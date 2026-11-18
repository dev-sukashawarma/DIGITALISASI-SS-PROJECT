# Validasi Xendit di Histori Transaksi — Desain

Tanggal: 2026-11-18 · Status: menunggu persetujuan

## 1. Maksud & alasan

Pesanan website (sistem Order Online, Supabase project **FormOrder_SS**, masuk ke POS sebagai
`orders.sales_source = 'online'` dengan `external_order_id` = id pesanan Order Online) dibayar lewat
Xendit. **Aturan owner (18 Nov 2026): untuk pesanan website, data Xendit adalah kebenaran.**

Rekonsiliasi Oktober dilakukan manual (CSV Balance History Xendit dicocokkan per nominal + jam)
dan menemukan 4 pembayaran yang tak pernah jadi pesanan POS, 1 bayar dobel, dan 1 total POS yang
salah. Akar bug-nya (webhook ditolak 401) sudah diperbaiki 18 Nov, tapi tidak ada tempat di
aplikasi untuk **melihat** apakah tiap pesanan website benar-benar sudah ada uangnya di Xendit.

Fitur ini menaruh status itu di **Histori Transaksi Detail** (halaman Rangkuman Penjualan), lengkap
dengan ID transaksi Xendit dan nomor referensi QRIS, supaya POS dan Xendit bisa dibuktikan cocok
per pesanan tanpa kerja manual.

## 2. Tujuan, bukan tujuan, anti-tujuan

**Tujuan**
- Tiap pesanan website di Histori Transaksi Detail punya status Xendit: ✓ Terverifikasi /
  ⏳ Belum / ⚠ Selisih, plus ID transaksi Xendit dan nomor referensi QRIS (bisa disalin).
- Filter "Xendit" di histori (Semua / Terverifikasi / Belum / Selisih / Hanya di Xendit), hanya
  muncul bila filter Sumber berisi Website.
- Pembayaran Xendit yang **tidak punya pesanan POS** tampil sebagai baris "⚠ Hanya di Xendit".
- Pesanan baru terverifikasi **otomatis** saat Xendit mengonfirmasi lunas.
- Unggah file Xendit (bulanan) untuk mengisi data lama (Oktober, November) dan menangkap yang lolos.

**Bukan tujuan**
- Tidak mengoreksi pesanan otomatis (tambah/batal/ubah total tetap keputusan manusia, seperti
  koreksi Oktober).
- Tidak memproses refund atau mencatat biaya Xendit ke laporan.
- Tidak mencakup aplikasi pelanggan (`retail.order_drafts`, `sales_source='app'`) — bisa menyusul.
- Tidak menyentuh food apps / platform settlement yang sudah ada.

**Anti-tujuan (gagal walau "jalan")**
- Angka omzet, KPI, ekspor, atau laporan apa pun **berubah** karena fitur ini. Status Xendit murni
  label; baris "Hanya di Xendit" **tidak ikut** total, hitungan transaksi, maupun ekspor omzet.
- Salah cocok diam-diam: satu pembayaran Xendit dipasangkan ke dua pesanan, atau pencocokan lewat
  nominal+jam ditampilkan seyakin pencocokan lewat ID.
- Kunci rahasia Xendit atau service role key FormOrder masuk ke admin-dashboard / browser.

## 3. Kondisi sekarang (yang relevan)

- **Order Online (FormOrder_SS):** `orders.tripay_reference` menyimpan ID payment request Xendit
  (`pr-…`); `tripay_merchant_ref` = `reference_id` kita (`SUKA-…`). Edge function `xendit-webhook`
  (v29, `verify_jwt=false`) dan `check-xendit-status` (polling dari halaman pelanggan) menandai
  lunas. Webhook menulis seluruh payload Xendit ke log (`console.log("Xendit webhook payload:"…)`).
  Cron jobid 1 memanggil `auto-cancel-expired-orders` (v23) yang bertanya ke Xendit dulu.
- **Masuk ke POS lewat tiga jalur:** `apps/pos-kasir/lib/pullOnlineOrder.ts`, edge function
  FormOrder `pull-online-order`, dan `push-order-to-kasir`. Ketiganya membuat `orders` POS dengan
  `external_order_id` = id Order Online, total = total Order Online (sudah termasuk biaya 0,6%).
- **Xendit Balance History CSV** (contoh: `BALANCE_HISTORY_REPORT_20261001_20261031_*.csv`) kolom:
  `Transaction ID, Transaction Type (QR_CODE_PAYMENT / VA_PAYMENT / …Fee / WITHDRAWAL / …),
  Line Type (TRANSACTION/FEE/VAT), Payment Channel, Reference, Amount, Debit or Credit,
  Payment Date, Settlement Date, Channel Reference (RRN QRIS), Description, …`.
  Disusun per tanggal **settlement** (H+2 hari kerja), bukan tanggal bayar.
  Akun Xendit dipakai bersama produk lain: baris `Reference` berawalan `PR-` (PantauReview) dan
  transaksi Rp 1 / Rp 2 (uji) **bukan** penjualan Suka Shawarma.
- **Belum diketahui:** apakah ID di payload webhook (`data.id`, `data.payment_id`,
  `payment_request_id`, `reference_id`) sama dengan salah satu kolom CSV (`Transaction ID` atau
  `Reference`). Referensi Oktober di CSV berbentuk UUID dan tidak cocok dengan `pr-…`/`SUKA-…`
  yang tersimpan. Satu-satunya pesanan Juni yang tercatat webhook menyimpan ID berawalan `qrpy…`.
- **Rangkuman Penjualan** identik di admin-dashboard (`/dashboard/reports/pos`), finance
  (`/laporan/penjualan`), HR (`/penjualan`); admin = sumber, dijaga
  `rangkumanPenjualan.parity.test.ts` di finance & HR. Data dihitung di server
  (`lib/posReport/*`) dengan cache per hari + generasi per tanggal (`bumpDayGenerations`).
  Histori sudah punya pola filter + lencana serupa (filter "Struk", `ReceiptReprintBadge.tsx`).
- Halaman upload serupa sudah ada untuk food apps: `/dashboard/platform-settlement`
  (`app/actions/platformSettlement.ts`) — per outlet per hari, bukan per pesanan.

## 4. Pendekatan

| | Cara | Untung | Rugi |
|---|---|---|---|
| A | Otomatis saja: data Xendit dibawa saat lunas | tanpa kerja manual | tak bisa mendeteksi pembayaran yang tak jadi pesanan (persis kasus Oktober); tak mengisi data lama |
| B | Unggah file saja | menangkap semua kasus, mengisi data lama | flag baru terisi sebulan sekali |
| **C** | **A untuk harian + B untuk pemeriksaan bulanan** | flag langsung untuk pesanan baru, file jadi pengaman | dua jalur pengisian |

**Dipilih: C** (disetujui user 18 Nov).

Cara menyimpan (keputusan desain): data sisi Xendit disimpan di **tabel tersendiri di DB POS**,
satu baris per pembayaran Xendit, ditautkan ke pesanan lewat `external_order_id`. **Tidak**
dititipkan lewat tiga jalur pembuatan pesanan POS, karena itu berarti mengubah tiga tempat dan
pesanan yang dibuat sebelum data Xendit datang tak akan pernah terisi.

## 5. Desain

### 5.1 Data — tabel `xendit_pembayaran` (DB POS)

Satu baris = satu pembayaran masuk di Xendit (baris CSV `Line Type=TRANSACTION`,
`Debit or Credit=CREDIT`, atau satu kiriman webhook sukses).

| Kolom | Isi |
|---|---|
| `id` | uuid |
| `xendit_id` | = kolom CSV `Transaction ID` — UNIQUE. Webhook wajib mengisi nilai yang sama (lihat 5.2) |
| `xendit_ref` | = kolom CSV `Reference` |
| `ref_qris` | `Channel Reference` (RRN, tertera di bukti bayar pelanggan); null untuk VA |
| `nominal` | numeric |
| `dibayar_at` | timestamptz (CSV `Payment Date` WIB / waktu dari webhook) |
| `channel` | QRIS / BRI / MANDIRI / … |
| `external_order_id` | id pesanan Order Online; terisi pasti dari webhook, atau hasil pencocokan file. **Tidak unik** (bayar dobel) |
| `outlet_id`, `nama_pelanggan`, `ringkasan_item` | snapshot dari webhook (5.6); null untuk baris file yang tak tercocokkan |
| `cara_cocok` | `webhook` · `file_id` · `file_nominal_jam` · `manual` · null (belum cocok) |
| `bukan_penjualan` | boolean — `PR-…`, nominal < 1.000, dsb. Disaring dari tampilan |
| `sumber` | `webhook` / `file`; `nama_file`, `diimpor_at`, `diimpor_oleh` |

- Baris dari webhook dan dari file untuk pembayaran yang sama **digabung** lewat `xendit_id`
  (upsert); sumber yang lebih pasti (webhook / ID) tak boleh ditimpa pencocokan nominal+jam.
- RLS: baca = peran yang boleh membuka Rangkuman Penjualan; tulis = hanya service role / server action.
- Tidak menyentuh tabel `orders` (anti-tujuan: omzet tak boleh berubah).

### 5.2 Jalur otomatis (pesanan baru)

1. `xendit-webhook` dan `check-xendit-status` (FormOrder), setelah berhasil menandai lunas,
   meng-upsert satu baris `xendit_pembayaran` ke **DB POS** (keduanya sudah memegang kredensial DB
   POS, seperti `pull-online-order`) dengan `external_order_id` = id pesanan, `cara_cocok='webhook'`.
2. **Langkah pertama pembangunan, sebelum menulis kode pemetaan:** ambil payload webhook asli
   pertama dari log `xendit-webhook`, bandingkan dengan file Xendit bulan itu, dan tetapkan field
   payload mana yang sama dengan kolom CSV mana. `xendit_id` **wajib** ID yang sama di keduanya;
   kalau tidak ada ID yang sama, `check-xendit-status`/webhook memanggil API Xendit untuk
   mengambil ID yang dipakai di laporan. Hasil temuan dicatat di dokumen ini.
3. Gagal menulis ke DB POS tidak boleh menggagalkan webhook (Xendit sudah lunas; tandai lunas di
   Order Online tetap jalan). Kegagalan dicatat ke log; file bulanan menjadi pengaman.

### 5.3 Jalur file (bulanan / data lama)

Halaman **Unggah File Xendit** di admin-dashboard (pola `/dashboard/platform-settlement`;
finance & HR menautkan ke sini seperti tombol Upload Settlement).

1. Parse Balance History CSV: ambil baris `TRANSACTION` + `CREDIT`
   (`QR_CODE_PAYMENT`, `VA_PAYMENT`, …). Fee/VAT/withdrawal diabaikan.
2. Tandai `bukan_penjualan`: `Reference` berawalan `PR-`, atau nominal < 1.000.
3. Upsert per `xendit_id` (unggah ulang file yang sama = tidak dobel).
4. Cocokkan yang belum punya `external_order_id`:
   - **Lewat ID** bila ID di file bisa ditautkan ke pesanan (hasil 5.2 langkah 2).
   - **Lewat nominal + jam** untuk data lama: pesanan website dengan total = nominal dan
     `created_at` dalam jendela [bayar − 20 menit, bayar + 30 menit], pilih yang terdekat;
     satu pesanan hanya boleh dipasangkan ke satu pembayaran. Kalau ada dua kandidat setara,
     **jangan** cocokkan — biarkan untuk dicocokkan manual. Ditandai `file_nominal_jam`.
5. Ringkasan setelah unggah: berapa baris baru, cocok lewat ID, cocok lewat nominal+jam, belum
   cocok, bukan penjualan.
6. Setelah unggah, `bumpDayGenerations` untuk tanggal-tanggal yang terdampak (bila status Xendit
   ikut cache laporan; lihat 5.4).

### 5.4 Tampilan — Histori Transaksi Detail

- Filter baru **"Xendit"** (dropdown, pola filter "Struk"), hanya muncul jika Sumber berisi
  Website: Semua · ✓ Terverifikasi · ⏳ Belum · ⚠ Selisih · ⚠ Hanya di Xendit.
- Lencana per baris pesanan website:
  - **✓ Xendit** — ada pembayaran tertaut dan nominal sama.
  - **⏳ Belum** — tidak ada pembayaran tertaut (file belum diunggah, belum settle, atau hilang).
  - **⚠ Selisih** — tertaut tapi nominal beda; tampilkan dua angkanya.
  - **⚠ Dobel** / **↩ Batal** — lihat 5.6; keduanya masuk filter "Selisih".
  - Pencocokan `file_nominal_jam` tetap ✓ tetapi dengan penanda "dicocokkan lewat nominal & jam".
- Di bawah nama/item: `ID <xendit_id singkat> · Ref QRIS <ref_qris>` + tombol salin.
- Baris **⚠ Hanya di Xendit** (pembayaran tanpa pesanan, `bukan_penjualan=false`) tampil di
  tabel yang sama saat filter Xendit = Semua/Hanya di Xendit, dengan gaya berbeda dan teks
  "tidak ada di POS". **Tidak** dihitung di total, jumlah transaksi, KPI, maupun ekspor omzet.
- Pesanan non-website tidak berlencana.
- Perubahan di `lib/posReport/*` dan komponen histori disalin identik ke finance & HR dan
  didaftarkan di tes paritas.

### 5.5 Akses

Mengikuti akses Rangkuman Penjualan masing-masing app. Unggah file: admin, owner, admin_finance,
developer (cek peran di server action, bukan hanya di halaman).

### 5.6 Aturan pencocokan & kasus khusus (keputusan desainer, hasil review builder)

- **Nominal yang dibandingkan:** `orders.total_amount` POS vs `nominal` Xendit. Keduanya nilai
  kotor yang dibayar pelanggan **termasuk biaya 0,6%** (terbukti Oktober: total POS 78.468 =
  Amount CSV 78.468). Di CSV, `Amount` baris `TRANSACTION` adalah kotor; fee/VAT baris terpisah.
- **Tertaut** = `external_order_id` sama, **apa pun status pesanan POS**. Status ditampilkan:
  - pesanan POS `completed` + nominal sama → **✓ Xendit**;
  - pesanan POS `cancelled` (mis. Cicurug #100, bayar dobel yang direfund) → **↩ Batal**,
    supaya uang yang tidak jadi omzet tetap terlihat. Karena Histori Transaksi hanya memuat
    pesanan selesai, pembayaran ini tampil di blok yang sama dengan "Hanya di Xendit"
    (ditandai "pesanan dibatalkan"), bukan sebagai lencana di baris tabel;
  - ada baris `xendit_pembayaran` dengan `external_order_id` yang **tidak punya pesanan POS**
    → **⚠ Hanya di Xendit**.
  Kandidat pencocokan nominal+jam mencakup pesanan website berstatus apa pun.
- **Bayar dobel:** boleh lebih dari satu `xendit_pembayaran` per `external_order_id`. Pesanan
  dengan ≥2 pembayaran tertaut berlencana **⚠ Dobel** (masuk filter "Selisih").
  Di `xendit-webhook`, pencatatan ke DB POS dilakukan **sebelum** penjaga "sudah paid" /
  "status tidak valid" (baris ±254 & ±263), untuk setiap event sukses ber-status
  SUCCEEDED/PAID — agar pembayaran kedua tetap tercatat. Upsert per `xendit_id` membuat
  kiriman ulang Xendit tidak dobel.
- **Outlet & identitas baris "Hanya di Xendit":** baris dari webhook / `check-xendit-status`
  menyimpan `outlet_id` POS (dari `outlets.pos_outlet_id` FormOrder), nama pelanggan, dan
  ringkasan item (snapshot) — admin-dashboard tidak membaca DB FormOrder. Baris dari file yang
  tak tercocokkan tidak punya outlet: hanya tampil saat **Semua Cabang**; saat difilter per
  cabang, tampil catatan "N pembayaran Xendit tanpa outlet — lihat di Semua Cabang".
- **Penulis otomatis:** `xendit-webhook` dan `check-xendit-status`. `auto-cancel-expired-orders`
  tidak perlu ditambah karena memulihkan lewat `check-xendit-status`.
- Kredensial DB POS untuk FormOrder: secret project `POS_SUPABASE_*` (sudah ada, dipakai
  `pull-online-order`).

## 6. Diputuskan bersama user

- Tempat: Histori Transaksi Detail, bukan kartu ringkasan terpisah.
- Pendekatan C (otomatis + unggah file bulanan).
- Tampilkan ID transaksi Xendit **dan** nomor referensi QRIS.
- Status: flag/filter "Xendit terverifikasi" untuk sumber website.

## 7. Diserahkan ke builder

- Nama kolom/tipe final, indeks, nama halaman unggah dan letak menunya.
- Apakah status Xendit dihitung di dalam cache `getPosReport` atau diambil terpisah (yang penting:
  tidak mengubah angka omzet, dan status segar setelah unggah/webhook).
- Bentuk UI pencocokan manual untuk kandidat ganda (boleh menyusul; minimal ditampilkan sebagai
  "Belum" dengan keterangan).
- Pengisian awal: unggah file Oktober (sudah ada di `Downloads`) dan November sebagai uji.

## 8. Risiko

- **ID webhook ≠ ID file** (5.2 langkah 2) — kalau dilewati, otomatis dan file akan membuat dua
  baris untuk satu pembayaran. Wajib diselesaikan sebelum menulis jalur otomatis.
- Pencocokan nominal+jam bisa salah pada jam ramai dengan nominal sama — dibatasi aturan satu-ke-
  satu dan "kandidat ganda = jangan cocokkan".
- Balance History per tanggal settlement: pembayaran akhir bulan ada di file bulan berikutnya —
  status ⏳ untuk tanggal 29–31 wajar sampai file berikutnya diunggah; jelaskan di UI.
- Tiga app wajib identik; lupa menyalin = tes paritas merah.

## 9. Hasil pengisian awal (18 Nov 2026)

File `BALANCE_HISTORY_REPORT_20261001_20261031_*.csv` diunggah dengan kode yang sama dengan
halaman unggah (lewat skrip sekali pakai, karena login lokal tidak tersedia):
- 127 pembayaran; 5 bukan penjualan (4× `PR-…` PantauReview, 1× uji Rp 2); 119 cocok lewat
  nominal & jam; 2 ditautkan manual (`cara_cocok='manual'`): bayar dobel Cicurug 9 Okt 14:33 →
  #100 (batal, total 0 sehingga nominal tak cocok) dan Pekayon #23 (tercatat `pos`, bukan website).
- Sisa 1 tak bertaut: 30 Sep 14:15 Rp 32.192 (Empang) — temuan September, tampil "Hanya di Xendit".
- Pesanan website Oktober: 110 selesai ✓ (1–28 Okt), 13 selesai ⏳ (29–31 Okt, settle November),
  #100 batal tertaut. Cocok dengan rekonsiliasi manual 18 Nov.
- Unggah ulang file yang sama: 0 baris baru, tautan tak berubah.

Batasan diketahui: pesanan website yang dibatalkan bernilai total 0 (trigger `handle_void_order`),
jadi pembayarannya tidak bisa dicocokkan lewat nominal — perlu tautan manual atau webhook.
