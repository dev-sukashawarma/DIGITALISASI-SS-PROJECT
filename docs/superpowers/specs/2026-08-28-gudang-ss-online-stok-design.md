# Spesifikasi Desain: Entitas Gudang SS Online & Manajemen Stok SSO

**Status:** Validated — Brainstorming Complete
**Tanggal:** 2026-08-28
**Scope:** `supabase` (DB migration & trigger BOM), `apps/stok` (UI switcher & RLS/access), `apps/admin-dashboard` (reporting)

---

## 1. Latar Belakang & Tujuan

Bisnis Suka Shawarma menjalankan penjualan marketplace nasional (**SS Online** / TikTok Shop & Shopee) yang pengirimannya dilakukan langsung dari gudang/pusat. 
Sebelumnya:
* Outlet virtual marketplace (`TikTok Shop` & `Shopee`) tidak memiliki baris `stok_balance` (saldo 0).
* Semua stok tersimpan campur di `GUDANG PUSAT (HQ)`.

**Tujuan:**
Membuat entitas gudang khusus **`GUDANG SS ONLINE`** yang terpisah dari `GUDANG PUSAT (HQ)` dan outlet dapur fisik. Stok fisik SSO dikelola penuh oleh staf gudang (role `kitchen`), diisi lewat mutasi resmi dari Gudang Pusat, dan otomatis berkurang via BOM saat pesanan marketplace selesai/di-sync.

---

## 2. Understanding Summary & Key Decisions

1. **Entitas Gudang Khusus:** Dibuat 1 entitas outlet baru berjenis gudang: `GUDANG SS ONLINE` (`type = 'gudang'`).
2. **Pengelolaan Role Kitchen:** Staf gudang (role `kitchen`) dapat mengelola 2 gudang (`GUDANG PUSAT (HQ)` dan `GUDANG SS ONLINE`) via selector/switcher di aplikasi stok (`apps/stok`).
3. **Alur Masuk (Inbound):** Pengisian stok awal & berkala ke `GUDANG SS ONLINE` dilakukan melalui transfer/mutasi resmi (`mutasi_antar_outlet`) dari `GUDANG PUSAT (HQ)`.
4. **Alur Keluar (Outbound / BOM):** Setiap transaksi penjualan marketplace (`TikTok Shop` dan `Shopee`) memotong saldo bahan baku otomatis di `GUDANG SS ONLINE` sesuai resep BOM.
5. **Isolasi Cabang Fisik:** Stok 19 cabang dapur fisik tidak terpengaruh oleh transaksi online.

---

## 3. Decision Log

| # | Keputusan | Alternatif Dipertimbangkan | Alasan Pemilihan |
|---|---|---|---|
| 1 | Membuat 1 entitas gudang baru (`GUDANG SS ONLINE`) | Stok dicatat per-marketplace channel / sub-lokasi virtual | Reusable dengan seluruh infrastruktur `stok_balance`, `stok_opname`, dan `mutasi_antar_outlet` tanpa modifikasi skema tabel |
| 2 | Pengurangan stok via BOM otomatis diarahkan ke `GUDANG SS ONLINE` | Pengurangan manual per batch / per opname | Otomatisasi konsumsi bahan baku per order marketplace real-time |
| 3 | Pengisian stok via Mutasi Stok (HQ → SSO) | Pengadaan langsung / input saldo tanpa alur | Menjaga rekam jejak audit (surat jalan & mutasi log) dari pasokan pusat ke alokasi online |
| 4 | Switcher Outlet di Header `apps/stok` untuk role `kitchen` | Halaman menu terpisah / dashboard khusus | Konsistensi UX navigasi multi-outlet yang sudah familiar |

---

## 5. Desain Teknis & Arsitektur Data

### 5.1 Database & Entitas
1. **Tabel `outlets`:**
   * Tambah 1 baris:
     * `id`: UUID (e.g. `d23e11b3-23f1-4f9a-b428-cc73e1aa9b91`)
     * `name`: `"GUDANG SS ONLINE"`
     * `slug`: `"gudang-ss-online"`
     * `type`: `'gudang'`
     * `is_active`: `true`
     * `is_bom_enabled`: `true`
2. **Tabel `stok_balance`:**
   * Inisialisasi baris `stok_balance` untuk `GUDANG SS ONLINE` untuk seluruh `bahan_baku` aktif.
3. **Keamanan & RLS (`accessible_outlet_ids`):**
   * Role `kitchen`, `admin`, `spv`, `owner` diizinkan membaca & menulis data `GUDANG SS ONLINE`.

### 5.2 Alur Mutasi Masuk (Inbound)
* **Asal:** `GUDANG PUSAT (HQ)`
* **Tujuan:** `GUDANG SS ONLINE`
* Menggunakan tabel `mutasi_antar_outlet` & `mutasi_antar_outlet_item`.
* Approval mutasi memotong `stok_balance` HQ dan menambah `stok_balance` SSO secara atomik.

### 5.3 Alur Pengurangan Pesanan (BOM Routing)
* Ketika pesanan `orders` di-insert / diupdate dengan channel marketplace (`tiktok_shop` / `shopee_shop` / `outlet_id` marketplace):
  * Trigger/fungsi BOM mendeteksi asal pesanan online.
  * Target pengurangan `stok_balance` dialihkan ke `GUDANG SS ONLINE`.
  * Item bahan baku terpotong sesuai resep menu/BOM.

### 5.4 Aplikasi Stok (`apps/stok`)
* **Header / Switcher:** Staf kitchen dapat berpindah context antara `GUDANG PUSAT (HQ)` dan `GUDANG SS ONLINE`.
* **Halaman Aktif:**
  * Monitoring / Live Monitoring: Menampilkan stok real-time Gudang SSO.
  * Opname: Pencatatan stok fisik berkala khusus Gudang SSO.
  * Mutasi: Dukungan transfer internal HQ ↔ SSO.

---

## 6. Rencana Verifikasi

1. **DB Testing:**
   * Verifikasi entitas `GUDANG SS ONLINE` terbuat di tabel `outlets`.
   * Verifikasi saldo `stok_balance` terinisialisasi.
   * Verifikasi akses RPC `accessible_outlet_ids` untuk role `kitchen`.
2. **Mutasi Testing:**
   * Jalankan transfer stok dari HQ ke SSO dan pastikan saldo berpindah dengan benar.
3. **BOM Routing Testing:**
   * Simulasikan order marketplace dan pastikan saldo yang terpotong adalah saldo di `GUDANG SS ONLINE`.
4. **UI Verification:**
   * Pastikan staf kitchen dapat memilih `GUDANG SS ONLINE` di aplikasi stok.
