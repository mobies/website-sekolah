import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaUndo } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, update, serverTimestamp } from 'firebase/database';
import { showConfirm, showAlert, toast } from '../../utils/alerts';

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  status: 'active' | 'completed';
  deleted?: boolean;
}

const AgendaList: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const agendaRef = getDBRef(tenantId, 'agenda');
    const unsubscribe = onValue(agendaRef, (snapshot) => {
      clearTimeout(timeout);
      try {
        const data = snapshot.val();
        if (data) {
          const list: AgendaItem[] = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setAgendas(list);
        } else {
          setAgendas([]);
        }
      } catch (err) {
        console.error("Error processing agenda data:", err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      clearTimeout(timeout);
      console.error("Firebase agenda fetch error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [tenantId]);

  const filteredAgendas = agendas.filter(item => !!item.deleted === showDeleted);

  const handleDelete = async (item: AgendaItem) => {
    const result = await showConfirm('Pindahkan ke Sampah?', `Agenda "${item.title}" akan dipindahkan ke folder sampah.`);
    if (result.isConfirmed) {
      try {
        await update(getDBRef(tenantId, `agenda/${item.id}`), { 
          deleted: true, 
          deletedAt: serverTimestamp() 
        });
        await updateCounter(tenantId, 'totalAgendas', -1);
        await logActivity(tenantId, { action: 'HAPUS', target: 'AGENDA', title: item.title });
        toast.fire({ icon: 'success', title: 'Agenda dipindahkan ke sampah' });
      } catch (error) {
        showAlert('Gagal', 'Gagal menghapus agenda.', 'error');
      }
    }
  };

  const handleRestore = async (item: AgendaItem) => {
    try {
      await update(getDBRef(tenantId, `agenda/${item.id}`), { 
        deleted: false, 
        deletedAt: null 
      });
      await updateCounter(tenantId, 'totalAgendas', 1);
      await logActivity(tenantId, { action: 'RESTORE', target: 'AGENDA', title: item.title });
      toast.fire({ icon: 'success', title: 'Agenda berhasil dipulihkan' });
    } catch (error) {
      showAlert('Gagal', 'Gagal memulihkan agenda.', 'error');
    }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Kelola Agenda {showDeleted ? '(Sampah)' : ''}</h4>
            <p className="text-muted small">Jadwal kegiatan {terms.school.toLowerCase()}.</p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => setShowDeleted(!showDeleted)}>
              {showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}
            </Button>
            <Button as={Link as any} to="/dashboard/agenda/tambah" variant="success">
              <FaPlus className="me-2" /> Tambah Agenda
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle">
              <thead className="bg-light">
                <tr className="small text-muted">
                  <th className="ps-4 py-3 border-0">KEGIATAN</th>
                  <th className="py-3 border-0">WAKTU</th>
                  <th className="py-3 border-0">LOKASI</th>
                  <th className="py-3 border-0 text-center">STATUS</th>
                  <th className="py-3 border-0 pe-4 text-end">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-5 small text-muted">Memuat...</td></tr>
                ) : filteredAgendas.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-5 small text-muted">Tidak ada agenda {showDeleted ? 'di sampah' : ''}.</td></tr>
                ) : (
                  filteredAgendas.map((item) => (
                    <tr key={item.id}>
                      <td className="ps-4 py-3 fw-bold small text-dark">{item.title}</td>
                      <td className="py-3 small text-muted">{new Date(item.date).toLocaleDateString('id-ID')}<br/>{item.time}</td>
                      <td className="py-3 small text-muted">{item.location}</td>
                      <td className="py-3 text-center">
                        <Badge bg={item.status === 'active' ? 'primary' : 'secondary'} pill className="fw-medium px-3 py-2" style={{ fontSize: '0.65rem' }}>
                          {item.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="pe-4 py-3 text-end">
                        {showDeleted ? (
                          <Button onClick={() => handleRestore(item)} variant="light" size="sm" className="btn-icon text-success"><FaUndo size={12} /></Button>
                        ) : (
                          <>
                            <Button as={Link as any} to={`/dashboard/agenda/edit/${item.id}`} variant="light" size="sm" className="btn-icon me-2"><FaEdit size={12} /></Button>
                            <Button onClick={() => handleDelete(item)} variant="light" size="sm" className="btn-icon text-danger"><FaTrash size={12} /></Button>
                          </>
                        )}
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

export default AgendaList;
