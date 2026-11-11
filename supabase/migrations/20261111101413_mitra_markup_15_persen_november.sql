-- Markup HPP mitra naik 10% -> 15%, berlaku 1 November 2026.
--
-- Keputusan owner 2026-11-11, sumber "HPP NOVEMBER.xlsx" tab OFFLINE:
--   * sel P3  : MARKUP MITRA (dari HPP + OPEX) = 0,15  "FIXED"
--   * kolom I : HPP MITRA = kolom C (HPP + OPEX) x 1,15
--   * kolom M : PROFIT HPP = kolom I - kolom C          (= base x 0,15)
--
-- Berlaku untuk SEMUA outlet mitra, TERMASUK MITRA CILEUNGSI
-- (62a56103-2085-4dd5-9d25-a3c0cffc88ff). Pengecualian x1,10 milik Cileungsi
-- berakhir 31 Oktober 2026 dan sengaja TIDAK diteruskan -- owner meminta seragam.
--
-- Riwayat markup mitra (jangan dibuka ulang tanpa keputusan owner baru):
--   sebelum 1 Okt 2026      : (HPP + OPEX) x 1,10
--   1 Okt - 31 Okt 2026     : (HPP + OPEX) x 1,00  (Cileungsi tetap x 1,10)
--   mulai 1 Nov 2026        : (HPP + OPEX) x 1,15  (semua mitra)
--
-- Agustus, September, dan Oktober 2026 WAJIB nol bergeser. Cabang lama
-- dipertahankan apa adanya; yang ditambahkan hanya cabang ">= 2026-11-01"
-- di posisi paling atas.
--
-- UTANG REPLAY (preseden repo 2026-09-07 & 2026-09-09): kedua fungsi di bawah
-- JUGA didefinisikan oleh migration bertimestamp 2030 --
-- get_mitra_item_hpp       -> 20300113000000, 20300125000000
-- get_owner_dashboard_summary -> 20300116000000, 20300250000000
-- Pada replay dari nol, berkas-berkas itu terurut SETELAH berkas ini dan akan
-- menimpa balik perubahan ini. Produksi aman karena semuanya sudah terstempel.
-- Timestamp 2030 TIDAK dipakai di sini karena scripts/migration-timestamp-lint.mjs
-- menolak timestamp jauh ke depan.

-- 1) Fungsi utama HPP mitra -------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp(
  p_menu_item_id uuid,
  p_channel text,
  p_tanggal date DEFAULT NULL::date,
  p_outlet_id uuid DEFAULT NULL::uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_tgl date := COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_base numeric;
  v_raw numeric;
BEGIN
  -- Mulai 1 Nov 2026: seragam (HPP + OPEX) x 1,15 untuk semua mitra.
  -- Dicek PALING AWAL supaya Cileungsi ikut, tetapi hanya sejak 1 Nov.
  IF v_tgl >= DATE '2026-11-01' THEN
    v_base := public.get_mitra_item_hpp_base(p_menu_item_id, p_channel, v_tgl);
    IF v_base > 0 THEN
      RETURN round(v_base * 1.15);
    END IF;
    RETURN 0;
  END IF;

  IF v_tgl < DATE '2026-10-01'
     OR p_outlet_id = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'::uuid
  THEN
    v_base := public.get_mitra_item_hpp_base(p_menu_item_id, p_channel, v_tgl);
    IF v_base > 0 THEN
      RETURN round(v_base * 1.10);
    END IF;
    RETURN 0;
  END IF;

  v_raw := public._get_mitra_item_hpp_raw(p_menu_item_id, p_channel, v_tgl);
  IF v_raw > 0 THEN
    RETURN round(v_raw);
  END IF;
  RETURN 0;
END;
$function$;

-- 2) get_owner_dashboard_summary: markup di-inline, bukan lewat fungsi di atas.
--    Fungsinya ~14 KB dan memuat dua penjaga yang wajib bertahan
--    (SET search_path=public, SET plan_cache_mode=force_custom_plan -- tanpa yang
--    kedua fungsi ini kena statement timeout 8 dtk di koneksi pool PostgREST).
--    Karena itu ia DI-PATCH TERARAH dari definisi hidupnya, bukan disalin ulang:
--    menyalin 14 KB berisiko menjatuhkan salah satu penjaga itu secara diam-diam.
DO $do$
DECLARE
  c_pola_cogs   constant text :=
    '(WHEN\s+ib\.local_date\s*<\s*DATE\s*''2026-10-01''\s+OR\s+ib\.outlet_id\s*=\s*''62a56103-2085-4dd5-9d25-a3c0cffc88ff''::uuid\s+THEN\s+ROUND\(ib\.base_hpp\s*\*\s*1\.1\))';
  c_pola_markup constant text :=
    '(WHEN\s+ib\.local_date\s*<\s*DATE\s*''2026-10-01''\s+OR\s+ib\.outlet_id\s*=\s*''62a56103-2085-4dd5-9d25-a3c0cffc88ff''::uuid\s+THEN\s+\(ROUND\(ib\.base_hpp\s*\*\s*1\.1\)\s*-\s*ib\.base_hpp\))';
  v_def text;
  v_new text;
  v_n   int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_owner_dashboard_summary';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'get_owner_dashboard_summary tidak ditemukan';
  END IF;

  -- Idempoten: kalau cabang November sudah ada, jangan sisipkan lagi.
  IF v_def LIKE '%1.15%' THEN
    RAISE NOTICE 'get_owner_dashboard_summary sudah memuat markup 1,15 - dilewati';
    RETURN;
  END IF;

  -- Penjaga: kedua SET wajib ada di definisi yang akan dieksekusi ulang.
  IF v_def NOT LIKE '%plan_cache_mode%' THEN
    RAISE EXCEPTION 'definisi kehilangan SET plan_cache_mode - batal (lihat Session 2026-09-25/26)';
  END IF;
  IF v_def NOT LIKE '%search_path%' THEN
    RAISE EXCEPTION 'definisi kehilangan SET search_path - batal';
  END IF;

  -- Penjaga: kedua pola lama harus ada tepat satu kali masing-masing.
  SELECT count(*) INTO v_n FROM regexp_matches(v_def, c_pola_cogs, 'g');
  IF v_n <> 1 THEN RAISE EXCEPTION 'pola item_cogs ditemukan % kali (harap 1)', v_n; END IF;
  SELECT count(*) INTO v_n FROM regexp_matches(v_def, c_pola_markup, 'g');
  IF v_n <> 1 THEN RAISE EXCEPTION 'pola item_markup ditemukan % kali (harap 1)', v_n; END IF;

  -- Sisipkan cabang November DI DEPAN cabang lama (urutan CASE menentukan).
  v_new := regexp_replace(v_def, c_pola_cogs,
    'WHEN ib.local_date >= DATE ''2026-11-01'' THEN ROUND(ib.base_hpp * 1.15) \1', 'g');
  v_new := regexp_replace(v_new, c_pola_markup,
    'WHEN ib.local_date >= DATE ''2026-11-01'' THEN (ROUND(ib.base_hpp * 1.15) - ib.base_hpp) \1', 'g');

  -- Asersi: tepat 2 cabang baru, cabang lama utuh, penjaga masih ada.
  SELECT count(*) INTO v_n FROM regexp_matches(v_new, '1\.15', 'g');
  IF v_n <> 2 THEN RAISE EXCEPTION 'harap 2 kemunculan 1.15, dapat %', v_n; END IF;
  SELECT count(*) INTO v_n FROM regexp_matches(v_new, '2026-11-01', 'g');
  IF v_n <> 2 THEN RAISE EXCEPTION 'harap 2 cabang 2026-11-01, dapat %', v_n; END IF;
  SELECT count(*) INTO v_n FROM regexp_matches(v_new, 'ROUND\(ib\.base_hpp \* 1\.1\)', 'g');
  IF v_n <> 2 THEN RAISE EXCEPTION 'cabang lama 1.1 harus tetap 2, dapat %', v_n; END IF;
  IF v_new NOT LIKE '%plan_cache_mode%' OR v_new NOT LIKE '%search_path%' THEN
    RAISE EXCEPTION 'penjaga SET hilang setelah patch - batal';
  END IF;

  EXECUTE v_new;
  RAISE NOTICE 'get_owner_dashboard_summary: 2 cabang markup November disisipkan';
END
$do$;
