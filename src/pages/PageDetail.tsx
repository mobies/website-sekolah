import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Card, ListGroup, Breadcrumb } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import { FaChevronRight, FaClock, FaShareAlt, FaPrint, FaFileAlt } from 'react-icons/fa';
import { getPageAttachmentFrameHeight, normalizePageAttachmentKind, type PageAttachmentItem } from '../utils/pageAttachments';

interface PageData {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  slug: string;
  attachments?: PageAttachmentItem[];
}

interface DetailHeroConfig {
  mode: 'solid' | 'image';
  solidColor: string;
  imageUrl: string;
  imageStoragePath?: string;
}

const PageDetail: React.FC = () => {
  const { slug } = useParams();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const [page, setPage] = useState<PageData | null>(null);
  const [allPages, setAllPages] = useState<PageData[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [detailHeroConfig, setDetailHeroConfig] = useState<DetailHeroConfig>({
    mode: 'solid',
    solidColor: '#198754',
    imageUrl: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !slug) return;

    const unsubSchoolName = onValue(getDBRef(tenantId, 'settings/schoolName'), (snap) => {
      setSchoolName(snap.val() || '');
    });

    const unsubHeroConfig = onValue(getDBRef(tenantId, 'settings/detailHeroConfig'), (snap) => {
      const data = snap.val();
      setDetailHeroConfig({
        mode: data?.mode === 'image' ? 'image' : 'solid',
        solidColor: data?.solidColor || '#198754',
        imageUrl: data?.imageUrl || '',
        imageStoragePath: data?.imageStoragePath
      });
    });

    const pagesRef = getDBRef(tenantId, 'pages');
    const unsub = onValue(pagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(p => p.isActive);

        setAllPages(list);

        const found = list.find(p => p.slug === slug);
        if (found) {
          setPage(found);
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    return () => {
      unsubSchoolName();
      unsubHeroConfig();
      unsub();
    };
  }, [tenantId, slug, navigate]);

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

  if (!page) return null;

  return (
    <div className="profile-page-wrapper bg-white">
      <section
        className="profile-hero position-relative overflow-hidden py-5 text-white"
        style={{
          backgroundColor: detailHeroConfig.solidColor,
          backgroundImage: detailHeroConfig.mode === 'image' && detailHeroConfig.imageUrl
            ? `url(${detailHeroConfig.imageUrl})`
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div
          className="hero-overlay position-absolute top-0 start-0 w-100 h-100"
          style={{
            background: detailHeroConfig.mode === 'image' && detailHeroConfig.imageUrl
              ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.45))'
              : 'linear-gradient(135deg, rgba(0, 0, 0, 0.18), rgba(255, 255, 255, 0.04))',
            opacity: 1
          }}
        ></div>
        <Container className="position-relative z-1 py-4">
          <Breadcrumb className="custom-breadcrumb mb-4">
            <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>Beranda</Breadcrumb.Item>
            <Breadcrumb.Item active>Page</Breadcrumb.Item>
            <Breadcrumb.Item active>{page.title}</Breadcrumb.Item>
          </Breadcrumb>
          <Row className="align-items-center">
            <Col lg={8}>
              <div className="d-flex align-items-center mb-3">
                <div className="bg-white bg-opacity-20 p-2 rounded-3 me-3">
                  <FaFileAlt size={24} />
                </div>
                <span className="text-uppercase tracking-wider fw-bold small opacity-75">Informasi Halaman</span>
              </div>
              <h1 className="display-4 fw-bold mb-3 lh-sm">{page.title}</h1>
              <div className="d-flex gap-4 align-items-center opacity-75 small">
                <span className="d-flex align-items-center"><FaClock className="me-2" /> Estimasi {readingTime(page.content)} Menit Baca</span>
                <span className="d-none d-md-inline">•</span>
                <span className="d-none d-md-inline">{schoolName}</span>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <Container className="py-5 mt-n4">
        <Row className="g-5">
          <Col lg={8} className="order-2 order-lg-1 mt-0">
            <Card className="border-0 shadow-sm rounded-4 overflow-hidden mt-n5 position-relative z-2">
              <Card.Body className="p-4 p-md-5">
                <div className="content-actions d-flex justify-content-end gap-3 mb-4 pb-4 border-bottom">
                  <button className="btn btn-light btn-sm rounded-pill px-3 text-muted" onClick={() => window.print()}><FaPrint className="me-2" /> Cetak</button>
                  <button className="btn btn-light btn-sm rounded-pill px-3 text-muted"><FaShareAlt className="me-2" /> Bagikan</button>
                </div>
                <article className="profile-article">
                  <div className="article-body" style={{ whiteSpace: 'pre-line' }}>
                    {page.content}
                  </div>
                  {(page.attachments?.length || 0) > 0 && (
                    <div className="profile-attachments mt-5 pt-4 border-top">
                    {page.attachments?.map((attachment) => {
                      const attachmentKind = normalizePageAttachmentKind(attachment.kind);
                      const isImage = attachmentKind === 'image';
                      return (
                        <section key={attachment.id} className="profile-attachment mb-4">
                          <h2 className="h5 fw-bold text-success mb-3">{attachment.title}</h2>
                          {isImage ? (
                            <img
                              src={attachment.url}
                              alt={attachment.title}
                              className="w-100 rounded-4 border bg-light"
                              loading="lazy"
                              style={{ maxHeight: '560px', objectFit: 'contain' }}
                            />
                          ) : (
                            <div className="border rounded-4 overflow-hidden bg-light" style={{ minHeight: getPageAttachmentFrameHeight(attachmentKind) }}>
                              <iframe
                                src={attachment.url}
                                title={attachment.title}
                                className="w-100"
                                style={{ border: 0, minHeight: getPageAttachmentFrameHeight(attachmentKind) }}
                                allowFullScreen
                              />
                            </div>
                          )}
                        </section>
                      );
                    })}
                    </div>
                  )}
                </article>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={4} className="order-1 order-lg-2">
            <div className="sticky-top" style={{ top: '100px' }}>
              <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                <Card.Header className="bg-success text-white py-3 border-0 fw-bold">Jelajahi Page</Card.Header>
                <ListGroup variant="flush">
                  {allPages.map((item) => (
                    <ListGroup.Item
                      key={item.id}
                      as={Link}
                      to={`/page/${item.slug}`}
                      className={`py-3 px-4 border-0 d-flex justify-content-between align-items-center text-decoration-none transition-all ${item.slug === slug ? 'bg-success bg-opacity-10 text-success fw-bold' : 'text-dark hover-bg-light'}`}
                    >
                      {item.title}
                      <FaChevronRight size={12} className={item.slug === slug ? 'text-success' : 'text-muted opacity-50'} />
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>

      <style>{`
        .profile-hero {
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
        .profile-attachments img {
          display: block;
        }
        .transition-all { transition: all 0.3s ease; }
        .hover-bg-light:hover { background-color: #f8fafc; color: #198754 !important; }
        .mt-n4 { margin-top: -1.5rem; }
        .mt-n5 { margin-top: -4rem; }
        @media (max-width: 991.98px) {
          .profile-hero { min-height: 300px; padding-bottom: 80px !important; }
          .mt-n5 { margin-top: -3rem; }
        }
      `}</style>
    </div>
  );
};

export default PageDetail;
