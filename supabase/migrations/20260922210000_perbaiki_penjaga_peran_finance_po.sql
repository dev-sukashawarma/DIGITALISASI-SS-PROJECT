-- Perbaiki dua penjaga peran yang selalu meluluskan siapa pun.
--
-- 1) is_finance() isinya `SELECT auth.uid() IS NOT NULL` -> true untuk SEMUA
--    yang login (63 crew ikut). Ia menjaga 5 RPC uang (disburse_payroll,
--    record_cash_deposit, settle_purchase_order, submit_cash_transaction,
--    mark_cash_transaction_paid) lewat `IF NOT is_finance() THEN RAISE
--    'forbidden: bukan finance'` -- yang karenanya TIDAK PERNAH menyala --
--    plus policy cash_transaction_read. Migration 20260723100100 sudah
--    memperingatkan ini pada 23 Juli 2026, tapi belum ditindaklanjuti.
--
-- 2) can_manage_po() memuat `current_user IN ('postgres','service_role')`.
--    Di dalam fungsi SECURITY DEFINER, current_user SELALU pemilik fungsi
--    (postgres), bukan pemanggilnya -- jadi klausa itu selalu benar dan
--    seluruh pengecekan peran di bawahnya tak pernah dievaluasi. Akibatnya
--    setiap pengguna login (crew, mitra) bisa MEMBACA dan MENULIS
--    purchase_order + purchase_order_item lewat policy po_select/po_insert/
--    po_update/poi_* (terukur 2026-09-22: 68 PO, 98 item), dan lolos penjaga
--    create_purchase_order / verifikasi_terima_po.
--
-- Daftar peran (keputusan owner 2026-09-22):
--   - is_finance: peran ber-akses app finance di packages/auth/src/access.ts
--     (admin, spv, leader, admin_finance, area_manager, purchasing) DITAMBAH
--     owner & developer -- keduanya tak ada di matriks app finance tapi harus
--     tetap bisa.
--   - can_manage_po: daftar peran lama dipertahankan apa adanya (admin,
--     kitchen, purchasing, admin_finance, owner); leader & spv memang tidak
--     ada di situ, jadi cukup membuang klausa current_user. Nama peran mati
--     'purchase' & 'finance' DIBUANG (0 baris di outlet_staff, status apa pun)
--     supaya daftarnya tidak menyesatkan -- pola yang sama dengan pembersihan
--     20260916100000.
--
-- Cabang service_role WAJIB dipertahankan di keduanya: service_role memang
-- bypass RLS, tapi TIDAK bypass `IF NOT <guard>` di dalam badan fungsi, jadi
-- RPC yang dipanggil server (service key) akan gagal tanpa cabang ini.
-- status='active' ikut dicek: staf nonaktif tak boleh lagi lolos.

CREATE OR REPLACE FUNCTION public.is_finance()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(auth.jwt() ->> 'role' = 'service_role', false)
    OR EXISTS (
         SELECT 1 FROM public.outlet_staff
          WHERE id = auth.uid()
            AND status = 'active'
            AND role IN ('admin', 'owner', 'developer', 'admin_finance',
                         'purchasing', 'area_manager', 'spv', 'leader')
       );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_po()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(auth.jwt() ->> 'role' = 'service_role', false)
    OR EXISTS (
         SELECT 1 FROM public.outlet_staff
          WHERE id = auth.uid()
            AND status = 'active'
            AND role IN ('admin', 'owner', 'kitchen', 'purchasing', 'admin_finance')
       );
$function$;
