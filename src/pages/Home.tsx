import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner } from 'react-bootstrap';
import Hero from '../components/Hero';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import ProgressiveImage from '../components/ProgressiveImage';
import IconRenderer from '../components/IconRenderer';

interface NewsItem {
  id: string;
  title: string;
  category: string;
  date: string;
  thumbnail: string;
  deleted?: boolean;
}

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string;
  deleted?: boolean;
}

interface EService {
  id: string;
  title: string;
  url: string;
  bgColor: string;
  textColor: string;
  icon: string;
  iconType: 'emoji' | 'fa' | 'bi' | 'hi' | 'fc';
}

const Home: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [eServices, setEServices] = useState<EService[]>([]);
  const [schoolInfo, setSchoolInfo] = useState({
    schoolName: '',
    tagline: '',
    eServicesLayout: 'bento',
    headmaster: {
      name: '',
      greeting: "",
      photo: ''
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    console.log("--- DATABASE PATH VERIFICATION ---");
    console.log("Active Tenant ID:", tenantId);
    console.log("Path Slider (Hero):", `tenants/${tenantId}/settings/heroSlides`);
    console.log("Path Sambutan (Headmaster):", `tenants/${tenantId}/settings/headmaster`);
    console.log("Path Berita (News):", `tenants/${tenantId}/news`);
    console.log("----------------------------------");

    // 1. Fetch School Info & Headmaster
    onValue(getDBRef(tenantId, 'settings'), (snap) => {
      const data = snap.val();
      if (data) {
        setSchoolInfo({
          schoolName: data.schoolName || '',
          tagline: data.tagline || '',
          eServicesLayout: data.eServicesLayout || 'bento',
          headmaster: data.headmaster || {
            name: '',
            greeting: "",
            photo: ''
          }
        });
      }
      setLoading(false);
    });

    // 2. Fetch News
    const newsRef = getDBRef(tenantId, 'news');
    onValue(newsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted && item.status === 'published')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3);
        setNews(list);
      }
    });

    // 3. Fetch Agendas
    const agendaRef = getDBRef(tenantId, 'agenda');
    onValue(agendaRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 2);
        setAgendas(list);
      }
    });

    // 4. Fetch E-Services
    const servicesRef = getDBRef(tenantId, 'e_services');
    onValue(servicesRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setEServices(list);
      } else {
        setEServices([]);
      }
    });
  }, [tenantId]);

  const getIconShadow = () => {
    return 'drop-shadow(0 0 12px rgba(255,255,255,0.6))'; // Fixed white glow
  };

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <>
      <Hero />
      
      {schoolInfo.headmaster.greeting && (
        <section className="py-5 bg-white">
          <Container>
            <Row className="align-items-center">
              <Col md={6}>
                <h2 className="fw-bold mb-4">Sambutan {terms.headmaster}</h2>
                <p className="lead mb-3 text-success fw-medium">Assalamu'alaikum Warahmatullahi Wabarakatuh</p>
                <p className="text-muted" style={{ lineHeight: '1.8', textAlign: 'justify', whiteSpace: 'pre-line' }}>
                  {schoolInfo.headmaster.greeting}
                </p>
                {schoolInfo.headmaster.name && (
                  <div className="mt-4 pt-3 border-top d-inline-block">
                    <p className="fw-bold mb-0 text-dark">{schoolInfo.headmaster.name}</p>
                    <small className="text-muted">{terms.headmaster} {schoolInfo.schoolName}</small>
                  </div>
                )}
              </Col>
              <Col md={5} className="offset-md-1 text-center mt-5 mt-md-0">
                <div className="position-relative d-inline-block">
                  <div className="bg-success position-absolute top-0 start-0 w-100 h-100 rounded shadow" style={{ transform: 'translate(15px, 15px)', zIndex: 0 }}></div>
                  <ProgressiveImage 
                    src={schoolInfo.headmaster.photo || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=400&h=500&fit=crop'} 
                    alt={schoolInfo.headmaster.name || terms.headmaster} 
                    className="rounded shadow position-relative" 
                    style={{ maxWidth: '320px', zIndex: 1, height: '400px' }} 
                  />
                </div>
              </Col>
            </Row>
          </Container>
        </section>
      )}

      <section className="py-5 bg-light">
        <Container>
          <Row className="text-center mb-5">
            <Col>
              <h2 className="fw-bold border-bottom border-success d-inline-block pb-2">Berita & Artikel</h2>
              <p className="text-muted small">Informasi terbaru seputar kegiatan dan prestasi {schoolInfo.schoolName}</p>
            </Col>
          </Row>
          <Row>
            {news.length === 0 ? (
              <Col className="text-center py-4">Belum ada berita terbaru.</Col>
            ) : (
              news.map((item) => (
                <Col key={item.id} md={4} className="mb-4">
                  <Card className="h-100 shadow-sm border-0 hover-lift">
                    <ProgressiveImage 
                      src={item.thumbnail || 'https://images.unsplash.com/photo-1585829365234-781f8c484dca?q=80&w=400&h=250&fit=crop'} 
                      style={{ height: '200px' }} 
                      alt={item.title}
                    />
                    <Card.Body>
                      <Card.Text className="text-success small mb-1 fw-bold text-uppercase">{item.category}</Card.Text>
                      <Card.Title className="fw-bold h5 mb-3">{item.title}</Card.Title>
                      <div className="d-flex justify-content-between align-items-center mt-auto pt-3 border-top">
                        <small className="text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</small>
                        <Button variant="link" className="text-success p-0 fw-bold small text-decoration-none">Selengkapnya</Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))
            )}
          </Row>
        </Container>
      </section>

      {/* E-Layanan Section - Dynamic Layout & Custom Colors & Smart Shadows */}
      {eServices.length > 0 && (
        <section className="py-5 bg-white">
          <Container>
            <h3 className="fw-bold mb-4 border-start border-4 border-primary ps-3">Layanan Digital</h3>
            
            {schoolInfo.eServicesLayout === 'bento' ? (
              <div className="bento-grid">
                {eServices.map((item, idx) => (
                  <a 
                    key={item.id} 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`bento-item text-decoration-none ${idx === 0 ? 'bento-large' : ''}`}
                    style={{ backgroundColor: item.bgColor || '#198754', color: item.textColor || '#ffffff' }}
                  >
                    <div className="bento-content">
                      <div className="bento-icon" style={{ filter: getIconShadow() }}>
                        <IconRenderer icon={item.icon} type={item.iconType || 'emoji'} />
                      </div>
                      <div className="bento-text">
                        <h5 className="fw-bold mb-1" style={{ color: 'inherit' }}>{item.title}</h5>
                        <small style={{ color: 'inherit', opacity: 0.7 }}>Klik untuk membuka</small>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="e-services-slider">
                <div className="d-flex overflow-auto pb-3 gap-3 no-scrollbar">
                  {eServices.map((item) => (
                    <a 
                      key={item.id} 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-decoration-none"
                    >
                      <Card 
                        className="border-0 shadow-sm hover-lift" 
                        style={{ 
                          width: '220px', 
                          flex: '0 0 auto', 
                          borderRadius: '15px',
                          backgroundColor: item.bgColor || '#198754',
                          color: item.textColor || '#ffffff'
                        }}
                      >
                        <Card.Body className="p-4 text-center">
                          <div className="display-5 mb-3" style={{ filter: getIconShadow() }}>
                            <IconRenderer icon={item.icon} type={item.iconType || 'emoji'} />
                          </div>
                          <h6 className="fw-bold mb-0" style={{ color: 'inherit' }}>{item.title}</h6>
                        </Card.Body>
                      </Card>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Container>
        </section>
      )}

      <section className="py-5 bg-light">
        <Container>
          <Row>
            <Col lg={12}>
              <h3 className="fw-bold mb-4 border-start border-4 border-success ps-3">Agenda Kegiatan</h3>
              {agendas.length === 0 ? (
                <p className="text-muted">Tidak ada agenda mendatang.</p>
              ) : (
                <Row>
                  {agendas.map((item) => (
                    <Col key={item.id} md={6}>
                      <Card className="border-0 shadow-sm mb-3 hover-lift">
                        <Card.Body className="p-3">
                          <Row className="align-items-center">
                            <Col xs="auto">
                              <div className="bg-success text-white p-3 rounded text-center" style={{ minWidth: '70px' }}>
                                <div className="fw-bold h4 mb-0">{new Date(item.date).getDate()}</div>
                                <small className="text-uppercase" style={{ fontSize: '0.6rem' }}>
                                  {new Date(item.date).toLocaleString('id-ID', { month: 'short' })
                                }</small>
                              </div>
                            </Col>
                            <Col>
                              <h6 className="fw-bold mb-1">{item.title}</h6>
                              <small className="text-muted d-block">{item.time}</small>
                            </Col>
                            <Col xs="auto">
                              <Button variant="outline-success" size="sm" className="rounded-pill px-3">Detail</Button>
                            </Col>
                          </Row>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
              <Button variant="link" className="text-success fw-bold p-0 mt-2 text-decoration-none">Lihat Semua Agenda &raquo;</Button>
            </Col>
          </Row>
        </Container>
      </section>

      <style>{`
        .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .bento-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(2, 180px);
          gap: 20px;
        }

        .bento-item {
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          position: relative;
          overflow: hidden;
          transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }

        .bento-item:hover {
          transform: scale(1.02);
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }

        .bento-large {
          grid-column: span 2;
          grid-row: span 2;
        }

        .bento-icon {
          font-size: 3rem;
          margin-bottom: auto;
          transition: 0.3s;
          display: flex;
          align-items: center;
        }

        .bento-item:hover .bento-icon {
          transform: translateY(-5px);
        }

        .bento-text h5 {
          font-size: 1.1rem;
        }

        .bento-large .bento-icon {
          font-size: 5rem;
        }

        .bento-large .bento-text h5 {
          font-size: 1.8rem;
        }

        @media (max-width: 992px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: auto;
          }
          .bento-item {
            height: 180px;
          }
        }

        @media (max-width: 576px) {
          .bento-grid {
            grid-template-columns: 1fr;
          }
          .bento-large {
            grid-column: span 1;
            grid-row: span 1;
          }
        }
      `}</style>
    </>
  );
};

export default Home;
