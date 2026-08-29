-- Buy X Get Y quota scope.
--
-- Existing outlet_promos rows represent the same admin configuration copied to
-- each outlet. The default remains per_outlet for backward compatibility. A
-- global quota uses one locked pool shared by those rows, so concurrent cashiers
-- cannot consume the same last redemption.

CREATE TABLE IF NOT EXISTS public.promo_quota_pools (
  id uuid PRIMARY KEY,
  usage_limit integer,
  current_usage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_quota_pools_usage_limit_check
    CHECK (usage_limit IS NULL OR usage_limit >= 1),
  CONSTRAINT promo_quota_pools_current_usage_check
    CHECK (current_usage >= 0)
);

ALTER TABLE public.promo_quota_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_quota_pools_admin_owner" ON public.promo_quota_pools;
CREATE POLICY "promo_quota_pools_admin_owner"
  ON public.promo_quota_pools
  FOR ALL
  USING (get_user_role() IN ('admin', 'owner'))
  WITH CHECK (get_user_role() IN ('admin', 'owner'));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promo_quota_pools TO authenticated;

ALTER TABLE public.outlet_promos
  ADD COLUMN IF NOT EXISTS quota_scope text NOT NULL DEFAULT 'per_outlet',
  ADD COLUMN IF NOT EXISTS quota_pool_id uuid REFERENCES public.promo_quota_pools(id) ON DELETE SET NULL;

UPDATE public.outlet_promos
SET quota_scope = 'per_outlet'
WHERE quota_scope IS NULL;

ALTER TABLE public.outlet_promos
  DROP CONSTRAINT IF EXISTS outlet_promos_quota_scope_check;

ALTER TABLE public.outlet_promos
  ADD CONSTRAINT outlet_promos_quota_scope_check
  CHECK (quota_scope IN ('global', 'per_outlet'));

CREATE INDEX IF NOT EXISTS outlet_promos_quota_pool_id_idx
  ON public.outlet_promos(quota_pool_id);

-- One authoritative quota operation is shared by the old discount routes and
-- the Buy X Get Y redemption trigger.
CREATE OR REPLACE FUNCTION public.increment_promo_usage(
  p_promo_id uuid,
  p_increment_amount integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_promo public.outlet_promos;
  v_pool public.promo_quota_pools;
  v_next_usage integer;
BEGIN
  IF p_increment_amount IS NULL OR p_increment_amount < 1 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_promo
  FROM public.outlet_promos
  WHERE id = p_promo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_promo.quota_scope = 'global' AND v_promo.quota_pool_id IS NOT NULL THEN
    SELECT * INTO v_pool
    FROM public.promo_quota_pools
    WHERE id = v_promo.quota_pool_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    v_next_usage := coalesce(v_pool.current_usage, 0) + p_increment_amount;
    IF v_pool.usage_limit IS NOT NULL AND v_next_usage > v_pool.usage_limit THEN
      RETURN false;
    END IF;

    UPDATE public.promo_quota_pools
    SET current_usage = v_next_usage
    WHERE id = v_pool.id;

    -- Keep the legacy column readable by POS clients that only fetch
    -- outlet_promos. The pool remains authoritative for enforcement.
    UPDATE public.outlet_promos
    SET current_usage = v_next_usage
    WHERE quota_pool_id = v_pool.id;

    RETURN true;
  END IF;

  v_next_usage := coalesce(v_promo.current_usage, 0) + p_increment_amount;
  IF v_promo.usage_limit IS NOT NULL AND v_next_usage > v_promo.usage_limit THEN
    RETURN false;
  END IF;

  UPDATE public.outlet_promos
  SET current_usage = v_next_usage
  WHERE id = v_promo.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_promo_usage(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_promo_usage(uuid, integer) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  promo_id uuid NOT NULL REFERENCES public.outlet_promos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, promo_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_promo_id_idx
  ON public.promo_redemptions(promo_id);

REVOKE ALL ON TABLE public.promo_redemptions FROM public, anon, authenticated;

-- Enforce BxGy quota inside the order_items insert transaction. This also
-- covers clients that do not call increment_promo_usage themselves.
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
  v_local_time time;
  v_item record;
BEGIN
  FOR v_item IN
    SELECT * FROM new_rows WHERE coalesce(is_promo_reward, false)
  LOOP
    IF v_item.promo_id IS NULL THEN
      RAISE EXCEPTION 'PROMO_INVALID: promo_id hadiah wajib diisi';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROMO_INVALID: order hadiah tidak ditemukan';
    END IF;

    SELECT * INTO v_promo
    FROM public.outlet_promos
    WHERE id = v_item.promo_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROMO_INVALID: promo tidak ditemukan';
    END IF;

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
       OR (v_promo.start_date IS NOT NULL AND v_order.created_at < v_promo.start_date)
       OR (v_promo.end_date IS NOT NULL AND v_order.created_at >= v_promo.end_date) THEN
      RAISE EXCEPTION 'PROMO_EXPIRED: promo tidak aktif pada waktu order';
    END IF;

    IF v_promo.daily_start_time IS NOT NULL AND v_promo.daily_end_time IS NOT NULL THEN
      v_local_time := (v_order.created_at AT TIME ZONE 'Asia/Jakarta')::time;
      IF (v_promo.daily_start_time <= v_promo.daily_end_time
          AND (v_local_time < v_promo.daily_start_time OR v_local_time >= v_promo.daily_end_time))
         OR (v_promo.daily_start_time > v_promo.daily_end_time
          AND v_local_time < v_promo.daily_start_time
          AND v_local_time >= v_promo.daily_end_time) THEN
        RAISE EXCEPTION 'PROMO_EXPIRED: order di luar jam promo';
      END IF;
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

DROP TRIGGER IF EXISTS trg_apply_buy_x_get_y_redemption ON public.order_items;
CREATE TRIGGER trg_apply_buy_x_get_y_redemption
AFTER INSERT ON public.order_items
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.apply_buy_x_get_y_redemption();

REVOKE ALL ON FUNCTION public.apply_buy_x_get_y_redemption() FROM public, anon, authenticated;
