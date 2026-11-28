-- ============================================================================
-- Migration: Grace Period Top-Up Petty Cash 17:00 WIB + Jalur Proses Darurat
-- ============================================================================
-- Lanjutan 20261126100000_pengeluaran_dan_topup_petty_cash_finance.sql (28 Nov 2026):
-- Masalah nyata: batas input outlet (16:00 WIB) sama persis dengan jam auto-batal
-- sistem & blokir proses Finance (16:00 WIB). Outlet yang mengajukan pukul 15:35 WIB
-- langsung auto-batal saat Finance baru buka dashboard pukul 16:00 lewat.
--
-- Solusi:
-- 1. Input outlet (Leader, `create_petty_cash_topup`) TETAP 09:00–16:00 WIB.
-- 2. Batas proses normal Finance & auto-batal sistem (`pg_cron`) digeser ke
--    17:00 WIB (0 10 * * * UTC) — memberi jeda 1 jam untuk memproses antrean sore.
-- 3. Jalur Proses Darurat (`finance_buka_kembali_topup_darurat`):
--    Khusus top-up yang terlanjur auto-batal pada HARI YANG SAMA (WIB),
--    Finance/Admin/Owner dapat membukanya kembali ke `forwarded_to_finance`
--    (`is_darurat = true`) dengan alasan darurat wajib, lalu mencairkannya di
--    Hub Approval meskipun sudah lewat pukul 17:00 WIB.
-- ============================================================================

SET LOCAL lock_timeout = '10s';

-- 1. Penanda jalur darurat pada petty_cash_topups (metadata-only, tanpa rewrite)
ALTER TABLE public.petty_cash_topups
  ADD COLUMN IF NOT EXISTS is_darurat boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.petty_cash_topups.is_darurat IS
  'True bila pengajuan yang auto-batal hari itu dibuka kembali oleh Finance/Owner lewat jalur Proses Darurat agar tetap bisa dicairkan melewati batas pukul 17:00 WIB.';

-- 2. Mesin status: izinkan transisi rejected -> forwarded_to_finance HANYA lewat jalur darurat
CREATE OR REPLACE FUNCTION public.petty_cash_enforce_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, '') <> 'forwarded_to_finance' THEN
      RAISE EXCEPTION 'Pengajuan petty cash harus lahir dengan status forwarded_to_finance (dicoba: %). Auto-approve dilarang.', NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  IF (OLD.status, NEW.status) = ('rejected', 'forwarded_to_finance')
     AND COALESCE(NEW.is_darurat, false) THEN
    RETURN NEW;
  END IF;

  IF (OLD.status, NEW.status) NOT IN (
    ('forwarded_to_finance', 'approved_by_finance'),
    ('forwarded_to_finance', 'rejected'),
    ('approved_by_finance',  'forwarded_by_leader'),
    ('forwarded_by_leader',  'completed')
  ) THEN
    RAISE EXCEPTION 'Transisi status petty cash tidak sah: % -> %. Pengajuan hanya bisa ditolak sebelum dana dicairkan.', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'approved_by_finance' AND length(btrim(COALESCE(NEW.proof_of_transfer_url, ''))) = 0 THEN
    RAISE EXCEPTION 'Bukti transfer/serah uang wajib dilampirkan sebelum pengajuan ditandai dicairkan';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Auto-batal pukul 17:00 WIB (lewati baris yang sedang dibuka sebagai darurat hari ini)
CREATE OR REPLACE FUNCTION public.batal_otomatis_topup_petty_cash_lewat_batas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
  v_url TEXT;
  v_key TEXT;
  v_outlet_nama TEXT;
  v_nominal_fmt TEXT;
  v_target RECORD;
  v_alasan CONSTANT TEXT := 'Dibatalkan otomatis oleh sistem karena melewati batas pukul 17:00 WIB';
  v_desc_baru TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
    v_key := NULL;
  END;

  FOR v_row IN
    SELECT id, outlet_id, amount, description, created_by
    FROM public.petty_cash_topups
    WHERE status = 'forwarded_to_finance'
      AND (
        NOT COALESCE(is_darurat, false)
        OR (created_at AT TIME ZONE 'Asia/Jakarta')::date < (NOW() AT TIME ZONE 'Asia/Jakarta')::date
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    v_desc_baru := CASE
      WHEN COALESCE(v_row.description, '') LIKE '%[Ditolak Finance:%' THEN v_row.description
      ELSE COALESCE(NULLIF(btrim(v_row.description), ''), 'Pengajuan Top Up Petty Cash')
           || E'\n\n[Ditolak Finance: ' || v_alasan || ']'
    END;

    UPDATE public.petty_cash_topups
    SET
      status = 'rejected',
      finance_approved_by = NULL,
      description = v_desc_baru
    WHERE id = v_row.id
      AND status = 'forwarded_to_finance';

    v_count := v_count + 1;

    IF COALESCE(v_url, '') <> '' AND COALESCE(v_key, '') <> '' THEN
      BEGIN
        SELECT name INTO v_outlet_nama FROM public.outlets WHERE id = v_row.outlet_id;
        v_outlet_nama := COALESCE(v_outlet_nama, 'Outlet');
        v_nominal_fmt := replace(to_char(COALESCE(v_row.amount, 0), 'FM999,999,999,999'), ',', '.');

        FOR v_target IN
          SELECT v_row.created_by AS id WHERE v_row.created_by IS NOT NULL
          UNION
          SELECT os.id FROM public.outlet_staff os
          WHERE v_row.created_by IS NULL
            AND os.outlet_id = v_row.outlet_id
            AND os.role = 'leader'
            AND os.status = 'active'
            AND COALESCE(os.is_active, true)
        LOOP
          PERFORM net.http_post(
            url := v_url,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_key
            ),
            body := jsonb_build_object(
              'user_id', v_target.id,
              'app', 'leader',
              'type', 'petty_cash_cancelled',
              'title', '⏰ Top Up Petty Cash Dibatalkan Otomatis',
              'body', 'Pengajuan top up ' || v_outlet_nama || ' Rp ' || v_nominal_fmt
                   || ' dibatalkan otomatis oleh sistem karena melewati batas proses pukul 17:00 WIB. Silakan ajukan kembali besok pukul 09:00–16:00 WIB atau hubungi Finance bila darurat.',
              'url', 'leader_petty_cash'
            )
          );
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Push auto-batal topup % gagal: %', v_row.id, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.batal_otomatis_topup_petty_cash_lewat_batas() FROM PUBLIC, anon, authenticated;

-- Pindahkan jadwal pg_cron dari 16:00 WIB (0 9 * * *) ke 17:00 WIB (0 10 * * *)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('petty-cash-topup-auto-batal-16wib', 'petty-cash-topup-auto-batal-17wib');

    PERFORM cron.schedule(
      'petty-cash-topup-auto-batal-17wib',
      '0 10 * * *',
      'SELECT public.batal_otomatis_topup_petty_cash_lewat_batas();'
    );
  ELSE
    RAISE NOTICE 'pg_cron belum aktif: job petty-cash-topup-auto-batal-17wib dilewati.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Pendaftaran pg_cron petty-cash-topup-auto-batal-17wib gagal: %', SQLERRM;
END $$;

-- 4. Pencairan Finance: batas normal 17:00 WIB; bila is_darurat = true pada hari yang sama tetap boleh diproses
CREATE OR REPLACE FUNCTION public.finance_process_petty_cash_custom(
  p_topup_id uuid,
  p_action text,
  p_method text DEFAULT 'transfer'::text,
  p_cash_location_id uuid DEFAULT NULL::uuid,
  p_proof_of_transfer_url text DEFAULT NULL::text,
  p_final_amount numeric DEFAULT NULL::numeric,
  p_description text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_topup public.petty_cash_topups%ROWTYPE;
  v_amount numeric;
  v_saldo numeric;
  v_now_wib timestamp;
BEGIN
  IF NOT public.kas_pencatat_ok() AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role = 'developer'
  ) THEN
    RAISE EXCEPTION 'Hanya Finance yang boleh memproses pencairan petty cash';
  END IF;

  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan petty cash tidak ditemukan';
  END IF;
  IF v_topup.status IS DISTINCT FROM 'forwarded_to_finance' THEN
    RAISE EXCEPTION 'Pengajuan tidak siap diproses Finance (status: %)', v_topup.status;
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.petty_cash_topups
    SET status = 'rejected', finance_approved_by = auth.uid(),
        description = COALESCE(p_description, v_topup.description)
    WHERE id = p_topup_id;
    RETURN;
  END IF;

  IF p_action IS DISTINCT FROM 'approve' THEN
    RAISE EXCEPTION 'Aksi pencairan tidak valid';
  END IF;

  -- Batas proses normal 17:00 WIB (hari yang sama). Jalur darurat hari ini dikecualikan.
  v_now_wib := NOW() AT TIME ZONE 'Asia/Jakarta';
  IF (v_topup.created_at AT TIME ZONE 'Asia/Jakarta')::date < v_now_wib::date THEN
    RAISE EXCEPTION 'Pengajuan top up dari hari sebelumnya tidak dapat dicairkan. Minta outlet mengajukan ulang pukul 09:00–16:00 WIB.';
  END IF;
  IF NOT COALESCE(v_topup.is_darurat, false) AND v_now_wib::time >= TIME '17:00:00' THEN
    RAISE EXCEPTION 'Pengajuan top up sudah melewati batas waktu proses pukul 17:00 WIB. Gunakan tombol Proses Darurat di halaman Petty Cash bila mendesak.';
  END IF;

  IF length(btrim(COALESCE(p_proof_of_transfer_url, ''))) = 0 THEN
    RAISE EXCEPTION 'Bukti transfer/serah uang wajib dilampirkan';
  END IF;

  p_method := COALESCE(p_method, 'transfer');
  IF p_method NOT IN ('transfer', 'tunai') THEN
    RAISE EXCEPTION 'Metode pencairan tidak valid';
  END IF;

  PERFORM 1 FROM public.cash_location
  WHERE id = p_cash_location_id AND is_active AND grup = 'petty_cash' AND scope = 'pusat'
    AND kind = CASE p_method WHEN 'transfer' THEN 'bank' ELSE 'cash' END
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pilih sumber Rekening Petty Cash aktif sesuai metode pencairan di dashboard Finance';
  END IF;

  v_amount := COALESCE(p_final_amount, v_topup.amount);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_topup.amount THEN
    RAISE EXCEPTION 'Nominal disetujui harus lebih dari 0 dan tidak melebihi pengajuan';
  END IF;

  SELECT saldo INTO v_saldo FROM public.cash_balance
  WHERE cash_location_id = p_cash_location_id FOR UPDATE;
  IF v_amount > COALESCE(v_saldo, 0) THEN
    RAISE EXCEPTION 'Saldo Rekening Petty Cash tidak mencukupi';
  END IF;

  UPDATE public.petty_cash_topups
  SET status = 'approved_by_finance', finance_approved_by = auth.uid(), approved_at = now(),
      disbursement_method = p_method, disbursed_from_cash_location_id = p_cash_location_id,
      proof_of_transfer_url = btrim(p_proof_of_transfer_url), amount = v_amount,
      description = COALESCE(p_description, v_topup.description)
  WHERE id = p_topup_id;

  INSERT INTO public.cash_transaction (
    cash_location_id, amount, direction, source_type, source_id, note, occurred_at, created_by, status
  ) VALUES (
    p_cash_location_id, v_amount, 'out', 'petty_cash_topup', p_topup_id,
    'Pencairan Petty Cash Outlet (' || p_method || ')' || CASE WHEN COALESCE(v_topup.is_darurat, false) THEN ' [DARURAT]' ELSE '' END,
    now(), auth.uid(), 'paid'
  );
END;
$function$;

-- 5. RPC Jalur Darurat: buka kembali top-up yang auto-batal hari ini agar bisa diproses di Hub Approval
CREATE OR REPLACE FUNCTION public.finance_buka_kembali_topup_darurat(
  p_topup_id uuid,
  p_alasan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_topup public.petty_cash_topups%ROWTYPE;
  v_now_wib timestamp;
  v_alasan text;
  v_desc_bersih text;
BEGIN
  IF NOT public.kas_pencatat_ok() AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role = 'developer'
  ) THEN
    RAISE EXCEPTION 'Hanya Finance / Admin / Owner yang berwenang membuka kembali pengajuan darurat';
  END IF;

  v_alasan := btrim(COALESCE(p_alasan, ''));
  IF length(v_alasan) < 3 THEN
    RAISE EXCEPTION 'Alasan darurat wajib diisi (minimal 3 karakter)';
  END IF;

  SELECT * INTO v_topup FROM public.petty_cash_topups WHERE id = p_topup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan petty cash tidak ditemukan';
  END IF;

  IF v_topup.status IS DISTINCT FROM 'rejected' THEN
    RAISE EXCEPTION 'Hanya pengajuan yang dibatalkan otomatis sistem yang bisa dibuka kembali (status saat ini: %)', v_topup.status;
  END IF;

  IF v_topup.finance_approved_by IS NOT NULL
     OR COALESCE(v_topup.description, '') NOT LIKE '%Dibatalkan otomatis oleh sistem%' THEN
    RAISE EXCEPTION 'Pengajuan yang ditolak manual oleh Finance tidak dapat dibuka lewat jalur darurat';
  END IF;

  v_now_wib := NOW() AT TIME ZONE 'Asia/Jakarta';
  IF (v_topup.created_at AT TIME ZONE 'Asia/Jakarta')::date <> v_now_wib::date THEN
    RAISE EXCEPTION 'Proses darurat hanya berlaku untuk pengajuan pada hari yang sama';
  END IF;

  -- Bersihkan tag auto-batal sistem lalu tempel catatan darurat
  v_desc_bersih := btrim(regexp_replace(
    COALESCE(v_topup.description, ''),
    E'\\s*\\[Ditolak Finance:\\s*Dibatalkan otomatis oleh sistem[^\\]]*\\]',
    '',
    'gi'
  ));

  UPDATE public.petty_cash_topups
  SET
    status = 'forwarded_to_finance',
    is_darurat = true,
    description = CASE
      WHEN v_desc_bersih = '' THEN '[DARURAT: ' || v_alasan || ']'
      ELSE v_desc_bersih || E'\n\n[DARURAT: ' || v_alasan || ']'
    END
  WHERE id = p_topup_id;

  -- Hapus riwayat tolak otomatis sistem agar riwayat keputusan Finance nanti bersih
  DELETE FROM public.approval_log
  WHERE jenis = 'petty_cash'
    AND keputusan = 'tolak'
    AND sumber_id = p_topup_id
    AND pelaku IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_buka_kembali_topup_darurat(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_buka_kembali_topup_darurat(uuid, text) TO authenticated;

-- 6. Perbarui teks push top-up baru ke Finance: batas proses 17:00 WIB
CREATE OR REPLACE FUNCTION public.petty_cash_topup_push_baru()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_outlet text;
  v_nominal text;
  v_desc text;
  v_recip record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'forwarded_to_finance' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'push_webhook_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'fcm_webhook_secret' LIMIT 1;
    IF COALESCE(v_url, '') = '' OR COALESCE(v_key, '') = '' THEN
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM public.outlets WHERE id = NEW.outlet_id;
    v_nominal := replace(to_char(COALESCE(NEW.amount, 0), 'FM999,999,999,999'), ',', '.');
    v_desc := CASE WHEN COALESCE(btrim(NEW.description), '') <> ''
      THEN ' · ' || left(btrim(NEW.description), 80) ELSE '' END;

    -- 1. Info saja ke AM binaan
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
          'title', 'Info Pengajuan Top Up · ' || COALESCE(v_outlet, 'Outlet'),
          'body', 'Top up petty cash Rp ' || v_nominal || v_desc || '. Langsung diproses Finance.',
          'url', 'manager_petty_cash'
        )
      );
    END LOOP;

    -- 2. Pemberitahuan ke Admin Finance
    FOR v_recip IN
      SELECT s.id
      FROM public.outlet_staff s
      WHERE s.role = 'admin_finance'
        AND s.status = 'active'
        AND s.id IS DISTINCT FROM NEW.created_by
    LOOP
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
          'user_id', v_recip.id,
          'app', 'finance',
          'title', 'Top Up Petty Cash Menunggu ACC · ' || COALESCE(v_outlet, 'Outlet'),
          'body', 'Pengajuan Rp ' || v_nominal || v_desc || '. Batas proses pukul 17:00 WIB.',
          'url', 'https://finance.sukashawarma.com/approval'
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Gagal mengirim push topup baru %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.petty_cash_topup_push_baru() FROM PUBLIC, anon, authenticated;
