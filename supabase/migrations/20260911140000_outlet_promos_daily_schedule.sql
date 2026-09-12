-- Jadwal promo per tanggal dalam WIB.
--
-- Bentuk data:
-- [
--   {"date":"2026-09-10","start_time":"10:00:00","end_time":"12:00:00"},
--   {"date":"2026-09-11","start_time":"15:00:00","end_time":"18:00:00"}
-- ]
--
-- Array kosong mempertahankan perilaku lama: daily_start_time/daily_end_time
-- (bila ada) tetap menjadi jam berulang setiap hari.

ALTER TABLE public.outlet_promos
  ADD COLUMN IF NOT EXISTS daily_schedule jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.outlet_promos
  DROP CONSTRAINT IF EXISTS outlet_promos_daily_schedule_array_check;

ALTER TABLE public.outlet_promos
  ADD CONSTRAINT outlet_promos_daily_schedule_array_check
  CHECK (jsonb_typeof(daily_schedule) = 'array');

COMMENT ON COLUMN public.outlet_promos.daily_schedule IS
  'Daftar jendela promo per tanggal WIB. Jika tidak kosong, aturan ini mengalahkan daily_start_time/daily_end_time.';

-- Dipakai oleh trigger Buy X Get Y, sehingga validasi server sama dengan
-- kalkulasi POS native. Jendela lintas tengah malam meneruskan sisa jam ke
-- tanggal berikutnya.
CREATE OR REPLACE FUNCTION public.is_outlet_promo_schedule_running(
  p_promo public.outlet_promos,
  p_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local_date date;
  v_local_time time;
  v_row jsonb;
  v_start time;
  v_end time;
BEGIN
  IF p_at IS NULL THEN RETURN false; END IF;

  IF p_promo.start_date IS NOT NULL AND p_at < p_promo.start_date THEN
    RETURN false;
  END IF;
  IF p_promo.end_date IS NOT NULL AND p_at >= p_promo.end_date THEN
    RETURN false;
  END IF;

  v_local_date := (p_at AT TIME ZONE 'Asia/Jakarta')::date;
  v_local_time := (p_at AT TIME ZONE 'Asia/Jakarta')::time;

  IF p_promo.daily_schedule IS NOT NULL
     AND jsonb_typeof(p_promo.daily_schedule) = 'array'
     AND jsonb_array_length(p_promo.daily_schedule) > 0 THEN
    FOR v_row IN SELECT value FROM jsonb_array_elements(p_promo.daily_schedule) LOOP
      BEGIN
        v_start := NULLIF(v_row->>'start_time', '')::time;
        v_end := NULLIF(v_row->>'end_time', '')::time;
      EXCEPTION WHEN invalid_text_representation THEN
        v_start := NULL;
        v_end := NULL;
      END;

      IF (v_row->>'date') = v_local_date::text
         AND v_start IS NOT NULL
         AND v_end IS NOT NULL
         AND v_start <> v_end
         AND (
           (v_start < v_end AND v_local_time >= v_start AND v_local_time < v_end)
           OR (v_start > v_end AND v_local_time >= v_start)
         ) THEN
        RETURN true;
      END IF;

      IF (v_row->>'date') = (v_local_date - 1)::text
         AND v_start IS NOT NULL
         AND v_end IS NOT NULL
         AND v_start > v_end
         AND v_local_time < v_end THEN
        RETURN true;
      END IF;
    END LOOP;
    RETURN false;
  END IF;

  IF p_promo.daily_start_time IS NULL OR p_promo.daily_end_time IS NULL THEN
    RETURN true;
  END IF;
  IF p_promo.daily_start_time = p_promo.daily_end_time THEN
    RETURN false;
  END IF;

  RETURN CASE
    WHEN p_promo.daily_start_time < p_promo.daily_end_time
      THEN v_local_time >= p_promo.daily_start_time
       AND v_local_time < p_promo.daily_end_time
    ELSE v_local_time >= p_promo.daily_start_time
      OR v_local_time < p_promo.daily_end_time
  END;
END;
$$;

-- Reinstall the BxGy validation trigger so a client cannot submit a reward
-- outside the per-date schedule.
CREATE OR REPLACE FUNCTION public.apply_buy_x_get_y_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_promo public.outlet_promos;
  v_reward_id uuid;
  v_reward_total integer;
  v_item record;
BEGIN
  FOR v_item IN SELECT * FROM new_rows WHERE coalesce(is_promo_reward, false) LOOP
    IF v_item.promo_id IS NULL THEN
      RAISE EXCEPTION 'PROMO_INVALID: promo_id hadiah wajib diisi';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROMO_INVALID: order hadiah tidak ditemukan'; END IF;

    SELECT * INTO v_promo FROM public.outlet_promos WHERE id = v_item.promo_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROMO_INVALID: promo tidak ditemukan'; END IF;

    IF v_promo.discount_type <> 'buy_one_get_one'
       OR (v_promo.scope = 'item' AND v_promo.menu_item_id IS NULL)
       OR (v_promo.scope = 'global' AND v_promo.menu_item_id IS NOT NULL)
       OR v_promo.scope NOT IN ('global', 'item')
       OR coalesce(v_promo.apply_to_food_apps, false) THEN
      RAISE EXCEPTION 'PROMO_INVALID: konfigurasi promo Buy X Get Y tidak valid';
    END IF;

    IF v_promo.outlet_id <> v_order.outlet_id THEN
      RAISE EXCEPTION 'PROMO_INVALID: promo bukan milik outlet order';
    END IF;

    IF lower(coalesce(v_order.source, '')) <> 'pos'
       OR (v_order.channel IS NOT NULL AND lower(v_order.channel) <> 'endorse') THEN
      RAISE EXCEPTION 'PROMO_INVALID: Buy X Get Y hanya berlaku untuk POS/endorse';
    END IF;

    IF NOT coalesce(v_promo.is_active, false)
       OR NOT public.is_outlet_promo_schedule_running(v_promo, v_order.created_at) THEN
      RAISE EXCEPTION 'PROMO_EXPIRED: promo tidak aktif pada waktu order';
    END IF;

    SELECT m.id INTO v_reward_id
    FROM public.menu_items AS m
    WHERE lower(btrim(m.name)) = 'original ayam reguler'
      AND coalesce(m.is_available, true)
      AND (m.outlet_id = v_order.outlet_id OR m.outlet_id IS NULL)
    ORDER BY (m.id = v_promo.reward_menu_item_id) DESC,
             (m.outlet_id = v_order.outlet_id) DESC,
             m.id
    LIMIT 1;

    IF v_reward_id IS NULL THEN
      RAISE EXCEPTION 'PROMO_REWARD_UNAVAILABLE: Original Ayam Reguler tidak tersedia';
    END IF;

    IF v_item.menu_item_id IS DISTINCT FROM v_reward_id
       OR coalesce(v_item.quantity, 0) < 1
       OR coalesce(v_item.unit_price, 0) <> 0
       OR coalesce(v_item.subtotal, 0) <> 0 THEN
      RAISE EXCEPTION 'PROMO_INVALID: baris hadiah harus Original Ayam Reguler gratis';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.order_items AS i
      WHERE i.order_id = v_item.order_id
        AND NOT coalesce(i.is_promo_reward, false)
        AND (v_promo.scope = 'global' OR i.menu_item_id = v_promo.menu_item_id)
        AND i.quantity >= coalesce(v_promo.buy_quantity, 1)
    ) THEN
      RAISE EXCEPTION 'PROMO_INVALID: jumlah menu pemicu belum memenuhi syarat';
    END IF;

    SELECT coalesce(sum(i.quantity), 0) INTO v_reward_total
    FROM public.order_items AS i
    WHERE i.order_id = v_item.order_id
      AND i.is_promo_reward
      AND i.promo_id = v_item.promo_id;

    IF v_reward_total > coalesce(v_promo.get_quantity, 1) THEN
      RAISE EXCEPTION 'PROMO_INVALID: jumlah hadiah melebihi konfigurasi promo';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.promo_redemptions
      WHERE order_id = v_item.order_id AND promo_id = v_item.promo_id
    ) THEN
      CONTINUE;
    END IF;

    IF NOT public.increment_promo_usage(v_item.promo_id, 1) THEN
      RAISE EXCEPTION 'PROMO_QUOTA_EXCEEDED: kuota promo sudah habis';
    END IF;

    INSERT INTO public.promo_redemptions(order_id, promo_id)
    VALUES (v_item.order_id, v_item.promo_id)
    ON CONFLICT (order_id, promo_id) DO NOTHING;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.is_outlet_promo_schedule_running(public.outlet_promos, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_outlet_promo_schedule_running(public.outlet_promos, timestamptz) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_buy_x_get_y_redemption() FROM public, anon, authenticated;

