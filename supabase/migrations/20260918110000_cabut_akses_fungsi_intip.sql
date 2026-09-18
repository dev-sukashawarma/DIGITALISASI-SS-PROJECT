-- Migration: 20260918110000_cabut_akses_fungsi_intip.sql
-- Tujuan: menutup C3 dari audit keamanan 2026-09-18.
--
-- MASALAH (dibuktikan lewat HTTP nyata memakai anon key, tanpa login):
--   Tiga fungsi SECURITY DEFINER bisa dipanggil siapa pun dari internet.
--   Kunci anon bersifat NEXT_PUBLIC_* sehingga ikut terkirim ke setiap
--   browser pengunjung -- "bisa dipanggil anon" = "bisa dipanggil publik".
--
--   1. get_table_policies(t_name text)
--      Membocorkan seluruh aturan RLS sebuah tabel. Saat diuji dengan
--      'payroll_records' ia mengembalikan policy asli lengkap dengan
--      "qual":"true" -- artinya penyerang tidak perlu menebak celah,
--      sistem menunjukkan sendiri pintu mana yang tidak dikunci.
--
--   2. get_func_source(func_name text)
--      Mengembalikan prosrc fungsi APA PUN. Tanpa filter skema, hanya
--      `WHERE proname = func_name LIMIT 1`. Rahasia apa pun yang tertanam
--      di badan sebuah fungsi ikut terbaca.
--
--   3. resolve_username(p_username text)
--      Membaca auth.users dari konteks anon = oracle enumerasi akun
--      (memastikan sebuah username ada sebelum menebak password).
--
-- KENAPA AMAN DICABUT:
--   Ketiganya NOL pemanggil. Diverifikasi ripgrep di seluruh repo
--   (*.ts/tsx/js/jsx/mjs/kt) dan di supabase/functions/. Khususnya
--   resolve_username: alur login apps/portal/src/app/page.tsx TIDAK
--   memakainya -- ia query outlet_staff lalu menyusun kandidat email di
--   sisi klien, jadi mencabut ini tidak memutus login siapa pun.
--
--   get_func_source & get_table_policies bahkan tidak punya file migration
--   sama sekali (dibuat ad-hoc langsung di DB), jadi tidak ada replay yang
--   akan menghidupkannya kembali.
--
-- CATATAN BENTUK PERBAIKAN:
--   Dipilih pencabutan izin, bukan DROP. Lebih mudah dikembalikan bila
--   ternyata ada alat internal tak terdokumentasi yang memakainya, dan
--   tetap menutup akses sepenuhnya. Kalau setelah beberapa waktu terbukti
--   benar-benar mati, ketiganya layak di-DROP di migration terpisah.
--
--   service_role sengaja TIDAK dicabut: itu kunci sisi server yang tidak
--   pernah dipegang browser, dan berguna untuk diagnosis.

-- 1. Oracle model keamanan
REVOKE ALL ON FUNCTION public.get_table_policies(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_table_policies(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_table_policies(text) FROM authenticated;

-- 2. Oracle kode sumber
REVOKE ALL ON FUNCTION public.get_func_source(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_func_source(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_func_source(text) FROM authenticated;

-- 3. Oracle enumerasi akun
REVOKE ALL ON FUNCTION public.resolve_username(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_username(text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_username(text) FROM authenticated;
