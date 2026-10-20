# Panduan & Dokumentasi Bot CEO (J.A.R.V.I.S.)

Bot CEO adalah **Chief Executive Command Centre AI** Suka Shawarma yang bertindak sebagai sistem pendamping eksekutif untuk **Owner / Bos, Administrator, dan Developer**. Bot ini mengonsolidasikan data penjualan real-time, status buka cabang, presensi SDM, ketersediaan gudang, serta rekonsiliasi kas/finance ke dalam saluran Telegram pribadi dan webapp Agents SS.

---

## 1. Identitas & Persona (J.A.R.V.I.S.)

- **Sapaan:** "Sir" atau "Bos"
- **Karakter:** Tenang, taktis, presisi, berwibawa, dan analitis ala sistem AI J.A.R.V.I.S. (Iron Man).
- **Target Pengguna & Wewenang:**
  - `owner` (Akses komando eksekutif penuh)
  - `admin` (Administrasi pusat)
  - `developer` (Observabilitas teknis dan pipeline)
  - Pengguna Whitelist Telegram yang disetujui di Admin Dashboard (`bot_slug = 'ceo'`).

---

## 2. Arsitektur Komunikasi Dua Arah & Webhook

Bot CEO kini mengadopsi arsitektur webhook mandiri dan pengiriman outbox yang setara dengan Bot Manager dan Bot HRD:

```
[ Telegram Chat (Bos / Owner) ]
       │
       ▼ (HTTPS Webhook)
[ https://agents.sukashawarma.com/api/telegram/ceo/webhook ]
       │
       ├─► 1. Cek Verifikasi & Whitelist (owner / admin / developer / whitelist)
       ├─► 2. Kirim Indikasi Typing Heartbeat (setiap 4 detik)
       ├─► 3. Hermes AI Profil 'ceo' (Port 8643 /p/ceo/)
       │       └─► Fallback jika timeout / gateway down:
       ├─► 4. 9Router AI Gateway ('CEO_SS' ➔ 'MANAGER_SS' ➔ Gemini 3.8 ➔ GPT-6 ➔ hermes-combo)
       │       └─► Fallback jika offline:
       └─► 5. Telemetri Nyata Live Database (`ambilTelemetriNyata`) + Generator Taktis (`buatJawabanDev`)
```

---

## 3. Menu Pintasan Cepat (Slash Commands)

Menu perintah dapat diaktifkan secara instan di Telegram dengan mengetik `/`:

| Command | Penjelasan | Fungsi Eksekutif |
|---|---|---|
| `/start` | Mulai bot & aktivasi akun eksekutif | Menautkan akun via Deep Link `inv_...` atau verifikasi staf terdaftar. |
| `/help` | Panduan & ringkasan komando eksekutif | Memaparkan menu shortcut dan contoh instruksi bisnis yang didukung. |
| `/omzet` | Omzet & ranking cabang hari ini | Menampilkan gross sales, total order, AOV, dan leaderboard cabang hari ini. |
| `/kemarin` | Evaluasi & ranking cabang kemarin | Rekapitulasi penjualan kemarin, perbandingan omzet, dan cabang 0 penjualan. |
| `/buka` | Cek cabang buka & belum transaksi | Memantau cabang mana saja yang sudah aktif bertransaksi dan cabang yang belum order. |
| `/absensi` | Presensi kru & staf operasional | Status clock-in kru cabang, rekapitulasi keterlambatan, dan daftar staf izin/cuti. |
| `/stok` | Status stok gudang pusat & outlet | Katalog master bahan baku utama, buffer cold storage, dan status pengiriman logistik. |
| `/finance` | Rekonsiliasi kas & arus keuangan | Gross sales POS, mutasi kas operasional, dan status rekonsiliasi pembayaran. |
| `/status` | Executive daily briefing & sistem | Diagnostik menyeluruh status stasiun sales, HRD, stok, dan koneksi server pusat. |
| `/new` | Mulai sesi percakapan baru | Mereset konteks percakapan untuk memulai topik pembahasan baru. |
| `/id` | Info User ID & Chat ID Anda | Menampilkan detail identitas akun Telegram untuk pendaftaran whitelist manual. |

---

## 4. Endpoint API Bot CEO di `apps/bot`

### A. Webhook Receiver (`POST /api/telegram/ceo/webhook`)
- **Tujuan:** Menerima pesan teks, perintah slash, dan tautan aktivasi mandiri langsung dari Telegram Bot API.
- **Autentikasi Header:** `x-telegram-bot-api-secret-token` (dicocokkan dengan `TELEGRAM_CEO_WEBHOOK_SECRET`).
- **Respon:** Menjalankan pemrosesan dua arah dengan prioritas Hermes ➔ AI Router ➔ Telemetri Nyata.

### B. Outbox Sender (`POST /api/telegram/ceo/send`)
- **Tujuan:** Mengirimkan pesan alert, digest terjadwal (04:00, 16:00, 21:00 WIB), atau pemberitahuan kritis dari server/cron ke Telegram Owner/Admin.
- **Autentikasi Header:** `Authorization: Bearer <TELEGRAM_CEO_SEND_SECRET>`.
- **Payload:**
  ```json
  {
    "user_id": "<UUID staf>",
    "title": "⚡ EXECUTIVE DAILY BRIEFING",
    "body": "Ringkasan performa cabang hari ini...",
    "url": "https://agents.sukashawarma.com"
  }
  ```

---

## 6. Daftar Trigger Otomatis Eksekutif (Single Source of Truth)

Seluruh pemicu otomatis Bot CEO terdaftar di database `public.bot_trigger_catalog` (dibaca otomatis oleh Native SuperApp Tab Trigger dan Telegram `/help`). Terdiri dari **7 Digest Makro Terjadwal** dan **8 Eskalasi Operasional & Finansial Kritis Real-Time**:

| No | ID Trigger | Judul Pemicu | Sumber Aplikasi | Jadwal / Pola Pemicu | Target Role |
|---|---|---|---|---|---|
| 1 | `tg_ceo_sales_kemarin_0400` | Rekapitulasi & Ranking Penjualan Kemarin | POS Cashier & Supabase | Cron Subuh 04:00 WIB | `owner`, `admin` |
| 2 | `tg_ceo_marcom_0401` | Ringkasan Kinerja Marketing & Promo Kemarin | App Marcom & Meta Ads | Cron Harian 04:01 WIB | `owner`, `admin` |
| 3 | `tg_ceo_absensi_hq_0830` | Laporan Presensi Staf Kantor Pusat / HQ | App HRD & Absensi | Cron Pagi 08:30 WIB | `owner`, `admin` |
| 4 | `tg_ceo_absensi_outlet_1400` | Laporan Presensi Kru Seluruh Outlet | App Absensi Outlet | Cron Siang 14:00 WIB | `owner`, `admin` |
| 5 | `tg_ceo_sales_sore_1600` | Flash Report Penjualan Sore | POS Cashier Network | Cron Sore 16:00 WIB | `owner`, `admin` |
| 6 | `tg_ceo_zero_sales_1930` | Eskalasi Cabang Rp 0 di Prime Time Malam | POS Cashier Network | Cron Audit 19:30 WIB | `owner`, `admin` |
| 7 | `tg_ceo_sales_malam_2200` | Laporan Penutupan & Omzet Final Harian | POS Cashier & Supabase | Cron Closing 22:00 WIB | `owner`, `admin` |
| 8 | `tg_ceo_opname_cutoff_2230` | Eskalasi Cut-Off Stok Opname Malam | App Gudang / Opname | Cron Cut-off 22:30 WIB | `owner`, `admin` |
| 9 | `tg_ceo_opname_finalized` | Notifikasi Rekap Finalize Stok Opname Cabang | App SuperApp / Opname | Trigger Real-Time `opname -> finalized` | `owner`, `admin` |
| 10 | `tg_ceo_void_eskalasi` | Eskalasi Pembatalan / Void POS Berisiko Tinggi | POS Cashier | Trigger Real-Time `orders -> cancelled >= 50k` | `owner`, `admin` |
| 11 | `tg_ceo_cash_var_eskalasi` | Eskalasi Selisih Kas Kritis Closing (> Rp 100rb) | POS Cashier / Closing | Trigger Real-Time `cashier_shifts -> closed` | `owner`, `admin` |
| 12 | `tg_ceo_late_open_eskalasi` | Eskalasi Keterlambatan Buka Outlet (≥ 30 Menit) | POS & Presensi Kru | Cron Tiap 5 Menit (Jam Buka) | `owner`, `admin` |
| 13 | `tg_ceo_waste_eskalasi` | Eskalasi Pengajuan Waste Bahan Baku (> Rp 150rb) | App Gudang & Dapur | Trigger Real-Time `stok_waste_reports` | `owner`, `admin` |
| 14 | `tg_ceo_watchdog_2h` | Heartbeat & Diagnostik VPS / Supabase | VPS Hostinger & Supabase | Cron Watchdog Tiap 2 Jam | `owner`, `admin`, `developer` |
| 15 | `tg_ceo_alert_down` | Alert Darurat Kegagalan Server / Database Down | Monitor Watchdog | Cron Healthcheck Tiap 2 Menit | `owner`, `admin`, `developer` |

---

## 7. Pipeline Pengiriman Alert Eskalasi ke Bot CEO

Ketika terjadi kejadian anomali operasional di database Supabase:
1. Trigger PostgreSQL mengeksekusi `public.bot_ceo_antrekan(p_key, p_staff_id, p_title, p_body, p_url)`.
2. Fungsi tersebut memanggil `public.bot_kirim_push_hp(...)` untuk memicu notifikasi instan push FCM ke smartphone Native SuperApp milik Owner/Admin.
3. Secara paralel, antrean disimpan di tabel `public.bot_ceo_alert_outbox`.
4. Cron worker `public.bot_ceo_kirim_antrean()` (atau dispatch otomatis) membaca outbox dan memanggil endpoint `POST https://agents.sukashawarma.com/api/telegram/ceo/send` dengan header `TELEGRAM_CEO_SEND_SECRET`.
5. Bot CEO mengirimkan pesan peringatan eksekutif langsung ke Telegram Chat ID milik Bos/Owner.

