-- Event wiring for the dedicated Stokist bot (Stok + Distribusi).
-- Database calls apps/bot; the Telegram token stays in Coolify, not SQL.

CREATE OR REPLACE FUNCTION public.bot_telegram_kirim_alert(
  p_staff_id uuid,
  p_app text,
  p_title text,
  p_body text,
  p_url text,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  IF p_staff_id IS NULL OR p_app IS NULL OR p_app NOT IN ('stok', 'distribusi')
    OR p_title IS NULL OR p_body IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bot_telegram_links l
    JOIN public.outlet_staff s ON s.id = l.staff_id AND s.status = 'active'
    WHERE l.staff_id = p_staff_id
      AND (p_outlet_id IS NULL OR s.role IN ('owner', 'admin', 'kitchen', 'purchasing', 'developer')
        OR s.outlet_id = p_outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = p_outlet_id
        ))
  ) THEN RETURN; END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'telegram_stokist_send_secret' LIMIT 1;
  IF COALESCE(v_url, '') = '' OR COALESCE(v_secret, '') = '' THEN
    RAISE WARNING 'Alert Stokist % dilewati: Vault telegram_stokist_send_url/telegram_stokist_send_secret belum tersedia.', p_app;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'user_id', p_staff_id,
      'app', p_app,
      'title', left(p_title, 180),
      'body', left(p_body, 1200),
      'url', p_url
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Telegram must not roll back stock or shipment operations.
  RAISE WARNING 'Gagal mengantrekan alert Telegram % untuk staf %: %', p_app, p_staff_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_kirim_alert(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Existing native push remains intact. Telegram goes to linked staff.
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_surat_jalan_dikirim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  r record;
BEGIN
  IF NEW.status <> 'dikirim' OR OLD.status IS NOT DISTINCT FROM 'dikirim' THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');
  IF v_outlet_name IS NULL THEN RETURN NEW; END IF;

  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('leader', 'crew')
      AND (
        s.outlet_id = NEW.outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
        )
      )
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'distribusi',
      '🚚 Surat jalan dikirim · ' || v_outlet_name,
      'Surat jalan ' || left(NEW.id::text, 8) || ' perlu dikonfirmasi saat barang diterima.',
      'https://distribusi.sukashawarma.com/distribusi/terima',
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_surat_jalan_dikirim() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_bot_telegram_surat_jalan_dikirim ON public.surat_jalan;
CREATE TRIGGER trg_bot_telegram_surat_jalan_dikirim
  AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_surat_jalan_dikirim();

-- A partially received shipment means at least one item was flagged during
-- outlet verification. Escalate that actionable discrepancy to central ops.
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_selisih_penerimaan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  r record;
BEGIN
  IF NEW.status <> 'diterima_sebagian' OR OLD.status IS NOT DISTINCT FROM 'diterima_sebagian' THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');
  IF v_outlet_name IS NULL THEN RETURN NEW; END IF;

  FOR r IN
    SELECT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('kitchen', 'purchasing', 'admin', 'owner')
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'distribusi',
      '⚠️ Selisih penerimaan · ' || v_outlet_name,
      'Penerimaan surat jalan outlet ini memiliki item yang ditandai selisih. Mohon tinjau hasil verifikasinya.',
      'https://distribusi.sukashawarma.com/distribusi/terima/' || NEW.id::text,
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_selisih_penerimaan() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_bot_telegram_selisih_penerimaan ON public.surat_jalan;
CREATE TRIGGER trg_bot_telegram_selisih_penerimaan
  AFTER UPDATE OF status ON public.surat_jalan
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_selisih_penerimaan();

-- Notify outlet leaders when stock crosses its effective (outlet override or
-- material default) reorder point. No repeat is sent while it stays below.
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_stok_kritis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_threshold numeric;
  v_outlet_name text;
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_item_name IS NULL OR NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role = 'leader'
      AND (
        s.outlet_id = NEW.outlet_id
        OR EXISTS (
          SELECT 1 FROM public.staff_outlets so
          WHERE so.staff_id = s.id AND so.outlet_id = NEW.outlet_id
        )
      )
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      '⚠️ Stok mencapai batas minimum · ' || v_outlet_name,
      'Stok ' || v_item_name || ' tersisa ' || NEW.saldo::text || '. Segera ajukan pemenuhan stok.',
      'https://stok.sukashawarma.com/stok/permintaan',
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_stok_kritis() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_bot_telegram_stok_kritis ON public.stok_balance;
CREATE TRIGGER trg_bot_telegram_stok_kritis
  AFTER INSERT OR UPDATE ON public.stok_balance
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_stok_kritis();

COMMENT ON FUNCTION public.bot_telegram_kirim_alert(uuid, text, text, text, text, uuid) IS
  'Mengantrekan alert Stok/Distribusi untuk staf yang menautkan bot Stokist.';
