-- Kas kecil outlet boleh ditandai RAB (ditanggung dana investasi).
-- Lanjutan 20261111150000_kategori_opex_rab. Keputusan owner 11 Nov 2026:
--   * saldo kas kecil TETAP berkurang (uangnya memang keluar dari laci),
--     jadi pembaca saldo/arus kas (get_petty_cash_snapshot, tutup shift,
--     laporan shift, closing kasir) sengaja tidak disentuh;
--   * tidak dihitung OPEX/laba: dua fungsi laba yang menjumlah kas kecil
--     tanpa saringan diberi `type <> 'rab'`.
-- Penandaan hanya lewat server action Buku Kas (tabel ini tak punya policy UPDATE).

SET lock_timeout = '5s';

-- 1. Tipe 'rab' di kas kecil; kategori rab <=> tipe rab.
ALTER TABLE public.petty_cash_expenses DROP CONSTRAINT IF EXISTS petty_cash_expenses_type_check;
ALTER TABLE public.petty_cash_expenses ADD CONSTRAINT petty_cash_expenses_type_check
  CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'rab'::text]));

ALTER TABLE public.petty_cash_expenses DROP CONSTRAINT IF EXISTS petty_cash_expenses_rab_type_check;
ALTER TABLE public.petty_cash_expenses ADD CONSTRAINT petty_cash_expenses_rab_type_check
  CHECK ((category = 'rab') = (type = 'rab'));

-- 2. Penjaga peran & bulan closing: fungsi yang sama dengan expenses.
DROP TRIGGER IF EXISTS trg_petty_cash_expenses_jaga_rab ON public.petty_cash_expenses;
CREATE TRIGGER trg_petty_cash_expenses_jaga_rab
  BEFORE INSERT OR UPDATE ON public.petty_cash_expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_jaga_rab();

-- 3. Fungsi laba: tambal tepat satu blok kas kecil masing-masing. Badan fungsi
--    dibaca dari katalog supaya SET (search_path, plan_cache_mode) ikut terbawa.
DO $$
DECLARE
  v_def text;
  v_baru text;
BEGIN
  -- Ringkasan Bisnis
  v_def := pg_get_functiondef('public.get_owner_dashboard_summary'::regproc);
  IF position('pce.type <> ''rab''' in v_def) = 0 THEN
    IF (length(v_def) - length(replace(v_def, 'AND pce.deleted_at IS NULL', ''))) / length('AND pce.deleted_at IS NULL') <> 1 THEN
      RAISE EXCEPTION 'get_owner_dashboard_summary: pola kas kecil tidak ditemukan tepat sekali';
    END IF;
    v_baru := replace(v_def, 'AND pce.deleted_at IS NULL',
      'AND pce.deleted_at IS NULL AND pce.type <> ''rab'' /* RAB: tidak dihitung OPEX */');
    EXECUTE v_baru;
  END IF;

  -- ROI mitra
  v_def := pg_get_functiondef('public.get_mitra_roi'::regproc);
  IF position('e.type <> ''rab''' in v_def) = 0 THEN
    IF (length(v_def) - length(replace(v_def, 'and e.deleted_at is null', ''))) / length('and e.deleted_at is null') <> 1 THEN
      RAISE EXCEPTION 'get_mitra_roi: pola kas kecil tidak ditemukan tepat sekali';
    END IF;
    v_baru := replace(v_def, 'and e.deleted_at is null',
      'and e.deleted_at is null and e.type <> ''rab'' /* RAB: tidak dihitung OPEX */');
    EXECUTE v_baru;
  END IF;
END $$;

-- 4. Pastikan SET penting tidak hilang.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_owner_dashboard_summary'
                 AND 'plan_cache_mode=force_custom_plan' = ANY (proconfig)) THEN
    RAISE EXCEPTION 'get_owner_dashboard_summary kehilangan plan_cache_mode';
  END IF;
END $$;
