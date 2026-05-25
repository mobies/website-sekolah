import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="admin-layout bg-light min-vh-100">
      <Sidebar />
      <div className="main-content" style={{ marginLeft: '260px' }}>
        <Topbar />
        <div className="content-wrapper p-4">
          {children}
        </div>
      </div>
      
      <style>{`
        .admin-layout {
          --mt-primary: #198754;
        }
        .main-content {
          transition: margin-left 0.3s ease;
        }
        @media (max-width: 992px) {
          .admin-sidebar {
            display: none !important;
          }
          .main-content {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardLayout;
