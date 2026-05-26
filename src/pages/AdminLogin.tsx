import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Spinner } from 'react-bootstrap';
import { FaGoogle, FaUserCog, FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa';
import { auth, googleProvider, functions } from '../firebase/config';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast, showAlert } from '../utils/alerts';
import { useTenant } from '../firebase/TenantContext';
import { httpsCallable } from 'firebase/functions';

const AdminLogin: React.FC = () => {
  const { terms, tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [tenantError, setTenantError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (tenantId === undefined) return;
    
    if (tenantId === null || tenantId === '') {
      setTenantError(true);
      setLoading(false);
      return;
    }

    // Check if already logged in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("DEBUG: Active session found:", user.uid);
        await verifyAdminWithServer(tenantId);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [tenantId]);

  const verifyAdminWithServer = async (tId: string) => {
    try {
      console.log("DEBUG: Calling cloud function verifyAdminRole for tenant:", tId);
      const verifyRole = httpsCallable(functions, 'verifyAdminRole');
      const result = await verifyRole({ tenantId: tId });
      const data = result.data as any;

      console.log("DEBUG: Server verification result:", data);

      if (data && data.isValid) {
        console.log("DEBUG: Access granted by server.");
        // Mark session as verified for this tenant
        sessionStorage.setItem(`admin_verified_${tId}`, 'true');
        toast.fire({ icon: 'success', title: `Berhasil login Admin ${tId}` });
        navigate('/dashboard');
      } else {
        console.warn("DEBUG: Access Denied by server.");
        await signOut(auth);
        showAlert('Akses Ditolak', 'Anda tidak memiliki otoritas sebagai admin untuk sekolah ini.', 'error');
        setLoading(false);
      }
    } catch (err) {
      console.error("DEBUG: Server verification error:", err);
      await signOut(auth);
      showAlert('Gagal Verifikasi', 'Terjadi kesalahan sistem saat memverifikasi hak akses. Pastikan internet Anda aktif.', 'error');
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await verifyAdminWithServer(tenantId!);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.fire({ icon: 'info', title: 'Login dibatalkan' });
      } else {
        toast.fire({ icon: 'error', title: 'Gagal login dengan Google' });
      }
      setLoading(false);
    }
  };

  if (loading) return <div className="vh-100 d-flex align-items-center justify-content-center"><div className="text-center"><Spinner animation="border" variant="success" className="mb-2" /><p className="text-muted small">Memverifikasi hak akses...</p></div></div>;

  if (tenantError) return (
    <div className="vh-100 d-flex align-items-center justify-content-center bg-light">
      <Card className="border-0 shadow p-4 text-center" style={{ maxWidth: '400px' }}>
        <FaExclamationTriangle className="text-warning fs-1 mb-3 mx-auto" />
        <h5 className="fw-bold">Website Tidak Dikenali</h5>
        <p className="small text-muted">Sistem gagal mendeteksi identitas sekolah dari alamat URL ini.</p>
        <Button variant="success" onClick={() => window.location.href = '/'}>Kembali ke Beranda</Button>
      </Card>
    </div>
  );

  return (
    <div className="bg-light vh-100 d-flex align-items-center justify-content-center">
      <Container style={{ maxWidth: '450px' }}>
        <Card className="border-0 shadow-lg p-4 text-center rounded-4">
          <Card.Body>
            <div className="mb-4">
              <div className="bg-success bg-opacity-10 rounded-circle d-inline-flex p-4 mb-3">
                <FaUserCog className="text-success fs-1" />
              </div>
              <h3 className="fw-bold text-dark">Admin Login</h3>
              <p className="text-muted small">Panel Kontrol {terms.school} ({tenantId})</p>
            </div>

            <Button 
              variant="white" 
              className="w-100 py-3 mb-3 border d-flex align-items-center justify-content-center fw-bold shadow-sm rounded-pill"
              onClick={handleLogin}
            >
              <FaGoogle className="text-danger me-3" /> Masuk dengan Google
            </Button>

            <div className="mt-3">
              <Button variant="link" className="text-muted small text-decoration-none" onClick={() => navigate('/')}>
                <FaArrowLeft className="me-2" /> Kembali ke Web Utama
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default AdminLogin;
