import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ref, query, orderByChild, limitToLast, get, endAt, onValue, update, serverTimestamp } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { useEditor } from '../firebase/useEditor';
import { Link } from 'react-router-dom';
import ProgressiveImage from '../components/ProgressiveImage';
import { Form, Row, Col, InputGroup, Button, Spinner, Modal } from 'react-bootstrap';
import { FaPlus, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { getDBRef, logActivity, getStorageRef, uploadBytesWithCache, updateTimeStats, updateCategoryStats } from '../firebase/utils';
import { getDownloadURL } from 'firebase/storage';
import { convertToWebP } from '../firebase/imageUtils';
import { showAlert, toast } from '../utils/alerts';

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
  status?: 'published' | 'draft';
  coverObjectFit?: 'cover' | 'contain' | 'fill';
  namaAuthor?: string;
}

const PAGE_SIZE = 10;

const NewsListPublic: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const { isEditor, staffName } = useEditor();
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDate, setLastDate] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchIndex, setSearchIndex] = useState<any>(null);
  const [archiveStats, setArchiveStats] = useState<any>(null);
  const [filteredFullList, setFilteredFullList] = useState<NewsItem[]>([]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editNewsId, setEditNewsId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    title: '',
    category: 'berita',
    content: '',
    status: 'published' as 'published' | 'draft',
    date: new Date().toISOString().split('T')[0],
    coverObjectFit: 'cover' as 'cover' | 'contain' | 'fill',
  });
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [addImagePreview, setAddImagePreview] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const isAnyFilterActive = !!(searchTerm || startDate || endDate || selectedCategory);

  const fetchNews = useCallback(async (isInitial = false) => {
    if (!tenantId) return;
    if (!isInitial && (!hasMore || loadingMore)) return;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const baseRef = ref(database, `tenants/${tenantId}/news`);
      const newsQuery = isInitial
        ? query(baseRef, orderByChild('date'), limitToLast(PAGE_SIZE))
        : query(baseRef, orderByChild('date'), endAt(lastDate!), limitToLast(PAGE_SIZE + 1));

      const snapshot = await get(newsQuery);
      const data = snapshot.val();
      
      if (data) {
        let loadedItems: NewsItem[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(item => !item.deleted && item.status === 'published')
          .sort((a, b) => b.date.localeCompare(a.date));

        if (!isInitial && lastDate) {
          loadedItems = loadedItems.filter(item => item.date < lastDate);
        }
        
        if (loadedItems.length === 0) {
          setHasMore(false);
        } else {
          setNewsList(prev => isInitial ? loadedItems : [...prev, ...loadedItems]);
          setLastDate(loadedItems[loadedItems.length - 1].date);
          if (loadedItems.length < PAGE_SIZE) setHasMore(false);
        }
      } else {
        setHasMore(false);
        if (isInitial) setNewsList([]);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantId, hasMore, loadingMore, lastDate]);

  useEffect(() => { fetchNews(true); }, [tenantId]);

  useEffect(() => {
    if (tenantId && isAnyFilterActive && !searchIndex) {
      get(ref(database, `tenants/${tenantId}/news_search_index`)).then(snap => setSearchIndex(snap.val() || {}));
    }
  }, [tenantId, isAnyFilterActive, searchIndex]);

  useEffect(() => {
    if (!tenantId) return;
    onValue(ref(database, `tenants/${tenantId}/stats/news`), snap => {
      setArchiveStats(snap.val());
    });
  }, [tenantId]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !isAnyFilterActive) {
        fetchNews();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchNews, isAnyFilterActive]);

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

  // When filters are active, ensure we have full news items (with image urls)
  useEffect(() => {
    if (!isAnyFilterActive) return;
    let cancelled = false;

    const loadFullItems = async () => {
      if (!tenantId) return;
      const promises = filteredResults.map(async (idxItem: any) => {
        // Try to find in already loaded newsList first
        const existing = newsList.find(n => n.id === idxItem.id);
        if (existing) return existing;
        try {
          const snap = await get(ref(database, `tenants/${tenantId}/news/${idxItem.id}`));
          if (snap.exists()) return { id: idxItem.id, ...snap.val() } as NewsItem;
        } catch (err) {
          console.error('Error fetching news item for filter:', err);
        }
        // Fallback to index item shape
        return { id: idxItem.id, title: idxItem.title || '', content: idxItem.content || '', imageUrl: idxItem.imageUrl, thumbnail: idxItem.thumbnail, date: idxItem.date } as NewsItem;
      });

      const results = await Promise.all(promises);
      if (!cancelled) setFilteredFullList(results as NewsItem[]);
    };

    loadFullItems();
    return () => { cancelled = true; };
  }, [filteredResults, isAnyFilterActive, tenantId, newsList]);

  const handleEditClick = async (itemId: string) => {
    if (!tenantId) return;
    try {
      const snapshot = await get(ref(database, `tenants/${tenantId}/news/${itemId}`));
      if (snapshot.exists()) {
        const item = snapshot.val();
        setEditNewsId(itemId);
        setEditTitle(item.title || '');
        setEditContent(item.content || '');
        setHasChanges(false);
        setShowEditModal(true);
      } else {
        showAlert('Error', 'Data berita tidak ditemukan.', 'error');
      }
    } catch (error) {
      console.error('Error fetching news detail:', error);
      showAlert('Gagal', 'Gagal memuat detail berita.', 'error');
    }
  };
  const handleAddImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAddImageFile(file);
      setAddImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddReset = () => {
    setAddFormData({
      title: '',
      category: 'berita',
      content: '',
      status: 'published',
      date: new Date().toISOString().split('T')[0],
      coverObjectFit: 'cover',
    });
    setAddImageFile(null);
    setAddImagePreview(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setIsAdding(true);
    try {
      let thumbnailUrl = '';
      if (addImageFile) {
        const webpBlob = await convertToWebP(addImageFile, { maxSizeBytes: 100 * 1024 });
        const fileName = `${Date.now()}_news.webp`;
        const fileRef = getStorageRef(tenantId, `news/${fileName}`);
        await uploadBytesWithCache(fileRef, webpBlob);
        thumbnailUrl = await getDownloadURL(fileRef);
      }

      const createdAt = Date.now();
      const newsData = {
        ...addFormData,
        thumbnail: thumbnailUrl,
        imageUrl: thumbnailUrl,
        namaAuthor: staffName || 'Administrator',
        updatedAt: serverTimestamp(),
        createdAt,
        year: new Date(addFormData.date).getFullYear(),
        month: new Date(addFormData.date).getMonth() + 1,
        day: new Date(addFormData.date).getDate(),
        deleted: false,
        status: addFormData.status,
      };
      const timestampId = Date.now().toString();
      const searchIndexData = {
        t: addFormData.title.toLowerCase(),
        title: addFormData.title,
        date: addFormData.date,
        c: addFormData.category,
        img: thumbnailUrl,
        deleted: false,
      };
      const updates: any = {};
      updates[`tenants/${tenantId}/news/${timestampId}`] = newsData;
      updates[`tenants/${tenantId}/news_search_index/${timestampId}`] = searchIndexData;

      await updateTimeStats(tenantId, 'news', addFormData.date, 1);
      await updateCategoryStats(tenantId, 'news', addFormData.category, 1);
      await logActivity(tenantId, { action: 'TAMBAH', target: 'BERITA', title: addFormData.title });
      await update(ref(database), updates);

      setNewsList(prev => [{ id: timestampId, ...newsData }, ...prev]);
      if (searchIndex) {
        setSearchIndex((prev: any) => ({
          ...prev,
          [timestampId]: searchIndexData,
        }));
      }

      toast.fire({ icon: 'success', title: 'Berita baru berhasil ditambahkan' });
      setShowAddModal(false);
      handleAddReset();
    } catch (error: any) {
      console.error('Error adding news:', error);
      showAlert('Gagal', error.message || 'Gagal menambahkan berita.', 'error');
    } finally {
      setIsAdding(false);
    }
  };
  const handleEditChange = () => {
    setHasChanges(true);
  };

  const handleSaveEdit = async () => {
    if (!tenantId || !editNewsId) return;
    setIsSaving(true);
    try {
      const updateData = {
        title: editTitle,
        content: editContent,
        updatedAt: Date.now()
      };
      
      await update(getDBRef(tenantId, `news/${editNewsId}`), updateData);
      await update(getDBRef(tenantId, `news_search_index/${editNewsId}`), { 
        t: editTitle.toLowerCase(),
        title: editTitle 
      });
      await logActivity(tenantId, { action: 'EDIT', target: 'BERITA', title: editTitle });
      
      // Update local states
      setNewsList(prev => prev.map(item => item.id === editNewsId ? { ...item, title: editTitle, content: editContent } : item));
      
      if (searchIndex) {
        setSearchIndex((prev: any) => {
          if (!prev || !prev[editNewsId]) return prev;
          return {
            ...prev,
            [editNewsId]: {
              ...prev[editNewsId],
              t: editTitle.toLowerCase(),
              title: editTitle
            }
          };
        });
      }
      
      setShowEditModal(false);
      toast.fire({ icon: 'success', title: 'Berita berhasil diperbarui' });
    } catch (error: any) {
      console.error('Error saving news:', error);
      showAlert('Gagal', error.message || 'Tidak dapat menyimpan berita.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;
  
  const displayList = isAnyFilterActive ? filteredFullList : newsList;

  return (
    <div className="container my-5">
      <div className="row">
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="fw-bold mb-0">Daftar {terms.berita || 'Berita'}</h2>
            <div className="d-flex gap-2">
              {isEditor && (
                <Button onClick={() => setShowAddModal(true)} variant="success" className="rounded-pill fw-bold px-4 shadow-sm" size="sm">
                  <FaPlus className="me-2" /> Tambah {terms.berita || 'Berita'}
                </Button>
              )}
              {isAnyFilterActive && (
                <Button variant="link" className="text-success p-0 text-decoration-none" onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setSelectedCategory(''); }}>
                  <i className="bi bi-x-circle me-1"></i> Reset Filter
                </Button>
              )}
            </div>
          </div>

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

          <div className="news-list">
            {displayList.length === 0 ? (
                <div className="text-center py-5 text-muted card border-0 bg-light rounded-4">
                  <i className="bi bi-search-heart display-4 mb-3 opacity-25"></i>
                  <p>Tidak ada berita yang cocok.</p>
                </div>
              ) : (
                displayList.map((item) => (
                  <div key={item.id} className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 hover-lift">
                    <div className="row g-0">
                      <div className="col-md-4">
                        <Link to={`/berita/${item.id}`} style={{ height: '100%', display: 'block' }}>
                          <ProgressiveImage 
                              src={item.thumbnail || item.imageUrl || 'https://images.unsplash.com/photo-1585829365234-781f8c484dca?q=80&w=400&h=250&fit=crop'} 
                              alt={item.title} 
                              className="w-100 h-100" 
                              style={{ objectFit: item.coverObjectFit || 'cover', minHeight: '180px' }} 
                            />
                        </Link>
                      </div>
                      <div className="col-md-8">
                        <div className="card-body d-flex flex-column h-100 p-4">
                          <div className="mb-2">
                             <span className="badge bg-success-subtle text-success x-small text-uppercase">{item.category || item.c || 'Berita'}</span>
                          </div>
                          <h5 className="card-title fw-bold mb-2">
                            <Link to={`/berita/${item.id}`} className="text-dark text-decoration-none">{item.title}</Link>
                          </h5>
                          <p className="text-muted small mb-3 flex-grow-1 text-truncate-2">
                            {item.content?.replace(/<[^>]*>?/gm, '') || ''}
                          </p>
                          <div className="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
                            <small className="text-muted">
                              <i className="bi bi-calendar3 me-1"></i> {new Date(item.date || item.createdAt).toLocaleDateString('id-ID')}
                              <span className="fw-semibold ms-3">oleh {item.namaAuthor || 'Admin'}</span>
                            </small>
                            <div className="d-flex gap-2">
                              {isEditor && (
                                <Button onClick={() => void handleEditClick(item.id)} size="sm" variant="outline-warning" className="rounded-pill px-3">
                                  <FaEdit className="me-1" /> Edit
                                </Button>
                              )}
                              <Link to={`/berita/${item.id}`} className="btn btn-sm btn-success rounded-pill px-4">Baca &raquo;</Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}
            {!isAnyFilterActive && loadingMore && <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>}
            {!isAnyFilterActive && !hasMore && newsList.length > 0 && <div className="text-center py-4 text-muted small italic">Semua berita telah ditampilkan.</div>}
          </div>
        </div>

        <div className="col-lg-4 ps-lg-5">
          <div className="sticky-top" style={{ top: '2rem', zIndex: 0 }}>
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white" style={{ zIndex: 0 }}>
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

      <Modal show={showAddModal} onHide={() => { setShowAddModal(false); handleAddReset(); }} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Tambah Berita</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Judul Berita</Form.Label>
                  <Form.Control
                    type="text"
                    value={addFormData.title}
                    onChange={e => setAddFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Kategori</Form.Label>
                  <Form.Select
                    value={addFormData.category}
                    onChange={e => setAddFormData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="berita">Berita Umum</option>
                    <option value="prestasi">Prestasi</option>
                    <option value="kegiatan">Kegiatan</option>
                    <option value="opini">Opini/Artikel</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Tanggal</Form.Label>
                  <Form.Control
                    type="date"
                    value={addFormData.date}
                    onChange={e => setAddFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={addFormData.status}
                    onChange={e => setAddFormData(prev => ({ ...prev, status: e.target.value as 'published' | 'draft' }))}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Pengaturan Cover</Form.Label>
                  <Form.Select
                    value={addFormData.coverObjectFit}
                    onChange={e => setAddFormData(prev => ({ ...prev, coverObjectFit: e.target.value as 'cover' | 'contain' | 'fill' }))}
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="fill">Fill</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Konten</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    value={addFormData.content}
                    onChange={e => setAddFormData(prev => ({ ...prev, content: e.target.value }))}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Gambar Sampul (opsional)</Form.Label>
                  <Form.Control type="file" accept="image/*" onChange={handleAddImageChange} />
                  {addImagePreview && (
                    <div className="mt-3">
                      <img src={addImagePreview} alt="Preview" className="img-fluid rounded" />
                    </div>
                  )}
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowAddModal(false); handleAddReset(); }}>
              <FaTimes className="me-1" /> Batal
            </Button>
            <Button type="submit" variant="success" disabled={isAdding}>
              <FaSave className="me-1" /> {isAdding ? 'Menyimpan...' : 'Simpan Berita'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

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

      <style>{`
        .hover-lift { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .hover-lift:hover { transform: translateY(-5px); box-shadow: 0 1rem 3rem rgba(0,0,0,0.1) !important; }
        .hover-scale { transition: transform 0.2s; }
        .hover-scale:hover { transform: scale(1.05); }
        .card-row:hover { background: #f8f9fa; }
        .bg-success-subtle { background-color: #e1f2e9; }
        .x-small { font-size: 0.7rem; }
        .text-truncate-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
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
    </div>
  );
};

export default NewsListPublic;
