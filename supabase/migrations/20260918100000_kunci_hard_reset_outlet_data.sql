-- Migration: 20260918100000_kunci_hard_reset_outlet_data.sql
-- Tujuan: menutup C1 dari audit keamanan 2026-09-18.
--
-- MASALAH (diverifikasi ke DB live 2026-09-18):
--   public.hard_reset_outlet_data() adalah SECURITY DEFINER yang menghapus
--   orders, ledger_stok, attendance, permintaan_bahan, surat_jalan (+CASCADE)
--   dan menolkan stok_balance untuk outlet MANA PUN yang id-nya disebut.
--   Penjaganya hanya `auth.uid() IS NULL` = "asal sudah login" -> crew/kiosk
--   mana pun bisa memusnahkan data outlet lain. Karena DEFINER, RLS dilewati.
--
--   Selain itu 20260719000000 hanya menulis GRANT ... TO authenticated tanpa
--   pernah mencabut grant bawaan PostgreSQL ke PUBLIC, sehingga `anon`
--   (belum login sama sekali) ikut memegang EXECUTE. Terverifikasi lewat
--   has_function_privilege('anon', ..., 'EXECUTE') = true.
--
--   Fungsi ini juga termasuk 37 SECURITY DEFINER tanpa search_path terkunci.
--
-- PERBAIKAN:
--   1. Guard jabatan di DALAM badan fungsi memakai helper kanonik
--      is_owner_or_admin() -- satu sumber aturan, bukan menebak sendiri.
--      Sengaja BUKAN is_admin(): helper itu memuat 'admin_hr', sedangkan
--      RoleContext admin-dashboard tak punya allowlist untuk ADMIN_HR
--      sehingga role tsb bisa membuka rute mana pun. Wipe outlet bukan
--      wewenang HR.
--   2. SET search_path = public (wajib untuk SECURITY DEFINER).
--   3. Cabut dari PUBLIC dan anon; EXECUTE hanya untuk authenticated,
--      karena pemanggil sahnya adalah komponen browser
--      apps/admin-dashboard/src/components/HardResetOutletCard.tsx yang
--      memakai sesi user (bukan service_role).
--
-- Badan fungsi (daftar penghapusan) TIDAK diubah sedikit pun -- murni
-- pengerasan akses, supaya perilaku fitur Danger Zone yang sah tetap sama.

CREATE OR REPLACE FUNCTION public.hard_reset_outlet_data(p_outlet_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Hanya owner/admin. Fail-closed: role lain (crew, kiosk, leader, spv,
  -- kitchen, mitra, admin_hr) ditolak walaupun sudah login.
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hard reset outlet hanya untuk owner/admin'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Hapus transaksi penjualan (orders).
  -- Note: order_items otomatis terhapus karena ada ON DELETE CASCADE.
  DELETE FROM public.orders WHERE outlet_id = p_outlet_id;

  -- 2. Hapus riwayat stok (ledger_stok).
  DELETE FROM public.ledger_stok WHERE outlet_id = p_outlet_id;

  -- 3. Hapus data absensi uji coba (attendance).
  DELETE FROM public.attendance WHERE outlet_id = p_outlet_id;

  -- 4. Hapus data distribusi bahan baku (permintaan_bahan dan surat_jalan).
  -- Note: permintaan_bahan_item otomatis terhapus via CASCADE.
  DELETE FROM public.permintaan_bahan WHERE outlet_id = p_outlet_id;

  -- Note: surat_jalan_item otomatis terhapus via CASCADE.
  DELETE FROM public.surat_jalan WHERE outlet_id = p_outlet_id;

  -- 5. Reset sisa stok ke 0.
  UPDATE public.stok_balance SET saldo = 0 WHERE outlet_id = p_outlet_id;
END;
$$;

-- CREATE OR REPLACE mempertahankan grant lama, jadi pencabutan harus eksplisit.
REVOKE ALL ON FUNCTION public.hard_reset_outlet_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hard_reset_outlet_data(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.hard_reset_outlet_data(UUID) TO authenticated;
