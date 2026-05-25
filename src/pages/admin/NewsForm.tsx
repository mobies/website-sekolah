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

const NewsForm: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    category: 'berita',
    content: '',
    status: 'draft' as 'published' | 'draft',
    date: new Date().toISOString().split('T')[0],
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      const newsRef = getDBRef(tenantId, `news/${id}`);
      onValue(newsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setFormData({
            title: data.title || '',
            category: data.category || 'berita',
            content: data.content || '',
            status: data.status || 'draft',
            date: data.date || new Date().toISOString().split('T')[0],
          });
          if (data.thumbnail) setImagePreview(data.thumbnail);
        }
        setFetching(false);
      }, { onlyOnce: true });
    }
  }, [id, tenantId, isEdit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
        const fileName = `${Date.now()}.webp`;
        const fileRef = getStorageRef(tenantId, `news/${fileName}`);
        const uploadResult = await uploadBytes(fileRef, webpBlob);
        thumbnailUrl = await getDownloadURL(uploadResult.ref);
      }

      const newsData = {
        ...formData,
        thumbnail: thumbnailUrl,
        updatedAt: serverTimestamp(),
        // Breakdown for time-based reporting
        year: new Date(formData.date).getFullYear(),
        month: new Date(formData.date).getMonth() + 1,
        day: new Date(formData.date).getDate(),
        deleted: false
      };

      if (isEdit) {
        const itemRef = getDBRef(tenantId, `news/${id}`);
        await set(itemRef, { ...newsData, createdAt: serverTimestamp() }); // Keep or update createdAt
        await logActivity(tenantId, { action: 'EDIT', target: 'BERITA', title: formData.title });
      } else {
        const newsRef = getDBRef(tenantId, 'news');
        const newItemRef = push(newsRef);
        await set(newItemRef, {
          ...newsData,
          createdAt: serverTimestamp(),
        });
        await updateCounter(tenantId, 'totalNews', 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'BERITA', title: formData.title });
      }

      toast.fire({ icon: 'success', title: 'Berita berhasil disimpan' });
      navigate('/dashboard/berita');
    } catch (error) {
      console.error("Error saving news:", error);
      showAlert('Gagal', 'Gagal menyimpan berita.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center">
            <Button onClick={() => navigate(-1)} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button>
            <div>
              <h4 className="fw-bold text-dark mb-1">{isEdit ? 'Edit Berita' : 'Tambah Berita Baru'}</h4>
              <p className="text-muted small">Kelola informasi terbaru {terms.school.toLowerCase()}.</p>
            </div>
          </div>
        </div>

        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Judul Berita</Form.Label>
                    <Form.Control name="title" value={formData.title} onChange={handleInputChange} placeholder="Masukkan judul berita" required />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Konten Berita</Form.Label>
                    <Form.Control as="textarea" name="content" value={formData.content} onChange={handleInputChange} rows={12} placeholder="Tulis isi berita..." required />
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={4}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Kategori</Form.Label>
                    <Form.Select name="category" value={formData.category} onChange={handleInputChange}>
                      <option value="berita">Berita Umum</option>
                      <option value="prestasi">Prestasi</option>
                      <option value="kegiatan">Kegiatan {terms.school}</option>
                      <option value="opini">Opini/Artikel</option>
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Tanggal</Form.Label>
                    <Form.Control type="date" name="date" value={formData.date} onChange={handleInputChange} />
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-bold small">Status</Form.Label>
                    <div>
                      <Form.Check inline type="radio" label="Draft" name="status" value="draft" checked={formData.status === 'draft'} onChange={handleInputChange} />
                      <Form.Check inline type="radio" label="Published" name="status" value="published" checked={formData.status === 'published'} onChange={handleInputChange} />
                    </div>
                  </Form.Group>
                  <Button type="submit" variant="success" className="w-100 py-2 fw-bold" disabled={loading}>
                    {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Berita
                  </Button>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white py-3 border-bottom"><h6 className="fw-bold mb-0 small">Thumbnail</h6></Card.Header>
                <Card.Body className="p-4 text-center">
                  {imagePreview ? (
                    <div className="mb-3 position-relative">
                      <img src={imagePreview} alt="Preview" className="img-fluid rounded shadow-sm" style={{ maxHeight: '200px' }} />
                      <Button variant="danger" size="sm" className="position-absolute top-0 end-0 m-2" onClick={() => { setImageFile(null); setImagePreview(null); }}>Hapus</Button>
                    </div>
                  ) : (
                    <div className="border border-2 border-dashed rounded p-5 mb-3 bg-light text-muted">
                      <FaCloudUploadAlt className="fs-1 mb-2" />
                      <p className="small mb-0">Upload gambar</p>
                    </div>
                  )}
                  <Form.Control type="file" accept="image/*" onChange={handleImageChange} className="d-none" id="news-image-upload" />
                  <Button as="label" htmlFor="news-image-upload" variant="outline-secondary" size="sm" className="w-100">Pilih Gambar</Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default NewsForm;
