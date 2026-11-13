-- Label kategori di push AM disamakan dengan POS native (PettyCashCategory):
-- Outlet, Bahan baku lainnya, Gas, Transport, Listrik, Internet, Overtime, Endorsement;
-- pdam (warisan) = Air. Lanjutan 20261113120000.

CREATE OR REPLACE FUNCTION public.petty_cash_expense_push_am_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_outlet text;
  v_kategori text;
  v_judul text;
  v_isi text;
  v_recip record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RAISE WARNING 'Push pengeluaran petty cash dilewati: secret push belum tersedia.';
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    v_kategori := CASE NEW.category
      WHEN 'pengeluaran_outlet' THEN 'Outlet'
      WHEN 'bahan_baku' THEN 'Bahan baku lainnya'
      WHEN 'gas' THEN 'Gas'
      WHEN 'transport' THEN 'Transport'
      WHEN 'pln' THEN 'Listrik'
      WHEN 'pdam' THEN 'Air'
      WHEN 'internet' THEN 'Internet'
      WHEN 'lembur' THEN 'Overtime'
      WHEN 'endorsement' THEN 'Endorsement'
      WHEN 'rab' THEN 'RAB'
      ELSE initcap(replace(COALESCE(NEW.category, 'pengeluaran'), '_', ' '))
    END;
    v_judul := 'Pengeluaran menunggu ACC · ' || COALESCE(v_outlet, 'Outlet');
    v_isi := v_kategori || ' Rp ' || replace(to_char(NEW.amount, 'FM999,999,999'), ',', '.') ||
      CASE WHEN COALESCE(btrim(NEW.description), '') <> ''
        THEN ' · ' || left(btrim(NEW.description), 80) ELSE '' END ||
      '. Kasir belum bisa tutup shift sebelum diproses.';

    FOR v_recip IN
      SELECT s.id
      FROM public.staff_outlets so
      JOIN public.outlet_staff s ON s.id = so.staff_id
      WHERE so.outlet_id = NEW.outlet_id
        AND s.role = 'area_manager'
        AND s.status = 'active'
        AND s.id IS DISTINCT FROM NEW.created_by
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'manager',
          'title', v_judul,
          'body', v_isi,
          'url', 'manager_petty_cash_pengeluaran'
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- Push tidak boleh menggagalkan pencatatan pengeluaran kasir.
    RAISE WARNING 'Gagal mengirim push pengeluaran petty cash %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.petty_cash_expense_push_am_pending() FROM PUBLIC, anon, authenticated;
