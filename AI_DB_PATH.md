## Firebase Realtime Database Paths

- `tenants/{tenantId}/news/{id}`: Menyimpan detail berita individu, termasuk judul, konten, URL gambar (imageUrl/thumbnail), kategori, status (published), dan waktu pembuatan. Digunakan untuk halaman detail berita dan daftar berita publik/admin.
- `tenants/{tenantId}/news_search_index/{id}`: Menyimpan data minimal berita (judul lowercase, judul asli, tanggal) untuk keperluan pencarian yang hemat bandwidth.
- `tenants/{tenantId}/stats/{category}/total`: Total item dalam kategori tertentu (news, agenda, announcement).
- `tenants/{tenantId}/stats/{category}/years/{year}/total`: Total item dalam satu tahun.
- `tenants/{tenantId}/stats/{category}/years/{year}/months/{month}/total`: Total item dalam satu bulan.
- `tenants/{tenantId}/stats/{category}/years/{year}/months/{month}/days/{day}`: Total item pada tanggal tertentu.
- `tenants/{tenantId}/settings`: Menyimpan konfigurasi umum sekolah/madrasah, termasuk nama, tagline, logo, profil kepala sekolah, informasi kontak (email, telepon, alamat, koordinat peta), serta preferensi layout (seperti `eServicesLayout`).
- `tenants/{tenantId}/profiles`: Menyimpan daftar konten profil dinamis (seperti Sejarah, Visi Misi, Struktur Organisasi, dll) dengan metadata judul, slug, konten, dan status aktif.
- `tenants/{tenantId}/e_services`: Menyimpan daftar layanan digital (link eksternal) beserta metadata ikon dan warna untuk ditampilkan di menu dan beranda.
- `tenants/{tenantId}/staff/{id}`: Menyimpan data guru dan staf (Nama, Foto, Jenis Kepegawaian, Mapel, Status Aktif).
- `tenants/{tenantId}/staff_search_index/{id}`: Index pencarian guru & staf (Nama lowercase, jenis).
- `tenants/{tenantId}/messages/{id}`: Pesan/masukan dari pengunjung. Berisi: `uid`, `authEmail`, `authName`, `inputName`, `subject`, `message`, `createdAt`, `isRead`, `reply` (opsional).
- `tenants/{tenantId}/messages`: Perlu index pada `uid` untuk filter "Pesan Saya" dan `createdAt` untuk admin.
- `tenants/{tenantId}/user_message_meta/{uid}`: Metadata per user untuk pembatasan pengiriman pesan (misal: `lastSentAt`).

## Firebase Storage Paths

- `tenants/{tenantId}/staff_photos/{fileName}`: Penyimpanan foto profil guru dan staf (Format WebP, Max 200KB).
- `tenants/{tenantId}/settings/logo/`: Logo sekolah.
- `tenants/{tenantId}/settings/headmaster/`: Foto kepala sekolah.
- `tenants/{tenantId}/settings/slides/`: Gambar hero slideshow.
- `tenants/{tenantId}/gallery/{albumId}/`: Foto-foto dalam album galeri.
