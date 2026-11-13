-- ============================================================================
-- Migration: Push ke AM + AM boleh membetulkan kategori pengeluaran petty cash
-- ============================================================================
-- Lanjutan 20261113100000_petty_cash_expense_approval_am (13 Nov 2026):
-- 1. Setiap pengeluaran petty cash POS baru berstatus 'pending' mengirim push ke
--    Area Manager aktif yang MEMBINA outlet itu (staff_outlets) — sumber yang sama
--    dengan pemeriksaan wewenang di review_petty_cash_expense. url
--    'manager_petty_cash_pengeluaran' membuka tab Pengeluaran di superapp.
-- 2. RPC ubah_kategori_pengeluaran_petty_cash: AM binaan (atau developer) boleh
--    membetulkan kategori yang salah input kasir (mis. beli gas dicatat PLN)
--    selama pengajuan masih 'pending'. Kategori asal disimpan sekali saja
--    (kategori_asal) beserta pelaku & waktunya, supaya jejaknya tidak hilang.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolom jejak koreksi kategori (nullable, tanpa default → tanpa rewrite tabel)
-- ---------------------------------------------------------------------------
ALTER TABLE public.petty_cash_expenses
  ADD COLUMN IF NOT EXISTS kategori_asal text,
  ADD COLUMN IF NOT EXISTS kategori_diubah_oleh uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kategori_diubah_pada timestamptz;

COMMENT ON COLUMN public.petty_cash_expenses.kategori_asal IS
  'Kategori yang diinput kasir sebelum dikoreksi AM (diisi sekali pada koreksi pertama).';

-- ---------------------------------------------------------------------------
-- 2. RPC koreksi kategori
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ubah_kategori_pengeluaran_petty_cash(
  p_expense_id uuid,
  p_category text
)
RETURNS public.petty_cash_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_caller_status text;
  v_exp public.petty_cash_expenses;
  v_updated public.petty_cash_expenses;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  SELECT role, status INTO v_caller_role, v_caller_status
  FROM public.outlet_staff WHERE id = v_caller_id;

  IF v_caller_status IS DISTINCT FROM 'active'
     OR v_caller_role IS NULL
     OR v_caller_role NOT IN ('area_manager', 'developer') THEN
    RAISE EXCEPTION 'Hanya Area Manager outlet binaan yang boleh mengubah kategori pengeluaran';
  END IF;

  -- Daftar sama persis dengan validasi add_petty_cash.
  IF p_category IS NULL OR p_category NOT IN (
    'pengeluaran_outlet','bahan_baku','gas','transport','pln',
    'pdam','internet','lembur','endorsement'
  ) THEN
    RAISE EXCEPTION 'Kategori tidak valid: %', p_category;
  END IF;

  SELECT * INTO v_exp FROM public.petty_cash_expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pengajuan pengeluaran tidak ditemukan';
  END IF;

  IF v_caller_role = 'area_manager' AND NOT EXISTS (
    SELECT 1 FROM public.staff_outlets so
    WHERE so.staff_id = v_caller_id AND so.outlet_id = v_exp.outlet_id
  ) THEN
    RAISE EXCEPTION 'Outlet ini bukan outlet binaan Anda';
  END IF;

  -- Kunci yang sama dengan review_petty_cash_expense: koreksi dan ACC tidak bisa
  -- balapan di pengajuan yang sama.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_exp.outlet_id::text, 0));

  SELECT * INTO v_exp FROM public.petty_cash_expenses WHERE id = p_expense_id FOR UPDATE;

  IF v_exp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pengajuan ini sudah dibatalkan oleh kasir/outlet';
  END IF;
  IF v_exp.status <> 'pending' THEN
    RAISE EXCEPTION 'Kategori hanya bisa diubah selama pengajuan masih menunggu (status: %)', v_exp.status;
  END IF;
  IF v_exp.type IS DISTINCT FROM 'expense' THEN
    RAISE EXCEPTION 'Kategori pengeluaran RAB tidak bisa diubah dari sini';
  END IF;

  IF v_exp.category = p_category THEN
    RETURN v_exp; -- tidak ada perubahan; idempoten
  END IF;

  -- Trigger rab_otomatis_terapkan tetap berlaku pada UPDATE ini, jadi hasilnya
  -- sama dengan bila kasir memilih kategori yang benar sejak awal.
  UPDATE public.petty_cash_expenses
  SET category = p_category,
      kategori_asal = COALESCE(kategori_asal, v_exp.category),
      kategori_diubah_oleh = v_caller_id,
      kategori_diubah_pada = NOW()
  WHERE id = p_expense_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.ubah_kategori_pengeluaran_petty_cash(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubah_kategori_pengeluaran_petty_cash(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Push ke AM binaan saat ada pengeluaran pending baru
-- ---------------------------------------------------------------------------
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
      WHEN 'pengeluaran_outlet' THEN 'Operasional Outlet'
      WHEN 'bahan_baku' THEN 'Bahan Baku'
      WHEN 'gas' THEN 'Gas'
      WHEN 'transport' THEN 'Transport'
      WHEN 'pln' THEN 'PLN / Listrik'
      WHEN 'pdam' THEN 'PDAM / Air'
      WHEN 'internet' THEN 'Internet'
      WHEN 'lembur' THEN 'Lembur'
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

DROP TRIGGER IF EXISTS trg_petty_cash_expense_push_am_pending ON public.petty_cash_expenses;
CREATE TRIGGER trg_petty_cash_expense_push_am_pending
  AFTER INSERT ON public.petty_cash_expenses
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.petty_cash_expense_push_am_pending();
