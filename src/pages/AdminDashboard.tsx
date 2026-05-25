import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/admin/DashboardLayout';
import { 
  FaNewspaper, 
  FaCalendarAlt, 
  FaBullhorn, 
  FaImages, 
  FaPlus, 
  FaEdit,
  FaTrash,
  FaUndo
} from 'react-icons/fa';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue, query, limitToLast, get, ref } from 'firebase/database';
import { auth, rtdb } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

interface ActivityLog {
  id: string;
  action: 'TAMBAH' | 'EDIT' | 'HAPUS' | 'RESTORE';
  target: 'BERITA' | 'AGENDA' | 'PENGUMUMAN' | 'GALERI';
  title: string;
  timestamp: number;
}

const AdminDashboard: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const navigate = useNavigate(); // Pastikan didefinisikan di sini
  const [stats, setStats] = useState({
    totalNews: 0,
    totalAgendas: 0,
    totalAnnouncements: 0,
    totalAlbums: 0,
    totalPhotos: 0
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    const forceLogout = async () => {
      await signOut(auth);
      navigate('/admin-login');
    };

    // Security Check
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate('/admin-login');
        return;
      }
      const settingsRef = ref(rtdb, `tenants/${tenantId}/settings`);
      const snapshot = await get(settingsRef);
      const settings = snapshot.val();
      if (!settings || settings.adminUid !== user.uid) {
        forceLogout();
      }
    };
    checkAuth();

    // 1. Fetch Stats
    const statsRef = getDBRef(tenantId, 'stats');
    onValue(statsRef, (snap) => {
      if (snap.val()) setStats(snap.val());
    });

    // 2. Fetch Last 10 Logs
    const logsRef = query(getDBRef(tenantId, 'logs'), limitToLast(10));
    onValue(logsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setLogs(list.reverse());
      }
      setLoading(false);
    });
  }, [tenantId]);

  const statCards = [
    { label: `Total Berita`, count: stats.totalNews, icon: <FaNewspaper />, color: '#0d6efd' },
    { label: `Agenda Aktif`, count: stats.totalAgendas, icon: <FaCalendarAlt />, color: '#198754' },
    { label: `Pengumuman`, count: stats.totalAnnouncements, icon: <FaBullhorn />, color: '#ffc107' },
    { label: `Album Galeri`, count: stats.totalAlbums, icon: <FaImages />, color: '#0dcaf0' },
  ];

  const getActionInfo = (action: string) => {
    switch (action) {
      case 'TAMBAH': return { label: 'Menambah', color: 'success', icon: <FaPlus size={10} /> };
      case 'EDIT': return { label: 'Mengubah', color: 'info', icon: <FaEdit size={10} /> };
      case 'HAPUS': return { label: 'Menghapus', color: 'danger', icon: <FaTrash size={10} /> };
      case 'RESTORE': return { label: 'Memulihkan', color: 'warning', icon: <FaUndo size={10} /> };
      default: return { label: action, color: 'secondary', icon: null };
    }
  };

  const getTargetIcon = (target: string) => {
    switch (target) {
      case 'BERITA': return <FaNewspaper size={14} />;
      case 'AGENDA': return <FaCalendarAlt size={14} />;
      case 'PENGUMUMAN': return <FaBullhorn size={14} />;
      case 'GALERI': return <FaImages size={14} />;
      default: return null;
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '-';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes}m yang lalu`;
    if (hours < 24) return `${hours}j yang lalu`;
    if (days < 7) return `${days}h yang lalu`;
    return new Date(timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="mb-4">
          <h4 className="fw-bold text-dark mb-1">Dashboard Overview</h4>
          <p className="text-muted small">Ringkasan aktivitas {terms.school} Anda.</p>
        </div>

        <Row className="mb-4">
          {statCards.map((stat, idx) => (
            <Col key={idx} md={3}>
              <Card className="border-0 shadow-sm overflow-hidden h-100">
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-muted fw-medium mb-1 small">{stat.label}</h6>
                      <h2 className="fw-bold mb-0">{stat.count || 0}</h2>
                    </div>
                    <div className="rounded-circle p-3 d-flex align-items-center justify-content-center" 
                         style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                      {stat.icon}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Row>
          <Col lg={8}>
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-dark small">Aktivitas Terakhir</h6>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle border-0">
                    <tbody className="border-0">
                      {logs.length === 0 ? (
                        <tr><td className="text-center py-4 text-muted small border-0">Belum ada aktivitas.</td></tr>
                      ) : (
                        logs.map((log) => {
                          const info = getActionInfo(log.action);
                          return (
                            <tr key={log.id} className="border-0">
                              <td className="ps-4 py-2 border-0">
                                <div className="d-flex align-items-center">
                                  <div className={`me-3 rounded-circle d-flex align-items-center justify-content-center bg-${info.color} bg-opacity-10 text-${info.color}`} style={{ width: '35px', height: '35px', flexShrink: 0 }}>
                                    {getTargetIcon(log.target)}
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="small text-dark fw-bold mb-0 lh-1">
                                      <span className={`text-${info.color} me-1`}>{info.label}</span> 
                                      <span className="text-muted fw-normal">{log.target.toLowerCase()}</span>
                                    </div>
                                    <div className="extra-small text-muted text-truncate" style={{ maxWidth: '100%' }}>
                                      {log.title}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="pe-4 py-2 text-end border-0" style={{ width: '100px', flexShrink: 0 }}>
                                <div className="extra-small text-muted fw-medium">{formatTime(log.timestamp)}</div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={4}>
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white py-3 border-bottom"><h6 className="fw-bold mb-0 text-dark small">Pintasan Cepat</h6></Card.Header>
              <Card.Body className="p-4">
                <Button as={Link as any} to="/dashboard/berita/tambah" variant="outline-success" className="w-100 mb-2 d-flex align-items-center justify-content-between p-2 border-dashed border-1 text-decoration-none">
                  <div className="d-flex align-items-center"><FaNewspaper className="me-2 text-muted" size={14} />
                    <div className="small fw-bold">Tulis Berita</div>
                  </div><FaPlus size={10} />
                </Button>
                
                <Button as={Link as any} to="/dashboard/agenda/tambah" variant="outline-primary" className="w-100 mb-2 d-flex align-items-center justify-content-between p-2 border-dashed border-1 text-decoration-none">
                  <div className="d-flex align-items-center"><FaCalendarAlt className="me-2 text-muted" size={14} />
                    <div className="small fw-bold">Buat Agenda</div>
                  </div><FaPlus size={10} />
                </Button>

                <Button as={Link as any} to="/dashboard/pengumuman/tambah" variant="outline-warning" className="w-100 mb-2 d-flex align-items-center justify-content-between p-2 border-dashed border-1 text-dark text-decoration-none">
                  <div className="d-flex align-items-center"><FaBullhorn className="me-2 text-muted" size={14} />
                    <div className="small fw-bold">Posting Info</div>
                  </div><FaPlus size={10} />
                </Button>

                <Button as={Link as any} to="/dashboard/galeri/tambah" variant="outline-info" className="w-100 d-flex align-items-center justify-content-between p-2 border-dashed border-1 text-decoration-none">
                  <div className="d-flex align-items-center"><FaImages className="me-2 text-muted" size={14} />
                    <div className="small fw-bold">Buat Album</div>
                  </div><FaPlus size={10} />
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      <style>{`
        .border-dashed { border-style: dashed !important; }
        .extra-small { font-size: 0.7rem; }
        .truncate-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </DashboardLayout>
  );
};

export default AdminDashboard;
