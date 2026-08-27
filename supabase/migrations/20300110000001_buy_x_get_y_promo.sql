-- Kontrak kanonis Buy X Get Y. Promo B1G1 lama otomatis memakai default 1/1.

ALTER TABLE public.outlet_promos
  ADD COLUMN IF NOT EXISTS buy_quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS get_quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS promo_buy_quantity integer,
  ADD COLUMN IF NOT EXISTS promo_get_quantity integer;

ALTER TABLE public.outlet_promos
  DROP CONSTRAINT IF EXISTS outlet_promos_buy_one_get_one_scope_check;

ALTER TABLE public.outlet_promos
  ADD CONSTRAINT outlet_promos_buy_one_get_one_scope_check
  CHECK (
    discount_type <> 'buy_one_get_one'
    OR (
      scope = 'item'
      AND menu_item_id IS NOT NULL
      AND COALESCE(apply_to_food_apps, false) = false
      AND buy_quantity >= 1
      AND get_quantity >= 1
    )
  );

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_order jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid := nullif(p_order->>'id', '')::uuid;
  v_order public.orders;
BEGIN
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'create_order_with_items: p_order.id wajib diisi';
  END IF;

  INSERT INTO public.orders (
    id, order_number, outlet_id, customer_name, status, source, payment_method,
    discount_amount, promo_subsidy, total_amount, amount_received, change_amount,
    created_at, channel, pickup_time, release_time, cashier_name, pos_client, is_offline_sync
  )
  SELECT
    v_order_id, coalesce((p_order->>'order_number')::int, 0),
    (p_order->>'outlet_id')::uuid, p_order->>'customer_name',
    coalesce(p_order->>'status', 'pending'), coalesce(p_order->>'source', 'pos'),
    p_order->>'payment_method', coalesce((p_order->>'discount_amount')::numeric, 0),
    coalesce((p_order->>'promo_subsidy')::int, 0), (p_order->>'total_amount')::numeric,
    (p_order->>'amount_received')::numeric, (p_order->>'change_amount')::numeric,
    coalesce((p_order->>'created_at')::timestamptz, now()), p_order->>'channel',
    (p_order->>'pickup_time')::timestamptz, (p_order->>'release_time')::timestamptz,
    p_order->>'cashier_name', coalesce(p_order->>'pos_client', 'native'),
    coalesce((p_order->>'is_offline_sync')::boolean, false)
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
    IF v_order.id IS NULL THEN
      RAISE EXCEPTION 'create_order_with_items: order % tidak tersimpan (kemungkinan ditolak RLS)', v_order_id;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_id) THEN
    INSERT INTO public.order_items (
      order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal,
      is_promo_reward, promo_id, promo_name, promo_buy_quantity, promo_get_quantity,
      original_unit_price
    )
    SELECT
      v_order_id, nullif(it->>'menu_item_id', '')::uuid, it->>'menu_item_name',
      (it->>'quantity')::int, (it->>'unit_price')::numeric, (it->>'subtotal')::numeric,
      coalesce((it->>'is_promo_reward')::boolean, false),
      nullif(it->>'promo_id', '')::uuid, nullif(it->>'promo_name', ''),
      nullif(it->>'promo_buy_quantity', '')::integer,
      nullif(it->>'promo_get_quantity', '')::integer,
      nullif(it->>'original_unit_price', '')::numeric
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS it;
  END IF;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;

-- POS browser memakai RPC berbeda; simpan metadata reward yang sama agar
-- histori, stok BOM, dan laporan tidak kehilangan konteks Buy X Get Y.
CREATE OR REPLACE FUNCTION public.atomic_insert_order(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_order_id uuid; v_order_number int; v_item jsonb; v_created_at timestamptz;
BEGIN
  v_created_at := COALESCE((p_order->>'created_at')::timestamptz, now());
  INSERT INTO public.orders (
    outlet_id, client_order_id, customer_name, customer_phone, cashier_name, notes,
    payment_method, total_amount, discount_amount, promo_subsidy, payment_proof_url,
    amount_received, change_amount, status, kitchen_receipt_printed, source, channel,
    sales_source, external_order_id, is_endorse, scheduled_promo_names, created_at, updated_at
  ) VALUES (
    (p_order->>'outlet_id')::uuid, (p_order->>'client_order_id')::uuid,
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'cashier_name', p_order->>'notes',
    p_order->>'payment_method', (p_order->>'total_amount')::numeric, (p_order->>'discount_amount')::numeric,
    COALESCE((p_order->>'promo_subsidy')::numeric, 0), p_order->>'payment_proof_url',
    (p_order->>'amount_received')::numeric, (p_order->>'change_amount')::numeric,
    COALESCE(p_order->>'status', 'pending'), COALESCE((p_order->>'kitchen_receipt_printed')::boolean, false),
    p_order->>'source', p_order->>'channel', COALESCE(p_order->>'sales_source', p_order->>'channel', p_order->>'source'),
    p_order->>'external_order_id', COALESCE((p_order->>'is_endorse')::boolean, false),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_order->'scheduled_promo_names', '[]'::jsonb))), '{}'),
    v_created_at, COALESCE((p_order->>'updated_at')::timestamptz, v_created_at)
  ) RETURNING id, order_number INTO v_order_id, v_order_number;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (
      order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, package_choices,
      is_promo_reward, promo_id, promo_name, promo_buy_quantity, promo_get_quantity
    ) VALUES (
      v_order_id, NULLIF(v_item->>'menu_item_id', '')::uuid, v_item->>'menu_item_name',
      (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric, (v_item->>'subtotal')::numeric, v_item->'package_choices',
      COALESCE((v_item->>'is_promo_reward')::boolean, false), NULLIF(v_item->>'promo_id', '')::uuid,
      NULLIF(v_item->>'promo_name', ''), NULLIF(v_item->>'promo_buy_quantity', '')::integer,
      NULLIF(v_item->>'promo_get_quantity', '')::integer
    );
  END LOOP;
  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
END;
$$;
