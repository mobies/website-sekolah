import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Breadcrumb, Spinner, Form, Button, Badge, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue, push, update, serverTimestamp, get, query, orderByChild, limitToLast } from 'firebase/database';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaPaperPlane, FaLock, FaExclamationCircle, FaHistory, FaCheckCircle, FaReply } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { showAlert, toast } from '../utils/alerts';
import { auth } from '../firebase/config';
import { onAuthStateChanged, type User } from 'firebase/auth';

// Fix default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ContactData {
  phone: string;
  email: string;
  address: string;
  lat: string;
  lng: string;
}

interface UserMessage {
  id: string;
  uid: string;
  subject: string;
  message: string;
  createdAt: number;
  isRead: boolean;
  reply?: string;
  inputName: string;
}

const Contact: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [contactInfo, setContactInfo] = useState<ContactData | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    hp: '' // Honeypot
  });
  const [sending, setSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  
  // History State
  const [myMessages, setMyMessages] = useState<UserMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && tenantId) {
        setFormData(prev => ({
          ...prev,
          name: currentUser.displayName || '',
          email: currentUser.email || ''
        }));

        // 1. Check last sent message meta
        const metaRef = getDBRef(tenantId, `user_message_meta/${currentUser.uid}`);
        get(metaRef).then(snap => {
          if (snap.exists()) setLastSentAt(snap.val().lastSentAt);
        });

        // 2. Fetch Message History (Optimized with denormalized data)
        setLoadingHistory(true);
        const userMessagesRef = getDBRef(tenantId, `user_messages/${currentUser.uid}`);
        const historyQuery = query(userMessagesRef, orderByChild('createdAt'), limitToLast(3));
        
        onValue(historyQuery, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const list = Object.keys(data).map(key => ({
              id: key,
              ...data[key]
            })).sort((a, b) => b.createdAt - a.createdAt);
            setMyMessages(list);
          } else {
            setMyMessages([]);
          }
          setLoadingHistory(false);
        });
      } else {
        setLastSentAt(null);
        setMyMessages([]);
      }
    });
    return () => unsubAuth();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = onValue(getDBRef(tenantId, 'settings'), (snap) => {
      const data = snap.val();
      if (data) {
        setContactInfo(data.contact || null);
        setSchoolName(data.schoolName || '');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  const canSendMessage = () => {
    if (!lastSentAt) return true;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (now - lastSentAt) > twentyFourHours;
  };

  const getRemainingTime = () => {
    if (!lastSentAt) return '';
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const remaining = twentyFourHours - (now - lastSentAt);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours} jam ${minutes} menit lagi`;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !user) return;
    if (!canSendMessage()) {
      showAlert('Limit Pengiriman', `Anda sudah mengirim pesan hari ini. Silakan coba kembali dalam ${getRemainingTime()}.`, 'info');
      return;
    }
    if (formData.hp) return; // Honeypot check

    setSending(true);
    try {
      const msgRef = push(getDBRef(tenantId, 'messages'));
      if (!msgRef.key) {
        console.error("Failed to generate a new message key.");
        throw new Error("Message key generation failed.");
      }
      const timestamp = Date.now();
      
      const messageData = {
        uid: user.uid,
        authEmail: user.email,
        authName: user.displayName,
        inputName: formData.name,
        subject: formData.subject || 'Pesan dari Form Kontak',
        message: formData.message,
        createdAt: serverTimestamp(),
        isRead: false
      };

      // Denormalization: Write to both paths
      const updates: { [key: string]: any } = {};
      
      const userMessageData = { ...messageData, createdAt: timestamp };

      updates[`/messages/${msgRef.key}`] = messageData;
      updates[`/user_messages/${user.uid}/${msgRef.key}`] = userMessageData;
      
      await update(getDBRef(tenantId), updates);

      // Update user meta
      await update(getDBRef(tenantId, `user_message_meta/${user.uid}`), {
        lastSentAt: timestamp,
        email: user.email
      });

      setLastSentAt(timestamp);
      toast.fire({ icon: 'success', title: 'Pesan Anda telah terkirim!' });
      setFormData(prev => ({ ...prev, subject: '', message: '', hp: '' }));
    } catch (error) {
      console.error("Detailed error on message submission:", error);
      showAlert('Gagal', 'Terjadi kesalahan. Silakan cek console untuk detail.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-center py-5 min-vh-100 d-flex align-items-center justify-content-center"><Spinner animation="border" variant="success" /></div>;

  const position: L.LatLngExpression | undefined = 
    contactInfo && contactInfo.lat && contactInfo.lng 
      ? [parseFloat(contactInfo.lat), parseFloat(contactInfo.lng)] 
      : undefined;

  const isLocked = !user || !canSendMessage();

  return (
    <div className="bg-light min-vh-100">
      <section className="py-5 bg-white border-bottom text-center text-md-start">
        <Container>
          <Breadcrumb className="mb-4 justify-content-center justify-content-md-start">
            <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>Beranda</Breadcrumb.Item>
            <Breadcrumb.Item active>Kontak</Breadcrumb.Item>
          </Breadcrumb>
          <h1 className="display-5 fw-bold text-dark mb-2">Hubungi Kami</h1>
          <p className="lead text-muted mb-0">Kami siap membantu menjawab pertanyaan Anda seputar {terms.school}.</p>
        </Container>
      </section>

      <Container className="py-5">
        <Row className="g-4">
          <Col lg={4}>
            <div className="d-flex flex-column gap-4">
               <Card className="border-0 shadow-sm rounded-4 p-4 bg-white">
                  <h5 className="fw-bold mb-4 border-start border-4 border-success ps-3">Info Kontak</h5>
                  <div className="d-flex mb-3 align-items-start">
                    <FaPhone className="text-success me-3 mt-1" size={14} />
                    <div>
                      <small className="text-muted text-uppercase d-block fw-bold" style={{fontSize: '0.65rem'}}>Telepon</small>
                      <a href={`tel:${contactInfo?.phone}`} className="text-dark text-decoration-none fw-bold small">{contactInfo?.phone || '-'}</a>
                    </div>
                  </div>
                  <div className="d-flex mb-3 align-items-start">
                    <FaEnvelope className="text-success me-3 mt-1" size={14} />
                    <div>
                      <small className="text-muted text-uppercase d-block fw-bold" style={{fontSize: '0.65rem'}}>Email</small>
                      <a href={`mailto:${contactInfo?.email}`} className="text-dark text-decoration-none fw-bold small text-break">{contactInfo?.email || '-'}</a>
                    </div>
                  </div>
                  <div className="d-flex mb-0 align-items-start">
                    <FaMapMarkerAlt className="text-success me-3 mt-1" size={14} />
                    <div>
                      <small className="text-muted text-uppercase d-block fw-bold" style={{fontSize: '0.65rem'}}>Alamat</small>
                      <p className="text-dark fw-medium small mb-0">{contactInfo?.address || '-'}</p>
                    </div>
                  </div>
               </Card>

               {user && (
                 <Card className="border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                    <Card.Header className="bg-transparent border-0 pt-4 px-4 pb-0">
                       <h5 className="fw-bold mb-0 d-flex align-items-center">
                          <FaHistory className="text-success me-2" size={16} /> Pesan Saya
                       </h5>
                    </Card.Header>
                    <Card.Body className="p-0">
                       {loadingHistory ? (
                         <div className="text-center py-4"><Spinner size="sm" variant="success" /></div>
                       ) : myMessages.length === 0 ? (
                         <div className="text-center py-5 text-muted small px-3">Belum ada riwayat pesan.</div>
                       ) : (
                         <ListGroup variant="flush">
                            {myMessages.map(msg => (
                              <ListGroup.Item key={msg.id} className="py-3 px-4 border-bottom">
                                 <div className="d-flex justify-content-between align-items-start mb-1">
                                    <small className="fw-bold text-dark text-truncate pe-2">{msg.subject}</small>
                                    {msg.reply ? (
                                      <Badge bg="success" className="rounded-pill" style={{fontSize: '0.6rem'}}>Dibalas</Badge>
                                    ) : msg.isRead ? (
                                      <Badge bg="info" className="rounded-pill" style={{fontSize: '0.6rem'}}>Dibaca</Badge>
                                    ) : (
                                      <Badge bg="secondary" className="bg-opacity-50 rounded-pill" style={{fontSize: '0.6rem'}}>Terkirim</Badge>
                                    )}
                                 </div>
                                 <p className="extra-small text-muted mb-2 text-truncate-2">{msg.message}</p>
                                 {msg.reply && (
                                   <p className="extra-small text-dark mb-2 italic">
                                     <FaReply size={10} className="me-1 text-success" />
                                     <span className="fw-bold">Balasan Admin:</span> "{msg.reply}"
                                   </p>
                                 )}
                                 <div className="extra-small text-muted opacity-75 d-flex justify-content-between align-items-center">
                                    <span>{new Date(msg.createdAt).toLocaleDateString('id-ID')}</span>
                                    {msg.isRead && <FaCheckCircle className="text-success" size={10} />}
                                 </div>
                              </ListGroup.Item>
                            ))}
                         </ListGroup>
                       )}
                    </Card.Body>
                 </Card>
               )}
            </div>
          </Col>

          <Col lg={8}>
            <Card className="border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white h-100">
               <h4 className="fw-bold mb-4">Kirimkan Pesan</h4>
               {!user ? (
                <div className="p-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-3 mb-4 d-flex align-items-center gap-3">
                   <div className="bg-warning bg-opacity-25 rounded-circle p-2 text-warning"><FaLock size={16} /></div>
                   <div className="small text-dark"><strong>Akses Terbatas:</strong> Silakan <strong>Login</strong> terlebih dahulu untuk dapat mengirimkan pesan.</div>
                </div>
              ) : !canSendMessage() && (
                <div className="p-3 bg-info bg-opacity-10 border border-info border-opacity-25 rounded-3 mb-4 d-flex align-items-center gap-3">
                   <div className="bg-info bg-opacity-25 rounded-circle p-2 text-info"><FaExclamationCircle size={16} /></div>
                   <div className="small text-dark"><strong>Limit Tercapai:</strong> Anda telah mengirim pesan dalam 24 jam terakhir. Coba lagi dalam <strong>{getRemainingTime()}</strong>.</div>
                </div>
              )}
              <Form onSubmit={handleFormSubmit} className={isLocked ? 'opacity-50' : ''}>
                <div style={{ display: 'none' }}><Form.Control type="text" value={formData.hp} onChange={e => setFormData({...formData, hp: e.target.value})} tabIndex={-1} /></div>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted text-uppercase">Nama Anda</Form.Label>
                      <Form.Control required disabled={isLocked} placeholder="Nama lengkap..." className="bg-light border-0 py-2 shadow-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted text-uppercase">Email (Akun)</Form.Label>
                      <Form.Control required type="email" readOnly className="bg-light border-0 py-2 shadow-none text-muted" value={formData.email} />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted text-uppercase">Subjek</Form.Label>
                      <Form.Control disabled={isLocked} placeholder="Tujuan pesan..." className="bg-light border-0 py-2 shadow-none" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group className="mb-4">
                      <Form.Label className="small fw-bold text-muted text-uppercase">Isi Pesan</Form.Label>
                      <Form.Control as="textarea" rows={5} required disabled={isLocked} placeholder="Tuliskan pesan atau pertanyaan Anda di sini..." className="bg-light border-0 py-2 shadow-none" value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Button type="submit" variant="success" className="px-5 py-2 fw-bold rounded-pill shadow-sm d-flex align-items-center" disabled={sending || isLocked}>
                      {sending ? <Spinner size="sm" className="me-2" /> : <FaPaperPlane className="me-2" />} Kirim Pesan
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card>
          </Col>
        </Row>
        
        {position && (
          <div className="shadow-sm rounded-4 overflow-hidden border bg-white p-2 mt-5">
            <div style={{ height: '400px' }}>
              <MapContainer center={position} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={position}><Popup><strong className="text-success">{schoolName}</strong></Popup></Marker>
              </MapContainer>
            </div>
          </div>
        )}
      </Container>

      <style>{`
        .extra-small { font-size: 0.65rem; }
        .text-uppercase { text-transform: uppercase; }
        .text-truncate-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .italic { font-style: italic; }
      `}</style>
    </div>
  );
};

export default Contact;
