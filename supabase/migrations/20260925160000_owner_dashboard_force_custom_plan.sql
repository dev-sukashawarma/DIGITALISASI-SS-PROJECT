-- ============================================================
-- Ringkasan Bisnis (/dashboard/owner) timeout 500 — akar masalah di plan cache
--
-- get_owner_dashboard_summary adalah fungsi PL/pgSQL. Query di dalamnya
-- di-cache per koneksi; setelah ±5 kali dipanggil, Postgres boleh beralih ke
-- "generic plan" yang dibuat TANPA tahu nilai p_from/p_to. Koneksi PostgREST
-- dipakai bergantian (pool), jadi sebagian koneksi memakai rencana bagus dan
-- sebagian rencana buruk — itu sebabnya halaman kadang cepat, kadang 500.
--
-- Diukur 2026-09-25 lewat exec_sql, parameter persis seperti aplikasi:
--   rentang   | plan_cache_mode = auto | force_custom_plan
--   7 hari    | timeout (>8 dtk) 3/3   | 0,28–0,44 dtk
--   24 hari   | timeout (>8 dtk) 2/2   | 0,50–0,55 dtk
--
-- Perbaikan: paksa fungsi INI selalu memakai rencana khusus per nilai
-- parameter. Biaya perencanaan ±beberapa ms per panggilan — jauh lebih kecil
-- dari rencana buruk. Tidak mengubah hasil, hak akses, atau fungsi lain.
--
-- ⚠️ CREATE OR REPLACE FUNCTION membuang opsi SET yang ditambahkan lewat
-- ALTER. Definisi terbaru fungsi ini ada di
-- 20260925152000_owner_summary_hpp_per_tanggal.sql (berkas ini sengaja
-- bertimestamp SESUDAHNYA). Siapa pun yang menulis ulang fungsi ini WAJIB
-- menyertakan `SET plan_cache_mode = force_custom_plan` di definisinya.
-- Catatan replay dari nol: 20300116000000_optimize_owner_dashboard_summary.sql
-- (ranjau timestamp 2030) jalan paling akhir dan akan menghapus setelan ini;
-- produksi aman karena semuanya sudah terstempel.
-- ============================================================

ALTER FUNCTION public.get_owner_dashboard_summary(timestamptz, timestamptz, uuid, text, uuid)
  SET plan_cache_mode = force_custom_plan;
