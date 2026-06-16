import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaFacebook, FaTwitter, FaInstagram, FaYoutube, FaLinkedin, FaTiktok, FaTelegram, FaWhatsapp, FaPinterest, FaGithub, FaLink, FaDiscord } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

interface ContactData {
  phone: string;
  email: string;
  address: string;
}

interface SocialMediaItem {
  url: string;
  active: boolean;
}

interface SchoolSettings {
  schoolName: string;
  tagline: string;
  description?: string;
  contact?: ContactData;
  socialMedia?: Record<string, SocialMediaItem>;
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
            <h5 className="text-success fw-bold mb-2">{schoolInfo.schoolName}</h5>
            <p className="small text-success mb-3" style={{ lineHeight: '1.6' }}>
              {schoolInfo.tagline}
            </p>
            <p className="small text-white mb-0" style={{ lineHeight: '1.8' }}>
              {schoolInfo.description || 'Lembaga pendidikan formal yang berkomitmen mencetak generasi unggul dalam prestasi dan berakhlakul karimah.'}
            </p>
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
          <Col lg={3} md={6} className="d-flex flex-column">
            <h6 className="fw-bold mb-4 text-uppercase tracking-wider">Kontak Kami</h6>
            <ul className="list-unstyled footer-contact flex-grow-1">
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

            <div className="mt-auto d-flex flex-wrap justify-content-md-end justify-content-start gap-2" style={{ maxWidth: '240px', alignSelf: 'flex-md-end' }}>
              {schoolInfo.socialMedia && Object.entries(schoolInfo.socialMedia).map(([platform, data]) => {
                if (!data.active || !data.url) return null;
                let Icon = FaLink;
                if (platform === 'facebook') Icon = FaFacebook;
                if (platform === 'instagram') Icon = FaInstagram;
                if (platform === 'youtube') Icon = FaYoutube;
                if (platform === 'twitter') Icon = FaTwitter;
                if (platform === 'x') Icon = FaXTwitter;
                if (platform === 'linkedin') Icon = FaLinkedin;
                if (platform === 'tiktok') Icon = FaTiktok;
                if (platform === 'telegram') Icon = FaTelegram;
                if (platform === 'whatsapp') Icon = FaWhatsapp;
                if (platform === 'pinterest') Icon = FaPinterest;
                if (platform === 'github') Icon = FaGithub;
                if (platform === 'discord') Icon = FaDiscord;

                return (
                  <a key={platform} href={data.url} target="_blank" rel="noopener noreferrer" className="social-icon" title={platform} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%', color: '#fff', transition: '0.3s' }}>
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
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
              Developed with <span className="text-danger">❤</span> by <a href="#" className="text-decoration-none fw-bold" style={{ color: '#56bfff' }}>Mobies Creative</a>
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
