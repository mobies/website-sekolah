import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaCloudUploadAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, set, push, serverTimestamp } from 'firebase/database';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { showAlert, toast } from '../../utils/alerts';

const GalleryForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coverImage: '',
    status: 'published' as 'published' | 'draft',
    date: new Date().toISOString().split('T')[0],
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [originalData, setOriginalData] = useState<any>(null);

  useEffect(() => {
    if (isEdit && tenantId) {
      onValue(getDBRef(tenantId, `gallery_albums/${id}`), (snap) => {
        if (snap.val()) {
          const data = snap.val();
          setFormData(data);
          setOriginalData(data);
          setImagePreview(data.coverImage);
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
      let coverUrl = formData.coverImage;

      if (imageFile) {
        const fileName = `${Date.now()}_${imageFile.name}`;
        const fileRef = getStorageRef(tenantId, `gallery/covers/${fileName}`);
        await uploadBytes(fileRef, imageFile);
        coverUrl = await getDownloadURL(fileRef);
      }

      const data = {
        ...formData,
        coverImage: coverUrl,
        updatedAt: serverTimestamp(),
        deleted: false
      };

      if (isEdit) {
        await set(getDBRef(tenantId, `gallery_albums/${id}`), { 
          ...data, 
          createdAt: originalData?.createdAt || serverTimestamp() 
        });
        await logActivity(tenantId, { action: 'EDIT', target: 'GALERI', title: formData.title });
      } else {
        const newRef = push(getDBRef(tenantId, 'gallery_albums'));
        await set(newRef, { ...data, createdAt: serverTimestamp() });
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
          <div><h4 className="fw-bold mb-1">{isEdit ? 'Edit Album' : 'Tambah Album Baru'}</h4></div>
        </div>
        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-bold">Judul Album</Form.Label>
                    <Form.Control value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                  </Form.Group>
                  <Form.Group className="mb-0">
                    <Form.Label className="small fw-bold">Keterangan</Form.Label>
                    <Form.Control as="textarea" rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={4}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4 text-center">
                  <Form.Label className="fw-bold small d-block text-start mb-3">Foto Sampul</Form.Label>
                  <div className="mb-3 bg-light rounded d-flex align-items-center justify-content-center border overflow-hidden" style={{ height: '200px' }}>
                    {imagePreview ? <img src={imagePreview} className="img-fluid h-100 w-100 object-fit-cover" alt="" /> : <FaCloudUploadAlt className="text-muted fs-1" />}
                  </div>
                  <input type="file" id="cover-img" className="d-none" accept="image/*" onChange={handleImageChange} />
                  <Button onClick={() => document.getElementById('cover-img')?.click()} variant="outline-success" size="sm" className="w-100 mb-3">Pilih Foto</Button>
                  <hr />
                  <Button type="submit" variant="success" className="w-100 py-2 fw-bold" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Simpan Album'}</Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default GalleryForm;
