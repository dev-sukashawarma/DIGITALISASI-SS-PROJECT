# Absensi Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buat seluruh aktivitas di `apps/absensi` realtime (muncul/hilang di detik itu tanpa refresh) lewat satu lapisan realtime terpusat, sambil menekan jumlah koneksi & fetch (ringan).

**Architecture:** Approach B — satu channel Supabase per scope yang di-multiplex untuk banyak tabel; event Postgres memicu `queryClient.invalidateQueries` (React Query) atau callback imperatif, dengan debounce. Sebuah migration membereskan `supabase_realtime` publication + `REPLICA IDENTITY FULL` agar event (termasuk DELETE) andal & lolos RLS.

**Tech Stack:** Next.js (app router) + React 18, `@tanstack/react-query`, `@supabase/supabase-js` Realtime (postgres_changes), Vitest (node env), TypeScript.

## Global Constraints

- App scope terbatas `apps/absensi` — JANGAN sentuh `@suka/auth` atau app lain.
- Semua client Supabase browser via `createClient()` dari `@/lib/supabase` (memo dengan `useMemo`/`useRef`, jangan panggil ulang tiap render).
- Migration bersifat **aditif & idempotent**; jangan longgarkan RLS lintas-outlet.
- Ganti `refetch()` manual → `invalidateQueries`; buang semua polling (`refetchInterval`).
- Test hanya logika murni (Vitest node env, tanpa DOM) — hook diverifikasi via smoke 2-device.
- Pertahankan `type-check` 0 error & suite Vitest hijau di tiap commit.
- Nama channel harus stabil per scope (`absensi-<scope>`), jangan pakai `Date.now()` (bikin channel baru tiap mount → boros).

---

### Task 1: Migration — publication + REPLICA IDENTITY

**Files:**
- Create: `supabase/migrations/20260710120000_absensi_realtime_publication.sql`

**Interfaces:**
- Produces: tabel absensi masuk publication `supabase_realtime` dan ber-`REPLICA IDENTITY FULL` sehingga event realtime (INSERT/UPDATE/DELETE) terkirim lengkap ke klien yang berhak (RLS).

- [ ] **Step 1: Tulis migration SQL**

```sql
-- 20260710120000_absensi_realtime_publication.sql
-- Absensi realtime: tambahkan tabel ke publication supabase_realtime + REPLICA IDENTITY FULL.
-- Idempotent & aditif. attendance + daily_checklist_ticks sudah ditambahkan di migration lama.

-- 1) Tambah ke publication (skip kalau sudah ada / tabel belum ada)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'leave_requests','cash_advances','cash_advance_installments',
    'outlet_staff','outlet_attendance_config','global_settings',
    'daily_checklist_records','checklist_items','checklist_categories'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) REPLICA IDENTITY FULL agar DELETE & UPDATE ber-filter membawa baris lama (lolos filter + RLS)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'attendance','leave_requests','cash_advances','cash_advance_installments',
    'outlet_staff','daily_checklist_ticks','daily_checklist_records','outlet_attendance_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;
```

- [ ] **Step 2: Verifikasi SQL valid secara lokal (dry parse)**

Run: `cd "C:/Users/Digital Marketing/OneDrive/Desktop/project/DIGITALISASI-SS-PROJECT" && node -e "const fs=require('fs');const s=fs.readFileSync('supabase/migrations/20260710120000_absensi_realtime_publication.sql','utf8');if(!/ALTER PUBLICATION supabase_realtime ADD TABLE/.test(s)||!/REPLICA IDENTITY FULL/.test(s))process.exit(1);console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260710120000_absensi_realtime_publication.sql
git commit -m "feat(absensi): publication + replica identity untuk realtime penuh"
```

> **Catatan apply:** `supabase db push` dijalankan saat integrasi (bukan di task ini). Setelah push, verifikasi di DB live:
> `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' ORDER BY 1;`
> dan `SELECT relname, relreplident FROM pg_class WHERE relname IN ('attendance','leave_requests','cash_advances') ` (relreplident harus `f`). Jangan andalkan status `migration list` saja (lihat gotcha CLAUDE.md 2026-07-08).

---

### Task 2: Util debounce + signature (logika murni, TDD)

**Files:**
- Create: `src/lib/realtime/debounce.ts`
- Create: `src/lib/realtime/debounce.test.ts`
- Create: `src/lib/realtime/signature.ts`
- Create: `src/lib/realtime/signature.test.ts`

**Interfaces:**
- Produces:
  - `createDebouncer(waitMs: number): { schedule(key: string, fn: () => void): void; cancelAll(): void }`
  - `subsSignature(subs: { table: string; event?: string; filter?: string }[]): string`

- [ ] **Step 1: Tulis test debounce yang gagal**

```ts
// src/lib/realtime/debounce.test.ts
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

- [ ] **Step 2: Jalankan test → gagal**

Run: `cd apps/absensi && npx vitest run src/lib/realtime/debounce.test.ts`
Expected: FAIL — `Cannot find module './debounce'`

- [ ] **Step 3: Implementasi debounce**

```ts
// src/lib/realtime/debounce.ts
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

- [ ] **Step 4: Tulis test signature yang gagal**

```ts
// src/lib/realtime/signature.test.ts
import { describe, it, expect } from "vitest";
import { subsSignature } from "./signature";

describe("subsSignature", () => {
  it("stabil untuk subs identik", () => {
    const a = subsSignature([{ table: "attendance", filter: "outlet_id=eq.1" }]);
    const b = subsSignature([{ table: "attendance", filter: "outlet_id=eq.1" }]);
    expect(a).toBe(b);
  });

  it("berubah saat filter berbeda", () => {
    const a = subsSignature([{ table: "attendance", filter: "outlet_id=eq.1" }]);
    const b = subsSignature([{ table: "attendance", filter: "outlet_id=eq.2" }]);
    expect(a).not.toBe(b);
  });

  it("default event '*' dan filter kosong", () => {
    expect(subsSignature([{ table: "x" }])).toBe("x|*|");
  });
});
```

- [ ] **Step 5: Jalankan → gagal**

Run: `cd apps/absensi && npx vitest run src/lib/realtime/signature.test.ts`
Expected: FAIL — `Cannot find module './signature'`

- [ ] **Step 6: Implementasi signature**

```ts
// src/lib/realtime/signature.ts
export function subsSignature(
  subs: { table: string; event?: string; filter?: string }[]
): string {
  return subs
    .map((s) => `${s.table}|${s.event ?? "*"}|${s.filter ?? ""}`)
    .join(";");
}
```

- [ ] **Step 7: Jalankan kedua test → lulus**

Run: `cd apps/absensi && npx vitest run src/lib/realtime/`
Expected: PASS (6 test)

- [ ] **Step 8: Commit**

```bash
git add apps/absensi/src/lib/realtime/debounce.ts apps/absensi/src/lib/realtime/debounce.test.ts apps/absensi/src/lib/realtime/signature.ts apps/absensi/src/lib/realtime/signature.test.ts
git commit -m "feat(absensi): util debounce + subsSignature untuk lapisan realtime"
```

---

### Task 2b: Hook inti `useRealtimeChannel` + wrapper `useRealtimeInvalidate`

**Files:**
- Create: `src/lib/realtime/useRealtimeChannel.ts`
- Create: `src/lib/realtime/useRealtimeInvalidate.ts`

**Interfaces:**
- Consumes: `subsSignature` (Task 2), `createDebouncer` (Task 2), `createClient` (`@/lib/supabase`), `useQueryClient` (`@tanstack/react-query`).
- Produces:
  - `type RealtimeSub = { table: string; event?: 'INSERT'|'UPDATE'|'DELETE'|'*'; filter?: string; handler: (payload: any) => void }`
  - `useRealtimeChannel(opts: { channelName: string; enabled?: boolean; subs: RealtimeSub[] }): void`
  - `type InvalidateSub = { table: string; event?: 'INSERT'|'UPDATE'|'DELETE'|'*'; filter?: string; queryKeys: unknown[][] }`
  - `useRealtimeInvalidate(opts: { channelName: string; enabled?: boolean; subs: InvalidateSub[]; debounceMs?: number }): void`

- [ ] **Step 1: Implementasi `useRealtimeChannel`**

```ts
// src/lib/realtime/useRealtimeChannel.ts
"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { subsSignature } from "./signature";

export type RealtimeSub = {
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  handler: (payload: any) => void;
};

export function useRealtimeChannel(opts: {
  channelName: string;
  enabled?: boolean;
  subs: RealtimeSub[];
}) {
  const { channelName, enabled = true, subs } = opts;
  const supabase = useMemo(() => createClient(), []);

  // Simpan subs terbaru di ref supaya handler selalu fresh tanpa re-subscribe tiap render.
  const subsRef = useRef(subs);
  subsRef.current = subs;

  // Re-subscribe hanya saat channelName/enabled/bentuk-subs (tabel|event|filter) berubah.
  const signature = subsSignature(subs);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel(channelName);
    subsRef.current.forEach((sub, idx) => {
      channel.on(
        "postgres_changes" as any,
        {
          event: sub.event ?? "*",
          schema: "public",
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        (payload: any) => {
          // Pakai handler terbaru dari ref (indeks stabil karena signature memicu re-subscribe).
          subsRef.current[idx]?.handler(payload);
        }
      );
    });
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, channelName, enabled, signature]);
}
```

- [ ] **Step 2: Implementasi `useRealtimeInvalidate`**

```ts
// src/lib/realtime/useRealtimeInvalidate.ts
"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeChannel } from "./useRealtimeChannel";
import { createDebouncer } from "./debounce";

export type InvalidateSub = {
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  queryKeys: unknown[][];
};

export function useRealtimeInvalidate(opts: {
  channelName: string;
  enabled?: boolean;
  subs: InvalidateSub[];
  debounceMs?: number;
}) {
  const { channelName, enabled = true, subs, debounceMs = 200 } = opts;
  const qc = useQueryClient();
  const debouncer = useMemo(() => createDebouncer(debounceMs), [debounceMs]);

  useEffect(() => () => debouncer.cancelAll(), [debouncer]);

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
        );
      },
    })),
  });
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/absensi && npx tsc --noEmit`
Expected: 0 error (pada file baru; error pre-existing tak-terkait diabaikan bila ada)

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/lib/realtime/useRealtimeChannel.ts apps/absensi/src/lib/realtime/useRealtimeInvalidate.ts
git commit -m "feat(absensi): hook useRealtimeChannel + useRealtimeInvalidate"
```

---

### Task 3: Refactor papan-kehadiran ke `useRealtimeInvalidate`

**Files:**
- Modify: `src/app/dashboard/papan-kehadiran/page.tsx:66-97` (ganti blok `useEffect` channel)

**Interfaces:**
- Consumes: `useRealtimeInvalidate` (Task 2b). QueryKey existing: `["papan-kehadiran", outletStaff?.outlet_id, today]`.

- [ ] **Step 1: Ganti import & blok subscription**

Hapus baris 3 `useEffect` dari import bila tak dipakai lagi (masih dipakai? cek — setelah refactor tidak). Tambah import:

```ts
import { useRealtimeInvalidate } from "@/lib/realtime/useRealtimeInvalidate";
```

Ganti seluruh blok `useEffect(() => { ... }, [outletStaff?.outlet_id, refetch, supabase])` (baris 66-97) dengan:

```ts
  useRealtimeInvalidate({
    channelName: `absensi-papan-${outletStaff?.outlet_id ?? "none"}`,
    enabled: !!outletStaff?.outlet_id,
    subs: [
      { table: "attendance", filter: `outlet_id=eq.${outletStaff?.outlet_id}`, queryKeys: [["papan-kehadiran", outletStaff?.outlet_id, today]] },
      { table: "outlet_attendance_config", filter: `outlet_id=eq.${outletStaff?.outlet_id}`, queryKeys: [["papan-kehadiran", outletStaff?.outlet_id, today]] },
      { table: "global_settings", queryKeys: [["papan-kehadiran", outletStaff?.outlet_id, today]] },
    ],
  });
```

Hapus `useEffect` dari `import { useState, useEffect } from "react"` → jadi `import { useState } from "react"`. Hapus `refetch` dari destructure `useQuery` bila tak dipakai lagi (`const { data, isLoading } = useQuery(...)`).

- [ ] **Step 2: Type-check**

Run: `cd apps/absensi && npx tsc --noEmit`
Expected: 0 error terkait file ini (tak ada referensi `refetch`/`useEffect`/`supabase` yang menggantung).

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/src/app/dashboard/papan-kehadiran/page.tsx
git commit -m "refactor(absensi): papan-kehadiran pakai useRealtimeInvalidate"
```

---

### Task 4: Realtime Cuti — subscription + buang polling notifikasi

**Files:**
- Modify: `src/features/cuti/CutiView.tsx` (tambah subscription)
- Modify: `src/features/cuti/useLeaveNotifications.ts:12-32` (buang `refetchInterval`, ganti ke realtime invalidate)

**Interfaces:**
- Consumes: `useRealtimeInvalidate`. QueryKeys existing: `['leaves', userId]`, `['leaveBalance', userId, year]`, `['unread-leaves-count', outletStaff?.id]`.

- [ ] **Step 1: CutiView — subscribe `leave_requests` milik user**

Tambah import di `CutiView.tsx`:

```ts
import { useRealtimeInvalidate } from "@/lib/realtime/useRealtimeInvalidate";
```

Setelah baris `const currentYear = new Date().getFullYear();`, tambah:

```ts
  useRealtimeInvalidate({
    channelName: `absensi-cuti-${userId ?? "none"}`,
    enabled: !!userId,
    subs: [
      {
        table: "leave_requests",
        filter: `staff_id=eq.${userId}`,
        queryKeys: [
          ["leaves", userId],
          ["leaveBalance", userId, currentYear],
          ["unread-leaves-count", userId],
        ],
      },
    ],
  });
```

- [ ] **Step 2: `useLeaveNotifications` — buang polling**

Di `useLeaveNotifications.ts`, hapus baris `refetchInterval: 15000,` (baris 31). Query tetap ada (dipakai badge), tapi refresh-nya kini dari invalidasi realtime di Step 1 (yang meng-invalidate `['unread-leaves-count', userId]`).

- [ ] **Step 3: Type-check**

Run: `cd apps/absensi && npx tsc --noEmit`
Expected: 0 error terkait.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/features/cuti/CutiView.tsx apps/absensi/src/features/cuti/useLeaveNotifications.ts
git commit -m "feat(absensi): cuti realtime + buang polling notifikasi 15s"
```

---

### Task 5: Realtime Kasbon

**Files:**
- Modify: `src/features/kasbon/KasbonView.tsx` (tambah subscription)

**Interfaces:**
- Consumes: `useRealtimeInvalidate`, `useAuth`. QueryKey existing: `['kasbon', userId]`.

- [ ] **Step 1: Baca queryKey & userId aktual**

Run: `cd apps/absensi && grep -n "queryKey\|outletStaff\|userId\|useAuth" src/features/kasbon/KasbonView.tsx | head -20`
Expected: melihat `['kasbon', userId]` dan sumber `userId` (`outletStaff?.id`).

- [ ] **Step 2: Tambah subscription**

Tambah import:

```ts
import { useRealtimeInvalidate } from "@/lib/realtime/useRealtimeInvalidate";
```

Setelah `userId` terdefinisi di komponen, tambah (pakai nama variabel userId yang ada di file):

```ts
  useRealtimeInvalidate({
    channelName: `absensi-kasbon-${userId ?? "none"}`,
    enabled: !!userId,
    subs: [
      { table: "cash_advances", filter: `staff_id=eq.${userId}`, queryKeys: [["kasbon", userId]] },
      { table: "cash_advance_installments", queryKeys: [["kasbon", userId]] },
    ],
  });
```

> Catatan: `cash_advance_installments` di-subscribe tanpa filter (tak ada kolom staff_id langsung); volume rendah, dapat diterima. Bila tabel tak ada, hook aman (event tak pernah datang), dan migration Task 1 sudah men-skip tabel yang tak ada.

- [ ] **Step 3: Type-check**

Run: `cd apps/absensi && npx tsc --noEmit`
Expected: 0 error terkait.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/features/kasbon/KasbonView.tsx
git commit -m "feat(absensi): kasbon realtime"
```

---

### Task 6: Realtime Rekap

**Files:**
- Modify: `src/app/dashboard/rekap/page.tsx` (tambah subscription)

**Interfaces:**
- Consumes: `useRealtimeInvalidate`. QueryKey existing (baris 47): `["rekap", outletStaff?.outlet_id, date]`.

- [ ] **Step 1: Tambah subscription**

Tambah import:

```ts
import { useRealtimeInvalidate } from "@/lib/realtime/useRealtimeInvalidate";
```

Setelah `useQuery` yang mendefinisikan `rows`, tambah:

```ts
  useRealtimeInvalidate({
    channelName: `absensi-rekap-${outletStaff?.outlet_id ?? "none"}`,
    enabled: !!outletStaff?.outlet_id,
    subs: [
      { table: "attendance", filter: `outlet_id=eq.${outletStaff?.outlet_id}`, queryKeys: [["rekap", outletStaff?.outlet_id, date]] },
    ],
  });
```

- [ ] **Step 2: Type-check**

Run: `cd apps/absensi && npx tsc --noEmit`
Expected: 0 error terkait.

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/src/app/dashboard/rekap/page.tsx
git commit -m "feat(absensi): rekap realtime"
```

---

### Task 7: Realtime Manajemen Kru (halaman enroll)

**Files:**
- Modify: `src/app/dashboard/enroll/page.tsx` (subscribe `outlet_staff`, reload list)

**Interfaces:**
- Consumes: `useRealtimeChannel` (varian callback — enroll pakai `useState`, bukan React Query). Fungsi load existing mengisi `setStaffList` via query `.from("outlet_staff")` (baris 56-62).

- [ ] **Step 1: Baca fungsi load existing untuk dipanggil ulang**

Run: `cd apps/absensi && grep -n "async function\|const load\|setStaffList\|selectedOutletId\|useEffect" src/app/dashboard/enroll/page.tsx | head -30`
Expected: menemukan nama fungsi loader (mis. `loadStaff`) dan dependency `selectedOutletId`.

- [ ] **Step 2: Tambah subscription callback**

Tambah import:

```ts
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
```

Ekstrak logika load staff ke fungsi stabil `loadStaff` (bila belum) yang membaca `selectedOutletId` dan memanggil `setStaffList`. Lalu tambahkan (gunakan nama loader aktual dari Step 1):

```ts
  useRealtimeChannel({
    channelName: `absensi-staff-${selectedOutletId || "none"}`,
    enabled: !!selectedOutletId,
    subs: [
      {
        table: "outlet_staff",
        filter: `outlet_id=eq.${selectedOutletId}`,
        handler: () => { loadStaff(); },
      },
    ],
  });
```

> `loadStaff` harus stabil (didefinisikan via `useCallback` atau dipanggil lewat ref) agar tak memicu re-subscribe. Bila file memakai pola inline, bungkus loader dengan `useCallback([selectedOutletId])`; `channelName` sudah berubah saat outlet berganti sehingga re-subscribe benar.

- [ ] **Step 3: Type-check**

Run: `cd apps/absensi && npx tsc --noEmit`
Expected: 0 error terkait.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/dashboard/enroll/page.tsx
git commit -m "feat(absensi): manajemen kru (enroll) realtime via outlet_staff"
```

---

### Task 8: Realtime Pengaturan

**Files:**
- Modify: `src/app/dashboard/pengaturan/PengaturanClient.tsx` (subscribe config + global_settings)

**Interfaces:**
- Consumes: `useRealtimeChannel` atau `useRealtimeInvalidate` tergantung apakah PengaturanClient pakai React Query. Tentukan di Step 1.

- [ ] **Step 1: Deteksi pola data-loading PengaturanClient**

Run: `cd apps/absensi && grep -n "useQuery\|queryKey\|useState\|createClient\|fetchConfig\|from(\"outlet_attendance_config\"" src/app/dashboard/pengaturan/PengaturanClient.tsx | head -30`
Expected: menentukan apakah pakai `useQuery` (→ `useRealtimeInvalidate` dengan queryKey terlihat) atau `useState`+loader (→ `useRealtimeChannel` callback).

- [ ] **Step 2a: Bila React Query — pakai `useRealtimeInvalidate`**

```ts
import { useRealtimeInvalidate } from "@/lib/realtime/useRealtimeInvalidate";
// ...
  useRealtimeInvalidate({
    channelName: `absensi-pengaturan-${outletId ?? "none"}`,
    enabled: !!outletId,
    subs: [
      { table: "outlet_attendance_config", filter: `outlet_id=eq.${outletId}`, queryKeys: [[/* queryKey config aktual dari Step 1 */]] },
      { table: "global_settings", queryKeys: [[/* queryKey config aktual */]] },
    ],
  });
```

- [ ] **Step 2b: Bila useState + loader — pakai `useRealtimeChannel`**

```ts
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
// ...
  useRealtimeChannel({
    channelName: `absensi-pengaturan-${outletId ?? "none"}`,
    enabled: !!outletId,
    subs: [
      { table: "outlet_attendance_config", filter: `outlet_id=eq.${outletId}`, handler: () => loadConfig() },
      { table: "global_settings", handler: () => loadConfig() },
    ],
  });
```

Pilih SATU cabang sesuai Step 1; gunakan nama queryKey/loader aktual.

- [ ] **Step 3: Type-check**

Run: `cd apps/absensi && npx tsc --noEmit`
Expected: 0 error terkait.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/dashboard/pengaturan/PengaturanClient.tsx
git commit -m "feat(absensi): pengaturan realtime (config + global_settings)"
```

---

### Task 9: Konsolidasi halaman realtime existing (checklist + kiosk)

**Files:**
- Modify: `src/app/dashboard/checklist-monitor/page.tsx:111-128` (channel name stabil, tanpa `Date.now()`)
- Modify: `src/app/dashboard/kru-checklist/page.tsx:152-186` (channel name stabil)
- Modify: `src/features/clock/AttendanceKioskPanel.tsx:110-139` (channel name stabil; tabel `outlets`/`global_settings` kini hidup berkat Task 1)

**Interfaces:**
- Consumes: publication dari Task 1 (kini `outlet_attendance_config`, `global_settings` benar-benar memancarkan event).

> Halaman-halaman ini sudah punya realtime yang berfungsi (termasuk optimistic & DELETE handling). Perubahan minimal & rendah-risiko: hanya stabilkan nama channel agar tak membuat channel baru tiap mount (hemat koneksi). Tidak me-rewrite ke hook baru untuk menghindari regresi. Reviewer boleh menolak task ini tanpa memengaruhi Task 1-8.

- [ ] **Step 1: checklist-monitor — nama channel stabil**

Di `subscribeRealtime` (baris 116), ubah:
```ts
.channel(`spv-monitor-${outletStaff!.outlet_id}-${Date.now()}`)
```
menjadi:
```ts
.channel(`absensi-checklist-monitor-${outletStaff!.outlet_id}`)
```

- [ ] **Step 2: kru-checklist — nama channel stabil**

Di `subscribeRealtime` (baris 159), ubah:
```ts
const channelName = `checklist-ticks-${rid}-${Date.now()}`;
```
menjadi:
```ts
const channelName = `absensi-checklist-ticks-${rid}`;
```

- [ ] **Step 3: AttendanceKioskPanel — nama channel stabil**

Baris 110 sudah `kiosk-realtime-${outletId}` (stabil) — tak berubah. Pastikan tak ada `Date.now()`. Verifikasi:

Run: `cd apps/absensi && grep -n "Date.now()" src/features/clock/AttendanceKioskPanel.tsx`
Expected: kosong (tidak ada).

- [ ] **Step 4: Type-check + test**

Run: `cd apps/absensi && npx tsc --noEmit && npx vitest run`
Expected: 0 type error terkait; semua Vitest hijau.

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/app/dashboard/checklist-monitor/page.tsx apps/absensi/src/app/dashboard/kru-checklist/page.tsx
git commit -m "refactor(absensi): nama channel realtime stabil (hemat koneksi)"
```

---

### Task 10: Verifikasi menyeluruh + apply migration + dokumentasi

**Files:**
- Modify: `CLAUDE.md` (catatan sesi)

- [ ] **Step 1: Type-check & test penuh**

Run: `cd apps/absensi && npx tsc --noEmit && npx vitest run`
Expected: 0 error, semua test hijau.

- [ ] **Step 2: Apply migration ke remote**

Run: `cd "C:/Users/Digital Marketing/OneDrive/Desktop/project/DIGITALISASI-SS-PROJECT" && supabase db push`
Expected: migration `20260710120000` applied. Bila drift, `supabase migration repair` sesuai gotcha CLAUDE.md.

- [ ] **Step 3: Verifikasi publication & replica identity di DB live**

Jalankan via Supabase SQL Editor:
```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND schemaname='public' ORDER BY 1;
SELECT relname, relreplident FROM pg_class
WHERE relname IN ('attendance','leave_requests','cash_advances','outlet_staff','outlet_attendance_config');
```
Expected: 9 tabel baru ada di publication; `relreplident = 'f'` untuk tabel target.

- [ ] **Step 4: Audit RLS SELECT (manual)**

Pastikan user yang menonton bisa `SELECT` baris yang relevan (kalau tidak, realtime tak terkirim):
- Crew: `leave_requests`/`cash_advances` milik sendiri (filter staff_id).
- SPV/board: `outlet_staff`, `attendance`, `outlet_attendance_config` untuk outletnya.
Bila kurang, tambah policy aditif (jangan longgarkan lintas-outlet). Catat temuan.

- [ ] **Step 5: Smoke test 2-device (bukti realtime, tanpa refresh)**

1. Crew absen di kiosk → papan-kehadiran device SPV update < 1 dtk.
2. Ubah status cuti crew di DB/admin-dashboard → layar CutiView crew berubah + badge, tanpa refresh.
3. Nonaktif/hapus staff di enroll → hilang instan di device lain.
4. Toggle checklist crew → monitor SPV update instan.
5. Ubah `outlet_attendance_config` (jam masuk) → papan-kehadiran & kiosk ikut update (regresi: dulu mati).

- [ ] **Step 6: Catat sesi di CLAUDE.md**

Tambah section `## Session 2026-07-10: Absensi Realtime Menyeluruh` berisi: lapisan realtime terpusat, migration publication + replica identity, temuan publication mati diperbaiki, polling notifikasi cuti dibuang, catatan "perlu redeploy `absensi.sukashawarma.com`".

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: catatan sesi absensi realtime menyeluruh"
```

---

## Self-Review Notes

- **Spec coverage:** §2 lapisan terpusat → Task 2/2b; §3 peta surface → Task 3-9 (papan, kiosk, checklist, cuti, kasbon, enroll, pengaturan, rekap); §4 migration → Task 1; buang polling → Task 4; §5 ringan (1 channel/scope, invalidate+debounce, nama channel stabil) → Task 2b/9; §6 testing → Task 2 + Task 10.
- **Optimistic "campur":** kiosk absen & toggle checklist SUDAH optimistic di kode existing (KioskClient/kru-checklist memanggil API lalu update state); tidak ada task baru diperlukan — realtime echo hanya menambah sinkronisasi lintas-device. Ditegaskan di Task 9 (tak me-rewrite agar optimistic existing utuh).
- **Type consistency:** `useRealtimeChannel`/`useRealtimeInvalidate` signature dipakai konsisten di Task 3-8; `RealtimeSub.handler` vs `InvalidateSub.queryKeys` dibedakan jelas.
- **No placeholders:** Task 5/7/8 punya Step "baca queryKey/loader aktual" karena file memakai nama lokal yang harus dikutip persis — perintah grep disediakan agar implementer mengisi nilai nyata, bukan menebak.
