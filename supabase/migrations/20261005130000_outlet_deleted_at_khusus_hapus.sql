-- 20261005130000_outlet_deleted_at_khusus_hapus.sql
--
-- `outlets.deleted_at` kini HANYA berarti "outlet dihapus" (soft delete). Outlet
-- terhapus disembunyikan dari halaman Manajemen Outlet, tapi barisnya tetap ada
-- sehingga seluruh data masa lalu (penjualan, stok, absensi, kas) tetap utuh dan
-- tetap terhitung di laporan periode lampau.
--
-- Sebelumnya (20261005120000) trigger mengisi deleted_at setiap kali status jadi
-- 'inactive', sehingga "Nonaktifkan" dan "Hapus" tak bisa dibedakan. Kini:
--   - Nonaktifkan : status = 'inactive', deleted_at TIDAK disentuh
--   - Hapus       : status = 'inactive', deleted_at = NOW()  (server action)
--   - Aktifkan / jadikan pending : deleted_at = NULL (sekaligus memulihkan)

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.sync_outlet_status_active()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'active' THEN
      NEW.is_active := true;
      NEW.deleted_at := NULL;
    ELSIF NEW.status = 'pending' THEN
      NEW.is_active := false;
      NEW.deleted_at := NULL;
    ELSIF NEW.status = 'inactive' THEN
      NEW.is_active := false;
    END IF;
  -- Kode lama yang hanya menyetel is_active
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = true THEN
      NEW.status := 'active';
      NEW.deleted_at := NULL;
    ELSIF OLD.status <> 'pending' THEN
      NEW.status := 'inactive';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Data: backfill 20261005120000 (diterapkan 2026-10-05 11:23:06.898523 WIB) mengisi
-- deleted_at untuk outlet yang sekadar NONAKTIF sejak lama (Global Outlet, Mitra
-- Paledang, Jatiasih, Sawangan). Mereka tidak pernah dihapus → kosongkan lagi.
-- Outlet yang dihapus lewat aplikasi sesudahnya (cap waktu berbeda) dibiarkan.
UPDATE public.outlets
SET deleted_at = NULL
WHERE deleted_at = '2026-10-05 11:23:06.898523+07'::timestamptz
  AND status = 'inactive';

