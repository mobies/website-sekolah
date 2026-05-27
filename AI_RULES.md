# AI_RULES - Panduan Pengembangan Proyek Sekolah

Dokumen ini berisi aturan wajib bagi Agent AI dalam mengerjakan proyek website Sekolah.

## 0. Profesionalisme AI Agent
- **Peran & Tanggung Jawab:** Sebagai AI programmer tingkat produksi, saya akan bekerja secara profesional, hati-hati, dan menjaga kualitas aplikasi yang sudah ada. Saya DILARANG merusak atau mengubah alur aplikasi yang sudah dibuat kecuali diperintahkan secara eksplisit oleh Anda.

## 1. Arsitektur Frontend
- **SPA Only:** Gunakan Single Page Application (React/Vue).
- **No SSR:** Hindari penggunaan Server Side Rendering (Next.js/Nuxt.js) kecuali diinstruksikan khusus.

## 2. Keamanan & Deployment
- **Konfirmasi Deploy:** DILARANG melakukan deploy ke Firebase Hosting atau Cloud Functions tanpa ijin/konfirmasi eksplisit dari user.
- **No Database/Storage Deploy:** DILARANG melakukan deployment untuk aturan Database (`rules`) atau Storage (`rules`) melalui CLI. Seluruh pengaturan keamanan/role wajib dilakukan secara MANUAL langsung melalui Firebase Console untuk menghindari kesalahan penimpaan aturan.
- **Separate Deployment:** Lakukan deployment untuk Hosting dan Functions secara TERPISAH (Gunakan `--only`).
- **Surgical Function Deployment (Time Efficiency):** Saat deploy Cloud Functions, HANYA deploy fungsi yang ditambah, diubah, atau dihapus saja (Contoh: `firebase deploy --only functions:namaFungsi`). JANGAN melakukan deploy semua fungsi jika tidak ada perubahan untuk menghemat waktu dan menghindari penghapusan fungsi dari proyek lain.

## 3. Manajemen Halaman
- **No Unrequested Pages:** Jangan menambah atau mengubah halaman di luar instruksi.
- **Anti-Halusinasi:** Jangan berasumsi fitur atau halaman diperlukan tanpa instruksi eksplisit.

## 4. Akses Data (RTDB)
- **Direct Access:** Realtime Database (RTDB) dibaca dan ditulis langsung dari frontend menggunakan Firebase SDK untuk efisiensi.
- **Function Usage:** Gunakan Cloud Functions HANYA untuk:
  - Proses Login/Logout (jika diperlukan logika server-side).
  - Fungsi yang diperintahkan khusus.
  - Proses yang membutuhkan akses admin/secret key.

## 5. Penyimpanan File
- **Firebase Storage:** Gunakan Firebase Storage untuk gambar dan file statis secara default.
- **S3:** Gunakan S3 hanya jika kredensial sudah disiapkan oleh user.
- **Hapus File Lama (Wajib):** Saat melakukan edit data yang menyertakan gambar (contoh: foto staf, sampul berita), jika gambar diubah, maka file gambar yang lama **wajib dihapus** dari Firebase Storage untuk menghemat ruang penyimpanan. Proses penghapusan tidak boleh mengganggu proses update data jika gagal.

## 6. Efisiensi Biaya (Cost Efficiency)
- **Firebase Billing:** Selalu prioritaskan metode yang paling hemat biaya.
- **Proactive Advice:** Berikan saran jika ada permintaan user atau implementasi kode yang berpotensi menyebabkan biaya Firebase membengkak (misal: looping query yang tidak efisien, ukuran file gambar terlalu besar, atau eksekusi Cloud Function yang berlebihan).

## 7. Branding & Terminologi Dinamis
- **Tenant Awareness:** Gunakan `useTenant()` untuk mendapatkan istilah dinamis (`terms`).
- **Pembedaan Istilah:**
  - Jenjang **MI, MTs, MA**: Gunakan istilah **Madrasah**, **Santri**, dan **Kepala Madrasah**.
  - Jenjang **SD, SMP, SMA, SMK**: Gunakan istilah **Sekolah**, **Siswa**, dan **Kepala Sekolah**.
- **Konsistensi UI:** Seluruh label, placeholder, dan konten teks harus merujuk pada terminologi dinamis ini agar sesuai dengan identitas tenant.

## 8. Gambar & Aset (Wajib)
- **Konversi & Kompresi:** Semua gambar yang diunggah wajib dikonversi ke format **WebP** dengan kualitas **70%**.
- **Resolusi Maksimum:** Resolusi gambar tidak boleh melebihi **1200x800 piksel**. Aspek rasio harus dijaga saat resizing.
- **Ukuran File:** Ukuran file akhir setelah kompresi tidak boleh melebihi **100KB**.
- **Fitur Rekonversi:** Jika ada gambar yang tidak sesuai (bukan WebP atau >100KB), sediakan tombol untuk melakukan rekonversi.
- **Penerapan:** Aturan ini berlaku untuk semua jenis unggahan gambar, termasuk logo, foto profil, sampul berita, dan galeri. Gunakan fungsi `convertToWebP` yang tersedia.

## 9. Dokumentasi Path Data (Wajib)
- **AI_DB_PATH Update:** Setiap kali Agent AI membuat path penyimpanan baru di RTDB atau Firebase Storage, path tersebut WAJIB dicatat dalam file `AI_DB_PATH.md` beserta deskripsi singkatnya.
- **Transparansi Struktur:** Pastikan struktur database tetap mengikuti pola `tenants/{tenantId}/` untuk menjaga konsistensi Multi-Tenancy.

## 10. Standar Logging & Optimasi Data (Wajib)
- **Activity Logging:** Setiap tindakan `TAMBAH`, `EDIT`, `HAPUS`, dan `RESTORE` pada modul utama (Berita, Agenda, Pengumuman, Galeri) WAJIB dicatat menggunakan fungsi `logActivity()`.
- **Atomic Counters:** Dilarang melakukan penghitungan ulang (count) data secara manual dari list besar. Gunakan fungsi `updateCounter()` untuk memperbarui path `stats/` setiap kali ada penambahan atau penghapusan data (termasuk soft delete).
- **Soft Delete:** Gunakan field `deleted: true` untuk penghapusan data. Pastikan counter dikurangi saat soft delete dan ditambah kembali saat restore.
- **Time-based Storage:** Simpan metadata waktu (`year`, `month`, `day`) pada setiap entitas data untuk memudahkan proses filter dan rekap tanpa membebani query Firebase.
- **Efisiensi Bandwidth:** Selalu prioritaskan pembacaan data summary/counter daripada membaca seluruh koleksi data untuk kebutuhan tampilan statistik di dashboard.

## 11. Bahasa chat (Wajib)
- **Bahasa yang digunakan:** Gunakan bahasa indonesia dalam berkomunikasi dan menyampaikan output. Gunakan bahasa singkat dan padat tapi jelas untuk menghemat token output.

## 12. Deteksi Bug & Kualitas Kode (Wajib)
- **TypeScript Check:** Selalu jalankan `npx tsc --noEmit` secara rutin setelah melakukan perubahan kode yang signifikan atau sebelum menyatakan tugas selesai. Ini bertujuan untuk mendeteksi error sintaksis, kesalahan tipe data, atau referensi yang hilang lebih awal guna menjaga stabilitas aplikasi.

## 13. Penanganan Error & Stabilitas (Wajib)
- **Preservasi UI/Alur:** Jika menemukan error saat build atau runtime, perbaiki error tersebut tanpa mengubah tampilan (UI) atau alur logika yang sudah ada kecuali diminta.
- **Dilarang Destruktif:** Jangan melakukan perubahan radikal yang membuat aplikasi menjadi kacau, acak-acakan, atau kehilangan fitur yang sudah berfungsi sebelumnya. Fokus pada perbaikan teknis yang presisi.

---
*Aturan ini bersifat mengikat dan harus diperiksa sebelum melakukan perubahan signifikan pada codebase.*
