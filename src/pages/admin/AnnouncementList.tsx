import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaUndo } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, update, serverTimestamp } from 'firebase/database';
import { showConfirm, showAlert, toast } from '../../utils/alerts';

interface AnnouncementItem {
  id: string;
  title: string;
  date: string;
  status: 'published' | 'draft';
  deleted?: boolean;
}

const AnnouncementList: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const timeout = setTimeout(() => setLoading(false), 5000);
    const unsubscribe = onValue(getDBRef(tenantId, 'announcements'), (snap) => {
      clearTimeout(timeout);
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setItems(list);
      } else setItems([]);
      setLoading(false);
    });
    return () => { unsubscribe(); clearTimeout(timeout); };
  }, [tenantId]);

  const filteredItems = items.filter(item => !!item.deleted === showDeleted);

  const handleDelete = async (item: AnnouncementItem) => {
    if ((await showConfirm('Hapus Pengumuman?', 'Pindahkan ke sampah.')).isConfirmed) {
      try {
        await update(getDBRef(tenantId, `announcements/${item.id}`), { deleted: true, deletedAt: serverTimestamp() });
        await updateCounter(tenantId, 'totalAnnouncements', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'PENGUMUMAN', title: item.title });
        toast.fire({ icon: 'success', title: 'Berhasil dihapus' });
      } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
    }
  };

  const handleRestore = async (item: AnnouncementItem) => {
    try {
      await update(getDBRef(tenantId, `announcements/${item.id}`), { deleted: false, deletedAt: null });
      await updateCounter(tenantId, 'totalAnnouncements', 1);
      await logActivity(tenantId, { action: 'RESTORE', target: 'PENGUMUMAN', title: item.title });
      toast.fire({ icon: 'success', title: 'Dipulihkan' });
    } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div><h4 className="fw-bold mb-1">Kelola Pengumuman {showDeleted ? '(Sampah)' : ''}</h4><p className="text-muted small">Informasi penting untuk {terms.student}.</p></div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}</Button>
            <Button as={Link as any} to="/dashboard/pengumuman/tambah" variant="success"><FaPlus className="me-2" /> Tambah</Button>
          </div>
        </div>
        <Card className="border-0 shadow-sm"><Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="bg-light"><tr className="small text-muted"><th className="ps-4 py-3 border-0">PENGUMUMAN</th><th className="py-3 border-0">TANGGAL</th><th className="py-3 border-0 text-center">STATUS</th><th className="py-3 border-0 pe-4 text-end">AKSI</th></tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan={4} className="text-center py-5 small text-muted">Memuat...</td></tr>) : filteredItems.length === 0 ? (<tr><td colSpan={4} className="text-center py-5 small text-muted">Kosong.</td></tr>) : (
                filteredItems.map(item => (
                  <tr key={item.id}>
                    <td className="ps-4 py-3 fw-bold small text-dark">{item.title}</td>
                    <td className="py-3 small text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                    <td className="py-3 text-center"><Badge bg={item.status === 'published' ? 'success' : 'warning'} pill className="fw-medium px-3 py-2" style={{ fontSize: '0.65rem' }}>{item.status.toUpperCase()}</Badge></td>
                    <td className="pe-4 py-3 text-end">
                      {showDeleted ? (<Button onClick={() => handleRestore(item)} variant="light" size="sm" className="btn-icon text-success"><FaUndo size={12} /></Button>) : (
                        <><Button as={Link as any} to={`/dashboard/pengumuman/edit/${item.id}`} variant="light" size="sm" className="btn-icon me-2"><FaEdit size={12} /></Button><Button onClick={() => handleDelete(item)} variant="light" size="sm" className="btn-icon text-danger"><FaTrash size={12} /></Button></>
                      )}
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

export default AnnouncementList;
