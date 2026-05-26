## Firebase Realtime Database Paths

- `tenants/{tenantId}/news/{id}`: Menyimpan detail berita individu, termasuk judul, konten, URL gambar (imageUrl/thumbnail), kategori, status (published), dan waktu pembuatan. Digunakan untuk halaman detail berita dan daftar berita publik/admin.
- `tenants/{tenantId}/news_search_index/{id}`: Menyimpan data minimal berita (judul lowercase, judul asli, tanggal) untuk keperluan pencarian yang hemat bandwidth.
- `tenants/{tenantId}/stats/{category}/total`: Total item dalam kategori tertentu (news, agenda, announcement).
- `tenants/{tenantId}/stats/{category}/years/{year}/total`: Total item dalam satu tahun.
- `tenants/{tenantId}/stats/{category}/years/{year}/months/{month}/total`: Total item dalam satu bulan.
- `tenants/{tenantId}/stats/{category}/years/{year}/months/{month}/days/{day}`: Total item pada tanggal tertentu.
- `tenants/{tenantId}/settings`: Menyimpan konfigurasi umum sekolah/madrasah, termasuk nama, tagline, logo, profil kepala sekolah, dan preferensi layout (seperti `eServicesLayout`).
- `tenants/{tenantId}/e_services`: Menyimpan daftar layanan digital (link eksternal) beserta metadata ikon dan warna untuk ditampilkan di menu dan beranda.

## Firebase Storage Paths

(Belum ada path baru yang ditambahkan untuk Firebase Storage)
