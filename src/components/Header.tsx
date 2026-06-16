import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, NavDropdown, Button, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../firebase/TenantContext';
import { getDBRef } from '../firebase/utils';
import { onValue } from 'firebase/database';
import { auth, googleProvider, functions } from '../firebase/config';
import { onAuthStateChanged, type User, signInWithPopup, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import ProgressiveImage from './ProgressiveImage';
import { FaUserCircle, FaSignInAlt, FaSignOutAlt, FaCalendarAlt, FaExternalLinkAlt, FaBullhorn, FaNewspaper, FaVideo, FaImages, FaBookOpen } from 'react-icons/fa';
import { toast } from '../utils/alerts';

interface EService {
  id: string;
  title: string;
  url: string;
  icon: string;
}

interface ProfileContent {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  order: number;
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

interface SitePage {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  order: number;
}

interface MenuConfig {
  labels: MenuLabels;
  linkedMenus: LinkedMenuItem[];
  fixedRootOrder: string[];
}

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

const Header: React.FC = () => {
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  
  const [settings, setSettings] = useState({
    schoolName: 'MTs Negeri 1 Garut',
    tagline: 'Unggul, Religius, Berbudaya',
    logo: '/logo.png'
  });
  const [menuConfig, setMenuConfig] = useState<MenuConfig>(DEFAULT_MENU_CONFIG);
  const [eServices, setEServices] = useState<EService[]>([]);
  const [profiles, setProfiles] = useState<ProfileContent[]>([]);
  const [sitePages, setSitePages] = useState<SitePage[]>([]);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const verifyAccess = async (tId: string) => {
    setVerifying(true);
    try {
      const verifyRole = httpsCallable(functions, 'verifyAdminRole');
      const result = await verifyRole({ tenantId: tId });
      const data = result.data as any;
      // Allow access if role is 'admin' or 'owner'
      if (data && data.isValid && (data.role === 'admin' || data.role === 'owner')) {
        sessionStorage.setItem(`admin_verified_${tId}`, 'true');
        setIsAdmin(true);
      } else {
        sessionStorage.removeItem(`admin_verified_${tId}`);
        setIsAdmin(false);
      }
    } catch (err) {
      console.error("Access verification error:", err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && tenantId) {
        const verified = sessionStorage.getItem(`admin_verified_${tenantId}`) === 'true';
        if (verified) {
          setIsAdmin(true);
        } else {
          verifyAccess(tenantId);
        }
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });

    return () => unsubAuth();
  }, [tenantId]);

  const handleLogin = async () => {
    if (!tenantId) return;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        toast.fire({ icon: 'success', title: 'Berhasil masuk' });
        await verifyAccess(tenantId);
      }
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.fire({ icon: 'error', title: 'Gagal login' });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (tenantId) sessionStorage.removeItem(`admin_verified_${tenantId}`);
      setIsAdmin(false);
      toast.fire({ icon: 'info', title: 'Berhasil keluar' });
      navigate('/');
    } catch (error) {
      toast.fire({ icon: 'error', title: 'Gagal logout' });
    }
  };

  useEffect(() => {
    if (!tenantId) return;

    // 1. Fetch Settings
    const settingsRef = getDBRef(tenantId, 'settings');
    const unsubSettings = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettings({
          schoolName: data.schoolName || 'MTs Negeri 1 Garut',
          tagline: data.tagline || 'Unggul, Religius, Berbudaya',
          logo: data.logo || '/logo.png'
        });
        setMenuConfig({
          labels: {
            ...DEFAULT_MENU_LABELS,
            ...(data.menuConfig?.labels || {})
          },
              linkedMenus: Array.isArray(data.menuConfig?.linkedMenus)
            ? data.menuConfig.linkedMenus.map((item: any, index: number) => ({
                id: item.id || `menu-${index}`,
                title: item.title || '',
                url: item.url || '',
                active: item.active !== false,
                order: typeof item.order === 'number' ? item.order : index,
                parentId: item.parentId ?? null,
                rootAfterId: item.rootAfterId ?? null
                ,targetType: item.targetType || 'url',
                pageId: item.pageId ?? null
              }))
            : [],
          fixedRootOrder: Array.isArray(data.menuConfig?.fixedRootOrder)
            ? data.menuConfig.fixedRootOrder.filter((id: string) => ['profile', 'eServices', 'content', 'contact'].includes(id))
            : DEFAULT_MENU_CONFIG.fixedRootOrder
        });
      }
    });

    // 2. Fetch E-Services for Menu
    const servicesRef = getDBRef(tenantId, 'e_services');
    const unsubServices = onValue(servicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setEServices(list);
      } else {
        setEServices([]);
      }
    });

    // 3. Fetch Dynamic Profiles for Menu
    const profilesRef = getDBRef(tenantId, 'profiles');
    const unsubProfiles = onValue(profilesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(p => p.isActive)
          .sort((a, b) => a.order - b.order);
        setProfiles(list);
      } else {
        setProfiles([]);
      }
    });

    const pagesRef = getDBRef(tenantId, 'pages');
    const unsubPages = onValue(pagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter((p: any) => p.isActive)
          .sort((a, b) => a.order - b.order);
        setSitePages(list);
      } else {
        setSitePages([]);
      }
    });

    return () => {
      unsubSettings();
      unsubServices();
      unsubProfiles();
      unsubPages();
    };
  }, [tenantId]);

  const getRootLinkedMenus = () => menuConfig.linkedMenus
    .filter(item => item.active && !item.parentId && item.title.trim().toLowerCase() !== (menuConfig.labels.eServices || DEFAULT_MENU_LABELS.eServices).trim().toLowerCase())
    .sort((a, b) => a.order - b.order);

  const getLinkedChildren = (parentId: string) => menuConfig.linkedMenus
    .filter(item => item.active && item.parentId === parentId)
    .sort((a, b) => a.order - b.order);

  const getPageUrlById = (pageId?: string | null) => {
    if (!pageId) return '';
    const page = sitePages.find(item => item.id === pageId);
    return page ? `/page/${page.slug}` : '';
  };

  const getOrderedRootMenus = () => {
    const fixedRoots = [
      { id: 'home', title: menuConfig.labels.home || DEFAULT_MENU_LABELS.home },
      { id: 'profile', title: menuConfig.labels.profile || DEFAULT_MENU_LABELS.profile },
      { id: 'eServices', title: menuConfig.labels.eServices || DEFAULT_MENU_LABELS.eServices },
      { id: 'content', title: menuConfig.labels.content || DEFAULT_MENU_LABELS.content },
      { id: 'contact', title: menuConfig.labels.contact || DEFAULT_MENU_LABELS.contact }
    ];

    const orderedFixedRoots = [
      fixedRoots[0],
      ...menuConfig.fixedRootOrder.map(id => fixedRoots.find(root => root.id === id)).filter(Boolean) as Array<{ id: string; title: string }>
    ];

    const rootLinkedItems = getRootLinkedMenus();
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

    orderedFixedRoots.forEach(root => {
      ordered.push({ kind: 'fixed', id: root.id, title: root.title });
      appendAfter(root.id);
    });

    return ordered;
  };

  return (
    <Navbar bg="white" expand="lg" sticky="top" className="shadow-sm py-2 px-0">
      <Container fluid className="px-3">
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center me-0 ms-0 ps-0">
          <ProgressiveImage
            src={settings.logo}
            alt={settings.schoolName}
            style={{ width: '45px', height: '45px' }}
            className="me-2"
          />
          <div className="d-none d-sm-block">
            <span className="fw-bold text-success d-block lh-1 text-uppercase small">{settings.schoolName}</span>
            <small className="text-muted d-block mb-0" style={{ fontSize: '0.65rem', lineHeight: 1.1, marginTop: '0.1rem' }}>{settings.tagline}</small>
          </div>
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto fw-medium align-items-lg-center">
            {getOrderedRootMenus().map((entry) => {
              if (entry.kind === 'fixed') {
                if (entry.id === 'home') {
                  return <Nav.Link key={entry.id} as={Link} to="/">{entry.title}</Nav.Link>;
                }
                if (entry.id === 'profile') {
                  return profiles.length > 0 ? (
                    <NavDropdown key={entry.id} title={entry.title} id="profile-nav-dropdown">
                      {profiles.map(p => (
                        <NavDropdown.Item key={p.id} as={Link} to={`/profil/${p.slug}`}>
                          <FaBookOpen className="me-2 submenu-icon" />
                          {p.title}
                        </NavDropdown.Item>
                      ))}
                    </NavDropdown>
                  ) : null;
                }
                if (entry.id === 'eServices') {
                  return eServices.length > 0 ? (
                    <NavDropdown key={entry.id} title={entry.title} id="elayanan-nav-dropdown">
                      {eServices.map((svc) => (
                        <NavDropdown.Item key={svc.id} href={svc.url} target="_blank" rel="noopener noreferrer">
                          <FaExternalLinkAlt className="me-2 submenu-icon" />
                          <span className="me-2">{svc.icon}</span>
                          {svc.title}
                        </NavDropdown.Item>
                      ))}
                    </NavDropdown>
                  ) : null;
                }
                if (entry.id === 'content') {
                  return (
                    <NavDropdown key={entry.id} title={entry.title} id="konten-nav-dropdown">
                      <NavDropdown.Item as={Link} to="/berita"><FaNewspaper className="me-2 submenu-icon" />{menuConfig.labels.news || DEFAULT_MENU_LABELS.news}</NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/pengumuman"><FaBullhorn className="me-2 submenu-icon" />{menuConfig.labels.announcements || DEFAULT_MENU_LABELS.announcements}</NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/agenda"><FaCalendarAlt className="me-2 submenu-icon" />{menuConfig.labels.agenda || DEFAULT_MENU_LABELS.agenda}</NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/video"><FaVideo className="me-2 submenu-icon" />{menuConfig.labels.video || DEFAULT_MENU_LABELS.video}</NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/galeri"><FaImages className="me-2 submenu-icon" />{menuConfig.labels.gallery || DEFAULT_MENU_LABELS.gallery}</NavDropdown.Item>
                    </NavDropdown>
                  );
                }
                if (entry.id === 'contact') {
                  return <Nav.Link key={entry.id} as={Link} to="/kontak">{entry.title}</Nav.Link>;
                }
                return null;
              }

              const item = entry.item!;
              const children = getLinkedChildren(item.id);
              const resolvedUrl = item.targetType === 'page' ? getPageUrlById(item.pageId) : item.url;
              const isInternal = resolvedUrl.startsWith('/');
              if (children.length > 0) {
                return (
                  <NavDropdown key={item.id} title={item.title} id={`linked-menu-${item.id}`}>
                    {resolvedUrl && (
                      <NavDropdown.Item as={isInternal ? Link : 'a'} {...(isInternal ? { to: resolvedUrl } : { href: resolvedUrl, target: '_blank', rel: 'noopener noreferrer' })}>
                        <FaExternalLinkAlt className="me-2 submenu-icon" />
                        Buka {item.title}
                      </NavDropdown.Item>
                    )}
                    {children.map((child) => {
                      const childUrl = child.targetType === 'page' ? getPageUrlById(child.pageId) : child.url;
                      const childInternal = childUrl.startsWith('/');
                      return (
                        <NavDropdown.Item
                          key={child.id}
                          as={childInternal ? Link : 'a'}
                          {...(childInternal
                            ? { to: childUrl || '#' }
                            : { href: childUrl || '#', target: '_blank', rel: 'noopener noreferrer' })}
                        >
                          <FaBookOpen className="me-2 submenu-icon" />
                          {child.title}
                        </NavDropdown.Item>
                      );
                    })}
                  </NavDropdown>
                );
              }

              const isRootInternal = resolvedUrl.startsWith('/');
              return (
                <Nav.Link
                  key={item.id}
                  as={isRootInternal ? Link : 'a'}
                  {...(isRootInternal ? { to: resolvedUrl || '#' } : { href: resolvedUrl || '#', target: '_blank', rel: 'noopener noreferrer' })}
                >
                  {item.title}
                </Nav.Link>
              );
            })}
            
            {/* Dashboard menu for Admin only */}
            {user && isAdmin && (
              <Nav.Link as={Link} to="/dashboard" className="text-success fw-bold">Dashboard</Nav.Link>
            )}

            {/* Profile and Login/Logout Action */}
            <div className="ms-lg-2 mt-3 mt-lg-0">
               {authLoading ? (
                 <div className="px-3"><Spinner animation="border" size="sm" variant="success" /></div>
               ) : user ? (
                 <NavDropdown 
                   title={
                     <div className="d-inline-flex align-items-center gap-2">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="rounded-circle shadow-sm" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                        ) : (
                          <FaUserCircle className="text-success" size={32} />
                        )}
                        <span className="small fw-bold text-dark d-none d-xl-inline">
                          {user.displayName?.split(' ')[0]}
                          {verifying && <Spinner animation="grow" size="sm" variant="success" className="ms-1" style={{ width: '8px', height: '8px' }} />}
                        </span>
                     </div>
                   } 
                   id="user-profile-dropdown"
                   align="end"
                   className="profile-dropdown-no-caret"
                 >
                   <NavDropdown.Header className="extra-small text-uppercase fw-bold text-muted">Akun Anda</NavDropdown.Header>
                   <div className="px-3 py-2 border-bottom">
                      <div className="small fw-bold text-dark text-truncate" style={{maxWidth: '180px'}}>{user.displayName}</div>
                      <div className="extra-small text-muted text-truncate" style={{maxWidth: '180px'}}>{user.email}</div>
                   </div>
                   <NavDropdown.Item onClick={handleLogout} className="text-danger mt-1">
                      <FaSignOutAlt className="me-2" /> Logout
                   </NavDropdown.Item>
                 </NavDropdown>
               ) : (
                 <Button variant="outline-success" size="sm" className="rounded-pill px-4 fw-bold border-2 d-flex align-items-center gap-2" onClick={handleLogin}>
                    <FaSignInAlt size={16} /> Login
                 </Button>
               )}
            </div>
          </Nav>
        </Navbar.Collapse>
      </Container>
      <style>{`
        .profile-dropdown-no-caret .dropdown-toggle::after {
          display: none;
        }
        .extra-small { font-size: 0.7rem; }
        .submenu-icon {
          width: 14px;
          text-align: center;
          opacity: 0.85;
        }
      `}</style>
    </Navbar>
  );
};

export default Header;
