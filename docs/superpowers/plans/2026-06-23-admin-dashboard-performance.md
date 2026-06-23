# Admin-Dashboard Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hilangkan refetch berlebihan & beban DB di admin-dashboard dengan caching policy konsisten, migrasi data-fetching ke React Query, dan agregasi di DB — tanpa mengganggu app lain.

**Architecture:** Semua server-state lewat React Query memakai satu factory client (`@/lib/supabase`). Hook agregat raw (`useEffect`+`useState`) dibungkus React Query tapi mempertahankan return shape `{ rows, loading, error }` agar consumer tak berubah. Agregasi per-jam dipindah dari client ke view DB baru `sales_hourly_spv` (aditif, tidak ALTER objek lama).

**Tech Stack:** Next.js 16, React 19, @tanstack/react-query v5, @supabase/supabase-js, Supabase (Postgres views), Vitest.

**Aturan isolasi (WAJIB):** Tidak mengubah `packages/auth`. DB hanya aditif (buat view baru, tidak ALTER/drop). Caching config hanya di `apps/admin-dashboard/src/app/Providers.tsx`. Verifikasi `yarn type-check` + `yarn build` di **root** sebelum selesai.

**Spec:** `docs/superpowers/specs/2026-06-23-admin-dashboard-performance-design.md`

---

## File Structure

| File | Tanggung jawab | Aksi |
|------|----------------|------|
| `src/app/Providers.tsx` | Default `QueryClient` (staleTime/gcTime/refetchOnWindowFocus) | Modify |
| `src/hooks/useOutlets.ts` | Master outlets cache (staleTime 5m) | Modify |
| `src/hooks/useStaff.ts` | Master staff cache (staleTime 5m) | Modify |
| `src/hooks/useSalesSummary.ts` | Agregat sales → React Query, shape `{rows,loading,error}` | Rewrite |
| `src/hooks/useMenuSales.ts` | Agregat menu → React Query | Rewrite |
| `src/hooks/useExpenses.ts` | Agregat expense → React Query | Rewrite |
| `src/hooks/useSalesHourly.ts` | Agregat per-jam → React Query + view DB | Rewrite |
| `src/app/dashboard/owner/profit/page.tsx` | Pakai `useOutlets` ganti fetch manual outlets | Modify |
| `src/app/dashboard/owner/page.tsx` | Konsolidasi client + outlets | Modify |
| `src/app/dashboard/owner/expenses/page.tsx` | Konsolidasi client + outlets | Modify |
| `supabase/migrations/20260623120000_sales_hourly_spv.sql` | View agregat per-jam | Create |

---

## Fase 0 — Konsolidasi Klien Supabase

### Task 0.1: Arahkan semua hook & page ke `createClient()` dari `@/lib/supabase`

**Files:**
- Modify: `src/hooks/useSalesSummary.ts`, `src/hooks/useMenuSales.ts`, `src/hooks/useExpenses.ts`, `src/hooks/useSalesHourly.ts`
- Modify: `src/app/dashboard/owner/profit/page.tsx`, `src/app/dashboard/owner/page.tsx`, `src/app/dashboard/owner/expenses/page.tsx`

> Catatan: `src/app/Providers.tsx` sengaja TETAP pakai `createSupabaseBrowserClient()` (di-pass ke `AuthProvider`) — itu memang konsumen sah dari `@suka/auth`. `src/lib/supabase.ts` juga tetap (ia yang mendelegasikan).

- [ ] **Step 1: Ganti import di tiap hook**

Di keempat hook, ganti:
```ts
import { createSupabaseBrowserClient } from '@suka/auth'
// ...
const supabase = useMemo(() => createSupabaseBrowserClient(), [])
```
menjadi:
```ts
import { createClient } from '@/lib/supabase'
// ...
const supabase = useMemo(() => createClient(), [])
```

- [ ] **Step 2: Ganti import di 3 page owner**

Di `owner/profit`, `owner/page`, `owner/expenses`, ganti pemanggilan `createSupabaseBrowserClient()` jadi `createClient()` (import dari `@/lib/supabase`). (Fetch outlets manual akan dibereskan di Fase 2; di sini cukup ganti factory.)

- [ ] **Step 3: Verifikasi tak ada sisa**

Run: `cd apps/admin-dashboard && grep -rn "createSupabaseBrowserClient" src`
Expected: hanya muncul di `src/app/Providers.tsx` dan `src/lib/supabase.ts`.

- [ ] **Step 4: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src
git commit -m "refactor(admin-dashboard): konsolidasi ke satu factory client supabase (Fase 0)"
```

---

## Fase 1 — Caching Policy

### Task 1.1: Set default QueryClient

**Files:**
- Modify: `src/app/Providers.tsx:19`

- [ ] **Step 1: Set default options**

Ganti:
```ts
const queryClient = useMemo(() => new QueryClient(), [])
```
menjadi:
```ts
const queryClient = useMemo(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          gcTime: 5 * 60_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    }),
  [],
)
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/app/Providers.tsx
git commit -m "perf(admin-dashboard): default caching policy QueryClient (Fase 1)"
```

### Task 1.2: staleTime master pada useOutlets & useStaff

**Files:**
- Modify: `src/hooks/useOutlets.ts`, `src/hooks/useStaff.ts`

- [ ] **Step 1: Tambah staleTime 5 menit di useOutlets**

Di objek `useQuery`, tambahkan setelah `queryFn`:
```ts
    staleTime: 5 * 60_000,
```

- [ ] **Step 2: Tambah staleTime 5 menit di useStaff**

Sama: tambah `staleTime: 5 * 60_000,` ke objek `useQuery`.

- [ ] **Step 3: Type-check + commit**

```bash
cd apps/admin-dashboard && yarn type-check
git add apps/admin-dashboard/src/hooks/useOutlets.ts apps/admin-dashboard/src/hooks/useStaff.ts
git commit -m "perf(admin-dashboard): staleTime 5m untuk master outlets & staff (Fase 1)"
```

---

## Fase 2 — Migrasi raw-hook ke React Query

> Pola: bungkus `useQuery`, map ke `{ rows, loading, error }` agar consumer tak berubah. queryKey berisi seluruh filter.

### Task 2.1: useSalesSummary → React Query

**Files:**
- Rewrite: `src/hooks/useSalesSummary.ts`

- [ ] **Step 1: Tulis ulang hook**

```ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SalesSummaryRow, PeriodFilterValue } from '@/lib/types'

export function useSalesSummary(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<SalesSummaryRow[]>({
    queryKey: ['sales-summary', filter.from, filter.to, filter.outletId, filter.source],
    queryFn: async () => {
      let q = supabase
        .from('sales_summary_spv')
        .select('outlet_id, outlet_name, sales_date, sales_source, omzet, jumlah_order_completed')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as SalesSummaryRow[]
    },
    staleTime: 2 * 60_000,
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

> Jika kolom di `SalesSummaryRow` berbeda, sesuaikan daftar `select` agar cocok dengan `src/lib/types.ts`. Jangan pakai `select('*')`.

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors (consumer pakai `.rows/.loading/.error` — tak berubah).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useSalesSummary.ts
git commit -m "perf(admin-dashboard): useSalesSummary pakai React Query + kolom eksplisit (Fase 2)"
```

### Task 2.2: useMenuSales → React Query

**Files:**
- Rewrite: `src/hooks/useMenuSales.ts`

- [ ] **Step 1: Tulis ulang hook (pola sama)**

```ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { MenuSalesRow, PeriodFilterValue } from '@/lib/types'

export function useMenuSales(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<MenuSalesRow[]>({
    queryKey: ['menu-sales', filter.from, filter.to, filter.outletId, filter.source],
    queryFn: async () => {
      let q = supabase
        .from('menu_sales_spv')
        .select('outlet_id, outlet_name, sales_date, sales_source, menu_name, qty, omzet')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as MenuSalesRow[]
    },
    staleTime: 2 * 60_000,
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

> Sesuaikan daftar kolom `select` dengan `MenuSalesRow` di `src/lib/types.ts`.

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/admin-dashboard && yarn type-check
git add apps/admin-dashboard/src/hooks/useMenuSales.ts
git commit -m "perf(admin-dashboard): useMenuSales pakai React Query (Fase 2)"
```

### Task 2.3: useExpenses → React Query

**Files:**
- Rewrite: `src/hooks/useExpenses.ts`

- [ ] **Step 1: Tulis ulang hook (pertahankan tipe ExpenseRow yang sudah diexport)**

```ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface ExpenseRow {
  id: string
  outlet_id: string
  outlet_name: string
  category: 'bahan_baku' | 'gaji' | 'operasional' | 'sewa' | 'utilitas' | 'lainnya'
  amount: number
  description: string
  expense_date: string
}

export function useExpenses(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<ExpenseRow[]>({
    queryKey: ['expenses', filter.from, filter.to, filter.outletId],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, outlets(name)')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((row: any) => ({
        id: row.id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlets?.name ?? 'Outlet Tidak Dikenal',
        category: row.category,
        amount: Number(row.amount),
        description: row.description,
        expense_date: row.expense_date,
      })) as ExpenseRow[]
    },
    staleTime: 2 * 60_000,
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd apps/admin-dashboard && yarn type-check
git add apps/admin-dashboard/src/hooks/useExpenses.ts
git commit -m "perf(admin-dashboard): useExpenses pakai React Query (Fase 2)"
```

### Task 2.4: Hilangkan fetch outlets duplikat di owner pages

**Files:**
- Modify: `src/app/dashboard/owner/profit/page.tsx`, `src/app/dashboard/owner/page.tsx`, `src/app/dashboard/owner/expenses/page.tsx`

- [ ] **Step 1: Ganti fetch manual outlets dgn useOutlets di profit page**

Hapus blok:
```ts
const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([])
useEffect(() => {
  supabase.from('outlets').select('id,name').order('name').then(({ data }) => setOutlets(data ?? []))
}, [supabase])
```
Ganti dengan:
```ts
import { useOutlets } from '@/hooks/useOutlets'
// ...
const { data: outlets = [] } = useOutlets()
```
(`useOutlets` mengembalikan `Outlet[]` dengan field `id` & `name` — kompatibel dengan pemakaian `outlets.forEach(o => map.set(o.id, { name: o.name, ... }))`.)

- [ ] **Step 2: Ulangi untuk owner/page.tsx & owner/expenses/page.tsx jika ada pola fetch outlets manual yang sama**

Cari di tiap file: `grep -n "from('outlets')" <file>`. Jika ada untuk dropdown/breakdown, ganti ke `useOutlets()`.

- [ ] **Step 3: Type-check + smoke + commit**

```bash
cd apps/admin-dashboard && yarn type-check
git add apps/admin-dashboard/src/app/dashboard/owner
git commit -m "perf(admin-dashboard): reuse useOutlets, hapus fetch outlets duplikat (Fase 2)"
```

---

## Fase 3 — Query Layer DB

### Task 3.1: View `sales_hourly_spv` (agregasi per-jam di DB)

**Files:**
- Create: `supabase/migrations/20260623120000_sales_hourly_spv.sql`

- [ ] **Step 1: Tulis migration (aditif — CREATE VIEW saja, tidak ALTER objek lain)**

```sql
-- Agregasi penjualan per jam (Asia/Jakarta) dari orders completed.
-- Aditif: view BARU, tidak mengubah objek existing. Definer/security_barrier
-- mengikuti pola view _spv lain agar SPV/admin lihat lintas outlet.
create or replace view public.sales_hourly_spv
with (security_barrier = true) as
select
  o.outlet_id,
  o.sales_source,
  (o.created_at at time zone 'Asia/Jakarta')::date as sales_date,
  extract(hour from (o.created_at at time zone 'Asia/Jakarta'))::int as sales_hour,
  sum(o.total_amount)::numeric as omzet,
  count(*)::int as jumlah_order_completed
from public.orders o
where o.status = 'completed'
group by 1, 2, 3, 4;

grant select on public.sales_hourly_spv to authenticated;
```

> Verifikasi nama kolom `orders` (`outlet_id`, `sales_source`, `created_at`, `total_amount`, `status`) cocok dengan yang dipakai `useSalesHourly` lama sebelum push.

- [ ] **Step 2: Cek drift lalu push (lihat memory supabase-migration-history-drift)**

Run: `supabase migration list`
Jika drift → `supabase migration repair --status applied <timestamp>` dulu, baru:
Run: `supabase db push`
Expected: migration `20260623120000` applied, tak ada error.

- [ ] **Step 3: Validasi angka view vs agregasi client lama**

Jalankan query manual untuk satu rentang & outlet, bandingkan `omzet`/`jumlah_order_completed` per jam dengan hasil lama. Harus identik.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623120000_sales_hourly_spv.sql
git commit -m "feat(db): view sales_hourly_spv untuk agregasi penjualan per jam (Fase 3)"
```

### Task 3.2: useSalesHourly pakai view (stop tarik raw orders)

**Files:**
- Rewrite: `src/hooks/useSalesHourly.ts`

- [ ] **Step 1: Tulis ulang hook**

```ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export interface SalesHourlyRow {
  sales_hour: number
  omzet: number
  jumlah_order_completed: number
}

export function useSalesHourly(filter: PeriodFilterValue) {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<SalesHourlyRow[]>({
    queryKey: ['sales-hourly', filter.from, filter.to, filter.outletId, filter.source],
    queryFn: async () => {
      let q = supabase
        .from('sales_hourly_spv')
        .select('sales_hour, omzet, jumlah_order_completed')
        .gte('sales_date', filter.from)
        .lte('sales_date', filter.to)
      if (filter.outletId !== 'all') q = q.eq('outlet_id', filter.outletId)
      if (filter.source !== 'all') q = q.eq('sales_source', filter.source)
      const { data, error } = await q
      if (error) throw error
      // Gabungkan baris lintas tanggal/outlet jadi 24 bucket jam.
      const hourMap = new Map<number, SalesHourlyRow>()
      for (let i = 0; i < 24; i++) hourMap.set(i, { sales_hour: i, omzet: 0, jumlah_order_completed: 0 })
      for (const r of (data ?? []) as any[]) {
        const b = hourMap.get(r.sales_hour)!
        b.omzet += Number(r.omzet)
        b.jumlah_order_completed += Number(r.jumlah_order_completed)
      }
      return Array.from(hourMap.values()).sort((a, b) => a.sales_hour - b.sales_hour)
    },
    staleTime: 2 * 60_000,
  })
  return { rows: query.data ?? [], loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Smoke test halaman yang pakai sales hourly**

Buka dashboard owner, cek chart per-jam tampil & cocok dengan sebelumnya.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useSalesHourly.ts
git commit -m "perf(admin-dashboard): useSalesHourly pakai view DB, stop tarik raw orders (Fase 3)"
```

---

## Verifikasi Akhir (lintas-app)

- [ ] **Step 1: Type-check root**

Run (dari root): `yarn type-check`
Expected: 0 errors di semua workspace.

- [ ] **Step 2: Build root**

Run (dari root): `yarn build`
Expected: semua app build sukses (bukti tak ada konsumen lain yang patah).

- [ ] **Step 3: Test admin-dashboard**

Run: `cd apps/admin-dashboard && yarn test`
Expected: semua test hijau (sesuaikan test yang mengasumsikan shape lama jika perlu).

- [ ] **Step 4: Smoke manual**

Buka owner / hr / profit / expenses / system-health. Ganti filter periode beberapa kali; pindah antar halaman lalu balik. Pastikan: tak ada error, dan kembali ke halaman yang sama tidak memicu loading penuh (bukti cache aktif).

---

## Self-Review Notes

- **Spec coverage:** masalah 1 (Task 1.1), 2 (Task 2.1–2.4, 3.2), 3 (Task 3.1–3.2), 4 (Task 2.4), 5 (kolom eksplisit di 2.1/2.2 + view), 6 (Task 0.1). ✔
- **Isolasi:** tak ada perubahan `packages/auth`; DB hanya CREATE VIEW; verifikasi build root. ✔
- **Return shape** `{ rows, loading, error }` dipertahankan di semua hook agregat → consumer tak berubah. ✔
