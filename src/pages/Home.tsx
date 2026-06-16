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
import { FaBullhorn, FaPaperclip, FaNewspaper, FaChevronRight } from 'react-icons/fa';
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

interface AnnouncementItem {
  id: string;
  title: string;
  date: string;
  content?: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  deleted?: boolean;
  status?: string;
}

interface EService {
  id: string;
  title: string;
  url: string;
  bgColor: string;
  textColor: string;
  icon: string;
  iconType: 'emoji' | 'fa' | 'bi' | 'hi' | 'fc';
  order?: number;
}

type EServicesLayout = 'bento' | 'slider' | 'compact-grid' | 'list-card';

const Home: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [eServices, setEServices] = useState<EService[]>([]);
  const [schoolInfo, setSchoolInfo] = useState({
    schoolName: '',
    tagline: '',
    eServicesLayout: 'bento' as EServicesLayout,
    headmaster: { name: '', greeting: "", photo: '' } as Headmaster // Cast to Headmaster
  });
  const [loading, setLoading] = useState(true);
  const serviceLayout: EServicesLayout = schoolInfo.eServicesLayout || 'bento';

  useEffect(() => {
    if (!tenantId) return;

    // 1. School Info
    onValue(getDBRef(tenantId, 'settings'), (snap) => {
      const data = snap.val();
      if (data) {
        setSchoolInfo({
          schoolName: data.schoolName || '',
          tagline: data.tagline || '',
          eServicesLayout: (['bento', 'slider', 'compact-grid', 'list-card'].includes(data.eServicesLayout) ? data.eServicesLayout : 'bento') as EServicesLayout,
          headmaster: data.headmaster || { name: '', greeting: "", photo: '' }
        });
      }
      setLoading(false);
    });

    // 2. News (Fetch up to 5 items)
    onValue(getDBRef(tenantId, 'news'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted && item.status === 'published')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5);
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
      if (data) setEServices(Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)));
      else setEServices([]);
    });

    // 5. Announcements (Fetch up to 2 items)
    onValue(getDBRef(tenantId, 'announcements'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted && item.status === 'published')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 2);
        setAnnouncements(list);
      } else setAnnouncements([]);
    });
  }, [tenantId]);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <>
      <Hero />

      <section className="py-5 bg-white">
        <Container>
          <Row>
            <Col md={announcements.length > 0 ? 8 : 12}>
              {schoolInfo.headmaster.greeting && (
                <>
                  <h2 className="fw-bold mb-3">Sambutan {terms.headmaster}</h2>
                  {schoolInfo.headmaster.photo && (
                    <img src={schoolInfo.headmaster.photo || 'https://via.placeholder.com/320x400'} alt={schoolInfo.headmaster.name} className="headmaster-photo float-start rounded me-3 mb-2" />
                  )}
                  <p className="lead mb-3 text-success fw-medium">Assalamu'alaikum Warahmatullahi Wabarakatuh</p>
                  <p className="text-muted" style={{ lineHeight: '1.8', textAlign: 'justify', whiteSpace: 'pre-line' }}>{schoolInfo.headmaster.greeting}</p>
                  {schoolInfo.headmaster.name && (
                    <div className="mt-4 pt-3 border-top d-inline-block">
                      <p className="fw-bold mb-0 text-dark">{schoolInfo.headmaster.name}</p>
                      <small className="text-muted">Kepala {schoolInfo.schoolName}</small>
                    </div>
                  )}
                </>
              )}
            </Col>

            {announcements.length > 0 && (
              <Col md={4} className="mt-4 mt-md-0">
                {/* Berita Terbaru (small list, same style as announcements) */}
                {news.length > 0 && (
                  <div className="mb-4">
                    <h5 className="fw-bold mb-3">Berita Terbaru</h5>
                    <ul className="announcement-list list-unstyled mb-2">
                      {news.slice(0, 2).map((item, idx) => (
                        <li key={item.id} className="announcement-item d-flex align-items-start p-3 rounded-3 mb-2 bg-white shadow-sm">
                          <div className={`announcement-icon-box d-inline-flex align-items-center justify-content-center rounded-3 text-white`} style={{ width: 52, height: 52, flexShrink: 0, backgroundColor: ['#ff6b6b', '#5aa9ff', '#ffb86b', '#9b8cff'][idx % 4] }}>
                            <FaNewspaper />
                          </div>

                          <Link to={`/berita/${item.id}`} className="text-decoration-none text-dark flex-grow-1 ms-3">
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="pe-2">
                                <div className="fw-bold mb-1 announcement-title" style={{ fontSize: '0.95rem' }}>{item.title}</div>
                                <div className="text-muted small announcement-subtitle text-truncate-2">{item.category ? item.category + ' • ' : ''}{item.title}</div>
                              </div>
                              <div className="d-flex align-items-center ms-2 announcement-meta">
                                <small className="text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</small>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="text-center mt-2">
                      <Link to="/berita" className="btn btn-light shadow-sm rounded-pill px-3 text-success">View all</Link>
                    </div>
                  </div>
                )}

                <h4 className="fw-bold mb-3">Pengumuman Terbaru</h4>
                <ul className="announcement-list list-unstyled mb-2">
                  {announcements.map((item, idx) => (
                    <li key={item.id} className="announcement-item d-flex align-items-start p-3 rounded-3 mb-2 bg-white shadow-sm">
                      <div className={`announcement-icon-box d-inline-flex align-items-center justify-content-center rounded-3 text-white`} style={{ width: 52, height: 52, flexShrink: 0, backgroundColor: ['#7bd389', '#5aa9ff', '#ffb86b', '#9b8cff'][idx % 4] }}>
                        <FaBullhorn />
                      </div>

                      <Link to={`/pengumuman/${item.id}`} className="text-decoration-none text-dark flex-grow-1 ms-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="pe-2">
                            <div className="fw-bold mb-1 announcement-title" style={{ fontSize: '0.95rem' }}>{item.title}</div>
                            <div className="text-muted small announcement-subtitle text-truncate-2">{item.content ? item.content.replace(/\n/g, ' ') : ''}</div>
                          </div>
                          <div className="d-flex align-items-center ms-2 announcement-meta">
                            <small className="text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</small>
                            {item.attachmentUrl ? <FaPaperclip className="text-primary ms-2" /> : null}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="text-center mt-2">
                  <Link to="/pengumuman" className="btn btn-light shadow-sm rounded-pill px-3 text-success">View all</Link>
                </div>
              </Col>
            )}
          </Row>
        </Container>
      </section>

      <section className="py-5 bg-light">
        <Container>
          <div className="d-flex justify-content-between align-items-end mb-4">
            <div>
              <h2 className="fw-bold border-bottom border-success d-inline-block pb-2 mb-2">Berita & Artikel</h2>
              <p className="text-muted small mb-0">Informasi terbaru seputar kegiatan dan prestasi {schoolInfo.schoolName}</p>
            </div>
            <Link to="/berita" className="btn btn-outline-primary rounded-pill px-4 py-2 mb-2">Lihat Semua</Link>
          </div>
          <div className="news-bento-grid bento-grid">
            {news.slice(0, 5).map((item, idx) => (
              idx === 0 ? (
                <Link key={item.id} to={`/berita/${item.id}`} className={`bento-item bento-large text-decoration-none text-white shadow-sm news-bento-large`} style={{ overflow: 'hidden' }}>
                  <ProgressiveImage src={item.thumbnail || 'https://via.placeholder.com/800x600'} style={{ width: '100%', height: '100%', objectFit: item.coverObjectFit || 'cover' }} alt={item.title} />
                  <div className="bento-content news-overlay p-4" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                    <div className="text-uppercase text-success small fw-bold mb-2">{item.category}</div>
                    <h3 className="fw-bold mb-2" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>{item.title}</h3>
                    <p className="news-excerpt mb-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>{((item as any).content || item.title || '').replace(/\n/g, ' ')}</p>
                  </div>
                </Link>
              ) : (
                <Link key={item.id} to={`/berita/${item.id}`} className={`bento-item text-decoration-none shadow-sm news-bento-item`} style={{ background: '#fff', color: '#222' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <ProgressiveImage src={item.thumbnail || 'https://via.placeholder.com/400x250'} style={{ width: '100%', height: 196, objectFit: item.coverObjectFit || 'cover' }} alt={item.title} />
                  </div>
                  <div className="bento-content p-3">
                    <div className="text-success small fw-bold text-uppercase mb-1">{item.category}</div>
                    <h5 className="fw-bold mb-2" style={{ fontSize: '1rem' }}>{item.title}</h5>
                    <div className="d-flex justify-content-between align-items-center mt-auto">
                      <small className="text-muted">{new Date(item.date).toLocaleDateString('id-ID')}</small>
                      <span className="text-success small">Selengkapnya</span>
                    </div>
                  </div>
                </Link>
              )
            ))}
          </div>
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
            
            {serviceLayout === 'slider' ? (
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
            ) : serviceLayout === 'compact-grid' ? (
              <div className="services-compact-grid">
                {eServices.map((item) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="service-compact-card text-decoration-none shadow-sm" style={{ backgroundColor: item.bgColor, color: item.textColor }}>
                    <div className="service-compact-icon"><IconRenderer icon={item.icon} type={item.iconType} /></div>
                    <div className="service-compact-content">
                      <h5 className="service-compact-title fw-bold mb-1" style={{ color: 'inherit' }}>{item.title}</h5>
                      <div className="service-compact-meta">Klik untuk membuka</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : serviceLayout === 'list-card' ? (
              <div className="services-list-cards">
                {eServices.map((item) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="service-list-card text-decoration-none shadow-sm" style={{ backgroundColor: item.bgColor, color: item.textColor }}>
                    <div className="service-list-icon"><IconRenderer icon={item.icon} type={item.iconType} /></div>
                    <div className="service-list-content">
                      <h5 className="service-list-title fw-bold mb-1" style={{ color: 'inherit' }}>{item.title}</h5>
                      <div className="service-list-sub">Klik untuk membuka</div>
                    </div>
                    <div className="service-list-arrow"><FaChevronRight size={10} /></div>
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
        
        /* Bento Grid (height increased by 40%) */
        .bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 252px); gap: 20px; }
        .bento-item { border-radius: 20px; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; transition: 0.3s; }
        .bento-item:hover { transform: translateY(-5px); }
        .bento-large { grid-column: span 2; grid-row: span 2; }
        .bento-icon { font-size: 3rem; margin-bottom: auto; }
        
        /* Services Slider */
        .services-slider { display: flex; overflow-x: auto; gap: 20px; padding: 10px 5px 20px; scrollbar-width: none; -ms-overflow-style: none; align-items: stretch; }
        .services-slider::-webkit-scrollbar { display: none; }
        .service-card { width: 280px; min-width: 280px; max-width: 280px; height: 252px; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end; transition: 0.3s; flex-shrink: 0; }
        .service-card:hover { transform: translateY(-5px); }
        .service-card .bento-content { height: 100%; display: flex; flex-direction: column; }
        .service-card .bento-text h5 { white-space: normal; overflow-wrap: anywhere; word-break: break-word; line-height: 1.25; }

        /* Compact Grid */
        .services-compact-grid { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
        .service-compact-card { width: fit-content; max-width: 100%; min-height: 0; border-radius: 16px; padding: 16px 18px; display: inline-flex; align-items: center; gap: 14px; transition: 0.25s ease; }
        .service-compact-card:hover { transform: translateY(-4px); }
        .service-compact-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,0.14); font-size: 1.5rem; }
        .service-compact-content { min-width: 0; display: flex; flex-direction: column; justify-content: center; max-width: 320px; }
        .service-compact-title { line-height: 1.2; white-space: normal; overflow-wrap: anywhere; }
        .service-compact-meta { font-size: 0.85rem; opacity: 0.75; }

        /* List Card */
        .services-list-cards { display: grid; gap: 14px; }
        .service-list-card { min-height: 92px; border-radius: 16px; padding: 16px 18px; display: flex; align-items: center; gap: 16px; transition: 0.25s ease; }
        .service-list-card:hover { transform: translateY(-3px); }
        .service-list-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,0.14); font-size: 1.6rem; }
        .service-list-content { flex: 1; min-width: 0; }
        .service-list-title { line-height: 1.2; white-space: normal; overflow-wrap: anywhere; }
        .service-list-sub { font-size: 0.85rem; opacity: 0.75; }
        .service-list-arrow { width: 38px; height: 38px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,0.14); font-size: 1.25rem; font-weight: 700; }
        
        @media (max-width: 992px) { 
          .bento-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: auto; } 
          .bento-item { height: 252px; } 
          .service-card { width: 240px; min-width: 240px; max-width: 240px; }
          .services-compact-grid { gap: 14px; }
        }
        @media (max-width: 576px) { 
          .bento-grid { grid-template-columns: 1fr; } 
          .bento-large { grid-column: span 1; grid-row: span 1; } 
          .service-card { width: 85%; min-width: 85%; max-width: 85%; }
          .services-compact-grid { flex-direction: column; }
          .service-compact-card { width: 100%; }
          .service-list-card { padding: 14px; }
          .service-list-icon { width: 50px; height: 50px; }
        }
        /* Headmaster photo styling: ~50% larger and subtle drop shadow */
        .headmaster-photo {
          width: 240px;
          max-width: 45%;
          box-shadow: 0 12px 30px rgba(0,0,0,0.16);
        }
        /* Kiddom-style Announcement List */
        .announcement-list { padding: 0; }
        .announcement-item { align-items: center; }
        .announcement-icon-box { font-size: 1.25rem; }
        .announcement-title { line-height: 1.05; }
        .announcement-subtitle { opacity: 0.85; }
        .announcement-meta { white-space: nowrap; margin-left: 8px; }
        .text-truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        /* News bento styles */
        .news-bento-grid { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 336px); }
        .news-bento-item { background: #fff; border-radius: 12px; display: flex; flex-direction: column; justify-content: flex-start; overflow: hidden; padding: 0; }
        .news-bento-large { position: relative; padding: 0; border-radius: 16px; }
        .news-overlay { background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 60%); }
        .news-excerpt { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; opacity: 0.95; }
        @media (max-width: 992px) { .news-bento-grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: auto; } .news-bento-large { grid-column: span 2; grid-row: span 1; height: 448px; } }
      `}</style>
    </>
  );
};

export default Home;
