# apps/bot — Webapp Bot Suka Shawarma (`agents.sukashawarma.com`)

> **Status: fase 1 dibangun (Task 1–9 plan), belum deploy.** Spec:
> `docs/superpowers/specs/2026-10-07-webapp-bot-design.md` · Plan:
> `docs/superpowers/plans/2026-10-07-webapp-bot.md`. Kerjakan di branch sendiri + Pull Request.

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
| `HERMES_KEYS` | JSON `{"ceo":"<key>","stokist":"<API_SERVER_KEY profil stokist>"}` — satu env untuk semua agen; restart setelah perubahan. Server-only. |
| `TELEGRAM_STOKIST_BOT_TOKEN` | Token bot Stokist untuk mengirim alert dan kode pengaitan Telegram. Token yang sama dipasang di profil Hermes `stokist` untuk menerima chat. |
| `TELEGRAM_STOKIST_SEND_SECRET` | Secret antarlayanan untuk endpoint `/api/telegram/send` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only untuk menyimpan tautan Telegram staf dan mencari penerima alert |

Tanpa `HERMES_*` app tetap jalan; setiap pertanyaan dijawab teks galat standar.

## Bot Stokist Telegram (Hermes)

Bot Stokist adalah profil Hermes terpisah bernama `stokist`, mengikuti SOP
[`docs/hermes/PANDUAN-AGENT-BARU.md`](../../docs/hermes/PANDUAN-AGENT-BARU.md).
Profilnya memakai server MCP pusat dengan scope `stok`, sehingga hanya alat
Stok & Distribusi tersedia. User ID Telegram yang di-allowlist dapat membaca
data domain tersebut lintas outlet. Bot CEO tetap bot terpisah dengan scope CEO.

Hermes menjadi satu-satunya penerima update Telegram untuk token Stokist. App
Bot hanya mengirim alert dan kode verifikasi; app tidak menjalankan `getUpdates`
atau webhook untuk menerima pesan. Alert database tetap dikirim ke staf aktif
yang sudah menautkan Telegram berdasarkan role dan outlet penerima event.

Untuk menautkan akun, user buka `/telegram`, kirim `/start` lalu `/id` ke bot,
masukkan Telegram User ID, minta kode, dan masukkan kode 6 digit yang dikirim
bot. Pemutusan koneksi dilakukan dari halaman yang sama.

Setelah migration `20261016140000_bot_telegram_alerts.sql`,
`20261016150000_stok_distribusi_alert_telegram.sql`, dan
`20300254001800_stokist_telegram_otp_target.sql` diterapkan:

1. Buat kunci MCP scope `stok` di Admin Dashboard → Sistem → Kunci Hermes.
2. Pastikan migration di atas sudah diterapkan. Di Coolify app Bot, pertahankan
   `TELEGRAM_STOKIST_BOT_TOKEN` dan `TELEGRAM_STOKIST_SEND_SECRET`, lalu deploy
   kode baru terlebih dahulu. Ini menghentikan poller lama tanpa mematikan kirim alert.
3. Setelah deploy app selesai, jalankan di VPS sebagai `suka-hermes`:
   `./scripts/hermes/provision-bot.sh --name stokist --mcp-key "<KUNCI_MCP>" --telegram`.
   Skrip meminta token secara tersembunyi dan user ID allowlist. Salin snippet
   `HERMES_KEYS` dari output provisioning ke Coolify app `agents.sukashawarma.com`.
   Pastikan `TELEGRAM_STOKIST_BOT_TOKEN` di Coolify app Bot sama dengan token profil
   Hermes. Gateway Hermes akan mengambil alih pesan masuk.
4. Di Supabase Vault, simpan `telegram_stokist_send_url` berisi
   `https://agents.sukashawarma.com/api/telegram/send` dan
   `telegram_stokist_send_secret` berisi nilai yang sama dengan
   `TELEGRAM_STOKIST_SEND_SECRET`. Event database memanggil endpoint ini.

Jangan simpan `TELEGRAM_STOKIST_WEBHOOK_SECRET`; webhook dan poller app telah
dihapus. Username bot tidak diperlukan. Aturan persona dan pengujian profil ada
di [`docs/hermes/SOUL-stokist.md`](../../docs/hermes/SOUL-stokist.md) dan
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
