-- 20260909100000_konsolidasi_supplier_aziz_agro.sql
-- Konsolidasi master supplier: normalisasi nama, gabungkan duplikat yang
-- termin-nya SAMA, dan pertahankan baris ber-termin berbeda sebagai baris
-- terpisah.
--
-- Keputusan owner 9 Sep 2026: "yang termin pisahkan karena memang beda termin".
-- Termin berbeda = kesepakatan pembayaran berbeda, bukan duplikat. Karena itu
-- Pak Aziz tetap punya tiga baris (tempo 10 / 15 / 30), dibedakan lewat nama
-- supaya tidak tertukar di dropdown PO -- salah pilih berarti jatuh tempo utang
-- meleset belasan hari.
--
-- BARIS YANG BERTAHAN DIPILIH BERDASARKAN DATA TERBAIK, BUKAN NAMANYA.
-- `Agro Boga Utama` (b9afa83d) memegang satu-satunya harga katalog terpercaya
-- untuk Agro (KENTANG Rp250.000). Menghapusnya akan menghilangkan harga itu
-- lewat FK CASCADE `bahan_baku_supplier`, dan seed ulang TIDAK bisa
-- memulihkannya karena seluruh PO milik `PT Agro Boga Utama` (c0281bca)
-- diverifikasi sebelum guard 4 Sep sehingga lahir sebagai harga 0. Jadi baris
-- itu yang disimpan, lalu di-rename ke nama yang dipilih owner.
--
-- Aditif untuk sisi nama; menghapus 3 baris supplier (2 duplikat + 1 sampah).
-- Idempoten: dijalankan dua kali menghasilkan keadaan akhir yang sama.

DO $$
DECLARE
  -- Pak Aziz (ketiganya nomor HP sama: 083876865070 = +62 838-7686-5070)
  v_aziz10   uuid := '6645d9b3-f3e9-45d6-a95b-a01de2941807'; -- dipulihkan, tempo 10
  v_aziz15   uuid := '0bd2e647-8892-4a01-91ad-696b1a26e9d9'; -- "Bapak Aziz", 4 PO -> BERTAHAN
  v_aziz15b  uuid := '40366ff5-66de-4454-b11e-ccea2b971e2c'; -- "L:ettuce (Pak Aziz)" -> dibuang
  v_aziz30   uuid := 'c364abe8-9b00-4b66-b7c1-15746c32b500'; -- tempo 30
  -- Agro
  v_agro     uuid := 'b9afa83d-3e66-4732-89a2-10999896c762'; -- pegang harga terpercaya -> BERTAHAN
  v_agro_dup uuid := 'c0281bca-478e-4b6f-8431-e3bafa54f240'; -- -> dibuang
  -- Entri sampah
  v_sadsad   uuid := '27a89e0c-3dba-4228-b38d-fcba74e9e461';
  -- Bahan baku
  v_sapi     uuid := 'ea22c9f6-dd51-4965-b6b5-b67507cfd2ef';
  v_lettuce  uuid := 'e486385e-9049-43e8-9ed4-6981af003a19'; -- "Sayur (lettuce)", aktif
  v_sayur    uuid := 'fe8fda11-243d-4bff-bf07-77456af41067'; -- "SAYUR", NONAKTIF
BEGIN
  -- ── A. Pulihkan baris tempo 10 ────────────────────────────────────────────
  -- Digabungkan keliru oleh 20260908231000 (dua termin berbeda disatukan).
  -- Nilai aslinya dipulihkan apa adanya, termasuk id dan created_at.
  INSERT INTO public.supplier (id, nama, kontak, termin_hari, is_active,
                               bahan_baku_ids, created_at)
  VALUES (v_aziz10, 'Lettuce (Pak Aziz) - Tempo 10', '+62 838-7686-5070', 10, true,
          ARRAY[v_lettuce, v_sayur], TIMESTAMPTZ '2026-08-14 15:36:00.348447+07')
  ON CONFLICT (id) DO NOTHING;

  -- ── B. Kembalikan daftar bahan baris tempo 30 ke miliknya sendiri ─────────
  UPDATE public.supplier
     SET bahan_baku_ids = ARRAY[v_sapi]
   WHERE id = v_aziz30
     AND bahan_baku_ids IS DISTINCT FROM ARRAY[v_sapi];

  -- Baris katalog yang lahir dari bahan pinjaman itu ikut dicabut.
  DELETE FROM public.bahan_baku_supplier
   WHERE supplier_id = v_aziz30
     AND bahan_baku_id IN (v_lettuce, v_sayur);

  -- ── C. Gabungkan dua baris Pak Aziz bertempo 15 ───────────────────────────
  IF EXISTS (SELECT 1 FROM public.supplier WHERE id = v_aziz15b) THEN
    UPDATE public.purchase_order SET supplier_id = v_aziz15 WHERE supplier_id = v_aziz15b;

    UPDATE public.supplier k
       SET bahan_baku_ids = (
             SELECT coalesce(array_agg(DISTINCT x), '{}'::uuid[])
               FROM unnest(coalesce(k.bahan_baku_ids, '{}'::uuid[])
                        || coalesce(d.bahan_baku_ids, '{}'::uuid[])) AS x)
      FROM public.supplier d
     WHERE k.id = v_aziz15 AND d.id = v_aziz15b;

    -- bahan_baku_supplier ikut terhapus lewat FK ON DELETE CASCADE.
    -- Tidak ada yang hilang: baris yang bertahan sudah memuat ketiga bahan itu.
    DELETE FROM public.supplier WHERE id = v_aziz15b;
  END IF;

  -- ── E. Gabungkan dua baris Agro (keduanya tempo 45) ───────────────────────
  IF EXISTS (SELECT 1 FROM public.supplier WHERE id = v_agro_dup) THEN
    UPDATE public.purchase_order SET supplier_id = v_agro WHERE supplier_id = v_agro_dup;

    UPDATE public.supplier k
       SET bahan_baku_ids = (
             SELECT coalesce(array_agg(DISTINCT x), '{}'::uuid[])
               FROM unnest(coalesce(k.bahan_baku_ids, '{}'::uuid[])
                        || coalesce(d.bahan_baku_ids, '{}'::uuid[])) AS x)
      FROM public.supplier d
     WHERE k.id = v_agro AND d.id = v_agro_dup;

    DELETE FROM public.supplier WHERE id = v_agro_dup;
  END IF;

  -- ── C/D/E. Nama kanonik (pilihan owner) ───────────────────────────────────
  UPDATE public.supplier SET nama = 'Lettuce (Pak Aziz) - Tempo 15' WHERE id = v_aziz15;
  UPDATE public.supplier SET nama = 'Lettuce (Pak Aziz) - Tempo 30' WHERE id = v_aziz30;
  UPDATE public.supplier SET nama = 'PT Agro Boga Utama'            WHERE id = v_agro;

  -- ── F. Sinkronkan kolom denormalisasi di dokumen PO ───────────────────────
  UPDATE public.purchase_order po
     SET supplier_nama = s.nama
    FROM public.supplier s
   WHERE po.supplier_id = s.id
     AND po.supplier_id IN (v_aziz10, v_aziz15, v_aziz30, v_agro)
     AND po.supplier_nama IS DISTINCT FROM s.nama;

  -- ── H. Buang entri sampah ─────────────────────────────────────────────────
  DELETE FROM public.supplier WHERE id = v_sadsad;
END $$;

-- DOWN: tidak ada. Penggabungan & penghapusan data tidak dibalik otomatis;
-- pulihkan dari backup bila perlu.
