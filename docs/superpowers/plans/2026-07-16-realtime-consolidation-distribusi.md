# Konsolidasi Realtime + Isi Celah Distribusi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyatukan tiga pola realtime jadi satu paket kanonik `@suka/realtime`, membunuh firehose dengan aman (replace-before-remove), dan menambah realtime ke app distribusi.

**Architecture:** Paket workspace baru `@suka/realtime` (mirror `@suka/auth`: export `src` langsung, di-transpile Next via `transpilePackages` — **tanpa** langkah `yarn build`). Hooks realtime scoped (per-scope channel, filter eksplisit) mengambil browser client dari `@suka/auth`. Firehose (`GlobalRealtimeProvider`) dicabut per-app **setelah** tiap query yang bergantung padanya diberi pengganti sub scoped. Publication dibiarkan permisif; `REPLICA IDENTITY FULL` ditambah selektif.

**Tech Stack:** TypeScript, Next.js (App Router), React Query (@tanstack/react-query), Supabase Realtime (`postgres_changes`), npm workspaces, vitest.

**Spec:** `docs/superpowers/specs/2026-07-16-realtime-consolidation-distribusi-design.md`

**Catatan koreksi vs spec:** Spec menyebut "gotcha wajib `yarn build`". Ground-truth: `@suka/auth`/`@suka/design-system` mengekspor `./src/index.ts` langsung dan tiap app mencantumkannya di `transpilePackages`, jadi Next mengompilasi TS sumber tanpa langkah build. `@suka/realtime` mengikuti pola ini → tak ada gotcha build. Yang wajib: tambah paket ke `dependencies` app + `transpilePackages` + `npm install` sekali untuk symlink workspace.

---

## File Structure

**Paket baru `packages/realtime/`:**
- `package.json` — manifest `@suka/realtime` (mirror `@suka/auth`)
- `tsconfig.json` — config TS
- `vitest.config.ts` — runner test util murni
- `src/index.ts` — barrel export
- `src/debounce.ts` — util `createDebouncer` (lifted dari stok)
- `src/debounce.test.ts` — test debounce (lifted)
- `src/signature.ts` — util `subsSignature` (lifted)
- `src/signature.test.ts` — test signature (lifted)
- `src/useRealtimeChannel.ts` — hook channel callback (client dari `@suka/auth`, nama channel stabil)
- `src/useRealtimeInvalidate.ts` — hook invalidate React Query

**Dihapus (setelah repoint):** `apps/absensi/src/lib/realtime/*`, `apps/stok/src/lib/realtime/*`.

**Dihapus (setelah pengganti terpasang):** `apps/pos-kasir/components/GlobalRealtimeProvider.tsx`, `apps/admin-dashboard/src/components/GlobalRealtimeProvider.tsx`, `apps/finance/src/components/GlobalRealtimeProvider.tsx`.

**Baru (pengganti scoped):** `apps/admin-dashboard/src/hooks/useHrFinanceRealtime.ts`, `apps/finance/src/hooks/useFinanceRealtime.ts`, `apps/distribusi/src/hooks/useDistribusiRealtime.ts`.

**Dimodifikasi (distribusi → React Query):** `apps/distribusi/src/hooks/useSuratJalanList.ts`, `apps/distribusi/src/hooks/useTerimaList.ts`.

**Migration baru:** `supabase/migrations/20260716120000_surat_jalan_replica_identity.sql`.

**ADR:** `docs/adr/0014-suka-realtime-shared-package.md`, `docs/adr/0015-publication-permissive-kill-firehose.md`.

---

## PHASE A — Paket `@suka/realtime`

### Task 1: Scaffold paket + lift util murni (debounce, signature)

**Files:**
- Create: `packages/realtime/package.json`
- Create: `packages/realtime/tsconfig.json`
- Create: `packages/realtime/vitest.config.ts`
- Create: `packages/realtime/src/debounce.ts`
- Create: `packages/realtime/src/debounce.test.ts`
- Create: `packages/realtime/src/signature.ts`
- Create: `packages/realtime/src/signature.test.ts`

- [ ] **Step 1: Buat `package.json`** (mirror `@suka/auth`)

```json
{
  "name": "@suka/realtime",
  "version": "0.0.1",
  "description": "Scoped Supabase realtime hooks (channel + React Query invalidation) for SUKA suite",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "files": ["src"],
  "scripts": {
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@suka/auth": "*"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^2.0.0",
    "@types/react": "^18.2.45"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

- [ ] **Step 2: Buat `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Buat `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 4: Buat `src/debounce.ts`** (lifted verbatim dari `apps/stok/src/lib/realtime/debounce.ts`)

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

- [ ] **Step 5: Buat `src/debounce.test.ts`** (lifted dari `apps/stok/src/lib/realtime/debounce.test.ts`)

Salin isi file `apps/stok/src/lib/realtime/debounce.test.ts` apa adanya (import path relatif `./debounce` sudah benar untuk lokasi baru).

- [ ] **Step 6: Buat `src/signature.ts`** (lifted dari stok)

```ts
export function subsSignature(
  subs: { table: string; event?: string; filter?: string }[]
): string {
  return subs
    .map((s) => `${s.table}|${s.event ?? "*"}|${s.filter ?? ""}`)
    .join(";");
}
```

- [ ] **Step 7: Buat `src/signature.test.ts`** (lifted dari stok)

Salin isi `apps/stok/src/lib/realtime/signature.test.ts` apa adanya.

- [ ] **Step 8: Jalankan test util, pastikan lulus**

Run: `cd packages/realtime && npm test`
Expected: PASS (semua test debounce + signature hijau).

- [ ] **Step 9: Commit**

```bash
git add packages/realtime
git commit -m "feat(realtime): scaffold @suka/realtime package + lift debounce/signature utils"
```

---

### Task 2: Hooks realtime (channel + invalidate) di paket

**Files:**
- Create: `packages/realtime/src/useRealtimeChannel.ts`
- Create: `packages/realtime/src/useRealtimeInvalidate.ts`
- Create: `packages/realtime/src/index.ts`

- [ ] **Step 1: Buat `src/useRealtimeChannel.ts`**

Perbedaan kanonik vs versi lama: (a) client dari `@suka/auth` (`createSupabaseBrowserClient`), bukan `@/lib/supabase`; (b) nama channel **stabil** per-scope (bukan `Math.random()` seperti versi absensi).

```ts
'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
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
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  // Simpan subs terbaru di ref supaya handler selalu fresh tanpa re-subscribe tiap render.
  const subsRef = useRef(subs)
  subsRef.current = subs

  // Re-subscribe hanya saat channelName/enabled/bentuk-subs (tabel|event|filter) berubah.
  const signature = subsSignature(subs)

  useEffect(() => {
    if (!enabled) return

    // Nama channel STABIL per-scope (bukan random). Cleanup andal via removeChannel
    // mencegah channel bocor / duplikat saat unmount / re-subscribe.
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

- [ ] **Step 2: Buat `src/useRealtimeInvalidate.ts`**

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

- [ ] **Step 3: Buat `src/index.ts`**

```ts
export { useRealtimeChannel } from './useRealtimeChannel'
export type { RealtimeSub } from './useRealtimeChannel'
export { useRealtimeInvalidate } from './useRealtimeInvalidate'
export type { InvalidateSub } from './useRealtimeInvalidate'
export { createDebouncer } from './debounce'
export { subsSignature } from './signature'
```

- [ ] **Step 4: Type-check paket**

Run: `cd packages/realtime && npm run type-check`
Expected: 0 error. (Jika `@suka/auth`/`@tanstack/react-query`/`react` types belum ter-resolve, lanjut Task 3 yang meng-install ke workspace, lalu ulang.)

- [ ] **Step 5: Commit**

```bash
git add packages/realtime/src
git commit -m "feat(realtime): add useRealtimeChannel + useRealtimeInvalidate (stable channel name, @suka/auth client)"
```

---

### Task 3: Sambungkan paket ke semua app konsumen

App konsumen: `stok`, `absensi`, `distribusi`, `pos-kasir`, `admin-dashboard`, `finance`.

**Files:**
- Modify: `apps/{stok,absensi,distribusi,pos-kasir,admin-dashboard,finance}/package.json` (tambah dependency)
- Modify: `apps/{stok,absensi,distribusi,pos-kasir,admin-dashboard,finance}/next.config.{mjs,js}` (tambah `transpilePackages`)

- [ ] **Step 1: Tambah dependency di tiap `package.json` app**

Di blok `"dependencies"` tiap app di atas, tambah baris:

```json
    "@suka/realtime": "*",
```

- [ ] **Step 2: Tambah `@suka/realtime` ke `transpilePackages` tiap `next.config`**

Contoh untuk stok (`apps/stok/next.config.mjs`) — sisipkan ke array yang sudah ada:

```js
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue', '@suka/realtime'],
```

Lakukan setara untuk: `absensi` (mjs), `distribusi` (mjs), `admin-dashboard` (mjs), `finance` (mjs), `pos-kasir` (`next.config.js` → jadi `['@suka/auth', '@suka/realtime']`).

- [ ] **Step 3: Install untuk symlink workspace**

Run: `npm install`
Expected: sukses; `node_modules/@suka/realtime` menjadi symlink ke `packages/realtime`.

- [ ] **Step 4: Verifikasi resolve dari satu app**

Run: `cd packages/realtime && npm run type-check`
Expected: 0 error (types `@suka/auth`, `react`, `@tanstack/react-query` kini ter-resolve).

- [ ] **Step 5: Commit**

```bash
git add apps/*/package.json apps/*/next.config.* package-lock.json
git commit -m "chore(realtime): wire @suka/realtime into all consumer apps (deps + transpilePackages)"
```

---

## PHASE B — Repoint absensi & stok, hapus `lib/realtime` lokal

### Task 4: Repoint stok ke `@suka/realtime`

**Files:**
- Modify: consumer di `apps/stok/src/hooks/*.ts` yang import dari `@/lib/realtime` atau `../lib/realtime`
- Delete: `apps/stok/src/lib/realtime/` (seluruh folder)

- [ ] **Step 1: Temukan consumer di stok**

Run: `grep -rn "lib/realtime" apps/stok/src`
Expected: daftar file yang import `useRealtimeInvalidate`/`useRealtimeChannel` dari path lokal.

- [ ] **Step 2: Ganti tiap import lokal → `@suka/realtime`**

Untuk tiap baris seperti:

```ts
import { useRealtimeInvalidate } from '@/lib/realtime/useRealtimeInvalidate'
```

ganti jadi:

```ts
import { useRealtimeInvalidate } from '@suka/realtime'
```

(Setara untuk `useRealtimeChannel`.)

- [ ] **Step 3: Hapus folder lokal**

Run: `rm -rf apps/stok/src/lib/realtime`

- [ ] **Step 4: Type-check stok**

Run: `cd apps/stok && npm run type-check`
Expected: 0 error baru (error pre-existing tak-terkait boleh diabaikan; catat baseline sebelum mulai).

- [ ] **Step 5: Build stok**

Run: `cd apps/stok && npm run build`
Expected: sukses.

- [ ] **Step 6: Verifikasi lintas-device (2 browser)**

Buka halaman monitoring/permintaan stok di 2 browser dengan outlet sama. Ubah data (mis. buat permintaan / gerakan stok) di browser A. Pastikan browser B ter-update **tanpa refresh**.

- [ ] **Step 7: Commit**

```bash
git add apps/stok
git commit -m "refactor(stok): repoint realtime to @suka/realtime, remove local lib/realtime"
```

---

### Task 5: Repoint absensi ke `@suka/realtime` (perbaiki divergensi random channel)

**Files:**
- Modify: consumer di `apps/absensi/src/**` yang import `lib/realtime`
- Delete: `apps/absensi/src/lib/realtime/` (folder — versi random channel dibuang, diganti versi paket yang stabil)

- [ ] **Step 1: Temukan consumer di absensi**

Run: `grep -rn "lib/realtime" apps/absensi/src`
Expected: daftar file (papan-kehadiran, rekap, enroll, checklist-monitor, PengaturanClient, KasbonView, useLeaveNotifications, AttendanceKioskPanel, dll).

- [ ] **Step 2: Ganti tiap import lokal → `@suka/realtime`**

Sama seperti Task 4 Step 2.

- [ ] **Step 3: Hapus folder lokal**

Run: `rm -rf apps/absensi/src/lib/realtime`

- [ ] **Step 4: Type-check absensi**

Run: `cd apps/absensi && npm run type-check`
Expected: 0 error baru (baseline pre-existing `gps.test.ts` TS6133 boleh diabaikan).

- [ ] **Step 5: Build absensi**

Run: `cd apps/absensi && npm run build`
Expected: sukses.

- [ ] **Step 6: Verifikasi lintas-device (2 browser)**

Papan-kehadiran di 2 browser (SPV + kiosk outlet sama). Absen di A → muncul live di B tanpa refresh. Approve cuti di A → badge/toast muncul live di B. (Konvensi nama channel kini stabil — pastikan tak ada duplikasi event / channel bocor saat pindah tab.)

- [ ] **Step 7: Commit**

```bash
git add apps/absensi
git commit -m "refactor(absensi): repoint realtime to @suka/realtime (fixes random channel-name divergence)"
```

---

## PHASE C — Bunuh firehose (replace-before-remove)

> **Aturan tiap task fase ini:** pasang/pastikan pengganti scoped **dulu**, uji lintas-device, **baru** hapus `GlobalRealtimeProvider`. Firehose hanya penting untuk update lintas-sesi; mutasi tab sendiri sudah invalidate lokal.

### Task 6: pos-kasir — cabut firehose (risiko rendah)

**Files:**
- Modify: `apps/pos-kasir/components/Providers.tsx` (lepas mount `GlobalRealtimeProvider`)
- Delete: `apps/pos-kasir/components/GlobalRealtimeProvider.tsx`

- [ ] **Step 1: Konfirmasi tak ada query yatim**

Run: `grep -rn "useQuery" apps/pos-kasir/app apps/pos-kasir/components apps/pos-kasir/lib | grep -oE "queryKey: \[[^]]+\]"`
Bandingkan tiap queryKey dengan channel dedicated yang sudah ada (`OrderNotification`, `KasirMenuClient` menu channel, `useKioskControl`, `usePromos`, `useStockAlerts`, `PettyCashNotification`, `BriefingBanner`) + invalidate eksplisit pasca-mutasi. Setiap queryKey yang butuh update lintas-sesi HARUS punya salah satunya. Catat temuan; jika ada yatim yang benar-benar butuh lintas-sesi, tambahkan sub scoped via `useRealtimeInvalidate` sebelum lanjut.
Expected: nol yatim (realtime pos-kasir sudah di channel dedicated).

- [ ] **Step 2: Lepas mount firehose di `Providers.tsx`**

Hapus `import { GlobalRealtimeProvider }` dan bungkusnya. Contoh: `<GlobalRealtimeProvider>{children}</GlobalRealtimeProvider>` → `{children}`.

- [ ] **Step 3: Hapus file firehose**

Run: `rm apps/pos-kasir/components/GlobalRealtimeProvider.tsx`

- [ ] **Step 4: Type-check + build**

Run: `cd apps/pos-kasir && npm run type-check && npm run build`
Expected: sukses.

- [ ] **Step 5: Verifikasi lintas-device (2 browser)**

Kasir A selesaikan order → papan order/menu kasir B (outlet sama) update live; kiosk control toggle di admin → kiosk update; petty cash notif tetap live. Konfirmasi tak ada regresi realtime.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-kasir
git commit -m "refactor(pos-kasir): remove redundant firehose GlobalRealtimeProvider (dedicated channels cover it)"
```

---

### Task 7: admin-dashboard — pasang sub scoped HR/expenses, cabut firehose

Query yang benar-benar numpang firehose & masih hidup: `['expenses']` (tabel `expenses`), `['payroll']` (tabel `payroll_records`). (`['staff']`←`outlet_staff` & `['cash-advances']`←`cash_advances` sudah mati karena beda nama — tak perlu diselamatkan, tapi kita pasangkan juga agar sengaja & benar.) Jalur sales sudah dipegang `useSalesRealtime` + `useTargetProgress` — jangan disentuh.

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useHrFinanceRealtime.ts`
- Modify: `apps/admin-dashboard/src/app/dashboard/layout.tsx` (atau komponen HR/expenses yang selalu ter-mount di area itu — lihat Step 2)
- Modify: `apps/admin-dashboard/src/app/Providers.tsx` (lepas firehose)
- Delete: `apps/admin-dashboard/src/components/GlobalRealtimeProvider.tsx`

- [ ] **Step 1: Buat hook pengganti scoped `useHrFinanceRealtime.ts`**

```ts
'use client'

import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Pengganti scoped untuk invalidasi yang sebelumnya numpang firehose.
 * Tabel dasli → queryKey React Query yang dipakai hooks admin-dashboard.
 */
export function useHrFinanceRealtime() {
  useRealtimeInvalidate({
    channelName: 'admin-hr-finance',
    subs: [
      { table: 'expenses', queryKeys: [['expenses']] },
      { table: 'payroll_records', queryKeys: [['payroll']] },
      { table: 'outlet_staff', queryKeys: [['staff']] },
      { table: 'cash_advances', queryKeys: [['cash-advances']] },
    ],
  })
}
```

- [ ] **Step 2: Mount hook di layout dashboard**

Di `apps/admin-dashboard/src/app/dashboard/layout.tsx` (client boundary yang selalu ter-mount saat user di dashboard), panggil hook:

```tsx
'use client'
import { useHrFinanceRealtime } from '@/hooks/useHrFinanceRealtime'
// ...di dalam komponen layout:
useHrFinanceRealtime()
```

Jika `layout.tsx` server component, buat komponen kecil client `RealtimeMount` yang memanggil hook lalu render `null`, dan sisipkan di layout. (Cari pola serupa `useSalesRealtime` dipanggil di mana — ikuti pola yang sama.)

- [ ] **Step 3: Lepas firehose di `Providers.tsx`**

Hapus import + bungkus `GlobalRealtimeProvider`.

- [ ] **Step 4: Hapus file firehose**

Run: `rm apps/admin-dashboard/src/components/GlobalRealtimeProvider.tsx`

- [ ] **Step 5: Type-check + build**

Run: `cd apps/admin-dashboard && npm run type-check && npm run build`
Expected: sukses (baseline error pre-existing BOM/bahan-baku boleh diabaikan; catat dulu sebelum mulai).

- [ ] **Step 6: Verifikasi lintas-device (2 browser)**

Di browser A: input pengeluaran (expenses) & proses payroll. Browser B (owner dashboard, halaman terkait) update live. Sales dashboard tetap live (regresi cek: selesaikan order → KPI naik). Approve cuti → HR activity update.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard
git commit -m "refactor(admin-dashboard): replace firehose with scoped HR/finance realtime, remove GlobalRealtimeProvider"
```

---

### Task 8: finance — pasang set scoped lengkap, cabut firehose (risiko tertinggi)

Firehose adalah **satu-satunya** realtime finance. Tabel dasar → queryKey (dari `.from()` di `apps/finance/src/hooks`):

| queryKey | tabel/basis dasar | catatan |
|---|---|---|
| `['expenses']` | `expenses` | tabel |
| `['cash_transaction', …]` | `cash_transaction` | tabel |
| `['cash_balance']` | `cash_balance` | tabel |
| `['cash_location']` | `cash_location` | tabel |
| `['petty_cash_topups', …]` | `petty_cash_topups` | tabel |
| `['payroll_slips', …]` | `payroll_records` | queryKey ≠ tabel |
| `['po_payable']` | **base table di balik view `po_payable_spv`** | lihat Step 1 — realtime TAK menyala di view |
| `['expected_cash', …]` | `cash_transaction` (+ `orders`) | turunan; invalidate saat cash_transaction berubah |

**Files:**
- Create: `apps/finance/src/hooks/useFinanceRealtime.ts`
- Modify: `apps/finance/src/app/dashboard/layout.tsx` (mount hook — sesuaikan dengan struktur nyata)
- Modify: `apps/finance/src/app/Providers.tsx` (lepas firehose)
- Delete: `apps/finance/src/components/GlobalRealtimeProvider.tsx`

- [ ] **Step 1: Resolusi base table untuk `po_payable_spv` (view)**

Run: `grep -rn "po_payable_spv\|po_payable" supabase/migrations | grep -iE "create (or replace )?view|create table"`
Realtime `postgres_changes` **tidak** menyala untuk view. Temukan tabel dasar yang ditulis saat settlement (rpc `settle_purchase_order`) — kandidat: `purchase_order` dan/atau `po_payment`. Konfirmasi dengan:
Run: `grep -rn "settle_purchase_order" supabase/migrations | head -5` lalu baca body fungsi (tabel yang di-`UPDATE`/`INSERT`).
Catat base table hasilnya sebagai `<PO_BASE_TABLE>` untuk Step 2.

- [ ] **Step 2: Buat `useFinanceRealtime.ts`**

Ganti `<PO_BASE_TABLE>` dengan hasil Step 1 (mis. `purchase_order`).

```ts
'use client'

import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Realtime finance (menggantikan firehose GlobalRealtimeProvider).
 * Semua update lintas-sesi (setoran, pencairan, approval petty cash,
 * settlement supplier) di-invalidate scoped ke queryKey React Query.
 */
export function useFinanceRealtime() {
  useRealtimeInvalidate({
    channelName: 'finance-global',
    subs: [
      { table: 'cash_transaction', queryKeys: [['cash_transaction'], ['cash_balance'], ['expected_cash']] },
      { table: 'cash_balance', queryKeys: [['cash_balance']] },
      { table: 'cash_location', queryKeys: [['cash_location']] },
      { table: 'petty_cash_topups', queryKeys: [['petty_cash_topups']] },
      { table: 'petty_cash_expenses', queryKeys: [['petty_cash_topups']] },
      { table: 'payroll_records', queryKeys: [['payroll_slips'], ['payroll']] },
      { table: 'expenses', queryKeys: [['expenses']] },
      { table: '<PO_BASE_TABLE>', queryKeys: [['po_payable']] },
    ],
  })
}
```

Catatan: `cash_transaction` meng-invalidate juga `['cash_balance']` & `['expected_cash']` karena keduanya turunan dari transaksi kas.

- [ ] **Step 3: Mount hook** di client boundary dashboard finance yang selalu ter-mount (pola sama Task 7 Step 2). Jika layout server component, pakai komponen kecil `RealtimeMount` client.

- [ ] **Step 4: Lepas firehose di `Providers.tsx`** — hapus import + bungkus `GlobalRealtimeProvider`.

- [ ] **Step 5: Hapus file firehose**

Run: `rm apps/finance/src/components/GlobalRealtimeProvider.tsx`

- [ ] **Step 6: Type-check + build**

Run: `cd apps/finance && npm run type-check && npm run build`
Expected: sukses (baseline pre-existing boleh diabaikan; catat dulu).

- [ ] **Step 7: Verifikasi lintas-device (2 browser) — menyeluruh (app paling bergantung firehose)**

Uji tiap alur lintas-sesi:
- Browser A submit/approve **cash transaction** → browser B: saldo kas & daftar transaksi update live.
- Approve **petty cash topup** di A → B update live.
- **Disburse payroll** di A → slip/payroll B update live.
- **Settle purchase order** di A → `po_payable` B update live (bukti base table Step 1 benar).
- Input **expenses** di A → B update live.

Jika salah satu tak update → base table/queryKey belum tepat; perbaiki sub sebelum lanjut.

- [ ] **Step 8: Commit**

```bash
git add apps/finance
git commit -m "refactor(finance): replace sole-realtime firehose with scoped useFinanceRealtime, remove GlobalRealtimeProvider"
```

---

## PHASE D — Distribusi realtime (isi celah)

### Task 9: Migrasi `useSuratJalanList` & `useTerimaList` ke React Query

**Files:**
- Modify: `apps/distribusi/src/hooks/useSuratJalanList.ts`
- Modify: `apps/distribusi/src/hooks/useTerimaList.ts`

> Distribusi sudah punya React Query (`usePOKitchen` memakainya; `Providers.tsx` menyediakan QueryClient). Kita samakan dua hook list ini agar abstraksi realtime langsung pas.

- [ ] **Step 1: Tulis ulang `useSuratJalanList.ts` ke React Query**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

interface SuratJalan {
  id: string
  outlet_id: string
  status: string
  created_at: string
  document_number?: string
  has_problem?: boolean
}

interface SuratJalanWithOutlet extends SuratJalan {
  outlet?: { name: string }
}

type DateFilter = 'all' | 'today' | '7days' | '30days' | 'belum_verif' | 'telah_verif'

async function fetchSuratJalan(dateFilter: DateFilter): Promise<SuratJalanWithOutlet[]> {
  const supabase = createSupabaseBrowserClient()
  let query = supabase
    .from('surat_jalan')
    .select('id, outlet_id, status, created_at, document_number, outlets(name), surat_jalan_item(qty_dikirim, qty_terima, kondisi)')
    .order('created_at', { ascending: false })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  if (dateFilter === 'today') query = query.gte('created_at', today)
  else if (dateFilter === '7days') query = query.gte('created_at', sevenDaysAgo)
  else if (dateFilter === '30days') query = query.gte('created_at', thirtyDaysAgo)
  else if (dateFilter === 'belum_verif') query = query.in('status', ['diterima_lengkap', 'diterima_sebagian'])
  else if (dateFilter === 'telah_verif') query = query.eq('status', 'selesai')

  const { data: sjList, error } = await query
  if (error) throw error

  return (sjList || []).map((sj: any) => {
    const items = sj.surat_jalan_item || []
    const has_problem = items.some(
      (it: any) => it.kondisi === 'rusak' || (it.qty_terima != null && it.qty_terima < it.qty_dikirim)
    )
    const outlet = Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets
    return { ...sj, outlet, has_problem }
  }) as SuratJalanWithOutlet[]
}

export function useSuratJalanList(dateFilter: DateFilter = 'all') {
  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: ['surat_jalan', dateFilter],
    queryFn: () => fetchSuratJalan(dateFilter),
  })

  const draftCount = data.filter((sj) => sj.status === 'draft').length
  const sentCount = data.filter((sj) => sj.status === 'dikirim').length
  const diterimaCount = data.filter((sj) => sj.status === 'diterima_lengkap' || sj.status === 'diterima_sebagian').length
  const selesaiCount = data.filter((sj) => sj.status === 'selesai').length

  return { data, loading, error: error ? (error as Error).message : null, draftCount, sentCount, diterimaCount, selesaiCount }
}
```

- [ ] **Step 2: Tulis ulang `useTerimaList.ts` ke React Query**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useAuth } from '@suka/auth'

interface SuratJalan {
  id: string
  outlet_id: string
  status: string
  created_at: string
  document_number?: string
  outlets?: { name: string }
}

async function fetchTerima(outletId: string | null | undefined): Promise<SuratJalan[]> {
  const supabase = createSupabaseBrowserClient()
  let query = supabase
    .from('surat_jalan')
    .select('id, outlet_id, status, created_at, document_number, outlets(name)')
    .in('status', ['dikirim', 'dikirim_lengkap', 'diterima_sebagian'])

  if (outletId) query = query.eq('outlet_id', outletId)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error

  return (data || []).map((sj: any) => ({
    ...sj,
    outlets: Array.isArray(sj.outlets) ? sj.outlets[0] : sj.outlets,
  })) as SuratJalan[]
}

export function useTerimaList() {
  const { outletStaff } = useAuth()
  const outletId = outletStaff?.outlet_id
  const { data = [], isLoading: loading, error } = useQuery({
    queryKey: ['surat_jalan_terima', outletId ?? 'all'],
    queryFn: () => fetchTerima(outletId),
  })

  return { data, loading, error: error ? (error as Error).message : null }
}
```

- [ ] **Step 3: Type-check + build distribusi**

Run: `cd apps/distribusi && npm run type-check && npm run build`
Expected: sukses (baseline `ignoreBuildErrors:true` di next.config; tetap jalankan type-check untuk tangkap error nyata).

- [ ] **Step 4: Smoke manual** — buka daftar Surat Jalan & Terima; pastikan data tampil & filter jalan seperti sebelumnya (belum realtime — itu Task 11).

- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/src/hooks/useSuratJalanList.ts apps/distribusi/src/hooks/useTerimaList.ts
git commit -m "refactor(distribusi): migrate surat_jalan list hooks to React Query"
```

---

### Task 10: Migration `REPLICA IDENTITY FULL` untuk `surat_jalan`

**Files:**
- Create: `supabase/migrations/20260716120000_surat_jalan_replica_identity.sql`

- [ ] **Step 1: Tulis migration (aditif, idempotent)**

`surat_jalan` sub-nya pakai `filter=outlet_id`; `REPLICA IDENTITY FULL` diperlukan agar event ter-filter (dan DELETE, bila ada) membawa nilai kolom lama sehingga lolos filter/RLS. `surat_jalan` sudah eligible via `enable_realtime_all`; migration ini hanya set replica identity.

```sql
-- Realtime distribusi: agar event ter-filter outlet_id (dan DELETE) lolos,
-- surat_jalan butuh REPLICA IDENTITY FULL. Publication sudah permisif
-- (enable_realtime_all), jadi cukup set replica identity. Aditif & idempotent.
DO $$
BEGIN
  IF to_regclass('public.surat_jalan') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.surat_jalan REPLICA IDENTITY FULL';
  END IF;
END $$;
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: applied. Jika drift (migration remote-only dev lain), JANGAN `migration repair` sepihak — verifikasi ground-truth dulu (Step 3) apakah replica identity sudah ter-set; migration ini idempotent & aman diulang.

- [ ] **Step 3: Verifikasi ground-truth (bukan andalkan `migration list`)**

Run:
```bash
supabase db query "SELECT relreplident FROM pg_class WHERE relname='surat_jalan'" --linked
```
Expected: `relreplident = f` (FULL).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260716120000_surat_jalan_replica_identity.sql
git commit -m "feat(distribusi): REPLICA IDENTITY FULL on surat_jalan for filtered realtime"
```

---

### Task 11: Pasang sub scoped realtime distribusi (3 surface)

**Files:**
- Create: `apps/distribusi/src/hooks/useDistribusiRealtime.ts`
- Modify: komponen konsumen — `apps/distribusi/src/components/distribusi/SuratJalanList.tsx` (pusat), `apps/distribusi/src/components/distribusi/TerimaList.tsx` (outlet)

- [ ] **Step 1: Buat hook realtime distribusi**

```ts
'use client'

import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Realtime distribusi.
 * - Pusat (daftar Surat Jalan): tanpa outletId → subscribe semua surat_jalan.
 * - Outlet (Terima): dengan outletId → subscribe surat_jalan outlet itu saja.
 * Keduanya juga menyalakan Permintaan Bahan.
 */
export function useDistribusiRealtime(outletId?: string | null) {
  useRealtimeInvalidate({
    channelName: outletId ? `distribusi-${outletId}` : 'distribusi-pusat',
    subs: [
      {
        table: 'surat_jalan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: outletId ? [['surat_jalan_terima', outletId]] : [['surat_jalan']],
      },
      {
        table: 'permintaan_bahan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['permintaan_bahan']],
      },
    ],
  })
}
```

- [ ] **Step 2: Pasang di daftar SJ pusat (`SuratJalanList.tsx`)**

Di komponen yang memakai `useSuratJalanList()` (pusat, lihat semua outlet), tambah:

```tsx
import { useDistribusiRealtime } from '@/hooks/useDistribusiRealtime'
// ...di dalam komponen:
useDistribusiRealtime() // tanpa outletId → scope pusat, invalidate ['surat_jalan']
```

- [ ] **Step 3: Pasang di daftar Terima outlet (`TerimaList.tsx`)**

Di komponen yang memakai `useTerimaList()`, ambil outletId dari auth & pasang scoped:

```tsx
import { useAuth } from '@suka/auth'
import { useDistribusiRealtime } from '@/hooks/useDistribusiRealtime'
// ...di dalam komponen:
const { outletStaff } = useAuth()
useDistribusiRealtime(outletStaff?.outlet_id) // scope outlet → invalidate ['surat_jalan_terima', outletId]
```

- [ ] **Step 4: Type-check + build**

Run: `cd apps/distribusi && npm run type-check && npm run build`
Expected: sukses.

- [ ] **Step 5: Verifikasi lintas-device (2 browser) — jantung fitur C**

- Browser A (pusat): buat/kirim Surat Jalan untuk outlet X (status → `dikirim`).
  Browser B (outlet X, halaman Terima): SJ baru muncul **live tanpa refresh**.
- Browser B (outlet X): verifikasi terima (status → `diterima_lengkap`).
  Browser A (pusat, daftar SJ): status flip **live**.
- Buat Permintaan Bahan di outlet → muncul live di sisi pusat.
- **Bonus lintas-app:** buka halaman terima stok di app `stok` untuk outlet X di browser ketiga; saat pusat kirim SJ, konfirmasi channel `@suka/realtime` yang sama juga menyalakan layar stok (bila halaman itu meng-subscribe `surat_jalan`) — bukti payoff paket bersama.

- [ ] **Step 6: Commit**

```bash
git add apps/distribusi/src/hooks/useDistribusiRealtime.ts apps/distribusi/src/components/distribusi/SuratJalanList.tsx apps/distribusi/src/components/distribusi/TerimaList.tsx
git commit -m "feat(distribusi): scoped realtime for surat_jalan (pusat + outlet) and permintaan_bahan"
```

---

## PHASE E — Dokumentasi keputusan

### Task 12: Tulis ADR-0014 & ADR-0015

**Files:**
- Create: `docs/adr/0014-suka-realtime-shared-package.md`
- Create: `docs/adr/0015-publication-permissive-kill-firehose.md`

- [ ] **Step 1: Tulis `0014-suka-realtime-shared-package.md`**

```markdown
# 14. `@suka/realtime` sebagai paket bersama untuk abstraksi realtime kanonik

Tanggal: 2026-07-16
Status: Diterima

## Konteks
Util realtime scoped diduplikasi di `apps/absensi/src/lib/realtime` dan
`apps/stok/src/lib/realtime`. Dua copy sudah divergen diam-diam (absensi memakai
nama channel `Math.random()`, stok memakai nama stabil) tanpa niat — bug yang
menyebar tak terlacak. Rencana konsolidasi menambah distribusi & pos-kasir sebagai
konsumen (jadi 4+ copy).

## Keputusan
Angkat util realtime jadi paket workspace `@suka/realtime` (mirror `@suka/auth`:
ekspor `src` langsung, di-transpile Next via `transpilePackages`). Semua app
meng-import dari `@suka/realtime`; copy lokal dihapus. Client Supabase diambil
dari `@suka/auth`. Nama channel stabil per-scope jadi kanonik.

## Konsekuensi
- Satu sumber kebenaran; perbaikan bug sekali untuk semua app.
- Tiap app konsumen wajib mencantumkan `@suka/realtime` di `dependencies` +
  `transpilePackages`.
- Preseden lawan: keputusan printLayout (CLAUDE.md) sengaja MENOLAK paket bersama
  demi "hindari friksi build/deploy dist". Perbedaan yang membenarkan arah berbeda
  di sini: printLayout = logika stabil jarang berubah; util realtime = infrastruktur
  yang bug-nya menyebar ke semua app, sehingga nilai satu-sumber jauh lebih tinggi.
  (Catatan: karena `@suka/*` mengekspor `src` + `transpilePackages`, "friksi build
  dist" yang dikhawatirkan printLayout tak berlaku untuk pola paket ini.)
```

- [ ] **Step 2: Tulis `0015-publication-permissive-kill-firehose.md`**

```markdown
# 15. Publication realtime permisif + bunuh firehose client

Tanggal: 2026-07-16
Status: Diterima

## Konteks
`GlobalRealtimeProvider` (pos-kasir, admin-dashboard, finance) men-subscribe
seluruh schema `public` (`event:'*'`) lalu invalidate queryKey `[table]`. Pola ini
(a) boros — tiap perubahan tiap tabel mem-fan-out ke tiap browser; (b) tak
reliabel — hanya bekerja bila queryKey kebetulan sama dengan nama tabel (mis.
`['staff']` vs tabel `outlet_staff` → mati diam-diam). Migration
`20260713100000_enable_realtime_all` memasukkan semua tabel ke publication.

## Keputusan
1. Bunuh firehose client di semua app; ganti dengan subscription scoped eksplisit
   (`@suka/realtime`) per query yang butuh update lintas-sesi.
2. BIARKAN publication permisif (`enable_realtime_all` tetap). Tidak memangkas jadi
   allowlist.

## Alasan tidak memangkas publication
- Biaya nyata yang dirasakan (fan-out event mubazir) berasal dari SUBSCRIPTION
  wildcard, bukan publication membership. Membunuh firehose sudah menghapusnya.
- DB ini shared dengan dev lain yang aktif push migration (drift rutin). Memangkas
  publication berisiko mematikan konsumen realtime di app tak-teraudit / kerja dev
  lain secara senyap — persis penyakit "mati diam-diam" yang diberantas.

## Konsekuensi
- Biaya decode WAL server-side (semua tabel) diterima sebagai trade-off keamanan.
- Bila kelak jadi beban nyata (metrik Supabase Realtime), pemangkasan publication =
  proyek terpisah dengan audit repo-penuh lebih dulu.
- `REPLICA IDENTITY FULL` ditambah selektif & aditif untuk tabel ber-filter/DELETE.
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0014-suka-realtime-shared-package.md docs/adr/0015-publication-permissive-kill-firehose.md
git commit -m "docs(adr): ADR-0014 @suka/realtime shared package, ADR-0015 permissive publication + kill firehose"
```

---

## Verifikasi akhir (setelah semua task)

- [ ] `npm install` bersih dari root; `node_modules/@suka/realtime` = symlink.
- [ ] Tak ada sisa `import ... from '@/lib/realtime'` di absensi/stok: `grep -rn "lib/realtime" apps/` → kosong.
- [ ] Tak ada sisa `GlobalRealtimeProvider`: `grep -rln "GlobalRealtimeProvider" apps/` → kosong.
- [ ] Tiap app konsumen: `npm run type-check` (0 error baru vs baseline) + `npm run build` sukses.
- [ ] Uji lintas-device 2-browser lulus untuk: absensi, stok, pos-kasir, admin-dashboard, finance, distribusi.
- [ ] Ground-truth migration: `surat_jalan` `relreplident='f'`.
- [ ] ADR-0014 & 0015 ada di `docs/adr/`.

---

## Catatan penting untuk pelaksana

- **JANGAN `migration repair` sepihak.** DB shared; riwayat berubah antar-pengecekan. Verifikasi ground-truth (`supabase db query --linked`) sebelum tindakan migration apa pun.
- **`npx` rusak di repo ini** (path `node_modules/node_modules` ganda) → pakai `./node_modules/.bin/<tool>` bila perlu.
- **Firehose = replace-before-remove.** Jangan pernah hapus `GlobalRealtimeProvider` sebelum pengganti scoped terpasang & teruji lintas-device. Urutan wajib: pos-kasir → admin-dashboard → finance.
- **Baseline error dulu.** Sebelum menyentuh tiap app, jalankan `npm run type-check` dan catat error pre-existing; hanya error BARU yang jadi tanggung jawab task.
- **Realtime = gerbang RLS.** Event `postgres_changes` hanya terkirim untuk baris yang boleh di-SELECT user. Bila sub tampak "mati", verifikasi RLS SELECT tabel itu untuk role penguji sebelum menyalahkan kode.
- **Realtime tak menyala di VIEW.** Untuk queryKey yang bersumber view (mis. `po_payable_spv`), subscribe base table-nya.
```
