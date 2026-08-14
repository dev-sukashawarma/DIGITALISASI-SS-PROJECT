-- Nama promo untuk konfigurasi serta snapshot promo terjadwal pada transaksi.
ALTER TABLE public.outlet_promos
  ADD COLUMN IF NOT EXISTS promo_name text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_promo_names text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.orders.scheduled_promo_names IS
  'Nama promo terjadwal yang benar-benar diterapkan ketika order dibuat.';

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
    INSERT INTO public.order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, package_choices)
    VALUES (v_order_id, NULLIF(v_item->>'menu_item_id', '')::uuid, v_item->>'menu_item_name',
      (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric, (v_item->>'subtotal')::numeric, v_item->'package_choices');
  END LOOP;
  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
END;
$$;
