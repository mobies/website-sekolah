import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { useEditor } from '../firebase/useEditor';
import { Spinner, Card, Container, Row, Col, Button } from 'react-bootstrap';
import { FaCalendarDay, FaArrowLeft, FaShareAlt, FaEdit } from 'react-icons/fa';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  date: string;
  createdAt: number;
}

const AnnouncementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useTenant();
  const { isEditor } = useEditor();
  const [data, setData] = useState<AnnouncementItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !id) {
      if (!tenantId) return;
      setError('ID tidak ditemukan.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const snap = await get(ref(database, `tenants/${tenantId}/announcements/${id}`));
        if (snap.exists()) setData({ id, ...snap.val() });
        else setError('Pengumuman tidak ditemukan.');
      } catch (err) { console.error(err); setError('Gagal memuat detail.'); } finally { setLoading(false); }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [tenantId, id]);

  const handleShare = async () => {
    if (!data) return;
    const shareUrl = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: data.title, url: shareUrl }); } catch (err) { }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Link berhasil disalin!');
    }
  };

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;
  if (error || !data) return <Container className="my-5 text-center"><div className="alert alert-danger">{error || 'Data tidak ditemukan'}</div><Link to="/pengumuman" className="btn btn-success">Kembali</Link></Container>;

  return (
    <div className="container my-5">
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item"><Link to="/">Beranda</Link></li>
          <li className="breadcrumb-item"><Link to="/pengumuman">Pengumuman</Link></li>
          <li className="breadcrumb-item active text-truncate" aria-current="page">{data.title}</li>
        </ol>
      </nav>
      <Row className="justify-content-center">
        <Col lg={8}>
          <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-5">
            <div className="bg-light p-4 p-md-5 border-bottom">
              <h1 className="fw-bold mb-3 text-dark">{data.title}</h1>
              <div className="d-flex align-items-center text-muted small"><FaCalendarDay className="me-2 text-success" />{new Date(data.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <Card.Body className="p-4 p-md-5">
              <div className="announcement-content mb-5" style={{ lineHeight: '1.8', fontSize: '1.1rem', whiteSpace: 'pre-wrap', color: '#444' }}>{data.content}</div>
              <div className="d-flex justify-content-between align-items-center border-top pt-4 gap-2 flex-wrap">
                <Button variant="outline-secondary" onClick={() => window.history.back()} className="rounded-pill px-4 btn-sm"><FaArrowLeft className="me-2" /> Kembali</Button>
                <div className="d-flex gap-2">
                  {isEditor && (
                    <Button as={Link as any} to={`/dashboard/pengumuman/${id}`} variant="warning" className="rounded-pill px-4 btn-sm fw-bold"><FaEdit className="me-2" /> Edit</Button>
                  )}
                  <Button variant="success" onClick={handleShare} className="rounded-pill px-4 btn-sm fw-bold"><FaShareAlt className="me-2" /> Bagikan</Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnnouncementDetail;
