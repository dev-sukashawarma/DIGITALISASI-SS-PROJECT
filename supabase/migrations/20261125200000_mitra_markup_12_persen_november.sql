-- Markup HPP mitra turun 15% -> 12%, berlaku 1 November 2026.
--
-- Keputusan owner 2026-11-25, sumber "SS COGS OCT 2026 v2.2 12 persen.xlsx"
-- tab OFFLINE:
--   * sel P3  : MARKUP MITRA (dari OVERHEAD COST) = 0,12
--   * kolom I : COGS MITRA = kolom C (HPP + overhead 10%) x 1,12
--   * kolom C di file = angka hpp_override yang sudah live -> yang berubah HANYA
--     persen markup, HPP internal tidak disentuh.
--
-- Menggantikan 0,15 dari migration 20261111101413 (keputusan 11 Nov 2026).
-- Tanggal mulai tetap 1 Nov 2026, jadi seluruh November ikut 12%.
-- Berlaku untuk SEMUA outlet mitra, TERMASUK MITRA CILEUNGSI.
--
-- Riwayat markup mitra (jangan dibuka ulang tanpa keputusan owner baru):
--   sebelum 1 Okt 2026      : (HPP + OPEX) x 1,10
--   1 Okt - 31 Okt 2026     : (HPP + OPEX) x 1,00  (Cileungsi tetap x 1,10)
--   mulai 1 Nov 2026        : (HPP + OPEX) x 1,12  (semua mitra)
--
-- Kedua fungsi DI-PATCH TERARAH dari definisi hidupnya (pg_get_functiondef),
-- bukan ditulis ulang: get_mitra_item_hpp punya SET search_path dan
-- get_owner_dashboard_summary punya SET plan_cache_mode = force_custom_plan
-- (tanpa itu kena statement timeout 8 dtk). CREATE OR REPLACE polos akan
-- membuang setelan itu diam-diam. pg_get_functiondef ikut menuliskan klausa SET,
-- dan penjaga di bawah memastikannya tetap ada.
--
-- UTANG REPLAY: kedua fungsi juga didefinisikan migration bertimestamp 2030
-- yang terurut SETELAH berkas ini; replay dari nol menimpa balik. Produksi aman
-- setelah berkas ini terstempel.

DO $do$
DECLARE
  v_fn   text;
  v_lama int;
  v_def  text;
  v_new  text;
  v_n    int;
BEGIN
  FOR v_fn, v_lama IN
    SELECT * FROM (VALUES ('get_mitra_item_hpp', 1), ('get_owner_dashboard_summary', 2)) t(f, n)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fn;
    IF v_def IS NULL THEN
      RAISE EXCEPTION '% tidak ditemukan', v_fn;
    END IF;

    SELECT count(*) INTO v_n FROM regexp_matches(v_def, '\*\s*1\.15\)', 'g');

    -- Idempoten: sudah 1,12 dan tak ada sisa 1,15 -> lewati.
    IF v_n = 0 AND v_def ~ '\*\s*1\.12\)' THEN
      RAISE NOTICE '% sudah memakai markup 1,12 - dilewati', v_fn;
      CONTINUE;
    END IF;

    IF v_n <> v_lama THEN
      RAISE EXCEPTION '%: harap % kemunculan "* 1.15)", dapat %', v_fn, v_lama, v_n;
    END IF;

    -- Penjaga SET.
    IF v_def NOT LIKE '%search_path%' THEN
      RAISE EXCEPTION '%: definisi tanpa SET search_path - batal', v_fn;
    END IF;
    IF v_fn = 'get_owner_dashboard_summary' AND v_def NOT LIKE '%plan_cache_mode%' THEN
      RAISE EXCEPTION 'get_owner_dashboard_summary tanpa SET plan_cache_mode - batal';
    END IF;

    v_new := regexp_replace(v_def, '\*(\s*)1\.15\)', '*\11.12)', 'g');
    v_new := replace(v_new, 'x 1,15', 'x 1,12');

    -- Asersi.
    SELECT count(*) INTO v_n FROM regexp_matches(v_new, '1\.15', 'g');
    IF v_n <> 0 THEN RAISE EXCEPTION '%: masih ada % kemunculan 1.15', v_fn, v_n; END IF;
    SELECT count(*) INTO v_n FROM regexp_matches(v_new, '\*\s*1\.12\)', 'g');
    IF v_n <> v_lama THEN RAISE EXCEPTION '%: harap % kemunculan 1.12, dapat %', v_fn, v_lama, v_n; END IF;
    SELECT count(*) INTO v_n FROM regexp_matches(v_new, '2026-11-01', 'g');
    IF v_n <> v_lama THEN RAISE EXCEPTION '%: cabang 2026-11-01 harus %, dapat %', v_fn, v_lama, v_n; END IF;
    IF v_new NOT LIKE '%search_path%'
       OR (v_fn = 'get_owner_dashboard_summary' AND v_new NOT LIKE '%plan_cache_mode%') THEN
      RAISE EXCEPTION '%: penjaga SET hilang setelah patch - batal', v_fn;
    END IF;

    EXECUTE v_new;
    RAISE NOTICE '%: markup November 1,15 -> 1,12', v_fn;
  END LOOP;
END
$do$;
