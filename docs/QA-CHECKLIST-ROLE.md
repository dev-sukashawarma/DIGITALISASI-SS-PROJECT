# Checklist Tes Manual — Akses per Role

**Tujuan:** verifikasi manual bahwa tiap role hanya bisa mengakses aplikasi sesuai
matriks akses. Dijalankan tester lewat browser, **read-only** (hanya login +
navigasi, jangan ubah data operasional).

**Sumber kebenaran:** `docs/ROLE-JOBDESK.md` (§ Matriks Akses) + `ROLE_APP_ACCESS`
di `packages/auth/src/access.ts`. Kalau hasil tes beda dari matriks → itu temuan bug.

> **Lingkungan:** jalankan di subdomain produksi/staging (`*.sukashawarma.com`),
> **bukan `localhost`** — guard `owner-dashboard` di-skip saat localhost.

---

## Persiapan

### Akun test (isi sebelum mulai)

| Role | Email / Username | Outlet | Catatan |
|------|------------------|--------|---------|
| admin | | (semua) | |
| owner | | (semua) | |
| spv | | (semua) | |
| kepala_outlet | | (binaan, ≥1) | pastikan punya baris `staff_outlets` |
| kasir | | 1 outlet | |
| crew | | 1 outlet | |
| kiosk | | 1 outlet | login via QR device, bukan portal |

### URL aplikasi

| App | URL |
|-----|-----|
| Portal | https://app.sukashawarma.com |
| Admin Dashboard | https://admin.sukashawarma.com |
| Stok | https://stok.sukashawarma.com |
| Absensi | https://absensi.sukashawarma.com |
| Distribusi | https://distribusi.sukashawarma.com |
| POS Kasir | https://pos.sukashawarma.com |
| Owner Dashboard | https://owner.sukashawarma.com |

### Aturan main

- Pakai **jendela incognito baru** untuk tiap role (sesi tidak bercampur).
- "Diizinkan" = halaman app terbuka, tidak dilempar balik ke portal.
- "Ditolak" = otomatis di-redirect ke portal (halaman login/launcher).
- Sebelum ganti role: **Keluar/Logout** atau tutup incognito.

### Matriks acuan

| Role | pos-kasir | absensi | stok | distribusi | owner-dash | admin-dash |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (auto) |
| owner | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| spv | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| kepala_outlet | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| kasir | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| crew | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| kiosk | ✅ (kiosk) | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 1. Role: `admin`

**Login**
- [ ] Buka Portal → login dengan email admin (gunakan email lengkap).
- [ ] **Diharapkan:** TIDAK berhenti di launcher — langsung **auto-redirect ke Admin Dashboard**.

**Akses app** (buka tiap URL di tab sama setelah login)
- [ ] Admin Dashboard → **diizinkan**
- [ ] POS Kasir → **diizinkan**
- [ ] Absensi → **diizinkan**
- [ ] Stok → **diizinkan**
- [ ] Distribusi → **diizinkan**
- [ ] Owner Dashboard → **diizinkan**

---

## 2. Role: `owner`

**Login & launcher**
- [ ] Login portal → masuk launcher.
- [ ] Launcher **hanya** menampilkan: **Owner Dashboard**.
- [ ] Tidak ada kartu: pos-kasir, absensi, stok, distribusi, admin.

**Akses app**
- [ ] Owner Dashboard → **diizinkan**
- [ ] Admin Dashboard → **ditolak** (redirect portal)
- [ ] POS Kasir → **ditolak**
- [ ] Absensi → **ditolak**
- [ ] Stok → **ditolak**
- [ ] Distribusi → **ditolak**

---

## 3. Role: `spv`

**Login & launcher**
- [ ] Login portal → masuk launcher.
- [ ] Launcher menampilkan: **Absensi, Stok, Distribusi**.
- [ ] Tidak ada kartu: pos-kasir, owner-dashboard, admin.

**Akses app**
- [ ] Absensi → **diizinkan** (data semua outlet)
- [ ] Stok → **diizinkan** (monitoring lintas outlet)
- [ ] Distribusi → **diizinkan**
- [ ] POS Kasir → **ditolak**
- [ ] Owner Dashboard → **ditolak**
- [ ] Admin Dashboard → **ditolak**

---

## 4. Role: `kepala_outlet`

> Pastikan akun punya pemetaan `staff_outlets` (≥1 outlet binaan).

**Login & launcher**
- [ ] Login portal → masuk launcher.
- [ ] Launcher menampilkan: **POS Kasir, Absensi, Stok, Distribusi**.
- [ ] Tidak ada kartu: owner-dashboard, admin.

**Akses app**
- [ ] POS Kasir → **diizinkan**
- [ ] Absensi → **diizinkan**
- [ ] Stok → **diizinkan**
- [ ] Distribusi → **diizinkan**
- [ ] Owner Dashboard → **ditolak**
- [ ] Admin Dashboard → **ditolak**
- [ ] (Scope) Saat di Stok/Absensi, data yang tampil **hanya outlet binaan**, bukan semua outlet.

---

## 5. Role: `kasir`

**Login & launcher**
- [ ] Login portal → masuk launcher.
- [ ] Launcher menampilkan: **POS Kasir, Absensi**.
- [ ] Tidak ada kartu: stok, distribusi, owner-dashboard, admin.

**Akses app**
- [ ] POS Kasir → **diizinkan**
- [ ] Absensi → **diizinkan** (clock in/out diri sendiri)
- [ ] Stok → **ditolak**
- [ ] Distribusi → **ditolak**
- [ ] Owner Dashboard → **ditolak**
- [ ] Admin Dashboard → **ditolak**

---

## 6. Role: `crew`

**Login & launcher**
- [ ] Login portal → masuk launcher.
- [ ] Launcher **hanya** menampilkan: **Absensi**.
- [ ] Tidak ada kartu lain.

**Akses app**
- [ ] Absensi → **diizinkan** (clock in/out)
- [ ] POS Kasir → **ditolak**
- [ ] Stok → **ditolak**
- [ ] Distribusi → **ditolak**
- [ ] Owner Dashboard → **ditolak**
- [ ] Admin Dashboard → **ditolak**

---

## 7. Role: `kiosk` (device / QR)

> Kiosk **bukan** login portal manusia. Login lewat QR device di pos-kasir.

**Negatif — tidak boleh masuk SSO manusia**
- [ ] Coba login kredensial kiosk di **Portal** → **ditolak** (tidak masuk launcher).

**Positif — mode kiosk (lewat device/QR)**
- [ ] Buka pos-kasir alur `qr-login` di device kiosk → masuk **mode kiosk** (tampilan terbatas).
- [ ] Sesi terikat ke `outlet_id` device yang benar.
- [ ] Tidak bisa membuka app lain (absensi/stok/distribusi/owner/admin) dari device kiosk.

---

## Catatan kendala yang diketahui

- **pos-kasir tidak punya middleware guard SSO portal** (alur kiosk QR). Untuk role
  yang seharusnya **ditolak** dari pos-kasir (owner, spv, crew), penolakan mungkin
  **tidak** muncul sebagai redirect otomatis. Verifikasi via: kartu pos-kasir tidak
  muncul di launcher role tsb + (kalau URL dibuka langsung) tidak ada fungsi kasir
  yang bisa dipakai. Catat sebagai temuan jika ternyata role bisa transaksi.
- **owner-dashboard skip enforcement di `localhost`** — wajib tes di subdomain deploy.
- Kalau hasil aktual berbeda dari matriks acuan di atas → **laporkan sebagai bug**
  (cocokkan dengan `ROLE_APP_ACCESS`).

---

## Ringkasan hasil

| Role | Login | Launcher benar | Guard app benar | Tester | Tanggal | Status |
|------|:---:|:---:|:---:|--------|---------|:------:|
| admin | | | | | | |
| owner | | | | | | |
| spv | | | | | | |
| kepala_outlet | | | | | | |
| kasir | | | | | | |
| crew | | | | | | |
| kiosk | | | | | | |

Status: ✅ Pass / ❌ Fail / ⚠️ Sebagian
