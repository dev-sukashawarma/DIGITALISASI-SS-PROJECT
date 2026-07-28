-- Bagian dari perbaikan "pemohon memegang kunci persetujuannya sendiri"
-- (lihat memory approval-key-held-by-requester). Supaya server bisa menolak
-- approver == requester, identitas pemohon harus tercatat DAN tidak bisa
-- dipalsukan dari client (kalau bisa dipalsukan, orang tinggal insert dengan
-- requested_by = ID orang lain lalu approve sendiri -- lolos cek).
--
-- Trigger men-stempel auth.uid() setiap kali insert dilakukan lewat client
-- terautentikasi (browser, RLS berlaku, auth.uid() tersedia). Untuk insert
-- via service-role (auth.uid() = NULL, mis. cancellation_requests yang
-- ditulis dari /api/cancellations/request), trigger no-op -- identitas
-- pemohon di kasus itu WAJIB diverifikasi & dikirim eksplisit dari app layer
-- (lihat perubahan route.ts terkait), trigger ini cuma jaring pengaman kalau
-- suatu saat rute itu pindah ke authenticated client.

ALTER TABLE bypass_requests
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES outlet_staff(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION stamp_requested_by_from_auth()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.requested_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bypass_requests_stamp_requester ON bypass_requests;
CREATE TRIGGER trg_bypass_requests_stamp_requester
  BEFORE INSERT ON bypass_requests
  FOR EACH ROW EXECUTE FUNCTION stamp_requested_by_from_auth();

DROP TRIGGER IF EXISTS trg_cancellation_requests_stamp_requester ON cancellation_requests;
CREATE TRIGGER trg_cancellation_requests_stamp_requester
  BEFORE INSERT ON cancellation_requests
  FOR EACH ROW EXECUTE FUNCTION stamp_requested_by_from_auth();

-- petty_cash_topups.created_by SUDAH ADA tapi diisi manual oleh client
-- (kasir/shift/page.tsx: `created_by: (await supabase.auth.getUser())...`).
-- Trigger generik di atas menstempel kolom `requested_by`, bukan
-- `created_by` -- buat versi khusus nama kolom untuk tabel ini.
CREATE OR REPLACE FUNCTION stamp_petty_cash_created_by_from_auth()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_petty_cash_topups_stamp_creator ON petty_cash_topups;
CREATE TRIGGER trg_petty_cash_topups_stamp_creator
  BEFORE INSERT ON petty_cash_topups
  FOR EACH ROW EXECUTE FUNCTION stamp_petty_cash_created_by_from_auth();
