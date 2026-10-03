-- Buy X Get Y: menu hadiah dipilih admin, bukan lagi selalu "Original Ayam Reguler".
--
-- Sebelumnya hadiah dikunci ke nama 'original ayam reguler' di dua fungsi:
-- create_order_with_items (menimpa baris hadiah ke menu itu) dan trigger
-- apply_buy_x_get_y_redemption (menolak hadiah lain). Kolom
-- outlet_promos.reward_menu_item_id sudah ada sejak 2026-08-29, tetapi hanya
-- dipakai sebagai urutan prioritas di antara menu bernama sama.
--
-- Sekarang reward_menu_item_id = sumber kebenaran:
--   * terisi  -> HANYA menu itu (tersedia, milik outlet order atau global).
--               Tidak ada fallback ke menu lain; kalau habis/terhapus, promo
--               ditolak PROMO_REWARD_UNAVAILABLE.
--   * NULL    -> perilaku lama (nama 'original ayam reguler'), untuk baris lama.
-- Hari ini seluruh 101 baris BxGy sudah ber-reward_menu_item_id = Original Ayam
-- Reguler, jadi migration ini tidak mengubah perilaku promo yang sudah ada.
--
-- POS native harus memakai aturan yang sama (BuyOneGetOneRules.resolveRewardMenuItem
-- di repo POS). APK lama tetap menambahkan Original Ayam Reguler; RPC ini menimpa
-- baris hadiahnya ke menu yang dipilih admin, jadi data order tetap benar, hanya
-- tampilan keranjang/struk di APK lama yang berbeda.
--
-- ⚠️ Kedua fungsi juga didefinisikan 20300110000002_buy_x_get_y_quota_scope.sql
-- (ranjau timestamp 2030) — replay dari nol akan memulihkan versi lama. Produksi
-- aman karena berkas itu sudah diterapkan. Preseden: 2026-09-09.

-- Helper bersama. Sengaja tanpa SET search_path (nama ter-kualifikasi skema) agar
-- bisa di-inline; dipanggil per baris hadiah.
CREATE OR REPLACE FUNCTION public.bxgy_reward_menu_id(p_reward_menu_item_id uuid, p_outlet_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT m.id
  FROM public.menu_items AS m
  WHERE coalesce(m.is_available, true)
    AND (m.outlet_id = p_outlet_id OR m.outlet_id IS NULL)
    AND CASE
          WHEN p_reward_menu_item_id IS NOT NULL THEN m.id = p_reward_menu_item_id
          ELSE lower(btrim(m.name)) = 'original ayam reguler'
        END
  ORDER BY (m.outlet_id = p_outlet_id) DESC NULLS LAST, m.id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.bxgy_reward_menu_id(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bxgy_reward_menu_id(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_buy_x_get_y_redemption()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

    v_reward_id := public.bxgy_reward_menu_id(v_promo.reward_menu_item_id, v_order.outlet_id);

    IF v_reward_id IS NULL THEN
      RAISE EXCEPTION 'PROMO_REWARD_UNAVAILABLE: menu hadiah promo tidak tersedia';
    END IF;

    IF v_item.menu_item_id IS DISTINCT FROM v_reward_id
       OR coalesce(v_item.quantity, 0) < 1
       OR coalesce(v_item.unit_price, 0) <> 0
       OR coalesce(v_item.subtotal, 0) <> 0 THEN
      RAISE EXCEPTION 'PROMO_INVALID: baris hadiah harus menu hadiah promo gratis';
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
$function$
;

REVOKE ALL ON FUNCTION public.apply_buy_x_get_y_redemption() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_order jsonb, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid := nullif(p_order->>'id', '')::uuid;
  v_order_outlet_id uuid := nullif(p_order->>'outlet_id', '')::uuid;
  v_order public.orders;
BEGIN
  IF v_order_id IS NULL OR v_order_outlet_id IS NULL THEN
    RAISE EXCEPTION 'create_order_with_items: id dan outlet_id wajib diisi';
  END IF;

  INSERT INTO public.orders (
    id, order_number, outlet_id, customer_name, status, source, payment_method,
    discount_amount, promo_subsidy, total_amount, amount_received, change_amount,
    created_at, channel, pickup_time, release_time, cashier_name, pos_client, is_offline_sync
  )
  SELECT
    v_order_id, coalesce((p_order->>'order_number')::int, 0), v_order_outlet_id,
    p_order->>'customer_name', coalesce(p_order->>'status', 'pending'),
    coalesce(p_order->>'source', 'pos'), p_order->>'payment_method',
    coalesce((p_order->>'discount_amount')::numeric, 0),
    coalesce((p_order->>'promo_subsidy')::int, 0),
    (p_order->>'total_amount')::numeric, (p_order->>'amount_received')::numeric,
    (p_order->>'change_amount')::numeric,
    coalesce((p_order->>'created_at')::timestamptz, now()), p_order->>'channel',
    (p_order->>'pickup_time')::timestamptz, (p_order->>'release_time')::timestamptz,
    p_order->>'cashier_name', coalesce(p_order->>'pos_client', 'native'),
    coalesce((p_order->>'is_offline_sync')::boolean, false)
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
    IF v_order.id IS NULL THEN
      RAISE EXCEPTION 'create_order_with_items: order tidak tersimpan';
    END IF;
    IF v_order.outlet_id <> v_order_outlet_id THEN
      RAISE EXCEPTION 'create_order_with_items: outlet order tidak cocok';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_id) THEN
    INSERT INTO public.order_items (
      order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal,
      is_promo_reward, promo_id, promo_name, promo_buy_quantity, promo_get_quantity,
      original_unit_price
    )
    SELECT
      v_order_id,
      CASE
        WHEN coalesce((item.raw->>'is_promo_reward')::boolean, false)
          AND reward_item.id IS NOT NULL THEN reward_item.id
        ELSE nullif(item.raw->>'menu_item_id', '')::uuid
      END,
      CASE
        WHEN coalesce((item.raw->>'is_promo_reward')::boolean, false)
          AND reward_item.id IS NOT NULL THEN reward_item.name
        ELSE item.raw->>'menu_item_name'
      END,
      (item.raw->>'quantity')::int,
      CASE
        WHEN coalesce((item.raw->>'is_promo_reward')::boolean, false)
          AND reward_item.id IS NOT NULL THEN 0
        ELSE (item.raw->>'unit_price')::numeric
      END,
      CASE
        WHEN coalesce((item.raw->>'is_promo_reward')::boolean, false)
          AND reward_item.id IS NOT NULL THEN 0
        ELSE (item.raw->>'subtotal')::numeric
      END,
      coalesce((item.raw->>'is_promo_reward')::boolean, false),
      nullif(item.raw->>'promo_id', '')::uuid,
      nullif(item.raw->>'promo_name', ''),
      nullif(item.raw->>'promo_buy_quantity', '')::integer,
      nullif(item.raw->>'promo_get_quantity', '')::integer,
      CASE
        WHEN coalesce((item.raw->>'is_promo_reward')::boolean, false)
          AND reward_item.id IS NOT NULL THEN reward_item.price
        ELSE nullif(item.raw->>'original_unit_price', '')::numeric
      END
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS item(raw)
    LEFT JOIN LATERAL (
      SELECT p.reward_menu_item_id, p.outlet_id
      FROM public.outlet_promos AS p
      WHERE p.id = nullif(item.raw->>'promo_id', '')::uuid
        AND p.discount_type = 'buy_one_get_one'
      LIMIT 1
    ) AS promo ON true
    LEFT JOIN LATERAL (
      SELECT m.id, m.name, m.price
      FROM public.menu_items AS m
      WHERE coalesce((item.raw->>'is_promo_reward')::boolean, false)
        AND m.id = public.bxgy_reward_menu_id(promo.reward_menu_item_id, v_order_outlet_id)
    ) AS reward_item ON true;
  END IF;

  RETURN to_jsonb(v_order);
END;
$function$

;

REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;
