-- supabase/migrations/20300203000000_order_status_trigger_notifications.sql
-- Trigger PostgreSQL & pg_net Webhook saat status pesanan berubah di POS Kasir (Opsi A)

-- 1. Pastikan ekstensi pg_net aktif
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Fungsi trigger saat status pesanan diperbarui
CREATE OR REPLACE FUNCTION public.trigger_customer_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_draft RECORD;
  v_title TEXT;
  v_body TEXT;
  v_order_num TEXT;
  v_notify_enabled BOOLEAN := true;
  v_gateway_url TEXT;
  v_secret TEXT;
  v_req_id BIGINT;
BEGIN
  -- Hanya proses bila status benar-benar berubah
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Cari relasi pesanan aplikasi retail di skema retail.order_drafts
    SELECT id, customer_id, pos_order_number
    INTO v_draft
    FROM retail.order_drafts
    WHERE pos_order_id = NEW.id
       OR (pos_order_number = NEW.order_number AND pos_order_number IS NOT NULL)
    LIMIT 1;

    -- Hanya eksekusi jika pesanan ini milik pelanggan aplikasi mobile retail
    IF FOUND AND v_draft.customer_id IS NOT NULL THEN
      v_order_num := COALESCE(NEW.order_number::text, v_draft.pos_order_number::text, '');

      -- Tentukan teks notifikasi berdasarkan status baru
      CASE NEW.status
        WHEN 'preparing' THEN
          v_title := 'Sedang Disiapkan 👨‍🍳';
          v_body := 'Pesanan #' || v_order_num || ' sedang disiapkan oleh kru dapur.';
        WHEN 'ready' THEN
          v_title := 'Pesanan Siap Diambil! 🌯';
          v_body := 'Pesanan #' || v_order_num || ' sudah selesai dimasak dan siap diambil di kasir.';
        WHEN 'completed' THEN
          v_title := 'Pesanan Selesai ✅';
          v_body := 'Pesanan #' || v_order_num || ' telah diambil. Selamat menikmati hidangan Suka Shawarma!';
        WHEN 'cancelled' THEN
          v_title := 'Pesanan Dibatalkan ❌';
          v_body := 'Pesanan #' || v_order_num || ' telah dibatalkan.';
        ELSE
          v_title := 'Status Pesanan Diperbarui';
          v_body := 'Status pesanan #' || v_order_num || ' telah diperbarui menjadi ' || NEW.status || '.';
      END CASE;

      -- Periksa preferensi pelanggan (default true jika belum disetel)
      SELECT COALESCE(notify_order_status, true)
      INTO v_notify_enabled
      FROM retail.customer_push_tokens
      WHERE customer_id = v_draft.customer_id
      ORDER BY updated_at DESC
      LIMIT 1;

      IF v_notify_enabled IS NULL THEN
        v_notify_enabled := true;
      END IF;

      -- A. Catat langsung ke tabel customer_notifications (In-App Inbox)
      IF v_notify_enabled THEN
        INSERT INTO retail.customer_notifications (
          customer_id,
          order_id,
          type,
          title,
          body,
          data,
          is_read,
          created_at
        )
        SELECT
          v_draft.customer_id,
          v_draft.id,
          'order_status',
          v_title,
          v_body,
          jsonb_build_object(
            'order_id', v_draft.id,
            'status', NEW.status,
            'order_number', NEW.order_number
          ),
          false,
          NOW()
        WHERE NOT EXISTS (
          -- Cegah duplikasi jika notifikasi status yang sama baru saja tercatat (< 10 detik)
          SELECT 1 FROM retail.customer_notifications
          WHERE order_id = v_draft.id
            AND (data->>'status') = NEW.status
            AND created_at > NOW() - INTERVAL '10 seconds'
        );
      END IF;

      -- B. Tembak webhook API Gateway / Edge Function via pg_net (untuk Push Notification FCM)
      BEGIN
        v_gateway_url := current_setting('app.settings.retail_gateway_url', true);
        IF v_gateway_url IS NULL OR v_gateway_url = '' THEN
          v_gateway_url := current_setting('app.settings.edge_function_url', true);
        END IF;
        v_secret := current_setting('app.settings.service_role_key', true);

        IF v_gateway_url IS NOT NULL AND v_gateway_url <> '' THEN
          SELECT net.http_post(
            url := v_gateway_url || '/api/internal/orders/status-changed',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || COALESCE(v_secret, ''),
              'x-internal-secret', COALESCE(v_secret, '')
            ),
            body := jsonb_build_object(
              'order_id', NEW.id,
              'status', NEW.status,
              'order_number', NEW.order_number,
              'source', 'pg_trigger'
            )
          ) INTO v_req_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Jangan gagalkan transaksi kasir jika pemanggilan pg_net gagal
        RAISE WARNING 'Gagal mengirim push webhook pg_net: %', SQLERRM;
      END;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Pasang Trigger pada tabel public.orders
DROP TRIGGER IF EXISTS trg_customer_order_status_notification ON public.orders;

CREATE TRIGGER trg_customer_order_status_notification
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_customer_order_status_notification();

COMMENT ON FUNCTION public.trigger_customer_order_status_notification() IS
  'Trigger database event-driven untuk notifikasi status pesanan pelanggan aplikasi retail (Opsi A)';
