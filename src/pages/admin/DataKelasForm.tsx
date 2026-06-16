import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { ref as dbRef, get, update } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { toast } from '../../utils/alerts';

interface FormData {
  kode: string;
  nama: string;
}

const DataKelasForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [formData, setFormData] = useState<FormData>({ kode: '', nama: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [error, setError] = useState('');

  const isEdit = !!id;

  useEffect(() => {
    if (!isEdit || !tenantId) {
      setFetching(false);
      return;
    }

    const loadData = async () => {
      try {
        const snapshot = await get(dbRef(database, `tenants/${tenantId}/references/kelas/${id}`));
        if (snapshot.exists()) {
          setFormData(snapshot.val());
        }
      } catch (err) {
        setError('Gagal memuat data');
        console.error(err);
      } finally {
        setFetching(false);
      }
    };

    loadData();
  }, [id, tenantId, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kode.trim()) {
      setError('Kode kelas harus diisi');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(formData.kode)) {
      setError('Kode harus huruf besar & angka saja');
      return;
    }
    if (!formData.nama.trim()) {
      setError('Nama kelas harus diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const dataToSave: any = {
        kode: formData.kode,
        nama: formData.nama
      };
      
      if (isEdit) {
        // On edit, update at the kode key
        await update(dbRef(database, `tenants/${tenantId}/references/kelas/${id}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil diupdate' });
      } else {
        // On create, use update() with kode as the key (semantic key instead of auto-generated ID)
        dataToSave.createdAt = Date.now();
        await update(dbRef(database, `tenants/${tenantId}/references/kelas/${formData.kode}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil ditambah' });
      }

      navigate('/dashboard/referensi/kelas');
    } catch (err) {
      setError('Gagal menyimpan data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <DashboardLayout><Container className="mt-4"><Spinner animation="border" /></Container></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container className="mt-4 mb-4" style={{ maxWidth: '600px' }}>
        <Row className="mb-4">
          <Col>
            <h2 className="fw-bold">{isEdit ? 'Edit' : 'Tambah'} Data Kelas</h2>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Kode Kelas</Form.Label>
            {isEdit && formData.kode ? (
              <div className="p-3 bg-light rounded border d-flex align-items-center gap-2">
                <span className="fw-bold">{formData.kode}</span>
                <Badge bg="info">Tidak dapat diubah</Badge>
              </div>
            ) : (
              <>
                <Form.Control
                  type="text"
                  placeholder="cth: VIIA"
                  value={formData.kode}
                  onChange={(e) => setFormData({ ...formData, kode: e.target.value.toUpperCase() })}
                  disabled={loading}
                  maxLength={20}
                />
                <Form.Text className="text-muted">Huruf besar & angka saja</Form.Text>
              </>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Nama Kelas</Form.Label>
            <Form.Control
              type="text"
              placeholder="cth: VII A"
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              disabled={loading}
            />
          </Form.Group>

          <Row className="gap-2">
            <Col xs="auto">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                {isEdit ? 'Update' : 'Tambah'}
              </Button>
            </Col>
            <Col xs="auto">
              <Button variant="secondary" onClick={() => navigate('/dashboard/referensi/kelas')} disabled={loading}>
                Batal
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default DataKelasForm;
