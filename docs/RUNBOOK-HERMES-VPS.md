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
Coolify) baru saat webapp `bot.sukashawarma.com` dibangun.

### 8. Cek
```bash
hermes status
```
Model = 9Router SS · Terminal = nonaktif · Telegram configured · Gateway running.

## SOUL.md profil bisnis — aturan wajib
- Setiap angka wajib berasal dari hasil alat di percakapan ini; alat gagal/tidak ada →
  "data tidak tersedia" + alasan. Jangan memperkirakan.
- **Jangan pernah meminta atau menerima** kunci, password, token, atau isi file
  konfigurasi (uji 2026-10-07: bot menawarkan "tempel isi file ke chat" — itu dilarang).
- Jangan menyarankan perintah terminal/server kepada pengguna.

## Berikutnya
1. Profil `ceo` + kunci MCP scope `penjualan` (setelah `/api/hermes/mcp` dibangun).
2. Verifikasi MCP lewat HTTP dengan header `Authorization` (keputusan K9).
3. Grup Telegram uji (dev saja) untuk masa uji 1 minggu.
