import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Row, Col, Spinner, Modal } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash, FaEye } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import ProgressiveImage from '../../components/ProgressiveImage';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, push, set, update, query, orderByChild, limitToLast, endAt, get, ref } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { showAlert, toast, showConfirm } from '../../utils/alerts';

interface Photo {
  id: string;
  url: string;
  createdAt: number;
  albumId: string;
  deleted?: boolean;
}

interface Album {
  id: string;
  title: string;
}

const PAGE_SIZE = 12;

const PhotoManager: React.FC = () => {
  const { tenantId } = useTenant();
  const { albumId } = useParams();
  const navigate = useNavigate();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // 1. Fetch Photos with Pagination
  const fetchPhotos = useCallback(async (isInitial = false) => {
    if (!tenantId || !albumId || (!isInitial && !hasMore) || loadingMore) return;
    
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const photosRef = ref(database, `tenants/${tenantId}/gallery_photos`);
      let photosQuery;
      
      if (isInitial) {
        photosQuery = query(photosRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
      } else {
        photosQuery = query(photosRef, orderByChild('createdAt'), endAt(lastTimestamp! - 1), limitToLast(PAGE_SIZE));
      }

      const snapshot = await get(photosQuery);
      const data = snapshot.val();
      
      if (data) {
        const items: Photo[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => item.albumId === albumId && !item.deleted)
          .sort((a, b) => b.createdAt - a.createdAt);

        if (items.length < PAGE_SIZE) setHasMore(false);
        
        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
          setPhotos(prev => isInitial ? items : [...prev, ...items]);
        } else if (isInitial) {
          setPhotos([]);
        }
      } else {
        setHasMore(false);
        if (isInitial) setPhotos([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantId, albumId, hasMore, loadingMore, lastTimestamp]);

  useEffect(() => {
    if (!tenantId || !albumId) return;
    
    // Fetch Album Info
    onValue(getDBRef(tenantId, `gallery_albums/${albumId}`), (snap) => {
      setAlbum(snap.val() ? { id: albumId, ...snap.val() } : null);
    });

    fetchPhotos(true);
  }, [tenantId, albumId]);

  // 2. Infinite Scroll Handler
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        fetchPhotos();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!tenantId || !albumId || !e.target.files?.[0]) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const fileName = `${Date.now()}_${file.name}`;
      const fileRef = getStorageRef(tenantId, `gallery/${albumId}/${fileName}`);
      
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const photoRef = push(getDBRef(tenantId, 'gallery_photos'));
      const newPhoto = {
        albumId,
        url,
        createdAt: Date.now(),
        deleted: false
      };
      await set(photoRef, newPhoto);

      // Add to local state
      setPhotos(prev => [{ id: photoRef.key!, ...newPhoto }, ...prev]);

      // Update photo count in album
      const albumRef = getDBRef(tenantId, `gallery_albums/${albumId}`);
      const albumSnap = await get(albumRef);
      const currentCount = albumSnap.val()?.photoCount || 0;
      await update(albumRef, { photoCount: currentCount + 1 });

      await updateCounter(tenantId, 'totalPhotos', 1);
      await logActivity(tenantId, { action: 'TAMBAH', target: 'GALERI', title: `Foto baru di ${album?.title}` });
      toast.fire({ icon: 'success', title: 'Foto berhasil diunggah' });
    } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); } finally { setUploading(false); }
  };

  const handleDelete = async (photo: Photo) => {
    if (!tenantId || !albumId) return;
    if ((await showConfirm('Hapus Foto?', 'Foto ini akan dihapus dari album.')).isConfirmed) {
      try {
        await update(getDBRef(tenantId, `gallery_photos/${photo.id}`), { deleted: true });
        setPhotos(prev => prev.filter(p => p.id !== photo.id));
        
        const albumRef = getDBRef(tenantId, `gallery_albums/${albumId}`);
        const albumSnap = await get(albumRef);
        const currentCount = albumSnap.val()?.photoCount || 0;
        await update(albumRef, { photoCount: Math.max(0, currentCount - 1) });
        
        await updateCounter(tenantId, 'totalPhotos', -1);
        toast.fire({ icon: 'success', title: 'Foto dihapus' });
      } catch (error) { showAlert('Gagal', 'Gagal menghapus.', 'error'); }
    }
  };

  const openPreview = (url: string) => {
    setSelectedPhoto(url);
    setShowPreview(true);
  };

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center">
             <Button onClick={() => navigate(-1)} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button>
             <div><h4 className="fw-bold text-dark mb-0">Kelola Foto</h4><p className="text-muted small mb-0">Album: {album?.title}</p></div>
          </div>
          <div className="d-flex gap-2">
             <input type="file" id="upload-photo" className="d-none" accept="image/*" onChange={handleUpload} />
             <Button onClick={() => document.getElementById('upload-photo')?.click()} variant="success" disabled={uploading}>{uploading ? <Spinner size="sm" /> : <><FaPlus className="me-2" /> Unggah Foto</>}</Button>
          </div>
        </div>

        <Row className="g-3">
          {photos.length === 0 ? (<Col className="text-center py-5 text-muted small">Belum ada foto di album ini.</Col>) : (
            photos.map(photo => (
              <Col key={photo.id} md={3} sm={6}>
                <Card className="border-0 shadow-sm rounded-4 overflow-hidden position-relative photo-card-admin">
                  <div className="photo-overlay d-flex align-items-center justify-content-center" onClick={() => openPreview(photo.url)}>
                     <div className="overlay-content text-white text-center">
                        <FaEye size={24} className="mb-2" />
                        <div className="fw-bold small uppercase tracking-wider">Preview</div>
                     </div>
                  </div>
                  <ProgressiveImage 
                    src={photo.url} 
                    className="img-fluid" 
                    style={{ height: '220px', width: '100%' }} 
                    alt="" 
                  />
                  <div className="position-absolute top-0 end-0 p-2 z-index-2">
                     <Button onClick={(e) => { e.stopPropagation(); handleDelete(photo); }} variant="danger" size="sm" className="rounded-circle shadow-sm btn-icon" style={{ width: '30px', height: '30px' }}><FaTrash size={12} /></Button>
                  </div>
                </Card>
              </Col>
            ))
          )}
        </Row>
        
        {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
        {!hasMore && photos.length > 0 && <div className="text-center py-4 text-muted small italic">Semua foto telah ditampilkan.</div>}
      </Container>

      {/* Preview Modal */}
      <Modal 
        show={showPreview} 
        onHide={() => setShowPreview(false)} 
        centered 
        size="lg"
        contentClassName="bg-transparent border-0 shadow-none"
        backdropClassName="bg-dark bg-opacity-75"
      >
        <Modal.Header closeButton closeVariant="white" className="border-0 p-3"></Modal.Header>
        <Modal.Body className="p-0 text-center">
           {selectedPhoto && (
             <div className="preview-image-container rounded-4 overflow-hidden shadow-lg mx-auto d-inline-block">
                <img src={selectedPhoto} alt="Preview" className="img-fluid" style={{ maxHeight: '85vh', objectFit: 'contain' }} />
             </div>
           )}
        </Modal.Body>
      </Modal>

      <style>{`
        .photo-card-admin {
          transition: transform 0.3s ease;
          cursor: pointer;
        }
        .photo-card-admin:hover {
          transform: translateY(-5px);
        }
        .photo-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.4);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 1;
        }
        .photo-card-admin:hover .photo-overlay {
          opacity: 1;
        }
        .z-index-2 { z-index: 2; }
        .preview-image-container {
          background-color: #000;
        }
        .tracking-wider { letter-spacing: 0.1em; }
      `}</style>
    </DashboardLayout>
  );
};

export default PhotoManager;
