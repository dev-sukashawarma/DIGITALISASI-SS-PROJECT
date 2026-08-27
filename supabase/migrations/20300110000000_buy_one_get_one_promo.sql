-- Audit reward B1G1 disimpan sebagai order_item agar laporan dan BOM membaca
-- unit berbayar serta unit gratis sebagai porsi yang berbeda.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_promo_reward boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_id uuid REFERENCES public.outlet_promos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_name text,
  ADD COLUMN IF NOT EXISTS original_unit_price numeric;

ALTER TABLE public.outlet_promos
  DROP CONSTRAINT IF EXISTS outlet_promos_discount_type_check;

ALTER TABLE public.outlet_promos
  ADD CONSTRAINT outlet_promos_discount_type_check
  CHECK (discount_type IN ('percentage', 'nominal', 'buy_one_get_one'));

ALTER TABLE public.outlet_promos
  DROP CONSTRAINT IF EXISTS outlet_promos_buy_one_get_one_scope_check;

ALTER TABLE public.outlet_promos
  ADD CONSTRAINT outlet_promos_buy_one_get_one_scope_check
  CHECK (
    discount_type <> 'buy_one_get_one'
    OR (scope = 'item' AND menu_item_id IS NOT NULL AND COALESCE(apply_to_food_apps, false) = false)
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

  -- Retry dengan UUID sama tidak memasukkan item atau mutasi BOM dua kali.
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_id) THEN
    INSERT INTO public.order_items (
      order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal,
      is_promo_reward, promo_id, promo_name, original_unit_price
    )
    SELECT
      v_order_id, nullif(it->>'menu_item_id', '')::uuid, it->>'menu_item_name',
      (it->>'quantity')::int, (it->>'unit_price')::numeric, (it->>'subtotal')::numeric,
      coalesce((it->>'is_promo_reward')::boolean, false),
      nullif(it->>'promo_id', '')::uuid, nullif(it->>'promo_name', ''),
      nullif(it->>'original_unit_price', '')::numeric
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS it;
  END IF;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_with_items(jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb, jsonb) TO authenticated;
