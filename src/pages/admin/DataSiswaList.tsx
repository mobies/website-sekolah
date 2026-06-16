import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { FaEdit, FaTrash, FaPlus, FaDownload, FaUndo } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { ref as dbRef, onValue, update } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { showConfirm, toast } from '../../utils/alerts';
import ImportSiswaMenu from './siswa/ImportSiswaMenu';

interface DataSiswa {
  nisn: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  gender: 'L' | 'P';
  email?: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number;
  permanentlyDeleted?: boolean;
}

const DataSiswaList: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [allData, setAllData] = useState<DataSiswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

  // Filter data based on viewMode
  const data = allData.filter(item => {
    if (item.permanentlyDeleted) return false; // Never show permanently deleted
    return viewMode === 'active' ? !item.deletedAt : !!item.deletedAt;
  });

  useEffect(() => {
    if (!tenantId) return;

    const dataRef = getDBRef(tenantId, 'references/siswa');
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const items: DataSiswa[] = [];
          snapshot.forEach((child) => {
            const siswa = { nisn: child.key!, ...child.val() };
            items.push(siswa);
          });
          setAllData(items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        } else {
          setAllData([]);
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

  const handleDelete = async (nisn: string, nama: string) => {
    const result = await showConfirm('Hapus Data?', `Yakin ingin menghapus "${nama}"?`);
    if (!result.isConfirmed) return;

    try {
      // Soft delete: set deletedAt timestamp instead of removing
      await update(dbRef(database, `tenants/${tenantId}/references/siswa/${nisn}`), {
        deletedAt: Date.now()
      });
      toast.fire({ icon: 'success', title: 'Data berhasil dihapus' });
    } catch (err) {
      console.error(err);
      toast.fire({ icon: 'error', title: 'Gagal menghapus data' });
    }
  };

  const handleRestore = async (nisn: string, nama: string) => {
    const result = await showConfirm('Restore Data?', `Yakin ingin mengembalikan "${nama}"?`);
    if (!result.isConfirmed) return;

    try {
      // Remove deletedAt field to restore
      await update(dbRef(database, `tenants/${tenantId}/references/siswa/${nisn}`), {
        deletedAt: null
      });
      toast.fire({ icon: 'success', title: 'Data berhasil di-restore' });
    } catch (err) {
      console.error(err);
      toast.fire({ icon: 'error', title: 'Gagal me-restore data' });
    }
  };

  const handlePermanentDelete = async (nisn: string, nama: string) => {
    const result = await showConfirm(
      'Hapus Permanen?', 
      `Data "${nama}" akan dihapus secara permanen dan tidak bisa di-restore. Lanjutkan?`
    );
    if (!result.isConfirmed) return;

    try {
      // Use a special marker for permanent deletion instead of complete removal
      await update(dbRef(database, `tenants/${tenantId}/references/siswa/${nisn}`), {
        deletedAt: null,
        permanentlyDeleted: true
      });
      toast.fire({ icon: 'success', title: 'Data berhasil dihapus permanen' });
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
            <h2 className="fw-bold">Data Siswa</h2>
            <div className="mt-2">
              <Button 
                variant={viewMode === 'active' ? 'primary' : 'outline-primary'} 
                className="me-2"
                onClick={() => setViewMode('active')}
                size="sm"
              >
                Data Aktif
              </Button>
              <Button 
                variant={viewMode === 'trash' ? 'danger' : 'outline-danger'} 
                size="sm"
                onClick={() => setViewMode('trash')}
              >
                Data Terhapus
              </Button>
            </div>
          </Col>
          <Col className="text-end">
            {viewMode === 'active' && (
              <>
                <Button 
                  variant="info" 
                  className="me-2"
                  onClick={() => setShowImportMenu(true)}
                >
                  <FaDownload className="me-2" /> Import
                </Button>
                <Button variant="success" onClick={() => navigate('/dashboard/data-siswa/tambah')}>
                  <FaPlus className="me-2" /> Tambah Baru
                </Button>
              </>
            )}
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        {data.length === 0 ? (
          <Alert variant="info">
            {viewMode === 'active' 
              ? 'Belum ada data aktif. Klik "Tambah Baru" atau "Import" untuk menambah.'
              : 'Tidak ada data terhapus.'}
          </Alert>
        ) : (
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr>
                <th style={{ width: '5%' }}>No</th>
                <th style={{ width: '12%' }}>NISN</th>
                <th>Nama Lengkap</th>
                <th style={{ width: '10%' }}>Jenis Kelamin</th>
                <th style={{ width: '15%' }}>Email</th>
                <th style={{ width: '15%' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={item.nisn}>
                  <td>{idx + 1}</td>
                  <td className="fw-bold">{item.nisn}</td>
                  <td>{item.nama}</td>
                  <td>{item.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                  <td>{item.email || '-'}</td>
                  <td>
                    {viewMode === 'active' ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="primary" 
                          className="me-2" 
                          onClick={() => navigate(`/dashboard/data-siswa/edit/${item.nisn}`)}
                        >
                          <FaEdit /> Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="danger" 
                          onClick={() => handleDelete(item.nisn, item.nama)}
                        >
                          <FaTrash /> Hapus
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="success" 
                          className="me-2" 
                          onClick={() => handleRestore(item.nisn, item.nama)}
                        >
                          <FaUndo /> Restore
                        </Button>
                        <Button 
                          size="sm" 
                          variant="danger" 
                          onClick={() => handlePermanentDelete(item.nisn, item.nama)}
                        >
                          <FaTrash /> Hapus Permanen
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Container>

      {/* Import Menu Modal */}
      {showImportMenu && (
        <ImportSiswaMenu 
          show={showImportMenu} 
          onHide={() => setShowImportMenu(false)}
          tenantId={tenantId!}
        />
      )}
    </DashboardLayout>
  );
};

export default DataSiswaList;
