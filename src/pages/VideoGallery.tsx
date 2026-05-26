import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Form, InputGroup, Button, Modal } from 'react-bootstrap';
import { ref, query, orderByChild, limitToLast, get, endAt } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';

interface VideoItem {
  id: string;
  title: string;
  youtubeId: string;
  createdAt: number;
  deleted?: boolean;
}

const PAGE_SIZE = 6;

const VideoGallery: React.FC = () => {
  const { tenantId } = useTenant();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  const fetchVideos = useCallback(async (isInitial = false) => {
    if (!tenantId || (!isInitial && !hasMore) || loadingMore) return;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const videosRef = ref(database, `tenants/${tenantId}/videos`);
      let videoQuery;
      if (isInitial) {
        videoQuery = query(videosRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
      } else {
        videoQuery = query(videosRef, orderByChild('createdAt'), endAt(lastTimestamp! - 1), limitToLast(PAGE_SIZE));
      }

      const snapshot = await get(videoQuery);
      const data = snapshot.val();
      if (data) {
        const items: VideoItem[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted)
          .sort((a, b) => b.createdAt - a.createdAt);
        if (items.length < PAGE_SIZE) setHasMore(false);
        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
          setVideos(prev => isInitial ? items : [...prev, ...items]);
        }
      } else setHasMore(false);
    } catch (error) { console.error(error); } finally { setLoading(false); setLoadingMore(false); }
  }, [tenantId, hasMore, loadingMore, lastTimestamp]);
  
  useEffect(() => { fetchVideos(true); }, [tenantId]);

  useEffect(() => {
    const handleScroll = () => {
      if (!searchTerm && window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) fetchVideos();
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchVideos, searchTerm]);

  const openVideo = (video: VideoItem) => {
    setActiveVideo(video);
    setShowModal(true);
  };

  return (
    <Container className="my-5">
      <Row className="justify-content-center mb-5">
        <Col lg={8} className="text-center">
          <h2 className="fw-bold mb-4">Galeri Video</h2>
          <div className="card shadow-sm border-0 p-3 bg-white rounded-4">
            <InputGroup>
              <InputGroup.Text className="bg-transparent border-end-0"><i className="bi bi-search"></i></InputGroup.Text>
              <Form.Control className="border-start-0 shadow-none" placeholder="Cari video..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              {searchTerm && <Button variant="light" className="border-start-0" onClick={() => setSearchTerm('')}>Reset</Button>}
            </InputGroup>
          </div>
        </Col>
      </Row>

      <Row>
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>
        ) : (
          videos.filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase())).map((video) => (
            <Col key={video.id} md={4} sm={6} className="mb-4">
              <Card className="h-100 border-0 shadow-sm rounded-4 overflow-hidden hover-lift" onClick={() => openVideo(video)} style={{ cursor: 'pointer' }}>
                <div className="position-relative">
                  <Card.Img variant="top" src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`} style={{ height: '200px', objectFit: 'cover' }} />
                  <div className="position-absolute top-50 start-50 translate-middle">
                     <div className="btn btn-danger rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                        <i className="bi bi-play-fill fs-4"></i>
                     </div>
                  </div>
                </div>
                <Card.Body className="p-3 text-center">
                  <Card.Title className="fw-bold small text-truncate-2 mb-0">{video.title}</Card.Title>
                </Card.Body>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered contentClassName="bg-transparent border-0">
        <Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header>
        <Modal.Body className="p-0">
          {activeVideo && (
            <div className="ratio ratio-16x9 shadow-lg rounded-4 overflow-hidden bg-black">
              <iframe src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1`} title={activeVideo.title} allowFullScreen allow="autoplay; encrypted-media"></iframe>
            </div>
          )}
          {activeVideo && <h5 className="text-white text-center mt-3 fw-bold">{activeVideo.title}</h5>}
        </Modal.Body>
      </Modal>

      {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
      <style>{`
        .hover-lift { transition: all 0.3s ease; }
        .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 1rem 3rem rgba(0,0,0,0.1) !important; }
        .text-truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </Container>
  );
};

export default VideoGallery;
