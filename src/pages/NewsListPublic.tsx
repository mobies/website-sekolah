import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ref, query, orderByChild, limitToLast, get, endAt, onValue } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { Link } from 'react-router-dom';
import ProgressiveImage from '../components/ProgressiveImage';
import { Form, Row, Col, InputGroup, Button, Spinner } from 'react-bootstrap';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  thumbnail?: string;
  createdAt: number;
  date: string;
  c?: string; // Category code from index
  category?: string; // Full data
  deleted?: boolean;
}

const PAGE_SIZE = 4;

const NewsListPublic: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDate, setLastDate] = useState<string | null>(null);
  
  // Search & Archive states
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchIndex, setSearchIndex] = useState<any>(null);
  const [archiveStats, setArchiveStats] = useState<any>(null);

  // 1. Initial Load & Pagination Logic
  const fetchNews = useCallback(async (isInitial = false) => {
    if (!tenantId) return;
    if (!isInitial && (!hasMore || loadingMore)) return;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      let newsQuery;
      const baseRef = ref(database, `tenants/${tenantId}/news`);
      
      if (isInitial) {
        newsQuery = query(baseRef, orderByChild('date'), limitToLast(PAGE_SIZE));
      } else {
        newsQuery = query(baseRef, orderByChild('date'), endAt(lastDate!), limitToLast(PAGE_SIZE + 1));
      }

      const snapshot = await get(newsQuery);
      const data = snapshot.val();
      
      if (data) {
        let loadedItems: NewsItem[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted)
          .sort((a, b) => b.date.localeCompare(a.date));

        if (!isInitial) {
          loadedItems = loadedItems.filter(item => item.date <= lastDate! && !newsList.find(existing => existing.id === item.id));
        }

        if (loadedItems.length === 0) {
          setHasMore(false);
        } else {
          if (isInitial) setNewsList(loadedItems);
          else setNewsList(prev => [...prev, ...loadedItems]);
          
          setLastDate(loadedItems[loadedItems.length - 1].date);
          if (loadedItems.length < PAGE_SIZE) setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantId, hasMore, loadingMore, lastDate, newsList]);

  useEffect(() => { fetchNews(true); }, [tenantId]);

  // 2. Search Index Loader
  useEffect(() => {
    if (tenantId && (searchTerm || startDate || endDate || selectedCategory) && !searchIndex) {
      get(ref(database, `tenants/${tenantId}/news_search_index`)).then(snap => setSearchIndex(snap.val() || {}));
    }
  }, [searchTerm, startDate, endDate, selectedCategory, tenantId, searchIndex]);

  // 3. Archive & Category Stats Loader
  useEffect(() => {
    if (!tenantId) return;
    onValue(ref(database, `tenants/${tenantId}/stats/news`), snap => {
      setArchiveStats(snap.val());
    });
  }, [tenantId]);

  // 4. Infinite Scroll Handler
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !searchTerm && !startDate && !endDate && !selectedCategory) {
        fetchNews();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchNews, searchTerm, startDate, endDate, selectedCategory]);

  const filteredResults = useMemo(() => {
    if (!searchIndex) return [];
    return Object.keys(searchIndex)
      .map(id => ({ id, ...searchIndex[id] }))
      .filter(item => {
        const matchTitle = !searchTerm || item.t.includes(searchTerm.toLowerCase());
        const matchStart = !startDate || item.date >= startDate;
        const matchEnd = !endDate || item.date <= endDate;
        const matchCat = !selectedCategory || item.c === selectedCategory;
        return !item.deleted && matchTitle && matchStart && matchEnd && matchCat;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [searchIndex, searchTerm, startDate, endDate, selectedCategory]);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;

  const isAnyFilterActive = !!(searchTerm || startDate || endDate || selectedCategory);

  return (
    <div className="container my-5">
      <div className="row">
        {/* KOLOM KIRI: DAFTAR BERITA */}
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="fw-bold mb-0">Daftar {terms.berita || 'Berita'}</h2>
            {isAnyFilterActive && (
              <Button variant="link" className="text-success p-0 text-decoration-none" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setSelectedCategory(''); }}>
                <i className="bi bi-x-circle me-1"></i> Reset Filter
              </Button>
            )}
          </div>

          {/* Search Bar - Expanded for Category */}
          <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-light">
            <Row className="g-2">
              <Col md={12}>
                <InputGroup size="sm" className="mb-2">
                  <InputGroup.Text className="bg-white border-end-0"><i className="bi bi-search"></i></InputGroup.Text>
                  <Form.Control className="border-start-0 shadow-none" placeholder={`Cari ${terms.berita}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  {searchTerm && (
                    <Button variant="outline-secondary" className="border-start-0" onClick={() => setSearchTerm('')}>
                      <i className="bi bi-x"></i>
                    </Button>
                  )}
                </InputGroup>
              </Col>
              <Col md={4}>
                <Form.Select size="sm" className="shadow-none" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                  <option value="">Semua Kategori</option>
                  <option value="berita">Berita Umum</option>
                  <option value="prestasi">Prestasi</option>
                  <option value="kegiatan">Kegiatan</option>
                  <option value="opini">Opini/Artikel</option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-white small border-end-0 text-muted">Dari</InputGroup.Text>
                  <Form.Control type="date" className="border-start-0 shadow-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </InputGroup>
              </Col>
              <Col md={4}>
                <InputGroup size="sm">
                  <InputGroup.Text className="bg-white small border-end-0 text-muted">Hingga</InputGroup.Text>
                  <Form.Control type="date" className="border-start-0 shadow-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </InputGroup>
              </Col>
            </Row>
          </div>

          {/* Content Area */}
          <div className="news-list">
            {isAnyFilterActive ? (
              filteredResults.length === 0 ? (
                <div className="text-center py-5 text-muted card border-0 bg-light rounded-4">
                  <i className="bi bi-search-heart display-4 mb-3 opacity-25"></i>
                  <p>Tidak ada berita yang cocok dengan filter tersebut.</p>
                </div>
              ) : (
                filteredResults.map(item => (
                  <Link key={item.id} to={`/berita/${item.id}`} className="text-decoration-none text-dark mb-3 d-block card-row">
                    <div className="card border-0 shadow-sm rounded-3 p-3 h-100 hover-lift d-flex flex-row justify-content-between align-items-center">
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="badge bg-success-subtle text-success x-small text-uppercase">{item.c || 'Berita'}</span>
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(item.date).toLocaleDateString('id-ID')}</small>
                        </div>
                        <h6 className="fw-bold mb-0">{item.title}</h6>
                      </div>
                      <i className="bi bi-chevron-right text-success opacity-50"></i>
                    </div>
                  </Link>
                ))
              )
            ) : (
              <>
                {newsList.map((news) => (
                  <div key={news.id} className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 hover-lift">
                    <div className="row g-0">
                      <div className="col-md-4">
                        <div style={{ height: '180px' }}>
                          <ProgressiveImage src={news.thumbnail || news.imageUrl || 'https://images.unsplash.com/photo-1585829365234-781f8c484dca?q=80&w=400&h=250&fit=crop'} alt={news.title} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                        </div>
                      </div>
                      <div className="col-md-8">
                        <div className="card-body d-flex flex-column h-100 p-4">
                          <div className="mb-2">
                             <span className="badge bg-success-subtle text-success x-small text-uppercase">{news.category || 'Berita'}</span>
                          </div>
                          <h4 className="card-title fw-bold mb-2">{news.title}</h4>
                          <p className="text-muted small mb-3 flex-grow-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {news.content.replace(/<[^>]*>?/gm, '')}
                          </p>
                          <div className="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
                            <small className="text-muted"><i className="bi bi-calendar3 me-1"></i> {new Date(news.date || news.createdAt).toLocaleDateString('id-ID')}</small>
                            <Link to={`/berita/${news.id}`} className="btn btn-sm btn-success rounded-pill px-4">Baca &raquo;</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
                {!hasMore && newsList.length > 0 && <div className="text-center py-4 text-muted small italic">Semua berita telah ditampilkan.</div>}
              </>
            )}
          </div>
        </div>

        {/* KOLOM KANAN: SIDEBAR ARSIP & KATEGORI */}
        <div className="col-lg-4 ps-lg-5">
          <div className="sticky-top" style={{ top: '2rem' }}>
            {/* KATEGORI FILTER */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
              <h5 className="fw-bold mb-4 border-start border-4 border-success ps-3">Kategori</h5>
              <div className="list-group list-group-flush">
                {[
                  { id: 'berita', label: 'Berita Umum' },
                  { id: 'prestasi', label: 'Prestasi' },
                  { id: 'kegiatan', label: 'Kegiatan' },
                  { id: 'opini', label: 'Opini/Artikel' }
                ].map(cat => {
                  const count = archiveStats?.categories?.[cat.id] || 0;
                  return (
                    <button key={cat.id} 
                      className={`list-group-item list-group-item-action border-0 d-flex justify-content-between align-items-center px-0 py-2 ${selectedCategory === cat.id ? 'text-success fw-bold' : ''}`}
                      onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}>
                      <span>{cat.label}</span>
                      <span className="badge bg-light text-dark rounded-pill">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ARSIP BERITA */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
              <h5 className="fw-bold mb-4 border-start border-4 border-success ps-3">Arsip Berita</h5>
              {archiveStats?.years ? (
                Object.keys(archiveStats.years).sort((a, b) => b.localeCompare(a)).map(year => (
                  <div key={year} className="mb-4">
                    <h6 className="fw-bold text-success mb-2">{year}</h6>
                    <div className="d-flex flex-wrap gap-2">
                      {Object.keys(archiveStats.years[year].months).sort((a, b) => b.localeCompare(a)).map(month => (
                        <button key={month} className="btn btn-light btn-sm rounded-pill border-0 px-3 hover-scale" 
                          onClick={() => {
                            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                            setStartDate(`${year}-${month}-01`);
                            setEndDate(`${year}-${month}-${lastDay}`);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}>
                          {monthNames[parseInt(month) - 1]} <span className="text-muted small">({archiveStats.years[year].months[month].total})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted small">Belum ada arsip tersedia.</div>
              )}
            </div>
            
            <div className="card border-0 rounded-4 p-4 bg-success text-white">
              <h6 className="fw-bold mb-2">Pencarian Pintar</h6>
              <p className="small mb-0 opacity-75">Sistem menggunakan teknologi indexing untuk memastikan pencarian kategori dan tanggal tetap cepat dan hemat data.</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hover-lift { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 1rem 3rem rgba(0,0,0,0.1) !important; }
        .hover-scale { transition: transform 0.2s; }
        .hover-scale:hover { transform: scale(1.05); }
        .card-row:hover { background: #f8f9fa; }
        .bg-success-subtle { background-color: #e1f2e9; }
        .x-small { font-size: 0.7rem; }
      `}</style>
    </div>
  );
};

export default NewsListPublic;
