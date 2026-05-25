# AI_DB_PATH - Dokumentasi Path Penyimpanan Data

Dokumen ini mencatat seluruh path yang digunakan dalam Firebase Realtime Database (RTDB) dan Firebase Storage untuk sistem Multi-Tenancy.

## 1. Realtime Database (RTDB)
Semua data disimpan di bawah prefix: `tenants/{tenantId}/`

| Path | Deskripsi | Field Utama |
| :--- | :--- | :--- |
| `settings` | Konfigurasi sekolah & branding | `schoolName`, `tagline`, `level`, `logo`, `heroSlides`, `headmaster`, `eServicesLayout` |
| `news` | Data berita & artikel | `title`, `content`, `category`, `date`, `thumbnail`, `deleted`, `year`, `month` |
| `agenda` | Jadwal kegiatan sekolah | `title`, `date`, `time`, `location`, `description`, `deleted`, `status` |
| `announcements` | Pengumuman penting | `title`, `content`, `date`, `status`, `deleted` |
| `gallery_albums` | Kelompok foto per kegiatan | `title`, `description`, `date`, `thumbnail` (cover), `deleted` |
| `gallery_photos` | Foto individual dalam album | `albumId`, `url`, `caption`, `timestamp`, `deleted` |
| `e_services` | Link layanan eksternal (E-Layanan) | `title`, `url`, `color` (legacy), `bgColor`, `textColor`, `icon`, `iconType`, `order` |
| `logs` | Log aktivitas administrator | `action`, `target`, `title`, `timestamp` |
| `stats` | Counter atomik untuk summary | `totalNews`, `totalAgendas`, `totalAnnouncements`, `totalAlbums`, `totalPhotos`, `totalEServices` |

## 2. Root Paths (Owner Only)
Path tingkat tinggi yang hanya dapat diakses oleh Owner.

| Path | Deskripsi |
| :--- | :--- |
| `owners/{uid}` | Daftar UID pengguna yang memiliki akses sebagai Owner |
| `invitations/{id}` | Token undangan pendaftaran yang dibuat oleh Owner |
| `registration-requests/{tenantId}` | Antrian pendaftaran sekolah yang menunggu persetujuan Owner |
| `tenant-lists/` | Ringkasan data tenant untuk dashboard owner (Efisien) |
| `tenants/` | Root dari seluruh data tenant (manajemen sekolah) |

## 3. Firebase Storage
Semua file disimpan di bawah prefix: `{tenantId}/`

| Path | Deskripsi | Format |
| :--- | :--- | :--- |
| `settings/` | Logo dan asset identitas | `.webp` |
| `settings/slides/` | Gambar untuk Hero Slideshow | `.webp` |
| `news/` | Thumbnail untuk berita | `.webp` |
| `gallery/{albumId}/` | Foto-foto kegiatan per album | `.webp` |

---
*Dokumen ini wajib diperbarui setiap kali ada penambahan path baru di database atau storage.*
