# ADR-009 — Omzet terpusat di satu `orders` hub via `sales_source`; input food-app di pos-kasir

- Status: Accepted
- Tanggal: 2026-06-19
- Terkait: ADR-002 (reporting hub), ADR-004 (project terpisah), ADR-006 (sinkron Edge Function). Men-supersede pendekatan di spec `2026-06-13-owner-dashboard-penjualan-design.md` (kini terintegrasi di `admin-dashboard`).

## Konteks

Owner Dashboard butuh menampilkan omzet 19 outlet. Ada **3 Sumber Omzet** kanonik (lihat CONTEXT.md "Sumber Omzet"):

1. **POS Outlet** — pelanggan datang langsung, transaksi di `apps/pos-kasir` (POS baru). Data native di `orders` Outlet Suite. Saat ini deploy tapi belum ada transaksi nyata.
2. **Order Online** (eks-"TiktokGo SS") — penjualan online, tinggal di `orders` project **Ecosystem**. Satu-satunya sumber yang LIVE sekarang.
3. **Manual Food Apps** — GoFood/GrabFood/ShopeeFood/TikTok. Tidak ada integrasi API; harus diinput manual.

Spec lama (2026-06-13) mengasumsikan: dashboard membaca **langsung** project Ecosystem via 2 client runtime, form input manual ada **di owner-dashboard**, dan food-app dicatat sebagai **total harian**. Tiga asumsi itu salah/bertabrakan dengan kenyataan:

- **Akses:** `crew` (yang menginput food-app) hanya punya akses `absensi` + `stok` — **tidak bisa** membuka admin-dashboard (`ROLE_APP_ACCESS`: admin-dashboard = admin+owner saja).
- **ADR:** baca langsung lintas-project = "live cross-DB query" yang sudah **ditolak ADR-002**.
- **Skema:** `orders` Outlet Suite (hasil `merge_pos_schema`) berbeda dari `orders` Ecosystem (status enum, kolom, nama). Tidak ada `sales_source`.

## Keputusan

**Satu model omzet terpusat di hub Outlet Suite.** Semua omzet = baris `orders` + `order_items` di Outlet Suite, dibedakan kolom baru **`orders.sales_source`** (`pos` | `online` | `gofood` | `grabfood` | `shopeefood` | `tiktok`). Konsekuensinya:

1. **Input food-app di `pos-kasir`, bukan admin-dashboard.** Crew yang jaga kasir meng-input order food-app **per-transaksi, item-level, realtime** (saat order masuk), persis seperti order POS biasa tetapi `sales_source` = nama app. Admin-dashboard (View Owner) **murni read-only**.
2. **POS Outlet & Food Apps native di hub** (ditulis pos-kasir) — tanpa sinkron.
3. **Order Online disinkron** dari Ecosystem → hub via Edge Function + Database Webhooks (ADR-006) secara real-time tanpa polling, dipetakan ke skema hub (status, amount, timestamp, item) dengan `sales_source='online'`.
4. **Omzet diakui** = `status='completed'` (item diterima customer). Tanggal omzet = tanggal `created_at` (aman: outlet beroperasi 13:00–22:00, tak pernah lewat tengah malam). Tidak perlu kolom `completed_at` untuk atribusi tanggal.
5. **Nilai dicatat = harga kotor** (sebelum komisi food-app). Komisi = komponen biaya Fase 2 (margin), bukan pengurang omzet. `payment_method` untuk food-app = N/A.
6. **"Menu terlaris" lintas-sumber** di-join via `menu_item_name` ter-normalisasi (lower+trim+rapatkan spasi). Varian ukuran (Jumbo/Sedang) = baris terpisah (produk berbeda). Rollup per-produk-induk = Fase 2.
7. **Admin-dashboard (View Owner) membaca satu project** lewat view definer `security_barrier` (pola `monitoring_view_spv`): `sales_summary_spv`, `menu_sales_spv`.

## Alternatif yang ditolak

- **Baca langsung Ecosystem via 2 client (spec lama)** — melanggar ADR-002 (live cross-DB), dan jadi kerja buang saat pos-kasir live (harus merge 2 skema `orders` berbeda di client).
- **Form input manual di admin-dashboard** — crew tak punya akses ke app itu.
- **Food-app sebagai total harian (lump sum)** — kehilangan analitik menu; owner minta item-level.
- **Tabel mapping menu Ecosystem↔hub** — ditunda; join-nama cukup untuk katalog kecil & stabil. Naik ke mapping bila nama divergen.

## Konsekuensi

- (+) Admin-dashboard sederhana: satu kontrak data (`orders` hub), satu project dibaca, isolasi dari perubahan skema sumber.
- (+) Future-proof: saat pos-kasir transaksi nyata, POS Outlet otomatis nyumbang view yang sama — nol rework UI.
- (+) Konsisten dengan ADR-002/004/006 (tak perlu keputusan arsitektur baru selain pemusatan ini).
- (−) **Dependency lintas-fitur:** omzet food-app & POS baru muncul di dashboard setelah `pos-kasir` mengimplementasikan input ber-`sales_source`. Fase 1 dashboard bisa jalan duluan hanya dengan Order Online (synced).
- (−) Butuh menambah `orders.sales_source` + (untuk food-app) penanganan `payment_method` N/A di skema pos-kasir.
- (−) Akurasi "menu terlaris" bergantung disiplin penamaan menu seragam (termasuk label ukuran) antara katalog Ecosystem & pos-kasir.
- (−) Omzet food-app = kotor → angka kas nyata (net setelah komisi) baru terlihat di Fase 2.
