import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaSave, FaArrowLeft } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity } from '../../firebase/utils';
import { onValue, set, serverTimestamp } from 'firebase/database';
import { showAlert, toast } from '../../utils/alerts';

const VideoForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({ title: '', youtubeUrl: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (isEdit && tenantId) {
      onValue(getDBRef(tenantId, `videos/${id}`), (snap) => {
        if (snap.val()) setFormData(snap.val());
        setFetching(false);
      }, { onlyOnce: true });
    } else {
      setFetching(false);
    }
  }, [id, tenantId, isEdit]);

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    const videoId = getYouTubeVideoId(formData.youtubeUrl);
    
    if (!videoId) {
      showAlert('URL Tidak Valid', 'Pastikan Anda memasukkan URL video YouTube yang benar.', 'error');
      return;
    }

    setLoading(true);
    try {
      const videoData = {
        title: formData.title,
        youtubeId: videoId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false
      };
      
      const videoRef = getDBRef(tenantId, `videos/${isEdit ? id : Date.now()}`);
      await set(videoRef, videoData);

      await logActivity(tenantId, { action: isEdit ? 'EDIT' : 'TAMBAH', target: 'VIDEO', title: formData.title });
      toast.fire({ icon: 'success', title: 'Video berhasil disimpan' });
      navigate('/dashboard/galeri/video');
    } catch (error) {
      showAlert('Gagal', 'Gagal menyimpan video.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex align-items-center mb-4">
          <Button onClick={() => navigate(-1)} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button>
          <div><h4 className="fw-bold mb-1">{isEdit ? 'Edit Video' : 'Tambah Video Baru'}</h4></div>
        </div>
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">Judul Video</Form.Label>
                <Form.Control value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">URL YouTube</Form.Label>
                <Form.Control value={formData.youtubeUrl} onChange={(e) => setFormData({...formData, youtubeUrl: e.target.value})} placeholder="Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ" required />
                <Form.Text>Sistem akan otomatis mengambil ID video dari URL.</Form.Text>
              </Form.Group>
              <Button type="submit" variant="success" className="px-5 py-2 fw-bold" disabled={loading}>
                {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Video
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </DashboardLayout>
  );
};

export default VideoForm;
