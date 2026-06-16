## Firebase Realtime Database Paths

- `tenants/{tenantId}/news/{id}`: Menyimpan detail berita individu, termasuk judul, konten, URL gambar (imageUrl/thumbnail), kategori, status (published), dan waktu pembuatan. Digunakan untuk halaman detail berita dan daftar berita publik/admin.
- `tenants/{tenantId}/news_search_index/{id}`: Menyimpan data minimal berita (judul lowercase, judul asli, tanggal) untuk keperluan pencarian yang hemat bandwidth.
- `tenants/{tenantId}/announcements/{id}`: Menyimpan detail pengumuman individu (judul, konten, tanggal, status, dll.).
- `tenants/{tenantId}/announcement_search_index/{id}`: Menyimpan data minimal pengumuman (t/judul lowercase, title, date, deleted) untuk keperluan pencarian yang hemat bandwidth.
- `tenants/{tenantId}/agenda/{id}`: Menyimpan detail agenda kegiatan (judul, tanggal, waktu, lokasi, deskripsi, status).
- `tenants/{tenantId}/agenda_search_index/{id}`: Menyimpan data minimal agenda (t/judul lowercase, title, date, time, loc, deleted) untuk keperluan pencarian yang hemat bandwidth.
- `tenants/{tenantId}/stats/{category}/total`: Total item dalam kategori tertentu (news, agenda, announcement).
- `tenants/{tenantId}/stats/{category}/years/{year}/total`: Total item dalam satu tahun.
- `tenants/{tenantId}/stats/{category}/years/{year}/months/{month}/total`: Total item dalam satu bulan.
- `tenants/{tenantId}/stats/{category}/years/{year}/months/{month}/days/{day}`: Total item pada tanggal tertentu.
- `tenants/{tenantId}/settings`: Menyimpan konfigurasi umum sekolah/madrasah, termasuk nama, tagline, logo, profil kepala sekolah, informasi kontak (email, telepon, alamat, koordinat peta), serta preferensi layout (seperti `eServicesLayout`).
- `tenants/{tenantId}/settings/detailHeroConfig`: Menyimpan konfigurasi latar header untuk halaman detail `Page` dan `Detail Profil`, termasuk mode `solid/image`, warna solid, dan URL gambar.
- `tenants/{tenantId}/settings/menuConfig`: Menyimpan konfigurasi menu publik, termasuk label menu tetap (`Beranda`, `Profile`, `E-Layanan`, `Konten`, `Kontak`, dan submenu Konten), urutan `fixedRootOrder`, serta daftar `linkedMenus` yang dapat diarahkan ke `url` atau ke `page` internal sebagai root/submenu.
- `tenants/{tenantId}/profiles`: Menyimpan daftar konten profil dinamis (seperti Sejarah, Visi Misi, Struktur Organisasi, dll) dengan metadata judul, slug, konten, dan status aktif.
- `tenants/{tenantId}/profiles/{profileId}`: Menyimpan satu konten profil beserta field `attachments[]` untuk lampiran gambar atau embed (`google-form`, `google-sheet`, `google-drive`, `google-slide`, `youtube`) yang tampil di halaman publik.
- `tenants/{tenantId}/pages`: Menyimpan daftar page internal untuk fitur `Page/Linked Menu`, dengan struktur konten serupa `Detail Profil` beserta status aktif.
- `tenants/{tenantId}/pages/{pageId}`: Menyimpan satu page internal beserta field `attachments[]` untuk lampiran gambar atau embed (`google-form`, `google-sheet`, `google-drive`, `google-slide`, `youtube`) yang tampil di halaman publik `/page/{slug}`.
- `tenants/{tenantId}/e_services`: Menyimpan daftar layanan digital (link eksternal) beserta metadata ikon dan warna untuk ditampilkan di menu dan beranda.
- `tenants/{tenantId}/staff/{id}`: Menyimpan data guru dan staf (Nama, Foto, Jenis Kepegawaian, Mapel, Status Aktif).
- `tenants/{tenantId}/staff_search_index/{id}`: Index pencarian guru & staf (Nama lowercase, jenis).
- `tenants/{tenantId}/messages/{id}`: Pesan/masukan dari pengunjung. Berisi: `uid`, `authEmail`, `authName`, `inputName`, `subject`, `message`, `createdAt`, `isRead`, `reply` (opsional).
- `tenants/{tenantId}/messages`: Perlu index pada `uid` untuk filter "Pesan Saya" dan `createdAt` untuk admin.
- `tenants/{tenantId}/user_message_meta/{uid}`: Metadata per user untuk pembatasan pengiriman pesan (misal: `lastSentAt`).
- `tenants/{tenantId}/references/tahun-ajaran/{id}`: Menyimpan data tahun ajaran dengan field tanggal_mulai (DD-MM-YYYY format, auto-generate tahun ajaran), nama (YYYY-YYYY format, auto-calculated), dan createdAt.
- `tenants/{tenantId}/references/kelas/{id}`: Menyimpan data kelas dengan field kode (uppercase alphanumeric), nama, dan createdAt.
- `tenants/{tenantId}/references/mapel/{id}`: Menyimpan data mata pelajaran dengan field kode (uppercase alphanumeric), nama, dan createdAt.
- `tenants/{tenantId}/references/pengajar/{id}`: Menyimpan data pengajar (assignment guru ke mapel) dengan field staffId (immutable), staffName (denormalized), mapelIds[] (array mapel yang diajarkan), dan createdAt.
- `tenants/{tenantId}/references/jadwal/{id}`: Menyimpan item jadwal pelajaran per tahun ajaran dengan field tahunAjaranId (immutable), tahunAjaranNama (denormalized, format YYYY-YYYY), hari (Senin-Minggu), nomorUrut (01-99, auto-calculated, unique per TA+hari), jenis (Pembelajaran/Kegiatan Lain), namaKegiatan (opsional, max 20 karakter, wajib jika jenis='Kegiatan Lain'), jamAwal (HH:MM), durasi (menit), jamAkhir (calculated HH:MM), dan createdAt. Jika item dengan nomorUrut-1 ada pada hari yang sama, jamAwal auto-lock ke jamAwal+durasi item sebelumnya.
- `tenants/{tenantId}/references/pembayaran/{id}`: Menyimpan item pembayaran dengan field nama dan createdAt.
- `tenants/{tenantId}/references/simpanan/{id}`: Menyimpan item simpanan dengan field nama dan createdAt.
- `registration-requests/{tenantId}`: Menyimpan permintaan pendaftaran admin baru, termasuk `tenantId`, `schoolName`, `npsn`, `level`, `adminEmail`, `adminUid`, `status`, `tokenUsed`, `timestamp`, dan metadata lampiran (`attachmentUrl`, `attachmentType`, `attachmentName`).

## Firebase Storage Paths

- `tenants/{tenantId}/staff_photos/{fileName}`: Penyimpanan foto profil guru dan staf (Format WebP, Max 200KB).
- `tenants/{tenantId}/settings/logo/`: Logo sekolah.
- `tenants/{tenantId}/settings/headmaster/`: Foto kepala sekolah.
- `tenants/{tenantId}/settings/detail-hero/`: Gambar latar header detail untuk `Page` dan `Detail Profil`, dikonversi ke WebP kualitas 70% dengan ukuran maksimal 100KB.
- `tenants/{tenantId}/settings/slides/`: Gambar hero slideshow.
- `tenants/{tenantId}/profiles/{profileId}/attachments/`: Penyimpanan lampiran gambar untuk konten profil, wajib WebP kualitas 70% dengan ukuran maksimal 100KB. Lampiran embed tersimpan langsung di RTDB pada array `attachments[]`.
- `tenants/{tenantId}/pages/{pageId}/attachments/`: Penyimpanan lampiran gambar untuk page internal, wajib WebP kualitas 70% dengan ukuran maksimal 100KB. Lampiran embed tersimpan langsung di RTDB pada array `attachments[]`.
- `tenants/{tenantId}/gallery/{albumId}/`: Foto-foto dalam album galeri.
- `registration-requests/{tenantId}/attachment.webp` atau `registration-requests/{tenantId}/attachment.pdf`: Lampiran file pendaftaran admin. Gambar dikonversi ke WebP sesuai aturan AI_RULES, PDF dibatasi maksimal 2MB.
