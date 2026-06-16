import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { TenantProvider } from './firebase/TenantContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Contact from './pages/Contact';
import ProfileDetail from './pages/ProfileDetail';
import PageDetail from './pages/PageDetail';
import NewsDetail from './pages/NewsDetail';
import NewsListPublic from './pages/NewsListPublic';
import AgendaListPublic from './pages/AgendaListPublic';
import AgendaDetail from './pages/AgendaDetail';
import AnnouncementListPublic from './pages/AnnouncementListPublic';
import AnnouncementDetail from './pages/AnnouncementDetail';
import VideoGallery from './pages/VideoGallery';
import GalleryListPublic from './pages/GalleryListPublic';
import GalleryDetailPublic from './pages/GalleryDetailPublic';
import StaffListPublic from './pages/StaffListPublic';
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
import VideoList from './pages/admin/VideoList';
import VideoForm from './pages/admin/VideoForm';
import StaffList from './pages/admin/StaffList';
import StaffForm from './pages/admin/StaffForm';
import MessageList from './pages/admin/MessageList';
import Settings from './pages/admin/Settings';
// Data Referensi - List Pages
import TahunAjaranList from './pages/admin/TahunAjaranList';
import DataKelasJList from './pages/admin/DataKelasJList';
import DataMapelList from './pages/admin/DataMapelList';
import DataPengajarList from './pages/admin/DataPengajarList';
import ItemJadwalList from './pages/admin/ItemJadwalList';
import ItemPembayaranList from './pages/admin/ItemPembayaranList';
import ItemSimpananList from './pages/admin/ItemSimpananList';
import DataSiswaList from './pages/admin/DataSiswaList';
import DataRombelList from './pages/admin/DataRombelList';
// Data Referensi - Form Pages
import TahunAjaranForm from './pages/admin/TahunAjaranForm';
import DataKelasForm from './pages/admin/DataKelasForm';
import DataMapelForm from './pages/admin/DataMapelForm';
import DataPengajarForm from './pages/admin/DataPengajarForm';
import ItemJadwalForm from './pages/admin/ItemJadwalForm';
import ItemPembayaranForm from './pages/admin/ItemPembayaranForm';
import ItemSimpananForm from './pages/admin/ItemSimpananForm';
import DataSiswaForm from './pages/admin/DataSiswaForm';
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
          <Route path="/profil/:slug" element={<ProfileDetail />} />
          <Route path="/page/:slug" element={<PageDetail />} />
          <Route path="/kontak" element={<Contact />} />
          <Route path="/berita" element={<NewsListPublic />} />
          <Route path="/berita/:id" element={<NewsDetail />} />
          <Route path="/berita/:id/:slug" element={<NewsDetail />} />
          <Route path="/agenda" element={<AgendaListPublic />} />
          <Route path="/agenda/:id" element={<AgendaDetail />} />
          <Route path="/pengumuman" element={<AnnouncementListPublic />} />
          <Route path="/pengumuman/:id" element={<AnnouncementDetail />} />
          <Route path="/video" element={<VideoGallery />} />
          <Route path="/galeri" element={<GalleryListPublic />} />
          <Route path="/galeri/:id" element={<GalleryDetailPublic />} />
          <Route path="/guru-dan-staf" element={<StaffListPublic />} />
          
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
          <Route path="/dashboard/galeri/video" element={<ProtectedRoute redirectTo="/admin-login"><VideoList /></ProtectedRoute>} />
          <Route path="/dashboard/galeri/video/tambah" element={<ProtectedRoute redirectTo="/admin-login"><VideoForm /></ProtectedRoute>} />
          <Route path="/dashboard/galeri/video/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><VideoForm /></ProtectedRoute>} />
          <Route path="/dashboard/staff" element={<ProtectedRoute redirectTo="/admin-login"><StaffList /></ProtectedRoute>} />
          <Route path="/dashboard/staff/tambah" element={<ProtectedRoute redirectTo="/admin-login"><StaffForm /></ProtectedRoute>} />
          <Route path="/dashboard/staff/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><StaffForm /></ProtectedRoute>} />
          <Route path="/dashboard/messages" element={<ProtectedRoute redirectTo="/admin-login"><MessageList /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute redirectTo="/admin-login"><Settings /></ProtectedRoute>} />
          
          {/* Data Referensi Routes */}
          <Route path="/dashboard/referensi/tahun-ajaran" element={<ProtectedRoute redirectTo="/admin-login"><TahunAjaranList /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/tahun-ajaran/tambah" element={<ProtectedRoute redirectTo="/admin-login"><TahunAjaranForm /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/tahun-ajaran/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><TahunAjaranForm /></ProtectedRoute>} />
          
          <Route path="/dashboard/referensi/kelas" element={<ProtectedRoute redirectTo="/admin-login"><DataKelasJList /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/kelas/tambah" element={<ProtectedRoute redirectTo="/admin-login"><DataKelasForm /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/kelas/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><DataKelasForm /></ProtectedRoute>} />
          
          <Route path="/dashboard/referensi/mapel" element={<ProtectedRoute redirectTo="/admin-login"><DataMapelList /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/mapel/tambah" element={<ProtectedRoute redirectTo="/admin-login"><DataMapelForm /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/mapel/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><DataMapelForm /></ProtectedRoute>} />
          
          <Route path="/dashboard/referensi/pengajar" element={<ProtectedRoute redirectTo="/admin-login"><DataPengajarList /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/pengajar/tambah" element={<ProtectedRoute redirectTo="/admin-login"><DataPengajarForm /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/pengajar/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><DataPengajarForm /></ProtectedRoute>} />
          
          <Route path="/dashboard/referensi/jadwal" element={<ProtectedRoute redirectTo="/admin-login"><ItemJadwalList /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/jadwal/tambah" element={<ProtectedRoute redirectTo="/admin-login"><ItemJadwalForm /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/jadwal/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><ItemJadwalForm /></ProtectedRoute>} />
          
          <Route path="/dashboard/referensi/pembayaran" element={<ProtectedRoute redirectTo="/admin-login"><ItemPembayaranList /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/pembayaran/tambah" element={<ProtectedRoute redirectTo="/admin-login"><ItemPembayaranForm /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/pembayaran/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><ItemPembayaranForm /></ProtectedRoute>} />
          
          <Route path="/dashboard/referensi/simpanan" element={<ProtectedRoute redirectTo="/admin-login"><ItemSimpananList /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/simpanan/tambah" element={<ProtectedRoute redirectTo="/admin-login"><ItemSimpananForm /></ProtectedRoute>} />
          <Route path="/dashboard/referensi/simpanan/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><ItemSimpananForm /></ProtectedRoute>} />
          
          {/* Data Induk Routes */}
          <Route path="/dashboard/data-siswa" element={<ProtectedRoute redirectTo="/admin-login"><DataSiswaList /></ProtectedRoute>} />
          <Route path="/dashboard/data-siswa/tambah" element={<ProtectedRoute redirectTo="/admin-login"><DataSiswaForm /></ProtectedRoute>} />
          <Route path="/dashboard/data-siswa/edit/:id" element={<ProtectedRoute redirectTo="/admin-login"><DataSiswaForm /></ProtectedRoute>} />
          <Route path="/dashboard/data-rombel" element={<ProtectedRoute redirectTo="/admin-login"><DataRombelList /></ProtectedRoute>} />
          
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
