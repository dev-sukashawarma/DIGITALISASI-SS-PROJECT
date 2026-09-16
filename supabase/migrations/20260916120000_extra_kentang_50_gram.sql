-- =============================================================================
-- 20260916120000_extra_kentang_50_gram.sql
-- =============================================================================
-- Konfirmasi owner 2026-09-16: satu porsi "Extra Kentang" = 50 gram.
--
-- Resepnya tercatat 20 gram — sekitar tiga potong kentang goreng untuk topping
-- yang dijual Rp 9.000. Ketahuan dari panel HPP Dinamis: dinamis Rp 291/porsi
-- vs override Rp 3.500 (-91,7%), paling menyimpang dari seluruh papan (menu
-- lain -13% s/d -33%). Extra Keju di sebelahnya diperiksa juga dan WAJAR:
-- 1 lembar keju, 240 lembar/Dus @ Rp 289.047 = Rp 1.204/porsi.
--
-- KENTANG: Dus = 10.000 gram @ Rp 250.000 -> Rp 25/gram (harga master).
--   sebelum: 20 g = Rp   500/porsi
--   sesudah: 50 g = Rp 1.250/porsi
-- Di outlet yang harga kirimannya lebih murah angkanya lebih rendah — HPP
-- dinamis memakai harga kiriman per outlet, bukan master.
--
-- Hanya SATU baris resep yang ada untuk menu ini (global, aktif, tanpa salinan
-- outlet) — diperiksa sebelum migration ditulis, termasuk resep nonaktif.
--
-- Dampak: potongan BOM KENTANG untuk menu ini naik 2,5x ke depan. Baris ledger
-- historis TIDAK disentuh — jejak audit, dan outlet opname rutin sehingga
-- selisih lama sudah terserap (pola sama dengan keputusan 2026-09-09 K1).
--
-- KOREKSI (ditulis belakangan, hari yang sama): draf pertama header ini menduga
-- `hpp_override` Rp 3.500 di kedua topping adalah HARGA JUAL yang keliru masuk
-- ke kolom HPP. ⚠️ DUGAAN ITU SALAH dan sudah ditarik. Harga jual sebenarnya
-- Extra Kentang Rp 9.000 dan Extra Keju Rp 7.000 (aplikasi Rp 8.000); disapu ke
-- seluruh menu aktif: NOL baris ber-`hpp_override = price`. Kedua topping justru
-- margin terbaik — food cost 38,9% & 50% vs menu utama 60–71%. Perbaikan resep di
-- bawah berdiri sendiri: porsinya yang kurang dicatat, bukan override-nya salah.
-- =============================================================================
BEGIN;

UPDATE public.resep_item ri
   SET qty_per_porsi = 50
  FROM public.resep r
  JOIN public.menu_items m ON m.id::text = r.menu_item_ref
 WHERE ri.resep_id = r.id
   AND m.name = 'Extra Kentang'
   AND ri.bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'KENTANG')
   AND ri.qty_per_porsi = 20;

DO $$
DECLARE v_n int; v_qty numeric;
BEGIN
  SELECT count(*), min(ri.qty_per_porsi) INTO v_n, v_qty
    FROM public.resep_item ri
    JOIN public.resep r ON r.id = ri.resep_id
    JOIN public.menu_items m ON m.id::text = r.menu_item_ref
   WHERE m.name = 'Extra Kentang';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris resep Extra Kentang = % (harap 1)', v_n;
  END IF;
  IF v_qty <> 50 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: qty_per_porsi = % (harap 50)', v_qty;
  END IF;
END $$;

COMMIT;
