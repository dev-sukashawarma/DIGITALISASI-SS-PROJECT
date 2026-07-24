# Role Purchase & Pengadaan — Implementation Plan (Spec 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan role `purchase` dedicated + alur pengadaan bahan baku end-to-end (usulan beli → PR → PO → approval finance → terima oleh stokis → stok masuk), dengan pemisahan tugas ditegakkan di DB.

**Architecture:** Perluas `apps/admin-dashboard` (pola `mitra`) untuk surface purchasing; `apps/finance` untuk surface approval. Satu record PO di DB menyambungkan keduanya. Aturan role hidup di RPC/RLS (penjaga sesungguhnya), UI memakai predikat murni yang sama.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + RLS), React Query, `@suka/auth`, `@suka/design-system`, Vitest.

## Global Constraints

- **`is_finance()` BUKAN gate role** — saat ini `SELECT auth.uid() IS NOT NULL` (true untuk semua user login). JANGAN pakai untuk otorisasi approval. Gunakan cek `outlet_staff.role` eksplisit.
- **`verifikasi_terima_po` harus MENOLAK role `purchase`** — pakai predikat terpisah `can_verify_po_receipt()`, jangan pakai `can_manage_po()` (yang kini memuat purchase).
- **`packages/auth` di-import dari `dist/`** — perubahan `src` tidak berlaku sampai `yarn build` di paket itu. `dist/access.js` saat ini masih versi lama (spv/leader belum punya `admin-dashboard`); rebuild akan mengaktifkan keduanya. RoleContext tetap menyaring (spv tak ada di allowlist → ditendang ke portal; leader punya guard `/dashboard/leader`), jadi tidak bocor — tapi rebuild harus disadari.
- **Scope Gudang Pusat** = outlet id `550e8400-e29b-41d4-a716-446655440001`.
- **Migration drift** rutin di DB shared — verifikasi ground-truth (`supabase db query "..." --linked`, `pg_get_functiondef`) sebelum `migration repair`; jangan andalkan `migration list`.
- **`npx` rusak di repo ini** — pakai `./node_modules/.bin/<tool>`.
- Semua perubahan stok WAJIB lewat `ledger_stok` (trigger yang urus saldo) — JANGAN `UPDATE stok_balance` langsung.
- TDD: test dulu, commit sering, DRY, YAGNI.

---

## File Structure

**packages/auth** (role plumbing)
- Modify: `packages/auth/src/types.ts` — tambah `'purchase'` ke union `Role`.
- Modify: `packages/auth/src/access.ts` — `ROLE_APP_ACCESS.purchase`.
- Test: `packages/auth/src/access.test.ts` (buat bila belum ada).

**supabase/migrations** (data + logika DB)
- Create: `20260723100000_purchase_role_and_procurement.sql` — role CHECK, `purchase_request`, `supplier.termin_hari`, kolom `purchase_order` (status, jatuh_tempo, audit finance), `bahan_baku_harga_history`.
- Create: `20260723100100_purchase_rpcs_guards.sql` — `can_manage_po` (+purchase), `can_verify_po_receipt` (baru), `verifikasi_terima_po` (pakai guard baru), `can_approve_po` + `approve_po_finance`/`reject_po_finance`, `po_on_verified` (+history, +jatuh_tempo).
- Create: `20260723100200_purchase_suggestion_view.sql` — `purchase_suggestion_spv` + policy `po_payable_spv` untuk purchase.

**apps/admin-dashboard** (surface purchasing)
- Create: `src/lib/purchase/predicates.ts` + test — predikat murni role.
- Create: `src/lib/purchase/suggestion.ts` + test — aritmetika qty saran.
- Create: `src/lib/purchase/dueDate.ts` + test — hitung jatuh tempo.
- Modify: `src/components/layout/RoleContext.tsx` — role `'PURCHASE'` + guard.
- Modify: `src/components/layout/navConfig.ts` — grup "Pembelian".
- Create: `src/hooks/usePurchaseSuggestion.ts`, `src/hooks/usePurchaseRequest.ts`, `src/hooks/useHargaHistory.ts`.
- Create: `src/app/dashboard/pembelian/perlu-dibeli/page.tsx`, `.../permintaan/page.tsx`, `.../harga/page.tsx`.
- Modify: `src/app/dashboard/pembelian/supplier/page.tsx` — field `termin_hari`.

**apps/finance** (surface approval)
- Create: `src/hooks/usePoApproval.ts`.
- Create: `src/app/po-approval/page.tsx` + view component.
- Modify: nav finance (tambah entri PO Approval).

---

## Task 1: Role plumbing di `@suka/auth`

**Files:**
- Modify: `packages/auth/src/types.ts`
- Modify: `packages/auth/src/access.ts`
- Test: `packages/auth/src/access.test.ts`

**Interfaces:**
- Produces: `Role` union memuat `'purchase'`; `ROLE_APP_ACCESS.purchase = ['admin-dashboard']`.

- [ ] **Step 1: Tulis test yang gagal**

Buat/append `packages/auth/src/access.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hasAppAccess, accessibleApps } from './access'

describe('role purchase access', () => {
  it('purchase hanya boleh admin-dashboard', () => {
    expect(accessibleApps('purchase')).toEqual(['admin-dashboard'])
    expect(hasAppAccess('purchase', 'admin-dashboard')).toBe(true)
    expect(hasAppAccess('purchase', 'finance')).toBe(false)
    expect(hasAppAccess('purchase', 'stok')).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal (type/nilai)**

Run: `cd packages/auth && ../../node_modules/.bin/vitest run src/access.test.ts`
Expected: FAIL — `'purchase'` bukan `Role` yang valid / `accessibleApps` return `[]`.

- [ ] **Step 3: Tambah `'purchase'` ke union `Role`**

Di `packages/auth/src/types.ts`, dalam `export type Role =`, tambah baris setelah `| 'admin_finance'`:

```typescript
  | 'purchase'
```

- [ ] **Step 4: Tambah entri di `ROLE_APP_ACCESS`**

Di `packages/auth/src/access.ts`, dalam objek `ROLE_APP_ACCESS`, tambah baris setelah `admin_finance: ['finance'],`:

```typescript
  purchase: ['admin-dashboard'],
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `cd packages/auth && ../../node_modules/.bin/vitest run src/access.test.ts`
Expected: PASS.

- [ ] **Step 6: Rebuild dist (WAJIB — consumer import dist)**

Run: `cd packages/auth && yarn build`
Expected: `dist/access.js` kini memuat `purchase: ['admin-dashboard']`.
Verifikasi: `grep "purchase" dist/access.js` → ada.

⚠️ **Catatan landmine:** rebuild ini juga mengaktifkan `spv`/`leader` → `admin-dashboard` yang sudah ada di `src` tapi belum di `dist`. Ini SUDAH tersaring RoleContext (spv ditendang ke portal, leader terkunci `/dashboard/leader`). Tidak ada aksi tambahan — cukup sadari saat verifikasi.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/src/access.ts packages/auth/src/access.test.ts packages/auth/dist
git commit -m "feat(auth): tambah role purchase (akses admin-dashboard)"
```

---

## Task 2: Migration skema pengadaan

**Files:**
- Create: `supabase/migrations/20260723100000_purchase_role_and_procurement.sql`

**Interfaces:**
- Produces: kolom & tabel — `outlet_staff.role` memuat `'purchase'`; tabel `purchase_request`; `supplier.termin_hari int`; `purchase_order.status` memuat `'menunggu_approval_finance'`; `purchase_order.jatuh_tempo date`, `disetujui_finance_oleh uuid`, `disetujui_finance_at timestamptz`; tabel `bahan_baku_harga_history`.

- [ ] **Step 1: Tulis migration**

Buat `supabase/migrations/20260723100000_purchase_role_and_procurement.sql`:

```sql
-- 20260723100000_purchase_role_and_procurement.sql
-- Spec 1: role purchase + skema pengadaan. Aditif & idempotent.

-- 1) Role purchase di CHECK constraint outlet_staff
DO $$
BEGIN
  ALTER TABLE public.outlet_staff DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
  ALTER TABLE public.outlet_staff ADD CONSTRAINT outlet_staff_role_check
    CHECK (role IN ('admin','owner','spv','leader','kasir','crew','kiosk','kitchen',
                    'mitra','staff_pusat','admin_finance','area_manager','korlap',
                    'admin_hr','purchase'));
END $$;

-- 2) Termin default per supplier
ALTER TABLE public.supplier
  ADD COLUMN IF NOT EXISTS termin_hari integer;
COMMENT ON COLUMN public.supplier.termin_hari IS 'Default termin pembayaran (hari) sejak barang diterima. NULL = belum ada kesepakatan.';

-- 3) Kolom purchase_order: gerbang approval finance + jatuh tempo
ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS jatuh_tempo date,
  ADD COLUMN IF NOT EXISTS disetujui_finance_oleh uuid REFERENCES public.outlet_staff(id),
  ADD COLUMN IF NOT EXISTS disetujui_finance_at timestamptz;

-- Perluas CHECK status PO (sisipkan menunggu_approval_finance)
DO $$
BEGIN
  ALTER TABLE public.purchase_order DROP CONSTRAINT IF EXISTS purchase_order_status_check;
  ALTER TABLE public.purchase_order ADD CONSTRAINT purchase_order_status_check
    CHECK (status IN ('draft','menunggu_approval_finance','dikirim_ke_supplier',
                      'sebagian_diterima','diterima_lengkap','dibatalkan'));
END $$;

-- 4) Riwayat harga master (jejak tiap penimpaan po_on_verified)
CREATE TABLE IF NOT EXISTS public.bahan_baku_harga_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id uuid NOT NULL REFERENCES public.bahan_baku(id) ON DELETE CASCADE,
  harga_lama    numeric,
  harga_baru    numeric NOT NULL,
  ref_po_id     uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  changed_by    uuid REFERENCES public.outlet_staff(id),
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bbhh_bahan ON public.bahan_baku_harga_history(bahan_baku_id, changed_at DESC);
ALTER TABLE public.bahan_baku_harga_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bbhh_select ON public.bahan_baku_harga_history;
CREATE POLICY bbhh_select ON public.bahan_baku_harga_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin','owner','kitchen','purchase')));

-- 5) Permintaan Pembelian (PR)
CREATE TABLE IF NOT EXISTS public.purchase_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by  uuid REFERENCES public.outlet_staff(id),
  bahan_baku_id uuid REFERENCES public.bahan_baku(id),
  nama_bebas    text,
  qty           numeric NOT NULL CHECK (qty > 0),
  satuan        text,
  alasan        text,
  urgensi       text NOT NULL DEFAULT 'normal' CHECK (urgensi IN ('rendah','normal','mendesak')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','jadi_po','ditolak')),
  linked_po_id  uuid REFERENCES public.purchase_order(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pr_bahan_or_bebas CHECK (bahan_baku_id IS NOT NULL OR nama_bebas IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_pr_status ON public.purchase_request(status, created_at DESC);
ALTER TABLE public.purchase_request ENABLE ROW LEVEL SECURITY;

-- SELECT: pengaju (kitchen/spv), purchase, admin, owner
DROP POLICY IF EXISTS pr_select ON public.purchase_request;
CREATE POLICY pr_select ON public.purchase_request
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid()
                   AND role IN ('kitchen','spv','purchase','admin','owner')));

-- INSERT: hanya kitchen/spv yang mengajukan (requested_by wajib = auth.uid())
DROP POLICY IF EXISTS pr_insert ON public.purchase_request;
CREATE POLICY pr_insert ON public.purchase_request
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.outlet_staff
                WHERE id = auth.uid() AND role IN ('kitchen','spv')));

-- UPDATE: purchase (mengubah status jadi_po/ditolak + link PO), admin/owner
DROP POLICY IF EXISTS pr_update ON public.purchase_request;
CREATE POLICY pr_update ON public.purchase_request
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('purchase','admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('purchase','admin','owner')));

CREATE OR REPLACE FUNCTION public.pr_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_pr_updated_at ON public.purchase_request;
CREATE TRIGGER trg_pr_updated_at BEFORE UPDATE ON public.purchase_request
  FOR EACH ROW EXECUTE FUNCTION public.pr_set_updated_at();
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: migration `20260723100000` applied. Bila drift (migration remote-only tanpa file lokal), JANGAN `repair` sepihak — laporkan; migration ini tak bergantung apa pun yang belum ada.

- [ ] **Step 3: Verifikasi ground-truth di DB live**

Run:
```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='purchase_order' AND column_name IN ('jatuh_tempo','disetujui_finance_oleh','disetujui_finance_at');" --linked
supabase db query "SELECT to_regclass('public.purchase_request'), to_regclass('public.bahan_baku_harga_history');" --linked
```
Expected: 3 kolom muncul; kedua tabel non-NULL.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723100000_purchase_role_and_procurement.sql
git commit -m "feat(db): skema pengadaan — role purchase, PR, termin, riwayat harga"
```

---

## Task 3: RPC guards & trigger (pemisahan tugas + approval + riwayat)

**Files:**
- Create: `supabase/migrations/20260723100100_purchase_rpcs_guards.sql`

**Interfaces:**
- Consumes: `can_manage_po()` existing; `po_on_verified()` existing (`20260709000001`/`20260718000001`); `verifikasi_terima_po(uuid,jsonb)` existing.
- Produces: `can_manage_po()` (memuat purchase); `can_verify_po_receipt()` (kitchen/admin/owner); `can_approve_po()` (admin_finance/owner/admin); `approve_po_finance(uuid)`; `reject_po_finance(uuid,text)`; `po_on_verified()` menulis history + set jatuh_tempo.

- [ ] **Step 1: Cek ground-truth versi fungsi terkini SEBELUM menimpa**

Run:
```bash
supabase db query "SELECT proname, pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('po_on_verified','can_manage_po','verifikasi_terima_po');" --linked
```
Expected: catat isi terkini `po_on_verified` (ranjau timestamp/versi HQ fix `20260718000001` mungkin jadi basis). Salin bagian FOR-loop apa adanya ke migration agar tak membuang perbaikan HQ.

- [ ] **Step 2: Tulis migration guards + RPC**

Buat `supabase/migrations/20260723100100_purchase_rpcs_guards.sql`:

```sql
-- 20260723100100_purchase_rpcs_guards.sql
-- Guards pemisahan tugas + approval finance + riwayat harga.

-- A) can_manage_po: compose/create/kirim PO. Tambah 'purchase'.
CREATE OR REPLACE FUNCTION public.can_manage_po()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin','kitchen','purchase'));
$$;

-- B) can_verify_po_receipt: HANYA yang boleh commit terima. TOLAK purchase.
CREATE OR REPLACE FUNCTION public.can_verify_po_receipt()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('kitchen','admin','owner'));
$$;

-- C) can_approve_po: gerbang approval finance. JANGAN pakai is_finance() (true utk semua).
CREATE OR REPLACE FUNCTION public.can_approve_po()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role IN ('admin_finance','owner','admin'));
$$;

-- D) verifikasi_terima_po: ganti guard ke can_verify_po_receipt (tolak purchase).
--    Ambil body existing dari Step 1; HANYA ubah baris guard di awal.
--    (Ganti blok "IF NOT public.can_manage_po() THEN ... END IF;" menjadi:)
--    IF NOT public.can_verify_po_receipt() THEN
--      RAISE EXCEPTION 'Hanya kitchen/admin/owner yang dapat verifikasi terima PO'
--        USING ERRCODE = 'insufficient_privilege';
--    END IF;
--    >>> Tempel ULANG definisi lengkap verifikasi_terima_po di sini dengan guard baru <<<

-- E) approve_po_finance / reject_po_finance
CREATE OR REPLACE FUNCTION public.approve_po_finance(p_po_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.can_approve_po() THEN
    RAISE EXCEPTION 'Hanya finance/owner/admin yang dapat approve PO'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT status INTO v_status FROM public.purchase_order WHERE id = p_po_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_status <> 'menunggu_approval_finance' THEN
    RAISE EXCEPTION 'PO tidak dalam status menunggu approval (status: %)', v_status;
  END IF;
  UPDATE public.purchase_order
    SET status = 'dikirim_ke_supplier',
        disetujui_finance_oleh = auth.uid(),
        disetujui_finance_at = now(),
        updated_at = now()
    WHERE id = p_po_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_po_finance(p_po_id uuid, p_alasan text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.can_approve_po() THEN
    RAISE EXCEPTION 'Hanya finance/owner/admin yang dapat menolak PO'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT status INTO v_status FROM public.purchase_order WHERE id = p_po_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'PO tidak ditemukan'; END IF;
  IF v_status <> 'menunggu_approval_finance' THEN
    RAISE EXCEPTION 'PO tidak dalam status menunggu approval (status: %)', v_status;
  END IF;
  UPDATE public.purchase_order
    SET status = 'draft',
        catatan = COALESCE(catatan,'') || CASE WHEN p_alasan IS NOT NULL
                    THEN E'\n[Ditolak finance] ' || p_alasan ELSE '' END,
        updated_at = now()
    WHERE id = p_po_id;
END; $$;

-- F) po_on_verified: tulis riwayat harga SEBELUM upsert + set jatuh_tempo.
--    Tempel ULANG definisi lengkap dari Step 1, dengan DUA sisipan:
--    (1) Di dalam FOR-loop, sebelum upsert bahan_baku_harga:
--        INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, ref_po_id, changed_by)
--        SELECT v_item.bahan_baku_id, bh.harga_beli, v_item.harga_terima, NEW.id, NEW.diverifikasi_oleh
--        FROM public.bahan_baku_harga bh WHERE bh.bahan_baku_id = v_item.bahan_baku_id;
--        -- (bila belum ada baris harga, history harga_lama NULL — pakai LEFT via NOT EXISTS insert terpisah)
--    (2) Setelah loop, hitung jatuh_tempo dari termin supplier:
--        UPDATE public.purchase_order po
--          SET jatuh_tempo = NEW.diverifikasi_at::date + COALESCE(s.termin_hari, 0)
--          FROM public.supplier s
--          WHERE po.id = NEW.id AND po.supplier_id = s.id AND po.jatuh_tempo IS NULL;
```

> **Catatan implementer:** Step 2 sengaja menandai blok D & F sebagai "tempel ulang definisi lengkap". Ambil definisi terkini dari Step 1, salin utuh, lalu terapkan perubahan yang dijelaskan. Ini menghindari membuang perbaikan HQ (`20260718000001`) yang mungkin jadi basis. Untuk history saat belum ada baris harga awal, gunakan dua statement (satu untuk kasus ada baris → harga_lama terisi; satu `WHERE NOT EXISTS` → harga_lama NULL), atau `LEFT JOIN` di satu INSERT.

- [ ] **Step 3: Push + verifikasi ground-truth**

Run:
```bash
supabase db push
supabase db query "SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('can_verify_po_receipt','can_approve_po','approve_po_finance','reject_po_finance');" --linked
```
Expected: keempat fungsi ada, `prosecdef=true`.

- [ ] **Step 4: Verifikasi manual pemisahan tugas (SQL sebagai purchase)**

Buat user uji role `purchase` di Supabase Studio (atau pakai akun test), lalu (via app nanti) pastikan `verifikasi_terima_po` menolak. Untuk sekarang, verifikasi logika guard via query:
```bash
supabase db query "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='verifikasi_terima_po';" --linked
```
Expected: body memuat `can_verify_po_receipt()`, BUKAN `can_manage_po()`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260723100100_purchase_rpcs_guards.sql
git commit -m "feat(db): guards pemisahan tugas + approval finance + riwayat harga"
```

---

## Task 4: Predikat murni role (shared UI ⇄ mental model RPC)

**Files:**
- Create: `apps/admin-dashboard/src/lib/purchase/predicates.ts`
- Test: `apps/admin-dashboard/src/lib/purchase/predicates.test.ts`

**Interfaces:**
- Produces: `canComposePO(role)`, `canVerifyReceipt(role)`, `canApprovePOFinance(role)` — semua `(role: string) => boolean`.

- [ ] **Step 1: Tulis test yang gagal**

```typescript
import { describe, it, expect } from 'vitest'
import { canComposePO, canVerifyReceipt, canApprovePOFinance } from './predicates'

describe('purchase role predicates', () => {
  it('compose: admin, kitchen, purchase', () => {
    expect(['admin','kitchen','purchase'].every(canComposePO)).toBe(true)
    expect(canComposePO('spv')).toBe(false)
  })
  it('verify receipt TOLAK purchase', () => {
    expect(canVerifyReceipt('purchase')).toBe(false)
    expect(['kitchen','admin','owner'].every(canVerifyReceipt)).toBe(true)
  })
  it('approve finance: admin_finance, owner, admin — TOLAK purchase', () => {
    expect(canApprovePOFinance('purchase')).toBe(false)
    expect(['admin_finance','owner','admin'].every(canApprovePOFinance)).toBe(true)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/purchase/predicates.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implementasi minimal**

Buat `apps/admin-dashboard/src/lib/purchase/predicates.ts`:

```typescript
// Predikat role pengadaan. HARUS cocok dengan guard RPC di
// 20260723100100_purchase_rpcs_guards.sql — satu sumber aturan, dua tempat pakai.
export function canComposePO(role: string): boolean {
  return ['admin', 'kitchen', 'purchase'].includes(role)
}
export function canVerifyReceipt(role: string): boolean {
  // Purchase SENGAJA dikecualikan — tak boleh jadi hakim atas barangnya sendiri.
  return ['kitchen', 'admin', 'owner'].includes(role)
}
export function canApprovePOFinance(role: string): boolean {
  return ['admin_finance', 'owner', 'admin'].includes(role)
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/purchase/predicates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/purchase/predicates.ts apps/admin-dashboard/src/lib/purchase/predicates.test.ts
git commit -m "feat(purchase): predikat role pengadaan + test"
```

---

## Task 5: Hitung jatuh tempo (fungsi murni)

**Files:**
- Create: `apps/admin-dashboard/src/lib/purchase/dueDate.ts`
- Test: `apps/admin-dashboard/src/lib/purchase/dueDate.test.ts`

**Interfaces:**
- Produces: `computeDueDate(arrivalISO: string, terminHari: number | null): string | null` — return ISO date (`YYYY-MM-DD`) atau `null` bila termin null.

- [ ] **Step 1: Tulis test yang gagal**

```typescript
import { describe, it, expect } from 'vitest'
import { computeDueDate } from './dueDate'

describe('computeDueDate', () => {
  it('arrival + 30 hari', () => {
    expect(computeDueDate('2026-07-01', 30)).toBe('2026-07-31')
  })
  it('arrival + 45 hari lintas bulan', () => {
    expect(computeDueDate('2026-07-20', 45)).toBe('2026-09-03')
  })
  it('termin null → null', () => {
    expect(computeDueDate('2026-07-01', null)).toBeNull()
  })
  it('abaikan komponen jam pada arrival', () => {
    expect(computeDueDate('2026-07-01T14:30:00Z', 10)).toBe('2026-07-11')
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/purchase/dueDate.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implementasi minimal**

Buat `apps/admin-dashboard/src/lib/purchase/dueDate.ts`:

```typescript
// Jatuh tempo = tanggal barang datang + termin_hari. Sejalan dengan
// po_on_verified() di DB; direplikasi di TS agar UI bisa menampilkan estimasi.
export function computeDueDate(arrivalISO: string, terminHari: number | null): string | null {
  if (terminHari == null) return null
  const d = new Date(arrivalISO.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + terminHari)
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/purchase/dueDate.test.ts`
Expected: PASS (2026-07-31, 2026-09-03, null, 2026-07-11).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/purchase/dueDate.ts apps/admin-dashboard/src/lib/purchase/dueDate.test.ts
git commit -m "feat(purchase): computeDueDate + test"
```

---

## Task 6: Aritmetika usulan beli (fungsi murni)

**Files:**
- Create: `apps/admin-dashboard/src/lib/purchase/suggestion.ts`
- Test: `apps/admin-dashboard/src/lib/purchase/suggestion.test.ts`

**Interfaces:**
- Consumes: baris mentah dari view `purchase_suggestion_spv` (Task 7).
- Produces:
  - type `SuggestionRow = { bahan_baku_id: string; nama: string; satuan: string; stok: number; threshold: number; days_left: number | null; permintaan_pending: number; sudah_dipesan: number }`
  - type `SuggestionComputed = SuggestionRow & { qty_saran: number; tingkat: 'mendesak'|'menipis'|'aman' }`
  - `computeSuggestion(row: SuggestionRow, hariKedepan?: number): SuggestionComputed` (default `hariKedepan = 7`)
  - `sortSuggestions(rows: SuggestionComputed[]): SuggestionComputed[]`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
import { describe, it, expect } from 'vitest'
import { computeSuggestion, sortSuggestions, type SuggestionRow } from './suggestion'

const base: SuggestionRow = {
  bahan_baku_id: 'a', nama: 'Ayam', satuan: 'kg',
  stok: 10, threshold: 20, days_left: 2, permintaan_pending: 5, sudah_dipesan: 0,
}

describe('computeSuggestion', () => {
  it('qty_saran = (threshold + permintaan + kebutuhan periode) - stok - sudah_dipesan, tak negatif', () => {
    // laju/hari = stok/days_left = 10/2 = 5; kebutuhan 7 hari = 35
    // (20 + 5 + 35) - 10 - 0 = 50
    const r = computeSuggestion(base)
    expect(r.qty_saran).toBe(50)
  })
  it('kurangi yang sudah dipesan', () => {
    expect(computeSuggestion({ ...base, sudah_dipesan: 40 }).qty_saran).toBe(10)
  })
  it('tak pernah negatif', () => {
    expect(computeSuggestion({ ...base, sudah_dipesan: 999 }).qty_saran).toBe(0)
  })
  it('days_left null → kebutuhan periode 0', () => {
    // (20 + 5 + 0) - 10 - 0 = 15
    expect(computeSuggestion({ ...base, days_left: null }).qty_saran).toBe(15)
  })
  it('tingkat mendesak bila stok < threshold ATAU days_left <= 3', () => {
    expect(computeSuggestion(base).tingkat).toBe('mendesak')
    expect(computeSuggestion({ ...base, stok: 25, days_left: 10 }).tingkat).toBe('aman')
    expect(computeSuggestion({ ...base, stok: 25, days_left: 2 }).tingkat).toBe('mendesak')
  })
})

describe('sortSuggestions', () => {
  it('mendesak di atas, aman di bawah', () => {
    const rows = [
      computeSuggestion({ ...base, bahan_baku_id: 'x', stok: 25, days_left: 10 }),
      computeSuggestion({ ...base, bahan_baku_id: 'y' }),
    ]
    expect(sortSuggestions(rows).map(r => r.bahan_baku_id)).toEqual(['y', 'x'])
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/purchase/suggestion.test.ts`
Expected: FAIL — module tidak ada.

- [ ] **Step 3: Implementasi minimal**

Buat `apps/admin-dashboard/src/lib/purchase/suggestion.ts`:

```typescript
export type SuggestionRow = {
  bahan_baku_id: string
  nama: string
  satuan: string
  stok: number
  threshold: number
  days_left: number | null
  permintaan_pending: number
  sudah_dipesan: number
}

export type Tingkat = 'mendesak' | 'menipis' | 'aman'
export type SuggestionComputed = SuggestionRow & { qty_saran: number; tingkat: Tingkat }

const RANK: Record<Tingkat, number> = { mendesak: 0, menipis: 1, aman: 2 }

export function computeSuggestion(row: SuggestionRow, hariKedepan = 7): SuggestionComputed {
  const lajuPerHari = row.days_left && row.days_left > 0 ? row.stok / row.days_left : 0
  const kebutuhanPeriode = lajuPerHari * hariKedepan
  const raw = (row.threshold + row.permintaan_pending + kebutuhanPeriode) - row.stok - row.sudah_dipesan
  const qty_saran = Math.max(0, Math.round(raw))

  let tingkat: Tingkat
  if (row.stok < row.threshold || (row.days_left != null && row.days_left <= 3)) {
    tingkat = 'mendesak'
  } else if (row.days_left != null && row.days_left <= 7) {
    tingkat = 'menipis'
  } else {
    tingkat = 'aman'
  }
  return { ...row, qty_saran, tingkat }
}

export function sortSuggestions(rows: SuggestionComputed[]): SuggestionComputed[] {
  return [...rows].sort((a, b) => RANK[a.tingkat] - RANK[b.tingkat])
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/purchase/suggestion.test.ts`
Expected: PASS (semua kasus).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/purchase/suggestion.ts apps/admin-dashboard/src/lib/purchase/suggestion.test.ts
git commit -m "feat(purchase): aritmetika usulan beli + test"
```

---

## Task 7: View `purchase_suggestion_spv` + policy payable

**Files:**
- Create: `supabase/migrations/20260723100200_purchase_suggestion_view.sql`

**Interfaces:**
- Consumes: `monitoring_view_spv`, `stockout_forecast_spv`, `permintaan_bahan`, `purchase_order`/`purchase_order_item`.
- Produces: view `purchase_suggestion_spv` dengan kolom `bahan_baku_id, nama, satuan, stok, threshold, days_left, permintaan_pending, sudah_dipesan` — cocok dengan `SuggestionRow`.

- [ ] **Step 1: Cek kolom sumber ground-truth**

Run:
```bash
supabase db query "SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name='monitoring_view_spv';" --linked
supabase db query "SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name='stockout_forecast_spv';" --linked
supabase db query "SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name='permintaan_bahan';" --linked
```
Expected: catat nama kolom nyata (mis. `qty_current`/`saldo`, `reorder_point`/`threshold`, `days_left`, `outlet_id`, status permintaan). Sesuaikan SELECT di Step 2 dengan nama nyata.

- [ ] **Step 2: Tulis view (sesuaikan nama kolom dari Step 1)**

Buat `supabase/migrations/20260723100200_purchase_suggestion_view.sql`:

```sql
-- 20260723100200_purchase_suggestion_view.sql
-- Usulan beli utk Gudang Pusat. Data mentah; aritmetika qty ada di TS (suggestion.ts).
-- Ganti nama kolom sumber sesuai hasil ground-truth Step 1.

CREATE OR REPLACE VIEW public.purchase_suggestion_spv
WITH (security_invoker = true) AS
WITH kitchen AS (SELECT '550e8400-e29b-41d4-a716-446655440001'::uuid AS id),
pesan AS (
  SELECT poi.bahan_baku_id, COALESCE(SUM(poi.qty_pesan - COALESCE(poi.qty_terima,0)),0) AS sudah_dipesan
  FROM public.purchase_order_item poi
  JOIN public.purchase_order po ON po.id = poi.purchase_order_id
  WHERE po.status IN ('menunggu_approval_finance','dikirim_ke_supplier','sebagian_diterima')
  GROUP BY poi.bahan_baku_id
),
minta AS (
  SELECT pb.bahan_baku_id, COALESCE(SUM(pb.qty),0) AS permintaan_pending
  FROM public.permintaan_bahan pb
  WHERE pb.status = 'pending'
  GROUP BY pb.bahan_baku_id
)
SELECT
  m.bahan_baku_id,
  m.nama,
  m.satuan,
  m.qty_current                       AS stok,       -- sesuaikan Step 1
  m.reorder_point                     AS threshold,  -- sesuaikan Step 1
  f.days_left,
  COALESCE(minta.permintaan_pending, 0) AS permintaan_pending,
  COALESCE(pesan.sudah_dipesan, 0)      AS sudah_dipesan
FROM public.monitoring_view_spv m
CROSS JOIN kitchen k
LEFT JOIN public.stockout_forecast_spv f
       ON f.bahan_baku_id = m.bahan_baku_id AND f.outlet_id = m.outlet_id
LEFT JOIN pesan  ON pesan.bahan_baku_id = m.bahan_baku_id
LEFT JOIN minta  ON minta.bahan_baku_id = m.bahan_baku_id
WHERE m.outlet_id = k.id;

GRANT SELECT ON public.purchase_suggestion_spv TO authenticated;

-- Policy: purchase boleh baca status bayar PO (read-only).
DROP POLICY IF EXISTS po_select_purchase ON public.purchase_order;
CREATE POLICY po_select_purchase ON public.purchase_order
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role = 'purchase'));
DROP POLICY IF EXISTS poi_select_purchase ON public.purchase_order_item;
CREATE POLICY poi_select_purchase ON public.purchase_order_item
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff
                 WHERE id = auth.uid() AND role = 'purchase'));
```

> **Catatan:** `purchase_suggestion_spv` pakai `security_invoker = true` supaya menghormati RLS caller. Purchase perlu SELECT di `monitoring_view_spv`/`stockout_forecast_spv` (view definer existing sudah GRANT ke authenticated) dan `permintaan_bahan` — verifikasi di Step 3.

- [ ] **Step 3: Push + verifikasi view mengembalikan baris untuk purchase**

Run:
```bash
supabase db push
supabase db query "SELECT count(*) FROM public.purchase_suggestion_spv;" --linked
```
Expected: query sukses (angka ≥ 0). Bila error kolom, koreksi nama dari Step 1 dan re-push sebagai migration koreksi.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723100200_purchase_suggestion_view.sql
git commit -m "feat(db): view purchase_suggestion_spv + policy payable purchase"
```

---

## Task 8: RoleContext + navConfig (guard 3 lapis — lapis nav & route)

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/RoleContext.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts`
- Test: `apps/admin-dashboard/src/components/layout/navConfig.test.ts` (append)

**Interfaces:**
- Consumes: `Role` lokal di kedua file (string uppercase).
- Produces: `'PURCHASE'` sebagai Role valid; grup nav "Pembelian"; guard route purchase → `/dashboard/pembelian`.

- [ ] **Step 1: Tulis test nav yang gagal**

Append ke `apps/admin-dashboard/src/components/layout/navConfig.test.ts`:

```typescript
import { NAV_GROUPS } from './navConfig'

describe('nav purchase', () => {
  it('PURCHASE hanya melihat grup Pembelian', () => {
    const groups = NAV_GROUPS.filter(g => g.roles.includes('PURCHASE' as any))
    expect(groups.length).toBe(1)
    expect(groups[0].title).toBe('Pembelian')
    const hrefs = groups[0].items.map(i => i.href)
    expect(hrefs).toContain('/dashboard/pembelian/perlu-dibeli')
    expect(hrefs).toContain('/dashboard/pembelian/permintaan')
  })
  it('PURCHASE tidak melihat grup Bisnis/keuangan', () => {
    const bisnis = NAV_GROUPS.find(g => g.title === 'Bisnis')
    expect(bisnis?.roles.includes('PURCHASE' as any)).toBeFalsy()
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/components/layout/navConfig.test.ts`
Expected: FAIL pada blok baru (grup belum ada). (Kegagalan pre-existing di file ini boleh diabaikan — fokus blok baru.)

- [ ] **Step 3: Tambah `'PURCHASE'` ke type Role + grup nav**

Di `apps/admin-dashboard/src/components/layout/navConfig.ts`:

Ganti baris `export type Role = ...` menjadi:
```typescript
export type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA' | 'LEADER' | 'AREA_MANAGER' | 'PURCHASE'
```

Tambah grup baru ke `NAV_GROUPS` (setelah grup 'Portal Mitra'):
```typescript
  {
    title: 'Pembelian',
    icon: ShoppingCart,
    roles: ['PURCHASE'],
    items: [
      { href: '/dashboard/pembelian/perlu-dibeli', label: 'Perlu Dibeli', shortLabel: 'Perlu Dibeli', icon: BellRing, roles: ['PURCHASE'] },
      { href: '/dashboard/pembelian', label: 'Purchase Order', shortLabel: 'PO', icon: ShoppingCart, roles: ['PURCHASE'] },
      { href: '/dashboard/pembelian/permintaan', label: 'Permintaan Pembelian', shortLabel: 'Permintaan', icon: FileText, roles: ['PURCHASE'] },
      { href: '/dashboard/pembelian/supplier', label: 'Master Supplier', shortLabel: 'Supplier', icon: Truck, roles: ['PURCHASE'] },
      { href: '/dashboard/pembelian/harga', label: 'Harga & Bahan Baku', shortLabel: 'Harga', icon: TrendingDown, roles: ['PURCHASE'] },
      { href: '/dashboard/reports/pembelian', label: 'Laporan Pembelian', shortLabel: 'Laporan', icon: PieChart, roles: ['PURCHASE'] },
    ],
  },
```

- [ ] **Step 4: Tambah `'PURCHASE'` ke RoleContext + guard**

Di `apps/admin-dashboard/src/components/layout/RoleContext.tsx`:

Ganti `type Role = ...` menjadi:
```typescript
type Role = 'ADMIN_HR' | 'OWNER' | 'ADMIN' | 'MITRA' | 'LEADER' | 'AREA_MANAGER' | 'PURCHASE'
```

Di allowlist `if ([...].includes(mappedRole))`, tambahkan `'PURCHASE'`:
```typescript
      if (['OWNER', 'ADMIN', 'ADMIN_HR', 'MITRA', 'LEADER', 'AREA_MANAGER', 'PURCHASE'].includes(mappedRole)) {
```

Tambah guard route baru (setelah guard AREA_MANAGER):
```typescript
  // Route-guard: PURCHASE hanya boleh /dashboard/pembelian/*
  useEffect(() => {
    if (role !== 'PURCHASE') return
    const allowed = ['/dashboard/pembelian', '/dashboard/reports/pembelian']
    if (!allowed.some((a) => pathname === a || pathname.startsWith(a + '/'))) {
      router.replace('/dashboard/pembelian/perlu-dibeli')
    }
  }, [role, pathname, router])
```

- [ ] **Step 5: Jalankan test nav, pastikan blok baru lulus**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/components/layout/navConfig.test.ts -t "nav purchase"`
Expected: PASS untuk 2 test baru.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/RoleContext.tsx apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(purchase): role PURCHASE di nav + RoleContext guard"
```

---

## Task 9: Hooks data purchasing (React Query)

**Files:**
- Create: `apps/admin-dashboard/src/hooks/usePurchaseSuggestion.ts`
- Create: `apps/admin-dashboard/src/hooks/usePurchaseRequest.ts`
- Create: `apps/admin-dashboard/src/hooks/useHargaHistory.ts`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient` dari `@suka/auth`; `SuggestionRow`/`computeSuggestion`/`sortSuggestions` (Task 6).
- Produces:
  - `usePurchaseSuggestion(): { rows: SuggestionComputed[]; loading: boolean; error: unknown }`
  - `usePurchaseRequests(): { rows: PurchaseRequest[]; loading; error }` + `useConvertPrToPo()` mutation stub (mengubah status → `jadi_po`, set `linked_po_id`)
  - `useHargaHistory(bahanBakuId: string)` → riwayat harga per bahan

- [ ] **Step 1: Tulis usePurchaseSuggestion**

Buat `apps/admin-dashboard/src/hooks/usePurchaseSuggestion.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { computeSuggestion, sortSuggestions, type SuggestionRow, type SuggestionComputed } from '@/lib/purchase/suggestion'

const supabase = createSupabaseBrowserClient()

export function usePurchaseSuggestion() {
  const q = useQuery<SuggestionComputed[]>({
    queryKey: ['purchase-suggestion'],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_suggestion_spv').select('*')
      if (error) throw error
      const computed = (data as SuggestionRow[]).map((r) => computeSuggestion(r))
      return sortSuggestions(computed)
    },
  })
  return { rows: q.data ?? [], loading: q.isLoading, error: q.error }
}
```

- [ ] **Step 2: Tulis usePurchaseRequest**

Buat `apps/admin-dashboard/src/hooks/usePurchaseRequest.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

export type PurchaseRequest = {
  id: string
  requested_by: string | null
  bahan_baku_id: string | null
  nama_bebas: string | null
  qty: number
  satuan: string | null
  alasan: string | null
  urgensi: 'rendah' | 'normal' | 'mendesak'
  status: 'pending' | 'jadi_po' | 'ditolak'
  linked_po_id: string | null
  created_at: string
}

export function usePurchaseRequests() {
  const q = useQuery<PurchaseRequest[]>({
    queryKey: ['purchase-requests'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_request')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PurchaseRequest[]
    },
  })
  return { rows: q.data ?? [], loading: q.isLoading, error: q.error }
}

export function useRejectPr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchase_request').update({ status: 'ditolak' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-requests'] }); toast.success('Permintaan ditolak') },
    onError: (e: any) => toast.error(e.message ?? 'Gagal menolak'),
  })
}
```

- [ ] **Step 3: Tulis useHargaHistory**

Buat `apps/admin-dashboard/src/hooks/useHargaHistory.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'

const supabase = createSupabaseBrowserClient()

export type HargaHistoryRow = {
  id: string
  harga_lama: number | null
  harga_baru: number
  ref_po_id: string | null
  changed_at: string
}

export function useHargaHistory(bahanBakuId: string | null) {
  const q = useQuery<HargaHistoryRow[]>({
    queryKey: ['harga-history', bahanBakuId],
    enabled: !!bahanBakuId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_baku_harga_history')
        .select('id, harga_lama, harga_baru, ref_po_id, changed_at')
        .eq('bahan_baku_id', bahanBakuId)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return data as HargaHistoryRow[]
    },
  })
  return { rows: q.data ?? [], loading: q.isLoading, error: q.error }
}
```

- [ ] **Step 4: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 error baru di 3 file ini (error pre-existing di file lain boleh diabaikan).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/hooks/usePurchaseSuggestion.ts apps/admin-dashboard/src/hooks/usePurchaseRequest.ts apps/admin-dashboard/src/hooks/useHargaHistory.ts
git commit -m "feat(purchase): hooks usulan beli, PR, riwayat harga"
```

---

## Task 10: Halaman Perlu Dibeli

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/pembelian/perlu-dibeli/page.tsx`

**Interfaces:**
- Consumes: `usePurchaseSuggestion` (Task 9), `SuggestionComputed` (Task 6).
- Produces: halaman client `/dashboard/pembelian/perlu-dibeli` — tabel + checkbox + tombol "Buat Draft PO" (navigasi ke `/dashboard/pembelian/new` membawa item terpilih via query/sessionStorage).

- [ ] **Step 1: Tulis halaman**

Buat `apps/admin-dashboard/src/app/dashboard/pembelian/perlu-dibeli/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePurchaseSuggestion } from '@/hooks/usePurchaseSuggestion'

const BADGE: Record<string, string> = {
  mendesak: 'bg-red-100 text-red-700',
  menipis: 'bg-amber-100 text-amber-700',
  aman: 'bg-emerald-100 text-emerald-700',
}

export default function PerluDibeliPage() {
  const { rows, loading } = usePurchaseSuggestion()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const router = useRouter()

  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }))
  const selected = rows.filter((r) => checked[r.bahan_baku_id])

  const buatDraft = () => {
    if (selected.length === 0) return
    sessionStorage.setItem('po_draft_items', JSON.stringify(
      selected.map((r) => ({ bahan_baku_id: r.bahan_baku_id, nama: r.nama, satuan: r.satuan, qty: r.qty_saran }))
    ))
    router.push('/dashboard/pembelian/new?from=suggestion')
  }

  if (loading) return <div className="p-6 text-suka-brown">Memuat usulan…</div>

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-suka-brown">Perlu Dibeli</h1>
        <button
          onClick={buatDraft}
          disabled={selected.length === 0}
          className="px-4 py-2 rounded-lg bg-suka-orange text-white font-bold disabled:opacity-40"
        >
          Buat Draft PO ({selected.length})
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-suka-outline bg-white">
        <table className="w-full text-sm">
          <thead className="bg-suka-cream text-suka-brown">
            <tr>
              <th className="p-3 text-left w-8"></th>
              <th className="p-3 text-left">Bahan</th>
              <th className="p-3 text-right">Stok</th>
              <th className="p-3 text-right">Threshold</th>
              <th className="p-3 text-right">Sisa Hari</th>
              <th className="p-3 text-right">Permintaan</th>
              <th className="p-3 text-right">Sudah Dipesan</th>
              <th className="p-3 text-right">Qty Saran</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bahan_baku_id} className="border-t border-suka-outline/50">
                <td className="p-3">
                  <input type="checkbox" checked={!!checked[r.bahan_baku_id]} onChange={() => toggle(r.bahan_baku_id)} />
                </td>
                <td className="p-3 font-medium">{r.nama}</td>
                <td className="p-3 text-right">{r.stok} {r.satuan}</td>
                <td className="p-3 text-right">{r.threshold}</td>
                <td className="p-3 text-right">{r.days_left ?? '—'}</td>
                <td className="p-3 text-right">{r.permintaan_pending || '—'}</td>
                <td className="p-3 text-right">{r.sudah_dipesan || '—'}</td>
                <td className="p-3 text-right font-bold">{r.qty_saran} {r.satuan}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BADGE[r.tingkat]}`}>{r.tingkat}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-suka-brown/60">Tidak ada usulan — stok pusat aman.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

> **Catatan:** halaman `/dashboard/pembelian/new` existing perlu membaca `sessionStorage.po_draft_items` bila `?from=suggestion`. Bila belum, tambahkan pembacaan itu di file `new/page.tsx` (prefill item). Ini modifikasi kecil pada form existing — lakukan di step berikut bila form-nya mendukung prefill; bila tidak, catat sebagai follow-up dan biarkan tombol mengarah ke form kosong untuk sekarang.

- [ ] **Step 2: Build cek route muncul**

Run: `cd apps/admin-dashboard && yarn build 2>&1 | grep "perlu-dibeli"`
Expected: route `/dashboard/pembelian/perlu-dibeli` muncul di output build.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/pembelian/perlu-dibeli/page.tsx
git commit -m "feat(purchase): halaman Perlu Dibeli"
```

---

## Task 11: Halaman Permintaan Pembelian (PR) + Harga

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/pembelian/permintaan/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/pembelian/harga/page.tsx`

**Interfaces:**
- Consumes: `usePurchaseRequests`, `useRejectPr` (Task 9); `usePOPriceAlerts` existing; `useHargaHistory` (Task 9).
- Produces: dua route baru.

- [ ] **Step 1: Tulis halaman Permintaan**

Buat `apps/admin-dashboard/src/app/dashboard/pembelian/permintaan/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { usePurchaseRequests, useRejectPr } from '@/hooks/usePurchaseRequest'

const URG: Record<string, string> = {
  mendesak: 'bg-red-100 text-red-700', normal: 'bg-suka-cream text-suka-brown', rendah: 'bg-gray-100 text-gray-600',
}
const ST: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', jadi_po: 'bg-emerald-100 text-emerald-700', ditolak: 'bg-gray-100 text-gray-500',
}

export default function PermintaanPage() {
  const { rows, loading } = usePurchaseRequests()
  const reject = useRejectPr()
  const router = useRouter()

  if (loading) return <div className="p-6 text-suka-brown">Memuat permintaan…</div>

  const konversi = (r: any) => {
    sessionStorage.setItem('po_draft_items', JSON.stringify([
      { bahan_baku_id: r.bahan_baku_id, nama: r.nama_bebas ?? '', satuan: r.satuan, qty: r.qty, pr_id: r.id },
    ]))
    router.push('/dashboard/pembelian/new?from=pr')
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-suka-brown mb-4">Permintaan Pembelian</h1>
      <div className="overflow-x-auto rounded-xl border border-suka-outline bg-white">
        <table className="w-full text-sm">
          <thead className="bg-suka-cream text-suka-brown">
            <tr>
              <th className="p-3 text-left">Barang</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-left">Alasan</th>
              <th className="p-3 text-center">Urgensi</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-suka-outline/50">
                <td className="p-3 font-medium">{r.nama_bebas ?? r.bahan_baku_id}</td>
                <td className="p-3 text-right">{r.qty} {r.satuan ?? ''}</td>
                <td className="p-3">{r.alasan ?? '—'}</td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${URG[r.urgensi]}`}>{r.urgensi}</span></td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ST[r.status]}`}>{r.status}</span></td>
                <td className="p-3 text-center">
                  {r.status === 'pending' && (
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => konversi(r)} className="px-3 py-1 rounded bg-suka-orange text-white text-xs font-bold">Jadikan PO</button>
                      <button onClick={() => reject.mutate(r.id)} className="px-3 py-1 rounded border border-suka-outline text-xs">Tolak</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-suka-brown/60">Belum ada permintaan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Tulis halaman Harga (alert + akses riwayat)**

Buat `apps/admin-dashboard/src/app/dashboard/pembelian/harga/page.tsx`:

```tsx
'use client'

import { usePOPriceAlerts } from '@/hooks/usePOPriceAlerts'

export default function HargaPage() {
  const { data: alerts = [], isLoading } = usePOPriceAlerts()

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-suka-brown mb-1">Harga & Bahan Baku</h1>
      <p className="text-sm text-suka-brown/70 mb-4">Bahan yang harganya berubah &gt;5% dari harga master dalam 30 hari terakhir.</p>
      {isLoading ? (
        <div className="text-suka-brown">Memuat…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-suka-outline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-suka-cream text-suka-brown">
              <tr>
                <th className="p-3 text-left">Bahan</th>
                <th className="p-3 text-right">Harga Master</th>
                <th className="p-3 text-right">Harga Terima</th>
                <th className="p-3 text-right">Selisih</th>
                <th className="p-3 text-left">PO</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.bahan_baku_id + a.po_id} className="border-t border-suka-outline/50">
                  <td className="p-3 font-medium">{a.nama}</td>
                  <td className="p-3 text-right">{a.harga_master ?? '—'}</td>
                  <td className="p-3 text-right">{a.harga_terima}</td>
                  <td className={`p-3 text-right font-bold ${a.selisih_pct >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {(a.selisih_pct * 100).toFixed(1)}%
                  </td>
                  <td className="p-3">{a.nomor_po}</td>
                </tr>
              ))}
              {alerts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-suka-brown/60">Tidak ada perubahan harga signifikan.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Build cek dua route muncul**

Run: `cd apps/admin-dashboard && yarn build 2>&1 | grep -E "pembelian/(permintaan|harga)"`
Expected: kedua route muncul.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/pembelian/permintaan/page.tsx apps/admin-dashboard/src/app/dashboard/pembelian/harga/page.tsx
git commit -m "feat(purchase): halaman Permintaan Pembelian + Harga"
```

---

## Task 12: Field termin di Master Supplier

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/pembelian/supplier/page.tsx`
- Modify: `apps/admin-dashboard/src/hooks/usePurchaseOrder.ts` (type `Supplier` + upsert)

**Interfaces:**
- Consumes: type `Supplier` existing (Task melihat `usePurchaseOrder.ts`).
- Produces: `Supplier.termin_hari: number | null`; form supplier punya input "Termin (hari)".

- [ ] **Step 1: Tambah `termin_hari` ke type Supplier**

Di `apps/admin-dashboard/src/hooks/usePurchaseOrder.ts`, pada `export type Supplier`, tambah field setelah `kategori`:
```typescript
  termin_hari: number | null
```

- [ ] **Step 2: Sertakan `termin_hari` di select & upsert supplier**

Cari query supplier di `usePurchaseOrder.ts` (select kolom supplier) dan tambahkan `termin_hari` ke daftar kolom `.select(...)`. Pada mutation create/update supplier, sertakan `termin_hari` di payload.

Contoh (sesuaikan dengan hook existing):
```typescript
// select:
.select('id, nama, kontak, alamat, kategori, catatan, is_active, created_at, bahan_baku_ids, termin_hari')
// payload upsert: { ..., termin_hari: input.termin_hari ?? null }
```

- [ ] **Step 3: Tambah input Termin di form supplier**

Di `apps/admin-dashboard/src/app/dashboard/pembelian/supplier/page.tsx`, tambahkan input pada form (dekat field kategori/kontak):
```tsx
<label className="block">
  <span className="text-sm font-medium text-suka-brown">Termin (hari)</span>
  <input
    type="number" min={0}
    value={form.termin_hari ?? ''}
    onChange={(e) => setForm((f) => ({ ...f, termin_hari: e.target.value === '' ? null : Number(e.target.value) }))}
    className="mt-1 w-full rounded-lg border border-suka-outline px-3 py-2"
    placeholder="mis. 30"
  />
</label>
```
(Sesuaikan nama state `form`/`setForm` dengan yang ada di file.)

- [ ] **Step 4: Type-check + build**

Run: `cd apps/admin-dashboard && yarn type-check && yarn build 2>&1 | tail -5`
Expected: 0 error baru; build sukses.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/pembelian/supplier/page.tsx apps/admin-dashboard/src/hooks/usePurchaseOrder.ts
git commit -m "feat(purchase): field termin_hari di Master Supplier"
```

---

## Task 13: Surface approval PO di `apps/finance`

**Files:**
- Create: `apps/finance/src/hooks/usePoApproval.ts`
- Create: `apps/finance/src/app/po-approval/page.tsx`
- Modify: nav finance (temukan file nav — pola `apps/finance/src/app/*`; tambah link `/po-approval`)

**Interfaces:**
- Consumes: `approve_po_finance(uuid)`, `reject_po_finance(uuid,text)` (Task 3); client `@suka/auth`.
- Produces: antrean "PO menunggu approval" + tombol Approve/Tolak.

- [ ] **Step 1: Tulis hook approval**

Buat `apps/finance/src/hooks/usePoApproval.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

export type PendingPo = {
  id: string
  nomor_po: string
  supplier_nama: string
  tanggal_po: string
  total: number
}

export function usePendingPos() {
  return useQuery<PendingPo[]>({
    queryKey: ['po-pending-approval'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order')
        .select('id, nomor_po, supplier_nama, tanggal_po, purchase_order_item(subtotal)')
        .eq('status', 'menunggu_approval_finance')
        .order('tanggal_po', { ascending: true })
      if (error) throw error
      return (data as any[]).map((p) => ({
        id: p.id, nomor_po: p.nomor_po, supplier_nama: p.supplier_nama, tanggal_po: p.tanggal_po,
        total: (p.purchase_order_item ?? []).reduce((a: number, i: any) => a + Number(i.subtotal ?? 0), 0),
      }))
    },
  })
}

export function useApprovePo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (poId: string) => {
      const { error } = await supabase.rpc('approve_po_finance', { p_po_id: poId })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['po-pending-approval'] }); toast.success('PO disetujui') },
    onError: (e: any) => toast.error(e.message ?? 'Gagal approve'),
  })
}

export function useRejectPo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ poId, alasan }: { poId: string; alasan?: string }) => {
      const { error } = await supabase.rpc('reject_po_finance', { p_po_id: poId, p_alasan: alasan ?? null })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['po-pending-approval'] }); toast.success('PO ditolak (kembali ke draft)') },
    onError: (e: any) => toast.error(e.message ?? 'Gagal menolak'),
  })
}
```

- [ ] **Step 2: Tulis halaman approval**

Buat `apps/finance/src/app/po-approval/page.tsx`:

```tsx
'use client'

import { usePendingPos, useApprovePo, useRejectPo } from '@/hooks/usePoApproval'
import { rupiah, tanggalWaktu } from '@/lib/format'

export default function PoApprovalPage() {
  const { data: pos = [], isLoading } = usePendingPos()
  const approve = useApprovePo()
  const reject = useRejectPo()

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-1">PO Menunggu Approval</h1>
      <p className="text-sm opacity-70 mb-4">Setujui komitmen pembelian sebelum PO dikirim ke vendor.</p>
      {isLoading ? (
        <div>Memuat…</div>
      ) : pos.length === 0 ? (
        <div className="p-6 text-center opacity-60 rounded-xl border">Tidak ada PO menunggu approval.</div>
      ) : (
        <div className="space-y-3">
          {pos.map((p) => (
            <div key={p.id} className="rounded-xl border p-4 flex items-center justify-between">
              <div>
                <div className="font-bold">{p.nomor_po} · {p.supplier_nama}</div>
                <div className="text-sm opacity-70">{tanggalWaktu(p.tanggal_po)} · {rupiah(p.total)}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve.mutate(p.id)} disabled={approve.isPending}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-40">Setujui</button>
                <button onClick={() => reject.mutate({ poId: p.id })} disabled={reject.isPending}
                  className="px-4 py-2 rounded-lg border font-bold">Tolak</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

> **Catatan:** verifikasi `rupiah`/`tanggalWaktu` diekspor dari `apps/finance/src/lib/format` (dipakai di `SupplierView.tsx`). Bila nama beda, sesuaikan import.

- [ ] **Step 3: Tambah entri nav finance**

Temukan komponen nav finance (grep `po_payable\|supplier\|href=` di `apps/finance/src`). Tambah link ke `/po-approval` berlabel "Approval PO" di grup yang sama dengan Supplier.

- [ ] **Step 4: Build finance**

Run: `cd apps/finance && yarn build 2>&1 | grep "po-approval"`
Expected: route `/po-approval` muncul.

- [ ] **Step 5: Commit**

```bash
git add apps/finance/src/hooks/usePoApproval.ts apps/finance/src/app/po-approval/page.tsx
git commit -m "feat(finance): antrean approval PO (approve/tolak komitmen)"
```

---

## Task 14: Verifikasi manual end-to-end + wiring status kirim

**Files:**
- Modify: `apps/admin-dashboard/src/hooks/usePurchaseOrder.ts` — transisi "kirim untuk approval" set status `menunggu_approval_finance` (bukan langsung `dikirim_ke_supplier`).

**Interfaces:**
- Consumes: status enum baru (Task 2).
- Produces: alur PO purchasing → status `menunggu_approval_finance`.

- [ ] **Step 1: Ubah aksi "kirim" purchasing**

Di `usePurchaseOrder.ts`, temukan mutation yang mengubah status draft → `dikirim_ke_supplier` (aksi "Kirim ke Supplier"). Untuk role purchasing, ubah agar men-set `menunggu_approval_finance` dulu. Bila transisi ini dilakukan lewat update kolom `status`:
```typescript
// ganti target status pada aksi "ajukan/kirim":
.update({ status: 'menunggu_approval_finance' })
```
Approval finance (Task 13) yang memindahkan ke `dikirim_ke_supplier`.

> **Catatan:** bila status di-set via RPC `create_purchase_order`/update lain, sesuaikan di sana. Pastikan hanya finance (via `approve_po_finance`) yang bisa mencapai `dikirim_ke_supplier` — RLS UPDATE PO tetap `can_manage_po()`, tapi transisi sah dijaga di RPC approval. (Purchasing tak bisa langsung set `dikirim_ke_supplier` dari UI karena tombol hanya "ajukan approval".)

- [ ] **Step 2: Type-check + build kedua app**

Run:
```bash
cd apps/admin-dashboard && yarn type-check && yarn build 2>&1 | tail -3
cd ../finance && yarn build 2>&1 | tail -3
```
Expected: sukses.

- [ ] **Step 3: Verifikasi manual (checklist — butuh akun uji)**

Buat akun `purchase` (Supabase Studio: outlet_staff role `purchase`, outlet = Kantor Pusat) + pastikan ada akun `admin_finance` & `kitchen`.

- [ ] Login `purchase` → hanya grup "Pembelian" tampil; ketik `/dashboard/owner/profit` → ditolak, redirect ke perlu-dibeli.
- [ ] Perlu Dibeli menampilkan baris; centang → Buat Draft PO → PO tersimpan draft.
- [ ] Ajukan PO → status `menunggu_approval_finance`.
- [ ] Login `admin_finance` (app finance) → PO muncul di Approval PO → Setujui → status `dikirim_ke_supplier`.
- [ ] Login `purchase` → coba panggil `verifikasi_terima_po` (via devtools/network) → **ditolak** `insufficient_privilege`.
- [ ] Login `kitchen` → verifikasi terima → stok bertambah (ledger), `bahan_baku_harga_history` bertambah 1 baris, `purchase_order.jatuh_tempo` terisi = arrival + termin.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/hooks/usePurchaseOrder.ts
git commit -m "feat(purchase): PO purchasing masuk antrean approval finance"
```

---

## Self-Review (checklist penulis)

**Spec coverage:**
- Role purchase + 3 lapis guard → Task 1 (auth), Task 8 (nav+route), Task 3/7 (RLS). ✅
- Approval finance tunggal (owner/admin info only) → Task 3 (`can_approve_po`, `approve_po_finance`), Task 13 (surface). ✅
- Terima stokis commit, purchase ditolak → Task 3 (`can_verify_po_receipt`), Task 4 (predikat), Task 14 (uji). ✅
- Usulan beli otomatis → Task 6 (aritmetika), Task 7 (view), Task 10 (halaman). ✅
- PR manual (kitchen/spv) → Task 2 (tabel+RLS), Task 9/11 (hook+halaman). ✅
- Riwayat harga master → Task 2 (tabel), Task 3 (trigger), Task 11 (akses). ✅
- Termin + jatuh tempo → Task 2 (kolom), Task 3 (compute di trigger), Task 5 (TS), Task 12 (form). ✅
- Purchase read-only status bayar → Task 7 (policy). ✅
- Non-stok → expenses: PR mendukung `nama_bebas`; pemetaan PO non-stok→expenses ada di alur PO existing. **Catatan:** wiring PO non-stok → `expenses` belum jadi task eksplisit — lihat gap di bawah.

**Gap teridentifikasi:**
- **PO non-stok → expenses**: spec §3 menyebut belanja non-stok jadi `expenses`, tapi plan belum punya task yang menautkan item PO non-stok ke tabel `expenses`. **Keputusan:** untuk Spec 1, PR/`nama_bebas` menampung barang non-stok; konversi ke `expenses` bergantung mekanik expenses existing (form input pengeluaran). Bila diperlukan otomatis, tambahkan task lanjutan — untuk sekarang cukup PR mencatatnya dan purchasing input manual ke expenses. Dicatat sebagai keterbatasan diketahui.

**Placeholder scan:** blok D & F Task 3 sengaja "tempel ulang definisi" karena bergantung ground-truth versi fungsi live — instruksi eksplisit + alasan disertakan, bukan placeholder kosong.

**Type consistency:** `SuggestionRow`/`SuggestionComputed` konsisten Task 6↔9↔10; `computeDueDate` Task 5 dipakai konsisten; nama RPC `approve_po_finance`/`reject_po_finance` sama di Task 3↔13; `can_verify_po_receipt` sama di Task 3↔4(predikat mirror).

---

**Keterbatasan diketahui (untuk hand-off):**
1. PO non-stok → expenses masih manual (lihat gap).
2. Verifikasi manual (Task 14) butuh akun uji nyata — belum ada e2e otomatis (sesuai kebijakan proyek).
3. `purchase_suggestion_spv` nama kolom sumber wajib disesuaikan ground-truth (Task 7 Step 1).
4. Prefill form `/dashboard/pembelian/new` dari sessionStorage (Task 10) mungkin perlu penyesuaian form existing.
