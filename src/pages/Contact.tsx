import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Breadcrumb, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import { FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
  const { tenantId } = useTenant();
  const [contactInfo, setContactInfo] = useState<ContactData | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="text-center">
        <Spinner animation="border" variant="success" className="mb-3" />
        <p className="text-muted fw-medium">Memuat informasi kontak...</p>
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
          <div className="row align-items-center">
            <Col lg={7}>
              <h1 className="display-4 fw-bold text-dark mb-3">Hubungi Kami</h1>
              <p className="lead text-muted mb-0">
                Kami berkomitmen untuk memberikan layanan terbaik. Silakan hubungi kami melalui saluran komunikasi di bawah ini atau kunjungi kantor kami secara langsung.
              </p>
            </Col>
          </div>
        </Container>
      </section>

      {/* CONTACT CARDS SECTION */}
      <Container className="py-5">
        <Row className="g-4 mb-5">
          <Col md={4}>
            <Card className="h-100 border-0 shadow-sm text-center p-4 rounded-4 transition-hover">
              <div className="icon-box bg-success bg-opacity-10 text-success rounded-circle mx-auto mb-4 d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                <FaPhone size={30} />
              </div>
              <h5 className="fw-bold mb-3">Telepon</h5>
              <p className="text-muted mb-3">Hubungi kami langsung untuk respon yang lebih cepat.</p>
              {contactInfo?.phone ? (
                <a href={`tel:${contactInfo.phone}`} className="h5 text-success text-decoration-none fw-bold mt-auto">
                  {contactInfo.phone}
                </a>
              ) : (
                <span className="text-muted italic">Tidak tersedia</span>
              )}
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 shadow-sm text-center p-4 rounded-4 transition-hover">
              <div className="icon-box bg-success bg-opacity-10 text-success rounded-circle mx-auto mb-4 d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                <FaEnvelope size={30} />
              </div>
              <h5 className="fw-bold mb-3">Email</h5>
              <p className="text-muted mb-3">Kirimkan pertanyaan atau feedback Anda melalui email.</p>
              {contactInfo?.email ? (
                <a href={`mailto:${contactInfo.email}`} className="h6 text-success text-decoration-none fw-bold mt-auto text-break">
                  {contactInfo.email}
                </a>
              ) : (
                <span className="text-muted italic">Tidak tersedia</span>
              )}
            </Card>
          </Col>
          <Col md={4}>
            <Card className="h-100 border-0 shadow-sm text-center p-4 rounded-4 transition-hover">
              <div className="icon-box bg-success bg-opacity-10 text-success rounded-circle mx-auto mb-4 d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                <FaMapMarkerAlt size={30} />
              </div>
              <h5 className="fw-bold mb-3">Alamat</h5>
              <p className="text-muted mb-3">Kunjungi lokasi kami secara langsung.</p>
              {contactInfo?.address ? (
                <p className="mb-0 text-dark small fw-medium mt-auto" style={{ whiteSpace: 'pre-line' }}>
                  {contactInfo.address}
                </p>
              ) : (
                <span className="text-muted italic">Tidak tersedia</span>
              )}
            </Card>
          </Col>
        </Row>

        {/* MAP SECTION */}
        <Row>
          <Col>
            <div className="map-container-wrapper shadow-sm rounded-4 overflow-hidden position-relative" style={{ height: '500px' }}>
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
                <div className="d-flex flex-column justify-content-center align-items-center h-100 bg-white border">
                  <FaMapMarkerAlt size={50} className="text-muted mb-3" />
                  <p className="text-muted fw-medium">Peta lokasi belum tersedia.</p>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Container>

      <style>{`
        .transition-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .transition-hover:hover {
          transform: translateY(-10px);
          box-shadow: 0 1rem 3rem rgba(0,0,0,.1) !important;
        }
        .contact-page-wrapper .breadcrumb-item + .breadcrumb-item::before {
          content: "›";
          font-size: 1.2rem;
          line-height: 1;
        }
        .map-container-wrapper {
          border: 1px solid rgba(0,0,0,.05);
        }
      `}</style>
    </div>
  );
};

export default Contact;
