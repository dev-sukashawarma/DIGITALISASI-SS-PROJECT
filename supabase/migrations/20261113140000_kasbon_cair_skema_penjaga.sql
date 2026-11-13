-- Migration: 20261113140000_kasbon_cair_skema_penjaga.sql
-- Spec: docs/superpowers/specs/2026-11-13-kasbon-pencairan-finance-design.md
--
-- Kasbon jadi dua tahap: HR menyetujui NILAI -> status 'menunggu_cair';
-- finance mencairkan (RPC di migration 20261113141000) -> 'active'.
-- Potongan gaji sudah mensyaratkan status='active', jadi kasbon yang
-- belum cair otomatis tidak terpotong.
--
-- Catatan: tabel cash_advances TIDAK lahir di migration mana pun
-- (20260729000000 hanya stub CREATE TABLE IF NOT EXISTS). CHECK
-- cash_advances_status_check di-DROP lalu ADD di sini.
--
-- Trigger penjaga adalah lapisan utama: tab browser lama, AksiBot,
-- skrip, dan admin-dashboard ikut terkunci walau kodenya belum diperbarui.

ALTER TABLE public.cash_advances
  ADD COLUMN IF NOT EXISTS dicairkan_at        timestamptz,
  ADD COLUMN IF NOT EXISTS dicairkan_oleh      uuid,
  ADD COLUMN IF NOT EXISTS dicairkan_dari      uuid REFERENCES public.cash_location(id),
  ADD COLUMN IF NOT EXISTS metode_cair         text,
  ADD COLUMN IF NOT EXISTS bukti_cair          text,
  ADD COLUMN IF NOT EXISTS cash_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS ditolak_finance_at  timestamptz,
  ADD COLUMN IF NOT EXISTS ditolak_finance_oleh uuid;

ALTER TABLE public.cash_advances DROP CONSTRAINT IF EXISTS cash_advances_metode_cair_check;
ALTER TABLE public.cash_advances ADD CONSTRAINT cash_advances_metode_cair_check
  CHECK (metode_cair IS NULL OR metode_cair IN ('transfer', 'tunai'));

ALTER TABLE public.cash_advances DROP CONSTRAINT IF EXISTS cash_advances_status_check;
ALTER TABLE public.cash_advances ADD CONSTRAINT cash_advances_status_check
  CHECK (status IN ('active', 'paid_off', 'menunggu_cair'));

-- ── Penjaga cash_advances ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cash_advances_jaga_cair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag boolean := coalesce(current_setting('app.kasbon_cair', true), '') = 'on';
BEGIN
  -- 1. Sesi user tidak boleh membuat kasbon disetujui yang langsung berjalan/lunas.
  --    Impor massal (service role, auth.uid() NULL) tetap boleh memasukkan riwayat.
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL
     AND NEW.status_hr = 'approved' AND NEW.status IN ('active', 'paid_off') AND NOT v_flag THEN
    -- dibiarkan: aturan 2 di bawah mengubah 'active' jadi menunggu_cair;
    -- 'paid_off' (kasbon manual dari slip) ditolak.
    IF NEW.status = 'paid_off' THEN
      RAISE EXCEPTION 'Kasbon disetujui harus menunggu pencairan finance; kasbon lunas tidak bisa dibuat langsung'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 2. Saat HR menyetujui: paksa menunggu_cair, catat penyetuju.
  IF NEW.status_hr = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status_hr IS DISTINCT FROM 'approved')
     AND NEW.status IS DISTINCT FROM 'paid_off' THEN
    NEW.status := 'menunggu_cair';
    NEW.approved_by := coalesce(NEW.approved_by, auth.uid());
    NEW.approved_at := coalesce(NEW.approved_at, now());
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- 3. Transisi siklus uang.
    -- (kasbon pending juga berstatus 'active' karena default; aturan 3 & 5
    --  hanya berlaku untuk kasbon yang sudah disetujui HR.)
    IF OLD.status_hr = 'approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF (OLD.status = 'menunggu_cair' AND NEW.status = 'active')
         OR (OLD.status = 'active' AND NEW.status = 'menunggu_cair') THEN
        IF NOT v_flag THEN
          RAISE EXCEPTION 'Status pencairan kasbon hanya bisa diubah oleh tim finance lewat Hub Approval'
            USING ERRCODE = 'check_violation';
        END IF;
      ELSIF OLD.status = 'menunggu_cair' AND NEW.status = 'paid_off' THEN
        RAISE EXCEPTION 'Kasbon yang belum dicairkan tidak bisa dilunasi'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    -- 5. Setelah cair, nominal & cicilan dikunci; sisa hanya boleh turun.
    IF OLD.status_hr = 'approved' AND OLD.status IN ('active', 'paid_off') AND NOT v_flag THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.installment_months IS DISTINCT FROM OLD.installment_months THEN
        RAISE EXCEPTION 'Nominal dan cicilan kasbon yang sudah dicairkan tidak bisa diubah'
          USING ERRCODE = 'check_violation';
      END IF;
      IF coalesce(NEW.remaining, 0) > coalesce(OLD.remaining, 0) THEN
        RAISE EXCEPTION 'Sisa kasbon yang sudah dicairkan tidak bisa bertambah'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    -- 6. Kasbon yang sudah cair tidak bisa ditolak.
    IF NEW.status_hr = 'rejected' AND OLD.status_hr = 'approved'
       AND OLD.status IS DISTINCT FROM 'menunggu_cair' THEN
      RAISE EXCEPTION 'Kasbon yang sudah dicairkan tidak bisa ditolak'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 4. Selama menunggu pencairan, sisa = nominal.
  IF NEW.status = 'menunggu_cair' THEN
    NEW.remaining := NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cash_advances_jaga_cair() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_cash_advances_00_jaga_cair ON public.cash_advances;
CREATE TRIGGER trg_cash_advances_00_jaga_cair
  BEFORE INSERT OR UPDATE ON public.cash_advances
  FOR EACH ROW EXECUTE FUNCTION public.cash_advances_jaga_cair();

-- ── Penjaga cicilan ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cash_advance_payments_jaga_cair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cash_advances WHERE id = NEW.cash_advance_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cicilan hanya untuk kasbon yang sudah dicairkan'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cash_advance_payments_jaga_cair() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_cash_advance_payments_jaga_cair ON public.cash_advance_payments;
CREATE TRIGGER trg_cash_advance_payments_jaga_cair
  BEFORE INSERT ON public.cash_advance_payments
  FOR EACH ROW EXECUTE FUNCTION public.cash_advance_payments_jaga_cair();
