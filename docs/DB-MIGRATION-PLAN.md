# DB Migration & Data Topology Plan — Sukashawarma Outlet Suite

> Status: Draft (2026-06-09). Mengikuti keputusan: **Supabase project BARU di akun/org berbeda** + **outlet_staff enroll fresh**. Hosting app = cPanel CloudLinux shared (static export). Postgres bawaan cPanel **tidak dipakai** — DB = Supabase cloud.
> Terkait: ADR-002 (amended), ADR-004, ADR-005.

## 1. Topologi 3 Project Supabase (akun berbeda)

| Project | Akun | Isi | Status |
|---------|------|-----|--------|
| **Ecosystem** (existing) | akun Supabase produksi | `outlets` (19, master), `menu_items`, `orders`, `admin_users`, `pos_cashiers`, dll. Dipakai TiktokGo + POS SS lama. | Produksi — **JANGAN diubah destruktif** |
| **shawarma-kiosk** (existing) | project terpisah | POS/self-service baru: `outlets`, `profiles`, `orders`, `order_items`, kasir/payment/reports. **Sumber sales resmi M4.** | Produksi — **read-only** dari suite |
| **Outlet Suite** (baru) | **akun/org Supabase BERBEDA** | `outlet_staff`, domain Stok Bahan Baku, Shipment/Goods Receipt, reporting schema. | Greenfield (suite ini) |

> **Konsolidasi nanti:** owner berencana migrasi/menyatukan project Supabase ke depan. Sampai itu terjadi, sinkron antar-akun (Edge Function). Saat konsolidasi, sumber sales & outlets bisa disederhanakan.

**Prinsip:** Project Ecosystem **read-only** dari sisi suite baru (hanya dibaca untuk sinkron). Tidak ada migrasi destruktif ke produksi. Karena beda akun, sinkron lintas-akun via **Supabase Edge Function** (panggil REST Ecosystem dgn read key) dijadwalkan **pg_cron**, bukan FDW, bukan n8n. (ADR-006)

## 2. Sinkronisasi `outlets` (Ecosystem → Outlet Suite)

`outlets` master tetap di Ecosystem (di-manage admin TiktokGo). Suite baru butuh salinannya untuk FK lokal.

- **ID strategy:** **pertahankan `outlet.id` (uuid) yang sama** di kedua project → join lintas-project tetap valid (krusial untuk dashboard).
- **Seed awal:** export 19 outlet dari Ecosystem → upsert ke `outlets` Outlet Suite (kolom yang dibutuhkan: `id, slug, name, address, lat, lng, type, is_active`). `lat/lng` langsung dipakai M1 (GPS radius absensi).
- **Sinkron berkala:** outlets jarang berubah (19 outlet). **Edge Function `sync-outlets`** dijadwalkan pg_cron: baca REST Ecosystem (read key) → upsert by `id` ke Outlet Suite (1 arah). Frekuensi harian cukup; bisa trigger manual saat ada outlet baru.
- **Catatan:** karena 2 project di **akun berbeda**, sinkron lewat REST + read key dari dalam Edge Function. FDW intra-akun tidak relevan. Salinan lokal `outlets` demi isolasi.

## 3. Skema BARU di Outlet Suite (additive, fresh project)

Semua dibuat via Supabase CLI migrations di repo suite. RLS per-outlet wajib di semua tabel.

```
outlets                 -- salinan sinkron dari Ecosystem (id sama)
outlet_staff            -- M0: id, outlet_id FK, name, role(crew|kasir|spv|kepala_outlet),
                        --     status, face_descriptor (jsonb/vector), ref_photo_url, created_at
raw_materials           -- M2: id, name, unit(kg|pcs|liter), category, created_at
outlet_material_config  -- M2: outlet_id, material_id, reorder_point  (UNIQUE outlet+material)
stock_ledger            -- M2: id, outlet_id, material_id, type(masuk|keluar|waste|adjust),
                        --     qty, source(opname|shipment|manual), ref_id, actor_staff_id, created_at
stock_opname            -- M2: id, outlet_id, opname_date, actor_staff_id  (header)
stock_opname_items      -- M2: opname_id, material_id, counted_qty, system_qty, diff
shipments               -- M3: id, outlet_id, no_surat_jalan, status(dikirim|diterima_sebagian|
                        --     diterima_lengkap|selisih_dicatat), created_by, created_at
shipment_items          -- M3: shipment_id, material_id, qty_dikirim
goods_receipts          -- M3: shipment_id, material_id, qty_diterima, diff, photo_url,
                        --     verified_by(staff), verified_at  -> trigger insert stock_ledger(masuk)
attendance              -- M1: id, outlet_staff_id, outlet_id, type(in|out), ts_server,
                        --     gps_lat, gps_lng, selfie_url, match_distance, status(tepat|telat|alpha)
```

Reporting schema (M4): materialized views (`mv_sales_daily`, `mv_cogs_waste`, `mv_attendance_summary`, `mv_distribution_status`) + refresh via `pg_cron`.

## 4. Konsekuensi Dashboard Owner (M4) — lintas project

Revenue/penjualan ada di **shawarma-kiosk** (POS/self-service, sumber utama) + **Ecosystem** (TiktokGo online order); sisanya di **Outlet Suite**. Karena ADR-002 ingin dashboard baca 1 tempat:

- **Strategi:** sinkron **agregat sales** (bukan raw rows) dari shawarma-kiosk (+ Ecosystem) → tabel `sales_rollup` di reporting schema Outlet Suite, via **Edge Function `sync-sales` + pg_cron** (harian + "hari ini" tiap ~2 menit). Dashboard tetap baca 1 project (Outlet Suite).
- **Catatan konsolidasi:** bila project Supabase nanti disatukan, jumlah sumber sync berkurang.
- Join sales↔stok pakai `outlet_id` (uuid sama) → COGS per outlet valid.
- HR pusat: tetap tidak diintegrasi. Compliance (MySQL): **fase lanjut** (opsional) — konektor MySQL paling gampang via n8n bila nanti diperlukan.

## 5. Urutan Eksekusi Migrasi

1. **M0 (Dev B):** buat project Outlet Suite → migration `outlets` + `outlet_staff` + RLS → Edge Function `sync-outlets` + pg_cron, seed 19 outlet → verifikasi isolasi RLS.
2. **M1 (Dev A):** tabel `attendance` (butuh `outlet_staff` + `outlets.lat/lng`).
3. **M2 (Dev B):** `raw_materials`, `outlet_material_config`, `stock_ledger`, `stock_opname*`.
4. **M3 (Dev A):** `shipments`, `shipment_items`, `goods_receipts` + trigger goods_receipt→stock_ledger(masuk).
5. **M4 (Dev B):** reporting schema + materialized views + pg_cron + `sales_rollup` sync dari Ecosystem.

## 6. Aturan Keamanan Migrasi
- Outlet Suite: migrations additive, reversible (sertakan DOWN), uji di branch/staging dulu.
- Ecosystem: **tanpa perubahan skema**; hanya akses baca (service key terbatas) untuk job sinkron.
- Semua tabel RLS per-outlet; uji "outlet X tak bisa baca data outlet Y" sebelum lanjut.
