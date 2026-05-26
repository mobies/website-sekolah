import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Card, Button, Row, Col, Spinner, Badge } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaUndo, FaCheckCircle, FaTimesCircle, FaSync, FaUserTie } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import ProgressiveImage from '../../components/ProgressiveImage';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, getStorageRef } from '../../firebase/utils';
import { update, ref, query, orderByChild, limitToLast, endAt, get, onValue, remove } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { storage } from '../../firebase/config';
import { deleteObject } from 'firebase/storage';
import { showConfirm, toast, showAlert } from '../../utils/alerts';

interface StaffItem {
  id: string;
  name: string;
  photo: string;
  type: string;
  subject?: string;
  isActive: boolean;
  createdAt: number;
  deleted?: boolean;
}

const PAGE_SIZE = 24; // Increased for better initial visibility

const StaffList: React.FC = () => {
  const { tenantId } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const q = new URLSearchParams(location.search).get('q') || '';
  
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // 1. Reactive Initial Load (Last 50 items)
  useEffect(() => {
    if (!tenantId) return;

    setLoading(true);
    const staffRef = ref(database, `tenants/${tenantId}/staff`);
    const initialQuery = query(staffRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
    
    const unsubscribe = onValue(initialQuery, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const items: StaffItem[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => b.createdAt - a.createdAt);
        
        setStaff(items);
        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
        }
        if (items.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);
      } else {
        setStaff([]);
        setHasMore(false);
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // 2. Load More (Manual trigger for older items)
  const loadMore = useCallback(async () => {
    if (!tenantId || !hasMore || loadingMore || !lastTimestamp) return;

    setLoadingMore(true);
    try {
      const staffRef = ref(database, `tenants/${tenantId}/staff`);
      const moreQuery = query(staffRef, orderByChild('createdAt'), endAt(lastTimestamp - 1), limitToLast(PAGE_SIZE));
      
      const snapshot = await get(moreQuery);
      const data = snapshot.val();
      
      if (data) {
        const items: StaffItem[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => b.createdAt - a.createdAt);

        if (items.length < PAGE_SIZE) setHasMore(false);
        
        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
          setStaff(prev => [...prev, ...items]);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  }, [tenantId, hasMore, loadingMore, lastTimestamp]);

  // 3. Auto-scroll loader
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !q && !loading && !loadingMore) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, q, loading, loadingMore]);

  const displayStaff = useMemo(() => {
    let filtered = staff.filter(s => !!s.deleted === showDeleted);
    if (q) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(q.toLowerCase()) || 
        (s.subject && s.subject.toLowerCase().includes(q.toLowerCase())) ||
        s.type.toLowerCase().includes(q.toLowerCase())
      );
    }
    return filtered;
  }, [staff, showDeleted, q]);

  const handleDelete = async (item: StaffItem) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Data?', `Data "${item.name}" akan dipindahkan ke sampah.`)).isConfirmed) {
       try {
           await update(getDBRef(tenantId, `staff/${item.id}`), { deleted: true });
           await update(getDBRef(tenantId, `staff_search_index/${item.id}`), { deleted: true });
           // No need to update local state here, onValue listener will handle it.
           await logActivity(tenantId, { action: 'HAPUS', target: 'STAFF', title: item.name });
           toast.fire({ icon: 'success', title: 'Data berhasil dihapus' });
       } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
    }
  };

  const handleRestore = async (item: StaffItem) => {
    if (!tenantId) return;
    try {
      await update(getDBRef(tenantId, `staff/${item.id}`), { deleted: false });
      await update(getDBRef(tenantId, `staff_search_index/${item.id}`), { deleted: false });
      // No need to update local state here, onValue listener will handle it.
      await logActivity(tenantId, { action: 'RESTORE', target: 'STAFF', title: item.name });
      toast.fire({ icon: 'success', title: 'Data dipulihkan' });
    } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
  };

  const handlePermanentDelete = async (item: StaffItem) => {
    if (!tenantId) return;
    const result = await showConfirm(
      'Hapus Permanen?',
      `Anda yakin ingin menghapus data "${item.name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
      'warning',
      'Hapus Permanen'
    );
    if (result.isConfirmed) {
      try {
        // 1. Delete photo from storage
        if (item.photo) {
          const photoFileName = item.photo.split('/').pop();
          if (photoFileName) {
            const photoRef = getStorageRef(tenantId, `staff_photos/${photoFileName}`);
            await deleteObject(photoRef);
          }
        }

        // 2. Delete staff record from RTDB
        await remove(getDBRef(tenantId, `staff/${item.id}`));
        
        // 3. Delete search index record from RTDB
        await remove(getDBRef(tenantId, `staff_search_index/${item.id}`));

        // No need to update local state here, onValue listener will handle it.
        await logActivity(tenantId, { action: 'HAPUS_PERMANEN', target: 'STAFF', title: item.name });
        toast.fire({ icon: 'success', title: 'Data berhasil dihapus permanen' });
      } catch (error) {
        console.error(error);
        showAlert('Gagal', 'Terjadi kesalahan saat menghapus permanen.', 'error');
      }
    }
  };

  const toggleStatus = async (item: StaffItem) => {
    if (!tenantId) return;
    const newStatus = !item.isActive;
    try {
       await update(getDBRef(tenantId, `staff/${item.id}`), { isActive: newStatus });
       await update(getDBRef(tenantId, `staff_search_index/${item.id}`), { isActive: newStatus });
       // No need to update local state here, onValue listener will handle it.
       await logActivity(tenantId, { action: 'UBAH_STATUS', target: 'STAFF', title: item.name });
       toast.fire({ icon: 'info', title: `Status ${item.name} diperbarui` });
    } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Guru & Staf {showDeleted ? '(Sampah)' : ''}</h4>
            <p className="text-muted small mb-0">Kelola data profil guru dan tenaga kependidikan.</p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" className="rounded-pill px-3" onClick={() => setShowDeleted(!showDeleted)}>
              {showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}
            </Button>
            <Button as={Link as any} to="/dashboard/staff/tambah" variant="success" size="sm" className="rounded-pill px-3 fw-bold">
              <FaPlus className="me-2" /> Tambah Baru
            </Button>
          </div>
        </div>

        <Row className="g-4">
          {loading ? (
             <Col xs={12} className="text-center py-5"><Spinner animation="border" variant="success" /></Col>
          ) : displayStaff.length === 0 ? (
             <Col xs={12} className="text-center py-5 text-muted border rounded-4 bg-light">
                <FaUserTie size={40} className="mb-3 opacity-25" />
                <p>Tidak ada data ditemukan.</p>
                {q && <Button variant="link" size="sm" onClick={() => navigate('/dashboard/staff')}>Clear Search</Button>}
             </Col>
          ) : (
            displayStaff.map(item => (
              <Col key={item.id} xl={3} lg={4} md={6}>
                <Card className={`h-100 border-0 shadow-sm rounded-4 overflow-hidden staff-card-admin ${!item.isActive && !showDeleted ? 'opacity-75' : ''}`}>
                  <div className="position-relative" style={{ height: '280px' }}>
                    <ProgressiveImage src={item.photo} alt={item.name} style={{ height: '100%', width: '100%' }} />
                    <div className="position-absolute top-0 end-0 p-2 d-flex flex-column gap-2" style={{ zIndex: 2 }}>
                       {showDeleted ? (
                         <>
                           <Button onClick={() => handleRestore(item)} variant="white" size="sm" className="rounded-circle shadow btn-icon text-success" title="Pulihkan"><FaUndo size={12} /></Button>
                           <Button onClick={() => handlePermanentDelete(item)} variant="white" size="sm" className="rounded-circle shadow btn-icon text-danger" title="Hapus Permanen"><FaTrash size={12} /></Button>
                         </>
                       ) : (
                         <>
                           <Button as={Link as any} to={`/dashboard/staff/edit/${item.id}`} variant="white" size="sm" className="rounded-circle shadow btn-icon text-primary"><FaEdit size={12} /></Button>
                           <Button onClick={() => handleDelete(item)} variant="white" size="sm" className="rounded-circle shadow btn-icon text-danger"><FaTrash size={12} /></Button>
                         </>
                       )}
                    </div>
                    <div className="position-absolute bottom-0 start-0 w-100 p-3 bg-gradient-dark text-white">
                       <Badge bg={item.type === 'guru' ? 'success' : item.type === 'pimpinan' ? 'danger' : 'info'} className="mb-1 uppercase x-small">
                          {item.type}
                       </Badge>
                       <div className="fw-bold text-truncate" title={item.name}>{item.name}</div>
                    </div>
                  </div>
                  <Card.Body className="p-3">
                     <div className="d-flex justify-content-between align-items-center">
                        <div className="small text-muted text-truncate pe-2">
                           {item.subject || '-'}
                        </div>
                        {!showDeleted && (
                           <Button variant="link" className="p-0 text-decoration-none" onClick={() => toggleStatus(item)}>
                              {item.isActive ? <FaCheckCircle className="text-success" title="Nonaktifkan" /> : <FaTimesCircle className="text-secondary" title="Aktifkan" />}
                           </Button>
                        )}
                     </div>
                  </Card.Body>
                </Card>
              </Col>
            ))
          )}
        </Row>

        {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
        {!hasMore && displayStaff.length > 0 && !q && <div className="text-center py-4 text-muted small italic">Semua data telah ditampilkan.</div>}
      </Container>

      <style>{`
        .staff-card-admin { transition: transform 0.3s ease; }
        .staff-card-admin:hover { transform: translateY(-5px); }
        .bg-gradient-dark { background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); }
        .btn-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0; }
        .uppercase { text-transform: uppercase; }
        .x-small { font-size: 0.65rem; }
      `}</style>
    </DashboardLayout>
  );
};

export default StaffList;
