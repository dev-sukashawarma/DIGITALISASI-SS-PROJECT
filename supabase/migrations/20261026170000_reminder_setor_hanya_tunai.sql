-- 20261026170000_reminder_setor_hanya_tunai.sql
--
-- Reminder setor WA untuk AM hanya memuat uang tunai (keputusan owner
-- 2026-10-26). Baris "Total omzet semua kanal" dibuang: AM membacanya seolah
-- jumlah yang harus disetor, padahal QRIS/kartu/food apps tidak disetor fisik.
-- Menggantikan definisi di 20261026160000_laporan_wa_am.

CREATE OR REPLACE FUNCTION public.wa_am_susun_reminder_setor(
  p_tanggal_jual date DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_phone_uji text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jual date := coalesce(p_tanggal_jual, (now() AT TIME ZONE 'Asia/Jakarta')::date - 1);
  v_am record;
  v_jumlah int;
  v_tunai numeric;
  v_baris text;
  v_body text;
  v_phone text;
  v_key text;
  v_n int := 0;
BEGIN
  IF p_phone_uji IS NOT NULL AND p_staff_id IS NULL THEN
    RAISE EXCEPTION 'p_phone_uji hanya boleh dipakai bersama p_staff_id';
  END IF;

  FOR v_am IN SELECT * FROM public.wa_am_penerima(p_staff_id) LOOP
    WITH binaan AS (
      SELECT * FROM public.wa_am_outlet_binaan(v_am.staff_id)
    ),
    per_outlet AS (
      SELECT b.outlet_name,
             count(o.id) AS n_order,
             coalesce(sum(o.total_amount) FILTER (WHERE o.payment_method = 'cash'), 0) AS tunai
      FROM binaan b
      LEFT JOIN public.orders o
        ON o.outlet_id = b.outlet_id
       AND o.status = 'completed'
       AND ((o.created_at AT TIME ZONE 'Asia/Jakarta'))::date = v_jual
      GROUP BY b.outlet_name
    )
    SELECT count(*), sum(tunai),
           string_agg(
             '• ' || outlet_name || ': '
               || CASE WHEN n_order = 0 THEN 'tidak ada penjualan'
                       ELSE public.wa_am_rupiah(tunai) END,
             E'\n' ORDER BY tunai DESC, outlet_name)
      INTO v_jumlah, v_tunai, v_baris
    FROM per_outlet;

    CONTINUE WHEN coalesce(v_jumlah, 0) = 0;

    v_body := '*Reminder Setor Tunai — ' || public.wa_am_tanggal(v_jual + 1) || '*'
      || E'\nOmzet tunai ' || public.wa_am_tanggal(v_jual) || ' · Area: ' || v_am.staff_name
      || E'\n\n' || v_baris
      || E'\n\n*Total tunai disetor: ' || public.wa_am_rupiah(v_tunai) || '*'
      || E'\n\n' || CASE WHEN v_tunai > 0
           THEN 'Mohon segera disetor hari ini.'
           ELSE 'Tidak ada uang tunai yang perlu disetor.' END;

    v_phone := coalesce(public.wa_am_normalisasi_nomor(p_phone_uji), v_am.phone);
    v_key := CASE WHEN p_phone_uji IS NOT NULL THEN 'uji:' || clock_timestamp() || ':' ELSE '' END
      || 'setor_tunai:' || v_jual;

    INSERT INTO public.wa_am_outbox (event_key, staff_id, phone, jenis, body)
    VALUES (v_key, v_am.staff_id, v_phone, 'setor_tunai', v_body)
    ON CONFLICT (event_key, staff_id) DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.wa_am_susun_reminder_setor(date, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_am_susun_reminder_setor(date, uuid, text) TO service_role;
