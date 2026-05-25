# MTs Negeri 1 Garut - Website Official

Proyek website sekolah MTs Negeri 1 Garut menggunakan React SPA, Bootstrap, dan Firebase.

## Teknologi Utama
- **Frontend:** React (Vite) + TypeScript
- **Styling:** Bootstrap (React-Bootstrap)
- **Backend:** Firebase Cloud Functions
- **Database:** Firebase Realtime Database (RTDB)
- **Storage:** Firebase Storage (untuk file statis/gambar)
- **Hosting:** Firebase Hosting

## Struktur Folder
- `src/components`: Komponen UI reusable (Header, Footer, Hero, dll)
- `src/pages`: Halaman utama website
- `src/firebase`: Konfigurasi Firebase
- `functions`: Kode untuk Firebase Cloud Functions

## Cara Menjalankan Lokal
1. Clone repositori ini.
2. Jalankan `npm install` di root dan di folder `functions`.
3. Update konfigurasi Firebase di `src/firebase/config.ts`.
4. Jalankan `npm run dev` untuk melihat frontend.
5. Jalankan `firebase emulators:start` untuk testing fungsi Firebase secara lokal.

## Deployment
1. Build proyek: `npm run build`
2. Deploy ke Firebase: `firebase deploy`
