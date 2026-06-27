-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to trigger push notification
CREATE OR REPLACE FUNCTION public.trigger_order_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
  v_req_id BIGINT;
  v_url TEXT;
  v_key TEXT;
BEGIN
  -- Only trigger for new pending orders from kiosk or online
  IF NEW.status = 'pending' THEN
    BEGIN
      v_url := current_setting('app.settings.edge_function_url', true);
      v_key := current_setting('app.settings.service_role_key', true);
      
      IF v_url IS NOT NULL AND v_key IS NOT NULL AND v_url <> '' AND v_key <> '' THEN
        v_payload := jsonb_build_object(
          'outlet_id', NEW.outlet_id,
          'app', 'pos-kasir',
          'title', 'Pesanan Kiosk Masuk!',
          'body', 'Order #' || left(NEW.id::text, 8) || ' siap diproses.',
          'url', '/kasir'
        );

        SELECT net.http_post(
          url := v_url || '/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
          ),
          body := v_payload
        ) INTO v_req_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Fail silently so order creation is never blocked
      RAISE WARNING 'Failed to trigger order push notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on orders table
DROP TRIGGER IF EXISTS on_order_created_send_push ON public.orders;

CREATE TRIGGER on_order_created_send_push
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_push_notification();

-- Note: To make this work, you must set these custom settings in Postgres:
-- ALTER DATABASE postgres SET "app.settings.edge_function_url" TO 'https://<project-ref>.supabase.co/functions/v1';
-- ALTER DATABASE postgres SET "app.settings.service_role_key" TO '<your-service-role-key>';
