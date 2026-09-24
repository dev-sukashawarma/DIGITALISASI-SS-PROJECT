# Master Bahan Baku — Tahap 1: Fondasi DB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyiapkan lapisan database untuk "satu tempat" master bahan baku — fungsi tulis ber-cek role, log perubahan, penegak invarian faktor, dan harga master yang diturunkan dari harga vendor — tanpa mengubah satu layar pun.

**Architecture:** Enam migration aditif. Semua penulisan master baru lewat fungsi `SECURITY DEFINER` yang memeriksa role langsung dari `outlet_staff`. Invarian satuan & harga ditegakkan trigger, bukan layar. Tulis langsung ke tabel **belum dicabut** di tahap ini (itu Tahap 2, setelah layar pindah), jadi app yang sedang live tidak terganggu.

**Tech Stack:** PostgreSQL (Supabase), PL/pgSQL, uji SQL gaya `supabase/verifikasi/**` (transaksi + `ROLLBACK`, simulasi user lewat `request.jwt.claims` + `SET LOCAL ROLE authenticated`).

**Spec:** `docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md` (baca K1, K4–K10 sebelum mulai).

## Global Constraints

- Hak akses (K1): lingkup **data** = `admin`, `owner`; lingkup **harga** (harga & vendor) = `admin`, `owner`, `purchasing`. Selalu syaratkan `outlet_staff.status = 'active'`.
- **Jangan** memakai `is_finance()` / `can_manage_po()` — keduanya selalu true (memory `penjaga-peran-palsu`). Jangan pula `can_write_bahan_baku()` (tidak memeriksa status).
- Setiap fungsi `SECURITY DEFINER` wajib `SET search_path = public`, lalu `REVOKE ALL ... FROM PUBLIC, anon`.
- Setiap view baru wajib `WITH (security_invoker = true)` (lihat CLAUDE.md §2 soal `ledger_transaksi_ringkas`).
- Tabel baru: `REVOKE ALL ON <tabel> FROM anon, authenticated` lalu GRANT seperlunya — default privileges Supabase memberi ALL.
- `trg_process_bom_stok` **tidak** menyaring `bahan_baku.is_active` — jangan berasumsi nonaktif menghentikan potongan resep.
- Invarian faktor (K4):
  - Punya satuan kecil + tengah: `faktor_konversi = faktor_tampilan / faktor_tengah`
  - Punya satuan kecil, tanpa tengah: `faktor_konversi = faktor_tampilan`
  - Tanpa satuan kecil: `faktor_tampilan = NULL`, `faktor_konversi = 1`, `satuan_tengah = NULL`
  - `bahan_baku_harga.kemasan_qty = COALESCE(faktor_tampilan, 1)`
- Harga master (K5): `harga_beli` per **satuan besar**. Turunan dari katalog = `harga / isi_satuan_kecil × COALESCE(faktor_tampilan, 1)`.
- Katalog vendor **terpercaya** = `is_active AND NOT perlu_ditinjau AND harga > 0 AND isi_satuan_kecil > 0`, dan supplier-nya aktif.
- Timestamp migration: `20260923HHMMSS`. **Sebelum apply**, cek tabrakan:
  - `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260923%';`
  - `ls supabase/migrations | cut -c1-14 | sort | uniq -d`
  - Kalau bentrok, geser jam dan ganti nama berkas.
- Cara apply: Supabase MCP `execute_sql` dengan isi berkas (atau `supabase db query --linked -f <berkas>`), lalu **verifikasi ke katalog** (`pg_proc` / `pg_trigger` / `information_schema`), lalu stempel:
  `INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('<versi>','<nama>') ON CONFLICT (version) DO NOTHING;`
  Setelah itu `SELECT` ulang untuk memastikan stempelnya ada.
- Uji SQL dijalankan dengan cara yang sama. Uji **wajib gagal** sebelum migration-nya di-apply (kontrol negatif), lalu lulus sesudahnya.
- **Tidak ada perubahan app di tahap ini.** Tidak perlu redeploy.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/20260923180000_peruntukan_is_opname_bahan_baku.sql` | Ambil alih WIP `peruntukan`/`is_opname` (K9), idempoten |
| `supabase/migrations/20260923181000_audit_master_bahan.sql` | Tabel log + trigger + view `riwayat_master_bahan` (K10.3) |
| `supabase/migrations/20260923182000_invarian_faktor_bahan.sql` | Helper `_peran_master`, penegak invarian faktor & kemasan, rapikan 4 bahan (K4) |
| `supabase/migrations/20260923183000_harga_master_turunan.sql` | Harga master diturunkan dari katalog + pembekuan + vendor "Beli Tunai" + view status (K5, K6) |
| `supabase/migrations/20260923184000_rpc_master_bahan_data.sql` | RPC simpan/nonaktif/aktif/hapus bahan + SKU (K1, K7, K8) |
| `supabase/migrations/20260923185000_rpc_master_bahan_vendor.sql` | RPC harga vendor + supplier (K1, K5) |
| `supabase/verifikasi/master_bahan/t1_peruntukan.sql` … `t7_regresi_jalur_lama.sql` | Satu uji per migration + regresi jalur lama |
| `supabase/verifikasi/master_bahan/pemantau.sql` | Kueri pantau setelah live |

---

### Task 1: Ambil alih migration peruntukan & ikut opname

**Files:**
- Create: `supabase/migrations/20260923180000_peruntukan_is_opname_bahan_baku.sql`
- Create: `supabase/verifikasi/master_bahan/t1_peruntukan.sql`
- Owner menghapus manual (bukan agen): berkas untracked `supabase/migrations/20300235000000_add_peruntukan_and_is_opname_bahan_baku.sql` di working tree `main`

**Interfaces:**
- Produces: kolom `bahan_baku.peruntukan text NOT NULL DEFAULT 'outlet'` dengan CHECK `('outlet','gudang','keduanya')`, dan `bahan_baku.is_opname boolean NOT NULL DEFAULT true`. Kolom-kolom ini dibaca RPC di Task 5.

Konteks: kedua kolom **sudah ada di DB live** dan sudah terisi. Sebaran per 2026-09-23: keduanya 22, gudang 6, outlet 20, setelah GAS 12 KG diubah ke keduanya. Berkas asli bertimestamp 2030, sehingga ditolak lint CI dan tak pernah distempel. Isi pengisian awalnya **tidak boleh jalan ulang** di produksi, karena akan menimpa suntingan manual sesudahnya.

- [ ] **Step 1: Tulis uji**

```sql
-- supabase/verifikasi/master_bahan/t1_peruntukan.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_ok boolean; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260923180000') THEN
    RAISE EXCEPTION 'GAGAL: migration 20260923180000 belum distempel';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bahan_baku_peruntukan_check') THEN
    RAISE EXCEPTION 'GAGAL: CHECK peruntukan tidak ada';
  END IF;
  INSERT INTO bahan_baku (nama, satuan, kategori) VALUES ('UJI T1 BAHAN', 'Pcs', 'UJI') RETURNING id INTO v_id;
  IF (SELECT peruntukan FROM bahan_baku WHERE id = v_id) <> 'outlet'
     OR (SELECT is_opname FROM bahan_baku WHERE id = v_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'GAGAL: default kolom salah';
  END IF;
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET peruntukan = 'lainnya' WHERE id = v_id;
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: nilai peruntukan liar diterima'; END IF;
  RAISE NOTICE 'HASIL T1: LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan GAGAL**

Jalankan isi `t1_peruntukan.sql` lewat MCP `execute_sql`.
Harapan: error `GAGAL: migration 20260923180000 belum distempel`.

- [ ] **Step 3: Tulis migration**

```sql
-- supabase/migrations/20260923180000_peruntukan_is_opname_bahan_baku.sql
--
-- Mengambil alih berkas WIP 20300235000000_add_peruntukan_and_is_opname_bahan_baku.sql
-- (untracked, timestamp 2030 ditolak lint CI, tak pernah distempel) — spec
-- 2026-09-23 K9. Kedua kolom SUDAH ADA di produksi dan sudah disunting manual
-- (mis. GAS 12 KG = keduanya), jadi pengisian awal berbasis nama HANYA jalan bila
-- kolomnya baru dibuat saat ini juga (replay dari nol). Di produksi blok itu mati.

DO $$
DECLARE
  v_peruntukan_baru boolean;
  v_opname_baru boolean;
BEGIN
  v_peruntukan_baru := NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bahan_baku' AND column_name = 'peruntukan');
  v_opname_baru := NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bahan_baku' AND column_name = 'is_opname');

  ALTER TABLE public.bahan_baku
    ADD COLUMN IF NOT EXISTS peruntukan TEXT NOT NULL DEFAULT 'outlet',
    ADD COLUMN IF NOT EXISTS is_opname BOOLEAN NOT NULL DEFAULT true;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bahan_baku_peruntukan_check') THEN
    ALTER TABLE public.bahan_baku
      ADD CONSTRAINT bahan_baku_peruntukan_check
      CHECK (peruntukan IN ('outlet', 'gudang', 'keduanya'));
  END IF;

  IF v_opname_baru THEN
    UPDATE public.bahan_baku SET is_opname = false
     WHERE UPPER(TRIM(kategori)) IN ('ASET', 'PERLENGKAPAN')
        OR UPPER(TRIM(nama)) IN ('PRINTER THERMAL', 'ID CARD');
  END IF;

  IF v_peruntukan_baru THEN
    UPDATE public.bahan_baku SET peruntukan = 'gudang'
     WHERE UPPER(TRIM(nama)) IN ('GARAM', 'JINTEN', 'KAYU MANIS', 'KETUMBAR', 'KUNYIT', 'SASA', 'CENGKEH');
    UPDATE public.bahan_baku SET peruntukan = 'keduanya'
     WHERE UPPER(TRIM(nama)) IN (
       'SAOS CABE', 'SAOS TOMAT', 'SAOS SAMYANG', 'MAYONES',
       'KULIT 25', 'KULIT 28', 'KULIT 32',
       'AYAM', 'SAPI', 'KENTANG', 'KEJU', 'TUM', 'BAWANG', 'TEPUNG',
       'MINYAK SAYUR', 'FOIL', 'SARUNG TANGAN BENING', 'KERTAS STRUK',
       'PLASTIK BESAR', 'PLASTIK KECIL', 'PLASTIK VACUM', 'PLASTIK MERAH',
       'POLYBAG', 'PAPER WRAP', 'POWDER TEH', 'POWDER JERUK', 'POWDER MIX',
       'CUP + TUTUP', 'SEDOTAN', 'STIKER', 'GAS 12 KG');
  END IF;
END $$;
```

- [ ] **Step 4: Rekam sebaran sebelum apply, apply, rekam sesudah**

Jalankan sebelum dan sesudah apply:
```sql
SELECT peruntukan, is_opname, count(*) FROM bahan_baku GROUP BY 1,2 ORDER BY 1,2;
```
Harapan: hasil **identik** sebelum dan sesudah. Kalau berbeda, blok pengisian awal ikut jalan: hentikan dan laporkan.
Lalu stempel `('20260923180000','peruntukan_is_opname_bahan_baku')` dan `SELECT` ulang stempelnya.

- [ ] **Step 5: Jalankan uji, pastikan LULUS**

Jalankan isi `t1_peruntukan.sql`. Harapan: tanpa error (NOTICE `HASIL T1: LULUS`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260923180000_peruntukan_is_opname_bahan_baku.sql supabase/verifikasi/master_bahan/t1_peruntukan.sql
git commit -m "feat(db): ambil alih migration peruntukan & is_opname bahan baku (idempoten)"
```
Lalu minta owner menghapus berkas lama `supabase/migrations/20300235000000_add_peruntukan_and_is_opname_bahan_baku.sql` dari working tree `main` (untracked; hook memblokir agen menghapusnya).

---

### Task 2: Log perubahan master + view riwayat

**Files:**
- Create: `supabase/migrations/20260923181000_audit_master_bahan.sql`
- Create: `supabase/verifikasi/master_bahan/t2_audit.sql`

**Interfaces:**
- Produces:
  - Tabel `public.master_bahan_audit(id bigserial, tabel text, baris_id uuid, bahan_baku_id uuid NULL, aksi text, perubahan jsonb, alasan text, changed_by uuid, changed_at timestamptz)`.
  - Trigger AFTER I/U/D pada `bahan_baku`, `bahan_baku_sku`, `supplier`.
  - Alasan diambil dari `current_setting('app.alasan', true)`. **Semua RPC di Task 5 & 6 menyetelnya dengan `set_config('app.alasan', ..., true)`.**
  - View `public.riwayat_master_bahan(bahan_baku_id, changed_at, changed_by, jenis, tabel, aksi, perubahan, alasan, harga_lama, harga_baru, supplier_id)`. `jenis` bernilai `'data' | 'harga_master' | 'harga_vendor'`.
  - `bbs_tulis_riwayat` kini mengisi `catatan` dari `app.alasan`.

- [ ] **Step 1: Tulis uji**

```sql
-- supabase/verifikasi/master_bahan/t2_audit.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_admin uuid; v_crew uuid; v_id uuid; v_n int; v_row master_bahan_audit%ROWTYPE;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  IF v_admin IS NULL OR v_crew IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture staf tak lengkap'; END IF;

  INSERT INTO bahan_baku (nama, satuan, kategori) VALUES ('UJI T2 BAHAN', 'Pcs', 'UJI') RETURNING id INTO v_id;

  -- (a) sebagai admin, ubah nama dengan alasan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('app.alasan', 'uji t2 ganti nama', true);
  UPDATE bahan_baku SET nama = 'UJI T2 BAHAN B' WHERE id = v_id;

  SELECT * INTO v_row FROM master_bahan_audit
   WHERE tabel = 'bahan_baku' AND baris_id = v_id AND aksi = 'UPDATE' ORDER BY id DESC LIMIT 1;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'GAGAL (a): baris audit UPDATE tidak ada / tak terbaca admin'; END IF;
  IF v_row.perubahan -> 'nama' ->> 'baru' <> 'UJI T2 BAHAN B'
     OR v_row.perubahan -> 'nama' ->> 'lama' <> 'UJI T2 BAHAN' THEN
    RAISE EXCEPTION 'GAGAL (a): isi perubahan salah: %', v_row.perubahan;
  END IF;
  IF v_row.alasan IS DISTINCT FROM 'uji t2 ganti nama' OR v_row.changed_by IS DISTINCT FROM v_admin
     OR v_row.bahan_baku_id IS DISTINCT FROM v_id THEN
    RAISE EXCEPTION 'GAGAL (a): alasan/pelaku/bahan salah';
  END IF;

  -- (b) UPDATE tanpa perubahan nilai tidak menulis audit
  SELECT count(*) INTO v_n FROM master_bahan_audit WHERE baris_id = v_id;
  UPDATE bahan_baku SET nama = 'UJI T2 BAHAN B' WHERE id = v_id;
  IF (SELECT count(*) FROM master_bahan_audit WHERE baris_id = v_id) <> v_n THEN
    RAISE EXCEPTION 'GAGAL (b): UPDATE kosong tetap menulis audit';
  END IF;

  -- (c) view riwayat memuat baris data
  IF NOT EXISTS (SELECT 1 FROM riwayat_master_bahan WHERE bahan_baku_id = v_id AND jenis = 'data') THEN
    RAISE EXCEPTION 'GAGAL (c): riwayat_master_bahan tak memuat baris data';
  END IF;

  -- (d) crew tidak bisa membaca log
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM master_bahan_audit WHERE baris_id = v_id) THEN
    RAISE EXCEPTION 'GAGAL (d): crew bisa membaca master_bahan_audit';
  END IF;
  RAISE NOTICE 'HASIL T2: LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan GAGAL**

Harapan: error `relation "master_bahan_audit" does not exist`.

- [ ] **Step 3: Tulis migration**

```sql
-- supabase/migrations/20260923181000_audit_master_bahan.sql
-- Satu log perubahan untuk master bahan baku (spec 2026-09-23 K10.3).
-- Harga master & harga vendor sudah punya tabel riwayat sendiri
-- (bahan_baku_harga_history, bahan_baku_supplier_history); log ini menutup
-- sisanya: data bahan, SKU, supplier. View riwayat_master_bahan menyatukan ketiganya
-- untuk tab Riwayat.

CREATE TABLE IF NOT EXISTS public.master_bahan_audit (
  id            bigserial PRIMARY KEY,
  tabel         text NOT NULL,
  baris_id      uuid NOT NULL,
  bahan_baku_id uuid,               -- NULL untuk baris supplier; sengaja tanpa FK agar
                                    -- catatan DELETE tetap hidup setelah bahannya hilang
  aksi          text NOT NULL CHECK (aksi IN ('INSERT', 'UPDATE', 'DELETE')),
  perubahan     jsonb NOT NULL,     -- UPDATE: {kolom: {lama, baru}}; INSERT/DELETE: baris utuh
  alasan        text,
  changed_by    uuid,
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mba_bahan ON public.master_bahan_audit (bahan_baku_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mba_baris ON public.master_bahan_audit (tabel, baris_id, changed_at DESC);

ALTER TABLE public.master_bahan_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.master_bahan_audit FROM anon, authenticated;
GRANT SELECT ON public.master_bahan_audit TO authenticated;

DROP POLICY IF EXISTS mba_select ON public.master_bahan_audit;
CREATE POLICY mba_select ON public.master_bahan_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.outlet_staff s
                  WHERE s.id = auth.uid() AND s.status = 'active'
                    AND s.role IN ('admin', 'owner', 'purchasing')));

CREATE OR REPLACE FUNCTION public.master_bahan_tulis_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old  jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new  jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_diff jsonb := '{}'::jsonb;
  v_row  jsonb;
  k      text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN k IN ('updated_at', 'created_at');
      IF (v_old -> k) IS DISTINCT FROM (v_new -> k) THEN
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('lama', v_old -> k, 'baru', v_new -> k));
      END IF;
    END LOOP;
    IF v_diff = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSE
    v_diff := COALESCE(v_new, v_old);
  END IF;

  v_row := COALESCE(v_new, v_old);
  INSERT INTO public.master_bahan_audit (tabel, baris_id, bahan_baku_id, aksi, perubahan, alasan, changed_by)
  VALUES (
    TG_TABLE_NAME,
    (v_row ->> 'id')::uuid,
    CASE TG_TABLE_NAME
      WHEN 'bahan_baku'     THEN (v_row ->> 'id')::uuid
      WHEN 'bahan_baku_sku' THEN (v_row ->> 'bahan_baku_id')::uuid
      ELSE NULL
    END,
    TG_OP,
    v_diff,
    NULLIF(current_setting('app.alasan', true), ''),
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.master_bahan_tulis_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_bahan_baku ON public.bahan_baku;
CREATE TRIGGER trg_audit_bahan_baku AFTER INSERT OR UPDATE OR DELETE ON public.bahan_baku
  FOR EACH ROW EXECUTE FUNCTION public.master_bahan_tulis_audit();
DROP TRIGGER IF EXISTS trg_audit_bahan_baku_sku ON public.bahan_baku_sku;
CREATE TRIGGER trg_audit_bahan_baku_sku AFTER INSERT OR UPDATE OR DELETE ON public.bahan_baku_sku
  FOR EACH ROW EXECUTE FUNCTION public.master_bahan_tulis_audit();
DROP TRIGGER IF EXISTS trg_audit_supplier ON public.supplier;
CREATE TRIGGER trg_audit_supplier AFTER INSERT OR UPDATE OR DELETE ON public.supplier
  FOR EACH ROW EXECUTE FUNCTION public.master_bahan_tulis_audit();

-- Riwayat katalog kini membawa alasan RPC (Task 6). Badan lain identik dengan
-- definisi live 2026-09-23 (SECURITY DEFINER, pelaku = auth.uid() / updated_by).
CREATE OR REPLACE FUNCTION public.bbs_tulis_riwayat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.harga            IS NOT DISTINCT FROM OLD.harga
     AND NEW.satuan_beli      IS NOT DISTINCT FROM OLD.satuan_beli
     AND NEW.isi_satuan_kecil IS NOT DISTINCT FROM OLD.isi_satuan_kecil THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bahan_baku_supplier_history (
    bahan_baku_supplier_id, bahan_baku_id, supplier_id,
    harga_lama, harga_baru, satuan_beli, isi_satuan_kecil,
    sumber, ref_po_id, changed_by, catatan
  ) VALUES (
    NEW.id, NEW.bahan_baku_id, NEW.supplier_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.harga ELSE NULL END,
    NEW.harga, NEW.satuan_beli, NEW.isi_satuan_kecil,
    NEW.sumber, NEW.ref_po_id, COALESCE(auth.uid(), NEW.updated_by),
    NULLIF(current_setting('app.alasan', true), '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW public.riwayat_master_bahan WITH (security_invoker = true) AS
SELECT a.bahan_baku_id, a.changed_at, a.changed_by, 'data'::text AS jenis,
       a.tabel, a.aksi, a.perubahan, a.alasan,
       NULL::numeric AS harga_lama, NULL::numeric AS harga_baru, NULL::uuid AS supplier_id
  FROM public.master_bahan_audit a
 WHERE a.bahan_baku_id IS NOT NULL
UNION ALL
SELECT h.bahan_baku_id, h.changed_at, h.changed_by, 'harga_master',
       'bahan_baku_harga', 'UPDATE', NULL::jsonb, h.catatan,
       h.harga_lama, h.harga_baru, NULL::uuid
  FROM public.bahan_baku_harga_history h
UNION ALL
SELECT v.bahan_baku_id, v.changed_at, v.changed_by, 'harga_vendor',
       'bahan_baku_supplier', 'UPDATE',
       jsonb_build_object('satuan_beli', v.satuan_beli, 'isi_satuan_kecil', v.isi_satuan_kecil,
                          'sumber', v.sumber, 'ref_po_id', v.ref_po_id),
       v.catatan, v.harga_lama, v.harga_baru, v.supplier_id
  FROM public.bahan_baku_supplier_history v;

REVOKE ALL ON public.riwayat_master_bahan FROM anon, authenticated;
GRANT SELECT ON public.riwayat_master_bahan TO authenticated;
```

- [ ] **Step 4: Apply, verifikasi katalog, stempel**

Verifikasi:
```sql
SELECT tgname FROM pg_trigger
 WHERE tgname IN ('trg_audit_bahan_baku','trg_audit_bahan_baku_sku','trg_audit_supplier');                -- 3 baris
SELECT reloptions FROM pg_class WHERE relname = 'riwayat_master_bahan';                                    -- {security_invoker=true}
SELECT prosecdef FROM pg_proc WHERE proname = 'master_bahan_tulis_audit';                                  -- true
SELECT position('app.alasan' in prosrc) > 0 FROM pg_proc WHERE proname = 'bbs_tulis_riwayat';             -- true
```
Stempel `('20260923181000','audit_master_bahan')`.

- [ ] **Step 5: Jalankan uji, pastikan LULUS**

Harapan: NOTICE `HASIL T2: LULUS`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260923181000_audit_master_bahan.sql supabase/verifikasi/master_bahan/t2_audit.sql
git commit -m "feat(db): log perubahan master bahan baku + view riwayat"
```

---

### Task 3: Helper peran + penegak invarian faktor & kemasan

**Files:**
- Create: `supabase/migrations/20260923182000_invarian_faktor_bahan.sql`
- Create: `supabase/verifikasi/master_bahan/t3_invarian.sql`

**Interfaces:**
- Produces:
  - `public._peran_master(p_lingkup text) RETURNS uuid`. `p_lingkup` bernilai `'data'` atau `'harga'`. Mengembalikan `auth.uid()` kalau berhak; kalau tidak, melempar `42501`. Hanya untuk dipanggil fungsi DEFINER lain; `EXECUTE` dicabut dari authenticated.
  - `public._kanon_satuan(p text) RETURNS text`. Kanonisasi label satuan, dipakai trigger dan RPC.
  - Trigger `trg_bahan_baku_00_tegakkan_faktor` BEFORE I/U pada `bahan_baku`. Dinamai `00` supaya jalan **sebelum** `trg_bahan_baku_faktor_po`, karena trigger BEFORE berjalan urut abjad. Trigger ini menurunkan `faktor_konversi`, menolak kombinasi satuan yang tidak sah, dan menolak perubahan `faktor_tampilan` pada bahan ber-riwayat stok, kecuali `current_setting('app.ganti_satuan', true) = 'on'` (disiapkan untuk Tahap 3).
  - Trigger `trg_bbh_00_samakan_kemasan` BEFORE I/U pada `bahan_baku_harga`. Memaksa `kemasan_qty = COALESCE(faktor_tampilan,1)` dan `kemasan_satuan = COALESCE(satuan_kecil, satuan)`.

- [ ] **Step 1: Cek data sebelum menulis trigger**

```sql
-- (i) baris yang akan DITOLAK trigger kalau disentuh (harus 0; kalau ada, laporkan ke owner dulu)
SELECT id, nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan
  FROM bahan_baku
 WHERE (NULLIF(btrim(satuan_kecil), '') IS NULL AND NULLIF(btrim(satuan_tengah), '') IS NOT NULL)
    OR (NULLIF(btrim(satuan_kecil), '') IS NOT NULL AND COALESCE(faktor_tampilan, 0) <= 0)
    OR (NULLIF(btrim(satuan_tengah), '') IS NOT NULL AND COALESCE(faktor_tengah, 0) <= 0);
-- (ii) baris yang faktor_konversi-nya AKAN DIUBAH (harapan per 2026-09-23: persis HAND GLOVE,
--      KERTAS STRUK, GALON AIR, KETUMBAR)
SELECT nama, faktor_tengah, faktor_tampilan, faktor_konversi AS lama,
       CASE WHEN NULLIF(btrim(satuan_kecil), '') IS NULL THEN 1
            WHEN NULLIF(btrim(satuan_tengah), '') IS NOT NULL THEN faktor_tampilan / faktor_tengah
            ELSE faktor_tampilan END AS baru
  FROM bahan_baku
 WHERE faktor_konversi IS DISTINCT FROM
       CASE WHEN NULLIF(btrim(satuan_kecil), '') IS NULL THEN 1
            WHEN NULLIF(btrim(satuan_tengah), '') IS NOT NULL THEN faktor_tampilan / faktor_tengah
            ELSE faktor_tampilan END;
-- (iii) pembaca faktor_konversi di DB — pastikan keempat bahan di (ii) tidak lewat jalur itu
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND prosrc ILIKE '%faktor_konversi%';
SELECT b.nama, count(ri.*) AS n_resep FROM bahan_baku b LEFT JOIN resep_item ri ON ri.bahan_baku_id = b.id
 WHERE b.nama IN ('HAND GLOVE','KERTAS STRUK','GALON AIR','KETUMBAR') GROUP BY 1;   -- semua 0
-- (iv) label PO/distribusi yang saat ini sudah bukan salah satu tingkat (dicatat saja;
--      trigger hanya memeriksa saat label/tingkat berubah)
SELECT nama, satuan, satuan_tengah, satuan_kecil, satuan_po, satuan_distribusi FROM bahan_baku
 WHERE (satuan_po IS NOT NULL AND lower(btrim(satuan_po)) NOT IN
          (lower(btrim(satuan)), lower(btrim(coalesce(satuan_tengah,''))), lower(btrim(coalesce(satuan_kecil,'')))))
    OR (satuan_distribusi IS NOT NULL AND lower(btrim(satuan_distribusi)) NOT IN
          (lower(btrim(satuan)), lower(btrim(coalesce(satuan_tengah,''))), lower(btrim(coalesce(satuan_kecil,'')))));
```
Kalau (i) tidak kosong, atau (ii) memuat bahan selain keempat itu: **berhenti**, laporkan daftarnya ke owner. Untuk tiap fungsi di (iii), baca badannya. Pastikan fungsi itu memakai `faktor_konversi` hanya saat `faktor_tengah IS NULL` (pola `trg_process_bom_stok` / `sync_harga_beli_display`). Kalau ada yang memakainya tanpa syarat itu, laporkan ke owner sebelum lanjut. Hasil (iv) disalin ke laporan task: itu daftar bahan yang label PO/distribusinya perlu dirapikan di Tahap 2.

- [ ] **Step 2: Tulis uji**

```sql
-- supabase/verifikasi/master_bahan/t3_invarian.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_id uuid; v_ok boolean; v_admin uuid; v_crew uuid; v_uid uuid; v_hg uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  SELECT id INTO v_hg FROM bahan_baku WHERE nama = 'HAND GLOVE';
  IF v_admin IS NULL OR v_crew IS NULL OR v_hg IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  -- (a) tiga tingkat: faktor_konversi diturunkan
  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, faktor_konversi, kategori)
  VALUES ('UJI T3 A', 'Dus', 'Roll', 48, 'cm', 36480, 999, 'UJI') RETURNING id INTO v_id;
  IF (SELECT faktor_konversi FROM bahan_baku WHERE id = v_id) <> 760 THEN
    RAISE EXCEPTION 'GAGAL (a): faktor_konversi tidak diturunkan';
  END IF;

  -- (b) tanpa satuan kecil → faktor_tampilan NULL, faktor_konversi 1
  INSERT INTO bahan_baku (nama, satuan, kategori, faktor_konversi) VALUES ('UJI T3 B', 'Unit', 'UJI', 50) RETURNING id INTO v_id;
  IF (SELECT faktor_konversi FROM bahan_baku WHERE id = v_id) <> 1
     OR (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_id) IS NOT NULL THEN
    RAISE EXCEPTION 'GAGAL (b): bahan satu tingkat tidak dinormalkan';
  END IF;

  -- (c) tengah tanpa kecil ditolak
  v_ok := false;
  BEGIN
    INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, kategori) VALUES ('UJI T3 C', 'Dus', 'Pack', 10, 'UJI');
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): tengah tanpa kecil diterima'; END IF;

  -- (d) label PO bukan salah satu tingkat ditolak; label sah diterima
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET satuan_po = 'karung' WHERE nama = 'UJI T3 A';
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): satuan_po liar diterima'; END IF;
  UPDATE bahan_baku SET satuan_po = 'roll', satuan_distribusi = 'Roll' WHERE nama = 'UJI T3 A';

  -- (e) faktor_tampilan bahan ber-riwayat ditolak tanpa app.ganti_satuan
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET faktor_tampilan = faktor_tampilan + 1 WHERE id = v_hg;
  EXCEPTION WHEN raise_exception THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): faktor bahan ber-riwayat bisa diubah langsung'; END IF;
  PERFORM set_config('app.ganti_satuan', 'on', true);
  UPDATE bahan_baku SET faktor_tampilan = faktor_tampilan + 1 WHERE id = v_hg;   -- lolos (dibatalkan ROLLBACK)
  PERFORM set_config('app.ganti_satuan', '', true);

  -- (f) keempat bahan sudah konsisten
  IF EXISTS (SELECT 1 FROM bahan_baku
              WHERE nama IN ('KERTAS STRUK','GALON AIR','KETUMBAR')
                AND abs(faktor_konversi * faktor_tengah - faktor_tampilan) > 0.001) THEN
    RAISE EXCEPTION 'GAGAL (f): masih ada bahan melanggar invarian';
  END IF;

  -- (g) kemasan_qty dipaksa sama dengan faktor_tampilan
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty)
  SELECT id, 1000, 1 FROM bahan_baku WHERE nama = 'UJI T3 A';
  IF (SELECT h.kemasan_qty FROM bahan_baku_harga h JOIN bahan_baku b ON b.id = h.bahan_baku_id WHERE b.nama = 'UJI T3 A') <> 36480 THEN
    RAISE EXCEPTION 'GAGAL (g): kemasan_qty tidak disamakan';
  END IF;

  -- (h) _peran_master: admin lolos 'data', crew ditolak 'harga'
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  v_uid := public._peran_master('data');
  IF v_uid IS DISTINCT FROM v_admin THEN RAISE EXCEPTION 'GAGAL (h): admin ditolak'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  v_ok := false;
  BEGIN
    PERFORM public._peran_master('harga');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (h): crew lolos _peran_master'; END IF;
  RAISE NOTICE 'HASIL T3: LULUS';
END $$;
ROLLBACK;
```

(f) sengaja tidak memuat HAND GLOVE, karena (e) sudah mengubah `faktor_tampilan`-nya di dalam transaksi ini.

- [ ] **Step 3: Jalankan uji, pastikan GAGAL**

Harapan: error `GAGAL (a): faktor_konversi tidak diturunkan`.

- [ ] **Step 4: Tulis migration**

```sql
-- supabase/migrations/20260923182000_invarian_faktor_bahan.sql
-- Spec 2026-09-23 K4 + K10.1: invarian faktor ditegakkan server, bukan tangan;
-- satu helper peran untuk semua RPC master.

CREATE OR REPLACE FUNCTION public._peran_master(p_lingkup text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = v_uid AND status = 'active';
  IF p_lingkup = 'data' AND v_role IN ('admin', 'owner') THEN
    RETURN v_uid;
  END IF;
  IF p_lingkup = 'harga' AND v_role IN ('admin', 'owner', 'purchasing') THEN
    RETURN v_uid;
  END IF;
  RAISE EXCEPTION 'Peran % tidak berhak mengubah master bahan baku (lingkup %)', COALESCE(v_role, '-'), p_lingkup
    USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public._peran_master(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._kanon_satuan(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- Sama dengan kanonisasi hitung_faktor_po(): lower + trim + 'bks' -> 'bungkus'.
  SELECT CASE WHEN x = 'bks' THEN 'bungkus' ELSE x END
    FROM (SELECT NULLIF(lower(btrim(COALESCE(p, ''))), '') AS x) s;
$$;

CREATE OR REPLACE FUNCTION public.bahan_baku_tegakkan_faktor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tingkat text[];
  v_satuan_berubah boolean;
BEGIN
  NEW.satuan        := btrim(NEW.satuan);
  NEW.satuan_tengah := NULLIF(btrim(NEW.satuan_tengah), '');
  NEW.satuan_kecil  := NULLIF(btrim(NEW.satuan_kecil), '');

  IF NEW.satuan_kecil IS NULL THEN
    IF NEW.satuan_tengah IS NOT NULL THEN
      RAISE EXCEPTION 'Bahan %: satuan tengah butuh satuan kecil', NEW.nama USING ERRCODE = '23514';
    END IF;
    NEW.faktor_tengah   := NULL;
    NEW.faktor_tampilan := NULL;
    NEW.faktor_konversi := 1;
  ELSE
    IF COALESCE(NEW.faktor_tampilan, 0) <= 0 OR NEW.faktor_tampilan = 'NaN'::numeric THEN
      RAISE EXCEPTION 'Bahan %: isi satuan kecil per satuan besar wajib > 0', NEW.nama USING ERRCODE = '23514';
    END IF;
    IF NEW.satuan_tengah IS NULL THEN
      NEW.faktor_tengah   := NULL;
      NEW.faktor_konversi := NEW.faktor_tampilan;
    ELSE
      IF COALESCE(NEW.faktor_tengah, 0) <= 0 OR NEW.faktor_tengah = 'NaN'::numeric THEN
        RAISE EXCEPTION 'Bahan %: isi satuan tengah per satuan besar wajib > 0', NEW.nama USING ERRCODE = '23514';
      END IF;
      NEW.faktor_konversi := NEW.faktor_tampilan / NEW.faktor_tengah;
    END IF;
  END IF;

  v_satuan_berubah := TG_OP = 'INSERT'
    OR NEW.satuan IS DISTINCT FROM OLD.satuan
    OR NEW.satuan_tengah IS DISTINCT FROM OLD.satuan_tengah
    OR NEW.satuan_kecil IS DISTINCT FROM OLD.satuan_kecil;

  -- Label PO & distribusi wajib salah satu tingkat (getDistribusiFactor() diam-diam
  -- jatuh ke 1 bila tak cocok — kelas bug 48x FOIL). Hanya dicek saat label atau
  -- tingkatnya berubah, supaya data lama tak mengunci edit kolom lain.
  v_tingkat := array_remove(ARRAY[public._kanon_satuan(NEW.satuan), public._kanon_satuan(NEW.satuan_tengah),
                                  public._kanon_satuan(NEW.satuan_kecil)], NULL);
  IF NEW.satuan_po IS NOT NULL
     AND (v_satuan_berubah OR NEW.satuan_po IS DISTINCT FROM OLD.satuan_po)
     AND NOT (public._kanon_satuan(NEW.satuan_po) = ANY (v_tingkat)) THEN
    RAISE EXCEPTION 'Bahan %: satuan PO "%" bukan salah satu tingkat (%)', NEW.nama, NEW.satuan_po,
      array_to_string(v_tingkat, '/') USING ERRCODE = '23514';
  END IF;
  IF NEW.satuan_distribusi IS NOT NULL
     AND (v_satuan_berubah OR NEW.satuan_distribusi IS DISTINCT FROM OLD.satuan_distribusi)
     AND NOT (public._kanon_satuan(NEW.satuan_distribusi) = ANY (v_tingkat)) THEN
    RAISE EXCEPTION 'Bahan %: satuan distribusi "%" bukan salah satu tingkat (%)', NEW.nama, NEW.satuan_distribusi,
      array_to_string(v_tingkat, '/') USING ERRCODE = '23514';
  END IF;

  -- Mengubah faktor penuh bahan ber-riwayat stok mengubah arti qty di dokumen
  -- berjalan & saldo skala besar — hanya lewat prosedur Ganti Satuan (Tahap 3).
  IF TG_OP = 'UPDATE'
     AND NEW.faktor_tampilan IS DISTINCT FROM OLD.faktor_tampilan
     AND COALESCE(current_setting('app.ganti_satuan', true), '') <> 'on'
     AND (EXISTS (SELECT 1 FROM public.ledger_stok WHERE bahan_baku_id = NEW.id)
          OR EXISTS (SELECT 1 FROM public.stok_balance WHERE bahan_baku_id = NEW.id AND saldo <> 0)) THEN
    RAISE EXCEPTION 'Bahan % sudah punya riwayat stok; isi satuannya hanya bisa diubah lewat Ganti Satuan', NEW.nama;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bahan_baku_00_tegakkan_faktor ON public.bahan_baku;
CREATE TRIGGER trg_bahan_baku_00_tegakkan_faktor BEFORE INSERT OR UPDATE ON public.bahan_baku
  FOR EACH ROW EXECUTE FUNCTION public.bahan_baku_tegakkan_faktor();

CREATE OR REPLACE FUNCTION public.bahan_baku_harga_samakan_kemasan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(b.faktor_tampilan, 1), COALESCE(b.satuan_kecil, b.satuan)
    INTO NEW.kemasan_qty, NEW.kemasan_satuan
    FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bbh_00_samakan_kemasan ON public.bahan_baku_harga;
CREATE TRIGGER trg_bbh_00_samakan_kemasan BEFORE INSERT OR UPDATE ON public.bahan_baku_harga
  FOR EACH ROW EXECUTE FUNCTION public.bahan_baku_harga_samakan_kemasan();

-- Rapikan pelanggar yang ada: sentuh baris supaya trigger menurunkan faktor_konversi.
-- faktor_tampilan TIDAK berubah, jadi saldo & ledger tak bergeser.
-- Dibungkus DO supaya set_config lokal dan UPDATE pasti satu transaksi
-- (alat apply bisa menjalankan tiap statement sebagai transaksi sendiri).
DO $$
BEGIN
  PERFORM set_config('app.alasan', 'Invarian faktor (spec 2026-09-23 K4): faktor_konversi diturunkan dari faktor_tampilan / faktor_tengah', true);
  UPDATE public.bahan_baku b
     SET faktor_konversi = b.faktor_konversi
   WHERE b.faktor_konversi IS DISTINCT FROM
         CASE WHEN NULLIF(btrim(b.satuan_kecil), '') IS NULL THEN 1
              WHEN NULLIF(btrim(b.satuan_tengah), '') IS NOT NULL THEN b.faktor_tampilan / b.faktor_tengah
              ELSE b.faktor_tampilan END;
END $$;
```

- [ ] **Step 5: Apply, verifikasi, stempel**

```sql
SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_bahan_baku_00_tegakkan_faktor','trg_bbh_00_samakan_kemasan');   -- 2 baris
SELECT count(*) FROM bahan_baku b
 WHERE b.faktor_konversi IS DISTINCT FROM
       CASE WHEN b.satuan_kecil IS NULL THEN 1
            WHEN b.satuan_tengah IS NOT NULL THEN b.faktor_tampilan / b.faktor_tengah
            ELSE b.faktor_tampilan END;                                                                                -- 0
SELECT count(*) FROM master_bahan_audit WHERE alasan LIKE 'Invarian faktor%';                                         -- = jumlah baris (ii)
```
Stempel `('20260923182000','invarian_faktor_bahan')`.

- [ ] **Step 6: Jalankan uji, pastikan LULUS**

Harapan: `HASIL T3: LULUS`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260923182000_invarian_faktor_bahan.sql supabase/verifikasi/master_bahan/t3_invarian.sql
git commit -m "feat(db): tegakkan invarian faktor satuan & kemasan, helper peran master"
```

---

### Task 4: Harga master diturunkan dari harga vendor

**Files:**
- Create: `supabase/migrations/20260923183000_harga_master_turunan.sql`
- Create: `supabase/verifikasi/master_bahan/t4_harga_turunan.sql`

**Interfaces:**
- Consumes: trigger kemasan dari Task 3. Trigger itu mengisi `kemasan_qty` otomatis saat baris `bahan_baku_harga` ditulis.
- Produces:
  - `public.harga_vendor_terpercaya(p_bahan uuid) RETURNS TABLE(supplier_id uuid, harga_per_besar numeric, harga_updated_at timestamptz, sumber text, ref_po_id uuid)`. Bersifat **SECURITY INVOKER**, sehingga RLS katalog berlaku bagi pemanggil. Mengembalikan paling banyak 1 baris.
  - `public.turunkan_harga_master(p_bahan uuid) RETURNS numeric` (DEFINER). Mengembalikan harga master baru, atau `NULL` kalau dibekukan.
  - Trigger `trg_bbs_00_harga_updated_at` (BEFORE) dan `trg_bbs_turunkan_harga_master` (AFTER I/U/D) pada `bahan_baku_supplier`, plus `trg_supplier_turunkan_harga_master` pada `supplier`.
  - Supplier bernama persis **`Beli Tunai / Tanpa Vendor`**.
  - View `public.bahan_baku_status_harga(bahan_baku_id, nama, harga_master, harga_master_updated_at, status, vendor_terbaru_id, harga_vendor_per_besar)`. `status` bernilai `'terkonfirmasi' | 'belum_dikonfirmasi'`.

- [ ] **Step 1: Tulis uji**

```sql
-- supabase/verifikasi/master_bahan/t4_harga_turunan.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_bahan uuid; v_s1 uuid; v_s2 uuid; v_admin uuid; v_crew uuid; v_bbs uuid; v_h numeric;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role='crew'  AND status='active' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM supplier WHERE nama = 'Beli Tunai / Tanpa Vendor' AND is_active) THEN
    RAISE EXCEPTION 'GAGAL: supplier Beli Tunai / Tanpa Vendor tidak ada';
  END IF;

  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T4 FOIL', 'Dus', 'Roll', 48, 'cm', 36480, 'UJI') RETURNING id INTO v_bahan;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan, 400000);
  INSERT INTO supplier (nama) VALUES ('UJI T4 VENDOR 1') RETURNING id INTO v_s1;
  INSERT INTO supplier (nama) VALUES ('UJI T4 VENDOR 2') RETURNING id INTO v_s2;

  -- (a) baris katalog terpercaya → master = harga / isi × faktor_tampilan
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga)
  VALUES (v_bahan, v_s1, 'roll', 760, 11554) RETURNING id INTO v_bbs;
  SELECT harga_beli INTO v_h FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan;
  IF abs(v_h - 554592) > 0.01 THEN RAISE EXCEPTION 'GAGAL (a): master % bukan 554592', v_h; END IF;
  IF NOT EXISTS (SELECT 1 FROM bahan_baku_harga_history WHERE bahan_baku_id = v_bahan AND catatan LIKE 'Turunan harga vendor%') THEN
    RAISE EXCEPTION 'GAGAL (a): riwayat turunan tak tercatat';
  END IF;
  IF (SELECT harga_updated_at FROM bahan_baku_supplier WHERE id = v_bbs) IS NULL THEN
    RAISE EXCEPTION 'GAGAL (a): harga_updated_at tak terisi';
  END IF;

  -- (b) satu-satunya baris jadi perlu_ditinjau → master DIBEKUKAN, tidak berubah
  UPDATE bahan_baku_supplier SET perlu_ditinjau = true, harga = 1 WHERE id = v_bbs;
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 554592) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (b): master tidak dibekukan';
  END IF;
  IF (SELECT status FROM bahan_baku_status_harga WHERE bahan_baku_id = v_bahan) <> 'belum_dikonfirmasi' THEN
    RAISE EXCEPTION 'GAGAL (b): status bukan belum_dikonfirmasi';
  END IF;

  -- (c) vendor lain yang lebih baru → master mengikutinya
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, harga_updated_at)
  VALUES (v_bahan, v_s2, 'dus', 36480, 600000, now() + interval '1 minute');
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 600000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (c): master tidak mengikuti vendor terbaru';
  END IF;

  -- (d) supplier dinonaktifkan → katalognya tak lagi dianggap terpercaya
  UPDATE supplier SET is_active = false WHERE id = v_s2;
  IF EXISTS (SELECT 1 FROM harga_vendor_terpercaya(v_bahan)) THEN
    RAISE EXCEPTION 'GAGAL (d): vendor nonaktif masih terpercaya';
  END IF;
  UPDATE supplier SET is_active = true WHERE id = v_s2;

  -- (e) crew tak bisa melihat harga vendor lewat fungsi (INVOKER + RLS katalog); admin bisa
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT EXISTS (SELECT 1 FROM harga_vendor_terpercaya(v_bahan)) THEN
    RAISE EXCEPTION 'GAGAL (e): admin tak melihat harga vendor';
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM harga_vendor_terpercaya(v_bahan)) THEN
    RAISE EXCEPTION 'GAGAL (e): crew melihat harga vendor';
  END IF;
  RAISE NOTICE 'HASIL T4: LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan GAGAL**

Harapan: error `GAGAL: supplier Beli Tunai / Tanpa Vendor tidak ada`.

- [ ] **Step 3: Tulis migration**

```sql
-- supabase/migrations/20260923183000_harga_master_turunan.sql
-- Spec 2026-09-23 K5/K6: harga hanya diketik per vendor; harga master dihitung =
-- harga vendor TERPERCAYA yang paling baru diperbarui, dikonversi ke satuan besar.
-- Bila tak ada vendor terpercaya, master DIBEKUKAN di nilai terakhirnya.
-- bahan_baku_harga tetap tabel sungguhan (16 pembaca tak diubah); kini ditulis sistem.
-- Jalur lama (verifikasi_terima_po, sahkan_nota_vendor) tetap menulis master
-- langsung; nilainya sama dengan turunan karena keduanya juga menulis katalog.

CREATE OR REPLACE FUNCTION public.bbs_isi_harga_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.harga_updated_at := COALESCE(NEW.harga_updated_at, now());
  ELSIF NEW.harga IS DISTINCT FROM OLD.harga
        AND NEW.harga_updated_at IS NOT DISTINCT FROM OLD.harga_updated_at THEN
    NEW.harga_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bbs_00_harga_updated_at ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_00_harga_updated_at BEFORE INSERT OR UPDATE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_isi_harga_updated_at();

-- INVOKER: RLS katalog vendor berlaku bagi pemanggil (crew tak boleh melihat harga vendor).
CREATE OR REPLACE FUNCTION public.harga_vendor_terpercaya(p_bahan uuid)
RETURNS TABLE (supplier_id uuid, harga_per_besar numeric, harga_updated_at timestamptz, sumber text, ref_po_id uuid)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.supplier_id,
         s.harga / s.isi_satuan_kecil * COALESCE(b.faktor_tampilan, 1),
         s.harga_updated_at, s.sumber, s.ref_po_id
    FROM public.bahan_baku_supplier s
    JOIN public.bahan_baku b ON b.id = s.bahan_baku_id
    JOIN public.supplier  sp ON sp.id = s.supplier_id
   WHERE s.bahan_baku_id = p_bahan
     AND s.is_active AND sp.is_active
     AND NOT s.perlu_ditinjau
     AND s.harga > 0 AND s.harga <> 'NaN'::numeric
     AND s.isi_satuan_kecil > 0 AND s.isi_satuan_kecil <> 'NaN'::numeric
   ORDER BY s.harga_updated_at DESC NULLS LAST, s.updated_at DESC, s.id DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.harga_vendor_terpercaya(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harga_vendor_terpercaya(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.turunkan_harga_master(p_bahan uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       record;
  v_lama  numeric;
  v_baru  numeric;
  v_nama  text;
BEGIN
  SELECT * INTO r FROM public.harga_vendor_terpercaya(p_bahan);
  IF NOT FOUND THEN
    RETURN NULL;   -- K6: dibekukan
  END IF;

  v_baru := round(r.harga_per_besar, 4);
  SELECT harga_beli INTO v_lama FROM public.bahan_baku_harga WHERE bahan_baku_id = p_bahan;
  IF v_lama IS NOT NULL AND abs(v_lama - v_baru) < 0.01 THEN
    RETURN v_lama;
  END IF;

  SELECT nama INTO v_nama FROM public.supplier WHERE id = r.supplier_id;
  INSERT INTO public.bahan_baku_harga (bahan_baku_id, harga_beli, harga_updated_at, updated_by)
  VALUES (p_bahan, v_baru, now(), auth.uid())
  ON CONFLICT (bahan_baku_id) DO UPDATE
     SET harga_beli = EXCLUDED.harga_beli,
         harga_updated_at = EXCLUDED.harga_updated_at,
         updated_by = EXCLUDED.updated_by;

  INSERT INTO public.bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, ref_po_id, catatan, changed_by)
  VALUES (p_bahan, v_lama, v_baru, r.ref_po_id,
          'Turunan harga vendor ' || COALESCE(v_nama, '?') || ' (sumber ' || COALESCE(r.sumber, '?') || ')'
            || COALESCE(' — ' || NULLIF(current_setting('app.alasan', true), ''), ''),
          auth.uid());
  RETURN v_baru;
END;
$$;
REVOKE ALL ON FUNCTION public.turunkan_harga_master(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bbs_picu_turunan_harga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.turunkan_harga_master(COALESCE(NEW.bahan_baku_id, OLD.bahan_baku_id));
  IF TG_OP = 'UPDATE' AND NEW.bahan_baku_id IS DISTINCT FROM OLD.bahan_baku_id THEN
    PERFORM public.turunkan_harga_master(OLD.bahan_baku_id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bbs_picu_turunan_harga() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bbs_turunkan_harga_master ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_turunkan_harga_master AFTER INSERT OR UPDATE OR DELETE ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_picu_turunan_harga();

-- Supplier aktif/nonaktif mengubah siapa yang terpercaya.
CREATE OR REPLACE FUNCTION public.supplier_picu_turunan_harga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.turunkan_harga_master(s.bahan_baku_id)
       FROM public.bahan_baku_supplier s WHERE s.supplier_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_picu_turunan_harga() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_supplier_turunkan_harga_master ON public.supplier;
CREATE TRIGGER trg_supplier_turunkan_harga_master AFTER UPDATE OF is_active ON public.supplier
  FOR EACH ROW EXECUTE FUNCTION public.supplier_picu_turunan_harga();

-- K5: tempat harga untuk bahan tanpa vendor / dibeli tunai.
INSERT INTO public.supplier (nama, kategori, catatan, termin_hari, is_active)
SELECT 'Beli Tunai / Tanpa Vendor', 'internal',
       'Harga bahan yang dibeli tunai atau belum punya vendor tetap (spec 2026-09-23 K5).', 0, true
 WHERE NOT EXISTS (SELECT 1 FROM public.supplier WHERE nama = 'Beli Tunai / Tanpa Vendor');

CREATE OR REPLACE VIEW public.bahan_baku_status_harga WITH (security_invoker = true) AS
SELECT b.id AS bahan_baku_id,
       b.nama,
       h.harga_beli AS harga_master,
       h.harga_updated_at AS harga_master_updated_at,
       CASE WHEN t.supplier_id IS NULL THEN 'belum_dikonfirmasi' ELSE 'terkonfirmasi' END AS status,
       t.supplier_id AS vendor_terbaru_id,
       t.harga_per_besar AS harga_vendor_per_besar
  FROM public.bahan_baku b
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = b.id
  LEFT JOIN LATERAL public.harga_vendor_terpercaya(b.id) t ON true
 WHERE b.is_active;
REVOKE ALL ON public.bahan_baku_status_harga FROM anon, authenticated;
GRANT SELECT ON public.bahan_baku_status_harga TO authenticated;
```

- [ ] **Step 4: Apply, verifikasi, stempel**

```sql
SELECT tgname FROM pg_trigger WHERE tgname IN
  ('trg_bbs_00_harga_updated_at','trg_bbs_turunkan_harga_master','trg_supplier_turunkan_harga_master');   -- 3
SELECT prosecdef FROM pg_proc WHERE proname = 'harga_vendor_terpercaya';                                   -- false
SELECT status, count(*) FROM bahan_baku_status_harga GROUP BY 1;
  -- harapan sekitar 23 terkonfirmasi / 25 belum_dikonfirmasi (48 bahan aktif, angka 2026-09-23)
```
Stempel `('20260923183000','harga_master_turunan')`.

**Migration ini TIDAK menulis ulang harga master yang sudah ada.** Trigger hanya menyala saat katalog berubah.

- [ ] **Step 5: Jalankan uji, pastikan LULUS**

Harapan: `HASIL T4: LULUS`.

- [ ] **Step 6: Siapkan daftar selisih untuk owner (JANGAN diterapkan)**

```sql
SELECT b.nama, h.harga_beli AS master_sekarang, t.harga_per_besar AS turunan,
       s.nama AS vendor, t.harga_updated_at AS vendor_diperbarui, h.harga_updated_at AS master_diperbarui,
       round((t.harga_per_besar - h.harga_beli) / NULLIF(h.harga_beli, 0) * 100, 1) AS selisih_pct
  FROM bahan_baku b
  JOIN LATERAL harga_vendor_terpercaya(b.id) t ON true
  LEFT JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
  LEFT JOIN supplier s ON s.id = t.supplier_id
 WHERE b.is_active AND (h.harga_beli IS NULL OR abs(h.harga_beli - t.harga_per_besar) >= 0.01)
 ORDER BY abs(COALESCE(h.harga_beli, 0) - t.harga_per_besar) DESC;
```
Tempel hasilnya ke laporan akhir task. Penyelarasan massal:
```sql
DO $$
BEGIN
  PERFORM set_config('app.alasan', 'Penyelarasan awal harga master ke vendor (disetujui owner)', true);
  PERFORM public.turunkan_harga_master(id) FROM public.bahan_baku WHERE is_active;
END $$;
```
**Blok ini hanya dijalankan setelah owner menyetujui daftar di atas.** Tanpa itu, harga master menyatu sendiri saat katalog diperbarui.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260923183000_harga_master_turunan.sql supabase/verifikasi/master_bahan/t4_harga_turunan.sql
git commit -m "feat(db): harga master diturunkan dari harga vendor terpercaya + pembekuan"
```

---

### Task 5: RPC data bahan & SKU

**Files:**
- Create: `supabase/migrations/20260923184000_rpc_master_bahan_data.sql`
- Create: `supabase/verifikasi/master_bahan/t5_rpc_data.sql`

**Interfaces:**
- Consumes: `_peran_master`, trigger invarian (Task 3), `app.alasan` yang ditangkap audit (Task 2).
- Produces (semua `SECURITY DEFINER`, `EXECUTE` hanya untuk `authenticated`):
  - `simpan_bahan_baku(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL) RETURNS uuid`
    - `p_id NULL` berarti buat baru.
    - Kunci `p_data` yang diizinkan: `nama, merek, kategori, peruntukan, is_opname, default_reorder_point, satuan, satuan_tengah, faktor_tengah, satuan_kecil, isi_kecil_per_tengah, satuan_po, satuan_distribusi, image_url, image_url_tengah, image_url_kecil, image_urls`.
    - Kunci satuan harus dikirim sebagai **satu set**: `satuan` dan `isi_kecil_per_tengah` wajib ada bila salah satu kunci satuan dikirim, juga saat membuat bahan baru. Semantiknya sama dengan `turunkanFaktorSatuan()` di `apps/admin-dashboard/src/lib/satuanBahan.ts`: `isi_kecil_per_tengah` = isi satuan kecil per satuan tengah, atau per satuan besar bila tanpa tengah.
  - `nonaktifkan_bahan_baku(p_id uuid, p_alasan text) RETURNS void` dan `aktifkan_bahan_baku(p_id uuid, p_alasan text) RETURNS void`
  - `hapus_bahan_baku(p_id uuid, p_alasan text) RETURNS void`
  - `simpan_sku(p_id uuid, p_bahan_baku_id uuid, p_data jsonb) RETURNS uuid`. Kunci yang diizinkan: `nama_kemasan, qty_isi, harga_beli, tingkatan_satuan, image_url, satuan_tengah, faktor_tengah, is_active`.
  - `set_default_sku(p_id uuid) RETURNS void` dan `hapus_sku(p_id uuid) RETURNS void`

- [ ] **Step 1: Tulis uji**

```sql
-- supabase/verifikasi/master_bahan/t5_rpc_data.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_admin uuid; v_purch uuid; v_id uuid; v_id2 uuid; v_ok boolean; v_hg uuid; v_sku uuid; v_msg text;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_purch FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_hg FROM bahan_baku WHERE nama = 'HAND GLOVE';
  IF v_admin IS NULL OR v_purch IS NULL OR v_hg IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) buat bahan tiga tingkat; faktor dihitung server
  v_id := public.simpan_bahan_baku(NULL, jsonb_build_object(
    'nama','UJI T5 FOIL','kategori','UJI','satuan','Dus','satuan_tengah','Roll','faktor_tengah',48,
    'satuan_kecil','cm','isi_kecil_per_tengah',760,'satuan_po','roll','peruntukan','keduanya'), 'uji t5 buat');
  IF (SELECT faktor_tampilan FROM bahan_baku WHERE id = v_id) <> 36480
     OR (SELECT faktor_konversi FROM bahan_baku WHERE id = v_id) <> 760 THEN
    RAISE EXCEPTION 'GAGAL (a): faktor salah';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM master_bahan_audit WHERE baris_id = v_id AND aksi = 'INSERT' AND alasan = 'uji t5 buat') THEN
    RAISE EXCEPTION 'GAGAL (a): audit INSERT tak tercatat';
  END IF;

  -- (b) nama kembar (aktif, beda huruf) ditolak
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(NULL, jsonb_build_object('nama','uji t5 foil','kategori','UJI','satuan','Pcs','isi_kecil_per_tengah',1), NULL);
  EXCEPTION WHEN unique_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (b): nama kembar diterima'; END IF;

  -- (c) kunci liar ditolak
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(v_id, jsonb_build_object('faktor_konversi', 5), NULL);
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): kunci liar diterima'; END IF;

  -- (d) ubah batas minimum & ikut opname
  PERFORM public.simpan_bahan_baku(v_id, jsonb_build_object('default_reorder_point', 2, 'is_opname', false), 'uji t5 edit');
  IF (SELECT default_reorder_point FROM bahan_baku WHERE id = v_id) <> 2
     OR (SELECT is_opname FROM bahan_baku WHERE id = v_id) THEN
    RAISE EXCEPTION 'GAGAL (d): edit tak tersimpan';
  END IF;

  -- (e) satuan bahan ber-riwayat stok tak bisa diubah lewat simpan
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(v_hg, jsonb_build_object('satuan','Dus','satuan_tengah','Box','faktor_tengah',50,
      'satuan_kecil','Lembar','isi_kecil_per_tengah',100), 'uji');
  EXCEPTION WHEN raise_exception THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (e): satuan ber-riwayat bisa diubah'; END IF;

  -- (f) SKU: buat, jadikan default, hapus
  v_sku := public.simpan_sku(NULL, v_id, jsonb_build_object('nama_kemasan','Dus','qty_isi',1,'harga_beli',0));
  PERFORM public.set_default_sku(v_sku);
  IF NOT (SELECT is_default FROM bahan_baku_sku WHERE id = v_sku) THEN RAISE EXCEPTION 'GAGAL (f): default'; END IF;
  PERFORM public.hapus_sku(v_sku);

  -- (g) bahan baru tanpa referensi bisa dihapus
  PERFORM public.hapus_bahan_baku(v_id, 'uji t5 hapus');
  IF EXISTS (SELECT 1 FROM bahan_baku WHERE id = v_id) THEN RAISE EXCEPTION 'GAGAL (g): tak terhapus'; END IF;

  -- (h) bahan ber-riwayat tak bisa dihapus, pesannya menyebut penghalang
  v_ok := false;
  BEGIN
    PERFORM public.hapus_bahan_baku(v_hg, 'uji');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
  END;
  IF NOT v_ok OR v_msg NOT LIKE '%ledger_stok%' THEN RAISE EXCEPTION 'GAGAL (h): %', v_msg; END IF;

  -- (i) nonaktifkan ditolak bila saldo ≠ 0
  IF EXISTS (SELECT 1 FROM stok_balance WHERE bahan_baku_id = v_hg AND saldo <> 0) THEN
    v_ok := false;
    BEGIN
      PERFORM public.nonaktifkan_bahan_baku(v_hg, 'uji');
    EXCEPTION WHEN raise_exception THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (i): nonaktif bahan bersaldo diterima'; END IF;
  END IF;

  -- (j) bahan bersih bisa dinonaktifkan & diaktifkan lagi; alasan kosong ditolak
  v_id2 := public.simpan_bahan_baku(NULL, jsonb_build_object('nama','UJI T5 BERSIH','kategori','UJI','satuan','Pcs','isi_kecil_per_tengah',1), NULL);
  v_ok := false;
  BEGIN
    PERFORM public.nonaktifkan_bahan_baku(v_id2, ' ');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (j): nonaktif tanpa alasan diterima'; END IF;
  PERFORM public.nonaktifkan_bahan_baku(v_id2, 'uji t5 nonaktif');
  IF (SELECT is_active FROM bahan_baku WHERE id = v_id2) THEN RAISE EXCEPTION 'GAGAL (j): tetap aktif'; END IF;
  PERFORM public.aktifkan_bahan_baku(v_id2, 'uji t5 aktif');

  -- (k) purchasing ditolak untuk lingkup data
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN
    PERFORM public.simpan_bahan_baku(v_id2, jsonb_build_object('nama','X'), NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (k): purchasing bisa ubah data bahan'; END IF;
  RAISE NOTICE 'HASIL T5: LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan GAGAL**

Harapan: error `function public.simpan_bahan_baku(...) does not exist`.

- [ ] **Step 3: Tulis migration**

```sql
-- supabase/migrations/20260923184000_rpc_master_bahan_data.sql
-- Spec 2026-09-23 K1/K4/K7/K8/K10: satu-satunya jalur tulis data bahan & SKU untuk layar
-- Tahap 2. Cek peran di DALAM fungsi (_peran_master), alasan dicatat ke audit.

CREATE OR REPLACE FUNCTION public._bahan_punya_riwayat_stok(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ledger_stok WHERE bahan_baku_id = p_id)
      OR EXISTS (SELECT 1 FROM public.stok_balance WHERE bahan_baku_id = p_id AND saldo <> 0);
$$;
REVOKE ALL ON FUNCTION public._bahan_punya_riwayat_stok(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.simpan_bahan_baku(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh  constant text[] := ARRAY['nama','merek','kategori','peruntukan','is_opname','default_reorder_point',
    'satuan','satuan_tengah','faktor_tengah','satuan_kecil','isi_kecil_per_tengah','satuan_po','satuan_distribusi',
    'image_url','image_url_tengah','image_url_kecil','image_urls'];
  c_satuan constant text[] := ARRAY['satuan','satuan_tengah','faktor_tengah','satuan_kecil','isi_kecil_per_tengah'];
  v_kunci    text;
  v_lama     public.bahan_baku%ROWTYPE;
  v_id       uuid;
  v_nama     text;
  v_satuan   text;
  v_tengah   text;
  v_ft       numeric;
  v_kecil    text;
  v_isi      numeric;
  v_tampilan numeric;
BEGIN
  PERFORM public._peran_master('data');
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'p_data harus objek JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_bahan_baku', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;
  PERFORM set_config('app.alasan', COALESCE(p_alasan, ''), true);

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_lama FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  END IF;

  -- Nama unik di antara bahan aktif (beda huruf/spasi dianggap sama).
  v_nama := btrim(COALESCE(p_data ->> 'nama', v_lama.nama));
  IF COALESCE(v_nama, '') = '' THEN RAISE EXCEPTION 'Nama bahan wajib diisi' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.bahan_baku
              WHERE is_active AND lower(btrim(nama)) = lower(v_nama)
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Sudah ada bahan aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;

  -- Satuan dikirim sebagai satu set; semantik = turunkanFaktorSatuan() (satuanBahan.ts).
  IF p_data ?| c_satuan OR p_id IS NULL THEN
    IF NOT (p_data ? 'satuan' AND p_data ? 'isi_kecil_per_tengah') THEN
      RAISE EXCEPTION 'Satuan dikirim sebagai satu set: satuan dan isi_kecil_per_tengah wajib ada' USING ERRCODE = '22023';
    END IF;
    v_satuan := btrim(p_data ->> 'satuan');
    v_tengah := NULLIF(btrim(p_data ->> 'satuan_tengah'), '');
    v_ft     := NULLIF(p_data ->> 'faktor_tengah', '')::numeric;
    v_kecil  := NULLIF(btrim(p_data ->> 'satuan_kecil'), '');
    v_isi    := NULLIF(p_data ->> 'isi_kecil_per_tengah', '')::numeric;
    IF COALESCE(v_satuan, '') = '' THEN RAISE EXCEPTION 'Satuan besar wajib diisi' USING ERRCODE = '22023'; END IF;

    IF v_tengah IS NULL OR (lower(v_tengah) = lower(v_satuan) AND COALESCE(v_ft, 1) = 1) THEN
      v_tengah := NULL; v_ft := NULL; v_tampilan := v_isi;
    ELSE
      v_tampilan := v_ft * v_isi;
    END IF;
    IF v_kecil IS NULL THEN
      v_tampilan := NULL;
    END IF;

    IF p_id IS NOT NULL AND public._bahan_punya_riwayat_stok(p_id) AND (
         v_satuan   IS DISTINCT FROM v_lama.satuan
      OR v_tengah   IS DISTINCT FROM v_lama.satuan_tengah
      OR v_ft       IS DISTINCT FROM v_lama.faktor_tengah
      OR v_kecil    IS DISTINCT FROM v_lama.satuan_kecil
      OR v_tampilan IS DISTINCT FROM v_lama.faktor_tampilan) THEN
      RAISE EXCEPTION 'Bahan "%" sudah punya riwayat stok; satuannya hanya bisa diubah lewat Ganti Satuan', v_lama.nama;
    END IF;
  ELSE
    v_satuan := v_lama.satuan; v_tengah := v_lama.satuan_tengah; v_ft := v_lama.faktor_tengah;
    v_kecil := v_lama.satuan_kecil; v_tampilan := v_lama.faktor_tampilan;
  END IF;

  IF p_id IS NULL THEN
    IF COALESCE(btrim(p_data ->> 'kategori'), '') = '' THEN
      RAISE EXCEPTION 'Kategori wajib diisi' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.bahan_baku (
      nama, merek, kategori, peruntukan, is_opname, default_reorder_point,
      satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
      satuan_po, satuan_distribusi, image_url, image_url_tengah, image_url_kecil, image_urls,
      is_active, is_fisik_checked)
    VALUES (
      v_nama, p_data ->> 'merek', btrim(p_data ->> 'kategori'),
      COALESCE(p_data ->> 'peruntukan', 'outlet'),
      COALESCE((p_data ->> 'is_opname')::boolean, true),
      COALESCE((p_data ->> 'default_reorder_point')::numeric, 0),
      v_satuan, v_tengah, v_ft, v_kecil, v_tampilan,
      p_data ->> 'satuan_po', p_data ->> 'satuan_distribusi',
      p_data ->> 'image_url', p_data ->> 'image_url_tengah', p_data ->> 'image_url_kecil',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_data -> 'image_urls')), '{}'::text[]),
      true, false)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.bahan_baku SET
    nama                  = v_nama,
    merek                 = CASE WHEN p_data ? 'merek' THEN p_data ->> 'merek' ELSE merek END,
    kategori              = CASE WHEN p_data ? 'kategori' THEN btrim(p_data ->> 'kategori') ELSE kategori END,
    peruntukan            = CASE WHEN p_data ? 'peruntukan' THEN p_data ->> 'peruntukan' ELSE peruntukan END,
    is_opname             = CASE WHEN p_data ? 'is_opname' THEN (p_data ->> 'is_opname')::boolean ELSE is_opname END,
    default_reorder_point = CASE WHEN p_data ? 'default_reorder_point'
                                 THEN (p_data ->> 'default_reorder_point')::numeric ELSE default_reorder_point END,
    satuan = v_satuan, satuan_tengah = v_tengah, faktor_tengah = v_ft,
    satuan_kecil = v_kecil, faktor_tampilan = v_tampilan,
    satuan_po             = CASE WHEN p_data ? 'satuan_po' THEN p_data ->> 'satuan_po' ELSE satuan_po END,
    satuan_distribusi     = CASE WHEN p_data ? 'satuan_distribusi' THEN p_data ->> 'satuan_distribusi' ELSE satuan_distribusi END,
    image_url             = CASE WHEN p_data ? 'image_url' THEN p_data ->> 'image_url' ELSE image_url END,
    image_url_tengah      = CASE WHEN p_data ? 'image_url_tengah' THEN p_data ->> 'image_url_tengah' ELSE image_url_tengah END,
    image_url_kecil       = CASE WHEN p_data ? 'image_url_kecil' THEN p_data ->> 'image_url_kecil' ELSE image_url_kecil END,
    image_urls            = CASE WHEN p_data ? 'image_urls'
                                 THEN COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_data -> 'image_urls')), '{}'::text[])
                                 ELSE image_urls END
  WHERE id = p_id;
  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nonaktifkan_bahan_baku(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_halang text[] := '{}';
  v_teks   text;
  v_n      int;
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;

  -- trg_process_bom_stok tidak menyaring is_active: bahan di resep aktif tetap dipotong.
  SELECT string_agg(DISTINCT r.nama, ', ') INTO v_teks
    FROM public.resep_item ri JOIN public.resep r ON r.id = ri.resep_id
   WHERE ri.bahan_baku_id = p_id AND r.is_active;
  IF v_teks IS NOT NULL THEN v_halang := v_halang || ('masih dipakai resep aktif: ' || v_teks); END IF;

  SELECT count(*) INTO v_n FROM public.surat_jalan_item si JOIN public.surat_jalan s ON s.id = si.surat_jalan_id
   WHERE si.bahan_baku_id = p_id AND s.status IN ('draft', 'dikirim');
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris surat jalan draft/dikirim'); END IF;

  SELECT count(*) INTO v_n FROM public.purchase_order_item pi JOIN public.purchase_order p ON p.id = pi.purchase_order_id
   WHERE pi.bahan_baku_id = p_id AND p.status NOT IN ('diterima_lengkap', 'dibatalkan');
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris PO terbuka'); END IF;

  SELECT count(*) INTO v_n FROM public.permintaan_bahan_item pi JOIN public.permintaan_bahan p ON p.id = pi.permintaan_id
   WHERE pi.bahan_baku_id = p_id AND p.status = 'menunggu';
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris permintaan menunggu'); END IF;

  SELECT count(*) INTO v_n FROM public.opname_item oi JOIN public.opname o ON o.id = oi.opname_id
   WHERE oi.bahan_baku_id = p_id AND o.status = 'draft';
  IF v_n > 0 THEN v_halang := v_halang || (v_n || ' baris draft opname'); END IF;

  SELECT string_agg(o.nama, ', ') INTO v_teks
    FROM public.stok_balance sb JOIN public.outlets o ON o.id = sb.outlet_id
   WHERE sb.bahan_baku_id = p_id AND sb.saldo <> 0;
  IF v_teks IS NOT NULL THEN v_halang := v_halang || ('saldo belum nol di: ' || v_teks); END IF;

  IF array_length(v_halang, 1) > 0 THEN
    RAISE EXCEPTION 'Tidak bisa dinonaktifkan — %', array_to_string(v_halang, '; ');
  END IF;

  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku SET is_active = false WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.aktifkan_bahan_baku(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_nama text;
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  SELECT nama INTO v_nama FROM public.bahan_baku WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.bahan_baku WHERE is_active AND id <> p_id
                AND lower(btrim(nama)) = lower(btrim(v_nama))) THEN
    RAISE EXCEPTION 'Sudah ada bahan aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;
  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku SET is_active = true WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hapus_bahan_baku(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        record;
  v_n      bigint;
  v_halang text[] := '{}';
BEGIN
  PERFORM public._peran_master('data');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;

  -- Semua tabel yang merujuk bahan_baku, kecuali lampiran milik bahan itu sendiri.
  -- Dibaca dari katalog supaya tabel perujuk baru otomatis ikut dijaga.
  FOR r IN
    SELECT c.conrelid::regclass AS tabel, a.attname AS kolom
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.confrelid = 'public.bahan_baku'::regclass AND c.contype = 'f'
       AND c.conrelid NOT IN ('public.bahan_baku_harga'::regclass, 'public.bahan_baku_harga_history'::regclass,
                              'public.bahan_baku_sku'::regclass, 'public.stok_balance'::regclass,
                              'public.outlet_reorder_point'::regclass)
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tabel, r.kolom) INTO v_n USING p_id;
    IF v_n > 0 THEN v_halang := v_halang || format('%s (%s baris)', r.tabel, v_n); END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM public.stok_balance WHERE bahan_baku_id = p_id AND saldo <> 0;
  IF v_n > 0 THEN v_halang := v_halang || format('stok_balance bersaldo (%s baris)', v_n); END IF;

  IF array_length(v_halang, 1) > 0 THEN
    RAISE EXCEPTION 'Bahan sudah pernah dipakai, tidak bisa dihapus (nonaktifkan saja) — %', array_to_string(v_halang, '; ');
  END IF;

  PERFORM set_config('app.alasan', p_alasan, true);
  DELETE FROM public.bahan_baku WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.simpan_sku(p_id uuid, p_bahan_baku_id uuid, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh constant text[] := ARRAY['nama_kemasan','qty_isi','harga_beli','tingkatan_satuan','image_url',
                                   'satuan_tengah','faktor_tengah','is_active'];
  v_kunci text;
  v_id    uuid;
BEGIN
  PERFORM public._peran_master('data');
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_sku', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_id IS NULL THEN
    IF COALESCE(btrim(p_data ->> 'nama_kemasan'), '') = '' OR COALESCE((p_data ->> 'qty_isi')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'nama_kemasan dan qty_isi (> 0) wajib diisi' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.bahan_baku_sku (bahan_baku_id, nama_kemasan, qty_isi, harga_beli, tingkatan_satuan,
                                       image_url, satuan_tengah, faktor_tengah, is_active, is_default)
    VALUES (p_bahan_baku_id, btrim(p_data ->> 'nama_kemasan'), (p_data ->> 'qty_isi')::numeric,
            COALESCE((p_data ->> 'harga_beli')::numeric, 0), p_data ->> 'tingkatan_satuan',
            p_data ->> 'image_url', p_data ->> 'satuan_tengah', (p_data ->> 'faktor_tengah')::numeric,
            COALESCE((p_data ->> 'is_active')::boolean, true), false)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.bahan_baku_sku SET
    nama_kemasan     = CASE WHEN p_data ? 'nama_kemasan' THEN btrim(p_data ->> 'nama_kemasan') ELSE nama_kemasan END,
    qty_isi          = CASE WHEN p_data ? 'qty_isi' THEN (p_data ->> 'qty_isi')::numeric ELSE qty_isi END,
    harga_beli       = CASE WHEN p_data ? 'harga_beli' THEN (p_data ->> 'harga_beli')::numeric ELSE harga_beli END,
    tingkatan_satuan = CASE WHEN p_data ? 'tingkatan_satuan' THEN p_data ->> 'tingkatan_satuan' ELSE tingkatan_satuan END,
    image_url        = CASE WHEN p_data ? 'image_url' THEN p_data ->> 'image_url' ELSE image_url END,
    satuan_tengah    = CASE WHEN p_data ? 'satuan_tengah' THEN p_data ->> 'satuan_tengah' ELSE satuan_tengah END,
    faktor_tengah    = CASE WHEN p_data ? 'faktor_tengah' THEN (p_data ->> 'faktor_tengah')::numeric ELSE faktor_tengah END,
    is_active        = CASE WHEN p_data ? 'is_active' THEN (p_data ->> 'is_active')::boolean ELSE is_active END
  WHERE id = p_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'SKU % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_sku(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_bahan uuid;
BEGIN
  PERFORM public._peran_master('data');
  SELECT bahan_baku_id INTO v_bahan FROM public.bahan_baku_sku WHERE id = p_id;
  IF v_bahan IS NULL THEN RAISE EXCEPTION 'SKU % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  UPDATE public.bahan_baku_sku SET is_default = (id = p_id) WHERE bahan_baku_id = v_bahan;
END;
$$;

CREATE OR REPLACE FUNCTION public.hapus_sku(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._peran_master('data');
  DELETE FROM public.bahan_baku_sku WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKU % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_bahan_baku(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nonaktifkan_bahan_baku(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aktifkan_bahan_baku(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hapus_bahan_baku(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simpan_sku(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_default_sku(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hapus_sku(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_bahan_baku(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nonaktifkan_bahan_baku(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aktifkan_bahan_baku(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hapus_bahan_baku(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simpan_sku(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_sku(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hapus_sku(uuid) TO authenticated;
```

- [ ] **Step 4: Apply, verifikasi, stempel**

```sql
SELECT proname, prosecdef FROM pg_proc
 WHERE proname IN ('simpan_bahan_baku','nonaktifkan_bahan_baku','aktifkan_bahan_baku','hapus_bahan_baku',
                   'simpan_sku','set_default_sku','hapus_sku');                                   -- 7 baris, semua true
SELECT has_function_privilege('anon', 'public.simpan_bahan_baku(uuid,jsonb,text)', 'EXECUTE');   -- false
```
Stempel `('20260923184000','rpc_master_bahan_data')`.

- [ ] **Step 5: Jalankan uji, pastikan LULUS**

Harapan: `HASIL T5: LULUS`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260923184000_rpc_master_bahan_data.sql supabase/verifikasi/master_bahan/t5_rpc_data.sql
git commit -m "feat(db): RPC simpan/nonaktif/hapus bahan baku & SKU dengan cek peran"
```

---

### Task 6: RPC harga vendor & supplier

**Files:**
- Create: `supabase/migrations/20260923185000_rpc_master_bahan_vendor.sql`
- Create: `supabase/verifikasi/master_bahan/t6_rpc_vendor.sql`

**Interfaces:**
- Consumes: `_peran_master('harga')`; trigger turunan harga (Task 4); `hitung_faktor_po()` yang sudah live; `bbs_tulis_riwayat` yang membawa alasan (Task 2).
- Produces (DEFINER, `EXECUTE` untuk `authenticated`):
  - `simpan_harga_vendor(p_bahan uuid, p_supplier uuid, p_harga numeric, p_satuan_beli text, p_isi_satuan_kecil numeric, p_alasan text, p_paksa boolean DEFAULT false) RETURNS uuid` (id baris katalog)
  - `nonaktifkan_harga_vendor(p_id uuid, p_alasan text) RETURNS void`
  - `simpan_supplier(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL) RETURNS uuid`. Kunci yang diizinkan: `nama, kontak, alamat, kategori, catatan, termin_hari, vendor_induk_id`.
  - `nonaktifkan_supplier(p_id uuid, p_alasan text) RETURNS void`

- [ ] **Step 1: Tulis uji**

```sql
-- supabase/verifikasi/master_bahan/t6_rpc_vendor.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_purch uuid; v_kitchen uuid; v_bahan uuid; v_sup uuid; v_bbs uuid; v_ok boolean; v_msg text;
BEGIN
  SELECT id INTO v_purch   FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_kitchen FROM outlet_staff WHERE role='kitchen'    AND status='active' LIMIT 1;
  IF v_purch IS NULL OR v_kitchen IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture staf'; END IF;

  INSERT INTO bahan_baku (nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, kategori)
  VALUES ('UJI T6 FOIL', 'Dus', 'Roll', 48, 'cm', 36480, 'UJI') RETURNING id INTO v_bahan;
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli) VALUES (v_bahan, 554592);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) purchasing membuat supplier & harga vendor; master ikut, riwayat membawa alasan
  v_sup := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T6 VENDOR','termin_hari',15), 'uji t6 supplier');
  v_bbs := public.simpan_harga_vendor(v_bahan, v_sup, 12000, 'roll', 760, 'uji t6 harga naik');
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan) - 576000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (a): master tak mengikuti (%)', (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bahan_baku_supplier_history WHERE bahan_baku_supplier_id = v_bbs AND catatan = 'uji t6 harga naik') THEN
    RAISE EXCEPTION 'GAGAL (a): alasan tak masuk riwayat katalog';
  END IF;

  -- (b) alasan kosong ditolak
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 12000, 'roll', 760, '  ');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (b): tanpa alasan diterima'; END IF;

  -- (c) isi per satuan beli beda dengan master (roll 500 cm) ditolak — pecah dulu
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 8791, 'roll', 500, 'uji');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT; END;
  IF NOT v_ok OR v_msg NOT LIKE '%dipecah%' THEN RAISE EXCEPTION 'GAGAL (c): %', v_msg; END IF;

  -- (d) harga per Dus diketik sebagai harga per roll (48x) ditolak kecuali dipaksa
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 576000, 'roll', 760, 'uji salah satuan');
  EXCEPTION WHEN raise_exception THEN v_ok := true; GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT; END;
  IF NOT v_ok OR v_msg NOT LIKE '%salah satuan%' THEN RAISE EXCEPTION 'GAGAL (d): %', v_msg; END IF;
  PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 576000, 'roll', 760, 'uji dipaksa', true);

  -- (e) nonaktifkan baris katalog
  PERFORM public.nonaktifkan_harga_vendor(v_bbs, 'uji t6 stop');
  IF (SELECT is_active FROM bahan_baku_supplier WHERE id = v_bbs) THEN RAISE EXCEPTION 'GAGAL (e)'; END IF;

  -- (f) nama supplier kembar ditolak
  v_ok := false;
  BEGIN PERFORM public.simpan_supplier(NULL, jsonb_build_object('nama','uji t6 vendor'), NULL);
  EXCEPTION WHEN unique_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (f): supplier kembar diterima'; END IF;

  -- (g) kitchen ditolak
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_kitchen, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.simpan_harga_vendor(v_bahan, v_sup, 12000, 'roll', 760, 'uji');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (g): kitchen bisa ubah harga vendor'; END IF;
  RAISE NOTICE 'HASIL T6: LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan GAGAL**

Harapan: `function public.simpan_supplier(...) does not exist`.

- [ ] **Step 3: Tulis migration**

```sql
-- supabase/migrations/20260923185000_rpc_master_bahan_vendor.sql
-- Spec 2026-09-23 K1/K5: harga hanya diketik per vendor (lingkup 'harga':
-- admin/owner/purchasing). Dua penjaga, sama dengan jalur PO:
--   1. isi per satuan beli harus sama dengan turunan master (kalau berbeda, bahan
--      harus dipecah per spesifikasi dulu — aturan "vendor bukan identitas barang");
--   2. rasio harga baru : master yang pas dengan sebuah faktor satuan (>= 2x, toleransi
--      1%) = dugaan salah satuan, ditolak kecuali p_paksa.

CREATE OR REPLACE FUNCTION public.simpan_harga_vendor(
  p_bahan uuid, p_supplier uuid, p_harga numeric, p_satuan_beli text,
  p_isi_satuan_kecil numeric, p_alasan text, p_paksa boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := public._peran_master('harga');
  b           public.bahan_baku%ROWTYPE;
  v_isi_mstr  numeric;
  v_baru      numeric;
  v_lama      numeric;
  v_rasio     numeric;
  v_faktor    numeric;
  v_id        uuid;
BEGIN
  IF COALESCE(btrim(p_alasan), '') = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023';
  END IF;
  IF p_harga IS NULL OR p_harga <= 0 OR p_harga = 'NaN'::numeric
     OR p_isi_satuan_kecil IS NULL OR p_isi_satuan_kecil <= 0 OR p_isi_satuan_kecil = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Harga dan isi satuan beli wajib angka > 0' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(btrim(p_satuan_beli), '') = '' THEN
    RAISE EXCEPTION 'Satuan beli wajib diisi' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO b FROM public.bahan_baku WHERE id = p_bahan AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bahan aktif % tidak ditemukan', p_bahan USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.supplier WHERE id = p_supplier AND is_active) THEN
    RAISE EXCEPTION 'Supplier aktif % tidak ditemukan', p_supplier USING ERRCODE = 'P0002';
  END IF;

  v_isi_mstr := public.hitung_faktor_po(b.satuan, p_satuan_beli, b.satuan_tengah, b.faktor_tengah,
                                        b.satuan_kecil, b.faktor_tampilan);
  IF v_isi_mstr IS NOT NULL AND abs(p_isi_satuan_kecil - v_isi_mstr) / v_isi_mstr > 0.001 THEN
    RAISE EXCEPTION 'Isi 1 % dari vendor ini (%) berbeda dengan master (%). Bahan harus dipecah per spesifikasi dulu sebelum harga ini dicatat.',
      p_satuan_beli, p_isi_satuan_kecil, v_isi_mstr;
  END IF;

  v_baru := p_harga / p_isi_satuan_kecil * COALESCE(b.faktor_tampilan, 1);
  SELECT harga_beli INTO v_lama FROM public.bahan_baku_harga WHERE bahan_baku_id = p_bahan;
  IF NOT p_paksa AND v_lama IS NOT NULL AND v_lama > 0 THEN
    v_rasio := GREATEST(v_baru / v_lama, v_lama / v_baru);
    FOR v_faktor IN
      SELECT f FROM (VALUES (b.faktor_tengah), (b.faktor_tampilan), (b.faktor_konversi)) k(f)
       WHERE f IS NOT NULL AND f >= 2
    LOOP
      IF abs(v_rasio - v_faktor) / v_faktor <= 0.01 THEN
        RAISE EXCEPTION 'Harga ini %x harga master (Rp %), pas dengan faktor satuan % — kemungkinan salah satuan. Periksa lagi, atau simpan dengan paksa bila memang benar.',
          round(v_rasio, 2), round(v_lama, 2), v_faktor;
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.alasan', p_alasan, true);
  INSERT INTO public.bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga,
                                          sumber, perlu_ditinjau, is_active, updated_by, ref_po_id)
  VALUES (p_bahan, p_supplier, p_satuan_beli, p_isi_satuan_kecil, p_harga, 'manual', false, true, v_uid, NULL)
  ON CONFLICT (bahan_baku_id, supplier_id) DO UPDATE
     SET satuan_beli = EXCLUDED.satuan_beli,
         isi_satuan_kecil = EXCLUDED.isi_satuan_kecil,
         harga = EXCLUDED.harga,
         sumber = 'manual',
         perlu_ditinjau = false,
         is_active = true,
         updated_by = EXCLUDED.updated_by,
         ref_po_id = NULL
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nonaktifkan_harga_vendor(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._peran_master('harga');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.bahan_baku_supplier SET is_active = false, is_preferred = false, updated_by = auth.uid()
   WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baris katalog % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.simpan_supplier(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh constant text[] := ARRAY['nama','kontak','alamat','kategori','catatan','termin_hari','vendor_induk_id'];
  v_uid   uuid := public._peran_master('harga');
  v_kunci text;
  v_nama  text;
  v_id    uuid;
BEGIN
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_supplier', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;
  v_nama := btrim(COALESCE(p_data ->> 'nama', (SELECT nama FROM public.supplier WHERE id = p_id)));
  IF COALESCE(v_nama, '') = '' THEN RAISE EXCEPTION 'Nama supplier wajib diisi' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.supplier WHERE is_active AND lower(btrim(nama)) = lower(v_nama)
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Sudah ada supplier aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;
  PERFORM set_config('app.alasan', COALESCE(p_alasan, ''), true);

  IF p_id IS NULL THEN
    INSERT INTO public.supplier (nama, kontak, alamat, kategori, catatan, termin_hari, vendor_induk_id, created_by, is_active)
    VALUES (v_nama, p_data ->> 'kontak', p_data ->> 'alamat', p_data ->> 'kategori', p_data ->> 'catatan',
            (p_data ->> 'termin_hari')::int, (p_data ->> 'vendor_induk_id')::uuid, v_uid, true)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.supplier SET
    nama            = v_nama,
    kontak          = CASE WHEN p_data ? 'kontak' THEN p_data ->> 'kontak' ELSE kontak END,
    alamat          = CASE WHEN p_data ? 'alamat' THEN p_data ->> 'alamat' ELSE alamat END,
    kategori        = CASE WHEN p_data ? 'kategori' THEN p_data ->> 'kategori' ELSE kategori END,
    catatan         = CASE WHEN p_data ? 'catatan' THEN p_data ->> 'catatan' ELSE catatan END,
    termin_hari     = CASE WHEN p_data ? 'termin_hari' THEN (p_data ->> 'termin_hari')::int ELSE termin_hari END,
    vendor_induk_id = CASE WHEN p_data ? 'vendor_induk_id' THEN (p_data ->> 'vendor_induk_id')::uuid ELSE vendor_induk_id END
  WHERE id = p_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Supplier % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nonaktifkan_supplier(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  PERFORM public._peran_master('harga');
  IF COALESCE(btrim(p_alasan), '') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO v_n FROM public.purchase_order
   WHERE supplier_id = p_id AND status NOT IN ('diterima_lengkap', 'dibatalkan');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Supplier masih punya % PO terbuka; selesaikan dulu', v_n;
  END IF;
  PERFORM set_config('app.alasan', p_alasan, true);
  UPDATE public.supplier SET is_active = false WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_harga_vendor(uuid, uuid, numeric, text, numeric, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nonaktifkan_harga_vendor(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.simpan_supplier(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nonaktifkan_supplier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_harga_vendor(uuid, uuid, numeric, text, numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nonaktifkan_harga_vendor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simpan_supplier(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nonaktifkan_supplier(uuid, text) TO authenticated;
```

- [ ] **Step 4: Apply, verifikasi, stempel**

```sql
SELECT proname, prosecdef FROM pg_proc
 WHERE proname IN ('simpan_harga_vendor','nonaktifkan_harga_vendor','simpan_supplier','nonaktifkan_supplier');   -- 4, semua true
SELECT has_function_privilege('anon',
  'public.simpan_harga_vendor(uuid,uuid,numeric,text,numeric,text,boolean)', 'EXECUTE');                         -- false
```
Stempel `('20260923185000','rpc_master_bahan_vendor')`.

- [ ] **Step 5: Jalankan uji, pastikan LULUS**

Harapan: `HASIL T6: LULUS`.

Lalu jalankan ulang **T1–T5**. Semuanya harus tetap LULUS: trigger Task 4 kini ikut menyala di jalur T6, dan fixture uji lama tidak boleh ikut terganggu.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260923185000_rpc_master_bahan_vendor.sql supabase/verifikasi/master_bahan/t6_rpc_vendor.sql
git commit -m "feat(db): RPC harga vendor & supplier dengan penjaga isi dan salah satuan"
```

---

### Task 7: Uji regresi jalur lama, pemantau, dokumentasi

**Files:**
- Create: `supabase/verifikasi/master_bahan/t7_regresi_jalur_lama.sql`
- Create: `supabase/verifikasi/master_bahan/pemantau.sql`
- Modify: `CLAUDE.md` (entri sesi baru di akhir, sebelum baris `**Last updated:**`)
- Modify: `docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md` (baris Status)

**Interfaces:**
- Consumes: semua objek Task 1–6.

- [ ] **Step 1: Tulis uji regresi jalur yang sudah live**

Tujuan: memastikan trigger baru tidak mematahkan penulis yang sedang dipakai produksi. Penulis itu adalah server action "tambah bahan" (service key, lewat tabel langsung) dan `katalog_tulis_dari_po`.

```sql
-- supabase/verifikasi/master_bahan/t7_regresi_jalur_lama.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_id uuid; v_sup uuid;
BEGIN
  -- (a) pola createBahanBakuAction (Tahap 0): insert bahan + SKU + harga sebagai service role
  SET LOCAL ROLE service_role;
  INSERT INTO bahan_baku (nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
                          faktor_konversi, is_active, is_fisik_checked)
  VALUES ('UJI T7 LAMA', 'UJI', 'tabung', NULL, NULL, 'gram', 12000, 12000, true, false) RETURNING id INTO v_id;
  INSERT INTO bahan_baku_sku (bahan_baku_id, nama_kemasan, qty_isi, harga_beli, is_default, is_active)
  VALUES (v_id, 'tabung', 1, 220000, true, true);
  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  VALUES (v_id, 220000, 12000, 'gram', now());
  IF (SELECT kemasan_qty FROM bahan_baku_harga WHERE bahan_baku_id = v_id) <> 12000 THEN
    RAISE EXCEPTION 'GAGAL (a): kemasan_qty berubah';
  END IF;
  RESET ROLE;

  -- (b) pola katalog_tulis_dari_po: insert katalog sumber 'po' → master diturunkan, tidak error
  SELECT id INTO v_sup FROM supplier WHERE is_active LIMIT 1;
  INSERT INTO bahan_baku_supplier (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, sumber, perlu_ditinjau, harga_updated_at)
  VALUES (v_id, v_sup, 'tabung', 12000, 230000, 'po', false, now());
  IF abs((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_id) - 230000) > 0.01 THEN
    RAISE EXCEPTION 'GAGAL (b): master tidak mengikuti katalog dari PO';
  END IF;
  RAISE NOTICE 'HASIL T7: LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan LULUS**

Harapan: `HASIL T7: LULUS`. Kalau GAGAL, trigger Task 3/4 mematahkan jalur produksi: **perbaiki trigger-nya, bukan ujinya.**

- [ ] **Step 3: Tulis pemantau**

```sql
-- supabase/verifikasi/master_bahan/pemantau.sql — jalankan satu kueri per giliran.

-- Q1: pelanggar invarian faktor/kemasan (harus 0)
SELECT b.nama FROM bahan_baku b LEFT JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
 WHERE b.faktor_konversi IS DISTINCT FROM
       CASE WHEN b.satuan_kecil IS NULL THEN 1
            WHEN b.satuan_tengah IS NOT NULL THEN b.faktor_tampilan / b.faktor_tengah
            ELSE b.faktor_tampilan END
    OR (h.bahan_baku_id IS NOT NULL AND h.kemasan_qty IS DISTINCT FROM COALESCE(b.faktor_tampilan, 1));

-- Q2: daftar kerja "belum dikonfirmasi vendor" (harus turun ke 0 seiring purchasing bekerja)
SELECT nama, harga_master, harga_master_updated_at FROM bahan_baku_status_harga
 WHERE status = 'belum_dikonfirmasi' ORDER BY nama;

-- Q3: master yang menyimpang dari vendor terbaru (setelah penyelarasan harus 0; sebelum itu = daftar owner)
SELECT b.nama, h.harga_beli, t.harga_per_besar FROM bahan_baku b
  JOIN LATERAL harga_vendor_terpercaya(b.id) t ON true
  JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
 WHERE b.is_active AND abs(h.harga_beli - t.harga_per_besar) >= 0.01;

-- Q4: perubahan master 7 hari terakhir tanpa alasan (jalur lama yang belum pindah ke RPC)
SELECT tabel, aksi, changed_by, changed_at FROM master_bahan_audit
 WHERE alasan IS NULL AND changed_at > now() - interval '7 days' ORDER BY changed_at DESC;
```

- [ ] **Step 4: Perbarui status spec & CLAUDE.md**

Di spec, ganti baris Status menjadi:
`**Status:** Disetujui owner (sesi grilling 2026-09-23). Tahap 0 LIVE (8729fbe2). Tahap 1 (fondasi DB) LIVE — lihat plan 2026-09-23-master-bahan-baku-tahap1-fondasi-db.md.`

Di `CLAUDE.md`, tambahkan entri sesi sebelum `**Last updated:**`. Isinya:
- Judul `## Session 2026-09-23: Master Bahan Baku Satu Tempat — Tahap 0 & 1`
- Status: Tahap 0 LIVE dan ter-deploy (commit `8729fbe2`); Tahap 1 = 6 migration applied dan terstempel, nol app diubah
- Daftar objek baru: RPC, trigger, view, supplier "Beli Tunai / Tanpa Vendor"
- Gotcha: trigger `_00_` sengaja jalan sebelum `trg_bahan_baku_faktor_po`; `harga_vendor_terpercaya` sengaja INVOKER; penyelarasan harga menunggu owner
- Next: Tahap 2 (halaman bertab + cabut tulis langsung)

- [ ] **Step 5: Commit**

```bash
git add supabase/verifikasi/master_bahan/t7_regresi_jalur_lama.sql supabase/verifikasi/master_bahan/pemantau.sql CLAUDE.md docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md
git commit -m "docs(bahan-baku): pemantau + catatan sesi Tahap 1 fondasi DB"
```

---

## Di luar plan ini (sengaja)

- Mencabut tulis langsung ke tabel master (K10.2) → **Tahap 2**, setelah layar pindah ke RPC.
- Tombol Ganti Satuan (memakai `app.ganti_satuan`, dan harus ikut menyegarkan `bahan_baku_harga.kemasan_qty`), stok membaca `peruntukan`/`is_opname`, penulisan ulang dokumen satuan → **Tahap 3**.
- Penyelarasan massal harga master ke vendor → menunggu persetujuan owner atas daftar di Task 4 Step 6.
- Cakupan bahan per outlet (mis. "GAS 12 KG hanya Kitchen & BNR") → belum ada di spec; perlu keputusan owner tersendiri.
