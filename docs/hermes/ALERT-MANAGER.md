# Alert Telegram Bot Manager (Area Manager & Regional Manager)

Penerima alert adalah staf aktif dengan role database `area_manager`, `regional_manager`, atau `developer`, serta memiliki akun Telegram yang tertaut di `public.bot_telegram_links`.

Pemeriksaan hak akses dan kepemilikan outlet dilakukan secara berjenjang:
- **Area Manager (AM)**: Hanya menerima alert terkait outlet yang menjadi wewenang binaannya (berdasarkan relasi `public.staff_outlets`).
- **Regional Manager (RM)**: Menerima alert eskalasi bernilai tinggi atau keterlambatan parah di seluruh cabang operasional aktif.

---

## Matriks Ringkasan Alert & Notifikasi

| No | Kategori Alert | Area Manager (AM) | Regional Manager (RM) | Pemicu (Trigger) & Jadwal | Link Aksi |
|:---|:---|:---:|:---:|:---|:---|
| 1 | **Keterlambatan Buka Outlet** | ✅ Ya | ✅ Eskalasi | • AM: Terlambat > 5 menit dari jadwal buka<br>• RM: Eskalasi keterlambatan parah $\ge 30$ menit | `manager.sukashawarma.com` |
| 2 | **Selisih Kas Closing Kasir** | ✅ Ya | ✅ Eskalasi | • AM: Selisih Rp 20.000 s/d Rp 100.000<br>• RM: Selisih kritis $>$ Rp 100.000 | `/transactions` |
| 3 | **Pengajuan Waste Bahan** | ✅ Ya | ✅ Eskalasi | • AM: Nilai waste $\le$ Rp 150.000<br>• RM: Eskalasi nilai besar $>$ Rp 150.000 | `/waste` |
| 4 | **Sidak Ceklist Harian** | ✅ Konfirmasi | ✅ Review | • RM: Saat AM menyelesaikan sidak cabang<br>• AM: Saat RM memberikan evaluasi/catatan balik | `/audit` |
| 5 | **Monitoring Stok Opname** | ✅ Ya | ✅ Eskalasi | • 21:30 WIB: Status cabang (SUDAH/DRAFT/BELUM)<br>• 22:30 WIB: Final cut-off cabang belum opname | `/stock/opname` |
| 6 | **Alert Stok Kritis (ROP)** | ✅ Ya | — | • Otomatis saat saldo stok jatuh di bawah reorder point | `/stock` |
| 7 | **Pengajuan Retur Bahan** | ✅ Ya | ✅ Ya | • Saat cabang mengajukan retur fisik ke gudang/vendor | `/approvals` |
| 8 | **Laporan Omzet Terjadwal** | ✅ Ya (Per-Area) | ✅ Ya (Regional) | • 15:00 WIB (Pasca Lunch Rush)<br>• 19:30 WIB (Puncak Dinner Rush)<br>• 22:30 WIB (Final Closing Harian) | `manager.sukashawarma.com` |

---

## Fitur Tahap 1

### 1. Alert Keterlambatan Buka Outlet (+5 Menit)
- **Kondisi Deteksi:**
  - Jadwal buka outlet diambil dari `outlet_attendance_shift` (urutan 1) atau `outlet_attendance_config.jam_masuk`, fallback ke `10:00:00` WIB.
  - Tepat 5 menit setelah jam buka (misal jadwal 10:00, pada 10:05 WIB):
    - Jika belum ada shift kasir yang dibuka (`shifts.status IN ('open', 'closed')` hari ini), **DAN**
    - Belum ada kru yang melakukan absensi masuk (`attendance.ts_server` hari ini bukan alpha),
    - Sistem langsung mengantrekan alert ke **Area Manager** yang membina outlet tersebut.
- **Eskalasi RM (>30 Menit):**
  - Jika keterlambatan berlanjut hingga >= 30 menit, sistem mengirimkan alert eskalasi ke seluruh **Regional Manager** aktif.
- **Idempotensi:** Alert hanya dikirim 1x per outlet per hari (`telat_buka:<outlet_id>:<tanggal>`).

### 2. Alert Selisih Kas Closing Kasir (Cash Variance)
- **Kondisi Deteksi:**
  - Dipicu saat shift kasir ditutup (`shifts.status` berubah dari `open` menjadi `closed`).
  - Menghitung nilai selisih absolut terbesar antara kas laci (`variance`) dan petty cash (`petty_cash_variance`).
- **Toleransi Berjenjang:**
  - **<= Rp 20.000:** Dianggap batas toleransi wajar, tidak memicu alert.
  - **> Rp 20.000 s/d Rp 100.000:** Peringatan dikirim ke **Area Manager** pembina outlet terkait.
  - **> Rp 100.000:** Alert kritis dikirim ke **Area Manager** dan otomatis dieskalasi ke seluruh **Regional Manager** aktif.
- **Isi Pesan Telegram:**
  - Nama Outlet, Nama Kasir penutup shift, Waktu Closing, Nominal Selisih Laci (+/-), Nominal Selisih Petty Cash (+/-), dan Catatan penutupan kasir.
  - Dilengkapi tombol inline URL ke `https://manager.sukashawarma.com/transactions`.

---

## Fitur Tahap 2

### 3. Alert Pengajuan Waste Bahan Baku
- **Kondisi Deteksi:**
  - Terpicu otomatis saat staf dapur/outlet mengajukan laporan waste baru di POS/Stok (`stok_waste_reports` dengan status `PENDING`).
  - Sistem otomatis mengecek master data harga bahan baku (`bahan_baku_harga`) untuk menghitung estimasi nilai kerugian rupiah (`qty * harga_beli`).
- **Toleransi & Penerima:**
  - **Standar (<= Rp 150.000):** Notifikasi pengajuan dikirimkan langsung ke **Area Manager (AM)** yang membina outlet bersangkutan.
  - **Eskalasi Bernilai Tinggi (> Rp 150.000):** Notifikasi dikirimkan ke **Area Manager (AM)** dan otomatis dieskalasi ke seluruh **Regional Manager (RM)**.
- **Isi Pesan Telegram:**
  - Memuat nama outlet, nama bahan baku, jumlah/satuan, estimasi kerugian Rp, alasan waste, staf pelapor, jam laporan, dan tombol link ke `https://manager.sukashawarma.com/waste`.

### 4. Notifikasi Laporan Sidak Ceklist Harian AM (ke RM)
- **Kondisi Deteksi:**
  - Saat Area Manager menyelesaikan dan mengirimkan ceklist sidak harian (`submit_ceklist_harian`) melalui aplikasi.
- **Penerima:**
  - Seluruh **Regional Manager (RM)** aktif menerima notifikasi ringkasan langsung di Telegram.
- **Isi Pesan Telegram:**
  - Nama outlet yang disidak, nama AM yang melakukan sidak, poin penilaian yang berstatus 'Perhatian' atau 'Buruk', daftar temuan fisik di lapangan, serta tautan ke Manager Dashboard untuk meninjau dan menyetujui.
- **Konfirmasi Balik ke AM:**
  - Saat Regional Manager menandai review/persetujuan pada ceklist (`tinjau_ceklist_harian`), Area Manager yang bersangkutan menerima notifikasi konfirmasi di Telegram beserta catatan/tanggapan dari RM.

---

## Fitur Tahap 3

### 5. Monitoring Status Stok Opname Harian (Sudah / Belum SO)
- **Jadwal & Perilaku:**
  - **Pukul 21:30 WIB (Pra-Closing Monitoring):** Mengirimkan digest status per area ke Area Manager, merinci cabang mana yang **SUDAH OPNAME** (finalized), **SEDANG DRAFT**, dan **BELUM OPNAME** sama sekali.
  - **Pukul 22:30 WIB (Final Cut-Off Alert):** Jika masih ada cabang yang belum selesai opname fisik, bot mengirimkan alert peringatan darurat ke AM dan melakukan eskalasi rekap ke **Regional Manager (RM)**.
- **Tautan Aksi:** Dilengkapi link ke dashboard kepatuhan stok opname.

### 6. Alert Stok Kritis (Out-of-Stock Risk)
- **Kondisi Deteksi:**
  - Terpicu via trigger pada saat mutasi/pengurangan stok di `stok_balance`.
  - Jika saldo bahan baku berada di bawah ambang batas *reorder point* (`outlet_reorder_point` atau default bahan).
  - Tidak mengirimkan alert berulang (anti-spam) jika saldo sebelumnya memang sudah berada di bawah ambang batas.
- **Penerima:** **Area Manager (AM)** pengawas cabang terkait.

### 7. Alert Pengajuan Retur Bahan Baku ke Gudang/Vendor
- **Kondisi Deteksi:**
  - Terpicu saat cabang mengajukan retur bahan baku (`retur_stok` berstatus `diajukan`).
- **Penerima:**
  - **Area Manager (AM)** untuk verifikasi awal fisik bahan.
  - **Regional Manager (RM)** untuk otorisasi koordinasi penjemputan logistik dan penggantian stok.
- **Tautan Aksi:** Langsung menuju halaman `https://manager.sukashawarma.com/approvals`.

---

## Fitur Tahap 4

### 8. Otomasi Laporan Omzet Terjadwal (Sales Broadcast)
- **Interval Terjadwal (~4 Jam Sekali):**
  - **15:00 WIB (Siang / Pasca Lunch Rush):** Memantau ritme penjualan awal hari dan progres menu best seller siang.
  - **19:30 WIB (Puncak Dinner Rush):** Memantau performa penjualan jam tersibuk menjelang pergantian shift malam.
  - **22:30 WIB (Final Closing Harian):** Rekapitulasi total pencapaian omzet, total pcs terjual, dan persentase capaian target hari ini.
- **Hierarki Konten Pesan:**
  - **Untuk Area Manager (AM):**
    - Ringkasan total omzet area binaan dan total pcs terjual.
    - Breakdown detail per-outlet binaan (omzet, pcs, dan % capaian terhadap `daily_sales_targets`).
    - Membantu AM mengidentifikasi cabang yang underperforming atau butuh dorongan promosi lokal secara real-time.
  - **Untuk Regional Manager (RM):**
    - Executive summary total omzet seluruh regional dan total pcs terjual.
    - Leaderboard perbandingan performa antar area binaan AM (peringkat omzet area, kontribusi outlet, dan persentase target regional).
- **Idempotensi & Concurrency:**
  - Dilindungi advisory lock `bot-manager-omzet-<sesi>`.
  - Event key unik harian: `omzet_am:<sesi>:<am_id>:<tanggal>` dan `omzet_rm:<sesi>:<rm_id>:<tanggal>`.
- **Tautan Aksi:** Dilengkapi tombol link ke `https://manager.sukashawarma.com`.

---

## Aktivasi & Konfigurasi

### 1. Endpoint Bot (`apps/bot`)
Endpoint pengiriman tersedia di `/api/telegram/manager/send`.
Environment variable runtime server:
- `TELEGRAM_MANAGER_BOT_TOKEN`: Token bot Telegram Manager (opsional, jika tidak disetel otomatis fallback ke `TELEGRAM_STOKIST_BOT_TOKEN`).
- `TELEGRAM_MANAGER_SEND_SECRET`: Secret antarlayanan (opsional, fallback ke `TELEGRAM_STOKIST_SEND_SECRET`).

### 2. Supabase Vault (Opsional Override)
Jika ingin memisahkan token/URL khusus bot Manager:
- `telegram_manager_send_url`: `https://agents.sukashawarma.com/api/telegram/manager/send`
- `telegram_manager_send_secret`: Secret bearer auth

*Catatan: Sistem secara otomatis memanfaatkan konfigurasi secret stokist yang sudah ada jika secret manager belum disetel di Vault.*

### 3. Database Migration
Terapkan migrasi berurutan:
1. `supabase/migrations/20300254003200_manager_telegram_alerts.sql` (Tahap 1: Pondasi Outbox, Late Opening +5m, Cash Variance)
2. `supabase/migrations/20300254003300_manager_waste_and_checklist_alerts.sql` (Tahap 2: Waste Reports, Sidak Ceklist Harian AM/RM)
3. `supabase/migrations/20300254003400_manager_stok_opname_and_retur_alerts.sql` (Tahap 3: Status Stok Opname, Stok Kritis, Approval Retur)
4. `supabase/migrations/20300254003500_manager_sales_broadcast_alerts.sql` (Tahap 4: Otomasi Laporan Omzet Terjadwal 3x Sehari)

Cron scheduler berjalan otomatis:
- `bot-manager-cek-telat-buka`: Berjalan setiap 5 menit pada jam operasional pagi (01:00-06:00 UTC = 08:00-13:00 WIB).
- `bot-manager-delivery`: Berjalan setiap menit memproses antrean pesan outbox.
- `bot-manager-opname-pra-closing`: Berjalan setiap hari pukul 21:30 WIB (14:30 UTC).
- `bot-manager-opname-cutoff`: Berjalan setiap hari pukul 22:30 WIB (15:30 UTC).
- `bot-manager-omzet-siang`: Berjalan setiap hari pukul 15:00 WIB (08:00 UTC).
- `bot-manager-omzet-dinner`: Berjalan setiap hari pukul 19:30 WIB (12:30 UTC).
- `bot-manager-omzet-closing`: Berjalan setiap hari pukul 22:30 WIB (15:30 UTC).

---

## Verifikasi & Pengujian

### 1. Test Endpoint (`apps/bot`)
```bash
yarn workspace @suka/bot test
yarn workspace @suka/bot type-check
```

### 2. Test SQL Outbox & Trigger
```bash
psql -v ON_ERROR_STOP=1 -d ss_hrd_alert_test -f supabase/verifikasi/hermes/t8_manager_alerts.sql
psql -v ON_ERROR_STOP=1 -d ss_hrd_alert_test -f supabase/verifikasi/hermes/t9_manager_waste_checklist_alerts.sql
psql -v ON_ERROR_STOP=1 -d ss_hrd_alert_test -f supabase/verifikasi/hermes/t10_manager_stok_opname_retur_alerts.sql
psql -v ON_ERROR_STOP=1 -d ss_hrd_alert_test -f supabase/verifikasi/hermes/t11_manager_sales_broadcast_alerts.sql
```

---

## Pemantauan Antrean
```sql
SELECT outcome, count(*), min(created_at) AS paling_lama
FROM public.bot_manager_alert_outbox
GROUP BY outcome;
```
