import React, { useState, useEffect } from 'react';
import { Container, Modal, Card } from 'react-bootstrap';
import { ref, query, orderByChild, limitToLast, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';

interface VideoItem {
  id: string;
  title: string;
  youtubeId: string;
}

const VideoSlider: React.FC = () => {
  const { tenantId } = useTenant();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const fetchVideos = async () => {
      try {
        const videosRef = ref(database, `tenants/${tenantId}/videos`);
        const videoQuery = query(videosRef, orderByChild('createdAt'), limitToLast(10));
        const snapshot = await get(videoQuery);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const list = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(item => !item.deleted)
            .reverse();
          setVideos(list);
        }
      } catch (error) {
        console.error("Error fetching videos for slider:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [tenantId]);

  const openVideo = (video: VideoItem) => {
    setActiveVideo(video);
    setShowModal(true);
  };

  if (loading || videos.length === 0) return null;

  return (
    <section className="py-5 bg-white">
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="fw-bold mb-0 border-start border-4 border-danger ps-3">Galeri Video</h3>
          <a href="/video" className="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold">Lihat Semua</a>
        </div>
        
        <div className="video-slider-container">
          <div className="video-track">
            {videos.map(video => (
              <div key={video.id} className="video-card-wrapper">
                <Card className="border-0 shadow-sm h-100 rounded-4 overflow-hidden video-card" onClick={() => openVideo(video)}>
                  <div className="position-relative video-thumbnail-container">
                    <img
                      className="w-100 h-100 object-fit-cover"
                      src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                      alt={video.title}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtubeId}/default.jpg`;
                      }}
                    />
                    <div className="position-absolute top-50 start-50 translate-middle">
                      <div className="play-btn-small">
                        <i className="bi bi-play-fill"></i>
                      </div>
                    </div>
                  </div>
                  <Card.Body className="p-3">
                    <h6 className="fw-bold mb-0 text-dark text-truncate-2" style={{ fontSize: '0.9rem', lineHeight: '1.4', height: '2.8rem' }}>
                      {video.title}
                    </h6>
                  </Card.Body>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* Video Player Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered contentClassName="bg-transparent border-0">
        <Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header>
        <Modal.Body className="p-0">
          {activeVideo && (
            <div className="ratio ratio-16x9 shadow-lg rounded-4 overflow-hidden bg-black">
              <iframe 
                src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1`} 
                title={activeVideo.title} 
                allowFullScreen 
                allow="autoplay; encrypted-media"
              ></iframe>
            </div>
          )}
          {activeVideo && <h5 className="text-white text-center mt-3 fw-bold">{activeVideo.title}</h5>}
        </Modal.Body>
      </Modal>

      <style>{`
        .video-slider-container {
          overflow-x: auto;
          padding: 10px 5px 25px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .video-slider-container::-webkit-scrollbar {
          display: none;
        }
        
        .video-track {
          display: flex;
          gap: 20px;
          justify-content: flex-start;
        }

        .video-card-wrapper {
          flex: 0 0 calc(25% - 15px); /* Default 4 items */
          min-width: 250px;
        }

        .video-card {
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .video-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
        }

        .video-thumbnail-container {
          height: 160px;
          background-color: #000;
        }

        .play-btn-small {
          width: 45px;
          height: 45px;
          background-color: rgba(220, 53, 69, 0.9);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          transition: transform 0.3s ease;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .video-card:hover .play-btn-small {
          transform: scale(1.1);
          background-color: #dc3545;
        }

        .text-truncate-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (max-width: 1200px) {
          .video-card-wrapper { flex: 0 0 calc(33.333% - 14px); } /* 3 items */
        }

        @media (max-width: 992px) {
          .video-card-wrapper { flex: 0 0 calc(50% - 10px); } /* 2 items */
        }

        @media (max-width: 576px) {
          .video-card-wrapper { flex: 0 0 85%; } /* 1.2 items for hint of more */
          .video-track { gap: 15px; }
        }
      `}</style>
    </section>
  );
};

export default VideoSlider;
