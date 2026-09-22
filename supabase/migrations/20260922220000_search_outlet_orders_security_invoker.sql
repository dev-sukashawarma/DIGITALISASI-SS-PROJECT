-- 20260922220000_search_outlet_orders_security_invoker.sql
--
-- `20300229000000_fix_order_number_overflow_and_unique_constraint.sql`
-- (commit 87ca29dc, diterapkan manual tanpa stempel) mendefinisikan ulang
-- search_outlet_orders sebagai SECURITY DEFINER tanpa cek pemanggil, tanpa
-- search_path terkunci, dan EXECUTE terbuka ke anon + PUBLIC.
-- Akibatnya: siapa pun dengan anon key bisa membaca order `completed` outlet
-- mana pun (nama & HP pelanggan, isi pesanan). Versi sebelumnya
-- (20260719050001) adalah SECURITY INVOKER -> RLS orders/order_items berlaku.
--
-- Perbaikan: kembali ke SECURITY INVOKER (RLS menentukan outlet yang boleh
-- dibaca), kunci search_path, cabut anon & PUBLIC. Body fungsi tidak diubah.
-- Berkas 2030 ikut dikoreksi agar replay dari nol tidak membuka lubang lagi.

ALTER FUNCTION public.search_outlet_orders(uuid, timestamptz, timestamptz, text, int, int)
  SECURITY INVOKER;
ALTER FUNCTION public.search_outlet_orders(uuid, timestamptz, timestamptz, text, int, int)
  SET search_path = public;

REVOKE ALL ON FUNCTION public.search_outlet_orders(uuid, timestamptz, timestamptz, text, int, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_outlet_orders(uuid, timestamptz, timestamptz, text, int, int)
  TO authenticated, service_role;
