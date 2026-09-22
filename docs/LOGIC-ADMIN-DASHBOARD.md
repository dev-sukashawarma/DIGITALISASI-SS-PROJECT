# Peta Logika & Alur — `apps/admin-dashboard`

**Ruang lingkup:** seluruh modul `apps/admin-dashboard` **KECUALI modul HR**
(`/dashboard/hr/*`, hooks `useAttendance*`, `useLeave*`, `usePayroll*`,
`useRoster`, `useStaff*`, `useContracts`, `useDiscipline`, `usePerformance`,
`useCrewBonus`, `useCashAdvance*`, `useHrActivity`, komponen
`components/modules/*` yang khusus HR). Modul HR sengaja tidak dibahas.

**Disusun:** 2026-09-21 · **Sumber:** pembacaan kode di `main` per tanggal itu.
Dokumen ini menjelaskan **apa yang dilakukan kode**, bukan apa yang seharusnya.
Di mana kode memuat keputusan bisnis atau jebakan yang mudah dilanggar, itu
ditandai ⚠️.

---

## Daftar Isi

1. [Fondasi: auth, role, routing, cache, realtime](#1-fondasi)
2. [Primitif lintas-modul (aturan yang dipakai banyak halaman)](#2-primitif-lintas-modul)
3. [Modul: Laporan Internal (Owner/Admin)](#3-modul-laporan-internal)
4. [Modul: Penjualan & Kinerja](#4-modul-penjualan--kinerja)
5. [Modul: Produk & Stok](#5-modul-produk--stok)
6. [Modul: Pembelian (PO)](#6-modul-pembelian-po)
7. [Modul: POS Admin](#7-modul-pos-admin)
8. [Modul: App Retail](#8-modul-app-retail)
9. [Modul: Kemitraan & Portal Mitra](#9-modul-kemitraan--portal-mitra)
10. [Modul: Leader & Area Manager](#10-modul-leader--area-manager)
11. [Modul: Petty Cash (lintas role)](#11-modul-petty-cash-lintas-role)
12. [Modul: Sistem, Migrasi Data & Integrasi](#12-modul-sistem-migrasi-data--integrasi)
13. [API Routes (HTTP)](#13-api-routes-http)
14. [Inventaris Server Action](#14-inventaris-server-action)
15. [Jebakan yang sudah terdokumentasi di kode](#15-jebakan-yang-sudah-terdokumentasi-di-kode)

---

## 1. Fondasi

### 1.1 Rantai autentikasi

```
middleware.ts
  └─ path /public/*        → lolos tanpa auth
  └─ hostname localhost    → lolos (dev bypass)
  └─ selain itu            → enforceAppAccess(request, 'admin-dashboard',
                                { rootRewritePath: '/dashboard' })  [@suka/auth]

app/layout.tsx (server)
  └─ parseStaffHeader(headers[STAFF_HEADER]) → initialStaff
      (profil staf disuntik middleware lewat header, jadi render pertama
       sudah tahu role tanpa round-trip ke DB)

app/Providers.tsx (client)
  └─ QueryClientProvider  staleTime 60s · gcTime 5m · refetchOnWindowFocus:false · retry:1
  └─ AuthProvider (supabase browser client, initialStaff)
  └─ RoleProvider          ← gerbang role sesungguhnya di sisi klien
  └─ NextTopLoader · Toaster (sonner) · GlobalDialogs
```

⚠️ **Middleware HANYA memeriksa `hasAppAccess(role, 'admin-dashboard')`.** Ia
tidak memeriksa role per-halaman. Semua penyempitan per-role terjadi di
`RoleContext` (browser) — yang **tidak melindungi Server Action**. Lihat §1.4.

### 1.2 Role & route guard (`components/layout/RoleContext.tsx`)

Role yang dikenal app ini:

| Role | Asal | Catatan |
|---|---|---|
| `OWNER` | `outlet_staff.role` | |
| `ADMIN` | | akses paling luas, tanpa route-guard penyempit |
| `ADMIN_HR` | | ⚠️ **tak punya allowlist route sama sekali** — bisa membuka rute admin apa pun |
| `MITRA` | | read-only, dikunci ke `/dashboard/mitra/*` |
| `LEADER` | | dikunci ke `/dashboard/leader/*` |
| `AREA_MANAGER` | dipetakan dari `KORLAP` | dikunci ke `/dashboard/area-manager/petty-cash` saja |
| `PURCHASING` | | dikunci ke `/dashboard/pembelian/*` + `/dashboard/reports/pembelian` |

Perilaku:

- Role di luar tujuh di atas (mis. `crew`) → **redirect keluar** ke Portal
  (`NEXT_PUBLIC_PORTAL_URL`, `localhost:3010` saat dev). Sama untuk staf yang
  `outlet_staff`-nya tidak ditemukan.
- `OWNER` yang mencoba `/dashboard/hr/*`, `/dashboard/system-health`, atau
  `/dashboard/outlets` → dilempar balik ke `/dashboard/owner`.
- Context yang diekspos: `{ role, outletId, isReadOnly: role === 'MITRA' }`.
- Selama `loading || !role` → layar "Memuat Akses..." (tidak merender anak).

### 1.3 Landing per role (`app/dashboard/page.tsx`, server)

Dibaca dari header staf, lalu `redirect()`:

| Role | Landing |
|---|---|
| OWNER | `/dashboard/owner` |
| MITRA | `/dashboard/mitra` |
| ADMIN_HR | `/dashboard/hr` |
| ADMIN / SUPERADMIN | `/dashboard/reports/pos` |
| KORLAP | `/dashboard/area-manager` |
| LEADER | `/dashboard/leader` |
| PURCHASING | `/dashboard/pembelian` |
| lainnya | `<ClientRedirect />` (fallback sisi klien) |

### 1.4 Otorisasi Server Action (`lib/authz.ts`)

Dua helper, dan alasannya ditulis panjang di kodenya:

- `requireRole(allowedRoles[])` — ambil `auth.getUser()` dari sesi, baca
  `outlet_staff.role` + `status`, **fail-closed**: tolak bila tidak aktif atau
  role tidak masuk daftar. Mengembalikan `{ userId, role }`.
- `assertOutletAccessible(outletId)` — panggil RPC `accessible_outlet_ids()`
  (sumber kebenaran yang sama dengan RLS) lalu cek keanggotaan.

⚠️ **Aturan yang ditegakkan kode ini:** setiap Server Action yang memakai
`createServiceClient()` (bypass RLS) **wajib** memanggil `requireRole` lebih
dulu. `'use server'` bukan privat — tiap `export` adalah endpoint POST yang bisa
dipanggil langsung tanpa melewati halaman. Untuk action yang menerima
`outletId` dari klien, role check saja tidak cukup → tambahkan
`assertOutletAccessible`.

### 1.5 Navigasi (`components/layout/navConfig.ts`)

Struktur: `NAV_GROUPS: NavGroup[]` → tiap grup punya `roles[]` dan `items[]`;
tiap item punya `roles[]`, opsional `primary?: Role[]` dan `children?` (satu
tingkat saja, dijaga test).

Fungsi turunan:

| Fungsi | Guna |
|---|---|
| `accessibleItems(role)` | daftar rata (induk lalu anak) untuk role tsb |
| `primaryItems(role)` | 4 item tab bar mobile — item bertanda `primary` didahulukan, sisanya urut `accessibleItems`; role tanpa penanda berperilaku persis `slice(0,4)` |
| `accessibleGroups(role)` | grup + item tersaring, grup kosong dibuang |
| `isItemActive(href, pathname)` | resolusi rute aktif; sejumlah href "induk" (mis. `/dashboard/owner/profit`, `/dashboard/pembelian`, `/dashboard/pos-admin`) hanya aktif pada path **persis**, supaya induk & anak tak menyala berbarengan |
| `labelForPath(pathname)` | judul halaman untuk Header (match terpanjang) |
| `resolvePortalUrl()` / `resolvePosKasirUrl()` | URL lintas-app, sadar localhost |

Daftar pintu (grup) dan pemiliknya:

| Pintu | Role |
|---|---|
| Leader Dashboard | LEADER |
| Area Manager Dashboard | AREA_MANAGER |
| Portal Mitra | MITRA |
| Laporan Internal | OWNER, ADMIN |
| Penjualan & Kinerja | OWNER, ADMIN |
| Produk & Stok | ADMIN |
| Pembelian | ADMIN, PURCHASING |
| Kemitraan | OWNER |
| POS | ADMIN |
| App Retail | OWNER, ADMIN |
| Karyawan *(HR — di luar lingkup dokumen)* | ADMIN_HR, ADMIN |
| Sistem | OWNER, ADMIN |
| Migrasi Data | OWNER |

⚠️ **Grup dipakai bersama antar-role.** Memindahkan item antar grup akan
diam-diam mengubah nav role lain. Mekanismenya harus penyempitan `roles` per
item (entri kembar dengan `roles` berbeda), bukan pemindahan.

### 1.6 Layout & shell (`app/dashboard/layout.tsx`)

`CommandMenu` (palet perintah) · `RealtimeMount` · `Sidebar` (desktop) ·
`Header` · `SwipeableLayout` (gestur mobile) · `<main id="dashboard-main-scroll">`
dengan `ScrollRestoration` · `BottomNav` (mobile, dari `primaryItems`).

### 1.7 Realtime (`components/RealtimeMount.tsx`)

Dipasang sekali di layout dashboard, memakai `@suka/realtime`:

- `useHrFinanceRealtime()` — peta tabel → queryKey:
  `expenses→['expenses']`, `payroll_records→['payroll']`,
  `outlet_staff→['staff']`, `cash_advances→['cash-advances']`.
- `useSalesRealtime()` — perubahan `orders` meng-invalidate
  `['sales-hourly-raw']`, `['menu-sales']`, `['target_progress_global']`.

### 1.8 Kebijakan cache periode (`lib/periodCache.ts`)

Aturan: **periode yang sudah tertutup bersifat immutable** → boleh di-cache
selamanya; periode berjalan tetap 2 menit.

```
isClosedPeriod(filter) := filter.to < kemarin (kalender Asia/Jakarta)
periodCacheOptions()   := tertutup ? { staleTime: Infinity, gcTime: 24 jam }
                                   : { staleTime: 2 menit, gcTime: 5 menit }
withPeriodCache(key, filter, fn) → read-through cache + persistensi localStorage
```

⚠️ "Kemarin", bukan "hari ini" — sinkronisasi POS offline & closing kasir sering
baru masuk keesokan harinya.

Dipakai oleh: `useExpenses`, `useHpp`, `useWaste`, `useSalesDaily`.

---

## 2. Primitif lintas-modul

Ini aturan yang muncul di banyak halaman. Kalau satu halaman baru melanggarnya,
angkanya akan berbeda dari halaman lain tanpa error apa pun.

### 2.1 Filter periode (`lib/types.ts` · `lib/period.ts` · `hooks/useDashboardStore.ts`)

```ts
PeriodFilterValue = { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD',
                      outletId: string | 'all' | 'ss-online',
                      source: SalesSource | 'all' }

SalesSource = pos | online | gofood | grabfood | shopeefood
            | tiktok | tiktok_shop | shopee_shop | endors | app
```

`presetRange(preset)` — semua tanggal dihitung di **Asia/Jakarta (UTC+7)**:

| Preset | Arti |
|---|---|
| `today` / `yesterday` | 1 hari |
| `7d` / `30d` | 7/30 hari terakhir **termasuk hari ini** |
| `this_month` | tanggal 1 s/d hari ini |
| `last_month` | **bulan kalender penuh** sebelumnya — supaya bisa dibandingkan dengan tutup buku |

Turunan: `diffDays(from,to)` (inklusif, minimum 1) · `previousRange(range)`
(rentang sepanjang yang sama tepat sebelum `from`) · `monthRange(year, month)`.

Filter global disimpan di zustand `useDashboardStore`.

### 2.2 `useScopedFilter()` — penguncian outlet untuk role read-only

Membungkus filter global. Untuk `MITRA`, `filter.outletId` **dipaksa** ke
outlet miliknya dan `lockedOutletId` dikembalikan non-null, sehingga
`PeriodFilter` merender outlet sebagai label statis, bukan combobox.

### 2.3 Outlet non-operasional

| Helper | Aturan |
|---|---|
| `lib/outletFilters.ts` — `TEST_OUTLET_ID`, `isTestOutlet()` | Outlet tes tidak boleh masuk agregat omzet/HPP/waste/biaya. Pengenalan: id persis **atau** nama/slug mengandung `tes`/`test`/`trial`/`demo` |
| `lib/marketplaceOutlets.ts` — `isMarketplaceOutlet()`, `splitOutletsByType()` | Outlet virtual `type='marketplace'` (TikTok Shop, Shopee) dipisah dari outlet fisik |
| `hooks/useOutlets.ts` | daftar outlet baku, `staleTime` 5 menit, **menyaring `type='marketplace'`** |

### 2.4 Kepemilikan outlet (`lib/outletOwnership.ts`)

`ProfitScope = 'all' | 'internal' | 'mitra'`.

`isMitraOutlet(outlet)` = benar bila **salah satu**: `outlets.type === 'mitra'`,
punya baris di `mitra_investments`, atau namanya mengandung "mitra".

⚠️ `type` **wajib** ikut dibaca: HPP outlet mitra dinaikkan 1,1× berdasarkan
penanda yang sama di `useHpp`. Kalau aturan di sini lebih sempit, outlet mitra
baru kena markup HPP tanpa pendapatan margin tandingannya — markup berubah jadi
biaya hantu.

`isInScope(row, scope)` — baris outlet tak dikenal dianggap **internal** (outlet
mitra selalu punya jejak eksplisit, jadi ketidaktahuan tak boleh membesarkan
angka mitra).

### 2.5 Kanal penjualan

| Berkas | Isi |
|---|---|
| `lib/channels.ts` | `CHANNELS[]` (label, warna, path logo SVG) + `getChannel(id)` yang menormalkan banyak alias & UUID channel; `SOURCE_LABELS` |
| `lib/order-source.ts` | `resolveOrderSource(channel, salesSource, customerName, isEndorse)` → urutan: Endorse → `channel` → `sales_source` → Website Online → POS Kasir → **POS Pawoon** (fallback terakhir) |
| `lib/channelGroups.ts` | `groupChannel(salesSource)` → `offline \| online \| foodapps \| tiktok \| app` untuk Rekap Bulanan |

⚠️ Dua nama yang mudah tertukar dan **sengaja dibedakan**:
`shopee`/`shopeefood` = ShopeeFood (delivery) vs `shopee_shop` = Shopee Seller
(marketplace); `tiktok`/`tiktokgo` = TikTok Go (delivery) vs `tiktok_shop` =
TikTok Shop (marketplace). Di `channelGroups`, marketplace masuk grup `online`,
bukan `tiktok`. Kanal `app` (aplikasi pelanggan sendiri) punya grup sendiri —
sebelumnya tak ada di peta dan diam-diam jatuh ke `offline`.

### 2.6 Rumus laba (`lib/profit.ts`)

```
netRevenue = grossRevenue − deductions
labaKotor  = grossRevenue − hpp − deductions
labaBersih = labaKotor − expenses − wasteValue
margin%    = terhadap grossRevenue
```

- `computeOutletProfit(...)` — sama, tapi `expenses` = pengeluaran outlet itu saja.
- `computeCompanyProfit(ΣlabaOutlet, pengeluaranPusat)` = `ΣlabaOutlet − pengeluaranPusat`
  (waste sudah terpotong di tingkat outlet).

⚠️ **Waste adalah argumen terpisah, bukan baris `expenses`.** Kalau waste ikut
ditulis ke tabel `expenses`, ia terpotong dua kali. `lib/expenseBreakdown.ts`
(`withWasteSlice`, kunci `__waste__`) menggabungkannya **hanya untuk tampilan**.

`lib/profitWaterfall.ts` — `buildProfitWaterfall(input)` menjabarkan rantai itu
langkah demi langkah (`base | deduction | subtotal | total`), termasuk fakta
bahwa waste dipotong di tahap laba **bersih**, bukan kotor.

### 2.7 KPI Laporan POS (`lib/posReportKpi.ts`)

⚠️ **`orders.total_amount` di DB SUDAH net** (potongan dikurangi saat order
dibuat di pos-kasir). Gross harus direkonstruksi:

```
grossRevenue = netRevenue + totalDeductions
grossProfit  = grossRevenue − (totalHpp + totalDeductions)
```

`computeNetRevenueVoidAware(orders)` — hanya `status === 'completed'` yang
dihitung; order `cancelled` (void) **tidak** memotong maupun menambah.

### 2.8 HPP (`hooks/useHpp.ts` · `lib/hpp.ts`)

Urutan penentuan HPP satu item (`getItemHpp`):

1. `menu_items.channel_hpp[channel]` — untuk kanal marketplace, kuncinya
   dicoba berurutan `ss_online` → `tiktok_shop` → `shopee_shop` → kunci mentah.
2. `menu_items.hpp_override`.
3. Bila `is_package`: Σ (`hpp_override` komponen × qty komponen).
4. Fallback pencocokan **nama** menu (`cleanItemName`) bila id tak ketemu.

Lalu: **outlet mitra ditagih base × 1,1**, dan `markup` dicatat sebagai
selisihnya (= 10% base), bukan 10% dari angka yang sudah dikali 1,1.

`lib/hpp.ts` `computeResepHpp()` — HPP standar dari resep untuk layar Resep:
`subtotal = round(harga_beli / kemasan_qty × qty_per_porsi)`, ditambah `buffer`,
lalu `marginRp`, `marginPct`, `foodcostPct`, dan bendera `anyMissingPrice`.

### 2.9 Paginasi PostgREST (`lib/fetchAllPages.ts` · `lib/queryPaging.ts`)

⚠️ **PostgREST memotong hasil di 1.000 baris tanpa error apa pun** — HTTP 200,
`error` null. `.limit(5000)` pun tidak menembusnya. Query tanpa paginasi akan
diam-diam mengembalikan sebagian data dan setiap penjumlahan di atasnya jadi
terlalu kecil.

- `fetchAllPages(build)` — loop berurutan.
- `fetchAllPagesParallel(build)` — halaman pertama membawa `count=exact`,
  sisanya diambil bersamaan.

⚠️ Pemanggil **wajib** memasang `.order(...)` pada kolom/kombinasi **unik**.
Tanpa urutan unik, baris di antara nilai kembar bisa terhitung dua kali dan
sebagian terlewat — kesalahan yang jauh lebih sulit dilihat daripada pemotongan.

### 2.10 Waktu WIB (`lib/timezone.ts`)

Semua konversi dipaku ke UTC+7, **bukan** zona perangkat — dashboard bisa
dibuka dari perangkat WITA/WIT atau yang salah setel, dan jadwal promo "17:00"
bisa tersimpan jadi 16:00. Nilai yang disimpan ke DB tetap ISO UTC.
`toWibInputValue` · `fromWibInputValue` · `formatWib` · `nowWibInputValue`.

---

## 3. Modul: Laporan Internal

Pintu **Laporan Internal** (OWNER, ADMIN).

### 3.1 Ringkasan Bisnis — `/dashboard/owner`

**Halaman:** `owner/page.tsx` (server: ambil `outlets`, `users`) →
`OwnerDashboardView.tsx` (client).

**Komponen:** `PeriodFilter` · `KpiCards` · `SourceBreakdown` · `TopMenus` ·
`OutletLeaderboard` · `DailyTargetBoard` (+ chart dinamis).

**Mesin data:** `app/actions/ownerDashboard.ts` →
`getOwnerDashboardDataFast(filter, outlets)`.

Alurnya:

```
1. resolveCallerScope()
   ├─ baca outlet_staff.role dari SESI (bukan service-role, supaya auth.uid()
   │  terisi di dalam RPC SECURITY DEFINER)
   ├─ role ∈ FULL_ACCESS_ROLES (admin, admin_hr, owner, spv,
   │  regional_manager, kitchen, admin_finance, purchasing) → scope 'all'
   └─ selain itu → RPC accessible_outlet_ids(); scopeKey = daftar id tergabung
      (scopeKey jadi bagian kunci cache → user beda scope tak saling baca cache)

2. Guard: outletId yang diminta harus ada di scope, kecuali 'ss-online'

3. Split-range cache (unstable_cache, tag 'owner-dashboard', revalidate 3600)
   ├─ rentang seluruhnya lampau  → satu panggilan ber-cache
   ├─ rentang melewati batas hari → dipecah dua:
   │     [from .. kemarin]  = beku, ikut cache 1 jam
   │     [hari ini .. to]   = selalu segar
   │     lalu digabung mergeSummaryPayload()
   └─ rentang hari ini saja      → tanpa cache

4. Sumber angka
   ├─ POS & delivery : RPC get_owner_dashboard_summary(p_from, p_to,
   │                   p_outlet_id, p_source, p_test_outlet_id)
   │                   → { kpi_rows, hourly_rows, menu_rows, total_cogs,
   │                       total_opex, bogo_transactions, bogo_gift_units }
   └─ SS Online      : fetchEcommerceOwnerData() dari `ecommerce_sales`
                       (+ `ecommerce_sale_items`, embed `menu_items`)
                       — hanya saat outletId 'all' atau 'ss-online'

5. Gabung: kpiRows di-concat, hourly & menu dijumlahkan per kunci,
   cogs/opex dijumlahkan; keluar juga fetchedAt & isCached
```

Aturan penggabungan (`mergeSummaryResult`) sah **hanya karena dua potongan
rentangnya lepas (disjoint)**: `kpi_rows` berkunci (outlet, source, tanggal)
sehingga cukup di-concat; `bogo_transactions` = COUNT(DISTINCT order) dan satu
order hanya milik satu tanggal.

**E-commerce (`fetchEcommerceOwnerData`):**
- Paginasi 1.000/halaman dengan `.order('order_date').order('id')` — ⚠️ `id`
  wajib sebagai pemecah seri: `order_date` disimpan sebagai tengah malam, jadi
  1.377 baris hanya punya ~30 timestamp unik.
- Query **dibangun ulang tiap halaman** (builder Supabase mutable).
- `omzetNet = max(0, total_amount − |total_potongan/admin_fee/discount_amount|)`.
- Channel → `tiktok_shop` / `shopee_shop` / `online` berdasarkan nama atau UUID.
- HPP per item: `channel_hpp` → `hpp_override` → komponen paket.

**B1G1 (`getBuyOneGetOneSummary`):** menghitung order `completed` yang punya
`order_items.is_promo_reward = true`. Reward disimpan sebagai order_item
tersendiri supaya jumlah porsi keluar tetap akurat sementara **omzet hanya dari
baris berbayar**. Dilewati bila filter `ss-online` atau source non-POS.

**Cache-bust:** `revalidateOwnerDashboardCache()` → `revalidateTag('owner-dashboard')`
+ `revalidatePath('/dashboard/owner')` + `revalidatePath('/dashboard/mitra')`.
Dipanggil dari tombol refresh di view.

**Leaderboard (`lib/leaderboard.ts`):** agregasi per outlet → `omzet`, `orders`,
`aov`, `deltaPct` (vs `previousRange`), `total_qty`, `avg_daily_qty`, dan
`performance_tier` dari `getPerformanceTier(avgDailyQty)`:

| Rata-rata porsi/hari | Tier |
|---|---|
| ≤ 75 | PESIMIS |
| ≤ 150 | MODERAT |
| < 300 | PROGRESIF |
| ≥ 300 | OPTIMIS |

### 3.2 Laba Rugi — `/dashboard/owner/profit` (+ `/internal`, `/mitra`)

**View:** `owner/profit/ProfitView.tsx` (~1.900 baris), dipakai ketiga rute
dengan `scope` berbeda (`all` / `internal` / `mitra`).

**Masukan:** `useScopedFilter` · `useOutlets` · `useSalesDaily` · `useExpenses` ·
`useHpp` · `useWaste` · `useMitraInvestments`.

**Alur:**
1. Tentukan himpunan outlet dalam scope lewat `mitraOutletIds()` / `isInScope()`
   (§2.4), buang outlet tes.
2. Per outlet: `computeOutletProfit(gross, deductions, hpp, expensesOutlet, waste)`.
3. Total perusahaan: `computeCompanyProfit(Σ laba outlet, pengeluaran pusat)` —
   biaya Pusat hanya ikut pada tampilan gabungan.
4. `NetProfitBreakdownModal` merender `buildProfitWaterfall(...)`, dan tiap baris
   beban menautkan ke Buku Kas lewat `bukuKasHref({from,to,outletId})`
   (`lib/bukuKasLink.ts`, parameter `from`/`to`/`outlet` — nama parameternya
   ditaruh di satu konstanta karena dibaca di dua tempat).
5. Ekspor: PDF/CSV lewat `app/actions/profitExport.ts` →
   `getProfitExportBreakdown(filter)`.

**Prorata OPEX (`lib/opexProrata.ts` + `hooks/useProratedOpex.ts`):** mengubah
beban tetap bulanan menjadi akrual harian proporsional **khusus pada bulan
berjalan**, supaya metrik harian/MTD tidak melonjak di akhir bulan.

- Kategori yang diprorata: Gaji Crew Outlet, Sewa Outlet, Internet.
- `getJakartaCurrentMonthInfo()` + `calculateMonthOverlap()` — kalau filter tidak
  beririsan dengan bulan berjalan, data riil dipakai 100% tanpa prorata.
- Baseline gaji per outlet dicari berurutan: `payroll_records` → master staf
  (`outlet_staff`/staff financials) → input riil di `expenses`.
- Sewa & Internet: rollover dari baseline bulan lalu bila bulan ini belum ada.
- Bonus crew bulanan: RPC `get_monthly_crew_bonus`.

### 3.3 Buku Kas (OPEX) — `/dashboard/reports/input-pengeluaran`

Halaman **pencatatan** (pasangan dari Analisis Pengeluaran yang menganalisis).

- Baca: `useExpenses(filter)` + `usePettyCashTopups(filter)`.
- Tulis: `ExpenseFormModal` → `useUpsertExpenses` → Server Action
  `upsertExpensesAction(items)`; impor massal `BulkImportModal` (XLSX) →
  `importExpensesAction(rows)`.
- Menerima parameter URL `from`/`to`/`outlet` (`BUKU_KAS_PARAMS`) sehingga tautan
  dari rincian laba bersih membawa serta periode & outlet yang sedang dilihat.
- Ekspor XLSX.

**Kategori (`lib/expenseCategories.ts`):**

| Kelompok | Isi |
|---|---|
| `OUTLET_CATEGORIES` (20) | pengeluaran_outlet, gaji_crew_outlet, bonus_leader, bonus_area_manager, lembur, ads, endorsement, promo, pdam, pln, internet, sewa_outlet, joint_expense, salary, bahan_baku, transport, utilitas, lainnya, bonus_crew, bonus_regional_manager |
| `PUSAT_CATEGORIES` | pengeluaran_global, gaji_staff_kantor |
| `INCOME_CATEGORIES` | pemasukan_lain, modal_awal, setoran_owner |

`deriveScope(category, outletId)` — ada `outlet_id` nyata → `outlet`; selain itu
kategori Pusat → `pusat`. Dua UUID sentinel (`ffffffff-…`, `00000000-…`)
diperlakukan sebagai "bukan outlet". `CATEGORY_META` memegang label/warna/ikon.

**`hooks/useExpenses.ts`** menggabungkan **dua** tabel:

| Sumber | Saringan penting |
|---|---|
| `expenses` | `.or('outlet_id.is.null,outlet_id.neq.<TEST>')` ⚠️ — `.neq()` polos bernilai NULL untuk baris ber-`outlet_id` NULL sehingga **membuang seluruh pengeluaran Pusat**; `.eq('type','expense')` ⚠️ — tabel ini juga menampung baris pemasukan |
| `petty_cash_expenses` | `.is('deleted_at', null)` (void lewat RPC tak dihitung, menyamakan dengan `get_petty_cash_balance()`); kategori dibatasi daftar putih |

⚠️ Daftar putih kategori petty cash **sengaja tidak memuat** kode lama
`overtime` dan `ads`: 14 baris Agustus–September memakainya dengan kategori
salah input, dan memasukkannya akan mengubah total yang sudah jadi dasar bagi
hasil. Enam kode baru (transport, pln, pdam, internet, lembur, endorsement)
aman karena nol baris historis. Keduanya dipaginasi (`petty_cash_expenses`
sendiri >1.400 baris/bulan).

### 3.4 Analisis Pengeluaran — `/dashboard/owner/expenses`

`useExpenses` + `useWaste`; irisan kategori dirender lewat
`withWasteSlice(slices, wasteValue)` sehingga "Kerugian Waste (otomatis)" tampil
sebagai kategori semu **tanpa** pernah ditulis ke tabel `expenses` (§2.6).
Kartu "Biaya Pusat" hanya muncul saat scope "Semua Outlet".

### 3.5 Kerugian Waste — `/dashboard/owner/waste`

**Sumber:** `useWasteSummary` (RPC `get_waste_summary_v2`) ·
`useWasteIncidents` (RPC `get_waste_incidents`, paginasi server 25/halaman) ·
`useBudgetLoss` (RPC `get_budget_loss_periode`) · `useSalesDaily` (penyebut
omzet) · `useWaste` (RPC `get_waste_periode`, total untuk laba).

**Kenapa dua RPC, bukan satu:** cap 1.000 baris PostgREST — total yang terpotong
lebih berbahaya daripada tidak ada total. `useWasteSummary` mengekspos
`truncated` bila hasil mentah mencapai 1.000, dan halaman menampilkan banner
peringatan alih-alih angka yang percaya diri tapi salah.

**Metrik (`lib/wasteMetrics.ts`, `lib/wasteGap.ts`, `lib/wasteBreakdown.ts`):**

| Fungsi | Aturan |
|---|---|
| `computeDeltaPct(cur, prev)` | `prev <= 0` → **null** (dirender "N/A"), bukan Infinity |
| `computeWastePctOmzet(nilai, omzet)` | `omzet <= 0` → null |
| `aggregateByBahanWithSpread(rows)` | ranking bahan + **sebaran outlet**: 1 outlet = masalah lokal (penyimpanan/shift), banyak outlet = sistemik (porsi resep/batch supplier) |
| `computeWasteGap(actual, budget)` | `gapPct = (actual−budget)/budget×100`; `budget === 0` → null |
| `aggregateByOutlet/Reason/Bahan/Date/BahanAndReason` | agregasi murni dari baris granular |
| `lib/wasteReasons.ts` | `normalizeReason`, `countFreeTextIncidents` |

⚠️ Penyebut omzet **harus** `useSalesDaily`, bukan `useSalesSummary` — yang
terakhir bersandar pada `useSalesHourlyRaw` yang tidak berpaginasi.

**Komponen:** `WasteKpiRow` · `WasteOutletRanking` · `WasteReasonBreakdown` ·
`WasteBahanRanking` · `WasteIncidentTable` · `WasteIncidentDetailModal`
(pelapor, penyetuju, foto bukti, jejak waktu lapor→approve).

⚠️ Modal detail melaporkan **keberadaan** baris ledger ("Potongan stok tercatat
(N baris)"), **tidak pernah** membandingkan qty laporan dengan qty ledger —
skala ledger bergantung `saldo_is_gram` per outlet sedangkan qty laporan selalu
satuan besar, jadi perbandingan langsung memicu alarm palsu di >50% baris.

### 3.6 Target & Pesan — `/dashboard/owner/targets`

`TargetsView.tsx`. Baca: `daily_sales_targets`, `owner_messages_overview`, RPC
`get_current_targets`. Tulis: RPC `set_daily_target`,
`clear_daily_target_override`, `send_owner_message` (tabel `owner_messages`).
Role read-only (mitra) menyembunyikan tombol simpan/hapus.

### 3.7 Budget Outlet — `/dashboard/budget-outlet`

`components/budget/BudgetOutletList` + Server Action `app/actions/budgetOutlet.ts`.

- `listOutletBudgets()` — `requireRole(['owner','admin'])`, **service client**,
  ambil outlet aktif (buang `marketplace`, buang nama mengandung `GUDANG`/
  `KANTOR PUSAT`), lalu per outlet panggil RPC `get_outlet_budget_status`.
- `setOutletBudgetConfig(outletId, nominal, periodType, customDays?)` — upsert
  `outlet_budget_config`. `periodType ∈ harian|mingguan|bulanan|custom`
  (`custom` wajib `customDays ≥ 1`).

⚠️ Dua hal yang ditegakkan kodenya: (a) `get_outlet_budget_status` di-GRANT ke
`service_role` **saja**, jadi action ini wajib service client — dan justru
karena itu wajib `requireRole`; (b) `effective_from` yang sudah ada
**dipertahankan** saat mengedit — reset ke hari ini akan diam-diam menggeser
jendela budget mingguan.

### 3.8 Petty Cash (Khusus) — `/dashboard/owner/petty-cash`

`getPettyCashData(filter, outlets)` di `ownerDashboard.ts`: menggabungkan
`expenses` petty cash dengan modal awal shift (`shifts.starting_cash`),
memetakan nama crew asli dari `outlet_staff`/`users`, menghasilkan
`transactions[]` + `dailySummaries[]` yang dirender `PettyCashReportView`.

### 3.9 Rekap Absensi (Stealth) — `/dashboard/owner/rekap-absensi`

`getAttendanceReportData(...)` → `AttendanceReportView` + `StealthPhotoModal`.
Nav: OWNER lewat pintu Laporan Internal, ADMIN lewat pintu Karyawan.
*(Halaman ini bersinggungan dengan HR tapi rutenya milik Owner; logika detail
absensinya di luar lingkup dokumen.)*

---

## 4. Modul: Penjualan & Kinerja

### 4.1 Rangkuman Penjualan — `/dashboard/reports/pos`

`reports/pos/page.tsx` (server: `outlets`) → `ReportsView.tsx` (~2.800 baris).

**Tabel yang dibaca:** `orders`, `menu_items`, `ecommerce_sales`,
`platform_settlements`, `shifts`, `petty_cash_topups`, `petty_cash_expenses`.

**Isi:**
- KPI lewat `computePosReportKpi` / `computeNetRevenueVoidAware` (§2.7).
- Filter cabang (`BranchFilter`, `MultiSelectDropdown`) dengan pemisahan
  outlet fisik vs marketplace (`splitOutletsByType`) — dropdown **"SS Online"**.
- Badge sumber pesanan (`OrderSourceBadge` + `resolveOrderSource`) dan badge
  promo terjadwal (`ScheduledPromoBadge`).
- Kartu **Settlement** + **Admin Settlement**: tersembunyi kecuali ada baris
  `platform_settlements` untuk filter terpilih. Untuk SS Online, query memakai
  **id outlet marketplace** (bukan literal `'ss-online'` yang bukan UUID).
- Ekspor PDF: `generateExecutiveItemReportPDF`, `generateCategorizedReportPDF`.

⚠️ `ReportsView.tsx` ada **kembar** di `apps/finance` dengan logika yang sama —
ubah keduanya bersamaan.

### 4.2 Target Harian — `/dashboard/reports/target-harian`

`useHistoricalTargets(filter)` (tabel `historical_daily_targets`, dikelompokkan
per tanggal) + `useSyncTargets()` → RPC `sync_missing_daily_targets`.
Snapshot otomatis dijalankan cron (§13).

### 4.3 Bonus Crew — `/dashboard/reports/crew-bonus`

`useMonthlyBonusSummary`, `useMonthlyCrewBonus`, `useMonthlyAMBonus`,
`useMonthlyRMBonus` per (bulan, tahun). Read-only untuk role read-only.
*(Perhitungan bonusnya sendiri bersinggungan dengan HR — di luar lingkup.)*

### 4.4 Rekap Bulanan — `/dashboard/owner/rekap-bulanan`

`useSalesDaily` + `useExpenses` + `useHppByChannel(from,to)` +
`usePcsByChannel(from,to)` (view `menu_sales_scoped`) →
`buildBusinessReportRows()` (`lib/businessReport.ts`), dikelompokkan per
`groupChannel()` (§2.5). Periode memakai `monthRange(year, month)`.

### 4.5 Laporan Pembelian — `/dashboard/reports/pembelian`

View `pembelian_supplier_bulanan`. (Nav: ADMIN + PURCHASING.)

### 4.6 Selisih Stok — `/dashboard/reports/shrinkage`

Server component membaca `opname_item` → `ShrinkageView`.
⚠️ **Sengaja dilepas dari nav** atas permintaan owner — halamannya tetap ada dan
bisa dibuka lewat URL.

### 4.7 Void / Pembatalan — `/dashboard/reports/voids`

Server component (`orders`) → `VoidsView`, ditopang
`app/actions/cancellations.ts`:

- `getVoidOrders()` — baca sesi, tentukan scope: `area_manager`/`leader` dibatasi
  lewat `staff_outlets`; lalu **service client** membaca
  `cancellation_requests` berstatus pending beserta embed `orders`→`outlets`.
- `processVoidOrder(tokenId, 'approve'|'reject')` — cari request by `token`,
  tolak kalau statusnya bukan `pending`, dan ⚠️ **tolak bila
  `request.requested_by === user.id`** (pemohon tak boleh menyetujui
  pengajuannya sendiri). Lalu update `cancellation_requests.status` dan status
  `orders`.

---

## 5. Modul: Produk & Stok

Pintu **Produk & Stok** (ADMIN).

### 5.1 Monitoring Stok — `/dashboard/stok-monitoring`

Halaman tipis → `components/monitoring/SPVDashboard`.

**Query (`lib/queries/monitoring.ts`):**

| Fungsi | Isi |
|---|---|
| `fetchSPVMonitoringData()` | agregat stok seluruh outlet (scope lewat RPC `accessible_outlet_ids`) |
| `fetchLeaderMonitoringData()` | versi ter-scope leader |
| `fetchItemDetail(outletId, bahanBakuId)` | `monitoring_view_spv` + `bahan_baku` + riwayat `ledger_stok` + `opname_item` |
| `fetchRecentLedger(limit)` | feed pergerakan stok terbaru |

**Hooks (`hooks/useMonitoringData.ts`):** `useRecentLedger` (staleTime 10 dtk) ·
`useWasteToday` (20 dtk) · `useSPVMonitoringData` / `useLeaderMonitoringData`
(25 dtk) · `useMonitoringRealtime()` yang mendengar `stok_balance` +
`ledger_stok` → invalidate `['monitoring']`.

### 5.2 Master Bahan Baku — `/dashboard/bahan-baku`

Komponen: `BahanBakuTable`, `BahanBakuFilters`, `BahanBakuAddModal`,
`BahanBakuDetailModal`.

- Baca: `useBahanBakuHarga()` — `bahan_baku` + embed harga, staleTime 5 menit.
- Normalisasi & penyaringan: `lib/bahanBaku.ts` — `normalizeBahanBaku(raw)`
  (embed Supabase bisa object/array/null), `filterAndSortBahanBaku(rows, search, sortBy)`
  dengan `SortOption` nama/harga/kategori asc-desc, dan `parsePriceInput(raw)`.
- Tulis: `useBahanBakuHargaMutations()` — upsert `bahan_baku_harga`, update
  `bahan_baku`, unggah foto ke storage bucket `bahan-baku` (lalu simpan
  publicUrl), kelola `bahan_baku_sku` termasuk penandaan SKU default (set
  `is_default=false` massal dulu, lalu insert yang baru).
- Tambah bahan: Server Action `app/actions/bahanBakuActions.ts` →
  `createBahanBakuAction(input)`.
- Satuan PO: `lib/satuanPo.ts` `hitungFaktorPo(b)` — berapa satuan **kecil**
  dalam 1 satuan PO. ⚠️ **Mengembalikan `null` (bukan 1)** saat tak ada tingkat
  yang cocok; padanannya di `apps/stok` mengembalikan 1, dan untuk FOIL itu
  berarti diam-diam salah 48×.

### 5.3 Manajemen Resep — `/dashboard/resep` dan `/dashboard/resep/[menu_id]`

- Daftar: `menu_items` + `resep` + `sales_channels`.
- `HPPView` — `menu_items`/`resep`/`resep_item`.
- `HppDashboardView` & `OutletPricingView` — `menu_outlet_prices` per outlet.
- Editor: `ResepEditor.tsx` (`resep`, `resep_item`, `bahan_baku`,
  `menu_packages`) memakai `computeResepHpp()` (§2.8) untuk menampilkan
  subtotal per bahan, buffer, total HPP, margin, dan food cost secara langsung.

### 5.4 Detail Opname Outlet — `/dashboard/opname`

`opname/page.tsx` memilih outlet aktif, lalu Server Action
`opname/actions.ts` → `getOpnamesData(fromDate, toDate, outletId)`.
Modal rincian di halaman Monitoring Aktivitas memakai
`monitoring/actions.ts` → `getOpnameDetails(opnameId)`.

### 5.5 Manajemen Outlet — `/dashboard/outlets`

`OutletsView` + `OutletForm` + `OutletTable` + `OutletFilters` +
`DeleteOutletDialog` + `HardResetOutletCard`.

Server Action `outlets/actions.ts`:

| Action | Isi |
|---|---|
| `createOutlet(values)` | buat outlet baru |
| `updateOutlet(id, values)` | ubah |
| `softDeleteOutlet(id)` | nonaktifkan |
| `hardDeleteOutlet(id)` | hapus permanen |

Pendukung: `lib/parseLatLng.ts` (koordinat), `lib/slugify.ts`,
`hooks/useOutletMutations.ts` (invalidate `['outlets']`).

⚠️ `OWNER` dilempar keluar dari rute ini oleh route-guard (§1.2).

---

## 6. Modul: Pembelian (PO)

Pintu **Pembelian** (ADMIN, PURCHASING). Ini satu-satunya pintu yang dimiliki
role `PURCHASING`, dan role itu dikunci ke sana.

### 6.1 Status PO (`hooks/usePurchaseOrder.ts`)

```
draft → menunggu_approval_finance → dikirim_ke_supplier
      → sebagian_diterima / diterima_lengkap
      (atau dibatalkan)
```

### 6.2 Perlu Dibeli — `/dashboard/pembelian/perlu-dibeli`

`usePurchaseSuggestion()` membaca view `purchase_suggestion_spv` (embed
`bahan_baku` untuk satuan bertingkat), lalu `lib/purchase/suggestion.ts`:

```
lajuPerHari      = days_left > 0 ? stok / days_left : 0
kebutuhanPeriode = lajuPerHari × hariKedepan (default 7)
qty_saran        = max(0, round(threshold + permintaan_pending
                                + kebutuhanPeriode − stok − sudah_dipesan))

tingkat = 'mendesak'  bila stok < threshold ATAU days_left ≤ 3
        = 'menipis'   bila days_left ≤ 7
        = 'aman'      selain itu
```

`sortSuggestions()` mengurutkan mendesak → menipis → aman.

### 6.3 Purchase Order — `/dashboard/pembelian` & `/new` & `/[id]`

- Daftar: RPC `get_purchase_orders(p_from, p_to, p_status)` (default 30 hari
  terakhir) → `PembelianView`.
- Buat: `/new` — pilih supplier (`useSuppliers`, tabel `supplier`), pilih bahan
  (`useBahanBakuOptions`, prefill `harga_beli` master), lalu `useCreatePO()` →
  RPC `create_purchase_order(...)`, invalidate `['purchase-orders']`.
- Detail: `/[id]` (server prefetch `purchase_order` + `purchase_order_item`) →
  `PODetailView`:
  - `useUpdatePOStatus()` — update `purchase_order.status`.
  - `handleUploadInvoice` — unggah faktur (`useUploadInvoice`,
    `getSignedInvoiceUrl`).
  - `handlePriceSync(selectedBahanBakuIds)` — menyalin harga terima PO ke master
    lewat `useBahanBakuHargaMutations`.
  - Badge status pembayaran memakai peta `PAY_BADGE`.

⚠️ Kosakata `payment_status` yang sah: **`unpaid | pending | paid`**. Kata
`lunas` pernah lahir dari form dan membelah pembacaan utang; jangan dihidupkan
lagi. (`retail-gateway` memakai kata `lunas` untuk domain Xendit — beda urusan.)

`lib/purchase/predicates.ts` — `canComposePO(role)`, `canVerifyReceipt(role)`,
`canApprovePOFinance(role)`.
`lib/purchase/dueDate.ts` — `computeDueDate(arrivalISO, terminHari)`.

### 6.4 Permintaan Pembelian — `/dashboard/pembelian/permintaan`

`usePurchaseRequests()` (tabel `purchase_request`, staleTime 60 dtk) dan
`useRejectPr()` (set `status='ditolak'`).

### 6.5 Master Supplier — `/dashboard/pembelian/supplier`

Halaman besar (~1.500 baris): CRUD supplier (`nama`, `kontak`, `alamat`,
`kategori`, `termin_hari`, `bahan_baku_ids[]`, `is_active`) + ekspor CSV.

⚠️ Nama supplier **harus membedakan termin** (mis. "Lettuce (Pak Aziz) - Tempo
15/30") — salah pilih di dropdown PO menggeser jatuh tempo utang belasan hari.

### 6.6 Harga & Bahan Baku — `/dashboard/pembelian/harga`

- `usePOPriceAlerts()` — silang `purchase_order` × `purchase_order_item` ×
  `bahan_baku_harga` untuk menandai harga terima yang menyimpang dari master.
- `useHargaHistory(bahanBakuId)` — `bahan_baku_harga_history`.

### 6.7 Katalog Harga Vendor — `/dashboard/pembelian/katalog-vendor`

`useKatalogVendor()` (tabel `bahan_baku_supplier`) + `useKatalogVendorMutations()`,
dirender `components/katalog-vendor/*`.

**Aturan murni (`lib/katalogVendor.ts` + `lib/katalogGroup.ts`):**

⚠️ **Satu-satunya angka yang boleh dibandingkan antar vendor adalah harga per
SATUAN KECIL** — vendor bisa menota dalam kemasan berbeda.

| Fungsi | Isi |
|---|---|
| `konversiKeSatuanKecil(qty, isiSatuanKecil)` | |
| `bolehPrefill(baris)` | baris layak dipakai mengisi form PO |
| `setarakanHargaAntarVendor(rows)` | tambah `hargaPerSatuanKecil` + `selisihPersen` terhadap vendor sah termurah |
| `kelompokkanKatalog(rows)` | kelompokkan per bahan, bawa serta harga master per satuan kecil sebagai pembanding |
| `ringkasKatalog(kelompok)` | ringkasan layar |
| `parseAngkaId(teks)` | ⚠️ parser gaya Indonesia: "8.791" = delapan ribu…, bukan 8,791. Koma = desimal; pola `^\d{1,3}(\.\d{3})+$` = pemisah ribuan |
| `validasiBarisKatalog(input)` | cermin CHECK constraint DB; ⚠️ **NaN diperiksa terpisah** karena di Postgres `'NaN'::numeric > 0` bernilai true sehingga CHECK tidak menahannya |

---

## 7. Modul: POS Admin

Pintu **POS** (ADMIN).

### 7.1 Ringkasan POS — `/dashboard/pos-admin`

`AdminOverviewView` membaca `orders`, `ecommerce_sales`, view `sales_hourly_spv`;
grafik `OverviewAreaChart`.

### 7.2 Daftar Menu POS — `/dashboard/pos-admin/menu`

Server page menarik `menu_items`, `categories`, `outlets`, `sales_channels`,
`outlet_promos`, `kiosk_settings` → `MenuView` (+ `MenuPicker`, `MenuSearch`,
`OutletPicker`).

**Server Action `pos-admin/menu/actions.ts`:**

| Action | Isi |
|---|---|
| `saveMenuItem(form)` | simpan menu, termasuk `package_items_to_save[]` (komponen paket, dukungan `or_menu_item_id`) dan `available_outlets[]` |
| `toggleMenuAvailability(id, current)` | buka/tutup ketersediaan |
| `toggleMenuPublished(id, published)` | tayang di katalog |
| `toggleTampilDiApp(id, current)` | tayang di aplikasi pelanggan |
| `updateMenuChannelPrices(menuId, channelPrices)` | harga per kanal |
| `deleteMenuItem(id, imageUrl)` / `deleteAllMenuItems(items)` | hapus |
| `toggleGlobalSetting(key, newIds)` | setelan global berbasis daftar id |
| `retryMenuOnlineSync(id)` / `syncCategoryOnline(categoryId)` | sinkron ke Order Online (`order-online-sync.ts`) |

⚠️ Dua jebakan yang tercatat di kode:
1. **Jangan tambahkan baris "Aplikasi" ke tabel `sales_channels`.** Mode "Satu
   Harga Semua" menyapu seluruh baris `sales_channels` dan menulis satu harga ke
   tiap slug — baris "Aplikasi" akan membuat harga aplikasi ikut tertimpa tiap
   kali admin mengatur harga food apps. Slug `aplikasi` sengaja hidup hanya
   sebagai kunci di `menu_items.channel_prices`.
2. **`channel_prices` wajib digabung, bukan ditimpa** — menulis
   `{ aplikasi: … }` polos menghapus harga GoFood/GrabFood/ShopeeFood sekaligus.
   Semua penulisan lewat `gabungHargaChannel` (`lib/appRetail/hargaAplikasi.ts`).

### 7.3 Kategori Menu — `/dashboard/pos-admin/categories`

`CategoriesView` atas tabel `categories`.

### 7.4 Manajemen Promo — `/dashboard/pos-admin/promo`

Baca `promos`, `outlet_promos`, `menu_items`, `outlets` →
`PromoView` + `PromoDailyScheduleEditor`. Tulis lewat `savePromosAction(outlets, promos)`.

**Model penyimpanan (`lib/promoOutlets.ts`):** satu promo logis (kombinasi
`scope` + `menu_item_id`) tetap disimpan **satu baris PER OUTLET** — trigger Buy
X Get Y, pool kuota, dan channel realtime per-outlet semuanya bergantung pada
bentuk itu. Yang baru hanyalah kolom `is_assigned`: outlet yang tidak dipilih
barisnya tetap ada (riwayat & tautan order lama tidak hilang) tapi ditandai
tidak terpilih sekaligus dimatikan.

| Fungsi | Isi |
|---|---|
| `promoOutletKey(promo)` | identitas promo logis (sama persis dengan kunci upsert server) |
| `isRowAssigned(row)` | ⚠️ `null`/`undefined` dibaca **TERPILIH** — baris lama sebelum fitur ini tak boleh tiba-tiba hilang di kasir |
| `resolvePromoOutletIds(promo, outletIds)` | field tak diisi = **semua outlet aktif** (perilaku lama); daftar kosong yang dikirim **eksplisit** = admin belum memilih apa pun → dilaporkan kosong supaya bisa ditolak saat promo diaktifkan |
| `groupPromoRows(rows)` | kumpulkan baris jadi promo logis; urutan distabilkan karena PostgREST tak menjamin urutan |

**Jadwal (`lib/promoSchedule.ts`):** semua perbandingan memakai epoch ms dari
kolom `timestamptz`, jadi hasilnya sama di zona waktu perangkat mana pun.
Jadwal per tanggal (`PromoDaySchedule`) **mengalahkan** `daily_start_time`/
`daily_end_time` lama. Jendela lintas tengah malam ditangani eksplisit.
`getPromoStatus()` → `nonaktif | terjadwal | berjalan | berakhir`;
`validateSchedule()` memeriksa tiap sisi **independen** (sebelumnya tanggal
rusak lolos bila sisi lain kosong).

Di `savePromosAction`: menu reward Buy X Get Y diresolusi **di server** (cari
menu bernama "original ayam reguler" yang tersedia untuk outlet itu, urut id)
supaya semua outlet menerima `menu_id` yang sama dengan katalog POS dan tidak
bergantung state browser. Jadwal divalidasi ulang di server — Server Action
adalah endpoint POST publik.

### 7.5 Pengguna POS — `/dashboard/pos-admin/users`

`UsersView` atas `outlet_staff` + `outlets`.

### 7.6 Outlet POS — `/dashboard/pos-admin/outlets`

`upsertOutlet(data)` / `deleteOutlet(id)` (`pos-admin/outlets/actions.ts`).

### 7.7 Panduan Kiosk — `/dashboard/pos-admin/guides`

Tabel `guides`, aset ke storage bucket `kiosk-assets`.

### 7.8 Pengaturan POS — `/dashboard/pos-admin/settings`

Menulis `global_settings` lewat `POST /api/settings` (§13).

### 7.9 Bukti QRIS — `/dashboard/bukti-qris`

Baca `orders` + `payment_proofs`; menampilkan bukti dari storage bucket
`payment_proofs` (publicUrl).

---

## 8. Modul: App Retail

Pintu **App Retail** (OWNER, ADMIN). Mengendalikan aplikasi pelanggan lewat
`retail-gateway`.

| Rute | Isi |
|---|---|
| `/dashboard/app-retail` | Ringkasan: jumlah menu tayang (`menu_items.tampil_di_app`), outlet menyala (`outlets.app_enabled`), order aplikasi |
| `/dashboard/app-retail/menu` | Pengaturan Menu Aplikasi — tayang/tidak, foto & deskripsi app, harga aplikasi |
| `/dashboard/app-retail/outlet` | Outlet Aplikasi — `outlets.app_enabled`, satu-satunya gerbang antara outlet & pelanggan (`GET /api/v1/outlets` menyaring persis kolom itu) |
| `/dashboard/app-retail/banner` | Banner carousel & popup promo (`app_banners`) |
| `/dashboard/app-retail/splash` | Splash screen (`app_splash_setting`) |

**Server Action `app-retail/actions.ts`:** `toggleTayangDiApp` ·
`simpanDetailMenuApp` · `toggleOutletApp` · `simpanBanner` ·
`toggleBannerAktif` · `hapusBanner`.

**Aturan murni (`lib/appRetail/`):**

| Berkas | Isi |
|---|---|
| `hargaAplikasi.ts` | `SLUG_APLIKASI = 'aplikasi'`; `gabungHargaChannel()` — **gabung**, jangan timpa (§7.2) |
| `tampilanMenu.ts` | `namaKategori(mentah)`, `hargaAplikasiTampil(channelPrices)` |
| `kesiapanOutlet.ts` | `periksaKesiapanOutlet(outlet, jumlahMenuTayang)`; `PERINGATAN_NOL_MENU` = "Nol menu tayang — katalog akan kosong" |
| `bannerForm.ts` | `periksaBanner(input)`; slot `carousel|popup`; aksi ketukan **hanya** `tidak_ada|menu|menu_item` (bukan URL bebas) |
| `splashForm.ts` | durasi 1.000–5.000 ms, pilihan 1/2/3/4/5 detik; `periksaSplash`, `barisSplash` |
| `kompresGambar.ts` | `MAKS_SISI 1280`, mutu 0,82, lewati bila < 300 KB; `hitungDimensi`, `perluDiproses`, `namaHasil`, `kompresGambarBanner(file)` |
| `jumlahKueri.ts` | `bacaJumlah(hasil)` — ⚠️ **membedakan gagal-query dari nol sungguhan**; kegagalan dirender `—`, bukan `0`, di halaman yang tujuannya justru menjawab "kanal ini hidup atau tidak" |

Aset banner diunggah ke bucket `app-banners`.

⚠️ Toggle & harga aplikasi **juga** ada di layar menu POS (§7.2). Dua tempat,
satu kolom — membingungkan tapi tak bisa menghasilkan data yang bertengkar.

---

## 9. Modul: Kemitraan & Portal Mitra

### 9.1 Mesin kebijakan bagi hasil (`lib/mitraPolicy.ts`)

`resolveMitraPolicy({ periodFrom, isBep, legacyProfitSharingPct, legacyManagementFee })`

| Periode | BEP | Profit sharing | Management fee |
|---|---|---|---|
| ≥ **2026-09-01** | belum | **100% mitra** | **3% dari omzet kotor** |
| ≥ 2026-09-01 | sudah | **50 : 50** | **0%** |
| < 2026-09-01 | — | `legacyProfitSharingPct` (default 50) | `legacyManagementFee` (default 0) |

BEP = Total Pengembalian Modal ≥ Nilai Investasi.

### 9.2 Saklar settlement TikTok (`lib/mitraSettlementTiktok.ts`)

```ts
export const PAKAI_SETTLEMENT_TIKTOK = false   // DIMATIKAN 2026-09-14
```

⚠️ Isi `platform_settlements` untuk `tiktokgo` tidak bisa dipakai sebagai omzet:
pengisinya (`source_file = 'hermes_api_inject'`) menulis ULANG angka yang sama
dengan `tanggal` baru tiap ~3 hari. Karena baris kembar dijumlahkan sementara
HPP tetap dari order, omzet membengkak tanpa biaya pendamping. Saklar ini
**dipakai bersama** `actions/mitraPnl.ts` dan `actions/mitraRoi.ts` — jangan
disalin ke masing-masing berkas supaya keduanya tak bisa bersikap berbeda.
Nyalakan lagi hanya setelah pengisi diperbaiki **dan** baris kembar dibersihkan.

### 9.3 P&L Mitra (`app/actions/mitraPnl.ts`)

`getMitraComprehensivePnl(filter, selectedOutletId, allowedOutletIds)`:

1. Wajib sesi login; **`targetOutletIds` disaring ke `allowedOutletIds`** —
   mitra tak bisa meminta outlet yang bukan miliknya.
2. Rentang tanggal dipaku `+07:00`.
3. Periode Agustus 2026 memakai **data closing hasil audit**
   (`mitraPnlClosingData.ts`: `isAugust2026Period(from,to)`,
   `getMitraAugustClosing(outletId)`) — bukan hitungan ulang.
4. Keluaran: `summary` (gross, deductions, net, COGS, laba kotor, OPEX, waste,
   management fee, laba bersih, `mitraShare`, margin, `policyStatus`, `isBep`,
   `profitSharingActive`), `channels` (pos / foodApps{grab,gofood,shopeefood} /
   tiktok), `opex` (kategori + rincian petty cash vs bulanan), `investment`
   (modal, total dibagikan, %BEP, ROI).

`profitSharingActive === false` bila `mitra_investments.is_profit_sharing_active`
dimatikan owner.

### 9.4 ROI & akrual (`app/actions/mitraRoi.ts`)

- `SYSTEM_START_MONTH = '2026-08'` — awal data bagi hasil yang dihitung sistem.
- ⚠️ **`accrualStartMonth(transfers)`**: akrual dimulai dari bulan **setelah**
  transfer terakhir di `mitra_transfers.bulan`. Mengakru bulan yang transfernya
  sudah ada = menghitung uang yang sama dua kali.
- `getMitraRoiStats(outletId|'all', allowedOutletIds)` dan
  `getMitraRealtimeBepBreakdown(mitraOutletIds)`.

### 9.5 Dashboard Kemitraan — `/dashboard/owner/kelola-mitra`

(OWNER lewat pintu Kemitraan; ADMIN lewat pintu Laporan Internal.)

Baca: `mitra_profiles`, `mitra_investments`, `mitra_transfers`,
`mitra_suggestions`, `outlets`, `outlet_staff`.

Server Action `owner/kelola-mitra/actions.ts`:

| Action | Isi |
|---|---|
| `upsertMitraProfile(data)` | profil mitra |
| `upsertInvestasi({outlet_id, nilai_investasi, tanggal_mulai, catatan})` | nilai investasi |
| `saveMitraTransfer({outlet_id, bulan, nominal, bukti_url, catatan})` | catat transfer bagi hasil + bukti |
| `deleteMitraTransfer(id, buktiUrl?)` | hapus transfer + berkas |
| `balasSaran({saran_id, tanggapan, user_id})` | balas saran mitra |
| `deleteSaran(saranId)` | hapus saran |

Impor massal investasi: `app/actions/bulkInvestments.ts` →
`bulkUpdateMitraInvestmentsAction([{outlet_id, nilai_investasi, omzet_historis}])`
(dipakai `BulkInvestasiModal`).

### 9.6 Portal Mitra — `/dashboard/mitra/*` (role MITRA, read-only)

| Rute | Isi |
|---|---|
| `/dashboard/mitra` | Dashboard Saya — investasi, transfer, saran, order, P&L (`MitraProfitLossSection`) |
| `/dashboard/mitra/orderan` | Riwayat orderan |
| `/dashboard/mitra/transfer` | Bukti transfer (storage bucket `mitra-transfers`) |
| `/dashboard/mitra/tim` | Tim outlet (`outlet_staff`) |
| `/dashboard/mitra/saran` | Saran & kritik (`mitra_suggestions`) |

Pendukung: `mitra/layout.tsx` (`mitra_profiles` + `outlets`),
`MitraOutletContext`, `MitraOutletInfo`, `MitraBiodataModal`, dan Server Action
`app/actions/mitraProfile.ts` (`getMitraBiodata`, `upsertMitraProfileFull`).

⚠️ Isolasi mitra ditegakkan **berlapis**: route-guard (§1.2) +
`useScopedFilter` yang mengunci `outletId` (§2.2) + `allowedOutletIds` di sisi
server action (§9.3) + RLS/scoped views di DB.

---

## 10. Modul: Leader & Area Manager

### 10.1 Leader — `/dashboard/leader/*` (role LEADER)

Scope outlet leader diambil dari `staff_outlets` (many-to-many) dan/atau RPC
`accessible_outlet_ids`.

| Rute | Data |
|---|---|
| `/dashboard/leader` (Ringkasan) | `orders`, `attendance`, `shifts`, `petty_cash_topups`, `petty_cash_expenses`, `inventory_batches`, RPC `get_petty_cash_balance` |
| `/dashboard/leader/sales` | `orders`, `order_items`, `historical_daily_targets` |
| `/dashboard/leader/stock` | `inventory_items`, `inventory_batches`, `inventory_units` |
| `/dashboard/leader/petty-cash` | lihat §11 |

### 10.2 Area Manager — `/dashboard/area-manager/petty-cash`

Satu-satunya rute yang boleh dibuka role `AREA_MANAGER` (route-guard §1.2).
Detailnya di §11.

---

## 11. Modul: Petty Cash (lintas role)

Ini satu alur yang melewati empat layar berbeda. Statusnya disimpan di
`petty_cash_topups.status`.

```
Leader mengajukan                → create_petty_cash_topup
   status: pending / forwarded_to_area_manager
        │
        ▼
Area Manager                     → area_manager_process_petty_cash(p_topup_id, 'approve'|'reject')
   approve → forwarded_to_finance        reject → rejected
        │
        ▼
Finance (pos-admin/petty-cash)   → processFinancePettyCash(...)
   status: approved_by_finance / forwarded_by_finance
        │
        ▼
Area Manager meneruskan dana     → area_manager_forward_funds(p_topup_id)
   status: forwarded_by_area_manager
        │
        ▼
Leader meneruskan ke crew        → leader_forward_funds(p_topup_id)
   status: forwarded_by_leader / completed
```

Layar yang terlibat:

| Layar | Role | Isi |
|---|---|---|
| `/dashboard/leader/petty-cash` | LEADER | ajukan top-up (`create_petty_cash_topup`), teruskan dana ke crew (`leader_forward_funds`) |
| `/dashboard/area-manager/petty-cash` | AREA_MANAGER | approve/reject, teruskan dana; saldo tiap outlet dari RPC `get_all_latest_petty_cash_balances`; filter riwayat per status. Server Action `getAreaManagerPettyCashTopups()` |
| `/dashboard/pos-admin/petty-cash` | ADMIN (finance) | `processFinancePettyCash(...)`, `forwardFinanceFunds(id)` |
| `/dashboard/petty-cash-balance` | ADMIN | Penyesuaian saldo — `petty_cash_adjustments`, `petty_cash_balance_history`, `shifts`; Server Action `adjustPettyCashBalance(input)` |
| `/dashboard/owner/petty-cash` | OWNER, ADMIN | laporan (§3.8) |

⚠️ Pengeluaran petty cash yang di-void (`deleted_at` terisi lewat RPC
`void_petty_cash_expense`) **tidak dihitung** di `useExpenses` — menyamakan
perilaku dengan `get_petty_cash_balance()` di DB.

---

## 12. Modul: Sistem, Migrasi Data & Integrasi

### 12.1 Monitoring Aktivitas — `/dashboard/monitoring`

Halaman besar (~900 baris) yang menarik banyak sumber sekaligus:
`outlets` (aktif, dengan `lat`/`lng`) · `outlet_staff` (role crew/leader/spv/
regional_manager/area_manager) · `staff_outlets` · `attendance` (**dipaginasi**
lewat `fetchAllPages`) · `checklist_categories` · `daily_checklist_records` +
`daily_checklist_ticks` · `opname` · `orders` (**dipaginasi**).

Komponen: `LiveLocationMap` (peta posisi outlet/staf), `OpnameDetailModal`
(Server Action `getOpnameDetails`), dan `LiveCameraPanel` (`camera_sessions`)
yang berada **di balik feature flag** — kodenya dipertahankan sementara rollout
ditunda.

### 12.2 Panduan Sistem — `/dashboard/panduan`

`panduan/page.tsx` → `/[system_code]` → `/[system_code]/[guide_id]`, tabel
`system_guides`. Server Action: `savePanduan`, `createPanduan`,
`deletePanduan(id, userId)`.

### 12.3 Pusat Notifikasi — `/dashboard/push-center`

Baca `push_subscriptions` (dikelompokkan per `app`), lalu kirim lewat
`POST {SUPABASE_URL}/functions/v1/send-push` (Edge Function).

### 12.4 Kesehatan Sistem — `/dashboard/system-health`

`useSystemHealth()` membaca view `system_health_latest` dan
`system_health_transitions`. `lib/healthStatus.ts` — `latestPerTarget(rows)` dan
`detectTransitions(rows)`. Komponen `AppHealthCard`, `InfraHealthCard`,
`IncidentTimeline`.

⚠️ View di atas `system_health_log` **wajib `security_invoker = true`** (RLS
tabelnya `is_admin()` only) — kalau definer, data health bocor ke non-admin.

### 12.5 Pengaturan Printer — `/dashboard/printer`

Halaman tipis → `components/printer/*`. Pustaka di `lib/printer/`:

| Berkas | Isi |
|---|---|
| `printLayout.ts` | tipe `PrintLayout`/`CustomerLayout`/`KitchenLayout`/`QrLayout` + `Typography`; `DEFAULT_PRINT_LAYOUT`; `mergePrintLayout`; `fetchPrintLayout` (tak pernah throw, fallback ke default) |
| `buildTemplateReceipt.ts` | susun struk untuk Uji Cetak |
| `escpos-encoder.ts` / `escpos-image.ts` | perintah ESC/POS termasuk raster logo (`GS v 0`), konversi canvas → bitmap monokrom |
| `bluetooth-printer.ts` / `printerStore.ts` | koneksi printer Bluetooth, **device-local** (localStorage), terpisah dari layout yang DB-backed |

Sumber kebenaran layout: satu baris `global_settings` dengan key `print_layout`.

⚠️ **Kolom `global_settings.value` bertipe TEXT, bukan JSONB** — nilainya
tersimpan sebagai string JSON berlapis. `mergePrintLayout` **wajib**
`JSON.parse` dulu bila `raw` bertipe string (dengan try/catch → default bila
korup). Tanpa itu, setelan tersimpan benar tapi tak pernah kepakai di struk.
Reader ini **terduplikasi** di `apps/pos-kasir` dan `apps/distribusi` — ketiganya
harus identik.

### 12.6 Migrasi Pawoon — `/dashboard/pawoon-import` (+ `/synced`, `/mapping`, `/profit`)

**Server Action `app/actions/pawoon.ts`** (semua ber-`requireRole(['admin','owner'])`,
memakai service client yang dibuat **lazy** — bukan top-level, supaya build
Next.js tidak crash "supabaseKey is required"):

| Action | Isi |
|---|---|
| `previewPawoonFile(formData)` | baca XLSX; muat `src/data/pawoon_item_map.json` (mapping item) dan `src/data/outlet_system_start_dates.json` (cutoff per outlet); cocokkan outlet |
| `syncPawoonData(orders, items, ordersToVoid)` | set `orders.status='cancelled'` untuk yang void (batch 100), lalu insert `orders` + `order_items` |
| `getMenuItemsForMapping()` / `updatePawoonMapping(newMappings)` | kelola mapping |
| `getOutletsForClear()` / `countPawoonDataForOutlet(...)` / `clearPawoonDataForOutlet(...)` | bersihkan data impor per outlet |

**Aturan baris produk (`lib/pawoonProduct.ts` — `resolvePawoonProductRow`):**

⚠️ Pawoon menulis modifier sebagai baris berawalan `+` di bawah produk induk,
dan ada **dua jenis**:

| Contoh | Harga | Perlakuan |
|---|---|---|
| `" + Tidak pedas"` | 0 | **dibuang** — catatan pesanan; qty-nya menggandakan qty induk, kalau ikut dicatat jumlah item terjual menggelembung |
| `" + EXTRA KEJU"` | 7.000 | **barang terjual**, ikut kolom Total struk |

Nilai dihitung dari `|harga| × |qty|` supaya baris void (bertanda negatif) tetap
dikenali sebagai modifier berbayar. Awalan `+` dibuang agar cocok dengan kunci
mapping ("EXTRA KEJU", "EXTRA KENTANG"). Dulu keduanya dibuang, dan akibatnya
`orders.total_amount` tidak pernah sama dengan jumlah `order_items`.

Halaman `/synced` (`orders`, `outlets`) memakai `SyncedFilters`; `/mapping`
(`MappingTable`) memetakan nama Pawoon → `menu_items`; `/profit` (`ProfitClient`)
menghitung laba data terimpor dari `orders` + `order_items`.
Urutan menu: `lib/pawoonMenuOrder.ts`.

### 12.7 Settlement Food Apps — `/dashboard/platform-settlement`

**Server Action `app/actions/platformSettlement.ts`:**

| Action | Isi |
|---|---|
| `previewSettlementFile(formData)` | pratinjau satu berkas |
| `previewAllSettlementFiles(formData)` | pratinjau banyak platform sekaligus → `MultiPlatformSummary` |
| `syncSettlementData(payload)` / `syncAllSettlementData(allDaily)` | tulis ke `platform_settlements` |

**Parser per platform (`lib/platformSettlement/`):** `gofood.ts`, `grabfood.ts`,
`shopeefood.ts`, `tiktokgo.ts` — masing-masing mengekspor `PlatformParser`.
Registry: `PLATFORM_PARSERS`, `PLATFORM_COMPARE_CHANNEL` (kanal pembanding di
data order), `PLATFORM_LIST`, `getParser(platform)`.

Util parsing (`types.ts`): `parseIdNumber` (angka gaya Indonesia),
`parsePlainNumber`, `parseSlashDate`, `parseTextDate`, `parseCsvText`.

`platform_settlements.platform` menerima juga `tiktok_shop` dan `shopee_shop`.

### 12.8 Data Validate — `/dashboard/data-validate`

Server page memuat outlet (`getOutletsForSelect()`) → `DataValidateClient`.

`data-validate/actions.ts` → `getDBDataForValidation(...)`:
- RPC `get_channel_validation_db_qty(...)` sebagai sumber utama, plus query
  `orders` sebagai pelengkap.
- ⚠️ Ada **WHITELIST nama menu (lowercase) per kanal** di kepala berkas — hanya
  item dalam daftar itu yang dihitung dari DB, supaya angka bisa dibandingkan
  dengan laporan platform yang cakupan menunya berbeda.

### 12.9 Impor Penjualan E-Commerce — `/dashboard/ecommerce/import-sales`

`ImportSalesView` membaca `ecommerce_channels` dan `ecommerce_entities`, lalu
mengirim ke `POST /api/ecommerce/import` (§13).

### 12.10 Integrasi Google Sheets

`lib/google-sheets-config.ts` + `lib/google-sheets-webhook.ts`, dikonfigurasi
lewat `GoogleSheetsSettingsModal`, diuji lewat
`GET /api/integrations/google-sheets/test`.

### 12.11 WhatsApp (WAHA) — `app/actions/waha.ts`

`getWahaStatus(config?)` dan `sendBulkWahaSalarySlips(...)` (slip gaji massal —
pemicunya ada di modul HR, di luar lingkup dokumen ini).
Helper: `lib/waha.ts`, komponen `BulkWAModal`.

### 12.12 Area Developer — `/developer/*`

Halaman terpisah dari `/dashboard`: `apikeys`, `orders` (`pos_sales` lewat
`developer/actions/orderActions.ts`), `system`, `users`
(`developer/actions/userActions.ts` atas `outlet_staff`).

### 12.13 Form publik — `/public/form-bahan-baku`

⚠️ Di bawah `/public/` sehingga **dibypass middleware auth** (§1.1). Server
Action `public/form-bahan-baku/actions.ts` menulis `bahan_baku` dan
`bahan_baku_sku` (termasuk `setDefaultBahanBakuSku`).

---

## 13. API Routes (HTTP)

| Route | Method | Otorisasi | Isi |
|---|---|---|---|
| `/api/users` | POST | sesi → `outlet_staff.role ∈ {admin, owner}` (403 selain itu) | buat akun staf; role yang diizinkan: crew, kitchen, kiosk, leader, regional_manager, area_manager, admin, admin_hr, admin_finance, purchasing, owner, mitra |
| `/api/users/[id]` | — | sesi | data staf + `attendance`, `attendance_logs`, `shifts`, `staff_financials`, `staff_outlets` |
| `/api/settings` | GET | service client (baca `global_settings`) | seluruh setelan sebagai objek `{key: value}` |
| `/api/settings` | POST | **`requireRole(['admin','owner'])`** | tulis `global_settings`; `brand_logo` base64 diunggah ke storage lalu disimpan sebagai URL |
| `/api/cron/record-target` | GET | `Bearer ${CRON_SECRET}` bila env terisi | RPC `snapshot_daily_targets` |
| `/api/ecommerce/import` | POST | ⚠️ **tidak ada cek role** | impor penjualan e-commerce |
| `/api/inventaris/photo` | — | — | unggah foto inventaris |
| `/api/integrations/google-sheets/test` | GET | — | uji koneksi webhook |
| `/api/v1/validation/tiktok-go/summary` | GET | header `x-api-key` = `VALIDATION_API_KEY` | ringkasan omzet per tanggal (WIB) dari `orders` |
| `/api/v1/validation/tiktok-go/transactions` | GET | idem | daftar transaksi |
| `/api/v1/validation/tiktok-go/settlement` | GET | idem | `platform_settlements` + `outlets` |

**Catatan `/api/users`.** Verifikasi memakai **client sesi (RLS), bukan service
client** — supaya cek otorisasi tetap jalan meski env service-role bermasalah,
dan errornya jelas di langkah yang benar.

**Catatan `/api/ecommerce/import`.** Alur: cari outlet GUDANG PUSAT
(`ilike '%gudang%'`) → petakan nama menu ke `menu_items` → buang order duplikat
→ insert `ecommerce_sales` + `ecommerce_sale_items`.

Bila `body.deduct_stock === true`: ambil `resep` aktif ber-`scope='global'`
untuk menu terjual, lalu `resep_item`, lalu tulis `ledger_stok` bertipe
`pemakaian` di **Gudang Pusat** dengan
`qty = −(qty_per_porsi × qtySold / faktor_konversi)`.

⚠️ Dua hal di route ini yang perlu diketahui siapa pun yang menyentuhnya:
(a) **tidak ada `requireRole`** — hanya modal service-role key;
(b) potongan stok memakai `faktor_konversi` dan **tidak** memeriksa
`saldo_is_gram` outlet tujuan, pola yang sama dengan kelas bug skala yang pernah
ditemukan di penulis `ledger_stok` lain.

---

## 14. Inventaris Server Action

Semua di `src/app/actions/` kecuali yang bertanda lokasi lain. Kolom "Guard"
adalah apa yang **benar-benar ada di kode**.

| Berkas | Export | Guard |
|---|---|---|
| `ownerDashboard.ts` | `getOwnerDashboardData`, `getOwnerDashboardDataFast`, `getBuyOneGetOneSummary`, `getPettyCashData`, `getAttendanceReportData`, `revalidateOwnerDashboardCache` | `resolveCallerScope()` (sesi + `accessible_outlet_ids`) |
| `menuSales.ts` | `getAggregatedMenuSales(filter)` | — |
| `profitExport.ts` | `getProfitExportBreakdown(filter)` | — |
| `expenses.ts` | `upsertExpensesAction(items)` | — |
| `importExpensesAction.ts` | `importExpensesAction(rows)` | — |
| `budgetOutlet.ts` | `listOutletBudgets`, `setOutletBudgetConfig` | **`requireRole(['owner','admin'])`** |
| `cancellations.ts` | `getVoidOrders`, `processVoidOrder` | sesi + scope `staff_outlets`; pemohon ≠ penyetuju |
| `users.ts` | `createStaffSync(values)`, `toggleStaffBonusEligibility` | **`requireRole(['admin','owner'])`** |
| `pawoon.ts` | `previewPawoonFile`, `syncPawoonData`, `getMenuItemsForMapping`, `updatePawoonMapping`, `getOutletsForClear`, `countPawoonDataForOutlet`, `clearPawoonDataForOutlet` | **`requireRole(['admin','owner'])`** |
| `platformSettlement.ts` | `previewSettlementFile`, `syncSettlementData`, `previewAllSettlementFiles`, `syncAllSettlementData` | — |
| `mitraPnl.ts` | `getMitraComprehensivePnl` | sesi + `allowedOutletIds` |
| `mitraPnlClosingData.ts` | `getMitraAugustClosing`, `isAugust2026Period` | data statis |
| `mitraRoi.ts` | `getMitraRoiStats`, `getMitraRealtimeBepBreakdown` | sesi |
| `mitraProfile.ts` | `getMitraBiodata`, `upsertMitraProfileFull` | sesi |
| `bulkInvestments.ts` | `bulkUpdateMitraInvestmentsAction` | — |
| `bahanBakuActions.ts` | `createBahanBakuAction` | — |
| `threshold.ts` | `updateThresholdAction(outletId, bahanBakuId, value)` | — |
| `inventory.ts` | `dispatchRequestAction`, `createRequestAction` | — |
| `waha.ts` | `sendBulkWahaSalarySlips`, `getWahaStatus` | — |
| `dashboard/app-retail/actions.ts` | 6 action (§8) | — |
| `dashboard/pos-admin/menu/actions.ts` | 10 action (§7.2) | — |
| `dashboard/pos-admin/promo/actions.ts` | `savePromosAction` | validasi jadwal di server |
| `dashboard/pos-admin/outlets/actions.ts` | `upsertOutlet`, `deleteOutlet` | — |
| `dashboard/pos-admin/petty-cash/actions.ts` | `processFinancePettyCash`, `forwardFinanceFunds` | — |
| `dashboard/outlets/actions.ts` | `createOutlet`, `updateOutlet`, `softDeleteOutlet`, `hardDeleteOutlet` | — |
| `dashboard/owner/kelola-mitra/actions.ts` | 6 action (§9.5) | — |
| `dashboard/petty-cash-balance/actions.ts` | `adjustPettyCashBalance` | — |
| `dashboard/area-manager/petty-cash/actions.ts` | `getAreaManagerPettyCashTopups` | — |
| `dashboard/opname/actions.ts` | `getOpnamesData` | — |
| `dashboard/monitoring/actions.ts` | `getOpnameDetails` | — |
| `dashboard/data-validate/actions.ts` | `getDBDataForValidation`, `getOutletsForSelect` | — |
| `dashboard/panduan/[system_code]/actions.ts` | `savePanduan`, `createPanduan`, `deletePanduan` | — |
| `public/form-bahan-baku/actions.ts` | tulis `bahan_baku`, `bahan_baku_sku` | ⚠️ rute publik |

⚠️ Baris ber-"—" **bukan berarti aman** — artinya tidak ada `requireRole` di
action itu. Bila action tersebut memakai service client, itu lubang otorisasi
kelas yang sama dengan temuan 2026-07-20; periksa satu per satu sebelum
menambah pemanggil baru.

---

## 15. Jebakan yang sudah terdokumentasi di kode

Ringkasan hal-hal yang paling mudah dilanggar tanpa error apa pun.

| # | Jebakan | Di mana |
|---|---|---|
| 1 | PostgREST memotong di 1.000 baris **tanpa error**; `.limit(5000)` tak menembus | §2.9 |
| 2 | Paginasi tanpa `ORDER BY` unik → baris ganda + terlewat | §2.9 |
| 3 | `orders.total_amount` **sudah net** — gross harus direkonstruksi | §2.7 |
| 4 | `.neq('outlet_id', X)` **membuang** baris ber-`outlet_id` NULL (= seluruh pengeluaran Pusat) | §3.3 |
| 5 | Tabel `expenses` juga menampung `type='income'` — wajib disaring | §3.3 |
| 6 | Waste adalah argumen terpisah; menulisnya ke `expenses` = terpotong dua kali | §2.6 |
| 7 | `global_settings.value` bertipe **TEXT**, bukan JSONB — wajib `JSON.parse` | §12.5 |
| 8 | Baris "Aplikasi" di `sales_channels` akan menimpa harga aplikasi | §7.2 |
| 9 | `channel_prices` wajib digabung, bukan ditimpa | §7.2 |
| 10 | `is_assigned` bernilai `null` = **TERPILIH** (baris promo lama) | §7.4 |
| 11 | `outlet_ids` promo yang tak diisi = semua outlet; yang kosong-eksplisit = belum memilih | §7.4 |
| 12 | Markup mitra 1,1× bergantung `isMitraOutlet` — aturan sempit = biaya hantu | §2.4, §2.8 |
| 13 | Akrual bagi hasil harus mulai **setelah** transfer terakhir | §9.4 |
| 14 | `PAKAI_SETTLEMENT_TIKTOK` dipakai bersama dua action — jangan disalin | §9.2 |
| 15 | Zona waktu perangkat ≠ WIB; semua konversi dipaku UTC+7 | §2.10 |
| 16 | `hitungFaktorPo` mengembalikan `null`, bukan 1 (padanan `apps/stok` beda) | §5.2 |
| 17 | `'NaN'::numeric > 0` = true di Postgres — CHECK tidak menahannya | §6.7 |
| 18 | Parser angka Indonesia: "8.791" ≠ 8,791 | §6.7 |
| 19 | Modifier Pawoon berharga 0 vs berbayar harus dibedakan | §12.6 |
| 20 | `ecommerce_sales.order_date` = tengah malam → wajib tiebreak `id` | §3.1 |
| 21 | `shopee` vs `shopee_shop`, `tiktok` vs `tiktok_shop` bukan hal yang sama | §2.5 |
| 22 | `useSalesHourlyRaw` tidak berpaginasi — jangan dipakai sebagai penyebut | §3.5 |
| 23 | Grup nav dipakai bersama antar-role | §1.5 |
| 24 | `'use server'` bukan privat — tiap export adalah endpoint POST | §1.4 |
| 25 | `ADMIN_HR` tak punya allowlist route di `RoleContext` | §1.2 |
| 26 | Kegagalan query harus dirender `—`, bukan `0` | §8 |
| 27 | `ReportsView.tsx` kembar di `apps/finance` | §4.1 |
| 28 | `printLayout.ts` kembar di `pos-kasir` & `distribusi` | §12.5 |

---

## Lampiran A — Peta hook → sumber data (non-HR)

| Hook | Sumber | staleTime |
|---|---|---|
| `useOutlets` | `outlets` (tanpa marketplace) | 5 m |
| `useSalesDaily` | view `sales_daily_scoped` + `ecommerce_sales` | periodCache |
| `useSalesHourlyRaw` | view `sales_hourly_scoped` | 2 m |
| `useSalesHourly` / `useSalesSummary` | turunan `useSalesHourlyRaw` | — |
| `useMenuSales` | action `getAggregatedMenuSales` | 2 m |
| `usePcsByChannel` | view `menu_sales_scoped` | 2 m |
| `useHpp` | `orders`/`order_items` + `menu_items` + `outlets` + `mitra_investments` | periodCache |
| `useHppByChannel` | hitungan per kanal | 2 m |
| `useExpenses` | `expenses` + `petty_cash_expenses` | periodCache |
| `useUpsertExpenses` | action `upsertExpensesAction` | — |
| `usePettyCashTopups` | `petty_cash_topups` | — |
| `useWaste` | RPC `get_waste_periode` | periodCache |
| `useWasteSummary` | RPC `get_waste_summary_v2` | 2 m |
| `useWasteBreakdown` | RPC `get_waste_breakdown` | 2 m |
| `useWasteIncidents` | RPC `get_waste_incidents` (25/hal) | 2 m |
| `useBudgetLoss` | RPC `get_budget_loss_periode` | 2 m |
| `useTargetProgress` | RPC `get_daily_target_progress_range` / view `daily_target_progress_scoped` | 15 dtk |
| `useHistoricalTargets` / `useSyncTargets` | `historical_daily_targets`, RPC `sync_missing_daily_targets` | 5 m |
| `usePurchaseOrders` / `usePODetail` | RPC `get_purchase_orders`, `purchase_order(_item)` | — |
| `useCreatePO` | RPC `create_purchase_order` | — |
| `useSuppliers` / `useBahanBakuOptions` | `supplier`, `bahan_baku` | — |
| `usePurchaseRequests` / `useRejectPr` | `purchase_request` | 60 dtk |
| `usePurchaseSuggestion` | view `purchase_suggestion_spv` | 2 m |
| `usePOPriceAlerts` | `purchase_order(_item)` + `bahan_baku_harga` | 5 m |
| `useKatalogVendor(+Mutations)` | `bahan_baku_supplier` | 60 dtk |
| `useBahanBakuHarga(+Mutations)` | `bahan_baku(_harga/_sku)`, storage `bahan-baku` | 5 m |
| `useHargaHistory` | `bahan_baku_harga_history` | 5 m |
| `useOutletThresholds(+Mutations)` | `bahan_baku`, `outlet_reorder_point` | — |
| `useMonitoringData.*` | `lib/queries/monitoring.ts` | 10–25 dtk |
| `useSystemHealth` | `system_health_latest/_transitions` | — |
| `useMitraInvestments` | `mitra_investments` + `mitra_transfers` | 5 m |
| `useOutletBudgetAdmin` | RPC budget outlet | 15 dtk |
| `useProratedOpex` | `payroll_records`, `outlet_staff`, `expenses`, RPC `get_monthly_crew_bonus` | 5 m – 1 j |
| `useSalesRealtime` / `useHrFinanceRealtime` / `useMonitoringRealtime` | `@suka/realtime` | — |

---

## Lampiran B — Peta pintu → rute (non-HR)

```
Laporan Internal (OWNER, ADMIN)
  /dashboard/owner                     Ringkasan Bisnis
  /dashboard/owner/petty-cash          Petty Cash (Khusus)
  /dashboard/owner/rekap-absensi       Rekap Absensi Stealth        [OWNER]
  /dashboard/owner/profit              Laba Rugi
    ├─ /internal                       Laba Rugi Internal
    └─ /mitra                          Laba Rugi Mitra
  /dashboard/reports/input-pengeluaran Buku Kas (OPEX)
  /dashboard/owner/expenses            Analisis Pengeluaran
  /dashboard/owner/waste               Kerugian Waste
  /dashboard/owner/targets             Target & Pesan
  /dashboard/budget-outlet             Budget Outlet
  /dashboard/owner/kelola-mitra        Dashboard Kemitraan          [ADMIN]

Penjualan & Kinerja (OWNER, ADMIN)
  /dashboard/reports/pos               Rangkuman Penjualan
  /dashboard/reports/target-harian     Target Harian
  /dashboard/reports/crew-bonus        Bonus Crew
  /dashboard/owner/rekap-bulanan       Rekap Bulanan
  (/dashboard/reports/shrinkage        Selisih Stok — TIDAK di nav)
  (/dashboard/reports/voids            Void — TIDAK di nav)

Produk & Stok (ADMIN)
  /dashboard/stok-monitoring · /bahan-baku · /resep · /opname · /outlets

Pembelian (ADMIN, PURCHASING)
  /dashboard/pembelian/perlu-dibeli · /pembelian · /pembelian/permintaan
  /pembelian/supplier · /pembelian/harga · /pembelian/katalog-vendor
  /dashboard/reports/pembelian

Kemitraan (OWNER)          /dashboard/owner/kelola-mitra
Portal Mitra (MITRA)       /dashboard/mitra{,/orderan,/transfer,/tim,/saran}
Leader (LEADER)            /dashboard/leader{,/petty-cash,/sales,/stock}
Area Manager               /dashboard/area-manager/petty-cash

POS (ADMIN)
  /dashboard/pos-admin{,/menu,/categories,/promo,/users,/settings}
  /dashboard/bukti-qris

App Retail (OWNER, ADMIN)
  /dashboard/app-retail{,/menu,/outlet,/banner,/splash}

Sistem (OWNER, ADMIN)
  /dashboard/monitoring · /panduan · /push-center · /petty-cash-balance
  /system-health · /printer · /pawoon-import{,/synced,/mapping}
  /platform-settlement · /data-validate

Migrasi Data (OWNER)
  /dashboard/pawoon-import{,/synced,/mapping} · /platform-settlement · /data-validate

Di luar nav
  /developer{,/apikeys,/orders,/system,/users}
  /public/form-bahan-baku              (bypass auth)
  /dashboard/inventory/{request,dispatch}
  /dashboard/kitchen/threshold · /dashboard/kelola-mitra
  /dashboard/ecommerce/import-sales · /dashboard/pawoon-import/profit
  /dashboard/area-manager{,/monitoring} · /dashboard/reports
```

---

**Catatan pemeliharaan:** dokumen ini disusun dari pembacaan kode, bukan dari
eksekusi. Bagian yang paling cepat basi adalah daftar rute (Lampiran B) dan
inventaris Server Action (§14) — keduanya bisa diregenerasi dengan
`find src/app -name page.tsx` dan
`grep -rn "^export async function" src/app/actions/*.ts src/app/dashboard/**/actions.ts`.
