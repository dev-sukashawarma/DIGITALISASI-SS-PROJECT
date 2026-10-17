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
| `TELEGRAM_STOKIST_LOGIN_CLIENT_ID`, `TELEGRAM_STOKIST_LOGIN_CLIENT_SECRET` | Kredensial Telegram Login dari @BotFather untuk aktivasi link undangan admin. Server-only. |
| `TELEGRAM_STOKIST_LOGIN_REDIRECT_URI` | `https://agents.sukashawarma.com/api/telegram/login/callback`; daftarkan sebagai Allowed URL di @BotFather. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only untuk menyimpan tautan Telegram staf dan mencari penerima alert |

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
diberikan, admin memasukkan username bot dan membuat link aktivasi khusus untuk
staf. Link hanya berlaku 24 jam dan sekali pakai; staf membuka link, mengonfirmasi
akun Telegram, lalu menekan Start untuk memulai chat dengan bot tersebut.
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

Aktivasi undangan memakai Telegram Login OIDC Authorization Code + PKCE; server
memverifikasi ID token Telegram dan menautkan akun ke staf yang dipilih admin.
Token undangan disimpan sebagai hash, kedaluwarsa setelah 24 jam, dan hanya dapat
digunakan satu kali. Jika akses staf dicabut sebelum link dipakai, penukaran
ditolak. Di @BotFather, pilih bot
Stokist → Login Widget, daftarkan origin `https://agents.sukashawarma.com` dan
redirect URI `https://agents.sukashawarma.com/api/telegram/login/callback`, lalu
pasang Client ID/Secret di Coolify app Bot. Minta izin bot mengirim pesan agar
alert dapat dikirim ke chat privat. Terapkan migration
`20300254002300_hermes_telegram_activation_invites.sql` sebelum admin membuat
link undangan. Halaman pengaitan lama tetap tersedia untuk kebutuhan admin.

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

Jangan simpan `TELEGRAM_STOKIST_WEBHOOK_SECRET`; webhook dan poller app telah
dihapus. Username bot tidak diperlukan. Aturan persona dan pengujian profil ada
di [`docs/hermes/SOUL-stokis.md`](../../docs/hermes/SOUL-stokis.md) dan
[`supabase/verifikasi/hermes/gerbang-stokis.md`](../../supabase/verifikasi/hermes/gerbang-stokis.md).

Jika Coolify masih menyimpan nama env lama `TELEGRAM_ALERT_*`, pindahkan nilainya
ke nama `TELEGRAM_STOKIST_*` sebelum deploy kode ini. Nama lama tidak dibaca lagi.

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
