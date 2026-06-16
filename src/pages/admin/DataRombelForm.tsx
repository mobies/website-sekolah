import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Spinner, Modal, Badge } from 'react-bootstrap';
import { useTenant } from '../../firebase/TenantContext';
import { useRombelData } from '../../hooks/useRombelData';
import { rtdb as database } from '../../firebase/config';
import { ref as dbRef, onValue, off } from 'firebase/database';
import { toast } from '../../utils/alerts';

interface DataRombelFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  tahunAjaranNama: string;
  idKelas?: string;
  isEdit?: boolean;
}

interface FormData {
  name: string;
  wali_kelas: string;
}

interface StaffData {
  id: string;
  name: string;
}

interface KelasData {
  kode: string;
  nama: string;
}

const DataRombelForm: React.FC<DataRombelFormProps> = ({
  isOpen,
  onClose,
  onSaved,
  tahunAjaranNama,
  idKelas,
  isEdit = false
}) => {
  const { tenantId } = useTenant();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    wali_kelas: ''
  });
  const [selectedIdKelas, setSelectedIdKelas] = useState<string>(idKelas || '');
  const [staffList, setStaffList] = useState<StaffData[]>([]);
  const [kelasList, setKelasList] = useState<KelasData[]>([]);
  const [usedKelasKodes, setUsedKelasKodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(isEdit);

  const { getRombel, saveRombel } = useRombelData();

  // Load staff (guru only)
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const staffRef = dbRef(database, `tenants/${tenantId}/staff`);
    const unsubscribe = onValue(
      staffRef,
      snapshot => {
        if (snapshot.exists()) {
          const staffData = snapshot.val();
          const guruList: StaffData[] = [];
          Object.entries(staffData).forEach(([key, value]: any) => {
            if (value.type === 'guru' && !value.deleted) {
              guruList.push({
                id: key,
                name: value.name || 'Unknown'
              });
            }
          });
          guruList.sort((a, b) => a.name.localeCompare(b.name));
          setStaffList(guruList);
        }
      },
      err => {
        console.error('Error loading staff:', err);
      }
    );

    return () => off(staffRef, 'value', unsubscribe);
  }, [isOpen, tenantId]);

  // Load kelas list
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    const kelasRef = dbRef(database, `tenants/${tenantId}/references/kelas`);
    const unsubscribe = onValue(
      kelasRef,
      snapshot => {
        if (snapshot.exists()) {
          const kelasData: KelasData[] = [];
          Object.entries(snapshot.val()).forEach(([kode, data]: any) => {
            kelasData.push({
              kode,
              nama: data.nama || 'Unknown'
            });
          });
          kelasData.sort((a, b) => a.nama.localeCompare(b.nama));
          setKelasList(kelasData);
        }
      },
      err => {
        console.error('Error loading kelas:', err);
      }
    );

    return () => off(kelasRef, 'value', unsubscribe);
  }, [isOpen, tenantId]);

  // Load rombel list for selected tahun ajaran to identify used kelas (create mode only)
  useEffect(() => {
    if (!isOpen || !tenantId || isEdit || !tahunAjaranNama) return;

    const rombelRef = dbRef(database, `tenants/${tenantId}/references/rombel/${tahunAjaranNama}`);
    const unsubscribe = onValue(
      rombelRef,
      snapshot => {
        const usedKodes = new Set<string>();
        if (snapshot.exists()) {
          Object.entries(snapshot.val()).forEach(([kode]: any) => {
            usedKodes.add(kode);
          });
        }
        setUsedKelasKodes(usedKodes);
      },
      err => {
        console.error('Error loading rombel:', err);
        setUsedKelasKodes(new Set());
      }
    );

    return () => off(rombelRef, 'value', unsubscribe);
  }, [isOpen, tenantId, tahunAjaranNama, isEdit]);

  // Load rombel data on edit mode
  useEffect(() => {
    if (!isEdit || !idKelas || !tenantId) {
      setFetching(false);
      return;
    }

    const loadData = async () => {
      try {
        const data = await getRombel(tenantId, tahunAjaranNama, idKelas);
        if (data) {
          setFormData({
            name: data.name || '',
            wali_kelas: data.wali_kelas || ''
          });
        }
        setFetching(false);
      } catch (err) {
        console.error('Error loading rombel:', err);
        setError('Gagal memuat data rombel');
        setFetching(false);
      }
    };

    loadData();
  }, [isEdit, idKelas, tenantId, tahunAjaranNama]);

  const handleInputChange = (e: React.ChangeEvent<any>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleKelasChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedIdKelas(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.name.trim()) {
      setError('Nama Rombel harus diisi');
      return;
    }

    if (formData.name.length > 100) {
      setError('Nama Rombel maksimal 100 karakter');
      return;
    }

    if (!formData.wali_kelas) {
      setError('Wali Kelas harus dipilih');
      return;
    }

    if (!selectedIdKelas) {
      setError('Kelas harus dipilih');
      return;
    }

    if (!tenantId) {
      setError('Data tahun ajaran tidak valid');
      return;
    }

    setLoading(true);

    try {
      await saveRombel(tenantId, tahunAjaranNama, selectedIdKelas, {
        name: formData.name.trim(),
        wali_kelas: formData.wali_kelas,
        members: isEdit ? undefined : null
      });

      toast.fire({
        icon: 'success',
        title: isEdit ? 'Data rombel berhasil diupdate' : 'Rombel berhasil ditambah'
      });

      onSaved();
      handleClose();
    } catch (err: any) {
      console.error('Error saving rombel:', err);
      setError(err.message || 'Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', wali_kelas: '' });
    setSelectedIdKelas(isEdit && idKelas ? idKelas : '');
    setError('');
    onClose();
  };

  if (fetching) {
    return (
      <Modal show={isOpen} onHide={handleClose} backdrop="static">
        <Modal.Header>
          <Modal.Title>{isEdit ? 'Edit' : 'Tambah'} Rombel</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Spinner animation="border" />
        </Modal.Body>
      </Modal>
    );
  }

  return (
    <Modal show={isOpen} onHide={handleClose} backdrop="static" size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? 'Edit' : 'Tambah'} Rombel</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          {/* Tahun Ajaran */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Tahun Ajaran</Form.Label>
            <div>
              <Badge bg="primary" className="py-2 px-3 fs-6">
                {tahunAjaranNama}
              </Badge>
            </div>
          </Form.Group>

          {/* ID Kelas */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Kelas *</Form.Label>
            {isEdit ? (
              <div>
                <Badge bg="secondary" className="py-2 px-3 fs-6">
                  {selectedIdKelas}
                </Badge>
              </div>
            ) : (
              <>
                <Form.Select
                  value={selectedIdKelas}
                  onChange={handleKelasChange}
                  disabled={loading || kelasList.length === 0}
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList
                    .filter(kelas => !usedKelasKodes.has(kelas.kode))
                    .map(kelas => (
                      <option key={kelas.kode} value={kelas.kode}>
                        {kelas.kode} - {kelas.nama}
                      </option>
                    ))}
                </Form.Select>
                {kelasList.filter(k => !usedKelasKodes.has(k.kode)).length === 0 && (
                  <Form.Text className="text-warning">
                    {kelasList.length === 0
                      ? 'Tidak ada kelas tersedia. Tambahkan kelas terlebih dahulu di menu Data Kelas.'
                      : 'Semua kelas sudah ditambahkan ke rombel tahun ini.'}
                  </Form.Text>
                )}
              </>
            )}
          </Form.Group>

          {/* Nama Rombel */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Nama Rombel *</Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Contoh: XII IPA 1"
              maxLength={100}
              disabled={loading}
            />
            <Form.Text className="text-muted">
              {formData.name.length}/100 karakter
            </Form.Text>
          </Form.Group>

          {/* Wali Kelas */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Wali Kelas *</Form.Label>
            <Form.Select
              name="wali_kelas"
              value={formData.wali_kelas}
              onChange={handleInputChange}
              disabled={loading || staffList.length === 0}
            >
              <option value="">-- Pilih Guru --</option>
              {staffList.map(guru => (
                <option key={guru.id} value={guru.id}>
                  {guru.name}
                </option>
              ))}
            </Form.Select>
            {staffList.length === 0 && (
              <Form.Text className="text-warning">
                Tidak ada guru tersedia. Tambahkan guru terlebih dahulu di menu Data Pengajar.
              </Form.Text>
            )}
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Batal
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
          {isEdit ? 'Update' : 'Tambah'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DataRombelForm;
