import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Row, Col, Spinner } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, push, set, update } from 'firebase/database';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { showAlert, toast, showConfirm } from '../../utils/alerts';

interface Photo {
  id: string;
  url: string;
  createdAt: number;
}

interface Album {
  id: string;
  title: string;
}

const PhotoManager: React.FC = () => {
  const { tenantId } = useTenant();
  const { albumId } = useParams();
  const navigate = useNavigate();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenantId || !albumId) return;

    // 1. Fetch Album Info
    onValue(getDBRef(tenantId, `gallery_albums/${albumId}`), (snap) => {
      setAlbum(snap.val() ? { id: albumId, ...snap.val() } : null);
    });

    // 2. Fetch Photos
    const photosRef = getDBRef(tenantId, 'gallery_photos');
    onValue(photosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter((p: any) => p.albumId === albumId && !p.deleted);
        setPhotos(list);
      } else setPhotos([]);
      setLoading(false);
    });
  }, [tenantId, albumId]);

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
      await set(photoRef, {
        albumId,
        url,
        createdAt: Date.now(),
        deleted: false
      });

      // Update photo count in album
      await update(getDBRef(tenantId, `gallery_albums/${albumId}`), {
        photoCount: (photos.length + 1)
      });
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
        await update(getDBRef(tenantId, `gallery_albums/${albumId}`), {
          photoCount: Math.max(0, photos.length - 1)
        });
        await updateCounter(tenantId, 'totalPhotos', -1);
      } catch (error) { showAlert('Gagal', 'Gagal menghapus.', 'error'); }
    }
  };

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
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

        <Row>
          {photos.length === 0 ? (<Col className="text-center py-5 text-muted small">Belum ada foto di album ini.</Col>) : (
            photos.map(photo => (
              <Col key={photo.id} md={3} sm={6} className="mb-4">
                <Card className="border-0 shadow-sm rounded-3 overflow-hidden position-relative group">
                  <img src={photo.url} className="img-fluid" style={{ height: '200px', width: '100%', objectFit: 'cover' }} alt="" />
                  <div className="position-absolute top-0 end-0 p-2">
                     <Button onClick={() => handleDelete(photo)} variant="danger" size="sm" className="shadow-sm"><FaTrash size={12} /></Button>
                  </div>
                </Card>
              </Col>
            ))
          )}
        </Row>
      </Container>
    </DashboardLayout>
  );
};

export default PhotoManager;
