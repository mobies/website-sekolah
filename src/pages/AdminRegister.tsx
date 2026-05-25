import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Spinner, Alert, InputGroup } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaGoogle, FaSchool, FaUserCircle, FaIdCard, FaGlobe, FaCheckCircle } from 'react-icons/fa';
import { auth, googleProvider } from '../firebase/config';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { getRootRef } from '../firebase/utils';
import { set, get, serverTimestamp } from 'firebase/database';
import { showAlert, toast } from '../utils/alerts';

const AdminRegister: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    tenantId: '',
    schoolName: '',
    npsn: '',
    level: 'MTs',
    adminName: '',
  });

  useEffect(() => {
    // 1. Verify Token
    if (!token) {
      setIsValidToken(false);
      setLoading(false);
      return;
    }

    get(getRootRef(`invitations/${token}`)).then((snap) => {
      if (snap.exists() && snap.val().status === 'active') {
        setIsValidToken(true);
        if (snap.val().tenantIdSuggestion) {
          setFormData((prev) => ({ ...prev, tenantId: snap.val().tenantIdSuggestion }));
        }
      } else {
        setIsValidToken(false);
      }
      setLoading(false);
    });

    // 2. Auth State
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [token]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      toast.fire({ icon: 'error', title: 'Gagal login Google' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const tenantId = formData.tenantId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setSubmitting(true);

    try {
      // 1. Check if tenant already exists or is pending
      const checkActive = await get(getRootRef(`tenant-lists/${tenantId}`));
      const checkPending = await get(getRootRef(`registration-requests/${tenantId}`));

      if (checkActive.exists() || checkPending.exists()) {
        setSubmitting(false);
        return showAlert('Gagal', `Sekolah dengan ID "${tenantId}" sudah terdaftar atau sedang dalam proses peninjauan.`, 'error');
      }

      // 2. Submit Request
      await set(getRootRef(`registration-requests/${tenantId}`), {
        ...formData,
        tenantId,
        adminEmail: user.email,
        adminUid: user.uid,
        status: 'pending',
        tokenUsed: token,
        timestamp: serverTimestamp()
      });

      // 3. Mark token as used (optional, or leave for owner to clean up)
      
      showAlert('Berhasil', 'Pendaftaran Anda telah dikirim dan sedang menunggu persetujuan Owner.', 'success');
      navigate('/');
    } catch (error: any) {
      console.error("Error submitting registration:", error);
      showAlert('Error', `Gagal mengirim pendaftaran: ${error.message || 'Terjadi kesalahan sistem.'}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="vh-100 d-flex align-items-center justify-content-center"><Spinner animation="border" variant="success" /></div>;

  if (!isValidToken) {
    return (
      <Container className="py-5 text-center">
        <Alert variant="danger" className="d-inline-block p-4">
          <h4 className="fw-bold">Link Undangan Tidak Valid</h4>
          <p className="mb-0">Mohon hubungi Owner untuk mendapatkan link undangan pendaftaran yang baru.</p>
          <Button variant="outline-danger" className="mt-3" onClick={() => navigate('/')}>Kembali ke Beranda</Button>
        </Alert>
      </Container>
    );
  }

  if (!user) {
    return (
      <div className="bg-light vh-100 d-flex align-items-center justify-content-center">
        <Card className="border-0 shadow p-4 text-center" style={{ maxWidth: '400px' }}>
          <FaGoogle className="text-danger fs-1 mb-3 mx-auto" />
          <h4 className="fw-bold">Login Diperlukan</h4>
          <p className="text-muted small">Silakan login menggunakan akun Google Anda untuk melanjutkan pendaftaran admin sekolah.</p>
          <Button variant="primary" className="w-100 py-2 fw-bold" onClick={handleLogin}>Login dengan Google</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container style={{ maxWidth: '700px' }}>
        <div className="text-center mb-4">
          <FaSchool className="text-success fs-1 mb-2" />
          <h3 className="fw-bold">Registrasi Admin Sekolah</h3>
          <p className="text-muted">Lengkapi formulir di bawah ini untuk mendaftarkan sekolah Anda.</p>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">NPSN Sekolah</Form.Label>
                    <InputGroup>
                      <InputGroup.Text><FaIdCard /></InputGroup.Text>
                      <Form.Control 
                        placeholder="8 digit NPSN" 
                        value={formData.npsn} 
                        onChange={(e) => setFormData({...formData, npsn: e.target.value})} 
                        required 
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Jenis Sekolah</Form.Label>
                    <Form.Select 
                      value={formData.level} 
                      onChange={(e) => setFormData({...formData, level: e.target.value})}
                      required
                    >
                      <option value="MI">MI</option>
                      <option value="MTs">MTs</option>
                      <option value="MA">MA</option>
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA">SMA</option>
                      <option value="SMK">SMK</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">Hostname</Form.Label>
                <InputGroup>
                  <InputGroup.Text><FaGlobe /></InputGroup.Text>
                  <Form.Control 
                          placeholder="misal: smp1garut" 
                          value={formData.tenantId} 
                          onChange={(e) => setFormData({...formData, tenantId: e.target.value})} 
                          readOnly
                          required 
                        />                </InputGroup>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">Nama Lengkap Sekolah</Form.Label>
                <Form.Control 
                  placeholder="Contoh: SMP Negeri 1 Garut" 
                  value={formData.schoolName} 
                  onChange={(e) => setFormData({...formData, schoolName: e.target.value})} 
                  required 
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label className="fw-bold small">Nama Lengkap Admin</Form.Label>
                <InputGroup>
                  <InputGroup.Text><FaUserCircle /></InputGroup.Text>
                  <Form.Control 
                    placeholder="Nama Anda sebagai administrator" 
                    value={formData.adminName} 
                    onChange={(e) => setFormData({...formData, adminName: e.target.value})} 
                    required 
                  />
                </InputGroup>
              </Form.Group>

              <div className="bg-light p-3 rounded mb-4 d-flex align-items-center">
                <img src={user.photoURL} alt="" className="rounded-circle me-3" style={{ width: '40px' }} />
                <div>
                  <div className="fw-bold small">{user.displayName}</div>
                  <div className="text-muted extra-small">{user.email} (Email Admin Terdeteksi)</div>
                </div>
                <FaCheckCircle className="text-success ms-auto" />
              </div>

              <Button type="submit" variant="success" className="w-100 py-2 fw-bold shadow-sm" disabled={submitting}>
                {submitting ? <Spinner size="sm" className="me-2" /> : null} KIRIM PENDAFTARAN
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
      <style>{`.extra-small { font-size: 0.75rem; }`}</style>
    </div>
  );
};

export default AdminRegister;
