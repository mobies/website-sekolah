import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import ProgressiveImage from './ProgressiveImage';

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
  const [settings, setSettings] = useState({
    schoolName: 'MTs Negeri 1 Garut',
    tagline: 'Unggul, Religius, Berbudaya',
    logo: '/logo.png'
  });
  const [eServices, setEServices] = useState<EService[]>([]);
  const [profiles, setProfiles] = useState<ProfileContent[]>([]);

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
    <Navbar bg="white" expand="lg" sticky="top" className="shadow-sm">
      <Container>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <ProgressiveImage
            src={settings.logo}
            alt={settings.schoolName}
            style={{ width: '45px', height: '45px' }}
            className="me-2"
          />
          <div className="d-none d-sm-block">
            <span className="fw-bold text-success d-block lh-1 text-uppercase">{settings.schoolName}</span>
            <small className="text-muted" style={{ fontSize: '0.7rem' }}>{settings.tagline}</small>
          </div>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto fw-medium">
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
            <Nav.Link as={Link} to="/dashboard" className="text-success border border-success rounded-pill px-3 ms-lg-2 mt-2 mt-lg-0 py-1 small">Admin</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;
