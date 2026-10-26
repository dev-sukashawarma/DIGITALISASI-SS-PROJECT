# Laporan WhatsApp untuk Area Manager — Status Opname & Reminder Setor Tunai

**Tanggal:** 2026-10-26
**Status:** Fungsi & antrean live (20261026160000); jadwal cron belum aktif (20261026160100)
**Pengirim:** device GOWA `AM_REMINDER` (6283832676624) di `blast.sukashawarma.com`

## 1. Tujuan

Setiap Area Manager (AM) menerima dua laporan otomatis lewat WhatsApp, berisi
semua outlet binaannya:

1. **Status opname harian** — outlet mana yang sudah opname (dan jam berapa),
   masih draft, atau belum.
2. **Reminder setor tunai** — omzet tunai per outlet yang wajib disetor, total
   tunai, dan total omzet semua kanal sebagai informasi.

## 2. Keputusan owner (2026-10-26)

| # | Keputusan |
|---|---|
| K1 | Reminder setor menampilkan **omzet tunai** per outlet (yang wajib disetor) + total tunai **saja**. (Baris "total omzet semua kanal" sempat ada, dibuang 2026-10-26 di `20261026170000` atas permintaan owner.) |
| K2 | Pola setor **H+1**: omzet hari Senin disetor hari Selasa, dst. Reminder dikirim **08:00 WIB** hari setor, berisi omzet hari sebelumnya. |
| K3 | Status opname dikirim **21:30 WIB** (progres semua outlet) dan **22:30 WIB** (cut-off, hanya bila masih ada outlet yang belum selesai). |

## 3. Kondisi sekarang (diukur di DB produksi 2026-10-26)

- **Bot Telegram AM sudah ada dan jadwalnya aktif**
  (`bot-manager-opname-pra-closing`, `-opname-cutoff`, `-omzet-siang/dinner/closing`),
  tetapi **0 dari 398 pesan pernah terkirim**: kelima AM tidak punya
  `bot_telegram_links.chat_id`. Laporan yang ada tidak pernah sampai ke siapa pun.
- **Rumus omzet bot Telegram salah.** `bot_manager_broadcast_omzet` menjumlah
  `orders.total_amount` setelah `LEFT JOIN order_items`, sehingga satu order
  terhitung sebanyak jumlah itemnya. 25 Okt 2026: bot Rp 136.305.896 vs
  sebenarnya Rp 87.454.974 (**+56%**). Rumus ini **tidak boleh** disalin.
- **`opname` tidak punya kolom waktu finalisasi.** Layar Detail Opname memakai
  `updated_at` sebagai pengganti (commit `b3680478c`), yang bergeser bila baris
  disentuh lagi sesudah finalisasi.
- **Pemetaan AM → outlet** ada di `staff_outlets`. Setiap AM juga dipetakan ke
  `KANTOR PUSAT` — wajib disaring.
- **Setoran** tercatat di `cash_transaction` (`source_type='cash_deposit'`,
  `outlet_id`, `sales_date`), baik outlet internal maupun mitra (200 / 202 baris,
  30 hari terakhir). Finance mencatatnya terlambat: per 26 Okt, sales_date
  22–23 Okt hanya 3 baris, 24–25 Okt nol.
- **Nomor AM** di `outlet_staff.phone`, kelima nomor sudah diuji kirim lewat
  `AM_REMINDER` (Chairul Rizky diperbaiki ke 081367472113 pada 2026-10-26).

## 4. Arsitektur

```
pg_cron (UTC)
  ├─ 14:30 UTC (21:30 WIB) → wa_am_susun_status_opname(false)
  ├─ 15:30 UTC (22:30 WIB) → wa_am_susun_status_opname(true)
  └─ 01:00 UTC (08:00 WIB) → wa_am_susun_reminder_setor()
                     │
                     ▼  satu baris per AM per laporan per tanggal
              wa_am_outbox  (event_key UNIQUE = idempoten)
                     │
  └─ * * * * *  wa_am_kirim_antrean()  → pg_net POST GOWA /send/message
                                          (X-Device-Id: AM_REMINDER)
  └─ * * * * *  wa_am_catat_respons()  → baca net._http_response → sent / retry / failed
```

### 4.1 Kenapa di database, bukan di app HR

- Pola yang sama dengan bot Telegram yang sudah jalan (antrean + pg_net + cron),
  jadi tidak menambah endpoint, secret, atau ketergantungan pada uptime app HR.
- Agregasi omzet & opname memang harus di SQL (aturan performa proyek); hanya
  teks jadi yang keluar ke GOWA.
- Volume kecil: maksimal ±15 pesan/hari (5 AM × 3 laporan), jadi fitur
  anti-spam `waha.ts` (simulasi mengetik, jeda acak) tidak diperlukan. Worker
  tetap mengirim maksimal **1 pesan per AM per putaran** dan memberi jeda.

### 4.2 Antrean khusus WA, terpisah dari `bot_manager_antrekan`

`bot_manager_antrekan` dipanggil juga oleh alert stok kritis, void, retur, izin
mendadak, dll. Menambahkan WA di sana akan membanjiri nomor `AM_REMINDER` dan
berisiko diblokir WhatsApp. Laporan WA punya penyusun dan antrean sendiri;
bot Telegram dan notifikasi HP tidak diubah.

## 5. Komponen

### 5.1 Migration skema

- **`opname.finalized_at timestamptz`** + trigger `BEFORE UPDATE OF status`:
  isi `now()` saat status berubah ke `finalized` (hanya bila masih NULL).
  Backfill baris lama dari `updated_at` (ditandai sebagai perkiraan di komentar
  kolom).
- **`wa_am_outbox`**:
  `id`, `event_key text`, `staff_id uuid`, `phone text` (sudah dinormalisasi
  `628…`), `jenis text` (`opname_progres` | `opname_cutoff` | `setor_tunai`),
  `body text`, `status text` (`pending` | `sending` | `sent` | `failed`),
  `attempts int`, `request_id bigint`, `message_id text`, `last_error text`,
  `created_at`, `sent_at`. UNIQUE `(event_key, staff_id)`.
  RLS aktif, `REVOKE ALL FROM anon, authenticated`; baca untuk
  `is_owner_or_admin()` (pemantauan).
- **Kredensial GOWA di Vault** (`gowa_base_url`, `gowa_basic_auth`). Tidak
  ditulis di migration.

### 5.2 `wa_am_susun_status_opname(p_cutoff boolean)`

Untuk setiap AM `role='area_manager' AND status='active'` dengan `phone` terisi:

- Outlet binaan dari `staff_outlets`, disaring `is_active`, tipe bukan
  `test`/`marketplace`/`system`/`office`, bukan Kantor Pusat/gudang
  (selaras `outlet_ids_terhitung()`).
- Status per outlet dari `opname` `tanggal = hari ini WIB`, `tipe = 'harian'`:
  `finalized` → ✅ + jam `finalized_at` WIB · `draft`/`pending` → ⏳ ·
  tidak ada → ❌.
- Cut-off: AM yang semua outletnya sudah ✅ tidak dikirimi.

Contoh:

```
*Status Opname — Senin, 26 Okt 2026 (21:30)*
Area: Tri Rizky · 2/3 selesai

✅ MITRA CILEUNGSI — 20:41
✅ SUKA SHAWARMA DEPOK SUKMAJAYA — 21:05
❌ MITRA CIBUBUR — belum opname

Mohon dipastikan selesai sebelum 22:30.
```

### 5.3 `wa_am_susun_reminder_setor()`

Tanggal jual = **kemarin WIB** (K2). Per outlet binaan (saringan sama):

- **Tunai** = `SUM(orders.total_amount)` `status='completed'`,
  `payment_method='cash'`, tanggal jual WIB = kemarin. Tanpa join ke
  `order_items` (penyebab bug bot Telegram).
- **Total semua kanal** = Omzet Kotor acuan tunggal
  (`total_amount + potongan`, sama dengan `sales_daily_spv` /
  Ringkasan Penjualan), dikecualikan outlet tes.
- Outlet dengan tunai 0 tetap ditulis (`Rp 0`) agar AM tahu tidak ada yang
  perlu disetor. Outlet tanpa transaksi sama sekali ditulis "tidak ada
  penjualan".

Contoh (angka nyata 25 Okt 2026):

```
*Reminder Setor Tunai — Senin, 26 Okt 2026*
Omzet Minggu, 25 Okt · Area: Tri Rizky

MITRA CILEUNGSI           Rp 1.937.000
SUKA SHAWARMA DEPOK SUKMAJAYA  Rp 222.000
MITRA CIBUBUR             Rp 146.000
───────────────
*Total tunai disetor:  Rp 2.305.000*
Total omzet semua kanal: Rp 13.941.780

Mohon segera disetor hari ini.
```

### 5.4 `wa_am_kirim_antrean()` & `wa_am_catat_respons()`

- Ambil maksimal 5 baris `pending` (atau `failed` dengan `attempts < 3` dan
  jeda backoff 2/5/15 menit), ubah ke `sending`, panggil `net.http_post` ke
  `{gowa_base_url}/send/message` dengan header `Authorization: Basic …`,
  `X-Device-Id: AM_REMINDER`, dan **`User-Agent` tetap** (Cloudflare menolak
  User-Agent bawaan pg_net, lihat `20300254002500`).
- Penerima ditulis sebagai `628…@s.whatsapp.net`.
- Respons: HTTP 200 + `code=SUCCESS` → `sent` + `message_id`;
  `INVALID_JID` → `failed` permanen (nomor salah, tidak di-retry);
  lainnya → `attempts+1`, retry. Setelah 3 kali gagal, satu alert ke developer
  lewat kanal bot yang sudah ada.
- `pg_try_advisory_xact_lock` agar dua putaran cron tidak mengirim baris yang
  sama.

## 6. Keamanan

- Semua fungsi `SECURITY DEFINER SET search_path = public`, `REVOKE` dari
  `PUBLIC, anon, authenticated`; hanya dijalankan pg_cron.
- Kredensial GOWA hanya di Vault. **Tindak lanjut terpisah:** `admin:sukashawarma2026`
  saat ini tertulis di `apps/HR/src/lib/waha.ts`, `apps/admin-dashboard/src/lib/waha.ts`
  (repo) dan compose Coolify — ganti password GOWA, lalu ambil dari env saja.
- Isi pesan hanya angka omzet & status outlet milik AM itu sendiri; tidak ada
  data lintas area.

## 7. Pengujian & verifikasi

- Uji SQL di transaksi `ROLLBACK`: penyusun menghasilkan tepat satu baris per
  AM, outlet Kantor Pusat tidak muncul, angka tunai = `SUM(total_amount)` order
  tunai (kontrol negatif: rumus dengan `JOIN order_items` harus berbeda).
- Idempoten: menjalankan penyusun dua kali tidak menambah baris.
- `finalized_at` terisi saat finalisasi dan tidak berubah saat `updated_at`
  berubah lagi.
- Uji kirim nyata ke satu nomor dulu (owner/dev) sebelum cron untuk kelima AM
  diaktifkan.
- Ukur waktu eksekusi penyusun (`EXPLAIN ANALYZE`); target < 500 ms.

## 8. Rollout

1. Migration skema + fungsi, cron **nonaktif**.
2. Simpan kredensial di Vault; jalankan penyusun manual, kirim ke nomor uji.
3. Aktifkan tiga jadwal + worker.
4. Pantau `wa_am_outbox` 3 hari pertama.

## 9. Di luar lingkup / pertanyaan terbuka

- **Bot Telegram AM** dibiarkan apa adanya (tidak pernah terkirim). Rumus omzetnya
  yang salah perlu diperbaiki atau jadwal Telegram-nya dimatikan — keputusan
  terpisah.
- **Status "sudah/belum setor"** tidak dimasukkan ke reminder 08:00: pada jam
  itu setoran tanggal jual H belum mungkin tercatat, dan finance mencatat
  terlambat beberapa hari (22–25 Okt hampir kosong). Laporan tunggakan setor
  baru masuk akal setelah pencatatan finance tepat waktu.
- Hari tanpa operasional/libur: reminder tetap terkirim dengan "tidak ada
  penjualan".
