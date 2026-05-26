import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Container, Card, Button, Table, Spinner, Modal } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaUndo, FaEye, FaPlay } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity } from '../../firebase/utils';
import { update, ref, query, orderByChild, limitToLast, endAt, get } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';

interface VideoItem {
  id: string;
  title: string;
  youtubeId: string;
  createdAt: number;
  deleted?: boolean;
}

const PAGE_SIZE = 10;

const VideoList: React.FC = () => {
  const { tenantId } = useTenant();
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q') || '';
  
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

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
          .sort((a, b) => b.createdAt - a.createdAt);

        if (items.length < PAGE_SIZE) setHasMore(false);

        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
          setVideos(prev => isInitial ? items : [...prev, ...items]);
        } else if (isInitial) {
          setVideos([]);
        }
      } else {
        setHasMore(false);
        if (isInitial) setVideos([]);
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
    fetchVideos(true);
  }, [tenantId, showDeleted]); // Refetch when switching between active/deleted if not using full index

  // Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !q) {
        fetchVideos();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchVideos, q]);

  const displayVideos = useMemo(() => {
    let filtered = videos.filter(v => !!v.deleted === showDeleted);
    if (q) {
      // Note: If searching, we currently only search within already loaded videos.
      // For a better search experience, an index should be used (similar to News).
      filtered = filtered.filter(v => v.title.toLowerCase().includes(q.toLowerCase()));
    }
    return filtered;
  }, [videos, showDeleted, q]);

  const handleDelete = async (item: VideoItem) => {
    if (!tenantId) return;
    try {
        await update(getDBRef(tenantId, `videos/${item.id}`), { deleted: true });
        setVideos(prev => prev.map(v => v.id === item.id ? { ...v, deleted: true } : v));
        await logActivity(tenantId, { action: 'HAPUS', target: 'VIDEO', title: item.title });
    } catch (error) { console.error(error); }
  };

  const handleRestore = async (item: VideoItem) => {
    if (!tenantId) return;
    try {
      await update(getDBRef(tenantId, `videos/${item.id}`), { deleted: false });
      setVideos(prev => prev.map(v => v.id === item.id ? { ...v, deleted: false } : v));
      await logActivity(tenantId, { action: 'PULIHKAN', target: 'VIDEO', title: item.title });
    } catch (error) { console.error(error); }
  };

  const openPreview = (video: VideoItem) => {
    setSelectedVideo(video);
    setShowPreview(true);
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div><h4 className="fw-bold mb-1 text-dark">Kelola Video {showDeleted ? '(Sampah)' : ''}</h4><p className="text-muted small mb-0">Klik pada judul video untuk melihat preview.</p></div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" className="rounded-pill px-3" onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? 'Lihat Aktif' : 'Lihat Sampah'}</Button>
            <Button as={Link as any} to="/dashboard/galeri/video/tambah" variant="success" size="sm" className="rounded-pill px-3 fw-bold"><FaPlus className="me-2" /> Tambah Video</Button>
          </div>
        </div>
        <Card className="border-0 shadow-sm rounded-4 overflow-hidden">
          <Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle admin-table">
              <thead className="bg-light text-muted uppercase extra-small fw-bold">
                <tr>
                  <th className="ps-4 py-3 border-0">VIDEO</th>
                  <th className="py-3 border-0">TANGGAL DIBUAT</th>
                  <th className="py-3 border-0 pe-4 text-end">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="text-center py-5"><Spinner animation="border" variant="success" size="sm" /></td></tr>
                ) : displayVideos.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-5 small text-muted border-0">Tidak ada video ditemukan.</td></tr>
                ) : (
                  displayVideos.map(item => (
                    <tr key={item.id} className="cursor-pointer" onClick={() => openPreview(item)}>
                      <td className="ps-4 py-3">
                        <div className="d-flex align-items-center">
                           <div className="video-thumb-preview me-3 rounded bg-dark d-flex align-items-center justify-content-center" style={{ width: '60px', height: '35px', overflow: 'hidden' }}>
                              <img src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`} className="img-fluid w-100" alt="" />
                           </div>
                           <div className="fw-bold text-dark small">{item.title}</div>
                           <FaPlay size={10} className="ms-2 text-success opacity-0 video-play-icon" />
                        </div>
                      </td>
                      <td className="py-3 small text-muted">{new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                      <td className="pe-4 py-3 text-end">
                        <div className="d-flex justify-content-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {showDeleted ? (
                            <Button onClick={() => handleRestore(item)} variant="light" size="sm" className="btn-icon text-success"><FaUndo size={14} /></Button>
                          ) : (
                            <>
                              <Button onClick={() => openPreview(item)} variant="light" size="sm" className="btn-icon text-info" title="Preview"><FaEye size={14} /></Button>
                              <Button as={Link as any} to={`/dashboard/galeri/video/edit/${item.id}`} variant="light" size="sm" className="btn-icon text-primary"><FaEdit size={14} /></Button>
                              <Button onClick={() => handleDelete(item)} variant="light" size="sm" className="btn-icon text-danger"><FaTrash size={14} /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
        
        {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
        {!hasMore && displayVideos.length > 0 && !q && <div className="text-center py-4 text-muted small italic">Semua video telah ditampilkan.</div>}
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
           {selectedVideo && (
             <div className="preview-video-container rounded-4 overflow-hidden shadow-lg mx-auto w-100 bg-black">
                <div className="ratio ratio-16x9">
                  <iframe 
                    src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1`} 
                    title={selectedVideo.title} 
                    allowFullScreen 
                    allow="autoplay; encrypted-media"
                  ></iframe>
                </div>
                <div className="p-3 bg-white text-dark text-start">
                   <h6 className="fw-bold mb-0">{selectedVideo.title}</h6>
                </div>
             </div>
           )}
        </Modal.Body>
      </Modal>

      <style>{`
        .admin-table tbody tr { transition: all 0.2s ease; cursor: pointer; }
        .admin-table tbody tr:hover { background-color: rgba(25, 135, 84, 0.03); }
        .admin-table tbody tr:hover .video-play-icon { opacity: 1; }
        .video-thumb-preview { border: 1px solid rgba(0,0,0,0.1); }
        .btn-icon { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #eee; }
        .extra-small { font-size: 0.7rem; }
        .uppercase { text-transform: uppercase; }
      `}</style>
    </DashboardLayout>
  );
};

export default VideoList;
