import React, { useState } from 'react';
import { Container, Card, Button, Spinner } from 'react-bootstrap';
import { FaGoogle, FaUserCog, FaArrowLeft } from 'react-icons/fa';
import { auth, rtdb, googleProvider } from '../firebase/config';
import { signInWithPopup, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from '../utils/alerts';
import { useTenant } from '../firebase/TenantContext';
import { get, ref } from 'firebase/database';

const AdminLogin: React.FC = () => {
  const { terms, tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Verify Admin UID
      const settingsRef = ref(rtdb, `tenants/${tenantId}/settings`);
      const snapshot = await get(settingsRef);
      const settings = snapshot.val();

      if (settings && settings.adminUid === user.uid) {
        toast.fire({ icon: 'success', title: `Berhasil login Admin ${tenantId}` });
        navigate('/dashboard');
      } else {
        await signOut(auth);
        toast.fire({ icon: 'error', title: 'User tidak memiliki otoritas sebagai admin' });
        setLoading(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.fire({ icon: 'error', title: 'Gagal login dengan Google' });
      setLoading(false);
    }
  };

  if (loading) return <div className="vh-100 d-flex align-items-center justify-content-center"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="bg-light vh-100 d-flex align-items-center justify-content-center">
      <Container style={{ maxWidth: '450px' }}>
        <Card className="border-0 shadow-lg p-4 text-center">
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
              className="w-100 py-3 mb-3 border d-flex align-items-center justify-content-center fw-bold shadow-sm"
              onClick={handleLogin}
            >
              <FaGoogle className="text-danger me-3" /> Masuk dengan Google
            </Button>

            <Button variant="link" className="text-muted small text-decoration-none" onClick={() => navigate('/')}>
              <FaArrowLeft className="me-2" /> Kembali ke Web Utama
            </Button>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default AdminLogin;
