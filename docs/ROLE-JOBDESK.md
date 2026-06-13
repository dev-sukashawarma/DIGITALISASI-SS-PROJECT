# Jobdesk & Wewenang Role — Suka Shawarma Outlet Suite

**Tanggal:** 2026-06-13
**Status:** Disepakati (brainstorming login SSO per role)
**Sumber kebenaran identitas:** tabel `outlet_staff` (1 baris per user) + tabel pemetaan `staff_outlets` untuk role multi-outlet

Dokumen ini mendefinisikan **7 role** sistem, jobdesk masing-masing, hak akses per aplikasi, dan batasannya. Menjadi acuan untuk: pemberian akun, guard akses per app, RLS, dan portal launcher SSO.

> Disusun selaras dengan SOP resmi: *JOBDESK SPV* dan *SOP + JOBDESK LEADER OUTLET* Suka Shawarma.

---

## Hierarki Organisasi

```
Management / HRD        →  role: owner + admin
        ↓
SPV (lintas outlet)     →  role: spv     — mengawasi & membina semua outlet
        ↓
Leader Outlet (1 outlet)→  role: kepala_outlet — PIC operasional harian outlet
        ↓
Crew / Kasir            →  role: crew, kasir
```

Pemetaan istilah SOP → role sistem:

| Istilah SOP | Role sistem |
|-------------|------------|
| Management / HRD | `admin` (+ `owner`) |
| SPV | `spv` |
| Leader Outlet | `kepala_outlet` |
| Crew / Kasir / Kitchen | `crew`, `kasir` |

---

## Ringkasan Role

| # | Role | Singkat | Cakupan data | Tipe |
|---|------|---------|-------------|------|
| 1 | `admin` | IT/Sistem + HR/Personalia | Semua outlet (19) | Manusia (pusat) |
| 2 | `owner` | Pemilik usaha | Semua outlet, read-only | Manusia (pusat) |
| 3 | `spv` | Supervisor pembina outlet | **Semua outlet (19)**, monitoring/evaluasi | Manusia (lapangan, lintas outlet) |
| 4 | `kepala_outlet` | Leader Outlet (PIC beberapa outlet) | **Beberapa outlet (subset)** via `staff_outlets` | Manusia (outlet) |
| 5 | `kasir` | Kasir | 1 outlet | Manusia (outlet) |
| 6 | `crew` | Kru produksi/operasional | 1 outlet, data diri | Manusia (outlet) |
| 7 | `kiosk` | Device POS/antrian | 1 outlet (terikat device) | Mesin (bukan manusia) |

> **Catatan `spv`:** satu role tunggal, **berada di atas Leader Outlet** dan **mengawasi seluruh 19 outlet** (bukan 1 outlet). Sifat aksesnya monitoring/evaluasi (read-heavy) lintas outlet, memakai view definer SPV yang sudah bypass RLS. Pembagian "produksi" vs "stok" adalah divisi/penugasan, bukan beda hak akses.

---

## Matriks Akses Role → Aplikasi

| Role | pos-kasir | absensi | stok | distribusi | owner-dashboard |
|------|:---:|:---:|:---:|:---:|:---:|
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **owner** | ❌ | ❌ | ❌ | ❌ | ✅ (read-only) |
| **spv** | ❌ | ✅ semua outlet | ✅ semua outlet (monitor) | ✅ (monitor) | ⚠️ ditunda |
| **kepala_outlet** | ✅ | ✅ (outlet binaan) | ✅ (outlet binaan) | ✅ | ❌ |
| **kasir** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **crew** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **kiosk** | ✅ (kiosk mode) | ❌ | ❌ | ❌ | ❌ |

Matriks ini adalah satu-satunya sumber untuk konstanta `ROLE_APP_ACCESS` dan guard middleware tiap app.
Perbedaan **scope** (1 outlet vs lintas outlet) ditegakkan terpisah lewat RLS / view definer, bukan oleh matriks ini.

---

## Detail Jobdesk per Role

### 1. `admin` — IT/Sistem + HR/Personalia

**Posisi:** Tim pusat (IT & personalia). Super user sistem.

**Tanggung jawab:**
- **HR/Personalia:** kelola database karyawan seluruh 19 outlet (tambah, edit, nonaktifkan staff via Edge Function `create-staff`/`delete-staff`), kelola akun login & reset kredensial, pantau **absensi harian lintas semua outlet**.
- **Sistem:** konfigurasi threshold stok per outlet, pengaturan aplikasi, kelola data master (outlet, item).
- **Pengawasan menyeluruh:** akses penuh semua app & semua laporan lintas outlet.

**Boleh:**
- CRUD staff & akun (semua outlet)
- Lihat & ekspor absensi semua outlet
- Atur threshold/config, monitoring-live semua outlet
- Akses pos-kasir, absensi, stok, distribusi, owner-dashboard

**Tidak boleh / hindari:**
- Dipakai untuk transaksi operasional harian (gunakan role operasional yang sesuai) — admin disediakan untuk administrasi, bukan kasir/produksi rutin.

**Catatan keamanan:** akun admin paling sensitif. Jumlahnya dijaga minimum; bukan untuk dibagi ke staf outlet.

---

### 2. `owner` — Pemilik Usaha

**Posisi:** Pemilik / pemangku kepentingan utama.

**Tanggung jawab:**
- Memantau kesehatan bisnis: omzet, penjualan, laba, tren agregat lintas outlet.

**Boleh:**
- Akses **owner-dashboard** secara **read-only** (laporan omzet/penjualan/agregat).

**Tidak boleh:**
- Mengubah data operasional (stok, transaksi, absensi).
- Kelola akun/karyawan (itu wewenang `admin`).
- Akses pos-kasir/absensi/stok/distribusi.

**Rasional pemisahan dari admin:** owner butuh *melihat angka*, bukan *mengubah sistem*. Memisahkan owner dari admin mencegah pemilik tak sengaja mengubah konfigurasi & menjaga prinsip least-privilege.

---

### 3. `spv` — Supervisor (Pembina Outlet)

**Posisi:** Pengawas & pembina operasional **lintas outlet**, berada **di atas Leader Outlet** dan menjadi penghubung antara management dan outlet. (Ref: *JOBDESK SPV*.)

**Cakupan data:** **semua 19 outlet**, lewat view definer SPV (`monitoring_view_spv`, `ledger_feed_spv`, `stockout_forecast_spv`) yang bypass RLS. Tidak memerlukan penugasan per-outlet.

**Tanggung jawab (dari SOP):**
- Mengontrol seluruh aktivitas operasional outlet agar sesuai SOP (pembukaan, operasional berjalan, penutupan).
- Mengawasi kedisiplinan, performa, kebersihan, dan absensi crew.
- Briefing, evaluasi, training, dan pembinaan kepada Leader Outlet & crew.
- Mengontrol stok bahan baku, waste, asset; investigasi awal bila ada selisih/kehilangan.
- Memastikan laporan operasional, absensi, stok, dan administrasi outlet berjalan tepat waktu.
- Melaporkan kondisi seluruh outlet kepada management secara berkala.

**Boleh (di sistem digital):**
- **absensi:** pantau & rekap absensi crew **lintas semua outlet**.
- **stok:** monitoring-live, rekap stok/waste, lihat ledger & forecast **lintas outlet** (read-heavy; investigasi selisih).
- **distribusi:** memantau kelancaran surat jalan/kiriman antar outlet.

**Tidak boleh:**
- Akses **pos-kasir** (bukan operator transaksi — hanya mengontrol kesesuaian rekap kasir).
- Kelola akun / config sistem (wewenang `admin`).
- owner-dashboard (akses angka penjualan/omzet — **ditunda, belum diputuskan**).

**Sifat akses:** monitoring/evaluasi (mayoritas read + rekap), bukan entry data harian. Entry data dilakukan Leader Outlet.

**Divisi (penugasan, bukan role):** seorang `spv` dapat ditandai produksi atau stok pada level data/fitur; hak akses app tetap sama.

---

### 4. `kepala_outlet` — Leader Outlet (PIC Beberapa Outlet)

**Posisi:** Pemimpin & penanggung jawab operasional harian **beberapa outlet** yang ditugaskan kepadanya, role model bagi crew. Melapor kepada SPV. (Ref: *SOP + JOBDESK LEADER OUTLET*.)

**Cakupan data:** himpunan outlet yang dipetakan eksplisit lewat tabel `staff_outlets` (many-to-many `staff_id ↔ outlet_id`). Bisa 1 atau beberapa outlet. RLS membatasi akses hanya ke outlet dalam pemetaan tersebut.

**Tanggung jawab (dari SOP):**
- Persiapan sebelum buka: cek kesiapan outlet, peralatan, bahan baku, kehadiran crew, FoodApps aktif.
- Briefing crew (pembagian tugas, target, promo).
- Operasional: pengawasan crew, pelayanan customer, kebersihan, kontrol stok & gramasi.
- Penutupan: **stock opname**, catat waste, **rekap kasir sesuai transaksi**, amankan outlet.
- Membuat & mengirim laporan harian (penjualan, absensi crew, stok, waste, kendala) kepada SPV.

**Boleh (di sistem digital):**
- **stok:** kelola stok & **opname** outlet sendiri.
- **distribusi:** terima & verifikasi surat jalan/kiriman.
- **absensi:** pantau & rekap absensi crew di outletnya.
- **pos-kasir:** transaksi & tutup shift (cover kasir bila perlu, pengawasan rekap).

**Tidak boleh:**
- Akses data outlet lain.
- Kelola akun lintas outlet / config sistem (wewenang admin).
- owner-dashboard.

---

### 5. `kasir` — Kasir

**Posisi:** Operator kasir di outlet.

**Cakupan data:** 1 outlet.

**Tanggung jawab:**
- Melayani transaksi penjualan dan mengelola shift kasir.

**Boleh:**
- **pos-kasir:** checkout/transaksi, buka & tutup shift.
- **absensi:** clock in/out diri sendiri.

**Tidak boleh:**
- Akses stok/distribusi.
- Ubah harga, setting, atau data master.
- Lihat data outlet lain.

---

### 6. `crew` — Kru Produksi/Operasional

**Posisi:** Staf produksi/operasional outlet.

**Cakupan data:** 1 outlet, terutama data diri (RLS `ledger_read` membatasi ke outlet sendiri).

**Tanggung jawab:**
- Kehadiran kerja.

**Boleh:**
- **absensi:** clock in/out (dengan face recognition).

**Tidak boleh:**
- Akses pos-kasir, stok, distribusi, owner-dashboard.
- Melihat data outlet lain.

**Catatan:** role dengan akses paling sempit — disengaja agar permukaan risiko minimal.

---

### 7. `kiosk` — Device (Mesin)

**Posisi:** **Perangkat**, bukan manusia. Tablet/layar di outlet untuk mode kiosk POS / antrian.

**Cakupan data:** 1 outlet, terikat ke device.

**Karakteristik:**
- Login via **QR device-bound** (alur `qr-login` pos-kasir), bukan email/password manual.
- **Tidak masuk portal launcher SSO** dan **di-exclude dari guard role manusia**.
- Sesi panjang/persisten, terikat `outlet_id` device.

**Boleh:**
- **pos-kasir:** mode kiosk saja (tampilan terbatas).

**Tidak boleh:**
- Login manual, akses app lain, atau fungsi administrasi.

---

## Aturan Lintas-Cutting

1. **RLS per scope:**
   - `kasir`, `crew` → terikat **1 outlet** (`outlet_staff.outlet_id`).
   - `kepala_outlet` → terikat **beberapa outlet** lewat tabel `staff_outlets` (RLS cek keanggotaan, bukan kolom tunggal).
   - `spv` → **semua outlet** lewat view definer SPV (bypass RLS).
   - `admin`, `owner` → semua outlet (agregat/bypass).
2. **Least privilege:** default tolak; akses hanya yang ada di matriks. Guard middleware menolak role di luar daftar app.
3. **Satu sumber identitas:** role & outlet selalu dibaca dari `outlet_staff`. Tabel `profiles` (lama, pos-kasir) dipensiunkan/menjadi view kompatibilitas.
4. **Kiosk terpisah total:** alur device QR tidak melewati SSO manusia.

---

## Catatan / Backlog (di luar lingkup role saat ini)

- **FoodApps (GoFood / GrabFood / ShopeeFood):** muncul kuat di SOP SPV & Leader (aktivasi, off menu habis, rating, komplain online) tetapi **belum ada modul di suite digital**. Dicatat sebagai kandidat fitur, bukan bagian dari sistem role/login.
- **`spv` & owner-dashboard (lihat penjualan binaan):** ditunda, belum diputuskan.
- **Penugasan SPV per-area:** saat ini SPV = semua 19 outlet. Bila kelak SPV dibagi regional, tambahkan pemetaan `spv ↔ outlet` tanpa mengubah daftar role.

---

## Model Data Identitas & Scope

```
outlet_staff (1 baris/user)
  ├─ id            → FK auth.users
  ├─ role          → admin | owner | spv | kepala_outlet | kasir | crew | kiosk
  ├─ outlet_id     → outlet "home" (dipakai kasir/crew/kiosk; opsional utk role multi-outlet)
  └─ status        → active | inactive | on_leave

staff_outlets (many-to-many, HANYA untuk kepala_outlet)
  ├─ staff_id      → FK outlet_staff.id
  └─ outlet_id     → FK outlets.id
```

- `kasir`, `crew`, `kiosk`: scope dari `outlet_staff.outlet_id` tunggal.
- `kepala_outlet`: scope dari baris-baris `staff_outlets` miliknya (1..N outlet).
- `spv`, `admin`, `owner`: semua outlet (tidak butuh pemetaan).

## Daftar Role Final (untuk enum/constraint `outlet_staff.role`)

```
admin | owner | spv | kepala_outlet | kasir | crew | kiosk
```

---

**Owner dokumen:** Dev Suka Shawarma
**Terkait:** `docs/superpowers/specs/` (spec login SSO per role — menyusul), `CLAUDE.md` (Outlet Model & RLS)
