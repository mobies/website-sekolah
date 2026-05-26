import React, { useEffect, useState, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { Link } from 'react-router-dom';
import { Form, InputGroup, Button, Spinner } from 'react-bootstrap';
import { FaBullhorn, FaCalendarDay } from 'react-icons/fa';

interface AnnouncementIndexItem {
  id: string;
  t: string;      // lowercase title
  title: string;
  date: string;
  deleted: boolean;
}

const AnnouncementListPublic: React.FC = () => {
  const { tenantId } = useTenant();
  const [indexData, setIndexData] = useState<AnnouncementIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    const indexRef = ref(database, `tenants/${tenantId}/announcement_search_index`);
    onValue(indexRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted)
          .sort((a, b) => b.date.localeCompare(a.date));
        setIndexData(list);
      } else setIndexData([]);
      setLoading(false);
    });
  }, [tenantId]);

  const filteredResults = useMemo(() => {
    return indexData.filter(item => !searchTerm || item.t.includes(searchTerm.toLowerCase()));
  }, [indexData, searchTerm]);

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="container my-5">
      <div className="row justify-content-center mb-5">
        <div className="col-lg-8 text-center">
          <h2 className="fw-bold mb-4">Pengumuman</h2>
          <div className="card shadow-sm border-0 p-3 bg-white rounded-4">
            <InputGroup>
              <InputGroup.Text className="bg-transparent border-end-0"><i className="bi bi-search"></i></InputGroup.Text>
              <Form.Control className="border-start-0 shadow-none" placeholder="Cari pengumuman..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              {searchTerm && <Button variant="light" className="border-start-0" onClick={() => setSearchTerm('')}>Reset</Button>}
            </InputGroup>
          </div>
        </div>
      </div>
      <div className="row justify-content-center">
        <div className="col-lg-10">
          {filteredResults.map(item => (
              <Link key={item.id} to={`/pengumuman/${item.id}`} className="text-decoration-none">
                <div className="card border-0 shadow-sm rounded-4 mb-3 hover-lift">
                  <div className="card-body p-4 d-flex align-items-center">
                    <div className="bg-success bg-opacity-10 text-success rounded-circle p-3 me-4 d-none d-md-block"><FaBullhorn className="fs-4" /></div>
                    <div className="flex-grow-1">
                      <h5 className="fw-bold text-dark mb-1">{item.title}</h5>
                      <div className="d-flex align-items-center text-muted small"><FaCalendarDay className="me-1" /> {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                    <div className="ms-3 text-success"><i className="bi bi-chevron-right fs-4"></i></div>
                  </div>
                </div>
              </Link>
          ))}
        </div>
      </div>
      <style>{`.hover-lift { transition: all 0.3s ease; } .hover-lift:hover { transform: translateX(5px); box-shadow: 0 0.5rem 1.5rem rgba(0,0,0,0.08) !important; }`}</style>
    </div>
  );
};

export default AnnouncementListPublic;
