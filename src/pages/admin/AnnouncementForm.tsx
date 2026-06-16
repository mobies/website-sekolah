import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaSave, FaArrowLeft } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { useIsOwner } from '../../firebase/useIsOwner';
import { getDBRef, logActivity, updateTimeStats, getStorageRef, uploadBytesWithCache, updateCounter } from '../../firebase/utils';
import { onValue, serverTimestamp, ref as dbRef, update } from 'firebase/database';
import { showAlert, toast } from '../../utils/alerts';
import { rtdb as database } from '../../firebase/config';
import { getDownloadURL } from 'firebase/storage';

const AnnouncementForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { isOwner, loading: ownerLoading } = useIsOwner();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    status: 'published' as 'published' | 'draft',
    date: new Date().toISOString().split('T')[0],
    attachmentUrl: null as string | null,
    attachmentType: null as string | null,
    hasAttachment: false,
  });
  
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [originalDate, setOriginalDate] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && tenantId) {
      onValue(getDBRef(tenantId, `announcements/${id}`), (snap) => {
        if (snap.val()) {
          const data = snap.val();
          setFormData(data);
          setOriginalDate(data.date);
          if (data.attachmentUrl) {
            setFormData(prev => ({ ...prev, attachmentUrl: data.attachmentUrl, attachmentType: data.attachmentType, hasAttachment: true }));
          }
        }
        setFetching(false);
      }, { onlyOnce: true });
    }
  }, [id, tenantId, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setLoading(true);
    try {
      const updates: any = {};
      
      let newAttachmentUrl = formData.attachmentUrl;
      let newAttachmentType = formData.attachmentType;
      let newHasAttachment = formData.hasAttachment;

      // 1. Handle attachment upload
      if (attachmentFile) {
        const attachmentPath = `announcements/${id || Date.now()}/${attachmentFile.name}`;
        const attachmentRef = getStorageRef(tenantId, attachmentPath);
        const uploadResult = await uploadBytesWithCache(attachmentRef, attachmentFile);
        newAttachmentUrl = await getDownloadURL(uploadResult.ref);
        newAttachmentType = attachmentFile.type;
        newHasAttachment = true;

        // Optional: Delete old attachment if a new one is uploaded during edit
        // if (isEdit && formData.attachmentUrl && formData.attachmentUrl !== newAttachmentUrl) {
        //   try { await deleteObject(getStorageRef(tenantId, formData.attachmentUrl)); } catch (e) { console.warn("Could not delete old attachment", e); }
        // }
      } else if (isEdit && !formData.attachmentUrl && formData.hasAttachment) {
        // If attachment was removed during edit
        newAttachmentUrl = null;
        newAttachmentType = null;
        newHasAttachment = false;
      }

      const data = {
        ...formData,
        attachmentUrl: newAttachmentUrl,
        attachmentType: newAttachmentType,
        hasAttachment: newHasAttachment,
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
        deleted: false,
        hasAttachment: newHasAttachment,
      };

      if (isEdit) {
        updates[`tenants/${tenantId}/announcements/${id}`] = { ...data, createdAt: serverTimestamp() };
        updates[`tenants/${tenantId}/announcement_search_index/${id}`] = searchIndexData;

        if (originalDate && originalDate !== formData.date) {
          await updateTimeStats(tenantId, 'announcement', originalDate, -1);
          await updateTimeStats(tenantId, 'announcement', formData.date, 1);
        }
        await logActivity(tenantId, { action: 'EDIT', target: 'PENGUMUMAN', title: formData.title });
      } else {
        const timestampId = Date.now().toString();
        updates[`tenants/${tenantId}/announcements/${timestampId}`] = { ...data, createdAt: serverTimestamp() };
        updates[`tenants/${tenantId}/announcement_search_index/${timestampId}`] = searchIndexData;
        await updateTimeStats(tenantId, 'announcement', formData.date, 1);
        await updateCounter(tenantId, 'totalAnnouncements', 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'PENGUMUMAN', title: formData.title });
      }
      
      await update(dbRef(database), updates);
      toast.fire({ icon: 'success', title: 'Pengumuman berhasil disimpan' });
      navigate('/dashboard/pengumuman');
    } catch (error) {
      showAlert('Gagal', 'Gagal menyimpan pengumuman.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching || ownerLoading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;
  if (isOwner) return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="p-4">
          <div className="alert alert-warning">Fasilitas tambah/edit pengumuman tidak tersedia untuk Owner.</div>
          <Button variant="success" onClick={() => navigate('/dashboard')} className="rounded-pill px-4">Kembali ke Dashboard</Button>
        </div>
      </Container>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <div className="d-flex align-items-center mb-4">
          <Button onClick={() => navigate(-1)} variant="light" className="btn-icon me-3"><FaArrowLeft /></Button>
          <div><h4 className="fw-bold mb-1">{isEdit ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</h4></div>
        </div>
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">Judul Pengumuman</Form.Label>
                <Form.Control value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">Isi Pengumuman</Form.Label>
                <Form.Control as="textarea" rows={8} value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">Lampiran (Opsional)</Form.Label>
                <Form.Control type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttachmentFile(e.target.files ? e.target.files[0] : null)} />
                {formData.attachmentUrl && <small className="text-muted">File saat ini: <a href={formData.attachmentUrl} target="_blank" rel="noopener noreferrer">Lihat Lampiran</a></small>}
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Tanggal</Form.Label>
                    <Form.Control type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-bold small">Status</Form.Label>
                    <div>
                      <Form.Check inline type="radio" label="Draft" name="status" value="draft" checked={formData.status === 'draft'} onChange={() => setFormData({...formData, status: 'draft'})} />
                      <Form.Check inline type="radio" label="Published" name="status" value="published" checked={formData.status === 'published'} onChange={() => setFormData({...formData, status: 'published'})} />
                    </div>
                  </Form.Group>
                </Col>
              </Row>
              <Button type="submit" variant="success" className="px-5 py-2 fw-bold" disabled={loading}>
                {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Pengumuman
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </DashboardLayout>
  );
};

export default AnnouncementForm;
