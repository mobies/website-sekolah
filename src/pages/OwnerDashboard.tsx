import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Modal, Form, Badge, Card, Spinner, InputGroup, Row, Col, Tab, Nav, Alert } from 'react-bootstrap';
import { FaPlus, FaTrash, FaSchool, FaSearch, FaCheckCircle, FaExclamationTriangle, FaIdCard, FaEnvelope, FaUserCheck, FaLink, FaClipboard, FaTimesCircle, FaRegClock } from 'react-icons/fa';
import { getRootRef } from '../firebase/utils';
import { onValue, set, remove, serverTimestamp } from 'firebase/database';
import { showAlert, toast, showConfirm } from '../utils/alerts';

interface InvitationInfo {
  id: string;
  tenantIdSuggestion?: string; // Optional suggestion from owner
  status: 'active' | 'used' | 'expired';
  createdAt: number;
}

interface RegistrationRequest {
  tenantId: string;
  schoolName: string;
  level: string;
  npsn: string;
  adminName: string;
  adminEmail: string;
  adminUid: string;
  status: 'pending' | 'approved' | 'rejected';
  tokenUsed: string;
  timestamp: number;
}

interface TenantInfo {
  id: string;
  schoolName: string;
  level: string;
  npsn: string;
  adminEmail: string;
  adminUid: string;
  createdAt: number;
}

const OwnerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants', 'invitations', 'requests'
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newInviteTenantId, setNewInviteTenantId] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    // Fetch Tenants (Active)
    const tenantsRef = getRootRef('tenant-lists');
    const unsubscribeTenants = onValue(tenantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setTenants(list);
      } else {
        setTenants([]);
      }
      setLoading(false);
    });

    // Fetch Invitations
    const invitesRef = getRootRef('invitations');
    const unsubscribeInvites = onValue(invitesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setInvitations(list);
      } else {
        setInvitations([]);
      }
    });

    // Fetch Registration Requests
    const requestsRef = getRootRef('registration-requests');
    const unsubscribeRequests = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ tenantId: key, ...data[key] }));
        setRequests(list);
      } else {
        setRequests([]);
      }
    });

    return () => {
      unsubscribeTenants();
      unsubscribeInvites();
      unsubscribeRequests();
    };
  }, []);

  const handleGenerateInviteLink = async () => {
    if (!newInviteTenantId) return showAlert('Peringatan', 'Saran Tenant ID tidak boleh kosong.', 'warning');
    const sanitizedId = newInviteTenantId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    setGeneratingInvite(true);
    try {

      const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      await set(getRootRef(`invitations/${newToken}`), {
        tenantIdSuggestion: sanitizedId,
        status: 'active',
        createdAt: serverTimestamp()
      });

      setGeneratedLink(`${window.location.origin}/admin-register?token=${newToken}`);
      toast.fire({ icon: 'success', title: 'Link undangan berhasil dibuat' });
    } catch (error) {
      showAlert('Gagal', 'Gagal membuat link undangan.', 'error');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.fire({ icon: 'info', title: 'Link disalin ke clipboard!' });
  };

  const handleDeleteTenant = async (id: string) => {
    const confirm = await showConfirm('Hapus Tenant?', `Hapus sekolah "${id}" PERMANEN?`);
    if (confirm.isConfirmed) {
      try {
        await remove(getRootRef(`tenants/${id}`));
        await remove(getRootRef(`tenant-lists/${id}`));
        // Remove any pending requests related to this tenantId
        await remove(getRootRef(`registration-requests/${id}`)); 
        toast.fire({ icon: 'success', title: 'Tenant berhasil dihapus' });
      } catch (error) {
        showAlert('Gagal', 'Gagal menghapus tenant.', 'error');
      }
    }
  };

  const handleApproveRequest = async (request: RegistrationRequest) => {
    const confirm = await showConfirm('Setujui Pendaftaran?', `Setujui pendaftaran admin dari ${request.schoolName} (${request.adminEmail})?`, 'Ya, Setujui!');
    if (confirm.isConfirmed) {
      try {
        const timestamp = serverTimestamp();
        const tenantData = {
          id: request.tenantId,
          schoolName: request.schoolName,
          level: request.level,
          npsn: request.npsn,
          adminEmail: request.adminEmail,
          adminUid: request.adminUid,
          createdAt: timestamp
        };
  
        // 1. Save to tenant-lists (Summary for Owner Dashboard)
        await set(getRootRef(`tenant-lists/${request.tenantId}`), tenantData);
  
        // 2. Initialize tenant settings
        await set(getRootRef(`tenants/${request.tenantId}/settings`), {
          ...tenantData,
          tagline: 'Membangun Generasi Cerdas & Berakhlak',
          logo: '',
          headmaster: { name: '', photo: '', greeting: '' },
          heroSlides: [],
          eServicesLayout: 'slider'
        });
  
        // 3. Initialize stats
        await set(getRootRef(`tenants/${request.tenantId}/stats`), {
          totalNews: 0, totalAgendas: 0, totalAnnouncements: 0, totalAlbums: 0, totalPhotos: 0
        });

        // 4. Update request status
        await set(getRootRef(`registration-requests/${request.tenantId}/status`), 'approved');
        // 5. Mark invitation as used
        await set(getRootRef(`invitations/${request.tokenUsed}/status`), 'used');

        toast.fire({ icon: 'success', title: `Pendaftaran ${request.schoolName} disetujui!` });
        setShowRequestModal(false);
      } catch (error) {
        console.error("Error approving request:", error);
        showAlert('Gagal', 'Gagal menyetujui pendaftaran.', 'error');
      }
    }
  };

  const handleRejectRequest = async (request: RegistrationRequest) => {
    const confirm = await showConfirm('Tolak Pendaftaran?', `Tolak pendaftaran admin dari ${request.schoolName} (${request.adminEmail})?`);
    if (confirm.isConfirmed) {
      try {
        await set(getRootRef(`registration-requests/${request.tenantId}/status`), 'rejected');
        // Optionally, remove the invitation or mark it as expired/rejected as well
        await remove(getRootRef(`invitations/${request.tokenUsed}`));
        toast.fire({ icon: 'info', title: `Pendaftaran ${request.schoolName} ditolak.` });
        setShowRequestModal(false);
      } catch (error) {
        showAlert('Gagal', 'Gagal menolak pendaftaran.', 'error');
      }
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.npsn.includes(searchTerm)
  );

  const filteredRequests = requests.filter(r => r.status === 'pending' && 
    (r.tenantId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.npsn.includes(searchTerm) ||
    r.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredInvitations = invitations.filter(inv => inv.status === 'active' && 
    (inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.tenantIdSuggestion?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    searchTerm === '')
  );

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold text-dark mb-1">Owner Dashboard</h2>
            <p className="text-muted">Manajemen Tenant & Sekolah Multi-Tenancy</p>
          </div>
          <Button variant="primary" className="px-4 py-2 fw-bold shadow-sm" onClick={() => setShowInviteModal(true)}>
            <FaPlus className="me-2" /> BUAT UNDANGAN BARU
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white py-3 border-bottom">
            <Nav variant="tabs" defaultActiveKey="tenants" onSelect={(k) => setActiveTab(k as string)} className="card-header-tabs">
              <Nav.Item>
                <Nav.Link eventKey="tenants" className="fw-bold small">Sekolah Aktif <Badge bg="primary" className="ms-1">{tenants.length}</Badge></Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="requests" className="fw-bold small">Permintaan Registrasi <Badge bg="warning" className="ms-1">{requests.filter(r => r.status === 'pending').length}</Badge></Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="invitations" className="fw-bold small">Undangan Terkirim <Badge bg="info" className="ms-1">{invitations.filter(inv => inv.status === 'active').length}</Badge></Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>
          <Card.Body className="p-0">
            <InputGroup className="p-4">
              <InputGroup.Text className="bg-light border-0"><FaSearch className="text-muted" /></InputGroup.Text>
              <Form.Control 
                placeholder="Cari..." 
                className="bg-light border-0" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>

            {loading ? (
              <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
            ) : (
              <Tab.Content>
                <Tab.Pane eventKey="tenants" active={activeTab === 'tenants'}>
                  {filteredTenants.length === 0 ? (
                    <div className="text-center py-5 text-muted">Belum ada tenant aktif terdaftar.</div>
                  ) : (
                    <Table responsive hover className="mb-0 align-middle">
                      <thead className="bg-light">
                        <tr className="small text-muted">
                          <th className="ps-4">TENANT ID</th>
                          <th>NAMA SEKOLAH</th>
                          <th>NPSN / EMAIL ADMIN</th>
                          <th>UID ADMIN</th>
                          <th className="text-end pe-4">AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTenants.map((tenant) => (
                          <tr key={tenant.id}>
                            <td className="ps-4"><code className="text-primary fw-bold">{tenant.id}</code><div className="extra-small mt-1"><Badge bg="info">{tenant.level}</Badge></div></td>
                            <td><div className="fw-bold">{tenant.schoolName}</div><div className="extra-small text-muted">Dibuat: {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '-'}</div></td>
                            <td>
                              <div className="small d-flex align-items-center mb-1"><FaIdCard className="text-muted me-2" size={12} /> {tenant.npsn}</div>
                              <div className="small d-flex align-items-center"><FaEnvelope className="text-muted me-2" size={12} /> {tenant.adminEmail}</div>
                            </td>
                            <td>
                              {tenant.adminUid ? (
                                <div className="small text-success d-flex align-items-center fw-bold"><FaUserCheck className="me-2" /> <code className="text-success small">{tenant.adminUid.substring(0, 10)}...</code></div>
                              ) : (
                                <span className="small text-muted italic">Not Linked</span>
                              )}
                            </td>
                            <td className="text-end pe-4">
                              <Button variant="outline-danger" size="sm" onClick={() => handleDeleteTenant(tenant.id)}><FaTrash size={12} /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Tab.Pane>

                <Tab.Pane eventKey="requests" active={activeTab === 'requests'}>
                  {filteredRequests.length === 0 ? (
                    <div className="text-center py-5 text-muted">Tidak ada permintaan registrasi baru.</div>
                  ) : (
                    <Table responsive hover className="mb-0 align-middle">
                      <thead className="bg-light">
                        <tr className="small text-muted">
                          <th className="ps-4">SEKOLAH</th>
                          <th>ADMIN</th>
                          <th>STATUS</th>
                          <th className="text-end pe-4">AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.map((req) => (
                          <tr key={req.tenantId}>
                            <td className="ps-4">
                              <div className="fw-bold text-dark">{req.schoolName}</div>
                              <div className="extra-small text-muted"><Badge bg="info" className="me-1">{req.level}</Badge> <code className="text-primary">{req.tenantId}</code></div>
                            </td>
                            <td>
                              <div className="small fw-bold">{req.adminName}</div>
                              <div className="extra-small text-muted">{req.adminEmail}</div>
                              <div className="extra-small text-muted font-monospace">UID: {req.adminUid.substring(0, 10)}...</div>
                            </td>
                            <td><Badge bg="warning" className="text-dark"><FaRegClock className="me-1" /> Pending</Badge></td>
                            <td className="text-end pe-4">
                              <Button variant="primary" size="sm" className="me-2" onClick={() => {
                                setSelectedRequest(req);
                                setShowRequestModal(true);
                              }}>Review</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Tab.Pane>

                <Tab.Pane eventKey="invitations">
                  {filteredInvitations.length === 0 ? (
                    <div className="text-center py-5 text-muted">Belum ada undangan yang aktif.</div>
                  ) : (
                    <Table responsive hover className="mb-0 align-middle">
                      <thead className="bg-light">
                        <tr className="small text-muted">
                          <th className="ps-4">TOKEN UNDANGAN</th>
                          <th>SUGGESTED ID</th>
                          <th>STATUS</th>
                          <th className="text-end pe-4">AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvitations.map((inv) => (
                          <tr key={inv.id}>
                            <td className="ps-4">
                              <code className="text-muted">{inv.id.substring(0, 15)}...</code>
                              <div className="extra-small text-muted">Dibuat: {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}</div>
                            </td>
                            <td><div className="fw-bold">{inv.tenantIdSuggestion}</div></td>
                            <td><Badge bg={inv.status === 'active' ? 'success' : inv.status === 'used' ? 'info' : 'danger'} className="text-capitalize">{inv.status}</Badge></td>
                            <td className="text-end pe-4">
                              <Button variant="outline-danger" size="sm" onClick={() => showConfirm('Hapus Undangan?', 'Token ini akan dihapus.').then(res => { if (res.isConfirmed) remove(getRootRef(`invitations/${inv.id}`)); })}><FaTrash size={12} /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Tab.Pane>
              </Tab.Content>
            )}
          </Card.Body>
        </Card>

        <div className="mt-5 p-4 bg-white rounded shadow-sm border-start border-primary border-4">
          <h6 className="fw-bold d-flex align-items-center"><FaCheckCircle className="text-success me-2" /> Informasi Sistem</h6>
          <p className="small text-muted mb-0">Sistem Multi-Tenancy ini menggunakan isolasi data per path pada Realtime Database. Data lengkap masing-masing sekolah tetap terisolasi di path <code>/tenants/&#123;id&#125;</code>.</p>
        </div>
      </Container>

      {/* Invite Modal */}
      <Modal show={showInviteModal} onHide={() => setShowInviteModal(false)} centered>
        <Form onSubmit={(e) => { e.preventDefault(); handleGenerateInviteLink(); }}>
          <Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold">Buat Link Undangan Admin</Modal.Title></Modal.Header>
          <Modal.Body className="p-4 text-center">
            <FaLink className="text-primary fs-1 mb-2" />
            <p className="text-muted small">Berikan link ini kepada calon admin sekolah untuk mendaftar.</p>
            
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold small">Saran Tenant ID (Opsional)</Form.Label>
              <Form.Control 
                placeholder="misal: smp1garut" 
                value={newInviteTenantId}
                onChange={(e) => setNewInviteTenantId(e.target.value)}
              />
              <Form.Text className="text-muted extra-small">Admin bisa mengubahnya nanti jika ID belum dipakai.</Form.Text>
            </Form.Group>

            <Button type="submit" variant="primary" className="w-100 py-2 fw-bold shadow-sm" disabled={generatingInvite}>
              {generatingInvite ? <Spinner size="sm" className="me-2" /> : null} Buat Undangan
            </Button>

            {generatedLink && (
              <InputGroup className="mt-4">
                <Form.Control value={generatedLink} readOnly />
                <Button variant="outline-secondary" onClick={handleCopyLink}><FaClipboard /></Button>
              </InputGroup>
            )}
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="light" onClick={() => setShowInviteModal(false)}>Tutup</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Request Review Modal */}
      <Modal show={showRequestModal} onHide={() => setShowRequestModal(false)} centered size="lg">
        {selectedRequest && (
          <Form>
            <Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold">Review Permintaan Registrasi</Modal.Title></Modal.Header>
            <Modal.Body className="p-4">
              <div className="text-center mb-4">
                <FaSchool className="text-primary fs-1 mb-2" />
                <h5 className="fw-bold mb-1">{selectedRequest.schoolName}</h5>
                <p className="text-muted small mb-0">ID: <code className="text-primary fw-bold">{selectedRequest.tenantId}</code> | NPSN: {selectedRequest.npsn}</p>
              </div>

              <Row>
                <Col md={6}>
                  <p className="small mb-1 fw-bold">Admin Details:</p>
                  <p className="extra-small mb-1"><FaUserCheck className="me-2 text-success" /> {selectedRequest.adminName}</p>
                  <p className="extra-small mb-1"><FaEnvelope className="me-2 text-muted" /> {selectedRequest.adminEmail}</p>
                  <p className="extra-small mb-1"><FaIdCard className="me-2 text-muted" /> UID: {selectedRequest.adminUid.substring(0, 15)}...</p>
                </Col>
                <Col md={6}>
                  <p className="small mb-1 fw-bold">Invitation Details:</p>
                  <p className="extra-small mb-1"><FaLink className="me-2 text-muted" /> Token: {selectedRequest.tokenUsed.substring(0, 15)}...</p>
                  <p className="extra-small mb-1"><FaRegClock className="me-2 text-muted" /> Tanggal Request: {new Date(selectedRequest.timestamp).toLocaleString()}</p>
                </Col>
              </Row>
              
              <Alert variant="info" className="mt-4 d-flex align-items-start">
                <FaExclamationTriangle className="text-info me-2 mt-1" />
                <small className="mb-0">Setelah disetujui, akun ini akan dibuat dan admin dapat login ke dashboard sekolah.</small>
              </Alert>
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0">
              <Button variant="light" onClick={() => setShowRequestModal(false)}>Batal</Button>
              <Button variant="danger" onClick={() => handleRejectRequest(selectedRequest)}><FaTimesCircle className="me-2" /> Tolak</Button>
              <Button variant="success" onClick={() => handleApproveRequest(selectedRequest)}><FaCheckCircle className="me-2" /> Setujui</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default OwnerDashboard;
