-- 20260925120000_auto_verifikasi_sadar_opname.sql
-- Mencegah double-count stok saat auto-verifikasi berjalan setelah outlet opname.
--
-- MASALAH YANG DITUTUP:
--   Kiriman tiba siang/sore, crew belum verifikasi di sistem.
--   Malam harinya (pukul 21:00-22:30 WIB), crew opname fisik dan menghitung
--   barang yang nyata-nyata sudah ada di toko. Saldo sistem di-set ke fisik.
--   Dini hari pukul 02:00 WIB, auto_verifikasi_surat_jalan memanggil
--   finalize_surat_jalan_and_ledger(), memasukkan kembali qty kiriman ke saldo.
--   Akibatnya: STOK TERCATAT GANDA (DOUBLE COUNT). Terjadi di 25 dari 36 SJ.
--
-- SOLUSI:
--   Cek apakah outlet sudah melakukan opname berstatus 'finalized' pada atau
--   setelah tanggal kiriman SJ.
--   - Jika SUDAH OPNAME: barang fisik sudah terserap hitungan opname.
--     Tutup SJ secara administratif (ditutup_administratif_at = now()),
--     status jadi 'diterima_lengkap', TANPA memanggil finalize_surat_jalan_and_ledger.
--     NOL BARIS LEDGER DITULIS.
--   - Jika BELUM OPNAME: panggil finalize_surat_jalan_and_ledger seperti biasa
--     agar stok sah masuk ke buku outlet.

CREATE OR REPLACE FUNCTION public.auto_verifikasi_surat_jalan(
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE(diproses int, dilewati int, daftar text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  c_mulai       CONSTANT date     := DATE '2026-09-11';
  c_geser       CONSTANT interval := interval '3 hours';  -- batas hari -> 21:00 WIB
  c_batas       CONSTANT int      := 50;                  -- maksimal per jalan

  v_sj          RECORD;
  v_n           int  := 0;
  v_skip        int  := 0;
  v_daftar      text := '';
  v_has_opname  boolean;
  v_tgl_kirim   date;
BEGIN
  FOR v_sj IN
    SELECT sj.id, sj.outlet_id, sj.updated_at, sj.notes
      FROM public.surat_jalan sj
     WHERE sj.status = 'dikirim'
       AND sj.auto_verified_at IS NULL
       AND sj.ditutup_administratif_at IS NULL
       -- hari kirimnya sudah lewat (batas 21:00 WIB)
       AND ((((sj.updated_at AT TIME ZONE 'Asia/Jakarta') + c_geser)::date)
            < (((now()        AT TIME ZONE 'Asia/Jakarta') + c_geser)::date))
       -- forward-only
       AND ((sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date) >= c_mulai
       -- outlet tes tidak masuk perhitungan apa pun (aturan owner 8 Sep)
       AND NOT EXISTS (
             SELECT 1 FROM public.outlets o
              WHERE o.id = sj.outlet_id AND o.type = 'test')
       -- jangan hidupkan stok di bahan yang sudah dinonaktifkan
       AND NOT EXISTS (
             SELECT 1 FROM public.surat_jalan_item i
               JOIN public.bahan_baku b ON b.id = i.bahan_baku_id
              WHERE i.surat_jalan_id = sj.id AND b.is_active = false)
       -- crew sedang memverifikasi sebagian: jangan didahului
       AND NOT EXISTS (
             SELECT 1 FROM public.surat_jalan_item i
              WHERE i.surat_jalan_id = sj.id AND i.qty_terima IS NOT NULL)
       -- sabuk pengaman: stok masuk belum pernah ditulis
       AND NOT EXISTS (
             SELECT 1 FROM public.ledger_stok l
              WHERE l.ref_shipment_id = sj.id AND l.tipe = 'terima_kiriman')
     ORDER BY sj.updated_at
     LIMIT c_batas
  LOOP
    v_daftar := v_daftar || v_sj.id::text || ' ';

    IF p_dry_run THEN
      v_n := v_n + 1;
      CONTINUE;
    END IF;

    v_tgl_kirim := ((v_sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date);

    -- Cek apakah outlet sudah opname pada atau setelah tanggal kiriman
    SELECT EXISTS (
      SELECT 1 FROM public.opname o
       WHERE o.outlet_id = v_sj.outlet_id
         AND o.status = 'finalized'
         AND o.tanggal >= v_tgl_kirim
    ) INTO v_has_opname;

    IF v_has_opname THEN
      -- Barang fisik sudah terserap hitungan opname harian outlet.
      -- Tutup administratif tanpa menulis ledger agar tidak double count.
      UPDATE public.surat_jalan_item
         SET qty_terima = qty_dikirim
       WHERE surat_jalan_id = v_sj.id;

      UPDATE public.surat_jalan
         SET auto_verified_at = now(),
             ditutup_administratif_at = now(),
             status = 'diterima_lengkap',
             notes = COALESCE(NULLIF(notes, ''), '')
                     || ' [Auto-verif: fisik sudah terserap opname harian tanggal ' || v_tgl_kirim::text || ', ditutup tanpa menambah ledger]',
             updated_at = now()
       WHERE id = v_sj.id;
    ELSE
      -- Belum pernah opname sejak dikirim, tulis ledger stok secara sah
      UPDATE public.surat_jalan_item
         SET qty_terima = qty_dikirim
       WHERE surat_jalan_id = v_sj.id;

      UPDATE public.surat_jalan
         SET auto_verified_at = now(),
             updated_at = now()
       WHERE id = v_sj.id;

      PERFORM public.finalize_surat_jalan_and_ledger(v_sj.id);
    END IF;

    v_n := v_n + 1;
  END LOOP;

  -- Hitung yang terlewati
  SELECT count(*) INTO v_skip
    FROM public.surat_jalan sj
   WHERE sj.status = 'dikirim'
     AND sj.auto_verified_at IS NULL
     AND sj.ditutup_administratif_at IS NULL
     AND ((((sj.updated_at AT TIME ZONE 'Asia/Jakarta') + c_geser)::date)
          < (((now()        AT TIME ZONE 'Asia/Jakarta') + c_geser)::date))
     AND ((sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date) >= c_mulai;
  v_skip := GREATEST(v_skip - v_n, 0);

  RETURN QUERY SELECT v_n, v_skip, NULLIF(btrim(v_daftar), '');
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_verifikasi_surat_jalan(boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.auto_verifikasi_surat_jalan(boolean) TO service_role;
