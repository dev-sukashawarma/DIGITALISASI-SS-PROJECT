-- Trigger for Surat Jalan Tiba (Distribusi)
CREATE OR REPLACE FUNCTION public.trigger_distribusi_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
  v_req_id BIGINT;
BEGIN
  -- Trigger when status changes to 'dikirim' (meaning it's on the way or has arrived for the outlet to check)
  IF NEW.status = 'dikirim' AND (OLD.status IS NULL OR OLD.status != 'dikirim') THEN
    v_payload := jsonb_build_object(
      'outlet_id', NEW.outlet_id,
      'app', 'distribusi',
      'title', 'Bahan Baku Tiba / Sedang Dikirim',
      'body', 'Surat Jalan baru siap untuk diverifikasi.',
      'url', '/',
      'target_roles', '["leader", "crew"]'::jsonb
    );

    SELECT net.http_post(
      url := current_setting('app.settings.edge_function_url', true) || '/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := v_payload
    ) INTO v_req_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------

-- Trigger for Stok Minimum (Stok)
CREATE OR REPLACE FUNCTION public.trigger_stok_minimum_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
  v_req_id BIGINT;
  v_bahan_nama TEXT;
  v_reorder_point NUMERIC;
BEGIN
  -- Get the reorder point and name from bahan_baku
  SELECT nama, default_reorder_point INTO v_bahan_nama, v_reorder_point
  FROM public.bahan_baku
  WHERE id = NEW.bahan_baku_id;

  -- Trigger only when saldo drops below or equal to reorder point, and previously it was above it
  IF NEW.saldo <= v_reorder_point AND (OLD IS NULL OR OLD.saldo > v_reorder_point) THEN
    v_payload := jsonb_build_object(
      'outlet_id', NEW.outlet_id,
      'app', 'stok',
      'title', 'Peringatan Minimum Stok',
      'body', 'Stok ' || v_bahan_nama || ' tersisa ' || NEW.saldo::text || '. Segera lakukan permintaan.',
      'url', '/',
      'target_roles', '["leader"]'::jsonb
    );

    SELECT net.http_post(
      url := current_setting('app.settings.edge_function_url', true) || '/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := v_payload
    ) INTO v_req_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
