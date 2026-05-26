import React, { useState, useEffect, useMemo } from 'react';
import { Container, Card, Button, Table, Spinner } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaEye, FaUndo, FaSyncAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, update, serverTimestamp, ref as dbRef, get } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { showConfirm, showAlert, toast } from '../../utils/alerts';

interface IndexItem {
  id: string;
  t: string;      // lowercase title
  title: string;
  date: string;
  c: string;      // category
  img?: string;   // thumbnail
  deleted: boolean;
}

const NewsList: React.FC = () => {
  const { tenantId } = useTenant();
  const location = useLocation();
  
  // Search state from URL Topbar
  const queryParams = new URLSearchParams(location.search);
  const q = queryParams.get('q') || '';

  const [indexData, setIndexData] = useState<IndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  // FETCH INDEX ONLY
  useEffect(() => {
    if (!tenantId) return;

    setLoading(true);
    const indexRef = getDBRef(tenantId, 'news_search_index');
    
    const unsubscribe = onValue(indexRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: IndexItem[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setIndexData(list);
      } else {
        setIndexData([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Index fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // LOCAL FILTERING
  const displayNews = useMemo(() => {
    let filtered = indexData.filter(item => !!item.deleted === showDeleted);
    if (q) {
      const lowQ = q.toLowerCase();
      filtered = filtered.filter(item => 
        item.t.includes(lowQ) || 
        (item.c && item.c.toLowerCase().includes(lowQ))
      );
    }
    return filtered;
  }, [indexData, showDeleted, q]);

  const handleDelete = async (item: IndexItem) => {
    if (!tenantId) return;
    const result = await showConfirm('Pindahkan ke Sampah?', `Berita "${item.title}" akan dipindahkan ke folder sampah.`);
    if (result.isConfirmed) {
      try {
        const updates: any = {};
        updates[`tenants/${tenantId}/news/${item.id}/deleted`] = true;
        updates[`tenants/${tenantId}/news/${item.id}/deletedAt`] = serverTimestamp();
        updates[`tenants/${tenantId}/news_search_index/${item.id}/deleted`] = true;
        
        await update(dbRef(database), updates);
        await updateCounter(tenantId, 'totalNews', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'BERITA', title: item.title });
        toast.fire({ icon: 'success', title: 'Berita dipindahkan ke sampah' });
      } catch (error) {
        showAlert('Gagal', 'Gagal menghapus berita.', 'error');
      }
    }
  };

  const handleRestore = async (item: IndexItem) => {
    if (!tenantId) return;
    try {
      const updates: any = {};
      updates[`tenants/${tenantId}/news/${item.id}/deleted`] = false;
      updates[`tenants/${tenantId}/news/${item.id}/deletedAt`] = null;
      updates[`tenants/${tenantId}/news_search_index/${item.id}/deleted`] = false;
      
      await update(dbRef(database), updates);
      await updateCounter(tenantId, 'totalNews', 1);
      await logActivity(tenantId, { action: 'RESTORE', target: 'BERITA', title: item.title });
      toast.fire({ icon: 'success', title: 'Berita berhasil dipulihkan' });
    } catch (error) {
      showAlert('Gagal', 'Gagal memulihkan berita.', 'error');
    }
  };

  const handleResummary = async () => {
    if (!tenantId) return;
    const result = await showConfirm('Hitung Ulang Statistik?', 'Sistem akan memindai seluruh data BERITA LENGKAP untuk membangun ulang statistik dan index.');
    if (!result.isConfirmed) return;

    setProcessing(true);
    try {
      const newsSnapshot = await get(getDBRef(tenantId, 'news'));
      const newsData = newsSnapshot.val();
      if (!newsData) { setProcessing(false); return; }

      const updates: any = {};
      const stats: any = { total: 0, categories: {}, years: {} };

      Object.keys(newsData).forEach(id => {
        const item = newsData[id];
        const category = (item.category || 'berita').toLowerCase();
        updates[`tenants/${tenantId}/news_search_index/${id}`] = {
          t: item.title.toLowerCase(), title: item.title, date: item.date, c: category, img: item.thumbnail || '', deleted: !!item.deleted
        };

        if (item.deleted) return;
        const date = new Date(item.date);
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        stats.total++;
        stats.categories[category] = (stats.categories[category] || 0) + 1;
        if (!stats.years[year]) stats.years[year] = { total: 0, months: {} };
        stats.years[year].total++;
        if (!stats.years[year].months[month]) stats.years[year].months[month] = { total: 0, days: {} };
        stats.years[year].months[month].total++;
        stats.years[year].months[month].days[day] = (stats.years[year].months[month].days[day] || 0) + 1;
      });

      updates[`tenants/${tenantId}/stats/news`] = stats;
      await update(dbRef(database), updates);
      toast.fire({ icon: 'success', title: 'Statistik & Index berhasil diperbarui' });
    } catch (error) {
      console.error(error);
      showAlert('Gagal', 'Gagal memperbarui statistik.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div><h4 className="fw-bold text-dark mb-1">Kelola Berita {showDeleted ? '(Sampah)' : ''}</h4></div>
          <div className="d-flex gap-2">
            <Button variant="outline-info" onClick={handleResummary} disabled={processing || loading}><FaSyncAlt /></Button>
            <Button variant="outline-secondary" onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}</Button>
            <Button as={Link as any} to="/dashboard/berita/tambah" variant="success"><FaPlus className="me-2" /> Tambah</Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm"><Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="bg-light">
              <tr className="small text-muted"><th className="ps-4">BERITA</th><th>KATEGORI</th><th>TANGGAL</th><th className="text-end pe-4">AKSI</th></tr>
            </thead>
            <tbody>
              {loading ? (<tr><td colSpan={4} className="text-center py-5"><Spinner animation="border" variant="success" size="sm" /></td></tr>) : displayNews.length === 0 ? (<tr><td colSpan={4} className="text-center py-5 small">Tidak ada berita.</td></tr>) : (
                displayNews.map((item) => (
                  <tr key={item.id}>
                    <td className="ps-4 py-3"><span className="fw-bold text-dark d-block small">{item.title}</span></td>
                    <td className="py-3 small text-muted text-capitalize">{item.c}</td>
                    <td className="py-3 small text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                    <td className="pe-4 py-3 text-end">
                      <div className="d-flex justify-content-end gap-2">
                        {showDeleted ? (<Button onClick={() => handleRestore(item)} variant="light" size="sm" className="text-success"><FaUndo size={14} /></Button>) : (
                          <><Button as={Link as any} to={`/berita/${item.id}`} target="_blank" variant="light" size="sm" className="text-primary"><FaEye size={14} /></Button>
                            <Button as={Link as any} to={`/dashboard/berita/edit/${item.id}`} variant="light" size="sm" className="text-info"><FaEdit size={14} /></Button>
                            <Button onClick={() => handleDelete(item)} variant="light" size="sm" className="text-danger"><FaTrash size={14} /></Button></>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card.Body></Card>
      </Container>
    </DashboardLayout>
  );
};

export default NewsList;
