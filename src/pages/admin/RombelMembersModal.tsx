import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Alert,
  Spinner,
  Table,
  Form,
  Badge,
  Tabs,
  Tab
} from 'react-bootstrap';
import { FaTrash, FaArrowRight } from 'react-icons/fa';
import { useTenant } from '../../firebase/TenantContext';
import { useRombelData } from '../../hooks/useRombelData';
import { rtdb as database } from '../../firebase/config';
import { ref as dbRef, get } from 'firebase/database';
import { toast, showConfirm } from '../../utils/alerts';

interface RombelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  tahunAjaranNama: string;
  idKelas: string;
  rombelName: string;
}

interface StudentData {
  nisn: string;
  nama: string;
  tempat_lahir?: string;
  rombel?: Record<string, any>;
}

interface AvailableRombel {
  idKelas: string;
  name: string;
}

const RombelMembersModal: React.FC<RombelMembersModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  tahunAjaranNama,
  idKelas,
  rombelName
}) => {
  const { tenantId } = useTenant();

  const [currentMembers, setCurrentMembers] = useState<StudentData[]>([]);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [availableRombels, setAvailableRombels] = useState<AvailableRombel[]>([]);
  const [assignedInOtherRombel, setAssignedInOtherRombel] = useState(0);

  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [actionMode, setActionMode] = useState<'none' | 'remove' | 'move'>('none');
  const [targetRombelForMove, setTargetRombelForMove] = useState('');

  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isOpen);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'add'>('current');

  const {
    getRombel,
    bulkRemoveStudentsFromRombel,
    bulkAddStudentsToRombel,
    moveStudentToRombel,
    getAvailableRombels
  } = useRombelData();

  // Load current members and available students (shadow data system)
  useEffect(() => {
    if (!isOpen || !tenantId) {
      setFetching(false);
      return;
    }

    const loadData = async () => {
      try {
        // 1. Load current rombel members
        const rombelData = await getRombel(tenantId, tahunAjaranNama, idKelas);
        const memberNisns = new Set(rombelData?.members || []);

        // 2. Load rombel list untuk tahun itu -> kumpulkan assigned NISN (shadow data index)
        const rombelListRef = dbRef(database, `tenants/${tenantId}/references/rombel/${tahunAjaranNama}`);
        const rombelSnapshot = await get(rombelListRef);
        const assignedNisns = new Set<string>();

        if (rombelSnapshot.exists()) {
          Object.entries(rombelSnapshot.val()).forEach(([_, rombelData]: any) => {
            const members = rombelData.members || [];
            members.forEach((nisn: string) => assignedNisns.add(nisn));
          });
        }

        // 3. Load all students
        const siswaRef = dbRef(database, `tenants/${tenantId}/references/siswa`);
        const siswaSnapshot = await get(siswaRef);

        if (siswaSnapshot.exists()) {
          const siswaData = siswaSnapshot.val();
          const students: StudentData[] = [];

          Object.entries(siswaData).forEach(([nisn, data]: any) => {
            if (!data.deletedAt) {
              students.push({
                nisn,
                nama: data.nama || '',
                tempat_lahir: data.tempat_lahir,
                rombel: data.rombel
              });
            }
          });

          students.sort((a, b) => a.nama.localeCompare(b.nama));

          // 4. Separate current members and available students (shadow data)
          // Available = bukan current member AND bukan di rombel lain tahun ini
          const members = students.filter(s => memberNisns.has(s.nisn));
          const available = students.filter(
            s => !memberNisns.has(s.nisn) && !assignedNisns.has(s.nisn)
          );

          // Count siswa yang assigned ke rombel lain tahun ini
          const assignedCount = students.filter(
            s => !memberNisns.has(s.nisn) && assignedNisns.has(s.nisn)
          ).length;

          setCurrentMembers(members);
          setAllStudents(available);
          setAssignedInOtherRombel(assignedCount);

          // Load available rombels for move operation
          const rombels = await getAvailableRombels(tenantId, tahunAjaranNama, idKelas);
          setAvailableRombels(rombels);
        }

        setFetching(false);
      } catch (err) {
        console.error('Error loading members data:', err);
        setError('Gagal memuat data siswa');
        setFetching(false);
      }
    };

    loadData();
  }, [isOpen, tenantId, tahunAjaranNama, idKelas]);

  const filteredAvailableStudents = allStudents.filter(student =>
    student.nisn.includes(searchQuery) ||
    student.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleMember = (nisn: string) => {
    const newSet = new Set(selectedMembers);
    if (newSet.has(nisn)) {
      newSet.delete(nisn);
    } else {
      newSet.add(nisn);
    }
    setSelectedMembers(newSet);
    setActionMode('none'); // Reset action mode when selection changes
  };

  const handleToggleAddStudent = (nisn: string) => {
    const newSet = new Set(selectedStudentsToAdd);
    if (newSet.has(nisn)) {
      newSet.delete(nisn);
    } else {
      newSet.add(nisn);
    }
    setSelectedStudentsToAdd(newSet);
  };

  const handleRemoveSelectedMembers = async () => {
    if (selectedMembers.size === 0) {
      setError('Pilih siswa yang akan dikeluarkan');
      return;
    }

    const result = await showConfirm(
      'Keluarkan Siswa?',
      `Yakin ingin mengeluarkan ${selectedMembers.size} siswa dari rombel ini?`
    );

    if (!result.isConfirmed) return;

    setLoading(true);
    setError('');

    try {
      const nisnsToRemove = Array.from(selectedMembers);
      const results = await bulkRemoveStudentsFromRombel(
        tenantId!,
        tahunAjaranNama,
        idKelas,
        nisnsToRemove
      );

      if (results.failed.length > 0) {
        setError(
          `${results.success.length} siswa berhasil dihapus, ${results.failed.length} gagal`
        );
      } else {
        toast.fire({
          icon: 'success',
          title: `${results.success.length} siswa berhasil dikeluarkan`
        });
      }

      onSaved();
      setSelectedMembers(new Set());
      setActionMode('none');
    } catch (err: any) {
      console.error('Error removing students:', err);
      setError(err.message || 'Gagal mengeluarkan siswa');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveSelectedMembers = async () => {
    if (selectedMembers.size === 0) {
      setError('Pilih siswa yang akan dipindahkan');
      return;
    }

    if (!targetRombelForMove) {
      setError('Pilih rombel tujuan');
      return;
    }

    const result = await showConfirm(
      'Pindahkan Siswa?',
      `Yakin ingin memindahkan ${selectedMembers.size} siswa ke rombel lain?`
    );

    if (!result.isConfirmed) return;

    setLoading(true);
    setError('');

    try {
      const nisnsToMove = Array.from(selectedMembers);
      let successCount = 0;
      let failedCount = 0;

      for (const nisn of nisnsToMove) {
        try {
          await moveStudentToRombel(tenantId!, tahunAjaranNama, idKelas, targetRombelForMove, nisn);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to move ${nisn}:`, err);
          failedCount++;
        }
      }

      if (failedCount > 0) {
        setError(`${successCount} siswa dipindahkan, ${failedCount} gagal`);
      } else {
        toast.fire({
          icon: 'success',
          title: `${successCount} siswa berhasil dipindahkan`
        });
      }

      onSaved();
      setSelectedMembers(new Set());
      setTargetRombelForMove('');
      setActionMode('none');
    } catch (err: any) {
      console.error('Error moving students:', err);
      setError(err.message || 'Gagal memindahkan siswa');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSelectedStudents = async () => {
    if (selectedStudentsToAdd.size === 0) {
      setError('Pilih siswa yang akan ditambahkan');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const nisnsToAdd = Array.from(selectedStudentsToAdd);
      const results = await bulkAddStudentsToRombel(
        tenantId!,
        tahunAjaranNama,
        idKelas,
        nisnsToAdd
      );

      if (results.failed.length > 0) {
        setError(
          `${results.success.length} siswa berhasil ditambah, ${results.failed.length} gagal`
        );
      } else {
        toast.fire({
          icon: 'success',
          title: `${results.success.length} siswa berhasil ditambahkan`
        });
      }

      onSaved();
      setSelectedStudentsToAdd(new Set());
      setSearchQuery('');
    } catch (err: any) {
      console.error('Error adding students:', err);
      setError(err.message || 'Gagal menambah siswa');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSelectedMembers(new Set());
    setSelectedStudentsToAdd(new Set());
    setTargetRombelForMove('');
    setSearchQuery('');
    setActionMode('none');
    onClose();
  };

  if (fetching) {
    return (
      <Modal show={isOpen} onHide={handleClose} backdrop="static" size="lg">
        <Modal.Header>
          <Modal.Title>Kelola Siswa - {rombelName}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Spinner animation="border" />
        </Modal.Body>
      </Modal>
    );
  }

  return (
    <Modal show={isOpen} onHide={handleClose} backdrop="static" size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Kelola Siswa - {rombelName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Tabs activeKey={activeTab} onSelect={(k: any) => setActiveTab(k)} className="mb-3">
          {/* TAB 1: Current Members */}
          <Tab eventKey="current" title={`Siswa Saat Ini (${currentMembers.length})`}>
            {currentMembers.length === 0 ? (
              <Alert variant="info">Belum ada siswa di rombel ini</Alert>
            ) : (
              <>
                {/* SINGLE SMART TABLE */}
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Kelola Siswa Saat Ini</h6>
                  <div className="table-responsive border rounded p-2">
                    <Table striped hover size="sm" className="mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <Form.Check
                              type="checkbox"
                              checked={
                                currentMembers.length > 0 &&
                                selectedMembers.size === currentMembers.length
                              }
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedMembers(
                                    new Set(currentMembers.map(m => m.nisn))
                                  );
                                } else {
                                  setSelectedMembers(new Set());
                                }
                              }}
                            />
                          </th>
                          <th>No</th>
                          <th>NISN</th>
                          <th>Nama Siswa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentMembers.map((student, idx) => (
                          <tr key={student.nisn}>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={selectedMembers.has(student.nisn)}
                                onChange={() => handleToggleMember(student.nisn)}
                              />
                            </td>
                            <td>{idx + 1}</td>
                            <td>{student.nisn}</td>
                            <td>{student.nama}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>

                {/* CONDITIONAL ACTION BUTTONS */}
                {selectedMembers.size > 0 && (
                  <div className="bg-light border rounded p-3">
                    <div className="d-flex gap-2 mb-3">
                      <Button
                        variant="danger"
                        onClick={handleRemoveSelectedMembers}
                        disabled={loading}
                      >
                        <FaTrash className="me-2" />
                        Keluarkan ({selectedMembers.size})
                      </Button>
                      <Button
                        variant={actionMode === 'move' ? 'secondary' : 'primary'}
                        onClick={() => setActionMode(actionMode === 'move' ? 'none' : 'move')}
                        disabled={loading}
                      >
                        <FaArrowRight className="me-2" />
                        {actionMode === 'move' ? 'Batalkan Pindahkan' : 'Pindahkan'} ({selectedMembers.size})
                      </Button>
                    </div>

                    {/* Show target rombel dropdown only in move mode */}
                    {actionMode === 'move' && (
                      <div className="d-flex gap-2 align-items-end">
                        <Form.Group className="flex-grow-1 mb-0">
                          <Form.Label className="fw-bold">Pilih Rombel Tujuan</Form.Label>
                          <Form.Select
                            value={targetRombelForMove}
                            onChange={e => setTargetRombelForMove(e.target.value)}
                            disabled={availableRombels.length === 0}
                            autoFocus
                          >
                            <option value="">-- Pilih Rombel --</option>
                            {availableRombels.map(r => (
                              <option key={r.idKelas} value={r.idKelas}>
                                {r.name} ({r.idKelas})
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                        <Button
                          variant="success"
                          onClick={handleMoveSelectedMembers}
                          disabled={!targetRombelForMove || loading}
                        >
                          <FaArrowRight className="me-2" />
                          Konfirmasi Pindahkan
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Tab>

          {/* TAB 2: Add New Members */}
          <Tab eventKey="add" title={`Tambah Siswa (${allStudents.length})`}>
            <div className="mb-3">
              <Form.Control
                type="text"
                placeholder="Cari NISN atau Nama Siswa..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Form.Text>
                Menampilkan {filteredAvailableStudents.length} dari {allStudents.length} siswa tersedia
              </Form.Text>

              {assignedInOtherRombel > 0 && (
                <Alert variant="info" className="mt-2 mb-0">
                  <small>
                    <strong>Sistem Shadow Data Aktif:</strong> {assignedInOtherRombel} siswa
                    tersembunyi karena sudah ditambahkan ke rombel lain pada tahun ajaran ini.
                    Hanya siswa yang belum ditugaskan yang ditampilkan di sini.
                  </small>
                </Alert>
              )}
            </div>

            {filteredAvailableStudents.length === 0 ? (
              <Alert variant="info">
                {allStudents.length === 0
                  ? 'Semua siswa sudah ada di rombel ini'
                  : 'Tidak ada siswa yang sesuai dengan pencarian'}
              </Alert>
            ) : (
              <>
                <div className="table-responsive">
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <Form.Check
                            type="checkbox"
                            checked={
                              filteredAvailableStudents.length > 0 &&
                              selectedStudentsToAdd.size === filteredAvailableStudents.length
                            }
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedStudentsToAdd(
                                  new Set(filteredAvailableStudents.map(s => s.nisn))
                                );
                              } else {
                                setSelectedStudentsToAdd(new Set());
                              }
                            }}
                          />
                        </th>
                        <th>No</th>
                        <th>NISN</th>
                        <th>Nama Siswa</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAvailableStudents.map((student, idx) => (
                        <tr key={student.nisn}>
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={selectedStudentsToAdd.has(student.nisn)}
                              onChange={() => handleToggleAddStudent(student.nisn)}
                            />
                          </td>
                          <td>{idx + 1}</td>
                          <td>{student.nisn}</td>
                          <td>{student.nama}</td>
                          <td>
                            <Badge bg="success">Tersedia</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <div className="mt-3">
                  <Button
                    variant="success"
                    onClick={handleAddSelectedStudents}
                    disabled={selectedStudentsToAdd.size === 0 || loading}
                  >
                    Tambahkan ({selectedStudentsToAdd.size})
                  </Button>
                </div>
              </>
            )}
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Tutup
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RombelMembersModal;
