# 0003 — Kurikulum Pembelajaran Backend Selesai Disusun

**Tanggal:** 2026-07-23  
**Topik:** Penyusunan Semua Lesson (03-10) Kurikulum Belajar Backend  
**Status:** Selesai & Siap Diakses

## Rangkuman Penyusunan Materi

Seluruh modul pembelajaran backend pemeliharaan (Lessons 03-10) telah berhasil dibuat dan disimpan di folder `teach/lessons/` dengan visual premium yang interaktif:

1. **[Lesson 03 — Row Level Security (RLS)](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0003-rls-keamanan-dan-performa.html)**:
   - Keamanan multi-outlet, menghindari rekursi RLS, bedah mendalam fungsi `accessible_outlet_ids()`, dan caching dengan keyword `STABLE`.
2. **[Lesson 04 — Triggers & Cron Jobs](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0004-triggers-dan-cronjobs.html)**:
   - Otomasi data vs penjadwalan waktu, alur kerja `pg_cron` + `pg_net` untuk sinkronisasi POS sales ke Edge Functions, dan pelacakan log kegagalan via `cron.job_run_details`.
3. **[Lesson 05 — Edge Functions](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0005-edge-functions-dan-errors.html)**:
   - Deno runtime serverless, penanganan fenomena "Cold Starts", pembacaan log error, penanganan CORS, dan CLI deployment.
4. **[Lesson 06 — Realtime & WebSockets](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0006-realtime-dan-websockets.html)**:
   - Komunikasi dua arah WebSocket, filter payload di sisi client, pemahaman `REPLICA IDENTITY FULL` pada UPDATE & DELETE, serta limitasi kuota koneksi websocket.
5. **[Lesson 07 — Storage & Bucket Security](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0007-storage-dan-bucket-policies.html)**:
   - Perbedaan Public vs Private buckets, penulisan policy untuk `storage.objects`, cara menggunakan Signed URL, dan trik kompresi gambar sebelum upload untuk hemat kuota.
6. **[Lesson 08 — Connection Pooling](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0008-connection-pooling.html)**:
   - Mengatasi connection churn, port 5432 (direct) vs 6543 (pooler Supavisor), perbedaan Transaction mode vs Session mode, dan setup `.env.local` yang tepat.
7. **[Lesson 09 — Migration Hygiene](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0009-migration-hygiene.html)**:
   - Aturan Emas Additive Migrations, penulisan SQL idempotent defensif (`IF NOT EXISTS`), dan command `supabase migration repair` untuk meluruskan status diverged history.
8. **[Lesson 10 — Incident Response](file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/teach/lessons/0010-incident-response.html)**:
   - Protokol 4 langkah pemulihan sistem down, isolasi cPanel Next.js vs Supabase DB, cara restore darurat Point-in-Time Recovery (PITR), dan penyusunan laporan Post-Mortem.

## Dampak & Hasil Belajar
- User sekarang memiliki aset belajar interaktif lengkap yang disesuaikan secara khusus dengan arsitektur kode riil dari Suka Shawarma Digital Suite.
- Seluruh modul dilengkapi quiz evaluasi mandiri langsung yang bisa dikerjakan di browser.
