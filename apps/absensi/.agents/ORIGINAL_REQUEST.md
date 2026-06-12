# Original User Request

## Initial Request — 2026-06-11T03:28:20Z

Sistem checklist operasional harian terintegrasi untuk outlet restoran. Sistem memungkinkan kru yang sedang shift untuk mengisi checklist (keamanan, alat, bahan baku) secara real-time tersinkronisasi antar perangkat kru di outlet yang sama.

Working directory: c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\absensi
Integrity mode: development

## Requirements

### R1. Sinkronisasi Checklist Real-time
Sistem harus menggunakan Supabase Realtime agar status checklist yang dicentang oleh satu staf langsung terlihat oleh staf lain di outlet yang sama (Case 1).

### R2. Kepemilikan Checklist Fleksibel (Outlet-Based)
Checklist dimiliki oleh outlet/shift per hari, bukan individu. Setiap kru yang sudah absen masuk dapat mengisi checklist. Sistem harus mencatat ID/Nama staf yang mencentang setiap item untuk akuntabilitas (Case 2).

### R3. Manajemen Checklist Dinamis (SPV)
Sistem harus menyediakan halaman di Dashboard SPV untuk membuat, mengedit, dan menghapus template item checklist (dan kategorinya) per outlet. Item-item ini yang akan muncul di layar kru.

## Acceptance Criteria

### Fungsionalitas Kiosk Kru
- [ ] Terdapat halaman Checklist Harian di dashboard Kru yang menampilkan item sesuai template outlet tersebut.
- [ ] Centang checklist terekam ke database dengan timestamp dan nama kru yang mencentang.
- [ ] Perubahan centang ter-broadcast via Supabase Realtime sehingga jika layar direfresh/dibuka kru lain, tampilannya sama persis.

### Fungsionalitas Dashboard SPV
- [ ] Terdapat halaman Manajemen Checklist di Dashboard SPV untuk membuat, mengubah, dan menghapus kategori serta item tugas.

### Verifikasi dengan Script Otomatis
- [ ] Agen harus menggunakan test script (misal Jest/Playwright) atau membuat script uji singkat untuk memverifikasi alur CRUD dan Supabase subscription berjalan tanpa error.
