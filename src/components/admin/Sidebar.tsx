import React, { useState, useEffect } from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { 
  FaTachometerAlt, 
  FaNewspaper, 
  FaImages, 
  FaUsers,
  FaEnvelope,
  FaUserCog,
  FaSignOutAlt,
  FaChevronDown,
  FaChevronRight,
  FaDatabase
} from 'react-icons/fa';
import { useTenant } from '../../firebase/TenantContext';
import { getDBRef } from '../../firebase/utils';
import { onValue } from 'firebase/database';
import { auth } from '../../firebase/config';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [schoolName, setSchoolName] = useState('MTsN 1 Garut');
  const [logo, setLogo] = useState('/logo.png');
  const [openMenus, setOpenMenus] = useState<string[]>([]); // Default all collapsed

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin-login');
  };

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) ? [] : [label]
    );
  };

  useEffect(() => {
    if (!tenantId) return;
    const settingsRef = getDBRef(tenantId, 'settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.schoolName) setSchoolName(data.schoolName);
        if (data.logo) setLogo(data.logo);
      }
    });
    return () => unsubscribe();
  }, [tenantId]);

  // Auto-open menu group if current route is a submenu (accordion style)
  useEffect(() => {
    const menuGroupMap: { [key: string]: string[] } = {
      'Konten Web Info': ['/dashboard/berita', '/dashboard/agenda', '/dashboard/pengumuman'],
      'Galeri': ['/dashboard/galeri'],
      'Data Induk': ['/dashboard/referensi/jadwal', '/dashboard/data-siswa', '/dashboard/data-rombel'],
      'Data Referensi': ['/dashboard/staff', '/dashboard/referensi/tahun-ajaran', '/dashboard/referensi/kelas', '/dashboard/referensi/mapel', '/dashboard/referensi/pengajar', '/dashboard/referensi/pembayaran', '/dashboard/referensi/simpanan']
    };

    for (const [groupLabel, subPaths] of Object.entries(menuGroupMap)) {
      const isCurrentPathInGroup = subPaths.some(path => location.pathname.startsWith(path));
      if (isCurrentPathInGroup) {
        setOpenMenus([groupLabel]);
        return;
      }
    }
    setOpenMenus([]);
  }, [location.pathname]);

  const menuItems = [
    { path: '/dashboard', icon: <FaTachometerAlt />, label: 'Dashboard' },
    { 
      label: 'Konten Web Info',
      icon: <FaNewspaper />,
      subItems: [
        { path: '/dashboard/berita', label: 'Berita' },
        { path: '/dashboard/agenda', label: 'Agenda' },
        { path: '/dashboard/pengumuman', label: 'Pengumuman' }
      ]
    },
    { path: '/dashboard/messages', icon: <FaEnvelope />, label: 'Pesan' },
    { 
      label: 'Galeri',
      icon: <FaImages />,
      subItems: [
        { path: '/dashboard/galeri', label: 'Album Foto' },
        { path: '/dashboard/galeri/video', label: 'Video' }
      ]
    },
    { 
      label: 'Data Referensi',
      icon: <FaDatabase />,
      subItems: [
        { path: '/dashboard/referensi/tahun-ajaran', label: 'Tahun Ajaran' },
        { path: '/dashboard/referensi/kelas', label: 'Data Kelas' },
        { path: '/dashboard/referensi/mapel', label: 'Data Mapel' },
        { path: '/dashboard/staff', label: 'Data Pegawai' },
        { path: '/dashboard/referensi/pengajar', label: 'Data Pengajar' },
        { path: '/dashboard/referensi/pembayaran', label: 'Item Pembayaran' },
        { path: '/dashboard/referensi/simpanan', label: 'Item Simpanan' }
      ]
    },
    { 
      label: 'Data Induk',
      icon: <FaUsers />,
      subItems: [
        { path: '/dashboard/referensi/jadwal', label: 'Item Jadwal' },
        { path: '/dashboard/data-siswa', label: 'Data Siswa' },
        { path: '/dashboard/data-rombel', label: 'Data Rombel' }
      ]
    },
    { divider: true },
    { path: '/dashboard/settings', icon: <FaUserCog />, label: 'Settings' },
  ];

  return (
    <div className="admin-sidebar bg-white border-end d-flex flex-column" style={{ width: '260px', height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div className="p-4 border-bottom d-flex align-items-center" style={{ flexShrink: 0 }}>
        <div className="bg-success rounded-3 p-1 me-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
          <img src={logo} className="img-fluid object-fit-contain h-100" alt="Logo" />
        </div>
        <div className="overflow-hidden">
          <h6 className="fw-bold mb-0 text-dark text-truncate" style={{ fontSize: '0.85rem' }}>{schoolName}</h6>
          <small className="text-muted" style={{ fontSize: '0.7rem' }}>Admin Panel</small>
        </div>
      </div>
      
      <div className="flex-grow-1 p-3" style={{ overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        <Nav className="flex-column">
          {menuItems.map((item, idx) => {
            if (item.divider) return <hr key={`div-${idx}`} className="my-2" />;

            if (item.subItems) {
              const isOpen = openMenus.includes(item.label);
              const isActive = item.subItems.some(sub => location.pathname === sub.path);

              return (
                <div key={`group-${item.label}`} className="mb-1">
                  <div 
                    onClick={() => toggleMenu(item.label)}
                    className={`sidebar-link d-flex align-items-center rounded-3 px-3 py-2 border-0 pointer ${isActive ? 'text-success' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="me-3 fs-5 d-flex align-items-center">{item.icon}</span>
                    <span className="fw-medium flex-grow-1">{item.label}</span>
                    {isOpen ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                  </div>
                  {isOpen && (
                    <div className="ms-4 mt-1 border-start ps-2">
                      {item.subItems.map(sub => (
                        <Nav.Link
                          key={sub.path}
                          as={Link}
                          to={sub.path}
                          className={`sidebar-link mb-1 d-flex align-items-center rounded-3 px-3 py-2 border-0 small ${
                            location.pathname === sub.path ? 'active' : ''
                          }`}
                        >
                          <span className="fw-medium">{sub.label}</span>
                        </Nav.Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Nav.Link
                key={item.path}
                as={Link}
                to={item.path!}
                className={`sidebar-link mb-1 d-flex align-items-center rounded-3 px-3 py-2 border-0 ${
                  location.pathname === item.path ? 'active' : ''
                }`}
              >
                <span className="me-3 fs-5 d-flex align-items-center">{item.icon}</span>
                <span className="fw-medium">{item.label}</span>
              </Nav.Link>
            );
          })}
        </Nav>
      </div>

      <div className="p-3 border-top bg-light" style={{ flexShrink: 0 }}>
        <div className="d-flex align-items-center mb-3">
          <div className="avatar me-2 bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}>
            <span className="small fw-bold">AD</span>
          </div>
          <div className="overflow-hidden">
            <h6 className="mb-0 text-dark fw-bold small">Administrator</h6>
            <p className="mb-0 text-muted extra-small text-truncate" style={{ fontSize: '0.7rem' }}>admin@{tenantId}.sch.id</p>
          </div>
        </div>
        <button className="btn btn-sm btn-outline-danger w-100 d-flex align-items-center justify-content-center" onClick={handleLogout}>
          <FaSignOutAlt className="me-2" /> Logout
        </button>
      </div>

      <style>{`
        .sidebar-link { color: #6c757d; transition: all 0.2s ease; text-decoration: none; }
        .sidebar-link:hover { background-color: #f8f9fa; color: #198754; }
        .sidebar-link.active { background-color: #e8f5e9; color: #198754; }
        .extra-small { font-size: 0.75rem; }
        .pointer { cursor: pointer; }
      `}</style>
    </div>
  );
};

export default Sidebar;
