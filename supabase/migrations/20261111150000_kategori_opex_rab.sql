-- Kategori OPEX "RAB": pengeluaran yang sudah ditanggung dana investasi
-- (RAB pembukaan outlet). Spec: docs/superpowers/specs/2026-11-11-kategori-opex-rab-design.md
--
-- Disimpan di `expenses` dengan category = 'rab' DAN type = 'rab'. Semua
-- laporan laba memfilter type = 'expense', jadi baris RAB tidak pernah
-- mengurangi OPEX, laba, bagi hasil mitra, maupun saldo rekening.

SET lock_timeout = '5s';

-- 1. Batas bulan yang sudah closing. NAIKKAN setiap closing bulan baru,
--    bersama BATAS_CLOSING_RAB di apps/{admin-dashboard,finance}/src/lib/pengeluaran/rab.ts.
CREATE OR REPLACE FUNCTION public.batas_closing_opex()
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$ SELECT DATE '2026-10-31' $$;

COMMENT ON FUNCTION public.batas_closing_opex() IS
  'Tanggal terakhir bulan yang sudah closing laba rugi. Baris expenses bertanggal <= ini tidak boleh diubah dari/ke kategori RAB.';

-- 2. Kategori rab <=> type rab. IS NOT DISTINCT FROM: type NULL tidak boleh lolos.
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_rab_type_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_rab_type_check
  CHECK ((category = 'rab') = (type IS NOT DISTINCT FROM 'rab'));

-- 3. RAB wajib satu outlet, tidak memotong rekening pusat maupun laci kasir.
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_rab_outlet_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_rab_outlet_check
  CHECK (
    type IS DISTINCT FROM 'rab'
    OR (outlet_id IS NOT NULL AND cash_location_id IS NULL AND payment_source <> 'cash_drawer')
  );

-- 4. Penjaga peran & bulan closing.
CREATE OR REPLACE FUNCTION public.expenses_jaga_rab()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rab_baru boolean := NEW.type IS NOT DISTINCT FROM 'rab';
  v_rab_lama boolean := TG_OP = 'UPDATE' AND OLD.type IS NOT DISTINCT FROM 'rab';
BEGIN
  IF NOT (v_rab_baru OR v_rab_lama) THEN
    RETURN NEW;
  END IF;

  -- Klien langsung (bukan server action service role) hanya untuk peran keuangan.
  IF auth.uid() IS NOT NULL AND NOT (
    kas_pencatat_ok()
    OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')
  ) THEN
    RAISE EXCEPTION 'Hanya admin finance, admin, atau owner yang boleh mencatat pengeluaran RAB'
      USING ERRCODE = '42501';
  END IF;

  -- Pindah dari/ke RAB menggeser OPEX bulan itu: dilarang untuk bulan closing.
  IF TG_OP = 'UPDATE' AND v_rab_baru <> v_rab_lama
     AND LEAST(OLD.expense_date, NEW.expense_date) <= batas_closing_opex() THEN
    RAISE EXCEPTION 'Kategori RAB tidak bisa diubah untuk bulan yang sudah closing (s.d. %)',
      to_char(batas_closing_opex(), 'DD Mon YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_jaga_rab ON public.expenses;
CREATE TRIGGER trg_expenses_jaga_rab
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_jaga_rab();

-- 5. Pensiunkan biaya_rab_outlet: pindahkan isinya (kosong per 11 Nov 2026)
--    ke expenses. Baris tanpa outlet tidak bisa dipindah -> gagalkan migration.
DO $$
DECLARE
  v_tanpa_outlet int;
  v_dipindah int;
BEGIN
  SELECT count(*) INTO v_tanpa_outlet FROM public.biaya_rab_outlet WHERE outlet_id IS NULL;
  IF v_tanpa_outlet > 0 THEN
    RAISE EXCEPTION 'Ada % baris biaya_rab_outlet tanpa outlet; alokasikan dulu di Marcom', v_tanpa_outlet;
  END IF;

  INSERT INTO public.expenses
    (outlet_id, category, type, amount, description, expense_date, period_month, payment_source, receipt_url)
  SELECT b.outlet_id, 'rab', 'rab', b.jumlah,
         '[MARCOM: ' || b.kategori_label || '] ' || b.keterangan || ' (Alokasi: ' || b.outlet_nama || ')',
         b.tanggal, date_trunc('month', b.tanggal)::date, 'transfer_pusat', b.receipt_url
  FROM public.biaya_rab_outlet b;
  GET DIAGNOSTICS v_dipindah = ROW_COUNT;

  DELETE FROM public.biaya_rab_outlet;
  RAISE NOTICE 'biaya_rab_outlet dipindah ke expenses: % baris', v_dipindah;
END $$;

COMMENT ON TABLE public.biaya_rab_outlet IS
  'PENSIUN sejak 11 Nov 2026: RAB kini di expenses (category/type = ''rab''). Jangan ditulis lagi.';
