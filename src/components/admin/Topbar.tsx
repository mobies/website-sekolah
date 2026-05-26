import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Badge } from 'react-bootstrap';
import { FaBell, FaSearch, FaExternalLinkAlt } from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { onValue } from 'firebase/database';

const Topbar: React.FC = () => {
  const { tenantId } = useTenant();
  const [schoolName, setSchoolName] = useState('MTsN 1 Garut');
  const navigate = useNavigate();
  const location = useLocation();

  // Get search term from URL
  const queryParams = new URLSearchParams(location.search);
  const searchTerm = queryParams.get('q') || '';

  // Visibility logic for search bar in Dashboard
  // Show only on specific admin list pages
  const allowedPaths = [
    '/dashboard/berita', 
    '/dashboard/pengumuman', 
    '/dashboard/agenda', 
    '/dashboard/galeri',
    '/dashboard/galeri/video'
  ];
  
  // Hide on main dashboard, settings, or any edit/tambah pages
  const isListPath = allowedPaths.some(path => location.pathname === path);
  const showSearch = isListPath;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    // Update URL query string
    navigate({ search: params.toString() }, { replace: true });
  };

  useEffect(() => {
    if (!tenantId) return;
    const settingsRef = getDBRef(tenantId, 'settings/schoolName');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const name = snapshot.val();
      if (name) setSchoolName(name);
    });
    return () => unsubscribe();
  }, [tenantId]);

  return (
    <Navbar bg="white" className="border-bottom sticky-top py-2" style={{ zIndex: 1020 }}>
      <Container fluid className="px-4">
        <div className="d-flex align-items-center">
          {showSearch && (
            <div className="input-group input-group-sm d-none d-md-flex" style={{ width: '250px' }}>
              <span className="input-group-text bg-light border-end-0 text-muted">
                <FaSearch />
              </span>
              <input 
                type="text" 
                className="form-control bg-light border-start-0 shadow-none" 
                placeholder="Cari data..." 
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
          )}
        </div>
        
        <Nav className="ms-auto align-items-center">
          <Nav.Link as={Link} to="/" className="text-muted me-3 d-flex align-items-center small fw-medium">
            <FaExternalLinkAlt className="me-1" /> Kunjungi Website
          </Nav.Link>
          <div className="position-relative me-3 pointer" style={{ cursor: 'pointer' }}>
            <FaBell className="text-muted fs-5" />
            <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle p-1 border border-white border-2">
              <span className="visually-hidden">unread notifications</span>
            </Badge>
          </div>
          <div className="border-start ps-3 ms-2">
            <span className="text-dark fw-bold small text-uppercase">{schoolName}</span>
          </div>
        </Nav>
      </Container>
    </Navbar>
  );
};

export default Topbar;
