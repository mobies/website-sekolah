import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaSave, FaArrowLeft, FaCloudUploadAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateTimeStats, updateCategoryStats } from '../../firebase/utils';
import { onValue, serverTimestamp, ref as dbRef, update } from 'firebase/database';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { rtdb as database } from '../../firebase/config';
import { showAlert, toast } from '../../utils/alerts';

const NewsForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    category: 'berita',
    content: '',
    status: 'published' as 'published' | 'draft',
    date: new Date().toISOString().split('T')[0],
    imageUrl: '',
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [originalData, setOriginalData] = useState<any>(null);

  useEffect(() => {
    if (isEdit && tenantId) {
      const newsRef = getDBRef(tenantId, `news/${id}`);
      onValue(newsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setFormData(data);
          setOriginalData(data);
          if (data.imageUrl || data.thumbnail) {
            setImagePreview(data.thumbnail || data.imageUrl);
          }
        }
        setFetching(false);
      }, { onlyOnce: true });
    } else {
      setFetching(false);
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
    if (!tenantId) return;
    setLoading(true);
    try {
      let thumbnailUrl = formData.imageUrl;

      if (imageFile) {
        const fileName = `${Date.now()}_${imageFile.name}`;
        const fileRef = getStorageRef(tenantId, `news/${fileName}`);
        await uploadBytes(fileRef, imageFile);
        thumbnailUrl = await getDownloadURL(fileRef);
      }

      const newsData = {
        ...formData,
        thumbnail: thumbnailUrl,
        updatedAt: serverTimestamp(),
        year: new Date(formData.date).getFullYear(),
        month: new Date(formData.date).getMonth() + 1,
        day: new Date(formData.date).getDate(),
        deleted: false
      };

      const searchIndexData = {
        t: formData.title.toLowerCase(),
        title: formData.title,
        date: formData.date,
        c: formData.category,
        img: thumbnailUrl,
        deleted: false
      };

      const updates: any = {};

      if (isEdit) {
        if (originalData && originalData.category !== formData.category) {
          await updateCategoryStats(tenantId, 'news', originalData.category, -1);
          await updateCategoryStats(tenantId, 'news', formData.category, 1);
        }
        updates[`tenants/${tenantId}/news/${id}`] = { ...newsData, createdAt: originalData?.createdAt || serverTimestamp() };
        updates[`tenants/${tenantId}/news_search_index/${id}`] = searchIndexData;
        await logActivity(tenantId, { action: 'EDIT', target: 'BERITA', title: formData.title });
      } else {
        const timestampId = Date.now().toString();
        updates[`tenants/${tenantId}/news/${timestampId}`] = { ...newsData, createdAt: serverTimestamp() };
        updates[`tenants/${tenantId}/news_search_index/${timestampId}`] = searchIndexData;
        await updateTimeStats(tenantId, 'news', formData.date, 1);
        await updateCategoryStats(tenantId, 'news', formData.category, 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'BERITA', title: formData.title });
      }

      await update(dbRef(database), updates);
      toast.fire({ icon: 'success', title: 'Berita berhasil disimpan' });
      navigate('/dashboard/berita');
    } catch (error) {
      console.error(error);
      showAlert('Gagal', 'Gagal menyimpan berita.', 'error');
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
          <div><h4 className="fw-bold mb-1">{isEdit ? 'Edit Berita' : 'Tambah Berita'}</h4></div>
        </div>

        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Judul Berita</Form.Label>
                    <Form.Control value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Isi Berita</Form.Label>
                    <Form.Control as="textarea" rows={15} value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} required />
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={4}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Kategori</Form.Label>
                    <Form.Select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                      <option value="berita">Berita Umum</option>
                      <option value="prestasi">Prestasi</option>
                      <option value="kegiatan">Kegiatan</option>
                      <option value="opini">Opini/Artikel</option>
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Tanggal Publikasi</Form.Label>
                    <Form.Control type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </Form.Group>
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-bold small">Status</Form.Label>
                    <div>
                      <Form.Check inline type="radio" label="Draft" name="status" checked={formData.status === 'draft'} onChange={() => setFormData({...formData, status: 'draft'})} />
                      <Form.Check inline type="radio" label="Published" checked={formData.status === 'published'} onChange={() => setFormData({...formData, status: 'published'})} />
                    </div>
                  </Form.Group>
                  <hr />
                  <Button type="submit" variant="success" className="w-100 py-2 fw-bold" disabled={loading}>
                    {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan
                  </Button>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4 text-center">
                  <Form.Label className="fw-bold small d-block text-start mb-3">Gambar Sampul</Form.Label>
                  <div className="mb-3 bg-light rounded d-flex align-items-center justify-content-center border" style={{ height: '200px', overflow: 'hidden' }}>
                    {imagePreview ? <img src={imagePreview} className="img-fluid" alt="" /> : <FaCloudUploadAlt className="text-muted fs-1" />}
                  </div>
                  <input type="file" id="news-img" className="d-none" accept="image/*" onChange={handleImageChange} />
                  <Button onClick={() => document.getElementById('news-img')?.click()} variant="outline-success" size="sm" className="w-100">Pilih Gambar</Button>
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
