# CONTEXT — Glossary Domain: Sukashawarma Outlet Suite

> Glossary kanonik. Bukan spec, bukan scratchpad. Hanya istilah & maknanya.
> Sumber keputusan: lihat `docs/adr/`.

## Identitas & Orang

- **Outlet Staff** — pegawai/akun yang beraksi di lingkup outlet (≠ HQ Employee). **Identitas kanonik & SATU-SATUNYA tabel user** untuk seluruh suite (absensi, POS kasir, stok, dan sistem lain yang akan diintegrasikan); semua aksi (absen, transaksi POS, stok, terima kiriman) ber-aktor Outlet Staff. `id` = `auth.users.id`. Role: `crew | kasir | spv | kepala_outlet | admin | kiosk`. `outlet_id` nullable (khusus `admin` global). Sejak unifikasi (`20260613000100`), tabel `profiles` POS dilebur ke sini — lihat ADR-0007. (lihat ADR-001)
- **HQ Employee** — karyawan pusat (domain SS-WEBAPP existing). **Di luar scope** suite ini.
- **SPV / Kepala Outlet** — role Outlet Staff dengan wewenang enroll wajah, approve, dan supervisi outlet.
- **Admin** — role global POS (tanpa outlet, `outlet_id` NULL): kelola user, menu, outlet, laporan lintas-cabang.
- **Kiosk** — "user" yang mewakili satu device self-order pelanggan di sebuah outlet (bukan orang). Login via QR oleh kasir.
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
- **Surat Jalan / Shipment (DO)** — dokumen + kejadian pengiriman batch bahan baku dari Gudang Pusat ke satu outlet (daftar item + qty dikirim). Dibuat di pusat.
- **Verifikasi Penerimaan (Goods Receipt)** — outlet mengonfirmasi **qty diterima** vs **qty dikirim**; selisih/kerusakan dicatat. **Qty terverifikasi → stok masuk** di ledger outlet (titik integrasi distribusi ↔ stok).
- **Discrepancy** — selisih antara qty dikirim dan qty diterima, ditandai untuk investigasi.

## Analitik

- **Reporting Hub** — Supabase (project Outlet Suite) sebagai sumber agregasi untuk Owner Dashboard (materialized views + pg_cron). Sales disinkron dari Ecosystem, bukan live cross-DB query. (lihat ADR-002, ADR-004)
- **COGS** — Cost of Goods Sold; biaya bahan baku terpakai, dihitung dari ledger stok.

## Sistem & Hosting

- **Ecosystem (project produksi)** — Supabase project existing dipakai TiktokGo + POS SS lama. Master `outlets`. **Read-only** dari sisi suite baru.
- **shawarma-kiosk** (`apps/pos-kasir`) — POS/self-service (Next.js+Supabase, multi-outlet, kasir+payment+reports). **Sejak migration `20260612000001_merge_pos_schema.sql`, schema-nya digabung ke Outlet Suite DB** (`khpkoreaaucvyqfhynfq`, sama dengan `apps/absensi`) — bukan lagi project terpisah/read-only. **Sejak unifikasi `20260613000100`, tabel `profiles` di-DROP** dan identitas user POS dipindah ke `outlet_staff` (role `admin|kasir|kiosk` ikut ditambahkan ke sana). Satu tabel user untuk semua sistem. Lihat ADR-0007.
- **Outlet Suite (project baru)** — Supabase project di **akun/org berbeda** untuk modul baru (M0–M4). (lihat ADR-004)
- **Hosting app** — server **cPanel CloudLinux shared** (penyedia lokal), file **statis** (Next.js static export), subdomain per modul. Postgres bawaan cPanel tidak dipakai. (lihat ADR-005)

## Operasional Harian Outlet & Gate Kasir

- **Status Operasional Outlet** — status harian per outlet, dihitung real-time dari tabel `attendance` (bukan kolom tersimpan, lewat RPC `get_outlet_day_status`): `belum_mulai` (belum ada kru absen hadir hari ini), `buka` (ada kru dengan status hadir terakhir = masuk), `tutup` (semua kru yang pernah hadir hari ini sudah absen pulang). Record `status='alpha'` diabaikan (lihat fix di `20260612000300_fix_get_outlet_presence_alpha.sql`).
- **Checklist Buka Toko / Tutup Toko** — kategori `checklist_categories` dengan `phase='buka'` atau `phase='tutup'`. **"Beres"** = 100% item (termasuk yang tidak wajib) pada fase tersebut sudah tercentang di `daily_checklist_ticks` untuk record hari ini.
- **Dashboard Kasir Gate** — lapisan blocking di `apps/pos-kasir` (`GlobalBlockerMount`) yang mengontrol akses role `kasir` ke `/kasir`. Urutan: (1) Status Operasional = `buka` → (2) Checklist Buka Toko beres → dashboard kasir terbuka. Begitu Status Operasional menjadi `tutup` (semua kru absen pulang), dashboard terkunci lagi. Self-order kiosk pelanggan (role `kiosk`) tidak terpengaruh gate ini.
