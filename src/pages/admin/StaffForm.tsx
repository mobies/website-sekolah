import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Spinner, Badge } from 'react-bootstrap';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaSave, FaArrowLeft, FaCamera, FaUserTie } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity } from '../../firebase/utils';
import { onValue, set, update } from 'firebase/database';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { convertToWebP } from '../../firebase/imageUtils';
import { showAlert, toast } from '../../utils/alerts';

const StaffForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    photo: '',
    type: 'guru', // guru, staf
    subject: '',
    isActive: true,
    order: 0
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!tenantId || !id) return;

    const staffRef = getDBRef(tenantId, `staff/${id}`);
    const unsub = onValue(staffRef, (snap) => {
      const data = snap.val();
      if (data) {
        setFormData(data);
        setPreviewUrl(data.photo);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [tenantId, id]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      let finalPhotoUrl = formData.photo;

      if (photoFile) {
        const webpBlob = await convertToWebP(photoFile);
        const fileName = `staff_${Date.now()}.webp`;
        const storageRef = getStorageRef(tenantId, `staff_photos/${fileName}`);
        await uploadBytes(storageRef, webpBlob);
        finalPhotoUrl = await getDownloadURL(storageRef);
      }

      if (!finalPhotoUrl && !id) {
        throw new Error('Foto wajib diunggah');
      }

      const staffData = {
        ...formData,
        photo: finalPhotoUrl,
        updatedAt: Date.now()
      };

      if (!id) {
        const timestamp = Date.now();
        const newRef = getDBRef(tenantId, `staff/${timestamp}`);
        await set(newRef, { 
          ...staffData, 
          id: newRef.key, 
          createdAt: timestamp,
          deleted: false 
        });
        
        // Update Search Index
        await set(getDBRef(tenantId, `staff_search_index/${newRef.key}`), {
          n: staffData.name.toLowerCase(),
          name: staffData.name,
          type: staffData.type,
          isActive: staffData.isActive,
          deleted: false
        });

        await logActivity(tenantId, { action: 'TAMBAH', target: 'STAFF', title: staffData.name });
        toast.fire({ icon: 'success', title: 'Data berhasil ditambahkan' });
      } else {
        await update(getDBRef(tenantId, `staff/${id}`), staffData);
        
        // Update Search Index
        await update(getDBRef(tenantId, `staff_search_index/${id}`), {
          n: staffData.name.toLowerCase(),
          name: staffData.name,
          type: staffData.type,
          isActive: staffData.isActive
        });

        await logActivity(tenantId, { action: 'EDIT', target: 'STAFF', title: staffData.name });
        toast.fire({ icon: 'success', title: 'Data berhasil diperbarui' });
      }

      navigate('/dashboard/staff');
    } catch (error: any) {
      console.error(error);
      showAlert('Gagal', error.message || 'Terjadi kesalahan saat menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex align-items-center mb-4">
           <Button as={Link as any} to="/dashboard/staff" variant="light" className="btn-icon me-3 shadow-sm"><FaArrowLeft /></Button>
           <div>
              <h4 className="fw-bold text-dark mb-0">{id ? 'Edit' : 'Tambah'} Guru & Staf</h4>
              <p className="text-muted small mb-0">Lengkapi informasi biodata secara akurat.</p>
           </div>
        </div>

        <Row className="justify-content-center">
           <Col lg={8}>
              <Form onSubmit={handleSubmit}>
                 <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                    <Card.Body className="p-4">
                       <Row>
                          <Col md={4} className="text-center border-end-md pe-md-4 mb-4 mb-md-0">
                             <Form.Label className="fw-bold small text-muted d-block text-start mb-3">FOTO PROFIL</Form.Label>
                             <div className="position-relative mx-auto" style={{ width: '180px', height: '240px' }}>
                                <div className="bg-light rounded-4 border overflow-hidden h-100 w-100 d-flex align-items-center justify-content-center shadow-inner">
                                   {previewUrl ? (
                                      <img src={previewUrl} className="img-fluid h-100 w-100 object-fit-cover" alt="Preview" />
                                   ) : (
                                      <div className="text-center p-3">
                                         <FaUserTie size={60} className="text-muted mb-2" />
                                         <p className="x-small text-muted mb-0">Belum ada foto</p>
                                      </div>
                                   )}
                                </div>
                                <Button 
                                   variant="success" 
                                   size="sm" 
                                   className="rounded-circle position-absolute shadow-sm" 
                                   style={{ bottom: '-10px', right: '-10px', width: '40px', height: '40px' }}
                                   onClick={() => document.getElementById('staff-photo')?.click()}
                                >
                                   <FaCamera />
                                </Button>
                             </div>
                             <input type="file" id="staff-photo" className="d-none" accept="image/*" onChange={handlePhotoChange} />
                             <p className="x-small text-muted mt-4">Rekomendasi rasio 3:4. Sistem akan otomatis mengkonversi ke WebP untuk menghemat kuota.</p>
                          </Col>

                          <Col md={8} className="ps-md-4">
                             <Form.Group className="mb-3">
                                <Form.Label className="fw-bold small text-muted">NAMA LENGKAP & GELAR</Form.Label>
                                <Form.Control 
                                   required 
                                   placeholder="Contoh: Drs. H. Ahmad, M.Pd" 
                                   value={formData.name} 
                                   onChange={e => setFormData({...formData, name: e.target.value})}
                                   className="fw-bold"
                                />
                             </Form.Group>

                             <Row>
                                <Col md={6}>
                                   <Form.Group className="mb-3">
                                      <Form.Label className="fw-bold small text-muted">JENIS KEPEGAWAIAN</Form.Label>
                                      <Form.Select 
                                         value={formData.type} 
                                         onChange={e => setFormData({...formData, type: e.target.value, subject: e.target.value === 'staf' ? '' : formData.subject})}
                                      >
                                         <option value="guru">Guru</option>
                                         <option value="staf">Staf Tata Usaha</option>
                                         <option value="pimpinan">Pimpinan</option>
                                      </Form.Select>
                                   </Form.Group>
                                </Col>
                                <Col md={6}>
                                   <Form.Group className="mb-3">
                                      <Form.Label className="fw-bold small text-muted">STATUS AKTIF</Form.Label>
                                      <div className="d-flex align-items-center h-100 pt-1">
                                         <Form.Check 
                                            type="switch" 
                                            id="staff-status" 
                                            label={formData.isActive ? <Badge bg="success-subtle" className="text-success">Aktif</Badge> : <Badge bg="secondary-subtle" className="text-secondary">Nonaktif</Badge>}
                                            checked={formData.isActive}
                                            onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                         />
                                      </div>
                                   </Form.Group>
                                </Col>
                             </Row>

                             {(formData.type === 'guru' || formData.type === 'pimpinan') && (
                                <Form.Group className="mb-4">
                                   <Form.Label className="fw-bold small text-muted">MATA PELAJARAN / JABATAN</Form.Label>
                                   <Form.Control 
                                      placeholder="Contoh: Matematika / Waka Kurikulum" 
                                      value={formData.subject} 
                                      onChange={e => setFormData({...formData, subject: e.target.value})}
                                   />
                                </Form.Group>
                             )}

                             <div className="mt-4 pt-3 border-top d-flex gap-2">
                                <Button type="submit" variant="success" className="px-4 fw-bold rounded-pill shadow-sm" disabled={saving}>
                                   {saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} {id ? 'Update Data' : 'Simpan Data'}
                                </Button>
                                <Button as={Link as any} to="/dashboard/staff" variant="light" className="px-4 fw-bold rounded-pill border">Batal</Button>
                             </div>
                          </Col>
                       </Row>
                    </Card.Body>
                 </Card>
              </Form>
           </Col>
        </Row>
      </Container>
      <style>{`
         .shadow-inner { box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
         .x-small { font-size: 0.7rem; }
         .btn-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 10px; }
         .border-end-md { border-right: 1px solid #dee2e6; }
         @media (max-width: 767.98px) { .border-end-md { border-right: none; } }
      `}</style>
    </DashboardLayout>
  );
};

export default StaffForm;
