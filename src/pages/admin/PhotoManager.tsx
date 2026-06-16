import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Row, Col, Spinner, Modal } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash, FaEye, FaSyncAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import ProgressiveImage from '../../components/ProgressiveImage';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter, uploadBytesWithCache } from '../../firebase/utils';
import { onValue, push, set, update, query, orderByChild, limitToLast, endAt, get, ref as dbRef } from 'firebase/database';
import { rtdb as database, storage } from '../../firebase/config';
import { getDownloadURL, ref, deleteObject } from 'firebase/storage';
import { showAlert, toast, showConfirm } from '../../utils/alerts';
import { convertToWebP, convertUrlToWebP, getImageMetadata, getStoragePathFromDownloadURL } from '../../firebase/imageUtils';
import type { ImageMetadata } from '../../firebase/imageUtils';
import { useIsOwner } from '../../firebase/useIsOwner';

interface Photo {
  id: string;
  url: string;
  createdAt: number;
  albumId: string;
  deleted?: boolean;
  metadata?: ImageMetadata | null;
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
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  
  const [isReconverting, setIsReconverting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reconvertedBlob, setReconvertedBlob] = useState<Blob | null>(null);
  const [reconvertedPreviewUrl, setReconvertedPreviewUrl] = useState<string | null>(null);
  const [reconvertTarget, setReconvertTarget] = useState<Photo | null>(null);
  const { isOwner } = useIsOwner();

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const fetchPhotos = useCallback(async (isInitial = false) => {
    if (!tenantId || !albumId || (!isInitial && !hasMore) || loadingMore) return;
    if (isInitial) setLoading(true); else setLoadingMore(true);
    try {
      const photosRef = dbRef(database, `tenants/${tenantId}/gallery_photos`);
      let photosQuery;
      if (isInitial) {
        photosQuery = query(photosRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
      } else {
        photosQuery = query(photosRef, orderByChild('createdAt'), endAt(lastTimestamp! - 1), limitToLast(PAGE_SIZE));
      }
      const snapshot = await get(photosQuery);
      const data = snapshot.val();
      if (data) {
        const items: Photo[] = Object.keys(data).map(key => ({ id: key, ...data[key] })).filter(item => item.albumId === albumId && !item.deleted).sort((a, b) => b.createdAt - a.createdAt);
        const itemsWithMetadata = await Promise.all(
          items.map(async (photo) => {
            if (photo.url) {
              const storagePath = getStoragePathFromDownloadURL(photo.url);
              if (storagePath) {
                const metadata = await getImageMetadata(storagePath);
                return { ...photo, metadata };
              }
            }
            return photo;
          })
        );
        if (itemsWithMetadata.length < PAGE_SIZE) setHasMore(false);
        if (itemsWithMetadata.length > 0) {
          setLastTimestamp(itemsWithMetadata[itemsWithMetadata.length - 1].createdAt);
          setPhotos(prev => isInitial ? itemsWithMetadata : [...prev, ...itemsWithMetadata]);
        } else if (isInitial) {
          setPhotos([]);
        }
      } else {
        setHasMore(false);
        if (isInitial) setPhotos([]);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); setLoadingMore(false); }
  }, [tenantId, albumId, hasMore, loadingMore, lastTimestamp]);

  useEffect(() => {
    if (!tenantId || !albumId) return;
    onValue(getDBRef(tenantId, `gallery_albums/${albumId}`), (snap) => setAlbum(snap.val() ? { id: albumId, ...snap.val() } : null));
    fetchPhotos(true);
  }, [tenantId, albumId, fetchPhotos]);

  useEffect(() => {
    const handleScroll = () => { if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) fetchPhotos(); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!tenantId || !albumId || !e.target.files?.[0]) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const webpBlob = await convertToWebP(file);
      const fileName = `${Date.now()}_gallery.webp`;
      const fileRef = getStorageRef(tenantId, `gallery/${albumId}/${fileName}`);
      await uploadBytesWithCache(fileRef, webpBlob);
      const url = await getDownloadURL(fileRef);
      const photoRef = push(dbRef(database, `tenants/${tenantId}/gallery_photos`));
      const newPhoto = { albumId, url, createdAt: Date.now(), deleted: false };
      await set(photoRef, newPhoto);
      setPhotos(prev => [{ id: photoRef.key!, ...newPhoto }, ...prev]);
      const albumRef = getDBRef(tenantId, `gallery_albums/${albumId}`);
      const albumSnap = await get(albumRef);
      const currentCount = albumSnap.val()?.photoCount || 0;
      await update(albumRef, { photoCount: currentCount + 1 });
      await updateCounter(tenantId, 'totalPhotos', 1);
      await logActivity(tenantId, { action: 'TAMBAH', target: 'GALERI', title: `Foto baru di ${album?.title}` });
      toast.fire({ icon: 'success', title: 'Foto berhasil diunggah' });
    } catch (error: any) { showAlert('Gagal', error.message || 'Terjadi kesalahan saat mengunggah.', 'error'); } finally { setUploading(false); }
  };

  const handleDelete = async (photo: Photo) => {
    if (!tenantId || !albumId) return;
    if ((await showConfirm('Hapus Foto?', 'Foto ini akan dihapus permanen.')).isConfirmed) {
      try {
        await deleteObject(ref(storage, photo.url)).catch(err => { if (err.code !== 'storage/object-not-found') throw err; });
        await update(dbRef(database, `tenants/${tenantId}/gallery_photos/${photo.id}`), { deleted: true });
        setPhotos(prev => prev.filter(p => p.id !== photo.id));
        const albumRef = getDBRef(tenantId, `gallery_albums/${albumId}`);
        const albumSnap = await get(albumRef);
        const currentCount = albumSnap.val()?.photoCount || 0;
        await update(albumRef, { photoCount: Math.max(0, currentCount - 1) });
        await updateCounter(tenantId, 'totalPhotos', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'GALERI', title: `Foto di ${album?.title || 'album'}` });
        toast.fire({ icon: 'success', title: 'Foto dihapus' });
      } catch (error: any) { showAlert('Gagal', error.message || 'Gagal menghapus foto.', 'error'); }
    }
  };

  const openPreview = (url: string) => { setSelectedPhoto(url); setShowPreview(true); };

  const handleReconvertClick = async (photo: Photo) => {
    if (!photo.url) return;
    const result = await showConfirm('Konversi Ulang Gambar?', 'Gambar ini akan dikonversi ke format WebP (maks 100KB). Lanjutkan?');
    if (!result.isConfirmed) return; setIsReconverting(true); setReconvertTarget(photo);
    try {
      const blob = await convertUrlToWebP(photo.url);
      setReconvertedBlob(blob);
      setReconvertedPreviewUrl(URL.createObjectURL(blob));
      setShowPreviewModal(true);
    } catch (error: any) { showAlert('Gagal Konversi', error.message, 'error'); } finally { setIsReconverting(false); }
  };

  const handleSaveReconvertedImage = async () => {
    if (!reconvertedBlob || !tenantId || !reconvertTarget) return; setIsReconverting(true);
    try {
      const { id, url: oldUrl, albumId } = reconvertTarget;
      const fileName = `${Date.now()}_gallery_reconverted.webp`;
      const fileRef = getStorageRef(tenantId, `gallery/${albumId}/${fileName}`);
      await uploadBytesWithCache(fileRef, reconvertedBlob);
      const newUrl = await getDownloadURL(fileRef);
      await update(dbRef(database, `tenants/${tenantId}/gallery_photos/${id}`), { url: newUrl });
      if (oldUrl) { try { await deleteObject(ref(storage, oldUrl)); } catch (err: any) { if (err.code !== 'storage/object-not-found') { /* console.error(\"Gagal hapus foto lama:\", err); */ } } }
      const newMetadata = await getImageMetadata(getStoragePathFromDownloadURL(newUrl)!);
      setPhotos(prev => prev.map(p => p.id === id ? { ...p, url: newUrl, metadata: newMetadata } : p));
      setShowPreviewModal(false); if(reconvertedPreviewUrl) URL.revokeObjectURL(reconvertedPreviewUrl); setReconvertedBlob(null); setReconvertedPreviewUrl(null); setReconvertTarget(null);
      toast.fire({ icon: 'success', title: 'Foto berhasil dikonversi' });
    } catch (error: any) { showAlert('Gagal', error.message, 'error'); } finally { setIsReconverting(false); }
  };

  const needsReconversion = (metadata: ImageMetadata | null | undefined) => metadata && (metadata.fileExtension !== 'webp' || metadata.sizeBytes > 102400);

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center"><Button onClick={() => navigate(-1)} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button><div><h4 className="fw-bold text-dark mb-0">Kelola Foto</h4><p className="text-muted small mb-0">Album: {album?.title}</p></div></div>
          <div className="d-flex gap-2"><input type="file" id="upload-photo" className="d-none" accept="image/*" onChange={handleUpload} /><Button onClick={() => document.getElementById('upload-photo')?.click()} variant="success" disabled={uploading}>{uploading ? <Spinner size="sm" /> : <><FaPlus className="me-2" /> Unggah Foto</>}</Button></div>
        </div>
        <Row className="g-3">
          {photos.length === 0 ? (<Col className="text-center py-5 text-muted small">Belum ada foto di album ini.</Col>) : (
            photos.map(photo => (
              <Col key={photo.id} md={3} sm={6}>
                <Card className="border-0 shadow-sm rounded-4 overflow-hidden position-relative photo-card-admin">
                  <div className="position-absolute top-0 start-0 p-2 z-index-2"><Button onClick={() => openPreview(photo.url)} variant="light" size="sm" className="rounded-circle shadow-sm btn-icon" style={{ width: '30px', height: '30px' }}><FaEye size={12} /></Button></div>
                  <ProgressiveImage src={photo.url} className="img-fluid" style={{ height: '220px', width: '100%' }} alt="" />
                  <div className="position-absolute top-0 end-0 p-2 z-index-2"><Button onClick={(e) => { e.stopPropagation(); handleDelete(photo); }} variant="danger" size="sm" className="rounded-circle shadow-sm btn-icon" style={{ width: '30px', height: '30px' }}><FaTrash size={12} /></Button></div>
                  {photo.metadata && (<div className="position-absolute bottom-0 start-0 w-100 p-2 bg-dark bg-opacity-75 text-white d-flex justify-content-between align-items-center"><span className="extra-small">{formatBytes(photo.metadata.sizeBytes)} .{photo.metadata.fileExtension}</span>{(isOwner || needsReconversion(photo.metadata)) && (<Button variant="link" className="p-0 text-warning" onClick={(e) => { e.stopPropagation(); handleReconvertClick(photo); }} disabled={isReconverting}><FaSyncAlt size={14} /></Button>)}</div>)}

                </Card>
              </Col>
            ))
          )}
        </Row>
        {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
        {!hasMore && photos.length > 0 && <div className="text-center py-4 text-muted small">Semua foto telah ditampilkan.</div>}
      </Container>
      <Modal show={showPreview} onHide={() => setShowPreview(false)} centered size="lg" contentClassName="bg-transparent border-0 shadow-none"><Modal.Header closeButton closeVariant="white" className="border-0 p-3"></Modal.Header><Modal.Body className="p-0 text-center">{selectedPhoto && (<div className="preview-image-container rounded-4 overflow-hidden shadow-lg mx-auto d-inline-block"><img src={selectedPhoto} alt="Preview" className="img-fluid" style={{ maxHeight: '85vh', objectFit: 'contain' }} /></div>)}</Modal.Body></Modal>
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered contentClassName="bg-transparent border-0"><Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header><Modal.Body className="text-center">{reconvertedPreviewUrl && <img src={reconvertedPreviewUrl} className="img-fluid rounded shadow-lg" alt="Preview Konversi" />}{reconvertedBlob && <p className="text-white small mt-3">Pratinjau hasil konversi. Ukuran file baru: {formatBytes(reconvertedBlob.size)}</p>}</Modal.Body><Modal.Footer className="border-0 justify-content-center"><Button variant="light" onClick={() => setShowPreviewModal(false)}>Batal</Button><Button variant="success" onClick={handleSaveReconvertedImage} disabled={isReconverting}>{isReconverting ? <Spinner size="sm" /> : "Simpan & Ganti Gambar"}</Button></Modal.Footer></Modal>
      <style>{`.photo-card-admin { transition: transform 0.3s ease; cursor: pointer; } .photo-card-admin:hover { transform: translateY(-5px); } .z-index-2 { z-index: 2; } .preview-image-container { background-color: #000; }`}</style>
    </DashboardLayout>
  );
};

export default PhotoManager;
