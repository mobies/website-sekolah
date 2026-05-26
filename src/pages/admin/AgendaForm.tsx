import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaSave, FaArrowLeft } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity, updateTimeStats } from '../../firebase/utils';
import { onValue, serverTimestamp, ref as dbRef, update } from 'firebase/database';
import { showAlert, toast } from '../../utils/alerts';
import { rtdb as database } from '../../firebase/config';

const AgendaForm: React.FC = () => {
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
    location: '',
    description: '',
    status: 'active' as 'active' | 'completed'
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [originalDate, setOriginalDate] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && tenantId) {
      onValue(getDBRef(tenantId, `agenda/${id}`), (snap) => {
        if (snap.val()) {
          const data = snap.val();
          setFormData(data);
          setOriginalDate(data.date);
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
      const data = {
        ...formData,
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
        time: formData.time,
        loc: formData.location,
        deleted: false
      };

      if (isEdit) {
        updates[`tenants/${tenantId}/agenda/${id}`] = { ...data, createdAt: serverTimestamp() };
        updates[`tenants/${tenantId}/agenda_search_index/${id}`] = searchIndexData;

        if (originalDate && originalDate !== formData.date) {
          await updateTimeStats(tenantId, 'agenda', originalDate, -1);
          await updateTimeStats(tenantId, 'agenda', formData.date, 1);
        }
        await logActivity(tenantId, { action: 'EDIT', target: 'AGENDA', title: formData.title });
      } else {
        const timestampId = Date.now().toString();
        updates[`tenants/${tenantId}/agenda/${timestampId}`] = { ...data, createdAt: serverTimestamp() };
        updates[`tenants/${tenantId}/agenda_search_index/${timestampId}`] = searchIndexData;
        await updateTimeStats(tenantId, 'agenda', formData.date, 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'AGENDA', title: formData.title });
      }
      
      await update(dbRef(database), updates);
      toast.fire({ icon: 'success', title: 'Agenda berhasil disimpan' });
      navigate('/dashboard/agenda');
    } catch (error) {
      console.error("Save agenda error:", error);
      showAlert('Gagal', 'Gagal menyimpan agenda.', 'error');
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
          <div><h4 className="fw-bold mb-1">{isEdit ? 'Edit Agenda' : 'Tambah Agenda'}</h4></div>
        </div>
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={12} className="mb-3">
                  <Form.Label className="fw-bold small">Nama Kegiatan</Form.Label>
                  <Form.Control value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
                </Col>
                <Col md={6} className="mb-3">
                  <Form.Label className="fw-bold small">Tanggal</Form.Label>
                  <Form.Control type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </Col>
                <Col md={6} className="mb-3">
                  <Form.Label className="fw-bold small">Waktu</Form.Label>
                  <Form.Control value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} placeholder="Misal: 08:00 - Selesai" required />
                </Col>
                <Col md={12} className="mb-3">
                  <Form.Label className="fw-bold small">Lokasi</Form.Label>
                  <Form.Control value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} required />
                </Col>
                <Col md={12} className="mb-4">
                  <Form.Label className="fw-bold small">Deskripsi (Opsional)</Form.Label>
                  <Form.Control as="textarea" rows={4} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </Col>
                <Col md={12}>
                  <Button type="submit" variant="success" className="px-5 py-2 fw-bold" disabled={loading}>
                    {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Agenda
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </DashboardLayout>
  );
};

export default AgendaForm;
