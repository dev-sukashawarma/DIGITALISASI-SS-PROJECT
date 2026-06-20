# Checklist Tes Manual Detail — Fungsional per Role

Pelengkap [QA-CHECKLIST-ROLE.md](QA-CHECKLIST-ROLE.md) (yang menguji **akses**).
Dokumen ini menguji **fungsi tiap role di dalam app sesuai jobdesk**
(`docs/ROLE-JOBDESK.md`), memakai route nyata tiap app.

**Aturan:**
- Tes di subdomain deploy, jendela incognito per role.
- Sebagian besar happy-path **read** aman. Langkah yang **menulis data**
  ditandai ⚠️ **(ubah data)** — lakukan hanya di akun/outlet test, atau lewati
  bila lingkungan = produksi nyata.
- Centang `[ ]` tiap langkah; tulis hasil tak sesuai di "Catatan temuan".

> Route ditulis relatif terhadap URL app (lihat tabel URL di QA-CHECKLIST-ROLE.md).

---

## 1. `admin` — IT/Sistem + HR/Personalia

### Admin Dashboard (`admin.sukashawarma.com`)
- [ ] `/dashboard` → ringkasan tampil tanpa error.
- [ ] `/dashboard/outlets` → daftar 19 outlet tampil; filter & tabel jalan.
- [ ] `/dashboard/outlets` → buka dialog **tambah/edit outlet** (form muncul). ⚠️ (ubah data) tambah outlet uji coba lalu hapus.
- [ ] `/dashboard/staff` → daftar staff lintas outlet tampil.
- [ ] `/dashboard/staff` → buka form **tambah staff** (create-staff). ⚠️ (ubah data) opsional buat akun uji lalu nonaktifkan/hapus.

### HR — Absensi (`absensi.sukashawarma.com`)
- [ ] `/dashboard/rekap` → rekap absensi **lintas semua outlet** tampil (bukan 1 outlet).
- [ ] `/dashboard/manajemen-kru` → daftar kru lintas outlet bisa dibuka.
- [ ] `/dashboard/pengaturan` → konfigurasi (mis. threshold/aturan) bisa diakses.
- [ ] `/dashboard/enroll` → halaman enroll wajah dapat dibuka.

### Sistem — Stok (`stok.sukashawarma.com`)
- [ ] `/stok/settings/threshold` → atur threshold stok per outlet (form muncul).
- [ ] `/stok/monitoring-live` → papan semua outlet tampil.

### POS Admin (`pos.sukashawarma.com`)
- [ ] `/admin/menu` → kelola menu/produk dapat dibuka.
- [ ] `/admin/users` → kelola user POS dapat dibuka.
- [ ] `/admin/outlets` → kelola outlet POS dapat dibuka.
- [ ] `/admin/settings` → pengaturan global dapat dibuka.
- [ ] generate **kiosk QR** (menu kasir → generate-kiosk-qr) menghasilkan QR.

**Catatan temuan:**
> _(...)_

---

## 2. `owner` — Pemilik (read-only)

### Owner Dashboard (`owner.sukashawarma.com`)
- [ ] `/dashboard` → omzet/penjualan agregat lintas outlet tampil.
- [ ] `/dashboard/profit` → laporan laba tampil.
- [ ] `/dashboard/expenses` → laporan pengeluaran tampil.
- [ ] **Read-only:** tidak ada tombol edit/hapus/simpan data operasional; kalaupun ada, aksi tertolak.
- [ ] Coba buka URL app lain (stok/absensi/pos) → **ditolak** (lihat checklist akses).

**Catatan temuan:**
> _(...)_

---

## 3. `spv` — Supervisor lintas outlet (read-heavy)

### Absensi
- [ ] `/dashboard/rekap` → rekap absensi crew **semua outlet** tampil.
- [ ] `/dashboard/papan-kehadiran` → papan kehadiran lintas outlet tampil.
- [ ] `/dashboard/checklist-monitor` → monitoring checklist outlet tampil.

### Stok
- [ ] `/stok/monitoring-live` → papan **semua 19 outlet** tampil (bukan 1 outlet).
- [ ] `/stok/monitoring` → ringkasan stok lintas outlet tampil.
- [ ] `/stok/ledger` → riwayat pergerakan stok lintas outlet dapat dilihat.
- [ ] `/stok/monitoring-live/[outlet-id]` → drill-down detail per outlet jalan.

### Distribusi
- [ ] `/distribusi/riwayat` → riwayat surat jalan/kiriman antar outlet tampil.
- [ ] `/distribusi/pengiriman` → status pengiriman dapat dipantau.

### Batasan
- [ ] Tidak ada entry transaksi kasir (POS tidak muncul/ditolak).
- [ ] Tidak bisa kelola akun/threshold (fitur admin tidak tersedia).

**Catatan temuan:**
> _(...)_

---

## 4. `kepala_outlet` — Leader Outlet (outlet binaan)

> Pastikan akun punya ≥1 outlet di `staff_outlets`.

### Stok (outlet binaan)
- [ ] `/stok/monitoring` → hanya data **outlet binaan** yang tampil (bukan semua).
- [ ] `/stok/opname/new` → form **stock opname** muncul. ⚠️ (ubah data) isi opname uji bila di outlet test.
- [ ] `/stok/ledger/new` → input pergerakan stok (pemakaian/waste) muncul. ⚠️ (ubah data)
- [ ] `/stok/permintaan` → buat permintaan bahan baku. ⚠️ (ubah data)

### Distribusi
- [ ] `/distribusi/terima` → daftar kiriman masuk untuk outlet binaan tampil.
- [ ] `/distribusi/terima/scan` → scan/terima surat jalan. ⚠️ (ubah data) verifikasi kiriman uji.

### Absensi
- [ ] `/dashboard/rekap` → rekap crew **outlet binaan saja**.
- [ ] `/dashboard/papan-kehadiran` → kehadiran crew outlet binaan.

### POS Kasir
- [ ] `/kasir/menu` → bisa buka kasir (cover kasir / pengawasan rekap).
- [ ] tutup shift / lihat rekap kasir dapat diakses.

### Batasan
- [ ] Data **outlet lain (non-binaan)** tidak muncul / tidak bisa dibuka.
- [ ] Owner-dashboard & admin-dashboard **ditolak**.

**Catatan temuan:**
> _(...)_

---

## 5. `kasir` — Kasir (1 outlet)

### POS Kasir
- [ ] `/kasir/menu` → daftar menu outlet tampil; bisa tambah item ke keranjang.
- [ ] **Buka shift** → shift kasir bisa dibuka. ⚠️ (ubah data)
- [ ] `/checkout` → proses transaksi/checkout (tunai/QRIS) berjalan. ⚠️ (ubah data) — pakai transaksi uji.
- [ ] `/kasir/histori` → riwayat transaksi outlet sendiri tampil.
- [ ] **Tutup shift** → tutup shift + rekap. ⚠️ (ubah data)

### Absensi
- [ ] Clock in/out **diri sendiri** berhasil. ⚠️ (ubah data)

### Batasan
- [ ] Tidak bisa ubah harga/menu (route `/admin/*` ditolak).
- [ ] Stok & distribusi **ditolak**.
- [ ] Data outlet lain tidak terlihat.

**Catatan temuan:**
> _(...)_

---

## 6. `crew` — Kru produksi (akses paling sempit)

### Absensi
- [ ] Buka absensi → diarahkan ke fungsi presensi diri (bukan dashboard admin).
- [ ] **Clock in** dengan **verifikasi wajah** berhasil. ⚠️ (ubah data)
- [ ] **Clock out** berhasil. ⚠️ (ubah data)
- [ ] `/dashboard/profil` → lihat profil/diri sendiri.
- [ ] `/dashboard/kru-checklist` (bila ada) → checklist tugas crew dapat diisi. ⚠️ (ubah data)

### Batasan
- [ ] Tidak bisa lihat rekap/absensi crew lain.
- [ ] pos-kasir, stok, distribusi, owner, admin → **semua ditolak**.

**Catatan temuan:**
> _(...)_

---

## 7. `kiosk` — Device (QR / mode kiosk)

> Bukan login portal manusia. Login lewat QR device di pos-kasir.

### Negatif
- [ ] Login kredensial kiosk di **Portal** → **ditolak** (tidak masuk launcher SSO).

### Positif (lewat device/QR)
- [ ] `/kiosk/qr-login` → scan QR device → masuk **mode kiosk**.
- [ ] Tampilan **terbatas mode kiosk** (hanya pesan/antrian), bukan POS kasir penuh.
- [ ] Sesi terikat ke `outlet_id` device yang benar (menu/produk sesuai outlet).
- [ ] **Kiosk logout** (`/api/kiosk/logout`) mengakhiri sesi device.
- [ ] Dari kiosk **tidak bisa** membuka absensi/stok/distribusi/owner/admin.

**Catatan temuan:**
> _(...)_

---

## Ringkasan hasil fungsional

| Role | Fungsi inti jalan | Batasan ditegakkan | Tester | Tanggal | Status |
|------|:---:|:---:|--------|---------|:------:|
| admin | | | | | |
| owner | | | | | |
| spv | | | | | |
| kepala_outlet | | | | | |
| kasir | | | | | |
| crew | | | | | |
| kiosk | | | | | |

Status: ✅ Pass / ❌ Fail / ⚠️ Sebagian
