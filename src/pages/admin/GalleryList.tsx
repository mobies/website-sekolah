import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Badge, Row, Col, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaUndo } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, update, serverTimestamp } from 'firebase/database';
import { showConfirm, showAlert, toast } from '../../utils/alerts';
import ProgressiveImage from '../../components/ProgressiveImage';

interface AlbumItem {
  id: string;
  title: string;
  date: string;
  thumbnail?: string;
  photoCount?: number;
  deleted?: boolean;
}

const GalleryList: React.FC = () => {
  const { tenantId } = useTenant();
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const timeout = setTimeout(() => setLoading(false), 5000);
    
    const albumsRef = getDBRef(tenantId, 'gallery_albums');
    const unsubscribe = onValue(albumsRef, (snapshot) => {
      clearTimeout(timeout);
      const data = snapshot.val();
      if (data) {
        const list: AlbumItem[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAlbums(list);
      } else {
        setAlbums([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [tenantId]);

  const filteredAlbums = albums.filter(item => !!item.deleted === showDeleted);

  const handleDelete = async (album: AlbumItem) => {
    const result = await showConfirm('Hapus Album?', `Album "${album.title}" dan isinya akan dipindahkan ke sampah.`);
    if (result.isConfirmed) {
      try {
        await update(getDBRef(tenantId, `gallery_albums/${album.id}`), { 
          deleted: true, 
          deletedAt: serverTimestamp() 
        });
        await updateCounter(tenantId, 'totalAlbums', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'GALERI', title: album.title });
        toast.fire({ icon: 'success', title: 'Album dipindahkan ke sampah' });
      } catch (error) {
        showAlert('Gagal', 'Gagal menghapus album.', 'error');
      }
    }
  };

  const handleRestore = async (album: AlbumItem) => {
    try {
      await update(getDBRef(tenantId, `gallery_albums/${album.id}`), { 
        deleted: false, 
        deletedAt: null 
      });
      await updateCounter(tenantId, 'totalAlbums', 1);
      await logActivity(tenantId, { action: 'RESTORE', target: 'GALERI', title: album.title });
      toast.fire({ icon: 'success', title: 'Album dipulihkan' });
    } catch (error) {
      showAlert('Gagal', 'Gagal memulihkan album.', 'error');
    }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Galeri Kegiatan {showDeleted ? '(Sampah)' : ''}</h4>
            <p className="text-muted small">Kelola dokumentasi foto berdasarkan kegiatan.</p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => setShowDeleted(!showDeleted)}>
              {showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}
            </Button>
            <Button as={Link as any} to="/dashboard/galeri/tambah" variant="success" className="d-flex align-items-center">
              <FaPlus className="me-2" /> Buat Album Kegiatan
            </Button>
          </div>
        </div>

        <Row>
          {loading ? (
            <Col className="text-center py-5"><Spinner animation="border" variant="success" /></Col>
          ) : filteredAlbums.length === 0 ? (
            <Col className="text-center py-5 text-muted small">Belum ada album kegiatan {showDeleted ? 'di sampah' : ''}.</Col>
          ) : (
            filteredAlbums.map((album) => (
              <Col key={album.id} md={4} lg={3} className="mb-4">
                <Card className="border-0 shadow-sm h-100 overflow-hidden album-card">
                  <ProgressiveImage 
                    src={album.thumbnail || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=400&h=250&fit=crop'} 
                    style={{ height: '160px' }} 
                    alt={album.title}
                  />
                  <Card.Body className="p-3">
                    <h6 className="fw-bold text-dark small mb-1 truncate-2" style={{ height: '40px' }}>{album.title}</h6>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {new Date(album.date).toLocaleDateString('id-ID')}
                      </small>
                      <Badge bg="light" text="dark" className="border">
                        {album.photoCount || 0} Foto
                      </Badge>
                    </div>
                    <div className="d-flex gap-2">
                      {showDeleted ? (
                        <Button onClick={() => handleRestore(album)} variant="success" size="sm" className="w-100 d-flex align-items-center justify-content-center">
                          <FaUndo className="me-2" /> Pulihkan
                        </Button>
                      ) : (
                        <>
                          <Button as={Link as any} to={`/dashboard/galeri/kelola/${album.id}`} variant="primary" size="sm" className="flex-grow-1">
                            Kelola Foto
                          </Button>
                          <Button as={Link as any} to={`/dashboard/galeri/edit/${album.id}`} variant="light" size="sm" className="btn-icon">
                            <FaEdit size={12} />
                          </Button>
                          <Button onClick={() => handleDelete(album)} variant="light" size="sm" className="btn-icon text-danger">
                            <FaTrash size={12} />
                          </Button>
                        </>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))
          )}
        </Row>
      </Container>
      <style>{`
        .truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .btn-icon { width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #eee; }
        .album-card { transition: transform 0.2s; }
        .album-card:hover { transform: translateY(-5px); }
      `}</style>
    </DashboardLayout>
  );
};

export default GalleryList;
