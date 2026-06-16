import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';

import { ref as dbRef, get, push, update } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { toast } from '../../utils/alerts';

interface FormData {
  nama: string;
}

const ItemPembayaranForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [formData, setFormData] = useState<FormData>({ nama: '' });
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
        const snapshot = await get(dbRef(database, `tenants/${tenantId}/references/pembayaran/${id}`));
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
    if (!formData.nama.trim()) {
      setError('Nama item harus diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const dataToSave = {
        nama: formData.nama,
        createdAt: Date.now()
      };

      if (isEdit) {
        await update(dbRef(database, `tenants/${tenantId}/references/pembayaran/${id}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil diupdate' });
      } else {
        await push(dbRef(database, `tenants/${tenantId}/references/pembayaran`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil ditambah' });
      }

      navigate('/dashboard/referensi/pembayaran');
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
            <h2 className="fw-bold">{isEdit ? 'Edit' : 'Tambah'} Item Pembayaran</h2>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Nama Item</Form.Label>
            <Form.Control
              type="text"
              placeholder="cth: SPP Bulanan"
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
              <Button variant="secondary" onClick={() => navigate('/dashboard/referensi/pembayaran')} disabled={loading}>
                Batal
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default ItemPembayaranForm;
