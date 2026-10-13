# Panduan Cron Job Laporan Otomatis ke Telegram

Dokumen ini menjelaskan arsitektur, jadwal, cara pemasangan, dan pemeliharaan laporan terjadwal otomatis (Cron Job) Suka Shawarma ke Grup Telegram Owner & Manajemen.

---

## 1. Gambaran Arsitektur

```
┌─────────────────────────────────┐
│     Systemd User Timers (VPS)   │
│  (07:00 WIB, 11:00 WIB, 22:00)  │
└────────────────┬────────────────┘
                 │ Memicu eksekusi
                 ▼
┌─────────────────────────────────┐
│   kirim-laporan-telegram.py     │
└────────┬────────────────────────┘
         │
         ├───► 1. Ambil data terverifikasi (JSON-RPC)
         │        via https://admin.sukashawarma.com/api/hermes/mcp
         │        (Rumus 100% identik dengan layar dashboard & bebas halusinasi)
         │
         └───► 2. Kirim pesan langsung ke Telegram
                  POST https://api.telegram.org/bot<TOKEN>/sendMessage
                  (Teks rapi, bersih, tanpa footer bungkusan bawaan bot)
                 │
                 ▼
┌─────────────────────────────────┐
│  Grup Telegram Owner/Manajemen  │
└─────────────────────────────────┘
```

### Keunggulan Metode Ini:
1. **Menggunakan Bot Telegram yang Sudah Ada:** Menggunakan token `@BotFather` yang telah aktif di VPS profil `ceo` (`TELEGRAM_BOT_TOKEN`).
2. **Pesan Bersih & Eksekutif:** Dikirim langsung ke Telegram Bot API sehingga bebas dari bungkusan `"Cronjob Response / To stop or manage this job..."` bawaan Hermes agent.
3. **Data Presisi 100%:** Angka omzet, transaksi, menu, dan presensi bersumber dari server MCP pusat, bukan hasil karangan AI model.
4. **Tahan Gangguan (Resilient):** Dikelola oleh Systemd user timer dengan `Persistent=true`. Jika VPS sempat reboot atau mati saat jam laporan, laporan akan langsung terkirim begitu server menyala kembali.

---

## 2. Jadwal & Rekomendasi Waktu Pengiriman

| No | Nama Laporan | Waktu WIB | Waktu UTC (VPS) | Isi Ringkasan |
|---|---|---|---|---|
| 1 | **☀️ Laporan Pagi Penjualan** | **07:00 WIB** | `00:00 UTC` | Omzet kotor kemarin vs hari sama minggu lalu, total transaksi, outlet tertinggi & terendah, outlet tanpa penjualan, 3 menu terlaris. |
| 2 | **👥 Rekap Presensi Kru (HRD)** | **11:00 WIB** | `04:00 UTC` | Total staf terjadwal, jumlah hadir tepat waktu, rincian staf telat (nama, outlet, menit telat, jam masuk), serta staf izin/cuti/sakit. |
| 3 | **🌙 Laporan Penutupan Malam** | **22:00 WIB** | `15:00 UTC` | Rekap closing omzet hari ini (cut-off 22:00 WIB), perbandingan dengan minggu lalu, top 5 outlet hari ini, menu terlaris hari ini. |

### 💡 Saran Laporan Tambahan (Bisa Diaktifkan Menyusul):
- **Laporan Logistik & Surat Jalan Gudang (Pukul 08:30 WIB):**
  Mendeteksi Surat Jalan (SJ) yang telah dikirim kemarin namun belum diverifikasi/diterima oleh outlet (mencegah selisih fisik) serta peringatan bahan baku kritis di gudang pusat.
- **Executive Summary Mingguan (Setiap Senin Pukul 07:30 WIB):**
  Rangkuman performa 1 pekan penuh (Senin s/d Minggu) dibandingkan dengan pekan sebelumnya, pertumbuhan omzet antar-outlet, dan outlet dengan performa terbaik mingguan.
- **Ringkasan OPEX & Kas Kecil (Setiap Jumat Pukul 17:00 WIB):**
  Total pengeluaran kas kecil outlet dan kantor pusat yang telah terverifikasi dalam 1 minggu berjalan untuk kontrol arus kas operasional.

---

## 3. Cara Mendapatkan Chat ID Grup Telegram

Agar bot dapat mengirim pesan ke grup Telegram Owner:
1. Pastikan Bot Telegram Anda sudah dimasukkan ke dalam grup tersebut sebagai anggota (atau admin).
2. Kirim sembarang pesan di grup tersebut (misal: "tes bot").
3. Buka browser dan akses URL berikut (ganti `<TOKEN>` dengan bot token Anda):
   ```text
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. Cari objek JSON `"chat"`:
   ```json
   "chat": {
     "id": -1001234567890,
     "title": "Grup Owner & Manajemen Suka Shawarma",
     "type": "supergroup"
   }
   ```
5. Salin angka ID tersebut (biasanya diawali tanda minus, misal: `-1001234567890`).

---

## 4. Konfigurasi di VPS Hostinger

Semua konfigurasi disimpan di file `.env` profil bot CEO agar aman dan terpusat:
`~/.hermes/profiles/ceo/.env`

Pastikan variabel-variabel berikut terisi:
```bash
# Token Bot Telegram dari @BotFather
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz

# Target Chat ID Grup Telegram Owner
TELEGRAM_CHAT_ID=-1001234567890

# Kunci MCP Suka Shawarma (dari admin-dashboard Sistem -> Kunci Hermes)
SUKA_MCP_KEY=hms_ceo_xxxxxxxxxxxxxxxxxxxx
```

---

## 5. Cara Aktivasi Otomatis (1 Perintah)

Login ke VPS sebagai user `suka-hermes`:
```bash
su - suka-hermes
cd ~/DIGITALISASI-SS-PROJECT   # atau folder repo Anda
git pull origin main
```

Jalankan skrip pemasangan otomatis:
```bash
./scripts/hermes/pasang-cron-laporan.sh
```

Skrip ini akan otomatis:
1. Memasang executable `kirim-laporan-telegram.py` ke `~/bin/`.
2. Memasang file service dan timer ke `~/.config/systemd/user/`.
3. Memeriksa keberadaan `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID`.
4. Mengaktifkan 3 timer laporan (`suka-laporan-pagi`, `suka-laporan-absensi`, `suka-laporan-malam`).

---

## 6. Perintah Pengujian & Pemeliharaan

### Menguji Pengiriman Langsung ke Telegram
```bash
# 1. Tes koneksi bot ke grup Telegram (pesan uji)
~/bin/kirim-laporan-telegram.py --jenis test

# 2. Uji kirim Laporan Pagi sekarang
~/bin/kirim-laporan-telegram.py --jenis pagi

# 3. Uji kirim Rekap Presensi Kru sekarang
~/bin/kirim-laporan-telegram.py --jenis absensi

# 4. Uji kirim Laporan Penutupan Malam sekarang
~/bin/kirim-laporan-telegram.py --jenis malam
```

### Uji Tanpa Mengirim (Dry-Run)
Untuk memeriksa tampilan teks di terminal tanpa mengirim ke Telegram:
```bash
~/bin/kirim-laporan-telegram.py --jenis pagi --dry-run
~/bin/kirim-laporan-telegram.py --jenis absensi --dry-run
~/bin/kirim-laporan-telegram.py --jenis malam --dry-run
```

### Memeriksa Jadwal Timer Berikutnya
```bash
systemctl --user list-timers "suka-laporan-*"
```
Output akan menampilkan kapan timer akan berjalan berikutnya dan berapa jam lagi.

### Melihat Log Eksekusi
```bash
# Log Laporan Pagi
journalctl --user -u suka-laporan-pagi --since "24 hours ago" --no-pager

# Log Presensi
journalctl --user -u suka-laporan-absensi --since "24 hours ago" --no-pager

# Log Penutupan Malam
journalctl --user -u suka-laporan-malam --since "24 hours ago" --no-pager
```

---

## 7. Penanganan Kendala (Troubleshooting)

| Gejala | Penyebab Umum | Solusi |
|---|---|---|
| `HTTP 400 Bad Request` dari Telegram API | `TELEGRAM_CHAT_ID` salah format atau Bot belum dimasukkan ke grup | Pastikan bot sudah di-invite ke grup dan format ID diawali tanda minus `-100...`. |
| `HTTP 401 Unauthorized` dari Telegram API | `TELEGRAM_BOT_TOKEN` salah atau dicabut | Periksa kembali token dari `@BotFather`. |
| `HTTP 403 Forbidden` dari server MCP | IP VPS belum terdaftar di allowlist kunci Hermes | Buka admin-dashboard **Sistem -> Kunci Hermes**, masukkan IP `76.13.193.138` ke kunci terkait. |
| `Timer inactive` setelah reboot VPS | Sesi systemd user belum di-linger | Jalankan sebagai root: `loginctl enable-linger suka-hermes`. |
