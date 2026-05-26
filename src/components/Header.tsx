import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, NavDropdown, Button, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import { auth, googleProvider, functions } from '../firebase/config';
import { onAuthStateChanged, type User, signInWithPopup, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import ProgressiveImage from './ProgressiveImage';
import { FaUserCircle, FaSignInAlt, FaSignOutAlt } from 'react-icons/fa';
import { toast } from '../utils/alerts';

interface EService {
  id: string;
  title: string;
  url: string;
  icon: string;
}

interface ProfileContent {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  order: number;
}

const Header: React.FC = () => {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  
  const [settings, setSettings] = useState({
    schoolName: 'MTs Negeri 1 Garut',
    tagline: 'Unggul, Religius, Berbudaya',
    logo: '/logo.png'
  });
  const [eServices, setEServices] = useState<EService[]>([]);
  const [profiles, setProfiles] = useState<ProfileContent[]>([]);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const verifyAdmin = async (tId: string) => {
    setVerifying(true);
    try {
      const verifyRole = httpsCallable(functions, 'verifyAdminRole');
      const result = await verifyRole({ tenantId: tId });
      const data = result.data as any;
      if (data && data.isValid) {
        sessionStorage.setItem(`admin_verified_${tId}`, 'true');
        setIsAdmin(true);
      } else {
        sessionStorage.removeItem(`admin_verified_${tId}`);
        setIsAdmin(false);
      }
    } catch (err) {
      console.error("Admin verification error:", err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && tenantId) {
        const verified = sessionStorage.getItem(`admin_verified_${tenantId}`) === 'true';
        if (verified) {
          setIsAdmin(true);
        } else {
          verifyAdmin(tenantId);
        }
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });

    return () => unsubAuth();
  }, [tenantId]);

  const handleLogin = async () => {
    if (!tenantId) return;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        toast.fire({ icon: 'success', title: 'Berhasil masuk' });
        await verifyAdmin(tenantId);
      }
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.fire({ icon: 'error', title: 'Gagal login' });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (tenantId) sessionStorage.removeItem(`admin_verified_${tenantId}`);
      setIsAdmin(false);
      toast.fire({ icon: 'info', title: 'Berhasil keluar' });
      navigate('/');
    } catch (error) {
      toast.fire({ icon: 'error', title: 'Gagal logout' });
    }
  };

  useEffect(() => {
    if (!tenantId) return;

    // 1. Fetch Settings
    const settingsRef = getDBRef(tenantId, 'settings');
    const unsubSettings = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettings({
          schoolName: data.schoolName || 'MTs Negeri 1 Garut',
          tagline: data.tagline || 'Unggul, Religius, Berbudaya',
          logo: data.logo || '/logo.png'
        });
      }
    });

    // 2. Fetch E-Services for Menu
    const servicesRef = getDBRef(tenantId, 'e_services');
    const unsubServices = onValue(servicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setEServices(list);
      } else {
        setEServices([]);
      }
    });

    // 3. Fetch Dynamic Profiles for Menu
    const profilesRef = getDBRef(tenantId, 'profiles');
    const unsubProfiles = onValue(profilesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(p => p.isActive)
          .sort((a, b) => a.order - b.order);
        setProfiles(list);
      } else {
        setProfiles([]);
      }
    });

    return () => {
      unsubSettings();
      unsubServices();
      unsubProfiles();
    };
  }, [tenantId]);

  return (
    <Navbar bg="white" expand="lg" sticky="top" className="shadow-sm py-2 px-0">
      <Container fluid className="px-3">
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center me-0 ms-0 ps-0">
          <ProgressiveImage
            src={settings.logo}
            alt={settings.schoolName}
            style={{ width: '45px', height: '45px' }}
            className="me-2"
          />
          <div className="d-none d-sm-block">
            <span className="fw-bold text-success d-block lh-1 text-uppercase small">{settings.schoolName}</span>
            <small className="text-muted" style={{ fontSize: '0.65rem' }}>{settings.tagline}</small>
          </div>
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto fw-medium align-items-lg-center">
            <Nav.Link as={Link} to="/">Beranda</Nav.Link>
            
            {/* Dynamic Profil Menu */}
            {profiles.length > 0 && (
              <NavDropdown title="Profil" id="profil-nav-dropdown">
                {profiles.map(p => (
                  <NavDropdown.Item key={p.id} as={Link} to={`/profil/${p.slug}`}>{p.title}</NavDropdown.Item>
                ))}
              </NavDropdown>
            )}
            
            {/* Dynamic E-Layanan Menu */}
            {eServices.length > 0 && (
              <NavDropdown title="E-Layanan" id="elayanan-nav-dropdown">
                {eServices.map((svc) => (
                  <NavDropdown.Item key={svc.id} href={svc.url} target="_blank" rel="noopener noreferrer">
                    <span className="me-2">{svc.icon}</span> {svc.title}
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
            )}

            <NavDropdown title="Konten" id="konten-nav-dropdown">
              <NavDropdown.Item as={Link} to="/berita">Berita</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/pengumuman">Pengumuman</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/video">Video</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/galeri">Galeri</NavDropdown.Item>
            </NavDropdown>

            <Nav.Link as={Link} to="/agenda">Agenda</Nav.Link>
            <Nav.Link as={Link} to="/kontak">Kontak</Nav.Link>
            
            {/* Dashboard menu for Admin only */}
            {user && isAdmin && (
              <Nav.Link as={Link} to="/dashboard" className="text-success fw-bold">Dashboard</Nav.Link>
            )}

            {/* Profile and Login/Logout Action */}
            <div className="ms-lg-2 mt-3 mt-lg-0">
               {authLoading ? (
                 <div className="px-3"><Spinner animation="border" size="sm" variant="success" /></div>
               ) : user ? (
                 <NavDropdown 
                   title={
                     <div className="d-inline-flex align-items-center gap-2">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="rounded-circle shadow-sm" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                        ) : (
                          <FaUserCircle className="text-success" size={32} />
                        )}
                        <span className="small fw-bold text-dark d-none d-xl-inline">
                          {user.displayName?.split(' ')[0]}
                          {verifying && <Spinner animation="grow" size="sm" variant="success" className="ms-1" style={{ width: '8px', height: '8px' }} />}
                        </span>
                     </div>
                   } 
                   id="user-profile-dropdown"
                   align="end"
                   className="profile-dropdown-no-caret"
                 >
                   <NavDropdown.Header className="extra-small text-uppercase fw-bold text-muted">Akun Anda</NavDropdown.Header>
                   <div className="px-3 py-2 border-bottom">
                      <div className="small fw-bold text-dark text-truncate" style={{maxWidth: '180px'}}>{user.displayName}</div>
                      <div className="extra-small text-muted text-truncate" style={{maxWidth: '180px'}}>{user.email}</div>
                   </div>
                   <NavDropdown.Item onClick={handleLogout} className="text-danger mt-1">
                      <FaSignOutAlt className="me-2" /> Logout
                   </NavDropdown.Item>
                 </NavDropdown>
               ) : (
                 <Button variant="outline-success" size="sm" className="rounded-pill px-4 fw-bold border-2 d-flex align-items-center gap-2" onClick={handleLogin}>
                    <FaSignInAlt size={16} /> Login
                 </Button>
               )}
            </div>
          </Nav>
        </Navbar.Collapse>
      </Container>
      <style>{`
        .profile-dropdown-no-caret .dropdown-toggle::after {
          display: none;
        }
        .extra-small { font-size: 0.7rem; }
      `}</style>
    </Navbar>
  );
};

export default Header;
