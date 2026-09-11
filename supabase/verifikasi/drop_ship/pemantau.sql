-- Pemantau drop-ship. Jalankan tiap tanggal tagihan (10/20/akhir bulan) & sesudahnya.
-- Read-only murni -- tidak ada DML di file ini. Jalankan lewat:
--   supabase db query --linked -f supabase/verifikasi/drop_ship/pemantau.sql

-- Q1: catatan crew yang lewat tanggal tagihan tapi belum disahkan (antrean macet).
-- Normalnya: 0 baris di hari tagihan itu sendiri (mis. tgl 20 sore); kalau baris
-- masih ada BESOK tanggal tagihannya (tgl 21+), berarti purchasing/kitchen/admin
-- belum sempat mengesahkan -- itu yang harus ditindaklanjuti, bukan dianggap bug.
-- periode_tagihan() mengembalikan TABLE -> wajib LATERAL (tak boleh di WHERE).
-- Tanggal pembanding WIB, bukan current_date (UTC).
SELECT s.nama AS vendor, p.tanggal_tagihan AS tagihan,
       count(*) AS catatan, sum(t.qty) AS kg
  FROM public.terima_vendor_outlet t
  JOIN public.supplier s ON s.id = t.supplier_id
  CROSS JOIN LATERAL public.periode_tagihan(t.tanggal_terima) p
 WHERE t.status = 'dicatat' AND p.tanggal_tagihan < (now() AT TIME ZONE 'Asia/Jakarta')::date
 GROUP BY s.nama, p.tanggal_tagihan ORDER BY p.tanggal_tagihan;

-- Q2: LARANGAN 3 -- PO diterima tanpa ledger. SUDAH mengecualikan PO nota drop-ship
-- (WHERE nota_vendor_id IS NULL): PO ber-nota_vendor_id tanpa baris ledger_stok
-- adalah NORMAL untuk drop-ship (stok masuk lewat terima_vendor_outlet/trigger
-- sync_terima_vendor_ledger, bukan lewat verifikasi_terima_po) -- jangan dilaporkan
-- sebagai anomali kalau muncul di luar query ini. Normalnya query ini: 0 baris.
SELECT po.nomor_po, po.supplier_nama, po.tanggal_po
  FROM public.purchase_order po
 WHERE po.status = 'diterima_lengkap' AND po.nota_vendor_id IS NULL
   AND po.tanggal_po >= DATE '2026-09-01'
   AND NOT EXISTS (SELECT 1 FROM public.ledger_stok l WHERE l.ref_po_id = po.id);

-- Q3: invarian stok -- ledger tiap catatan terima vendor harus persis sama dengan
-- target trigger sync_terima_vendor_ledger (qty dikonversi to_ledger_scale bila
-- status dicatat/disahkan, 0 bila ditolak). Normalnya: 0 baris SELALU -- ini
-- bukan ambang, kalau ada 1 baris pun berarti trigger gagal jalan atau di-bypass.
SELECT t.id, t.status, t.qty, COALESCE(sum(l.qty),0) AS ledger,
       CASE WHEN t.status IN ('dicatat','disahkan') THEN public.to_ledger_scale(t.outlet_id, t.bahan_baku_id, t.qty) ELSE 0 END AS target
  FROM public.terima_vendor_outlet t LEFT JOIN public.ledger_stok l ON l.ref_terima_vendor_id = t.id
 GROUP BY t.id
HAVING abs(COALESCE(sum(l.qty),0) - CASE WHEN t.status IN ('dicatat','disahkan')
          THEN public.to_ledger_scale(t.outlet_id, t.bahan_baku_id, t.qty) ELSE 0 END) > 0.000001;

-- Q4: sayur masih dicatat lewat adjustment manual setelah go-live (harus mendekati 0).
-- Normalnya: 0 baris sejak 21 September 2026 WIB (tanggal go-live, lihat Task 10) --
-- crew seharusnya sudah pindah ke catat_terima_vendor(). Baris 'Pengembalian Void%'
-- dikecualikan karena itu bukan penerimaan baru (pembalikan void order, alur lama
-- yang tetap sah dipakai kapan pun).
SELECT o.name, count(*) FROM public.ledger_stok l
  JOIN public.bahan_baku b ON b.id = l.bahan_baku_id JOIN public.outlets o ON o.id = l.outlet_id
 WHERE b.nama ILIKE '%lettuce%' AND l.tipe = 'adjustment' AND l.qty > 0
   AND l.catatan NOT ILIKE 'Pengembalian Void%' AND l.created_at >= TIMESTAMPTZ '2026-09-21 00:00+07'
 GROUP BY o.name;
