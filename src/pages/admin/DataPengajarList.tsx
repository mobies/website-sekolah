import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Button, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { ref as dbRef, onValue, remove } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { showConfirm, toast } from '../../utils/alerts';

interface DataPengajar {
  id: string;
  staffId: string;
  staffName: string;
  mapelKodes: string[];
  createdAt?: number;
}

interface Mapel {
  kode: string;
  nama: string;
}

const DataPengajarList: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [data, setData] = useState<DataPengajar[]>([]);
  const [mapelList, setMapelList] = useState<Mapel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create mapel name map for display (kode -> nama)
  const mapelMap = useMemo(() => {
    const map: { [kode: string]: string } = {};
    mapelList.forEach(m => {
      map[m.kode] = m.nama;
    });
    return map;
  }, [mapelList]);

  useEffect(() => {
    if (!tenantId) return;

    let unsubPengajar: (() => void) | undefined;
    let unsubMapel: (() => void) | undefined;

    // Load pengajar data
    const dataRef = getDBRef(tenantId, 'references/pengajar');
    unsubPengajar = onValue(
      dataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const items: DataPengajar[] = [];
          snapshot.forEach((child) => {
            items.push({ id: child.key!, ...child.val() });
          });
          setData(items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        } else {
          setData([]);
        }
        setLoading(false);
      },
      (err) => {
        setError('Gagal memuat data');
        console.error(err);
        setLoading(false);
      }
    );

    // Load mapel data for name resolution
    const mapelRef = getDBRef(tenantId, 'references/mapel');
    unsubMapel = onValue(mapelRef, (snapshot) => {
      if (snapshot.exists()) {
        const items: Mapel[] = [];
        snapshot.forEach((child) => {
          const mapelData = child.val();
          items.push({ kode: child.key!, nama: mapelData.nama });
        });
        setMapelList(items);
      } else {
        setMapelList([]);
      }
    });

    return () => {
      if (unsubPengajar) unsubPengajar();
      if (unsubMapel) unsubMapel();
    };
  }, [tenantId]);

  const handleDelete = async (id: string, staffName: string) => {
    const result = await showConfirm('Hapus Data?', `Yakin ingin menghapus "${staffName}"?`);
    if (!result.isConfirmed) return;

    try {
      await remove(dbRef(database, `tenants/${tenantId}/references/pengajar/${id}`));
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
            <h2 className="fw-bold">Data Pengajar</h2>
          </Col>
          <Col className="text-end">
            <Button variant="success" onClick={() => navigate('/dashboard/referensi/pengajar/tambah')}>
              <FaPlus className="me-2" /> Tambah Baru
            </Button>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        {data.length === 0 ? (
          <Alert variant="info">Belum ada data. Klik "Tambah Baru" untuk menambah.</Alert>
        ) : (
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr>
                <th style={{ width: '5%' }}>No</th>
                <th style={{ width: '30%' }}>Guru</th>
                <th>Mapel yang Diampu</th>
                <th style={{ width: '15%' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td>{item.staffName}</td>
                  <td>
                    {item.mapelKodes && item.mapelKodes.length > 0 ? (
                      <div className="d-flex gap-1 flex-wrap">
                        {item.mapelKodes.map(mapelKode => (
                          <Badge key={mapelKode} bg="info">
                            {mapelMap[mapelKode] || mapelKode}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    <Button size="sm" variant="primary" className="me-2" onClick={() => navigate(`/dashboard/referensi/pengajar/edit/${item.id}`)}>
                      <FaEdit /> Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(item.id, item.staffName)}>
                      <FaTrash /> Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Container>
    </DashboardLayout>
  );
};

export default DataPengajarList;
