# E2E Test — Role `admin`

> Prasyarat bersama: lihat [README.md](README.md). Akun: baris **admin** (email lengkap).
> Jobdesk: IT/Sistem + HR/Personalia — super user, akses semua app.

## Cakupan
admin punya akses **semua app**, dan dari portal **auto-redirect** ke Admin Dashboard
(tidak berhenti di launcher).

---

## TC-ADM-01 — Login & auto-redirect
| | |
|--|--|
| Langkah | Buka Portal → login email+password admin |
| Diharapkan | TIDAK berhenti di launcher; **otomatis di-redirect ke `admin.sukashawarma.com`** |
- [ ] Pass

## TC-ADM-02 — Akses semua app
Buka tiap URL setelah login:
- [ ] Admin Dashboard → diizinkan
- [ ] POS Kasir → diizinkan
- [ ] Absensi → diizinkan
- [ ] Stok → diizinkan
- [ ] Distribusi → diizinkan
- [ ] Owner Dashboard → diizinkan

## TC-ADM-03 — Outlet master (admin-dashboard)
- [ ] `/dashboard/outlets` → daftar 19 outlet tampil; filter & tabel jalan.
- [ ] Buka dialog tambah/edit outlet → form muncul.
- [ ] ⚠️ (ubah data) Tambah outlet uji → tersimpan → hapus lagi.

## TC-ADM-04 — Staff master / HR
- [ ] `/dashboard/staff` → daftar staff lintas outlet tampil.
- [ ] Buka form tambah staff (Edge Function `create-staff`) → form muncul.
- [ ] ⚠️ (ubah data) Buat akun crew uji → muncul di daftar → nonaktifkan/hapus (`delete-staff`).
- [ ] Reset kredensial salah satu akun test berhasil.

## TC-ADM-05 — Absensi lintas outlet (HR)
- [ ] `/dashboard/rekap` → rekap absensi **semua outlet** (bukan 1).
- [ ] `/dashboard/manajemen-kru` → daftar kru lintas outlet terbuka.
- [ ] `/dashboard/pengaturan` → konfigurasi terbuka.

## TC-ADM-06 — Stok & config sistem
- [ ] `/stok/monitoring-live` → papan semua outlet tampil.
- [ ] `/stok/settings/threshold` → atur threshold per outlet (form muncul).
- [ ] ⚠️ (ubah data) Ubah threshold outlet test → tersimpan.

## TC-ADM-07 — POS admin
- [ ] `/admin/menu` → kelola menu terbuka.
- [ ] `/admin/users` → kelola user POS terbuka.
- [ ] `/admin/settings` → pengaturan global terbuka.
- [ ] Generate **kiosk QR** menghasilkan QR valid.

---

## Kemungkinan masalah & troubleshooting

| Gejala | Penyebab mungkin | Tindakan |
|--------|------------------|----------|
| Login admin berhenti di launcher (tidak auto-redirect) | Chokepoint redirect by-role di launcher RSC tidak jalan / `NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD` salah | Cek launcher `page.tsx` redirect admin; cek env URL admin di portal prod |
| Auto-redirect ke admin-dashboard tapi lalu balik ke portal | admin-dashboard tak mengenali sesi (cookie domain / JWT secret) | Pastikan cookie `.sukashawarma.com` + `SUPABASE_JWT_SECRET` di admin-dashboard |
| `/dashboard/staff` kosong / error embed | `staff_outlets` FK drift (PGRST200) atau embed ambigu (PGRST201) | Lihat memory "Admin-Dashboard Deploy Chain"; perbaiki FK / disambiguasi embed |
| create-staff / delete-staff gagal | Edge Function env (service role) atau RLS | Cek log Edge Function; service role key terpasang |
| Threshold tersimpan tapi monitoring tak berubah | View monitoring mengabaikan `outlet_reorder_point` | Lihat memory "Monitoring Views Threshold & ORP Drift" (migration 20260617120000) |
| Akun admin tak bisa buka app tertentu | `status ≠ active` atau role tersimpan bukan `admin` | Cek `outlet_staff.role/status` |

## Hasil
| Tester | Tanggal | Status (✅/❌/⚠️) | Catatan |
|--------|---------|------|---------|
| | | | |
