-- Gramasi MINYAK & FOIL 5M disesuaikan, keputusan owner 2026-11-11.
-- Sumber: "HPP NOVEMBER.xlsx" tab GRAMASI CREW + tab SIZE 25/28/32.
--
-- MINYAK — aturan owner: "menu yang original 25 gram, suka suka 50 gr".
--   resep 'Shawarma %' (menu Original, termasuk kedua Best Seller) -> 25 g
--   resep 'Suka %'     (grup SUKA-SUKA)                            -> 50 g
--   Naik/turun bercampur: Mix Besar & ketiga Jumbo & 2 Best Seller TURUN
--   (35/40 -> 25), sedangkan Suka Beef & Suka Chicken NAIK (25 -> 50).
--   Menu Online tidak punya baris MINYAK sama sekali -> tak tersentuh.
--
--   Dasar empiris (Oktober 2026, outlet internal+mitra, outlet tes dikecualikan):
--   sistem memotong 1.738.351 g, selisih opname +503.743 g (62% baris positif,
--   median +1.043 g) => pemakaian NYATA ~1.234.608 g = 23,3 g/porsi, sementara
--   resep lama 30,4 g/porsi (kelebihan potong 29%). Setelah perubahan ini
--   27,6 g/porsi (+18,7% dari nyata) -- membaik, belum nol. Angka 25/50 adalah
--   standar operasional pilihan owner, bukan hasil optimasi terhadap opname.
--
-- FOIL 5M — ikut tab SIZE: ukuran 25 -> 33 cm, 28 -> 36 cm, 32 -> 40 cm.
--   Ukuran dibaca dari bahan KULIT pada resep yang sama (KULIT 25/28/32),
--   bukan dari nama resep -- lebih tahan terhadap rename menu.
--   Menu Online IKUT berubah (punya FOIL). Menu Reguler/BOGO tidak punya
--   FOIL sejak 20261021120000 (diganti PLASTIK VACUM + DUS PACKING).
--
--   ⚠️ CATATAN PENTING — FOIL BERTENTANGAN DENGAN DATA LAPANGAN.
--   Selisih opname FOIL Oktober NEGATIF (-719.491 cm): fisik lebih RENDAH dari
--   sistem, artinya lapangan memakai foil LEBIH BANYAK (nyata ~57,2 cm/porsi)
--   daripada resep lama (40,5). Menurunkannya ke 36,1 cm/porsi membuat selisih
--   opname makin negatif (perkiraan ~-1,12 jt cm/bulan). Owner diberi tahu
--   angka ini beserta dua alternatif (biarkan & selidiki di outlet, atau
--   naikkan mendekati pemakaian nyata) dan tetap memilih mengikuti Excel.
--   Tindak lanjut yang masih terbuka: cari sebab pemakaian 41% di atas standar
--   (cara potong crew / sisa ujung roll / roll rusak yang tak tercatat waste).
--
-- BERLAKU KE DEPAN SAJA. Baris `ledger_stok` historis TIDAK dikoreksi -- opname
-- rutin sudah menyerapnya (pola keputusan K1, Session 2026-09-09).
-- hpp_override TIDAK disentuh, jadi laporan laba/COGS tidak bergeser sama
-- sekali; yang berubah hanya potongan stok untuk order berikutnya dan HPP
-- teoritis di panel HPP Dinamis.

DO $$
DECLARE
  v_minyak uuid;
  v_foil   uuid;
  v_n      int;
  v_ubah_minyak int;
  v_ubah_foil   int;
BEGIN
  SELECT id INTO v_minyak FROM public.bahan_baku WHERE nama = 'MINYAK'  AND is_active;
  SELECT id INTO v_foil   FROM public.bahan_baku WHERE nama = 'FOIL 5M';
  IF v_minyak IS NULL THEN RAISE EXCEPTION 'Bahan MINYAK tidak ditemukan'; END IF;
  IF v_foil   IS NULL THEN RAISE EXCEPTION 'Bahan FOIL 5M tidak ditemukan'; END IF;

  -- Peta resep -> ukuran, dibaca dari bahan KULIT pada resep yang sama.
  CREATE TEMP TABLE _r ON COMMIT DROP AS
  SELECT r.id AS resep_id, r.nama,
         CASE WHEN r.nama LIKE 'Suka %' THEN 'SUKA' ELSE 'ORI' END AS grup,
         (SELECT CASE b2.nama WHEN 'KULIT 25' THEN 25 WHEN 'KULIT 28' THEN 28
                              WHEN 'KULIT 32' THEN 32 END
            FROM public.resep_item ri2
            JOIN public.bahan_baku b2 ON b2.id = ri2.bahan_baku_id
           WHERE ri2.resep_id = r.id AND b2.nama LIKE 'KULIT %'
           LIMIT 1) AS ukuran
  FROM public.resep r
  WHERE r.is_active AND r.outlet_id IS NULL;

  -- Penjaga: tiap resep yang punya FOIL wajib punya KULIT (penentu ukuran).
  SELECT count(*) INTO v_n
    FROM public.resep_item ri JOIN _r ON _r.resep_id = ri.resep_id
   WHERE ri.bahan_baku_id = v_foil AND _r.ukuran IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'GAGAL: % resep ber-FOIL tanpa KULIT penentu ukuran', v_n;
  END IF;

  -- Penjaga: cakupan sesuai yang diukur 11 Nov 2026.
  SELECT count(*) INTO v_n FROM public.resep_item ri JOIN _r ON _r.resep_id = ri.resep_id
   WHERE ri.bahan_baku_id = v_minyak;
  IF v_n <> 15 THEN RAISE EXCEPTION 'GAGAL: resep ber-MINYAK = % (harap 15)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.resep_item ri JOIN _r ON _r.resep_id = ri.resep_id
   WHERE ri.bahan_baku_id = v_foil;
  IF v_n <> 23 THEN RAISE EXCEPTION 'GAGAL: resep ber-FOIL = % (harap 23)', v_n; END IF;

  -- 1) MINYAK: Original 25 g, Suka-Suka 50 g
  WITH upd AS (
    UPDATE public.resep_item ri
       SET qty_per_porsi = CASE _r.grup WHEN 'SUKA' THEN 50 ELSE 25 END
      FROM _r
     WHERE _r.resep_id = ri.resep_id
       AND ri.bahan_baku_id = v_minyak
       AND ri.qty_per_porsi <> CASE _r.grup WHEN 'SUKA' THEN 50 ELSE 25 END
    RETURNING 1
  ) SELECT count(*) INTO v_ubah_minyak FROM upd;

  -- 2) FOIL 5M: 25 -> 33 cm, 28 -> 36 cm, 32 -> 40 cm
  WITH upd AS (
    UPDATE public.resep_item ri
       SET qty_per_porsi = CASE _r.ukuran WHEN 25 THEN 33 WHEN 28 THEN 36 WHEN 32 THEN 40 END
      FROM _r
     WHERE _r.resep_id = ri.resep_id
       AND ri.bahan_baku_id = v_foil
       AND ri.qty_per_porsi <> CASE _r.ukuran WHEN 25 THEN 33 WHEN 28 THEN 36 WHEN 32 THEN 40 END
    RETURNING 1
  ) SELECT count(*) INTO v_ubah_foil FROM upd;

  -- Asersi A: jumlah baris yang berubah persis seperti yang dihitung 11 Nov 2026
  IF v_ubah_minyak <> 8 THEN
    RAISE EXCEPTION 'ASERSI A GAGAL: baris MINYAK berubah % (harap 8)', v_ubah_minyak;
  END IF;
  IF v_ubah_foil <> 23 THEN
    RAISE EXCEPTION 'ASERSI A GAGAL: baris FOIL berubah % (harap 23)', v_ubah_foil;
  END IF;

  -- Asersi B: nilai akhir MINYAK patuh aturan untuk SEMUA resep ber-MINYAK
  SELECT count(*) INTO v_n FROM public.resep_item ri JOIN _r ON _r.resep_id = ri.resep_id
   WHERE ri.bahan_baku_id = v_minyak
     AND ri.qty_per_porsi = CASE _r.grup WHEN 'SUKA' THEN 50 ELSE 25 END;
  IF v_n <> 15 THEN RAISE EXCEPTION 'ASERSI B GAGAL: MINYAK patuh aturan % dari 15', v_n; END IF;

  -- Asersi C: nilai akhir FOIL patuh aturan untuk SEMUA resep ber-FOIL
  SELECT count(*) INTO v_n FROM public.resep_item ri JOIN _r ON _r.resep_id = ri.resep_id
   WHERE ri.bahan_baku_id = v_foil
     AND ri.qty_per_porsi = CASE _r.ukuran WHEN 25 THEN 33 WHEN 28 THEN 36 WHEN 32 THEN 40 END;
  IF v_n <> 23 THEN RAISE EXCEPTION 'ASERSI C GAGAL: FOIL patuh aturan % dari 23', v_n; END IF;

  -- Asersi D: tidak ada bahan LAIN yang ikut tersentuh -- Suka Sosis dipakai
  -- sebagai sampel: SOSIS tetap 2 pcs, lettuce 50 g, TUM 10 g.
  SELECT count(*) INTO v_n
    FROM public.resep r
    JOIN public.resep_item ri ON ri.resep_id = r.id
    JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
   WHERE r.nama = 'Suka Sosis' AND r.is_active AND r.outlet_id IS NULL
     AND ((b.nama = 'SOSIS' AND ri.qty_per_porsi = 2)
       OR (b.nama = 'Sayur (lettuce)' AND ri.qty_per_porsi = 50)
       OR (b.nama = 'TUM' AND ri.qty_per_porsi = 10));
  IF v_n <> 3 THEN RAISE EXCEPTION 'ASERSI D GAGAL: bahan lain Suka Sosis bergeser (% dari 3)', v_n; END IF;

  RAISE NOTICE 'OK: MINYAK % baris, FOIL % baris disesuaikan', v_ubah_minyak, v_ubah_foil;
END $$;
