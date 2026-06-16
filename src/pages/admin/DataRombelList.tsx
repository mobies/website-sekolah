import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Row, Col, Spinner, Alert, Badge, Form } from 'react-bootstrap';
import { FaEdit, FaTrash, FaPlus, FaUsers } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { rtdb as database } from '../../firebase/config';
import { ref as dbRef, onValue, off } from 'firebase/database';
import DataRombelForm from './DataRombelForm';
import RombelMembersModal from './RombelMembersModal';
import { useRombelData } from '../../hooks/useRombelData';
import { toast, showConfirm } from '../../utils/alerts';

interface TahunAjaran {
  nama: string;
}

interface RombelItem {
  id: string;
  tahunAjaranNama: string;
  idKelas: string;
  name: string;
  wali_kelas: string;
  members?: string[] | null;
}

const DataRombelList: React.FC = () => {
  const { tenantId } = useTenant();

  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [selectedTA, setSelectedTA] = useState('');

  const [rombelList, setRombelList] = useState<RombelItem[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [kelasNames, setKelasNames] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRombel, setEditingRombel] = useState<RombelItem | null>(null);

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedRombel, setSelectedRombel] = useState<RombelItem | null>(null);

  const { deleteRombel } = useRombelData();

  // Load tahun ajaran list
  useEffect(() => {
    if (!tenantId) return;

    const taRef = dbRef(database, `tenants/${tenantId}/references/tahun-ajaran`);
    const unsubscribe = onValue(
      taRef,
      snapshot => {
        if (snapshot.exists()) {
          const tas: TahunAjaran[] = [];
          snapshot.forEach(child => {
            tas.push({ nama: child.key as string, ...child.val() });
          });
          tas.sort((a, b) => (b.nama || '').localeCompare(a.nama || ''));
          setTahunAjaranList(tas);

          // Auto-select first TA
          if (tas.length > 0 && !selectedTA) {
            setSelectedTA(tas[0].nama);
          }
        }
      },
      err => {
        console.error('Error loading tahun ajaran:', err);
      }
    );

    return () => off(taRef, 'value', unsubscribe);
  }, [tenantId, selectedTA]);

  // Load staff names
  useEffect(() => {
    if (!tenantId) return;

    const staffRef = dbRef(database, `tenants/${tenantId}/staff`);
    const unsubscribe = onValue(
      staffRef,
      snapshot => {
        if (snapshot.exists()) {
          const staffData: Record<string, string> = {};
          snapshot.forEach(child => {
            const data = child.val();
            if (!data.deleted) {
              staffData[child.key as string] = data.name || 'Unknown';
            }
          });
          setStaffNames(staffData);
        }
      },
      err => {
        console.error('Error loading staff:', err);
      }
    );

    return () => off(staffRef, 'value', unsubscribe);
  }, [tenantId]);

  // Load kelas names
  useEffect(() => {
    if (!tenantId) return;

    const kelasRef = dbRef(database, `tenants/${tenantId}/references/kelas`);
    const unsubscribe = onValue(
      kelasRef,
      snapshot => {
        if (snapshot.exists()) {
          const kelasData: Record<string, string> = {};
          snapshot.forEach(child => {
            const data = child.val();
            kelasData[child.key as string] = data.nama || 'Unknown';
          });
          setKelasNames(kelasData);
        }
      },
      err => {
        console.error('Error loading kelas:', err);
      }
    );

    return () => off(kelasRef, 'value', unsubscribe);
  }, [tenantId]);

  // Load rombel list for selected TA
  useEffect(() => {
    if (!tenantId || !selectedTA) {
      setRombelList([]);
      return;
    }

    setLoading(true);
    const rombelRef = dbRef(database, `tenants/${tenantId}/references/rombel/${selectedTA}`);

    const unsubscribe = onValue(
      rombelRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const items: RombelItem[] = [];

          Object.entries(data).forEach(([idKelas, rombelData]: any) => {
            items.push({
              id: `${selectedTA}_${idKelas}`,
              tahunAjaranNama: selectedTA,
              idKelas,
              name: rombelData.name || '',
              wali_kelas: rombelData.wali_kelas || '',
              members: rombelData.members || null
            });
          });

          items.sort((a, b) => a.name.localeCompare(b.name));
          setRombelList(items);
        } else {
          setRombelList([]);
        }
        setLoading(false);
      },
      err => {
        console.error('Error loading rombel:', err);
        setError('Gagal memuat data rombel');
        setLoading(false);
      }
    );

    return () => off(rombelRef, 'value', unsubscribe);
  }, [tenantId, selectedTA]);

  const handleAddNew = () => {
    setEditingRombel(null);
    setShowFormModal(true);
  };

  const handleEdit = (rombel: RombelItem) => {
    setEditingRombel(rombel);
    setShowFormModal(true);
  };

  const handleDelete = async (rombel: RombelItem) => {
    const result = await showConfirm(
      'Hapus Rombel?',
      `Yakin ingin menghapus rombel "${rombel.name}"? Siswa akan dikeluarkan dari rombel ini.`
    );

    if (!result.isConfirmed) return;

    try {
      await deleteRombel(tenantId!, selectedTA, rombel.idKelas);
      toast.fire({ icon: 'success', title: 'Rombel berhasil dihapus' });
    } catch (err: any) {
      toast.fire({ icon: 'error', title: err.message || 'Gagal menghapus rombel' });
    }
  };

  const handleManageMembers = (rombel: RombelItem) => {
    setSelectedRombel(rombel);
    setShowMembersModal(true);
  };

  const handleFormSaved = () => {
    setShowFormModal(false);
    setEditingRombel(null);
  };

  const handleMembersSaved = () => {
    setShowMembersModal(false);
    setSelectedRombel(null);
  };

  return (
    <DashboardLayout>
      <Container fluid className="mt-4 mb-4">
        {/* Header */}
        <Row className="mb-4 align-items-center">
          <Col>
            <div className="d-flex align-items-center gap-3">
              <div
                className="bg-info rounded-3 p-3 d-flex align-items-center justify-content-center"
                style={{ width: '45px', height: '45px' }}
              >
                <FaUsers className="text-white" size={20} />
              </div>
              <div>
                <h2 className="m-0 fw-bold">Data Rombel</h2>
                <p className="m-0 text-muted small">Kelola rombel (kelompok belajar) siswa</p>
              </div>
            </div>
          </Col>
          <Col className="text-end">
            <Button variant="success" onClick={handleAddNew} disabled={!selectedTA}>
              <FaPlus className="me-2" /> Tambah Baru
            </Button>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        {/* Filter Tahun Ajaran */}
        <Form.Group className="mb-4">
          <Form.Label className="fw-bold">Filter Tahun Ajaran</Form.Label>
          <Form.Select
            value={selectedTA}
            onChange={e => setSelectedTA(e.target.value)}
            className="w-md"
            style={{ maxWidth: '300px' }}
          >
            <option value="">-- Pilih Tahun Ajaran --</option>
            {tahunAjaranList.map(ta => (
              <option key={ta.nama} value={ta.nama}>
                {ta.nama}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        )}

        {/* Empty State */}
        {!loading && rombelList.length === 0 && (
          <Alert variant="info" className="text-center py-5">
            <p className="mb-0">
              {selectedTA ? 'Belum ada data rombel untuk tahun ajaran ini' : 'Pilih tahun ajaran terlebih dahulu'}
            </p>
          </Alert>
        )}

        {/* Rombel Table */}
        {!loading && rombelList.length > 0 && (
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead className="table-dark">
                <tr>
                  <th style={{ width: '5%' }}>No</th>
                  <th>Nama Rombel</th>
                  <th>ID Kelas</th>
                  <th>Nama Kelas</th>
                  <th>Wali Kelas</th>
                  <th style={{ width: '8%' }}>Jumlah Siswa</th>
                  <th style={{ width: '22%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rombelList.map((rombel, idx) => (
                  <tr key={rombel.id}>
                    <td>{idx + 1}</td>
                    <td className="fw-bold">{rombel.name}</td>
                    <td>
                      <Badge bg="secondary">{rombel.idKelas}</Badge>
                    </td>
                    <td>{kelasNames[rombel.idKelas] || '-'}</td>
                    <td>{staffNames[rombel.wali_kelas] || '-'}</td>
                    <td className="text-center">
                      <Badge bg="primary">{rombel.members?.length || 0}</Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="info"
                        className="me-2"
                        onClick={() => handleManageMembers(rombel)}
                        title="Kelola Siswa"
                      >
                        <FaUsers /> Siswa
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        className="me-2"
                        onClick={() => handleEdit(rombel)}
                      >
                        <FaEdit /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(rombel)}
                      >
                        <FaTrash /> Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Container>

      {/* Modals */}
      <DataRombelForm
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSaved={handleFormSaved}
        tahunAjaranNama={selectedTA}
        idKelas={editingRombel?.idKelas}
        isEdit={!!editingRombel}
      />

      {selectedRombel && (
        <RombelMembersModal
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          onSaved={handleMembersSaved}
          tahunAjaranNama={selectedRombel.tahunAjaranNama}
          idKelas={selectedRombel.idKelas}
          rombelName={selectedRombel.name}
        />
      )}
    </DashboardLayout>
  );
};

export default DataRombelList;
