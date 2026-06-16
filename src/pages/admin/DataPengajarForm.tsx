import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { ref as dbRef, get, update, onValue } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { toast } from '../../utils/alerts';

interface Staff {
  id: string;
  name: string;
  type: string;
}

interface Mapel {
  kode: string;
  nama: string;
}

interface FormData {
  staffId: string;
  staffName: string;
  mapelKodes: string[];
}

const DataPengajarForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [formData, setFormData] = useState<FormData>({ staffId: '', staffName: '', mapelKodes: [] });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [error, setError] = useState('');
  
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [mapelList, setMapelList] = useState<Mapel[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedMapels, setSelectedMapels] = useState<Set<string>>(new Set());

  const isEdit = !!id;

  // Load staff & mapel dropdown data
  useEffect(() => {
    if (!tenantId) return;

    setLoadingData(true);
    let unsubStaff: (() => void) | undefined;
    let unsubMapel: (() => void) | undefined;

    try {
      // Fetch staff (filtered by type='guru')
      const staffRef = getDBRef(tenantId, 'staff');
      unsubStaff = onValue(staffRef, (snapshot) => {
        if (snapshot.exists()) {
          const items: Staff[] = [];
          snapshot.forEach((child) => {
            const staffData = child.val();
            if (staffData.type === 'guru') {
              items.push({ id: child.key!, name: staffData.name, type: staffData.type });
            }
          });
          setStaffList(items.sort((a, b) => a.name.localeCompare(b.name)));
        }
        setLoadingData(false);
      });

      // Fetch mapel
      const mapelRef = getDBRef(tenantId, 'references/mapel');
      unsubMapel = onValue(mapelRef, (snapshot) => {
        if (snapshot.exists()) {
          const items: Mapel[] = [];
          snapshot.forEach((child) => {
            const mapelData = child.val();
            items.push({ kode: child.key!, nama: mapelData.nama });
          });
          setMapelList(items.sort((a, b) => a.nama.localeCompare(b.nama)));
        }
      });
    } catch (err) {
      console.error('Error loading data:', err);
      setLoadingData(false);
    }

    return () => {
      if (unsubStaff) unsubStaff();
      if (unsubMapel) unsubMapel();
    };
  }, [tenantId]);

  // Load pengajar data on edit
  useEffect(() => {
    if (!isEdit || !tenantId) {
      setFetching(false);
      return;
    }

    const loadData = async () => {
      try {
        const snapshot = await get(dbRef(database, `tenants/${tenantId}/references/pengajar/${id}`));
        if (snapshot.exists()) {
          const data = snapshot.val();
          setFormData(data);
          setSelectedMapels(new Set(data.mapelKodes || []));
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
    if (!formData.staffId.trim()) {
      setError('Silakan pilih guru');
      return;
    }
    if (selectedMapels.size === 0) {
      setError('Silakan pilih minimal 1 mapel');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const mapelArray = Array.from(selectedMapels);
      const dataToSave = isEdit ? {
        mapelKodes: mapelArray
      } : {
        staffId: formData.staffId,
        staffName: formData.staffName,
        mapelKodes: mapelArray,
        createdAt: Date.now()
      };

      if (isEdit) {
        // On edit, update at the staffId key
        await update(dbRef(database, `tenants/${tenantId}/references/pengajar/${id}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil diupdate' });
      } else {
        // On create, use update() with staffId as the key (semantic key instead of auto-generated ID)
        dataToSave.createdAt = Date.now();
        await update(dbRef(database, `tenants/${tenantId}/references/pengajar/${formData.staffId}`), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil ditambah' });
      }

      navigate('/dashboard/referensi/pengajar');
    } catch (err) {
      setError('Gagal menyimpan data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching || loadingData) return <DashboardLayout><Container className="mt-4"><Spinner animation="border" /></Container></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container className="mt-4 mb-4" style={{ maxWidth: '600px' }}>
        <Row className="mb-4">
          <Col>
            <h2 className="fw-bold">{isEdit ? 'Edit' : 'Tambah'} Data Pengajar</h2>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          {/* Staff Selection */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Guru</Form.Label>
            {isEdit && formData.staffId ? (
              <div className="p-3 bg-light rounded border d-flex align-items-center gap-2">
                <span>{formData.staffName}</span>
                <Badge bg="info">Tidak dapat diubah</Badge>
              </div>
            ) : (
              <Form.Select
                value={formData.staffId}
                onChange={(e) => {
                  const selectedStaff = staffList.find(s => s.id === e.target.value);
                  setFormData({
                    ...formData,
                    staffId: e.target.value,
                    staffName: selectedStaff?.name || ''
                  });
                }}
                disabled={loading}
                className={!formData.staffId && error ? 'is-invalid' : ''}
              >
                <option value="">-- Pilih Guru --</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          {/* Mapel Selection */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Mapel yang Diampu</Form.Label>
            <div className="border rounded p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {mapelList.length === 0 ? (
                <p className="text-muted mb-0">Tidak ada data mapel</p>
              ) : (
                mapelList.map(mapel => (
                  <Form.Check
                    key={mapel.kode}
                    type="checkbox"
                    id={`mapel-${mapel.kode}`}
                    label={mapel.nama}
                    checked={selectedMapels.has(mapel.kode)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedMapels);
                      if (e.target.checked) {
                        newSelected.add(mapel.kode);
                      } else {
                        newSelected.delete(mapel.kode);
                      }
                      setSelectedMapels(newSelected);
                    }}
                    disabled={loading}
                    className="mb-2"
                  />
                ))
              )}
            </div>
            {selectedMapels.size > 0 && (
              <div className="mt-2">
                <small className="text-muted">
                  {selectedMapels.size} mapel dipilih
                </small>
              </div>
            )}
          </Form.Group>

          <Row className="gap-2">
            <Col xs="auto">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                {isEdit ? 'Update' : 'Tambah'}
              </Button>
            </Col>
            <Col xs="auto">
              <Button variant="secondary" onClick={() => navigate('/dashboard/referensi/pengajar')} disabled={loading}>
                Batal
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default DataPengajarForm;
