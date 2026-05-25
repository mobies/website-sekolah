import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaSave, FaArrowLeft, FaCloudUploadAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { push, set, onValue, serverTimestamp } from 'firebase/database';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { convertToWebP } from '../../firebase/imageUtils';
import { showAlert, toast } from '../../utils/alerts';

const GalleryForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      onValue(getDBRef(tenantId, `gallery_albums/${id}`), (snap) => {
        const data = snap.val();
        if (data) {
          setFormData({
            title: data.title || '',
            description: data.description || '',
            date: data.date || new Date().toISOString().split('T')[0],
          });
          if (data.thumbnail) setImagePreview(data.thumbnail);
        }
        setFetching(false);
      }, { onlyOnce: true });
    }
  }, [id, tenantId, isEdit]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let thumbnailUrl = imagePreview;
      if (imageFile) {
        const webpBlob = await convertToWebP(imageFile, 0.7);
        const fileName = `album_cover_${Date.now()}.webp`;
        const fileRef = getStorageRef(tenantId, `gallery/covers/${fileName}`);
        const uploadResult = await uploadBytes(fileRef, webpBlob);
        thumbnailUrl = await getDownloadURL(uploadResult.ref);
      }

      const data = {
        ...formData,
        thumbnail: thumbnailUrl,
        updatedAt: serverTimestamp(),
        deleted: false
      };

      if (isEdit) {
        await set(getDBRef(tenantId, `gallery_albums/${id}`), { ...data, createdAt: serverTimestamp() });
        await logActivity(tenantId, { action: 'EDIT', target: 'GALERI', title: formData.title });
      } else {
        const newRef = push(getDBRef(tenantId, 'gallery_albums'));
        await set(newRef, { ...data, createdAt: serverTimestamp(), photoCount: 0 });
        await updateCounter(tenantId, 'totalAlbums', 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'GALERI', title: formData.title });
      }

      toast.fire({ icon: 'success', title: 'Album berhasil disimpan' });
      navigate('/dashboard/galeri');
    } catch (error) {
      showAlert('Gagal', 'Terjadi kesalahan.', 'error');
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
          <h4 className="fw-bold mb-0">{isEdit ? 'Edit Album' : 'Buat Album Kegiatan Baru'}</h4>
        </div>
        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}>
              <Card className="border-0 shadow-sm mb-4"><Card.Body className="p-4">
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold small">Nama Kegiatan / Judul Album</Form.Label>
                  <Form.Control value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required placeholder="Misal: Peringatan Hari Guru 2026" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold small">Deskripsi Singkat</Form.Label>
                  <Form.Control as="textarea" rows={4} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Ceritakan sedikit tentang kegiatan ini..." />
                </Form.Group>
                <Row>
                  <Col md={6}><Form.Group className="mb-3"><Form.Label className="fw-bold small">Tanggal Kegiatan</Form.Label>
                    <Form.Control type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </Form.Group></Col>
                </Row>
                <Button type="submit" variant="success" className="px-5 py-2 fw-bold mt-3" disabled={loading}>
                  {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Album
                </Button>
              </Card.Body></Card>
            </Col>
            <Col lg={4}>
              <Card className="border-0 shadow-sm text-center"><Card.Header className="bg-white py-3 border-bottom"><h6 className="fw-bold mb-0 small">Foto Sampul (Cover)</h6></Card.Header><Card.Body className="p-4">
                {imagePreview ? (
                  <div className="mb-3"><img src={imagePreview} className="img-fluid rounded shadow-sm" style={{ maxHeight: '250px', width: '100%', objectFit: 'cover' }} alt="" /></div>
                ) : (
                  <div className="border border-2 border-dashed rounded p-5 mb-3 bg-light text-muted"><FaCloudUploadAlt className="fs-1 mb-2" /><p className="small">Pilih Foto Sampul</p></div>
                )}
                <Form.Control type="file" accept="image/*" onChange={handleImageChange} className="d-none" id="album-cover-upload" />
                <Button as="label" htmlFor="album-cover-upload" variant="outline-primary" size="sm" className="w-100">Pilih Foto</Button>
                <p className="extra-small text-muted mt-2 mb-0">Foto ini akan menjadi tampilan utama album.</p>
              </Card.Body></Card>
            </Col>
          </Row>
        </Form>
      </Container>
      <style>{`
        .btn-icon { width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #eee; }
        .extra-small { font-size: 0.7rem; }
      `}</style>
    </DashboardLayout>
  );
};

export default GalleryForm;
