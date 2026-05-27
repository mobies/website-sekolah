import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaFacebook, FaTwitter, FaInstagram, FaYoutube } from 'react-icons/fa';

interface ContactData {
  phone: string;
  email: string;
  address: string;
}

interface SchoolSettings {
  schoolName: string;
  tagline: string;
  description?: string;
  contact?: ContactData;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
}

interface EService {
  id: string;
  title: string;
  url: string;
}

interface ProfileContent {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  order: number;
}

const Footer: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [schoolInfo, setSchoolInfo] = useState<SchoolSettings>({
    schoolName: 'MTs Negeri 1 Garut',
    tagline: 'Unggul, Religius, Berbudaya'
  });
  const [services, setServices] = useState<EService[]>([]);
  const [profiles, setProfiles] = useState<ProfileContent[]>([]);

  useEffect(() => {
    if (!tenantId) return;

    // Fetch Settings
    const unsubSettings = onValue(getDBRef(tenantId, 'settings'), (snap) => {
      if (snap.val()) setSchoolInfo(snap.val());
    });

    // Fetch E-Services
    const unsubServices = onValue(getDBRef(tenantId, 'e_services'), (snap) => {
      const data = snap.val();
      if (data) {
        setServices(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setServices([]);
      }
    });

    // Fetch Dynamic Profiles
    const unsubProfiles = onValue(getDBRef(tenantId, 'profiles'), (snap) => {
      const data = snap.val();
      if (data) {
        setProfiles(Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(p => p.isActive)
          .sort((a, b) => a.order - b.order));
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
    <footer className="bg-dark text-white pt-5 pb-4 mt-auto">
      <Container>
        <Row className="gy-4">
          {/* School Profile */}
          <Col lg={4} md={6}>
            <h5 className="text-success fw-bold mb-4">{schoolInfo.schoolName}</h5>
            <p className="small text-white mb-4" style={{ lineHeight: '1.8' }}>
              {schoolInfo.description || `${schoolInfo.tagline}. Lembaga pendidikan formal yang berkomitmen mencetak generasi unggul dalam prestasi dan berakhlakul karimah.`}
            </p>
            <div className="d-flex gap-3">
              {schoolInfo.socialMedia?.facebook && (
                <a href={schoolInfo.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="social-icon">
                  <FaFacebook size={20} />
                </a>
              )}
              {schoolInfo.socialMedia?.instagram && (
                <a href={schoolInfo.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="social-icon">
                  <FaInstagram size={20} />
                </a>
              )}
              {schoolInfo.socialMedia?.twitter && (
                <a href={schoolInfo.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="social-icon">
                  <FaTwitter size={20} />
                </a>
              )}
              {schoolInfo.socialMedia?.youtube && (
                <a href={schoolInfo.socialMedia.youtube} target="_blank" rel="noopener noreferrer" className="social-icon">
                  <FaYoutube size={20} />
                </a>
              )}
              {!schoolInfo.socialMedia && (
                <>
                  <a href="#" className="social-icon"><FaFacebook size={20} /></a>
                  <a href="#" className="social-icon"><FaInstagram size={20} /></a>
                  <a href="#" className="social-icon"><FaYoutube size={20} /></a>
                </>
              )}
            </div>
          </Col>

          {/* Quick Links */}
          <Col lg={2} md={6}>
            <h6 className="fw-bold mb-4 text-uppercase tracking-wider">Tautan Cepat</h6>
            <ul className="list-unstyled footer-links">
              <li><Link to="/">Beranda</Link></li>
              {profiles.length > 0 ? (
                profiles.map(profile => (
                  <li key={profile.id}><Link to={`/profil/${profile.slug}`}>{profile.title}</Link></li>
                ))
              ) : (
                <>
                  <li><Link to="/profil/sejarah">Sejarah</Link></li>
                  <li><Link to="/profil/visi-misi">Visi & Misi</Link></li>
                </>
              )}
              <li><Link to="/berita">{terms.berita}</Link></li>
              <li><Link to="/agenda">Agenda</Link></li>
            </ul>
          </Col>

          {/* Services */}
          <Col lg={3} md={6}>
            <h6 className="fw-bold mb-4 text-uppercase tracking-wider">Layanan Link</h6>
            <ul className="list-unstyled footer-links">
              {services.length > 0 ? (
                services.map(svc => (
                  <li key={svc.id}>
                    <a href={svc.url} target="_blank" rel="noopener noreferrer">{svc.title}</a>
                  </li>
                ))
              ) : (
                <>
                  <li><a href="https://elearning.kemenag.go.id/" target="_blank" rel="noopener noreferrer">E-Learning</a></li>
                  <li><a href="https://simpatika.kemenag.go.id/" target="_blank" rel="noopener noreferrer">SIMPATIKA</a></li>
                  <li><a href="https://emis.kemenag.go.id/" target="_blank" rel="noopener noreferrer">EMIS 4.0</a></li>
                </>
              )}
            </ul>
          </Col>

          {/* Contact */}
          <Col lg={3} md={6}>
            <h6 className="fw-bold mb-4 text-uppercase tracking-wider">Kontak Kami</h6>
            <ul className="list-unstyled footer-contact">
              <li className="d-flex mb-3">
                <FaMapMarkerAlt className="text-success mt-1 me-3 flex-shrink-0" />
                <span className="small text-white">{schoolInfo.contact?.address || 'Alamat belum diatur'}</span>
              </li>
              <li className="d-flex mb-3">
                <FaPhone className="text-success mt-1 me-3 flex-shrink-0" />
                <span className="small text-white">{schoolInfo.contact?.phone || 'Telepon belum diatur'}</span>
              </li>
              <li className="d-flex mb-3">
                <FaEnvelope className="text-success mt-1 me-3 flex-shrink-0" />
                <span className="small text-white text-break">{schoolInfo.contact?.email || 'Email belum diatur'}</span>
              </li>
            </ul>
          </Col>
        </Row>

        <hr className="my-4 border-secondary opacity-25" />
        
        <Row className="align-items-center">
          <Col md={6} className="text-center text-md-start">
            <p className="small text-white mb-0">
              &copy; {new Date().getFullYear()} <span className="text-white">{schoolInfo.schoolName}</span>. All Rights Reserved.
            </p>
          </Col>
          <Col md={6} className="text-center text-md-end mt-3 mt-md-0">
            <p className="small text-white mb-0">
              Developed with <span className="text-danger">❤</span> by <a href="#" className="text-decoration-none text-warning fw-bold hover-warning">dibuat untuk pendidikan indonesia</a>
            </p>
          </Col>
        </Row>
      </Container>

      <style>{`
        .footer-links li, .footer-contact li {
          margin-bottom: 0.75rem;
        }
        .footer-links a {
          color: #ffffff;
          text-decoration: none;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        .footer-links a:hover {
          color: #198754;
          padding-left: 5px;
        }
        .social-icon {
          color: #ffffff;
          transition: all 0.2s ease;
          display: inline-block;
        }
        .social-icon:hover {
          color: #198754;
          transform: translateY(-3px);
        }
        .tracking-wider {
          letter-spacing: 0.05em;
        }
        .hover-white:hover {
          color: white !important;
        }
        .hover-warning:hover {
          color: #ffc107 !important;
          opacity: 0.8;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
