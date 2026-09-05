-- Inbound/Outbound feed: view turunan di atas ledger_stok.
-- Revisi 2026-09-03: tambah kolom saldo_sesudah (sisa stok setelah transaksi).
-- Timestamp digeser 20300123000000 -> 20300124000000 karena bentrok dengan
-- 20300123000000_kategori_aset_perlengkapan.sql milik kerja paralel.
--
-- Latar: tabel fisik `inbound_outbound` hanya pernah diisi sekali lewat script
-- backfill (20300108000009) dan beku sejak 2026-08-21 -- tidak ada trigger
-- ledger_stok -> inbound_outbound, dan drawer input manualnya tidak pernah
-- dipakai (nol baris berkategori 'Pemakaian'/'Retur'/'Expired'/'Transfer Masuk').
-- View ini menggantikannya sebagai sumber tampilan, jadi selalu hidup.
--
-- Definisi bisnis (keputusan owner 2026-09-03): inbound = barang masuk dari
-- vendor, outbound = barang keluar gudang ke outlet. Opname, waste, pemakaian,
-- dan adjustment negatif TIDAK termasuk -- semuanya sudah tampil di tab Ledger.
--
-- Tiga sumber, dibedakan lewat kolom `sumber` supaya bisa diberi badge berbeda:
--   vendor_po     : penerimaan PO (sejak modul PO dipakai, PO asli pertama 2026-08-28)
--   vendor_manual : adjustment positif -- cara lama stokis mencatat barang masuk
--                   sebelum modul PO ada, dan masih dipakai sesekali sesudahnya.
--                   Badge terpisah membuat penerimaan yang melewati PO kelihatan.
--   kirim_outlet  : transfer_keluar lewat surat jalan
--
-- security_invoker: WAJIB, supaya RLS `ledger_read` di ledger_stok tetap berlaku
-- (tanpa ini pergerakan stok semua outlet bocor ke siapa pun yang bisa SELECT view).

CREATE OR REPLACE VIEW public.inbound_outbound_feed
WITH (security_invoker = true) AS
SELECT
    l.id,
    l.outlet_id,
    l.bahan_baku_id,
    CASE WHEN l.tipe = 'transfer_keluar' THEN 'OUT' ELSE 'IN' END           AS tipe,
    CASE
        WHEN l.tipe = 'pembelian_supplier' THEN 'vendor_po'
        WHEN l.tipe = 'transfer_keluar'    THEN 'kirim_outlet'
        ELSE 'vendor_manual'
    END                                                                     AS sumber,
    CASE
        WHEN l.tipe = 'pembelian_supplier' THEN 'Pembelian Vendor'
        WHEN l.tipe = 'transfer_keluar'    THEN 'Kirim ke Outlet'
        ELSE 'Barang Masuk (Manual)'
    END                                                                     AS kategori,
    abs(l.qty)                                                              AS qty,

    COALESCE(h.harga_beli_display, h.harga_beli)                            AS harga_satuan,
    l.catatan,
    l.created_by,
    l.created_at,
    staff.name                                                              AS pencatat_nama,
    b.nama                                                                  AS bahan_nama,
    b.satuan                                                                AS bahan_satuan,
    b.satuan_tengah,
    b.faktor_tengah,
    b.satuan_kecil,
    b.faktor_tampilan,
    b.satuan_distribusi,
    l.ref_shipment_id,
    tujuan.name                                                             AS tujuan_outlet_nama,
    sj.document_number                                                      AS nomor_sj,
    po.nomor_po,
    po.supplier_nama,
    -- Sisa stok gudang tepat setelah transaksi ini, distempel trigger
    -- ledger_stamp_saldo. Ditaruh di akhir daftar select karena CREATE OR
    -- REPLACE VIEW hanya mengizinkan penambahan kolom di ujung.
    l.saldo_sesudah
FROM public.ledger_stok l
JOIN      public.bahan_baku       b      ON b.id      = l.bahan_baku_id
LEFT JOIN public.bahan_baku_harga h      ON h.bahan_baku_id = l.bahan_baku_id
LEFT JOIN public.outlet_staff     staff  ON staff.id  = l.created_by
LEFT JOIN public.surat_jalan      sj     ON sj.id     = l.ref_shipment_id
LEFT JOIN public.outlets          tujuan ON tujuan.id = sj.outlet_id
LEFT JOIN public.purchase_order   po     ON po.id     = l.ref_po_id
WHERE l.qty <> 0
  AND (
        l.tipe = 'pembelian_supplier'
     OR l.tipe = 'transfer_keluar'
        -- Adjustment positif dihitung sebagai barang masuk, KECUALI yang
        -- catatannya jelas-jelas koreksi. Baris bercatatan kosong tetap ikut:
        -- di periode pra-PO mayoritasnya memang penerimaan barang.
     OR (
            l.tipe = 'adjustment'
        AND l.qty > 0
        AND COALESCE(l.catatan, '') !~* '(koreksi|kesalahan input|salah input|belum opname|surat jalan|reorder|test)'
        )
      );

COMMENT ON VIEW public.inbound_outbound_feed IS
    'Arus barang masuk dari vendor & keluar ke outlet, diturunkan langsung dari ledger_stok. Menggantikan tabel inbound_outbound yang beku sejak 2026-08-21.';

GRANT SELECT ON public.inbound_outbound_feed TO authenticated;
