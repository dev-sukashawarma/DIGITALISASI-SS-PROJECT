# Alert Telegram Bot HRD

Penerima hanya staf aktif dengan role database `admin_hr` (role yang disebut
`admin_hrd` dalam rancangan produk) atau `developer`, akses profil `hrd` di Agents SS, serta ID
Telegram tertaut. Owner, admin umum dan karyawan dengan role lain tidak menerima alert
ini. Pemeriksaan penerima dilakukan saat antre, sebelum kirim, dan di endpoint.

## Perilaku

- **Telat >15 menit:** satu alert per staf/outlet/tanggal WIB. Tepat 15 menit
  tidak memicu alert; 16 menit memicu. Menggunakan `attendance_harian.telat_menit`
  hasil mesin absensi yang sudah memperhitungkan shift/jadwal khusus. Batas 15
  menit tetap berlaku meskipun toleransi outlet lebih besar. Pesan memuat nama,
  outlet, tanggal, check-in tercatat dan menit telat, serta arahan konfirmasi HR.
  Edit/check-out tidak mengulang pesan. Data historis tidak di-backfill.
- **Rekap 09.00 WIB:** jumlah absensi tidak lengkap dan alfa kemarin, pengajuan
  izin/cuti pending lebih dari 24 jam, serta kontrak yang berakhir dalam 60 hari.
  Rekap tanpa temuan tidak dikirim. Rekap mengingatkan setiap hari selama temuan
  masih memenuhi kriteria. Alfa berasal dari mesin HR yang sudah ada, termasuk
  aturan libur dan izin; bot tidak menyimpulkan alfa hanya dari baris yang kosong.
- Temuan adalah bahan verifikasi HR. Bot tidak menegur karyawan, memberi sanksi,
  menyetujui izin atau mengubah payroll. Koreksi dan pencatatan tindak lanjut
  dilakukan melalui aplikasi HR. Tidak ada tombol aksi Telegram palsu.
- Tanggal akhir kontrak mengikuti layar HR saat ini: `outlet_staff.resign_date`,
  hanya untuk `contract_type='contract'`. Probation, dokumen kedaluwarsa, lembur,
  validasi payroll dan checklist lain belum termasuk implementasi ini.

## Aktivasi

1. Deploy app Bot dengan route `/api/telegram/hrd/send` dan runtime env server-only:
   - `TELEGRAM_HRD_BOT_TOKEN`: token bot profil Hermes `hrd`.
   - `TELEGRAM_HRD_SEND_SECRET`: secret khusus pengiriman HRD.
   - `SUPABASE_SERVICE_ROLE_KEY` dan `NEXT_PUBLIC_SUPABASE_URL` yang sudah dipakai.
2. Isi Supabase Vault melalui jalur pengelolaan secret:
   - `telegram_hrd_send_url`: `https://agents.sukashawarma.com/api/telegram/hrd/send`
   - `telegram_hrd_send_secret`: sama dengan `TELEGRAM_HRD_SEND_SECRET`.
   Jangan memakai token atau secret Stokist untuk HRD.
3. Terapkan migration `20300254002900_hrd_telegram_alerts.sql`, kemudian
   `20300254003100_hrd_developer_alert_recipients.sql` untuk menambahkan penerima
   developer. Jika migration awal sudah terpasang, cukup terapkan migration kedua.
   Membutuhkan skema
   HR terkini, registry/akses bot, `pg_net`, Vault dan `pg_cron` yang sudah dipakai
   alert Stokist. Jadwal cron mengasumsikan UTC, sesuai instalasi Supabase standar.
4. Pada Admin Dashboard → Sistem → Agents SS → Akses Bot Telegram, pilih `hrd`,
   beri akses ke staf HR dan developer yang sesuai, dan tautkan ID Telegramnya. Staf harus
   menekan `/start` pada Bot HRD agar bot dapat mengirim ke chat privat.

Hermes tetap menjadi penerima pesan Telegram; app Bot hanya mengirim alert.
Tidak diperlukan webhook atau poller Telegram baru. Fitur ini belum aktif hanya
dengan menambahkan file: deploy, migration, secret dan penerima harus tersedia.

## Antrean dan pemeriksaan

Worker tiap menit memproses maksimal 50 entri. Kegagalan dicoba ulang dengan
jarak minimal 15 menit, maksimal 3 percobaan. Tanpa Vault, antrean tetap pending.
Pencabutan akses membatalkan antrean, dan keterlambatan yang sudah dikoreksi
sebelum pengiriman dilewati. Timeout setelah Telegram menerima pesan masih dapat
menyebabkan duplikasi pada retry; Telegram sendMessage tidak menyediakan kunci
idempotensi. Semua tabel antrean privat, tanpa akses anon/authenticated.

Periksa dari koneksi administratif; hindari mengekspor body berisi data HR:

```sql
SELECT outcome, count(*), min(created_at) AS paling_lama
FROM public.bot_hrd_alert_outbox GROUP BY outcome;
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'bot-hrd-%';
```

Status `failed` memerlukan pemeriksaan konfigurasi/log endpoint. Baris selesai
disimpan 90 hari. Pengujian SQL terisolasi:

```sh
psql -v ON_ERROR_STOP=1 -d ss_hrd_alert_test -f supabase/verifikasi/hermes/t7_hrd_alerts.sql
```

Gunakan hanya PostgreSQL sementara dengan nama di atas. HTTP, Vault dan cron
di-stub; tidak mengirim Telegram atau menulis database operasional. Uji endpoint
dan pemeriksaan tipe: `yarn workspace @suka/bot test` dan
`yarn workspace @suka/bot type-check`.

Rollback pengiriman:

```sql
SELECT cron.unschedule('bot-hrd-delivery');
SELECT cron.unschedule('bot-hrd-daily');
DROP TRIGGER IF EXISTS trg_bot_hrd_telat ON public.attendance_harian;
```

Tabel antrean dapat dipertahankan untuk audit. Alert Stokist tetap terpisah.
