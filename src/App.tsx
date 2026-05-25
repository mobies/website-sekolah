import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { TenantProvider } from './firebase/TenantContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import NewsList from './pages/admin/NewsList';
import NewsForm from './pages/admin/NewsForm';
import AnnouncementList from './pages/admin/AnnouncementList';
import AnnouncementForm from './pages/admin/AnnouncementForm';
import AgendaList from './pages/admin/AgendaList';
import AgendaForm from './pages/admin/AgendaForm';
import GalleryList from './pages/admin/GalleryList';
import GalleryForm from './pages/admin/GalleryForm';
import PhotoManager from './pages/admin/PhotoManager';
import Settings from './pages/admin/Settings';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerLogin from './pages/OwnerLogin';
import AdminLogin from './pages/AdminLogin';
import AdminRegister from './pages/AdminRegister';
import { ProtectedRoute } from './firebase/ProtectedRoute';
import './App.css';

const AppContent = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const isOwner = location.pathname.startsWith('/owner');
  const isAdminRegister = location.pathname.startsWith('/admin-register');
  const isLogin = location.pathname.includes('-login');
  const hideLayout = isDashboard || isOwner || isLogin || isAdminRegister;

  return (
    <div className="d-flex flex-column min-vh-100">
      {!hideLayout && <Header />}
      <main className="flex-grow-1">
        <Routes>
          <Route path="/" element={<Home />} />
          
          {/* Public Login/Register Routes */}
          <Route path="/owner-login" element={<OwnerLogin />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin-register" element={<AdminRegister />} />

          {/* Protected Owner Routes */}
          <Route path="/owner" element={
            <ProtectedRoute redirectTo="/owner-login">
              <OwnerDashboard />
            </ProtectedRoute>
          } />

          {/* Protected Admin Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute redirectTo="/admin-login">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/berita" element={<ProtectedRoute redirectTo="/admin-login"><NewsList /></ProtectedRoute>} />
          <Route path="/dashboard/berita/tambah" element={<ProtectedRoute redirectTo="/admin-login"><NewsForm /></ProtectedRoute>} />
          <Route path="/dashboard/berita/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><NewsForm /></ProtectedRoute>} />
          <Route path="/dashboard/pengumuman" element={<ProtectedRoute redirectTo="/admin-login"><AnnouncementList /></ProtectedRoute>} />
          <Route path="/dashboard/pengumuman/tambah" element={<ProtectedRoute redirectTo="/admin-login"><AnnouncementForm /></ProtectedRoute>} />
          <Route path="/dashboard/pengumuman/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><AnnouncementForm /></ProtectedRoute>} />
          <Route path="/dashboard/agenda" element={<ProtectedRoute redirectTo="/admin-login"><AgendaList /></ProtectedRoute>} />
          <Route path="/dashboard/agenda/tambah" element={<ProtectedRoute redirectTo="/admin-login"><AgendaForm /></ProtectedRoute>} />
          <Route path="/dashboard/agenda/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><AgendaForm /></ProtectedRoute>} />
          <Route path="/dashboard/galeri" element={<ProtectedRoute redirectTo="/admin-login"><GalleryList /></ProtectedRoute>} />
          <Route path="/dashboard/galeri/tambah" element={<ProtectedRoute redirectTo="/admin-login"><GalleryForm /></ProtectedRoute>} />
          <Route path="/dashboard/galeri/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><GalleryForm /></ProtectedRoute>} />
          <Route path="/dashboard/galeri/kelola/:albumId" element={<ProtectedRoute redirectTo="/admin-login"><PhotoManager /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute redirectTo="/admin-login"><Settings /></ProtectedRoute>} />
          
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {!hideLayout && <Footer />}
    </div>
  );
};

function App() {
  return (
    <TenantProvider>
      <Router>
        <AppContent />
      </Router>
    </TenantProvider>
  );
}

export default App;
