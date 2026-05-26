import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Spinner, Form, InputGroup, Button, Breadcrumb, Badge } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaImages, FaSearch } from 'react-icons/fa';
import ProgressiveImage from '../components/ProgressiveImage';
import { useTenant } from '../firebase/TenantContext';
import { ref, query, orderByChild, limitToLast, endAt, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';

interface Album {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  photoCount: number;
  isActive: boolean;
  deleted?: boolean;
  createdAt: number;
}

const PAGE_SIZE = 12;

const GalleryListPublic: React.FC = () => {
  const { tenantId } = useTenant();
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q') || '';
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState(q);

  const fetchAlbums = useCallback(async (isInitial = false) => {
    if (!tenantId || (!isInitial && !hasMore) || loadingMore) return;
    
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const albumsRef = ref(database, `tenants/${tenantId}/gallery_albums`);
      let albumsQuery;
      
      if (isInitial) {
        albumsQuery = query(albumsRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
      } else {
        albumsQuery = query(albumsRef, orderByChild('createdAt'), endAt(lastTimestamp! - 1), limitToLast(PAGE_SIZE));
      }

      const snapshot = await get(albumsQuery);
      const data = snapshot.val();
      
      if (data) {
        const items: Album[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted) // Usually albums don't have isActive, but they have deleted
          .sort((a, b) => b.createdAt - a.createdAt);

        if (items.length < PAGE_SIZE) setHasMore(false);
        
        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
          setAlbums(prev => isInitial ? items : [...prev, ...items]);
        } else if (isInitial) {
          setAlbums([]);
        }
      } else {
        setHasMore(false);
        if (isInitial) setAlbums([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantId, hasMore, loadingMore, lastTimestamp]);

  useEffect(() => {
    if (!tenantId) return;
    setSearchTerm(q);
    fetchAlbums(true);
  }, [tenantId, q]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !loading && !loadingMore && !searchTerm) {
        fetchAlbums();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchAlbums, loading, loadingMore, searchTerm]);

  const filteredAlbums = useMemo(() => {
    if (!searchTerm) return albums;
    return albums.filter(a => 
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [albums, searchTerm]);

  if (loading && filteredAlbums.length === 0) return <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="gallery-list-public-page bg-light min-vh-100 py-5">
      <Container>
        <Breadcrumb className="mb-4">
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>Beranda</Breadcrumb.Item>
          <Breadcrumb.Item active>Galeri Foto</Breadcrumb.Item>
        </Breadcrumb>

        <div className="mb-4">
          <h2 className="fw-bold text-dark mb-1">Galeri Foto</h2>
          <p className="text-muted small mb-0">Kumpulan dokumentasi kegiatan sekolah dalam album foto.</p>
        </div>

        <div className="card shadow-sm border-0 p-3 bg-white rounded-4 mb-4">
            <InputGroup>
              <InputGroup.Text className="bg-transparent border-end-0"><FaSearch /></InputGroup.Text>
              <Form.Control 
                className="border-start-0 shadow-none" 
                placeholder="Cari album..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
              {searchTerm && <Button variant="light" className="border-start-0" onClick={() => setSearchTerm('')}>Reset</Button>}
            </InputGroup>
        </div>

        <Row className="g-4">
          {filteredAlbums.length === 0 && !loading ? (
             <Col xs={12} className="text-center py-5 text-muted border rounded-4 bg-white">
                <FaImages size={40} className="mb-3 opacity-25" />
                <p>Tidak ada album foto ditemukan.</p>
             </Col>
          ) : (
            filteredAlbums.map(item => (
              <Col key={item.id} xl={4} lg={4} md={6}>
                <Link to={`/galeri/${item.id}`} className="text-decoration-none">
                  <Card className="h-100 border-0 shadow-sm rounded-4 overflow-hidden album-card-public">
                    <div className="position-relative album-image-container">
                      <ProgressiveImage src={item.coverImage} alt={item.title} style={{ height: '100%', width: '100%' }} />
                      <div className="position-absolute top-0 end-0 p-3">
                         <Badge bg="dark" className="bg-opacity-50 backdrop-blur rounded-pill px-3 py-2 fw-bold">
                            {item.photoCount || 0} Foto
                         </Badge>
                      </div>
                      <div className="position-absolute bottom-0 start-0 w-100 p-3 bg-gradient-dark text-white">
                         <h5 className="fw-bold mb-0 text-truncate" title={item.title}>{item.title}</h5>
                      </div>
                    </div>
                    <Card.Body className="p-3">
                       <p className="text-muted small mb-0 text-truncate-2" style={{ minHeight: '40px' }}>{item.description}</p>
                    </Card.Body>
                  </Card>
                </Link>
              </Col>
            ))
          )}
        </Row>

        {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
        {!hasMore && filteredAlbums.length > 0 && <div className="text-center py-4 text-muted small italic">Semua album telah ditampilkan.</div>}
      </Container>

      <style>{`
        .album-card-public { transition: transform 0.3s ease; }
        .album-card-public:hover { transform: translateY(-5px); box-shadow: 0 1rem 3rem rgba(0,0,0,0.1) !important; }
        .album-image-container { height: 240px; background-color: #f8f9fa; }
        .bg-gradient-dark { background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); }
        .backdrop-blur { backdrop-filter: blur(4px); }
        .text-truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default GalleryListPublic;
