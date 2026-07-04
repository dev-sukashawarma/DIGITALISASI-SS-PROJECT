-- 20260704220000_ledger_transaksi_ringkas_view.sql
-- View agregasi ledger_stok per transaksi (bukan per baris bahan), untuk halaman
-- ledger list. Kunci grup: ref_order_id/ref_opname_id/ref_shipment_id/ref_transfer_id
-- (baris-baris dari 1 event, mis. 1 order selesai, berbagi ref yang sama). Baris
-- tanpa ref sama sekali (adjustment/waste manual) jadi grup 1-anggota (fallback ke id).
--
-- View biasa (BUKAN security definer) -- tunduk RLS ledger_read yang sudah ada
-- di ledger_stok, tidak ada perubahan akses.
--
-- Kolom single_* hanya valid dipakai saat jumlah_bahan = 1 (grup manual):
-- MAX() atas 1 baris = nilai baris itu sendiri, dipakai UI supaya card manual
-- tidak perlu extra query terpisah.

CREATE VIEW ledger_transaksi_ringkas AS
SELECT
  COALESCE(ref_order_id::text, ref_opname_id::text, ref_shipment_id::text, ref_transfer_id::text, id::text) AS transaksi_key,
  outlet_id,
  MIN(created_at) AS created_at,
  COUNT(*) AS jumlah_bahan,
  MAX(ref_order_id) AS ref_order_id,
  MAX(ref_opname_id) AS ref_opname_id,
  MAX(ref_shipment_id) AS ref_shipment_id,
  MAX(ref_transfer_id) AS ref_transfer_id,
  MAX(bahan_baku_id) AS single_bahan_baku_id,
  MAX(tipe) AS single_tipe,
  MAX(qty) AS single_qty,
  MAX(catatan) AS single_catatan,
  MAX(saldo_sesudah) AS single_saldo_sesudah
FROM ledger_stok
GROUP BY 1, outlet_id;

COMMENT ON VIEW ledger_transaksi_ringkas IS
  'Agregasi ledger_stok per transaksi (order/opname/kiriman/transfer/manual) untuk halaman ledger list. single_* hanya valid saat jumlah_bahan=1.';
