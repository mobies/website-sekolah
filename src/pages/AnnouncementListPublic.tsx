import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ref, query, orderByChild, limitToLast, endAt, get } from 'firebase/database';
import { rtdb as database } from '../firebase/config';
import { useTenant } from '../firebase/TenantContext';
import { Link } from 'react-router-dom';
import { Form, InputGroup, Button, Spinner } from 'react-bootstrap';
import { FaBullhorn, FaCalendarDay } from 'react-icons/fa';

interface AnnouncementIndexItem {
  id: string;
  t: string;      // lowercase title
  title: string;
  date: string;
  deleted: boolean;
}

const AnnouncementListPublic: React.FC = () => {
  const { tenantId } = useTenant();
  const [indexData, setIndexData] = useState<AnnouncementIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCursor, setLastCursor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    const indexRef = ref(database, `tenants/${tenantId}/announcement_search_index`);

    const pageSize = 3;
    const loadInitial = async () => {
      setLoading(true);
      try {
        const q = query(indexRef, orderByChild('date'), limitToLast(pageSize));
        const snap = await get(q);
        const data = snap.val();
        if (data) {
          const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
            .filter((item: AnnouncementIndexItem) => !item.deleted)
            .sort((a: AnnouncementIndexItem, b: AnnouncementIndexItem) => b.date.localeCompare(a.date));
          setIndexData(list);
          if (list.length < pageSize) setHasMore(false);
          setLastCursor(list.length ? list[list.length - 1].date : null);
        } else {
          setIndexData([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [tenantId]);

  const loadMore = useCallback(async () => {
    if (!tenantId || !hasMore || loadingMore || !lastCursor) return;
    setLoadingMore(true);
    const indexRef = ref(database, `tenants/${tenantId}/announcement_search_index`);
    const pageSize = 3;
    try {
      // Fetch older items ending at the current cursor. We request pageSize+1 and drop the duplicate cursor item.
      const q = query(indexRef, orderByChild('date'), endAt(lastCursor), limitToLast(pageSize + 1));
      const snap = await get(q);
      const data = snap.val();
      if (data) {
        let list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
          .filter((item: AnnouncementIndexItem) => !item.deleted)
          .sort((a: AnnouncementIndexItem, b: AnnouncementIndexItem) => b.date.localeCompare(a.date));

        // Remove the duplicate that equals lastCursor (the most recent of previously loaded)
        if (list.length && lastCursor) {
          list = list.filter(it => it.date !== lastCursor);
        }

        if (list.length === 0) {
          setHasMore(false);
        } else {
          setIndexData(prev => [...prev, ...list]);
          setLastCursor(list[list.length - 1].date);
          if (list.length < pageSize) setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [tenantId, hasMore, loadingMore, lastCursor]);

  useEffect(() => {
    if (searchTerm) return; // disable infinite-scroll while searching
    const onScroll = () => {
      if (!hasMore || loadingMore) return;
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 400;
      if (scrollPos >= threshold) {
        loadMore();
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasMore, loadingMore, loadMore, searchTerm]);

  const filteredResults = useMemo(() => {
    return indexData.filter(item => !searchTerm || item.t.includes(searchTerm.toLowerCase()));
  }, [indexData, searchTerm]);

  if (loading) return <div className="text-center my-5 py-5"><Spinner animation="border" variant="success" /></div>;

  return (
    <div className="container my-5">
      <div className="row justify-content-center mb-5">
        <div className="col-lg-8 text-center">
          <div className="d-flex align-items-center justify-content-center mb-4 gap-3">
            <h2 className="fw-bold mb-0">Pengumuman</h2>
          </div>
          <div className="card shadow-sm border-0 p-3 bg-white rounded-4">
            <InputGroup>
              <InputGroup.Text className="bg-transparent border-end-0"><i className="bi bi-search"></i></InputGroup.Text>
              <Form.Control className="border-start-0 shadow-none" placeholder="Cari pengumuman..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              {searchTerm && <Button variant="light" className="border-start-0" onClick={() => setSearchTerm('')}>Reset</Button>}
            </InputGroup>
          </div>
        </div>
      </div>
      <div className="row justify-content-center">
        <div className="col-lg-10">
          {filteredResults.map(item => (
              <div key={item.id} className="text-decoration-none">
                <div className="card border-0 shadow-sm rounded-4 mb-3 hover-lift">
                  <div className="card-body p-4 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center flex-grow-1">
                      <div className="bg-success bg-opacity-10 text-success rounded-circle p-3 me-4 d-none d-md-block"><FaBullhorn className="fs-4" /></div>
                      <div>
                        <Link to={`/pengumuman/${item.id}`} className="text-decoration-none">
                          <h5 className="fw-bold text-dark mb-1">{item.title}</h5>
                          <div className="d-flex align-items-center text-muted small"><FaCalendarDay className="me-1" /> {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        </Link>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 ms-3">
                      <Link to={`/pengumuman/${item.id}`} className="text-success"><i className="bi bi-chevron-right fs-4"></i></Link>
                    </div>
                  </div>
                </div>
              </div>
          ))}

          <div className="text-center my-3">
            {loadingMore && <Spinner animation="border" variant="success" />}
            {!loadingMore && !hasMore && <small className="text-muted">Tidak ada pengumuman lainnya</small>}
          </div>
        </div>
      </div>
      <style>{`.hover-lift { transition: all 0.3s ease; } .hover-lift:hover { transform: translateX(5px); box-shadow: 0 0.5rem 1.5rem rgba(0,0,0,0.08) !important; }`}</style>
    </div>
  );
};

export default AnnouncementListPublic;
