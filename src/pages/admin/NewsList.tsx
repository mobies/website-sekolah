import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaEye, FaUndo } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, update, serverTimestamp } from 'firebase/database';
import { showConfirm, showAlert, toast } from '../../utils/alerts';

interface NewsItem {
  id: string;
  title: string;
  category: string;
  date: string;
  status: 'published' | 'draft';
  thumbnail?: string;
  deleted?: boolean;
}

const NewsList: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const newsRef = getDBRef(tenantId, 'news');
    const unsubscribe = onValue(newsRef, (snapshot) => {
      clearTimeout(timeout);
      try {
        const data = snapshot.val();
        if (data) {
          const newsList: NewsItem[] = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          newsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setNews(newsList);
        } else {
          setNews([]);
        }
      } catch (err) {
        console.error("Error processing news data:", err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      clearTimeout(timeout);
      console.error("Firebase news fetch error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [tenantId]);

  const filteredNews = news.filter(item => !!item.deleted === showDeleted);

  const handleDelete = async (item: NewsItem) => {
    const result = await showConfirm('Pindahkan ke Sampah?', `Berita "${item.title}" akan dipindahkan ke folder sampah.`);
    if (result.isConfirmed) {
      try {
        const itemRef = getDBRef(tenantId, `news/${item.id}`);
        await update(itemRef, { 
          deleted: true, 
          deletedAt: serverTimestamp() 
        });
        await updateCounter(tenantId, 'totalNews', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'BERITA', title: item.title });
        toast.fire({ icon: 'success', title: 'Berita dipindahkan ke sampah' });
      } catch (error) {
        showAlert('Gagal', 'Gagal menghapus berita.', 'error');
      }
    }
  };

  const handleRestore = async (item: NewsItem) => {
    try {
      const itemRef = getDBRef(tenantId, `news/${item.id}`);
      await update(itemRef, { 
        deleted: false, 
        deletedAt: null 
      });
      await updateCounter(tenantId, 'totalNews', 1);
      await logActivity(tenantId, { action: 'RESTORE', target: 'BERITA', title: item.title });
      toast.fire({ icon: 'success', title: 'Berita berhasil dipulihkan' });
    } catch (error) {
      showAlert('Gagal', 'Gagal memulihkan berita.', 'error');
    }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Kelola Berita {showDeleted ? '(Sampah)' : ''}</h4>
            <p className="text-muted small">Daftar semua artikel dan berita {terms.school.toLowerCase()}.</p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => setShowDeleted(!showDeleted)}>
              {showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}
            </Button>
            <Button as={Link as any} to="/dashboard/berita/tambah" variant="success" className="d-flex align-items-center">
              <FaPlus className="me-2" /> Tambah Berita
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle">
              <thead className="bg-light">
                <tr className="small text-muted">
                  <th className="ps-4 py-3 fw-bold border-0">BERITA</th>
                  <th className="py-3 fw-bold border-0">KATEGORI</th>
                  <th className="py-3 fw-bold border-0">TANGGAL</th>
                  <th className="py-3 fw-bold border-0 text-center">STATUS</th>
                  <th className="py-3 fw-bold border-0 pe-4 text-end">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-5 text-muted small">Memuat data...</td></tr>
                ) : filteredNews.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-5 text-muted small">Tidak ada berita {showDeleted ? 'di sampah' : ''}.</td></tr>
                ) : (
                  filteredNews.map((item) => (
                    <tr key={item.id}>
                      <td className="ps-4 py-3">
                        <div className="d-flex align-items-center">
                          <img src={item.thumbnail || 'https://via.placeholder.com/50'} alt="" className="rounded me-3" style={{ width: '45px', height: '45px', objectFit: 'cover' }} />
                          <span className="fw-bold text-dark small">{item.title}</span>
                        </div>
                      </td>
                      <td className="py-3 small text-muted text-capitalize">{item.category}</td>
                      <td className="py-3 small text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                      <td className="py-3 text-center">
                        <Badge bg={item.status === 'published' ? 'success' : 'warning'} pill className={`${item.status === 'published' ? '' : 'text-dark'} fw-medium px-3 py-2`} style={{ fontSize: '0.65rem' }}>{item.status.toUpperCase()}</Badge>
                      </td>
                      <td className="pe-4 py-3 text-end">
                        <div className="d-flex justify-content-end gap-2">
                          {showDeleted ? (
                            <Button onClick={() => handleRestore(item)} variant="light" size="sm" className="btn-icon text-success"><FaUndo size={14} /></Button>
                          ) : (
                            <>
                              <Button variant="light" size="sm" className="btn-icon text-primary"><FaEye size={14} /></Button>
                              <Button as={Link as any} to={`/dashboard/berita/edit/${item.id}`} variant="light" size="sm" className="btn-icon text-info"><FaEdit size={14} /></Button>
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
    </DashboardLayout>
  );
};

export default NewsList;
