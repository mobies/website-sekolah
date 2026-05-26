import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Modal, Breadcrumb, Button } from 'react-bootstrap';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEye, FaImages } from 'react-icons/fa';
import ProgressiveImage from '../components/ProgressiveImage';
import { useTenant } from '../firebase/TenantContext';
import { ref, query, orderByChild, limitToLast, endAt, get, onValue } from 'firebase/database';
import { rtdb as database } from '../firebase/config';

interface Photo {
  id: string;
  url: string;
  createdAt: number;
  albumId: string;
  deleted?: boolean;
}

interface Album {
  id: string;
  title: string;
  description: string;
}

const PAGE_SIZE = 12;

const GalleryDetailPublic: React.FC = () => {
  const { tenantId } = useTenant();
  const { id: albumId } = useParams();
  const navigate = useNavigate();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  
  // Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchPhotos = useCallback(async (isInitial = false) => {
    if (!tenantId || !albumId || (!isInitial && !hasMore) || loadingMore) return;
    
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const photosRef = ref(database, `tenants/${tenantId}/gallery_photos`);
      let photosQuery;
      
      if (isInitial) {
        photosQuery = query(photosRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
      } else {
        photosQuery = query(photosRef, orderByChild('createdAt'), endAt(lastTimestamp! - 1), limitToLast(PAGE_SIZE));
      }

      const snapshot = await get(photosQuery);
      const data = snapshot.val();
      
      if (data) {
        const items: Photo[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => item.albumId === albumId && !item.deleted)
          .sort((a, b) => b.createdAt - a.createdAt);

        if (items.length < PAGE_SIZE) setHasMore(false);
        
        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
          setPhotos(prev => isInitial ? items : [...prev, ...items]);
        } else if (isInitial) {
          setPhotos([]);
        }
      } else {
        setHasMore(false);
        if (isInitial) setPhotos([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantId, albumId, hasMore, loadingMore, lastTimestamp]);

  useEffect(() => {
    if (!tenantId || !albumId) return;

    // 1. Fetch Album Info
    const albumRef = ref(database, `tenants/${tenantId}/gallery_albums/${albumId}`);
    onValue(albumRef, (snap) => {
      const data = snap.val();
      if (data && !data.deleted) {
        setAlbum({ id: albumId, ...data });
      } else {
        navigate('/galeri');
      }
    });

    fetchPhotos(true);
  }, [tenantId, albumId, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !loading && !loadingMore) {
        fetchPhotos();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchPhotos, loading, loadingMore]);

  const openPreview = (url: string) => {
    setSelectedPhoto(url);
    setShowPreview(true);
  };

  if (loading && photos.length === 0) return (
    <div className="text-center py-5 min-vh-100 bg-light d-flex align-items-center justify-content-center">
      <Spinner animation="border" variant="success" />
    </div>
  );

  return (
    <div className="gallery-detail-public-page bg-light min-vh-100 py-5">
      <Container>
        <Breadcrumb className="mb-4">
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>Beranda</Breadcrumb.Item>
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/galeri" }}>Galeri Foto</Breadcrumb.Item>
          <Breadcrumb.Item active>{album?.title}</Breadcrumb.Item>
        </Breadcrumb>

        <div className="d-flex align-items-center mb-4">
           <Button onClick={() => navigate(-1)} variant="white" className="btn-icon me-3 shadow-sm rounded-circle">
              <FaArrowLeft />
           </Button>
           <div>
              <h2 className="fw-bold text-dark mb-1">{album?.title}</h2>
              <p className="text-muted small mb-0">{album?.description}</p>
           </div>
        </div>

        <Row className="g-3">
          {photos.length === 0 ? (
             <Col xs={12} className="text-center py-5 text-muted border rounded-4 bg-white">
                <FaImages size={40} className="mb-3 opacity-25" />
                <p>Belum ada foto dalam album ini.</p>
             </Col>
          ) : (
            photos.map(photo => (
              <Col key={photo.id} xl={3} lg={4} md={6} sm={6}>
                <Card className="border-0 shadow-sm rounded-4 overflow-hidden position-relative photo-card-public" onClick={() => openPreview(photo.url)}>
                  <div className="photo-overlay d-flex align-items-center justify-content-center">
                     <div className="overlay-content text-white text-center">
                        <FaEye size={24} className="mb-2" />
                        <div className="fw-bold small uppercase tracking-wider">Preview</div>
                     </div>
                  </div>
                  <ProgressiveImage 
                    src={photo.url} 
                    className="img-fluid" 
                    style={{ height: '240px', width: '100%' }} 
                    alt="" 
                  />
                </Card>
              </Col>
            ))
          )}
        </Row>

        {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
        {!hasMore && photos.length > 0 && <div className="text-center py-4 text-muted small italic">Semua foto telah ditampilkan.</div>}
      </Container>

      {/* Preview Modal */}
      <Modal 
        show={showPreview} 
        onHide={() => setShowPreview(false)} 
        centered 
        size="lg"
        contentClassName="bg-transparent border-0 shadow-none"
        backdropClassName="bg-dark bg-opacity-75"
      >
        <Modal.Header closeButton closeVariant="white" className="border-0 p-3"></Modal.Header>
        <Modal.Body className="p-0 text-center">
           {selectedPhoto && (
             <div className="preview-image-container rounded-4 overflow-hidden shadow-lg mx-auto d-inline-block">
                <img src={selectedPhoto} alt="Preview" className="img-fluid" style={{ maxHeight: '85vh', objectFit: 'contain' }} />
             </div>
           )}
        </Modal.Body>
      </Modal>

      <style>{`
        .photo-card-public { cursor: pointer; transition: transform 0.3s ease; }
        .photo-card-public:hover { transform: scale(1.02); }
        .photo-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.4);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 1;
        }
        .photo-card-public:hover .photo-overlay {
          opacity: 1;
        }
        .preview-image-container { background-color: #000; }
        .btn-icon { width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; padding: 0; }
        .tracking-wider { letter-spacing: 0.1em; }
      `}</style>
    </div>
  );
};

export default GalleryDetailPublic;
