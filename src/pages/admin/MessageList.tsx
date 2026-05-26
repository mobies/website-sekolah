import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Card, Button, Table, Spinner, Badge, Modal, Form } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import { FaTrash, FaReply, FaPaperPlane } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, logActivity } from '../../firebase/utils';
import { update, ref, query, orderByChild, limitToLast, endAt, get, remove } from 'firebase/database';
import { rtdb as database } from '../../firebase/config';
import { showConfirm, toast, showAlert } from '../../utils/alerts';

interface Message {
  id: string;
  uid: string;
  authEmail: string;
  authName: string;
  inputName: string;
  subject: string;
  message: string;
  createdAt: number;
  isRead: boolean;
  reply?: string;
}

const PAGE_SIZE = 20;

const MessageList: React.FC = () => {
  const { tenantId } = useTenant();
  const location = useLocation();
  const q = new URLSearchParams(location.search).get('q') || '';
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);

  // Reply Modal State
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!tenantId || (!isInitial && !hasMore) || loadingMore) return;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const msgRef = ref(database, `tenants/${tenantId}/messages`);
      let msgQuery;

      if (isInitial) {
        msgQuery = query(msgRef, orderByChild('createdAt'), limitToLast(PAGE_SIZE));
      } else {
        msgQuery = query(msgRef, orderByChild('createdAt'), endAt(lastTimestamp! - 1), limitToLast(PAGE_SIZE));
      }

      const snapshot = await get(msgQuery);
      const data = snapshot.val();

      if (data) {
        const items: Message[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => b.createdAt - a.createdAt);

        if (items.length < PAGE_SIZE) setHasMore(false);

        if (items.length > 0) {
          setLastTimestamp(items[items.length - 1].createdAt);
          setMessages(prev => isInitial ? items : [...prev, ...items]);
        } else if (isInitial) {
          setMessages([]);
        }
      } else {
        setHasMore(false);
        if (isInitial) setMessages([]);
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
    fetchMessages(true);
  }, [tenantId]);

  // Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !q && !loading && !loadingMore) {
        fetchMessages();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchMessages, q, loading, loadingMore]);

  const displayMessages = useMemo(() => {
    if (!q) return messages;
    return messages.filter(m => 
      m.inputName.toLowerCase().includes(q.toLowerCase()) || 
      m.authEmail.toLowerCase().includes(q.toLowerCase()) ||
      m.subject.toLowerCase().includes(q.toLowerCase())
    );
  }, [messages, q]);

  const markAsRead = async (msg: Message) => {
    if (!tenantId || msg.isRead) return;
    try {
      await update(getDBRef(tenantId, `messages/${msg.id}`), { isRead: true });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
    } catch (error) { console.error(error); }
  };

  const openReply = (msg: Message) => {
    setSelectedMsg(msg);
    setReplyText(msg.reply || '');
    setShowReplyModal(true);
    markAsRead(msg);
  };

  const submitReply = async () => {
    if (!tenantId || !selectedMsg || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await update(getDBRef(tenantId, `messages/${selectedMsg.id}`), { 
        reply: replyText,
        isRead: true 
      });
      setMessages(prev => prev.map(m => m.id === selectedMsg.id ? { ...m, reply: replyText, isRead: true } : m));
      toast.fire({ icon: 'success', title: 'Balasan terkirim' });
      setShowReplyModal(false);
      await logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: `Membalas pesan: ${selectedMsg.subject}` });
    } catch (error) {
      showAlert('Gagal', 'Terjadi kesalahan.', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const deleteMessage = async (msg: Message) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Pesan?', 'Pesan ini akan dihapus permanen.')).isConfirmed) {
       try {
          await remove(getDBRef(tenantId, `messages/${msg.id}`));
          setMessages(prev => prev.filter(m => m.id !== msg.id));
          toast.fire({ icon: 'success', title: 'Pesan dihapus' });
       } catch (error) { showAlert('Gagal', 'Terjadi kesalahan.', 'error'); }
    }
  };

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="mb-4">
           <h4 className="fw-bold text-dark mb-1">Pesan Pengunjung</h4>
           <p className="text-muted small mb-0">Kelola masukan dan pertanyaan dari halaman kontak publik.</p>
        </div>

        <Card className="border-0 shadow-sm rounded-4 overflow-hidden">
          <Card.Body className="p-0">
            <Table hover responsive className="mb-0 align-middle admin-table">
              <thead className="bg-light text-muted uppercase extra-small fw-bold">
                <tr>
                  <th className="ps-4 py-3 border-0">PENGIRIM</th>
                  <th className="py-3 border-0">SUBJEK & PESAN</th>
                  <th className="py-3 border-0">STATUS</th>
                  <th className="py-3 border-0 pe-4 text-end">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-5"><Spinner animation="border" variant="success" size="sm" /></td></tr>
                ) : displayMessages.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-5 small text-muted border-0">Tidak ada pesan ditemukan.</td></tr>
                ) : (
                  displayMessages.map(item => (
                    <tr key={item.id} className={!item.isRead ? 'bg-success bg-opacity-10 fw-bold' : ''}>
                      <td className="ps-4 py-3">
                         <div className="small text-dark">{item.inputName}</div>
                         <div className="extra-small text-muted">{item.authEmail}</div>
                      </td>
                      <td className="py-3">
                         <div className="small text-dark text-truncate" style={{maxWidth: '250px'}}>{item.subject}</div>
                         <div className="extra-small text-muted text-truncate" style={{maxWidth: '250px'}}>{item.message}</div>
                      </td>
                      <td className="py-3">
                         {item.reply ? (
                           <Badge bg="success" className="rounded-pill px-2">Dibalas</Badge>
                         ) : item.isRead ? (
                           <Badge bg="light" className="text-dark rounded-pill px-2 border">Dibaca</Badge>
                         ) : (
                           <Badge bg="primary" className="rounded-pill px-2 shadow-sm">Baru</Badge>
                         )}
                         <div className="extra-small text-muted mt-1">{new Date(item.createdAt).toLocaleDateString('id-ID')}</div>
                      </td>
                      <td className="pe-4 py-3 text-end">
                        <div className="d-flex justify-content-end gap-2">
                           <Button onClick={() => openReply(item)} variant="light" size="sm" className="btn-icon text-success" title="Balas"><FaReply size={14} /></Button>
                           <Button onClick={() => deleteMessage(item)} variant="light" size="sm" className="btn-icon text-danger" title="Hapus"><FaTrash size={14} /></Button>
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
        {!hasMore && displayMessages.length > 0 && !q && <div className="text-center py-4 text-muted small italic">Semua pesan telah ditampilkan.</div>}
      </Container>

      {/* Reply Modal */}
      <Modal show={showReplyModal} onHide={() => setShowReplyModal(false)} centered rounded-4 shadow>
        <Modal.Header closeButton className="border-0 pt-4 px-4">
           <Modal.Title className="fw-bold h5">Balas Pesan</Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 pb-4">
           {selectedMsg && (
             <div className="mb-4 p-3 bg-light rounded-3 border">
                <div className="extra-small text-success fw-bold text-uppercase mb-1">Pesan dari {selectedMsg.inputName}:</div>
                <div className="small text-dark italic">"{selectedMsg.message}"</div>
             </div>
           )}
           <Form.Group className="mb-0">
              <Form.Label className="extra-small fw-bold text-muted text-uppercase">Tulis Balasan</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={5} 
                className="bg-white shadow-none border" 
                placeholder="Ketik jawaban atau tanggapan Anda..." 
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
              />
              <Form.Text className="extra-small text-muted">Balasan akan langsung tampil di halaman kontak pengirim.</Form.Text>
           </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0 px-4 pb-4">
           <Button variant="light" onClick={() => setShowReplyModal(false)} className="rounded-pill px-4 fw-bold">Batal</Button>
           <Button variant="success" onClick={submitReply} disabled={sendingReply} className="rounded-pill px-4 fw-bold shadow-sm">
              {sendingReply ? <Spinner size="sm" /> : <FaPaperPlane className="me-2" />} Kirim Balasan
           </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .admin-table tbody tr { transition: all 0.2s; }
        .btn-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 8px; border: 1px solid #eee; }
        .extra-small { font-size: 0.65rem; }
        .uppercase { text-transform: uppercase; }
        .italic { font-style: italic; }
      `}</style>
    </DashboardLayout>
  );
};

export default MessageList;
