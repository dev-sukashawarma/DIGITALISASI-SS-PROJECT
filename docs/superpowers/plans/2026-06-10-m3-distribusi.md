# M3 Distribusi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M3 supply chain module: SPV creates & sends Surat Jalan from warehouse; crew at outlet verifies received goods; qty terverifikasi auto-flows to M2 ledger.

**Architecture:** Postgres schema (surat_jalan + surat_jalan_item) with RLS per outlet; Supabase RPCs for atomic operations; React UI split by role (SPV pusat vs crew outlet); auto-ledger integration via RPC trigger chain.

**Tech Stack:** Next.js 16 (static export) + React 19 RC + TypeScript strict, Supabase (Postgres + RLS + Edge Functions/Deno), Tailwind v4, `@suka/design-system`, `@suka/offline-queue` (future).

**Reference spec:** `docs/superpowers/specs/2026-06-10-m3-distribusi-design.md`

---

## File Structure

**Migrations** (`supabase/migrations/`):
- `20260609002000_create_surat_jalan.sql` — schema + indexes
- `20260609002100_create_surat_jalan_rpc.sql` — 4 RPC functions
- `20260609002200_surat_jalan_rls.sql` — RLS policies
- `20260609002300_seed_sample_surat_jalan.sql` — dev data

**App types & hooks** (`apps/distribusi/src/`):
- `types/distribusi.ts` — TypeScript domain types
- `hooks/useSuratJalan.ts` — data hooks (list, create, send, verify, finalize)
- `hooks/useFileUpload.ts` — foto upload helper (Supabase Storage)

**App components - Pusat** (`apps/distribusi/src/components/distribusi/`):
- `SuratJalanList.tsx` — list view (filter by status)
- `SuratJalanForm.tsx` — create form (outlet select + item picker)
- `SuratJalanDetail.tsx` — detail view (readonly items + signature flow)
- `SignatureFlow.tsx` — 3-signature approval UI

**App components - Outlet** (`apps/distribusi/src/components/distribusi/`):
- `TerimaList.tsx` — incoming shipments (status=dikirim)
- `VerifikasiForm.tsx` — per-item verification form (qty, kondisi, foto conditional)

**App pages** (`apps/distribusi/src/app/`):
- `distribusi/surat-jalan/page.tsx` — list (pusat)
- `distribusi/surat-jalan/new/page.tsx` — create (pusat)
- `distribusi/surat-jalan/[id]/page.tsx` — detail (pusat)
- `distribusi/terima/page.tsx` — incoming list (outlet)
- `distribusi/terima/[id]/page.tsx` — verify form (outlet)

**Layout:**
- Modify: `components/layout/Sidebar.tsx` — add distribusi nav links

---

## Phase 0 — Database Schema & RLS

### Task 1: Create surat_jalan + surat_jalan_item tables

**Files:**
- Create: `supabase/migrations/20260609002000_create_surat_jalan.sql`

- [ ] **Step 1: Write migration**

```sql
-- Surat Jalan: shipment master record
CREATE TABLE surat_jalan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','dikirim','diterima_sebagian','diterima_lengkap')),
  created_by UUID REFERENCES outlet_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  signatures JSONB DEFAULT '[]'::jsonb,
  
  INDEX idx_surat_jalan_outlet ON outlet_id,
  INDEX idx_surat_jalan_status ON status,
  INDEX idx_surat_jalan_created ON created_at DESC
);

-- Surat Jalan items: line items with verification data
CREATE TABLE surat_jalan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_jalan_id UUID NOT NULL REFERENCES surat_jalan(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  
  qty_dikirim NUMERIC NOT NULL CHECK (qty_dikirim > 0),
  qty_terima NUMERIC,
  
  kondisi TEXT CHECK (kondisi IN ('baik','rusak','hilang_qty')),
  selisih NUMERIC GENERATED ALWAYS AS (COALESCE(qty_terima,0) - qty_dikirim) STORED,
  flagged BOOLEAN NOT NULL DEFAULT false,
  
  foto_path TEXT,
  catatan TEXT,
  verified_by UUID REFERENCES outlet_staff(id),
  verified_at TIMESTAMPTZ,
  
  UNIQUE(surat_jalan_id, bahan_baku_id),
  INDEX idx_sj_item_sj ON surat_jalan_id,
  INDEX idx_sj_item_bahan ON bahan_baku_id
);
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push` (or paste into Supabase SQL editor)
Expected: tables created, indexes created.

- [ ] **Step 3: Verify**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('surat_jalan','surat_jalan_item');
```
Expected: 2 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609002000_create_surat_jalan.sql
git commit -m "feat(distribusi): surat_jalan + surat_jalan_item schema"
```

---

### Task 2: Create RPC functions

**Files:**
- Create: `supabase/migrations/20260609002100_create_surat_jalan_rpc.sql`

- [ ] **Step 1: Write RPC migration**

```sql
-- 1. create_surat_jalan(outlet_id UUID, items JSONB[])
CREATE OR REPLACE FUNCTION create_surat_jalan(
  p_outlet_id UUID,
  p_items JSONB
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
  v_item JSONB;
BEGIN
  -- Validate outlet exists
  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;

  -- Insert master record
  INSERT INTO surat_jalan (outlet_id, created_by)
  VALUES (p_outlet_id, auth.uid())
  RETURNING * INTO v_sj;

  -- Insert items (p_items is array of {bahan_baku_id, qty_dikirim})
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
    VALUES (v_sj.id, (v_item->>'bahan_baku_id')::UUID, (v_item->>'qty_dikirim')::NUMERIC);
  END LOOP;

  RETURN v_sj;
END;
$$;

-- 2. send_surat_jalan(surat_jalan_id UUID, signatures JSONB[])
CREATE OR REPLACE FUNCTION send_surat_jalan(
  p_surat_jalan_id UUID,
  p_signatures JSONB
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
BEGIN
  SELECT * INTO v_sj FROM surat_jalan WHERE id = p_surat_jalan_id FOR UPDATE;
  
  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'surat_jalan % not found', p_surat_jalan_id;
  END IF;
  IF v_sj.status != 'draft' THEN
    RAISE EXCEPTION 'surat_jalan % status is %, must be draft', p_surat_jalan_id, v_sj.status;
  END IF;

  -- Validate creator is auth user
  IF v_sj.created_by != auth.uid() THEN
    RAISE EXCEPTION 'only creator can send surat_jalan';
  END IF;

  UPDATE surat_jalan
  SET status = 'dikirim', signatures = p_signatures, updated_at = NOW()
  WHERE id = p_surat_jalan_id
  RETURNING * INTO v_sj;

  RETURN v_sj;
END;
$$;

-- 3. verify_surat_jalan_item(...)
CREATE OR REPLACE FUNCTION verify_surat_jalan_item(
  p_surat_jalan_id UUID,
  p_item_id UUID,
  p_qty_terima NUMERIC,
  p_kondisi TEXT,
  p_foto_path TEXT DEFAULT NULL
)
RETURNS surat_jalan_item
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item surat_jalan_item;
  v_sj surat_jalan;
  v_flagged BOOLEAN;
  v_crew_outlet UUID;
BEGIN
  -- Load item & parent surat_jalan
  SELECT * INTO v_item FROM surat_jalan_item WHERE id = p_item_id AND surat_jalan_id = p_surat_jalan_id;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'item % not found in surat_jalan %', p_item_id, p_surat_jalan_id;
  END IF;

  SELECT * INTO v_sj FROM surat_jalan WHERE id = p_surat_jalan_id;
  IF v_sj.status != 'dikirim' THEN
    RAISE EXCEPTION 'surat_jalan % status is %, must be dikirim', p_surat_jalan_id, v_sj.status;
  END IF;

  -- Validate crew belongs to outlet
  SELECT outlet_id INTO v_crew_outlet FROM outlet_staff WHERE id = auth.uid();
  IF v_crew_outlet != v_sj.outlet_id THEN
    RAISE EXCEPTION 'crew does not belong to this outlet';
  END IF;

  -- Calculate flagged
  v_flagged := (p_qty_terima != v_item.qty_dikirim) OR (p_kondisi != 'baik');

  -- If flagged, foto is required
  IF v_flagged AND p_foto_path IS NULL THEN
    RAISE EXCEPTION 'foto required for flagged item';
  END IF;

  -- Update item
  UPDATE surat_jalan_item
  SET 
    qty_terima = p_qty_terima,
    kondisi = p_kondisi,
    flagged = v_flagged,
    foto_path = p_foto_path,
    verified_by = auth.uid(),
    verified_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- 4. finalize_surat_jalan(surat_jalan_id UUID)
CREATE OR REPLACE FUNCTION finalize_surat_jalan(
  p_surat_jalan_id UUID
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
  v_outlet_id UUID;
  v_final_status TEXT;
  v_any_flagged BOOLEAN;
  r RECORD;
BEGIN
  SELECT * INTO v_sj FROM surat_jalan WHERE id = p_surat_jalan_id FOR UPDATE;
  
  IF v_sj.id IS NULL THEN
    RAISE EXCEPTION 'surat_jalan % not found', p_surat_jalan_id;
  END IF;
  IF v_sj.status != 'dikirim' THEN
    RAISE EXCEPTION 'surat_jalan % status is %, must be dikirim', p_surat_jalan_id, v_sj.status;
  END IF;

  -- Validate crew belongs to outlet
  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND outlet_id = v_sj.outlet_id) THEN
    RAISE EXCEPTION 'crew does not belong to this outlet';
  END IF;

  -- Check all items verified
  IF EXISTS (SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id = p_surat_jalan_id AND qty_terima IS NULL) THEN
    RAISE EXCEPTION 'masih ada barang belum dicek';
  END IF;

  -- Determine final status
  SELECT EXISTS(SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id = p_surat_jalan_id AND flagged = true)
  INTO v_any_flagged;
  v_final_status := CASE WHEN v_any_flagged THEN 'diterima_sebagian' ELSE 'diterima_lengkap' END;

  -- Update surat_jalan
  UPDATE surat_jalan
  SET status = v_final_status, updated_at = NOW()
  WHERE id = p_surat_jalan_id
  RETURNING * INTO v_sj;

  -- Create ledger entries for all verified items
  FOR r IN
    SELECT bahan_baku_id, qty_terima
    FROM surat_jalan_item
    WHERE surat_jalan_id = p_surat_jalan_id AND qty_terima IS NOT NULL
  LOOP
    INSERT INTO ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, ref_surat_jalan_id, created_by, catatan
    )
    VALUES (
      v_sj.outlet_id, r.bahan_baku_id, 'terima_kiriman', r.qty_terima, p_surat_jalan_id, auth.uid(),
      'Auto dari verifikasi kiriman'
    );
  END LOOP;

  RETURN v_sj;
END;
$$;
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push`
Expected: 4 RPCs created.

- [ ] **Step 3: Verify**

```sql
SELECT proname FROM pg_proc
WHERE proname IN ('create_surat_jalan','send_surat_jalan','verify_surat_jalan_item','finalize_surat_jalan');
```
Expected: 4 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609002100_create_surat_jalan_rpc.sql
git commit -m "feat(distribusi): surat_jalan RPC functions (create, send, verify, finalize)"
```

---

### Task 3: RLS policies

**Files:**
- Create: `supabase/migrations/20260609002200_surat_jalan_rls.sql`

- [ ] **Step 1: Write RLS migration**

```sql
ALTER TABLE surat_jalan ENABLE ROW LEVEL SECURITY;
ALTER TABLE surat_jalan_item ENABLE ROW LEVEL SECURITY;

-- surat_jalan: SPV (pusat) sees all; crew (outlet) sees only own outlet
CREATE POLICY surat_jalan_read_all ON surat_jalan FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
    OR outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
  );

CREATE POLICY surat_jalan_insert ON surat_jalan FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
  );

CREATE POLICY surat_jalan_update ON surat_jalan FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND status = 'draft'
    AND EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
  );

-- surat_jalan_item: via parent surat_jalan access
CREATE POLICY sj_item_read ON surat_jalan_item FOR SELECT TO authenticated
  USING (
    surat_jalan_id IN (
      SELECT id FROM surat_jalan
      WHERE EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'spv')
        OR outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
    )
  );

CREATE POLICY sj_item_update ON surat_jalan_item FOR UPDATE TO authenticated
  USING (
    surat_jalan_id IN (
      SELECT id FROM surat_jalan
      WHERE status = 'dikirim'
        AND outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    surat_jalan_id IN (
      SELECT id FROM surat_jalan
      WHERE status = 'dikirim'
        AND outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())
    )
  );
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push`
Expected: RLS policies created.

- [ ] **Step 3: Verify**

```sql
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('surat_jalan','surat_jalan_item') ORDER BY tablename;
```
Expected: rows for both tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609002200_surat_jalan_rls.sql
git commit -m "feat(distribusi): RLS policies for surat_jalan domain"
```

---

### Task 4: Sample seed data

**Files:**
- Create: `supabase/migrations/20260609002300_seed_sample_surat_jalan.sql`

- [ ] **Step 1: Write seed migration**

```sql
-- DEV SAMPLE ONLY. Insert sample surat_jalan for testing.
-- (Assumes outlets + bahan_baku + outlet_staff already seeded from M0 + M2)

-- Insert 2 sample surat_jalan (one per outlet, different statuses)
INSERT INTO surat_jalan (outlet_id, status, created_by, notes) 
SELECT id, 'dikirim', 
  (SELECT id FROM outlet_staff WHERE role = 'spv' LIMIT 1),
  'Sample SJ untuk testing'
FROM outlets LIMIT 2
ON CONFLICT DO NOTHING;

-- Insert sample items for the first surat_jalan
INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
SELECT sj.id, bb.id, 50
FROM surat_jalan sj
JOIN bahan_baku bb ON bb.nama = 'Daging Ayam'
WHERE sj.status = 'dikirim'
LIMIT 1
ON CONFLICT (surat_jalan_id, bahan_baku_id) DO NOTHING;

INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
SELECT sj.id, bb.id, 100
FROM surat_jalan sj
JOIN bahan_baku bb ON bb.nama = 'Roti Pita'
WHERE sj.status = 'dikirim'
LIMIT 1
ON CONFLICT (surat_jalan_id, bahan_baku_id) DO NOTHING;
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push`
Expected: sample data inserted.

- [ ] **Step 3: Verify**

```sql
SELECT COUNT(*) FROM surat_jalan WHERE status = 'dikirim';
SELECT COUNT(*) FROM surat_jalan_item;
```
Expected: 2 surat_jalan, 2+ items.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609002300_seed_sample_surat_jalan.sql
git commit -m "chore(distribusi): dev seed sample surat_jalan"
```

---

## Phase 1 — Types & Hooks

### Task 5: TypeScript domain types

**Files:**
- Create: `apps/distribusi/src/types/distribusi.ts`

- [ ] **Step 1: Write types file**

```typescript
export type SuratJalanStatus = 'draft' | 'dikirim' | 'diterima_sebagian' | 'diterima_lengkap'
export type KondisiItem = 'baik' | 'rusak' | 'hilang_qty'

export interface SuratJalan {
  id: string
  outlet_id: string
  status: SuratJalanStatus
  created_by: string | null
  created_at: string
  updated_at: string
  notes: string | null
  signatures: Array<{ user_id: string; timestamp: string; [key: string]: any }> | null
}

export interface SuratJalanItem {
  id: string
  surat_jalan_id: string
  bahan_baku_id: string
  qty_dikirim: number
  qty_terima: number | null
  kondisi: KondisiItem | null
  selisih: number
  flagged: boolean
  foto_path: string | null
  catatan: string | null
  verified_by: string | null
  verified_at: string | null
}

export interface CreateSuratJalanPayload {
  outlet_id: string
  items: Array<{ bahan_baku_id: string; qty_dikirim: number }>
}

export interface VerifyItemPayload {
  surat_jalan_id: string
  item_id: string
  qty_terima: number
  kondisi: KondisiItem
  foto_path: string | null
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/types/distribusi.ts
git commit -m "feat(distribusi): domain TypeScript types"
```

---

### Task 6: useSuratJalan hooks

**Files:**
- Create: `apps/distribusi/src/hooks/useSuratJalan.ts`

- [ ] **Step 1: Write hooks file**

```typescript
'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { SuratJalan, SuratJalanItem } from '@/types/distribusi'

// List all Surat Jalan (SPV sees all; crew sees own outlet)
export function useSuratJalanList(outlet_id?: string, status?: string) {
  const [data, setData] = useState<SuratJalan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let query = supabase.from('surat_jalan').select('*')
    
    if (outlet_id) query = query.eq('outlet_id', outlet_id)
    if (status) query = query.eq('status', status)
    
    query.order('created_at', { ascending: false }).then(({ data }) => {
      setData((data as SuratJalan[]) ?? [])
      setLoading(false)
    })
  }, [outlet_id, status])

  return { suratJalanList: data, loading }
}

// Load single Surat Jalan + its items
export function useSuratJalanDetail(suratJalanId: string | undefined) {
  const [sj, setSj] = useState<SuratJalan | null>(null)
  const [items, setItems] = useState<SuratJalanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!suratJalanId) return
    const supabase = createClient()
    supabase.from('surat_jalan').select('*').eq('id', suratJalanId).single()
      .then(({ data }) => setSj(data as SuratJalan))
    supabase.from('surat_jalan_item').select('*').eq('surat_jalan_id', suratJalanId)
      .then(({ data }) => {
        setItems((data as SuratJalanItem[]) ?? [])
        setLoading(false)
      })
  }, [suratJalanId])

  return { sj, items, loading }
}

// RPC: create_surat_jalan
export function useSuratJalanActions() {
  const supabase = createClient()

  const create = useCallback(async (outlet_id: string, items: Array<{ bahan_baku_id: string; qty_dikirim: number }>) => {
    const { data, error } = await supabase.rpc('create_surat_jalan', {
      p_outlet_id: outlet_id,
      p_items: items
    })
    if (error) throw error
    return data as SuratJalan
  }, [])

  const send = useCallback(async (surat_jalan_id: string, signatures: any[]) => {
    const { data, error } = await supabase.rpc('send_surat_jalan', {
      p_surat_jalan_id: surat_jalan_id,
      p_signatures: signatures
    })
    if (error) throw error
    return data as SuratJalan
  }, [])

  const verify = useCallback(async (surat_jalan_id: string, item_id: string, qty_terima: number, kondisi: string, foto_path: string | null) => {
    const { data, error } = await supabase.rpc('verify_surat_jalan_item', {
      p_surat_jalan_id: surat_jalan_id,
      p_item_id: item_id,
      p_qty_terima: qty_terima,
      p_kondisi: kondisi,
      p_foto_path: foto_path
    })
    if (error) throw error
    return data as SuratJalanItem
  }, [])

  const finalize = useCallback(async (surat_jalan_id: string) => {
    const { data, error } = await supabase.rpc('finalize_surat_jalan', {
      p_surat_jalan_id: surat_jalan_id
    })
    if (error) throw error
    return data as SuratJalan
  }, [])

  return { create, send, verify, finalize }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/hooks/useSuratJalan.ts
git commit -m "feat(distribusi): useSuratJalan hooks (list, detail, actions)"
```

---

### Task 7: File upload helper hook

**Files:**
- Create: `apps/distribusi/src/hooks/useFileUpload.ts`

- [ ] **Step 1: Write hook**

```typescript
'use client'
import { useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export function useFileUpload() {
  const supabase = createClient()

  const uploadFoto = useCallback(async (
    file: File,
    surat_jalan_id: string,
    item_id: string
  ): Promise<string> => {
    const filename = `${surat_jalan_id}/${item_id}/${Date.now()}-${file.name}`
    const path = `surat-jalan/${filename}`

    const { error } = await supabase.storage.from('distribusi').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw error
    return path
  }, [])

  const deleteFoto = useCallback(async (path: string) => {
    const { error } = await supabase.storage.from('distribusi').remove([path])
    if (error) throw error
  }, [])

  return { uploadFoto, deleteFoto }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/hooks/useFileUpload.ts
git commit -m "feat(distribusi): useFileUpload hook for Supabase Storage"
```

---

## Phase 2 — Pusat UI (SPV)

### Task 8: SuratJalanList component

**Files:**
- Create: `apps/distribusi/src/components/distribusi/SuratJalanList.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client'
import Link from 'next/link'
import { Card, Badge, Button } from '@suka/design-system'
import type { SuratJalan } from '@/types/distribusi'

const statusLabel: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'default' as any },
  dikirim: { label: 'Dikirim', variant: 'warning' as any },
  diterima_sebagian: { label: 'Diterima Sebagian', variant: 'warning' as any },
  diterima_lengkap: { label: 'Diterima Lengkap', variant: 'success' as any },
}

export function SuratJalanList({ items }: { items: SuratJalan[] }) {
  const draftCount = items.filter(s => s.status === 'draft').length
  const dikirimCount = items.filter(s => s.status === 'dikirim').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{draftCount} draft · {dikirimCount} sedang dikirim</p>
        <Link href="/distribusi/surat-jalan/new">
          <Button>+ Surat Jalan Baru</Button>
        </Link>
      </div>
      <div className="space-y-2">
        {items.map(sj => (
          <Link key={sj.id} href={`/distribusi/surat-jalan/${sj.id}`}>
            <Card className="p-4 flex justify-between items-center cursor-pointer hover:shadow-md transition">
              <div>
                <p className="font-semibold">Outlet {sj.outlet_id.slice(0, 8)}…</p>
                <p className="text-xs text-gray-500">{new Date(sj.created_at).toLocaleDateString('id-ID')}</p>
              </div>
              <Badge variant={statusLabel[sj.status].variant}>
                {statusLabel[sj.status].label}
              </Badge>
            </Card>
          </Link>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">Belum ada Surat Jalan.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/SuratJalanList.tsx
git commit -m "feat(distribusi): SuratJalanList component (pusat view)"
```

---

### Task 9: SuratJalanForm component (create)

**Files:**
- Create: `apps/distribusi/src/components/distribusi/SuratJalanForm.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { useSuratJalanActions } from '@/hooks/useSuratJalan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import type { CreateSuratJalanPayload } from '@/types/distribusi'

export function SuratJalanForm({ outletId }: { outletId: string }) {
  const router = useRouter()
  const { create } = useSuratJalanActions()
  const { bahanBaku } = useBahanBaku()
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Array<{ bahan_baku_id: string; qty_dikirim: string }>>([])

  const addItem = () => {
    setItems([...items, { bahan_baku_id: '', qty_dikirim: '' }])
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }
    setItems(updated)
  }

  const canSubmit = items.length > 0 && items.every(it => it.bahan_baku_id && it.qty_dikirim)

  const submit = async () => {
    setBusy(true)
    try {
      const payload: CreateSuratJalanPayload = {
        outlet_id: outletId,
        items: items.map(it => ({
          bahan_baku_id: it.bahan_baku_id,
          qty_dikirim: Number(it.qty_dikirim),
        })),
      }
      const sj = await create(payload.outlet_id, payload.items)
      router.push(`/distribusi/surat-jalan/${sj.id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Item yang dikirim</h3>
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-3">
            <select className="flex-1 border rounded p-2" value={it.bahan_baku_id}
              onChange={e => updateItem(idx, 'bahan_baku_id', e.target.value)}>
              <option value="">— Pilih bahan baku —</option>
              {bahanBaku.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
            <Input type="number" className="w-28" placeholder="Qty"
              value={it.qty_dikirim} onChange={e => updateItem(idx, 'qty_dikirim', e.target.value)} />
            <Button variant="danger" onClick={() => removeItem(idx)}>Hapus</Button>
          </div>
        ))}
        <Button variant="secondary" onClick={addItem}>+ Tambah Item</Button>
      </Card>

      <Button disabled={!canSubmit || busy} onClick={submit} className="w-full">
        {busy ? 'Menyimpan…' : 'Buat Surat Jalan'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/SuratJalanForm.tsx
git commit -m "feat(distribusi): SuratJalanForm component (create new shipment)"
```

---

### Task 10: SignatureFlow component

**Files:**
- Create: `apps/distribusi/src/components/distribusi/SignatureFlow.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { useSuratJalanActions } from '@/hooks/useSuratJalan'
import type { SuratJalan } from '@/types/distribusi'

interface SignatureEntry {
  user_id: string
  timestamp: string
}

export function SignatureFlow({ sj, onSent }: { sj: SuratJalan; onSent?: (updated: SuratJalan) => void }) {
  const { send } = useSuratJalanActions()
  const [signatures, setSignatures] = useState<SignatureEntry[]>(
    Array(3).fill(null).map(() => ({ user_id: '', timestamp: '' }))
  )
  const [busy, setBusy] = useState(false)

  const updateSig = (idx: number, field: string, value: string) => {
    const updated = [...signatures]
    updated[idx] = { ...updated[idx], [field]: value }
    setSignatures(updated)
  }

  const canSend = signatures.every(s => s.user_id && s.timestamp)

  const handleSend = async () => {
    setBusy(true)
    try {
      const updated = await send(sj.id, signatures)
      onSent?.(updated)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Approval dari 3 Petugas (Pusat)</h3>
      {signatures.map((sig, idx) => (
        <div key={idx} className="border rounded p-3 space-y-2">
          <p className="text-sm font-medium">Penanda tangan {idx + 1}</p>
          <Input placeholder="User ID / Email" value={sig.user_id}
            onChange={e => updateSig(idx, 'user_id', e.target.value)} />
          <Input type="datetime-local" value={sig.timestamp}
            onChange={e => updateSig(idx, 'timestamp', e.target.value)} />
        </div>
      ))}
      <Button disabled={!canSend || busy} onClick={handleSend} className="w-full">
        {busy ? 'Mengirim…' : 'Kirim Surat Jalan'}
      </Button>
    </Card>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/SignatureFlow.tsx
git commit -m "feat(distribusi): SignatureFlow component (3-signature approval)"
```

---

### Task 11: SuratJalanDetail component

**Files:**
- Create: `apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client'
import { Card, Badge } from '@suka/design-system'
import { SignatureFlow } from './SignatureFlow'
import { useSuratJalanDetail } from '@/hooks/useSuratJalan'
import type { SuratJalan, SuratJalanItem } from '@/types/distribusi'

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  dikirim: 'Dikirim',
  diterima_sebagian: 'Diterima Sebagian',
  diterima_lengkap: 'Diterima Lengkap',
}

export function SuratJalanDetail({ suratJalanId }: { suratJalanId: string }) {
  const { sj, items, loading } = useSuratJalanDetail(suratJalanId)

  if (loading) return <p>Memuat…</p>
  if (!sj) return <p>Surat Jalan tidak ditemukan</p>

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg">Surat Jalan {sj.id.slice(0, 8)}…</h2>
          <Badge variant={sj.status === 'draft' ? 'default' as any : 'success' as any}>
            {statusLabel[sj.status]}
          </Badge>
        </div>
        <p className="text-sm text-gray-600">Outlet: {sj.outlet_id.slice(0, 8)}…</p>
        <p className="text-sm text-gray-600">Dibuat: {new Date(sj.created_at).toLocaleString('id-ID')}</p>
        {sj.notes && <p className="text-sm mt-2">{sj.notes}</p>}
      </Card>

      {/* Items */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Item ({items.length})</h3>
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="border rounded p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{it.bahan_baku_id.slice(0, 8)}…</span>
                <span>Dikirim: {it.qty_dikirim}</span>
              </div>
              {it.qty_terima !== null && (
                <div className="text-gray-600 text-xs mt-1">
                  Terima: {it.qty_terima} | Selisih: {it.selisih}
                  {it.flagged && <span className="ml-2 text-red-600 font-bold">⚠️ FLAGGED</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Signature Flow (if draft) */}
      {sj.status === 'draft' && <SignatureFlow sj={sj} />}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx
git commit -m "feat(distribusi): SuratJalanDetail component"
```

---

### Task 12: Pusat pages

**Files:**
- Create: `apps/distribusi/src/app/distribusi/surat-jalan/page.tsx`
- Create: `apps/distribusi/src/app/distribusi/surat-jalan/new/page.tsx`
- Create: `apps/distribusi/src/app/distribusi/surat-jalan/[id]/page.tsx`

- [ ] **Step 1: Write list page**

```tsx
'use client'
import { useAuth } from '@/context/AuthContext'
import { useSuratJalanList } from '@/hooks/useSuratJalan'
import { SuratJalanList } from '@/components/distribusi/SuratJalanList'

export default function SuratJalanListPage() {
  const { outletStaff } = useAuth()
  const { suratJalanList, loading } = useSuratJalanList()

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Surat Jalan</h1>
      {loading ? <p>Memuat…</p> : <SuratJalanList items={suratJalanList} />}
    </main>
  )
}
```

- [ ] **Step 2: Write new page**

```tsx
'use client'
import { useAuth } from '@/context/AuthContext'
import { SuratJalanForm } from '@/components/distribusi/SuratJalanForm'

export default function NewSuratJalanPage() {
  const { outletStaff } = useAuth()
  if (!outletStaff) return <main className="p-4">Memuat…</main>

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Surat Jalan Baru</h1>
      <SuratJalanForm outletId={outletStaff.outlet_id} />
    </main>
  )
}
```

- [ ] **Step 3: Write detail page**

```tsx
'use client'
import { use } from 'react'
import { SuratJalanDetail } from '@/components/distribusi/SuratJalanDetail'

export default function SuratJalanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Detail Surat Jalan</h1>
      <SuratJalanDetail suratJalanId={id} />
    </main>
  )
}
```

- [ ] **Step 4: Type-check + build**

Run: `cd apps/distribusi && yarn type-check && yarn build`
Expected: passes (if dynamic route build error, add `export async function generateStaticParams() { return [] }` to `[id]` page).

- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/src/app/distribusi/surat-jalan/page.tsx apps/distribusi/src/app/distribusi/surat-jalan/new/page.tsx "apps/distribusi/src/app/distribusi/surat-jalan/[id]/page.tsx"
git commit -m "feat(distribusi): pusat pages (list, new, detail)"
```

---

## Phase 3 — Outlet UI (Crew)

### Task 13: TerimaList component

**Files:**
- Create: `apps/distribusi/src/components/distribusi/TerimaList.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client'
import Link from 'next/link'
import { Card, Button } from '@suka/design-system'
import type { SuratJalan } from '@/types/distribusi'

export function TerimaList({ items }: { items: SuratJalan[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{items.length} Surat Jalan menunggu verifikasi</p>
      <div className="space-y-2">
        {items.map(sj => (
          <Card key={sj.id} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">Dari Gudang Pusat</p>
              <p className="text-xs text-gray-500">{new Date(sj.created_at).toLocaleDateString('id-ID')}</p>
            </div>
            <Link href={`/distribusi/terima/${sj.id}`}>
              <Button>Verifikasi</Button>
            </Link>
          </Card>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">Tidak ada barang masuk.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/TerimaList.tsx
git commit -m "feat(distribusi): TerimaList component (outlet incoming view)"
```

---

### Task 14: VerifikasiForm component

**Files:**
- Create: `apps/distribusi/src/components/distribusi/VerifikasiForm.tsx`

- [ ] **Step 1: Write component**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { useSuratJalanActions } from '@/hooks/useSuratJalan'
import { useSuratJalanDetail } from '@/hooks/useSuratJalan'
import { useFileUpload } from '@/hooks/useFileUpload'
import type { SuratJalanItem } from '@/types/distribusi'

export function VerifikasiForm({ suratJalanId }: { suratJalanId: string }) {
  const router = useRouter()
  const { sj, items } = useSuratJalanDetail(suratJalanId)
  const { verify, finalize } = useSuratJalanActions()
  const { uploadFoto } = useFileUpload()
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  const handleQtyChange = (itemId: string, value: string) => {
    setFormData(prev => ({ ...prev, [itemId]: { ...prev[itemId], qty_terima: value } }))
  }

  const handleKondisiChange = (itemId: string, value: string) => {
    setFormData(prev => ({ ...prev, [itemId]: { ...prev[itemId], kondisi: value } }))
  }

  const handleFotoUpload = async (itemId: string, file: File) => {
    setUploading(prev => ({ ...prev, [itemId]: true }))
    try {
      const path = await uploadFoto(file, suratJalanId, itemId)
      setFormData(prev => ({ ...prev, [itemId]: { ...prev[itemId], foto_path: path } }))
    } catch (err) {
      alert('Gagal upload foto: ' + (err as Error).message)
    } finally {
      setUploading(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const handleVerifyItem = async (item: SuratJalanItem) => {
    setBusy(true)
    try {
      const data = formData[item.id] || {}
      if (!data.qty_terima || !data.kondisi) {
        alert('Qty dan kondisi harus diisi')
        return
      }

      const qty_terima = Number(data.qty_terima)
      const needsFoto = qty_terima !== item.qty_dikirim || data.kondisi !== 'baik'
      
      if (needsFoto && !data.foto_path) {
        alert('Foto diperlukan untuk item dengan selisih atau kondisi tidak baik')
        return
      }

      await verify(suratJalanId, item.id, qty_terima, data.kondisi, data.foto_path || null)
      setVerified(prev => ({ ...prev, [item.id]: true }))
    } finally {
      setBusy(false)
    }
  }

  const handleFinalize = async () => {
    if (!sj) return
    setBusy(true)
    try {
      await finalize(suratJalanId)
      alert('Kiriman selesai diverifikasi & stok diperbarui')
      router.push('/distribusi/terima')
    } catch (err) {
      alert('Gagal finalize: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!sj) return <p>Memuat…</p>

  const allVerified = items.length > 0 && items.every(it => verified[it.id])

  return (
    <div className="space-y-4">
      {items.map(item => {
        const data = formData[item.id] || {}
        const needsFoto = data.qty_terima && (Number(data.qty_terima) !== item.qty_dikirim || data.kondisi !== 'baik')
        
        return (
          <Card key={item.id} className={`p-4 space-y-3 ${verified[item.id] ? 'opacity-60' : ''}`}>
            <p className="font-semibold">Bahan: {item.bahan_baku_id.slice(0, 8)}…</p>
            <p className="text-sm text-gray-600">Dikirim: {item.qty_dikirim}</p>

            {!verified[item.id] ? (
              <>
                <Input type="number" placeholder="Qty Terima" inputMode="decimal"
                  value={data.qty_terima || ''} onChange={e => handleQtyChange(item.id, e.target.value)} />
                
                <select className="w-full border rounded p-2" value={data.kondisi || ''}
                  onChange={e => handleKondisiChange(item.id, e.target.value)}>
                  <option value="">— Pilih Kondisi —</option>
                  <option value="baik">Baik</option>
                  <option value="rusak">Rusak</option>
                  <option value="hilang_qty">Hilang Qty</option>
                </select>

                {needsFoto && (
                  <div className="border-2 border-orange-300 rounded p-3 bg-orange-50">
                    <p className="text-sm font-medium mb-2">📸 Foto diperlukan</p>
                    <input type="file" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleFotoUpload(item.id, e.target.files[0])}
                      disabled={uploading[item.id]} />
                    {data.foto_path && <p className="text-xs text-green-600 mt-1">✓ Foto tersimpan</p>}
                  </div>
                )}

                <Button onClick={() => handleVerifyItem(item)} disabled={busy || uploading[item.id]}>
                  Verifikasi Item
                </Button>
              </>
            ) : (
              <p className="text-sm text-green-600 font-medium">✓ Sudah diverifikasi</p>
            )}
          </Card>
        )
      })}

      <Button disabled={!allVerified || busy} onClick={handleFinalize} className="w-full font-semibold">
        {busy ? 'Menyelesaikan…' : 'Selesaikan & Update Stok'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/distribusi/src/components/distribusi/VerifikasiForm.tsx
git commit -m "feat(distribusi): VerifikasiForm component (item-by-item verification)"
```

---

### Task 15: Outlet pages

**Files:**
- Create: `apps/distribusi/src/app/distribusi/terima/page.tsx`
- Create: `apps/distribusi/src/app/distribusi/terima/[id]/page.tsx`

- [ ] **Step 1: Write terima list page**

```tsx
'use client'
import { useAuth } from '@/context/AuthContext'
import { useSuratJalanList } from '@/hooks/useSuratJalan'
import { TerimaList } from '@/components/distribusi/TerimaList'

export default function TerimaPage() {
  const { outletStaff } = useAuth()
  const { suratJalanList, loading } = useSuratJalanList(outletStaff?.outlet_id, 'dikirim')

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Penerimaan Barang</h1>
      {loading ? <p>Memuat…</p> : <TerimaList items={suratJalanList} />}
    </main>
  )
}
```

- [ ] **Step 2: Write terima detail page**

```tsx
'use client'
import { use } from 'react'
import { VerifikasiForm } from '@/components/distribusi/VerifikasiForm'

export default function TerimaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Verifikasi Penerimaan</h1>
      <VerifikasiForm suratJalanId={id} />
    </main>
  )
}
```

- [ ] **Step 3: Type-check + build**

Run: `cd apps/distribusi && yarn type-check && yarn build`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/distribusi/src/app/distribusi/terima/page.tsx "apps/distribusi/src/app/distribusi/terima/[id]/page.tsx"
git commit -m "feat(distribusi): outlet pages (terima list & verify)"
```

---

## Phase 4 — Layout & Integration

### Task 16: Update Sidebar navigation

**Files:**
- Modify: `apps/distribusi/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read current sidebar**

Check the file structure and add distribusi nav links.

- [ ] **Step 2: Add distribusi nav items**

After reading, add links:
```tsx
{/* Distribusi Section */}
<div className="mt-4 pt-4 border-t">
  <p className="text-xs font-semibold text-gray-500 uppercase px-4 mb-2">Distribusi</p>
  <nav className="space-y-1">
    <Link href="/distribusi/surat-jalan" className="block px-4 py-2 rounded hover:bg-gray-100">
      Surat Jalan
    </Link>
    <Link href="/distribusi/terima" className="block px-4 py-2 rounded hover:bg-gray-100">
      Penerimaan Barang
    </Link>
  </nav>
</div>
```

- [ ] **Step 3: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/distribusi/src/components/layout/Sidebar.tsx
git commit -m "feat(distribusi): add distribusi nav to sidebar"
```

---

## Self-Review Checklist

✅ **Spec coverage:**
- [x] Database schema (surat_jalan, surat_jalan_item, ledger integration)
- [x] RPC functions (create, send, verify, finalize)
- [x] RLS policies (SPV sees all, crew sees own outlet)
- [x] UI for pusat (list, form, detail, signature flow)
- [x] UI for outlet (list, verifikasi form)
- [x] Foto upload (conditional, required if flagged)
- [x] Auto-ledger to M2

✅ **Placeholder scan:** No TBDs, all steps have complete code

✅ **Type consistency:** Types defined in Task 5; used consistently in all hooks, components, pages

✅ **Error handling:** RPC functions validate & raise exceptions; React components catch & alert

---

## Execution Ready

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans skill, batch execution with checkpoints

Which approach?
