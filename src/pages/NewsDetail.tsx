import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { useEditor } from '../firebase/useEditor';
import { FaShareAlt, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { Button, Modal } from 'react-bootstrap';
import { showAlert, toast } from '../utils/alerts';
import { getDBRef, logActivity } from '../firebase/utils';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  thumbnail?: string;
  createdAt: number;
  date: string;
  category?: string;
  namaAuthor?: string;
  deleted?: boolean;
  coverObjectFit?: 'cover' | 'contain' | 'fill';
}

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { tenantId, terms } = useTenant();
  const { isEditor } = useEditor();
  const [news, setNews] = useState<NewsItem | null>(null);
  const [searchIndex, setSearchIndex] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    if (!id) {
      setLoading(false);
      setError('News ID is missing.');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch current news detail (Full data)
        const newsPath = `tenants/${tenantId}/news/${id}`;
        const snapshot = await get(ref(database, newsPath));

        if (snapshot.exists()) {
          setNews({ id, ...snapshot.val() });
        } else {
          setError(`Berita dengan ID '${id}' tidak ditemukan.`);
        }

        // 2. Fetch search index (Lite data for sidebar/footer)
        const indexSnapshot = await get(ref(database, `tenants/${tenantId}/news_search_index`));
        if (indexSnapshot.exists()) {
          setSearchIndex(indexSnapshot.val());
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Gagal mengambil data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [tenantId, id]);

  const relatedNews = useMemo(() => {
    if (!searchIndex || !news) return [];
    
    const currentCategory = (news.category || 'berita').toLowerCase();
    
    const allItems = Object.keys(searchIndex).map(key => ({
      id: key,
      ...searchIndex[key]
    })).filter(item => item.id !== news.id && !item.deleted);

    // Filter by same category
    const sameCategory = allItems
      .filter(item => (item.c || 'berita').toLowerCase() === currentCategory)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);

    // If not enough related news, fill with latest news
    if (sameCategory.length < 4) {
      const otherItems = allItems
        .filter(item => (item.c || 'berita').toLowerCase() !== currentCategory)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4 - sameCategory.length);
      
      return [...sameCategory, ...otherItems];
    }

    return sameCategory;
  }, [searchIndex, news]);

  if (loading) return <div className="text-center my-5 py-5">Memuat {terms.berita || 'Berita'}...</div>;
  if (error) return <div className="alert alert-danger text-center my-5 mx-3">{error}</div>;
  if (!news) return <div className="text-center my-5">Berita tidak ditemukan.</div>;

  const formattedDate = new Date(news.date || news.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const createSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const shareUrl = `${window.location.origin}/berita/${id}/${createSlug(news.title)}`;
  const shareText = `Baca berita: ${news.title}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: news.title,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Link berita berhasil disalin ke clipboard!');
    }
  };

  const handleEditClick = () => {
    setEditTitle(news!.title);
    setEditContent(news!.content);
    setHasChanges(false);
    setShowEditModal(true);
  };

  const handleEditChange = () => {
    setHasChanges(true);
  };

  const handleSaveEdit = async () => {
    if (!tenantId || !id || !news) return;
    setIsSaving(true);
    try {
      const updateData = {
        title: editTitle,
        content: editContent,
        updatedAt: Date.now()
      };
      
      await update(getDBRef(tenantId, `news/${id}`), updateData);
      await update(getDBRef(tenantId, `news_search_index/${id}`), { 
        t: editTitle.toLowerCase(),
        title: editTitle 
      });
      await logActivity(tenantId, { action: 'EDIT', target: 'BERITA', title: editTitle });
      
      setNews(prev => prev ? { ...prev, title: editTitle, content: editContent } : null);
      setShowEditModal(false);
      toast.fire({ icon: 'success', title: 'Berita berhasil diperbarui' });
    } catch (error: any) {
      console.error('Error saving news:', error);
      showAlert('Gagal', error.message || 'Tidak dapat menyimpan berita.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container my-5">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb flex-nowrap overflow-hidden">
          <li className="breadcrumb-item text-nowrap"><Link to="/">Beranda</Link></li>
          <li className="breadcrumb-item text-nowrap"><Link to="/berita">Daftar {terms.berita || 'Berita'}</Link></li>
          <li className="breadcrumb-item active text-truncate" aria-current="page">{news.title}</li>
        </ol>
      </nav>

      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card shadow-sm border-0 mb-5 rounded-4 overflow-hidden">
            {news.thumbnail || news.imageUrl ? (
              <img src={news.thumbnail || news.imageUrl} className="card-img-top" alt={news.title} style={{ maxHeight: '600px', objectFit: news.coverObjectFit || 'cover' }} />
            ) : null}
            <div className="card-body p-4 p-md-5">
              <div className="mb-3">
                <span className="badge bg-success-subtle text-success text-uppercase px-3 py-2 rounded-pill small fw-bold">
                  {news.category || 'Berita'}
                </span>
              </div>
              <h1 className="fw-bold mb-3 display-6 text-dark">{news.title}</h1>
              
              <div className="mb-4 pb-3 border-bottom">
                <div className="d-flex gap-2">
                  {isEditor && (
                    <Button onClick={handleEditClick} variant="warning" className="rounded-pill px-4 d-flex align-items-center gap-2 fw-bold shadow-sm">
                      <FaEdit /> Inline Edit
                    </Button>
                  )}
                  <button 
                    onClick={handleShare}
                    className="btn btn-success rounded-pill px-4 d-flex align-items-center gap-2 fw-bold shadow-sm"
                  >
                    <FaShareAlt /> Bagikan
                  </button>
                </div>
              </div>

              <div className="d-flex align-items-center text-muted mb-4 pb-3 border-bottom">
                <i className="bi bi-calendar3 me-2 text-success"></i>
                <span className="small fw-medium">{formattedDate}</span>
                <span className="small fw-semibold ms-4">oleh {news.namaAuthor || 'Admin'}</span>
              </div>
              <div 
                className="news-content" 
                style={{ lineHeight: '1.9', fontSize: '1.15rem', color: '#333' }}
                dangerouslySetInnerHTML={{ __html: news.content }} 
              />
            </div>
          </div>

          <section className="mt-5 pt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold mb-0 border-start border-4 border-success ps-3">Berita Terkait</h3>
              <Link to="/berita" className="btn btn-outline-success btn-sm rounded-pill px-4 fw-bold">
                Lihat Semua &raquo;
              </Link>
            </div>
            
            <div className="row">
              {relatedNews.length === 0 ? (
                <div className="col-12 text-center py-4 text-muted small italic">Tidak ada berita terkait lainnya.</div>
              ) : (
                relatedNews.map((item) => (
                  <div key={item.id} className="col-md-3 col-sm-6 mb-4">
                    <Link to={`/berita/${item.id}`} className="text-decoration-none text-dark h-100 d-block hover-lift">
                      <div className="card border-0 shadow-sm h-100 rounded-4 bg-white">
                        <div className="card-body p-4">
                          <div className="mb-2">
                             <span className="text-success x-small fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>{item.c || 'Berita'}</span>
                          </div>
                          <h6 className="card-title mb-2 fw-bold text-truncate-2" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{item.title}</h6>
                          <div className="mt-3 text-muted border-top pt-2" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-calendar3 me-1"></i> {new Date(item.date).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .text-truncate-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .hover-lift { transition: all 0.3s ease; }
        .hover-lift:hover { 
          transform: translateY(-5px); 
          box-shadow: 0 12px 25px rgba(0,0,0,0.12) !important;
        }
        .news-content img { max-width: 100%; height: auto; border-radius: 12px; margin: 2rem 0; box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .news-content p { margin-bottom: 1.5rem; }
        .bg-success-subtle { background-color: #e1f2e9; }
        .x-small { font-size: 0.75rem; }
        .editor-content {
          border: 2px solid #dee2e6;
          border-radius: 8px;
          padding: 16px;
          min-height: 300px;
          max-height: 500px;
          overflow-y: auto;
          line-height: 1.6;
          font-size: 1rem;
        }
        .editor-content:focus {
          outline: none;
          border-color: #198754;
          box-shadow: 0 0 0 0.2rem rgba(25, 135, 84, 0.25);
        }
      `}</style>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Inline Edit Berita</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label fw-bold">Judul</label>
            <input 
              type="text" 
              className="form-control" 
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); handleEditChange(); }}
              placeholder="Judul berita"
            />
          </div>
          <div className="mb-3">
            <label className="form-label fw-bold">Konten</label>
            <div 
              className="editor-content"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => { setEditContent(e.currentTarget.innerHTML); handleEditChange(); }}
              dangerouslySetInnerHTML={{ __html: editContent }}
            />
            <small className="text-muted d-block mt-2">Anda dapat mengedit teks langsung. HTML tags akan dipertahankan.</small>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowEditModal(false)} disabled={isSaving}>
            <FaTimes className="me-2" /> Batal
          </Button>
          {hasChanges && (
            <Button 
              variant="success" 
              onClick={handleSaveEdit} 
              disabled={isSaving}
              className="d-flex align-items-center gap-2"
            >
              {isSaving ? <span className="spinner-border spinner-border-sm me-2" /> : <FaSave className="me-2" />}
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default NewsDetail;
