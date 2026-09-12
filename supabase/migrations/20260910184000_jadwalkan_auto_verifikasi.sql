-- 20260910184000_jadwalkan_auto_verifikasi.sql
-- Jadwalkan auto_verifikasi_surat_jalan sekali sehari.
--
-- ⚠️ pg_cron MENJADWAL DALAM UTC.
--   Owner minta ditutup dini hari, 02:00 WIB.
--   02:00 WIB = 19:00 UTC HARI SEBELUMNYA.
--   '0 19 * * *' menjalankan job pukul 19:00 UTC, yang di Jakarta sudah pukul
--   02:00 keesokan harinya. Salah pasang di sini menggeser tenggat 7 jam tanpa
--   gejala apa pun -- karena itu jadwalnya diverifikasi setelah dipasang.
--
-- Jalan pertama: 10 September 19:00 UTC = 11 September 02:00 WIB. Saat itu
-- belum ada SJ ber-dispatch >= 11 September, jadi hasil jalan pertama nol.
-- Yang benar-benar diproses baru jalan berikutnya (12 Sep 02:00 WIB), untuk
-- kiriman tanggal 11.
--
-- Idempoten: unschedule dulu kalau namanya sudah terdaftar.

SELECT cron.unschedule('auto-verifikasi-surat-jalan')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-verifikasi-surat-jalan');

SELECT cron.schedule(
  'auto-verifikasi-surat-jalan',
  '0 19 * * *',                                   -- 19:00 UTC = 02:00 WIB besoknya
  $$SELECT public.auto_verifikasi_surat_jalan();$$
);

-- DOWN:
-- SELECT cron.unschedule('auto-verifikasi-surat-jalan');
