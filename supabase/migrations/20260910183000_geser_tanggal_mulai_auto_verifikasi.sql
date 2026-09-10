-- 20260910183000_geser_tanggal_mulai_auto_verifikasi.sql
-- Menutup surat jalan yang sudah lewat harinya, dianggap diterima sesuai kirim.
--
-- PERUBAHAN DARI 20260910182000: tanggal mulai digeser 14 -> 11 September
-- (keputusan owner 2026-09-10, "geser aja jadi besok"). Sisa isi fungsi sama
-- persis; hanya konstanta c_mulai yang berubah.
--
-- Akibatnya untuk 13 SJ tanggal 10 September yang masih menggantung: mereka
-- berada DI LUAR aturan baru (dispatch 10 Sep < 11 Sep), jadi tidak akan
-- tersentuh fungsi ini. Itu disengaja -- outlet-outlet itu melakukan opname tiap
-- malam, sehingga besok pagi barangnya sudah terserap hitungan fisik dan
-- perlakuan yang benar bagi mereka justru penutupan administratif tanpa stok,
-- sama seperti 39 tunggakan sebelumnya.
--
-- MASALAH YANG DITUTUP
--   Separuh kiriman gudang->outlet tak pernah diverifikasi crew (Agustus
--   209/418, September 39/93). Gudang Pusat sudah didebit saat SJ ditandai
--   dikirim, tapi outlet tak pernah dikredit. Yang menambal selama ini opname --
--   sehingga opname berhenti berfungsi sebagai pemeriksa.
--
-- TENGGAT: LEWAT HARI (keputusan owner 2026-09-10)
--   Diukur dari surat_jalan_item.verified_at pada 216 SJ sejak 1 Agustus:
--   98% diverifikasi di hari yang sama, 2% besoknya, NOL lebih dari itu.
--   Kalau tidak diverifikasi hari itu, praktis tidak akan pernah.
--
-- HARI KIRIM BERAKHIR 21:00, BUKAN TENGAH MALAM
--   Owner: barang tiba di outlet paling lambat pukul 21:00. Kiriman yang
--   ditandai dikirim pukul 21:00 ke atas berarti barangnya baru jalan malam
--   itu -- outlet belum punya kesempatan sama sekali. Tanpa aturan ini, kiriman
--   21:10 Senin ditutup Selasa 02:00, cuma 5 jam kemudian, seluruhnya saat
--   outlet tutup. Terdampak 21 dari 524 SJ (4%).
--
--   Teknisnya: batas hari digeser dengan MENAMBAH 3 jam sebelum diambil
--   tanggalnya. Sen 21:10 + 3j = Sel 00:10 -> hari Selasa.
--                Sen 20:00 + 3j = Sen 23:00 -> hari Senin.
--
-- NOL PENULIS STOK BARU
--   Fungsi ini hanya mengisi qty_terima lalu memanggil
--   finalize_surat_jalan_and_ledger, yang sudah SECURITY DEFINER, sudah memakai
--   to_ledger_scale() (gram vs satuan besar), dan sudah menolak verifikasi
--   ganda. Sesi 9 September dihabiskan menutup bug salah konversi satuan di
--   fungsi pencatat stok -- jangan bikin jalur baru.
--
-- verified_at SENGAJA TIDAK DIISI
--   Kolom itu berarti "diverifikasi manusia" dan dipakai untuk mengukur
--   kebiasaan crew. Mengisinya di sini merusak pengukuran itu selamanya, dan
--   menghapus satu-satunya cara melihat apakah crew makin tidak memverifikasi.
--   Penanda auto_verified_at di tabel induk yang menandai penutupan sistem.
--
-- BERHENTI DI diterima_lengkap, TIDAK SAMPAI selesai
--   Alurnya dua tahap: outlet menerima (stok bertambah), lalu Pusat memvalidasi
--   & menutup jadi 'selesai' lewat tombol handleVerifyPusat. Fungsi ini hanya
--   menggantikan tahap 1. Kiriman yang ditutup sistem sengaja mengendap di
--   antrean validasi Pusat (role kitchen, keputusan owner) -- kalau ikut ditutup
--   sampai 'selesai', kiriman yang tak diperiksa siapa pun justru jadi
--   satu-satunya yang lolos tanpa mata manusia sama sekali.
--
-- Spec:  docs/superpowers/specs/2026-09-10-auto-verifikasi-surat-jalan-design.md
-- Plan:  docs/superpowers/plans/2026-09-10-auto-verifikasi-surat-jalan.md
-- Idempoten (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.auto_verifikasi_surat_jalan(
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE(diproses int, dilewati int, daftar text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  -- Forward-only. SJ sebelum tanggal ini TIDAK BOLEH tersentuh: barangnya sudah
  -- terserap opname, menambahkannya lagi = stok hantu ratusan juta.
  c_mulai  CONSTANT date     := DATE '2026-09-11';
  c_geser  CONSTANT interval := interval '3 hours';  -- batas hari -> 21:00 WIB
  c_batas  CONSTANT int      := 50;                  -- maksimal per jalan

  v_sj     RECORD;
  v_n      int  := 0;
  v_skip   int  := 0;
  v_daftar text := '';
BEGIN
  FOR v_sj IN
    SELECT sj.id
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

    UPDATE public.surat_jalan_item
       SET qty_terima = qty_dikirim
     WHERE surat_jalan_id = v_sj.id;

    UPDATE public.surat_jalan
       SET auto_verified_at = now()
     WHERE id = v_sj.id;

    PERFORM public.finalize_surat_jalan_and_ledger(v_sj.id);
    v_n := v_n + 1;
  END LOOP;

  -- Berapa yang sudah lewat hari tapi TIDAK diproses -- angka ini yang memberi
  -- tahu kalau ada yang mandek diam-diam karena kena penjaga.
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

-- service_role perlu EXECUTE supaya dry-run bisa dipanggil lewat PostgREST saat
-- pemeriksaan. pg_cron menjalankannya sebagai pemilik job, tak lewat sini.
GRANT EXECUTE ON FUNCTION public.auto_verifikasi_surat_jalan(boolean) TO service_role;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.auto_verifikasi_surat_jalan(boolean);
