import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Card, ListGroup, Breadcrumb } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import { FaChevronRight, FaClock, FaShareAlt, FaPrint, FaBookOpen } from 'react-icons/fa';

interface ProfileData {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  slug: string;
}

const ProfileDetail: React.FC = () => {
  const { slug } = useParams();
  const { tenantId, terms } = useTenant();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [allProfiles, setAllProfiles] = useState<ProfileData[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !slug) return;

    // 1. Fetch School Name
    onValue(getDBRef(tenantId, 'settings/schoolName'), (snap) => {
      setSchoolName(snap.val() || '');
    });

    // 2. Fetch All Active Profiles for Sidebar
    const profilesRef = getDBRef(tenantId, 'profiles');
    const unsub = onValue(profilesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(p => p.isActive);
        
        setAllProfiles(list);
        
        const found = list.find(p => p.slug === slug);
        if (found) {
          setProfile(found);
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    return () => unsub();
  }, [tenantId, slug, navigate]);

  // Estimate reading time
  const readingTime = (text: string) => {
    const wordsPerMinute = 200;
    const noOfWords = text.split(/\s/g).length;
    const minutes = noOfWords / wordsPerMinute;
    return Math.ceil(minutes);
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="text-center">
        <Spinner animation="border" variant="success" className="mb-3" />
        <p className="text-muted fw-medium">Memuat informasi...</p>
      </div>
    </div>
  );
  
  if (!profile) return null;

  return (
    <div className="profile-page-wrapper bg-white">
      {/* PROFESSIONAL HERO SECTION */}
      <section className="profile-hero position-relative overflow-hidden py-5 text-white">
        <div className="hero-overlay position-absolute top-0 start-0 w-100 h-100"></div>
        <Container className="position-relative z-1 py-4">
          <Breadcrumb className="custom-breadcrumb mb-4">
            <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>Beranda</Breadcrumb.Item>
            <Breadcrumb.Item active>Profil</Breadcrumb.Item>
            <Breadcrumb.Item active>{profile.title}</Breadcrumb.Item>
          </Breadcrumb>
          
          <Row className="align-items-center">
            <Col lg={8}>
              <div className="d-flex align-items-center mb-3">
                <div className="bg-white bg-opacity-20 p-2 rounded-3 me-3">
                  <FaBookOpen size={24} />
                </div>
                <span className="text-uppercase tracking-wider fw-bold small opacity-75">Informasi Profil Institusi</span>
              </div>
              <h1 className="display-4 fw-bold mb-3 lh-sm">{profile.title}</h1>
              <div className="d-flex gap-4 align-items-center opacity-75 small">
                <span className="d-flex align-items-center"><FaClock className="me-2" /> Estimasi {readingTime(profile.content)} Menit Baca</span>
                <span className="d-none d-md-inline">•</span>
                <span className="d-none d-md-inline">{schoolName}</span>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* CONTENT SECTION */}
      <Container className="py-5 mt-n4">
        <Row className="g-5">
          {/* MAIN CONTENT */}
          <Col lg={8} className="order-2 order-lg-1 mt-0">
            <Card className="border-0 shadow-sm rounded-4 overflow-hidden mt-n5 position-relative z-2">
              <Card.Body className="p-4 p-md-5">
                <div className="content-actions d-flex justify-content-end gap-3 mb-4 pb-4 border-bottom">
                  <button className="btn btn-light btn-sm rounded-pill px-3 text-muted" onClick={() => window.print()}><FaPrint className="me-2" /> Cetak</button>
                  <button className="btn btn-light btn-sm rounded-pill px-3 text-muted"><FaShareAlt className="me-2" /> Bagikan</button>
                </div>
                
                <article className="profile-article">
                  <div className="article-body" style={{ whiteSpace: 'pre-line' }}>
                    {profile.content}
                  </div>
                </article>
              </Card.Body>
            </Card>
          </Col>

          {/* SIDEBAR NAVIGATION */}
          <Col lg={4} className="order-1 order-lg-2">
            <div className="sticky-top" style={{ top: '100px' }}>
              <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                <Card.Header className="bg-success text-white py-3 border-0 fw-bold">
                   Jelajahi Profil
                </Card.Header>
                <ListGroup variant="flush">
                  {allProfiles.map((p) => (
                    <ListGroup.Item 
                      key={p.id} 
                      as={Link} 
                      to={`/profil/${p.slug}`}
                      className={`py-3 px-4 border-0 d-flex justify-content-between align-items-center text-decoration-none transition-all ${p.slug === slug ? 'bg-success bg-opacity-10 text-success fw-bold' : 'text-dark hover-bg-light'}`}
                    >
                      {p.title}
                      <FaChevronRight size={12} className={p.slug === slug ? 'text-success' : 'text-muted opacity-50'} />
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card>

              {/* HELPER CARD */}
              <Card className="border-0 shadow-sm rounded-4 bg-dark text-white p-4">
                <h5 className="fw-bold mb-3">Butuh Informasi?</h5>
                <p className="small opacity-75 mb-4">Silakan hubungi kami untuk informasi lebih lanjut mengenai pendaftaran atau kegiatan sekolah.</p>
                <Link to="/kontak" className="btn btn-success rounded-pill fw-bold w-100">Hubungi Kami</Link>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>

      <style>{`
        .profile-hero {
          background: linear-gradient(135deg, #198754 0%, #0d5c3a 100%);
          min-height: 350px;
        }
        
        .hero-overlay {
          background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0);
          background-size: 32px 32px;
          opacity: 0.3;
        }

        .custom-breadcrumb .breadcrumb-item, 
        .custom-breadcrumb .breadcrumb-item a {
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .custom-breadcrumb .breadcrumb-item.active {
          color: #fff;
          opacity: 1;
        }

        .tracking-wider { letter-spacing: 0.1em; }

        .profile-article .article-body {
          font-size: 1.15rem;
          line-height: 1.9;
          color: #334155;
          text-align: justify;
        }

        .transition-all { transition: all 0.3s ease; }
        .hover-bg-light:hover { background-color: #f8fafc; color: #198754 !important; }
        
        .mt-n4 { margin-top: -1.5rem; }
        .mt-n5 { margin-top: -4rem; }

        @media (max-width: 991.98px) {
          .profile-hero { min-height: 300px; padding-bottom: 80px !important; }
          .mt-n5 { margin-top: -3rem; }
        }

        /* Print styles */
        @media print {
          .profile-hero, .content-actions, .sidebar-nav, footer, .navbar { display: none !important; }
          .profile-page-wrapper { background: white !important; padding: 0 !important; }
          .card { box-shadow: none !important; border: none !important; }
          .profile-article .article-body { font-size: 12pt; color: black; }
        }
      `}</style>
    </div>
  );
};

export default ProfileDetail;
