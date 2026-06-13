# Owner Dashboard — Modul Penjualan & Omzet (Fase 1)

**Tanggal:** 2026-06-13
**App:** `apps/owner-dashboard`
**Status:** Design — disetujui untuk lanjut ke implementation plan

---

## 1. Tujuan & Ruang Lingkup

### Tujuan
Memberi pemilik 19 outlet Suka Shawarma satu layar untuk menjawab:
*"Outlet mana yang perform, channel mana yang sehat, menu apa yang laku, dan bagaimana trennya."*
Berbasis data transaksi nyata dari sistem order/POS.

### In-scope (Fase 1)
- Omzet total & per outlet (Hari ini / 7 hari / 30 hari / custom range)
- **Breakdown omzet per channel** (Online / POS / GoFood / ShopeeFood / TikTok)
- Ranking/leaderboard outlet by omzet (dengan ▲▼ vs periode sebelumnya)
- Tren omzet harian (line chart)
- Menu terlaris (top items by qty & by revenue)
- AOV (average order value), jumlah order, rasio order selesai vs batal/expired
- Filter periode + filter outlet + filter channel
- **Form manual entry** omzet food apps (GoFood/ShopeeFood/TikTok)

### Out-of-scope (ditunda)
- Biaya / HPP / margin → **Fase 2** (butuh harga bahan baku diisi)
- Absensi, monitoring stok (sudah ada di app `stok`), forecasting
- Integrasi API langsung ke GoFood/ShopeeFood/TikTok (food app tetap manual entry di Fase 1)

---

## 2. Sumber Data & Definisi Metrik

### Sumber tunggal omzet
Satu Supabase (project order/POS bersama — dipakai TiktokGo SS *dan* POS SS). Ketiga
channel omzet tinggal di **satu tabel `orders`** (+ `order_items` untuk rincian menu),
dibedakan kolom `channel` / `payment_method`:

| Channel | Cara dikenali sekarang |
|---|---|
| Order online (order.sukashawarma.com) | `channel = 'online'`, `payment_method` tripay_* |
| POS / kasir outlet | `channel = 'pos'`, `payment_method` `cash`/`qris_static` (ada `cashier_id`, `cash_received`, `discount_amount`, `voided_at`) |
| Manual food apps (GoFood/ShopeeFood/TikTok) | `payment_method = 'manual'` (saat ini ~27 row, belum terpisah per app) |

### Perubahan skema yang dibutuhkan
- Tambah kolom **`orders.sales_source`** TEXT, nilai: `online` / `pos` / `gofood` / `shopeefood` / `tiktok`.
  - Backfill: `online`/`pos` di-derive dari `channel`.
  - Row `payment_method='manual'` lama → tandai `tiktok` atau biarkan `manual`/`unknown` (dikonfirmasi saat implementasi; default aman: `unknown`).
  - Entry manual baru wajib mengisi `sales_source`.
- Migration ditaruh di repo **POS/TiktokGo** (pemilik skema `orders`), bukan di SS Digital. Additive-only, backward compatible (pola sama seperti `pos_alter_orders`).

### Definisi metrik (disepakati)
- **Omzet diakui** = `SUM(orders.total)` dengan `status IN ('paid','preparing','ready','done')`.
  `pending_payment`, `cancelled`, `expired`, dan order ber-`voided_at` **tidak** dihitung.
- **Tanggal acuan** = `paid_at` (saat uang masuk). Untuk manual entry yang tak punya `paid_at`,
  gunakan tanggal transaksi yang diinput. Timezone **Asia/Jakarta**.
- **Jumlah order** = COUNT order diakui.
- **AOV** = omzet diakui ÷ jumlah order diakui.
- **% order selesai** = order `done` ÷ total order (semua status) pada periode.
- **Menu terlaris** = agregasi `order_items.quantity` & `order_items.subtotal` dari order diakui.
- **Breakdown channel** = group by `sales_source`.

---

## 3. Arsitektur

- **App:** lanjutkan `apps/owner-dashboard` (Next.js app router) yang sekarang masih placeholder M0.
- **Dua Supabase client:**
  - `supabaseSales` (project order/POS) — **satu-satunya sumber Fase 1**.
  - `supabaseOps` (SS Digital, sudah ada) — disiapkan untuk Fase 2 (biaya), **tidak dipakai Fase 1**.
  - Kredensial `supabaseSales` lewat env var (`NEXT_PUBLIC_SALES_SUPABASE_URL` + anon key). Anon key + RLS/view definer, bukan service role di client.
- **Agregasi di DB, bukan di app.** Buat view/RPC di project order/POS, definer + `security_barrier`
  (pola sama seperti `monitoring_view_spv`) agar owner lihat semua outlet, bypass RLS:
  - `sales_summary_spv` — omzet, jumlah order, order selesai, per `outlet_id` × `sales_source` × tanggal.
  - `menu_sales_spv` — qty & revenue per menu (per periode, optional per outlet).
- **Pemetaan outlet:** kedua project punya tabel `outlets` ber-ID beda. Fase 1 hanya butuh `outlets`
  dari project sales (label). Pemetaan slug ↔ ID disiapkan sebagai konstanta/util untuk Fase 2.
- **Komponen UI kecil & fokus** (tiap komponen punya satu tujuan, data via props/hook sendiri, dapat diuji terpisah):
  - `PeriodFilter` — pilih rentang (Hari ini / 7h / 30h / custom) + filter outlet + filter channel.
  - `KpiCards` — Omzet, Jumlah Order, AOV, % Order Selesai.
  - `ChannelBreakdown` — omzet per channel (kartu/donut).
  - `RevenueTrendChart` — line chart omzet harian.
  - `TopMenus` — daftar menu terlaris (toggle by qty / by revenue).
  - `OutletLeaderboard` — tabel 19 outlet: omzet, order, AOV, ▲▼ vs periode lalu.
  - `ManualSalesEntryForm` — input omzet food apps (outlet, tanggal, sales_source, total, optional rincian item).
- **Data fetching:** custom hook (mis. `useSalesSummary(period, filters)`) yang panggil view/RPC, dengan state loading/error/empty.
- **Charting:** satu lib ringan (Recharts sebagai default; dikonfirmasi di plan kalau belum terpasang).

---

## 4. Layout Halaman

```
Header: judul + PeriodFilter (Hari ini / 7h / 30h / custom) + filter outlet + filter channel
Row KPI (4 kartu): Omzet | Jumlah Order | AOV | % Order Selesai
Row channel: ChannelBreakdown (Online / POS / GoFood / ShopeeFood / TikTok)
Row tengah: RevenueTrendChart (kiri, lebar) | TopMenus (kanan)
Row bawah: OutletLeaderboard (tabel 19 outlet, sortable, ▲▼ vs periode lalu)
Aksi: tombol "Input Manual (Food Apps)" → ManualSalesEntryForm (modal/drawer)
```

Alur pemilik: buka → lihat KPI agregat → cek breakdown channel → scan tren → lihat ranking outlet & menu.

---

## 5. Testing & Error Handling

### Testing
- **Logika agregasi diuji di level SQL**: view/RPC mengembalikan angka benar untuk data seed
  (beberapa outlet, beberapa channel, status campur termasuk void/expired untuk memastikan terfilter).
- **Unit test** untuk fungsi transformasi/format di app (format rupiah, hitung AOV, %, delta periode).

### Error Handling
- State **loading**, **empty** (belum ada order di periode → pesan ramah, bukan layar kosong),
  dan **gagal konek** `supabaseSales` (tampilkan pesan, jangan crash — manfaatkan `ErrorBoundary`/`OfflineIndicator` yang sudah ada).
- Manual entry: validasi sisi form (outlet & sumber wajib, total > 0) + tangani error simpan.

---

## 6. Catatan Lanjutan (Fase 2 — bukan untuk diimplementasi sekarang)
- Biaya/HPP: butuh harga bahan baku diisi di SS Digital (`bahan_baku`/`resep`), lalu margin = omzet − HPP per outlet/menu.
- Saat itu `supabaseOps` mulai dipakai; pemetaan outlet slug ↔ ID jadi krusial untuk menyandingkan omzet (sales) dan biaya (ops).
