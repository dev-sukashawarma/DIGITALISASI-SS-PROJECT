# E2E Test per Role — Index

Kumpulan dokumen tes **E2E manual** terperinci, **satu dokumen per role**. Tiap
dokumen berisi: prasyarat, test case bernomor (langkah + hasil diharapkan), dan
bagian **Kemungkinan masalah & troubleshooting** spesifik role tersebut.

## Daftar dokumen

| Role | Dokumen |
|------|---------|
| admin | [e2e-admin.md](e2e-admin.md) |
| owner | [e2e-owner.md](e2e-owner.md) |
| spv | [e2e-spv.md](e2e-spv.md) |
| leader | [e2e-leader.md](e2e-leader.md) |
| kasir | [e2e-kasir.md](e2e-kasir.md) |
| crew | [e2e-crew.md](e2e-crew.md) |
| kiosk | [e2e-kiosk.md](e2e-kiosk.md) |

Ringkasan matriks akses: [../QA-CHECKLIST-ROLE.md](../QA-CHECKLIST-ROLE.md).
Sumber jobdesk: [../ROLE-JOBDESK.md](../ROLE-JOBDESK.md).

## Prasyarat bersama (berlaku untuk semua role)

### Lingkungan
- Jalankan di **subdomain deploy** (`*.sukashawarma.com`), **bukan `localhost`**.
  - Alasan: guard `owner-dashboard` di-skip saat `localhost`; cookie SSO butuh
    domain `.sukashawarma.com` agar ke-share antar subdomain.
- Pakai **jendela incognito baru per role** supaya sesi tidak bercampur.
- Sebagian besar langkah read-only aman. Langkah yang **menulis** ditandai
  ⚠️ **(ubah data)** — pakai akun/outlet test, atau lewati di lingkungan produksi nyata.

### URL
| App | URL |
|-----|-----|
| Portal | https://app.sukashawarma.com |
| Admin Dashboard | https://admin.sukashawarma.com |
| Stok | https://stok.sukashawarma.com |
| Absensi | https://absensi.sukashawarma.com |
| Distribusi | https://distribusi.sukashawarma.com |
| POS Kasir | https://pos.sukashawarma.com |
| Owner Dashboard | https://owner.sukashawarma.com |

### Akun test
Isi tabel ini sebelum mulai; tiap dokumen role menunjuk barisnya.

| Role | Email / Username | Password | Outlet | Catatan |
|------|------------------|----------|--------|---------|
| admin | | | (semua) | email lengkap |
| owner | | | (semua) | |
| spv | | | (semua) | |
| leader | | | (binaan ≥1) | butuh baris `staff_outlets` |
| kasir | | | 1 outlet | |
| crew | | | 1 outlet | wajah sudah ter-enroll |
| kiosk | | | 1 outlet | login via QR device |

### Definisi hasil
- **Diizinkan** = halaman app terbuka, tetap di host app.
- **Ditolak** = di-redirect ke portal (login/launcher).
- **Pass** = semua hasil sesuai harapan. **Fail** = ada yang menyimpang (catat).

## Masalah umum lintas-role (cek dulu sebelum lapor bug)

| Gejala | Kemungkinan penyebab | Tindakan |
|--------|----------------------|----------|
| Login sukses tapi langsung balik ke login | Cookie SSO tak ter-share antar subdomain | Pastikan `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` saat build app, tes di subdomain (bukan IP/localhost) |
| Akses app lambat / kadang 401 | App tak set `SUPABASE_JWT_SECRET` → fallback `getUser()` lambat | Set `SUPABASE_JWT_SECRET` di env app prod |
| Sudah login, buka app malah ke portal terus | Role memang tak punya akses (benar), ATAU staff `status ≠ active` | Cek `outlet_staff.status='active'` & matriks akses |
| Tombol/aksi gagal diam-diam (RLS) | Hook bikin browser client sendiri tanpa cookieOptions → write jadi anon | Lihat memory "Two-Factory Browser Client Gotcha"; pastikan pakai `@suka/auth` client |
| Embedding error PGRST200/PGRST201 | FK/`staff_outlets` drift atau embed ambigu | Lihat memory "Admin-Dashboard Deploy Chain" |
| Tampilan beda server vs setelah reload | Hydration mismatch (`Date.now()` saat render) | Catat; bukan masalah akses |
