-- ==============================================================================
-- Migration: Smart Promo-Aware Voucher Abuse Trigger
-- Memperbaiki false alert potensi voucher abuse saat outlet sedang menjalankan
-- kampanye promo resmi di tabel public.outlet_promos.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_voucher_abuse_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_outlet_name text;
  v_voucher_count int := 0;
  v_total_discount numeric := 0;
  v_kasir_name text;
  v_is_promo_active boolean := false;
  v_active_promo_names text := '';
  v_order_no text;
  v_ceo record;
BEGIN
  -- Abaikan jika order dibatalkan atau tidak ada pemotongan diskon
  IF NEW.status = 'cancelled' OR coalesce(NEW.discount_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Abaikan jika order historis masa lalu tersinkronisasi offline
  IF (coalesce(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::date < v_tgl_wib THEN
    RETURN NEW;
  END IF;

  -- 1. Periksa apakah outlet ini (atau global HQ) sedang memiliki promo resmi yang AKTIF
  SELECT 
    EXISTS (
      SELECT 1 FROM public.outlet_promos
      WHERE (outlet_id = NEW.outlet_id OR outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff')
        AND is_active = true
        AND (start_date IS NULL OR start_date <= now())
        AND (end_date IS NULL OR end_date >= now())
    ),
    coalesce(string_agg(DISTINCT coalesce(nullif(btrim(promo_name), ''), 'Promo Resmi'), ', '), '')
  INTO v_is_promo_active, v_active_promo_names
  FROM public.outlet_promos
  WHERE (outlet_id = NEW.outlet_id OR outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff')
    AND is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now());

  -- 2. Hitung akumulasi transaksi berdiskon dalam 2 jam terakhir di outlet ini
  SELECT count(*), coalesce(sum(discount_amount), 0)
  INTO v_voucher_count, v_total_discount
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status <> 'cancelled'
    AND coalesce(discount_amount, 0) > 0
    AND created_at >= (now() - interval '2 hours');

  -- 3. Evaluasi Kewajaran:
  -- KASUS A: SEDANG ADA PROMO RESMI AKTIF di outlet tersebut:
  --   Frekuensi transaksi berdiskon (>= 10 order dalam 2 jam) adalah WAJAR & SAH saat jam ramai.
  --   Alert HANYA dipicu bila nilai total diskon sangat ekstrem (>= Rp 1.500.000 dalam 2 jam) untuk pemantauan volume.
  --
  -- KASUS B: TIDAK ADA PROMO RESMI AKTIF sama sekali:
  --   Kasir memotong diskon manual tanpa ada promo resmi yang terdaftar di sistem.
  --   Picu peringatan jika:
  --     (v_voucher_count >= 10 AND v_total_discount >= 250000) -- wajib ada frekuensi DAN nilai signifikan
  --     ATAU v_total_discount >= 500000 -- diskon manual akumulasi besar
  IF (v_is_promo_active AND v_total_discount >= 1500000)
     OR (NOT v_is_promo_active AND ((v_voucher_count >= 10 AND v_total_discount >= 250000) OR v_total_discount >= 500000))
  THEN
    SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
    FROM public.outlets WHERE id = NEW.outlet_id;

    v_kasir_name := coalesce(nullif(btrim(NEW.cashier_name), ''), 'Kasir POS');
    v_order_no := coalesce(nullif(btrim(NEW.order_number::text), ''), left(NEW.id::text, 8));

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      IF v_is_promo_active THEN
        -- Alert pemantauan volume promo resmi (bukan tuduhan penggelapan kasir)
        PERFORM public.bot_ceo_antrekan(
          format('voucher_abuse_ceo:%s:%s', v_tgl_wib::text, NEW.outlet_id::text),
          v_ceo.id,
          '🎟️ <b>MONITORING SALES: VOLUME DISKON PROMO TINGGI</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet:</b> %s\n' ||
            E'🎟️ <b>Promo Aktif:</b> <b>%s</b>\n' ||
            E'💸 <b>Total Nilai Diskon (2 Jam):</b> <code>%s</code> (<code>%sx Transaksi</code>)\n' ||
            E'🔢 <b>Order Terakhir:</b> <code>#%s</code>\n' ||
            E'👤 <b>Kasir Terakhir:</b> %s\n' ||
            E'⏱️ <b>Waktu Terdeteksi:</b> <code>%s WIB</code>\n\n' ||
            E'<blockquote>💡 <b>Catatan Direksi:</b>\n' ||
            E'Outlet sedang menjalankan kampanye promo resmi. Akumulasi potongan diskon telah mencapai ambang pemantauan volume tinggi.</blockquote>',
            public.bot_escape_html(v_outlet_name),
            public.bot_escape_html(v_active_promo_names),
            public.bot_format_rupiah(v_total_discount),
            v_voucher_count::text,
            public.bot_escape_html(v_order_no),
            public.bot_escape_html(v_kasir_name),
            to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
          ),
          'https://admin.sukashawarma.com'
        );
      ELSE
        -- Alert peringatan potensi abuse diskon manual tanpa promo resmi
        PERFORM public.bot_ceo_antrekan(
          format('voucher_abuse_ceo:%s:%s', v_tgl_wib::text, NEW.outlet_id::text),
          v_ceo.id,
          '🚨 <b>[SALES WARNING] POTENSI ABUSE DISKON MANUAL</b>',
          format(
            E'━━━━━━━━━━━━━━━━━━━━━\n' ||
            E'🏪 <b>Outlet:</b> %s\n' ||
            E'⚠️ <b>Status Promo:</b> <b>TIDAK ADA PROMO RESMI AKTIF</b>\n' ||
            E'💸 <b>Total Diskon Manual (2 Jam):</b> <code>%s</code> (<code>%sx Transaksi</code>)\n' ||
            E'🔢 <b>Order Terakhir:</b> <code>#%s</code>\n' ||
            E'👤 <b>Kasir Terakhir:</b> %s\n' ||
            E'⏱️ <b>Waktu Terdeteksi:</b> <code>%s WIB</code>\n\n' ||
            E'<blockquote>⚠️ <b>Atensi Direksi:</b>\n' ||
            E'Terdeteksi pemotongan diskon manual berulang di kasir tanpa adanya kampanye promo resmi yang terdaftar di outlet ini. Waspada manipulasi nota kasir tunai.</blockquote>',
            public.bot_escape_html(v_outlet_name),
            public.bot_format_rupiah(v_total_discount),
            v_voucher_count::text,
            public.bot_escape_html(v_order_no),
            public.bot_escape_html(v_kasir_name),
            to_char(now() AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
          ),
          'https://admin.sukashawarma.com'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_voucher_abuse_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;
