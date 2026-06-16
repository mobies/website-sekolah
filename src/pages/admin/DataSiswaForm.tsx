import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';

import { ref as dbRef, get, update } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { toast } from '../../utils/alerts';

interface FormData {
  nisn: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  gender: 'L' | 'P';
  email: string;
}

const DataSiswaForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [formData, setFormData] = useState<FormData>({
    nisn: '',
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    gender: 'L',
    email: ''
  });
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
        const snapshot = await get(dbRef(database, `tenants/${tenantId}/references/siswa/${id}`));
        if (snapshot.exists()) {
          setFormData({ nisn: id!, ...snapshot.val() });
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

    // Validation
    if (!formData.nisn.trim()) {
      setError('NISN harus diisi');
      return;
    }
    if (!/^\d{10}$/.test(formData.nisn)) {
      setError('NISN harus 10 digit angka');
      return;
    }
    if (!formData.nama.trim()) {
      setError('Nama lengkap harus diisi');
      return;
    }
    if (formData.nama.length > 100) {
      setError('Nama lengkap maksimal 100 karakter');
      return;
    }
    if (!formData.tempat_lahir.trim()) {
      setError('Tempat lahir harus diisi');
      return;
    }
    if (formData.tempat_lahir.length > 50) {
      setError('Tempat lahir maksimal 50 karakter');
      return;
    }
    if (!formData.tanggal_lahir) {
      setError('Tanggal lahir harus diisi');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.tanggal_lahir)) {
      setError('Format tanggal lahir harus YYYY-MM-DD');
      return;
    }
    if (!formData.gender || (formData.gender !== 'L' && formData.gender !== 'P')) {
      setError('Jenis kelamin harus dipilih');
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Format email tidak valid');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const dataToSave: any = {
        nisn: formData.nisn,
        nama: formData.nama,
        tempat_lahir: formData.tempat_lahir,
        tanggal_lahir: formData.tanggal_lahir,
        gender: formData.gender,
        updatedAt: Date.now()
      };

      // Only add email if it has a value (Firebase doesn't accept undefined)
      if (formData.email && formData.email.trim()) {
        dataToSave.email = formData.email;
      }

      if (isEdit) {
        // On edit, update at NISN key
        await update(dbRef(database, `tenants/${tenantId}/references/siswa/${id}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil diupdate' });
      } else {
        // On create, use NISN as key (semantic ID)
        await update(dbRef(database, `tenants/${tenantId}/references/siswa/${formData.nisn}`), {
          ...dataToSave,
          createdAt: Date.now()
        });
        toast.fire({ icon: 'success', title: 'Data berhasil ditambah' });
      }

      navigate('/dashboard/data-siswa');
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
      <Container className="mt-4 mb-4" style={{ maxWidth: '700px' }}>
        <Row className="mb-4">
          <Col>
            <h2 className="fw-bold">{isEdit ? 'Edit' : 'Tambah'} Data Siswa</h2>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          {/* NISN */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">NISN (Nomor Induk Siswa Nasional)</Form.Label>
            {isEdit ? (
              <div className="p-3 bg-light rounded border d-flex align-items-center gap-2">
                <span className="fw-bold">{formData.nisn}</span>
                <Badge bg="info">Tidak dapat diubah</Badge>
              </div>
            ) : (
              <>
                <Form.Control
                  type="text"
                  placeholder="cth: 1234567890"
                  value={formData.nisn}
                  onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                  disabled={loading}
                  maxLength={10}
                />
                <Form.Text className="text-muted">10 digit angka</Form.Text>
              </>
            )}
          </Form.Group>

          {/* Nama Lengkap */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Nama Lengkap</Form.Label>
            <Form.Control
              type="text"
              placeholder="cth: Ahmad Rasyid"
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              disabled={loading}
              maxLength={100}
            />
            <Form.Text className="text-muted">Maksimal 100 karakter</Form.Text>
          </Form.Group>

          {/* Tempat Lahir */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Tempat Lahir</Form.Label>
            <Form.Control
              type="text"
              placeholder="cth: Jakarta"
              value={formData.tempat_lahir}
              onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
              disabled={loading}
              maxLength={50}
            />
            <Form.Text className="text-muted">Maksimal 50 karakter</Form.Text>
          </Form.Group>

          {/* Tanggal Lahir */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Tanggal Lahir</Form.Label>
            <Form.Control
              type="date"
              value={formData.tanggal_lahir}
              onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
              disabled={loading}
            />
            <Form.Text className="text-muted">Format: YYYY-MM-DD</Form.Text>
          </Form.Group>

          {/* Jenis Kelamin */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Jenis Kelamin</Form.Label>
            <div>
              <Form.Check
                type="radio"
                label="Laki-laki"
                name="gender"
                value="L"
                checked={formData.gender === 'L'}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })}
                disabled={loading}
                className="mb-2"
              />
              <Form.Check
                type="radio"
                label="Perempuan"
                name="gender"
                value="P"
                checked={formData.gender === 'P'}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })}
                disabled={loading}
              />
            </div>
          </Form.Group>

          {/* Email */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Email (Opsional)</Form.Label>
            <Form.Control
              type="email"
              placeholder="cth: siswa@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
            />
            <Form.Text className="text-muted">Email valid jika diisi</Form.Text>
          </Form.Group>

          <Row className="gap-2">
            <Col xs="auto">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                {isEdit ? 'Update' : 'Tambah'}
              </Button>
            </Col>
            <Col xs="auto">
              <Button variant="secondary" onClick={() => navigate('/dashboard/data-siswa')} disabled={loading}>
                Batal
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default DataSiswaForm;
