import React, { useState, useEffect, useMemo } from 'react';
import { Container, Card, Button, Table, Spinner } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaUndo, FaSyncAlt } from 'react-icons/fa';
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
  time: string;
  loc: string;
  deleted: boolean;
}

const AgendaList: React.FC = () => {
  const { tenantId } = useTenant();
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q') || '';

  const [indexData, setIndexData] = useState<IndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const indexRef = getDBRef(tenantId, 'agenda_search_index');
    const unsubscribe = onValue(indexRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: IndexItem[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setIndexData(list);
      } else setIndexData([]);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, [tenantId]);

  const displayItems = useMemo(() => {
    let filtered = indexData.filter(item => !!item.deleted === showDeleted);
    if (q) {
      const lowQ = q.toLowerCase();
      filtered = filtered.filter(item => item.t.includes(lowQ) || (item.loc && item.loc.toLowerCase().includes(lowQ)));
    }
    return filtered;
  }, [indexData, showDeleted, q]);

  const handleDelete = async (item: IndexItem) => {
    if (!tenantId) return;
    const result = await showConfirm('Pindahkan ke Sampah?', `Agenda "${item.title}" akan dipindahkan.`);
    if (result.isConfirmed) {
      try {
        const updates: any = {};
        updates[`tenants/${tenantId}/agenda/${item.id}/deleted`] = true;
        updates[`tenants/${tenantId}/agenda/${item.id}/deletedAt`] = serverTimestamp();
        updates[`tenants/${tenantId}/agenda_search_index/${item.id}/deleted`] = true;
        await update(dbRef(database), updates);
        await updateCounter(tenantId, 'totalAgendas', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'AGENDA', title: item.title });
        toast.fire({ icon: 'success', title: 'Berhasil dihapus' });
      } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
    }
  };

  const handleRestore = async (item: IndexItem) => {
    if (!tenantId) return;
    try {
      const updates: any = {};
      updates[`tenants/${tenantId}/agenda/${item.id}/deleted`] = false;
      updates[`tenants/${tenantId}/agenda/${item.id}/deletedAt`] = null;
      updates[`tenants/${tenantId}/agenda_search_index/${item.id}/deleted`] = false;
      await update(dbRef(database), updates);
      await updateCounter(tenantId, 'totalAgendas', 1);
      await logActivity(tenantId, { action: 'RESTORE', target: 'AGENDA', title: item.title });
      toast.fire({ icon: 'success', title: 'Berhasil dipulihkan' });
    } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
  };

  const handleResummary = async () => {
    if (!tenantId) return;
    const result = await showConfirm('Hitung Ulang?', 'Scan ulang data agenda.');
    if (!result.isConfirmed) return;
    setProcessing(true);
    try {
      const snapshot = await get(getDBRef(tenantId, 'agenda'));
      const data = snapshot.val();
      if (!data) { setProcessing(false); return; }
      const updates: any = {};
      const stats: any = { total: 0, years: {} };
      Object.keys(data).forEach(id => {
        const item = data[id];
        updates[`tenants/${tenantId}/agenda_search_index/${id}`] = { t: item.title.toLowerCase(), title: item.title, date: item.date, time: item.time, loc: item.location, deleted: !!item.deleted };
        if (!item.deleted) {
          const date = new Date(item.date);
          const y = date.getFullYear().toString();
          const m = (date.getMonth() + 1).toString().padStart(2, '0');
          stats.total++;
          if (!stats.years[y]) stats.years[y] = { total: 0, months: {} };
          stats.years[y].total++;
          if (!stats.years[y].months[m]) stats.years[y].months[m] = { total: 0, days: {} };
          stats.years[y].months[m].total++;
        }
      });
      updates[`tenants/${tenantId}/stats/agenda`] = stats;
      await update(dbRef(database), updates);
      toast.fire({ icon: 'success', title: 'Sinkronisasi selesai' });
    } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); } finally { setProcessing(false); }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div><h4 className="fw-bold text-dark mb-1">Kelola Agenda {showDeleted ? '(Sampah)' : ''}</h4></div>
          <div className="d-flex gap-2">
            <Button variant="outline-info" onClick={handleResummary} disabled={processing || loading}><FaSyncAlt /></Button>
            <Button variant="outline-secondary" onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}</Button>
            <Button as={Link as any} to="/dashboard/agenda/tambah" variant="success"><FaPlus className="me-2" /> Tambah</Button>
          </div>
        </div>
        <Card className="border-0 shadow-sm"><Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="bg-light"><tr className="small text-muted"><th className="ps-4">KEGIATAN</th><th>WAKTU</th><th>LOKASI</th><th className="text-end pe-4">AKSI</th></tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan={4} className="text-center py-5"><Spinner animation="border" variant="success" size="sm" /></td></tr>) : displayItems.length === 0 ? (<tr><td colSpan={4} className="text-center py-5 small">Kosong.</td></tr>) : (
                displayItems.map((item) => (
                  <tr key={item.id}>
                    <td className="ps-4 py-3"><span className="fw-bold text-dark d-block small">{item.title}</span></td>
                    <td className="py-3 small text-muted">{new Date(item.date).toLocaleDateString('id-ID')}<br/><span style={{fontSize:'0.7rem'}}>{item.time}</span></td>
                    <td className="py-3 small text-muted text-truncate" style={{ maxWidth: '200px' }}>{item.loc}</td>
                    <td className="pe-4 py-3 text-end">
                        <div className="d-flex justify-content-end gap-2">
                          {showDeleted ? (<Button onClick={() => handleRestore(item)} variant="light" size="sm" className="text-success"><FaUndo /></Button>) : (
                          <><Button as={Link as any} to={`/dashboard/agenda/edit/${item.id}`} variant="light" size="sm" className="text-info"><FaEdit /></Button>
                            <Button onClick={() => handleDelete(item)} variant="light" size="sm" className="text-danger"><FaTrash /></Button></>
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

export default AgendaList;
