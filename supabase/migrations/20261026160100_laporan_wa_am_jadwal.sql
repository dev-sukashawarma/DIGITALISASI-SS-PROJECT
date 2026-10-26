-- 20261026160100_laporan_wa_am_jadwal.sql
--
-- Jadwal laporan WA untuk Area Manager (fungsi di 20261026160000_laporan_wa_am).
-- pg_cron berjalan dalam UTC:
--   14:30 UTC = 21:30 WIB  status opname (progres)
--   15:30 UTC = 22:30 WIB  status opname (cut-off, hanya AM yang belum lengkap)
--   01:00 UTC = 08:00 WIB  reminder setor tunai (omzet kemarin)
--   tiap menit            kirim antrean ke GOWA

SELECT cron.schedule('wa-am-opname-progres', '30 14 * * *',
  $$SELECT public.wa_am_susun_status_opname(false);$$);
SELECT cron.schedule('wa-am-opname-cutoff', '30 15 * * *',
  $$SELECT public.wa_am_susun_status_opname(true);$$);
SELECT cron.schedule('wa-am-setor-tunai', '0 1 * * *',
  $$SELECT public.wa_am_susun_reminder_setor();$$);
SELECT cron.schedule('wa-am-kirim', '* * * * *',
  $$SELECT public.wa_am_kirim_antrean();$$);
