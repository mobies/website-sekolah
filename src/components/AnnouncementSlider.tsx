import React, { useState, useEffect } from 'react';
import { Container, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaPaperclip, FaFileAlt, FaFileImage } from 'react-icons/fa';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import ProgressiveImage from './ProgressiveImage';

interface AnnouncementItem {
  id: string;
  title: string;
  date: string;
  content: string;
  status?: string;
  deleted?: boolean;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}

const AnnouncementSlider: React.FC = () => {
  const { tenantId } = useTenant();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    const announcementRef = getDBRef(tenantId, 'announcements');
    const unsubscribe = onValue(announcementRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter((item: AnnouncementItem) => !item.deleted && item.status === 'published')
          .sort((a: AnnouncementItem, b: AnnouncementItem) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 6);
        setAnnouncements(list);
      } else {
        setAnnouncements([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  if (loading || announcements.length === 0) return null;

  const renderAttachmentIcon = (type?: string | null) => {
    if (!type) return <FaPaperclip />;
    if (type.startsWith('image/')) return <FaFileImage />;
    return <FaFileAlt />;
  };

  return (
    <section className="py-5 bg-white">
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3 className="fw-bold mb-0">Pengumuman Terbaru</h3>
          <Link to="/pengumuman" className="btn btn-outline-success btn-sm rounded-pill px-3 fw-bold">Lihat Semua</Link>
        </div>

        <div className="announcement-slider-container">
          <div className="announcement-track">
            {announcements.map((item) => (
              <div key={item.id} className="announcement-card-wrapper">
                <Card className="border-0 shadow-sm rounded-4 announcement-card h-100">
                  <Link to={`/pengumuman/${item.id}`} className="text-decoration-none text-dark">
                    {item.attachmentUrl && item.attachmentType?.startsWith('image/') ? (
                      <div className="announcement-image-wrapper">
                        <ProgressiveImage src={item.attachmentUrl} alt={item.title} style={{ width: '100%', height: '170px', objectFit: 'cover' }} />
                      </div>
                    ) : null}

                    <Card.Body className="d-flex flex-column p-4">
                      <div className="d-flex align-items-start justify-content-between mb-2 announcement-title-row">
                        <Card.Title className="h6 fw-bold text-dark mb-0 flex-grow-1" style={{ minHeight: '3rem' }}>{item.title}</Card.Title>
                        {item.attachmentType ? (
                          <div className="attachment-icon text-success d-inline-flex align-items-center justify-content-center">
                            {renderAttachmentIcon(item.attachmentType)}
                          </div>
                        ) : null}
                      </div>
                      <Card.Text className="text-muted small mb-4 text-truncate-2">{item.content}</Card.Text>
                      <div className="mt-auto d-flex justify-content-between align-items-center pt-3 border-top">
                        <small className="text-muted">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</small>
                        <span className="text-success small fw-bold">Selengkapnya →</span>
                      </div>
                    </Card.Body>
                  </Link>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </Container>

      <style>{`
        .announcement-slider-container {
          overflow-x: auto;
          padding: 10px 5px 25px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .announcement-slider-container::-webkit-scrollbar { display: none; }
        .announcement-track {
          display: flex;
          gap: 20px;
          justify-content: flex-start;
        }
        .announcement-card-wrapper {
          flex: 0 0 calc(33.333% - 14px);
          min-width: 300px;
        }
        .announcement-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .announcement-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.08) !important;
        }
        .announcement-image-wrapper {
          position: relative;
          overflow: hidden;
          border-top-left-radius: 1rem;
          border-top-right-radius: 1rem;
        }
        .announcement-image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .attachment-icon {
          width: 36px;
          height: 36px;
          font-size: 1rem;
          min-width: 36px;
        }
        .announcement-image-wrapper {
          overflow: hidden;
          border-top-left-radius: 1rem;
          border-top-right-radius: 1rem;
        }
        .text-truncate-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media (max-width: 1200px) { .announcement-card-wrapper { flex: 0 0 calc(50% - 12px); } }
        @media (max-width: 768px) { .announcement-card-wrapper { flex: 0 0 70%; } }
        @media (max-width: 576px) { .announcement-card-wrapper { flex: 0 0 90%; } }
      `}</style>
    </section>
  );
};

export default AnnouncementSlider;
