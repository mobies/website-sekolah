import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Button, Row, Col, Spinner, Alert, Form, Badge } from 'react-bootstrap';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { ref as dbRef, onValue, remove } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { showConfirm, toast } from '../../utils/alerts';

const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

interface TahunAjaran {
  id: string;
  nama: string;
  tanggal_mulai?: string;
}

interface ItemJadwal {
  id: string;
  tahunAjaranId: string;
  hari: string;
  nomorUrut: number;
  jenis: string;
  namaKegiatan?: string;
  jamAwal: string;
  durasi: number;
  jamAkhir?: string;
  createdAt?: number;
}

const ItemJadwalList: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [selectedTahunAjaranId, setSelectedTahunAjaranId] = useState<string>('');
  const [allJadwal, setAllJadwal] = useState<ItemJadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch Tahun Ajaran
  useEffect(() => {
    if (!tenantId) return;

    const taRef = getDBRef(tenantId, 'references/tahun-ajaran');
    const unsubscribe = onValue(
      taRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const items: TahunAjaran[] = [];
          snapshot.forEach((child) => {
            items.push({ id: child.key!, ...child.val() });
          });
          items.sort((a, b) => (b.nama || '').localeCompare(a.nama || ''));
          setTahunAjaranList(items);
          if (items.length > 0 && !selectedTahunAjaranId) {
            setSelectedTahunAjaranId(items[0].id);
          }
        } else {
          setTahunAjaranList([]);
        }
      },
      (err) => {
        console.error('Error loading tahun ajaran:', err);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  // Fetch Jadwal (nested structure: tahunAjaranNama/hari/nomorUrut)
  useEffect(() => {
    if (!tenantId) return;

    setLoading(true);
    const dataRef = getDBRef(tenantId, 'references/jadwal');
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const items: ItemJadwal[] = [];
          const data = snapshot.val();
          
          // Traverse nested structure: tahunAjaranNama -> hari -> nomorUrut
          Object.entries(data).forEach(([tahunAjaranNama, hariData]: any) => {
            if (typeof hariData === 'object' && hariData !== null) {
              Object.entries(hariData).forEach(([hari, nomorUrutData]: any) => {
                if (typeof nomorUrutData === 'object' && nomorUrutData !== null) {
                  Object.entries(nomorUrutData).forEach(([nomorUrut, jadwalData]: any) => {
                    if (typeof jadwalData === 'object') {
                      // Construct composite ID for reference
                      const compositeId = `${tahunAjaranNama}_${hari}_${nomorUrut}`;
                      items.push({ 
                        id: compositeId,
                        tahunAjaranId: jadwalData.tahunAjaranId || tahunAjaranNama,
                        hari,
                        nomorUrut: parseInt(nomorUrut),
                        ...jadwalData 
                      });
                    }
                  });
                }
              });
            }
          });
          setAllJadwal(items);
        } else {
          setAllJadwal([]);
        }
        setLoading(false);
      },
      (err) => {
        setError('Gagal memuat data');
        console.error(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  // Filter & Sort Jadwal
  const displayJadwal = allJadwal
    .filter(item => item.tahunAjaranId === selectedTahunAjaranId)
    .sort((a, b) => {
      const hariCompare = HARI_OPTIONS.indexOf(a.hari) - HARI_OPTIONS.indexOf(b.hari);
      if (hariCompare !== 0) return hariCompare;
      return (a.nomorUrut || 0) - (b.nomorUrut || 0);
    });

  // Group Jadwal by Hari
  const groupedJadwal = useMemo(() => {
    const groups: { [key: string]: ItemJadwal[] } = {};
    HARI_OPTIONS.forEach(hari => {
      groups[hari] = displayJadwal.filter(item => item.hari === hari);
    });
    return groups;
  }, [displayJadwal]);

  const handleDelete = async (item: ItemJadwal) => {
    const result = await showConfirm('Hapus Data?', `Yakin ingin menghapus jadwal ${item.hari} nomor ${item.nomorUrut}?`);
    if (!result.isConfirmed) return;

    try {
      // Parse composite ID to get tahunAjaranNama, hari, nomorUrut
      const [tahunAjaranNama, hari, nomorUrut] = item.id.split('_');
      const path = `tenants/${tenantId}/references/jadwal/${tahunAjaranNama}/${hari}/${nomorUrut}`;
      await remove(dbRef(database, path));
      toast.fire({ icon: 'success', title: 'Data berhasil dihapus' });
    } catch (err) {
      console.error(err);
      toast.fire({ icon: 'error', title: 'Gagal menghapus data' });
    }
  };

  if (loading) return <DashboardLayout><Container className="mt-4"><Spinner animation="border" /></Container></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="mt-4 mb-4">
        <Row className="mb-4 align-items-center">
          <Col>
            <h2 className="fw-bold">Item Jadwal</h2>
          </Col>
          <Col className="text-end">
            <Button 
              variant="success" 
              onClick={() => navigate('/dashboard/referensi/jadwal/tambah', { state: { tahunAjaranId: selectedTahunAjaranId } })}
              disabled={!selectedTahunAjaranId}
            >
              <FaPlus className="me-2" /> Tambah Baru
            </Button>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        {tahunAjaranList.length === 0 ? (
          <Alert variant="warning">Belum ada data Tahun Ajaran. Silakan buat terlebih dahulu di Data Referensi.</Alert>
        ) : (
          <>
            <Row className="mb-3">
              <Col md={3}>
                <Form.Group>
                  <Form.Label className="fw-bold mb-2">Filter Tahun Ajaran</Form.Label>
                  <Form.Select 
                    value={selectedTahunAjaranId}
                    onChange={(e) => setSelectedTahunAjaranId(e.target.value)}
                  >
                    {tahunAjaranList.map(ta => (
                      <option key={ta.id} value={ta.id}>{ta.nama}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            {displayJadwal.length === 0 ? (
              <Alert variant="info">Belum ada jadwal untuk tahun ajaran ini. Klik "Tambah Baru" untuk menambah.</Alert>
            ) : (
              <>
                {HARI_OPTIONS.map(hari => {
                  const itemsForHari = groupedJadwal[hari];
                  if (itemsForHari.length === 0) return null;

                  return (
                    <div key={hari} className="mb-4">
                      <Row className="mb-2 align-items-center">
                        <Col>
                          <h5 className="fw-bold mb-0">
                            <Badge bg="primary" className="me-2">{hari}</Badge>
                            ({itemsForHari.length} item)
                          </h5>
                        </Col>
                      </Row>
                      <Table striped bordered hover responsive className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: '5%' }}>No</th>
                            <th style={{ width: '12%' }}>Nomor</th>
                            <th style={{ width: '15%' }}>Jenis</th>
                            <th style={{ width: '28%' }}>Jam Awal - Jam Akhir (Durasi)</th>
                            <th style={{ width: '20%' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsForHari.map((item, idx) => (
                            <tr key={item.id}>
                              <td>{idx + 1}</td>
                              <td><strong>{String(item.nomorUrut).padStart(2, '0')}</strong></td>
                              <td>
                                {item.jenis}
                                {item.namaKegiatan && <div className="small text-muted">{item.namaKegiatan}</div>}
                              </td>
                              <td>
                                {item.jamAwal} - {item.jamAkhir} ({item.durasi} menit)
                              </td>
                              <td>
                                <Button size="sm" variant="primary" className="me-2" onClick={() => navigate(`/dashboard/referensi/jadwal/edit/${item.id}`)}>
                                  <FaEdit /> Edit
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => handleDelete(item)}>
                                  <FaTrash /> Hapus
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </Container>
    </DashboardLayout>
  );
};

export default ItemJadwalList;
