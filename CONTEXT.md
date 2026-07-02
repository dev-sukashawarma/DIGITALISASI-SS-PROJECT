# CONTEXT — Glossary Domain: Sukashawarma Outlet Suite

> Glossary kanonik. Bukan spec, bukan scratchpad. Hanya istilah & maknanya.
> Sumber keputusan: lihat `docs/adr/`.

## Identitas & Orang

- **Outlet Staff** — pegawai/akun yang beraksi di lingkup outlet (≠ HQ Employee). **Identitas kanonik & SATU-SATUNYA tabel user** untuk seluruh suite (absensi, POS kasir, stok, dan sistem lain yang akan diintegrasikan); semua aksi (absen, transaksi POS, stok, terima kiriman) ber-aktor Outlet Staff. `id` = `auth.users.id`. Role: `crew | kasir | spv | leader | admin | kiosk`. `outlet_id` nullable (khusus `admin` global). Sejak unifikasi (`20260613000100`), tabel `profiles` POS dilebur ke sini — lihat ADR-0007. (lihat ADR-001)
- **HQ Employee** — karyawan pusat (domain SS-WEBAPP existing). **Di luar scope** suite ini.
- **SPV / Leader Outlet** — role Outlet Staff dengan wewenang enroll wajah, approve, dan supervisi outlet.
- **Admin** — role global POS (tanpa outlet, `outlet_id` NULL): kelola user, menu, outlet, laporan lintas-cabang.
- **Kiosk** — "user" yang mewakili satu device self-order pelanggan di sebuah outlet (bukan orang). Login via QR oleh kasir. **Pengecualian SSO**: device kiosk TIDAK login lewat Portal; diaktifkan kasir via scan QR lokal di `apps/pos-kasir` (`/kiosk/qr-login`). (lihat ADR-008)
- **Pseudo-Email** — identitas login untuk Outlet Staff tanpa email asli (mis. kasir): username `kasir_sudirman` dipetakan ke `kasir_sudirman@outlet.local` sebelum `signInWithPassword`. Normalisasi terpusat di `@suka/auth` (`normalizeLoginIdentifier`) agar Portal & app konsisten.
- **Status Akun** — `is_active` (boolean) + `inactive_reason` menggate akses (dipakai blocker POS). Kolom lama `status` (`active|inactive|on_leave`) tetap untuk konteks absensi; `is_active` diselaraskan dengannya saat unifikasi.

## Bahan Baku & Stok

- **Bahan Baku (Raw Material)** — barang mentah/consumable outlet (daging, tortilla, saus, kemasan, gas). Punya satuan (kg/pcs/liter) & reorder point per outlet.
- **Inventarisasi / Stock Opname** — aktivitas **menghitung & mencatat** stok fisik bahan baku pada waktu tertentu. Output: stok aktual.
- **Manajemen Stok** — operasi **transaksional** yang mengubah stok (masuk/keluar/waste/adjust) = ledger pergerakan.
- **Monitoring Bahan Baku** — lapisan **baca/alert** di atas stok: level realtime semua outlet, alert < reorder point, deteksi waste tinggi.
- **Reorder Point** — ambang stok minimum yang memicu alert untuk pesan ulang.
- **BOM (Bill of Materials) / Resep** — komposisi bahan baku per 1 porsi menu (mis. 1 shawarma = 80g daging + 1 tortilla + 30ml saus). Dipakai untuk auto-deduction **fase lanjut**.

> Catatan: Inventarisasi, Manajemen Stok, dan Monitoring adalah **3 muka dari satu domain Stok Bahan Baku**, bukan 3 sistem terpisah.

## Distribusi

- **Gudang Pusat (Central Warehouse)** — **satu** titik asal distribusi bahan baku ke 19 outlet.
- **Permintaan Bahan** — pesanan bahan baku yang **diinisiasi outlet** ke pusat (`permintaan_bahan`); outlet minta → kitchen setujui → terbit Surat Jalan. Ini "pesanan per outlet".
- **Kode Permintaan** — kode unik per Permintaan Bahan, format **`PB/{OUTLET}/{YYYYMMDD}/{urut}`** (outlet dari `slug`, `urut` reset harian per outlet — praktis selalu `001` karena kirim ke outlet umumnya 1× sehari; `urut` = jaring untuk kirim susulan langka). Dijamin unik via UNIQUE constraint (bukan counter table — cadence harian membuat race tak relevan).
- **Order Session** — satu kejadian pemesanan bahan baku = **satu Surat Jalan**. Saat Surat Jalan dibuat, **harga bahan baku terkini di-snapshot** ke tiap itemnya (harga "hari itu"). Nilai barang masuk untuk HPP = `qty terverifikasi × harga snapshot`. Snapshot ini yang membuat HPP historis stabil: order Senin memakai harga Senin, reorder Rabu memakai harga Rabu, walau harga master berubah.
- **Surat Jalan / Shipment (DO)** — dokumen + kejadian pengiriman batch bahan baku dari Gudang Pusat ke satu outlet (daftar item + qty dikirim). Dibuat di pusat.
- **Verifikasi Penerimaan (Goods Receipt)** — outlet mengonfirmasi **qty diterima** vs **qty dikirim**; selisih/kerusakan dicatat. **Qty terverifikasi → stok masuk** di ledger outlet (titik integrasi distribusi ↔ stok).
- **Discrepancy** — selisih antara qty dikirim dan qty diterima, ditandai untuk investigasi.

## Analitik

- **Reporting Hub** — Supabase (project Outlet Suite) sebagai sumber agregasi untuk Owner Dashboard (materialized views + pg_cron). Sales disinkron dari Ecosystem, bukan live cross-DB query. (lihat ADR-002, ADR-004)
- **Sumber Omzet (Revenue Source)** — kanal pemasukan outlet. Kanonik ada **3**:
  1. **POS Outlet** — pelanggan datang langsung ke outlet, transaksi via POS baru (`apps/pos-kasir`). Data native di Outlet Suite `orders` begitu pos-kasir live. **Belum ada data** selama pos-kasir in-development.
  2. **Order Online** — penjualan online (sebelumnya "TiktokGo SS"). Tinggal di **Ecosystem** (`orders`). **Satu-satunya sumber yang LIVE saat ini.** Istilah kanonik = **Order Online** (jangan pakai "TiktokGo" lagi di konteks owner-dashboard).
  3. **Manual Food Apps** — omzet dari aplikasi food delivery (**ShopeeFood, TikTok, GrabFood, GoFood**) yang **diinput manual** (tidak ada integrasi API). Masing-masing app dilacak terpisah sebagai sub-kanal.
  > POS SS legacy (POS lama di Ecosystem) sudah **dibuang dari scope** — bukan sumber omzet.
- **Omzet Diakui (Recognized Revenue)** — nilai penjualan yang dihitung sebagai omzet di Owner Dashboard = order ber-status **`completed`** (item sudah diterima customer / order tuntas). Status `pending`/`preparing`/`ready` = masih jalan (tidak dihitung), `cancelled` = batal (tidak dihitung). Berlaku seragam untuk ketiga Sumber Omzet. Untuk Order Online yang di-sync dari Ecosystem, status sumber dipetakan ke enum hub saat sync.
- **COGS / HPP** — Cost of Goods Sold (Harga Pokok Penjualan); biaya bahan baku **terjual/terpakai**. Metode kanonik saat ini = **opname periodik harian per outlet**: `HPP_hari = nilai(stok awal hari) + nilai(barang masuk hari) − nilai(stok akhir hari)`, dengan `stok awal hari = stok akhir hari sebelumnya`. Stok fisik dari Stock Opname (**harian**), barang masuk dari Surat Jalan terverifikasi, harga dari Harga Bahan Baku. **Stok akhir dinilai pada harga snapshot Surat Jalan terbaru per bahan (metode "harga terakhir" — lihat ADR-011).** HPP harian di-roll-up ke mingguan/bulanan di Owner Dashboard. Auto-deduction berbasis BOM per penjualan = **target akhir (fase lanjut)**, belum aktif.
- **Laba / Pemasukan Bersih** — hasil **Omzet Diakui − HPP** (biaya bahan baku terjual). Berbeda dari **Pengeluaran/Expenses** (biaya operasional manual: sewa, gaji, listrik). Owner Dashboard "Profitabilitas" saat ini baru menghitung `Omzet − Expenses`; HPP belum masuk (gap yang sedang digarap).
- **Pengeluaran/Expenses** — biaya operasional manual (di luar HPP). Punya **dua scope** yang menentukan pembebanannya:
  - **Pengeluaran Outlet** — biaya yang jadi tanggung jawab operasional satu outlet (gaji crew, bonus leader/korlap, lembur, ADS, endorsement, promo, PDAM, PLN, internet, sewa outlet, pengeluaran outlet lain-lain). Ter-attribute ke satu outlet → **dibebankan ke P&L outlet itu**.
  - **Pengeluaran Pusat** — biaya level perusahaan yang **tidak** di-attribute ke outlet mana pun, **company-wide (satu nilai untuk seluruh perusahaan, bukan per-outlet)**. Kanonik ada 2 jenis: **Pengeluaran Global** & **Gaji Staff Kantor**. **Dikecualikan dari P&L per-outlet** (supaya kinerja outlet/leader dinilai adil), TAPI **tetap dihitung di P&L company-wide** (uang beneran keluar; kalau tidak, laba total perusahaan overstated).
  > Aturan pembebanan: **Laba Outlet** = Omzet outlet − HPP outlet − Pengeluaran Outlet (outlet itu saja). **Laba Perusahaan** = Σ Laba Outlet − Σ Pengeluaran Pusat.
- **Harga Bahan Baku** — harga beli per bahan. **Harga master terkini** dikelola admin (tabel `bahan_baku_harga`, admin-only). Saat sebuah order/sesi dibuat, harga terkini di-**snapshot** ke order tersebut agar HPP historis tidak berubah walau harga master berubah kemudian (lihat **Order Session**).

## Auth & Akses

- **Portal (Gerbang SSO Tunggal)** (`apps/portal`) — satu-satunya tempat Outlet Staff login. Setelah login, menampilkan **Launcher** (daftar app yang boleh diakses role-nya). Sesi disimpan sebagai cookie Supabase (`@supabase/ssr`) ber-nama default `sb-<project-ref>-auth-token`. Karena cookie host-only `localhost` dibagi lintas port, sesi Portal otomatis terbaca app lain di lokal; di prod dibagi lewat `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com`. (lihat ADR-008)
- **Matriks Akses App** — `ROLE_APP_ACCESS` di `@suka/auth` (`access.ts`) — sumber tunggal role → daftar app. `hasAppAccess(role, app)` & `accessibleApps(role)`. Ref: `docs/ROLE-JOBDESK.md`.
- **Model Gate** — penegakan akses bergantung runtime app: app **static export** (absensi, stok, distribusi — ADR-005) memakai **gate client-side** (`AuthGuard` + `@suka/auth`); app **SSR/Node** (pos-kasir, portal) memakai **middleware** (`enforceAppAccess`). Keduanya menolak ke Portal bila belum login / role tak punya akses / status bukan `active`. (lihat ADR-008)

## Sistem & Hosting

- **Ecosystem (project produksi)** — Supabase project existing; kini sumber **Order Online** (sebelumnya "TiktokGo SS"). Master `outlets`. **Read-only** dari sisi suite baru. (POS SS legacy yang dulu juga di sini sudah **dibuang dari scope** — tidak diintegrasikan ke owner-dashboard.)
- **shawarma-kiosk** (`apps/pos-kasir`) — POS/self-service (Next.js+Supabase, multi-outlet, kasir+payment+reports). **Sejak migration `20260612000001_merge_pos_schema.sql`, schema-nya digabung ke Outlet Suite DB** (`khpkoreaaucvyqfhynfq`, sama dengan `apps/absensi`) — bukan lagi project terpisah/read-only. **Sejak unifikasi `20260613000100`, tabel `profiles` di-DROP** dan identitas user POS dipindah ke `outlet_staff` (role `admin|kasir|kiosk` ikut ditambahkan ke sana). Satu tabel user untuk semua sistem. Lihat ADR-0007.
- **Outlet Suite (project baru)** — Supabase project di **akun/org berbeda** untuk modul baru (M0–M4). (lihat ADR-004)
- **Hosting app** — server **cPanel CloudLinux shared** (penyedia lokal), tiap modul = **Next.js Node server** via **CloudLinux Node Selector + Passenger** (1 subdomain = 1 Node app), bukan static export. Postgres bawaan cPanel tidak dipakai. (lihat ADR-008 yang men-supersede ADR-005)

## Operasional Harian Outlet & Gate Kasir

- **Status Operasional Outlet** — status harian per outlet, dihitung real-time dari tabel `attendance` (bukan kolom tersimpan, lewat RPC `get_outlet_day_status`): `belum_mulai` (belum ada kru absen hadir hari ini), `buka` (ada kru dengan status hadir terakhir = masuk), `tutup` (semua kru yang pernah hadir hari ini sudah absen pulang). Record `status='alpha'` diabaikan (lihat fix di `20260612000300_fix_get_outlet_presence_alpha.sql`).
- **Checklist Buka Toko / Tutup Toko** — kategori `checklist_categories` dengan `phase='buka'` atau `phase='tutup'`. **"Beres"** = 100% item (termasuk yang tidak wajib) pada fase tersebut sudah tercentang di `daily_checklist_ticks` untuk record hari ini.
- **Dashboard Kasir Gate** — lapisan blocking di `apps/pos-kasir` (`GlobalBlockerMount`) yang mengontrol akses role `kasir` ke `/kasir`. Urutan: (1) Status Operasional = `buka` → (2) Checklist Buka Toko beres → dashboard kasir terbuka. Begitu Status Operasional menjadi `tutup` (semua kru absen pulang), dashboard terkunci lagi. Self-order kiosk pelanggan (role `kiosk`) tidak terpengaruh gate ini.
