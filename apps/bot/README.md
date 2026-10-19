# apps/bot — Webapp Bot Suka Shawarma (`agents.sukashawarma.com`)

> Spec: `docs/superpowers/specs/2026-10-07-webapp-bot-design.md` · Plan:
> `docs/superpowers/plans/2026-10-07-webapp-bot.md`.

## Menjalankan di lokal

```bash
yarn workspace @suka/bot dev     # http://localhost:3050 (login lewat portal lokal :3010)
yarn workspace @suka/bot test
yarn workspace @suka/bot type-check
```

`apps/bot/.env.local` (tidak di-commit):

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sama dengan app lain |
| `NEXT_PUBLIC_COOKIE_DOMAIN`, `NEXT_PUBLIC_PORTAL_URL` | SSO (produksi: `.sukashawarma.com`, `https://app.sukashawarma.com`) |
| `SUPABASE_JWT_SECRET` | verifikasi sesi lokal cepat (server-only) |
| `HERMES_API_URL` | API server Hermes, mis. `http://<IP gateway Docker Coolify>:8643` (server-only) |
| `HERMES_KEYS` | JSON `{"ceo":"<key>","stokis":"<API_SERVER_KEY profil stokis>"}` — satu env untuk semua agen; restart setelah perubahan. Server-only. |
| `TELEGRAM_STOKIST_BOT_TOKEN` | Token bot Stokist untuk mengirim alert dan kode pengaitan Telegram. Token yang sama dipasang di profil Hermes `stokis` untuk menerima chat. |
| `TELEGRAM_STOKIST_SEND_SECRET` | Secret antarlayanan untuk endpoint `/api/telegram/send` |
| `TELEGRAM_STOKIST_LOGIN_CLIENT_ID`, `TELEGRAM_STOKIST_LOGIN_CLIENT_SECRET` | Kredensial Telegram Login untuk menyelesaikan undangan aktivasi lama. Server-only; alur admin baru memakai ID Telegram numerik. |
| `TELEGRAM_STOKIST_LOGIN_REDIRECT_URI` | `https://agents.sukashawarma.com/api/telegram/login/callback`; daftarkan sebagai Allowed URL di @BotFather. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only untuk menyimpan tautan Telegram staf dan mencari penerima alert |

## Build dan deployment Bot

`yarn workspace @suka/bot build` memakai Webpack secara eksplisit. Pada Next.js
16, `NEXT_TURBOPACK=0` tidak memilih Webpack; log deployment lama tetap menampilkan
Turbopack. Build tetap memeriksa TypeScript, membatasi worker prerender menjadi
satu, dan memakai optimasi memori Webpack.

Dockerfile memakai cache khusus Bot untuk Yarn dan `.next/cache`; perubahan
source tidak mengulang instalasi dependensi. Konteks Docker dibatasi oleh
`apps/bot/Dockerfile.dockerignore` ke Bot dan dua package yang dipakainya.
Image runtime memakai output `standalone` dan berjalan sebagai user `node`.
Cache build dan dependensi development tidak disalin ke image runtime.
Cache mount dipakai kembali pada builder Docker yang sama. Runner GitHub Actions
yang baru memakai cache layer GHA; isi cache mount tidak otomatis ikut cache GHA.

Semua secret server wajib tersedia sebagai **runtime environment** di Coolify,
termasuk `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `HERMES_API_URL`,
`HERMES_KEYS`, `TELEGRAM_STOKIST_BOT_TOKEN`, dan `TELEGRAM_STOKIST_SEND_SECRET`.
Secret tidak disimpan dalam image. Variabel `NEXT_PUBLIC_*` tetap diberikan
saat build. Mengubah secret runtime memerlukan penggantian/restart container
dengan environment baru; image yang sama dapat dipakai kembali.

Workflow `.github/workflows/deploy-bot-coolify.yml` sudah membangun image
`ghcr.io/dev-sukashawarma/digitalisasi-ss-project/bot:latest`. Jika resource
Coolify masih memakai source Git + Dockerfile, trigger workflow akan membuat
Coolify melakukan build source lagi di VPS. Untuk menghindari build dua kali,
gunakan resource **Docker Image** di Coolify dengan image GHCR tersebut, port
`3000`, domain `agents.sukashawarma.com`, dan runtime environment yang sama.
Gunakan tag `sha-<7 karakter SHA>` untuk mengunci versi saat rollback. Perubahan
jenis resource dan perpindahan domain dilakukan setelah image baru diverifikasi.

Tanpa `HERMES_*` app tetap jalan; setiap pertanyaan dijawab teks galat standar.

## Bot Stokist Telegram (Hermes)

Bot Stokist memakai profil Hermes `stokis`, mengikuti SOP
[`docs/hermes/PANDUAN-AGENT-BARU.md`](../../docs/hermes/PANDUAN-AGENT-BARU.md).
Profilnya memakai server MCP pusat dengan scope `stok`, sehingga hanya alat
Stok & Distribusi tersedia. User ID Telegram yang di-allowlist dapat membaca
data domain tersebut lintas outlet. Bot CEO tetap bot terpisah dengan scope CEO.

Hermes menjadi satu-satunya penerima update Telegram untuk token Stokist. App
Bot hanya mengirim alert dan kode verifikasi; app tidak menjalankan `getUpdates`
atau webhook untuk menerima pesan. Alert database tetap dikirim ke staf aktif
yang sudah menautkan Telegram berdasarkan role dan outlet penerima event.

Owner/admin memilih staf yang boleh memakai bot di Admin Dashboard → Sistem →
Agents SS → Akses Bot Telegram
(`https://admin.sukashawarma.com/dashboard/sistem/bot-telegram`). Di halaman
tersebut, pilih bot lebih dulu lalu tentukan stafnya. Bot lain yang sudah
dipasang pada VPS dapat didaftarkan memakai nama profil Hermesnya. Setelah akses
diberikan, admin memasukkan ID Telegram numerik staf. Minta staf memperoleh ID
akunnya lewat layanan pencari ID Telegram, lalu admin menyalin ID tersebut ke
dashboard. ID tidak boleh dipakai oleh staf lain. Setelah disimpan, staf tinggal
membuka username bot yang dipilih dan menekan `/start`.
Daftar akses semua bot tersimpan per profil. Endpoint privat Admin Dashboard
menyediakan daftar Telegram ID yang diizinkan, lalu skrip VPS
`scripts/hermes/sinkron-akses-telegram.py` memperbarui
`TELEGRAM_ALLOWED_USERS` secara berkala. Perubahan akses muncul setelah sinkronisasi
berikutnya (maksimal sekitar satu menit) dan gateway Hermes dimuat ulang otomatis
jika allowlist berubah. ID yang sudah ada di allowlist sebelum pemasangan pertama
disimpan sebagai daftar lama agar akses yang sedang berjalan tidak terputus.
Untuk memasang sinkronisasi, ikuti bagian *Sinkronisasi akses Telegram* di
`docs/RUNBOOK-HERMES-VPS.md`.
Migrasi `20300254002100_bot_telegram_exclusive_access.sql` membuat daftar ini
kosong pada awal pemasangan; tautan lama tetap tersimpan, tetapi alert baru
tidak terkirim sebelum staf dipilih. API pengaitan, endpoint kirim, dan fungsi
database sama-sama memeriksa daftar akses tersebut. Menghapus akses langsung
menghentikan alert, termasuk untuk tautan yang sudah ada.

ID Telegram disimpan global per akun staf dan dipakai pada semua bot yang telah
diizinkan untuk staf itu. Mengosongkan ID di dashboard memutus tautan Telegram.
Link aktivasi OIDC yang pernah dibuat tetap dapat diselesaikan sampai kedaluwarsa;
alur baru tidak membuat link tersebut. Minta izin bot mengirim pesan agar alert
dapat dikirim ke chat privat.

Allowlist chat Hermes disinkronkan otomatis dari pilihan staf di Agents SS. Setiap
profil tetap memakai token Telegramnya sendiri; yang dibagikan hanya Telegram ID
staf yang diberi akses ke profil tersebut.

Setelah migration `20261016140000_bot_telegram_alerts.sql`,
`20261016150000_stok_distribusi_alert_telegram.sql`, dan
`20300254001800_stokist_telegram_otp_target.sql` diterapkan:

1. Buat kunci MCP scope `stok` di Admin Dashboard → Sistem → Kunci Hermes.
2. Pastikan migration di atas sudah diterapkan. Di Coolify app Bot, pertahankan
   `TELEGRAM_STOKIST_BOT_TOKEN` dan `TELEGRAM_STOKIST_SEND_SECRET`, lalu deploy
   kode baru terlebih dahulu. Ini menghentikan poller lama tanpa mematikan kirim alert.
3. Di VPS sebagai `suka-hermes`, gunakan profil `stokis` yang sudah ada dan
   pastikan `.env` profil itu menyimpan token Telegram serta `API_SERVER_KEY`.
   Samakan token dengan `TELEGRAM_STOKIST_BOT_TOKEN` di Coolify app Bot, dan
   masukkan API key profil ke entri `stokis` pada `HERMES_KEYS`. Jangan buat
   profil `stokist` kedua untuk token Telegram yang sama.
4. Di Supabase Vault, simpan `telegram_stokist_send_url` berisi
   `https://agents.sukashawarma.com/api/telegram/send` dan
   `telegram_stokist_send_secret` berisi nilai yang sama dengan
   `TELEGRAM_STOKIST_SEND_SECRET`. Event database memanggil endpoint ini.

Migration `20300254002400_stokist_unusual_stock_drop_and_delivery_failure_alert.sql`
menambahkan alert penurunan stok tidak wajar (turun minimal 50% dalam satu
perubahan, saldo masih di atas reorder point, maksimal sekali per bahan/outlet
per jam) dan watchdog hasil kirim Telegram. Watchdog berjalan tiap menit; jika
Telegram atau endpoint Bot gagal, fallback push dikirim ke owner/admin/developer
dan dibatasi satu kali per jenis kegagalan tiap 15 menit. Jalur fallback memakai
Vault `push_webhook_url` dan `fcm_webhook_secret` yang sudah digunakan push lain.
Terapkan migration ini sebelum deploy app Bot yang memanggil fungsi fallback.

Migration `20300254002700_kitchen_telegram_receipt_alerts.sql` menambah dua alert
khusus staf `kitchen` aktif yang sudah diberi akses dan ditautkan ke Telegram:

- **Crew selesai verifikasi**: satu ringkasan per surat jalan yang diterima
  lengkap dan sesuai, berisi outlet, nomor SJ, crew, waktu, jumlah baris bahan,
  serta tautan detail/bukti. Penutupan otomatis dan administratif tidak dianggap
  verifikasi crew. Alert selisih penerimaan yang sudah ada tetap berlaku.
- **Crew belum verifikasi**: mulai 2 jam setelah pengiriman baru, diperiksa
  setiap 10 menit pada 08.00–21.00 WIB, diulang paling cepat 4 jam per SJ.
  Nama PIC outlet ikut dicantumkan. Pengingat berhenti saat status penerimaan
  selesai/sebagian, dibatalkan, atau ditutup otomatis. Pengiriman historis
  sebelum pemasangan tidak diikutkan ke pengingat.

Jam kirim dicatat terpisah dari `surat_jalan.updated_at`, sehingga tanda tangan
atau edit catatan tidak mengulang hitungan 2 jam. State bersifat privat (RLS),
dan scheduler memproses paling banyak 50 SJ per eksekusi. Pemeriksaan terisolasi:
`supabase/verifikasi/hermes/t5_alert_verifikasi_kitchen.sql`; jalankan hanya di
database PostgreSQL sementara bernama `ss_kitchen_alert_test`.

Untuk rollback alert baru, hentikan job
`bot-telegram-kitchen-verification-reminder` dengan `cron.unschedule`, lalu
hapus trigger `trg_bot_telegram_verifikasi_kitchen` pada `surat_jalan`. State dan
fungsi dapat dipertahankan untuk audit; jalur alert lain tetap berjalan.

Migration `20300254002800_telegram_stock_number_format.sql` merapikan angka pada
alert stok kritis dan penurunan stok: maksimal 3 desimal, koma desimal, tanpa
nol di belakang (`5 → 2`, `2,5`, `60%`). Hanya teks pesan yang dibulatkan;
saldo database dan batas pemicu tetap memakai nilai presisi aslinya. Uji
terisolasi ada di `supabase/verifikasi/hermes/t6_format_angka_alert_stok.sql`.

Migration `20300254003000_kitchen_daily_opname_summary.sql` menambah ringkasan
opname harian Telegram khusus kitchen aktif yang sudah diberi akses bot dan
ditautkan. **21.00 WIB** mengirim outlet yang belum final; jika semuanya selesai,
pengingat tidak dikirim. **22.30 WIB** mengirim rangkuman akhir selesai dan belum
selesai. Setiap laporan membaca data terbaru untuk tanggal kalender WIB itu,
hanya opname `harian`, satu hitungan per outlet aktif `internal`/`mitra` yang
belum dihapus. Gudang, kantor, marketplace, outlet tes dan nonaktif tidak masuk.

Status belum selesai dibedakan menjadi belum mulai, draft, menunggu persetujuan,
dan perlu perbaikan. PIC/penulis opname dan waktu pencatatan ikut ditampilkan;
waktu memakai `approved_at`, lalu `updated_at`/`created_at` bila perlu, karena
skema tidak mempunyai `finalized_at`. Daftar panjang dibagi ke pesan bernomor
agar semua outlet tetap tercantum dan payload tidak terpotong. Log privat
mencegah pengiriman ulang per tanggal/fase/penerima, dan mencatat antrean pesan;
status pengiriman HTTP tetap diperiksa watchdog yang sudah ada.

Uji terisolasi: `supabase/verifikasi/hermes/t7_ringkasan_opname_kitchen.sql`.
Untuk menghentikan fitur, `cron.unschedule` kedua job
`bot-telegram-kitchen-opname-pengingat` dan `bot-telegram-kitchen-opname-ringkasan`.
Fitur tidak mengubah jadwal pengingat opname lewat 7 hari yang sudah ada.

Migration `20300254003700_exclude_leader_from_telegram_alerts.sql` menegakkan
kebijakan bahwa role `leader` tidak menerima notifikasi Telegram apa pun.
Alert stok kritis (`bot_telegram_alert_stok_kritis`) dialihkan ke staf
`kitchen` dan `purchasing` aktif, alert penurunan stok tidak biasa hanya
dikirim ke tim pusat (`owner`, `admin`, `developer`, `kitchen`, `purchasing`),
dan alert surat jalan dikirim dinonaktifkan untuk level kru/leader outlet.
Endpoint `/api/telegram/send` memvalidasi role staf dan menolak pengiriman ke
role `leader` (`role_not_eligible`). Uji terisolasi:
`supabase/verifikasi/hermes/t12_exclude_leader_alerts.sql`.

Migration `20300254003800_kitchen_permintaan_bahan_alerts.sql` menambahkan
alert otomatis ke tim Kitchen via Bot Telegram saat outlet cabang mengajukan
permintaan bahan baru (`permintaan_bahan` status `menunggu`). Alert dikirim
menggunakan `CONSTRAINT TRIGGER DEFERRED` pada transaksi pembuatan permintaan,
sehingga seluruh rincian baris item (`permintaan_bahan_item`) terangkum secara
lengkap (jumlah item, sampel 3 item, pembuat, waktu, dan link peninjauan).
Uji terisolasi: `supabase/verifikasi/hermes/t13_kitchen_permintaan_bahan_alert.sql`.

Jangan simpan `TELEGRAM_STOKIST_WEBHOOK_SECRET`; webhook dan poller app telah
dihapus. Username bot tidak diperlukan. Aturan persona dan pengujian profil ada
di [`docs/hermes/SOUL-stokis.md`](../../docs/hermes/SOUL-stokis.md) dan
[`supabase/verifikasi/hermes/gerbang-stokis.md`](../../supabase/verifikasi/hermes/gerbang-stokis.md).

Jika Coolify masih menyimpan nama env lama `TELEGRAM_ALERT_*`, pindahkan nilainya
ke nama `TELEGRAM_STOKIST_*` sebelum deploy kode ini. Nama lama tidak dibaca lagi.

## Alert Telegram HRD

Bot HRD memiliki jalur terpisah `/api/telegram/hrd/send` untuk admin HR dan developer aktif
(`admin_hr` atau `developer` di database), yang telah diberi akses profil `hrd` dan menautkan
Telegram. Migration `20300254002900_hrd_telegram_alerts.sql` menambahkan alert
keterlambatan **lebih dari 15 menit** dan rekap pemeriksaan harian pukul 09.00 WIB
(absensi tidak lengkap, alfa, izin tertunda, kontrak mendekati akhir). Terapkan juga
`20300254003100_hrd_developer_alert_recipients.sql` untuk penerima developer, serta
`20300254004300_hrd_leave_and_cash_advance_alerts.sql` untuk alert pengajuan cuti/izin baru,
pengajuan kasbon baru, penambahan kasbon pending di rekap 09.00 WIB, dan sinkronisasi
katalog trigger.
Panduan perilaku, konfigurasi `TELEGRAM_HRD_BOT_TOKEN`/`TELEGRAM_HRD_SEND_SECRET`,
Vault, verifikasi dan rollback tersedia di
[`docs/hermes/ALERT-HRD.md`](../../docs/hermes/ALERT-HRD.md).

## Untuk apa

Tempat bos (dan nanti staf divisi) **bertanya langsung** ke bot Suka Shawarma lewat
browser/HP. Bot-nya sendiri adalah **Hermes Agent** di VPS; webapp ini hanya "meja depan":
login, memilih bot sesuai role, menampilkan percakapan.

## Gambaran

```
Pengguna ──HTTPS──► Cloudflare ──► Coolify: agents.sukashawarma.com (app ini, login SSO)
                                          │  jaringan internal VPS + kunci API server per profil
                                          ▼
                                 Hermes API server  /p/<profil>/v1/...   (TIDAK dibuka ke internet)
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
           9Router (127.0.0.1) → Claude/Gemini     MCP Suka Shawarma: admin.sukashawarma.com/api/hermes/mcp
                                                   (data baca-saja, kunci per bot)
```

## Keputusan yang sudah diambil (2026-10-07)

| # | Keputusan |
|---|---|
| 1 | Webapp **buatan sendiri** di monorepo ini (bukan `hermes dashboard` bawaan — itu panel admin mesin, khusus dev lewat tunnel SSH). |
| 2 | Login = **SSO akun Suka Shawarma** (`@suka/auth`, cookie `.sukashawarma.com`). Role → profil Hermes. |
| 3 | Coolify & Hermes **satu VPS** → webapp memanggil API server Hermes **lewat jaringan internal**, API server tidak dibuka ke internet. |
| 4 | Satu API server melayani semua profil lewat `/p/<profil>/`; **tiap profil punya `API_SERVER_KEY` sendiri** (disimpan di server webapp, tak pernah ke browser). |
| 5 | Riwayat percakapan **disimpan di Supabase per user** (RLS milik sendiri, maks 50 percakapan), pola sama dengan SUKA Bot. Hermes menerima `X-Hermes-Session-Id` untuk konteks. |
| 6 | Fitur Hermes **memory, skills/self-improvement, session_search MATI** di profil bisnis. "Ingat preferensi saya" (nanti) disimpan di webapp per orang, bukan memory Hermes. |
| 7 | Toolset platform `api_server` **wajib dikunci per profil** (hanya `clarify` + MCP `suka`) — API server memberi akses penuh toolset bila tidak dikunci. |

## Peta role → profil (rencana)

| Role | Profil Hermes | Status |
|---|---|---|
| owner, admin, developer | `ceo` | profil sudah ada & teruji (CLI + Telegram) |
| kitchen, purchasing | `gudang` | menunggu domain gudang |
| admin_hr | `hrd` | menunggu domain absensi |
| admin_finance | `finance` | menunggu domain finance |

## Pertanyaan yang masih terbuka

- Siapa yang bisa membuka webapp di fase 1 (usul: hanya owner/admin/developer).
- Tampilan & fitur fase 1 (streaming jawaban, daftar percakapan, HP-first).

## Bacaan wajib

- `CLAUDE.md` (root) — bagian "Session 2026-10-07: Hermes API".
- `docs/superpowers/specs/2026-10-07-hermes-api-design.md` — keputusan API & keamanan.
- `docs/RUNBOOK-HERMES-VPS.md` — kondisi VPS, gateway, profil `ceo`.
- `apps/portal/src/app/asisten/` & `apps/admin-dashboard/src/lib/sukaBot/` — contoh pola chat SUKA Bot.
