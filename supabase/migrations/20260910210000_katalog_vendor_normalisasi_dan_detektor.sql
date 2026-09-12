-- 20260910210000_katalog_vendor_normalisasi_dan_detektor.sql
--
-- Dua hal, keduanya fondasi multi-vendor (bukan penanganan kasus FOIL):
--   (3) Normalisasi penulisan `satuan_beli` di katalog vendor.
--   (1) Detektor konflik spesifikasi antar-vendor untuk bahan yang sama.
--
-- ============================================================================
-- ATURAN FUNDAMENTAL YANG DITEGAKKAN DI SINI
-- ============================================================================
--
--   Vendor adalah atribut PEMBELIAN, bukan identitas BARANG.
--   Satu-satunya hal yang memaksa sebuah bahan dipecah: ISI SATUAN-BELI
--   yang berbeda antar vendor.
--
-- Ini batas teknis, bukan preferensi. Stok disimpan dalam satuan terkecil, dan
-- jembatan satuan-besar -> satuan-kecil (`faktor_konversi`/`faktor_tampilan`)
-- adalah kolom PER-BAHAN. Dua nilai berbeda tidak muat di satu kolom.
--
-- Harga beda, termin beda, merek beda -- TIDAK memaksa pemisahan.
--
-- Bukti lapangan (2026-09-10): dari 15 bahan multi-vendor, hanya FOIL yang
-- isinya berbeda (Ekadharma 760 cm/roll vs Altindo 500 cm/roll). Empat belas
-- sisanya berjalan tanpa masalah. Kekacauan FOIL bukan karena dua ukuran itu
-- ada, tapi karena baru ketahuan SETELAH bercampur di rak.
--
-- ============================================================================
-- (3) NORMALISASI `satuan_beli`
-- ============================================================================
--
-- Sekarang tercampur: 'bal'/'Bal', 'dus'/'Dus', 'kg'/'Kg', 'pack'/'Pack'.
-- Bentuk kanonik = huruf kecil + trim, MENGIKUTI `canon()` yang sudah dipakai
-- apps/admin-dashboard/src/lib/satuanPo.ts -- supaya data dan kode sepakat,
-- bukan supaya cantik.
--
-- ⚠️ KATANYA TIDAK DIUBAH, hanya penulisannya. `satuan_beli` SAH berbeda dari
--    `bahan_baku.satuan`: FOIL dibeli per 'roll' sedangkan masternya 'Dus'.
--    Menyamakannya ke master akan merusak arti kolom ini.
--
-- Efek tampilan: Katalog Harga Vendor akan menampilkan huruf kecil. Kalau mau
-- rapi, kapitalkan di lapisan tampilan -- jangan di data.

UPDATE public.bahan_baku_supplier
   SET satuan_beli = lower(btrim(satuan_beli))
 WHERE satuan_beli IS DISTINCT FROM lower(btrim(satuan_beli));

-- Jaga supaya baris baru tetap kanonik. Tanpa ini, normalisasi sekali jalan
-- akan luntur pada input berikutnya dan detektor di bawah ikut rapuh.
CREATE OR REPLACE FUNCTION public.bbs_normalisasi_satuan()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.satuan_beli := NULLIF(lower(btrim(NEW.satuan_beli)), '');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bbs_normalisasi_satuan ON public.bahan_baku_supplier;
CREATE TRIGGER trg_bbs_normalisasi_satuan
  BEFORE INSERT OR UPDATE OF satuan_beli ON public.bahan_baku_supplier
  FOR EACH ROW EXECUTE FUNCTION public.bbs_normalisasi_satuan();

-- ============================================================================
-- (1) DETEKTOR KONFLIK SPESIFIKASI
-- ============================================================================
--
-- Menyala SEBELUM barangnya masuk gudang -- itu seluruh gunanya. Begitu dua
-- ukuran bercampur di rak, memisahkannya mundur nyaris mustahil (pelajaran
-- FOIL: 17 outlet minus, 42 baris ledger berpasangan untuk memulihkan).
--
-- `tingkat`:
--   'konflik_isi'    -> WAJIB dipecah per spesifikasi sebelum barang masuk
--   'beda_satuan'    -> kata satuan beli berbeda; belum tentu salah (mis. satu
--                       vendor jual per roll, satu per dus) tapi WAJIB dilihat,
--                       karena isi yang sama dengan satuan berbeda hampir pasti
--                       salah input
--   'aman'           -> multi-vendor sehat, tidak perlu tindakan
--
-- security_invoker: RLS `bbs_select` tetap berlaku bagi pembaca. Tanpa ini,
-- view berjalan sebagai pemilik dan membocorkan katalog ke siapa pun yang bisa
-- SELECT view-nya.

CREATE OR REPLACE VIEW public.vendor_konflik_spesifikasi
WITH (security_invoker = true) AS
WITH agg AS (
  SELECT
    bs.bahan_baku_id,
    count(*)                                    AS n_vendor,
    count(DISTINCT bs.isi_satuan_kecil)         AS ragam_isi,
    count(DISTINCT lower(btrim(bs.satuan_beli))) AS ragam_satuan,
    string_agg(
      s.nama || ': ' || coalesce(bs.satuan_beli, '?')
             || ' isi ' || coalesce(bs.isi_satuan_kecil::text, '?'),
      ' | ' ORDER BY s.nama
    )                                           AS rincian
  FROM public.bahan_baku_supplier bs
  JOIN public.supplier s ON s.id = bs.supplier_id
  WHERE bs.is_active
  GROUP BY bs.bahan_baku_id
  HAVING count(*) > 1
)
SELECT
  a.bahan_baku_id,
  b.nama            AS bahan,
  b.is_active       AS bahan_aktif,
  a.n_vendor,
  a.ragam_isi,
  a.ragam_satuan,
  CASE
    WHEN a.ragam_isi    > 1 THEN 'konflik_isi'
    WHEN a.ragam_satuan > 1 THEN 'beda_satuan'
    ELSE 'aman'
  END               AS tingkat,
  a.rincian
FROM agg a
JOIN public.bahan_baku b ON b.id = a.bahan_baku_id;

COMMENT ON VIEW public.vendor_konflik_spesifikasi IS
  'Deteksi dini bahan multi-vendor yang isi satuan-belinya berbeda. '
  'tingkat=konflik_isi WAJIB dipecah per spesifikasi SEBELUM barang masuk '
  'gudang -- vendor tidak pernah jadi identitas barang, spesifikasi iya. '
  'Lihat docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md.';

REVOKE ALL ON public.vendor_konflik_spesifikasi FROM PUBLIC, anon;
GRANT SELECT ON public.vendor_konflik_spesifikasi TO authenticated, service_role;

-- ============================================================================
-- ASERSI
-- ============================================================================
DO $$
DECLARE
  v_sisa    int;
  v_konflik int;
  v_aman    int;
BEGIN
  SELECT count(*) INTO v_sisa FROM public.bahan_baku_supplier
   WHERE satuan_beli IS DISTINCT FROM lower(btrim(satuan_beli));
  IF v_sisa > 0 THEN
    RAISE EXCEPTION 'Masih ada % baris satuan_beli belum kanonik', v_sisa;
  END IF;

  -- FOIL harus terdeteksi: kalau tidak, detektornya tidak bekerja.
  SELECT count(*) INTO v_konflik
    FROM public.vendor_konflik_spesifikasi WHERE tingkat = 'konflik_isi';
  IF v_konflik = 0 THEN
    RAISE EXCEPTION 'Detektor tidak menemukan satu konflik pun -- FOIL seharusnya kena';
  END IF;

  -- Kontrol positif: bahan multi-vendor yang sehat harus tetap terbaca 'aman',
  -- bukan ikut ditandai. Detektor yang menandai semuanya sama tak bergunanya
  -- dengan yang tidak menandai apa pun.
  SELECT count(*) INTO v_aman
    FROM public.vendor_konflik_spesifikasi WHERE tingkat = 'aman';
  IF v_aman = 0 THEN
    RAISE EXCEPTION 'Nol bahan berstatus aman -- detektor menandai semuanya';
  END IF;
END $$;

-- DOWN:
-- DROP VIEW IF EXISTS public.vendor_konflik_spesifikasi;
-- DROP TRIGGER IF EXISTS trg_bbs_normalisasi_satuan ON public.bahan_baku_supplier;
-- DROP FUNCTION IF EXISTS public.bbs_normalisasi_satuan();
-- (normalisasi satuan_beli tidak dipulihkan: penulisan lama tak dicatat, dan
--  perbedaannya murni kapitalisasi)
