-- supabase/migrations/20260805170000_atomic_insert_order_rpc.sql
CREATE OR REPLACE FUNCTION public.atomic_insert_order(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_order_number int;
  v_item jsonb;
  v_created_at timestamptz;
BEGIN
  -- Handle created_at separately to support client-provided timestamps
  IF p_order ? 'created_at' AND (p_order->>'created_at') IS NOT NULL THEN
    v_created_at := (p_order->>'created_at')::timestamptz;
  ELSE
    v_created_at := now();
  END IF;

  INSERT INTO public.orders (
    outlet_id,
    client_order_id,
    customer_name,
    customer_phone,
    cashier_name,
    notes,
    payment_method,
    total_amount,
    discount_amount,
    promo_subsidy,
    payment_proof_url,
    amount_received,
    change_amount,
    status,
    kitchen_receipt_printed,
    source,
    channel,
    sales_source,
    external_order_id,
    created_at,
    updated_at
  )
  VALUES (
    (p_order->>'outlet_id')::uuid,
    (p_order->>'client_order_id')::uuid,
    p_order->>'customer_name',
    p_order->>'customer_phone',
    p_order->>'cashier_name',
    p_order->>'notes',
    p_order->>'payment_method',
    (p_order->>'total_amount')::numeric,
    (p_order->>'discount_amount')::numeric,
    COALESCE((p_order->>'promo_subsidy')::numeric, 0),
    p_order->>'payment_proof_url',
    (p_order->>'amount_received')::numeric,
    (p_order->>'change_amount')::numeric,
    COALESCE(p_order->>'status', 'pending'),
    COALESCE((p_order->>'kitchen_receipt_printed')::boolean, false),
    p_order->>'source',
    p_order->>'channel',
    COALESCE(p_order->>'sales_source', p_order->>'channel', p_order->>'source'),
    p_order->>'external_order_id',
    v_created_at,
    COALESCE((p_order->>'updated_at')::timestamptz, v_created_at)
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  IF jsonb_typeof(p_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      BEGIN
        INSERT INTO public.order_items (
          order_id,
          menu_item_id,
          menu_item_name,
          quantity,
          unit_price,
          subtotal,
          package_choices
        ) VALUES (
          v_order_id,
          (v_item->>'menu_item_id')::uuid,
          v_item->>'menu_item_name',
          (v_item->>'quantity')::int,
          (v_item->>'unit_price')::numeric,
          (v_item->>'subtotal')::numeric,
          v_item->'package_choices'
        );
      EXCEPTION WHEN foreign_key_violation THEN
        -- Fallback: If menu_item_id is invalid/deleted, insert with NULL but preserve name
        INSERT INTO public.order_items (
          order_id,
          menu_item_id,
          menu_item_name,
          quantity,
          unit_price,
          subtotal,
          package_choices
        ) VALUES (
          v_order_id,
          NULL,
          v_item->>'menu_item_name',
          (v_item->>'quantity')::int,
          (v_item->>'unit_price')::numeric,
          (v_item->>'subtotal')::numeric,
          v_item->'package_choices'
        );
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number);
END;
$$;
