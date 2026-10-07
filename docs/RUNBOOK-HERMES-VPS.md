# Runbook — Hermes Suka Shawarma di VPS Hostinger

**Dibuat:** 2026-10-07 · Spec: `docs/superpowers/specs/2026-10-07-hermes-api-design.md`

## Struktur VPS (keputusan 2026-10-07)

```
VPS Hostinger srv1892441 (IPv4 statis)
├── root            → Hermes milik Rendy (/root/.hermes, profil default + ads)
│                     TIDAK disentuh. Root + terminal aktif + memegang
│                     SUPABASE_SERVICE_ROLE_KEY (disengaja, untuk manage DB & server).
└── suka-hermes     → Hermes Suka Shawarma (profil per bot: ceo, gudang, hrd, finance)
```

- Satu **user Linux** per pemilik/instalasi; **profil Hermes** per bot di dalamnya.
  Instalasi baru untuk pihak lain = user Linux baru (`hermes-<nama>`, huruf kecil).
- ⚠️ Pemisahan `suka-hermes` = **kerapian, bukan keamanan**: root (termasuk bot Rendy)
  tetap bisa membaca `/home/suka-hermes`. Dapat diterima karena bot Rendy sudah memegang
  service role key (akses lebih besar dari apa pun di sini). Pindah ke VPS sendiri bila
  service role key dicabut dari bot Rendy atau `suka-hermes` mulai memegang sesuatu yang
  lebih sensitif.
- Yang dipegang `suka-hermes`: kunci MCP read-only per scope, kunci 9Router SS,
  token Master Bot Telegram SS (bocor ⇒ pesan palsu ke grup bos).

## Port

| Pemilik | API server | Dashboard |
|---|---|---|
| Rendy (root) | 8642 (default) | 9119 (default) |
| suka-hermes | **8643** | **9120** |

## Langkah install

### 1. User (sebagai root)
```bash
adduser suka-hermes
chmod 700 /home/suka-hermes
loginctl enable-linger suka-hermes
```

### 2. Install
```bash
su - suka-hermes
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes --version
```

### 2b. Sesi systemd user (✅ 2026-10-07)
`su -` tak membuka bus systemd user → `systemctl --user` gagal "No medium found".
```bash
echo 'export XDG_RUNTIME_DIR=/run/user/$(id -u)' >> ~/.bashrc
```
`hermes-gateway.service` (systemd user) aktif & hidup lagi setelah reboot (linger).
Wizard install memasang gateway otomatis — ia tak melayani apa pun sampai platform diatur.

### 3. Model (✅ 2026-10-07)
- Wizard default mengarah ke **Nous Portal (berbayar) — batalkan (Ctrl+C)**, pakai
  `hermes setup model` → **Custom endpoint** → mode **2 Chat Completions**.
- 9Router berjalan **di VPS yang sama** (`76.13.193.138` = IP VPS ini, port 20128).
  `base_url` diganti ke **`http://127.0.0.1:20128/v1`** (baris `custom_providers` di
  `~/.hermes/config.yaml`; nama provider `76.13.193.138:20128` sengaja dibiarkan).
- API key 9Router tersimpan di `config.yaml` (bukan hanya `.env`) → jangan pernah tempel
  config mentah ke mana pun.
- Model `hermes-combo` = **combo 9Router yang sama dengan bot Rendy**. TODO: buat combo
  sendiri (mis. `suka-combo`) agar perubahan Rendy tak ikut mengubah bot SS.
- ⚠️ Port 20128 9Router terbuka ke internet tanpa https — pertimbangkan firewall/https.

### 4. Kunci toolset (✅ CLI 2026-10-07) — WAJIB per platform
Pengaturan **per platform** (`--platform`, default `cli`). Yang dipertahankan hanya
`clarify` (+ MCP Suka Shawarma nanti).
```bash
hermes tools disable [--platform <p>] web browser terminal file code_execution vision \
  image_gen tts skills todo memory session_search connections delegation cronjob computer_use
hermes tools --summary     # harus 1/28 per platform
```
- `memory` dimatikan: bot tak boleh menjawab angka dari ingatan (angka wajib dari alat).
- `session_search` dimatikan: tak boleh mencari percakapan user lain.
- `connections`/`cronjob` dimatikan: bot tak boleh menambah MCP / jadwal sendiri.
- **Ulangi untuk `--platform telegram` dan platform API server begitu dipasang** —
  platform baru kemungkinan mulai dengan semua toolset aktif. Verifikasi `--summary`.
- Uji: minta bot "baca file ~/.hermes/config.yaml" → harus menolak.

### 5. Master Bot Telegram (✅ 2026-10-07 — bot menjawab, toolset Telegram 1/28)
Terbukti: platform Telegram baru muncul dengan **17/28 toolset aktif** → wajib
`hermes tools disable --platform telegram ...` (daftar sama dengan langkah 4) **sebelum**
pesan pertama, lalu `systemctl --user restart hermes-gateway`.
Bot "serba bisa" untuk dev (terminal dll) = profil terpisah (mis. `devbot`), bot Telegram
sendiri, hanya ID dev, **tanpa** kunci MCP Suka Shawarma.

- Bot baru via **@BotFather** (bukan bot Rendy).
- `hermes gateway setup` → `TELEGRAM_ALLOWED_USERS` = ID Telegram dev saja (sementara).
- `hermes gateway install` (service systemd user, hidup lagi setelah reboot).
- Bot satu arah (keputusan K10 spec) — konfigurasi menyusul saat digest pertama dibuat.

### 6. Dashboard admin (khusus dev)
```bash
hermes dashboard --port 9120 --no-open
```
Dari laptop:
```bash
ssh -L 9120:127.0.0.1:9120 root@<ip-vps>
```
Buka `http://127.0.0.1:9120`. **Jangan pernah `--host 0.0.0.0`.**

### 7. API server — biarkan MATI
Dinyalakan (port 8643, `API_SERVER_KEY`, bind 127.0.0.1 + reverse proxy berallowlist IP
Coolify) baru saat webapp `agents.sukashawarma.com` dibangun.

### 8. Cek
```bash
hermes status
```
Model = 9Router SS · Terminal = nonaktif · Telegram configured · Gateway running.

## Gateway & Telegram (✅ 2026-10-07 — Bot CEO menjawab di Telegram)
- Hermes versi ini: **satu host gateway per user**, dijalankan dari profil **default**
  (`hermes gateway install`), dan ia **melayani semua profil**. `ceo gateway install` ditolak
  ("Profile 'ceo' does not get a gateway of its own"). Jangan pakai `--force`/`standalone`.
- Platform dipasang di **profil yang menjawab**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS`,
  `TELEGRAM_HOME_CHANNEL` ada di `~/.hermes/profiles/ceo/.env`, **dihapus** dari `~/.hermes/.env`
  (cadangan `.env.bak-20261007`). Satu token hanya di satu profil.
- Pastikan hanya **satu** proses gateway: `ps -u suka-hermes -o pid,cmd | grep gateway`.
  Proses `gateway run` manual sisa uji harus di-`kill` (berebut token dengan service).
- Uji 2026-10-07 di Telegram (chat pribadi, hanya ID dev): omzet 6 Okt = Rp 66.105.510 ✅,
  pertanyaan gaji ditolak ✅. Telegram dua arah = **hanya untuk uji dev**; membuka ke bos
  = keputusan terpisah (tambah ID eksplisit, tetap chat pribadi, jangan masukkan ke grup).

## API server untuk webapp `agents.sukashawarma.com` (✅ 2026-10-07)
- Coolify satu VPS; gateway jaringan Docker `coolify` = **`10.0.1.1`**
  (`docker network inspect coolify -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}'`, root).
- `~/.hermes/.env` (host gateway): `API_SERVER_ENABLED=true`, `API_SERVER_HOST=10.0.1.1`,
  `API_SERVER_PORT=8643`, `API_SERVER_KEY=<acak>` (profil default). `multiplex_profiles: true`
  sudah aktif di `config.yaml` → tiap profil di `/p/<profil>/`.
- `~/.hermes/profiles/ceo/.env`: `API_SERVER_KEY=<acak>` (= `HERMES_KEY_CEO` di Coolify app `bot`).
  Kunci dibuat `printf 'API_SERVER_KEY=%s\n' "$(openssl rand -hex 32)" >> …` (tak tampil di layar).
- Toolset dikunci: `hermes|ceo tools disable --platform api_server <daftar standar>`.
- Uji: `ss -ltnp | grep 8643` → `10.0.1.1:8643`; dari internet tak tersambung; host tanpa
  kunci/benar/salah = 401/200/401; dari container `coolify` = 200; chat "jalankan whoami" →
  ditolak, hanya 5 alat `suka`.
- Webapp: `HERMES_API_URL=http://10.0.1.1:8643`. User `suka-hermes` sengaja **tidak** di grup docker.

## SOUL.md profil bisnis — aturan wajib
- Setiap angka wajib berasal dari hasil alat di percakapan ini; alat gagal/tidak ada →
  "data tidak tersedia" + alasan. Jangan memperkirakan.
- **Jangan pernah meminta atau menerima** kunci, password, token, atau isi file
  konfigurasi (uji 2026-10-07: bot menawarkan "tempel isi file ke chat" — itu dilarang).
- Jangan menyarankan perintah terminal/server kepada pengguna.

## Sambungkan MCP Suka Shawarma (profil `ceo`)

Prasyarat: admin-dashboard dengan `/api/hermes/mcp` sudah ter-deploy (branch
`feat/hermes-api`). SOUL: `docs/hermes/SOUL-ceo.md`. Gerbang: `supabase/verifikasi/hermes/gerbang-penjualan.md`.

1. Halaman admin **Sistem → Kunci Hermes** → buat kunci "Bot CEO", scope `penjualan`
   (domain lain dicentang saat tahapnya live), IP **kosong dulu**. Salin kunci (tampil sekali).
2. Di VPS (`su - suka-hermes`):
   ```bash
   hermes profile create ceo
   ceo setup model            # Custom endpoint http://127.0.0.1:20128/v1, mode 2
   echo 'SUKA_MCP_KEY=<kunci>' >> ~/.hermes/profiles/ceo/.env
   chmod 600 ~/.hermes/profiles/ceo/.env
   ```
   Tambahkan ke `~/.hermes/profiles/ceo/config.yaml`:
   ```yaml
   mcp_servers:
     suka:
       url: https://<domain-admin-dashboard>/api/hermes/mcp
       headers:
         Authorization: "Bearer ${SUKA_MCP_KEY}"
       enabled: true
   ```
3. Kunci toolset bawaan profil `ceo` untuk **cli dan telegram** (daftar langkah 4), lalu
   `ceo tools --summary` — alat `suka:*` harus terlihat & aktif; bila ikut mati,
   `ceo tools enable suka:penjualan_ringkasan ...` (format `server:tool`).
4. Salin `docs/hermes/SOUL-ceo.md` → `~/.hermes/profiles/ceo/SOUL.md`.
5. Panggilan pertama akan **403** (IP kosong). Buka log di halaman Kunci Hermes, lihat IP
   pada baris "ditolak", tambahkan IP itu ke kunci → ulangi. Harapannya **`76.13.193.138`**
   (IP publik VPS): admin.sukashawarma.com di belakang **Cloudflare**, IP asli diambil dari
   `cf-connecting-ip`. ⚠️ Kalau log menampilkan `172.6x/104.1x–104.2x/162.15x…` (rentang
   Cloudflare), JANGAN dimasukkan — berarti perbaikan Cloudflare belum ter-deploy.
6. Uji: `ceo` → "omzet kemarin berapa?" → jawaban menyebut periode & sama dengan layar.
7. Gerbang 2 di produksi, terutama: kirim header `x-real-ip` palsu dari laptop →
   harus tetap **403**. Kalau lolos, proxy tidak menimpa header → allowlist IP bisa
   dipalsukan; perbaiki konfigurasi proxy sebelum lanjut.
8. Jadwal: `ceo cron --help` → 07:00 WIB panggil `laporan_pagi_ceo`, kirim `teks` ke grup
   Telegram **uji**. Cron Hermes kemungkinan UTC (07:00 WIB = 00:00 UTC) — uji dulu dengan
   jadwal beberapa menit ke depan.
9. Isi tabel gerbang; setelah 7 hari lulus, pindahkan tujuan laporan pagi ke grup Owner.
