import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Row, Col, Spinner, Form } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaPlus, FaTrash, FaArrowLeft } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, push, set, update, serverTimestamp } from 'firebase/database';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { convertToWebP } from '../../firebase/imageUtils';
import { showConfirm, showAlert, toast } from '../../utils/alerts';
import ProgressiveImage from '../../components/ProgressiveImage';

interface PhotoItem {
  id: string;
  url: string;
  caption: string;
}

const PhotoManager: React.FC = () => {
  const { tenantId } = useTenant();
  const { albumId } = useParams();
  const navigate = useNavigate();
  
  const [album, setAlbum] = useState<any>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenantId || !albumId) return;

    // 1. Fetch Album Info
    onValue(getDBRef(tenantId, `gallery_albums/${albumId}`), (snap) => {
      setAlbum(snap.val());
    });

    // 2. Fetch Photos
    const photosRef = getDBRef(tenantId, 'gallery_photos');
    const unsubscribe = onValue(photosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(photo => photo.albumId === albumId && !photo.deleted);
        setPhotos(list);
      } else {
        setPhotos([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId, albumId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        const webpBlob = await convertToWebP(file, 0.7);
        const fileName = `photo_${Date.now()}.webp`;
        const fileRef = getStorageRef(tenantId, `gallery/${albumId}/${fileName}`);
        const uploadResult = await uploadBytes(fileRef, webpBlob);
        const url = await getDownloadURL(uploadResult.ref);

        const photoRef = push(getDBRef(tenantId, 'gallery_photos'));
        await set(photoRef, {
          albumId,
          url,
          caption: '',
          timestamp: serverTimestamp(),
          deleted: false
        });

        // Update photo count in album
        await update(getDBRef(tenantId, `gallery_albums/${albumId}`), {
          photoCount: photos.length + 1
        });
        await updateCounter(tenantId, 'totalPhotos', 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'GALERI', title: `Foto baru di ${album?.title}` });
        
        toast.fire({ icon: 'success', title: 'Foto berhasil diunggah' });
      } catch (error) {
        showAlert('Gagal', 'Gagal mengunggah foto.', 'error');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = async (photo: PhotoItem) => {
    if ((await showConfirm('Hapus Foto?', 'Foto ini akan dihapus dari album.')).isConfirmed) {
      try {
        await update(getDBRef(tenantId, `gallery_photos/${photo.id}`), { deleted: true });
        await update(getDBRef(tenantId, `gallery_albums/${albumId}`), {
          photoCount: Math.max(0, photos.length - 1)
        });
        await updateCounter(tenantId, 'totalPhotos', -1);
        toast.fire({ icon: 'success', title: 'Foto dihapus' });
      } catch (error) {
        showAlert('Gagal', 'Terjadi kesalahan.', 'error');
      }
    }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center">
            <Button onClick={() => navigate('/dashboard/galeri')} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button>
            <div>
              <h4 className="fw-bold text-dark mb-0">{album?.title || 'Memuat...'}</h4>
              <p className="text-muted small mb-0">Kelola foto dalam album ini.</p>
            </div>
          </div>
          <div>
            <Form.Control type="file" accept="image/*" onChange={handleUpload} className="d-none" id="photo-add" disabled={uploading} />
            <Button as="label" htmlFor="photo-add" variant="primary" className="px-4 py-2 fw-bold shadow-sm" disabled={uploading}>
              {uploading ? <Spinner size="sm" className="me-2" /> : <FaPlus className="me-2" />}
              Upload Foto Baru
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <Row>
              {loading ? (
                <Col className="text-center py-5"><Spinner animation="border" variant="primary" /></Col>
              ) : photos.length === 0 ? (
                <Col className="text-center py-5 text-muted">Belum ada foto di album ini. Silakan klik tombol Upload.</Col>
              ) : (
                photos.map((photo) => (
                  <Col key={photo.id} xs={6} md={4} lg={3} className="mb-4">
                    <div className="position-relative photo-item rounded overflow-hidden shadow-sm">
                      <ProgressiveImage src={photo.url} style={{ height: '180px', width: '100%' }} alt="" />
                      <div className="photo-overlay d-flex align-items-center justify-content-center">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(photo)} className="btn-icon">
                          <FaTrash size={12} />
                        </Button>
                      </div>
                    </div>
                  </Col>
                ))
              )}
            </Row>
          </Card.Body>
        </Card>
      </Container>
      <style>{`
        .photo-item { position: relative; cursor: pointer; }
        .photo-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); opacity: 0; transition: 0.3s; }
        .photo-item:hover .photo-overlay { opacity: 1; }
        .btn-icon { width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; }
      `}</style>
    </DashboardLayout>
  );
};

export default PhotoManager;
