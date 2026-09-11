# Saldo per Vendor Gudang Pusat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gudang Pusat mencatat sisa per vendor untuk bahan multi-vendor; kitchen wajib memilih vendor (boleh pecah) saat menyetujui permintaan / membuat surat jalan; pengiriman diblokir bila sisa vendor kurang.

**Architecture:** Buku mutasi terpisah `stok_vendor_gudang_mutasi` ditulis oleh trigger (PO masuk, SJ dikirim, opname gudang final) dan RPC koreksi; `ledger_stok` tidak diubah strukturnya (hanya satu trigger AFTER INSERT baru). Surat jalan menyimpan `vendor_id` per baris; harga snapshot mengikuti katalog vendor. UI memakai satu fungsi murni `alokasiVendor.ts` (salinan identik di app stok & distribusi).

**Tech Stack:** Supabase Postgres (PL/pgSQL, RLS), Next.js app router (apps/stok, apps/distribusi), TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-11-saldo-vendor-gudang-design.md`

## Global Constraints

- Gudang Pusat = `d23e11b3-23f1-4f9a-b428-cc73e1aa9b90` (`GUDANG PUSAT (HQ)`).
- Kunci vendor = vendor induk = `COALESCE(supplier.vendor_induk_id, supplier.id)`.
- Bahan multi-vendor = bahan dengan ≥2 vendor induk berbeda di `bahan_baku_supplier` (`is_active`) ∧ `supplier.is_active`.
- `stok_vendor_gudang_mutasi.qty` = skala stok Gudang Pusat: `to_ledger_scale('d23e11b3-…', bahan, qty_besar)`. Semua qty di UI/RPC = satuan besar kecuali disebut lain.
- Sumber mutasi: `po`, `sj_kirim`, `hitung_fisik`, `koreksi`. (`sj_batal` DIBUANG — SJ hanya bisa dibatalkan saat draft, via `batalkan_surat_jalan_draft`; nol SJ terkirim pernah dibatalkan.)
- Penjaga sisa hanya untuk bahan multi-vendor yang **aktif** (= punya ≥1 mutasi `hitung_fisik`). Draft tidak memesan sisa.
- Setiap migration: `SET lock_timeout = '5s';`, idempoten, fungsi `SECURITY DEFINER SET search_path = public`, `REVOKE ... FROM PUBLIC, anon`. Cek timestamp unik: `ls supabase/migrations | cut -c1-14 | sort | uniq -d`.
- DB produksi bersama: implementer TIDAK apply; controller apply per migration dengan `supabase db query --linked -f <file>` + ulang bila deadlock, lalu stempel `supabase_migrations.schema_migrations`.
- Uji SQL: `BEGIN … ROLLBACK`, lapor `RAISE EXCEPTION 'HASIL …'`, sebagai user asli (`set_config('request.jwt.claims', …)` + `SET LOCAL ROLE authenticated`), kontrol negatif per blok, fixture via SELECT.
- Commit: cek `git branch --show-current` dulu; akhiri pesan dengan `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Jangan push.
- Vitest: `./node_modules/.bin/vitest run` (npx rusak). Type-check `yarn type-check` harus 0 error.

## File Structure

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20260911150000_saldo_vendor_skema.sql` | Kolom `vendor_induk_id`, tabel mutasi, helper, view, RPC `saldo_vendor_gudang`, RPC koreksi, bersih-bersih data |
| `supabase/migrations/20260911151000_saldo_vendor_po.sql` | Trigger AFTER INSERT `ledger_stok` → mutasi `po` |
| `supabase/migrations/20260911152000_saldo_vendor_surat_jalan.sql` | `surat_jalan_item.vendor_id` + unique baru, isi vendor & harga, `create_surat_jalan`, `approve_permintaan_svc`, penjaga + mutasi `sj_kirim` |
| `supabase/migrations/20260911153000_saldo_vendor_opname.sql` | Tabel `opname_item_vendor`, RPC `simpan_hitung_vendor`, trigger final → `hitung_fisik` |
| `supabase/verifikasi/saldo_vendor/t1…t4_*.sql` | Uji SQL per migration |
| `apps/stok/src/lib/stok/alokasiVendor.ts` (+test) | Fungsi murni alokasi & validasi |
| `apps/distribusi/src/lib/alokasiVendor.ts` (+test) | Salinan identik |
| `apps/stok/src/app/actions/permintaan.ts` | `fetchSaldoVendorGudang`, tipe `ApproveItemInput.alokasi` |
| `apps/stok/src/components/permintaan/PilihVendorBahan.tsx` | Pemilih vendor per bahan |
| `apps/stok/src/components/permintaan/ApprovalModal.tsx` | Integrasi pemilih |
| `apps/distribusi/src/components/distribusi/SuratJalanForm.tsx` | Pemilih vendor + INSERT `vendor_id` |
| `apps/stok/src/components/stok/OpnameForm.tsx` | Sub-baris per vendor (gudang) |
| `supabase/verifikasi/saldo_vendor/pemantau.sql`, `CLAUDE.md` | Pemantau & catatan sesi |

---

### Task 1: Skema buku vendor, helper, RPC saldo & koreksi, bersih-bersih data

**Files:**
- Create: `supabase/migrations/20260911150000_saldo_vendor_skema.sql`
- Test: `supabase/verifikasi/saldo_vendor/t1_skema.sql`

**Interfaces:**
- Produces: `public.vendor_induk(uuid) → uuid`; `public.vendor_bahan(uuid) → SETOF uuid`; `public.bahan_multi_vendor(uuid) → boolean`; `public.bahan_vendor_aktif(uuid) → boolean`; `public.sisa_vendor_gudang(p_bahan uuid, p_vendor uuid) → numeric` (skala gudang); tabel `stok_vendor_gudang_mutasi`; RPC `saldo_vendor_gudang(p_bahan_ids uuid[])` → `TABLE(bahan_baku_id uuid, vendor_id uuid, vendor_nama text, sisa numeric /*satuan besar*/, multi boolean, aktif boolean)`; RPC `koreksi_saldo_vendor(p_bahan uuid, p_vendor uuid, p_qty_besar numeric, p_catatan text) → uuid`; konstanta gudang di fungsi `public.gudang_pusat_id() → uuid`.
- Deviasi sadar dari spec §4.1.3: *view* `stok_vendor_gudang` diganti RPC `saldo_vendor_gudang` — harus bisa dipanggil server action lewat service role (auth.uid() NULL) sekaligus menolak crew; view `security_invoker` tidak bisa keduanya.

- [ ] **Step 1: Tulis uji t1 (akan gagal karena objek belum ada)**

```sql
-- supabase/verifikasi/saldo_vendor/t1_skema.sql
-- Harapan: "HASIL T1: LULUS ..."
BEGIN;
DO $$
DECLARE v_kitchen uuid; v_crew uuid; v_sapi uuid; v_ayam uuid; v_dj uuid; v_aziz10 uuid; v_aziz15 uuid;
        v_n int; v_ok boolean; r record;
BEGIN
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen' AND status='active' LIMIT 1;
  SELECT id INTO v_crew    FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1;
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_ayam FROM bahan_baku WHERE nama='AYAM';
  SELECT id INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_aziz10 FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT id INTO v_aziz15 FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 15';
  IF v_kitchen IS NULL OR v_crew IS NULL OR v_sapi IS NULL OR v_dj IS NULL OR v_aziz10 IS NULL THEN
    RAISE EXCEPTION 'GAGAL: fixture tak ketemu'; END IF;

  -- (a) grup Pak Aziz
  IF public.vendor_induk(v_aziz15) <> v_aziz10 THEN RAISE EXCEPTION 'GAGAL (a): Tempo 15 bukan anak Tempo 10'; END IF;
  -- (b) SAPI multi-vendor = Djafafood + Pak Aziz (tepat 2 induk)
  SELECT count(*) INTO v_n FROM public.vendor_bahan(v_sapi);
  IF v_n <> 2 OR NOT public.bahan_multi_vendor(v_sapi) THEN RAISE EXCEPTION 'GAGAL (b): SAPI vendor induk = %', v_n; END IF;
  -- (c) AYAM tak lagi multi (Dunia Plastik dinonaktifkan)
  IF public.bahan_multi_vendor(v_ayam) THEN RAISE EXCEPTION 'GAGAL (c): AYAM masih multi-vendor'; END IF;
  -- (d) belum aktif sebelum hitung fisik
  IF public.bahan_vendor_aktif(v_sapi) THEN RAISE EXCEPTION 'GAGAL (d): SAPI sudah aktif tanpa hitung fisik'; END IF;

  -- (e) kitchen: RPC saldo memuat 2 baris SAPI, sisa 0, multi=true
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_n FROM public.saldo_vendor_gudang(ARRAY[v_sapi]) s WHERE s.multi AND s.sisa = 0 AND NOT s.aktif;
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (e): saldo SAPI baris=%', v_n; END IF;
  -- (f) koreksi +5 Blok Djafafood → sisa 5
  PERFORM public.koreksi_saldo_vendor(v_sapi, v_dj, 5, 'uji');
  SELECT sisa INTO r FROM public.saldo_vendor_gudang(ARRAY[v_sapi]) s WHERE s.vendor_id = v_dj;
  IF r.sisa <> 5 THEN RAISE EXCEPTION 'GAGAL (f): sisa % bukan 5', r.sisa; END IF;
  -- (g) koreksi tanpa catatan ditolak
  v_ok := false;
  BEGIN PERFORM public.koreksi_saldo_vendor(v_sapi, v_dj, 1, ' '); EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): koreksi tanpa catatan lolos'; END IF;
  -- (h) tulis langsung ditolak
  v_ok := false;
  BEGIN INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber) VALUES (v_sapi, v_dj, 1, 'koreksi');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (h): INSERT langsung lolos'; END IF;
  EXECUTE 'RESET ROLE';

  -- (i) crew ditolak RPC saldo
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_ok := false;
  BEGIN PERFORM public.saldo_vendor_gudang(ARRAY[v_sapi]); EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): crew bisa baca saldo vendor'; END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'HASIL T1: LULUS (grup Aziz, SAPI multi, AYAM tunggal, belum aktif, saldo, koreksi, tulis langsung & crew ditolak)';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Tulis migration**

```sql
-- supabase/migrations/20260911150000_saldo_vendor_skema.sql
-- Saldo per vendor Gudang Pusat — skema. Spec: docs/superpowers/specs/2026-09-11-saldo-vendor-gudang-design.md
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.gudang_pusat_id() RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid $$;

ALTER TABLE public.supplier ADD COLUMN IF NOT EXISTS vendor_induk_id uuid REFERENCES public.supplier(id);

CREATE OR REPLACE FUNCTION public.vendor_induk(p_supplier uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(s.vendor_induk_id, s.id) FROM public.supplier s WHERE s.id = p_supplier
$$;

CREATE OR REPLACE FUNCTION public.vendor_bahan(p_bahan uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT COALESCE(s.vendor_induk_id, s.id)
    FROM public.bahan_baku_supplier bs JOIN public.supplier s ON s.id = bs.supplier_id
   WHERE bs.bahan_baku_id = p_bahan AND bs.is_active AND COALESCE(s.is_active, true)
$$;

CREATE OR REPLACE FUNCTION public.bahan_multi_vendor(p_bahan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.vendor_bahan(p_bahan)) >= 2
$$;

CREATE TABLE IF NOT EXISTS public.stok_vendor_gudang_mutasi (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id            uuid NOT NULL REFERENCES public.bahan_baku(id),
  vendor_id                uuid NOT NULL REFERENCES public.supplier(id),
  qty                      numeric NOT NULL,           -- skala stok Gudang Pusat, bertanda
  sumber                   text NOT NULL CHECK (sumber IN ('po','sj_kirim','hitung_fisik','koreksi')),
  ref_ledger_id            uuid,
  ref_surat_jalan_item_id  uuid REFERENCES public.surat_jalan_item(id),
  ref_opname_id            uuid REFERENCES public.opname(id),
  catatan                  text,
  dibuat_oleh              uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (sumber <> 'koreksi' OR length(btrim(coalesce(catatan,''))) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS svgm_po_unik ON public.stok_vendor_gudang_mutasi (ref_ledger_id) WHERE sumber = 'po';
CREATE UNIQUE INDEX IF NOT EXISTS svgm_sj_unik ON public.stok_vendor_gudang_mutasi (ref_surat_jalan_item_id) WHERE sumber = 'sj_kirim';
CREATE UNIQUE INDEX IF NOT EXISTS svgm_opname_unik ON public.stok_vendor_gudang_mutasi (ref_opname_id, bahan_baku_id, vendor_id) WHERE sumber = 'hitung_fisik';
CREATE INDEX IF NOT EXISTS svgm_bahan_vendor ON public.stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id);

ALTER TABLE public.stok_vendor_gudang_mutasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS svgm_select ON public.stok_vendor_gudang_mutasi;
CREATE POLICY svgm_select ON public.stok_vendor_gudang_mutasi FOR SELECT TO authenticated
  USING (public.peran_saya() IN ('kitchen','purchasing','admin','owner','spv','regional_manager','admin_finance'));
REVOKE ALL ON public.stok_vendor_gudang_mutasi FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stok_vendor_gudang_mutasi TO authenticated;

CREATE OR REPLACE FUNCTION public.bahan_vendor_aktif(p_bahan uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stok_vendor_gudang_mutasi m WHERE m.bahan_baku_id = p_bahan AND m.sumber = 'hitung_fisik')
$$;

CREATE OR REPLACE FUNCTION public.sisa_vendor_gudang(p_bahan uuid, p_vendor uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(m.qty), 0) FROM public.stok_vendor_gudang_mutasi m
   WHERE m.bahan_baku_id = p_bahan AND m.vendor_id = p_vendor
$$;

-- Nama tampil: buang akhiran " - Tempo N" (grup Pak Aziz).
CREATE OR REPLACE FUNCTION public.saldo_vendor_gudang(p_bahan_ids uuid[])
RETURNS TABLE(bahan_baku_id uuid, vendor_id uuid, vendor_nama text, sisa numeric, multi boolean, aktif boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role','') <> 'service_role' AND current_user NOT IN ('postgres','service_role')
     AND COALESCE(public.peran_saya(),'') NOT IN ('kitchen','purchasing','admin','owner','spv','regional_manager','admin_finance') THEN
    RAISE EXCEPTION 'Tidak berhak melihat saldo vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT b.id, v.vid, regexp_replace(s.nama, '\s*-\s*Tempo\s*\d+\s*$', '', 'i'),
           public.sisa_vendor_gudang(b.id, v.vid) / NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), b.id, 1), 0),
           public.bahan_multi_vendor(b.id), public.bahan_vendor_aktif(b.id)
      FROM unnest(p_bahan_ids) AS b(id)
      CROSS JOIN LATERAL public.vendor_bahan(b.id) AS v(vid)
      JOIN public.supplier s ON s.id = v.vid
     ORDER BY b.id, s.nama;
END $$;

CREATE OR REPLACE FUNCTION public.koreksi_saldo_vendor(p_bahan uuid, p_vendor uuid, p_qty_besar numeric, p_catatan text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF COALESCE(public.peran_saya(),'') NOT IN ('kitchen','admin','owner') THEN
    RAISE EXCEPTION 'Hanya kitchen/admin/owner yang boleh mengoreksi saldo vendor' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_catatan IS NULL OR btrim(p_catatan) = '' THEN
    RAISE EXCEPTION 'Catatan koreksi wajib' USING ERRCODE = 'check_violation';
  END IF;
  IF p_qty_besar IS NULL OR p_qty_besar = 0 THEN
    RAISE EXCEPTION 'Qty koreksi tidak boleh 0' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_bahan(p_bahan) v WHERE v = p_vendor) THEN
    RAISE EXCEPTION 'Vendor bukan vendor aktif bahan ini' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, catatan, dibuat_oleh)
  VALUES (p_bahan, p_vendor, public.to_ledger_scale(public.gudang_pusat_id(), p_bahan, p_qty_besar), 'koreksi', btrim(p_catatan), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.vendor_induk(uuid), public.vendor_bahan(uuid), public.bahan_multi_vendor(uuid),
  public.bahan_vendor_aktif(uuid), public.sisa_vendor_gudang(uuid,uuid), public.saldo_vendor_gudang(uuid[]),
  public.koreksi_saldo_vendor(uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_vendor_gudang(uuid[]), public.koreksi_saldo_vendor(uuid,uuid,numeric,text)
  TO authenticated, service_role;

-- Bersih-bersih data (keputusan owner K4, K7).
UPDATE public.supplier c SET vendor_induk_id = p.id
  FROM public.supplier p
 WHERE p.nama = 'Lettuce (Pak Aziz) - Tempo 10'
   AND c.nama IN ('Lettuce (Pak Aziz) - Tempo 15', 'Lettuce (Pak Aziz) - Tempo 30')
   AND c.vendor_induk_id IS DISTINCT FROM p.id;

UPDATE public.bahan_baku_supplier bs SET is_active = false
  FROM public.bahan_baku b, public.supplier s
 WHERE bs.bahan_baku_id = b.id AND bs.supplier_id = s.id
   AND b.nama = 'AYAM' AND s.nama = 'Dunia Plastik Depok' AND bs.is_active;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.supplier WHERE vendor_induk_id IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'Grup Pak Aziz tidak terbentuk tepat 2 anak';
  END IF;
END $$;
```

- [ ] **Step 3: Commit** (controller menerapkan + menjalankan t1; harapan `HASIL T1: LULUS`; kontrol negatif: salin t1, ubah (f) `<> 5` → `<> 6`, harus `GAGAL (f)`)

```bash
git add supabase/migrations/20260911150000_saldo_vendor_skema.sql supabase/verifikasi/saldo_vendor/t1_skema.sql
git commit -m "feat(db): buku saldo per vendor Gudang Pusat — skema, helper, RPC saldo & koreksi"
```

---

### Task 2: Mutasi `po` dari penerimaan PO di Gudang Pusat

**Files:**
- Create: `supabase/migrations/20260911151000_saldo_vendor_po.sql`
- Test: `supabase/verifikasi/saldo_vendor/t2_po.sql`

**Interfaces:**
- Consumes: `vendor_induk`, `bahan_multi_vendor`, `gudang_pusat_id`, tabel mutasi (Task 1).
- Produces: trigger `trg_stok_vendor_dari_po` AFTER INSERT ON `ledger_stok`.

- [ ] **Step 1: Tulis uji t2**

```sql
-- supabase/verifikasi/saldo_vendor/t2_po.sql — harapan "HASIL T2: LULUS"
BEGIN;
DO $$
DECLARE v_sapi uuid; v_ayam uuid; v_dj uuid; v_po uuid; v_ledger uuid; v_n int; v_qty numeric;
BEGIN
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_ayam FROM bahan_baku WHERE nama='AYAM';
  SELECT id INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_po FROM purchase_order WHERE supplier_id = v_dj ORDER BY created_at DESC LIMIT 1;
  IF v_po IS NULL THEN RAISE EXCEPTION 'GAGAL: tak ada PO Djafafood untuk fixture'; END IF;

  -- (a) pembelian_supplier SAPI ber-PO di gudang → 1 mutasi po, qty sama, vendor Djafafood
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_po_id, catatan)
  VALUES (public.gudang_pusat_id(), v_sapi, 'pembelian_supplier', 4000, v_po, 'UJI t2') RETURNING id INTO v_ledger;
  SELECT count(*), max(qty) INTO v_n, v_qty FROM stok_vendor_gudang_mutasi
   WHERE ref_ledger_id = v_ledger AND sumber='po' AND vendor_id = public.vendor_induk(v_dj);
  IF v_n <> 1 OR v_qty <> 4000 THEN RAISE EXCEPTION 'GAGAL (a): n=% qty=%', v_n, v_qty; END IF;

  -- (b) bahan satu-vendor → nol mutasi
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_po_id, catatan)
  VALUES (public.gudang_pusat_id(), v_ayam, 'pembelian_supplier', 1000, v_po, 'UJI t2') RETURNING id INTO v_ledger;
  IF EXISTS (SELECT 1 FROM stok_vendor_gudang_mutasi WHERE ref_ledger_id = v_ledger) THEN RAISE EXCEPTION 'GAGAL (b): AYAM dapat mutasi'; END IF;

  -- (c) outlet lain / tanpa PO → nol mutasi
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
  VALUES (public.gudang_pusat_id(), v_sapi, 'adjustment', 100, 'UJI t2') RETURNING id INTO v_ledger;
  IF EXISTS (SELECT 1 FROM stok_vendor_gudang_mutasi WHERE ref_ledger_id = v_ledger) THEN RAISE EXCEPTION 'GAGAL (c): adjustment dapat mutasi'; END IF;

  RAISE EXCEPTION 'HASIL T2: LULUS (PO multi-vendor tercatat sekali, satu-vendor & adjustment diabaikan)';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Tulis migration** (trigger di tabel panas — controller menerapkan terpisah, ulang bila deadlock)

```sql
-- supabase/migrations/20260911151000_saldo_vendor_po.sql
-- ledger_stok ada di publication realtime: DDL di sini pernah deadlock (2026-09-11).
-- Satu CREATE TRIGGER saja; bila gagal lock, ulangi.
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.stok_vendor_dari_po() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vendor uuid;
BEGIN
  IF NOT public.bahan_multi_vendor(NEW.bahan_baku_id) THEN RETURN NULL; END IF;
  SELECT public.vendor_induk(po.supplier_id) INTO v_vendor FROM public.purchase_order po WHERE po.id = NEW.ref_po_id;
  IF v_vendor IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_ledger_id, catatan, dibuat_oleh)
  VALUES (NEW.bahan_baku_id, v_vendor, NEW.qty, 'po', NEW.id, 'Terima PO', NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.stok_vendor_dari_po() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stok_vendor_dari_po ON public.ledger_stok;
CREATE TRIGGER trg_stok_vendor_dari_po
  AFTER INSERT ON public.ledger_stok
  FOR EACH ROW
  WHEN (NEW.tipe = 'pembelian_supplier' AND NEW.ref_po_id IS NOT NULL
        AND NEW.outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid)
  EXECUTE FUNCTION public.stok_vendor_dari_po();
```

- [ ] **Step 3: Commit** (kontrol negatif controller: salin t2, ubah (a) `v_qty <> 4000` → `<> 4001`, harus GAGAL (a))

```bash
git add supabase/migrations/20260911151000_saldo_vendor_po.sql supabase/verifikasi/saldo_vendor/t2_po.sql
git commit -m "feat(db): mutasi saldo vendor dari penerimaan PO Gudang Pusat"
```

---

### Task 3: Surat jalan ber-vendor — kolom, isi otomatis, harga vendor, approval, penjaga kirim

**Files:**
- Create: `supabase/migrations/20260911152000_saldo_vendor_surat_jalan.sql`
- Test: `supabase/verifikasi/saldo_vendor/t3_surat_jalan.sql`

**Interfaces:**
- Consumes: Task 1 helper.
- Produces: `surat_jalan_item.vendor_id uuid`; `create_surat_jalan(p_outlet_id uuid, p_items jsonb)` — tiap item `{bahan_baku_id, qty_dikirim, vendor_id?}`; `approve_permintaan_svc(p_permintaan_id uuid, p_items jsonb)` — tiap item `{bahan_baku_id, qty_disetujui, alokasi?: [{vendor_id, qty}]}` (qty satuan besar); trigger penjaga `trg_sj_vendor_dikirim`.

- [ ] **Step 1: Tulis uji t3**

```sql
-- supabase/verifikasi/saldo_vendor/t3_surat_jalan.sql — harapan "HASIL T3: LULUS"
BEGIN;
DO $$
DECLARE v_sapi uuid; v_ayam uuid; v_dj uuid; v_az uuid; v_outlet uuid; v_sj surat_jalan; v_ok boolean;
        v_n int; v_harga_dj numeric; v_sisa numeric;
BEGIN
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_ayam FROM bahan_baku WHERE nama='AYAM';
  SELECT public.vendor_induk(id) INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_az FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  SELECT id INTO v_outlet FROM outlets WHERE type='test' LIMIT 1;
  -- titik awal: aktifkan SAPI (Djafafood 3 Blok, Pak Aziz 4 Blok) lewat mutasi langsung sebagai postgres
  INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, catatan) VALUES
    (v_sapi, v_dj, public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 3), 'hitung_fisik', 'UJI'),
    (v_sapi, v_az, public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 4), 'hitung_fisik', 'UJI');

  -- (a) create_surat_jalan (service) pecah 3+2 + AYAM tanpa vendor (terisi otomatis)
  PERFORM set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  v_sj := public.create_surat_jalan(v_outlet, jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 3, 'vendor_id', v_dj),
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 2, 'vendor_id', v_az),
    jsonb_build_object('bahan_baku_id', v_ayam, 'qty_dikirim', 1)));
  SELECT count(*) INTO v_n FROM surat_jalan_item WHERE surat_jalan_id = v_sj.id;
  IF v_n <> 3 THEN RAISE EXCEPTION 'GAGAL (a): baris %', v_n; END IF;
  IF EXISTS (SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id=v_sj.id AND bahan_baku_id=v_ayam AND vendor_id IS NULL) THEN
    RAISE EXCEPTION 'GAGAL (a): vendor AYAM tak terisi otomatis'; END IF;

  -- (b) harga baris Djafafood = katalog Djafafood bila > 0
  SELECT max(bs.harga) INTO v_harga_dj FROM bahan_baku_supplier bs JOIN supplier s ON s.id=bs.supplier_id
   WHERE bs.bahan_baku_id=v_sapi AND bs.is_active AND COALESCE(s.vendor_induk_id,s.id)=v_dj AND bs.harga > 0;
  IF v_harga_dj IS NOT NULL AND NOT EXISTS (SELECT 1 FROM surat_jalan_item WHERE surat_jalan_id=v_sj.id AND vendor_id=v_dj AND harga_snapshot=v_harga_dj) THEN
    RAISE EXCEPTION 'GAGAL (b): harga snapshot bukan harga katalog Djafafood'; END IF;

  -- (c) kirim → 2 mutasi sj_kirim, sisa Djafafood 0, Pak Aziz 2
  UPDATE surat_jalan SET status='dikirim' WHERE id = v_sj.id;
  SELECT count(*) INTO v_n FROM stok_vendor_gudang_mutasi m JOIN surat_jalan_item i ON i.id=m.ref_surat_jalan_item_id
   WHERE i.surat_jalan_id = v_sj.id AND m.sumber='sj_kirim';
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (c): mutasi sj_kirim %', v_n; END IF;
  v_sisa := public.sisa_vendor_gudang(v_sapi, v_az) / public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1);
  IF v_sisa <> 2 THEN RAISE EXCEPTION 'GAGAL (c): sisa Pak Aziz % bukan 2', v_sisa; END IF;

  -- (d) SJ baru minta 1 Djafafood (sisa 0) → kirim DITOLAK
  v_sj := public.create_surat_jalan(v_outlet, jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 1, 'vendor_id', v_dj)));
  v_ok := false;
  BEGIN UPDATE surat_jalan SET status='dikirim' WHERE id = v_sj.id;
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): kirim melebihi sisa lolos'; END IF;

  -- (e) SAPI tanpa vendor → kirim DITOLAK
  v_sj := public.create_surat_jalan(v_outlet, jsonb_build_array(
    jsonb_build_object('bahan_baku_id', v_sapi, 'qty_dikirim', 1)));
  v_ok := false;
  BEGIN UPDATE surat_jalan SET status='dikirim' WHERE id = v_sj.id;
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): bahan multi-vendor tanpa vendor lolos'; END IF;

  -- (f) approve_permintaan_svc: alokasi total tak pas → ditolak
  -- (dijalankan hanya bila ada permintaan menunggu fixture; dibuat di sini)
  DECLARE v_p uuid; BEGIN
    INSERT INTO permintaan_bahan (outlet_id, status) VALUES (v_outlet, 'menunggu') RETURNING id INTO v_p;
    v_ok := false;
    BEGIN PERFORM public.approve_permintaan_svc(v_p, jsonb_build_array(jsonb_build_object(
      'bahan_baku_id', v_sapi, 'qty_disetujui', 2,
      'alokasi', jsonb_build_array(jsonb_build_object('vendor_id', v_az, 'qty', 1)))));
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): alokasi tak pas lolos'; END IF;
    -- (g) alokasi pas → SJ 1 baris Pak Aziz 2
    PERFORM public.approve_permintaan_svc(v_p, jsonb_build_array(jsonb_build_object(
      'bahan_baku_id', v_sapi, 'qty_disetujui', 2,
      'alokasi', jsonb_build_array(jsonb_build_object('vendor_id', v_az, 'qty', 2)))));
    PERFORM 1 FROM permintaan_bahan p JOIN surat_jalan_item i ON i.surat_jalan_id = p.surat_jalan_id
     WHERE p.id = v_p AND i.vendor_id = v_az AND i.qty_dikirim = 2;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAGAL (g): SJ dari approval tak ber-vendor'; END IF;
  END;

  RAISE EXCEPTION 'HASIL T3: LULUS (pecah 3+2, vendor otomatis, harga vendor, sj_kirim, blokir sisa & tanpa vendor, approval alokasi)';
END $$;
ROLLBACK;
```

> Catatan implementer: sebelum menulis (f)/(g), cek kolom wajib `permintaan_bahan` di DB (`information_schema.columns`, read-only) dan lengkapi INSERT fixture bila ada kolom NOT NULL lain.

- [ ] **Step 2: Tulis migration**

```sql
-- supabase/migrations/20260911152000_saldo_vendor_surat_jalan.sql
SET lock_timeout = '5s';

ALTER TABLE public.surat_jalan_item ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.supplier(id);
ALTER TABLE public.surat_jalan_item DROP CONSTRAINT IF EXISTS surat_jalan_item_surat_jalan_id_bahan_baku_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS surat_jalan_item_sj_bahan_vendor_key
  ON public.surat_jalan_item (surat_jalan_id, bahan_baku_id, vendor_id) NULLS NOT DISTINCT;

-- Satu fungsi untuk vendor & harga: trigger berjalan urut abjad, jadi dua trigger
-- terpisah akan mengisi harga SEBELUM vendor terisi.
CREATE OR REPLACE FUNCTION public.fill_harga_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_satu uuid; v_n int;
BEGIN
  IF NEW.vendor_id IS NULL THEN
    SELECT count(*), min(v::text)::uuid INTO v_n, v_satu FROM public.vendor_bahan(NEW.bahan_baku_id) v;
    IF v_n = 1 THEN NEW.vendor_id := v_satu; END IF;
  ELSE
    NEW.vendor_id := public.vendor_induk(NEW.vendor_id);
  END IF;

  IF COALESCE(NEW.harga_snapshot, 0) = 0 AND NEW.vendor_id IS NOT NULL THEN
    SELECT bs.harga INTO NEW.harga_snapshot
      FROM public.bahan_baku_supplier bs JOIN public.supplier s ON s.id = bs.supplier_id
     WHERE bs.bahan_baku_id = NEW.bahan_baku_id AND bs.is_active AND bs.harga > 0
       AND COALESCE(s.vendor_induk_id, s.id) = NEW.vendor_id
     ORDER BY bs.harga_updated_at DESC NULLS LAST, bs.id
     LIMIT 1;
  END IF;
  IF COALESCE(NEW.harga_snapshot, 0) = 0 THEN
    SELECT COALESCE(harga_beli, 0) INTO NEW.harga_snapshot FROM public.bahan_baku_harga WHERE bahan_baku_id = NEW.bahan_baku_id;
  END IF;
  NEW.harga_snapshot := COALESCE(NEW.harga_snapshot, 0);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_surat_jalan(p_outlet_id uuid, p_items jsonb)
RETURNS surat_jalan LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sj surat_jalan; v_item jsonb;
BEGIN
  IF auth.role() != 'service_role' AND NOT EXISTS (
    SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen','admin','owner','purchasing')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen), purchasing, atau admin/owner yang boleh menerbitkan surat jalan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;
  INSERT INTO surat_jalan (outlet_id, created_by) VALUES (p_outlet_id, auth.uid()) RETURNING * INTO v_sj;
  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim, vendor_id)
    VALUES (v_sj.id, (v_item->>'bahan_baku_id')::uuid, (v_item->>'qty_dikirim')::numeric,
            NULLIF(v_item->>'vendor_id','')::uuid);
  END LOOP;
  RETURN v_sj;
END $$;

CREATE OR REPLACE FUNCTION public.approve_permintaan_svc(p_permintaan_id uuid, p_items jsonb)
RETURNS permintaan_bahan LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p permintaan_bahan; v_item jsonb; v_a jsonb; v_sj surat_jalan; v_sj_items jsonb := '[]'::jsonb;
  v_bahan uuid; v_qty numeric; v_harga numeric; v_total numeric; v_nama text;
BEGIN
  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id; END IF;
  IF v_p.status != 'menunggu' THEN RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status; END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    v_bahan := (v_item->>'bahan_baku_id')::uuid;
    v_qty   := (v_item->>'qty_disetujui')::numeric;
    v_harga := COALESCE((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan), 0);

    UPDATE permintaan_bahan_item SET qty_disetujui = v_qty, harga_snapshot = v_harga
     WHERE permintaan_id = p_permintaan_id AND bahan_baku_id = v_bahan;
    IF NOT FOUND THEN
      INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta, qty_disetujui, harga_snapshot)
      VALUES (p_permintaan_id, v_bahan, v_qty, v_qty, v_harga);
    END IF;

    IF v_qty > 0 THEN
      IF jsonb_typeof(v_item->'alokasi') = 'array' AND jsonb_array_length(v_item->'alokasi') > 0 THEN
        SELECT COALESCE(sum((a->>'qty')::numeric), 0) INTO v_total FROM jsonb_array_elements(v_item->'alokasi') a;
        IF abs(v_total - v_qty) > 0.000001 THEN
          SELECT nama INTO v_nama FROM bahan_baku WHERE id = v_bahan;
          RAISE EXCEPTION 'Pembagian vendor % (%) tidak sama dengan jumlah disetujui (%)', v_nama, v_total, v_qty
            USING ERRCODE = 'check_violation';
        END IF;
        FOR v_a IN SELECT jsonb_array_elements(v_item->'alokasi') LOOP
          IF (v_a->>'qty')::numeric > 0 THEN
            v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan,
              'qty_dikirim', (v_a->>'qty')::numeric, 'vendor_id', v_a->>'vendor_id');
          END IF;
        END LOOP;
      ELSE
        IF public.bahan_multi_vendor(v_bahan) THEN
          SELECT nama INTO v_nama FROM bahan_baku WHERE id = v_bahan;
          RAISE EXCEPTION 'Pilih vendor untuk %', v_nama USING ERRCODE = 'check_violation';
        END IF;
        v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan, 'qty_dikirim', v_qty);
      END IF;
    END IF;
  END LOOP;

  UPDATE permintaan_bahan_item SET qty_disetujui = 0 WHERE permintaan_id = p_permintaan_id AND qty_disetujui IS NULL;
  IF jsonb_array_length(v_sj_items) = 0 THEN
    RAISE EXCEPTION 'tidak ada item disetujui (qty > 0); gunakan tolak_permintaan_svc';
  END IF;
  v_sj := create_surat_jalan(v_p.outlet_id, v_sj_items);
  UPDATE permintaan_bahan SET status = 'disetujui', surat_jalan_id = v_sj.id, updated_at = NOW()
   WHERE id = p_permintaan_id RETURNING * INTO v_p;
  RETURN v_p;
END $$;

-- Penjaga + mutasi sj_kirim saat → dikirim. RAISE membatalkan seluruh UPDATE,
-- termasuk debit gudang oleh sj_on_dikirim_kurangi_kitchen.
CREATE OR REPLACE FUNCTION public.sj_vendor_on_dikirim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_butuh numeric; v_sisa numeric; v_f numeric;
BEGIN
  IF NOT (OLD.status <> 'dikirim' AND NEW.status = 'dikirim') THEN RETURN NEW; END IF;
  FOR r IN
    SELECT i.id, i.bahan_baku_id, i.qty_dikirim, i.vendor_id, b.nama AS bahan, b.satuan, s.nama AS vendor
      FROM surat_jalan_item i JOIN bahan_baku b ON b.id = i.bahan_baku_id
      LEFT JOIN supplier s ON s.id = i.vendor_id
     WHERE i.surat_jalan_id = NEW.id AND i.qty_dikirim > 0 AND public.bahan_multi_vendor(i.bahan_baku_id)
  LOOP
    IF r.vendor_id IS NULL THEN
      RAISE EXCEPTION 'Pilih vendor untuk % sebelum dikirim', r.bahan USING ERRCODE = 'check_violation';
    END IF;
    v_f := NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), r.bahan_baku_id, 1), 0);
    v_butuh := public.to_ledger_scale(public.gudang_pusat_id(), r.bahan_baku_id, r.qty_dikirim);
    IF public.bahan_vendor_aktif(r.bahan_baku_id) THEN
      v_sisa := public.sisa_vendor_gudang(r.bahan_baku_id, r.vendor_id);
      IF v_butuh > v_sisa + 0.000001 THEN
        RAISE EXCEPTION 'Sisa % % tinggal % %, surat jalan butuh %',
          r.bahan, regexp_replace(r.vendor, '\s*-\s*Tempo\s*\d+\s*$', '', 'i'),
          round(v_sisa / v_f, 2), r.satuan, r.qty_dikirim USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_surat_jalan_item_id, catatan, dibuat_oleh)
    VALUES (r.bahan_baku_id, r.vendor_id, -v_butuh, 'sj_kirim', r.id, 'Kirim SJ', auth.uid())
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sj_vendor_on_dikirim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sj_vendor_dikirim ON public.surat_jalan;
CREATE TRIGGER trg_sj_vendor_dikirim AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW EXECUTE FUNCTION public.sj_vendor_on_dikirim();
```

- [ ] **Step 3: Commit** (kontrol negatif controller: salin t3, ubah (c) `v_sisa <> 2` → `<> 3`, harus GAGAL (c). Controller juga menjalankan ulang `supabase/verifikasi/drop_ship/t3_catat.sql` & memastikan auto-verifikasi SJ (`auto_verifikasi_surat_jalan(true)`) tetap jalan.)

```bash
git add supabase/migrations/20260911152000_saldo_vendor_surat_jalan.sql supabase/verifikasi/saldo_vendor/t3_surat_jalan.sql
git commit -m "feat(db): surat jalan ber-vendor — pecah vendor, harga vendor, penjaga sisa saat kirim"
```

---

### Task 4: Opname Gudang Pusat per vendor → mutasi `hitung_fisik`

**Files:**
- Create: `supabase/migrations/20260911153000_saldo_vendor_opname.sql`
- Test: `supabase/verifikasi/saldo_vendor/t4_opname.sql`

**Interfaces:**
- Consumes: Task 1.
- Produces: tabel `opname_item_vendor(opname_id, bahan_baku_id, vendor_id, qty_besar)`; RPC `simpan_hitung_vendor(p_opname_id uuid, p_items jsonb)` — `p_items = [{bahan_baku_id, vendor_id, qty_besar}]`, mengganti seluruh baris opname itu; trigger `trg_opname_vendor_final` pada `opname` status → `finalized`.

- [ ] **Step 1: Tulis uji t4**

```sql
-- supabase/verifikasi/saldo_vendor/t4_opname.sql — harapan "HASIL T4: LULUS"
BEGIN;
DO $$
DECLARE v_k uuid; v_sapi uuid; v_dj uuid; v_az uuid; v_op uuid; v_ok boolean; v_sisa numeric; v_f numeric;
BEGIN
  SELECT id INTO v_k FROM outlet_staff WHERE role='kitchen' AND status='active' AND outlet_id = public.gudang_pusat_id() LIMIT 1;
  SELECT id INTO v_sapi FROM bahan_baku WHERE nama='SAPI';
  SELECT public.vendor_induk(id) INTO v_dj FROM supplier WHERE nama ILIKE 'Djafafood%';
  SELECT id INTO v_az FROM supplier WHERE nama='Lettuce (Pak Aziz) - Tempo 10';
  IF v_k IS NULL THEN RAISE EXCEPTION 'GAGAL: tak ada kitchen ber-outlet Gudang Pusat'; END IF;
  v_f := public.to_ledger_scale(public.gudang_pusat_id(), v_sapi, 1);
  INSERT INTO opname (outlet_id, tanggal, tipe, status, created_by)
  VALUES (public.gudang_pusat_id(), current_date, 'ad_hoc', 'draft', v_k) RETURNING id INTO v_op;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_k,'role','authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- (a) hanya satu vendor SAPI diisi → ditolak
  v_ok := false;
  BEGIN PERFORM public.simpan_hitung_vendor(v_op, jsonb_build_array(
      jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'qty_besar', 12)));
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (a): sub-baris sebagian lolos'; END IF;
  -- (b) lengkap → tersimpan
  PERFORM public.simpan_hitung_vendor(v_op, jsonb_build_array(
      jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_dj, 'qty_besar', 12),
      jsonb_build_object('bahan_baku_id', v_sapi, 'vendor_id', v_az, 'qty_besar', 9)));
  EXECUTE 'RESET ROLE';

  -- (c) finalisasi (qty_fisik item = 21 Blok dalam skala gudang) → sisa Djafafood 12, Pak Aziz 9, SAPI aktif
  INSERT INTO opname_item (opname_id, bahan_baku_id, qty_fisik, qty_system, selisih)
  VALUES (v_op, v_sapi, 21 * v_f, 21 * v_f, 0);
  UPDATE opname SET status = 'finalized' WHERE id = v_op;
  v_sisa := public.sisa_vendor_gudang(v_sapi, v_dj) / v_f;
  IF v_sisa <> 12 THEN RAISE EXCEPTION 'GAGAL (c): sisa Djafafood %', v_sisa; END IF;
  IF NOT public.bahan_vendor_aktif(v_sapi) THEN RAISE EXCEPTION 'GAGAL (c): SAPI belum aktif'; END IF;

  -- (d) idempoten: memicu ulang (status bolak-balik) tidak menggandakan
  UPDATE opname SET status = 'draft' WHERE id = v_op;
  UPDATE opname SET status = 'finalized' WHERE id = v_op;
  v_sisa := public.sisa_vendor_gudang(v_sapi, v_dj) / v_f;
  IF v_sisa <> 12 THEN RAISE EXCEPTION 'GAGAL (d): sisa berubah jadi %', v_sisa; END IF;

  RAISE EXCEPTION 'HASIL T4: LULUS (sebagian ditolak, simpan, final → hitung_fisik, aktif, idempoten)';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Tulis migration**

```sql
-- supabase/migrations/20260911153000_saldo_vendor_opname.sql
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.opname_item_vendor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id     uuid NOT NULL REFERENCES public.opname(id) ON DELETE CASCADE,
  bahan_baku_id uuid NOT NULL REFERENCES public.bahan_baku(id),
  vendor_id     uuid NOT NULL REFERENCES public.supplier(id),
  qty_besar     numeric NOT NULL CHECK (qty_besar >= 0),
  UNIQUE (opname_id, bahan_baku_id, vendor_id)
);
ALTER TABLE public.opname_item_vendor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oiv_select ON public.opname_item_vendor;
CREATE POLICY oiv_select ON public.opname_item_vendor FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.opname o WHERE o.id = opname_id AND o.outlet_id IN (SELECT public.accessible_outlet_ids())));
REVOKE ALL ON public.opname_item_vendor FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.opname_item_vendor TO authenticated;

CREATE OR REPLACE FUNCTION public.simpan_hitung_vendor(p_opname_id uuid, p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o opname; r record; v_nama text;
BEGIN
  SELECT * INTO v_o FROM opname WHERE id = p_opname_id;
  IF v_o.id IS NULL OR v_o.outlet_id <> public.gudang_pusat_id() THEN
    RAISE EXCEPTION 'Opname bukan milik Gudang Pusat' USING ERRCODE = 'check_violation';
  END IF;
  IF v_o.status NOT IN ('draft','pending_approval') THEN
    RAISE EXCEPTION 'Opname sudah %', v_o.status USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status='active' AND outlet_id = v_o.outlet_id) THEN
    RAISE EXCEPTION 'Bukan staff Gudang Pusat' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Tiap bahan yang dikirim wajib memuat SEMUA vendor induknya, tak lebih tak kurang.
  FOR r IN
    SELECT (x->>'bahan_baku_id')::uuid AS bahan, array_agg(public.vendor_induk((x->>'vendor_id')::uuid) ORDER BY 1) AS vendor
      FROM jsonb_array_elements(p_items) x GROUP BY 1
  LOOP
    IF r.vendor IS DISTINCT FROM (SELECT array_agg(v ORDER BY v) FROM public.vendor_bahan(r.bahan) v) THEN
      SELECT nama INTO v_nama FROM bahan_baku WHERE id = r.bahan;
      RAISE EXCEPTION 'Hitungan % harus diisi untuk semua vendornya', v_nama USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  DELETE FROM opname_item_vendor WHERE opname_id = p_opname_id;
  INSERT INTO opname_item_vendor (opname_id, bahan_baku_id, vendor_id, qty_besar)
  SELECT p_opname_id, (x->>'bahan_baku_id')::uuid, public.vendor_induk((x->>'vendor_id')::uuid), (x->>'qty_besar')::numeric
    FROM jsonb_array_elements(p_items) x;
END $$;
REVOKE ALL ON FUNCTION public.simpan_hitung_vendor(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_hitung_vendor(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.opname_vendor_final() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_target numeric;
BEGIN
  IF NOT (NEW.status = 'finalized' AND OLD.status IS DISTINCT FROM 'finalized'
          AND NEW.outlet_id = public.gudang_pusat_id()) THEN RETURN NEW; END IF;
  FOR r IN SELECT bahan_baku_id, vendor_id, qty_besar FROM opname_item_vendor WHERE opname_id = NEW.id LOOP
    -- Idempoten: bila opname ini sudah menulis hitung_fisik untuk pasangan ini, lewati.
    CONTINUE WHEN EXISTS (SELECT 1 FROM stok_vendor_gudang_mutasi m WHERE m.sumber='hitung_fisik'
                           AND m.ref_opname_id = NEW.id AND m.bahan_baku_id = r.bahan_baku_id AND m.vendor_id = r.vendor_id);
    v_target := public.to_ledger_scale(public.gudang_pusat_id(), r.bahan_baku_id, r.qty_besar);
    INSERT INTO stok_vendor_gudang_mutasi (bahan_baku_id, vendor_id, qty, sumber, ref_opname_id, catatan, dibuat_oleh)
    VALUES (r.bahan_baku_id, r.vendor_id, v_target - public.sisa_vendor_gudang(r.bahan_baku_id, r.vendor_id),
            'hitung_fisik', NEW.id, 'Opname gudang per vendor', auth.uid());
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.opname_vendor_final() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_opname_vendor_final ON public.opname;
CREATE TRIGGER trg_opname_vendor_final AFTER UPDATE OF status ON public.opname
  FOR EACH ROW EXECUTE FUNCTION public.opname_vendor_final();
```

- [ ] **Step 3: Commit** (kontrol negatif controller: salin t4, ubah (c) `v_sisa <> 12` → `<> 13`, harus GAGAL (c))

```bash
git add supabase/migrations/20260911153000_saldo_vendor_opname.sql supabase/verifikasi/saldo_vendor/t4_opname.sql
git commit -m "feat(db): opname Gudang Pusat per vendor → mutasi hitung_fisik"
```

---

### Task 5: Fungsi murni `alokasiVendor` (stok + salinan distribusi)

**Files:**
- Create: `apps/stok/src/lib/stok/alokasiVendor.ts`, `apps/stok/src/lib/stok/alokasiVendor.test.ts`
- Create: `apps/distribusi/src/lib/alokasiVendor.ts`, `apps/distribusi/src/lib/alokasiVendor.test.ts` (salinan identik)

**Interfaces:**
- Produces:
  - `type SaldoVendor = { vendor_id: string; vendor_nama: string; sisa: number; aktif: boolean }` (sisa satuan besar)
  - `type Alokasi = { vendor_id: string; qty: number }` (satuan besar)
  - `alokasiAwal(qty: number, vendors: SaldoVendor[]): Alokasi[]`
  - `validasiAlokasi(qty: number, alokasi: Alokasi[], vendors: SaldoVendor[]): string | null`

- [ ] **Step 1: Tulis test**

```ts
// apps/stok/src/lib/stok/alokasiVendor.test.ts
import { describe, it, expect } from 'vitest'
import { alokasiAwal, validasiAlokasi, type SaldoVendor } from './alokasiVendor'

const dj: SaldoVendor = { vendor_id: 'dj', vendor_nama: 'Djafafood', sisa: 3, aktif: true }
const az: SaldoVendor = { vendor_id: 'az', vendor_nama: 'Pak Aziz', sisa: 4, aktif: true }

describe('alokasiAwal', () => {
  it('satu vendor → semua ke vendor itu', () => {
    expect(alokasiAwal(5, [dj])).toEqual([{ vendor_id: 'dj', qty: 5 }])
  })
  it('multi: vendor bersisa terbanyak yang cukup', () => {
    expect(alokasiAwal(4, [dj, az])).toEqual([{ vendor_id: 'az', qty: 4 }])
  })
  it('multi: tak ada yang cukup → kosong (kitchen harus pecah)', () => {
    expect(alokasiAwal(5, [dj, az])).toEqual([])
  })
  it('belum aktif → kosong, wajib pilih manual', () => {
    expect(alokasiAwal(1, [{ ...dj, aktif: false }, { ...az, aktif: false }])).toEqual([])
  })
})

describe('validasiAlokasi', () => {
  it('bahan satu/tanpa vendor → selalu lolos', () => {
    expect(validasiAlokasi(5, [], [dj])).toBeNull()
    expect(validasiAlokasi(5, [], [])).toBeNull()
  })
  it('multi tanpa alokasi → wajib pilih', () => {
    expect(validasiAlokasi(5, [], [dj, az])).toMatch(/Pilih vendor/)
  })
  it('pecah 3+2 pas → lolos', () => {
    expect(validasiAlokasi(5, [{ vendor_id: 'dj', qty: 3 }, { vendor_id: 'az', qty: 2 }], [dj, az])).toBeNull()
  })
  it('total tak pas → ditolak', () => {
    expect(validasiAlokasi(5, [{ vendor_id: 'dj', qty: 3 }], [dj, az])).toMatch(/belum sama/)
  })
  it('melebihi sisa vendor aktif → ditolak', () => {
    expect(validasiAlokasi(4, [{ vendor_id: 'dj', qty: 4 }], [dj, az])).toMatch(/Sisa Djafafood tinggal 3/)
  })
  it('vendor belum aktif → sisa tidak dicek', () => {
    expect(validasiAlokasi(9, [{ vendor_id: 'dj', qty: 9 }], [{ ...dj, aktif: false }, az])).toBeNull()
  })
  it('vendor ganda / qty ≤ 0 / vendor asing → ditolak', () => {
    expect(validasiAlokasi(2, [{ vendor_id: 'dj', qty: 1 }, { vendor_id: 'dj', qty: 1 }], [dj, az])).toMatch(/dua kali/)
    expect(validasiAlokasi(2, [{ vendor_id: 'dj', qty: 2 }, { vendor_id: 'az', qty: 0 }], [dj, az])).toMatch(/lebih dari 0/)
    expect(validasiAlokasi(2, [{ vendor_id: 'x', qty: 2 }], [dj, az])).toMatch(/tidak dikenal/)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `cd apps/stok && ./node_modules/.bin/vitest run src/lib/stok/alokasiVendor.test.ts` → FAIL (modul tak ada)

- [ ] **Step 3: Implementasi**

```ts
// apps/stok/src/lib/stok/alokasiVendor.ts
// Alokasi vendor per bahan saat menyiapkan surat jalan.
// Spec: docs/superpowers/specs/2026-09-11-saldo-vendor-gudang-design.md §4.3-4.4.
// SALINAN IDENTIK di apps/distribusi/src/lib/alokasiVendor.ts — ubah keduanya.
// Penjaga sebenarnya ada di DB (sj_vendor_on_dikirim); ini hanya untuk UI.
export type SaldoVendor = { vendor_id: string; vendor_nama: string; sisa: number; aktif: boolean }
export type Alokasi = { vendor_id: string; qty: number }

const EPS = 1e-6

export function alokasiAwal(qty: number, vendors: SaldoVendor[]): Alokasi[] {
  if (vendors.length === 1) return [{ vendor_id: vendors[0].vendor_id, qty }]
  const cukup = vendors
    .filter((v) => v.aktif && v.sisa + EPS >= qty)
    .sort((a, b) => b.sisa - a.sisa)
  return cukup.length ? [{ vendor_id: cukup[0].vendor_id, qty }] : []
}

export function validasiAlokasi(qty: number, alokasi: Alokasi[], vendors: SaldoVendor[]): string | null {
  if (vendors.length <= 1) return null
  if (alokasi.length === 0) return 'Pilih vendor dulu'
  const dipakai = new Set<string>()
  let total = 0
  for (const a of alokasi) {
    const v = vendors.find((x) => x.vendor_id === a.vendor_id)
    if (!v) return 'Vendor tidak dikenal'
    if (dipakai.has(a.vendor_id)) return `${v.vendor_nama} dipilih dua kali`
    dipakai.add(a.vendor_id)
    if (!(a.qty > 0)) return `Jumlah ${v.vendor_nama} harus lebih dari 0`
    if (v.aktif && a.qty > v.sisa + EPS) return `Sisa ${v.vendor_nama} tinggal ${v.sisa}`
    total += a.qty
  }
  if (Math.abs(total - qty) > EPS) return `Jumlah per vendor (${total}) belum sama dengan ${qty}`
  return null
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**; salin kedua berkas ke `apps/distribusi/src/lib/` (ubah path import test ke `./alokasiVendor`), jalankan `cd apps/distribusi && ./node_modules/.bin/vitest run src/lib/alokasiVendor.test.ts` → PASS. Pastikan `diff apps/stok/src/lib/stok/alokasiVendor.ts apps/distribusi/src/lib/alokasiVendor.ts` kosong. Type-check kedua app 0 error.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/lib/stok/alokasiVendor.ts apps/stok/src/lib/stok/alokasiVendor.test.ts apps/distribusi/src/lib/alokasiVendor.ts apps/distribusi/src/lib/alokasiVendor.test.ts
git commit -m "feat(stok,distribusi): fungsi murni alokasi vendor per bahan"
```

---

### Task 6: Pemilih vendor di layar persetujuan permintaan (app stok)

**Files:**
- Modify: `apps/stok/src/app/actions/permintaan.ts` (tipe `ApproveItemInput`, action baru `fetchSaldoVendorGudang`)
- Create: `apps/stok/src/components/permintaan/PilihVendorBahan.tsx`
- Modify: `apps/stok/src/components/permintaan/ApprovalModal.tsx`

**Interfaces:**
- Consumes: RPC `saldo_vendor_gudang(p_bahan_ids uuid[])` (Task 1); `approve_permintaan_svc` item `alokasi` (Task 3); `alokasiAwal`, `validasiAlokasi`, `SaldoVendor`, `Alokasi` (Task 5).
- Produces: `fetchSaldoVendorGudang(bahanBakuIds: string[]): Promise<Record<string, SaldoVendor[]>>`; `ApproveItemInput = { bahan_baku_id: string; qty_disetujui: number; alokasi?: Alokasi[] }`.

- [ ] **Step 1: Server action** — di `permintaan.ts`, tambahkan `alokasi?: { vendor_id: string; qty: number }[]` ke tipe `ApproveItemInput` (cari definisinya), lalu tambahkan:

```ts
export async function fetchSaldoVendorGudang(bahanBakuIds: string[]): Promise<Record<string, SaldoVendor[]>> {
  await requirePermintaanViewer()
  if (!bahanBakuIds.length) return {}
  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('saldo_vendor_gudang', { p_bahan_ids: bahanBakuIds })
  if (error) throw new Error(error.message)
  const hasil: Record<string, SaldoVendor[]> = {}
  for (const r of (data ?? []) as { bahan_baku_id: string; vendor_id: string; vendor_nama: string; sisa: number | null; aktif: boolean }[]) {
    ;(hasil[r.bahan_baku_id] ??= []).push({
      vendor_id: r.vendor_id, vendor_nama: r.vendor_nama, sisa: Number(r.sisa ?? 0), aktif: r.aktif,
    })
  }
  return hasil
}
```
(import `type SaldoVendor` dari `@/lib/stok/alokasiVendor`.)

- [ ] **Step 2: Komponen `PilihVendorBahan`** — qty di komponen ini satuan **distribusi** (sama dengan kolom qty modal); konversi ke satuan besar dilakukan pemanggil.

```tsx
'use client'
// Pemilih vendor untuk satu bahan multi-vendor. Tampil hanya bila vendor ≥ 2.
import type { Alokasi, SaldoVendor } from '@/lib/stok/alokasiVendor'

type Props = {
  vendors: SaldoVendor[]              // sisa dalam satuan DISTRIBUSI
  satuan: string
  alokasi: Alokasi[]                  // qty dalam satuan DISTRIBUSI
  onChange: (a: Alokasi[]) => void
  galat: string | null
  disabled?: boolean
}

export function PilihVendorBahan({ vendors, satuan, alokasi, onChange, galat, disabled }: Props) {
  if (vendors.length <= 1) {
    return vendors[0] ? <p className="text-[11px] text-[#544437]">Vendor: <b>{vendors[0].vendor_nama}</b></p> : null
  }
  const pecah = alokasi.length > 1
  const ubahQty = (vendor_id: string, qty: number) =>
    onChange(alokasi.map((a) => (a.vendor_id === vendor_id ? { ...a, qty } : a)))
  const pilihTunggal = (vendor_id: string, total: number) => onChange([{ vendor_id, qty: total }])
  const total = alokasi.reduce((s, a) => s + a.qty, 0)

  return (
    <div className="mt-2 rounded-lg border border-[#d9c2b2]/60 p-2 space-y-1 text-[11px]">
      {vendors.map((v) => {
        const habis = v.aktif && v.sisa <= 0
        const a = alokasi.find((x) => x.vendor_id === v.vendor_id)
        return (
          <label key={v.vendor_id} className={`flex items-center gap-2 ${habis ? 'opacity-50' : ''}`}>
            {pecah ? (
              <input type="checkbox" disabled={disabled || habis} checked={!!a}
                onChange={(e) => onChange(e.target.checked ? [...alokasi, { vendor_id: v.vendor_id, qty: 0 }] : alokasi.filter((x) => x.vendor_id !== v.vendor_id))} />
            ) : (
              <input type="radio" disabled={disabled || habis} checked={!!a}
                onChange={() => pilihTunggal(v.vendor_id, total)} />
            )}
            <span className="flex-1">{v.vendor_nama}</span>
            <span className="text-[#544437]/70">{v.aktif ? `sisa ${v.sisa} ${satuan}` : 'belum dihitung'}{habis ? ' · habis' : ''}</span>
            {pecah && a && (
              <input type="number" min="0" step="any" disabled={disabled} value={a.qty || ''}
                onChange={(e) => ubahQty(v.vendor_id, Number(e.target.value))}
                className="w-16 rounded border border-[#d9c2b2] p-0.5 text-right" />
            )}
          </label>
        )
      })}
      {!disabled && (
        <button type="button" className="text-[#904d00] underline"
          onClick={() => onChange(pecah ? alokasi.slice(0, 1).map((a) => ({ ...a, qty: total })) : alokasi)}
          hidden={!pecah && alokasi.length === 0}>
          {pecah ? 'Satu vendor saja' : '+ pecah vendor'}
        </button>
      )}
      {!pecah && alokasi.length > 0 && !disabled && (
        <button type="button" className="ml-2 text-[#904d00] underline"
          onClick={() => onChange([...alokasi, ...vendors.filter((v) => v.vendor_id !== alokasi[0].vendor_id && !(v.aktif && v.sisa <= 0)).slice(0, 1).map((v) => ({ vendor_id: v.vendor_id, qty: 0 }))])}>
          + pecah vendor
        </button>
      )}
      {galat && <p className="font-semibold text-red-700">{galat}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Integrasi `ApprovalModal`** (semua hook tetap di atas early-return mana pun):
  1. State `const [saldoVendor, setSaldoVendor] = useState<Record<string, SaldoVendor[]>>({})` dan `const [alokasi, setAlokasi] = useState<Record<string, Alokasi[]>>({})` (qty satuan distribusi).
  2. Di `useEffect` crosscheck yang ada, panggil juga `fetchSaldoVendorGudang(bahanBakuIds)` → `setSaldoVendor`.
  3. Helper di komponen: `vendorsDist(it)` = `saldoVendor[id]` dengan `sisa` dikonversi `Math.floor(convertToDistribusiUnit(v.sisa, b) * 1000) / 1000`.
  4. Saat `qtys` atau `saldoVendor` berubah dan `alokasi[id]` belum ada: isi `alokasiAwal(qtys[id], vendorsDist(it))`. Bila qty bahan diubah dan alokasi tunggal → samakan qty-nya.
  5. Galat per bahan = `validasiAlokasi(qtys[id] ?? 0, alokasi[id] ?? [], vendorsDist(it))` (hanya bila qty > 0). `const adaGalatVendor = permintaan.items.some(...)`.
  6. Render `<PilihVendorBahan vendors={vendorsDist(it)} satuan={/* label satuan distribusi yang SUDAH dirender di samping input qty baris itu — pakai variabel/ekspresi yang sama, jangan hitung ulang */} alokasi={alokasi[id] ?? []} onChange={(a) => setAlokasi({ ...alokasi, [id]: a })} galat={galat} disabled={!canApprove} />` di bawah kolom qty tiap bahan.
  7. Tombol Setujui: tambahkan `|| adaGalatVendor` ke kondisi `disabled`.
  8. `handleApprove`: tiap item tambahkan `alokasi: (saldoVendor[id]?.length ?? 0) >= 2 ? (alokasi[id] ?? []).map(a => ({ vendor_id: a.vendor_id, qty: b ? convertToBaseUnit(a.qty, b) : a.qty })) : undefined`.

- [ ] **Step 4: Verifikasi** — `./node_modules/.bin/vitest run` (baseline + test Task 5 lulus), `yarn type-check` 0, `./node_modules/.bin/next build --webpack` sukses.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/app/actions/permintaan.ts apps/stok/src/components/permintaan/PilihVendorBahan.tsx apps/stok/src/components/permintaan/ApprovalModal.tsx
git commit -m "feat(stok): pilih vendor per bahan saat menyetujui permintaan"
```

---

### Task 7: Pemilih vendor di form surat jalan manual (app distribusi)

**Files:**
- Modify: `apps/distribusi/src/components/distribusi/SuratJalanForm.tsx`
- Create: `apps/distribusi/src/components/distribusi/PilihVendorBahan.tsx` (salinan komponen Task 6, import `../../lib/alokasiVendor` sesuai alias `@/lib/alokasiVendor`)

**Interfaces:**
- Consumes: RPC `saldo_vendor_gudang` (dipanggil langsung dengan client browser `createSupabaseBrowserClient()` — pengguna form = kitchen/admin, lolos cek peran RPC); `alokasiAwal`, `validasiAlokasi` (Task 5).
- Produces: baris `surat_jalan_item` dengan `vendor_id`; satu bahan boleh ≥2 baris (beda vendor).

- [ ] **Step 1:** Ambil saldo vendor untuk bahan di daftar `items` (query `supabase.rpc('saldo_vendor_gudang', { p_bahan_ids })` di `useEffect` bergantung pada daftar bahanId); state `alokasi: Record<bahanId, Alokasi[]>` satuan distribusi, isi awal `alokasiAwal`.
- [ ] **Step 2:** Render `PilihVendorBahan` di bawah tiap item; blokir submit bila ada `validasiAlokasi` ≠ null (toast pesan galat pertama).
- [ ] **Step 3:** Ganti `itemsToInsert` menjadi `flatMap`:

```ts
const itemsToInsert = items.flatMap((item) => {
  const bahan = bahanBaku.find((b) => b.id === item.bahanId)
  const keBase = (q: number) => (bahan ? convertToBaseUnit(q, bahan) : q)
  const vendors = saldoVendor[item.bahanId] ?? []
  const a = alokasi[item.bahanId] ?? []
  if (vendors.length >= 2) {
    return a.map((x) => ({ surat_jalan_id: sj.id, bahan_baku_id: item.bahanId, qty_dikirim: keBase(x.qty), vendor_id: x.vendor_id }))
  }
  return [{ surat_jalan_id: sj.id, bahan_baku_id: item.bahanId, qty_dikirim: keBase(item.qty) }]
})
```
(Bahan satu vendor: `vendor_id` diisi otomatis oleh trigger `fill_harga_snapshot`.)
- [ ] **Step 4: Verifikasi** — vitest distribusi, `yarn type-check` 0, `next build --webpack` sukses.
- [ ] **Step 5: Commit**

```bash
git add apps/distribusi/src/components/distribusi/SuratJalanForm.tsx apps/distribusi/src/components/distribusi/PilihVendorBahan.tsx
git commit -m "feat(distribusi): pilih vendor per bahan di form surat jalan"
```

---

### Task 8: Opname Gudang Pusat — sub-baris per vendor (app stok)

**Files:**
- Modify: `apps/stok/src/components/stok/OpnameForm.tsx`

**Interfaces:**
- Consumes: RPC `saldo_vendor_gudang` (daftar vendor per bahan, tanpa memakai `sisa` — hitung buta), RPC `simpan_hitung_vendor(p_opname_id, p_items)` (Task 4).

Aturan UI (spec §4.5):
- Hanya bila `isGudang` (sudah ada di form, baris 79) dan bahan `multi`.
- Tiap vendor: input satuan besar/tengah/kecil SAMA seperti baris utama (pakai handler & konversi yang sudah ada per level). Total baris utama = jumlah sub-baris dalam satuan besar, tampil read-only; input utama bahan itu dinonaktifkan.
- Semua sub-baris kosong → bahan dilewati (perilaku lama). Sebagian terisi → tampilkan galat inline dan blokir Simpan Draft/Finalisasi.
- **Stok sistem & sisa vendor TIDAK ditampilkan** (hitung buta dipertahankan).
- Sesudah draft/opname tersimpan (dapat `opname_id`) dan SEBELUM finalisasi dipanggil: panggil `simpan_hitung_vendor(opnameId, items)` dengan `qty_besar` per vendor. Gagal → hentikan finalisasi dan tampilkan pesan RPC.
- Draft lokal (`localStorage opname_draft_<outlet>`) ikut menyimpan sub-baris (tambah field `vendor` di objek draft; draft lama tanpa field itu tetap terbaca).

- [ ] **Step 1:** Ekstrak fungsi murni `totalSubVendor(sub: Record<vendorId, {besar?:string; tengah?:string; kecil?:string}>, b: Bahan): { total: number | null; sebagian: boolean }` ke `apps/stok/src/lib/stok/opnameVendor.ts` + test (kosong semua → `{total:null, sebagian:false}`; sebagian → `sebagian:true`; lengkap → total satuan besar memakai `faktor_tengah`/`faktor_tampilan` bahan). Tulis test dulu, lihat gagal, implementasi, lulus.
- [ ] **Step 2:** Integrasikan ke `OpnameForm` sesuai aturan di atas; hooks tetap sebelum early-return.
- [ ] **Step 3: Verifikasi** — vitest (baseline + test baru), `yarn type-check` 0, `next build --webpack` sukses.
- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/lib/stok/opnameVendor.ts apps/stok/src/lib/stok/opnameVendor.test.ts apps/stok/src/components/stok/OpnameForm.tsx
git commit -m "feat(stok): opname Gudang Pusat per vendor untuk bahan multi-vendor"
```

---

### Task 9: Pemantau & catatan sesi

**Files:**
- Create: `supabase/verifikasi/saldo_vendor/pemantau.sql`
- Modify: `CLAUDE.md` (entri sesi baru), memori `vendor-bukan-identitas-barang.md` (status)

- [ ] **Step 1: Pemantau (read-only)**

```sql
-- Q1: selisih Σ sisa vendor vs stok total gudang per bahan multi-vendor aktif.
-- Normal: kecil (waste/penyesuaian gudang di antara opname). Besar → hitung ulang bahan itu.
SELECT b.nama,
       round(sum(m.qty) / NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), b.id, 1),0), 2) AS sisa_vendor_besar,
       round(sb.saldo / NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), b.id, 1),0), 2) AS stok_total_besar
  FROM bahan_baku b
  JOIN stok_vendor_gudang_mutasi m ON m.bahan_baku_id = b.id
  LEFT JOIN stok_balance sb ON sb.bahan_baku_id = b.id AND sb.outlet_id = public.gudang_pusat_id()
 WHERE public.bahan_vendor_aktif(b.id)
 GROUP BY b.id, b.nama, sb.saldo ORDER BY abs(sum(m.qty) - COALESCE(sb.saldo,0)) DESC;

-- Q2: SJ dikirim sejak go-live berbahan multi-vendor tanpa vendor. Normal: 0.
SELECT s.id, b.nama FROM surat_jalan s JOIN surat_jalan_item i ON i.surat_jalan_id = s.id
  JOIN bahan_baku b ON b.id = i.bahan_baku_id
 WHERE s.status <> 'draft' AND i.vendor_id IS NULL AND public.bahan_multi_vendor(i.bahan_baku_id)
   AND s.created_at >= TIMESTAMPTZ '2026-09-12 00:00+07';

-- Q3: bahan multi-vendor yang BELUM punya titik awal (penjaga belum aktif). Target: 0 setelah sesi hitung fisik.
SELECT b.nama FROM bahan_baku b WHERE b.is_active AND public.bahan_multi_vendor(b.id) AND NOT public.bahan_vendor_aktif(b.id) ORDER BY 1;
```

- [ ] **Step 2:** Entri `CLAUDE.md` "Session 2026-09-xx: Saldo per Vendor Gudang Pusat" — isi hanya fakta terukur saat itu (migration applied, uji LULUS, apa yang belum: sesi hitung fisik titik awal, redeploy `stok` + `distribusi`). Perbarui memori `vendor-bukan-identitas-barang` dengan status.
- [ ] **Step 3: Commit**

```bash
git add supabase/verifikasi/saldo_vendor/pemantau.sql CLAUDE.md
git commit -m "docs: pemantau saldo vendor + catatan sesi"
```
