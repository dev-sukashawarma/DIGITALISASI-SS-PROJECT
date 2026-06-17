# Fitur 1 — Permintaan Bahan Baku Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Outlet (crew) menginisiasi permintaan bahan baku; kepala_outlet kitchen approve/edit/tolak; approve otomatis membuat draft surat jalan yang terhubung.

**Architecture:** Dua tabel baru (`permintaan_bahan`, `permintaan_bahan_item`) + RPC `approve_permintaan`/`tolak_permintaan` (SECURITY DEFINER). RPC approve memanggil ulang logika pembuatan surat jalan yang sudah ada (`create_surat_jalan`) lalu menautkan `surat_jalan_id`. UI baru di app `stok` (route `/stok/permintaan`): form buat (crew, dibantu saran item di bawah threshold dari `monitoring_view_crew`) + layar approval (kepala_outlet kitchen). Notifikasi status realtime via Supabase channel per outlet.

**Tech Stack:** Supabase (Postgres + RLS + RPC + Realtime), Next.js App Router, TypeScript, TailwindCSS, `@suka/design-system`, `@suka/auth`.

**Konstanta penting:**
- Kitchen outlet id: `550e8400-e29b-41d4-a716-446655440001` (slug `kitchen-bogor`).
- Surat jalan `outlet_id` = outlet **tujuan/penerima** (= outlet peminta). `create_surat_jalan(p_outlet_id, p_items jsonb)` set `created_by = auth.uid()`, status `draft`. Item JSON shape: `{ bahan_baku_id, qty_dikirim }`.
- Status threshold dari `monitoring_view_crew`: `below` / `warning` / `ok`.

---

## File Structure

- `supabase/migrations/20260615000100_create_permintaan_bahan.sql` — tabel + index.
- `supabase/migrations/20260615000200_permintaan_bahan_rls.sql` — RLS policies.
- `supabase/migrations/20260615000300_permintaan_bahan_rpc.sql` — RPC create/approve/tolak.
- `supabase/migrations/20260615000400_permintaan_realtime.sql` — tambah tabel ke publication realtime.
- `apps/stok/src/types/permintaan.ts` — tipe TS.
- `apps/stok/src/hooks/usePermintaan.ts` — hook list + actions.
- `apps/stok/src/components/permintaan/PermintaanForm.tsx` — form buat (crew).
- `apps/stok/src/components/permintaan/PermintaanList.tsx` — list permintaan outlet (crew) + status badge + realtime.
- `apps/stok/src/components/permintaan/ApprovalList.tsx` — layar approval (kitchen).
- `apps/stok/src/components/permintaan/ApprovalModal.tsx` — modal edit qty/item + approve/tolak.
- `apps/stok/src/app/stok/permintaan/page.tsx` — route utama (render Form+List untuk crew, ApprovalList untuk kitchen).
- `apps/stok/src/components/permintaan/__tests__/PermintaanForm.test.tsx` — test komponen.

---

## Task 1: Migration — tabel permintaan_bahan & item

**Files:**
- Create: `supabase/migrations/20260615000100_create_permintaan_bahan.sql`

- [x] **Step 1: Tulis migration**

```sql
-- Permintaan bahan baku: outlet menginisiasi, kitchen approve.
CREATE TABLE permintaan_bahan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  dibuat_oleh UUID NOT NULL REFERENCES outlet_staff(id),
  status TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu','disetujui','ditolak')),
  catatan_kitchen TEXT,
  surat_jalan_id UUID REFERENCES surat_jalan(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permintaan_outlet ON permintaan_bahan(outlet_id);
CREATE INDEX idx_permintaan_status ON permintaan_bahan(status);
CREATE INDEX idx_permintaan_created ON permintaan_bahan(created_at DESC);

CREATE TABLE permintaan_bahan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permintaan_id UUID NOT NULL REFERENCES permintaan_bahan(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  qty_diminta NUMERIC NOT NULL CHECK (qty_diminta > 0),
  qty_disetujui NUMERIC CHECK (qty_disetujui IS NULL OR qty_disetujui >= 0),
  UNIQUE(permintaan_id, bahan_baku_id)
);

CREATE INDEX idx_permintaan_item_permintaan ON permintaan_bahan_item(permintaan_id);
```

- [x] **Step 2: Verifikasi syntax lokal**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && supabase db push --dry-run`
Expected: tidak ada error parse pada file migration baru. (Kalau remote diverged, lihat catatan migration repair di CLAUDE.md — jangan db push polos.)

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260615000100_create_permintaan_bahan.sql
git commit -m "feat(db): tabel permintaan_bahan & item"
```

---

## Task 2: Migration — RLS permintaan_bahan

**Files:**
- Create: `supabase/migrations/20260615000200_permintaan_bahan_rls.sql`

Aturan:
- Outlet staff melihat/insert permintaan untuk outletnya sendiri (`accessible_outlet_ids()` sudah ada — meresolusi scope termasuk kepala_outlet multi-outlet, spv/admin/owner semua).
- Kepala_outlet kitchen (akses ke outlet kitchen) melihat semua permintaan (untuk approval). Karena spv/admin/owner sudah dapat semua via `accessible_outlet_ids()`, satu policy SELECT berbasis itu cukup; tambah klausa khusus agar staff kitchen melihat lintas outlet.

- [x] **Step 1: Tulis migration**

```sql
ALTER TABLE permintaan_bahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE permintaan_bahan_item ENABLE ROW LEVEL SECURITY;

-- Helper: apakah user punya akses ke outlet kitchen (approver)
CREATE OR REPLACE FUNCTION is_kitchen_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT '550e8400-e29b-41d4-a716-446655440001'::uuid = ANY (accessible_outlet_ids());
$$;

-- SELECT: outlet sendiri ATAU staff kitchen (lihat semua untuk approval)
CREATE POLICY permintaan_select ON permintaan_bahan
  FOR SELECT USING (
    outlet_id = ANY (accessible_outlet_ids()) OR is_kitchen_staff()
  );

-- INSERT: hanya untuk outlet yang diakses, dan dibuat_oleh = user
CREATE POLICY permintaan_insert ON permintaan_bahan
  FOR INSERT WITH CHECK (
    outlet_id = ANY (accessible_outlet_ids()) AND dibuat_oleh = auth.uid()
  );

-- UPDATE: hanya staff kitchen (approve/tolak lewat RPC; policy ini back-stop)
CREATE POLICY permintaan_update ON permintaan_bahan
  FOR UPDATE USING (is_kitchen_staff());

-- Item: ikut parent permintaan
CREATE POLICY permintaan_item_select ON permintaan_bahan_item
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM permintaan_bahan p WHERE p.id = permintaan_id
            AND (p.outlet_id = ANY (accessible_outlet_ids()) OR is_kitchen_staff()))
  );

CREATE POLICY permintaan_item_insert ON permintaan_bahan_item
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM permintaan_bahan p WHERE p.id = permintaan_id
            AND p.outlet_id = ANY (accessible_outlet_ids()))
  );

CREATE POLICY permintaan_item_update ON permintaan_bahan_item
  FOR UPDATE USING (is_kitchen_staff());
```

- [x] **Step 2: Verifikasi `accessible_outlet_ids()` ada**

Run: `grep -rn "accessible_outlet_ids" supabase/migrations/20260613000500_accessible_outlets_fn.sql`
Expected: definisi fungsi muncul (return `uuid[]`). Kalau return type beda, sesuaikan pemakaian `= ANY(...)`.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260615000200_permintaan_bahan_rls.sql
git commit -m "feat(db): RLS permintaan_bahan + is_kitchen_staff helper"
```

---

## Task 3: Migration — RPC create / approve / tolak

**Files:**
- Create: `supabase/migrations/20260615000300_permintaan_bahan_rpc.sql`

- [x] **Step 1: Tulis migration**

```sql
-- buat_permintaan(outlet_id, items jsonb) -> permintaan_bahan
-- items: [{ bahan_baku_id, qty_diminta }]
CREATE OR REPLACE FUNCTION buat_permintaan(
  p_outlet_id UUID,
  p_items JSONB
)
RETURNS permintaan_bahan
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p permintaan_bahan;
  v_item JSONB;
BEGIN
  IF NOT (p_outlet_id = ANY (accessible_outlet_ids())) THEN
    RAISE EXCEPTION 'tidak punya akses ke outlet %', p_outlet_id;
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'permintaan harus berisi minimal 1 item';
  END IF;

  INSERT INTO permintaan_bahan (outlet_id, dibuat_oleh)
  VALUES (p_outlet_id, auth.uid())
  RETURNING * INTO v_p;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta)
    VALUES (v_p.id, (v_item->>'bahan_baku_id')::UUID, (v_item->>'qty_diminta')::NUMERIC);
  END LOOP;

  RETURN v_p;
END;
$$;

-- approve_permintaan(permintaan_id, items jsonb)
-- items final (sudah diedit kitchen): [{ bahan_baku_id, qty_disetujui }]
-- Set qty_disetujui per item, buat draft surat_jalan, tautkan surat_jalan_id.
CREATE OR REPLACE FUNCTION approve_permintaan(
  p_permintaan_id UUID,
  p_items JSONB
)
RETURNS permintaan_bahan
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p permintaan_bahan;
  v_item JSONB;
  v_sj surat_jalan;
  v_sj_items JSONB := '[]'::jsonb;
  v_bahan UUID;
  v_qty NUMERIC;
BEGIN
  IF NOT is_kitchen_staff() THEN
    RAISE EXCEPTION 'hanya staff kitchen yang dapat approve';
  END IF;

  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id;
  END IF;
  IF v_p.status != 'menunggu' THEN
    RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status;
  END IF;

  -- Update qty_disetujui per item & susun item surat jalan (skip qty 0)
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_bahan := (v_item->>'bahan_baku_id')::UUID;
    v_qty := (v_item->>'qty_disetujui')::NUMERIC;

    UPDATE permintaan_bahan_item
    SET qty_disetujui = v_qty
    WHERE permintaan_id = p_permintaan_id AND bahan_baku_id = v_bahan;

    -- Item baru yang ditambah kitchen (belum ada di permintaan) -> insert
    IF NOT FOUND THEN
      INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta, qty_disetujui)
      VALUES (p_permintaan_id, v_bahan, v_qty, v_qty);
    END IF;

    IF v_qty > 0 THEN
      v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan, 'qty_dikirim', v_qty);
    END IF;
  END LOOP;

  -- Item di permintaan yang tidak ada di p_items dianggap ditolak (qty_disetujui = 0)
  UPDATE permintaan_bahan_item
  SET qty_disetujui = 0
  WHERE permintaan_id = p_permintaan_id AND qty_disetujui IS NULL;

  IF jsonb_array_length(v_sj_items) = 0 THEN
    RAISE EXCEPTION 'tidak ada item disetujui (qty > 0); gunakan tolak_permintaan';
  END IF;

  -- Buat draft surat jalan ke outlet peminta
  v_sj := create_surat_jalan(v_p.outlet_id, v_sj_items);

  UPDATE permintaan_bahan
  SET status = 'disetujui', surat_jalan_id = v_sj.id, updated_at = NOW()
  WHERE id = p_permintaan_id
  RETURNING * INTO v_p;

  RETURN v_p;
END;
$$;

-- tolak_permintaan(permintaan_id, alasan)
CREATE OR REPLACE FUNCTION tolak_permintaan(
  p_permintaan_id UUID,
  p_alasan TEXT
)
RETURNS permintaan_bahan
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p permintaan_bahan;
BEGIN
  IF NOT is_kitchen_staff() THEN
    RAISE EXCEPTION 'hanya staff kitchen yang dapat menolak';
  END IF;

  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id;
  END IF;
  IF v_p.status != 'menunggu' THEN
    RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status;
  END IF;

  UPDATE permintaan_bahan
  SET status = 'ditolak', catatan_kitchen = p_alasan, updated_at = NOW()
  WHERE id = p_permintaan_id
  RETURNING * INTO v_p;

  RETURN v_p;
END;
$$;
```

- [x] **Step 2: Verifikasi tanda tangan `create_surat_jalan` cocok**

Run: `grep -n "FUNCTION create_surat_jalan" supabase/migrations/20260609002100_create_surat_jalan_rpc.sql`
Expected: `create_surat_jalan(p_outlet_id UUID, p_items JSONB) RETURNS surat_jalan`. Item shape `{bahan_baku_id, qty_dikirim}` cocok dengan `v_sj_items`.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260615000300_permintaan_bahan_rpc.sql
git commit -m "feat(db): RPC buat/approve/tolak permintaan + auto draft surat jalan"
```

---

## Task 4: Migration — realtime publication

**Files:**
- Create: `supabase/migrations/20260615000400_permintaan_realtime.sql`

- [x] **Step 1: Tulis migration**

```sql
-- Aktifkan realtime agar crew mendapat notif perubahan status.
ALTER PUBLICATION supabase_realtime ADD TABLE permintaan_bahan;
ALTER TABLE permintaan_bahan REPLICA IDENTITY FULL;
```

- [x] **Step 2: Verifikasi pola publication yang sudah dipakai**

Run: `grep -rn "supabase_realtime ADD TABLE" supabase/migrations`
Expected: ada preseden (mis. attendance). Kalau publication belum ada di proyek, ganti dengan pola yang dipakai migration `20260612000003_fix_realtime_attendance.sql`.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/20260615000400_permintaan_realtime.sql
git commit -m "feat(db): realtime untuk permintaan_bahan"
```

---

## Task 5: Tipe TypeScript

**Files:**
- Create: `apps/stok/src/types/permintaan.ts`

- [x] **Step 1: Tulis tipe**

```typescript
export type PermintaanStatus = 'menunggu' | 'disetujui' | 'ditolak'

export interface PermintaanItem {
  id: string
  permintaan_id: string
  bahan_baku_id: string
  qty_diminta: number
  qty_disetujui: number | null
}

export interface Permintaan {
  id: string
  outlet_id: string
  dibuat_oleh: string
  status: PermintaanStatus
  catatan_kitchen: string | null
  surat_jalan_id: string | null
  created_at: string
  updated_at: string
}

export interface PermintaanWithItems extends Permintaan {
  items: PermintaanItem[]
  outlet_name?: string
}

// Payload submit dari form crew
export interface BuatPermintaanItemInput {
  bahan_baku_id: string
  qty_diminta: number
}

// Payload approve dari kitchen
export interface ApproveItemInput {
  bahan_baku_id: string
  qty_disetujui: number
}
```

- [x] **Step 2: Type check**

Run: `cd apps/stok && yarn type-check`
Expected: PASS (file baru, belum dipakai).

- [x] **Step 3: Commit**

```bash
git add apps/stok/src/types/permintaan.ts
git commit -m "feat(stok): tipe permintaan bahan"
```

---

## Task 6: Hook usePermintaan

**Files:**
- Create: `apps/stok/src/hooks/usePermintaan.ts`

Ikuti pola `useLedger.ts` (`createClient` dari `@/lib/supabase`). Sediakan: daftar permintaan outlet (crew), daftar approval (kitchen, status menunggu), saran item di bawah threshold (dari `monitoring_view_crew`), dan actions buat/approve/tolak via RPC.

- [x] **Step 1: Tulis hook**

```typescript
'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type {
  PermintaanWithItems, BuatPermintaanItemInput, ApproveItemInput,
} from '@/types/permintaan'

// Saran item di bawah threshold untuk form crew
export interface SaranItem {
  bahan_baku_id: string
  item_name: string
  satuan: string
  current_qty: number
  threshold: number
}

export function useSaranItem(outletId: string | undefined) {
  const [saran, setSaran] = useState<SaranItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!outletId) { setLoading(false); return }
    const supabase = createClient()
    const load = async () => {
      const { data, error } = await supabase
        .from('monitoring_view_crew')
        .select('bahan_baku_id, item_name, satuan, current_qty, threshold, status')
        .eq('outlet_id', outletId)
        .in('status', ['below', 'warning'])
      if (!error && data) {
        setSaran(data.map((d: any) => ({
          bahan_baku_id: d.bahan_baku_id, item_name: d.item_name,
          satuan: d.satuan, current_qty: d.current_qty, threshold: d.threshold,
        })))
      }
      setLoading(false)
    }
    load()
  }, [outletId])
  return { saran, loading }
}

async function loadPermintaan(filter: { outletId?: string; pendingOnly?: boolean }) {
  const supabase = createClient()
  let q = supabase
    .from('permintaan_bahan')
    .select('*, items:permintaan_bahan_item(*), outlets(name)')
    .order('created_at', { ascending: false })
  if (filter.outletId) q = q.eq('outlet_id', filter.outletId)
  if (filter.pendingOnly) q = q.eq('status', 'menunggu')
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    ...r, outlet_name: r.outlets?.name,
  })) as PermintaanWithItems[]
}

export function usePermintaanList(outletId: string | undefined) {
  const [data, setData] = useState<PermintaanWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!outletId) { setLoading(false); return }
    try {
      setData(await loadPermintaan({ outletId }))
      setError(null)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [outletId])

  useEffect(() => { refresh() }, [refresh])

  // Realtime: refresh saat ada perubahan status untuk outlet ini
  useEffect(() => {
    if (!outletId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`permintaan:${outletId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'permintaan_bahan', filter: `outlet_id=eq.${outletId}` },
        () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [outletId, refresh])

  return { permintaan: data, loading, error, refresh }
}

export function useApprovalList() {
  const [data, setData] = useState<PermintaanWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setData(await loadPermintaan({ pendingOnly: true }))
      setError(null)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { permintaan: data, loading, error, refresh }
}

export function usePermintaanActions() {
  const supabase = createClient()
  const buat = useCallback(async (outletId: string, items: BuatPermintaanItemInput[]) => {
    const { error } = await supabase.rpc('buat_permintaan', {
      p_outlet_id: outletId, p_items: items,
    })
    if (error) throw new Error(error.message)
  }, [supabase])
  const approve = useCallback(async (permintaanId: string, items: ApproveItemInput[]) => {
    const { error } = await supabase.rpc('approve_permintaan', {
      p_permintaan_id: permintaanId, p_items: items,
    })
    if (error) throw new Error(error.message)
  }, [supabase])
  const tolak = useCallback(async (permintaanId: string, alasan: string) => {
    const { error } = await supabase.rpc('tolak_permintaan', {
      p_permintaan_id: permintaanId, p_alasan: alasan,
    })
    if (error) throw new Error(error.message)
  }, [supabase])
  return { buat, approve, tolak }
}
```

- [x] **Step 2: Type check**

Run: `cd apps/stok && yarn type-check`
Expected: PASS. Kalau `createClient` path beda, samakan dengan import di `useLedger.ts` (`@/lib/supabase`).

- [x] **Step 3: Commit**

```bash
git add apps/stok/src/hooks/usePermintaan.ts
git commit -m "feat(stok): hook usePermintaan (list, approval, saran, actions)"
```

---

## Task 7: PermintaanForm (crew membuat permintaan)

**Files:**
- Create: `apps/stok/src/components/permintaan/PermintaanForm.tsx`
- Test: `apps/stok/src/components/permintaan/__tests__/PermintaanForm.test.tsx`

Form menampilkan saran item (centang + qty default = `threshold - current_qty`, dibulatkan ke atas, minimal 1) dan opsi tambah item manual dari `useBahanBaku`. Submit → `buat()`.

- [x] **Step 1: Tulis test gagal**

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PermintaanForm } from '../PermintaanForm'

vi.mock('@/hooks/usePermintaan', () => ({
  useSaranItem: () => ({
    saran: [{ bahan_baku_id: 'b1', item_name: 'Daging', satuan: 'kg', current_qty: 2, threshold: 10 }],
    loading: false,
  }),
  usePermintaanActions: () => ({ buat: vi.fn(), approve: vi.fn(), tolak: vi.fn() }),
}))
vi.mock('@/hooks/useBahanBaku', () => ({ useBahanBaku: () => ({ bahanBaku: [] }) }))

describe('PermintaanForm', () => {
  it('menampilkan item saran di bawah threshold', () => {
    render(<PermintaanForm outletId="o1" />)
    expect(screen.getByText(/Daging/)).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/stok && yarn vitest run src/components/permintaan/__tests__/PermintaanForm.test.tsx`
Expected: FAIL — `Cannot find module '../PermintaanForm'`.

- [x] **Step 3: Implementasi komponen**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input } from '@suka/design-system'
import { useSaranItem, usePermintaanActions } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'

interface Row { bahan_baku_id: string; nama: string; satuan: string; qty: string; checked: boolean }

export function PermintaanForm({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { saran } = useSaranItem(outletId)
  const { bahanBaku } = useBahanBaku()
  const { buat } = usePermintaanActions()
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Inisialisasi baris dari saran (qty default = kekurangan ke threshold)
  const saranRows: Row[] = saran.map(s => {
    const existing = rows[s.bahan_baku_id]
    const def = Math.max(1, Math.ceil(s.threshold - s.current_qty))
    return existing ?? {
      bahan_baku_id: s.bahan_baku_id, nama: s.item_name, satuan: s.satuan,
      qty: String(def), checked: true,
    }
  })

  function setRow(id: string, patch: Partial<Row>, base?: Row) {
    setRows(prev => ({ ...prev, [id]: { ...(prev[id] ?? base!), ...patch } }))
  }

  const selected = saranRows.filter(r => r.checked && Number(r.qty) > 0)
  const valid = selected.length > 0 && !busy

  async function submit() {
    setBusy(true); setErrorMsg(null)
    try {
      await buat(outletId, selected.map(r => ({
        bahan_baku_id: r.bahan_baku_id, qty_diminta: Number(r.qty),
      })))
      router.push('/stok/permintaan')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <Card className="p-6 border border-[#d9c2b2]/45 rounded-2xl shadow-sm space-y-4 bg-white">
      <h2 className="text-xs font-bold text-[#544437]/75 uppercase tracking-wide">Item Menipis / Kritis</h2>
      {saranRows.length === 0 && (
        <p className="text-xs text-[#544437]/60">Tidak ada item di bawah threshold. Stok aman.</p>
      )}
      <div className="space-y-2">
        {saranRows.map(r => (
          <div key={r.bahan_baku_id} className="flex items-center gap-3 border border-[#d9c2b2]/40 rounded-xl px-3 py-2">
            <input
              type="checkbox"
              checked={r.checked}
              onChange={e => setRow(r.bahan_baku_id, { checked: e.target.checked }, r)}
            />
            <span className="flex-1 text-xs font-semibold text-[#1e1b15]">{r.nama}</span>
            <Input
              type="number" inputMode="decimal" value={r.qty}
              onChange={e => setRow(r.bahan_baku_id, { qty: e.target.value }, r)}
              className="w-24 px-3 py-1.5 border border-[#d9c2b2]/40 rounded-lg text-xs"
            />
            <span className="text-[10px] text-[#544437]/60 w-8">{r.satuan}</span>
          </div>
        ))}
      </div>

      {errorMsg && <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-3 rounded-xl">{errorMsg}</p>}

      <Button
        disabled={!valid}
        onClick={submit}
        className="w-full bg-[#f29744] hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider disabled:opacity-40"
      >
        {busy ? 'Mengirim…' : `Kirim Permintaan (${selected.length} item)`}
      </Button>
    </Card>
  )
}
```

- [x] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/stok && yarn vitest run src/components/permintaan/__tests__/PermintaanForm.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/stok/src/components/permintaan/PermintaanForm.tsx apps/stok/src/components/permintaan/__tests__/PermintaanForm.test.tsx
git commit -m "feat(stok): PermintaanForm dengan saran item threshold"
```

---

## Task 8: PermintaanList (crew melihat status + realtime)

**Files:**
- Create: `apps/stok/src/components/permintaan/PermintaanList.tsx`

- [x] **Step 1: Implementasi**

```tsx
'use client'
import { Card } from '@suka/design-system'
import { usePermintaanList } from '@/hooks/usePermintaan'
import type { PermintaanStatus } from '@/types/permintaan'

const STATUS_STYLE: Record<PermintaanStatus, string> = {
  menunggu: 'bg-amber-50 text-amber-700 border-amber-200',
  disetujui: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ditolak: 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_LABEL: Record<PermintaanStatus, string> = {
  menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak',
}

export function PermintaanList({ outletId }: { outletId: string }) {
  const { permintaan, loading, error } = usePermintaanList(outletId)

  if (loading) return <p className="text-xs text-[#544437]/60">Memuat…</p>
  if (error) return <p className="text-xs text-[#ba1a1a]">{error}</p>
  if (permintaan.length === 0) return <p className="text-xs text-[#544437]/60">Belum ada permintaan.</p>

  return (
    <div className="space-y-3">
      {permintaan.map(p => (
        <Card key={p.id} className="p-4 border border-[#d9c2b2]/45 rounded-2xl bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#544437]/60 font-semibold">
              {new Date(p.created_at).toLocaleString('id-ID')}
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_STYLE[p.status]}`}>
              {STATUS_LABEL[p.status]}
            </span>
          </div>
          <ul className="text-xs text-[#1e1b15] space-y-0.5">
            {p.items.map(it => (
              <li key={it.id} className="flex justify-between">
                <span>{it.bahan_baku_id}</span>
                <span>
                  {it.qty_diminta}
                  {it.qty_disetujui != null && it.qty_disetujui !== it.qty_diminta && (
                    <span className="text-[#f29744] font-bold"> → {it.qty_disetujui}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {p.status === 'ditolak' && p.catatan_kitchen && (
            <p className="text-[11px] text-red-600">Alasan: {p.catatan_kitchen}</p>
          )}
        </Card>
      ))}
    </div>
  )
}
```

Catatan: nama bahan baku ditampilkan dari id; jika ingin nama, join `bahan_baku(nama)` di `loadPermintaan` select (`items:permintaan_bahan_item(*, bahan_baku(nama))`) dan map ke item. Opsional, tidak memblokir.

- [x] **Step 2: Type check**

Run: `cd apps/stok && yarn type-check`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add apps/stok/src/components/permintaan/PermintaanList.tsx
git commit -m "feat(stok): PermintaanList dengan status realtime"
```

---

## Task 9: ApprovalModal + ApprovalList (kitchen)

**Files:**
- Create: `apps/stok/src/components/permintaan/ApprovalModal.tsx`
- Create: `apps/stok/src/components/permintaan/ApprovalList.tsx`

- [x] **Step 1: Implementasi ApprovalModal**

```tsx
'use client'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { usePermintaanActions } from '@/hooks/usePermintaan'
import type { PermintaanWithItems } from '@/types/permintaan'

export function ApprovalModal({
  permintaan, onClose, onDone,
}: { permintaan: PermintaanWithItems; onClose: () => void; onDone: () => void }) {
  const { approve, tolak } = usePermintaanActions()
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(permintaan.items.map(it => [it.bahan_baku_id, String(it.qty_diminta)]))
  )
  const [alasan, setAlasan] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function doApprove() {
    setBusy(true); setErrorMsg(null)
    try {
      await approve(permintaan.id, permintaan.items.map(it => ({
        bahan_baku_id: it.bahan_baku_id, qty_disetujui: Number(qty[it.bahan_baku_id] ?? 0),
      })))
      onDone()
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  async function doTolak() {
    if (!alasan.trim()) { setErrorMsg('Alasan wajib diisi'); return }
    setBusy(true); setErrorMsg(null)
    try { await tolak(permintaan.id, alasan); onDone() }
    catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="p-6 bg-white rounded-2xl max-w-md w-full space-y-4" onClick={(e: any) => e.stopPropagation()}>
        <h2 className="text-sm font-extrabold text-[#701604]">
          Permintaan {permintaan.outlet_name ?? permintaan.outlet_id}
        </h2>
        <div className="space-y-2">
          {permintaan.items.map(it => (
            <div key={it.id} className="flex items-center gap-3">
              <span className="flex-1 text-xs">{it.bahan_baku_id}</span>
              <span className="text-[10px] text-[#544437]/60">minta {it.qty_diminta}</span>
              <Input
                type="number" value={qty[it.bahan_baku_id] ?? ''}
                onChange={e => setQty(q => ({ ...q, [it.bahan_baku_id]: e.target.value }))}
                className="w-24 px-3 py-1.5 border border-[#d9c2b2]/40 rounded-lg text-xs"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#544437]/60">Set qty 0 untuk menolak item tertentu.</p>

        <Input placeholder="Alasan (untuk tolak)" value={alasan}
          onChange={e => setAlasan(e.target.value)}
          className="px-3 py-2 border border-[#d9c2b2]/40 rounded-lg text-xs w-full" />

        {errorMsg && <p className="text-xs font-bold text-[#ba1a1a]">{errorMsg}</p>}

        <div className="flex gap-2">
          <Button disabled={busy} onClick={doTolak}
            className="flex-1 bg-white border border-red-300 text-red-600 font-bold py-2.5 rounded-xl text-xs">
            Tolak
          </Button>
          <Button disabled={busy} onClick={doApprove}
            className="flex-1 bg-[#f29744] text-white font-bold py-2.5 rounded-xl text-xs">
            {busy ? 'Memproses…' : 'Setujui'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
```

- [x] **Step 2: Implementasi ApprovalList**

```tsx
'use client'
import { useState } from 'react'
import { Card } from '@suka/design-system'
import { useApprovalList } from '@/hooks/usePermintaan'
import { ApprovalModal } from './ApprovalModal'
import type { PermintaanWithItems } from '@/types/permintaan'

export function ApprovalList() {
  const { permintaan, loading, error, refresh } = useApprovalList()
  const [active, setActive] = useState<PermintaanWithItems | null>(null)

  if (loading) return <p className="text-xs text-[#544437]/60">Memuat…</p>
  if (error) return <p className="text-xs text-[#ba1a1a]">{error}</p>
  if (permintaan.length === 0) return <p className="text-xs text-[#544437]/60">Tidak ada permintaan menunggu.</p>

  return (
    <>
      <div className="space-y-3">
        {permintaan.map(p => (
          <Card key={p.id} onClick={() => setActive(p)}
            className="p-4 border border-[#d9c2b2]/45 rounded-2xl bg-white cursor-pointer hover:bg-[#fff8f1]/50 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-[#1e1b15]">{p.outlet_name ?? p.outlet_id}</p>
              <p className="text-[10px] text-[#544437]/60">{p.items.length} item • {new Date(p.created_at).toLocaleString('id-ID')}</p>
            </div>
            <span className="text-[10px] font-bold text-[#f29744]">Tinjau →</span>
          </Card>
        ))}
      </div>
      {active && (
        <ApprovalModal permintaan={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); refresh() }} />
      )}
    </>
  )
}
```

- [x] **Step 3: Type check**

Run: `cd apps/stok && yarn type-check`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/stok/src/components/permintaan/ApprovalModal.tsx apps/stok/src/components/permintaan/ApprovalList.tsx
git commit -m "feat(stok): layar approval kitchen (list + modal edit qty)"
```

---

## Task 10: Route /stok/permintaan + link navigasi

**Files:**
- Create: `apps/stok/src/app/stok/permintaan/page.tsx`
- Modify: `apps/stok/src/app/dashboard/page.tsx` (tambah link ke `/stok/permintaan`; baca file dulu untuk pola link/menu yang ada)

- [x] **Step 1: Tulis page**

Crew lihat Form + List permintaan outletnya. Staff kitchen (akses outlet kitchen) lihat ApprovalList. Tentukan via `outletStaff` dari `useAuth` (pola sama `threshold/page.tsx`).

```tsx
'use client'
import { useAuth } from '@suka/auth'
import { PermintaanForm } from '@/components/permintaan/PermintaanForm'
import { PermintaanList } from '@/components/permintaan/PermintaanList'
import { ApprovalList } from '@/components/permintaan/ApprovalList'

const KITCHEN_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export default function PermintaanPage() {
  const { outletStaff, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Memuat…</p></div>
  }
  if (!outletStaff) return null

  const isKitchen = outletStaff.outlet_id === KITCHEN_OUTLET_ID
    || ['admin', 'spv', 'owner'].includes(outletStaff.role)

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-lg font-extrabold text-[#701604]">Permintaan Bahan Baku</h1>

      {isKitchen ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#f29744]">Menunggu Persetujuan</h2>
          <ApprovalList />
        </section>
      ) : (
        <>
          {outletStaff.outlet_id && <PermintaanForm outletId={outletStaff.outlet_id} />}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#f29744]">Riwayat Permintaan</h2>
            {outletStaff.outlet_id && <PermintaanList outletId={outletStaff.outlet_id} />}
          </section>
        </>
      )}
    </main>
  )
}
```

- [x] **Step 2: Tambah link navigasi**

Baca `apps/stok/src/app/dashboard/page.tsx`, tambahkan kartu/menu "Permintaan Bahan" yang menaut ke `/stok/permintaan`, mengikuti pola menu yang sudah ada di file itu. (Konten persis menyesuaikan markup eksisting — jangan menebak struktur, ikuti yang ada.)

- [x] **Step 3: Type check + build**

Run: `cd apps/stok && yarn type-check`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/stok/src/app/stok/permintaan/page.tsx apps/stok/src/app/dashboard/page.tsx
git commit -m "feat(stok): route /stok/permintaan + link navigasi"
```

---

## Task 11: Smoke test manual (end-to-end)

- [x] **Step 1: Jalankan dev server**

Run: `cd apps/stok && yarn dev` (http://localhost:3001)

- [x] **Step 2: Verifikasi alur**

1. Login sebagai crew outlet non-kitchen → buka `/stok/permintaan` → item di bawah threshold muncul → centang + submit → muncul di "Riwayat Permintaan" status **Menunggu**.
2. Login sebagai kepala_outlet kitchen → buka `/stok/permintaan` → permintaan tadi muncul di "Menunggu Persetujuan" → buka modal → ubah satu qty → Setujui.
3. Kembali sebagai crew → status berubah **Disetujui** otomatis (realtime, tanpa reload) dengan qty teredit ditandai.
4. Cek di app distribusi/`surat_jalan`: draft surat jalan baru untuk outlet peminta sudah ada, `permintaan_bahan.surat_jalan_id` terisi.

Expected: semua langkah lulus. Jika realtime tidak update, verifikasi Task 4 (publication) ter-apply di remote.

---

## Self-Review Notes

- **Spec coverage:** crew membuat (Task 7) ✓; saran threshold (Task 6 `useSaranItem` + Task 7) ✓; approver kitchen kepala_outlet (Task 2 `is_kitchen_staff`, Task 10 gating) ✓; edit qty/tambah/kurangi item (Task 3 approve RPC handle item baru & qty 0, Task 9 modal) ✓; auto draft surat jalan + link (Task 3) ✓; tolak + alasan (Task 3, Task 9) ✓; status + realtime notif (Task 4, Task 6, Task 8) ✓; RLS scope (Task 2) ✓.
- **Catatan:** penambahan item baru oleh kitchen di modal saat ini tidak ada UI-nya (modal hanya edit qty item existing); RPC sudah mendukung. Jika owner ingin kitchen menambah item baru dari modal, tambahkan picker `useBahanBaku` — di luar scope versi pertama.
- **Nama bahan baku** ditampilkan sebagai id di list/modal; peningkatan join `bahan_baku(nama)` dicatat sebagai opsional non-blocking di Task 8.
