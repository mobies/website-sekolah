import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Spinner, Form, InputGroup, Button, Breadcrumb } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaUserTie, FaSearch } from 'react-icons/fa';
import ProgressiveImage from '../components/ProgressiveImage';
import { useTenant } from '../firebase/TenantContext';
import { ref, query, orderByChild, limitToLast, endAt, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';

interface StaffItem {
  id: string;
  name: string;
  photo: string;
  type: string;
  subject?: string;
  isActive: boolean;
  deleted?: boolean;
  createdAt: number;
}

const PAGE_SIZE = 12;

const StaffListPublic: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q') || '';
  
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState(q);

  // 1. Fetch Staff with Pagination
  const fetchStaff = useCallback(async (isInitial = false) => {
    if (!tenantId || (!isInitial && !hasMore) || loadingMore) return;
    
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const staffRef = ref(database, `tenants/${tenantId}/staff`);
      let staffQuery;
      
      if (isInitial) {
        staffQuery = query(staffRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
      } else {
        staffQuery = query(staffRef, orderByChild('createdAt'), endAt(lastTimestamp! - 1), limitToLast(PAGE_SIZE));
      }

      const snapshot = await get(staffQuery);
      const data = snapshot.val();
      
      if (data) {
        const items: StaffItem[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => item.isActive && !item.deleted)
          .sort((a, b) => b.createdAt - a.createdAt);

        // Filter out items already in the list if not initial load
        const newItems = isInitial 
          ? items
          : items.filter(item => !staff.some(existingItem => existingItem.id === item.id));

        if (newItems.length < PAGE_SIZE) setHasMore(false);
        
        if (newItems.length > 0) {
          setLastTimestamp(newItems[newItems.length - 1].createdAt);
          setStaff(prev => isInitial ? newItems : [...prev, ...newItems]);
        } else if (isInitial) {
          setStaff([]);
        }
      } else {
        setHasMore(false);
        if (isInitial) setStaff([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantId, hasMore, loadingMore, lastTimestamp, staff]); // Added staff to deps for filtering newItems

  useEffect(() => {
    if (!tenantId) return;
    setSearchTerm(q);
    fetchStaff(true); // Refetch on query change
  }, [tenantId, q]);

  // Infinite Scroll Handler
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !loading && !loadingMore && !searchTerm) {
        fetchStaff();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchStaff, loading, loadingMore, searchTerm]);

  const filteredStaff = useMemo(() => {
    let list = staff;
    if (searchTerm) {
      list = list.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.subject && s.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
        s.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return list;
  }, [staff, searchTerm]);

  if (loading && filteredStaff.length === 0) return <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="staff-list-public-page bg-light min-vh-100 py-5">
      <Container>
        <Breadcrumb className="mb-4">
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>Beranda</Breadcrumb.Item>
          <Breadcrumb.Item active>Guru & Staf</Breadcrumb.Item>
        </Breadcrumb>

        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold text-dark mb-1">Guru & Staf</h2>
            <p className="text-muted small mb-0">Daftar lengkap tenaga pendidik dan kependidikan {terms.school}.</p>
          </div>
        </div>

        <div className="card shadow-sm border-0 p-3 bg-white rounded-4 mb-4">
            <InputGroup>
              <InputGroup.Text className="bg-transparent border-end-0"><FaSearch /></InputGroup.Text>
              <Form.Control 
                className="border-start-0 shadow-none" 
                placeholder="Cari nama guru atau mata pelajaran..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
              {searchTerm && <Button variant="light" className="border-start-0" onClick={() => setSearchTerm('')}>Reset</Button>}
            </InputGroup>
        </div>

        <Row className="g-4">
          {filteredStaff.length === 0 && !loading ? (
             <Col xs={12} className="text-center py-5 text-muted border rounded-4 bg-white">
                <FaUserTie size={40} className="mb-3 opacity-25" />
                <p>Tidak ada data guru atau staf ditemukan.</p>
             </Col>
          ) : (
            filteredStaff.map(item => (
              <Col key={item.id} xl={3} lg={4} md={6} sm={6}>
                <Card className="h-100 border-0 shadow-sm rounded-4 overflow-hidden staff-card-public">
                  <div className="position-relative staff-image-container-public">
                    <ProgressiveImage src={item.photo} alt={item.name} style={{ height: '100%', width: '100%' }} />
                    <div className="position-absolute bottom-0 start-0 w-100 p-2 bg-gradient-dark text-white">
                       <div className="fw-bold small text-truncate" title={item.name}>{item.name}</div>
                    </div>
                  </div>
                  <Card.Body className="p-3 text-center">
                    <div className="text-success fw-bold extra-small text-uppercase">{item.type}</div>
                    <div className="text-muted extra-small text-truncate px-1">{item.subject || '-'}</div>
                  </Card.Body>
                </Card>
              </Col>
            ))
          )}
        </Row>

        {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
        {!hasMore && filteredStaff.length > 0 && <div className="text-center py-4 text-muted small italic">Semua data telah ditampilkan.</div>}
      </Container>

      <style>{`
        .staff-card-public { transition: transform 0.3s ease; }
        .staff-card-public:hover { transform: translateY(-5px); box-shadow: 0 1rem 3rem rgba(0,0,0,0.1) !important; }
        .staff-image-container-public { height: 280px; background-color: #f8f9fa; }
        .bg-gradient-dark { background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); }
        .extra-small { font-size: 0.7rem; }
        .uppercase { text-transform: uppercase; }
      `}</style>
    </div>
  );
};

export default StaffListPublic;
