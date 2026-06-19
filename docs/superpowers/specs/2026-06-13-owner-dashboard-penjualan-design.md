# Owner Dashboard — Modul Penjualan & Omzet (Fase 1)

**Tanggal:** 2026-06-13 · **Revisi besar:** 2026-06-19 (hasil grill-with-docs)
**App:** `apps/owner-dashboard`
**Status:** Design — disetujui untuk lanjut ke implementation plan
**Keputusan arsitektur:** lihat **ADR-0009** (omzet terpusat di `orders` hub via `sales_source`).

> ⚠️ **Catatan revisi:** versi awal (13 Jun) mengasumsikan dashboard baca langsung Ecosystem via 2 client, form input manual di owner-dashboard, dan food-app dicatat total harian. Ketiganya **dibatalkan** setelah grilling — lihat ADR-0009. Spec ini adalah versi yang berlaku.

---

## 1. Tujuan & Ruang Lingkup

### Tujuan
Memberi pemilik 19 outlet satu layar untuk menjawab:
*"Outlet mana yang perform, sumber omzet mana yang sehat, menu apa yang laku, dan bagaimana trennya."*

### In-scope (Fase 1)
- Omzet total & per outlet (Hari ini / 7 hari / 30 hari / custom range)
- **Breakdown omzet per Sumber Omzet**: POS Outlet · Order Online · GoFood · GrabFood · ShopeeFood · TikTok
- Ranking/leaderboard outlet by omzet (▲▼ vs periode sebelumnya yang sama panjang)
- Tren omzet harian (line chart)
- Menu terlaris (top items by qty & by revenue) — lintas sumber
- AOV (average order value), jumlah order, % order `completed`
- Filter periode + filter outlet + filter sumber omzet

### Out-of-scope (Fase 2+)
- Biaya / HPP / margin / **komisi food-app** (omzet Fase 1 = kotor)
- Rollup menu per-produk-induk (Fase 1 = per-varian/ukuran)
- Tabel mapping menu Ecosystem↔hub (Fase 1 = join nama)
- Integrasi API langsung ke food apps (tetap input manual di pos-kasir)
- Absensi, monitoring stok (sudah di app lain), forecasting

### Bukan tanggung jawab app ini (dependency ke pos-kasir)
**Form input order (POS & food-app) ada di `apps/pos-kasir`, bukan di sini** — crew tak punya akses owner-dashboard (ADR-0009). Owner-dashboard **murni read-only**.

---

## 2. Sumber Data & Definisi Metrik

### Model omzet terpusat (ADR-0009)
Semua omzet = `orders` + `order_items` di **Outlet Suite (hub)**, dibedakan kolom **`orders.sales_source`**:

| Sumber Omzet | `sales_source` | Masuk hub via | Live? |
|---|---|---|---|
| POS Outlet | `pos` | pos-kasir native | belum ada transaksi |
| Order Online | `online` | **sync** Edge Function dari Ecosystem | ✅ live |
| Food Apps | `gofood`/`grabfood`/`shopeefood`/`tiktok` | pos-kasir, per-order item-level | tergantung pos-kasir |

### Perubahan skema (di repo/skema pos-kasir, bukan owner-dashboard)
- Tambah kolom **`orders.sales_source`** TEXT (default `pos`). Backfill order lama = `pos`.
- Food-app: `payment_method` = N/A (atau nilai `foodapp`); yang bermakna `sales_source`.
- Tidak perlu `completed_at` (atribusi tanggal pakai `created_at`, aman karena jam operasional 13:00–22:00).

### Sinkron Order Online (ADR-006)
Edge Function + pg_cron membaca `orders`/`order_items` Ecosystem → upsert ke hub dengan `sales_source='online'`. Pemetaan saat sync:
- **Status** Ecosystem → enum hub (`done`/delivered → `completed`; `cancelled`/`expired` → `cancelled`; dll).
- **Amount** Ecosystem `total` → `total_amount`.
- **outlet_id** — 1:1 (uuid sama, ADR-004).
- **Item** — bawa `menu_item_name` (kunci join menu lintas-sumber).
- Cadence: "hari ini" ~2 menit, historis per jam (ADR-002).

### Definisi metrik (disepakati)
- **Omzet Diakui** = `SUM(total_amount)` untuk order `status='completed'`. `pending`/`preparing`/`ready` tidak dihitung; `cancelled` tidak dihitung. (lihat CONTEXT.md "Omzet Diakui")
- **Tanggal omzet** = tanggal `created_at`, timezone **Asia/Jakarta**, batas hari kalender.
- **Nilai** = harga **kotor** (komisi food-app = biaya Fase 2).
- **Jumlah order** = COUNT order `completed`. **AOV** = omzet ÷ jumlah order.
- **% Order Completed** = order `completed` ÷ total order (semua status) pada periode.
- **Menu terlaris** = agregasi `order_items.quantity` & `subtotal` dari order `completed`, di-`GROUP BY` **nama ter-normalisasi** `lower(trim(regexp_replace(name,'\s+',' ','g')))`. Varian ukuran = baris terpisah.
- **Breakdown sumber** = group by `sales_source`.

---

## 3. Arsitektur

- **App:** `apps/owner-dashboard` (Next.js app router), saat ini placeholder M0 → diisi.
- **Satu Supabase (hub Outlet Suite)** — dashboard baca **satu project**. Tidak ada client kedua ke Ecosystem (sync menangani Order Online di sisi DB).
- **Agregasi di DB** lewat view definer (`security_barrier`, pola `monitoring_view_spv` — owner lihat semua outlet, bypass RLS):
  - `sales_summary_spv` — omzet, jumlah order, order completed, per `outlet_id` × `sales_source` × tanggal.
  - `menu_sales_spv` — qty & revenue per menu (nama ter-normalisasi), per periode, optional per outlet.
- **Hardening app (fold ke plan):** auth via `@suka/auth` (buang `src/lib/supabase.ts` lokal + footgun service-role), tambah `baseUrl` di tsconfig, test infra (vitest) — mengikuti playbook stok/distribusi/absensi.
- **Komponen UI kecil & fokus** (data via hook sendiri, dapat diuji terpisah):
  - `PeriodFilter` — rentang (Hari ini / 7h / 30h / custom) + filter outlet + filter sumber.
  - `KpiCards` — Omzet · Jumlah Order · AOV · % Completed.
  - `SourceBreakdown` — omzet per Sumber Omzet (kartu/donut).
  - `RevenueTrendChart` — line chart omzet harian.
  - `TopMenus` — menu terlaris (toggle by qty / by revenue).
  - `OutletLeaderboard` — tabel 19 outlet: omzet, order, AOV, ▲▼ vs periode lalu.
- **Data fetching:** hook (mis. `useSalesSummary(period, filters)`) panggil view, state loading/error/empty.
- **Charting:** Recharts (konfirmasi terpasang di plan).

---

## 4. Layout Halaman

```
Header: judul + PeriodFilter (Hari ini / 7h / 30h / custom) + filter outlet + filter sumber
Row KPI (4 kartu): Omzet | Jumlah Order | AOV | % Order Completed
Row sumber: SourceBreakdown (POS Outlet / Order Online / GoFood / GrabFood / ShopeeFood / TikTok)
Row tengah: RevenueTrendChart (kiri, lebar) | TopMenus (kanan)
Row bawah: OutletLeaderboard (tabel 19 outlet, sortable, ▲▼ vs periode lalu)
```

Default periode = "7 hari" (hari penuh). Sumber dengan nol data (mis. POS Outlet sebelum transaksi nyata) ditampilkan "belum ada transaksi", bukan error/0 menyesatkan.

---

## 5. Testing & Error Handling

### Testing
- **Logika agregasi diuji di level SQL**: view mengembalikan angka benar untuk data seed (beberapa outlet, beberapa sumber, status campur termasuk cancelled untuk memastikan terfilter, nama menu dengan beda kapital/spasi untuk memastikan join-normalisasi).
- **Unit test** fungsi transformasi/format di app (format rupiah, AOV, %, delta periode, normalisasi nama menu).

### Error Handling
- State **loading**, **empty** (periode tanpa order completed → pesan ramah), dan **gagal konek** hub (pesan, jangan crash — manfaatkan `ErrorBoundary`/`OfflineIndicator` yang sudah ada).

---

## 6. Dependency & Urutan
1. **Skema:** tambah `orders.sales_source` (skema pos-kasir/hub).
2. **Sync Order Online:** Edge Function + pg_cron (bisa paralel; ini yang membuat data live tersedia).
3. **View hub:** `sales_summary_spv`, `menu_sales_spv`.
4. **owner-dashboard:** hardening + UI baca view.
5. **(pos-kasir, di luar plan ini):** input order ber-`sales_source` untuk POS Outlet & food-app → mengisi sumber non-online.

Fase 1 dashboard bisa dirilis & bermakna **hanya dengan Order Online** (synced); sumber lain menyusul saat pos-kasir mengimplementasikan input.

## 7. Catatan Fase 2 (bukan untuk sekarang)
- Komisi food-app + HPP/margin (omzet kotor → laba). Saat itu `supabaseOps`/ledger stok dipakai untuk biaya.
- Rollup menu per-produk-induk; tabel mapping menu bila nama divergen.
