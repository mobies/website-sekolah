import React, { useState, useEffect, useMemo } from 'react';
import { Container, Card, Button, Table } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaUndo, FaImages } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import ProgressiveImage from '../../components/ProgressiveImage'; // Added
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, update, serverTimestamp } from 'firebase/database';
import { showConfirm, showAlert, toast } from '../../utils/alerts';

interface Album {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  photoCount: number;
  deleted?: boolean;
}

const GalleryList: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q') || '';
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const albumsRef = getDBRef(tenantId, 'gallery_albums');
    const unsubscribe = onValue(albumsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const list: Album[] = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setAlbums(list.sort((a, b) => b.id.localeCompare(a.id)));
        } else {
          setAlbums([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [tenantId]);

  const filteredAlbums = useMemo(() => {
    let list = albums.filter(item => !!item.deleted === showDeleted);
    if (q) {
      list = list.filter(item => 
        item.title.toLowerCase().includes(q.toLowerCase()) || 
        item.description.toLowerCase().includes(q.toLowerCase())
      );
    }
    return list;
  }, [albums, showDeleted, q]);

  const handleDelete = async (album: Album) => {
    if (!tenantId) return;
    const result = await showConfirm('Hapus Album?', `Album "${album.title}" akan dipindahkan ke folder sampah.`);
    if (result.isConfirmed) {
      try {
        const albumRef = getDBRef(tenantId, `gallery_albums/${album.id}`);
        await update(albumRef, { 
          deleted: true, 
          deletedAt: serverTimestamp() 
        });
        await updateCounter(tenantId, 'totalAlbums', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'GALERI', title: album.title });
        toast.fire({ icon: 'success', title: 'Album dihapus' });
      } catch (error) {
        showAlert('Gagal', 'Terjadi kesalahan.', 'error');
      }
    }
  };

  const handleRestore = async (album: Album) => {
    if (!tenantId) return;
    try {
      const albumRef = getDBRef(tenantId, `gallery_albums/${album.id}`);
      await update(albumRef, { 
        deleted: false, 
        deletedAt: null 
      });
      await updateCounter(tenantId, 'totalAlbums', 1);
      await logActivity(tenantId, { action: 'RESTORE', target: 'GALERI', title: album.title });
      toast.fire({ icon: 'success', title: 'Album dipulihkan' });
    } catch (error) {
      showAlert('Gagal', 'Terjadi kesalahan.', 'error');
    }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Kelola Galeri Foto {showDeleted ? '(Sampah)' : ''}</h4>
            <p className="text-muted small">Kelola album foto kegiatan {terms.school.toLowerCase()}.</p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => setShowDeleted(!showDeleted)}>
              {showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}
            </Button>
            <Button as={Link as any} to="/dashboard/galeri/tambah" variant="success" className="d-flex align-items-center">
              <FaPlus className="me-2" /> Tambah Album
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle">
              <thead className="bg-light">
                <tr className="small text-muted">
                  <th className="ps-4 py-3 border-0">ALBUM</th>
                  <th className="py-3 border-0">JUMLAH FOTO</th>
                  <th className="py-3 border-0 text-end pe-4">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="text-center py-5 text-muted small">Memuat data...</td></tr>
                ) : filteredAlbums.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-5 text-muted small">Tidak ada album.</td></tr>
                ) : (
                  filteredAlbums.map((item) => (
                    <tr key={item.id}>
                      <td className="ps-4 py-3">
                        <div className="d-flex align-items-center">
                          <ProgressiveImage
                            src={item.coverImage || 'https://via.placeholder.com/50'}
                            alt={item.title}
                            className="rounded me-3"
                            style={{ width: '45px', height: '45px', objectFit: 'cover' }}
                          />
                          <div>
                            <span className="fw-bold text-dark d-block small">{item.title}</span>
                            <span className="text-muted extra-small d-block text-truncate" style={{ maxWidth: '300px' }}>{item.description}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 small text-muted">
                        {item.photoCount || 0} Foto
                      </td>
                      <td className="pe-4 py-3 text-end">
                        <div className="d-flex justify-content-end gap-2">
                          {showDeleted ? (
                            <Button onClick={() => handleRestore(item)} variant="light" size="sm" className="btn-icon text-success"><FaUndo size={14} /></Button>
                          ) : (
                            <>
                              <Button as={Link as any} to={`/dashboard/galeri/kelola/${item.id}`} variant="light" size="sm" className="btn-icon text-primary" title="Kelola Foto"><FaImages size={14} /></Button>
                              <Button as={Link as any} to={`/dashboard/galeri/edit/${item.id}`} variant="light" size="sm" className="btn-icon text-info"><FaEdit size={14} /></Button>
                              <Button onClick={() => handleDelete(item)} variant="light" size="sm" className="btn-icon text-danger"><FaTrash size={14} /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      </Container>
      <style>{`.extra-small { font-size: 0.7rem; }`}</style>
    </DashboardLayout>
  );
};

export default GalleryList;
