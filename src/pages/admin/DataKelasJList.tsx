import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { ref as dbRef, onValue, remove } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { showConfirm, toast } from '../../utils/alerts';

interface DataKelas {
  id: string;
  kode: string;
  nama: string;
  createdAt?: number;
}

const DataKelasJList: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [data, setData] = useState<DataKelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantId) return;

    const dataRef = getDBRef(tenantId, 'references/kelas');
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const items: DataKelas[] = [];
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

    return () => unsubscribe();
  }, [tenantId]);

  const handleDelete = async (id: string, nama: string) => {
    const result = await showConfirm('Hapus Data?', `Yakin ingin menghapus "${nama}"?`);
    if (!result.isConfirmed) return;

    try {
      await remove(dbRef(database, `tenants/${tenantId}/references/kelas/${id}`));
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
            <h2 className="fw-bold">Data Kelas</h2>
          </Col>
          <Col className="text-end">
            <Button variant="success" onClick={() => navigate('/dashboard/referensi/kelas/tambah')}>
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
                <th style={{ width: '15%' }}>Kode</th>
                <th>Nama Kelas</th>
                <th style={{ width: '15%' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td><strong>{item.kode}</strong></td>
                  <td>{item.nama}</td>
                  <td>
                    <Button size="sm" variant="primary" className="me-2" onClick={() => navigate(`/dashboard/referensi/kelas/edit/${item.id}`)}>
                      <FaEdit /> Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(item.id, item.nama)}>
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

export default DataKelasJList;
