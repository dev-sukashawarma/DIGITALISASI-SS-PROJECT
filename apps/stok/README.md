# apps/stok — Stock Monitoring & Ledger

Aplikasi pemantauan stok & buku besar (ledger) untuk 19 outlet Suka Shawarma.
Stack: Next.js (App Router) + TypeScript + TailwindCSS v4 + Supabase. Auth lintas
subdomain via `@suka/auth` (SSO cookie `.sukashawarma.com`).

- **Dev:** `yarn dev` → http://localhost:3001
- **Build / type-check:** `yarn build` · `yarn type-check`
- **Produksi:** https://stok.sukashawarma.com (Node server cPanel — lihat bagian Deploy di `CLAUDE.md` root)

> Detail keputusan arsitektur (monitoring-live, RLS ledger, model outlet) ada di
> `CLAUDE.md` root. File ini fokus pada **peta halaman & komponen** app stok.

---

## Peta Route

| Route | Tipe | Render | Akses | Keterangan |
|-------|------|--------|-------|------------|
| `/login` | ƒ | `LoginPage` | publik | Login SSO |
| `/dashboard` | ƒ | `MonitoringPage` | crew/spv (role-based) | Beranda; crew lihat outlet sendiri, SPV lihat semua |
| `/stok/monitoring` | ƒ | `MonitoringDashboard` | semua login | Dashboard stok per outlet |
| `/stok/monitoring-live` | ƒ | `LiveMonitoringPage` | spv/manajemen | Papan TV real-time 18+ outlet (view-only) |
| `/stok/monitoring-live/[outlet-id]` | ƒ Dynamic | `DetailOutletMonitoring` | scoped | Drill-down detail per outlet |
| `/stok/ledger` | ƒ | `LedgerList` | scoped | Daftar pergerakan stok (filter Semua/Masuk/Keluar/Penyesuaian) |
| `/stok/ledger/[id]` | ƒ Dynamic | `LedgerDetail` | scoped | Detail satu baris ledger |
| `/stok/ledger/new` | ƒ | `ManualEntryForm` | crew/leader | Entri manual: waste / penyesuaian / transfer keluar |
| `/stok/opname` | ƒ | `OpnameList` | scoped | Daftar opname |
| `/stok/opname/[id]` | ƒ Dynamic | `OpnameDetail` | scoped | Detail opname + item |
| `/stok/opname/new` | ƒ | `OpnameForm` | crew/leader | Mulai opname baru |
| `/stok/permintaan` | ƒ | `PermintaanForm` + `PermintaanList` | crew (buat) / spv (approve) | Permintaan bahan ke kitchen |
| `/stok/settings/threshold` | ƒ | — | spv/admin | Atur reorder point per outlet/item |

**API internal:** `/api/health` (healthcheck), `/api/debug-permintaan` (debug, non-UI).

> ⚠️ Semua route `[param]` **harus** `ƒ Dynamic`. Jangan tambahkan
> `generateStaticParams()` yang mengembalikan `[]` — itu memaksa mode SSG dan
> membuat prefetch RSC untuk id dinamis balas **500** di produksi (lihat
> Session 2026-06-25 di `CLAUDE.md`).

---

## Komponen Inti

| Komponen | Lokasi | Peran |
|----------|--------|-------|
| `MonitoringPage` | `components/monitoring/MonitoringPage.tsx` | Router role-based crew vs SPV |
| `CrewDashboard` | `components/monitoring/CrewDashboard.tsx` | Beranda crew (Aksi Cepat + bottom nav) |
| `SPVDashboard` | `components/monitoring/SPVDashboard.tsx` | Dashboard SPV lintas outlet |
| `LiveMonitoringPage` | `components/monitoring/LiveMonitoringPage.tsx` | Papan TV operasional minimalist |
| `MonitoringDetailModal` | `components/monitoring/MonitoringDetailModal.tsx` | Modal detail item (ledger + discrepancy) |
| `ManualEntryForm` | `components/stok/ManualEntryForm.tsx` | Form entri ledger manual |
| `LedgerList` / `LedgerDetail` | `components/stok/` | Daftar & detail pergerakan |
| `OpnameForm` / `OpnameList` / `OpnameDetail` | `components/stok/` | Alur opname |
| `PermintaanForm` / `PermintaanList` | `components/permintaan/` | Permintaan bahan + approval |

---

## Data Layer

- **Hooks:** `useMonitoringData`, `useStokBalance`, `useLedger`, `useOpname`,
  `usePermintaan`, `useBahanBaku`, `useAutoRefresh` (`src/hooks/`).
- **Query helpers:** `src/lib/queries/monitoring.ts` (`fetchItemDetail`,
  `fetchOpnameStatus`, dll), `src/lib/queries/threshold.ts`.
- **Server actions:** `src/app/actions/permintaan.ts` (RPC `_svc` SECURITY DEFINER).
- **Supabase view (definer, bypass RLS untuk SPV):** `monitoring_view_spv`,
  `monitoring_view_crew`, `ledger_feed_spv`, `opname_compliance_view`.

### Catatan field (mudah keliru)
- `ledger_stok` kolomnya `tipe` & `catatan` (bukan `type`/`notes`). Bila konsumen
  mengharap `type`/`notes`, alias di select: `select('type:tipe, notes:catatan')`.
- `opname_item` **tak punya** `created_at`; untuk urut terbaru gunakan parent
  `opname` (`opname!inner(created_at)`).

---

## Aturan Validasi Penting

- **Entri ledger manual** (`ManualEntryForm`): tipe `adjustment` (penyesuaian) =
  delta **bertanda**, boleh negatif (asal ≠ 0). Tipe `waste` & `transfer_keluar`
  selalu kuantitas positif. `adjustment` wajib isi alasan (catatan).

---

## Konvensi

- **Tailwind v4:** `@import "tailwindcss"` + `@theme` palet `suka-*`. Hindari directive v3.
- **Tanggal:** hitung `new Date()`/`Date.now()` di `useEffect` (client-only) untuk
  hindari hydration mismatch.
- **Auth client:** gunakan `createSupabaseBrowserClient()` dari `@suka/auth`
  (cookieOptions ter-set). Jangan bikin factory client sendiri tanpa cookieOptions
  (writes jadi anon → RPC `auth.uid()=null`).
- **SSO:** `.env.local` tiap app wajib `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com`
  saat build, plus `SUPABASE_JWT_SECRET` di produksi.

---

**Owner:** Dev Suka Shawarma · Terakhir diperbarui: 2026-06-25
