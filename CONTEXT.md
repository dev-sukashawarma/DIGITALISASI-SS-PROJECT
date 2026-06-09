# CONTEXT — Glossary Domain: Sukashawarma Outlet Suite

> Glossary kanonik. Bukan spec, bukan scratchpad. Hanya istilah & maknanya.
> Sumber keputusan: lihat `docs/adr/`.

## Identitas & Orang

- **Outlet Staff** — pegawai yang bekerja di satu outlet (≠ HQ Employee). **Identitas kanonik** suite ini; semua aksi outlet (absen, transaksi, stok, terima kiriman) ber-aktor Outlet Staff. Role: `crew | kasir | spv | kepala_outlet`. (lihat ADR-001)
- **HQ Employee** — karyawan pusat (domain SS-WEBAPP existing). **Di luar scope** suite ini.
- **SPV / Kepala Outlet** — role Outlet Staff dengan wewenang enroll wajah, approve, dan supervisi outlet.

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

- **Ecosystem (project produksi)** — Supabase project existing yang dipakai TiktokGo, POS SS, kiosk. Master `outlets`. **Read-only** dari sisi suite baru.
- **Outlet Suite (project baru)** — Supabase project di **akun/org berbeda** untuk modul baru (M0–M4). (lihat ADR-004)
- **Hosting app** — server **cPanel CloudLinux shared** (penyedia lokal), file **statis** (Next.js static export), subdomain per modul. Postgres bawaan cPanel tidak dipakai. (lihat ADR-005)
