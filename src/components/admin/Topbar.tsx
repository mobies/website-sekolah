import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Badge } from 'react-bootstrap';
import { FaBell, FaSearch, FaExternalLinkAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { onValue } from 'firebase/database';

const Topbar: React.FC = () => {
  const { tenantId } = useTenant();
  const [schoolName, setSchoolName] = useState('MTsN 1 Garut');

  useEffect(() => {
    const settingsRef = getDBRef(tenantId, 'settings/schoolName');
    onValue(settingsRef, (snapshot) => {
      const name = snapshot.val();
      if (name) setSchoolName(name);
    });
  }, [tenantId]);

  return (
    <Navbar bg="white" className="border-bottom sticky-top py-2" style={{ zIndex: 1020 }}>
      <Container fluid className="px-4">
        <div className="d-flex align-items-center">
          <div className="input-group input-group-sm d-none d-md-flex" style={{ width: '250px' }}>
            <span className="input-group-text bg-light border-end-0 text-muted">
              <FaSearch />
            </span>
            <input type="text" className="form-control bg-light border-start-0" placeholder="Cari data..." />
          </div>
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
