import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';

const Footer: React.FC = () => {
  const { tenantId } = useTenant();
  const [schoolInfo, setSchoolInfo] = useState({
    schoolName: 'MTs Negeri 1 Garut',
    tagline: 'Unggul, Religius, Berbudaya'
  });

  useEffect(() => {
    onValue(getDBRef(tenantId, 'settings'), (snap) => {
      if (snap.val()) setSchoolInfo(snap.val());
    });
  }, [tenantId]);

  return (
    <footer className="bg-dark text-white py-5 mt-auto">
      <Container>
        <Row>
          <Col md={4} className="mb-4">
            <h5 className="text-success fw-bold mb-3">{schoolInfo.schoolName}</h5>
            <p className="small text-muted">
              {schoolInfo.tagline}. Lembaga pendidikan formal di bawah naungan Kementerian Agama yang berkomitmen mencetak generasi unggul dalam prestasi dan berakhlakul karimah.
            </p>
          </Col>
          <Col md={2} className="mb-4">
            <h6 className="fw-bold mb-3">Tautan Cepat</h6>
            <ul className="list-unstyled small">
              <li className="mb-2"><Link to="/" className="text-decoration-none text-muted hover-white">Beranda</Link></li>
              <li className="mb-2"><Link to="/berita" className="text-decoration-none text-muted hover-white">Berita Terbaru</Link></li>
              <li className="mb-2"><Link to="/kontak" className="text-decoration-none text-muted hover-white">Hubungi Kami</Link></li>
            </ul>
          </Col>
          <Col md={3} className="mb-4">
            <h6 className="fw-bold mb-3">Layanan Link</h6>
            <ul className="list-unstyled small">
              <li className="mb-2"><a href="#" className="text-decoration-none text-muted hover-white">E-Learning</a></li>
              <li className="mb-2"><a href="#" className="text-decoration-none text-muted hover-white">Simpatika</a></li>
              <li className="mb-2"><a href="#" className="text-decoration-none text-muted hover-white">Emis 4.0</a></li>
            </ul>
          </Col>
          <Col md={3} className="mb-4">
            <h6 className="fw-bold mb-3">Kontak Kami</h6>
            <ul className="list-unstyled small text-muted">
              <li className="mb-2">Jl. Raya Karangpawitan, Garut, Jawa Barat</li>
              <li className="mb-2">info@sekolah.sch.id</li>
            </ul>
          </Col>
        </Row>
        <hr className="my-4 border-secondary" />
        <Row>
          <Col className="text-center">
            <p className="small text-muted mb-0">
              &copy; {new Date().getFullYear()} {schoolInfo.schoolName}. All Rights Reserved.
            </p>
          </Col>
        </Row>
      </Container>
      <style>{`
        .hover-white:hover { color: white !important; }
      `}</style>
    </footer>
  );
};

export default Footer;
