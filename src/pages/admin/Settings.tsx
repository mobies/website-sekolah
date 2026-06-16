import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Spinner, ListGroup, Modal, Badge, Tabs, Tab, InputGroup } from 'react-bootstrap';
import { FaSave, FaTrash, FaPlus, FaSchool, FaImage, FaUserTie, FaExternalLinkAlt, FaEdit, FaPen, FaCogs, FaHistory, FaCheckCircle, FaTimesCircle, FaEye, FaPhone, FaEnvelope, FaMapMarkerAlt, FaLocationArrow, FaSyncAlt, FaFacebook, FaInstagram, FaYoutube, FaTwitter, FaLinkedin, FaTiktok, FaTelegram, FaWhatsapp, FaPinterest, FaGithub, FaDiscord, FaLink, FaArrowUp, FaArrowDown, FaPaperclip, FaBars, FaSitemap, FaHome, FaGlobe, FaFileAlt, FaNewspaper, FaBullhorn, FaCalendarAlt, FaVideo, FaBookOpen } from 'react-icons/fa';
import { FaImages } from 'react-icons/fa6';
import { FaXTwitter } from 'react-icons/fa6';
import DashboardLayout from '../../components/admin/DashboardLayout';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef, getStorageRef, logActivity, updateCounter, uploadBytesWithCache } from '../../firebase/utils';
import { onValue, set, push, remove, update } from 'firebase/database';
import { getDownloadURL, ref, deleteObject } from 'firebase/storage';
import { useIsOwner } from '../../firebase/useIsOwner';
import { convertToWebP, convertHeroImage, convertUrlToWebP } from '../../firebase/imageUtils';
import type { ImageMetadata } from '../../firebase/imageUtils';
import { getImageMetadata, getStoragePathFromDownloadURL } from '../../firebase/imageUtils';
import { showAlert, toast, showConfirm } from '../../utils/alerts';
import { storage } from '../../firebase/config';
import IconRenderer from '../../components/IconRenderer';
import LocationMapPicker from '../../components/LocationMapPicker';
import ProgressiveImage from '../../components/ProgressiveImage';
import { buildPageAttachmentEmbedUrl, getPageAttachmentFrameHeight, normalizePageAttachmentKind, type PageAttachmentItem, type PageAttachmentKind } from '../../utils/pageAttachments';

interface HeroSlide {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  objectFit: 'cover' | 'contain' | 'fill';
  metadata?: ImageMetadata | null;
}

interface HeroLogo {
  id: string;
  url: string;
  align: 'left' | 'right';
  active: boolean;
}

interface EService {
  id: string;
  title: string;
  url: string;
  bgColor: string;
  textColor: string;
  icon: string;
  iconType: 'emoji' | 'fa' | 'bi' | 'hi' | 'fc';
  order?: number;
}

interface ProfileContent {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
  order: number;
  attachments?: ProfileAttachment[];
}

interface SitePage {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
  order: number;
  attachments?: PageAttachmentItem[];
}

interface ProfileAttachment {
  id: string;
  title: string;
  kind?: PageAttachmentKind;
  url: string;
  sourceUrl?: string;
  storagePath?: string;
}

interface MenuLabels {
  home: string;
  content: string;
  profile: string;
  eServices: string;
  contact: string;
  news: string;
  announcements: string;
  agenda: string;
  video: string;
  gallery: string;
}

interface LinkedMenuItem {
  id: string;
  title: string;
  url: string;
  active: boolean;
  order: number;
  parentId: string | null;
  rootAfterId?: string | null;
  targetType?: 'url' | 'page';
  pageId?: string | null;
}

interface MenuConfig {
  labels: MenuLabels;
  linkedMenus: LinkedMenuItem[];
  fixedRootOrder: string[];
}

interface DetailHeroConfig {
  mode: 'solid' | 'image';
  solidColor: string;
  imageUrl: string;
  imageStoragePath?: string;
}

type EServicesLayout = 'bento' | 'slider' | 'compact-grid' | 'list-card';

const DEFAULT_MENU_LABELS: MenuLabels = {
  home: 'Beranda',
  content: 'Konten',
  profile: 'Profile',
  eServices: 'E-Layanan',
  contact: 'Kontak',
  news: 'Berita',
  announcements: 'Pengumuman',
  agenda: 'Agenda',
  video: 'Video',
  gallery: 'Galeri'
};

const DEFAULT_MENU_CONFIG: MenuConfig = {
  labels: DEFAULT_MENU_LABELS,
  linkedMenus: [],
  fixedRootOrder: ['profile', 'eServices', 'content', 'contact']
};

const DEFAULT_DETAIL_HERO_CONFIG: DetailHeroConfig = {
  mode: 'solid',
  solidColor: '#198754',
  imageUrl: ''
};

const Settings: React.FC = () => {
  const { tenantId, terms } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [activeSubTab, setActiveSubTab] = useState('identity');

  const [formData, setFormData] = useState({
    schoolName: '',
    tagline: '',
    description: '',
    logo: '',
    eServicesLayout: 'bento' as EServicesLayout,
    headmaster: { name: '', photo: '', greeting: '' },
    contact: { phone: '', email: '', address: '', lat: '', lng: '', mapZoom: 15 },
    socialMedia: { 
      facebook: { url: '', active: false }, 
      instagram: { url: '', active: false }, 
      youtube: { url: '', active: false }, 
      twitter: { url: '', active: false }, 
      x: { url: '', active: false },
      linkedin: { url: '', active: false }, 
      tiktok: { url: '', active: false },
      telegram: { url: '', active: false },
      whatsapp: { url: '', active: false },
      pinterest: { url: '', active: false },
      github: { url: '', active: false },
      discord: { url: '', active: false }
    }
  });

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [heroLogos, setHeroLogos] = useState<HeroLogo[]>([]);
  const [eServices, setEServices] = useState<EService[]>([]);
  const [profiles, setProfiles] = useState<ProfileContent[]>([]);
  const [sitePages, setSitePages] = useState<SitePage[]>([]);
  const [menuConfig, setMenuConfig] = useState<MenuConfig>(DEFAULT_MENU_CONFIG);
  const [detailHeroConfig, setDetailHeroConfig] = useState<DetailHeroConfig>(DEFAULT_DETAIL_HERO_CONFIG);
  
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [headmasterPhotoFile, setHeadmasterPhotoFile] = useState<File | null>(null);
  const [newSlideFile, setNewSlideFile] = useState<File | null>(null);
  const [newSlideData, setNewSlideData] = useState({ title: '', subtitle: '', objectFit: 'cover' as 'cover' | 'contain' | 'fill' });
  const [newHeroLogoFile, setNewHeroLogoFile] = useState<File | null>(null);
  const [newHeroLogoAlign, setNewHeroLogoAlign] = useState<'left'|'right'>('left');
  
  const [logoMetadata, setLogoMetadata] = useState<ImageMetadata | null>(null);
  const [headmasterPhotoMetadata, setHeadmasterPhotoMetadata] = useState<ImageMetadata | null>(null);
  const [detailHeroImageFile, setDetailHeroImageFile] = useState<File | null>(null);
  const [detailHeroImageMetadata, setDetailHeroImageMetadata] = useState<ImageMetadata | null>(null);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [currentService, setCurrentService] = useState<Partial<EService>>({
      title: '', url: '', bgColor: '#198754', textColor: '#ffffff', icon: '🚀', iconType: 'emoji', order: 0
  });

  const [showSlideModal, setShowSlideModal] = useState(false);
  const [currentSlide, setCurrentSlide] = useState<Partial<HeroSlide>>({});

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Partial<ProfileContent>>({
    title: '', content: '', isActive: true, order: 0, attachments: []
  });

  const [showPageModal, setShowPageModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<Partial<SitePage>>({
    title: '', content: '', isActive: true, order: 0, attachments: []
  });

  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [currentAttachmentProfile, setCurrentAttachmentProfile] = useState<ProfileContent | null>(null);
  const [attachmentItems, setAttachmentItems] = useState<ProfileAttachment[]>([]);
  const [newAttachmentTitle, setNewAttachmentTitle] = useState('');
  const [newAttachmentKind, setNewAttachmentKind] = useState<PageAttachmentKind>('image');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newAttachmentFile, setNewAttachmentFile] = useState<File | null>(null);
  const [attachmentSaving, setAttachmentSaving] = useState(false);

  const [showPageAttachmentModal, setShowPageAttachmentModal] = useState(false);
  const [currentAttachmentPage, setCurrentAttachmentPage] = useState<SitePage | null>(null);
  const [pageAttachmentItems, setPageAttachmentItems] = useState<PageAttachmentItem[]>([]);
  const [newPageAttachmentTitle, setNewPageAttachmentTitle] = useState('');
  const [newPageAttachmentKind, setNewPageAttachmentKind] = useState<PageAttachmentItem['kind']>('image');
  const [newPageAttachmentUrl, setNewPageAttachmentUrl] = useState('');
  const [newPageAttachmentFile, setNewPageAttachmentFile] = useState<File | null>(null);
  const [pageAttachmentSaving, setPageAttachmentSaving] = useState(false);
  const attachmentKindLabels: Record<PageAttachmentKind, string> = {
    image: 'Gambar',
    'google-form': 'Google Form',
    'google-sheet': 'Google Sheet',
    youtube: 'YouTube',
    'google-drive': 'Google Drive',
    'google-slide': 'Google Slides'
  };

  const [showMenuItemModal, setShowMenuItemModal] = useState(false);
  const [currentMenuItem, setCurrentMenuItem] = useState<Partial<LinkedMenuItem>>({
    title: '',
    url: '',
    active: true,
    order: 0,
    parentId: null,
    targetType: 'url'
  });
  const [menuItemMode, setMenuItemMode] = useState<'root' | 'submenu'>('root');
  const [menuItemParentId, setMenuItemParentId] = useState<string | null>(null);
  const [menuItemInsertAfterId, setMenuItemInsertAfterId] = useState<string | null>(null);
  const [menuPageTargetId, setMenuPageTargetId] = useState<string | null>(null);

  const [isReconverting, setIsReconverting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [reconvertedBlob, setReconvertedBlob] = useState<Blob | null>(null);
  const [reconvertedPreviewUrl, setReconvertedPreviewUrl] = useState<string | null>(null);
  const [reconvertTarget, setReconvertTarget] = useState<{ type: 'logo' | 'headmaster' | 'slide'; id?: string; url?: string } | null>(null);
  const { isOwner } = useIsOwner();

  const iconOptions = {
    emoji: ['🚀', '🏫', '📚', '🎓', '📅', '📢', '💻', '🌍', '🏠', '📝', '🏆', '⚽', '🎨', '🔬', '💡'],
    fa: ['FaHome', 'FaUser', 'FaBook', 'FaInfoCircle', 'FaPhone', 'FaGraduationCap', 'FaGlobe', 'FaEnvelope', 'FaLaptop', 'FaRegListAlt', 'FaBullhorn', 'FaUsers', 'FaBriefcase', 'FaChartLine', 'FaCloud'],
    bi: ['BiHome', 'BiUser', 'BiBook', 'BiInfoCircle', 'BiPhone', 'BiMap', 'BiGlobe', 'BiEnvelope', 'BiLaptop', 'BiListUl', 'BiNews', 'BiCamera', 'BiCloudUpload', 'BiBriefcase', 'BiTrophy'],
    hi: ['HiHome', 'HiUser', 'HiBookOpen', 'HiInformationCircle', 'HiPhone', 'HiMail', 'HiGlobeAlt', 'HiAcademicCap', 'HiCalendar', 'HiBell', 'HiBriefcase', 'HiChip', 'HiCamera', 'HiChartBar', 'HiCloud'],
    fc: ['FcHome', 'FcAbout', 'FcAddressBook', 'FcBullhorn', 'FcCalendar', 'FcConferenceCall', 'FcDocument', 'FcEngineering', 'FcGraduationCap', 'FcInfo', 'FcLibrary', 'FcLink', 'FcPortraitMode', 'FcPositiveDynamic', 'FcSettings']
  };

  const pageAttachmentKindLabels: Record<'image' | 'google-form' | 'google-sheet' | 'youtube' | 'google-drive' | 'google-slide', string> = {
    image: 'Gambar',
    'google-form': 'Google Form',
    'google-sheet': 'Google Sheet',
    youtube: 'YouTube',
    'google-drive': 'Google Drive',
    'google-slide': 'Google Slides'
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getProfileAttachmentsPath = (profileId: string, fileName: string) => `profiles/${profileId}/attachments/${fileName}`;
  const getPageAttachmentsPath = (pageId: string, fileName: string) => `pages/${pageId}/attachments/${fileName}`;

  const syncProfileAttachments = (profileId: string, nextAttachments: ProfileAttachment[]) => {
    setProfiles(prev => prev.map(item => item.id === profileId ? { ...item, attachments: nextAttachments } : item));
    setCurrentProfile(prev => prev.id === profileId ? { ...prev, attachments: nextAttachments } : prev);
    setCurrentAttachmentProfile(prev => prev && prev.id === profileId ? { ...prev, attachments: nextAttachments } : prev);
    setAttachmentItems(nextAttachments);
  };

  const syncPageAttachments = (pageId: string, nextAttachments: ProfileAttachment[]) => {
    setSitePages(prev => prev.map(item => item.id === pageId ? { ...item, attachments: nextAttachments } : item));
    setCurrentPage(prev => prev.id === pageId ? { ...prev, attachments: nextAttachments } : prev);
    setCurrentAttachmentPage(prev => prev && prev.id === pageId ? { ...prev, attachments: nextAttachments } : prev);
    setPageAttachmentItems(nextAttachments);
  };

  const persistAttachmentList = async (profileId: string, nextAttachments: ProfileAttachment[]) => {
    if (!tenantId) return;
    await update(getDBRef(tenantId, `profiles/${profileId}`), { attachments: nextAttachments });
    syncProfileAttachments(profileId, nextAttachments);
  };

  const persistPageAttachmentList = async (pageId: string, nextAttachments: ProfileAttachment[]) => {
    if (!tenantId) return;
    await update(getDBRef(tenantId, `pages/${pageId}`), { attachments: nextAttachments });
    syncPageAttachments(pageId, nextAttachments);
  };

  const normalizeMenuConfig = (config?: Partial<MenuConfig> | null): MenuConfig => {
    const labels = {
      ...DEFAULT_MENU_LABELS,
      ...(config?.labels || {})
    };

    const linkedMenus = Array.isArray(config?.linkedMenus)
      ? config!.linkedMenus.map((item, index) => ({
          id: item.id || `menu-${Date.now()}-${index}`,
          title: item.title || '',
          url: item.url || '',
          active: item.active !== false,
          order: typeof item.order === 'number' ? item.order : index,
          parentId: item.parentId ?? null,
          rootAfterId: item.rootAfterId ?? null,
          targetType: item.targetType || 'url',
          pageId: item.pageId ?? null
        }))
      : [];

    const validFixedRootIds = new Set(['profile', 'eServices', 'content', 'contact']);
    const fixedRootOrder = Array.isArray(config?.fixedRootOrder)
      ? config!.fixedRootOrder.filter((id): id is string => validFixedRootIds.has(id))
      : [];

    return {
      labels,
      linkedMenus,
      fixedRootOrder: fixedRootOrder.length > 0 ? fixedRootOrder : DEFAULT_MENU_CONFIG.fixedRootOrder
    };
  };

  const syncMenuConfig = (nextConfig: MenuConfig) => {
    setMenuConfig(nextConfig);
  };

  const getChildrenMenus = (parentId: string | null) => {
    return menuConfig.linkedMenus
      .filter(item => item.parentId === parentId && item.active)
      .sort((a, b) => a.order - b.order);
  };

  const getRootMenus = () => getChildrenMenus(null);

  const getOrderedRootMenus = () => {
    const fixedRootTitles: Record<string, string> = {
      home: menuConfig.labels.home || DEFAULT_MENU_LABELS.home,
      profile: menuConfig.labels.profile || DEFAULT_MENU_LABELS.profile,
      eServices: menuConfig.labels.eServices || DEFAULT_MENU_LABELS.eServices,
      content: menuConfig.labels.content || DEFAULT_MENU_LABELS.content,
      contact: menuConfig.labels.contact || DEFAULT_MENU_LABELS.contact
    };

    const fixedRoots = [
      { id: 'home', title: fixedRootTitles.home },
      ...menuConfig.fixedRootOrder.map(id => ({ id, title: fixedRootTitles[id] }))
    ];

    const rootLinkedItems = menuConfig.linkedMenus
      .filter(item => item.active && !item.parentId)
      .sort((a, b) => a.order - b.order);

    const grouped = new Map<string, LinkedMenuItem[]>();
    rootLinkedItems.forEach(item => {
      const anchorId = item.rootAfterId || 'content';
      const list = grouped.get(anchorId) || [];
      list.push(item);
      grouped.set(anchorId, list);
    });

    const ordered: Array<{ kind: 'fixed' | 'linked'; id: string; title: string; item?: LinkedMenuItem }> = [];
    const appendAfter = (anchorId: string) => {
      const children = (grouped.get(anchorId) || []).slice().sort((a, b) => a.order - b.order);
      children.forEach(child => {
        ordered.push({ kind: 'linked', id: child.id, title: child.title, item: child });
        appendAfter(child.id);
      });
    };

    fixedRoots.forEach(root => {
      ordered.push({ kind: 'fixed', id: root.id, title: root.title });
      appendAfter(root.id);
    });

    return ordered;
  };

  const handleMoveFixedRoot = async (rootId: string, direction: 'up' | 'down') => {
    if (!tenantId) return;
    const order = [...(menuConfig.fixedRootOrder || DEFAULT_MENU_CONFIG.fixedRootOrder)];
    const currentIndex = order.indexOf(rootId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    [order[currentIndex], order[targetIndex]] = [order[targetIndex], order[currentIndex]];

    const nextConfig = normalizeMenuConfig({ ...menuConfig, fixedRootOrder: order });
    setSaving(true);
    try {
      await update(getDBRef(tenantId, 'settings'), { menuConfig: nextConfig });
      syncMenuConfig(nextConfig);
      toast.fire({ icon: 'success', title: 'Urutan menu tetap diperbarui' });
      await logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: `Ubah urutan menu tetap: ${rootId}` });
    } catch (err: any) {
      showAlert('Gagal', err.message || 'Gagal memperbarui urutan menu tetap.', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!tenantId) return;

    const unsubSettings = onValue(getDBRef(tenantId, 'settings'), async (snap) => {
      const data = snap.val();
      if (data) {
        const defaultSocialMedia = { 
          facebook: { url: '', active: false }, 
          instagram: { url: '', active: false }, 
          youtube: { url: '', active: false }, 
          twitter: { url: '', active: false }, 
          x: { url: '', active: false },
          linkedin: { url: '', active: false }, 
          tiktok: { url: '', active: false },
          telegram: { url: '', active: false },
          whatsapp: { url: '', active: false },
          pinterest: { url: '', active: false },
          github: { url: '', active: false },
          discord: { url: '', active: false }
        };

        let mergedSocialMedia = { ...defaultSocialMedia };
        if (data.socialMedia) {
          Object.keys(defaultSocialMedia).forEach(key => {
            if (data.socialMedia[key]) {
              if (typeof data.socialMedia[key] === 'string') {
                (mergedSocialMedia as any)[key] = { url: data.socialMedia[key], active: true };
              } else {
                (mergedSocialMedia as any)[key] = { ...(defaultSocialMedia as any)[key], ...data.socialMedia[key] };
              }
            }
          });
        }

        setFormData({
          schoolName: data.schoolName || '',
          tagline: data.tagline || '',
          description: data.description || '',
          logo: data.logo || '',
          eServicesLayout: (['bento', 'slider', 'compact-grid', 'list-card'].includes(data.eServicesLayout) ? data.eServicesLayout : 'bento') as EServicesLayout,
          headmaster: data.headmaster || { name: '', photo: '', greeting: '' },
          contact: data.contact || { phone: '', email: '', address: '', lat: '', lng: '', mapZoom: 15 },
          socialMedia: mergedSocialMedia
        });
        syncMenuConfig(normalizeMenuConfig(data.menuConfig));
        const nextDetailHeroConfig = {
          ...DEFAULT_DETAIL_HERO_CONFIG,
          ...(data.detailHeroConfig || {})
        };
        setDetailHeroConfig(nextDetailHeroConfig);
        
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

        const logosRaw = data.heroLogos ? (Array.isArray(data.heroLogos) ? data.heroLogos : Object.values(data.heroLogos)) : [];
        setHeroLogos(logosRaw as HeroLogo[]);

        if (data.logo && !data.logo.startsWith('/')) {
          const storagePath = getStoragePathFromDownloadURL(data.logo);
          if (storagePath) setLogoMetadata(await getImageMetadata(storagePath)); else setLogoMetadata(null);
        } else setLogoMetadata(null);
        if (data.headmaster?.photo && !data.headmaster.photo.startsWith('/')) {
          const storagePath = getStoragePathFromDownloadURL(data.headmaster.photo);
          if (storagePath) setHeadmasterPhotoMetadata(await getImageMetadata(storagePath)); else setHeadmasterPhotoMetadata(null);
        } else setHeadmasterPhotoMetadata(null);
        if (nextDetailHeroConfig.imageStoragePath) {
          setDetailHeroImageMetadata(await getImageMetadata(nextDetailHeroConfig.imageStoragePath));
        } else if (nextDetailHeroConfig.imageUrl && !nextDetailHeroConfig.imageUrl.startsWith('/')) {
          const storagePath = getStoragePathFromDownloadURL(nextDetailHeroConfig.imageUrl);
          if (storagePath) setDetailHeroImageMetadata(await getImageMetadata(storagePath)); else setDetailHeroImageMetadata(null);
        } else {
          setDetailHeroImageMetadata(null);
        }
      }
      setLoading(false);
    });

    const unsubServices = onValue(getDBRef(tenantId, 'e_services'), (snap) => {
      setEServices(snap.exists() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)) : []);
    });

    const unsubProfiles = onValue(getDBRef(tenantId, 'profiles'), (snap) => {
      setProfiles(snap.exists() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).sort((a,b) => a.order - b.order) : []);
    });

    const unsubPages = onValue(getDBRef(tenantId, 'pages'), (snap) => {
      setSitePages(snap.exists() ? Object.keys(snap.val()).map(key => ({ id: key, ...snap.val()[key] })).sort((a,b) => a.order - b.order) : []);
    });

    return () => { unsubSettings(); unsubServices(); unsubProfiles(); unsubPages(); };
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
        await uploadBytesWithCache(fileRef, webpBlob);
        finalLogo = await getDownloadURL(fileRef);

        if (formData.logo) {
          try { await deleteObject(ref(storage, formData.logo)); } catch (err: any) { if (err.code !== 'storage/object-not-found') console.error("Gagal hapus logo lama:", err); }
        }
      }

      if (headmasterPhotoFile) {
        const webpBlob = await convertToWebP(headmasterPhotoFile);
        const fileRef = getStorageRef(tenantId, `settings/headmaster/hm_${Date.now()}.webp`);
        await uploadBytesWithCache(fileRef, webpBlob);
        headmasterPhoto = await getDownloadURL(fileRef);

        if (formData.headmaster.photo) {
          try { await deleteObject(ref(storage, formData.headmaster.photo)); } catch (err: any) { if (err.code !== 'storage/object-not-found') console.error("Gagal hapus foto lama:", err); }
        }
      }

      const updatedData = { ...formData, logo: finalLogo, headmaster: { ...formData.headmaster, photo: headmasterPhoto } };
      await update(getDBRef(tenantId, 'settings'), { ...updatedData, heroSlides: heroSlides.map(({metadata, ...s}) => s), heroLogos, menuConfig });
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
      await uploadBytesWithCache(fileRef, newSlideFile);
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

  const handleHeroLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSaving(true);
      try {
        const convertedBlob = await convertToWebP(file, { quality: 0.7 });
        const webpFile = new File([convertedBlob], `${Date.now()}_hero_logo.webp`, { type: 'image/webp' });
        setNewHeroLogoFile(webpFile);
      } catch (error: any) {
        showAlert('Konversi Gagal', error.message || 'Gagal mengonversi logo opsional.', 'error');
        e.target.value = '';
        setNewHeroLogoFile(null);
      } finally {
        setSaving(false);
      }
    }
  };

  const persistHeroLogos = async (logos: HeroLogo[]) => {
    if (!tenantId) return;
    await set(getDBRef(tenantId, 'settings/heroLogos'), logos);
    setHeroLogos(logos);
  };

  const handleAddHeroLogo = async () => {
    if (!tenantId || !newHeroLogoFile) return;
    setSaving(true);
    try {
      const fileRef = getStorageRef(tenantId, `settings/hero-logos/${newHeroLogoFile.name}`);
      await uploadBytesWithCache(fileRef, newHeroLogoFile);
      const url = await getDownloadURL(fileRef);
      const newItem: HeroLogo = {
        id: Date.now().toString(),
        url,
        align: newHeroLogoAlign,
        active: true,
      };
      const updated = [...heroLogos, newItem];
      await persistHeroLogos(updated);
      setNewHeroLogoFile(null);
      setNewHeroLogoAlign('left');
      await logActivity(tenantId, { action: 'TAMBAH', target: 'SLIDESHOW', title: `Logo hero (${newItem.align})` });
      toast.fire({ icon: 'success', title: 'Logo hero berhasil ditambahkan' });
    } catch (err: any) {
      showAlert('Gagal', err.message || 'Gagal menambahkan logo hero.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateHeroLogo = async (id: string, patch: Partial<HeroLogo>) => {
    if (!tenantId) return;
    const updated = heroLogos.map(item => item.id === id ? { ...item, ...patch } : item);
    await persistHeroLogos(updated);
  };

  const handleDeleteHeroLogo = async (id: string) => {
    if (!tenantId) return;
    const item = heroLogos.find(logo => logo.id === id);
    if (!item) return;
    if ((await showConfirm('Hapus Logo Hero?', 'Logo opsional ini akan dihapus dari hero slideshow.')).isConfirmed) {
      try {
        await deleteObject(ref(storage, item.url));
      } catch (err: any) {
        if (err.code !== 'storage/object-not-found') {
          console.error('Gagal hapus logo hero:', err);
        }
      }
      const updated = heroLogos.filter(logo => logo.id !== id);
      await persistHeroLogos(updated);
      await logActivity(tenantId, { action: 'HAPUS', target: 'SLIDESHOW', title: `Logo hero ${id}` });
      toast.fire({ icon: 'success', title: 'Logo hero berhasil dihapus' });
    }
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
      let slideUrl = currentSlide.url || '';

      if (isOwner && currentSlide.url) {
        // Owner reupload image with caching
        try {
          const response = await fetch(currentSlide.url);
          const blob = await response.blob();
          const fileName = `slide_${currentSlide.id}_recache.webp`;
          const fileRef = getStorageRef(tenantId, `settings/slides/${fileName}`);
          await uploadBytesWithCache(fileRef, blob);
          const newUrl = await getDownloadURL(fileRef);
          slideUrl = newUrl;

          // Delete old image
          const oldImageRef = ref(storage, currentSlide.url);
          await deleteObject(oldImageRef);

        } catch (error: any) {
          console.error('Error recaching slide image for owner:', error);
        }
      }

      const updatedSlides = heroSlides.map(s => s.id === currentSlide.id ? { ...currentSlide as HeroSlide, url: slideUrl, metadata: s.metadata } : s);
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
      await uploadBytesWithCache(fileRef, reconvertedBlob);
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
        try { await deleteObject(ref(storage, oldUrl)); } catch (err: any) { if (err.code !== 'storage/object-not-found') { /* console.error(\"Gagal hapus gambar lama setelah rekonversi:\", err); */ } }
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
        await set(newRef, { ...currentService, id: newRef.key, order: eServices.length });
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
      const data = { ...currentProfile, slug, attachments: currentProfile.attachments || [] };
      
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

  const handleSavePage = async () => {
    if (!tenantId || !currentPage.title) return;
    setSaving(true);
    try {
      const slug = currentPage.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const data = { ...currentPage, slug, attachments: currentPage.attachments || [] };

      if (currentPage.id) {
        await set(getDBRef(tenantId, `pages/${currentPage.id}`), data);
        await logActivity(tenantId, { action: 'EDIT', target: 'HALAMAN', title: `Update: ${data.title}` });
      } else {
        const newRef = push(getDBRef(tenantId, 'pages'));
        await set(newRef, { ...data, id: newRef.key, order: sitePages.length });
        await logActivity(tenantId, { action: 'TAMBAH', target: 'HALAMAN', title: `Tambah: ${data.title}` });
      }
      setShowPageModal(false);
      toast.fire({ icon: 'success', title: 'Halaman berhasil disimpan' });
    } catch (err) { showAlert('Gagal', 'Gagal menyimpan halaman.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteProfile = async (id: string, title: string) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Konten Profil?', `Menghapus "${title}" juga akan menghilangkan menu ini dari halaman publik.`)).isConfirmed) {
      const targetProfile = profiles.find(item => item.id === id);
      const attachmentsToDelete = targetProfile?.attachments || [];
      await Promise.all(attachmentsToDelete.map(async (attachment) => {
        if (!attachment.url && !attachment.storagePath) return;
        try {
          const attachmentRef = attachment.storagePath ? getStorageRef(tenantId, attachment.storagePath) : ref(storage, attachment.url);
          await deleteObject(attachmentRef);
        } catch (err: any) {
          if (err.code !== 'storage/object-not-found') {
            console.error('Gagal menghapus lampiran profil:', err);
          }
        }
      }));
      await remove(getDBRef(tenantId, `profiles/${id}`));
      await logActivity(tenantId, { action: 'HAPUS', target: 'PROFIL', title: `Hapus: ${title}` });
    }
  };

  const handleDeletePage = async (id: string, title: string) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Halaman?', `Menghapus "${title}" juga akan menghilangkan menu page yang mengarah ke halaman ini.`)).isConfirmed) {
      const targetPage = sitePages.find(item => item.id === id);
      const attachmentsToDelete = targetPage?.attachments || [];
      await Promise.all(attachmentsToDelete.map(async (attachment) => {
        if (!attachment.storagePath) return;
        try {
          const attachmentRef = getStorageRef(tenantId, attachment.storagePath);
          await deleteObject(attachmentRef);
        } catch (err: any) {
          if (err.code !== 'storage/object-not-found') {
            console.error('Gagal menghapus lampiran halaman:', err);
          }
        }
      }));
      const linkedPageIds = new Set(
        menuConfig.linkedMenus
          .filter(menu => menu.targetType === 'page' && menu.pageId === id)
          .map(menu => menu.id)
      );
      const removeWithDescendants = (items: LinkedMenuItem[]) => {
        const descendantIds = new Set(linkedPageIds);
        let changed = true;
        while (changed) {
          changed = false;
          items.forEach(menu => {
            if (!descendantIds.has(menu.id) && menu.parentId && descendantIds.has(menu.parentId)) {
              descendantIds.add(menu.id);
              changed = true;
            }
          });
        }
        return items.filter(menu => !descendantIds.has(menu.id));
      };
      const nextMenuConfig = { ...menuConfig, linkedMenus: normalizeLinkedMenus(removeWithDescendants(menuConfig.linkedMenus)) };
      await update(getDBRef(tenantId, 'settings'), { menuConfig: nextMenuConfig });
      syncMenuConfig(nextMenuConfig);
      await remove(getDBRef(tenantId, `pages/${id}`));
      await logActivity(tenantId, { action: 'HAPUS', target: 'HALAMAN', title: `Hapus: ${title}` });
    }
  };

  const handleOpenAttachments = (profile: ProfileContent) => {
    setCurrentAttachmentProfile(profile);
    setAttachmentItems(profile.attachments || []);
    setNewAttachmentTitle('');
    setNewAttachmentKind('image');
    setNewAttachmentUrl('');
    setNewAttachmentFile(null);
    setShowAttachmentModal(true);
  };

  const handleOpenPageAttachments = (page: SitePage) => {
    setCurrentAttachmentPage(page);
    setPageAttachmentItems(page.attachments || []);
    setNewPageAttachmentTitle('');
    setNewPageAttachmentKind('image');
    setNewPageAttachmentUrl('');
    setNewPageAttachmentFile(null);
    setShowPageAttachmentModal(true);
  };

  const handleAddAttachment = async () => {
    if (!tenantId || !currentAttachmentProfile?.id || !newAttachmentTitle.trim()) return;
    setAttachmentSaving(true);
    try {
      const kind = normalizePageAttachmentKind(newAttachmentKind);
      const safeTitle = newAttachmentTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'lampiran';
      let nextAttachment: ProfileAttachment | null = null;

      if (kind === 'image') {
        if (!newAttachmentFile) return;
        const webpBlob = await convertToWebP(newAttachmentFile);
        const fileName = `${Date.now()}_${safeTitle}.webp`;
        const fileRef = getStorageRef(tenantId, getProfileAttachmentsPath(currentAttachmentProfile.id, fileName));
        await uploadBytesWithCache(fileRef, webpBlob);
        const url = await getDownloadURL(fileRef);
        nextAttachment = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: newAttachmentTitle.trim(),
          kind,
          url,
          storagePath: getProfileAttachmentsPath(currentAttachmentProfile.id, fileName)
        };
      } else {
        const sourceUrl = newAttachmentUrl.trim();
        if (!sourceUrl) return;
        nextAttachment = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: newAttachmentTitle.trim(),
          kind,
          sourceUrl,
          url: buildPageAttachmentEmbedUrl(kind, sourceUrl)
        };
      }

      const nextAttachments = [...attachmentItems, nextAttachment];
      await persistAttachmentList(currentAttachmentProfile.id, nextAttachments);
      setNewAttachmentTitle('');
      setNewAttachmentKind('image');
      setNewAttachmentUrl('');
      setNewAttachmentFile(null);
      toast.fire({ icon: 'success', title: 'Lampiran berhasil ditambahkan' });
      await logActivity(tenantId, { action: 'EDIT', target: 'PROFIL', title: `Tambah lampiran: ${currentAttachmentProfile.title}` });
    } catch (error: any) {
      showAlert('Gagal', error.message || 'Gagal menambah lampiran.', 'error');
    } finally {
      setAttachmentSaving(false);
    }
  };

  const handleAddPageAttachment = async () => {
    if (!tenantId || !currentAttachmentPage?.id || !newPageAttachmentTitle.trim()) return;
    setPageAttachmentSaving(true);
    try {
      const kind = normalizePageAttachmentKind(newPageAttachmentKind);
      const safeTitle = newPageAttachmentTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'lampiran';
      let nextAttachment: PageAttachmentItem | null = null;

      if (kind === 'image') {
        if (!newPageAttachmentFile) return;
        const webpBlob = await convertToWebP(newPageAttachmentFile);
        const fileName = `${Date.now()}_${safeTitle}.webp`;
        const fileRef = getStorageRef(tenantId, getPageAttachmentsPath(currentAttachmentPage.id, fileName));
        await uploadBytesWithCache(fileRef, webpBlob);
        const url = await getDownloadURL(fileRef);
        nextAttachment = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: newPageAttachmentTitle.trim(),
          kind,
          url,
          storagePath: getPageAttachmentsPath(currentAttachmentPage.id, fileName)
        };
      } else {
        const sourceUrl = newPageAttachmentUrl.trim();
        if (!sourceUrl) return;
        nextAttachment = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: newPageAttachmentTitle.trim(),
          kind,
          sourceUrl,
          url: buildPageAttachmentEmbedUrl(kind, sourceUrl)
        };
      }

      const nextAttachments = [...pageAttachmentItems, nextAttachment];
      await persistPageAttachmentList(currentAttachmentPage.id, nextAttachments);
      setNewPageAttachmentTitle('');
      setNewPageAttachmentKind('image');
      setNewPageAttachmentUrl('');
      setNewPageAttachmentFile(null);
      toast.fire({ icon: 'success', title: 'Lampiran halaman berhasil ditambahkan' });
      await logActivity(tenantId, { action: 'EDIT', target: 'HALAMAN', title: `Tambah lampiran: ${currentAttachmentPage.title}` });
    } catch (error: any) {
      showAlert('Gagal', error.message || 'Gagal menambah lampiran halaman.', 'error');
    } finally {
      setPageAttachmentSaving(false);
    }
  };

  const handleAttachmentTitleBlur = async (attachmentId: string, title: string) => {
    if (!tenantId || !currentAttachmentProfile?.id) return;
    const trimmedTitle = title.trim();
    const nextAttachments = attachmentItems.map(item => item.id === attachmentId ? { ...item, title: trimmedTitle } : item);
    await persistAttachmentList(currentAttachmentProfile.id, nextAttachments);
  };

  const handleAttachmentSourceBlur = async (attachmentId: string, sourceUrl: string) => {
    if (!tenantId || !currentAttachmentProfile?.id) return;
    const trimmedSourceUrl = sourceUrl.trim();
    const nextAttachments = attachmentItems.map(item => {
      if (item.id !== attachmentId) return item;
      const kind = normalizePageAttachmentKind(item.kind);
      return {
        ...item,
        kind,
        sourceUrl: trimmedSourceUrl,
        url: kind === 'image' ? item.url : buildPageAttachmentEmbedUrl(kind, trimmedSourceUrl)
      };
    });
    await persistAttachmentList(currentAttachmentProfile.id, nextAttachments);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!tenantId || !currentAttachmentProfile?.id) return;
    const target = attachmentItems.find(item => item.id === attachmentId);
    if (!target) return;
    if ((await showConfirm('Hapus Lampiran?', target.title)).isConfirmed) {
      const nextAttachments = attachmentItems.filter(item => item.id !== attachmentId);
      if (target.url || target.storagePath) {
        try {
          const attachmentRef = target.storagePath ? getStorageRef(tenantId, target.storagePath) : ref(storage, target.url);
          await deleteObject(attachmentRef);
        } catch (err: any) {
          if (err.code !== 'storage/object-not-found') {
            console.error('Gagal menghapus file lampiran:', err);
          }
        }
      }
      await persistAttachmentList(currentAttachmentProfile.id, nextAttachments);
      await logActivity(tenantId, { action: 'HAPUS', target: 'PROFIL', title: `Hapus lampiran: ${target.title}` });
      toast.fire({ icon: 'success', title: 'Lampiran dihapus' });
    }
  };

  const handlePageAttachmentTitleBlur = async (attachmentId: string, title: string) => {
    if (!tenantId || !currentAttachmentPage?.id) return;
    const trimmedTitle = title.trim();
    const nextAttachments = pageAttachmentItems.map(item => item.id === attachmentId ? { ...item, title: trimmedTitle } : item);
    await persistPageAttachmentList(currentAttachmentPage.id, nextAttachments);
  };

  const handlePageAttachmentSourceBlur = async (attachmentId: string, sourceUrl: string) => {
    if (!tenantId || !currentAttachmentPage?.id) return;
    const trimmedSourceUrl = sourceUrl.trim();
    const nextAttachments = pageAttachmentItems.map(item => {
      if (item.id !== attachmentId) return item;
      const kind = normalizePageAttachmentKind(item.kind);
      return {
        ...item,
        kind,
        sourceUrl: trimmedSourceUrl,
        url: kind === 'image' ? item.url : buildPageAttachmentEmbedUrl(kind, trimmedSourceUrl)
      };
    });
    await persistPageAttachmentList(currentAttachmentPage.id, nextAttachments);
  };

  const handleDeletePageAttachment = async (attachmentId: string) => {
    if (!tenantId || !currentAttachmentPage?.id) return;
    const target = pageAttachmentItems.find(item => item.id === attachmentId);
    if (!target) return;
    if ((await showConfirm('Hapus Lampiran?', target.title)).isConfirmed) {
      const nextAttachments = pageAttachmentItems.filter(item => item.id !== attachmentId);
      if (target.storagePath) {
        try {
          const attachmentRef = getStorageRef(tenantId, target.storagePath);
          await deleteObject(attachmentRef);
        } catch (err: any) {
          if (err.code !== 'storage/object-not-found') {
            console.error('Gagal menghapus file lampiran halaman:', err);
          }
        }
      }
      await persistPageAttachmentList(currentAttachmentPage.id, nextAttachments);
      await logActivity(tenantId, { action: 'HAPUS', target: 'HALAMAN', title: `Hapus lampiran: ${target.title}` });
      toast.fire({ icon: 'success', title: 'Lampiran halaman dihapus' });
    }
  };

  const toggleProfileStatus = async (item: ProfileContent) => {
    if (!tenantId) return;
    await set(getDBRef(tenantId, `profiles/${item.id}/isActive`), !item.isActive);
    toast.fire({ icon: 'info', title: `Status ${item.title} diperbarui` });
  };

  const togglePageStatus = async (item: SitePage) => {
    if (!tenantId) return;
    await set(getDBRef(tenantId, `pages/${item.id}/isActive`), !item.isActive);
    toast.fire({ icon: 'info', title: `Status ${item.title} diperbarui` });
  };

  const handleUpdateLayout = async (layout: EServicesLayout) => {
    if (!tenantId) return;
    setSaving(true);
    try {
        await set(getDBRef(tenantId, 'settings/eServicesLayout'), layout);
        setFormData(prev => ({ ...prev, eServicesLayout: layout }));
        toast.fire({ icon: 'success', title: 'Layout diperbarui' });
    } catch (err) { showAlert('Gagal', 'Gagal update layout.', 'error'); }
    finally { setSaving(false); }
  };

  const handleSaveDetailHeroConfig = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      let nextConfig: DetailHeroConfig = { ...detailHeroConfig };

      if (detailHeroImageFile) {
        const webpBlob = await convertToWebP(detailHeroImageFile);
        const fileName = `detail-hero_${Date.now()}.webp`;
        const storagePath = `settings/detail-hero/${fileName}`;
        const fileRef = getStorageRef(tenantId, storagePath);
        await uploadBytesWithCache(fileRef, webpBlob);
        const imageUrl = await getDownloadURL(fileRef);

        if (detailHeroConfig.imageStoragePath) {
          try {
            await deleteObject(getStorageRef(tenantId, detailHeroConfig.imageStoragePath));
          } catch (err: any) {
            if (err.code !== 'storage/object-not-found') {
              console.error('Gagal menghapus background header lama:', err);
            }
          }
        }

        nextConfig = {
          ...nextConfig,
          imageUrl,
          imageStoragePath: storagePath
        };
      }

      await update(getDBRef(tenantId, 'settings'), { detailHeroConfig: nextConfig });
      setDetailHeroConfig(nextConfig);
      setDetailHeroImageFile(null);
      if (nextConfig.imageStoragePath) {
        setDetailHeroImageMetadata(await getImageMetadata(nextConfig.imageStoragePath));
      } else {
        setDetailHeroImageMetadata(null);
      }
      await logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: 'Update background header detail page/profil' });
      toast.fire({ icon: 'success', title: 'Latar header detail berhasil diperbarui' });
    } catch (err: any) {
      showAlert('Gagal', err.message || 'Gagal menyimpan latar header detail.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const normalizeLinkedMenus = (items: LinkedMenuItem[]) => {
    const grouped = new Map<string | null, LinkedMenuItem[]>();
    items.forEach(item => {
      const parentKey = item.parentId ?? null;
      const list = grouped.get(parentKey) || [];
      list.push(item);
      grouped.set(parentKey, list);
    });

    return Array.from(grouped.entries()).flatMap(([parentId, list]) =>
      list
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({
          ...item,
          parentId,
          order: index
        }))
    );
  };

  const openMenuItemModal = (mode: 'root' | 'submenu', parentId: string | null = null, item?: LinkedMenuItem) => {
    if (item) {
      setCurrentMenuItem(item);
      setMenuItemMode(item.parentId ? 'submenu' : 'root');
      setMenuItemParentId(item.parentId);
      setMenuItemInsertAfterId(item.parentId ? null : (item.rootAfterId || 'content'));
      setMenuPageTargetId(item.targetType === 'page' ? (item.pageId || null) : null);
    } else {
      const siblings = menuConfig.linkedMenus.filter(menu => (menu.parentId ?? null) === parentId);
      setCurrentMenuItem({
        title: '',
        url: '',
        active: true,
        order: siblings.length,
        parentId
      });
      setMenuItemMode(mode);
      setMenuItemParentId(parentId);
      const orderedRoots = getOrderedRootMenus();
      setMenuItemInsertAfterId(mode === 'root' ? (orderedRoots[orderedRoots.length - 1]?.id || null) : null);
      setMenuPageTargetId(null);
    }
    setShowMenuItemModal(true);
  };

  const handleSaveMenuItem = async () => {
    if (!tenantId || !currentMenuItem.title?.trim()) return;
    setSaving(true);
    try {
      const nextItem: LinkedMenuItem = {
        id: currentMenuItem.id || `menu-${Date.now()}`,
        title: currentMenuItem.title.trim(),
        url: currentMenuItem.targetType === 'page'
          ? (() => {
              const targetPage = sitePages.find(page => page.id === menuPageTargetId);
              return targetPage ? `/page/${targetPage.slug}` : '';
            })()
          : (currentMenuItem.url?.trim() || ''),
        active: currentMenuItem.active !== false,
        order: typeof currentMenuItem.order === 'number' ? currentMenuItem.order : 0,
        parentId: menuItemMode === 'submenu' ? (menuItemParentId || null) : null,
        rootAfterId: menuItemMode === 'root' ? (menuItemInsertAfterId || 'content') : null
        ,targetType: currentMenuItem.targetType || 'url',
        pageId: currentMenuItem.targetType === 'page' ? (menuPageTargetId || null) : null
      };

      const remainingItems = menuConfig.linkedMenus.filter(item => item.id !== nextItem.id);
      const rootItems = remainingItems
        .filter(item => (item.parentId ?? null) === null)
        .sort((a, b) => a.order - b.order);
      const childItems = remainingItems
        .filter(item => (item.parentId ?? null) !== null)
        .sort((a, b) => a.order - b.order);

      let nextItems: LinkedMenuItem[];

      if (menuItemMode === 'root') {
        const nextAnchorId = menuItemInsertAfterId || 'content';
        nextItem.rootAfterId = nextAnchorId;

        const nextRootItems = [...rootItems];
        const existingIndex = currentMenuItem.id ? nextRootItems.findIndex(item => item.id === currentMenuItem.id) : -1;
        if (existingIndex >= 0) nextRootItems.splice(existingIndex, 1);
        const lastSameAnchorIndex = [...nextRootItems].map((item, index) => ((item.rootAfterId || 'content') === nextAnchorId ? index : -1)).filter(index => index >= 0).pop();
        nextRootItems.splice(typeof lastSameAnchorIndex === 'number' ? lastSameAnchorIndex + 1 : nextRootItems.length, 0, nextItem);
        nextItems = normalizeLinkedMenus([
          ...childItems,
          ...nextRootItems.map((item, index) => ({ ...item, parentId: null, order: index }))
        ]);
      } else {
        nextItems = normalizeLinkedMenus([...remainingItems, nextItem]);
      }

      const nextConfig = { ...menuConfig, linkedMenus: nextItems };
      await update(getDBRef(tenantId, 'settings'), { menuConfig: nextConfig });
      syncMenuConfig(nextConfig);
      setShowMenuItemModal(false);
      toast.fire({ icon: 'success', title: 'Menu linked berhasil disimpan' });
      await logActivity(tenantId, { action: currentMenuItem.id ? 'EDIT' : 'TAMBAH', target: 'SETTINGS', title: `${currentMenuItem.id ? 'Ubah' : 'Tambah'} menu: ${nextItem.title}` });
    } catch (err: any) {
      showAlert('Gagal', err.message || 'Gagal menyimpan menu linked.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMenuItem = async (item: LinkedMenuItem) => {
    if (!tenantId) return;
    if ((await showConfirm('Hapus Menu?', item.title)).isConfirmed) {
      const childCount = menuConfig.linkedMenus.filter(menu => menu.parentId === item.id).length;
      const remaining = menuConfig.linkedMenus.filter(menu => menu.id !== item.id && menu.parentId !== item.id);
      const nextConfig = { ...menuConfig, linkedMenus: normalizeLinkedMenus(remaining) };
      await update(getDBRef(tenantId, 'settings'), { menuConfig: nextConfig });
      syncMenuConfig(nextConfig);
      toast.fire({ icon: 'success', title: 'Menu dihapus' });
      await logActivity(tenantId, { action: 'HAPUS', target: 'SETTINGS', title: `Hapus menu: ${item.title}${childCount ? ` (${childCount} submenu)` : ''}` });
    }
  };

  const handleToggleMenuItem = async (item: LinkedMenuItem) => {
    if (!tenantId) return;
    const updated = menuConfig.linkedMenus.map(menu => menu.id === item.id ? { ...menu, active: !menu.active } : menu);
    const nextConfig = { ...menuConfig, linkedMenus: normalizeLinkedMenus(updated) };
    await update(getDBRef(tenantId, 'settings'), { menuConfig: nextConfig });
    syncMenuConfig(nextConfig);
    toast.fire({ icon: 'info', title: `Status ${item.title} diperbarui` });
  };

  const handleMoveMenuItem = async (item: LinkedMenuItem, direction: 'up' | 'down') => {
    if (!tenantId) return;
    const parentId = item.parentId ?? null;
    const siblings = menuConfig.linkedMenus
      .filter(menu => (menu.parentId ?? null) === parentId)
      .sort((a, b) => a.order - b.order);
    const currentIndex = siblings.findIndex(menu => menu.id === item.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

    const otherItems = menuConfig.linkedMenus.filter(menu => (menu.parentId ?? null) !== parentId);
    const nextItems = normalizeLinkedMenus([...otherItems, ...reordered.map((menu, index) => ({ ...menu, order: index }))]);
    const nextConfig = { ...menuConfig, linkedMenus: nextItems };
    await update(getDBRef(tenantId, 'settings'), { menuConfig: nextConfig });
    syncMenuConfig(nextConfig);
    toast.fire({ icon: 'success', title: 'Urutan menu diperbarui' });
  };

  const handlePromptEditMenuLabel = async (field: keyof MenuLabels, promptTitle: string) => {
    if (!tenantId) return;
    const currentValue = menuConfig.labels[field] || DEFAULT_MENU_LABELS[field];
    const nextValue = window.prompt(`Ubah label ${promptTitle}`, currentValue);
    if (nextValue === null) return;

    const trimmedValue = nextValue.trim();
    if (!trimmedValue) {
      showAlert('Validasi', 'Label menu tidak boleh kosong.', 'warning');
      return;
    }

    const nextConfig = normalizeMenuConfig({
      ...menuConfig,
      labels: { ...menuConfig.labels, [field]: trimmedValue }
    });

    setSaving(true);
    try {
      await update(getDBRef(tenantId, 'settings'), { menuConfig: nextConfig });
      syncMenuConfig(nextConfig);
      toast.fire({ icon: 'success', title: `Label ${promptTitle} diperbarui` });
      await logActivity(tenantId, { action: 'EDIT', target: 'SETTINGS', title: `Update label menu: ${promptTitle}` });
    } catch (err: any) {
      showAlert('Gagal', err.message || `Gagal memperbarui label ${promptTitle}.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReorderEService = async (id: string, direction: 'up' | 'down') => {
    if (!tenantId) return;
    const currentIndex = eServices.findIndex(item => item.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= eServices.length) return;

    const reordered = [...eServices];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

    const updates: Record<string, number> = {};
    reordered.forEach((item, index) => {
      updates[`e_services/${item.id}/order`] = index;
    });

    await update(getDBRef(tenantId, ''), updates);
    setEServices(reordered.map((item, index) => ({ ...item, order: index })));
    toast.fire({ icon: 'success', title: 'Urutan layanan diperbarui' });
  };

  const getSocialIcon = (platform: string) => {
    switch(platform) {
      case 'facebook': return <FaFacebook />;
      case 'instagram': return <FaInstagram />;
      case 'youtube': return <FaYoutube />;
      case 'twitter': return <FaTwitter />;
      case 'x': return <FaXTwitter />;
      case 'linkedin': return <FaLinkedin />;
      case 'tiktok': return <FaTiktok />;
      case 'telegram': return <FaTelegram />;
      case 'whatsapp': return <FaWhatsapp />;
      case 'pinterest': return <FaPinterest />;
      case 'github': return <FaGithub />;
      case 'discord': return <FaDiscord />;
      default: return <FaLink />;
    }
  };

  const needsReconversion = (metadata: ImageMetadata | null | undefined) => metadata && (metadata.fileExtension !== 'webp' || metadata.sizeBytes > 102400);
  const rootLinkedMenus = getRootMenus();

  if (loading) return <DashboardLayout><div className="text-center py-5"><Spinner animation="border" variant="success" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <Container fluid className="p-0 pb-5">
        <div className="d-flex justify-content-between align-items-center mb-4"><h4 className="fw-bold text-dark mb-0">Pengaturan {terms.school}</h4>{(saving) && <Badge bg="warning" className="text-dark border-0"><Spinner size="sm" className="me-1" /> Sedang Memproses...</Badge>}</div>
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'general')} className="mb-4 custom-tabs border-0">
          <Tab eventKey="general" title={<><FaSchool className="me-2" /> Profil</>}>
             <Card className="border-0 shadow-sm mb-4 rounded-4"><Card.Body className="p-4"><div className="d-flex gap-2 mb-4 bg-light p-2 rounded-3 sub-nav-container overflow-auto"><Button variant={activeSubTab === 'identity' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('identity')}><FaSchool className="me-2" /> Identitas</Button><Button variant={activeSubTab === 'headmaster' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('headmaster')}><FaUserTie className="me-2" /> Kepala Lembaga</Button><Button variant={activeSubTab === 'school' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('school')}><FaHistory className="me-2" /> Detail Profil</Button><Button variant={activeSubTab === 'contact' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('contact')}><FaPhone className="me-2" /> Detail Kontak</Button><Button variant={activeSubTab === 'social' ? 'success' : 'light'} size="sm" className="rounded-pill px-3 fw-bold flex-shrink-0" onClick={() => setActiveSubTab('social')}><FaExternalLinkAlt className="me-2" /> Media Sosial</Button></div>
                   {activeSubTab === 'identity' && (<Form onSubmit={handleSaveGeneral} className="animate-fade-in"><h6 className="fw-bold mb-4 text-success border-start border-3 border-success ps-2">Identitas Utama & Logo</h6><Row className="align-items-center mb-4"><Col md={3} className="text-center"><div className="mb-3 bg-white rounded-circle d-flex align-items-center justify-content-center border mx-auto shadow-sm position-relative" style={{ width: '150px', height: '150px', overflow: 'hidden' }}><ProgressiveImage src={newLogoFile ? URL.createObjectURL(newLogoFile) : formData.logo || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} className="img-fluid p-2" alt="Logo Preview"/></div>{logoMetadata && (<div className="d-flex justify-content-center align-items-center gap-2 mt-n2 mb-2"><span className="text-muted x-small">{formatBytes(logoMetadata.sizeBytes)} .{logoMetadata.fileExtension}</span>{needsReconversion(logoMetadata) && (<Button variant="link" className="p-0 text-warning" onClick={() => handleReconvertClick({type: 'logo', url: formData.logo})} disabled={isReconverting}><FaSyncAlt size={12} /></Button>)}</div>)}<input type="file" className="d-none" id="logo-upload" accept="image/png,image/jpeg" onChange={e => e.target.files && setNewLogoFile(e.target.files[0])} /><Button size="sm" variant="outline-success" className="rounded-pill px-3 fw-bold" onClick={() => document.getElementById('logo-upload')?.click()}>Ganti Logo</Button></Col><Col md={9}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted text-uppercase">NAMA {terms.school.toUpperCase()}</Form.Label><Form.Control value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} required className="fw-bold fs-5" /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">TAGLINE / SLOGAN</Form.Label><Form.Control value={formData.tagline} onChange={e => setFormData({...formData, tagline: e.target.value})} placeholder="Unggul dalam Prestasi..." /></Form.Group><Form.Group className="mb-0"><Form.Label className="x-small fw-bold text-muted">DESKRIPSI SEKOLAH</Form.Label><Form.Control as="textarea" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Deskripsi singkat sekolah ini." /></Form.Group></Col></Row><hr className="my-4 opacity-50" /><div className="d-flex justify-content-end"><Button type="submit" variant="success" className="px-5 py-2 fw-bold shadow rounded-pill" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Identitas</Button></div></Form>)}
                   {activeSubTab === 'headmaster' && (<Form onSubmit={handleSaveGeneral} className="animate-fade-in"><h6 className="fw-bold mb-4 text-success border-start border-3 border-success ps-2">Profil {terms.headmaster}</h6><Row><Col md={8}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted text-uppercase">NAMA LENGKAP {terms.headmaster.toUpperCase()}</Form.Label><Form.Control value={formData.headmaster.name} onChange={e => setFormData({...formData, headmaster: {...formData.headmaster, name: e.target.value}})} className="fw-bold" /></Form.Group><Form.Group className="mb-0"><Form.Label className="x-small fw-bold text-muted">SAMBUTAN SINGKAT (HOME)</Form.Label><Form.Control as="textarea" rows={8} value={formData.headmaster.greeting} onChange={e => setFormData({...formData, headmaster: {...formData.headmaster, greeting: e.target.value}})} style={{ fontSize: '1rem', lineHeight: '1.6' }} /></Form.Group></Col><Col md={4}><div className="text-center mt-3 mt-md-0"><Form.Label className="x-small fw-bold text-muted d-block text-start">FOTO PROFIL</Form.Label><div className="mb-3 bg-light rounded-4 border mx-auto overflow-hidden shadow-sm position-relative" style={{ width: '100%', height: '250px' }}><ProgressiveImage src={headmasterPhotoFile ? URL.createObjectURL(headmasterPhotoFile) : formData.headmaster.photo || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'} className="img-fluid h-100 w-100 object-fit-cover" alt="Headmaster" /></div>{headmasterPhotoMetadata && (<div className="d-flex justify-content-center align-items-center gap-2 mt-n2 mb-2"><span className="text-muted x-small">{formatBytes(headmasterPhotoMetadata.sizeBytes)} .{headmasterPhotoMetadata.fileExtension}</span>{needsReconversion(headmasterPhotoMetadata) && (<Button variant="link" className="p-0 text-warning" onClick={() => handleReconvertClick({type: 'headmaster', url: formData.headmaster.photo})} disabled={isReconverting}><FaSyncAlt size={12} /></Button>)}</div>)}<input type="file" className="d-none" id="hm-photo" accept="image/*" onChange={e => e.target.files && setHeadmasterPhotoFile(e.target.files[0])} /><Button variant="outline-success" className="rounded-pill w-100 fw-bold" onClick={() => document.getElementById('hm-photo')?.click()}>Ganti Foto Profil</Button></div></Col></Row><hr className="my-4 opacity-50" /><div className="d-flex justify-content-end"><Button type="submit" variant="success" className="px-5 py-2 fw-bold shadow rounded-pill" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Profil {terms.headmaster}</Button></div></Form>)}
                    {activeSubTab === 'school' && (<div className="animate-fade-in"><div className="d-flex justify-content-between align-items-center mb-4"><h6 className="fw-bold mb-0 text-success border-start border-3 border-success ps-2">Daftar Konten Profil {terms.school}</h6><Button variant="success" size="sm" className="rounded-pill px-3 fw-bold" onClick={() => { setCurrentProfile({ title: '', content: '', isActive: true, order: profiles.length, attachments: [] }); setShowProfileModal(true); }}><FaPlus className="me-1" /> Tambah Halaman Profil</Button></div><ListGroup className="border-0">{profiles.map((item) => (<ListGroup.Item key={item.id} className="mb-3 rounded-4 border shadow-sm p-3 bg-white"><div className="d-flex justify-content-between align-items-center gap-3"><div className="d-flex align-items-center flex-grow-1 overflow-hidden"><div className={`me-3 p-2 rounded-circle flex-shrink-0 ${item.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>{item.isActive ? <FaCheckCircle size={20} /> : <FaTimesCircle size={20} />}</div><div className="overflow-hidden"><div className="fw-bold text-dark text-truncate">{item.title}</div><code className="extra-small text-muted">/profil/{item.slug}</code>{(item.attachments?.length || 0) > 0 && <div className="extra-small text-success mt-1">{item.attachments?.length} lampiran</div>}</div></div><div className="d-flex gap-2 flex-shrink-0"><Button variant="light" size="sm" className="btn-icon position-relative" title="Lampiran" onClick={() => handleOpenAttachments(item)}><FaPaperclip size={13} className="text-secondary" />{(item.attachments?.length || 0) > 0 && <Badge bg="success" pill className="position-absolute top-0 start-100 translate-middle">{item.attachments?.length}</Badge>}</Button><Button variant="light" size="sm" className="btn-icon" title="Preview" onClick={() => window.open(`/profil/${item.slug}`, '_blank')}><FaEye size={14} className="text-info" /></Button><Button variant="light" size="sm" className="btn-icon" title="Ubah Status" onClick={() => toggleProfileStatus(item)}>{item.isActive ? <FaTimesCircle size={14} className="text-warning" /> : <FaCheckCircle size={14} className="text-success" />}</Button><Button variant="light" size="sm" className="btn-icon" title="Edit" onClick={() => { setCurrentProfile({ ...item, attachments: item.attachments || [] }); setShowProfileModal(true); }}><FaEdit size={14} className="text-primary" /></Button><Button variant="light" size="sm" className="btn-icon" title="Hapus" onClick={() => handleDeleteProfile(item.id, item.title)}><FaTrash size={14} className="text-danger" /></Button></div></div></ListGroup.Item>))}{profiles.length === 0 && <div className="text-center py-5 text-muted border rounded-4 bg-light">Belum ada halaman profil dinamis.</div>}</ListGroup><p className="small text-muted mt-3"><i className="bi bi-info-circle me-1"></i> Item aktif akan muncul di navigasi Profil.</p></div>)}
                   {activeSubTab === 'contact' && (<Form onSubmit={handleSaveGeneral} className="animate-fade-in"><h6 className="fw-bold mb-4 text-success border-start border-3 border-success ps-2">Informasi Kontak & Lokasi</h6><Row><Col md={6}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted"><FaPhone className="me-1" /> TELEPON</Form.Label><Form.Control value={formData.contact.phone} onChange={e => setFormData({...formData, contact: {...formData.contact, phone: e.target.value}})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted"><FaEnvelope className="me-1" /> EMAIL</Form.Label><Form.Control type="email" value={formData.contact.email} onChange={e => setFormData({...formData, contact: {...formData.contact, email: e.target.value}})} /></Form.Group><Form.Group className="mb-0"><Form.Label className="x-small fw-bold text-muted"><FaMapMarkerAlt className="me-1" /> ALAMAT</Form.Label><Form.Control as="textarea" rows={4} value={formData.contact.address} onChange={e => setFormData({...formData, contact: {...formData.contact, address: e.target.value}})} /></Form.Group></Col><Col md={6}><h6 className="fw-bold mb-3 text-dark border-start border-3 border-success ps-2">Lokasi Peta</h6><LocationMapPicker latitude={formData.contact.lat} longitude={formData.contact.lng} onLocationChange={(lat, lng) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, lat, lng }}))} />{formData.contact.lat && <div className="mt-3 bg-light p-3 rounded-4 border text-muted small"><FaLocationArrow className="me-2 text-success" />Lat: <strong>{formData.contact.lat}</strong>, Lng: <strong>{formData.contact.lng}</strong><Button variant="outline-info" size="sm" className="rounded-pill ms-3 py-0 px-2 x-small" onClick={() => window.open(`https://www.google.com/maps?q=${formData.contact.lat},${formData.contact.lng}`, '_blank')}><FaEye className="me-1" /> Lihat</Button></div>}</Col></Row><hr className="my-4 opacity-50" /><div className="d-flex justify-content-end"><Button type="submit" variant="success" className="px-5 py-2 fw-bold shadow rounded-pill" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Kontak</Button></div></Form>)}
                   {activeSubTab === 'social' && (<Form onSubmit={handleSaveGeneral} className="animate-fade-in"><h6 className="fw-bold mb-4 text-success border-start border-3 border-success ps-2">Media Sosial</h6><Row><Col xs={12}><div className="bg-light p-4 rounded-4 border">
{Object.keys(formData.socialMedia).map(key => (
  <Form.Group className="mb-3 d-flex align-items-center gap-2" key={key}>
    <Form.Check 
      type="switch" 
      id={`switch-${key}`}
      checked={(formData.socialMedia as any)[key].active} 
      onChange={e => setFormData({...formData, socialMedia: {...formData.socialMedia, [key]: { ...(formData.socialMedia as any)[key], active: e.target.checked }}})} 
    />
    <Form.Label className="x-small fw-bold text-muted mb-0" style={{ minWidth: '70px', textTransform: 'capitalize' }}>{key}</Form.Label>
    <InputGroup size="sm">
      <Form.Control 
        value={(formData.socialMedia as any)[key].url} 
        onChange={e => setFormData({...formData, socialMedia: {...formData.socialMedia, [key]: { ...(formData.socialMedia as any)[key], url: e.target.value }}})} 
        placeholder={`URL ${key}...`}
        disabled={!(formData.socialMedia as any)[key].active}
      />
      <InputGroup.Text className="bg-white text-muted">
        {getSocialIcon(key)}
      </InputGroup.Text>
    </InputGroup>
  </Form.Group>
))}
</div></Col></Row><hr className="my-4 opacity-50" /><div className="d-flex justify-content-end"><Button type="submit" variant="success" className="px-5 py-2 fw-bold shadow rounded-pill" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Media Sosial</Button></div></Form>)}
                </Card.Body></Card>
          </Tab>
          <Tab eventKey="slideshow" title={<><FaImage className="me-2" /> Slideshow</>}><Card className="border-0 shadow-sm mb-4 rounded-4 overflow-hidden"><Card.Header className="bg-white py-3 fw-bold border-0 d-flex justify-content-between align-items-center text-info"><span><FaImage className="me-2" /> Slideshow</span><Badge bg="info" className="text-white rounded-pill px-3">{heroSlides.length}/5</Badge></Card.Header><Card.Body className="p-4 pt-0"><div className="bg-light p-4 rounded-4 border mb-4"><h6 className="fw-bold mb-3">Tambah Slide Baru</h6><Row><Col md={6}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">JUDUL</Form.Label><Form.Control placeholder="Teks Utama" value={newSlideData.title} onChange={e => setNewSlideData({...newSlideData, title: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">SUB-JUDUL</Form.Label><Form.Control placeholder="Teks Penjelasan" value={newSlideData.subtitle} onChange={e => setNewSlideData({...newSlideData, subtitle: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">Object Fit</Form.Label><Form.Select value={newSlideData.objectFit} onChange={e => setNewSlideData({...newSlideData, objectFit: e.target.value as any})}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></Form.Select></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label className="x-small fw-bold text-muted">GAMBAR</Form.Label><Form.Control type="file" accept="image/*" onChange={handleSlideFileChange} /></Form.Group><Button variant="info" className="text-white w-100 fw-bold rounded-pill shadow-sm mt-2 py-2" onClick={handleAddSlide} disabled={saving || !newSlideFile}>{saving ? <Spinner size="sm" /> : <><FaPlus className="me-1" /> Unggah</>}</Button></Col></Row></div><h6 className="fw-bold mb-3">Daftar Slide Aktif</h6><Row className="g-4">{heroSlides.map(slide => (<Col key={slide.id} md={4}><Card className="group shadow-sm rounded-4 overflow-hidden border-0 h-100 bg-white"><div className="position-relative"><img src={slide.url} style={{ width: '100%', height: '180px', objectFit: slide.objectFit || 'cover' }} alt={slide.title} /><div className="position-absolute top-0 end-0 p-2 d-flex gap-2"><Button variant="light" size="sm" className="rounded-circle btn-icon shadow" onClick={() => { setCurrentSlide(slide); setShowSlideModal(true); }}><FaEdit size={12} /></Button><Button variant="danger" size="sm" className="rounded-circle btn-icon shadow" onClick={() => handleDeleteSlide(slide.id, slide.title)}><FaTrash size={12} /></Button></div></div><Card.Body className="p-3"><div className="fw-bold small text-truncate mb-1">{slide.title}</div><div className="text-muted extra-small text-truncate">{slide.subtitle || '-'}</div></Card.Body></Card></Col>))}{heroSlides.length === 0 && <Col xs={12} className="text-center py-5 text-muted">Belum ada slide.</Col>}</Row><div className="bg-light p-4 rounded-4 border mt-4"><div className="d-flex justify-content-between align-items-center mb-3"><h6 className="fw-bold mb-0">Logo Opsional Bawah Hero</h6><Badge bg="dark" className="rounded-pill">{heroLogos.filter(item => item.active).length} aktif</Badge></div><Row className="align-items-end g-3"><Col md={5}><Form.Group><Form.Label className="x-small fw-bold text-muted">UPLOAD LOGO</Form.Label><Form.Control type="file" accept="image/*" onChange={handleHeroLogoFileChange} /></Form.Group></Col><Col md={3}><Form.Group><Form.Label className="x-small fw-bold text-muted">FLOAT</Form.Label><Form.Select value={newHeroLogoAlign} onChange={e => setNewHeroLogoAlign(e.target.value as 'left' | 'right')}><option value="left">Left</option><option value="right">Right</option></Form.Select></Form.Group></Col><Col md={4}><Button variant="dark" className="w-100 rounded-pill fw-bold" onClick={handleAddHeroLogo} disabled={saving || !newHeroLogoFile}>{saving ? <Spinner size="sm" /> : 'Tambah Logo Hero'}</Button></Col></Row><div className="small text-muted mt-3">Logo akan otomatis dikonversi ke WebP kualitas 70% dan hanya panel bawah hero yang tampil jika minimal 1 logo aktif.</div><Row className="g-3 mt-1">{heroLogos.map(item => (<Col md={6} key={item.id}><div className="bg-white border rounded-4 p-3 h-100"><div className="d-flex align-items-center gap-3"><div className="border rounded-3 bg-light d-flex align-items-center justify-content-center" style={{ width: '110px', height: '68px', overflow: 'hidden' }}><img src={item.url} alt="Hero Logo" style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain' }} /></div><div className="flex-grow-1"><div className="d-flex justify-content-between align-items-center mb-2"><Form.Check type="switch" id={`hero-logo-${item.id}`} label={item.active ? 'Aktif' : 'Nonaktif'} checked={item.active} onChange={e => handleUpdateHeroLogo(item.id, { active: e.target.checked })} /><Button variant="light" size="sm" className="btn-icon" onClick={() => handleDeleteHeroLogo(item.id)}><FaTrash className="text-danger" size={12} /></Button></div><Form.Group><Form.Label className="extra-small fw-bold text-muted mb-1">POSISI</Form.Label><Form.Select size="sm" value={item.align} onChange={e => handleUpdateHeroLogo(item.id, { align: e.target.value as 'left' | 'right' })}><option value="left">Float Left</option><option value="right">Float Right</option></Form.Select></Form.Group></div></div></div></Col>))}{heroLogos.length === 0 && <Col xs={12} className="text-center py-3 text-muted">Belum ada logo opsional hero.</Col>}</Row></div></Card.Body></Card></Tab>
          <Tab eventKey="services" title={<><FaExternalLinkAlt className="me-2" /> Menu Layanan</>}><Card className="border-0 shadow-sm rounded-4"><Card.Header className="bg-white py-3 fw-bold border-0 d-flex justify-content-between align-items-center text-primary"><span><FaExternalLinkAlt className="me-2" /> E-Services</span><Button size="sm" variant="primary" className="rounded-pill px-3 fw-bold" onClick={() => { setCurrentService({ title: '', url: '', bgColor: '#198754', textColor: '#ffffff', icon: '🚀', iconType: 'emoji', order: eServices.length }); setShowServiceModal(true); }}><FaPlus className="me-1" /> Tambah</Button></Card.Header><Card.Body className="p-4 pt-0"><div className="bg-light p-3 rounded-4 mb-4 border"><div className="d-flex align-items-start justify-content-between gap-3 mb-2"><h6 className="fw-bold mb-0 text-dark small"><FaCogs className="me-1" /> Layout</h6><div className="small text-muted">Pilih tampilan yang paling nyaman untuk publik.</div></div><div className="d-grid gap-2 bg-white p-3 rounded-4 border shadow-sm"><Form.Check type="radio" label="Bento" name="layout" id="lay-bento" checked={formData.eServicesLayout === 'bento'} onChange={() => handleUpdateLayout('bento')} className="small fw-medium" /><Form.Check type="radio" label="Slider" name="layout" id="lay-slider" checked={formData.eServicesLayout === 'slider'} onChange={() => handleUpdateLayout('slider')} className="small fw-medium" /><Form.Check type="radio" label="Compact Grid" name="layout" id="lay-compact-grid" checked={formData.eServicesLayout === 'compact-grid'} onChange={() => handleUpdateLayout('compact-grid')} className="small fw-medium" /><Form.Check type="radio" label="List Card" name="layout" id="lay-list-card" checked={formData.eServicesLayout === 'list-card'} onChange={() => handleUpdateLayout('list-card')} className="small fw-medium" /></div></div><ListGroup variant="flush">{eServices.map((svc, index) => (<ListGroup.Item key={svc.id} className="px-0 py-3 d-flex align-items-center justify-content-between bg-transparent"><div className="d-flex align-items-center overflow-hidden"><div className="me-3 d-flex flex-column gap-1"><Button variant="light" size="sm" className="btn-icon" disabled={index === 0} onClick={() => handleReorderEService(svc.id, 'up')}><FaArrowUp size={11} className={index === 0 ? 'text-muted' : 'text-secondary'} /></Button><Button variant="light" size="sm" className="btn-icon" disabled={index === eServices.length - 1} onClick={() => handleReorderEService(svc.id, 'down')}><FaArrowDown size={11} className={index === eServices.length - 1 ? 'text-muted' : 'text-secondary'} /></Button></div><div className="me-3 p-2 rounded-3 d-flex align-items-center justify-content-center shadow-sm border" style={{ backgroundColor: svc.bgColor, color: svc.textColor, width: '42px', height: '42px', flexShrink: 0 }}><IconRenderer icon={svc.icon} type={svc.iconType} /></div><div className="overflow-hidden"><div className="fw-bold small text-dark lh-1 mb-1">{svc.title}</div><code className="extra-small text-muted text-truncate d-block">{svc.url}</code><div className="extra-small text-muted mt-1">Urutan: {(svc.order ?? index) + 1}</div></div></div><div className="d-flex gap-1 ms-2"><Button variant="light" size="sm" className="btn-icon" onClick={() => { setCurrentService(svc); setShowServiceModal(true); }}><FaEdit size={12} className="text-primary" /></Button><Button variant="light" size="sm" className="btn-icon" onClick={() => handleDeleteEService(svc.id, svc.title)}><FaTrash size={12} className="text-danger" /></Button></div></ListGroup.Item>))}{eServices.length === 0 && <div className="text-center py-4 text-muted small">Belum ada layanan.</div>}</ListGroup></Card.Body></Card></Tab>
          <Tab eventKey="menus" title={<><FaBars className="me-2" /> Atur Menu</>}>
            <Row className="g-4">
              <Col lg={5}>
                <Card className="border-0 shadow-sm rounded-4 mb-4">
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                      <div>
                        <h6 className="fw-bold mb-1 text-dark border-start border-3 border-dark ps-2"><FaSitemap className="me-2" /> Tree Menu Tetap</h6>
                        <div className="small text-muted mt-2">Klik ikon pensil di sisi kanan untuk mengubah label. `E-Layanan` tetap terhubung ke Layanan Digital.</div>
                      </div>
                    </div>
                    <div className="d-grid gap-3">
                      <div className="border rounded-4 p-3 bg-white shadow-sm">
                        <div className="d-flex align-items-start gap-3">
                          <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary flex-shrink-0"><FaHome size={16} /></div>
                          <div className="flex-grow-1 overflow-hidden d-flex align-items-start justify-content-between gap-3">
                            <div className="overflow-hidden">
                              <div className="fw-bold text-dark text-truncate">{menuConfig.labels.home || DEFAULT_MENU_LABELS.home}</div>
                              <div className="extra-small text-muted">Root tetap</div>
                            </div>
                            <Button variant="light" size="sm" className="btn-icon flex-shrink-0" title="Edit label" onClick={() => handlePromptEditMenuLabel('home', 'Beranda')} disabled={saving}><FaPen size={11} className="text-primary" /></Button>
                          </div>
                        </div>
                      </div>
                      <div className="border rounded-4 p-3 bg-white shadow-sm">
                        <div className="d-flex align-items-start gap-3">
                          <div className="p-2 rounded-circle bg-secondary bg-opacity-10 text-secondary flex-shrink-0"><FaNewspaper size={16} /></div>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="d-flex align-items-start justify-content-between gap-3">
                              <div className="overflow-hidden">
                                <div className="fw-bold text-dark text-truncate">{menuConfig.labels.content || DEFAULT_MENU_LABELS.content}</div>
                                <div className="extra-small text-muted mb-2">Root tetap</div>
                              </div>
                              <div className="d-flex gap-1 flex-shrink-0">
                                <Button variant="light" size="sm" className="btn-icon" title="Naik" onClick={() => handleMoveFixedRoot('content', 'up')} disabled={(menuConfig.fixedRootOrder.indexOf('content') <= 0) || saving}><FaArrowUp size={11} className={menuConfig.fixedRootOrder.indexOf('content') > 0 ? 'text-secondary' : 'text-muted'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" title="Turun" onClick={() => handleMoveFixedRoot('content', 'down')} disabled={(menuConfig.fixedRootOrder.indexOf('content') === -1 || menuConfig.fixedRootOrder.indexOf('content') >= menuConfig.fixedRootOrder.length - 1) || saving}><FaArrowDown size={11} className={(menuConfig.fixedRootOrder.indexOf('content') !== -1 && menuConfig.fixedRootOrder.indexOf('content') < menuConfig.fixedRootOrder.length - 1) ? 'text-secondary' : 'text-muted'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" title="Edit label" onClick={() => handlePromptEditMenuLabel('content', 'Konten')} disabled={saving}><FaPen size={11} className="text-primary" /></Button>
                              </div>
                            </div>
                            <div className="ps-4 d-grid gap-2">
                              {[
                                { key: 'news', icon: FaNewspaper, title: 'Berita' },
                                { key: 'announcements', icon: FaBullhorn, title: 'Pengumuman' },
                                { key: 'agenda', icon: FaCalendarAlt, title: 'Agenda' },
                                { key: 'video', icon: FaVideo, title: 'Video' },
                                { key: 'gallery', icon: FaImages, title: 'Galeri' }
                              ].map((item) => {
                                const Icon = item.icon;
                                const label = (menuConfig.labels as any)[item.key] || (DEFAULT_MENU_LABELS as any)[item.key];
                                return (
                                  <div key={item.key} className="d-flex align-items-center justify-content-between gap-3 text-muted small">
                                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                                      <Icon size={12} className="text-secondary flex-shrink-0" />
                                      <span className="text-truncate">{label}</span>
                                    </div>
                                    <Button variant="light" size="sm" className="btn-icon flex-shrink-0" title="Edit label" onClick={() => handlePromptEditMenuLabel(item.key as keyof MenuLabels, item.title)} disabled={saving}><FaPen size={10} className="text-primary" /></Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border rounded-4 p-3 bg-white shadow-sm">
                        <div className="d-flex align-items-start gap-3">
                          <div className="p-2 rounded-circle bg-secondary bg-opacity-10 text-secondary flex-shrink-0"><FaBookOpen size={16} /></div>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="d-flex align-items-start justify-content-between gap-3">
                              <div className="overflow-hidden">
                                <div className="fw-bold text-dark text-truncate">{menuConfig.labels.profile || DEFAULT_MENU_LABELS.profile}</div>
                                <div className="extra-small text-muted mb-2">Root tetap, submenu dikelola dari Detail Profil</div>
                              </div>
                              <div className="d-flex gap-1 flex-shrink-0">
                                <Button variant="light" size="sm" className="btn-icon" title="Naik" onClick={() => handleMoveFixedRoot('profile', 'up')} disabled={(menuConfig.fixedRootOrder.indexOf('profile') <= 0) || saving}><FaArrowUp size={11} className={menuConfig.fixedRootOrder.indexOf('profile') > 0 ? 'text-secondary' : 'text-muted'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" title="Turun" onClick={() => handleMoveFixedRoot('profile', 'down')} disabled={(menuConfig.fixedRootOrder.indexOf('profile') === -1 || menuConfig.fixedRootOrder.indexOf('profile') >= menuConfig.fixedRootOrder.length - 1) || saving}><FaArrowDown size={11} className={(menuConfig.fixedRootOrder.indexOf('profile') !== -1 && menuConfig.fixedRootOrder.indexOf('profile') < menuConfig.fixedRootOrder.length - 1) ? 'text-secondary' : 'text-muted'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" title="Edit label" onClick={() => handlePromptEditMenuLabel('profile', 'Profile')} disabled={saving}><FaPen size={11} className="text-primary" /></Button>
                              </div>
                            </div>
                            <div className="ps-4 d-grid gap-2">
                              {profiles.length > 0 ? profiles.map((profileItem) => (
                                <div key={profileItem.id} className="d-flex align-items-center justify-content-between gap-3 text-muted small">
                                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                                    {profileItem.isActive ? <FaCheckCircle size={12} className="text-success flex-shrink-0" /> : <FaTimesCircle size={12} className="text-secondary flex-shrink-0" />}
                                    <span className="text-truncate">{profileItem.title}</span>
                                  </div>
                                  <Badge bg={profileItem.isActive ? 'success' : 'secondary'} pill>{profileItem.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
                                </div>
                              )) : <div className="extra-small text-muted">Belum ada halaman profil.</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border rounded-4 p-3 bg-white shadow-sm">
                        <div className="d-flex align-items-start gap-3">
                          <div className="p-2 rounded-circle bg-warning bg-opacity-10 text-warning flex-shrink-0"><FaExternalLinkAlt size={16} /></div>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="d-flex align-items-start justify-content-between gap-3">
                              <div className="overflow-hidden">
                                <div className="fw-bold text-dark text-truncate">{menuConfig.labels.eServices || DEFAULT_MENU_LABELS.eServices}</div>
                                <div className="extra-small text-muted mb-2">Root tetap, sub menu berasal dari Layanan Digital</div>
                              </div>
                              <div className="d-flex gap-1 flex-shrink-0">
                                <Button variant="light" size="sm" className="btn-icon" title="Naik" onClick={() => handleMoveFixedRoot('eServices', 'up')} disabled={(menuConfig.fixedRootOrder.indexOf('eServices') <= 0) || saving}><FaArrowUp size={11} className={menuConfig.fixedRootOrder.indexOf('eServices') > 0 ? 'text-secondary' : 'text-muted'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" title="Turun" onClick={() => handleMoveFixedRoot('eServices', 'down')} disabled={(menuConfig.fixedRootOrder.indexOf('eServices') === -1 || menuConfig.fixedRootOrder.indexOf('eServices') >= menuConfig.fixedRootOrder.length - 1) || saving}><FaArrowDown size={11} className={(menuConfig.fixedRootOrder.indexOf('eServices') !== -1 && menuConfig.fixedRootOrder.indexOf('eServices') < menuConfig.fixedRootOrder.length - 1) ? 'text-secondary' : 'text-muted'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" title="Edit label" onClick={() => handlePromptEditMenuLabel('eServices', 'E-Layanan')} disabled={saving}><FaPen size={11} className="text-primary" /></Button>
                              </div>
                            </div>
                            <div className="ps-4 d-grid gap-2">
                              {eServices.length > 0 ? eServices.map((svc) => (
                                <div key={svc.id} className="d-flex align-items-center justify-content-between gap-3 text-muted small">
                                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                                    <FaLink size={12} className="text-secondary flex-shrink-0" />
                                    <span className="text-truncate">{svc.title}</span>
                                  </div>
                                  <Badge bg="light" text="secondary" className="border">Dari Layanan Digital</Badge>
                                </div>
                              )) : <div className="extra-small text-muted">Belum ada layanan digital.</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border rounded-4 p-3 bg-white shadow-sm">
                        <div className="d-flex align-items-start gap-3">
                          <div className="p-2 rounded-circle bg-info bg-opacity-10 text-info flex-shrink-0"><FaPhone size={16} /></div>
                          <div className="flex-grow-1 overflow-hidden d-flex align-items-start justify-content-between gap-3">
                            <div className="overflow-hidden">
                              <div className="fw-bold text-dark text-truncate">{menuConfig.labels.contact || DEFAULT_MENU_LABELS.contact}</div>
                              <div className="extra-small text-muted">Root tetap</div>
                            </div>
                            <div className="d-flex gap-1 flex-shrink-0">
                              <Button variant="light" size="sm" className="btn-icon" title="Naik" onClick={() => handleMoveFixedRoot('contact', 'up')} disabled={(menuConfig.fixedRootOrder.indexOf('contact') <= 0) || saving}><FaArrowUp size={11} className={menuConfig.fixedRootOrder.indexOf('contact') > 0 ? 'text-secondary' : 'text-muted'} /></Button>
                              <Button variant="light" size="sm" className="btn-icon" title="Turun" onClick={() => handleMoveFixedRoot('contact', 'down')} disabled={(menuConfig.fixedRootOrder.indexOf('contact') === -1 || menuConfig.fixedRootOrder.indexOf('contact') >= menuConfig.fixedRootOrder.length - 1) || saving}><FaArrowDown size={11} className={(menuConfig.fixedRootOrder.indexOf('contact') !== -1 && menuConfig.fixedRootOrder.indexOf('contact') < menuConfig.fixedRootOrder.length - 1) ? 'text-secondary' : 'text-muted'} /></Button>
                              <Button variant="light" size="sm" className="btn-icon" title="Edit label" onClick={() => handlePromptEditMenuLabel('contact', 'Kontak')} disabled={saving}><FaPen size={11} className="text-primary" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col lg={7}>
                <Card className="border-0 shadow-sm rounded-4 h-100">
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                      <div>
                        <h6 className="fw-bold mb-1 text-primary border-start border-3 border-primary ps-2"><FaSitemap className="me-2" /> Page/Linked Menu</h6>
                        <div className="small text-muted mt-2"><FaGlobe className="me-1" /> Menu bisa diarahkan ke URL bebas atau ke Page yang dikelola di bawah ini.</div>
                      </div>
                      <div className="d-flex gap-2 flex-shrink-0">
                        <Button variant="outline-primary" className="rounded-pill px-3 fw-bold" onClick={() => openMenuItemModal('root')}><FaPlus className="me-2" /> Root</Button>
                        <Button variant="primary" className="rounded-pill px-3 fw-bold" onClick={() => openMenuItemModal('submenu', rootLinkedMenus[0]?.id || null)} disabled={rootLinkedMenus.length === 0}><FaPlus className="me-2" /> Submenu</Button>
                      </div>
                    </div>
                    <div className="small text-muted mb-3">Root menu yang punya child akan tampil sebagai dropdown. Item aktif saja yang muncul di publik.</div>
                    <div className="d-grid gap-3">
                      {rootLinkedMenus.length > 0 ? rootLinkedMenus.map(root => {
                        const children = getChildrenMenus(root.id);
                        return (
                          <div key={root.id} className="border rounded-4 p-3 bg-white shadow-sm">
                            <div className="d-flex justify-content-between align-items-start gap-3">
                              <div className="d-flex align-items-start gap-3 flex-grow-1 overflow-hidden">
                                <div className="p-2 rounded-circle flex-shrink-0 bg-secondary bg-opacity-10 text-secondary">
                                  <FaSitemap size={18} />
                                </div>
                                <div className="overflow-hidden">
                                  <div className="fw-bold text-dark text-truncate">{root.title}</div>
                                  <code className="extra-small text-muted text-truncate d-block">{root.url || 'Tanpa URL'}</code>
                                  <div className="extra-small text-muted mt-1">{children.length} submenu</div>
                                </div>
                              </div>
                              <div className="d-flex gap-1 flex-shrink-0 flex-wrap justify-content-end">
                                <Button variant="light" size="sm" className="btn-icon" disabled={root.order === 0} onClick={() => handleMoveMenuItem(root, 'up')}><FaArrowUp size={11} className={root.order === 0 ? 'text-muted' : 'text-secondary'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" disabled={root.order >= rootLinkedMenus.length - 1} onClick={() => handleMoveMenuItem(root, 'down')}><FaArrowDown size={11} className={root.order >= rootLinkedMenus.length - 1 ? 'text-muted' : 'text-secondary'} /></Button>
                                <Button variant="light" size="sm" className="btn-icon" onClick={() => openMenuItemModal('submenu', root.id)} title="Tambah submenu"><FaPlus size={12} className="text-success" /></Button>
                                <Button variant="light" size="sm" className="btn-icon" onClick={() => handleToggleMenuItem(root)} title="Ubah status">{root.active ? <FaCheckCircle size={12} className="text-success" /> : <FaTimesCircle size={12} className="text-warning" />}</Button>
                                <Button variant="light" size="sm" className="btn-icon" onClick={() => openMenuItemModal('root', root.parentId, root)} title="Edit"><FaEdit size={12} className="text-primary" /></Button>
                                <Button variant="light" size="sm" className="btn-icon" onClick={() => handleDeleteMenuItem(root)} title="Hapus"><FaTrash size={12} className="text-danger" /></Button>
                              </div>
                            </div>
                            {children.length > 0 && (
                              <div className="ps-4 mt-3 d-grid gap-2">
                                {children.map(child => (
                                  <div key={child.id} className="border rounded-3 p-3 bg-light">
                                    <div className="d-flex justify-content-between align-items-start gap-3">
                                      <div className="d-flex align-items-start gap-3 flex-grow-1 overflow-hidden">
                                        <div className="p-2 rounded-circle flex-shrink-0 bg-secondary bg-opacity-10 text-secondary">
                                          <FaFileAlt size={16} />
                                        </div>
                                        <div className="overflow-hidden">
                                          <div className="fw-bold text-dark text-truncate">{child.title}</div>
                                          <code className="extra-small text-muted text-truncate d-block">{child.url || 'Tanpa URL'}</code>
                                        </div>
                                      </div>
                                      <div className="d-flex gap-1 flex-shrink-0 flex-wrap justify-content-end">
                                        <Button variant="light" size="sm" className="btn-icon" disabled={child.order === 0} onClick={() => handleMoveMenuItem(child, 'up')}><FaArrowUp size={11} className={child.order === 0 ? 'text-muted' : 'text-secondary'} /></Button>
                                        <Button variant="light" size="sm" className="btn-icon" disabled={child.order >= children.length - 1} onClick={() => handleMoveMenuItem(child, 'down')}><FaArrowDown size={11} className={child.order >= children.length - 1 ? 'text-muted' : 'text-secondary'} /></Button>
                                        <Button variant="light" size="sm" className="btn-icon" onClick={() => handleToggleMenuItem(child)} title="Ubah status">{child.active ? <FaCheckCircle size={12} className="text-success" /> : <FaTimesCircle size={12} className="text-warning" />}</Button>
                                        <Button variant="light" size="sm" className="btn-icon" onClick={() => openMenuItemModal('submenu', child.parentId, child)} title="Edit"><FaEdit size={12} className="text-primary" /></Button>
                                        <Button variant="light" size="sm" className="btn-icon" onClick={() => handleDeleteMenuItem(child)} title="Hapus"><FaTrash size={12} className="text-danger" /></Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }) : <div className="text-center py-5 text-muted border rounded-4 bg-light">Belum ada menu linked.</div>}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab>
          <Tab eventKey="pages" title={<><FaFileAlt className="me-2" /> Pages</>}>
            <Card className="border-0 shadow-sm rounded-4">
              <Card.Body className="p-4">
                <div className="border rounded-4 bg-light p-4 mb-4">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
                    <div>
                      <h6 className="fw-bold mb-1 text-primary border-start border-3 border-primary ps-2"><FaImage className="me-2" /> Latar Header Detail</h6>
                      <div className="small text-muted mt-2">Dipakai bersama pada halaman detail item `Pages` dan `Detail Profil` di publik.</div>
                    </div>
                    <Button variant="primary" className="rounded-pill px-4 fw-bold flex-shrink-0" onClick={handleSaveDetailHeroConfig} disabled={saving || (detailHeroConfig.mode === 'image' && !detailHeroConfig.imageUrl && !detailHeroImageFile)}>
                      {saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan Latar
                    </Button>
                  </div>
                  <Row className="g-4 align-items-start">
                    <Col lg={7}>
                      <Row className="g-3">
                        <Col md={5}>
                          <Form.Group>
                            <Form.Label className="small fw-bold text-muted">Mode Latar</Form.Label>
                            <Form.Select value={detailHeroConfig.mode} onChange={e => setDetailHeroConfig(prev => ({ ...prev, mode: e.target.value as 'solid' | 'image' }))}>
                              <option value="solid">Warna Solid</option>
                              <option value="image">Gambar</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={7}>
                          <Form.Group>
                            <Form.Label className="small fw-bold text-muted">Warna Solid</Form.Label>
                            <div className="d-flex align-items-center gap-3">
                              <Form.Control type="color" value={detailHeroConfig.solidColor} onChange={e => setDetailHeroConfig(prev => ({ ...prev, solidColor: e.target.value }))} style={{ width: '72px', height: '44px' }} />
                              <Form.Control value={detailHeroConfig.solidColor} onChange={e => setDetailHeroConfig(prev => ({ ...prev, solidColor: e.target.value }))} />
                            </div>
                          </Form.Group>
                        </Col>
                        <Col xs={12}>
                          <Form.Group>
                            <Form.Label className="small fw-bold text-muted">Gambar Header</Form.Label>
                            <Form.Control
                              type="file"
                              accept="image/*"
                              onChange={e => {
                                const input = e.currentTarget as HTMLInputElement;
                                setDetailHeroImageFile(input.files?.[0] || null);
                              }}
                            />
                            <div className="small text-muted mt-2">Jika memakai gambar, file akan dikonversi ke WebP 70% dengan batas ukuran akhir 100KB.</div>
                            {detailHeroImageMetadata && (
                              <div className="extra-small text-muted mt-2">File aktif: {formatBytes(detailHeroImageMetadata.sizeBytes)} .{detailHeroImageMetadata.fileExtension}</div>
                            )}
                          </Form.Group>
                        </Col>
                      </Row>
                    </Col>
                    <Col lg={5}>
                      <div className="border rounded-4 overflow-hidden shadow-sm bg-white">
                        <div
                          className="position-relative text-white"
                          style={{
                            minHeight: '190px',
                            backgroundColor: detailHeroConfig.solidColor,
                            backgroundImage: detailHeroConfig.mode === 'image' && (detailHeroImageFile || detailHeroConfig.imageUrl)
                              ? `url(${detailHeroImageFile ? URL.createObjectURL(detailHeroImageFile) : detailHeroConfig.imageUrl})`
                              : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: detailHeroConfig.mode === 'image' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255,255,255,0.04)' }}></div>
                          <div className="position-relative p-4 h-100 d-flex flex-column justify-content-end">
                            <div className="small text-uppercase fw-bold opacity-75 mb-2">Preview Header</div>
                            <div className="fw-bold fs-4">Judul Konten</div>
                            <div className="small opacity-75 mt-2">Akan dipakai untuk detail profil dan page publik.</div>
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
                <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
                  <div>
                    <h6 className="fw-bold mb-1 text-success border-start border-3 border-success ps-2"><FaFileAlt className="me-2" /> Page Konten</h6>
                    <div className="small text-muted mt-2">Konten page sama seperti halaman Detail Profil, termasuk lampiran gambar.</div>
                  </div>
                  <Button variant="success" className="rounded-pill px-4 fw-bold flex-shrink-0" onClick={() => { setCurrentPage({ title: '', content: '', isActive: true, order: sitePages.length, attachments: [] }); setShowPageModal(true); }}><FaPlus className="me-2" /> Tambah Page</Button>
                </div>
                <ListGroup className="border-0">
                  {sitePages.map((item) => (
                    <ListGroup.Item key={item.id} className="mb-3 rounded-4 border shadow-sm p-3 bg-white">
                      <div className="d-flex justify-content-between align-items-center gap-3">
                        <div className="d-flex align-items-center flex-grow-1 overflow-hidden">
                          <div className={`me-3 p-2 rounded-circle flex-shrink-0 ${item.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>{item.isActive ? <FaCheckCircle size={20} /> : <FaTimesCircle size={20} />}</div>
                          <div className="overflow-hidden">
                            <div className="fw-bold text-dark text-truncate">{item.title}</div>
                            <code className="extra-small text-muted">/page/{item.slug}</code>
                            {(item.attachments?.length || 0) > 0 && <div className="extra-small text-success mt-1">{item.attachments?.length} lampiran</div>}
                          </div>
                        </div>
                        <div className="d-flex gap-2 flex-shrink-0">
                          <Button variant="light" size="sm" className="btn-icon position-relative" title="Lampiran" onClick={() => handleOpenPageAttachments(item)}><FaPaperclip size={13} className="text-secondary" />{(item.attachments?.length || 0) > 0 && <Badge bg="success" pill className="position-absolute top-0 start-100 translate-middle">{item.attachments?.length}</Badge>}</Button>
                          <Button variant="light" size="sm" className="btn-icon" title="Preview" onClick={() => window.open(`/page/${item.slug}`, '_blank')}><FaEye size={14} className="text-info" /></Button>
                          <Button variant="light" size="sm" className="btn-icon" title="Ubah Status" onClick={() => togglePageStatus(item)}>{item.isActive ? <FaTimesCircle size={14} className="text-warning" /> : <FaCheckCircle size={14} className="text-success" />}</Button>
                          <Button variant="light" size="sm" className="btn-icon" title="Edit" onClick={() => { setCurrentPage({ ...item, attachments: item.attachments || [] }); setShowPageModal(true); }}><FaEdit size={14} className="text-primary" /></Button>
                          <Button variant="light" size="sm" className="btn-icon" title="Hapus" onClick={() => handleDeletePage(item.id, item.title)}><FaTrash size={14} className="text-danger" /></Button>
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                  {sitePages.length === 0 && <div className="text-center py-5 text-muted border rounded-4 bg-light">Belum ada halaman.</div>}
                </ListGroup>
                <p className="small text-muted mt-3"><i className="bi bi-info-circle me-1"></i> Halaman aktif bisa dipilih sebagai target menu Page.</p>
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>
      </Container>
      <Modal show={showSlideModal} onHide={() => setShowSlideModal(false)} centered><Modal.Header closeButton className="border-0"><Modal.Title className="h5 fw-bold">Edit Slide</Modal.Title></Modal.Header><Modal.Body><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Judul</Form.Label><Form.Control value={currentSlide.title} onChange={e => setCurrentSlide({...currentSlide, title: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Sub-Judul</Form.Label><Form.Control value={currentSlide.subtitle} onChange={e => setCurrentSlide({...currentSlide, subtitle: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Object Fit</Form.Label><Form.Select value={currentSlide.objectFit} onChange={e => setCurrentSlide({...currentSlide, objectFit: e.target.value as any})}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></Form.Select></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Gambar</Form.Label>{currentSlide.url && <img src={currentSlide.url} className="img-fluid rounded mb-2" alt="Current slide"/>}{currentSlide.metadata && (<div className="d-flex justify-content-between align-items-center"><span className="text-muted extra-small">{formatBytes(currentSlide.metadata.sizeBytes)} .{currentSlide.metadata.fileExtension}</span>{needsReconversion(currentSlide.metadata) && (<Button variant="link" className="p-0 text-warning" onClick={() => handleReconvertClick({ type: 'slide', id: currentSlide.id, url: currentSlide.url })} disabled={isReconverting}><FaSyncAlt size={14} /></Button>)}</div>)}</Form.Group></Modal.Body><Modal.Footer className="border-0"><Button variant="light" className="rounded-pill px-4" onClick={() => setShowSlideModal(false)}>Batal</Button><Button variant="primary" className="rounded-pill px-4" onClick={handleSaveSlide} disabled={saving}>{saving ? <Spinner size="sm"/> : 'Simpan'}</Button></Modal.Footer></Modal>
      <Modal show={showServiceModal} onHide={() => setShowServiceModal(false)} centered size="lg" className="rounded-4"><Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold h5">Layanan</Modal.Title></Modal.Header><Modal.Body className="p-4 pt-2"><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Nama</Form.Label><Form.Control value={currentService.title} onChange={e => setCurrentService({...currentService, title: e.target.value})} /></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">URL</Form.Label><Form.Control value={currentService.url} onChange={e => setCurrentService({...currentService, url: e.target.value})} /></Form.Group><Row><Col md={4}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Tipe Ikon</Form.Label><Form.Select value={currentService.iconType} onChange={e => setCurrentService({...currentService, iconType: e.target.value as any, icon: iconOptions[e.target.value as keyof typeof iconOptions][0]})}><option value="emoji">Emoji</option><option value="fa">FontAwesome</option><option value="bi">Bootstrap</option><option value="hi">Hero</option><option value="fc">Flat Color</option></Form.Select></Form.Group></Col><Col md={8}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Pilih Ikon</Form.Label><div className="icon-grid-selector d-flex flex-wrap gap-2 p-2 bg-light rounded border" style={{ maxHeight: '150px' }}>{iconOptions[currentService.iconType as keyof typeof iconOptions]?.map(iconName => (<div key={iconName} className={`icon-item p-2 rounded cursor-pointer border ${currentService.icon === iconName ? 'bg-success text-white' : 'bg-white'}`} onClick={() => setCurrentService({...currentService, icon: iconName})} style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}><IconRenderer icon={iconName} type={currentService.iconType as any} /></div>))}</div></Form.Group></Col></Row><Row><Col md={6}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Warna Latar</Form.Label><Form.Control type="color" value={currentService.bgColor} onChange={e => setCurrentService({...currentService, bgColor: e.target.value})} /></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Warna Teks</Form.Label><Form.Control type="color" value={currentService.textColor} onChange={e => setCurrentService({...currentService, textColor: e.target.value})} /></Form.Group></Col></Row></Modal.Body><Modal.Footer className="border-0 pt-0"><Button variant="light" className="rounded-pill px-4" onClick={() => setShowServiceModal(false)}>Batal</Button><Button variant="success" className="rounded-pill px-4" onClick={handleSaveService} disabled={saving}>{saving ? <Spinner size="sm"/> : <FaSave/>} Simpan</Button></Modal.Footer></Modal>
        <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered size="xl" className="rounded-4"><Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold h5">Halaman Profil</Modal.Title></Modal.Header><Modal.Body className="p-4 pt-2"><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Judul</Form.Label><Form.Control value={currentProfile.title} onChange={e => setCurrentProfile({...currentProfile, title: e.target.value})} className="fw-bold" /><Form.Text>Slug URL akan otomatis dibuat.</Form.Text></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Konten</Form.Label><Form.Control as="textarea" rows={15} value={currentProfile.content} onChange={e => setCurrentProfile({...currentProfile, content: e.target.value})} style={{ fontSize: '1rem', lineHeight: '1.6' }} /></Form.Group><Form.Check type="switch" label="Tampilkan di Menu" checked={currentProfile.isActive} onChange={e => setCurrentProfile({...currentProfile, isActive: e.target.checked})} /></Modal.Body><Modal.Footer className="border-0 pt-0"><Button variant="light" className="rounded-pill px-4" onClick={() => setShowProfileModal(false)}>Batal</Button><Button variant="success" className="rounded-pill px-4" onClick={handleSaveProfile} disabled={saving}>{saving ? <Spinner size="sm"/> : <FaSave/>} Simpan</Button></Modal.Footer></Modal>
        <Modal show={showPageModal} onHide={() => setShowPageModal(false)} centered size="xl" className="rounded-4"><Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold h5">Page Konten</Modal.Title></Modal.Header><Modal.Body className="p-4 pt-2"><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Judul</Form.Label><Form.Control value={currentPage.title} onChange={e => setCurrentPage({...currentPage, title: e.target.value})} className="fw-bold" /><Form.Text>Slug URL akan otomatis dibuat.</Form.Text></Form.Group><Form.Group className="mb-3"><Form.Label className="small fw-bold text-muted">Konten</Form.Label><Form.Control as="textarea" rows={15} value={currentPage.content} onChange={e => setCurrentPage({...currentPage, content: e.target.value})} style={{ fontSize: '1rem', lineHeight: '1.6' }} /></Form.Group><Form.Check type="switch" label="Tampilkan di Menu" checked={currentPage.isActive} onChange={e => setCurrentPage({...currentPage, isActive: e.target.checked})} /></Modal.Body><Modal.Footer className="border-0 pt-0"><Button variant="light" className="rounded-pill px-4" onClick={() => setShowPageModal(false)}>Batal</Button><Button variant="success" className="rounded-pill px-4" onClick={handleSavePage} disabled={saving}>{saving ? <Spinner size="sm"/> : <FaSave/>} Simpan</Button></Modal.Footer></Modal>
        <Modal show={showAttachmentModal} onHide={() => setShowAttachmentModal(false)} centered size="xl" className="rounded-4">
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold h5">Lampiran Konten</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 pt-2">
            <div className="mb-4">
              <div className="fw-bold text-dark">{currentAttachmentProfile?.title || 'Konten Profil'}</div>
              <div className="small text-muted">Lampiran tampil di bawah isi konten pada halaman publik.</div>
            </div>
            <Row className="g-4">
              <Col lg={7}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">Daftar Lampiran</h6>
                  <Badge bg="success" pill>{attachmentItems.length}</Badge>
                </div>
                {attachmentItems.length > 0 ? (
                  <div className="d-grid gap-3">
                    {attachmentItems.map((attachment) => {
                      const attachmentKind = normalizePageAttachmentKind(attachment.kind);
                      const isImage = attachmentKind === 'image';
                      return (
                        <div key={attachment.id} className="border rounded-4 p-3 bg-white shadow-sm">
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                            <Badge bg={isImage ? 'secondary' : 'primary'} pill>{attachmentKindLabels[attachmentKind]}</Badge>
                            <Button variant="light" size="sm" className="btn-icon" onClick={() => handleDeleteAttachment(attachment.id)} title="Hapus Lampiran">
                              <FaTrash size={12} className="text-danger" />
                            </Button>
                          </div>
                          <div className="d-grid gap-3">
                            <Form.Group>
                              <Form.Label className="small fw-bold text-muted">Judul Lampiran</Form.Label>
                              <Form.Control
                                value={attachment.title}
                                onChange={e => setAttachmentItems(prev => prev.map(item => item.id === attachment.id ? { ...item, title: e.target.value } : item))}
                                onBlur={e => handleAttachmentTitleBlur(attachment.id, e.target.value)}
                              />
                            </Form.Group>
                            {isImage ? (
                              <div className="border rounded-3 bg-light flex-shrink-0 overflow-hidden" style={{ minHeight: '160px' }}>
                                <img src={attachment.url} alt={attachment.title} className="w-100 h-100 object-fit-cover" style={{ maxHeight: '240px' }} />
                              </div>
                            ) : (
                              <div className="border rounded-3 bg-light overflow-hidden" style={{ minHeight: '240px' }}>
                                <iframe
                                  src={attachment.url}
                                  title={attachment.title}
                                  className="w-100"
                                  style={{ border: 0, minHeight: getPageAttachmentFrameHeight(attachmentKind) }}
                                  allowFullScreen
                                />
                              </div>
                            )}
                            {isImage ? (
                              <code className="extra-small text-muted d-block text-truncate">{attachment.url}</code>
                            ) : (
                              <Form.Group>
                                <Form.Label className="small fw-bold text-muted">URL Embed</Form.Label>
                                <Form.Control
                                  value={attachment.sourceUrl || attachment.url}
                                  onChange={e => setAttachmentItems(prev => prev.map(item => item.id === attachment.id ? { ...item, sourceUrl: e.target.value } : item))}
                                  onBlur={e => handleAttachmentSourceBlur(attachment.id, e.target.value)}
                                  placeholder="Tempel URL Google Form, Google Sheet, Google Drive, atau Google Slides"
                                />
                              </Form.Group>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted border rounded-4 bg-light p-4">Belum ada lampiran.</div>
                )}
              </Col>
              <Col lg={5}>
                <Card className="border-0 bg-light rounded-4 h-100">
                  <Card.Body className="p-4">
                    <h6 className="fw-bold mb-3">Tambah Lampiran</h6>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted">Jenis Lampiran</Form.Label>
                      <Form.Select value={newAttachmentKind} onChange={e => setNewAttachmentKind(e.target.value as PageAttachmentKind)}>
                        <option value="image">Gambar</option>
                        <option value="google-form">Google Form</option>
                        <option value="google-sheet">Google Sheet</option>
                        <option value="youtube">YouTube</option>
                        <option value="google-drive">Google Drive</option>
                        <option value="google-slide">Google Slides</option>
                      </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted">Judul Lampiran</Form.Label>
                      <Form.Control value={newAttachmentTitle} onChange={e => setNewAttachmentTitle(e.target.value)} placeholder="Contoh: Dokumentasi Kegiatan" />
                    </Form.Group>
                    {newAttachmentKind === 'image' ? (
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-muted">Gambar</Form.Label>
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const input = e.currentTarget as HTMLInputElement;
                            setNewAttachmentFile(input.files?.[0] || null);
                          }}
                        />
                        <div className="small text-muted mt-2">Gambar otomatis dikonversi ke WebP 70% dengan batas ukuran akhir 100KB.</div>
                      </Form.Group>
                    ) : (
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-muted">URL Embed</Form.Label>
                        <Form.Control
                          value={newAttachmentUrl}
                          onChange={e => setNewAttachmentUrl(e.target.value)}
                          placeholder={
                            newAttachmentKind === 'google-form'
                              ? 'Tempel URL Google Form'
                              : newAttachmentKind === 'google-sheet'
                                ? 'Tempel URL Google Sheet'
                                : newAttachmentKind === 'google-drive'
                                  ? 'Tempel URL Google Drive'
                                  : newAttachmentKind === 'google-slide'
                                    ? 'Tempel URL Google Slides'
                                    : 'Tempel URL YouTube'
                          }
                        />
                        <div className="small text-muted mt-2">Gunakan link berbagi atau link publik yang bisa dimuat di iframe.</div>
                      </Form.Group>
                    )}
                    <Button variant="success" className="w-100 rounded-pill fw-bold" onClick={handleAddAttachment} disabled={attachmentSaving || !newAttachmentTitle.trim() || (newAttachmentKind === 'image' ? !newAttachmentFile : !newAttachmentUrl.trim())}>
                      {attachmentSaving ? <Spinner size="sm" className="me-2" /> : <FaPlus className="me-2" />} Tambah Lampiran
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="light" className="rounded-pill px-4" onClick={() => setShowAttachmentModal(false)}>Tutup</Button>
          </Modal.Footer>
        </Modal>
        <Modal show={showPageAttachmentModal} onHide={() => setShowPageAttachmentModal(false)} centered size="xl" className="rounded-4">
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold h5">Lampiran Page</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 pt-2">
            <div className="mb-4">
              <div className="fw-bold text-dark">{currentAttachmentPage?.title || 'Page Konten'}</div>
              <div className="small text-muted">Lampiran tampil di bawah isi konten pada halaman publik.</div>
            </div>
            <Row className="g-4">
              <Col lg={7}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0">Daftar Lampiran</h6>
                  <Badge bg="success" pill>{pageAttachmentItems.length}</Badge>
                </div>
                {pageAttachmentItems.length > 0 ? (
                  <div className="d-grid gap-3">
                    {pageAttachmentItems.map((attachment) => {
                      const attachmentKind = normalizePageAttachmentKind(attachment.kind);
                      const isImage = attachmentKind === 'image';
                      const previewSrc = attachment.url;
                      return (
                        <div key={attachment.id} className="border rounded-4 p-3 bg-white shadow-sm">
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                            <Badge bg={isImage ? 'secondary' : 'primary'} pill>{pageAttachmentKindLabels[attachmentKind]}</Badge>
                            <Button variant="light" size="sm" className="btn-icon" onClick={() => handleDeletePageAttachment(attachment.id)} title="Hapus Lampiran">
                              <FaTrash size={12} className="text-danger" />
                            </Button>
                          </div>
                          <div className="d-grid gap-3">
                            <Form.Group>
                              <Form.Label className="small fw-bold text-muted">Judul Lampiran</Form.Label>
                              <Form.Control
                                value={attachment.title}
                                onChange={e => setPageAttachmentItems(prev => prev.map(item => item.id === attachment.id ? { ...item, title: e.target.value } : item))}
                                onBlur={e => handlePageAttachmentTitleBlur(attachment.id, e.target.value)}
                              />
                            </Form.Group>
                            {isImage ? (
                              <div className="border rounded-3 bg-light overflow-hidden" style={{ minHeight: '160px' }}>
                                <img src={previewSrc} alt={attachment.title} className="w-100 h-100 object-fit-cover" style={{ maxHeight: '240px' }} />
                              </div>
                            ) : (
                              <div className="border rounded-3 bg-light overflow-hidden" style={{ minHeight: '240px' }}>
                                <iframe
                                  src={previewSrc}
                                  title={attachment.title}
                                  className="w-100 h-100"
                                  style={{ border: 0, minHeight: getPageAttachmentFrameHeight(attachmentKind) }}
                                  allowFullScreen
                                />
                              </div>
                            )}
                            {isImage ? (
                              <code className="extra-small text-muted d-block text-truncate">{attachment.url}</code>
                            ) : (
                              <Form.Group>
                                <Form.Label className="small fw-bold text-muted">URL Embed</Form.Label>
                                <Form.Control
                                  value={attachment.sourceUrl || attachment.url}
                                  onChange={e => setPageAttachmentItems(prev => prev.map(item => item.id === attachment.id ? { ...item, sourceUrl: e.target.value } : item))}
                                  onBlur={e => handlePageAttachmentSourceBlur(attachment.id, e.target.value)}
                                  placeholder="Tempel URL Google Form, Google Sheet, Google Drive, atau Google Slides"
                                />
                              </Form.Group>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted border rounded-4 bg-light p-4">Belum ada lampiran.</div>
                )}
              </Col>
              <Col lg={5}>
                <Card className="border-0 bg-light rounded-4 h-100">
                  <Card.Body className="p-4">
                    <h6 className="fw-bold mb-3">Tambah Lampiran</h6>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted">Jenis Lampiran</Form.Label>
                      <Form.Select value={newPageAttachmentKind} onChange={e => setNewPageAttachmentKind(e.target.value as any)}>
                        <option value="image">Gambar</option>
                        <option value="google-form">Google Form</option>
                        <option value="google-sheet">Google Sheet</option>
                        <option value="youtube">YouTube</option>
                        <option value="google-drive">Google Drive</option>
                        <option value="google-slide">Google Slides</option>
                      </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted">Judul Lampiran</Form.Label>
                      <Form.Control value={newPageAttachmentTitle} onChange={e => setNewPageAttachmentTitle(e.target.value)} placeholder="Contoh: Dokumentasi Kegiatan" />
                    </Form.Group>
                    {newPageAttachmentKind === 'image' ? (
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-muted">Gambar</Form.Label>
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const input = e.currentTarget as HTMLInputElement;
                            setNewPageAttachmentFile(input.files?.[0] || null);
                          }}
                        />
                        <div className="small text-muted mt-2">Gambar otomatis dikonversi ke WebP 70% dengan batas ukuran akhir 100KB.</div>
                      </Form.Group>
                    ) : (
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-muted">URL Embed</Form.Label>
                        <Form.Control
                          value={newPageAttachmentUrl}
                          onChange={e => setNewPageAttachmentUrl(e.target.value)}
                          placeholder={
                            newPageAttachmentKind === 'google-form'
                              ? 'Tempel URL Google Form'
                              : newPageAttachmentKind === 'google-sheet'
                                ? 'Tempel URL Google Sheet'
                              : newPageAttachmentKind === 'google-drive'
                                ? 'Tempel URL Google Drive'
                                : newPageAttachmentKind === 'google-slide'
                                  ? 'Tempel URL Google Slides'
                                  : 'Tempel URL YouTube'
                          }
                        />
                        <div className="small text-muted mt-2">Gunakan link berbagi atau link publik yang bisa dimuat di iframe.</div>
                      </Form.Group>
                    )}
                    <Button
                      variant="success"
                      className="w-100 rounded-pill fw-bold"
                      onClick={handleAddPageAttachment}
                      disabled={
                        pageAttachmentSaving ||
                        !newPageAttachmentTitle.trim() ||
                        (newPageAttachmentKind === 'image' ? !newPageAttachmentFile : !newPageAttachmentUrl.trim())
                      }
                    >
                      {pageAttachmentSaving ? <Spinner size="sm" className="me-2" /> : <FaPlus className="me-2" />} Tambah Lampiran
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="light" className="rounded-pill px-4" onClick={() => setShowPageAttachmentModal(false)}>Tutup</Button>
          </Modal.Footer>
        </Modal>
        <Modal show={showMenuItemModal} onHide={() => setShowMenuItemModal(false)} centered size="lg" className="rounded-4">
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold h5">Page/Linked Menu</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 pt-2">
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">Tipe Menu</Form.Label>
                  <Form.Select value={menuItemMode} onChange={e => {
                    const nextMode = e.target.value as 'root' | 'submenu';
                    setMenuItemMode(nextMode);
                    if (nextMode === 'root') {
                      setMenuItemParentId(null);
                      const orderedRoots = getOrderedRootMenus();
                      setMenuItemInsertAfterId(orderedRoots[orderedRoots.length - 1]?.id || null);
                    }
                    if (nextMode === 'submenu' && !menuItemParentId) setMenuItemParentId(rootLinkedMenus[0]?.id || null);
                  }}>
                    <option value="root">Root Menu</option>
                    <option value="submenu">Sub Menu</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              {menuItemMode === 'root' && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small fw-bold text-muted">Letakkan Setelah Root</Form.Label>
                    <Form.Select value={menuItemInsertAfterId || ''} onChange={e => setMenuItemInsertAfterId(e.target.value || null)}>
                      {getOrderedRootMenus().map(root => <option key={root.id} value={root.id}>{root.title}</option>)}
                    </Form.Select>
                    <Form.Text className="text-muted">Root baru akan disimpan tepat setelah root yang dipilih. Beranda tetap paling awal.</Form.Text>
                  </Form.Group>
                </Col>
              )}
              {menuItemMode === 'submenu' && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small fw-bold text-muted">Parent Root</Form.Label>
                    <Form.Select value={menuItemParentId || ''} onChange={e => setMenuItemParentId(e.target.value || null)}>
                      <option value="">Pilih root</option>
                      {rootLinkedMenus.map(root => <option key={root.id} value={root.id}>{root.title}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">Judul Menu</Form.Label>
                  <Form.Control value={currentMenuItem.title || ''} onChange={e => setCurrentMenuItem(prev => ({ ...prev, title: e.target.value }))} placeholder="Contoh: Portal Santri" />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">Target Menu</Form.Label>
                  <Form.Select value={currentMenuItem.targetType || 'url'} onChange={e => {
                    const nextType = e.target.value as 'url' | 'page';
                    setCurrentMenuItem(prev => ({ ...prev, targetType: nextType }));
                    if (nextType === 'page' && !menuPageTargetId) {
                      setMenuPageTargetId(sitePages[0]?.id || null);
                    }
                  }}>
                    <option value="url">URL</option>
                    <option value="page">Page</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              {currentMenuItem.targetType === 'page' ? (
                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="small fw-bold text-muted">Pilih Page</Form.Label>
                    <Form.Select value={menuPageTargetId || ''} onChange={e => setMenuPageTargetId(e.target.value || null)}>
                      <option value="">Pilih page</option>
                      {sitePages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
              ) : (
                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="small fw-bold text-muted">URL</Form.Label>
                    <Form.Control value={currentMenuItem.url || ''} onChange={e => setCurrentMenuItem(prev => ({ ...prev, url: e.target.value }))} placeholder="https://..." />
                  </Form.Group>
                </Col>
              )}
              <Col md={12}>
                <Form.Check type="switch" label="Tampilkan di menu publik" checked={currentMenuItem.active !== false} onChange={e => setCurrentMenuItem(prev => ({ ...prev, active: e.target.checked }))} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button variant="light" className="rounded-pill px-4" onClick={() => setShowMenuItemModal(false)}>Batal</Button>
            <Button variant="success" className="rounded-pill px-4" onClick={handleSaveMenuItem} disabled={saving || !currentMenuItem.title?.trim() || (currentMenuItem.targetType === 'page' && !menuPageTargetId)}>{saving ? <Spinner size="sm" className="me-2" /> : <FaSave className="me-2" />} Simpan</Button>
          </Modal.Footer>
        </Modal>
        <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered contentClassName="bg-transparent border-0"><Modal.Header closeButton closeVariant="white" className="border-0"></Modal.Header><Modal.Body className="text-center">{reconvertedPreviewUrl && <img src={reconvertedPreviewUrl} className="img-fluid rounded shadow-lg" alt="Preview Konversi" />}{reconvertedBlob && <p className="text-white small mt-3">Pratinjau hasil konversi. Ukuran file baru: {formatBytes(reconvertedBlob.size)}</p>}</Modal.Body><Modal.Footer className="border-0 justify-content-center"><Button variant="light" onClick={() => setShowPreviewModal(false)}>Batal</Button><Button variant="success" onClick={handleSaveReconvertedImage} disabled={isReconverting}>{isReconverting ? <Spinner size="sm" /> : "Simpan & Ganti Gambar"}</Button></Modal.Footer></Modal>
      <style>{`.custom-tabs .nav-link { color: #6c757d; font-weight: 600; border: none; padding: 12px 24px; border-radius: 12px 12px 0 0; } .custom-tabs .nav-link.active { color: #198754; background: white; border-bottom: 3px solid #198754; } .x-small { font-size: 0.7rem; } .extra-small { font-size: 0.65rem; } .btn-icon { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #eee; } .cursor-pointer { cursor: pointer; } .icon-item:hover { transform: scale(1.1); border-color: #198754; } .animate-fade-in { animation: fadeIn 0.3s ease-in; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } } .sub-nav-container::-webkit-scrollbar { height: 4px; } .sub-nav-container::-webkit-scrollbar-thumb { background: #ddd; border-radius: 10px; }`}</style>
    </DashboardLayout>
  );
};

export default Settings;
