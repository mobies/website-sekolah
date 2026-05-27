import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero';
import VideoSlider from '../components/VideoSlider';
import StaffSlider from '../components/StaffSlider';
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
  status?: string;
  coverObjectFit?: 'cover' | 'contain' | 'fill';
}

interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time: string;
  deleted?: boolean;
}

interface Headmaster {
  name: string;
  greeting: string;
  photo: string;
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
    headmaster: { name: '', greeting: "", photo: '' } as Headmaster // Cast to Headmaster
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    // 1. School Info
    onValue(getDBRef(tenantId, 'settings'), (snap) => {
      const data = snap.val();
      if (data) {
        setSchoolInfo({
          schoolName: data.schoolName || '',
          tagline: data.tagline || '',
          eServicesLayout: data.eServicesLayout || 'bento',
          headmaster: data.headmaster || { name: '', greeting: "", photo: '' }
        });
      }
      setLoading(false);
    });

    // 2. News (Fetch 4 items)
    onValue(getDBRef(tenantId, 'news'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted && item.status === 'published')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 4);
        setNews(list);
      }
    });

    // 3. Agendas
    onValue(getDBRef(tenantId, 'agenda'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 2);
        setAgendas(list);
      }
    });

    // 4. E-Services
    onValue(getDBRef(tenantId, 'e_services'), (snap) => {
      const data = snap.val();
      if (data) setEServices(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      else setEServices([]);
    });
  }, [tenantId]);

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
                <p className="text-muted" style={{ lineHeight: '1.8', textAlign: 'justify', whiteSpace: 'pre-line' }}>{schoolInfo.headmaster.greeting}</p>
                {schoolInfo.headmaster.name && (
                  <div className="mt-4 pt-3 border-top d-inline-block">
                    <p className="fw-bold mb-0 text-dark">{schoolInfo.headmaster.name}</p>
                    <small className="text-muted">Kepala {schoolInfo.schoolName}</small>
                  </div>
                )}
              </Col>
              <Col md={5} className="offset-md-1 text-center mt-5 mt-md-0">
                <div className="position-relative d-inline-block">
                  <div className="bg-success position-absolute top-0 start-0 w-100 h-100 rounded shadow" style={{ transform: 'translate(15px, 15px)', zIndex: 0 }}></div>
                  <ProgressiveImage src={schoolInfo.headmaster.photo || 'https://via.placeholder.com/400x500'} alt={schoolInfo.headmaster.name} className="rounded shadow position-relative" style={{ maxWidth: '320px', zIndex: 1, height: '400px' }} />
                </div>
              </Col>
            </Row>
          </Container>
        </section>
      )}

      <section className="py-5 bg-light">
        <Container>
          <div className="text-center mb-5">
            <h2 className="fw-bold border-bottom border-success d-inline-block pb-2">Berita & Artikel</h2>
            <p className="text-muted small">Informasi terbaru seputar kegiatan dan prestasi {schoolInfo.schoolName}</p>
          </div>
          <Row>
            {news.map((item) => (
              <Col key={item.id} xs={12} sm={6} md={6} lg={4} xl={3} className="mb-4 d-flex">
                <Card className="h-100 shadow-sm border-0 hover-lift w-100">
                  <ProgressiveImage 
                    src={item.thumbnail || 'https://via.placeholder.com/400x250'} 
                    style={{ height: '200px', objectFit: item.coverObjectFit || 'cover' }} 
                    alt={item.title}
                  />
                  <Card.Body className="d-flex flex-column">
                    <Card.Text className="text-success small mb-1 fw-bold text-uppercase">{item.category}</Card.Text>
                    <Card.Title className="fw-bold h6 mb-3">{item.title}</Card.Title>
                    <div className="d-flex justify-content-between align-items-center mt-auto pt-3 border-top">
                      <small className="text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</small>
                      <Link to={`/berita/${item.id}`} className="text-success fw-bold small text-decoration-none">Selengkapnya</Link>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <VideoSlider />

      <section className="py-5 bg-light">
        <Container>
          <h3 className="fw-bold mb-4 border-start border-4 border-success ps-3">Agenda Kegiatan</h3>
          <Row>
            {agendas.map((item) => (
              <Col key={item.id} md={6} className="mb-3">
                <Card className="border-0 shadow-sm hover-lift">
                  <Card.Body className="p-3">
                    <Row className="align-items-center">
                      <Col xs="auto"><div className="bg-success text-white p-3 rounded text-center" style={{ minWidth: '70px' }}><div className="fw-bold h4 mb-0">{new Date(item.date).getDate()}</div><small className="text-uppercase" style={{ fontSize: '0.6rem' }}>{new Date(item.date).toLocaleString('id-ID', { month: 'short' })}</small></div></Col>
                      <Col><h6 className="fw-bold mb-1">{item.title}</h6><small className="text-muted d-block">{item.time}</small></Col>
                      <Col xs="auto"><Link to={`/agenda/${item.id}`} className="btn btn-outline-success btn-sm rounded-pill px-3">Detail</Link></Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          <Link to="/agenda" className="btn btn-link text-success fw-bold p-0 mt-2 text-decoration-none">Lihat Semua Agenda &raquo;</Link>
        </Container>
      </section>

      {eServices.length > 0 && (
        <section className="py-5 bg-white">
          <Container>
            <h3 className="fw-bold mb-4 border-start border-4 border-primary ps-3">Layanan Digital</h3>
            
            {schoolInfo.eServicesLayout === 'slider' ? (
              <div className="services-slider">
                {eServices.map((item) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="service-card text-decoration-none shadow-sm" style={{ backgroundColor: item.bgColor, color: item.textColor }}>
                    <div className="bento-content">
                      <div className="bento-icon"><IconRenderer icon={item.icon} type={item.iconType} /></div>
                      <div className="bento-text">
                        <h5 className="fw-bold mb-1" style={{ color: 'inherit' }}>{item.title}</h5>
                        <small style={{ color: 'inherit', opacity: 0.7 }}>Klik untuk membuka</small>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="bento-grid">
                {eServices.map((item, idx) => (
                    <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className={`bento-item text-decoration-none shadow-sm ${idx === 0 ? 'bento-large' : ''}`} style={{ backgroundColor: item.bgColor, color: item.textColor }}>
                      <div className="bento-content">
                        <div className="bento-icon"><IconRenderer icon={item.icon} type={item.iconType} /></div>
                        <div className="bento-text"><h5 className="fw-bold mb-1" style={{ color: 'inherit' }}>{item.title}</h5><small style={{ color: 'inherit', opacity: 0.7 }}>Klik untuk membuka</small></div>
                      </div>
                    </a>
                ))}
              </div>
            )}
          </Container>
        </section>
      )}

      <StaffSlider />

      <style>{`
        .hover-lift { transition: all 0.2s ease; }
        .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
        
        /* Bento Grid */
        .bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 180px); gap: 20px; }
        .bento-item { border-radius: 20px; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; transition: 0.3s; }
        .bento-item:hover { transform: translateY(-5px); }
        .bento-large { grid-column: span 2; grid-row: span 2; }
        .bento-icon { font-size: 3rem; margin-bottom: auto; }
        
        /* Services Slider */
        .services-slider { display: flex; overflow-x: auto; gap: 20px; padding: 10px 5px 20px; scrollbar-width: none; -ms-overflow-style: none; }
        .services-slider::-webkit-scrollbar { display: none; }
        .service-card { min-width: 280px; height: 180px; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end; transition: 0.3s; flex-shrink: 0; }
        .service-card:hover { transform: translateY(-5px); }

        @media (max-width: 992px) { 
          .bento-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: auto; } 
          .bento-item { height: 180px; } 
          .service-card { min-width: 240px; }
        }
        @media (max-width: 576px) { 
          .bento-grid { grid-template-columns: 1fr; } 
          .bento-large { grid-column: span 1; grid-row: span 1; } 
          .service-card { min-width: 85%; }
        }
      `}</style>
    </>
  );
};

export default Home;
