import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Row, Col, Spinner, Table, Modal, Badge, Nav, Tab } from 'react-bootstrap';
import { FaSave, FaPlus, FaTrash, FaImage, FaUserTie, FaThLarge, FaEllipsisH, FaSmile, FaFontAwesome, FaBootstrap, FaCode, FaEdit, FaCloudUploadAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, set, push, remove } from 'firebase/database';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { convertToWebP } from '../../firebase/imageUtils';
import { showAlert, showConfirm, toast } from '../../utils/alerts';
import IconRenderer from '../../components/IconRenderer';

interface Slide {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  link?: string; // Optional link for the slide
}

interface SchoolSettings {
  schoolName: string;
  tagline: string;
  level: string;
  eServicesLayout: 'bento' | 'slider';
  logo?: string;
  heroSlides: Array<Slide>;
  headmaster: {
    name: string;
    greeting: string;
    photo?: string;
  };
}

interface EService {
  id: string;
  title: string;
  url: string;
  bgColor: string;
  textColor: string;
  icon: string;
  iconType: 'emoji' | 'fa' | 'bi' | 'hi' | 'fc';
}

const Settings: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: '',
    tagline: '',
    level: 'MTs',
    eServicesLayout: 'bento',
    heroSlides: [],
    headmaster: {
      name: '',
      greeting: ''
    }
  });
  const [eServices, setEServices] = useState<EService[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [hmFile, setHmFile] = useState<File | null>(null);
  const [hmPreview, setHmPreview] = useState<string | null>(null);

  // E-Service Modal State
  const [showEServiceModal, setShowEServiceModal] = useState(false);
  const [currentEService, setCurrentEService] = useState<Partial<EService>>({
    title: '',
    url: '',
    bgColor: '#198754',
    textColor: '#ffffff',
    icon: '🎓',
    iconType: 'emoji'
  });

  // Slide Modal State
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState<Partial<Slide>>({
    title: '',
    subtitle: '',
    url: '',
    link: ''
  });
  const [slideImageFile, setSlideImageFile] = useState<File | null>(null);
  const [slideImagePreview, setSlideImagePreview] = useState<string | null>(null);
  const [slideLoading, setSlideLoading] = useState(false);

  const iconSets = {
    emoji: [
      '🎓', '📝', '📚', '📜', '🏫', '🖥️', '💻', '🎒', '🧪', '🎨', 
      '⚽', '📢', '🤝', '🌍', '🚌', '🍴', '📅', '🔐', '👤', '💰',
      '📊', '🏆', '⭐', '📍', '📞', '📧', '⏰', '📖', '📁', '💡'
    ],
    bi: [
      'BiBook', 'BiCalendarEvent', 'BiCamera', 'BiChatDots', 'BiCheckCircle',
      'BiCloudDownload', 'BiCreditCard', 'BiEnvelope', 'BiFile', 'BiGlobe',
      'BiGraduationCap', 'BiHeadphone', 'BiHomeAlt', 'BiImage', 'BiInfoCircle',
      'BiLink', 'BiListUl', 'BiLockAlt', 'BiMap', 'BiMessageSquareDetail',
      'BiMicrophone', 'BiMouse', 'BiNotification', 'BiPaperclip', 'BiPencil',
      'BiPhone', 'BiSearch', 'BiShield', 'BiStar', 'BiUser'
    ],
    fa: [
      'FaSchool', 'FaGraduationCap', 'FaBook', 'FaChalkboardTeacher', 'FaUserGraduate',
      'FaCalendarAlt', 'FaNewspaper', 'FaImages', 'FaVideo', 'FaComments',
      'FaGlobe', 'FaEnvelope', 'FaPhone', 'FaMapMarkerAlt', 'FaShieldAlt',
      'FaUniversity', 'FaUserFriends', 'FaBullhorn', 'FaLightbulb', 'FaHeart'
    ],
    hi: [
      'HiAcademicCap', 'HiAnnotation', 'HiBeaker', 'HiBookOpen', 'HiBriefcase',
      'HiCalculator', 'HiCalendar', 'HiCamera', 'HiChartBar', 'HiChat',
      'HiClipboardList', 'HiCloudDownload', 'HiCode', 'HiColorSwatch', 'HiDesktopComputer',
      'HiDocumentText', 'HiFingerPrint', 'HiGlobe', 'HiIdentification', 'HiLibrary'
    ],
    fc: [
      'FcAddressBook', 'FcApprove', 'FcAssistant', 'FcBriefcase', 'FcBullright',
      'FcCalculator', 'FcCalendar', 'FcCamera', 'FcClime', 'FcConferenceCall',
      'FcCustomerSupport', 'FcDatabase', 'FcDepartment', 'FcDiploma', 'FcDisplay',
      'FcDocument', 'FcElectronics', 'FcEnteringHeavenAlive', 'FcExternal', 'FcFile',
      'FcGraduationCap', 'FcHome', 'FcIdea', 'FcLibrary', 'FcNeutralDecision',
      'FcOnlineSupport', 'FcOk', 'FcReading', 'FcRules', 'FcSerialTasks'
    ]
  };

  useEffect(() => {
    if (!tenantId) return;

    const timeout = setTimeout(() => {
      setFetching(false);
    }, 5000);

    // Fetch School Settings
    const settingsRef = getDBRef(tenantId, 'settings');
    const unsubSettings = onValue(settingsRef, (snapshot) => {
      clearTimeout(timeout);
      const data = snapshot.val();
      if (data) {
        setSettings({
          schoolName: data.schoolName || '',
          tagline: data.tagline || '',
          level: data.level || 'MTs',
          eServicesLayout: data.eServicesLayout || 'bento',
          logo: data.logo || '/logo.png',
          heroSlides: data.heroSlides || [],
          headmaster: data.headmaster || { name: '', greeting: '', photo: '' }
        });
        if (data.logo) setLogoPreview(data.logo);
        if (data.headmaster?.photo) setHmPreview(data.headmaster.photo);
      } else {
        setSettings(prev => ({
          ...prev,
          heroSlides: [] // Ensure heroSlides is an empty array if no data
        }));
      }
    });

    // Fetch E-Services
    const servicesRef = getDBRef(tenantId, 'e_services');
    const unsubServices = onValue(servicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setEServices(list);
      } else {
        setEServices([]);
      }
      setFetching(false);
    });

    return () => {
      unsubSettings();
      unsubServices();
      clearTimeout(timeout);
    };
  }, [tenantId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('hm_')) {
      const field = name.replace('hm_', '');
      setSettings(prev => ({
        ...prev,
        headmaster: { ...prev.headmaster, [field]: value }
      }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  // Logo Handlers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Headmaster Photo Handlers
  const handleHmPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setHmFile(file);
      setHmPreview(URL.createObjectURL(file));
    }
  };

  // Slide Handlers
  const handleSlideModalShow = (slide?: Slide) => {
    if (slide) {
      setCurrentSlide(slide);
      setSlideImagePreview(slide.url || null);
    } else {
      setCurrentSlide({ title: '', subtitle: '', url: '', link: '' });
      setSlideImageFile(null);
      setSlideImagePreview(null);
    }
    setShowSlideModal(true);
  };

  const handleSlideImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSlideImageFile(file);
      setSlideImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlideLoading(true);

    if (!currentSlide.title || !currentSlide.subtitle || !slideImagePreview) {
      setSlideLoading(false);
      return showAlert('Peringatan', 'Judul, deskripsi, dan gambar slide wajib diisi.', 'warning');
    }

    try {
      let imageUrl = slideImagePreview;

      if (slideImageFile) {
        const webpBlob = await convertToWebP(slideImageFile, 0.7);
        const fileName = `slide_${Date.now()}.webp`;
        const fileRef = getStorageRef(tenantId, `settings/slides/${fileName}`);
        const uploadResult = await uploadBytes(fileRef, webpBlob);
        imageUrl = await getDownloadURL(uploadResult.ref);
      }

      const newSlideData = {
        id: currentSlide.id || Date.now().toString(),
        title: currentSlide.title,
        subtitle: currentSlide.subtitle,
        url: imageUrl,
        link: currentSlide.link || ''
      };

      const updatedSlides = currentSlide.id
        ? settings.heroSlides.map(s => (s.id === currentSlide.id ? newSlideData : s))
        : [...settings.heroSlides, newSlideData];

      setSettings(prev => ({ ...prev, heroSlides: updatedSlides }));
      await set(getDBRef(tenantId, 'settings/heroSlides'), updatedSlides); // Update only slides path

      logActivity(tenantId, { 
        action: currentSlide.id ? 'EDIT' : 'TAMBAH', 
        target: 'SLIDESHOW', 
        title: `Slide: ${currentSlide.title}` 
      });

      setShowSlideModal(false);
      toast.fire({ icon: 'success', title: 'Slide berhasil disimpan' });

    } catch (error) {
      console.error("Error saving slide:", error);
      showAlert('Gagal', 'Gagal menyimpan slide.', 'error');
    } finally {
      setSlideLoading(false);
    }
  };

  const handleDeleteSlide = async (id: string, title: string) => {
    const result = await showConfirm('Hapus Slide?', `Slide "${title}" akan dihapus dari beranda.`);
    if (result.isConfirmed) {
      try {
        const updatedSlides = settings.heroSlides.filter(s => s.id !== id);
        setSettings(prev => ({ ...prev, heroSlides: updatedSlides }));
        await set(getDBRef(tenantId, 'settings/heroSlides'), updatedSlides);

        logActivity(tenantId, { action: 'HAPUS', target: 'SLIDESHOW', title: `Slide: ${title}` });
        toast.fire({ icon: 'success', title: 'Slide dihapus' });
      } catch (error) {
        showAlert('Gagal', 'Gagal menghapus slide.', 'error');
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let logoUrl = settings.logo;
      if (logoFile) {
        const webpBlob = await convertToWebP(logoFile, 0.7);
        const fileName = `logo_${Date.now()}.webp`;
        const fileRef = getStorageRef(tenantId, `settings/logo/${fileName}`);
        const uploadResult = await uploadBytes(fileRef, webpBlob);
        logoUrl = await getDownloadURL(uploadResult.ref);
      }

      let hmPhotoUrl = settings.headmaster.photo;
      if (hmFile) {
        const webpBlob = await convertToWebP(hmFile, 0.7);
        const fileName = `headmaster_${Date.now()}.webp`;
        const fileRef = getStorageRef(tenantId, `settings/headmaster/${fileName}`);
        const uploadResult = await uploadBytes(fileRef, webpBlob);
        hmPhotoUrl = await getDownloadURL(uploadResult.ref);
      }

      const finalSettings = { 
        ...settings, 
        logo: logoUrl,
        headmaster: { ...settings.headmaster, photo: hmPhotoUrl }
      };
      
      await set(getDBRef(tenantId, 'settings'), finalSettings);
      showAlert('Berhasil', 'Pengaturan berhasil disimpan!', 'success');
      logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: 'Update Pengaturan' });
    } catch (error) {
      console.error("Error saving settings:", error);
      showAlert('Gagal', 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // E-Service Handlers
  const handleSaveEService = async () => {
    if (!currentEService.title || !currentEService.url) {
      return showAlert('Peringatan', 'Mohon isi nama dan URL layanan.', 'warning');
    }
    
    try {
      if (currentEService.id) {
        await set(getDBRef(tenantId, `e_services/${currentEService.id}`), currentEService);
        logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: `Update E-Layanan: ${currentEService.title}` });
      } else {
        await push(getDBRef(tenantId, 'e_services'), currentEService);
        await updateCounter(tenantId, 'totalEServices', 1);
        logActivity(tenantId, { action: 'TAMBAH', target: 'SETTINGS', title: `Tambah E-Layanan: ${currentEService.title}` });
      }
      setShowEServiceModal(false);
      toast.fire({ icon: 'success', title: 'Layanan berhasil disimpan' });
    } catch (error) {
      showAlert('Gagal', 'Gagal menyimpan layanan.', 'error');
    }
  };

  const handleDeleteEService = async (id: string, title: string) => {
    const result = await showConfirm('Hapus Layanan?', `Layanan "${title}" akan dihapus permanen.`);
    if (result.isConfirmed) {
      try {
        await remove(getDBRef(tenantId, `e_services/${id}`));
        await updateCounter(tenantId, 'totalEServices', -1);
        logActivity(tenantId, { action: 'HAPUS', target: 'SETTINGS', title: `Hapus E-Layanan: ${title}` });
        toast.fire({ icon: 'success', title: 'Layanan dihapus' });
      } catch (error) {
        showAlert('Gagal', 'Gagal menghapus layanan.', 'error');
      }
    }
  };

  if (fetching) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0">
        <Form onSubmit={handleSaveSettings}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h4 className="fw-bold text-dark mb-1">Pengaturan {terms.school}</h4>
              <p className="text-muted small mb-0">Kelola identitas dan tampilan website {terms.school.toLowerCase()} Anda.</p>
            </div>
            <Button type="submit" variant="success" className="px-4 py-2 fw-bold shadow-sm" disabled={loading}>
              {loading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />}
              SIMPAN SEMUA PENGATURAN
            </Button>
          </div>

          <Row>
            <Col lg={8}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white py-3 border-bottom">
                  <h6 className="fw-bold mb-0 small">Identitas & Logo</h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <Row>
                    <Col md={8}>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold small">Jenjang {terms.school}</Form.Label>
                        <Form.Select name="level" value={settings.level} onChange={handleInputChange}>
                          <option value="SD">SD (Sekolah Dasar)</option>
                          <option value="MI">MI (Madrasah Ibtidaiyah)</option>
                          <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                          <option value="MTs">MTs (Madrasah Tsanawiyah)</option>
                          <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                          <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
                          <option value="MA">MA (Madrasah Aliyah)</option>
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold small">Nama {terms.school}</Form.Label>
                        <Form.Control name="schoolName" value={settings.schoolName} onChange={handleInputChange} required placeholder={`Contoh: ${settings.level} Negeri 1 Garut`} />
                      </Form.Group>
                      <Form.Group className="mb-4">
                        <Form.Label className="fw-bold small">Tagline / Motto</Form.Label>
                        <Form.Control name="tagline" value={settings.tagline} onChange={handleInputChange} placeholder="Misal: Unggul, Religius, Berbudaya" />
                      </Form.Group>
                    </Col>
                    <Col md={4} className="text-center">
                      <Form.Label className="fw-bold small d-block">Logo {terms.school}</Form.Label>
                      <div className="bg-light border rounded p-2 mb-2 mx-auto" style={{ width: '100px', height: '100px' }}>
                        {logoPreview ? <img src={logoPreview} className="img-fluid h-100 object-fit-contain" alt="Logo" /> : <FaImage className="text-muted fs-2 mt-3" />}
                      </div>
                      <Form.Control type="file" id="logo-upload" className="d-none" onChange={handleLogoChange} accept="image/*" />
                      <Button as="label" htmlFor="logo-upload" variant="outline-success" size="sm" className="pointer">Ubah Logo</Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                  <h6 className="fw-bold mb-0 small">Slide Show Beranda (Hero)</h6>
                  <Button variant="outline-success" size="sm" className="d-flex align-items-center" onClick={() => handleSlideModalShow()}>
                    <FaPlus className="me-2" /> Tambah Slide
                  </Button>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0 align-middle">
                    <thead className="bg-light">
                      <tr className="small text-muted">
                        <th className="ps-4 border-0">GAMBAR</th>
                        <th className="border-0">TEXT</th>
                        <th className="text-end pe-4 border-0">AKSI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.heroSlides.length === 0 ? (
                        <tr><td colSpan={3} className="text-center py-4 text-muted small">Belum ada slide.</td></tr>
                      ) : (
                        settings.heroSlides.map((slide) => (
                          <tr key={slide.id}>
                            <td className="ps-4 py-3">
                              <img src={slide.url} className="rounded border" style={{ width: '100px', height: '60px', objectFit: 'cover' }} alt="" />
                            </td>
                            <td className="small">
                              <div className="fw-bold">{slide.title}</div>
                              <div className="text-muted truncate-1">{slide.subtitle}</div>
                              {slide.link && <a href={slide.link} target="_blank" rel="noopener noreferrer" className="extra-small text-info text-decoration-none d-block truncate-1">{slide.link}</a>}
                            </td>
                            <td className="text-end pe-4">
                              <Button variant="light" size="sm" className="btn-icon me-2" onClick={() => handleSlideModalShow(slide)}>
                                <FaEdit size={12} />
                              </Button>
                              <Button variant="outline-danger" size="sm" onClick={() => handleDeleteSlide(slide.id, slide.title)}>
                                <FaTrash size={12} />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white py-3 border-bottom">
                  <h6 className="fw-bold mb-0 small">Tampilan & Tata Letak</h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <Form.Group>
                    <Form.Label className="fw-bold small d-block mb-3">Pilih Layout Menu E-Layanan</Form.Label>
                    <Row>
                      <Col md={6}>
                        <div 
                          className={`p-3 border rounded-3 pointer position-relative ${settings.eServicesLayout === 'bento' ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'}`}
                          onClick={() => setSettings({...settings, eServicesLayout: 'bento'})}
                        >
                          <div className="d-flex align-items-center mb-2">
                            <FaThLarge className={`me-2 ${settings.eServicesLayout === 'bento' ? 'text-primary' : 'text-muted'}`} />
                            <h6 className="mb-0 small fw-bold">Bento Grid (Modern)</h6>
                          </div>
                          <p className="extra-small text-muted mb-0">Tampilan kotak bervariasi yang elegan dan premium. Cocok untuk menonjolkan satu layanan utama.</p>
                          {settings.eServicesLayout === 'bento' && <div className="position-absolute top-0 end-0 p-2"><Badge bg="primary">Terpilih</Badge></div>}
                        </div>
                      </Col>
                      <Col md={6}>
                        <div 
                          className={`p-3 border rounded-3 pointer position-relative ${settings.eServicesLayout === 'slider' ? 'border-primary bg-primary bg-opacity-10' : 'bg-light'}`}
                          onClick={() => setSettings({...settings, eServicesLayout: 'slider'})}
                        >
                          <div className="d-flex align-items-center mb-2">
                            <FaEllipsisH className={`me-2 ${settings.eServicesLayout === 'slider' ? 'text-primary' : 'text-muted'}`} />
                            <h6 className="mb-0 small fw-bold">Menu Slider (Minimalis)</h6>
                          </div>
                          <p className="extra-small text-muted mb-0">Tampilan list horizontal yang bisa digeser. Hemat ruang dan sangat rapi.</p>
                          {settings.eServicesLayout === 'slider' && <div className="position-absolute top-0 end-0 p-2"><Badge bg="primary">Terpilih</Badge></div>}
                        </div>
                      </Col>
                    </Row>
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>
            
            <Col lg={4}>
              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white py-3 border-bottom">
                  <h6 className="fw-bold mb-0 small">Profil {terms.headmaster}</h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <div className="text-center mb-4">
                    <div className="bg-light border rounded-3 p-2 mb-3 mx-auto overflow-hidden" style={{ width: '150px', height: '180px' }}>
                      {hmPreview ? (
                        <img src={hmPreview} className="img-fluid h-100 w-100 object-fit-cover rounded" alt={terms.headmaster} />
                      ) : (
                        <div className="h-100 d-flex align-items-center justify-content-center flex-column text-muted">
                          <FaUserTie size={50} className="mb-2" />
                          <small>Belum ada foto</small>
                        </div>
                      )}
                    </div>
                    <Form.Control type="file" id="hm-upload" className="d-none" onChange={handleHmPhotoChange} accept="image/*" />
                    <Button as="label" htmlFor="hm-upload" variant="outline-primary" size="sm" className="pointer px-3">Ganti Foto</Button>
                  </div>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Nama {terms.headmaster}</Form.Label>
                    <Form.Control 
                      name="hm_name" 
                      value={settings.headmaster.name} 
                      onChange={handleInputChange} 
                      placeholder="Masukkan nama lengkap & gelar" 
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">Sambutan / Greeting</Form.Label>
                    <Form.Control 
                      as="textarea" 
                      rows={6} 
                      name="hm_greeting" 
                      value={settings.headmaster.greeting} 
                      onChange={handleInputChange} 
                      placeholder={`Tulis sambutan hangat untuk pengunjung website ${terms.school.toLowerCase()}...`} 
                    />
                  </Form.Group>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                  <h6 className="fw-bold mb-0 small">Manajemen E-Layanan</h6>
                  <Button variant="outline-primary" size="sm" onClick={() => {
                    setCurrentEService({ title: '', url: '', bgColor: '#198754', textColor: '#ffffff', icon: '🎓', iconType: 'emoji' });
                    setShowEServiceModal(true);
                  }}>
                    <FaPlus size={10} />
                  </Button>
                </Card.Header>
                <Card.Body className="p-3">
                  {eServices.length === 0 ? (
                    <div className="text-center py-3 text-muted extra-small">Belum ada layanan.</div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {eServices.map((svc) => (
                        <div key={svc.id} className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center border-0 border-bottom">
                          <div className="d-flex align-items-center overflow-hidden">
                            <span className="me-2 d-flex align-items-center" style={{ width: '24px', height: '24px' }}>
                              <IconRenderer icon={svc.icon} type={svc.iconType || 'emoji'} size="1.2rem" />
                            </span>
                            <span className="small fw-bold text-truncate">{svc.title}</span>
                          </div>
                          <div className="d-flex gap-1">
                            <Button variant="link" size="sm" className="p-0 text-muted" onClick={() => {
                              setCurrentEService(svc);
                              setShowEServiceModal(true);
                            }}>Edit</Button>
                            <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => handleDeleteEService(svc.id, svc.title)}>Hapus</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      </Container>

      {/* E-Service Modal */}
      <Modal show={showEServiceModal} onHide={() => setShowEServiceModal(false)} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold h5">{currentEService.id ? 'Edit Layanan' : 'Tambah Layanan Baru'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Row>
            <Col md={7}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">Nama Layanan</Form.Label>
                <Form.Control 
                  value={currentEService.title} 
                  onChange={(e) => setCurrentEService({...currentEService, title: e.target.value})} 
                  placeholder="Misal: E-Learning, PPDB Online" 
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold small">URL / Link Tujuan</Form.Label>
                <Form.Control 
                  value={currentEService.url} 
                  onChange={(e) => setCurrentEService({...currentEService, url: e.target.value})} 
                  placeholder="https://..." 
                />
              </Form.Group>
              
              <Row className="mb-3">
                <Col xs={6}>
                  <Form.Label className="fw-bold small">Warna Latar</Form.Label>
                  <div className="d-flex align-items-center gap-2 border p-1 rounded bg-white">
                    <Form.Control 
                      type="color" 
                      className="form-control-color border-0"
                      value={currentEService.bgColor} 
                      onChange={(e) => setCurrentEService({...currentEService, bgColor: e.target.value})}
                      title="Pilih warna latar"
                    />
                    <small className="text-muted extra-small font-monospace text-uppercase">{currentEService.bgColor}</small>
                  </div>
                </Col>
                <Col xs={6}>
                  <Form.Label className="fw-bold small">Warna Teks</Form.Label>
                  <div className="d-flex align-items-center gap-2 border p-1 rounded bg-white">
                    <Form.Control 
                      type="color" 
                      className="form-control-color border-0"
                      value={currentEService.textColor} 
                      onChange={(e) => setCurrentEService({...currentEService, textColor: e.target.value})}
                      title="Pilih warna teks"
                    />
                    <small className="text-muted extra-small font-monospace text-uppercase">{currentEService.textColor}</small>
                  </div>
                </Col>
              </Row>
            </Col>
            
            <Col md={5}>
              <Form.Label className="fw-bold small d-block">Pilih Ikon Layanan</Form.Label>
              <div className="border rounded bg-light overflow-hidden">
                <Tab.Container defaultActiveKey={currentEService.iconType || 'emoji'}>
                  <Nav variant="tabs" className="bg-white px-2 pt-2 border-0">
                    <Nav.Item>
                      <Nav.Link eventKey="emoji" className="px-3 py-2 small" onClick={() => setCurrentEService({...currentEService, iconType: 'emoji'})}><FaSmile /></Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="bi" className="px-3 py-2 small" onClick={() => setCurrentEService({...currentEService, iconType: 'bi'})}><FaBootstrap /></Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="fa" className="px-3 py-2 small" onClick={() => setCurrentEService({...currentEService, iconType: 'fa'})}><FaFontAwesome /></Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="hi" className="px-3 py-2 small" onClick={() => setCurrentEService({...currentEService, iconType: 'hi'})}><FaCode /></Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="fc" className="px-3 py-2 small" onClick={() => setCurrentEService({...currentEService, iconType: 'fc'})}><FaImage /></Nav.Link>
                    </Nav.Item>
                  </Nav>
                  <Tab.Content className="p-3" style={{ height: '200px', overflowY: 'auto' }}>
                    {Object.entries(iconSets).map(([type, icons]) => (
                      <Tab.Pane key={type} eventKey={type}>
                        <div className="emoji-grid">
                          {icons.map((iconName, idx) => (
                            <div 
                              key={idx} 
                              className={`emoji-item p-2 text-center pointer rounded d-flex align-items-center justify-content-center ${currentEService.icon === iconName ? 'bg-primary text-white' : ''}`}
                              onClick={() => setCurrentEService({...currentEService, icon: iconName, iconType: type as any})}
                              title={iconName}
                            >
                              <IconRenderer icon={iconName} type={type as any} size="1.4rem" />
                            </div>
                          ))}
                        </div>
                      </Tab.Pane>
                    ))}
                  </Tab.Content>
                </Tab.Container>
              </div>
              <div className="text-center mt-3 p-2 border rounded bg-white shadow-sm">
                <small className="text-muted d-block mb-1 Extra Small">Pratinjau Tampilan</small>
                <div 
                  className="rounded shadow-sm p-3 mx-auto d-flex flex-column align-items-center justify-content-center" 
                  style={{ 
                    backgroundColor: currentEService.bgColor, 
                    color: currentEService.textColor,
                    width: '100px',
                    height: '100px'
                  }}
                >
                  <div className="fs-3 mb-1 d-flex align-items-center">
                    <IconRenderer icon={currentEService.icon || '🎓'} type={currentEService.iconType || 'emoji'} />
                  </div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 'bold' }} className="text-truncate w-100">{currentEService.title || 'Judul'}</div>
                </div>
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="light" onClick={() => setShowEServiceModal(false)}>Batal</Button>
          <Button variant="primary" onClick={handleSaveEService}>Simpan Layanan</Button>
        </Modal.Footer>
      </Modal>

      {/* Slide Modal */}
      <Modal show={showSlideModal} onHide={() => setShowSlideModal(false)} centered size="lg">
        <Form onSubmit={handleSaveSlide}>
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold h5">{currentSlide.id ? 'Edit Slide' : 'Tambah Slide Baru'}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Row>
              <Col md={7}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold small">Judul Slide</Form.Label>
                  <Form.Control 
                    value={currentSlide.title} 
                    onChange={(e) => setCurrentSlide({...currentSlide, title: e.target.value})}
                    placeholder="Misal: Penerimaan Santri Baru"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold small">Deskripsi Singkat</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={3} 
                    value={currentSlide.subtitle} 
                    onChange={(e) => setCurrentSlide({...currentSlide, subtitle: e.target.value})}
                    placeholder="Jelaskan singkat tentang slide ini"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold small">URL Link (Opsional)</Form.Label>
                  <Form.Control 
                    type="url" 
                    value={currentSlide.link} 
                    onChange={(e) => setCurrentSlide({...currentSlide, link: e.target.value})}
                    placeholder="https://domain.com/berita-terbaru"
                  />
                  <Form.Text className="text-muted">Link akan dibuka di tab baru.</Form.Text>
                </Form.Group>
              </Col>
              <Col md={5} className="text-center">
                <Form.Label className="fw-bold small d-block">Gambar Slide</Form.Label>
                <div className="border rounded bg-light overflow-hidden mb-3">
                  {slideImagePreview ? (
                    <img src={slideImagePreview} className="img-fluid" style={{ maxHeight: '180px', width: '100%', objectFit: 'cover' }} alt="Preview" />
                  ) : (
                    <div className="p-5 text-muted"><FaImage size={50} /> <p className="small mb-0">Pilih gambar</p></div>
                  )}
                </div>
                <Form.Control type="file" id="slide-image-upload" className="d-none" onChange={handleSlideImageChange} accept="image/*" />
                <Button as="label" htmlFor="slide-image-upload" variant="outline-primary" size="sm" className="w-100">
                  <FaCloudUploadAlt className="me-2" /> Upload Gambar Baru
                </Button>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="light" onClick={() => setShowSlideModal(false)}>Batal</Button>
            <Button type="submit" variant="primary" disabled={slideLoading}>
              {slideLoading ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Slide
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <style>{`
        .extra-small { font-size: 0.75rem; }
        .truncate-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .pointer { cursor: pointer; }
        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
          gap: 5px;
        }
        .emoji-item:hover:not(.bg-primary) {
          background-color: #f0f2f5;
        }
        .nav-tabs .nav-link { border: 1px solid transparent; color: #6c757d; }
        .nav-tabs .nav-link.active { background-color: transparent; border-bottom: 2px solid var(--bs-primary); color: var(--bs-primary); font-weight: bold; }
        .form-control-color { width: 40px; height: 30px; padding: 0; }
      `}</style>
    </DashboardLayout>
  );
};

export default Settings;
