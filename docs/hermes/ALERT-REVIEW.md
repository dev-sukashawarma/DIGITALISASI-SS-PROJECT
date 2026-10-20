# Panduan & Dokumentasi Bot SukaReview (Telegram & SuperApp)

Bot SukaReview adalah **Asisten AI Intelijen Ulasan & Kepuasan Pelanggan (Customer Experience & Google Review Intelligence)** Suka Shawarma. Bot ini memantau ulasan Google Reviews secara real-time dari seluruh cabang, mendeteksi keluhan pelanggan, mengevaluasi tren rating outlet, dan mengirimkan alert dini ke saluran Telegram manajemen.

---

## 1. Identitas & Persona Bot
- **Nama Profil Hermes:** `review` (alias: `sukareview`)
- **Label Tampilan:** Bot SukaReview
- **Target Pengguna & Wewenang:**
  - `owner` (Akses monitoring ulasan seluruh jaringan)
  - `admin` (Administrasi & pengaturan threshold sistem)
  - `developer` (Integrasi Pub/Sub, Places API, dan webhook)
  - `marcom` (Analisis sentimen brand & draft respon ulasan)
  - `area_manager` & `regional_manager` (Evaluasi kualitas rasa & pelayanan cabang binaan)
  - Staf Whitelist Telegram (`bot_slug = 'review'`)

---

## 2. Arsitektur Komunikasi & Integrasi Webhook

```
[ Pelanggan Google Maps ]
        │
        ▼ (Google Business Profile Pub/Sub / Places Sync)
[ App SukaReview (review.sukashawarma.com) ]
        │
        ├─► Ingest Review & Gemini AI Sentiment Analysis
        ├─► Evaluasi 4 Rule Alert Operasional (engine.ts)
        │       └─► Kirim Alert ke Telegram (notify-telegram.ts)
        │
        ▼
[ https://agents.sukashawarma.com/api/telegram/review/send ]
        │
        ▼ (Telegram Outbox Dispatcher)
[ Bot Telegram SukaReview ] ◄──► [ Tim Manajemen / AM / Marcom ]
        │
        ▼ (Pesan Balasan / Pertanyaan Chat Masuk)
[ https://agents.sukashawarma.com/api/telegram/review/webhook ]
        │
        ├─► 1. Cek Verifikasi & Whitelist (Owner/Admin/Marcom/AM)
        ├─► 2. Kirim Indikasi Typing Heartbeat
        ├─► 3. Hermes AI Profil 'review' (Port 8643 /p/review/)
        ├─► 4. 9Router AI Gateway ('ANALYTIC-SOSMED-COMBO' ➔ Gemini 3.8 ➔ GPT-6)
        └─► 5. Telemetri Real-Time & Dev Generator Fallback
```

---

## 3. Menu Perintah Pintas (Slash Commands)

| Command | Penjelasan | Fungsi Operasional |
|---|---|---|
| `/start` | Mulai bot & aktivasi akun | Mengaitkan akun Telegram via token invite atau memeriksa status registrasi. |
| `/help` | Panduan & daftar trigger alert | Memaparkan ringkasan 6 pemicu alert dan contoh pertanyaan yang didukung. |
| `/rating` | Leaderboard & skor rating cabang | Menampilkan rangkuman skor Google Reviews seluruh cabang dan top 3 terbaik. |
| `/negatif` | Ulasan negatif (1-2⭐) terbaru | Menampilkan keluhan kritis pelanggan terbaru yang membutuhkan respon segera. |
| `/alert` | Peringatan aktif operasional | Memeriksa apakah ada outlet yang mengalami lonjakan ulasan buruk atau penurunan rating. |
| `/outlet [nama]` | Cek performa spesifik outlet | Melihat ringkasan review, rating, dan sentimen untuk outlet tertentu. |
| `/rekap` | Analisis sentimen ulasan | Rekapitulasi persentase sentimen positif, netral, negatif, dan topik komplain utama. |
| `/new` | Mulai sesi percakapan baru | Mereset konteks percakapan AI untuk topik baru. |
| `/id` | Info User ID & Chat ID Anda | Menampilkan detail identitas akun Telegram untuk pendaftaran whitelist. |

---

## 4. 6 Trigger Alert Otomatis Operasional

1. 🔴 **Alert Review Bintang 1-2 Baru Masuk (`LOW_RATING_REVIEW`)**
   - *Pemicu:* Real-Time saat ulasan dengan rating ≤ 2⭐ masuk ke sistem.
   - *Isi Pesan:* Nama cabang, skor rating, nama reviewer, komentar keluhan, dan link Google Maps/Dashboard.
2. ⚠️ **Alert Lonjakan Ulasan Negatif (`NEGATIVE_SPIKE`)**
   - *Pemicu:* Real-Time jika suatu cabang menerima ≥ 3 ulasan rating ≤ 2⭐ dalam rentang waktu 24 jam.
   - *Tindakan:* Peringatan darurat bagi AM/RM untuk segera melakukan audit ke cabang terkait.
3. 📉 **Alert Penurunan Drastis Rating Outlet (`RATING_DROP`)**
   - *Pemicu:* Real-Time jika rata-rata rating 7 hari terakhir turun ≥ 0.3 poin dibanding periode 7 hari sebelumnya.
4. 🚨 **Alert Outlet di Bawah Ambang Minimum (`LOW_OUTLET_RATING`)**
   - *Pemicu:* Real-Time jika akumulasi rating keseluruhan cabang berada di bawah 3.8⭐.
5. 📊 **Rekap Harian Sentimen & Ulasan Pelanggan**
   - *Pemicu:* Cron Harian pukul 09:00 WIB.
   - *Isi Pesan:* Jumlah ulasan baru 24 jam terakhir, persentase ulasan positif vs negatif, dan cabang berkinerja terbaik.
6. 💬 **Pengingat Ulasan Negatif Belum Dibalas**
   - *Pemicu:* Cron Harian pukul 15:00 WIB.
   - *Isi Pesan:* Daftar review bintang 1-2 yang belum mendapatkan draft respon resmi dari tim manajemen/marcom.

---

## 5. Variabel Lingkungan (Environment Variables)

### Di `apps/bot` (Coolify Runtime / `.env.local`):
```env
TELEGRAM_REVIEW_BOT_TOKEN="<token-dari-BotFather>"
TELEGRAM_REVIEW_WEBHOOK_SECRET="<secret-token-opsional>"
TELEGRAM_REVIEW_SEND_SECRET="<secret-antarlayanan-untuk-outbox>"
```

### Di `SukaReview` (`.env.local` / Vercel):
```env
# Opsi A: Kirim langsung via Bot Telegram
TELEGRAM_BOT_TOKEN="<token-dari-BotFather>"
TELEGRAM_CHAT_ID="<chat-id-penerima-alert>"

# Opsi B: Kirim via endpoint outbox apps/bot
TELEGRAM_REVIEW_SEND_URL="https://agents.sukashawarma.com/api/telegram/review/send"
TELEGRAM_REVIEW_SEND_SECRET="<secret-sama-dengan-apps/bot>"
```
