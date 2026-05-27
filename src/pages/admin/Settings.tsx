import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Spinner, ListGroup, Modal, Badge, Tabs, Tab } from 'react-bootstrap';
import { FaSave, FaTrash, FaPlus, FaSchool, FaImage, FaUserTie, FaExternalLinkAlt, FaEdit, FaCogs, FaHistory, FaCheckCircle, FaTimesCircle, FaEye, FaPhone, FaEnvelope, FaMapMarkerAlt, FaLocationArrow, FaFacebook, FaInstagram, FaYoutube, FaSyncAlt } from 'react-icons/fa';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter } from '../../firebase/utils';
import { onValue, set, push, remove, update } from 'firebase/database';
import { uploadBytes, getDownloadURL, ref, deleteObject } from 'firebase/storage';
import { convertToWebP, convertHeroImage, convertUrlToWebP } from '../../firebase/imageUtils';
import type { ImageMetadata } from '../../firebase/imageUtils';
import { getImageMetadata, getStoragePathFromDownloadURL } from '../../firebase/imageUtils';
import { showAlert, toast, showConfirm } from '../../utils/alerts';
import { storage } from '../../firebase/config';
import IconRenderer from '../../components/IconRenderer';
import LocationMapPicker from '../../components/LocationMapPicker';
import ProgressiveImage from '../../components/ProgressiveImage';

interface HeroSlide {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  objectFit: 'cover' | 'contain' | 'fill';
  metadata?: ImageMetadata | null;
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

interface ProfileContent {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
  order: number;
}

const Settings: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [activeSubTab, setActiveSubTab] = useState('identity');

  const [formData, setFormData] = useState({
    schoolName: '',
    tagline: '',
    logo: '',
    eServicesLayout: 'bento' as 'bento' | 'slider',
    headmaster: { name: '', photo: '', greeting: '' },
    contact: { phone: '', email: '', address: '', lat: '', lng: '', mapZoom: 15 },
    socialMedia: { facebook: '', instagram: '', youtube: '', twitter: '', linkedin: '', telegram: '' }
  });

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [eServices, setEServices] = useState<EService[]>([]);
  const [profiles, setProfiles] = useState<ProfileContent[]>([]);
  
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [headmasterPhotoFile, setHeadmasterPhotoFile] = useState<File | null>(null);
  const [newSlideFile, setNewSlideFile] = useState<File | null>(null);
  const [newSlideData, setNewSlideData] = useState({ title: '', subtitle: '', objectFit: 'cover' as 'cover' | 'contain' | 'fill' });
  
  const [logoMetadata, setLogoMetadata] = useState<ImageMetadata | null>(null);
  const [headmasterPhotoMetadata, setHeadmasterPhotoMetadata] = useState<ImageMetadata | null>(null);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [currentService, setCurrentService] = useState<Partial<EService>>({
     title: '', url: '', bgColor: '#198754', textColor: '#ffffff', icon: '🚀', iconType: 'emoji'
  });

  const [showSlideModal, setShowSlideModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState<Partial<HeroSlide>>({});

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Partial<ProfileContent>>({
    title: '', content: '', isActive: true, order: 0
  });

  const [isReconverting, setIsReconverting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reconvertedBlob, setReconvertedBlob] = useState<Blob | null>(null);
  const [reconvertedPreviewUrl, setReconvertedPreviewUrl] = useState<string | null>(null);
  const [reconvertTarget, setReconvertTarget] = useState<{ type: 'logo' | 'headmaster' | 'slide'; id?: string; url?: string } | null>(null);

  const iconOptions = {
    emoji: ['🚀', '🏫', '📚', '🎓', '📅', '📢', '💻', '🌍', '🏠', '📝', '🏆', '⚽', '🎨', '🔬', '💡'],
    fa: ['FaHome', 'FaUser', 'FaBook', 'FaInfoCircle', 'FaPhone', 'FaGraduationCap', 'FaGlobe', 'FaEnvelope', 'FaLaptop', 'FaRegListAlt', 'FaBullhorn', 'FaUsers', 'FaBriefcase', 'FaChartLine', 'FaCloud'],
    bi: ['BiHome', 'BiUser', 'BiBook', 'BiInfoCircle', 'BiPhone', 'BiMap', 'BiGlobe', 'BiEnvelope', 'BiLaptop', 'BiListUl', 'BiNews', 'BiCamera', 'BiCloudUpload', 'BiBriefcase', 'BiTrophy'],
    hi: ['HiHome', 'HiUser', 'HiBookOpen', 'HiInformationCircle', 'HiPhone', 'HiMail', 'HiGlobeAlt', 'HiAcademicCap', 'HiCalendar', 'HiBell', 'HiBriefcase', 'HiChip', 'HiCamera', 'HiChartBar', 'HiCloud'],
    fc: ['FcHome', 'FcAbout', 'FcAddressBook', 'FcBullhorn', 'FcCalendar', 'FcConferenceCall', 'FcDocument', 'FcEngineering', 'FcGraduationCap', 'FcInfo', 'FcLibrary', 'FcLink', 'FcPortraitMode', 'FcPositiveDynamic', 'FcSettings']
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (!tenantId) return;

    const unsubSettings = onValue(getDBRef(tenantId, 'settings'), async (snap) => {
      const data = snap.val();
      if (data) {
        setFormData({
          schoolName: data.schoolName || '',
          tagline: data.tagline || '',
          logo: data.logo || '',
          eServicesLayout: data.eServicesLayout || 'bento',
          headmaster: data.headmaster || { name: '', photo: '', greeting: '' },
          contact: data.contact || { phone: '', email: '', address: '', lat: '', lng: '', mapZoom: 15 },
          socialMedia: data.socialMedia || { facebook: '', instagram: '', youtube: '', twitter: '', linkedin: '', telegram: '' }
        });
        
        const slidesRaw = data.heroSlides ? (Array.isArray(data.heroSlides) ? data.heroSlides : Object.values(data.heroSlides)) : [];
        const slidesWithMetadata = await Promise.all(
          slidesRaw.map(async (slide: any) => {
            if (slide.url) {
              const storagePath = getStoragePathFromDownloadURL(slide.url);
              if (storagePath) {
                const metadata = await getImageMetadata(storagePath);
                return { ...slide, metadata };
              }
            }
            return slide;
          })
        );
        setHeroSlides(slidesWithMetadata);

        if (data.logo && !data.logo.startsWith('/')) {
          const storagePath = getStoragePathFromDownloadURL(data.logo);
          if (storagePath) setLogoMetadata(await getImageMetadata(storagePath)); else setLogoMetadata(null);
        } else setLogoMetadata(null);
        if (data.headmaster?.photo && !data.headmaster.photo.startsWith('/')) {
          const storagePath = getStoragePathFromDownloadURL(data.headmaster.photo);
          if (storagePath) setHeadmasterPhotoMetadata(await getImageMetadata(storagePath)); else setHeadmasterPhotoMetadata(null);
        } else setHeadmasterPhotoMetadata(null);
      }
      setLoading(false);
    });

    const unsubServices = onValue(getDBRef(tenantId, 'e_services'), (snap) => {
      setEServices(snap.exists() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })) : []);
    });

    const unsubProfiles = onValue(getDBRef(tenantId, 'profiles'), (snap) => {
      setProfiles(snap.exists() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).sort((a,b) => a.order - b.order) : []);
    });

    return () => { unsubSettings(); unsubServices(); unsubProfiles(); };
  }, [tenantId]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    try {
      let finalLogo = formData.logo;
      let headmasterPhoto = formData.headmaster.photo;

      if (newLogoFile) {
        const webpBlob = await convertToWebP(newLogoFile);
        const fileRef = getStorageRef(tenantId, `settings/logo/logo_${Date.now()}.webp`);
        await uploadBytes(fileRef, webpBlob);
        finalLogo = await getDownloadURL(fileRef);

        if (formData.logo) {
          try { await deleteObject(ref(storage, formData.logo)); } catch (err: any) { if (err.code !== 'storage/object-not-found') console.error("Gagal hapus logo lama:", err); }
        }
      }

      if (headmasterPhotoFile) {
        const webpBlob = await convertToWebP(headmasterPhotoFile);
        const fileRef = getStorageRef(tenantId, `settings/headmaster/hm_${Date.now()}.webp`);
        await uploadBytes(fileRef, webpBlob);
        headmasterPhoto = await getDownloadURL(fileRef);

        if (formData.headmaster.photo) {
          try { await deleteObject(ref(storage, formData.headmaster.photo)); } catch (err: any) { if (err.code !== 'storage/object-not-found') console.error("Gagal hapus foto lama:", err); }
        }
      }

      const updatedData = { ...formData, logo: finalLogo, headmaster: { ...formData.headmaster, photo: headmasterPhoto } };
      await set(getDBRef(tenantId, 'settings'), { ...updatedData, heroSlides: heroSlides.map(({metadata, ...s}) => s) });
      await logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: 'Update Profil & Identitas Utama' });
      
      setNewLogoFile(null);
      setHeadmasterPhotoFile(null);
      toast.fire({ icon: 'success', title: 'Pengaturan berhasil disimpan' });
    } catch (err: any) { 
      showAlert('Gagal', err.message || 'Gagal menyimpan pengaturan.', 'error');
    } finally { setSaving(false); }
  };

  const handleSlideFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSaving(true);
      try {
        const convertedBlob = await convertHeroImage(file);
        const webpFile = new File([convertedBlob], `${Date.now()}.webp`, { type: 'image/webp' });
        setNewSlideFile(webpFile);
      } catch (error: any) {
        showAlert('Konversi Gagal', error.message, 'error');
        e.target.value = '';
        setNewSlideFile(null);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleAddSlide = async () => {
    if (!tenantId || !newSlideFile) return;
    setSaving(true);
    try {
      const fileRef = getStorageRef(tenantId, `settings/slides/${newSlideFile.name}`);
      await uploadBytes(fileRef, newSlideFile);
      const url = await getDownloadURL(fileRef);

      const newSlide: HeroSlide = {
        id: Date.now().toString(),
        url,
        title: newSlideData.title,
        subtitle: newSlideData.subtitle,
        objectFit: newSlideData.objectFit
      };

      const updatedSlides = [...heroSlides, newSlide];
      await set(getDBRef(tenantId, 'settings/heroSlides'), updatedSlides.map(({metadata, ...s}) => s));
      setHeroSlides(updatedSlides);
      setNewSlideFile(null);
      setNewSlideData({ title: '', subtitle: '', objectFit: 'cover' });
      await logActivity(tenantId, { action: 'TAMBAH', target: 'SLIDESHOW', title: `Slide: ${newSlide.title}` });
      toast.fire({ icon: 'success', title: 'Slide berhasil ditambahkan' });
    } catch (err) { showAlert('Gagal', 'Gagal upload slide.', 'error'); } finally { setSaving(false); }
  };

  const handleDeleteSlide = async (id: string, title: string) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Slide?', title)).isConfirmed) {
      const slideToDelete = heroSlides.find(s => s.id === id);
      if (slideToDelete?.url) {
        try { await deleteObject(ref(storage, slideToDelete.url)); } catch (err: any) { if (err.code !== 'storage/object-not-found') console.error("Gagal hapus gambar slide lama:", err); }
      }
      const updated = heroSlides.filter(s => s.id !== id);
      await set(getDBRef(tenantId, 'settings/heroSlides'), updated.map(({metadata, ...s}) => s));
      setHeroSlides(updated);
      await logActivity(tenantId, { action: 'HAPUS', target: 'SLIDESHOW', title: `Slide: ${title}` });
    }
  };

  const handleSaveSlide = async () => {
    if (!tenantId || !currentSlide.id) return;
    setSaving(true);
    try {
      const updatedSlides = heroSlides.map(s => s.id === currentSlide.id ? { ...currentSlide as HeroSlide, metadata: s.metadata } : s);
      await set(getDBRef(tenantId, 'settings/heroSlides'), updatedSlides.map(({metadata, ...s}) => s));
      setHeroSlides(updatedSlides);
      setShowSlideModal(false);
      await logActivity(tenantId, { action: 'EDIT', target: 'SLIDESHOW', title: `Slide: ${currentSlide.title}` });
      toast.fire({ icon: 'success', title: 'Slide berhasil diperbarui' });
    } catch(err) {
      showAlert('Gagal', 'Gagal menyimpan perubahan slide.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReconvertClick = async (target: { type: 'logo' | 'headmaster' | 'slide'; id?: string; url?: string }) => {
    let imageUrl: string | undefined;
    if (target.type === 'logo') imageUrl = formData.logo;
    else if (target.type === 'headmaster') imageUrl = formData.headmaster.photo;
    else if (target.type === 'slide') imageUrl = target.url;
    
    if (!imageUrl) return;

    const result = await showConfirm('Konversi Ulang Gambar?', 'Gambar ini akan dikonversi ke format WebP (maks 100KB). Lanjutkan?');
    if (!result.isConfirmed) return;

    setIsReconverting(true);
    setReconvertTarget(target);
    try {
      const blob = await convertUrlToWebP(imageUrl, { maxSizeBytes: 100 * 1024 });
      setReconvertedBlob(blob);
      setReconvertedPreviewUrl(URL.createObjectURL(blob));
      setShowPreviewModal(true);
    } catch (error: any) {
      showAlert('Gagal Konversi', error.message, 'error');
    } finally {
      setIsReconverting(false);
    }
  };

  const handleSaveReconvertedImage = async () => {
    if (!reconvertedBlob || !tenantId || !reconvertTarget) return;
    setIsReconverting(true);
    
    try {
      const { type, id, url: oldUrl } = reconvertTarget;
      const fileName = `${type}_${Date.now()}_reconverted.webp`;
      let storagePath: string;
      
      if (type === 'slide' && id) {
        storagePath = `settings/slides/${id}_${fileName}`;
      } else if (type === 'logo') {
        storagePath = `settings/logo/${fileName}`;
      } else if (type === 'headmaster') {
        storagePath = `settings/headmaster/${fileName}`;
      } else {
        throw new Error("Tipe rekonversi tidak valid.");
      }

      const fileRef = getStorageRef(tenantId, storagePath);
      await uploadBytes(fileRef, reconvertedBlob);
      const newUrl = await getDownloadURL(fileRef);

      if (type === 'logo') {
        const updates: any = { logo: newUrl };
        await update(getDBRef(tenantId, 'settings'), updates);
        setFormData(prev => ({ ...prev, logo: newUrl }));
        setLogoMetadata(await getImageMetadata(storagePath));
      } else if (type === 'headmaster') {
        const updates: any = { headmaster: { ...formData.headmaster, photo: newUrl } };
        await update(getDBRef(tenantId, 'settings'), updates);
        setFormData(prev => ({ ...prev, headmaster: { ...prev.headmaster, photo: newUrl } }));
        setHeadmasterPhotoMetadata(await getImageMetadata(storagePath));
      } else if (type === 'slide' && id) {
        const updatedSlides = heroSlides.map(s => s.id === id ? { ...s, url: newUrl } : s);
        await set(getDBRef(tenantId, 'settings/heroSlides'), updatedSlides.map(({metadata, ...s}) => s));
        setHeroSlides(updatedSlides);
        setCurrentSlide(prev => ({...prev, url: newUrl, metadata: null})); // Clear metadata, it will be refetched by useEffect
      }
      
      if (oldUrl) {
        try { await deleteObject(ref(storage, oldUrl)); } catch (err: any) { if (err.code !== 'storage/object-not-found') console.error("Gagal hapus gambar lama setelah rekonversi:", err); }
      }

      setShowPreviewModal(false);
      if(reconvertedPreviewUrl) URL.revokeObjectURL(reconvertedPreviewUrl);
      setReconvertedBlob(null);
      setReconvertedPreviewUrl(null);
      setReconvertTarget(null);

      await logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: `Rekonversi gambar ${type}` });
      toast.fire({ icon: 'success', title: 'Gambar berhasil dikonversi ulang' });

    } catch (error: any) {
      showAlert('Gagal Menyimpan', error.message, 'error');
    } finally {
      setIsReconverting(false);
    }
  };

  const handleSaveService = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      if (currentService.id) {
        await set(getDBRef(tenantId, `e_services/${currentService.id}`), currentService);
        await logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: `Update Layanan: ${currentService.title}` });
      } else {
        const newRef = push(getDBRef(tenantId, 'e_services'));
        await set(newRef, { ...currentService, id: newRef.key });
        await updateCounter(tenantId, 'totalEServices', 1);
        await logActivity(tenantId, { action: 'TAMBAH', target: 'SETTINGS', title: `Tambah Layanan: ${currentService.title}` });
      }
      setShowServiceModal(false);
      toast.fire({ icon: 'success', title: 'Layanan berhasil disimpan' });
    } catch (error) { showAlert('Gagal', 'Gagal menyimpan layanan.', 'error'); } 
    finally { setSaving(false); }
  };

  const handleDeleteEService = async (id: string, title: string) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Layanan?', title)).isConfirmed) {
      await remove(getDBRef(tenantId, `e_services/${id}`));
      await updateCounter(tenantId, 'totalEServices', -1);
      await logActivity(tenantId, { action: 'HAPUS', target: 'SETTINGS', title: `Hapus Layanan: ${title}` });
    }
  };

  const handleSaveProfile = async () => {
    if (!tenantId || !currentProfile.title) return;
    setSaving(true);
    try {
      const slug = currentProfile.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const data = { ...currentProfile, slug };
      
      if (currentProfile.id) {
        await set(getDBRef(tenantId, `profiles/${currentProfile.id}`), data);
        await logActivity(tenantId, { action: 'EDIT', target: 'PROFIL', title: `Update: ${data.title}` });
      } else {
        const newRef = push(getDBRef(tenantId, 'profiles'));
        await set(newRef, { ...data, id: newRef.key, order: profiles.length });
        await logActivity(tenantId, { action: 'TAMBAH', target: 'PROFIL', title: `Tambah: ${data.title}` });
      }
      setShowProfileModal(false);
      toast.fire({ icon: 'success', title: 'Konten profil berhasil disimpan' });
    } catch (err) { showAlert('Gagal', 'Gagal menyimpan konten profil.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteProfile = async (id: string, title: string) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Konten Profil?', `Menghapus "${title}" juga akan menghilangkan menu ini dari halaman publik.`)).isConfirmed) {
      await remove(getDBRef(tenantId, `profiles/${id}`));
      await logActivity(tenantId, { action: 'HAPUS', target: 'PROFIL', title: `Hapus: ${title}` });
    }
  };

  const toggleProfileStatus = async (item: ProfileContent) => {
    if (!tenantId) return;
    await set(getDBRef(tenantId, `profiles/${item.id}/isActive`), !item.isActive);
    toast.fire({ icon: 'info', title: `Status ${item.title} diperbarui` });
  };

  const handleUpdateLayout = async (layout: 'bento' | 'slider') => {
    if (!tenantId) return;
    setSaving(true);
    try {
        await set(getDBRef(tenantId, 'settings/eServicesLayout'), layout);
        setFormData(prev => ({ ...prev, eServicesLayout: layout }));
        toast.fire({ icon: 'success', title: 'Layout diperbarui' });
    } catch (err) { showAlert('Gagal', 'Gagal update layout.', 'error'); }
    finally { setSaving(false); }
  };

  const needsReconversion = (metadata: ImageMetadata | null | undefined) => metadata && (metadata.fileExtension !== 'webp' || metadata.sizeBytes > 102400);

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4"><h4 className="fw-bold text-dark mb-0">Pengaturan {terms.school}</h4>{(saving) && <Badge bg="warning" className="text-dark border-0"><Spinner size="sm" className="me-1" /> Sedang Memproses...</Badge>}</div>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'general')} className="mb-4 custom-tabs border-0">
          <Tab eventKey="general" title={<><FaSchool className="me-2" /> Identitas & Profil</>}>
             <Card className="border-0 shadow-sm mb-4 rounded-4"><Card.Body className="p-4"><div className="d-flex gap-2 mb-4 bg-light p-2 rounded-3 sub-nav-container overflow-auto"><Button variant={activeSubTab === 'identity' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('identity')}><FaSchool className="me-2" /> Identitas Utama</Button><Button variant={activeSubTab === 'headmaster' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('headmaster')}><FaUserTie className="me-2" /> Profil {terms.headmaster}</Button><Button variant={activeSubTab === 'school' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('school')}><FaHistory className="me-2" /> Detail Konten Sekolah</Button><Button variant={activeSubTab === 'contact' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('contact')}><FaPhone className="me-2" /> Detail Kontak</Button></div>
                   {activeSubTab === 'identity' && (<Form onSubmit={handleSaveGeneral} className="animate-fade-in"><h6 className="fw-bold mb-4 text-success border-start border-3 border-success ps-2">Identitas Utama & Logo</h6><Row className="align-items-center mb-4"><Col md={3} className="text-center"><div className="mb-3 bg-white rounded-circle d-flex align-items-center justify-content-center border mx-auto shadow-sm position-relative" style={{ width: '150px', height: '150px', overflow: 'hidden' }}><ProgressiveImage src={newLogoFile ? URL.createObjectURL(newLogoFile) : formData.logo || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} className="img-fluid p-2" alt="Logo Preview"/></div>{logoMetadata && (<div className="d-flex justify-content-center align-items-center gap-2 mt-n2 mb-2"><span className="text-muted x-small">{formatBytes(logoMetadata.sizeBytes)} .{logoMetadata.fileExtension}</span>{needsReconversion(logoMetadata) && (<Button variant="link" className="p-0 text-warning" onClick={() => handleReconvertClick({type: 'logo', url: formData.logo})} disabled={isReconverting}><FaSyncAlt size={12} /></Button>)}</div>)}<input type="file" className="d-none" id="logo-upload" accept="image/png,image/jpeg" onChange={e => e.target.files && setNewLogoFile(e.target.files[0])} /><Button size="sm" variant="outline-success" className="rounded-pill px-3 fw-bold" onClick={() => document.getElementById('logo-upload')?.click()}>Ganti Logo</Button></Col><Col md={9}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted text-uppercase">NAMA {terms.school.toUpperCase()}</Form.Label><Form.Control value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} required className="fw-bold fs-5" /></Form.Group><Form.Group className="mb-0"><Form.Label className="x-small fw-bold text-muted">TAGLINE / SLOGAN</Form.Label><Form.Control value={formData.tagline} onChange={e => setFormData({...formData, tagline: e.target.value})} placeholder="Unggul dalam Prestasi..." /></Form.Group></Col></Row><hr className="my-4 opacity-50" /><div className="d-flex justify-content-end"><Button type="submit" variant="success" className="px-5 py-2 fw-bold shadow rounded-pill" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Identitas</Button></div></Form>)}
                   {activeSubTab === 'headmaster' && (<Form onSubmit={handleSaveGeneral} className="animate-fade-in"><h6 className="fw-bold mb-4 text-success border-start border-3 border-success ps-2">Profil {terms.headmaster}</h6><Row><Col md={8}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted text-uppercase">NAMA LENGKAP {terms.headmaster.toUpperCase()}</Form.Label><Form.Control value={formData.headmaster.name} onChange={e => setFormData({...formData, headmaster: {...formData.headmaster, name: e.target.value}})} className="fw-bold" /></Form.Group><Form.Group className="mb-0"><Form.Label className="x-small fw-bold text-muted">SAMBUTAN SINGKAT (HOME)</Form.Label><Form.Control as="textarea" rows={8} value={formData.headmaster.greeting} onChange={e => setFormData({...formData, headmaster: {...formData.headmaster, greeting: e.target.value}})} style={{ fontSize: '1rem', lineHeight: '1.6' }} /></Form.Group></Col><Col md={4}><div className="text-center mt-3 mt-md-0"><Form.Label className="x-small fw-bold text-muted d-block text-start">FOTO PROFIL</Form.Label><div className="mb-3 bg-light rounded-4 border mx-auto overflow-hidden shadow-sm position-relative" style={{ width: '100%', height: '250px' }}><ProgressiveImage src={headmasterPhotoFile ? URL.createObjectURL(headmasterPhotoFile) : formData.headmaster.photo || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} className="img-fluid h-100 w-100 object-fit-cover" alt="Headmaster" /></div>{headmasterPhotoMetadata && (<div className="d-flex justify-content-center align-items-center gap-2 mt-n2 mb-2"><span className="text-muted x-small">{formatBytes(headmasterPhotoMetadata.sizeBytes)} .{headmasterPhotoMetadata.fileExtension}</span>{needsReconversion(headmasterPhotoMetadata) && (<Button variant="link" className="p-0 text-warning" onClick={() => handleReconvertClick({type: 'headmaster', url: formData.headmaster.photo})} disabled={isReconverting}><FaSyncAlt size={12} /></Button>)}</div>)}<input type="file" className="d-none" id="hm-photo" accept="image/*" onChange={e => e.target.files && setHeadmasterPhotoFile(e.target.files[0])} /><Button variant="outline-success" className="rounded-pill w-100 fw-bold" onClick={() => document.getElementById('hm-photo')?.click()}>Ganti Foto Profil</Button></div></Col></Row><hr className="my-4 opacity-50" /><div className="d-flex justify-content-end"><Button type="submit" variant="success" className="px-5 py-2 fw-bold shadow rounded-pill" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Profil {terms.headmaster}</Button></div></Form>)}
                   {activeSubTab === 'school' && (<div className="animate-fade-in"><div className="d-flex justify-content-between align-items-center mb-4"><h6 className="fw-bold mb-0 text-success border-start border-3 border-success ps-2">Daftar Konten Profil {terms.school}</h6><Button variant="success" size="sm" className="rounded-pill px-3 fw-bold" onClick={() => { setCurrentProfile({ title: '', content: '', isActive: true, order: profiles.length }); setShowProfileModal(true); }}><FaPlus className="me-1" /> Tambah Halaman Profil</Button></div><ListGroup className="border-0">{profiles.map((item) => (<ListGroup.Item key={item.id} className="mb-3 rounded-4 border shadow-sm p-3 bg-white"><div className="d-flex justify-content-between align-items-center"><div className="d-flex align-items-center"><div className={`me-3 p-2 rounded-circle ${item.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>{item.isActive ? <FaCheckCircle size={20} /> : <FaTimesCircle size={20} />}</div><div><div className="fw-bold text-dark">{item.title}</div><code className="extra-small text-muted">/profil/{item.slug}</code></div></div><div className="d-flex gap-2"><Button variant="light" size="sm" className="btn-icon" title="Preview" onClick={() => window.open(`/profil/${item.slug}`, '_blank')}><FaEye size={14} className="text-info" /></Button><Button variant="light" size="sm" className="btn-icon" title="Ubah Status" onClick={() => toggleProfileStatus(item)}>{item.isActive ? <FaTimesCircle size={14} className="text-warning" /> : <FaCheckCircle size={14} className="text-success" />}</Button><Button variant="light" size="sm" className="btn-icon" title="Edit" onClick={() => { setCurrentProfile(item); setShowProfileModal(true); }}><FaEdit size={14} className="text-primary" /></Button><Button variant="light" size="sm" className="btn-icon" title="Hapus" onClick={() => handleDeleteProfile(item.id, item.title)}><FaTrash size={14} className="text-danger" /></Button></div></div></ListGroup.Item>))}{profiles.length === 0 && <div className="text-center py-5 text-muted border rounded-4 bg-light">Belum ada halaman profil dinamis.</div>}</ListGroup><p className="small text-muted mt-3"><i className="bi bi-info-circle me-1"></i> Item aktif akan muncul di navigasi Profil.</p></div>)}
                   {activeSubTab === 'contact' && (<Form onSubmit={handleSaveGeneral} className="animate-fade-in"><h6 className="fw-bold mb-4 text-success border-start border-3 border-success ps-2">Informasi Kontak & Lokasi</h6><Row><Col md={6}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted"><FaPhone className="me-1" /> TELEPON</Form.Label><Form.Control value={formData.contact.phone} onChange={e => setFormData({...formData, contact: {...formData.contact, phone: e.target.value}})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted"><FaEnvelope className="me-1" /> EMAIL</Form.Label><Form.Control type="email" value={formData.contact.email} onChange={e => setFormData({...formData, contact: {...formData.contact, email: e.target.value}})} /></Form.Group><Form.Group className="mb-0"><Form.Label className="x-small fw-bold text-muted"><FaMapMarkerAlt className="me-1" /> ALAMAT</Form.Label><Form.Control as="textarea" rows={4} value={formData.contact.address} onChange={e => setFormData({...formData, contact: {...formData.contact, address: e.target.value}})} /></Form.Group><div className="mt-4 p-3 bg-light rounded-4 border"><h6 className="fw-bold mb-3 text-dark small"><FaExternalLinkAlt className="me-2 text-primary" /> Media Sosial</h6><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted"><FaFacebook className="me-1 text-primary" /> FB</Form.Label><Form.Control value={formData.socialMedia.facebook} onChange={e => setFormData({...formData, socialMedia: {...formData.socialMedia, facebook: e.target.value}})} size="sm" /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted"><FaInstagram className="me-1 text-danger" /> IG</Form.Label><Form.Control value={formData.socialMedia.instagram} onChange={e => setFormData({...formData, socialMedia: {...formData.socialMedia, instagram: e.target.value}})} size="sm" /></Form.Group><Form.Group className="mb-0"><Form.Label className="x-small fw-bold text-muted"><FaYoutube className="me-1 text-danger" /> YT</Form.Label><Form.Control value={formData.socialMedia.youtube} onChange={e => setFormData({...formData, socialMedia: {...formData.socialMedia, youtube: e.target.value}})} size="sm" /></Form.Group></div></Col><Col md={6}><h6 className="fw-bold mb-3 text-dark border-start border-3 border-success ps-2">Lokasi Peta</h6><LocationMapPicker latitude={formData.contact.lat} longitude={formData.contact.lng} onLocationChange={(lat, lng) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, lat, lng }}))} />{formData.contact.lat && <div className="mt-3 bg-light p-3 rounded-4 border text-muted small"><FaLocationArrow className="me-2 text-success" />Lat: <strong>{formData.contact.lat}</strong>, Lng: <strong>{formData.contact.lng}</strong><Button variant="outline-info" size="sm" className="rounded-pill ms-3 py-0 px-2 x-small" onClick={() => window.open(`https://www.google.com/maps?q=${formData.contact.lat},${formData.contact.lng}`, '_blank')}><FaEye className="me-1" /> Lihat</Button></div>}</Col></Row><hr className="my-4 opacity-50" /><div className="d-flex justify-content-end"><Button type="submit" variant="success" className="px-5 py-2 fw-bold shadow rounded-pill" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Kontak</Button></div></Form>)}
                </Card.Body></Card>
          </Tab>
          <Tab eventKey="slideshow" title={<><FaImage className="me-2" /> Hero Slideshow</>}><Card className="border-0 shadow-sm mb-4 rounded-4 overflow-hidden"><Card.Header className="bg-white py-3 fw-bold border-0 d-flex justify-content-between align-items-center text-info"><span><FaImage className="me-2" /> Slideshow</span><Badge bg="info" className="text-white rounded-pill px-3">{heroSlides.length}/5</Badge></Card.Header><Card.Body className="p-4 pt-0"><div className="bg-light p-4 rounded-4 border mb-4"><h6 className="fw-bold mb-3">Tambah Slide Baru</h6><Row><Col md={6}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">JUDUL</Form.Label><Form.Control placeholder="Teks Utama" value={newSlideData.title} onChange={e => setNewSlideData({...newSlideData, title: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">SUB-JUDUL</Form.Label><Form.Control placeholder="Teks Penjelasan" value={newSlideData.subtitle} onChange={e => setNewSlideData({...newSlideData, subtitle: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">Object Fit</Form.Label><Form.Select value={newSlideData.objectFit} onChange={e => setNewSlideData({...newSlideData, objectFit: e.target.value as any})}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></Form.Select></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">GAMBAR</Form.Label><Form.Control type="file" accept="image/*" onChange={handleSlideFileChange} /></Form.Group><Button variant="info" className="text-white w-100 fw-bold rounded-pill shadow-sm mt-2 py-2" onClick={handleAddSlide} disabled={saving || !newSlideFile}>{saving ? <Spinner size="sm" /> : <><FaPlus className="me-1" /> Unggah</>}</Button></Col></Row></div><h6 className="fw-bold mb-3">Daftar Slide Aktif</h6><Row className="g-4">{heroSlides.map(slide => (<Col key={slide.id} md={4}><Card className="group shadow-sm rounded-4 overflow-hidden border-0 h-100 bg-white"><div className="position-relative"><img src={slide.url} style={{ width: '100%', height: '180px', objectFit: slide.objectFit || 'cover' }} alt={slide.title} /><div className="position-absolute top-0 end-0 p-2 d-flex gap-2"><Button variant="light" size="sm" className="rounded-circle btn-icon shadow" onClick={() => { setCurrentSlide(slide); setShowSlideModal(true); }}><FaEdit size={12} /></Button><Button variant="danger" size="sm" className="rounded-circle btn-icon shadow" onClick={() => handleDeleteSlide(slide.id, slide.title)}><FaTrash size={12} /></Button></div></div><Card.Body className="p-3"><div className="fw-bold small text-truncate mb-1">{slide.title}</div><div className="text-muted extra-small text-truncate">{slide.subtitle || '-'}</div></Card.Body></Card></Col>))}{heroSlides.length === 0 && <Col xs={12} className="text-center py-5 text-muted">Belum ada slide.</Col>}</Row></Card.Body></Card></Tab>
          <Tab eventKey="services" title={<><FaExternalLinkAlt className="me-2" /> Layanan Digital</>}><Card className="border-0 shadow-sm rounded-4"><Card.Header className="bg-white py-3 fw-bold border-0 d-flex justify-content-between align-items-center text-primary"><span><FaExternalLinkAlt className="me-2" /> E-Services</span><Button size="sm" variant="primary" className="rounded-pill px-3 fw-bold" onClick={() => { setCurrentService({ title: '', url: '', bgColor: '#198754', textColor: '#ffffff', icon: '🚀', iconType: 'emoji' }); setShowServiceModal(true); }}><FaPlus className="me-1" /> Tambah</Button></Card.Header><Card.Body className="p-4 pt-0"><div className="bg-light p-3 rounded-4 mb-4 border"><div className="d-flex align-items-center justify-content-between gap-2"><h6 className="fw-bold mb-0 text-dark small"><FaCogs className="me-1" /> Layout</h6><div className="d-flex gap-3 bg-white p-2 rounded-pill border shadow-sm"><Form.Check type="radio" label="Bento" name="layout" id="lay-bento" checked={formData.eServicesLayout === 'bento'} onChange={() => handleUpdateLayout('bento')} className="small fw-medium" /><Form.Check type="radio" label="Slider" name="layout" id="lay-slider" checked={formData.eServicesLayout === 'slider'} onChange={() => handleUpdateLayout('slider')} className="small fw-medium" /></div></div></div><ListGroup variant="flush">{eServices.map(svc => (<ListGroup.Item key={svc.id} className="px-0 py-3 d-flex align-items-center justify-content-between bg-transparent"><div className="d-flex align-items-center overflow-hidden"><div className="me-3 p-2 rounded-3 d-flex align-items-center justify-content-center shadow-sm border" style={{ backgroundColor: svc.bgColor, color: svc.textColor, width: '42px', height: '42px', flexShrink: 0 }}><IconRenderer icon={svc.icon} type={svc.iconType} /></div><div className="overflow-hidden"><div className="fw-bold small text-dark lh-1 mb-1">{svc.title}</div><code className="extra-small text-muted text-truncate d-block">{svc.url}</code></div></div><div className="d-flex gap-1 ms-2"><Button variant="light" size="sm" className="btn-icon" onClick={() => { setCurrentService(svc); setShowServiceModal(true); }}><FaEdit size={12} className="text-primary" /></Button><Button variant="light" size="sm" className="btn-icon" onClick={() => handleDeleteEService(svc.id, svc.title)}><FaTrash size={12} className="text-danger" /></Button></div></ListGroup.Item>))}{eServices.length === 0 && <div className="text-center py-4 text-muted small">Belum ada layanan.</div>}</ListGroup></Card.Body></Card></Tab>
        </Tabs>
      </Container>
      <Modal show={showSlideModal} onHide={() => setShowSlideModal(false)} centered><Modal.Header closeButton className="border-0"><Modal.Title className="h5 fw-bold">Edit Slide</Modal.Title></Modal.Header><Modal.Body><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Judul</Form.Label><Form.Control value={currentSlide.title} onChange={e => setCurrentSlide({...currentSlide, title: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Sub-Judul</Form.Label><Form.Control value={currentSlide.subtitle} onChange={e => setCurrentSlide({...currentSlide, subtitle: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Object Fit</Form.Label><Form.Select value={currentSlide.objectFit} onChange={e => setCurrentSlide({...currentSlide, objectFit: e.target.value as any})}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></Form.Select></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Gambar</Form.Label>{currentSlide.url && <img src={currentSlide.url} className="img-fluid rounded mb-2" alt="Current slide"/>}{currentSlide.metadata && (<div className="d-flex justify-content-between align-items-center"><span className="text-muted extra-small">{formatBytes(currentSlide.metadata.sizeBytes)} .{currentSlide.metadata.fileExtension}</span>{needsReconversion(currentSlide.metadata) && (<Button variant="link" className="p-0 text-warning" onClick={() => handleReconvertClick({ type: 'slide', id: currentSlide.id, url: currentSlide.url })} disabled={isReconverting}><FaSyncAlt size={14} /></Button>)}</div>)}</Form.Group></Modal.Body><Modal.Footer className="border-0"><Button variant="light" className="rounded-pill px-4" onClick={() => setShowSlideModal(false)}>Batal</Button><Button variant="primary" className="rounded-pill px-4" onClick={handleSaveSlide} disabled={saving}>{saving ? <Spinner size="sm"/> : 'Simpan'}</Button></Modal.Footer></Modal>
      <Modal show={showServiceModal} onHide={() => setShowServiceModal(false)} centered size="lg" className="rounded-4"><Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold h5">Layanan</Modal.Title></Modal.Header><Modal.Body className="p-4 pt-2"><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Nama</Form.Label><Form.Control value={currentService.title} onChange={e => setCurrentService({...currentService, title: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">URL</Form.Label><Form.Control value={currentService.url} onChange={e => setCurrentService({...currentService, url: e.target.value})} /></Form.Group><Row><Col md={4}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Tipe Ikon</Form.Label><Form.Select value={currentService.iconType} onChange={e => setCurrentService({...currentService, iconType: e.target.value as any, icon: iconOptions[e.target.value as keyof typeof iconOptions][0]})}><option value="emoji">Emoji</option><option value="fa">FontAwesome</option><option value="bi">Bootstrap</option><option value="hi">Hero</option><option value="fc">Flat Color</option></Form.Select></Form.Group></Col><Col md={8}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Pilih Ikon</Form.Label><div className="icon-grid-selector d-flex flex-wrap gap-2 p-2 bg-light rounded border" style={{ maxHeight: '150px' }}>{iconOptions[currentService.iconType as keyof typeof iconOptions]?.map(iconName => (<div key={iconName} className={`icon-item p-2 rounded cursor-pointer border ${currentService.icon === iconName ? 'bg-success text-white' : 'bg-white'}`} onClick={() => setCurrentService({...currentService, icon: iconName})} style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}><IconRenderer icon={iconName} type={currentService.iconType as any} /></div>))}</div></Form.Group></Col></Row><Row><Col md={6}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Warna Latar</Form.Label><Form.Control type="color" value={currentService.bgColor} onChange={e => setCurrentService({...currentService, bgColor: e.target.value})} /></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Warna Teks</Form.Label><Form.Control type="color" value={currentService.textColor} onChange={e => setCurrentService({...currentService, textColor: e.target.value})} /></Form.Group></Col></Row></Modal.Body><Modal.Footer className="border-0 pt-0"><Button variant="light" className="rounded-pill px-4" onClick={() => setShowServiceModal(false)}>Batal</Button><Button variant="success" className="rounded-pill px-4" onClick={handleSaveService} disabled={saving}>{saving ? <Spinner size="sm"/> : <FaSave/>} Simpan</Button></Modal.Footer></Modal>
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered size="xl" className="rounded-4"><Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold h5">Halaman Profil</Modal.Title></Modal.Header><Modal.Body className="p-4 pt-2"><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Judul</Form.Label><Form.Control value={currentProfile.title} onChange={e => setCurrentProfile({...currentProfile, title: e.target.value})} className="fw-bold" /><Form.Text>Slug URL akan otomatis dibuat.</Form.Text></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Konten</Form.Label><Form.Control as="textarea" rows={15} value={currentProfile.content} onChange={e => setCurrentProfile({...currentProfile, content: e.target.value})} style={{ fontSize: '1rem', lineHeight: '1.6' }} /></Form.Group><Form.Check type="switch" label="Tampilkan di Menu" checked={currentProfile.isActive} onChange={e => setCurrentProfile({...currentProfile, isActive: e.target.checked})} /></Modal.Body><Modal.Footer className="border-0 pt-0"><Button variant="light" className="rounded-pill px-4" onClick={() => setShowProfileModal(false)}>Batal</Button><Button variant="success" className="rounded-pill px-4" onClick={handleSaveProfile} disabled={saving}>{saving ? <Spinner size="sm"/> : <FaSave/>} Simpan</Button></Modal.Footer></Modal>
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered contentClassName="bg-transparent border-0"><Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header><Modal.Body className="text-center">{reconvertedPreviewUrl && <img src={reconvertedPreviewUrl} className="img-fluid rounded shadow-lg" alt="Preview Konversi" />}{reconvertedBlob && <p className="text-white small mt-3">Pratinjau hasil konversi. Ukuran file baru: {formatBytes(reconvertedBlob.size)}</p>}</Modal.Body><Modal.Footer className="border-0 justify-content-center"><Button variant="light" onClick={() => setShowPreviewModal(false)}>Batal</Button><Button variant="success" onClick={handleSaveReconvertedImage} disabled={isReconverting}>{isReconverting ? <Spinner size="sm" /> : "Simpan & Ganti Gambar"}</Button></Modal.Footer></Modal>
      <style>{`.custom-tabs .nav-link { color: #6c757d; font-weight: 600; border: none; padding: 12px 24px; border-radius: 12px 12px 0 0; } .custom-tabs .nav-link.active { color: #198754; background: white; border-bottom: 3px solid #198754; } .x-small { font-size: 0.7rem; } .extra-small { font-size: 0.65rem; } .btn-icon { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #eee; } .cursor-pointer { cursor: pointer; } .icon-item:hover { transform: scale(1.1); border-color: #198754; } .animate-fade-in { animation: fadeIn 0.3s ease-in; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } } .sub-nav-container::-webkit-scrollbar { height: 4px; } .sub-nav-container::-webkit-scrollbar-thumb { background: #ddd; border-radius: 10px; }`}</style>
    </DashboardLayout>
  );
};

export default Settings;
