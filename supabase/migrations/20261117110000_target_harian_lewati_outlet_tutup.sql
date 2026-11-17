-- Target harian tidak lagi dibuat untuk outlet yang sudah tutup (2026-11-17).
--
-- snapshot_daily_targets() menulis satu baris historical_daily_targets untuk
-- SETIAP outlet, termasuk yang sudah ditutup. Akibatnya Jatiasih, Mitra
-- Ciseeng, Depok Sukmajaya, dan Sawangan (Internal) mendapat target Rp 5 jt
-- dengan capaian 0% setiap hari sesudah tutup (Jatiasih: 96 hari), dan papan
-- Target Harian ikut menampilkannya.
--
-- Aturan baru: outlet nonaktif dengan tanggal tutup (nonaktif_at, WIB) sebelum
-- tanggal snapshot dilewati. Hari tutupnya sendiri tetap dicatat. Outlet yang
-- dibuka kembali (is_active = true) tetap ikut walau nonaktif_at terisi.
--
-- Baris lama sengaja tidak dihapus; tampilan papan menyaringnya di app
-- (lib/outletTutup.ts). Badan fungsi selain klausa WHERE identik dengan
-- definisi live sebelumnya (20260714010000 / 20260706130000).

CREATE OR REPLACE FUNCTION public.snapshot_daily_targets(p_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today date := p_date;
BEGIN
  INSERT INTO public.historical_daily_targets (record_date, outlet_id, target_amount, omzet_achieved, achieved_pct)
  SELECT
    v_today,
    o.id AS outlet_id,
    COALESCE(dst.target_amount, COALESCE(dt_global.target_amount, 0)) AS target_amount,
    COALESCE(sales.omzet_today, 0) AS omzet_achieved,
    CASE
      WHEN COALESCE(dst.target_amount, COALESCE(dt_global.target_amount, 0)) > 0 THEN
        (COALESCE(sales.omzet_today, 0) / COALESCE(dst.target_amount, COALESCE(dt_global.target_amount, 0))) * 100
      ELSE 0
    END AS achieved_pct
  FROM public.outlets o
  LEFT JOIN (
    SELECT
      outlet_id,
      SUM(total_amount) AS omzet_today
    FROM public.orders
    WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = v_today
      AND status IN ('completed', 'selesai', 'paid')
    GROUP BY outlet_id
  ) sales ON sales.outlet_id = o.id
  LEFT JOIN (
    -- Override targets per outlet
    SELECT DISTINCT ON (outlet_id) outlet_id, target_amount
    FROM public.daily_sales_targets
    WHERE outlet_id IS NOT NULL
      AND effective_from <= v_today
    ORDER BY outlet_id, effective_from DESC, created_at DESC
  ) dst ON dst.outlet_id = o.id
  LEFT JOIN (
    -- Global target
    SELECT target_amount
    FROM public.daily_sales_targets
    WHERE outlet_id IS NULL
      AND effective_from <= v_today
    ORDER BY effective_from DESC, created_at DESC
    LIMIT 1
  ) dt_global ON true
  -- Outlet tutup dilewati mulai hari sesudah tanggal tutupnya.
  WHERE o.is_active IS NOT FALSE
     OR o.nonaktif_at IS NULL
     OR (o.nonaktif_at AT TIME ZONE 'Asia/Jakarta')::date >= v_today
  ON CONFLICT (record_date, outlet_id)
  DO UPDATE SET
    target_amount = EXCLUDED.target_amount,
    omzet_achieved = EXCLUDED.omzet_achieved,
    achieved_pct = EXCLUDED.achieved_pct;
END;
$function$;

-- Versi tanpa argumen (warisan 20260706130000) diarahkan ke versi bertanggal
-- supaya aturannya hanya ada di satu tempat.
CREATE OR REPLACE FUNCTION public.snapshot_daily_targets()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public.snapshot_daily_targets(current_date);
END;
$function$;
