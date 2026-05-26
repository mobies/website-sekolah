import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Breadcrumb, Spinner, Form, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue, push, set, serverTimestamp } from 'firebase/database';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaPaperPlane } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { showAlert, toast } from '../utils/alerts';

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

const Contact: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [contactInfo, setContactInfo] = useState<ContactData | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    hp: '' // Honeypot field for bot protection
  });
  const [sending, setSending] = useState(false);

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    // Bot protection: if hidden honeypot field is filled, ignore submission
    if (formData.hp) {
      console.warn("Bot detected.");
      return;
    }

    setSending(true);
    try {
      const msgRef = push(getDBRef(tenantId, 'messages'));
      await set(msgRef, {
        name: formData.name,
        email: formData.email,
        subject: formData.subject || 'Pesan dari Form Kontak',
        message: formData.message,
        createdAt: serverTimestamp(),
        isRead: false
      });

      toast.fire({ icon: 'success', title: 'Pesan Anda telah terkirim!' });
      setFormData({ name: '', email: '', subject: '', message: '', hp: '' });
    } catch (error) {
      showAlert('Gagal', 'Terjadi kesalahan saat mengirim pesan.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="text-center">
        <Spinner animation="border" variant="success" className="mb-3" />
        <p className="text-muted fw-medium">Memuat informasi...</p>
      </div>
    </div>
  );

  const position: L.LatLngExpression | undefined = 
    contactInfo && contactInfo.lat && contactInfo.lng 
      ? [parseFloat(contactInfo.lat), parseFloat(contactInfo.lng)] 
      : undefined;

  return (
    <div className="contact-page-wrapper bg-light min-vh-100">
      {/* HERO SECTION */}
      <section className="contact-hero py-5 bg-white border-bottom">
        <Container>
          <Breadcrumb className="mb-4">
            <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>Beranda</Breadcrumb.Item>
            <Breadcrumb.Item active>Kontak</Breadcrumb.Item>
          </Breadcrumb>
          <Row className="align-items-center">
            <Col lg={8}>
              <h1 className="display-5 fw-bold text-dark mb-2">Hubungi Kami</h1>
              <p className="lead text-muted mb-0">
                Kami siap membantu menjawab pertanyaan Anda seputar {terms.school}.
              </p>
            </Col>
          </Row>
        </Container>
      </section>

      <Container className="py-5">
        <Row className="g-5">
          {/* LEFT COLUMN: ELEGANT CONTACT INFO */}
          <Col lg={4}>
            <div className="contact-info-clean">
              <h4 className="fw-bold mb-4">Informasi Kontak</h4>
              
              <div className="info-item d-flex mb-4">
                <div className="icon-wrapper me-3 text-success">
                  <FaPhone size={20} />
                </div>
                <div>
                  <div className="fw-bold small text-uppercase text-muted tracking-wider">Telepon</div>
                  <div className="h5 mb-0">
                    {contactInfo?.phone ? (
                      <a href={`tel:${contactInfo.phone}`} className="text-dark text-decoration-none fw-bold">{contactInfo.phone}</a>
                    ) : 'Tidak tersedia'}
                  </div>
                </div>
              </div>

              <div className="info-item d-flex mb-4">
                <div className="icon-wrapper me-3 text-success">
                  <FaEnvelope size={20} />
                </div>
                <div>
                  <div className="fw-bold small text-uppercase text-muted tracking-wider">Email Resmi</div>
                  <div className="h6 mb-0">
                    {contactInfo?.email ? (
                      <a href={`mailto:${contactInfo.email}`} className="text-dark text-decoration-none fw-bold text-break">{contactInfo.email}</a>
                    ) : 'Tidak tersedia'}
                  </div>
                </div>
              </div>

              <div className="info-item d-flex mb-5">
                <div className="icon-wrapper me-3 text-success">
                  <FaMapMarkerAlt size={20} />
                </div>
                <div>
                  <div className="fw-bold small text-uppercase text-muted tracking-wider">Alamat Lengkap</div>
                  <p className="mb-0 text-dark fw-medium lh-base">
                    {contactInfo?.address || 'Alamat belum tersedia'}
                  </p>
                </div>
              </div>

              <Card className="border-0 shadow-sm rounded-4 bg-success text-white p-4">
                 <h5 className="fw-bold mb-2">Jam Operasional</h5>
                 <p className="small mb-0 opacity-75">Senin - Jumat: 07:30 - 15:30</p>
                 <p className="small mb-0 opacity-75">Sabtu: 07:30 - 12:30</p>
                 <p className="small mb-0 opacity-75">Minggu & Hari Libur: Tutup</p>
              </Card>
            </div>
          </Col>

          {/* RIGHT COLUMN: MESSAGE FORM */}
          <Col lg={8}>
            <Card className="border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
              <h4 className="fw-bold mb-4">Kirimkan Pesan</h4>
              <Form onSubmit={handleFormSubmit}>
                {/* Honeypot field (hidden from users) */}
                <div style={{ display: 'none' }}>
                  <Form.Control 
                    type="text" 
                    value={formData.hp} 
                    onChange={e => setFormData({...formData, hp: e.target.value})} 
                    tabIndex={-1} 
                    autoComplete="off" 
                  />
                </div>

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted uppercase">Nama Lengkap</Form.Label>
                      <Form.Control 
                        required 
                        placeholder="Masukkan nama Anda..." 
                        className="bg-light border-0 py-2 shadow-none"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted uppercase">Alamat Email</Form.Label>
                      <Form.Control 
                        required 
                        type="email" 
                        placeholder="email@contoh.com" 
                        className="bg-light border-0 py-2 shadow-none"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted uppercase">Subjek (Opsional)</Form.Label>
                      <Form.Control 
                        placeholder="Tujuan pesan..." 
                        className="bg-light border-0 py-2 shadow-none"
                        value={formData.subject}
                        onChange={e => setFormData({...formData, subject: e.target.value})}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Form.Group className="mb-4">
                      <Form.Label className="small fw-bold text-muted uppercase">Isi Pesan</Form.Label>
                      <Form.Control 
                        as="textarea" 
                        rows={5} 
                        required 
                        placeholder="Tuliskan pesan atau pertanyaan Anda di sini..." 
                        className="bg-light border-0 py-2 shadow-none"
                        value={formData.message}
                        onChange={e => setFormData({...formData, message: e.target.value})}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Button 
                      type="submit" 
                      variant="success" 
                      className="px-5 py-2 fw-bold rounded-pill shadow-sm d-flex align-items-center" 
                      disabled={sending}
                    >
                      {sending ? <Spinner size="sm" className="me-2" /> : <FaPaperPlane className="me-2" />}
                      Kirim Pesan Sekarang
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card>
          </Col>
        </Row>

        {/* MAP SECTION */}
        <Row className="mt-5 pt-4">
          <Col>
            <div className="map-wrapper shadow-sm rounded-4 overflow-hidden border bg-white p-2">
              <div style={{ height: '450px' }}>
                {position ? (
                  <MapContainer center={position} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={position}>
                      <Popup>
                        <div className="p-2">
                          <strong className="d-block mb-1 text-success">{schoolName}</strong>
                          <span className="text-muted small">{contactInfo?.address.split('\n')[0]}</span>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div className="d-flex flex-column justify-content-center align-items-center h-100 bg-light rounded-3">
                    <FaMapMarkerAlt size={50} className="text-muted mb-3 opacity-25" />
                    <p className="text-muted fw-medium">Peta lokasi belum tersedia.</p>
                  </div>
                )}
              </div>
            </div>
          </Col>
        </Row>
      </Container>

      <style>{`
        .icon-wrapper {
          width: 42px;
          height: 42px;
          background-color: rgba(25, 135, 84, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .tracking-wider { letter-spacing: 0.1em; }
        .uppercase { text-transform: uppercase; }
        .shadow-none:focus { border: 1px solid #198754 !important; }
      `}</style>
    </div>
  );
};

export default Contact;
