-- 20300120000001_fix_waste_breakdown_faktor_penuh.sql
--
-- KONTEKS: audit 2026-09-02 (pemicu: nilai waste Agustus terlihat janggal).
--
-- MASALAH YANG DIPERBAIKI DI SINI (satu saja, sengaja sempit):
--   get_waste_breakdown (dari 20260714100000) menghitung qty_kecil dengan
--   faktor_konversi sebagai faktor besar->kecil:
--
--     w.qty * COALESCE(b.faktor_konversi, 1) AS qty_kecil
--
--   Itu benar SEBELUM sistem satuan 3-tingkat ada. Sejak 20300108000005 aturan
--   kanoniknya: faktor PENUH (kecil per besar) = faktor_tampilan ketika
--   faktor_tengah terisi, faktor_konversi ketika tidak. faktor_konversi sendiri
--   hanya porsi tengah->kecil.
--
--   stok_waste_reports.qty disimpan dalam SATUAN BESAR (WasteModal.tsx membagi
--   input dengan faktor_tampilan / faktor_tengah -- itu sudah benar). Jadi untuk
--   mengembalikannya ke satuan kecil harus dikali faktor PENUH.
--
--   Bukti: waste KEJU 2 Agt tersimpan qty = 0,0166667 Dus. Crew mengetik 4 Lembar
--   (4/240). Tampilan lama: 0,0166667 * 10 = 0,17 Lembar (omong kosong).
--   Setelah fix: 0,0166667 * 240 = 4 Lembar -- persis yang diketik crew.
--
-- ⚠ YANG SENGAJA *TIDAK* DIUBAH: hpp_kecil dan nilai.
--   Draft pertama migration ini sempat mengubah hpp_kecil jadi
--   harga_beli / faktor_penuh, dengan asumsi harga_beli = harga per satuan besar.
--   ASUMSI ITU SALAH dan sudah dibatalkan. Pemeriksaan data membuktikan basis
--   harga_beli TIDAK SERAGAM antar bahan:
--
--     KEJU    harga 10.850, kemasan_qty 10 Lembar  -> per PACK  (satuan tengah).
--             Cocok dengan resep: Suka Beef pakai 2 lembar, get_hpp_periode
--             menghitung 2/faktor_konversi(10) * 10.850 = Rp2.170/porsi (wajar).
--             Rumus lama (harga_beli/faktor_konversi = Rp1.085/lembar) BENAR.
--     SAPI    harga 100.000, kemasan_qty 1000 Gram -> per KG (satuan tengah).
--             Rumus lama Rp100/gram BENAR.
--     KENTANG harga 250.000, kemasan_qty 1000 Gram -> kalau dibaca per kg jadi
--             Rp250.000/kg (mustahil untuk kentang). Nilainya sebenarnya per DUS
--             (10 kg) = Rp25.000/kg. Di sini kemasan_qty-nya yang salah.
--     MINYAK  harga 376.000, kemasan_qty 16000 Gram -> per KOMPAN (satuan besar).
--
--   Karena basisnya campur PER-BAHAN, tidak ada satu rumus yang benar untuk
--   semuanya, dan mengubah rumus valuasi sekarang akan mengalikan angka laporan
--   sampai 50x di atas data yang belum diverifikasi. Perbaikan valuasi menunggu
--   konfirmasi owner per bahan. Migration ini TIDAK menggeser satu Rupiah pun.
--
-- LINGKUP: hanya kolom qty_kecil. get_waste_periode tidak disentuh sama sekali.

CREATE OR REPLACE FUNCTION get_waste_breakdown(p_from date, p_to date)
RETURNS TABLE(
  outlet_id uuid,
  outlet_name text,
  reason text,
  bahan_baku_id uuid,
  bahan_nama text,
  tanggal date,
  qty numeric,
  qty_kecil numeric,
  satuan_kecil text,
  hpp_kecil numeric,
  nilai numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  SELECT
    w.outlet_id,
    o.name AS outlet_name,
    w.reason,
    w.bahan_baku_id,
    b.nama AS bahan_nama,
    (w.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
    w.qty,
    -- Faktor PENUH (kecil per besar) -- aturan kanonik yang sama persis dengan
    -- trg_process_bom_stok (20300108000005) dan to_ledger_scale().
    w.qty * GREATEST(
      COALESCE(
        CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
             THEN b.faktor_tampilan
             ELSE b.faktor_konversi
        END,
        1
      ),
      1
    ) AS qty_kecil,
    b.satuan_kecil,
    -- TIDAK DIUBAH (lihat catatan di header): basis harga_beli belum seragam.
    COALESCE(bh.harga_beli, 0) / COALESCE(b.faktor_konversi, 1) AS hpp_kecil,
    w.qty * COALESCE(bh.harga_beli, 0) AS nilai
  FROM stok_waste_reports w
  JOIN outlets o ON o.id = w.outlet_id
  JOIN bahan_baku b ON b.id = w.bahan_baku_id
  LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
  WHERE w.status = 'APPROVED'
    AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    AND w.outlet_id IN (SELECT public.accessible_outlet_ids());
END;
$$;

GRANT EXECUTE ON FUNCTION get_waste_breakdown(date, date) TO authenticated;
