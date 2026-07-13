# Stok Realtime Menyeluruh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semua permukaan `apps/stok` (monitoring, ledger, opname, permintaan, waste) update instan tanpa refresh halaman, memakai pola realtime yang sudah terbukti di `apps/absensi`.

**Architecture:** Port lib realtime murni (`createDebouncer`, `subsSignature`, `useRealtimeChannel`, `useRealtimeInvalidate`) dari `apps/absensi` ke `apps/stok`. Tambah migration yang memasukkan `ledger_stok`, `opname`, `opname_item`, `stok_waste_reports` ke publication `supabase_realtime` (`stok_balance` & `permintaan_bahan` sudah ada). Setiap hook/halaman subscribe ke tabel dasar dan invalidate React Query key yang relevan (atau memanggil ulang fetch manual untuk hook non-react-query), difilter RLS `accessible_outlet_ids()` yang sudah ada.

**Tech Stack:** Next.js App Router, React Query, Supabase Realtime (`postgres_changes`), Vitest.

**Deviasi dari spec** (`docs/superpowers/specs/2026-07-13-stok-realtime-design.md`): spec menyebut "hapus `useAutoRefresh.ts`". Selama riset plan ditemukan `useAutoRefresh` punya test coverage langsung (`useMonitoringData.test.tsx` baris 122-134) dan dipakai di 5 file test lain sebagai bagian dari shape mock. Menghapusnya berarti mengubah banyak test yang tak terkait realtime. Karena `enabled:false` sudah membuatnya inert (tidak pernah jalan), plan ini **membiarkannya apa adanya** dan menambahkan realtime sebagai mekanisme refresh yang baru & terpisah. Pembersihan `useAutoRefresh` bisa jadi task terpisah nanti.

---

### Task 1: Port primitive realtime (debounce + signature) + test

**Files:**
- Create: `apps/stok/src/lib/realtime/debounce.ts`
- Create: `apps/stok/src/lib/realtime/debounce.test.ts`
- Create: `apps/stok/src/lib/realtime/signature.ts`
- Create: `apps/stok/src/lib/realtime/signature.test.ts`

- [ ] **Step 1: Tulis `signature.ts`**

```ts
export function subsSignature(
  subs: { table: string; event?: string; filter?: string }[]
): string {
  return subs
    .map((s) => `${s.table}|${s.event ?? "*"}|${s.filter ?? ""}`)
    .join(";");
}
```

- [ ] **Step 2: Tulis `signature.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { subsSignature } from "./signature";

describe("subsSignature", () => {
  it("stabil untuk subs identik", () => {
    const a = subsSignature([{ table: "ledger_stok", filter: "outlet_id=eq.1" }]);
    const b = subsSignature([{ table: "ledger_stok", filter: "outlet_id=eq.1" }]);
    expect(a).toBe(b);
  });

  it("berubah saat filter berbeda", () => {
    const a = subsSignature([{ table: "ledger_stok", filter: "outlet_id=eq.1" }]);
    const b = subsSignature([{ table: "ledger_stok", filter: "outlet_id=eq.2" }]);
    expect(a).not.toBe(b);
  });

  it("default event '*' dan filter kosong", () => {
    expect(subsSignature([{ table: "x" }])).toBe("x|*|");
  });
});
```

- [ ] **Step 3: Tulis `debounce.ts`**

```ts
export function createDebouncer(waitMs: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    schedule(key: string, fn: () => void) {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          fn();
        }, waitMs)
      );
    },
    cancelAll() {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    },
  };
}
```

- [ ] **Step 4: Tulis `debounce.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncer } from "./debounce";

describe("createDebouncer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hanya menjalankan panggilan terakhir per key setelah wait", () => {
    const d = createDebouncer(200);
    const fn = vi.fn();
    d.schedule("a", fn);
    d.schedule("a", fn);
    d.schedule("a", fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("key berbeda dijalankan independen", () => {
    const d = createDebouncer(100);
    const a = vi.fn();
    const b = vi.fn();
    d.schedule("a", a);
    d.schedule("b", b);
    vi.advanceTimersByTime(100);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("cancelAll mencegah eksekusi tertunda", () => {
    const d = createDebouncer(100);
    const fn = vi.fn();
    d.schedule("a", fn);
    d.cancelAll();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Jalankan test**

Run: `cd apps/stok && yarn test src/lib/realtime`
Expected: 6 test lulus (3 signature + 3 debounce)

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/lib/realtime/debounce.ts apps/stok/src/lib/realtime/debounce.test.ts apps/stok/src/lib/realtime/signature.ts apps/stok/src/lib/realtime/signature.test.ts
git commit -m "feat(stok): port realtime debounce & signature primitives dari absensi"
```

---

### Task 2: Port hook realtime (`useRealtimeChannel` + `useRealtimeInvalidate`)

**Files:**
- Create: `apps/stok/src/lib/realtime/useRealtimeChannel.ts`
- Create: `apps/stok/src/lib/realtime/useRealtimeInvalidate.ts`

- [ ] **Step 1: Tulis `useRealtimeChannel.ts`**

```ts
'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { subsSignature } from './signature'

export type RealtimeSub = {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  handler: (payload: any) => void
}

export function useRealtimeChannel(opts: {
  channelName: string
  enabled?: boolean
  subs: RealtimeSub[]
}) {
  const { channelName, enabled = true, subs } = opts
  const supabase = useMemo(() => createClient(), [])

  // Simpan subs terbaru di ref supaya handler selalu fresh tanpa re-subscribe tiap render.
  const subsRef = useRef(subs)
  subsRef.current = subs

  // Re-subscribe hanya saat channelName/enabled/bentuk-subs (tabel|event|filter) berubah.
  const signature = subsSignature(subs)

  useEffect(() => {
    if (!enabled) return

    const channel = supabase.channel(channelName)
    subsRef.current.forEach((sub, idx) => {
      channel.on(
        'postgres_changes' as any,
        {
          event: sub.event ?? '*',
          schema: 'public',
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        (payload: any) => {
          // Pakai handler terbaru dari ref (indeks stabil karena signature memicu re-subscribe).
          subsRef.current[idx]?.handler(payload)
        }
      )
    })
    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, channelName, enabled, signature])
}
```

- [ ] **Step 2: Tulis `useRealtimeInvalidate.ts`**

```ts
'use client'

import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeChannel } from './useRealtimeChannel'
import { createDebouncer } from './debounce'

export type InvalidateSub = {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  queryKeys: unknown[][]
}

export function useRealtimeInvalidate(opts: {
  channelName: string
  enabled?: boolean
  subs: InvalidateSub[]
  debounceMs?: number
}) {
  const { channelName, enabled = true, subs, debounceMs = 500 } = opts
  const qc = useQueryClient()
  const debouncer = useMemo(() => createDebouncer(debounceMs), [debounceMs])

  useEffect(() => () => debouncer.cancelAll(), [debouncer])

  useRealtimeChannel({
    channelName,
    enabled,
    subs: subs.map((s) => ({
      table: s.table,
      event: s.event,
      filter: s.filter,
      handler: () => {
        s.queryKeys.forEach((qk) =>
          debouncer.schedule(JSON.stringify(qk), () =>
            qc.invalidateQueries({ queryKey: qk })
          )
        )
      },
    })),
  })
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error (file baru belum dipakai di manapun, tapi harus valid berdiri sendiri)

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/lib/realtime/useRealtimeChannel.ts apps/stok/src/lib/realtime/useRealtimeInvalidate.ts
git commit -m "feat(stok): port useRealtimeChannel & useRealtimeInvalidate dari absensi"
```

---

### Task 3: Migration — tambah tabel ke publication `supabase_realtime`

**Files:**
- Create: `supabase/migrations/20260713100000_stok_realtime_publication.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- Aktifkan realtime untuk apps/stok: ledger, opname, dan waste report saat ini
-- hanya polling/refresh manual. stok_balance & permintaan_bahan sudah ada di
-- publication (lihat 20260626110000 & 20260615000400) — tidak disentuh di sini.
--
-- Catatan biaya: menambah tabel ke publication menambah beban WAL decode
-- Realtime (lihat docs/PERFORMANCE.md). ledger_stok ditulis tiap transaksi
-- (order kasir dsb, 19 outlet) — trade-off sadar, diredam via debounce di
-- sisi client (lihat apps/stok/src/lib/realtime).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ledger_stok'
  ) then
    alter publication supabase_realtime add table public.ledger_stok;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opname'
  ) then
    alter publication supabase_realtime add table public.opname;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opname_item'
  ) then
    alter publication supabase_realtime add table public.opname_item;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stok_waste_reports'
  ) then
    alter publication supabase_realtime add table public.stok_waste_reports;
  end if;
end $$;

-- REPLICA IDENTITY FULL agar event UPDATE/DELETE ber-filter (mis. outlet_id,
-- reported_by) tetap lolos evaluasi filter Realtime & RLS (default identity
-- hanya membawa kolom primary key untuk OLD row).
alter table public.ledger_stok replica identity full;
alter table public.opname replica identity full;
alter table public.opname_item replica identity full;
alter table public.stok_waste_reports replica identity full;
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: migration `20260713100000_stok_realtime_publication` applied tanpa error. Kalau ada riwayat diverged, jalankan `supabase migration repair --status applied` untuk migration yang sudah ada secara fisik dulu (lihat `docs/superpowers/specs` gotcha migration drift), baru push ulang.

- [ ] **Step 3: Verifikasi di DB live**

Run (via `psql` atau Supabase SQL Editor):
```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname='public' and tablename in ('ledger_stok','opname','opname_item','stok_waste_reports');
```
Expected: 4 baris kembali (bukan cuma andalkan `migration list`, sesuai gotcha sesi 2026-07-08 — status "applied" tak selalu berarti efeknya benar-benar ada di DB).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260713100000_stok_realtime_publication.sql
git commit -m "feat(stok): tambahkan ledger_stok/opname/opname_item/stok_waste_reports ke publication realtime"
```

---

### Task 4: Mount `<Toaster />` + tambah dependency `sonner`

`WasteApprovalPage` dan `WasteModal` sudah memanggil `toast.success/toast.error` dari `sonner`, tapi tak pernah ada `<Toaster />` yang di-mount — toast selama ini tidak pernah muncul secara visual. Halaman baru "Riwayat Waste Saya" (Task 11) butuh toast ini benar-benar tampil.

**Files:**
- Modify: `apps/stok/package.json`
- Modify: `apps/stok/src/app/Providers.tsx`

- [ ] **Step 1: Tambah dependency `sonner`**

Di `apps/stok/package.json`, tambahkan ke `dependencies` (setelah `@tanstack/react-query`):

```json
    "@tanstack/react-query": "^5.101.0",
    "sonner": "^1.4.0"
```

- [ ] **Step 2: Install**

Run: `cd apps/stok && yarn install` (dari root monorepo: `yarn install`)
Expected: `sonner` ter-resolve tanpa error (sebelumnya hoisted dari app lain, sekarang dideklarasikan eksplisit)

- [ ] **Step 3: Mount `<Toaster />` di `Providers.tsx`**

Modify `apps/stok/src/app/Providers.tsx` — tambah import dan render:

```ts
import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { OutletScopeProvider } from '@/hooks/useOutletScope'
```

Lalu di dalam `return`, tambahkan `<Toaster richColors position="top-center" />` sebagai sibling pertama di dalam `AuthProvider` (setelah `<ErrorBoundary>` dibuka):

```tsx
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider supabase={supabase} initialStaff={initialStaff}>
          <Toaster richColors position="top-center" />
          <OutletScopeProvider>{children}</OutletScopeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
```

- [ ] **Step 4: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 5: Commit**

```bash
git add apps/stok/package.json apps/stok/src/app/Providers.tsx
git commit -m "fix(stok): mount Toaster sonner agar toast waste approval benar-benar tampil"
```

---

### Task 5: Hook realtime Monitoring (`useMonitoringRealtime`) + wire ke 3 dashboard

**Files:**
- Modify: `apps/stok/src/hooks/useMonitoringData.ts`
- Modify: `apps/stok/src/components/monitoring/LiveMonitoringPage.tsx`
- Modify: `apps/stok/src/components/monitoring/SPVDashboard.tsx`
- Modify: `apps/stok/src/components/monitoring/CrewDashboard.tsx`

Ini export **fungsi baru**, tidak mengubah `useSPVMonitoringData`/`useLeaderMonitoringData`/`useCrewMonitoringData` yang sudah ada (supaya test `useMonitoringData.test.tsx` yang sudah ada tetap hijau tanpa perlu mock Supabase client tambahan).

- [ ] **Step 1: Tambah `useMonitoringRealtime` di `useMonitoringData.ts`**

Tambahkan import di bagian atas file (setelah import `useAutoRefresh`):

```ts
import { useId } from 'react';
import { useRealtimeInvalidate } from '@/lib/realtime/useRealtimeInvalidate';
```

Tambahkan fungsi baru di akhir file:

```ts
/**
 * Realtime invalidation untuk seluruh query di bawah namespace ['monitoring'].
 * Dipanggil sekali per halaman dashboard (Monitoring-Live, SPV, Crew), bukan
 * per data-hook, supaya tidak membuka banyak channel duplikat untuk sumber
 * data yang sama. Debounce 2.5s karena ledger_stok/stok_balance bergerak
 * sangat sering saat outlet ramai (tiap order kasir).
 */
export function useMonitoringRealtime() {
  const instanceId = useId();
  useRealtimeInvalidate({
    channelName: `monitoring_realtime_${instanceId}`,
    debounceMs: 2500,
    subs: [
      { table: 'stok_balance', queryKeys: [['monitoring']] },
      { table: 'ledger_stok', queryKeys: [['monitoring']] },
    ],
  });
}
```

- [ ] **Step 2: Wire ke `LiveMonitoringPage.tsx`**

Tambah import dan panggilan di komponen (papan TV — tambah juga fallback poll 2 menit sebagai jaring pengaman karena board ini ditonton tanpa interaksi):

```ts
import { useSPVMonitoringData, useMonitoringRealtime } from '@/hooks/useMonitoringData';
```

Di dalam `export function LiveMonitoringPage()`, baris pertama setelah `const router = useRouter();`:

```ts
  useMonitoringRealtime();
  const { data, isLoading: isMonitoringLoading, refetch } = useSPVMonitoringData();
```

Lalu ubah query `outletsMaster` tak perlu diubah. Untuk fallback poll, ubah pemanggilan `useSPVMonitoringData()` di `useMonitoringData.ts` **tidak diubah** (tetap tanpa refetchInterval) — sebagai gantinya tambahkan fallback poll level-halaman di `LiveMonitoringPage.tsx` dengan `useEffect` + `setInterval(refetch, 120000)`:

```ts
  useEffect(() => {
    const id = setInterval(() => { refetch(); }, 120000);
    return () => clearInterval(id);
  }, [refetch]);
```

(letakkan setelah deklarasi `const isLoading = ...` yang sudah ada, pastikan `useEffect` sudah di-import — cek import React di baris 2, tambahkan `useEffect` bila belum ada)

- [ ] **Step 3: Wire ke `SPVDashboard.tsx`**

Tambah import:

```ts
import { useMonitoringRealtime } from '@/hooks/useMonitoringData';
```

Panggil di baris pertama dalam body komponen (sebelum `const spvQuery = useSPVMonitoringData(...)`):

```ts
  useMonitoringRealtime();
```

- [ ] **Step 4: Wire ke `CrewDashboard.tsx`**

Tambah import:

```ts
import { useCrewMonitoringData, useMonitoringRealtime } from '@/hooks/useMonitoringData';
```

Panggil di baris pertama dalam `export function CrewDashboard()` (sebelum `const { data, isLoading, ... } = useCrewMonitoringData();`):

```ts
  useMonitoringRealtime();
```

- [ ] **Step 5: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 6: Jalankan test monitoring yang sudah ada**

Run: `cd apps/stok && yarn test src/hooks/__tests__/useMonitoringData.test.tsx src/components/monitoring/__tests__`
Expected: semua test tetap hijau (mock `@/hooks/useMonitoringData` bersifat auto-mock tanpa factory, jadi `useMonitoringRealtime` otomatis jadi no-op `vi.fn()` di test-test komponen; test hook langsung tidak memanggil fungsi baru ini sama sekali)

- [ ] **Step 7: Commit**

```bash
git add apps/stok/src/hooks/useMonitoringData.ts apps/stok/src/components/monitoring/LiveMonitoringPage.tsx apps/stok/src/components/monitoring/SPVDashboard.tsx apps/stok/src/components/monitoring/CrewDashboard.tsx
git commit -m "feat(stok): realtime invalidate untuk monitoring dashboard (SPV/Leader/Crew/Live)"
```

---

### Task 6: Realtime Ledger & Riwayat Transaksi

**Files:**
- Modify: `apps/stok/src/hooks/useLedger.ts`

- [ ] **Step 1: Tambah realtime invalidate ke `useLedgerTransaksiList`**

Tambah import di atas file:

```ts
import { useId } from 'react'
import { useRealtimeInvalidate } from '@/lib/realtime/useRealtimeInvalidate'
```

Di dalam `export function useLedgerTransaksiList(outletId: string | null | undefined, page = 0) {`, setelah deklarasi `const { data, isLoading, error } = useQuery({...})` dan sebelum `return`, tambahkan:

```ts
  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `ledger_transaksi_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    debounceMs: 800,
    subs: [
      {
        table: 'ledger_stok',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['ledger-transaksi', outletId], ['ledger-transaksi-detail', outletId]],
      },
    ],
  })
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 3: Jalankan test terkait ledger**

Run: `cd apps/stok && yarn test src/components/stok/__tests__/LedgerList.test.tsx`
Expected: tetap hijau (test ini me-render komponen list, tidak memanggil hook langsung dengan Supabase asli — verifikasi tak ada regresi)

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/hooks/useLedger.ts
git commit -m "feat(stok): realtime invalidate riwayat ledger per outlet"
```

---

### Task 7: Realtime Opname

**Files:**
- Modify: `apps/stok/src/hooks/useOpname.ts`

- [ ] **Step 1: Tambah realtime invalidate ke `useOpnameList`**

Tambah import di atas file:

```ts
import { useId } from 'react'
import { useRealtimeInvalidate } from '@/lib/realtime/useRealtimeInvalidate'
```

Di dalam `export function useOpnameList(outletId: string | null | undefined) {`, setelah `const { data, isLoading } = useQuery({...})` dan sebelum `return`, tambahkan:

```ts
  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `opname_list_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    debounceMs: 800,
    subs: [
      { table: 'opname', filter: outletId ? `outlet_id=eq.${outletId}` : undefined, queryKeys: [['opname', outletId]] },
      { table: 'opname_item', queryKeys: [['opname', outletId]] },
    ],
  })
```

Catatan: `opname_item` tak punya kolom `outlet_id` (lihat gotcha sesi 2026-06-25 — relasinya lewat `opname_id`), jadi subscribe tanpa filter untuk tabel ini; volumenya rendah (hanya saat opname aktif diisi) jadi aman tanpa filter.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/hooks/useOpname.ts
git commit -m "feat(stok): realtime invalidate daftar opname per outlet"
```

---

### Task 8: Realtime Antrian Approval Permintaan Bahan

**Files:**
- Modify: `apps/stok/src/hooks/usePermintaan.ts`

- [ ] **Step 1: Tambah subscribe realtime ke `useApprovalList`**

Tambah import di atas file:

```ts
import { useId } from 'react'
```

(catatan: file ini sudah `import { useCallback, useEffect, useId, useState } from 'react'` — cek dulu, kalau `useId` sudah ada di baris 2 tidak perlu diubah. Berdasar baca file: baris 2 sudah `import { useCallback, useEffect, useId, useState } from 'react'` — **skip step ini**, `useId` sudah tersedia.)

Di dalam `export function useApprovalList() {`, setelah `const refresh = useCallback(...)` dan `useEffect(() => { setLoading(true); refresh() }, [refresh])` yang sudah ada, tambahkan subscription baru (pola sama seperti `usePermintaanList` di file yang sama):

```ts
  const instanceId = useId()
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`permintaan_approval_${instanceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'permintaan_bahan',
      }, () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh, instanceId])
```

Tidak difilter per-outlet karena approver (leader/SPV/kitchen) perlu melihat request dari semua outlet yang accessible baginya — RLS `permintaan_bahan` (via `accessible_outlet_ids()`) yang membatasi baris mana yang benar-benar terkirim ke client.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/hooks/usePermintaan.ts
git commit -m "feat(stok): realtime subscribe antrian approval permintaan bahan"
```

---

### Task 9: Realtime `useStokBalance` (ganti polling manual)

**Files:**
- Modify: `apps/stok/src/hooks/useStokBalance.ts`

- [ ] **Step 1: Ganti `setInterval` dengan realtime subscribe**

Ganti seluruh isi file jadi:

```ts
'use client'
import { useCallback, useEffect, useId, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { StokBalance } from '@/types/stok'

export function useStokBalance(outletId: string | undefined) {
  const [data, setData] = useState<StokBalance[]>([])
  const [loading, setLoading] = useState(true)
  const instanceId = useId()

  const fetchBalance = useCallback(async () => {
    if (!outletId) return
    const supabase = createClient()
    const { data } = await supabase.from('stok_balance').select('*').eq('outlet_id', outletId)
    setData((data as StokBalance[]) ?? [])
    setLoading(false)
  }, [outletId])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  useEffect(() => {
    if (!outletId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`stok_balance_${outletId}_${instanceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'stok_balance',
        filter: `outlet_id=eq.${outletId}`,
      }, () => { fetchBalance() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [outletId, instanceId, fetchBalance])

  return { balances: data, loading, refresh: fetchBalance }
}
```

Perubahan dari versi lama: hapus `REFRESH_MS`/`setInterval` polling 30 detik dan cek `navigator.onLine` manual (realtime channel Supabase sudah menangani reconnect sendiri); tambah subscribe `postgres_changes` di `stok_balance` filter outlet.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/hooks/useStokBalance.ts
git commit -m "feat(stok): ganti polling manual useStokBalance dengan realtime subscribe"
```

---

### Task 10: Realtime Antrian Approval Waste

**Files:**
- Modify: `apps/stok/src/app/stok/waste-approval/page.tsx`

- [ ] **Step 1: Tambah subscribe realtime**

Tambah import di atas file:

```ts
'use client'
import { useEffect, useId, useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { fetchPendingWasteReports, approveWasteReport, rejectWasteReport } from '@/app/actions/waste'
import { toast } from 'sonner'
import { useStokBalance } from '@/hooks/useStokBalance'
import { useAuth } from '@suka/auth'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeChannel } from '@/lib/realtime/useRealtimeChannel'
```

Di dalam `export default function WasteApprovalPage()`, setelah deklarasi `const { balances } = useStokBalance(outletId || '')` dan sebelum `const loadReports = async () => {...}`, tambahkan:

```ts
  const instanceId = useId()
  const queryClient = useQueryClient()
```

Setelah blok `useEffect(() => { loadReports() }, [])` yang sudah ada, tambahkan subscription baru:

```ts
  useRealtimeChannel({
    channelName: `waste_approval_${instanceId}`,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        handler: () => {
          loadReports()
          // SPVDashboard punya query React Query terpisah (['waste_pending_all'])
          // untuk badge jumlah pending — invalidate juga supaya tetap sinkron.
          queryClient.invalidateQueries({ queryKey: ['waste_pending_all'] })
        },
      },
    ],
  })
```

Tidak difilter per-outlet: approver (leader/SPV/kitchen) perlu melihat laporan waste baru dari semua outlet accessible-nya; RLS `waste_reports_read` (`accessible_outlet_ids()`) yang membatasi baris yang benar-benar terkirim.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 3: Jalankan test yang me-render halaman ini secara tidak langsung**

Run: `cd apps/stok && yarn test src/components/monitoring/__tests__/SPVDashboard.test.tsx`
Expected: tetap hijau. `WasteApprovalPage` dirender langsung (tak di-mock) di test ini — channel Supabase memakai env stub dari `vitest.setup.ts` dan WebSocket global jsdom, koneksi akan gagal secara async tanpa melempar error sinkron saat render. Kalau test ini gagal atau macet, mock `@/app/actions/waste` dan `@/lib/realtime/useRealtimeChannel` di `SPVDashboard.test.tsx` sebagai perbaikan (tambahkan `vi.mock('@/app/actions/waste', () => ({ fetchPendingWasteReports: vi.fn().mockResolvedValue([]) }))` di bagian atas file test).

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/app/stok/waste-approval/page.tsx
git commit -m "feat(stok): realtime subscribe antrian approval waste"
```

---

### Task 11: Halaman baru — Riwayat Waste Saya

**Files:**
- Modify: `apps/stok/src/types/stok.ts`
- Modify: `apps/stok/src/app/actions/waste.ts`
- Create: `apps/stok/src/app/stok/waste-history/page.tsx`

- [ ] **Step 1: Tambah type `WasteReport` di `types/stok.ts`**

Tambahkan di akhir file:

```ts
export type WasteStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export interface WasteReport {
  id: string; outlet_id: string; bahan_baku_id: string
  qty: number; reason: string; photo_url: string | null
  status: WasteStatus; rejection_reason: string | null
  reported_by: string | null; approved_by: string | null
  created_at: string; updated_at: string
  bahan_baku?: { nama: string; satuan: string } | null
}
```

- [ ] **Step 2: Tambah server action `fetchMyWasteReports` di `app/actions/waste.ts`**

Tambahkan di akhir file (setelah `countPendingWasteReports`):

```ts
export async function fetchMyWasteReports(staffId: string) {
  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('stok_waste_reports')
    .select('*, bahan_baku(nama, satuan)')
    .eq('reported_by', staffId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 3: Buat halaman `waste-history/page.tsx`**

```tsx
'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@suka/auth'
import { toast } from 'sonner'
import { Card } from '@suka/design-system'
import { fetchMyWasteReports } from '@/app/actions/waste'
import { useRealtimeChannel } from '@/lib/realtime/useRealtimeChannel'
import { BottomNav } from '@/components/common/BottomNav'
import type { WasteReport, WasteStatus } from '@/types/stok'

const STATUS_LABEL: Record<WasteStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
}

const STATUS_CLASS: Record<WasteStatus, string> = {
  PENDING: 'text-yellow-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
}

export default function WasteHistoryPage() {
  const { outletStaff } = useAuth()
  const staffId = outletStaff?.id
  const instanceId = useId()
  const [reports, setReports] = useState<WasteReport[]>([])
  const [loading, setLoading] = useState(true)
  const prevStatusRef = useRef<Map<string, WasteStatus>>(new Map())

  const load = async () => {
    if (!staffId) { setLoading(false); return }
    const data = await fetchMyWasteReports(staffId)
    const list = (data ?? []) as WasteReport[]

    list.forEach((r) => {
      const prev = prevStatusRef.current.get(r.id)
      if (prev === 'PENDING' && r.status === 'APPROVED') {
        toast.success(`Waste report ${r.bahan_baku?.nama ?? ''} disetujui`)
      } else if (prev === 'PENDING' && r.status === 'REJECTED') {
        toast.error(`Waste report ${r.bahan_baku?.nama ?? ''} ditolak`)
      }
    })
    prevStatusRef.current = new Map(list.map((r) => [r.id, r.status]))

    setReports(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [staffId])

  useRealtimeChannel({
    channelName: `waste_history_${staffId ?? 'anon'}_${instanceId}`,
    enabled: !!staffId,
    subs: [
      {
        table: 'stok_waste_reports',
        event: '*',
        filter: staffId ? `reported_by=eq.${staffId}` : undefined,
        handler: () => { load() },
      },
    ],
  })

  if (loading) return <div className="p-4">Memuat...</div>

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto pb-28">
      <h1 className="text-xl font-bold text-suka-brown">Riwayat Waste Saya</h1>

      {reports.length === 0 ? (
        <p className="text-gray-500 text-sm">Belum ada laporan waste.</p>
      ) : (
        reports.map((r) => (
          <Card key={r.id} className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{r.bahan_baku?.nama}</p>
                <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('id-ID')}</p>
              </div>
              <span className={`text-xs font-bold uppercase ${STATUS_CLASS[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <p className="text-sm text-gray-700">{r.qty} {r.bahan_baku?.satuan} — {r.reason}</p>
            {r.status === 'REJECTED' && r.rejection_reason && (
              <p className="text-xs text-red-600">Alasan ditolak: {r.rejection_reason}</p>
            )}
          </Card>
        ))
      )}

      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/types/stok.ts apps/stok/src/app/actions/waste.ts apps/stok/src/app/stok/waste-history/page.tsx
git commit -m "feat(stok): halaman Riwayat Waste Saya dengan realtime + toast status"
```

---

### Task 12: Entry point dari CrewDashboard

**Files:**
- Modify: `apps/stok/src/components/monitoring/CrewDashboard.tsx`

- [ ] **Step 1: Tambah link "Riwayat Waste Saya" di kedua dropdown menu (mobile & desktop)**

Di dropdown mobile (sekitar baris 96-105), tambahkan `<Link>` setelah tombol "Refresh Data" dan sebelum tombol "Keluar":

```tsx
                <button onClick={() => refetch()} className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  <RefreshCw size={12} /> Refresh Data
                </button>
                <Link href="/stok/waste-history" className="px-4 py-2.5 text-xs font-bold text-suka-brown hover:bg-suka-cream text-left flex items-center gap-2 transition-colors">
                  🗑️ Riwayat Waste Saya
                </Link>
                <button onClick={handleLogout} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left flex items-center gap-2 transition-colors border-t border-suka-brown/5">
                  <LogOut size={12} /> Keluar
                </button>
```

Lakukan perubahan yang sama persis di blok dropdown desktop (sekitar baris 128-137) — struktur JSX-nya identik dengan blok mobile.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 3: Jalankan test CrewDashboard**

Run: `cd apps/stok && yarn test src/components/monitoring/__tests__/CrewDashboard.test.tsx`
Expected: tetap hijau (penambahan link tidak mengubah elemen yang di-assert test yang sudah ada; kalau ada snapshot test yang gagal karena markup baru, itu ekspektasi wajar — update snapshot)

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/components/monitoring/CrewDashboard.tsx
git commit -m "feat(stok): entry point Riwayat Waste Saya di dropdown CrewDashboard"
```

---

### Task 13: Verifikasi akhir

**Files:** tidak ada file baru — validasi menyeluruh.

- [ ] **Step 1: Full type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error

- [ ] **Step 2: Full test suite**

Run: `cd apps/stok && yarn test`
Expected: semua test lulus. Kalau `SPVDashboard.test.tsx` gagal karena channel Supabase nyata di `WasteApprovalPage` (Task 10), tambahkan mock berikut di bagian atas file test tersebut lalu jalankan ulang:

```ts
vi.mock('@/app/actions/waste', () => ({
  fetchPendingWasteReports: vi.fn().mockResolvedValue([]),
  approveWasteReport: vi.fn(),
  rejectWasteReport: vi.fn(),
}))
```

- [ ] **Step 3: Build**

Run: `cd apps/stok && yarn build`
Expected: build sukses tanpa error

- [ ] **Step 4: Manual smoke test (2 tab browser, `yarn dev` di port 3001)**

1. Buka Monitoring-Live di tab 1, buat entry ledger baru (mis. lewat opname/new) di tab 2 pada outlet yang sama → tab 1 update dalam ~3 detik tanpa refresh
2. Buka halaman Permintaan (crew, tab 2) ajukan request bahan → buka SPVDashboard (approver, tab 1) → antrian approval bertambah instan
3. Submit waste report (crew, tab 1) → approve dari WasteApprovalPage (approver, tab 2) → tab 1 buka `/stok/waste-history` → toast "disetujui" muncul + status berubah instan
4. Opname: buka `/stok/opname/new` di 2 tab untuk outlet sama, isi salah satu → tab lain lihat entry baru tanpa refresh

- [ ] **Step 5: Commit final (jika ada perbaikan dari Step 2)**

```bash
git add -A
git commit -m "test(stok): perbaikan mock waste-approval untuk realtime channel di SPVDashboard test"
```

(lewati step ini kalau tidak ada perubahan)

---

## Ringkasan Cakupan Spec

| Spec case # | Task yang mengimplementasikan |
|---|---|
| 1 (Monitoring-Live) | Task 5 |
| 2 (SPV/Leader/Crew Dashboard) | Task 5 |
| 3 (Permintaan list) | sudah ada, tidak ada task |
| 4 (Permintaan approval) | Task 8 |
| 5 (Ledger) | Task 6 |
| 6 (Opname) | Task 7 |
| 7 (Waste approval) | Task 10 |
| 8 (Waste status crew) | Task 11, 12 |
| 9 (useStokBalance) | Task 9 |
