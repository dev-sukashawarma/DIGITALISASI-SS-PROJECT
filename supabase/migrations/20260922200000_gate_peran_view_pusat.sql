-- Gate PERAN untuk view definer yang datanya bersifat pusat (bukan per outlet).
--
-- Sisa dari 20260922190000 (yang menangani view ber-outlet_id). Terukur
-- 2026-09-22: crew & mitra membaca po_payable_spv (62 PO + utangnya),
-- pembelian_supplier_bulanan (57) dan _harian_spv (86 baris harga beli per
-- supplier), serta v_tiktok_rekap_harian (75 baris settlement).
--
-- po_payable_spv SUDAH memuat gate is_finance() -- tapi is_finance() isinya
-- cuma `auth.uid() IS NOT NULL`, alias true untuk SEMUA yang login (komentar
-- di 20260723100100 sudah memperingatkan ini). Gate diganti cek peran nyata
-- DI DALAM view; is_finance() sendiri TIDAK disentuh di sini karena dipakai
-- sebagai penjaga 5 fungsi uang (disburse_payroll, record_cash_deposit,
-- settle_purchase_order, submit_cash_transaction, mark_cash_transaction_paid)
-- + policy cash_transaction_read -> perbaikannya butuh keputusan owner.
--
-- pembelian_supplier_*: TIDAK bisa mengandalkan RLS purchase_order, karena
-- policy-nya memakai can_manage_po() yang juga selalu true -- fungsi itu
-- mengecek `current_user IN ('postgres','service_role')`, dan di dalam fungsi
-- SECURITY DEFINER current_user SELALU pemilik fungsi (postgres). Karena itu
-- gate peran ditulis eksplisit di view. (Akibat lain dari can_manage_po yang
-- rusak: semua yang login bisa membaca & MENULIS purchase_order lewat policy
-- po_select/po_insert/po_update -- juga menunggu keputusan owner.)
--
-- v_tiktok_rekap_harian: cukup security_invoker, karena tiktok_transaksi
-- sudah ber-RLS is_owner_or_admin() yang benar (EXISTS ke outlet_staff).
--
-- Diverifikasi (persona nyata, transaksi + ROLLBACK): crew & mitra 0 baris di
-- keempat view; admin_finance/purchasing/leader/owner tetap seperti sebelumnya
-- (57/86/62); v_tiktok kini owner/admin saja -- nol pemakai di kode aplikasi.

-- po_payable_spv: ganti is_finance() (selalu true utk semua authenticated) dgn cek peran nyata
CREATE OR REPLACE VIEW public.po_payable_spv AS
 SELECT po.id, po.nomor_po, po.supplier_id, po.supplier_nama, po.tanggal_po, po.status,
        po.payment_status, po.paid_at, po.cash_transaction_id,
        COALESCE(sum(poi.subtotal), 0::numeric) AS total
   FROM purchase_order po
   LEFT JOIN purchase_order_item poi ON poi.purchase_order_id = po.id
  WHERE (po.status = ANY (ARRAY['sebagian_diterima'::text, 'diterima_lengkap'::text]))
    AND EXISTS (SELECT 1 FROM outlet_staff s
                 WHERE s.id = auth.uid() AND s.status = 'active'
                   AND s.role = ANY (ARRAY['admin','owner','admin_finance','spv','leader','area_manager','purchasing','developer']))
  GROUP BY po.id;
CREATE OR REPLACE VIEW public.pembelian_supplier_bulanan AS
SELECT date_trunc('month'::text, (po.diverifikasi_at AT TIME ZONE 'Asia/Jakarta'::text))::date AS bulan,
    poi.bahan_baku_id,
    b.nama AS nama_bahan,
    b.satuan,
    po.supplier_id,
    po.supplier_nama,
    sum(poi.qty_terima) AS total_qty,
    round(sum(poi.qty_terima * COALESCE(poi.harga_terima, 0::numeric)) / NULLIF(sum(poi.qty_terima), 0::numeric), 0) AS avg_harga_tertimbang,
    min(poi.harga_terima) AS harga_min,
    max(poi.harga_terima) AS harga_max,
    sum(poi.subtotal) AS total_nilai,
    count(po.id) AS jumlah_po
   FROM purchase_order po
     JOIN purchase_order_item poi ON poi.purchase_order_id = po.id
     JOIN bahan_baku b ON b.id = poi.bahan_baku_id
  WHERE (po.status = ANY (ARRAY['sebagian_diterima'::text, 'diterima_lengkap'::text])) AND EXISTS (SELECT 1 FROM outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active' AND s.role = ANY (ARRAY['admin','owner','admin_finance','spv','leader','area_manager','purchasing','kitchen','developer'])) AND poi.qty_terima IS NOT NULL AND poi.harga_terima IS NOT NULL
  GROUP BY (date_trunc('month'::text, (po.diverifikasi_at AT TIME ZONE 'Asia/Jakarta'::text))::date), poi.bahan_baku_id, b.nama, b.satuan, po.supplier_id, po.supplier_nama;

CREATE OR REPLACE VIEW public.pembelian_supplier_harian_spv AS
SELECT (po.diverifikasi_at AT TIME ZONE 'Asia/Jakarta'::text)::date AS tanggal,
    po.id AS purchase_order_id,
    po.nomor_po,
    po.supplier_id,
    po.supplier_nama,
    poi.bahan_baku_id,
    b.nama AS nama_bahan,
    b.satuan,
    poi.qty_terima,
    poi.harga_terima,
    poi.subtotal AS nilai_beli,
    poi.kondisi
   FROM purchase_order po
     JOIN purchase_order_item poi ON poi.purchase_order_id = po.id
     JOIN bahan_baku b ON b.id = poi.bahan_baku_id
  WHERE (po.status = ANY (ARRAY['sebagian_diterima'::text, 'diterima_lengkap'::text])) AND EXISTS (SELECT 1 FROM outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active' AND s.role = ANY (ARRAY['admin','owner','admin_finance','spv','leader','area_manager','purchasing','kitchen','developer'])) AND poi.qty_terima IS NOT NULL;
ALTER VIEW public.v_tiktok_rekap_harian SET (security_invoker = true);
