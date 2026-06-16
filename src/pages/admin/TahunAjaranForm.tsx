import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { ref as dbRef, get, update } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { toast } from '../../utils/alerts';

interface FormData {
  tanggal_mulai: string;
  nama: string;
}

const TahunAjaranForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [formData, setFormData] = useState<FormData>({ tanggal_mulai: '', nama: '' });
  const [dateInputValue, setDateInputValue] = useState<string>('2026-07-01'); // YYYY-MM-DD format for input
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [error, setError] = useState('');

  const isEdit = !!id;

  // Helper: Convert YYYY-MM-DD to DD-MM-YYYY
  const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  // Helper: Convert DD-MM-YYYY to YYYY-MM-DD
  const formatDateInput = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return '';
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  };

  // Helper: parse date and calculate tahun ajaran (YYYY-YYYY)
  const calculateTahunAjaran = (dateStr: string): string | null => {
    if (!dateStr || dateStr.length !== 10) return null;
    const [year] = dateStr.split('-');
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) return null;
    return `${yearNum}-${yearNum + 1}`;
  };

  // Handle date input change and auto-calculate tahun ajaran
  const handleDateChange = (value: string) => {
    if (!value) return;
    setDateInputValue(value);
    const displayFormat = formatDateDisplay(value);
    const tahunAjaran = calculateTahunAjaran(value) || '';
    setFormData({
      tanggal_mulai: displayFormat,
      nama: tahunAjaran
    });
  };

  useEffect(() => {
    if (!isEdit || !tenantId) {
      setFetching(false);
      setDateInputValue('2026-07-01'); // Reset to default
      return;
    }

    const loadData = async () => {
      try {
        const snapshot = await get(dbRef(database, `tenants/${tenantId}/references/tahun-ajaran/${id}`));
        if (snapshot.exists()) {
          const data = snapshot.val();
          setFormData(data);
          // Convert stored DD-MM-YYYY to YYYY-MM-DD for date input
          if (data.tanggal_mulai) {
            setDateInputValue(formatDateInput(data.tanggal_mulai));
          }
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
    if (!dateInputValue.trim() || dateInputValue.length !== 10) {
      setError('Tanggal mulai tahun ajaran harus diisi');
      return;
    }
    // Validate date is within July 1-31, 2026
    if (dateInputValue < '2026-07-01' || dateInputValue > '2026-07-31') {
      setError('Tanggal harus dalam rentang 1-31 Juli 2026');
      return;
    }
    if (!formData.nama.trim()) {
      setError('Tahun ajaran tidak valid');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const dataToSave: any = {
        tanggal_mulai: formData.tanggal_mulai,
        nama: formData.nama
      };
      
      if (isEdit) {
        // On edit, update at the nama key
        await update(dbRef(database, `tenants/${tenantId}/references/tahun-ajaran/${id}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil diupdate' });
      } else {
        // On create, use update() with nama as the key (semantic key instead of auto-generated ID)
        dataToSave.createdAt = Date.now();
        await update(dbRef(database, `tenants/${tenantId}/references/tahun-ajaran/${formData.nama}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil ditambah' });
      }

      navigate('/dashboard/referensi/tahun-ajaran');
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
            <h2 className="fw-bold">{isEdit ? 'Edit' : 'Tambah'} Tahun Ajaran</h2>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Tanggal Mulai Tahun Ajaran</Form.Label>
            <Form.Control
              type="date"
              value={dateInputValue}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={loading}
              min="2026-07-01"
              max="2026-07-31"
            />
            <Form.Text className="text-muted">Pilih tanggal antara 1-31 Juli 2026</Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Tahun Ajaran (Otomatis)</Form.Label>
            <Form.Control
              type="text"
              value={formData.nama}
              disabled
              className="bg-light"
              placeholder="Akan dihitung otomatis"
            />
            <Form.Text className="text-muted">
              {formData.nama ? `Preview: ${formData.nama}` : 'Masukkan tanggal mulai terlebih dahulu'}
            </Form.Text>
          </Form.Group>

          <Row className="gap-2">
            <Col xs="auto">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                {isEdit ? 'Update' : 'Tambah'}
              </Button>
            </Col>
            <Col xs="auto">
              <Button variant="secondary" onClick={() => navigate('/dashboard/referensi/tahun-ajaran')} disabled={loading}>
                Batal
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default TahunAjaranForm;
