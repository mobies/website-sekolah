# AI Roadmap Proyek Sekolah

Dokumen ini merangkum pekerjaan proyek yang sudah dikerjakan dan yang masih menjadi pekerjaan lanjutan.

## Checklist Selesai

- [x] Standardisasi unggah gambar ke format WebP kualitas 70 persen dengan batas ukuran akhir maksimal 100KB.
- [x] Penghapusan file gambar lama dari Firebase Storage saat gambar diganti, agar penyimpanan lebih efisien.
- [x] Perbaikan error build dan error sintaks di beberapa modul admin sehingga `npm run build` kembali stabil.
- [x] Perbaikan fitur galeri, termasuk kompresi gambar dan penghapusan file fisik saat foto dihapus.
- [x] Pengelolaan `Detail Profil` di Settings, termasuk tambah, edit, hapus, aktif/nonaktif, dan preview publik.
- [x] Penambahan lampiran untuk item `Detail Profil`.
- [x] Lampiran `Detail Profil` mendukung gambar dan embed: Google Form, Google Sheet, Google Drive, Google Slides, dan YouTube.
- [x] Penambahan modul `Pages` dengan struktur konten mirip `Detail Profil`.
- [x] Lampiran untuk item `Pages` mendukung gambar dan embed: Google Form, Google Sheet, Google Drive, Google Slides, dan YouTube.
- [x] Penambahan tab `Pages` pada Dashboard Admin -> Settings.
- [x] Penambahan tab `Atur Menu` pada Dashboard Admin -> Settings.
- [x] Konfigurasi menu publik agar dapat mengubah label menu tetap: Beranda, Profile, E-Layanan, Konten, dan Kontak.
- [x] Konfigurasi `Page/Linked Menu` untuk mengarah ke URL tertentu atau ke page internal.
- [x] Penambahan tree menu pada pengaturan menu agar root dan submenu terlihat jelas.
- [x] Root menu tetap `E-Layanan` terhubung langsung dengan `Layanan Digital`.
- [x] Root menu tetap `Profile` terhubung langsung dengan item `Detail Profil`.
- [x] Root linked menu dapat disisipkan setelah root tertentu, termasuk di antara root menu tetap.
- [x] `Home/Beranda` dikunci tetap menjadi root menu pertama.
- [x] Root menu tetap selain `Home/Beranda` dapat diurutkan ulang secara custom.
- [x] Perubahan label tree menu langsung dari ikon pensil dengan prompt dan simpan langsung ke database.
- [x] Perubahan beberapa label tab di `Settings` agar lebih ringkas: `Profil`, `Slideshow`, `Menu Layanan`, `Atur Menu`, dan `Pages`.
- [x] Penyesuaian navbar publik: `Agenda` menjadi submenu dari `Konten`.
- [x] Penambahan ikon pada semua submenu navbar publik.
- [x] Penambahan pengaturan latar header untuk halaman detail `Pages` dan `Detail Profil`, dengan pilihan warna solid atau gambar upload.
- [x] Gambar latar header detail disimpan di Storage dan dikonversi ke WebP sesuai aturan.
- [x] Halaman publik `PageDetail` dan `ProfileDetail` membaca konfigurasi latar header dari `settings/detailHeroConfig`.
- [x] Penambahan dua mode baru section `Layanan Digital`: `Compact Grid` dan `List Card`, selain `Bento` dan `Slider`.
- [x] Perapihan mode `Compact Grid` agar ukuran kartu lebih mengikuti isi.
- [x] Perbaikan tampilan foto guru/staf di publik agar posisi crop rata atas dan kepala tidak mudah terpotong.
- [x] Penyesuaian rasio box/card guru-staf publik menjadi `3:4`.
- [x] Pembaruan dokumentasi path data di `AI_DB_PATH.md` untuk path-path baru yang sudah dibuat.

## Checklist Belum Dikerjakan / Lanjutan

- [ ] Optimasi ukuran bundle frontend dengan code splitting, karena build masih memberi warning ukuran chunk besar.
- [ ] Abstraksi logika upload gambar berulang ke helper atau custom hook agar lebih mudah dirawat.
- [ ] Penambahan progress upload yang lebih informatif pada proses unggah file di panel admin.
- [ ] Review konsistensi visual semua mode `Layanan Digital` pada desktop dan mobile setelah penambahan mode baru.
- [ ] Review lanjutan untuk seluruh halaman publik agar crop foto portrait lain juga aman jika ada komponen serupa.
- [ ] Audit ringan struktur `Settings.tsx` karena file sudah cukup besar dan banyak menangani fitur berbeda.
- [ ] Penyusunan dokumentasi penggunaan fitur `Atur Menu`, `Pages`, dan lampiran embed agar admin lebih mudah memahami alurnya.

## Catatan

- Fokus data tetap memakai pola multi-tenant `tenants/{tenantId}/...`.
- Deployment, commit, dan push tidak dilakukan tanpa instruksi eksplisit dari user.
- Setiap penambahan path RTDB atau Storage baru wajib dicatat di `AI_DB_PATH.md`.
