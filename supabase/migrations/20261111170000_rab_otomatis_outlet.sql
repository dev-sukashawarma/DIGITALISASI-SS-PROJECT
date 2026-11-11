-- Aturan RAB otomatis per outlet + RAB boleh mencatat rekening pembayar.
-- Keputusan owner 11 Nov 2026 (kasus Mitra Karawaci):
--   * Semua pengeluaran Mitra Karawaci s.d. 30 Nov 2026 ditanggung RAB,
--     KECUALI gas, PLN, PDAM, internet, utilitas, sewa outlet, endorsement.
--   * Aturan MUTLAK: berlaku pada setiap simpan (input baru, edit manual,
--     sinkron ulang Marcom), di expenses maupun kas kecil.
--   * Pengeluaran yang dibayar dari rekening pusat tetap memotong rekening
--     (uangnya memang keluar); hanya tidak dihitung OPEX/laba.
--   * Gaji/bonus crew (payroll HR) di luar aturan ini.
-- Lanjutan 20261111150000_kategori_opex_rab & 20261111160000_kas_kecil_rab.

SET lock_timeout = '5s';

-- 1. RAB boleh mencatat rekening pembayar (dulu wajib NULL).
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_rab_outlet_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_rab_outlet_check
  CHECK (
    type IS DISTINCT FROM 'rab'
    OR (outlet_id IS NOT NULL AND payment_source <> 'cash_drawer')
  );

-- 2. Penjaga sumber kas: rekening pusat boleh membayar baris RAB.
DO $$
DECLARE
  v_def text;
  v_lama constant text := 'NOT IN (''expense'', ''office_settled'')';
BEGIN
  v_def := pg_get_functiondef('public.expenses_cek_sumber_kas'::regproc);
  IF position('''office_settled'', ''rab''' in v_def) = 0 THEN
    IF (length(v_def) - length(replace(v_def, v_lama, ''))) / length(v_lama) <> 1 THEN
      RAISE EXCEPTION 'expenses_cek_sumber_kas: pola tipe tidak ditemukan tepat sekali';
    END IF;
    EXECUTE replace(v_def, v_lama, 'NOT IN (''expense'', ''office_settled'', ''rab'')');
  END IF;
END $$;

-- 3. Tabel aturan. Ditulis hanya lewat migration / SQL oleh developer.
CREATE TABLE IF NOT EXISTS public.rab_outlet_otomatis (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id        uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  berlaku_mulai    date,
  berlaku_sampai   date NOT NULL,
  kategori_kecuali text[] NOT NULL DEFAULT '{}',
  catatan          text,
  dibuat_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (berlaku_mulai IS NULL OR berlaku_mulai <= berlaku_sampai)
);

COMMENT ON TABLE public.rab_outlet_otomatis IS
  'Aturan RAB otomatis: pengeluaran outlet ini bertanggal dalam periode & kategorinya bukan pengecualian dipaksa type/category = ''rab'' (expenses & petty_cash_expenses). Tidak dihitung OPEX/laba.';

ALTER TABLE public.rab_outlet_otomatis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rab_outlet_otomatis FROM anon, authenticated;
GRANT SELECT ON public.rab_outlet_otomatis TO authenticated;
DROP POLICY IF EXISTS rab_outlet_otomatis_baca ON public.rab_outlet_otomatis;
CREATE POLICY rab_outlet_otomatis_baca ON public.rab_outlet_otomatis
  FOR SELECT TO authenticated
  USING (
    kas_pencatat_ok()
    OR EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND status = 'active' AND role = 'developer')
  );

-- 4. Fungsi penerap. Hanya mengubah baris type 'expense'; pemasukan, voucher
--    kantor, dan laci kasir (cash_drawer) tidak disentuh.
CREATE OR REPLACE FUNCTION public.rab_otomatis_terapkan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kecuali text[];
BEGIN
  IF NEW.type IS DISTINCT FROM 'expense' OR NEW.outlet_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'expenses' AND NEW.payment_source = 'cash_drawer' THEN
    RETURN NEW;
  END IF;
  -- Bulan yang sudah closing tidak pernah diubah otomatis (penjaga closing di
  -- trg_*_jaga_rab berjalan sebelum trigger ini, jadi dijaga di sini juga).
  IF NEW.expense_date <= batas_closing_opex() THEN
    RETURN NEW;
  END IF;

  SELECT r.kategori_kecuali INTO v_kecuali
  FROM rab_outlet_otomatis r
  WHERE r.outlet_id = NEW.outlet_id
    AND NEW.expense_date <= r.berlaku_sampai
    AND (r.berlaku_mulai IS NULL OR NEW.expense_date >= r.berlaku_mulai)
  ORDER BY r.berlaku_sampai DESC
  LIMIT 1;

  IF NOT FOUND OR lower(NEW.category) = ANY (v_kecuali) THEN
    RETURN NEW;
  END IF;

  NEW.category := 'rab';
  NEW.type := 'rab';
  RETURN NEW;
END;
$$;

-- Nama "zz_" supaya berjalan SETELAH trg_*_jaga_rab & trg_expenses_cek_sumber_kas
-- (trigger BEFORE berurutan menurut nama). Penjaga peran melihat type 'expense',
-- jadi crew tetap bisa mencatat kas kecil di POS; konversi terjadi sesudahnya.
DROP TRIGGER IF EXISTS trg_expenses_zz_rab_otomatis ON public.expenses;
CREATE TRIGGER trg_expenses_zz_rab_otomatis
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.rab_otomatis_terapkan();

DROP TRIGGER IF EXISTS trg_petty_cash_expenses_zz_rab_otomatis ON public.petty_cash_expenses;
CREATE TRIGGER trg_petty_cash_expenses_zz_rab_otomatis
  BEFORE INSERT OR UPDATE ON public.petty_cash_expenses
  FOR EACH ROW EXECUTE FUNCTION public.rab_otomatis_terapkan();

-- 5. Aturan Mitra Karawaci (dibuka 3 Nov 2026).
INSERT INTO public.rab_outlet_otomatis (outlet_id, berlaku_mulai, berlaku_sampai, kategori_kecuali, catatan)
SELECT 'a85330a1-c150-4389-9a94-c23b66aaed7c', NULL, DATE '2026-11-30',
       ARRAY['gas', 'pln', 'pdam', 'internet', 'wifi', 'utilitas', 'utilities', 'sewa', 'sewa_outlet', 'endorsement'],
       'Opening Mitra Karawaci: ditanggung RAB s.d. akhir November 2026 (keputusan owner 11 Nov 2026)'
WHERE NOT EXISTS (
  SELECT 1 FROM public.rab_outlet_otomatis WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c'
);

-- 6. Terapkan ke baris yang sudah ada (trigger yang mengubah; kolom kas tidak
--    berubah, jadi potongan rekening tetap utuh).
DO $$
DECLARE
  v_exp int;
  v_pce int;
BEGIN
  UPDATE public.expenses SET type = type
  WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c' AND type = 'expense' AND expense_date <= DATE '2026-11-30';
  UPDATE public.petty_cash_expenses SET type = type
  WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c' AND type = 'expense' AND expense_date <= DATE '2026-11-30'
    AND deleted_at IS NULL;

  SELECT count(*) INTO v_exp FROM public.expenses
  WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c' AND type = 'rab';
  SELECT count(*) INTO v_pce FROM public.petty_cash_expenses
  WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c' AND type = 'rab' AND deleted_at IS NULL;
  RAISE NOTICE 'Karawaci RAB: expenses %, kas kecil %', v_exp, v_pce;
END $$;
