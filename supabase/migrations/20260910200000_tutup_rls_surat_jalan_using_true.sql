-- 20260910200000_tutup_rls_surat_jalan_using_true.sql
--
-- Menutup lubang RLS pada surat_jalan & surat_jalan_item, dan mencabut akses
-- anon dari fungsi penulis stok finalize_surat_jalan_and_ledger.
--
-- ============================================================================
-- TEMUAN (diverifikasi ground-truth 2026-09-10, bukan dari nama policy)
-- ============================================================================
--
-- 1. Dua policy PERMISSIVE bernama "..._all" berlaku untuk cmd = ALL, role
--    {public}, dengan qual = true DAN with_check = true:
--
--      surat_jalan_all            ALL  public  USING(true)  WITH CHECK(true)
--      surat_jalan_item_all       ALL  public  USING(true)  WITH CHECK(true)
--
--    Policy PERMISSIVE di-OR-kan. Jadi keempat policy ber-scope di kedua tabel
--    -- surat_jalan_update_scoped, surat_jalan_insert_scoped, sj_item_update,
--    surat_jalan_item_update_scoped -- SELURUHNYA DEKORATIF. Ekspresinya benar,
--    tapi tak pernah menentukan apa pun karena selalu ada policy true di
--    sebelahnya yang mengizinkan lebih dulu.
--
-- 2. Grant tabel terbuka sampai ke anon (has_table_privilege, terverifikasi):
--      anon UPDATE surat_jalan       = true
--      anon UPDATE surat_jalan_item  = true
--    Digabung dengan (1): pemegang anon key -- yang ADA DI SETIAP BUNDEL
--    BROWSER, bukan rahasia -- bisa mengubah qty_terima SJ outlet mana pun.
--
-- 3. finalize_surat_jalan_and_ledger (SECURITY DEFINER, penulis ledger_stok)
--    di-GRANT EXECUTE ke PUBLIC dan anon. Fungsinya NOL cek role dan tidak
--    pernah menyentuh auth.uid(); satu-satunya penjaganya cek status.
--    Dibuktikan terjangkau: panggilan anon lewat PostgREST membalas
--    "Surat jalan not found" -- pesan itu berasal DARI DALAM badan fungsi,
--    bukan permission denied. Jadi dengan UUID nyata, fungsinya benar-benar
--    jalan.
--
--    Dampak terburuk bukan cuma stok palsu. Memanggilnya pada SJ 'dikirim'
--    yang qty_terima-nya masih NULL akan MENUTUP SJ itu ke 'diterima_lengkap'
--    TANPA menulis satu baris ledger pun -- dan fungsinya menolak verifikasi
--    ulang. Kiriman itu kehilangan haknya atas stok secara permanen, persis
--    penyakit yang baru saja dibereskan sesi 2026-09-10.
--
-- ============================================================================
-- KENAPA AMAN DICABUT
-- ============================================================================
--
-- Policy ber-scope yang tersisa sudah menutup seluruh alur nyata:
--   * crew outlet memverifikasi kirimannya sendiri -> sj_item_update
--     (outlet sendiri, hanya saat status = 'dikirim')
--   * kitchen/admin/owner/spv lintas outlet          -> *_update_scoped
--     (accessible_outlet_ids())
--   * pembuatan SJ                                    -> *_insert_scoped
--     (kitchen/admin/owner/purchasing)
--   * finalize_surat_jalan_and_ledger & create_surat_jalan SECURITY DEFINER,
--     jadi tak terpengaruh RLS sama sekali.
--
-- DELETE: setelah policy ALL dicabut, tak ada policy DELETE tersisa, jadi
-- DELETE tertutup untuk semua orang. Itu DISENGAJA dan tidak menghapus fitur:
-- disisir seluruh apps/*, NOL pemanggilan .delete() terhadap surat_jalan
-- maupun surat_jalan_item.
--
-- anon tidak punya alur sah apa pun di sini: /distribusi/terima/[id] (halaman
-- QR penerimaan) TIDAK dikecualikan matcher middleware distribusi, jadi tetap
-- lewat enforceAppAccess -- wajib login.
--
-- ledger_stok SENGAJA TIDAK DISENTUH: tabel itu sudah benar (hanya punya
-- policy SELECT + INSERT ber-scope, nol policy UPDATE/DELETE) dan justru jadi
-- kontrol pembanding yang membuktikan pola ini bisa dilakukan benar di repo ini.
--
-- Idempoten: IF EXISTS + REVOKE berulang tidak berefek samping.

BEGIN;

-- (1) Cabut dua policy USING(true).
DROP POLICY IF EXISTS surat_jalan_all      ON public.surat_jalan;
DROP POLICY IF EXISTS surat_jalan_item_all ON public.surat_jalan_item;

-- (2) anon tidak punya urusan menulis di kedua tabel ini.
REVOKE INSERT, UPDATE, DELETE ON public.surat_jalan      FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.surat_jalan_item FROM anon;

-- (3) Penulis stok tidak boleh dipanggil pemegang anon key.
--     authenticated tetap dipertahankan: itulah jalur verifikasi crew yang sah.
REVOKE EXECUTE ON FUNCTION public.finalize_surat_jalan_and_ledger(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_surat_jalan_and_ledger(uuid)
  TO authenticated, service_role;

-- (4) Asersi: gagalkan transaksi kalau lubangnya ternyata belum tertutup.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE tablename IN ('surat_jalan','surat_jalan_item')
                AND qual = 'true') THEN
    RAISE EXCEPTION 'Masih ada policy USING(true) tersisa';
  END IF;

  IF has_function_privilege('anon',
       'public.finalize_surat_jalan_and_ledger(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon masih bisa EXECUTE finalize_surat_jalan_and_ledger';
  END IF;

  IF has_table_privilege('anon','public.surat_jalan_item','UPDATE') THEN
    RAISE EXCEPTION 'anon masih bisa UPDATE surat_jalan_item';
  END IF;

  -- Kontrol positif: alur sah tidak boleh ikut mati.
  IF NOT has_function_privilege('authenticated',
       'public.finalize_surat_jalan_and_ledger(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated kehilangan EXECUTE -- verifikasi crew mati';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE tablename = 'surat_jalan_item'
                    AND policyname = 'sj_item_update') THEN
    RAISE EXCEPTION 'policy verifikasi crew hilang';
  END IF;
END $$;

COMMIT;

-- DOWN (memulihkan lubangnya -- hanya untuk rollback darurat):
-- CREATE POLICY surat_jalan_all ON public.surat_jalan
--   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY surat_jalan_item_all ON public.surat_jalan_item
--   FOR ALL USING (true) WITH CHECK (true);
-- GRANT INSERT, UPDATE, DELETE ON public.surat_jalan, public.surat_jalan_item TO anon;
-- GRANT EXECUTE ON FUNCTION public.finalize_surat_jalan_and_ledger(uuid) TO anon;
