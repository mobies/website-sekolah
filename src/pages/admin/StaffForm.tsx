import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Spinner, Badge, Modal } from 'react-bootstrap';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaSave, FaArrowLeft, FaCamera, FaUserTie, FaSyncAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, uploadBytesWithCache } from '../../firebase/utils';
import { onValue, set, update } from 'firebase/database';
import { getDownloadURL, ref, deleteObject } from 'firebase/storage';
import { useIsOwner } from '../../firebase/useIsOwner';
import { convertToWebP, convertUrlToWebP, getImageMetadata, getStoragePathFromDownloadURL } from '../../firebase/imageUtils';
import type { ImageMetadata } from '../../firebase/imageUtils';
import { showAlert, toast, showConfirm } from '../../utils/alerts';
import { storage } from '../../firebase/config';
import ProgressiveImage from '../../components/ProgressiveImage';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';

const StaffForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', photo: '', type: 'guru' as 'guru' | 'staf' | 'pimpinan', subject: '', isActive: true, is_editor: false, order: 0 });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [originalPhoto, setOriginalPhoto] = useState('');
  const [photoMetadata, setPhotoMetadata] = useState<ImageMetadata | null>(null);
  const [isReconverting, setIsReconverting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reconvertedBlob, setReconvertedBlob] = useState<Blob | null>(null);
  const [reconvertedPreviewUrl, setReconvertedPreviewUrl] = useState<string | null>(null);
  const [editorProcessing, setEditorProcessing] = useState(false);
  const { isOwner } = useIsOwner();

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (!tenantId || !id) { setLoading(false); return; }
    const staffRef = getDBRef(tenantId, `staff/${id}`);
    const unsub = onValue(staffRef, async (snap) => {
      const data = snap.val();
      if (data) {
        setFormData(data);
        setPreviewUrl(data.photo);
        setOriginalPhoto(data.photo);
        if (data.photo) {
          const storagePath = getStoragePathFromDownloadURL(data.photo);
          if (storagePath) {
            const metadata = await getImageMetadata(storagePath);
            setPhotoMetadata(metadata);
          }
        }
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
      setPhotoMetadata(null);
    }
  };

  const handleEditorToggle = async (checked: boolean) => {
    if (!tenantId) return;
    if (!formData.email) {
      showAlert('Email diperlukan', 'Mohon isi email staff terlebih dahulu sebelum mengubah status editor.', 'warning');
      return;
    }

    setEditorProcessing(true);
    try {
      if (checked) {
        const setEditorRole = httpsCallable(functions, 'setEditorRole');
        await setEditorRole({
          tenantId,
          email: formData.email,
          staffName: formData.name,
          staffId: id || ''
        });
        toast.fire({ icon: 'success', title: 'Editor berhasil diaktifkan' });
      } else {
        const removeEditorRole = httpsCallable(functions, 'removeEditorRole');
        await removeEditorRole({
          tenantId,
          email: formData.email
        });
        toast.fire({ icon: 'success', title: 'Editor berhasil dinonaktifkan' });
      }
      setFormData(prev => ({ ...prev, is_editor: checked }));
    } catch (error: any) {
      console.error('Error saat mengubah status editor:', error);
      showAlert('Gagal', error.message || 'Tidak dapat mengubah status editor.', 'error');
    } finally {
      setEditorProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!tenantId) return; setSaving(true);
    try {
      let finalPhotoUrl = formData.photo;
      if (photoFile) {
        const webpBlob = await convertToWebP(photoFile);
        const fileName = `staff_${Date.now()}.webp`;
        const storageRef = getStorageRef(tenantId, `staff_photos/${fileName}`);
        await uploadBytesWithCache(storageRef, webpBlob);
        finalPhotoUrl = await getDownloadURL(storageRef);
        if (id && originalPhoto) { try { await deleteObject(ref(storage, originalPhoto)); } catch (err: any) { if (err.code !== 'storage/object-not-found') { /* console.error(\"Gagal menghapus foto lama:\", err); */ } } }
      } else if (isOwner && id && originalPhoto) {
        // Owner reupload image with caching even without uploading new image
        try {
          const response = await fetch(originalPhoto);
          const blob = await response.blob();
          const fileName = `staff_${Date.now()}_recache.webp`;
          const storageRef = getStorageRef(tenantId, `staff_photos/${fileName}`);
          await uploadBytesWithCache(storageRef, blob);
          const newUrl = await getDownloadURL(storageRef);
          finalPhotoUrl = newUrl;

          // Update photo URL in RTDB
          await update(getDBRef(tenantId, `staff/${id}`), { photo: newUrl });
          await update(getDBRef(tenantId, `staff_search_index/${id}`), { photo: newUrl });

          // Delete old image
          const oldImageRef = ref(storage, originalPhoto);
          await deleteObject(oldImageRef);

          setFormData(prev => ({ ...prev, photo: newUrl }));
          setPreviewUrl(newUrl);
          const newMetadata = await getImageMetadata(getStoragePathFromDownloadURL(newUrl)!);
          setPhotoMetadata(newMetadata);
          setOriginalPhoto(newUrl);

        } catch (error: any) {
          console.error('Error recaching image for owner:', error);
        }
      }
      if (!finalPhotoUrl && !id) throw new Error('Foto wajib diunggah');
      const staffData = { ...formData, photo: finalPhotoUrl, updatedAt: Date.now() };

      if (!id) {
        const timestamp = Date.now();
        const newRef = getDBRef(tenantId, `staff/${timestamp}`);
        await set(newRef, { ...staffData, id: newRef.key, createdAt: timestamp, deleted: false });
        await set(getDBRef(tenantId, `staff_search_index/${newRef.key}`), { n: staffData.name.toLowerCase(), name: staffData.name, type: staffData.type, isActive: staffData.isActive, is_editor: staffData.is_editor, email: staffData.email, deleted: false });
        await logActivity(tenantId, { action: 'TAMBAH', target: 'STAFF', title: staffData.name });
        toast.fire({ icon: 'success', title: 'Data berhasil ditambahkan' });
      } else {
        await update(getDBRef(tenantId, `staff/${id}`), staffData);
        await update(getDBRef(tenantId, `staff_search_index/${id}`), { n: staffData.name.toLowerCase(), name: staffData.name, type: staffData.type, isActive: staffData.isActive, is_editor: !!staffData.is_editor, email: staffData.email || '' });
        await logActivity(tenantId, { action: 'EDIT', target: 'STAFF', title: staffData.name });
        toast.fire({ icon: 'success', title: 'Data berhasil diperbarui' });
      }
      navigate('/dashboard/staff');
    } catch (error: any) { console.error(error); showAlert('Gagal', error.message || 'Terjadi kesalahan saat menyimpan.', 'error'); } finally { setSaving(false); }
  };

  const handleReconvertClick = async () => {
    if (!previewUrl) return;
    const result = await showConfirm('Konversi Ulang Gambar?', 'Gambar ini akan dikonversi ke format WebP (maks 100KB). Lanjutkan?');
    if (!result.isConfirmed) return; setIsReconverting(true);
    try {
      const blob = await convertUrlToWebP(previewUrl);
      setReconvertedBlob(blob);
      setReconvertedPreviewUrl(URL.createObjectURL(blob));
      setShowPreviewModal(true);
    } catch (error: any) { showAlert('Gagal Konversi', error.message, 'error'); } finally { setIsReconverting(false); }
  };

  const handleSaveReconvertedImage = async () => {
    if (!reconvertedBlob || !tenantId || !id) return; setIsReconverting(true);
    try {
      const fileName = `staff_${Date.now()}_reconverted.webp`;
      const fileRef = getStorageRef(tenantId, `staff_photos/${fileName}`);
      await uploadBytesWithCache(fileRef, reconvertedBlob);
      const newUrl = await getDownloadURL(fileRef);
      await update(getDBRef(tenantId, `staff/${id}`), { photo: newUrl });
      if (originalPhoto) { try { await deleteObject(ref(storage, originalPhoto)); } catch (err: any) { if (err.code !== 'storage/object-not-found') console.error("Gagal menghapus foto lama:", err); } }
      setFormData(prev => ({ ...prev, photo: newUrl }));
      setPreviewUrl(newUrl);
      const newMetadata = await getImageMetadata(getStoragePathFromDownloadURL(newUrl)!);
      setPhotoMetadata(newMetadata);
      setOriginalPhoto(newUrl);
      setShowPreviewModal(false); if(reconvertedPreviewUrl) URL.revokeObjectURL(reconvertedPreviewUrl); setReconvertedBlob(null); setReconvertedPreviewUrl(null);
      await logActivity(tenantId, { action: 'EDIT', target: 'STAFF', title: `Rekonversi foto untuk: ${formData.name}` });
      toast.fire({ icon: 'success', title: 'Foto berhasil dikonversi ulang' });
    } catch (error: any) { showAlert('Gagal Menyimpan', error.message, 'error'); } finally { setIsReconverting(false); }
  };

  const needsReconversion = photoMetadata && (photoMetadata.fileExtension !== 'webp' || photoMetadata.sizeBytes > 102400);

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex align-items-center mb-4"><Button as={Link as any} to="/dashboard/staff" variant="light" className="btn-icon me-3 shadow-sm"><FaArrowLeft /></Button><div><h4 className="fw-bold text-dark mb-0">{id ? 'Edit' : 'Tambah'} Guru & Staf</h4><p className="text-muted small mb-0">Lengkapi informasi biodata secara akurat.</p></div></div>
        <Row>
           <Col xs={12}>
              <Form onSubmit={handleSubmit}>
                 <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                    <Card.Body className="p-4">
                       <Row>
                          <Col md={4} className="text-center border-end-md pe-md-4 mb-4 mb-md-0">
                             <Form.Label className="fw-bold small text-muted d-block text-start mb-3">FOTO PROFIL</Form.Label>
                             <div className="position-relative mx-auto" style={{ width: '180px', height: '240px' }}><div className="bg-light rounded-4 border overflow-hidden h-100 w-100 d-flex align-items-center justify-content-center shadow-inner">{previewUrl ? <ProgressiveImage src={previewUrl} className="img-fluid h-100 w-100 object-fit-cover" alt="Preview" /> : <div className="text-center p-3"><FaUserTie size={60} className="text-muted mb-2" /><p className="x-small text-muted mb-0">Belum ada foto</p></div>}</div><Button variant="success" size="sm" className="rounded-circle position-absolute shadow-sm" style={{ bottom: '-10px', right: '-10px', width: '40px', height: '40px' }} onClick={() => document.getElementById('staff-photo')?.click()}><FaCamera /></Button></div>
                             <input type="file" id="staff-photo" className="d-none" accept="image/*" onChange={handlePhotoChange} />
                             {photoMetadata && (<div className="d-flex justify-content-center align-items-center gap-2 mt-3"><span className="text-muted x-small">{formatBytes(photoMetadata.sizeBytes)} .{photoMetadata.fileExtension}</span>{needsReconversion && (<Button variant="link" className="p-0 text-warning" onClick={handleReconvertClick} disabled={isReconverting}><FaSyncAlt size={12} /></Button>)}</div>)}
                             <p className="x-small text-muted mt-2">Rekomendasi rasio 3:4. Sistem akan otomatis mengkonversi ke WebP.</p>
                          </Col>
                          <Col md={8} className="ps-md-4">
                             <Form.Group className="mb-3"><Form.Label className="fw-bold small text-muted">NAMA LENGKAP & GELAR</Form.Label><Form.Control required placeholder="Contoh: Drs. H. Ahmad, M.Pd" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="fw-bold"/></Form.Group>
                             <Form.Group className="mb-3"><Form.Label className="fw-bold small text-muted">EMAIL (Opsional)</Form.Label><Form.Control type="email" placeholder="Untuk matching dengan akun editor" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></Form.Group>
                             <Row><Col md={6}><Form.Group className="mb-3"><Form.Label className="fw-bold small text-muted">JENIS KEPEGAWAIAN</Form.Label><Form.Select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any, subject: e.target.value === 'staf' ? '' : formData.subject})}><option value="guru">Guru</option><option value="staf">Staf Tata Usaha</option><option value="pimpinan">Pimpinan</option></Form.Select></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label className="fw-bold small text-muted">STATUS AKTIF</Form.Label><div className="d-flex align-items-center h-100 pt-1"><Form.Check type="switch" id="staff-status" label={formData.isActive ? <Badge bg="success-subtle" className="text-success">Aktif</Badge> : <Badge bg="secondary-subtle" className="text-secondary">Nonaktif</Badge>} checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})}/></div></Form.Group></Col></Row>
                             <Row><Col md={6}><Form.Group className="mb-4"><Form.Label className="fw-bold small text-muted">EDITOR BERITA</Form.Label><div className="d-flex align-items-center h-100 pt-1"><Form.Check type="switch" id="staff-editor" label={formData.is_editor ? <Badge bg="info-subtle" className="text-info">Editor</Badge> : <Badge bg="secondary-subtle" className="text-secondary">Bukan Editor</Badge>} checked={formData.is_editor} disabled={editorProcessing} onChange={e => void handleEditorToggle(e.target.checked)}/></div><Form.Text className="text-muted extra-small d-block mt-2">Jika aktif, guru ini bisa inline edit/add berita & pengumuman di halaman publik.</Form.Text></Form.Group></Col></Row>
                             {(formData.type === 'guru' || formData.type === 'pimpinan') && (<Form.Group className="mb-4"><Form.Label className="fw-bold small text-muted">MATA PELAJARAN / JABATAN</Form.Label><Form.Control placeholder="Contoh: Matematika / Waka Kurikulum" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}/></Form.Group>)}
                             <div className="mt-4 pt-3 border-top d-flex gap-2"><Button type="submit" variant="success" className="px-4 fw-bold rounded-pill shadow-sm" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} {id ? 'Update Data' : 'Simpan Data'}</Button><Button as={Link as any} to="/dashboard/staff" variant="light" className="px-4 fw-bold rounded-pill border">Batal</Button></div>
                          </Col>
                       </Row>
                    </Card.Body>
                 </Card>
              </Form>
           </Col>
        </Row>
      </Container>
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered contentClassName="bg-transparent border-0"><Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header><Modal.Body className="text-center">{reconvertedPreviewUrl && <img src={reconvertedPreviewUrl} className="img-fluid rounded shadow-lg" alt="Preview Konversi" />}{reconvertedBlob && <p className="text-white small mt-3">Pratinjau hasil konversi. Ukuran file baru: {formatBytes(reconvertedBlob.size)}</p>}</Modal.Body><Modal.Footer className="border-0 justify-content-center"><Button variant="light" onClick={() => setShowPreviewModal(false)}>Batal</Button><Button variant="success" onClick={handleSaveReconvertedImage} disabled={isReconverting}>{isReconverting ? <Spinner size="sm" /> : "Simpan & Ganti Foto"}</Button></Modal.Footer></Modal>
      <style>{`.shadow-inner { box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); } .x-small { font-size: 0.7rem; } .btn-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 10px; } .border-end-md { border-right: 1px solid #dee2e6; } @media (max-width: 767.98px) { .border-end-md { border-right: none; } }`}</style>
    </DashboardLayout>
  );
};

export default StaffForm;

