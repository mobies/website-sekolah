import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Spinner } from 'react-bootstrap';
import { FaGoogle, FaUserShield, FaArrowLeft } from 'react-icons/fa';
import { auth, googleProvider, functions } from '../firebase/config';
import { signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { toast, showAlert } from '../utils/alerts';

const OwnerLogin: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set persistence to local (keeps session on refresh)
    setPersistence(auth, browserLocalPersistence);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setVerifying(true);
        try {
          const checkOwner = httpsCallable(functions, 'authIsOwnerValid');
          const result = await checkOwner() as { data: { isValid: boolean } };
          
          if (result.data.isValid) {
            toast.fire({ icon: 'success', title: 'Akses Owner Terverifikasi' });
            navigate('/owner');
          } else {
            console.log("Akses Ditolak. UID Anda:", currentUser.uid);
            await signOut(auth);
            showAlert('Akses Ditolak', `Akun Anda (${currentUser.uid}) tidak terdaftar sebagai Owner.`, 'error');
          }
        } catch (error) {
          console.error("Verification error:", error);
          await signOut(auth);
          showAlert('Error', 'Gagal memverifikasi status Owner.', 'error');
        } finally {
          setVerifying(false);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
      toast.fire({ icon: 'error', title: 'Gagal login dengan Google' });
    }
  };

  if (loading || verifying) {
    return (
      <div className="vh-100 d-flex flex-column align-items-center justify-content-center bg-light">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <p className="text-muted small">{verifying ? 'Memverifikasi Akses Owner...' : 'Memuat...'}</p>
      </div>
    );
  }

  return (
    <div className="bg-light vh-100 d-flex align-items-center justify-content-center">
      <Container style={{ maxWidth: '450px' }}>
        <Card className="border-0 shadow-lg p-4 text-center">
          <Card.Body>
            <div className="mb-4">
              <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-4 mb-3">
                <FaUserShield className="text-primary fs-1" />
              </div>
              <h3 className="fw-bold text-dark">Owner Login</h3>
              <p className="text-muted">Masuk untuk mengelola seluruh jaringan sekolah.</p>
            </div>

            <Button 
              variant="white" 
              className="w-100 py-3 mb-3 border d-flex align-items-center justify-content-center fw-bold shadow-sm"
              onClick={handleLogin}
            >
              <FaGoogle className="text-danger me-3" /> Masuk dengan Google
            </Button>

            <Button variant="link" className="text-muted small text-decoration-none" onClick={() => navigate('/')}>
              <FaArrowLeft className="me-2" /> Kembali ke Beranda
            </Button>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default OwnerLogin;
