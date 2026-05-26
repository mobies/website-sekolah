import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { Spinner, Card, Container, Row, Col, Button } from 'react-bootstrap';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaArrowLeft, FaShareAlt } from 'react-icons/fa';

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  createdAt: number;
}

const AgendaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useTenant();
  const [agenda, setAgenda] = useState<AgendaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    if (!id) {
      setError('ID Agenda tidak ditemukan.');
      setLoading(false);
      return;
    }

    const fetchAgenda = async () => {
      try {
        const snap = await get(ref(database, `tenants/${tenantId}/agenda/${id}`));
        if (snap.exists()) {
          setAgenda({ id, ...snap.val() });
        } else {
          setError('Agenda tidak ditemukan.');
        }
      } catch (err) {
        console.error(err);
        setError('Gagal memuat detail agenda.');
      } finally {
        setLoading(false);
      }
    };

    fetchAgenda();
    window.scrollTo(0, 0);
  }, [tenantId, id]);

  const handleShare = async () => {
    if (!agenda) return;
    const shareUrl = window.location.href;
    const shareText = `Agenda: ${agenda.title} pada ${new Date(agenda.date).toLocaleDateString('id-ID')}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: agenda.title, text: shareText, url: shareUrl });
      } catch (err) { if ((err as Error).name !== 'AbortError') console.error(err); }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Link agenda berhasil disalin!');
    }
  };

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;
  if (error || !agenda) return <Container className="my-5 text-center"><div className="alert alert-danger">{error || 'Data tidak ditemukan'}</div><Link to="/agenda" className="btn btn-success">Kembali ke Daftar Agenda</Link></Container>;

  const formattedDate = new Date(agenda.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="container my-5">
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/">Beranda</Link></li>
          <li className="breadcrumb-item"><Link to="/agenda">Agenda</Link></li>
          <li className="breadcrumb-item active text-truncate" aria-current="page">{agenda.title}</li>
        </ol>
      </nav>

      <Row className="justify-content-center">
        <Col lg={9}>
          <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-5">
            <div className="bg-success p-4 p-md-5 text-white position-relative">
              <div className="position-relative" style={{ zIndex: 1 }}>
                <h1 className="fw-bold mb-3 display-6">{agenda.title}</h1>
                <div className="d-flex flex-wrap gap-3 mt-4">
                  <div className="d-flex align-items-center bg-white bg-opacity-25 rounded-pill px-3 py-1 small">
                    <FaCalendarAlt className="me-2" /> {formattedDate}
                  </div>
                  <div className="d-flex align-items-center bg-white bg-opacity-25 rounded-pill px-3 py-1 small">
                    <FaClock className="me-2" /> {agenda.time}
                  </div>
                </div>
              </div>
              <div className="position-absolute top-0 end-0 p-4 opacity-25 d-none d-md-block">
                <FaCalendarAlt style={{ fontSize: '8rem' }} />
              </div>
            </div>
            
            <Card.Body className="p-4 p-md-5">
              <div className="mb-5">
                <h5 className="fw-bold border-start border-4 border-success ps-3 mb-4">Detail Kegiatan</h5>
                <div className="bg-light rounded-4 p-4 mb-4">
                  <div className="row g-4">
                    <Col md={6}>
                      <div className="small text-muted mb-1 text-uppercase fw-bold">Lokasi</div>
                      <div className="d-flex align-items-start">
                        <FaMapMarkerAlt className="text-success mt-1 me-2" />
                        <span className="fw-medium">{agenda.location}</span>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="small text-muted mb-1 text-uppercase fw-bold">Waktu</div>
                      <div className="d-flex align-items-start">
                        <FaClock className="text-success mt-1 me-2" />
                        <span className="fw-medium">{agenda.time}</span>
                      </div>
                    </Col>
                  </div>
                </div>
                
                <div className="agenda-description" style={{ lineHeight: '1.8', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>
                  {agenda.description || 'Tidak ada deskripsi tambahan untuk agenda ini.'}
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center border-top pt-4">
                <Button variant="light" onClick={() => window.history.back()} className="rounded-pill px-4 d-flex align-items-center gap-2">
                  <FaArrowLeft /> Kembali
                </Button>
                <Button variant="success" onClick={handleShare} className="rounded-pill px-4 d-flex align-items-center gap-2 fw-bold shadow-sm">
                  <FaShareAlt /> Bagikan
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AgendaDetail;
