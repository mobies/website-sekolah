import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Form, Button, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { ref as dbRef, get, update } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { toast } from '../../utils/alerts';

const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const JENIS_OPTIONS = ['Pembelajaran', 'Kegiatan Lain'];

interface TahunAjaran {
  id: string;
  nama: string;
}

interface FormData {
  tahunAjaranId: string;
  tahunAjaranNama: string;
  hari: string;
  nomorUrut: number;
  jenis: string;
  namaKegiatan?: string;
  jamAwal: string;
  durasi: number;
  jamAkhir: string;
}

const ItemJadwalForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId } = useTenant();
  
  const stateTA = (location.state as { tahunAjaranId?: string })?.tahunAjaranId;
  
  // const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [formData, setFormData] = useState<FormData>({
    tahunAjaranId: '',
    tahunAjaranNama: '',
    hari: 'Senin',
    nomorUrut: 1,
    jenis: 'Pembelajaran',
    namaKegiatan: '',
    jamAwal: '07:00',
    durasi: 45,
    jamAkhir: '07:45'
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [error, setError] = useState('');
  const [jamAwalLocked, setJamAwalLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [nomorUrutLocked] = useState(!id); // Lock nomor urut in create mode

  const isEdit = !!id;

  // Fetch Tahun Ajaran
  useEffect(() => {
    if (!tenantId) return;

    const taRef = getDBRef(tenantId, 'references/tahun-ajaran');
    get(taRef).then(snapshot => {
      if (snapshot.exists()) {
        const items: TahunAjaran[] = [];
        snapshot.forEach(child => {
          items.push({ id: child.key!, ...child.val() as any });
        });
        items.sort((a, b) => (b.nama || '').localeCompare(a.nama || ''));
        // setTahunAjaranList(items);

        // Set initial tahunAjaranId from state or first TA
        if (!isEdit) {
          const taId = stateTA || (items.length > 0 ? items[0].id : '');
          const ta = items.find(x => x.id === taId);
          if (ta) {
            setFormData(prev => ({
              ...prev,
              tahunAjaranId: ta.id,
              tahunAjaranNama: ta.nama
            }));
          }
        }
      }
    }).catch(err => console.error(err));
  }, [tenantId, isEdit, stateTA]);

  // Load existing data (edit mode)
  const [originalDurasi, setOriginalDurasi] = useState<number | null>(null);

  useEffect(() => {
    if (!isEdit || !tenantId) {
      setFetching(false);
      return;
    }

    const loadData = async () => {
      try {
        // Parse composite ID: tahunAjaranNama_hari_nomorUrut
        const [tahunAjaranNama, hari, nomorUrut] = id!.split('_');
        const path = `tenants/${tenantId}/references/jadwal/${tahunAjaranNama}/${hari}/${nomorUrut}`;
        const snapshot = await get(dbRef(database, path));
        if (snapshot.exists()) {
          const data = snapshot.val() as FormData;
          setFormData(data);
          setOriginalDurasi(data.durasi); // Store original durasi for comparison
          setFetching(false);
        }
      } catch (err) {
        setError('Gagal memuat data');
        console.error(err);
        setFetching(false);
      }
    };

    loadData();
  }, [id, tenantId, isEdit]);

  // Helper: Add minutes to time
  const addMinutesToTime = (time: string, minutes: number): string => {
    const [h, m] = time.split(':').map(Number);
    let totalMinutes = h * 60 + m + minutes;
    if (totalMinutes >= 24 * 60) totalMinutes = 24 * 60 - 1;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  // Helper: Calculate jamAkhir from jamAwal + durasi
  const calculateJamAkhir = (awal: string, durasi: number): string => {
    return addMinutesToTime(awal, durasi);
  };

  // Check previous item and lock jamAwal if exists
  useEffect(() => {
    if (isEdit || !tenantId || !formData.tahunAjaranId || !formData.hari || !formData.nomorUrut) {
      setJamAwalLocked(false);
      return;
    }

    const checkPreviousItem = async () => {
      try {
        // Use nested path: references/jadwal/{tahunAjaranNama}/{hari}/
        const prevNomorUrut = formData.nomorUrut - 1;
        const jadwalPath = `tenants/${tenantId}/references/jadwal/${formData.tahunAjaranNama}/${formData.hari}/${prevNomorUrut}`;
        const snapshot = await get(dbRef(database, jadwalPath));
        
        if (snapshot.exists()) {
          const prevData = snapshot.val() as any;
          const calculatedJamAwal = addMinutesToTime(prevData.jamAwal, prevData.durasi);
          setFormData(prev => ({
            ...prev,
            jamAwal: calculatedJamAwal,
            jamAkhir: calculateJamAkhir(calculatedJamAwal, prev.durasi)
          }));
          setJamAwalLocked(true);
          setLockReason(`Item sebelumnya berakhir pada ${calculatedJamAwal}`);
        } else {
          setJamAwalLocked(false);
        }
      } catch (err) {
        // Item sebelumnya tidak ada, tidak dikunci
        setJamAwalLocked(false);
        console.error('Error checking previous item:', err);
      }
    };

    checkPreviousItem();
  }, [formData.tahunAjaranId, formData.hari, formData.nomorUrut, isEdit, tenantId, formData.tahunAjaranNama]);

  // Auto-calculate nomorUrut based on existing items for this hari (create mode only)
  useEffect(() => {
    if (isEdit || !tenantId || !formData.tahunAjaranId || !formData.hari) return;

    const calculateNomorUrut = async () => {
      try {
        // Use nested path: references/jadwal/{tahunAjaranNama}/{hari}/
        const jadwalPath = `tenants/${tenantId}/references/jadwal/${formData.tahunAjaranNama}/${formData.hari}`;
        const snapshot = await get(dbRef(database, jadwalPath));
        
        let maxNomorUrut = 0;
        if (snapshot.exists()) {
          // snapshot.val() returns object with nomorUrut keys like {1: {...}, 2: {...}, ...}
          const nomorUrutKeys = Object.keys(snapshot.val());
          maxNomorUrut = nomorUrutKeys.length > 0
            ? Math.max(...nomorUrutKeys.map(k => parseInt(k) || 0))
            : 0;
        }

        const nextNomorUrut = maxNomorUrut + 1;
        setFormData(prev => ({
          ...prev,
          nomorUrut: nextNomorUrut
        })); 
      } catch (err) {
        // Path doesn't exist yet, start with 1
        setFormData(prev => ({
          ...prev,
          nomorUrut: 1
        }));
        console.error('Error calculating nomor urut:', err);
      }
    };

    calculateNomorUrut();
  }, [formData.tahunAjaranId, formData.hari, isEdit, tenantId, formData.tahunAjaranNama]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.tahunAjaranId) {
      setError('Tahun Ajaran harus dipilih');
      return;
    }
    if (!formData.hari) {
      setError('Hari harus dipilih');
      return;
    }
    if (!formData.nomorUrut || formData.nomorUrut < 1) {
      setError('Nomor Urut harus diisi (min 1)');
      return;
    }
    if (!formData.jenis) {
      setError('Jenis harus dipilih');
      return;
    }
    if (formData.jenis === 'Kegiatan Lain') {
      if (!formData.namaKegiatan || !formData.namaKegiatan.trim()) {
        setError('Nama Kegiatan harus diisi jika Jenis adalah "Kegiatan Lain"');
        return;
      }
      if (formData.namaKegiatan.length > 20) {
        setError('Nama Kegiatan maksimal 20 karakter');
        return;
      }
    }
    if (!formData.jamAwal || !/^\d{2}:\d{2}$/.test(formData.jamAwal)) {
      setError('Jam Awal harus dalam format HH:MM');
      return;
    }
    if (!formData.durasi || formData.durasi < 1) {
      setError('Durasi harus diisi (min 1 menit)');
      return;
    }

    // Check jamAwal + durasi doesn't exceed 24 hours
    const [h, m] = formData.jamAwal.split(':').map(Number);
    if (h * 60 + m + formData.durasi >= 24 * 60) {
      setError('Jam Awal + Durasi tidak boleh melebihi 24:00');
      return;
    }

    setLoading(true);

    try {
      const dataToSave: any = {
        tahunAjaranId: formData.tahunAjaranNama,
        tahunAjaranNama: formData.tahunAjaranNama,
        hari: formData.hari,
        nomorUrut: formData.nomorUrut,
        jenis: formData.jenis,
        jamAwal: formData.jamAwal,
        durasi: formData.durasi,
        jamAkhir: calculateJamAkhir(formData.jamAwal, formData.durasi),
        createdAt: isEdit ? undefined : Date.now()
      };
      
      // Include namaKegiatan if jenis is 'Kegiatan Lain'
      if (formData.jenis === 'Kegiatan Lain' && formData.namaKegiatan) {
        dataToSave.namaKegiatan = formData.namaKegiatan;
      }

      if (isEdit) {
        delete dataToSave.createdAt;
        // Parse composite ID: tahunAjaranNama_hari_nomorUrut
        const [tahunAjaranNama, hari, nomorUrut] = id!.split('_');
        const path = `tenants/${tenantId}/references/jadwal/${tahunAjaranNama}/${hari}/${nomorUrut}`;
        await update(dbRef(database, path), dataToSave);

        // If durasi changed, update following items in the same hari
        const durasiChanged = originalDurasi !== formData.durasi;
        if (durasiChanged && originalDurasi !== null) {
          const durasiDiff = formData.durasi - originalDurasi;
          
          try {
            // Query nested path for specific hari
            const jadwalPath = `tenants/${tenantId}/references/jadwal/${formData.tahunAjaranNama}/${formData.hari}`;
            const snapshot = await get(dbRef(database, jadwalPath));
            
            if (snapshot.exists()) {
              const updates: any = {};
              const hariData = snapshot.val();
              
              // Find all items with nomorUrut > current item
              Object.entries(hariData).forEach(([nomorUrutKey, itemData]: any) => {
                const itemNomorUrut = parseInt(nomorUrutKey);
                if (itemNomorUrut > formData.nomorUrut) {
                  const [h, m] = itemData.jamAwal.split(':').map(Number);
                  const newTotalMinutes = h * 60 + m + durasiDiff;
                  const newH = Math.floor(newTotalMinutes / 60);
                  const newM = newTotalMinutes % 60;
                  const newJamAwal = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
                  const newJamAkhir = addMinutesToTime(newJamAwal, itemData.durasi);
                  
                  const updatePath = `tenants/${tenantId}/references/jadwal/${formData.tahunAjaranNama}/${formData.hari}/${nomorUrutKey}`;
                  updates[updatePath] = {
                    ...itemData,
                    jamAwal: newJamAwal,
                    jamAkhir: newJamAkhir
                  };
                }
              });
              
              if (Object.keys(updates).length > 0) {
                await update(dbRef(database), updates);
              }
            }
          } catch (err) {
            console.warn('Warning: Could not update following items:', err);
            // Don't fail the main update, just warn
          }
        }

        toast.fire({ icon: 'success', title: 'Data berhasil diupdate' });
      } else {
        dataToSave.createdAt = Date.now();
        // Use nested path format: /{tahunAjaranNama}/{hari}/{nomorUrut}
        const path = `tenants/${tenantId}/references/jadwal/${formData.tahunAjaranNama}/${formData.hari}/${formData.nomorUrut}`;
        await update(dbRef(database, path), dataToSave);
        toast.fire({ icon: 'success', title: 'Data berhasil ditambah' });
      }

      navigate('/dashboard/referensi/jadwal');
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
            <h2 className="fw-bold">{isEdit ? 'Edit' : 'Tambah'} Item Jadwal</h2>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          {/* Tahun Ajaran */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Tahun Ajaran</Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Badge bg="primary" className="py-2 px-3">
                {formData.tahunAjaranNama}
              </Badge>
              <small className="text-muted">
                {isEdit ? 'Tidak dapat diubah' : 'Dipilih dari halaman Item Jadwal'}
              </small>
            </div>
          </Form.Group>

          {/* Hari */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Hari *</Form.Label>
            <Form.Select
              value={formData.hari}
              onChange={(e) => setFormData({ ...formData, hari: e.target.value })}
              disabled={loading}
            >
              {HARI_OPTIONS.map(hari => (
                <option key={hari} value={hari}>{hari}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Nomor Urut */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              Nomor Urut {nomorUrutLocked && <Badge bg="info" className="ms-2">Otomatis</Badge>}
            </Form.Label>
            <Form.Control
              type="number"
              min="1"
              max="99"
              value={formData.nomorUrut}
              onChange={(e) => setFormData({ ...formData, nomorUrut: parseInt(e.target.value) || 0 })}
              disabled={loading || nomorUrutLocked}
              placeholder="01-99"
            />
            {nomorUrutLocked ? (
              <small className="text-info d-block mt-1">
                🔒 Dihitung otomatis berdasarkan item yang sudah ada untuk hari {formData.hari}
              </small>
            ) : (
              <small className="text-muted d-block mt-1">Dapat diubah sesuai kebutuhan</small>
            )}
          </Form.Group>

          {/* Jenis */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Jenis *</Form.Label>
            <Form.Select
              value={formData.jenis}
              onChange={(e) => setFormData({ ...formData, jenis: e.target.value })}
              disabled={loading}
            >
              {JENIS_OPTIONS.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Nama Kegiatan (conditional) */}
          {formData.jenis === 'Kegiatan Lain' && (
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Nama Kegiatan *</Form.Label>
              <Form.Control
                type="text"
                maxLength={20}
                placeholder="cth: Upacara, Pertemuan Orang Tua"
                value={formData.namaKegiatan || ''}
                onChange={(e) => setFormData({ ...formData, namaKegiatan: e.target.value })}
                disabled={loading}
              />
              <small className="text-muted d-block mt-1">
                {formData.namaKegiatan ? formData.namaKegiatan.length : 0}/20 karakter
              </small>
            </Form.Group>
          )}

          {/* Jam Awal */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              Jam Awal {jamAwalLocked && <Badge bg="warning" className="ms-2">Terkunci</Badge>}
            </Form.Label>
            <Form.Control
              type="time"
              value={formData.jamAwal}
              onChange={(e) => {
                const newJamAwal = e.target.value;
                setFormData({
                  ...formData,
                  jamAwal: newJamAwal,
                  jamAkhir: calculateJamAkhir(newJamAwal, formData.durasi)
                });
              }}
              disabled={loading || jamAwalLocked}
            />
            {jamAwalLocked && (
              <small className="text-warning d-block mt-1">
                🔒 {lockReason}
              </small>
            )}
          </Form.Group>

          {/* Durasi */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Durasi (menit) *</Form.Label>
            <Form.Control
              type="number"
              min="1"
              max="999"
              value={formData.durasi}
              onChange={(e) => {
                const newDurasi = parseInt(e.target.value) || 0;
                setFormData({
                  ...formData,
                  durasi: newDurasi,
                  jamAkhir: calculateJamAkhir(formData.jamAwal, newDurasi)
                });
              }}
              disabled={loading}
              placeholder="45"
            />
          </Form.Group>

          {/* Jam Akhir (Read-only) */}
          <Form.Group className="mb-4">
            <Form.Label className="fw-bold">Jam Akhir (Otomatis)</Form.Label>
            <div className="input-group">
              <span className="input-group-text" style={{ width: '100%', backgroundColor: '#f0f0f0' }}>
                <strong>{formData.jamAkhir}</strong>
              </span>
            </div>
            <small className="text-muted d-block mt-1">Dihitung dari Jam Awal + Durasi</small>
          </Form.Group>

          {/* Submit Buttons */}
          <Row className="gap-2">
            <Col xs="auto">
              <Button variant="primary" type="submit" disabled={loading || !formData.tahunAjaranId}>
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                {isEdit ? 'Update' : 'Tambah'}
              </Button>
            </Col>
            <Col xs="auto">
              <Button variant="secondary" onClick={() => navigate('/dashboard/referensi/jadwal')} disabled={loading}>
                Batal
              </Button>
            </Col>
          </Row>
        </Form>
      </Container>
    </DashboardLayout>
  );
};

export default ItemJadwalForm;
