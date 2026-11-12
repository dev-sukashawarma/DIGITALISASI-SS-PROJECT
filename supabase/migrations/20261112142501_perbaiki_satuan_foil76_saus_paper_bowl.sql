-- =============================================================================
-- Migration: Perbaiki Satuan Bahan Baku (FOIL 7,6M, SAUS KEJU, SAUS TRUFFLE, PAPER BOWL)
--            + Default satuan_po & satuan_distribusi pada simpan_bahan_baku
-- =============================================================================

-- 1. Perbaiki simpan_bahan_baku agar pembuatan bahan baru (p_id IS NULL) selalu
--    mengisi default satuan_po (lower(satuan)) dan satuan_distribusi
--    (lower(COALESCE(satuan_tengah, satuan))) bila tidak dikirim eksplisit oleh klien.
CREATE OR REPLACE FUNCTION public.simpan_bahan_baku(
  p_id uuid,
  p_data jsonb,
  p_alasan text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_boleh  constant text[] := ARRAY['nama','merek','kategori','peruntukan','is_opname','default_reorder_point',
    'satuan','satuan_tengah','faktor_tengah','satuan_kecil','isi_kecil_per_tengah','satuan_po','satuan_distribusi',
    'image_url','image_url_tengah','image_url_kecil','image_urls'];
  c_satuan constant text[] := ARRAY['satuan','satuan_tengah','faktor_tengah','satuan_kecil','isi_kecil_per_tengah'];
  v_kunci    text;
  v_lama     public.bahan_baku%ROWTYPE;
  v_id       uuid;
  v_nama     text;
  v_satuan   text;
  v_tengah   text;
  v_ft       numeric;
  v_kecil    text;
  v_isi      numeric;
  v_tampilan numeric;
BEGIN
  -- Membuat bahan baru = lingkup 'tambah' (termasuk purchasing); mengubah = 'data'.
  PERFORM public._peran_master(CASE WHEN p_id IS NULL THEN 'tambah' ELSE 'data' END);
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'p_data harus objek JSON' USING ERRCODE = '22023';
  END IF;
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_bahan_baku', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;
  PERFORM set_config('app.alasan', COALESCE(p_alasan, ''), true);

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_lama FROM public.bahan_baku WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bahan % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  END IF;

  -- Nama unik di antara bahan aktif (beda huruf/spasi dianggap sama).
  v_nama := btrim(COALESCE(p_data ->> 'nama', v_lama.nama));
  IF COALESCE(v_nama, '') = '' THEN RAISE EXCEPTION 'Nama bahan wajib diisi' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.bahan_baku
              WHERE is_active AND lower(btrim(nama)) = lower(v_nama)
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Sudah ada bahan aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;

  -- Satuan dikirim sebagai satu set; semantik = turunkanFaktorSatuan() (satuanBahan.ts).
  IF p_data ?| c_satuan OR p_id IS NULL THEN
    IF NOT (p_data ? 'satuan' AND p_data ? 'isi_kecil_per_tengah') THEN
      RAISE EXCEPTION 'Satuan dikirim sebagai satu set: satuan dan isi_kecil_per_tengah wajib ada' USING ERRCODE = '22023';
    END IF;
    v_satuan := btrim(p_data ->> 'satuan');
    v_tengah := NULLIF(btrim(p_data ->> 'satuan_tengah'), '');
    v_ft     := NULLIF(p_data ->> 'faktor_tengah', '')::numeric;
    v_kecil  := NULLIF(btrim(p_data ->> 'satuan_kecil'), '');
    v_isi    := NULLIF(p_data ->> 'isi_kecil_per_tengah', '')::numeric;
    IF COALESCE(v_satuan, '') = '' THEN RAISE EXCEPTION 'Satuan besar wajib diisi' USING ERRCODE = '22023'; END IF;

    IF v_tengah IS NULL OR (lower(v_tengah) = lower(v_satuan) AND COALESCE(v_ft, 1) = 1) THEN
      v_tengah := NULL; v_ft := NULL; v_tampilan := v_isi;
    ELSE
      v_tampilan := v_ft * v_isi;
    END IF;
    IF v_kecil IS NULL THEN
      v_tampilan := NULL;
    END IF;

    IF p_id IS NOT NULL AND public._bahan_punya_riwayat_stok(p_id) AND (
         v_satuan   IS DISTINCT FROM v_lama.satuan
      OR v_tengah   IS DISTINCT FROM v_lama.satuan_tengah
      OR v_ft       IS DISTINCT FROM v_lama.faktor_tengah
      OR v_kecil    IS DISTINCT FROM v_lama.satuan_kecil
      OR v_tampilan IS DISTINCT FROM v_lama.faktor_tampilan) THEN
      RAISE EXCEPTION 'Bahan "%" sudah punya riwayat stok; satuannya hanya bisa diubah lewat Ganti Satuan', v_lama.nama;
    END IF;
  ELSE
    v_satuan := v_lama.satuan; v_tengah := v_lama.satuan_tengah; v_ft := v_lama.faktor_tengah;
    v_kecil := v_lama.satuan_kecil; v_tampilan := v_lama.faktor_tampilan;
  END IF;

  IF p_id IS NULL THEN
    IF COALESCE(btrim(p_data ->> 'kategori'), '') = '' THEN
      RAISE EXCEPTION 'Kategori wajib diisi' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.bahan_baku (
      nama, merek, kategori, peruntukan, is_opname, default_reorder_point,
      satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
      satuan_po, satuan_distribusi, image_url, image_url_tengah, image_url_kecil, image_urls,
      is_active, is_fisik_checked)
    VALUES (
      v_nama, p_data ->> 'merek', btrim(p_data ->> 'kategori'),
      COALESCE(p_data ->> 'peruntukan', 'outlet'),
      COALESCE((p_data ->> 'is_opname')::boolean, true),
      COALESCE((p_data ->> 'default_reorder_point')::numeric, 0),
      v_satuan, v_tengah, v_ft, v_kecil, v_tampilan,
      COALESCE(NULLIF(btrim(p_data ->> 'satuan_po'), ''), lower(v_satuan)),
      COALESCE(NULLIF(btrim(p_data ->> 'satuan_distribusi'), ''), lower(COALESCE(v_tengah, v_satuan))),
      p_data ->> 'image_url', p_data ->> 'image_url_tengah', p_data ->> 'image_url_kecil',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_data -> 'image_urls')), '{}'::text[]),
      true, false)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.bahan_baku SET
    nama                  = v_nama,
    merek                 = CASE WHEN p_data ? 'merek' THEN p_data ->> 'merek' ELSE merek END,
    kategori              = CASE WHEN p_data ? 'kategori' THEN btrim(p_data ->> 'kategori') ELSE kategori END,
    peruntukan            = CASE WHEN p_data ? 'peruntukan' THEN p_data ->> 'peruntukan' ELSE peruntukan END,
    is_opname             = CASE WHEN p_data ? 'is_opname' THEN (p_data ->> 'is_opname')::boolean ELSE is_opname END,
    default_reorder_point = CASE WHEN p_data ? 'default_reorder_point'
                                 THEN (p_data ->> 'default_reorder_point')::numeric ELSE default_reorder_point END,
    satuan = v_satuan, satuan_tengah = v_tengah, faktor_tengah = v_ft,
    satuan_kecil = v_kecil, faktor_tampilan = v_tampilan,
    satuan_po             = CASE WHEN p_data ? 'satuan_po' THEN p_data ->> 'satuan_po' ELSE satuan_po END,
    satuan_distribusi     = CASE WHEN p_data ? 'satuan_distribusi' THEN p_data ->> 'satuan_distribusi' ELSE satuan_distribusi END,
    image_url             = CASE WHEN p_data ? 'image_url' THEN p_data ->> 'image_url' ELSE image_url END,
    image_url_tengah      = CASE WHEN p_data ? 'image_url_tengah' THEN p_data ->> 'image_url_tengah' ELSE image_url_tengah END,
    image_url_kecil       = CASE WHEN p_data ? 'image_url_kecil' THEN p_data ->> 'image_url_kecil' ELSE image_url_kecil END,
    image_urls            = CASE WHEN p_data ? 'image_urls'
                                 THEN COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_data -> 'image_urls')), '{}'::text[])
                                 ELSE image_urls END
  WHERE id = p_id;

  IF v_satuan   IS DISTINCT FROM v_lama.satuan
     OR v_tengah   IS DISTINCT FROM v_lama.satuan_tengah
     OR v_ft       IS DISTINCT FROM v_lama.faktor_tengah
     OR v_kecil    IS DISTINCT FROM v_lama.satuan_kecil
     OR v_tampilan IS DISTINCT FROM v_lama.faktor_tampilan THEN
    UPDATE public.bahan_baku_harga SET kemasan_qty = kemasan_qty WHERE bahan_baku_id = p_id;
    PERFORM public.turunkan_harga_master(p_id);
  END IF;
  RETURN p_id;
END;
$function$;

-- 2. Perbaikan data satuan pada PAPER BOWL, SAUS KEJU, SAUS TRUFFLE, dan FOIL 7,6M
DO $$
DECLARE
  v_gudang        uuid := public.gudang_pusat_id();
  v_paper_bowl    public.bahan_baku%ROWTYPE;
  v_saus          public.bahan_baku%ROWTYPE;
  v_foil          public.bahan_baku%ROWTYPE;
  v_m0            record;
  v_m1            record;
  v_delta_keluar  numeric;
  v_c_sj          bigint := 0;
  v_c_pb          bigint := 0;
  v_c_kat         bigint := 0;
  v_harga_foil    numeric;
  v_sup_rec       record;
BEGIN
  PERFORM set_config('app.ganti_satuan', 'on', true);

  -- A. PAPER BOWL: satuan_kecil 'Dus' -> 'Pcs', satuan_po = 'pack', satuan_distribusi = 'pack'
  SELECT * INTO v_paper_bowl
  FROM public.bahan_baku
  WHERE is_active AND upper(btrim(nama)) = 'PAPER BOWL'
  FOR UPDATE;

  IF FOUND AND (
    lower(COALESCE(v_paper_bowl.satuan_kecil, '')) = 'dus'
    OR v_paper_bowl.satuan_po IS NULL
    OR v_paper_bowl.satuan_distribusi IS NULL
  ) THEN
    PERFORM set_config('app.alasan',
      'Koreksi satuan PAPER BOWL: satuan_kecil Dus -> Pcs (1 Pack = 50 Pcs), satuan_po = pack, satuan_distribusi = pack',
      true);

    UPDATE public.bahan_baku
    SET satuan            = 'Pack',
        satuan_tengah     = NULL,
        faktor_tengah     = NULL,
        satuan_kecil      = 'Pcs',
        faktor_tampilan   = 50,
        satuan_po         = 'pack',
        satuan_distribusi = 'pack',
        satuan_diganti_at = now()
    WHERE id = v_paper_bowl.id;

    UPDATE public.bahan_baku_harga
    SET kemasan_qty = kemasan_qty
    WHERE bahan_baku_id = v_paper_bowl.id;

    INSERT INTO public.bahan_baku_ganti_satuan (
      bahan_baku_id, satuan_lama, satuan_baru, jembatan, k_kecil, k_besar, jumlah_baris, alasan
    ) VALUES (
      v_paper_bowl.id,
      jsonb_build_object(
        'satuan', v_paper_bowl.satuan, 'satuan_tengah', v_paper_bowl.satuan_tengah,
        'faktor_tengah', v_paper_bowl.faktor_tengah, 'satuan_kecil', v_paper_bowl.satuan_kecil,
        'faktor_tampilan', v_paper_bowl.faktor_tampilan, 'satuan_po', v_paper_bowl.satuan_po,
        'satuan_distribusi', v_paper_bowl.satuan_distribusi
      ),
      jsonb_build_object(
        'satuan', 'Pack', 'satuan_tengah', NULL, 'faktor_tengah', NULL,
        'satuan_kecil', 'Pcs', 'faktor_tampilan', 50,
        'satuan_po', 'pack', 'satuan_distribusi', 'pack'
      ),
      1, 1, 1,
      jsonb_build_object('catatan', 'Koreksi label satuan_kecil Dus -> Pcs & pengisian satuan_po/satuan_distribusi'),
      'Koreksi label satuan kecil PAPER BOWL (Dus -> Pcs) dan isi satuan_po/satuan_distribusi = pack'
    );
  END IF;

  -- B. SAUS KEJU & SAUS TRUFFLE: satuan_tengah 'Kg' -> 'Pouch' (6 Pouch @ 1000 Gram), satuan_po = 'dus', satuan_distribusi = 'pouch'
  FOR v_saus IN
    SELECT * FROM public.bahan_baku
    WHERE is_active AND upper(btrim(nama)) IN ('SAUS KEJU', 'SAUS TRUFFLE')
    FOR UPDATE
  LOOP
    IF lower(COALESCE(v_saus.satuan_tengah, '')) <> 'pouch'
       OR v_saus.satuan_po IS NULL
       OR v_saus.satuan_distribusi IS NULL THEN

      PERFORM set_config('app.alasan',
        format('Penyeragaman satuan %s seperti saus lainnya: Dus / Pouch (6) / Gram (1000), satuan_po = dus, satuan_distribusi = pouch', v_saus.nama),
        true);

      UPDATE public.bahan_baku
      SET satuan            = 'Dus',
          satuan_tengah     = 'Pouch',
          faktor_tengah     = 6,
          satuan_kecil      = 'Gram',
          faktor_tampilan   = 6000,
          satuan_po         = 'dus',
          satuan_distribusi = 'pouch',
          satuan_diganti_at = now()
      WHERE id = v_saus.id;

      UPDATE public.bahan_baku_harga
      SET kemasan_qty = kemasan_qty
      WHERE bahan_baku_id = v_saus.id;

      INSERT INTO public.bahan_baku_ganti_satuan (
        bahan_baku_id, satuan_lama, satuan_baru, jembatan, k_kecil, k_besar, jumlah_baris, alasan
      ) VALUES (
        v_saus.id,
        jsonb_build_object(
          'satuan', v_saus.satuan, 'satuan_tengah', v_saus.satuan_tengah,
          'faktor_tengah', v_saus.faktor_tengah, 'satuan_kecil', v_saus.satuan_kecil,
          'faktor_tampilan', v_saus.faktor_tampilan, 'satuan_po', v_saus.satuan_po,
          'satuan_distribusi', v_saus.satuan_distribusi
        ),
        jsonb_build_object(
          'satuan', 'Dus', 'satuan_tengah', 'Pouch', 'faktor_tengah', 6,
          'satuan_kecil', 'Gram', 'faktor_tampilan', 6000,
          'satuan_po', 'dus', 'satuan_distribusi', 'pouch'
        ),
        1, 1, 1,
        jsonb_build_object('catatan', 'Penyeragaman satuan_tengah Kg -> Pouch & pengisian satuan_po/satuan_distribusi'),
        format('Penyeragaman satuan %s seperti saus kemasan lainnya (1 Dus = 6 Pouch @ 1000 Gram)', v_saus.nama)
      );
    END IF;
  END LOOP;

  -- C. FOIL 7,6M: koreksi faktor_tengah 48 -> 24 Roll/Dus (faktor_tampilan 36480 -> 18240 cm)
  SELECT * INTO v_foil
  FROM public.bahan_baku
  WHERE is_active AND upper(btrim(nama)) = 'FOIL 7,6M'
  FOR UPDATE;

  IF FOUND AND v_foil.faktor_tengah = 48 THEN
    SELECT * INTO v_m0 FROM public._metrik_ledger_bahan(v_foil.id);

    PERFORM set_config('app.alasan',
      'Koreksi faktor_tengah FOIL 7,6M dari 48 menjadi 24 Roll/Dus (18.240 cm/Dus) sesuai fisik kemasan vendor',
      true);

    -- 1) Update master bahan_baku (1 Dus = 24 Roll = 18.240 cm)
    UPDATE public.bahan_baku
    SET satuan            = 'Dus',
        satuan_tengah     = 'Roll',
        faktor_tengah     = 24,
        satuan_kecil      = 'cm',
        faktor_tampilan   = 18240,
        satuan_po         = 'roll',
        satuan_distribusi = 'roll',
        satuan_diganti_at = now()
    WHERE id = v_foil.id;

    -- 2) Sinkronisasi kemasan_qty di bahan_baku_harga (36480 -> 18240 cm).
    --    harga_beli (Rp 292.869,23) SUDAH merupakan harga per 1 Dus isi 24 Roll dari PO,
    --    sehingga tidak dibagi 2.
    UPDATE public.bahan_baku_harga
    SET kemasan_qty = kemasan_qty
    WHERE bahan_baku_id = v_foil.id
    RETURNING harga_beli INTO v_harga_foil;

    -- 3) Sinkronisasi ulang harga per Roll di katalog vendor (sebelumnya terbagi 48 menjadi Rp 6.101,44/Roll;
    --    dengan 24 Roll/Dus menjadi Rp 12.202,88/Roll).
    IF v_harga_foil IS NOT NULL AND v_harga_foil > 0 THEN
      FOR v_sup_rec IN
        SELECT supplier_id, ref_po_id
        FROM public.bahan_baku_supplier
        WHERE bahan_baku_id = v_foil.id AND is_active
      LOOP
        PERFORM public.katalog_tulis_dari_po(v_foil.id, v_sup_rec.supplier_id, v_harga_foil, v_sup_rec.ref_po_id);
        v_c_kat := v_c_kat + 1;
      END LOOP;
    END IF;

    -- 4) Konversi qty_dikirim/qty_terima di surat_jalan_item & qty_diminta/qty_disetujui di permintaan_bahan_item
    --    (seluruhnya diinput dari UI dalam satuan Roll lalu dibagi faktor_tengah lama 48; dikalikan 2 agar jumlah Roll tetap sama).
    UPDATE public.surat_jalan_item
    SET qty_dikirim    = qty_dikirim * 2,
        qty_terima     = qty_terima * 2,
        harga_snapshot = CASE
                           WHEN harga_snapshot IS NOT NULL AND abs(harga_snapshot - 554592) < 1 THEN harga_snapshot / 2
                           ELSE harga_snapshot
                         END
    WHERE bahan_baku_id = v_foil.id;
    GET DIAGNOSTICS v_c_sj = ROW_COUNT;

    UPDATE public.permintaan_bahan_item
    SET qty_diminta    = qty_diminta * 2,
        qty_disetujui  = qty_disetujui * 2,
        harga_snapshot = CASE
                           WHEN harga_snapshot IS NOT NULL AND abs(harga_snapshot - 554592) < 1 THEN harga_snapshot / 2
                           ELSE harga_snapshot
                         END
    WHERE bahan_baku_id = v_foil.id;
    GET DIAGNOSTICS v_c_pb = ROW_COUNT;

    -- 5) Rekonsiliasi saldo Gudang Pusat lewat ledger_stok (SOP: tidak pernah UPDATE stok_balance langsung).
    --    PO masuk (41,6 Dus) sudah dicatat dalam basis 24 Roll/Dus, sedangkan 19 baris transfer_keluar
    --    memotong dalam basis 48 Roll/Dus (setengah dari jumlah Dus 24-Roll yang sebenarnya keluar).
    SELECT COALESCE(SUM(qty), 0) INTO v_delta_keluar
    FROM public.ledger_stok
    WHERE outlet_id = v_gudang
      AND bahan_baku_id = v_foil.id
      AND tipe = 'transfer_keluar';

    IF v_delta_keluar < 0 THEN
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, created_at
      ) VALUES (
        v_gudang,
        v_foil.id,
        'adjustment',
        v_delta_keluar,
        'Koreksi selisih skala transfer_keluar FOIL 7,6M di Gudang Pusat (19 SJ terpotong basis 48 Roll/Dus, disesuaikan ke 24 Roll/Dus)',
        now()
      );
    END IF;

    -- 6) Verifikasi integritas rantai ledger tidak memburuk
    SELECT * INTO v_m1 FROM public._metrik_ledger_bahan(v_foil.id);
    IF v_m1.beda > v_m0.beda OR v_m1.putus > v_m0.putus THEN
      RAISE EXCEPTION 'Asersi gagal pada koreksi FOIL 7,6M: beda % -> %, putus % -> %',
        v_m0.beda, v_m1.beda, v_m0.putus, v_m1.putus;
    END IF;

    INSERT INTO public.bahan_baku_ganti_satuan (
      bahan_baku_id, satuan_lama, satuan_baru, jembatan, k_kecil, k_besar, jumlah_baris, alasan
    ) VALUES (
      v_foil.id,
      jsonb_build_object(
        'satuan', v_foil.satuan, 'satuan_tengah', v_foil.satuan_tengah,
        'faktor_tengah', v_foil.faktor_tengah, 'satuan_kecil', v_foil.satuan_kecil,
        'faktor_tampilan', v_foil.faktor_tampilan, 'satuan_po', v_foil.satuan_po,
        'satuan_distribusi', v_foil.satuan_distribusi
      ),
      jsonb_build_object(
        'satuan', 'Dus', 'satuan_tengah', 'Roll', 'faktor_tengah', 24,
        'satuan_kecil', 'cm', 'faktor_tampilan', 18240,
        'satuan_po', 'roll', 'satuan_distribusi', 'roll'
      ),
      1, 1, 2,
      jsonb_build_object(
        'sj_item', v_c_sj,
        'permintaan_item', v_c_pb,
        'katalog', v_c_kat,
        'adjustment_gudang_dus', v_delta_keluar
      ),
      'Koreksi faktor_tengah FOIL 7,6M dari 48 menjadi 24 Roll/Dus sesuai fisik kemasan vendor'
    );
  END IF;

  PERFORM set_config('app.ganti_satuan', '', true);
END $$;
