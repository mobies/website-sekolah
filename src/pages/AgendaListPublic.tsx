import React, { useEffect, useState, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { Link } from 'react-router-dom';
import { Form, Row, Col, InputGroup, Button, Spinner } from 'react-bootstrap';
import { FaMapMarkerAlt, FaClock } from 'react-icons/fa';

interface AgendaIndexItem {
  id: string;
  t: string;      // lowercase title
  title: string;
  date: string;
  time: string;
  loc: string;
  deleted: boolean;
}

const AgendaListPublic: React.FC = () => {
  const { tenantId } = useTenant();
  const [indexData, setIndexData] = useState<AgendaIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    const indexRef = ref(database, `tenants/${tenantId}/agenda_search_index`);
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
    return indexData.filter(item => {
      const matchTitle = !searchTerm || item.t.includes(searchTerm.toLowerCase());
      const matchStart = !startDate || item.date >= startDate;
      const matchEnd = !endDate || item.date <= endDate;
      return matchTitle && matchStart && matchEnd;
    });
  }, [indexData, searchTerm, startDate, endDate]);

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="container my-5">
      <div className="row justify-content-center mb-5">
        <div className="col-lg-10 text-center">
          <h2 className="fw-bold mb-4">Agenda Kegiatan</h2>
          <div className="card shadow-sm border-0 p-3 bg-white rounded-4">
            <Row className="g-2 align-items-center">
              <Col md={4}>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-transparent border-end-0"><i className="bi bi-search"></i></InputGroup.Text>
                  <Form.Control className="border-start-0 shadow-none" placeholder="Cari agenda..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </InputGroup>
              </Col>
              <Col md={3}>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light small border-end-0">Dari</InputGroup.Text>
                  <Form.Control type="date" className="border-start-0 shadow-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </InputGroup>
              </Col>
              <Col md={3}>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-light small border-end-0">Hingga</InputGroup.Text>
                  <Form.Control type="date" className="border-start-0 shadow-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </InputGroup>
              </Col>
              <Col md={2}>
                {(searchTerm || startDate || endDate) && (
                  <Button variant="success" className="w-100 btn-sm" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}>Reset</Button>
                )}
              </Col>
            </Row>
          </div>
        </div>
      </div>

      <div className="row">
        {filteredResults.map(item => (
            <div key={item.id} className="col-md-6 mb-4">
              <Link to={`/agenda/${item.id}`} className="text-decoration-none">
                <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden hover-lift">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <div className="bg-success text-white rounded-3 p-2 text-center" style={{ minWidth: '60px' }}>
                        <div className="fw-bold lh-1" style={{ fontSize: '1.2rem' }}>{new Date(item.date).getDate()}</div>
                        <div className="small text-uppercase" style={{ fontSize: '0.7rem' }}>{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(item.date))}</div>
                      </div>
                      <div><h5 className="card-title fw-bold text-dark mb-0">{item.title}</h5><small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Tahun {new Date(item.date).getFullYear()}</small></div>
                    </div>
                    <div className="d-flex flex-column gap-2 mt-3">
                      <div className="d-flex align-items-center text-muted small"><FaClock className="me-2 text-success" /> {item.time}</div>
                      <div className="d-flex align-items-center text-muted small"><FaMapMarkerAlt className="me-2 text-success" /> {item.loc}</div>
                    </div>
                  </div>
                  <div className="card-footer bg-light border-0 py-3 px-4 d-flex justify-content-between align-items-center">
                    <span className="text-success fw-bold small">Lihat Detail &raquo;</span><i className="bi bi-calendar-check text-success"></i>
                  </div>
                </div>
              </Link>
            </div>
        ))}
      </div>
      <style>{`.hover-lift { transition: all 0.3s ease; } .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 1rem 3rem rgba(0,0,0,0.1) !important; }`}</style>
    </div>
  );
};

export default AgendaListPublic;
