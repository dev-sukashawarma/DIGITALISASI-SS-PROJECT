-- Pemantau pelacakan driver. Jalankan satu kueri per giliran.

-- Q1 perjalanan berjalan > 12 jam (harus 0 — tutup otomatis 15 mnt sekali)
SELECT id, driver_id, berangkat_at FROM driver_perjalanan
 WHERE status = 'berjalan' AND berangkat_at < now() - interval '12 hours';

-- Q2 stop menunggu milik perjalanan yang sudah tertutup (harus 0)
SELECT s.id, s.surat_jalan_id, p.status FROM driver_perjalanan_stop s
  JOIN driver_perjalanan p ON p.id = s.perjalanan_id
 WHERE s.status = 'menunggu' AND p.status <> 'berjalan';

-- Q3 porsi SJ dikirim 7 hari terakhir yang tidak dilacak
SELECT count(*) FILTER (WHERE s.id IS NULL) AS tidak_dilacak, count(*) AS total
  FROM surat_jalan sj
  LEFT JOIN driver_perjalanan_stop s ON s.surat_jalan_id = sj.id AND s.status <> 'dibatalkan'
 WHERE sj.status NOT IN ('draft','dibatalkan') AND sj.created_at >= now() - interval '7 days';

-- Q4 tiba yang ditekan > 500 m dari outlet, 7 hari terakhir
SELECT s.tiba_at, o.name, s.tiba_jarak_m FROM driver_perjalanan_stop s
  JOIN outlets o ON o.id = s.outlet_id
 WHERE s.tiba_sumber = 'driver' AND s.tiba_jarak_m > 500 AND s.tiba_at >= now() - interval '7 days'
 ORDER BY s.tiba_jarak_m DESC;

-- Q5 jejak melewati retensi (harus 0)
SELECT count(*) FROM driver_lokasi_jejak
 WHERE direkam_at < now() - make_interval(days => (_pelacakan_pengaturan()->>'retensi_hari')::int + 1);

-- Q6 jalannya cron
SELECT j.jobname, d.status, d.start_time FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
 WHERE j.jobname IN ('driver-tutup-perjalanan','driver-retensi-jejak') ORDER BY d.start_time DESC LIMIT 10;
