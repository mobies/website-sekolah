import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { Spinner, Card, Container, Row, Col, Button } from 'react-bootstrap';
import { FaCalendarDay, FaArrowLeft, FaShareAlt, FaFilePdf, FaDownload } from 'react-icons/fa';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  date: string;
  createdAt: number;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
}

const AnnouncementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useTenant();
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
        if (snap.exists()) {
          const payload = snap.val();
          setData({
            id,
            ...payload,
            attachmentUrl: payload.attachmentUrl || payload.fileUrl || null,
            attachmentType: payload.attachmentType || payload.fileType || null,
            attachmentName: payload.attachmentName || payload.fileName || null,
          });
        } else setError('Pengumuman tidak ditemukan.');
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

  const hasAttachment = Boolean(data?.attachmentUrl);
  const isImageAttachment = hasAttachment && (data?.attachmentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(data?.attachmentUrl || ''));
  const isPdfAttachment = hasAttachment && (data?.attachmentType?.includes('pdf') || /\.pdf$/i.test(data?.attachmentUrl || ''));

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;
  if (error || !data) return <Container className="my-5 text-center"><div className="alert alert-danger">{error || 'Data tidak ditemukan'}</div><Link to="/pengumuman" className="btn btn-success">Kembali</Link></Container>;

  return (
    <Container fluid className="my-5 px-3 px-md-4">
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item"><Link to="/">Beranda</Link></li>
          <li className="breadcrumb-item"><Link to="/pengumuman">Pengumuman</Link></li>
          <li className="breadcrumb-item active text-truncate" aria-current="page">{data.title}</li>
        </ol>
      </nav>
      <Row className="justify-content-center">
        <Col xs={12}>
          <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-5">
            <div className="bg-light p-4 p-md-5 border-bottom">
              <h1 className="fw-bold mb-3 text-dark">{data.title}</h1>
              <div className="d-flex align-items-center text-muted small"><FaCalendarDay className="me-2 text-success" />{new Date(data.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <Card.Body className="p-4 p-md-5">
              <div className="announcement-content mb-4" style={{ lineHeight: '1.8', fontSize: '1.1rem', whiteSpace: 'pre-wrap', color: '#444' }}>{data.content}</div>

              {hasAttachment && (
                <div className="announcement-attachment border-top pt-4 mt-4">
                  {isImageAttachment && (
                    <div className="attachment-preview mb-4">
                      <img src={data.attachmentUrl || undefined} alt={data.attachmentName || 'Lampiran gambar'} className="img-fluid rounded" style={{ maxWidth: '100%' }} />
                    </div>
                  )}

                  {isPdfAttachment && (
                    <div className="attachment-preview mb-4">
                      <div className="d-flex align-items-center mb-3 text-secondary">
                        <FaFilePdf className="me-2 text-danger" />
                        <div>{data.attachmentName || 'Lampiran PDF'}</div>
                      </div>
                      <object data={data.attachmentUrl || undefined} type="application/pdf" width="100%" height="600">
                        <p>PDF tidak dapat ditampilkan. <a href={data.attachmentUrl || '#'} target="_blank" rel="noreferrer">Unduh file</a></p>
                      </object>
                    </div>
                  )}

                  {!isImageAttachment && !isPdfAttachment && (
                    <div className="attachment-download mb-4">
                      <a href={data.attachmentUrl || '#'} target="_blank" rel="noreferrer" className="btn btn-outline-primary rounded-pill">
                        <FaDownload className="me-2" /> Unduh Lampiran
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center border-top pt-4 gap-2 flex-wrap">
                <Button variant="outline-secondary" onClick={() => window.history.back()} className="rounded-pill px-4 btn-sm"><FaArrowLeft className="me-2" /> Kembali</Button>
                <div className="d-flex gap-2">
                  <Button variant="success" onClick={handleShare} className="rounded-pill px-4 btn-sm fw-bold"><FaShareAlt className="me-2" /> Bagikan</Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AnnouncementDetail;
