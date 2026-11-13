-- Migration: 20261113141000_kasbon_cair_rpc.sql
-- Spec: docs/superpowers/specs/2026-11-13-kasbon-pencairan-finance-design.md
-- Butuh: 20261113140000_kasbon_cair_skema_penjaga.sql (kolom + flag app.kasbon_cair).
--
-- Finance hanya menulis lewat RPC di bawah (RLS cash_advances tetap HR-only):
--   finance_kasbon_menunggu()   daftar antrean (nama staf tertahan RLS outlet_staff)
--   finance_cairkan_kasbon()    potong Rekening Petty Cash, kasbon -> active
--   finance_tolak_kasbon()      final, alasan wajib
--   finance_batal_cair_kasbon() void transaksi, kasbon -> menunggu_cair (belum ada cicilan)
-- Peran: kas_pencatat_ok() (admin_finance/admin/owner) atau developer aktif.
-- JANGAN is_finance(): memuat spv/leader/dll.
--
-- UTANG REPLAY: trg_fn_crew_kasbon_status_push juga didefinisikan di
-- 20300254010600 (terurut sesudah berkas ini); replay dari nol memulihkan teks lama.

-- ── Peran ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kasbon_pencair_ok()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.kas_pencatat_ok() OR EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role = 'developer');
$$;
REVOKE ALL ON FUNCTION public.kasbon_pencair_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kasbon_pencair_ok() TO authenticated;

-- ── Antrean ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_kasbon_menunggu()
RETURNS TABLE (
  id uuid, staff_id uuid, staff_nama text, outlet_nama text, amount numeric,
  amount_requested numeric, reason text, installment_months int, approval_note text,
  approved_at timestamptz, approved_by uuid, penyetuju_nama text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.kasbon_pencair_ok() THEN
    RAISE EXCEPTION 'Hanya tim finance yang boleh memproses kasbon' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT k.id, k.staff_id, s.name::text, o.name::text, k.amount, k.amount_requested, k.reason,
         k.installment_months, k.approval_note, k.approved_at, k.approved_by, p.name::text, k.created_at
  FROM public.cash_advances k
  LEFT JOIN public.outlet_staff s ON s.id = k.staff_id
  LEFT JOIN public.outlets o      ON o.id = s.outlet_id
  LEFT JOIN public.outlet_staff p ON p.id = k.approved_by
  WHERE k.status_hr = 'approved' AND k.status = 'menunggu_cair'
  ORDER BY coalesce(k.approved_at, k.created_at), k.id;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_kasbon_menunggu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_kasbon_menunggu() TO authenticated;

-- ── Cairkan ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_cairkan_kasbon(p_id uuid, p_cash_location_id uuid, p_bukti text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_k     public.cash_advances%ROWTYPE;
  v_lok   public.cash_location%ROWTYPE;
  v_saldo numeric;
  v_nama  text;
  v_tx    uuid;
BEGIN
  IF NOT public.kasbon_pencair_ok() THEN
    RAISE EXCEPTION 'Hanya tim finance yang boleh memproses kasbon' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_k FROM cash_advances WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_k.status_hr IS DISTINCT FROM 'approved' OR v_k.status IS DISTINCT FROM 'menunggu_cair' THEN
    RAISE EXCEPTION 'Kasbon tidak menunggu pencairan' USING ERRCODE = 'check_violation';
  END IF;
  IF v_k.approved_by IS NOT NULL AND v_k.approved_by = auth.uid() THEN
    RAISE EXCEPTION 'Pencairan harus oleh orang lain dari yang menyetujui di HR' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_lok FROM cash_location
   WHERE id = p_cash_location_id AND is_active AND grup = 'petty_cash' AND scope = 'pusat'
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pilih Rekening Petty Cash aktif' USING ERRCODE = 'check_violation';
  END IF;
  IF nullif(btrim(coalesce(p_bukti, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Bukti wajib diisi' USING ERRCODE = 'check_violation';
  END IF;

  SELECT saldo INTO v_saldo FROM cash_balance WHERE cash_location_id = p_cash_location_id FOR UPDATE;
  IF v_k.amount > coalesce(v_saldo, 0) THEN
    RAISE EXCEPTION 'Saldo Rekening Petty Cash tidak mencukupi' USING ERRCODE = 'check_violation';
  END IF;

  SELECT name INTO v_nama FROM outlet_staff WHERE id = v_k.staff_id;

  INSERT INTO cash_transaction (
    cash_location_id, amount, direction, source_type, source_id, status,
    occurred_at, created_by, proof_url, category, note
  ) VALUES (
    p_cash_location_id, v_k.amount, 'out', 'kasbon', p_id, 'paid',
    now(), auth.uid(), btrim(p_bukti), 'Kasbon', 'Pencairan kasbon ' || coalesce(v_nama, '-')
  ) RETURNING id INTO v_tx;

  PERFORM set_config('app.kasbon_cair', 'on', true);
  UPDATE cash_advances
     SET status = 'active',
         remaining = amount,
         dicairkan_at = now(),
         dicairkan_oleh = auth.uid(),
         dicairkan_dari = p_cash_location_id,
         metode_cair = CASE v_lok.kind WHEN 'bank' THEN 'transfer' ELSE 'tunai' END,
         bukti_cair = btrim(p_bukti),
         cash_transaction_id = v_tx
   WHERE id = p_id;
  PERFORM set_config('app.kasbon_cair', 'off', true);

  RETURN v_tx;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_cairkan_kasbon(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_cairkan_kasbon(uuid, uuid, text) TO authenticated;

-- ── Tolak (final) ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_tolak_kasbon(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_k public.cash_advances%ROWTYPE;
BEGIN
  IF NOT public.kasbon_pencair_ok() THEN
    RAISE EXCEPTION 'Hanya tim finance yang boleh memproses kasbon' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_alasan, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_k FROM cash_advances WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_k.status_hr IS DISTINCT FROM 'approved' OR v_k.status IS DISTINCT FROM 'menunggu_cair' THEN
    RAISE EXCEPTION 'Kasbon tidak menunggu pencairan' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE cash_advances
     SET status_hr = 'rejected',
         rejection_note = '[Ditolak Finance] ' || btrim(p_alasan),
         ditolak_finance_at = now(),
         ditolak_finance_oleh = auth.uid()
   WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_tolak_kasbon(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_tolak_kasbon(uuid, text) TO authenticated;

-- ── Batal pencairan ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finance_batal_cair_kasbon(p_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_k public.cash_advances%ROWTYPE;
BEGIN
  IF NOT public.kasbon_pencair_ok() THEN
    RAISE EXCEPTION 'Hanya tim finance yang boleh memproses kasbon' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_alasan, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan wajib diisi' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_k FROM cash_advances WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_k.status IS DISTINCT FROM 'active' OR v_k.cash_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Kasbon ini tidak dicairkan lewat finance' USING ERRCODE = 'check_violation';
  END IF;
  IF v_k.remaining IS DISTINCT FROM v_k.amount
     OR EXISTS (SELECT 1 FROM cash_advance_payments WHERE cash_advance_id = p_id) THEN
    RAISE EXCEPTION 'Kasbon sudah dicicil/dipotong, pencairan tidak bisa dibatalkan' USING ERRCODE = 'check_violation';
  END IF;

  -- Void (bukan DELETE); trigger cash_apply_balance mengembalikan saldo.
  UPDATE cash_transaction
     SET status = 'void',
         note = concat_ws(' ', note, '[Dibatalkan: ' || btrim(p_alasan) || ']')
   WHERE id = v_k.cash_transaction_id AND status <> 'void';

  PERFORM set_config('app.kasbon_cair', 'on', true);
  PERFORM set_config('app.kasbon_alasan', btrim(p_alasan), true);
  UPDATE cash_advances
     SET status = 'menunggu_cair',
         dicairkan_at = NULL, dicairkan_oleh = NULL, dicairkan_dari = NULL,
         metode_cair = NULL, bukti_cair = NULL, cash_transaction_id = NULL
   WHERE id = p_id;
  PERFORM set_config('app.kasbon_cair', 'off', true);
  PERFORM set_config('app.kasbon_alasan', '', true);
END;
$$;
REVOKE ALL ON FUNCTION public.finance_batal_cair_kasbon(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_batal_cair_kasbon(uuid, text) TO authenticated;

-- ── Riwayat Hub ──────────────────────────────────────────────────────────────
ALTER TABLE public.approval_log DROP CONSTRAINT IF EXISTS approval_log_jenis_check;
ALTER TABLE public.approval_log ADD CONSTRAINT approval_log_jenis_check
  CHECK (jenis IN ('petty_cash', 'po', 'bayar_vendor', 'dana_kantor', 'kasbon'));
ALTER TABLE public.approval_log DROP CONSTRAINT IF EXISTS approval_log_keputusan_check;
ALTER TABLE public.approval_log ADD CONSTRAINT approval_log_keputusan_check
  CHECK (keputusan IN ('setuju', 'tolak', 'serah_am', 'batal_cair'));

CREATE OR REPLACE FUNCTION public.trg_approval_log_kasbon()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_keputusan text; v_pelaku uuid; v_alasan text; v_nama text;
BEGIN
  BEGIN
    IF OLD.status = 'menunggu_cair' AND NEW.status = 'active' THEN
      v_keputusan := 'setuju'; v_pelaku := coalesce(auth.uid(), NEW.dicairkan_oleh);
    ELSIF OLD.status = 'active' AND NEW.status = 'menunggu_cair' AND OLD.status_hr = 'approved' THEN
      v_keputusan := 'batal_cair'; v_pelaku := auth.uid();
      v_alasan := nullif(current_setting('app.kasbon_alasan', true), '');
    ELSIF NEW.ditolak_finance_at IS NOT NULL AND OLD.ditolak_finance_at IS NULL THEN
      v_keputusan := 'tolak'; v_pelaku := coalesce(auth.uid(), NEW.ditolak_finance_oleh);
      v_alasan := regexp_replace(coalesce(NEW.rejection_note, ''), '^\[Ditolak Finance\] ', '');
    ELSE
      RETURN NEW;
    END IF;

    SELECT name INTO v_nama FROM outlet_staff WHERE id = NEW.staff_id;
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut)
    VALUES ('kasbon', v_keputusan, NEW.id, v_nama, left(NEW.reason, 200), NEW.amount, v_alasan, v_pelaku, now(), now())
    ON CONFLICT (jenis, keputusan, sumber_id) DO UPDATE
      SET pelaku = EXCLUDED.pelaku, pelaku_nama = NULL, nominal = EXCLUDED.nominal,
          alasan = EXCLUDED.alasan, waktu = EXCLUDED.waktu, waktu_urut = EXCLUDED.waktu_urut;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log kasbon gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_approval_log_kasbon() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_approval_log_kasbon ON public.cash_advances;
CREATE TRIGGER trg_approval_log_kasbon
  AFTER UPDATE OF status, status_hr ON public.cash_advances
  FOR EACH ROW EXECUTE FUNCTION public.trg_approval_log_kasbon();

-- ── Push crew ────────────────────────────────────────────────────────────────
-- Teks persetujuan HR kini menyebut pencairan finance (sisanya sama dengan live).
CREATE OR REPLACE FUNCTION public.trg_fn_crew_kasbon_status_push()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rupiah TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.status_hr IN ('approved', 'rejected') AND (OLD.status_hr IS NULL OR OLD.status_hr = 'pending') THEN
    v_rupiah := 'Rp ' || to_char(coalesce(NEW.amount, 0), 'FM999,999,999');

    IF NEW.status_hr = 'approved' THEN
      v_title := '💰 Pengajuan Kasbon Disetujui';
      v_body := 'Pengajuan kasbon Anda sebesar ' || v_rupiah || ' telah disetujui HR dan menunggu pencairan oleh finance.';
      IF coalesce(NEW.installment_months, 1) > 1 THEN
        v_body := v_body || ' Dicicil ' || NEW.installment_months || ' bulan.';
      END IF;
    ELSE
      v_title := '❌ Pengajuan Kasbon Ditolak';
      v_body := 'Pengajuan kasbon Anda sebesar ' || v_rupiah || ' ditolak oleh HR.';
      IF NEW.rejection_note IS NOT NULL AND btrim(NEW.rejection_note) <> '' THEN
        v_body := v_body || E'\nAlasan: "' || left(btrim(NEW.rejection_note), 150) || '"';
      END IF;
    END IF;

    PERFORM public.crew_alert_kirim_push(NEW.staff_id, v_title, v_body, 'crew_kasbon', 'crew_kasbon');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_crew_kasbon_status_push gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_crew_kasbon_finance_push()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rupiah text; v_title text; v_body text;
BEGIN
  v_rupiah := 'Rp ' || to_char(coalesce(NEW.amount, 0), 'FM999,999,999');
  IF OLD.status = 'menunggu_cair' AND NEW.status = 'active' THEN
    v_title := '💸 Kasbon Dicairkan';
    v_body := 'Kasbon Anda sebesar ' || v_rupiah || ' sudah dicairkan ('
              || CASE NEW.metode_cair WHEN 'tunai' THEN 'tunai' ELSE 'transfer' END || ').';
  ELSIF NEW.ditolak_finance_at IS NOT NULL AND OLD.ditolak_finance_at IS NULL THEN
    v_title := '❌ Kasbon Ditolak Finance';
    v_body := 'Kasbon Anda sebesar ' || v_rupiah || ' ditolak oleh finance.'
              || E'\nAlasan: "' || left(regexp_replace(coalesce(NEW.rejection_note, ''), '^\[Ditolak Finance\] ', ''), 150) || '"';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.crew_alert_kirim_push(NEW.staff_id, v_title, v_body, 'crew_kasbon', 'crew_kasbon');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_crew_kasbon_finance_push gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_fn_crew_kasbon_finance_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_crew_kasbon_finance_push ON public.cash_advances;
CREATE TRIGGER trg_crew_kasbon_finance_push
  AFTER UPDATE OF status, status_hr ON public.cash_advances
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_crew_kasbon_finance_push();
