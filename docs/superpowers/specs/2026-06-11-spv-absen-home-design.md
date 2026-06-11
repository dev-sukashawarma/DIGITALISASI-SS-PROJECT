# SPV bisa absen + jadi halaman utama SPV

## Latar belakang
Saat ini hanya kru (`role !== spv/kepala_outlet`) yang punya halaman absen wajah
(`/dashboard/kru`, berisi kamera + liveness + riwayat absensi pribadi via
`useClockKiosk`). SPV/kepala outlet hanya punya "Papan Kehadiran" (board view-only)
sebagai halaman utama (`/dashboard`), tanpa cara untuk absen sendiri.

## Tujuan
- SPV/kepala outlet bisa absen (clock-in/out wajah) seperti kru.
- Halaman absen menjadi halaman utama (root `/dashboard`) untuk SPV.

## Perubahan

1. **Ekstrak komponen bersama** `AttendanceKioskPanel` (lokasi:
   `src/features/clock/AttendanceKioskPanel.tsx`) berisi seluruh UI kamera/liveness,
   status hari ini, riwayat absensi, dan tools testing — dipindah dari
   `src/app/dashboard/kru/page.tsx` apa adanya (tanpa perubahan logika).

2. **Pindah board**: konten `src/app/dashboard/page.tsx` (Papan Kehadiran) dipindah ke
   `src/app/dashboard/papan-kehadiran/page.tsx` (route baru), tanpa perubahan logika.

3. **Root `/dashboard` baru**: `src/app/dashboard/page.tsx` di-render ulang memakai
   `<AttendanceKioskPanel />` — jadi halaman utama SPV.

4. **`src/app/dashboard/kru/page.tsx`**: disederhanakan jadi render
   `<AttendanceKioskPanel />` (dedup, behavior kru tidak berubah).

5. **Nav SPV** (`src/components/Navbar` / `src/app/dashboard/layout.tsx`): tambah item
   "Absen" → `/dashboard` di posisi pertama, "Papan Kehadiran" → `/dashboard/papan-kehadiran`
   di posisi kedua. Item lain tetap.

6. **Whitelist crew** di `dashboard/layout.tsx` tidak berubah — crew tetap diarahkan ke
   `/dashboard/kru`.

## Di luar scope
- Tidak mengubah logika `useClockKiosk`, face matching, atau RBAC/RLS.
- Tidak menggabungkan halaman board dan absen jadi satu.
