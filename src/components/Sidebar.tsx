import React from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { 
  FaTachometerAlt, 
  FaNewspaper, 
  FaCalendarAlt, 
  FaImages, 
  FaBullhorn, 
  FaUserCog,
  FaHome
} from 'react-icons/fa';

const Sidebar: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: <FaTachometerAlt />, label: 'Overview' },
    { path: '/dashboard/berita', icon: <FaNewspaper />, label: 'Kelola Berita' },
    { path: '/dashboard/agenda', icon: <FaCalendarAlt />, label: 'Kelola Agenda' },
    { path: '/dashboard/pengumuman', icon: <FaBullhorn />, label: 'Pengumuman' },
    { path: '/dashboard/galeri', icon: <FaImages />, label: 'Galeri Foto' },
    { path: '/dashboard/settings', icon: <FaUserCog />, label: 'Pengaturan' },
  ];

  return (
    <div className="bg-dark text-white min-vh-100 p-3 shadow" style={{ width: '250px' }}>
      <div className="text-center mb-4 pb-3 border-bottom border-secondary">
        <h5 className="fw-bold text-success mb-0">Admin Panel</h5>
        <small className="text-muted">MTsN 1 Garut</small>
      </div>
      
      <Nav className="flex-column">
        {menuItems.map((item) => (
          <Nav.Link
            key={item.path}
            as={Link}
            to={item.path}
            className={`text-white mb-2 d-flex align-items-center rounded p-2 ${
              location.pathname === item.path ? 'bg-success' : 'hover-bg-secondary'
            }`}
          >
            <span className="me-3">{item.icon}</span>
            {item.label}
          </Nav.Link>
        ))}
        
        <hr className="border-secondary" />
        
        <Nav.Link
          as={Link}
          to="/"
          className="text-white d-flex align-items-center p-2 rounded"
        >
          <span className="me-3"><FaHome /></span>
          Lihat Website
        </Nav.Link>
      </Nav>

      <style>{`
        .hover-bg-secondary:hover {
          background-color: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
