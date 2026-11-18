-- Pemantau retur vendor & kredit vendor. Jalankan SATU kueri per giliran.

-- Q1: retur menunggu penyelesaian vendor lebih dari 14 hari (perlu ditagih / ditutup).
SELECT r.nomor, s.nama AS vendor, r.diserahkan_at, r.cara_penyelesaian,
       now() - r.diserahkan_at AS lama
FROM retur_vendor r JOIN supplier s ON s.id = r.supplier_id
WHERE r.status = 'diserahkan' AND r.diserahkan_at < now() - interval '14 days'
ORDER BY r.diserahkan_at;

-- Q2: baris ledger retur_ke_vendor tanpa dokumen yang sudah diserahkan/selesai. HARUS 0.
SELECT l.id, l.created_at, l.qty, l.ref_retur_vendor_id
FROM ledger_stok l
LEFT JOIN retur_vendor r ON r.id = l.ref_retur_vendor_id
WHERE l.tipe = 'retur_ke_vendor' AND (r.id IS NULL OR r.status NOT IN ('diserahkan','selesai'));

-- Q3: saldo kredit per vendor induk. Tidak boleh negatif.
SELECT k.vendor_induk, s.nama, SUM(k.jumlah) AS saldo,
       SUM(k.jumlah) FILTER (WHERE k.status = 'dicadangkan') AS dicadangkan
FROM vendor_kredit k LEFT JOIN supplier s ON s.id = k.vendor_induk
GROUP BY k.vendor_induk, s.nama
ORDER BY saldo;

-- Q4: kredit dicadangkan lebih dari 7 hari (pengajuan bayar menggantung).
SELECT k.id, po.nomor_po, k.jumlah, k.created_at, po.payment_status
FROM vendor_kredit k JOIN purchase_order po ON po.id = k.purchase_order_id
WHERE k.status = 'dicadangkan' AND k.created_at < now() - interval '7 days';
