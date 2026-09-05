# Kunci Harga per PO & Pertanggungjawaban Barang Outlet — Design

**Tanggal:** 5 September 2026
**Status:** Rancangan, menunggu review. **Belum ada kode ditulis.**
**Asal:** brainstorming dengan owner, 5 September 2026

---

## 1. Ringkasan

Dua perubahan yang saling mengunci:

1. **Kantong harga per PO di gudang.** Tiap penerimaan PO membentuk satu kantong
   berisi qty + harga yang dikunci. Gudang boleh memegang beberapa kantong untuk
   bahan yang sama (vendor berbeda, harga berbeda). Saat mengirim, stokis memilih
   kantong mana yang dikeluarkan — boleh campur dalam satu pengiriman.
2. **Rekening pertanggungjawaban rupiah per outlet.** Outlet tidak menerima
   identitas kantong, hanya nilainya. Outlet mempertanggungjawabkan rupiah yang
   diterimanya lewat penjualan, sisa stok, dan waste.

**Prinsip yang dipegang** (sudah disepakati sebelumnya, `CATATAN-LANJUTAN-HARGA-STOK.md`):

> Vendor adalah urusan dokumen pembelian. Ia tidak pernah naik ke identitas
> barang, ke resep, atau ke outlet.

Kantong hidup **hanya di gudang**. Yang menyeberang ke outlet cuma rupiah.

---

## 1.1 Garis mulai — ini sistem baru, data lama dibiarkan

**Keputusan owner, 5 September 2026.**

Ini dibangun sebagai sistem baru. Data sebelum tanggal mulai **tidak disentuh,
tidak dikoreksi mundur, dan tidak direkonstruksi.** Pembangunan baru dimulai
setelah konsepnya pakem.

Yang **TIDAK** dilakukan:

- Menghitung ulang HPP periode yang sudah lewat
- Membetulkan nilai persediaan historis
- Merekonstruksi harga vendor untuk kiriman yang sudah terjadi
- Membuat rekening pertanggungjawaban untuk periode sebelum tanggal mulai

Konsekuensi yang harus diterima sadar: **angka sebelum dan sesudah garis mulai
tidak bisa dibandingkan langsung.** HPP bulan sebelum garis mulai dihitung dengan
harga master hari itu; sesudahnya dengan harga terkunci. Perbandingan antar-bulan
yang melintasi garis ini akan menyesatkan, dan laporan wajib menandainya.

### Kapan garis mulai ditetapkan

> **Jangan tentukan tanggalnya. Tentukan syaratnya. Tanggalnya lahir sendiri saat
> syarat terpenuhi.**

Nilai awal bersifat **permanen dan tidak bisa dikoreksi mundur** (aturan di
bagian ini). Bila tanggal dipatok lebih dulu lalu syaratnya belum siap,
kesalahan pada hari itu terkunci selamanya sebagai "nilai awal resmi".

**Daftar syarat** (diukur 5 September 2026):

| | Syarat | Status |
|---|---|---|
| 1 | Master data lengkap — harga beli + `kemasan_qty` untuk semua baris bersaldo | ✅ **760 dari 760**, nol tanpa harga, nol tanpa kemasan |
| 2 | Opname berjalan di semua outlet | ✅ 22 outlet dalam 7 hari terakhir, 119 finalized |
| 3 | 7 bumbu BNR **dibuka aksesnya lalu di-opname fisik** | ❌ **Rp74.954.720** akan terkunci jadi nilai awal palsu. **Bukan dinolkan lewat SQL** — lihat catatan di bawah |
| 4 | Penjaga finalisasi opname terpasang (P1, §6) | ❌ opname pembuka bisa setengah jadi seperti BNR 4 Sep |
| 5 | Surat jalan menggantung diputuskan nasibnya | 🔄 **52 draft sedang dikoreksi** (per 5 Sep). **203 berstatus `dikirim` belum digarap** — ini tumpukan yang lebih besar, umur rata-rata 21 hari, dan yang menentukan nilai "di jalan" saat hari-H (§4.2.3, O10) |
| 6 | Sistemnya sendiri dibangun (Tahap 2–4, §7) | ❌ belum ada kode |
| 7 | Opname penuh semua outlet **tepat sebelum** hari-H | ⏳ dijadwalkan, bukan syarat berdiri sendiri |

Syarat 3 dan 4 paling mendesak dan keduanya kecil. Syarat 3 khususnya: begitu
sistem menyala, Rp74,9 juta itu berubah status dari *"kesalahan yang bisa
diperbaiki"* jadi *"nilai awal resmi yang tidak boleh disentuh"*.

#### Catatan syarat 3 — jangan dinolkan lewat SQL

Premis awal "ketujuh bumbu tidak pernah ada wujudnya" **terbantah oleh data**:

```
Opname BNR 9 Juni 2026 (finalized)
  CENGKEH   qty_fisik 4   qty_system 0   selisih +4
```

Crew pernah menghitungnya dan menemukan 4. Barangnya nyata; yang salah
**jumlahnya** (sistem 32, hitungan orang 4). Menolkan lewat SQL akan menghapus
barang yang ada di rak.

**Akar masalahnya bukan data, tapi akses.** Ketujuhnya disaring keluar dari form
opname outlet oleh daftar nama di
`packages/design-system/src/utils/bahanBaku.ts` (`gudangPusatItems`), lewat
`OpnameForm.tsx:221`. Crew BNR tidak pernah bisa mengoreksinya walaupun mau —
angka salah terkunci di luar jangkauan satu-satunya orang yang melihat raknya.
Bukan soal kategori: MERICA (juga BUMBU) muncul normal di opname 4 September.

**Perbaikan yang benar:** tampilkan bahan ber-source `GUDANG_PUSAT` di form
opname outlet **hanya bila outlet itu punya saldo ≠ 0** untuk bahan tersebut,
lalu biarkan opname fisik yang menentukan. Targeted, dan membersihkan dirinya
sendiri — begitu saldonya nol, bahan itu hilang lagi dari form. Analisis lengkap:
`docs/draft-sql/nolkan-bumbu-hantu-bnr.sql` (naskah SQL-nya sendiri **ditandai
jangan dipakai**).

**Bentuk tanggalnya: awal bulan, tepat setelah opname penuh.**

- **Awal bulan** — angka sebelum dan sesudah garis mulai tidak bisa dibandingkan.
  Menyala di tengah bulan menghasilkan satu bulan yang separuhnya metode lama dan
  separuhnya metode baru: laporan yang tidak bisa dibaca siapa pun.
- **Setelah opname penuh** — nilai awal = jumlah fisik × harga. Jumlah yang salah
  menghasilkan nilai yang salah, dan itu permanen.

**Sebelum menyalakan: jalankan Tahap 0 selama satu bulan penuh.** Laporan
pertanggungjawaban dari data yang sudah ada, nol tulisan ke database. Gunanya
melihat apakah persamaannya masuk akal, seberapa besar selisih yang muncul, dan
apakah crew bisa menjelaskannya — **selagi semuanya masih bisa dibatalkan.**

### Beda "data lama" dengan "nilai awal" — jangan tertukar

Satu hal tetap diperlukan, dan itu **bukan** koreksi data lama:

| | Apa | Status |
|---|---|---|
| Koreksi mundur | Mengubah angka periode lampau | ❌ tidak dilakukan |
| **Nilai awal** | Memberi `nilai_rp` pembuka untuk stok yang **masih ada** di hari sistem menyala | ✅ tetap perlu |

Rata-rata bergerak tidak bisa mulai dari kosong — 760 baris yang bersaldo pada
hari-H harus punya angka pembuka, sama seperti neraca pembuka saat membuka
pembukuan baru. Angkanya diambil dari harga master saat itu dan **ditandai
"nilai awal"**, supaya selamanya bisa dibedakan dari hasil transaksi nyata.

Ini menulis ke keadaan **hari ini**, tidak menyentuh satu pun baris masa lalu.

---

## 2. Masalah yang diselesaikan

### 2.1 Persamaan pertanggungjawaban tidak bisa ditutup

Pertanggungjawaban barang menuntut persamaan ini tutup:

```
Nilai barang diterima = nilai terjual + nilai sisa stok + nilai waste + selisih
```

Keadaan sekarang — satu sisi beku, tiga sisi bergerak:

| Sisi | Dinilai pakai | Beku? |
|---|---|---|
| Barang diterima | `surat_jalan_item.harga_snapshot` | ✅ ya |
| Sisa stok | `bahan_baku_harga.harga_beli` hari ini | ❌ |
| Terjual (HPP) | `bahan_baku_harga.harga_beli` hari ini | ❌ |
| Waste | `bahan_baku_harga.harga_beli` hari ini | ❌ |

Akibat terukur — harga SAPI ditimpa 100.000 → 103.000 pada 3 September:

```
Outlet terima 20 Blok @ 100.000 (terkunci)  → tanggung jawab Rp2.000.000
Terjual 15 → dinilai 15 × 103.000            = Rp1.545.000
Sisa     5 → dinilai  5 × 103.000            = Rp  515.000
                                               ─────────────
                          dipertanggungjawabkan Rp2.060.000
                          selisih semu          Rp   60.000
```

Crew "kelebihan" Rp60.000 tanpa melakukan apa pun. Kalau harga turun, mereka
tampak **kurang** — dan itu jadi tuduhan ke orang yang tidak bersalah.

### 2.2 HPP periode berubah surut

`get_hpp_periode` mengambil `bahan_baku_harga` **hari ini**, tanpa pencarian
harga historis. HPP Agustus berubah **Rp49.582.162 (+6%)** antara dibaca
31 Agustus dan 5 September, tanpa satu pun penjualan berubah.

### 2.3 Harga vendor berbeda tidak terwakili

Sejak 1 Juli hanya 2 bahan yang harga vendornya benar-benar berbeda: SAPI
(100.000 vs 103.000) dan FOIL (8.791 vs 11.554). Harga master cuma menyimpan
satu angka, sehingga stok dari vendor murah ikut dinilai di harga vendor mahal.

---

## 3. Yang sudah ada dan tidak perlu dibangun

Diverifikasi ke database produksi, 5 September:

| Sudah ada | Bukti |
|---|---|
| `surat_jalan_item.harga_snapshot` | 2.127 dari 2.127 baris terisi (Agustus–September) |
| Snapshot benar-benar beku | SAPI 28 Agu–2 Sep terkunci 100.000, tidak ikut berubah saat master jadi 103.000 pada 3 Sep |
| Aritmetika satuannya lurus | Dramaga 20 Blok × Rp100.000 = Rp2.000.000 |
| Satu pintu penulis saldo | `ledger_stamp_saldo` — satu `INSERT … ON CONFLICT` atomik dengan row-lock |
| Penjagaan harga saat terima PO | `f6f0af84` — menolak rebase master ke satuan salah |
| Riwayat perubahan harga | `bahan_baku_harga_history` (baru sejak 28 Agustus, 11 baris) |

**Baris pertama persamaan pertanggungjawaban sudah bisa dihitung hari ini**,
tanpa kode baru. Itu dipakai sebagai titik uji di Tahap 0.

---

## 4. Rancangan

### 4.0 Aturan fondasi — invarian kantong

> **Setiap gram barang di gudang wajib menjadi milik tepat satu kantong.
> Tanpa kecuali.**

```
Σ qty semua kantong aktif   ==  saldo gudang        ← wajib, selalu
Σ nilai_rp semua kantong    ==  nilai_rp gudang
```

**Kenapa ini ditulis sebagai aturan fondasi, bukan detail.** Tanpa invarian ini
akan ada dua angka yang sama-sama mengaku tahu isi gudang, dan keduanya akan
menyimpang. Itu **penyakit yang sama persis** dengan divergensi `stok_balance` ↔
`ledger_stok` yang sudah pernah memaksa reset baseline 643 baris pada Juli 2026.

Dan divergensinya **pasti terjadi** bila kantong hanya dibentuk untuk barang
ber-PO. Diukur 30 hari terakhir, barang masuk Gudang Pusat:

```
  20  pembelian_supplier (lewat PO)
 126  adjustment
  76  opname_selisih
 ────
 222  total   →  hanya 9% lewat PO
```

Kalau 202 dari 222 pemasukan tidak berkantong, 91% isi gudang tidak punya
pemilik dan invariannya bohong sejak hari pertama.

**Maka kantong dibentuk untuk SEMUA pemasukan**, dibedakan oleh penandanya:

| Sumber pemasukan | Kantong | Harga diambil dari | `harga_terverifikasi` |
|---|---|---|---|
| Penerimaan PO | ✅ | `harga_terima` di nota | **true** |
| Adjustment manual | ✅ | harga master saat itu | false |
| Selisih opname (lebih) | ✅ | rata-rata kantong aktif | false |
| Retur dari outlet | ✅ | kembali ke kantong asal | mengikuti asal |

#### Efek samping yang berharga

Begitu semua barang berkantong dan tiap kantong bertanda, muncul angka yang
selama ini tidak bisa dilihat sama sekali:

```
Nilai persediaan gudang
  berharga terverifikasi (dari nota)   Rp ....   ..%
  harga menumpang master               Rp ....   ..%
```

Prasyarat **P2** (§6) berhenti jadi dugaan dan jadi angka yang dipantau sendiri
oleh purchasing. Ini juga alat ukur untuk memutuskan apakah Tahap 4 layak
dilanjutkan.

### 4.1 Kantong biaya di gudang (`stok_lot`)

Tabel baru. Satu baris = satu kantong.

```
stok_lot
  id
  bahan_baku_id
  outlet_id             -- Gudang Pusat pada tahap ini; kolom disiapkan untuk nanti
  sumber                -- 'po' | 'adjustment' | 'opname' | 'retur'
  ref_po_id             -- NULL kalau sumber bukan 'po'
  harga_terverifikasi   -- true hanya bila harganya dari nota PO
  qty_awal              -- SKALA BARIS STOK GUDANG (gram/cm/lembar), bukan satuan besar
  qty_sisa              -- fisik masih di rak
  qty_dipesan           -- diklaim surat jalan yang belum berangkat
  nilai_rp              -- total rupiah kantong ini
  status                -- 'aktif' | 'habis' | 'ditutup'
  dibuat_pada
```

**Harga per satuan tidak disimpan** — diturunkan saat ditampilkan, mengikuti
aturan yang sama dengan `nilai_rp` di outlet (§4.3.1):

```
Kantong #1 (PO-001, vendor A)
   qty       30.000        ← gram, skala sama dengan saldo gudang
   nilai_rp  Rp1.650.000   ← rupiah, tak bersatuan

   Ditampilkan: 15 Blok @ Rp110.000
   (30.000 ÷ 2.000 = 15 Blok  ·  1.650.000 ÷ 15 = Rp110.000)
```

Dengan qty kantong berskala sama dengan saldo, penjumlahan invarian §4.0 **tidak
pernah menyeberang satuan** — tidak ada tempat bagi kesalahan gramasi untuk
menyelinap.

Aturan:

- Kantong dibentuk saat penerimaan PO diverifikasi (`verifikasi_terima_po`),
  memakai `harga_terima` yang sudah lolos penjagaan `f6f0af84`.
- Kantong punya **dua** angka, bukan satu:

```
qty_sisa      -- fisik masih di rak gudang
qty_dipesan   -- sudah diklaim surat jalan yang belum berangkat
tersedia      = qty_sisa − qty_dipesan     ← ini yang boleh dialokasikan
```

- `qty_dipesan` naik saat permintaan **disetujui** (§4.2).
- `qty_sisa` turun dan `qty_dipesan` turun saat status jadi **'dikirim'**.
- `qty_sisa` nol → `status='habis'`.
- **Harga terkunci tidak pernah diubah.** Koreksi harga PO membentuk baris
  penyesuaian terpisah, bukan menulis ulang kantong yang sudah dipakai.

Skala yang diharapkan kecil: 20 PO/bulan, 45 baris item; paling banyak 5 PO per
bahan dalam 60 hari (KENTANG), SAPI 3.

### 4.2 Pemilihan kantong — SAAT PERMINTAAN OUTLET DISETUJUI

**Keputusan owner, 5 September:** kantong dipilih pada momen gudang menyetujui
permintaan outlet, dan `harga_snapshot` lahir dari alokasi itu.

Ini penting karena hari ini ada **dua momen berbeda**, dan jeda di antaranya nyata:

```
SAAT A  permintaan disetujui → surat jalan dibuat
        → harga_snapshot dikunci oleh trigger fill_harga_snapshot
          dari bahan_baku_harga (harga master)

        ⏳ rata-rata 3,9 jam · paling lama 28,8 jam (417 SJ, Agu–Sep)

SAAT B  status jadi 'dikirim'
        → trg_sj_on_dikirim_kurangi_kitchen → stok gudang baru berkurang
```

Kantong dipilih di **Saat A**. Karena stok baru berkurang di Saat B, memilih saja
tidak cukup — kantong harus **dipesan** (`qty_dipesan`, §4.1), kalau tidak dua
persetujuan bisa mengklaim isi kantong yang sama.

**Keuntungan yang ikut didapat:** anggaran outlet dihitung dari
`SUM(qty_disetujui × harga_snapshot)` pada `permintaan_bahan_item`
(`get_outlet_budget_status`). Hari ini angka itu berasal dari harga master, jadi
anggaran terpakai berdasar **perkiraan**. Dengan kantong dipilih di Saat A,
anggaran outlet langsung terpotong angka yang **sebenarnya**.

**Titik sambung sudah ada, tidak perlu membongkar apa pun.** Trigger
`fill_harga_snapshot` hanya mengisi bila nilainya masih 0:

```sql
IF COALESCE(NEW.harga_snapshot, 0) = 0 THEN ...
```

Jadi bila alokasi kantong menyuplai angkanya lebih dulu, trigger tidak akan
menimpanya.

### 4.2.1 Mekanisme pemilihan

- **Kalau cuma satu kantong aktif → sistem memilih sendiri, layar tidak berubah.**
  Diperkirakan ini mayoritas hari.
- Kalau ada ≥2 kantong aktif → layar kirim menampilkan daftar kantong (vendor,
  harga, sisa), stokis mengalokasikan qty. Boleh campur.
- Alokasi disimpan di tabel jembatan:

```
surat_jalan_item_lot
  id
  surat_jalan_item_id
  stok_lot_id
  qty
  harga_terkunci        -- disalin dari lot, beku
```

- `surat_jalan_item.harga_snapshot` tetap diisi, sebagai **rata-rata tertimbang
  alokasi** baris itu — supaya seluruh layar dan laporan yang sudah membacanya
  tidak perlu diubah.

Contoh yang jadi asal usul rancangan ini:

```
Outlet minta 20 Kg sapi
  10 Kg dari kantong vendor A @ Rp110.000  = Rp1.100.000
  10 Kg dari kantong vendor B @ Rp100.000  = Rp1.000.000
                                    total  = Rp2.100.000
  harga_snapshot baris itu = 2.100.000 / 20 = Rp105.000
```

Batas atas beban stokis: dari 2.127 baris kiriman Agustus–September, 1.219
melibatkan bahan yang punya ≥2 PO — sekitar 20 pemilihan per hari. Angka
sebenarnya lebih kecil, karena punya 2 PO dalam dua bulan tidak berarti dua
kantong hidup bersamaan.

**Kenapa satu baris berharga campuran, bukan dipecah jadi beberapa baris.**
Alternatifnya adalah memecah kiriman jadi satu baris per kantong, masing-masing
dengan harga aslinya. Itu ditolak: crew outlet akan menerima satu surat jalan
berisi **SAPI dengan dua harga berbeda**, dan langsung tahu ada dua vendor —
melanggar prinsip yang dipegang di §1. Satu baris berharga campuran justru yang
menjaga prinsip itu. Rinciannya tidak hilang, hanya tidak ditampilkan ke outlet.

**Aturan pembulatan — wajib.** Pembagian tidak selalu bulat. Contoh: 3 Kg
@110.000 + 4 Kg @100.000 = Rp730.000; dibagi 7 = Rp104.285,714…

```
Rp104.286 × 7 = Rp730.002   (lebih Rp2)
Rp104.285 × 7 = Rp729.995   (kurang Rp5)
```

Kecil per baris, tapi 2.127 baris per dua bulan. Kalau dibiarkan, rekening
pertanggungjawaban tidak akan pernah tutup persis dan orang akan mengejar selisih
yang cuma pembulatan.

> **Total rupiah alokasi adalah angka yang berwenang. `harga_snapshot` hanya
> tampilan. JANGAN pernah menghitung ulang total dari `harga_snapshot`.**

Kolom `harga_snapshot` bertipe `numeric` tanpa batas desimal, jadi presisi
penyimpanannya aman — bahayanya ada di kode yang membulatkan lalu mengalikan
balik.

### 4.2.2 Saat pesanan bertabrakan dengan kenyataan fisik

Antara persetujuan (Saat A) dan pengiriman (Saat B) ada jeda **rata-rata 3,9 jam,
paling lama 28,8 jam**. Dalam jeda itu opname, waste gudang, atau adjustment bisa
mengurangi stok — sehingga barang yang sudah dipesan ternyata tidak ada.

```
09:00  disetujui      → kantong #1 dipesan 20.000
11:00  opname gudang  → kantong #1 fisiknya cuma 15.000
13:00  dikirim        → mau ambil 20.000, ada 15.000
```

**Titik beratnya bukan "apa yang dilakukan jam 13:00".** Sistem sudah tahu sejak
jam 11:00; yang membuat ini jadi kekacauan adalah **dua jam diam**. Karena itu
aturan di bawah memindahkan penemuannya ke depan, bukan menambah penanganan di
ujung.

**Aturan 1 — pengurangan gudang memakan `tersedia` lebih dulu.**
Setiap pengurangan (opname, waste gudang, adjustment) wajib menghabiskan
`qty_sisa − qty_dipesan` sebelum menyentuh yang sudah dijanjikan.

```
Kantong #1  qty_sisa 30.000 · dipesan 20.000 · tersedia 10.000
Opname menemukan 15.000 → kurang 15.000
   dari tersedia : 10.000   ✅ janji aman
   sisanya       :  5.000   ⚠️ terpaksa memakan pesanan
```

Tidak menghilangkan masalah, tapi banyak kasus akan berhenti di baris pertama.

**Aturan 2 — begitu pesanan tersentuh, surat jalannya ditandai saat itu juga.**
Jam 11:00, bukan 13:00. Surat jalan berstatus "perlu ditinjau — kantong berkurang
5.000" dan muncul di layar orang gudang. **Ini inti perbaikannya**; empat aturan
lain hanya pendukung.

**Aturan 3 — saat kirim, fisik yang menang, dan stokis yang memutuskan.**
Sistem tidak boleh memilih sendiri. Layar kirim menampilkan alokasi asli,
peringatannya, dan dua jalan:

| Pilihan | Akibat |
|---|---|
| Kirim apa adanya | Outlet dapat lebih sedikit; kekurangan tercatat sebagai permintaan tak terpenuhi |
| Ganti dari kantong lain | Qty terpenuhi, tapi nilainya berubah karena harga kantong berbeda |

**Aturan 4 — nilai dan anggaran dikoreksi, dan koreksinya terlihat.**
`harga_snapshot` **tetap lahir saat persetujuan** (§4.2). Yang ditambahkan: bila
fisiknya berbeda, angka itu **dikoreksi saat kirim** dan koreksinya tercatat
sebagai koreksi — tidak menimpa diam-diam.

```
Disetujui  20   Blok · Rp2.100.000  → anggaran outlet terpotong Rp2.100.000
Dikirim    17,5 Blok · Rp1.837.500
Koreksi anggaran: +Rp262.500 dikembalikan, dengan alasan tertulis
```

Tanpa ini, anggaran outlet terpotong untuk barang yang tidak pernah diterima.

**Aturan 5 — alokasi awal dan alokasi final dua-duanya disimpan.**
Supaya saat crew bertanya *"kok anggaran saya beda dari yang disetujui?"*,
jawabannya bisa ditunjukkan, bukan diperdebatkan.

**Yang sengaja TIDAK dilakukan: memblokir opname gudang selama ada pesanan
menggantung.** Opname adalah kebenaran fisik; menghalanginya demi menjaga janji
sistem itu terbalik urutannya.

**Batas jujur aturan ini:** kelimanya tidak membuat kekurangan barang tidak
terjadi — barang memang bisa hilang, busuk, atau salah hitung. Yang dijamin cuma
kekurangan itu ketahuan lebih awal, ditangani manusia yang sadar, dan
meninggalkan jejak.

### 4.2.3 Barang di jalan dan penerimaan outlet

**Kategori ketiga yang selama ini tidak ada.** Saat status 'dikirim', nilai sudah
keluar dari gudang tapi belum masuk outlet. Hari ini nilai itu **tidak tercatat di
mana pun** — dan itu bukan sekejap:

```
205 surat jalan berstatus 'dikirim'  ·  rata-rata umur 21 hari
```

Nilai persediaan perusahaan harus dipecah tiga:

```
  di gudang (di rak)   Rp ....  ┐  tanggung jawab GUDANG
  di jalan             Rp ....  ┘
  di outlet            Rp ....     tanggung jawab OUTLET
```

**Keputusan owner, 5 September: gudang menanggung barang sampai diterima outlet.**
Karena itu tidak diperlukan pihak ketiga — barang di jalan tetap masuk
pertanggungjawaban gudang.

#### Penerimaan

Diukur Agustus–September, dari 1.101 baris yang sudah diverifikasi outlet:

```
 54 qty-nya beda dari yang dikirim  (46 kurang · 8 lebih)
 69 kondisinya tidak baik
```

Mekanismenya sudah ada: `qty_terima`, `kondisi`, `foto_path`, `verified_by`,
`verified_at`, plus jalur ledger `rejected_kiriman`.

> **Aturan: nilai yang masuk ke outlet mengikuti `qty_terima`, bukan
> `qty_dikirim`.** Outlet hanya bertanggung jawab atas barang yang benar-benar
> sampai di tangannya.

```
qty_dikirim 20 Blok · nilai Rp2.100.000
qty_terima  17,5 Blok

  masuk ke outlet   = 2.100.000 × (17,5 ÷ 20) = Rp1.837.500
  selisih           =                            Rp  262.500
                      → kerugian, dibebankan ke GUDANG
```

#### Efek samping yang disengaja

Karena gudang menanggung sampai diterima, **205 surat jalan menggantung
(rata-rata 21 hari) menjadi paparan terbuka milik gudang.** Itu menciptakan
dorongan yang selama ini tidak ada: gudang jadi punya alasan sendiri untuk
memastikan kiriman ditutup, tanpa perlu aturan tambahan.

#### Risiko yang harus diawasi

Gudang bisa menanggung hal yang bukan salahnya — sopir, atau outlet yang salah
hitung saat menerima. Peredamnya sudah ada (`foto_path` + `verified_by`), dan
polanya akan terlihat bila satu outlet berulang kali melaporkan kurang. Pantau,
jangan diasumsikan jujur maupun curang.

### 4.3 Nilai melekat di outlet (`stok_balance.nilai_rp`)

Outlet **tidak** menyimpan kantong. Satu kolom baru di `stok_balance`:

```
nilai_rp                -- total rupiah dari saldo baris itu
harga_satuan_terakhir   -- cadangan untuk saat saldo <= 0 (lihat O8)
```

**Yang disimpan adalah TOTAL RUPIAH, bukan harga per satuan.** Ini keputusan
sadar, bukan selera — alasannya di §4.3.1.

Dirawat di `ledger_stamp_saldo` — satu-satunya pintu penulis saldo:

```
barang masuk berharga  : nilai_rp += nilai kiriman (rupiah, apa adanya)
barang keluar          : nilai_rp −= nilai_rp × (qty keluar ÷ saldo sebelum)
harga master diubah    : nilai_rp tidak tersentuh     ← inti perbaikannya
```

Nilai kiriman berasal dari `harga_snapshot × qty_terima`, dihitung dalam satuan
besar di lapisan surat jalan — satu-satunya tempat satuannya tidak ambigu.

Harga per satuan **tidak disimpan**; diturunkan saat dibutuhkan:

```
harga per satuan = nilai_rp ÷ saldo      (otomatis dalam skala baris itu)
```

**Kenapa rata-rata bergerak di outlet, bukan kantong:** outlet mengalami stok
menembus nol **1.530 kali** dalam dua bulan (gudang cuma 17). Kantong tidak punya
jawaban saat lapisan habis; nilai rupiah tetap jalan dan pulih sendiri saat
barang berikutnya masuk.

### 4.3.1 Kenapa total rupiah, bukan harga per satuan — soal gramasi

**Batasan yang dipegang (keputusan owner, 5 September): gramasi tidak diubah
sama sekali.** Saldo, BOM, opname, dan tampilan tetap bekerja persis seperti
sekarang. Lapisan nilai menempel di belakangnya, tidak menggantikan apa pun.

Rancangan awal menyimpan `harga_pokok` per satuan besar dan mewajibkan setiap
perkalian lewat `saldo_is_gram()`. **Itu dibuang** — ia menaruh ranjau di setiap
tempat yang mengalikan harga × saldo, lalu bergantung pada tidak ada yang lupa.
Kelas kesalahan ini sudah tiga kali menyesatkan di proyek ini.

Rupiah tidak punya satuan. Karena `qty keluar` dan `saldo` **selalu berasal dari
baris yang sama**, skalanya pasti sama, sehingga pembagiannya membatalkan
skalanya sendiri:

```
Baris berskala Blok:  saldo 20      nilai_rp 2.072.000
  jual 0,1 Blok  → 2.072.000 × (0,1 ÷ 20)      = Rp10.360

Baris berskala gram:  saldo 40.000  nilai_rp 2.072.000
  jual 200 gram  → 2.072.000 × (200 ÷ 40.000)  = Rp10.360
```

Hasil identik, tanpa satu pun pemanggilan `saldo_is_gram()`.

**Bonus: baris yang berpindah skala tidak rusak.** Saat 7 baris bumbu BNR
akhirnya di-opname, saldonya berubah 1.000× tanpa barang bergerak. Harga per Kg
yang tersimpan akan mendadak salah 1.000× tanpa peringatan; `nilai_rp` tidak
berubah sama sekali, dan harga turunannya menyesuaikan diri.

**Dua jalur yang TETAP butuh sadar skala** — terisolasi, bisa diuji sendiri:

| Jalur | Frekuensi (2 bln) | Kebal gramasi? |
|---|---|---|
| Penjualan (BOM) | 470.075 | ✅ proporsional |
| Pengiriman & transfer | 2.127 | ✅ proporsional |
| Waste | 292 | ✅ proporsional |
| **Opname** | 16.396 | ❌ lihat O4 |
| **Saldo minus** | 1.530 | ❌ lihat O8 |

### 4.4 HPP dan waste memakai harga terkunci

- `get_hpp_periode` berhenti membaca `bahan_baku_harga`. Biaya dicap ke baris
  ledger `pemakaian` saat pemotongan BOM terjadi, memakai rumus proporsional
  §4.3. HPP periode = jumlah cap dalam periode itu — **beku selamanya**.
- `process_waste_report_approval` menilai waste dengan cara yang sama — rincian
  di §4.6.

**Kolom baru di `ledger_stok`: `nilai_gerak`** — nilai rupiah pergerakan baris
itu, diisi `ledger_stamp_saldo`.

> **Penamaan sengaja dibedakan.** `stok_balance.nilai_rp` = nilai **stok yang
> ada**; `ledger_stok.nilai_gerak` = nilai **satu pergerakan**. Memberi nama
> sama pada dua hal berbeda adalah cara paling murah membuat orang salah jumlah
> di kemudian hari.

### 4.5 Laporan pertanggungjawaban

Turunan, bukan tabel baru:

```
REKENING PERTANGGUNGJAWABAN — <outlet>, <periode>
  + nilai barang diterima      Σ harga_snapshot × qty_terima
  − nilai terjual              Σ nilai_rp pada ledger 'pemakaian'
  − nilai waste disetujui      Σ nilai_rp pada ledger 'waste'
  ────────────────────────────
  = seharusnya sama dengan nilai sisa stok  (stok_balance.nilai_rp)

  Selisih = angka yang perlu dijelaskan
```

Perhatikan sisi kanan **tidak dihitung** dari saldo × harga — ia dibaca langsung
dari `stok_balance.nilai_rp`. Tidak ada perkalian, jadi tidak ada tempat bagi
kesalahan skala (§4.3.1).

### 4.5.1 Selisih itu diapakan — jangan dijawab buru-buru

Selisih bisa berarti banyak hal sekaligus: barang hilang, crew salah hitung saat
opname, waste yang lupa dilaporkan, resep yang tidak akurat sehingga potongan BOM
meleset dari pemakaian nyata, atau kiriman yang tidak pernah diverifikasi
(1.026 baris, O10).

> **Bila selisih langsung diperlakukan sebagai tanggungan crew sejak hari
> pertama, yang terjadi bukan ketertiban — melainkan crew berhenti jujur saat
> opname, karena jujur jadi merugikan mereka. Dan begitu opname tidak jujur,
> seluruh sistem ini kehilangan dasarnya.**

**Aturan peluncuran: jalankan sebagai laporan pantau dulu, minimal satu siklus
opname penuh, tanpa konsekuensi apa pun ke siapa pun.** Lihat besar dan pola
selisihnya, baru tetapkan ambang wajarnya. Ambang itu keputusan owner, bukan
teknis — dan tidak boleh ditetapkan sebelum datanya ada.

### 4.6 Waste

292 baris dalam dua bulan, 17 outlet. Alur yang ada tidak berubah: crew lapor →
SPV setujui → ledger `waste`. Yang ditambahkan hanya nilainya, dengan rumus yang
**sama persis dengan penjualan** (§4.3).

Efek samping: `get_waste_periode` yang memakai `qty × harga_beli` polos — dan
tercatat **belum sadar skala** sejak sesi 2026-08-04 — menjadi tidak relevan. Ia
digantikan penjumlahan cap, dan masalah skalanya ikut hilang tanpa perlu
diperbaiki khusus.

**Waste yang belum disetujui belum mengurangi apa pun** (O5), ditampilkan
terpisah sebagai "menggantung".

---

## 5. Kasus tepi — bagian yang paling menentukan

### Di gudang

| # | Kasus | Rancangan |
|---|---|---|
| G1 | **Barang masuk tanpa PO** — 126 `adjustment` dalam 30 hari, vs hanya 20 `pembelian_supplier` | Diselesaikan oleh aturan fondasi §4.0: kantong **tetap dibentuk**, `harga_terverifikasi = false`, harga menumpang master. Muncul di laporan pengecualian. Jangan diam-diam dianggap setara kantong PO. |
| G2 | Opname gudang menemukan selisih (76 baris dalam 30 hari) | Selisih lebih → kantong `sumber='opname'`, `harga_terverifikasi = false`, nilai pada rata-rata tertimbang kantong aktif. Selisih kurang → kurangi kantong tertua lebih dulu. Invarian §4.0 tetap wajib tutup sesudahnya. |
| G10 | **Invarian §4.0 pecah** — Σ kantong ≠ saldo gudang | Harus mustahil secara konstruksi: kantong ditulis oleh jalur yang sama dengan yang menulis saldo. Tambahan: kueri pemeriksa yang bisa dijalankan kapan saja, dan **wajib dijalankan sebelum tiap tahap dianggap selesai** — jangan menunggu gejalanya muncul di laporan. |
| G11 | **Pesanan bertabrakan dengan kenyataan fisik** — stok berkurang antara persetujuan dan pengiriman | Lima aturan di §4.2.2. Intinya: pengurangan memakan `tersedia` dulu, dan begitu pesanan tersentuh surat jalannya **ditandai saat itu juga**, bukan saat pengiriman gagal. |
| G3 | Kantong habis di tengah kirim | Luber otomatis ke kantong berikutnya sesuai urutan pilihan stokis; kalau stokis tak memilih, urut tertua. |
| G4 | Gudang stok minus (17 kasus dalam 2 bulan) | Izinkan `qty_sisa` negatif pada kantong terakhir yang dipakai, pulih saat penerimaan berikutnya. Jangan blokir pengiriman. |
| G5 | Barang dikembalikan (`rejected_kiriman`) | Kembalikan qty ke kantong asalnya lewat `surat_jalan_item_lot`. |
| G6 | Harga PO dikoreksi setelah barang telanjur dipakai | **Jangan tulis ulang kantong.** Buat baris penyesuaian nilai terpisah supaya jejak audit utuh. |
| G7 | Kantong menyisakan pecahan kecil yang mengendap | Ambang penutupan (mis. sisa < 1% qty awal) → gabungkan ke kantong aktif berikutnya, catat di riwayat. |
| G8 | **Surat jalan mengendap sebagai draft** — 47 berstatus draft saat ini, dan catatan lama menyebut ada draft berumur >2 minggu | Tiap draft yang menggantung memegang `qty_dipesan` atas barang yang sebenarnya masih di rak — terkunci tanpa alasan. **Perlu aturan pelepasan otomatis** setelah batas umur tertentu. Batasnya keputusan owner, dan lebih baik ditetapkan sebelum fitur menyala. |
| G9 | Permintaan ditolak / surat jalan dibatalkan setelah kantong dipesan | Lepas `qty_dipesan` seketika, kembalikan ke tersedia. |

### Di outlet

| # | Kasus | Rancangan |
|---|---|---|
| O1 | Stok menembus nol (1.530 kasus) | Tidak ada masalah — `nilai_rp` tetap melekat; penilaian keluar memakai `harga_satuan_terakhir` (O8), lalu pulih sendiri ke rumus proporsional saat barang masuk. |
| O2 | **Opname difinalisasi belum lengkap** | Prasyarat wajib, lihat §6. |
| O3 | Transfer antar-outlet | Nilai ikut barang secara proporsional dari outlet pengirim. Berlaku aturan §4.2.3 yang sama: pengirim menanggung sampai diterima. |
| O11 | **`opname_item.selisih` dan `qty_system` bisa rusak** | Untuk baris yang belum terkonversi skala, form opname mengalikan saldo sekali lagi dengan faktor kemasan. Terbukti di BNR 4 September: FOIL ditampilkan `qty_system` **26.194.492** padahal saldonya 34.466 (34.466 × 760 = 26.194.160). Yang menyelamatkan adalah perbaikan `finalize_opname` (3 Sep) yang **mengabaikan** `selisih` tersimpan dan menghitung ulang dari `qty_fisik` → ledger tertulis −4.066, bukan −26 juta. **Aturan: jangan pernah membaca `selisih` atau `qty_system` untuk menghitung nilai. Yang berwenang adalah `qty_fisik` dan baris ledger yang dihasilkan.** |
| O10 | **Kiriman tidak pernah diverifikasi** — 1.026 dari 2.127 baris tak punya `qty_terima` | Nilainya menggantung di kategori "di jalan" tanpa batas waktu, dan pertanggungjawaban gudang tidak pernah tutup. Perlu aturan: kiriman melewati batas umur tertentu **dianggap diterima penuh** (dengan penandaan), atau dieskalasi. Batasnya keputusan owner. Tanpa ini, laporan gudang akan menumpuk paparan yang tak pernah selesai. |
| O4 | **Opname — dua cabang, bukan satu aturan rumit** | **Cabang biasa (skala tidak berubah): proporsional**, sama seperti semua jalur lain. `saldo 10 Blok · nilai Rp1.036.000`, opname menemukan 9 → `1.036.000 × (9÷10) = Rp932.400`. Tidak ada yang istimewa. **Cabang khusus: opname MEMBALIK skala baris.** Saldo berubah 1.000× tanpa barang bergerak, sehingga proporsional menghasilkan angka mustahil (`1.036.000 × (18.000÷10)`). Untuk cabang ini nilai dihitung dari `qty_fisik (satuan besar) × harga per satuan besar`; form opname sudah tahu angka besarnya. **Cabang khusus ini mati sendiri** — lihat O4b. |
| O4b | **Berapa baris yang masih bisa memicu cabang khusus** | Diukur 5 September: **47 baris**, dan hanya **7 di outlet nyata** (BNR — bumbu hantu yang sama). Sisanya outlet tes (22), KANTOR PUSAT dummy (17), GUDANG SS ONLINE (1). Begitu 7 baris BNR dibereskan (syarat 3 di §1.1), cabang khusus tidak punya sasaran lagi dan seluruh sistem berjalan di cabang proporsional saja. Uji cabang khusus tetap wajib ditulis — tapi ia berumur pendek, bukan beban permanen. |
| O8 | **Menilai barang keluar saat saldo ≤ 0** | Rumus proporsional pecah (pembagi nol/negatif). Terjadi 1.530 kali dalam 2 bulan. Simpan `harga_satuan_terakhir` saat saldo terakhir positif; pakai itu selama saldo minus, kembali ke proporsional begitu barang masuk lagi. |
| O9 | **Sisa nilai saat saldo mencapai nol** | Pembulatan bisa menyisakan rupiah menggantung padahal barangnya nol. Saat `saldo = 0`, paksa `nilai_rp = 0` dan catat sisanya sebagai selisih pembulatan — jangan dibiarkan mengendap. |
| O5 | Waste dilaporkan tapi belum disetujui | Belum mengurangi rekening; ditampilkan terpisah sebagai "menggantung". |
| O6 | Bahan tanpa harga di master | Nilai tidak bisa dihitung. Tampilkan sebagai "belum bisa dinilai", **jangan diperlakukan sebagai nol** — pola yang sudah dipakai `nilai_persediaan_spv`. |
| O7 | Saldo awal saat fitur menyala | Semua baris bersaldo perlu `nilai_rp` pembuka. Diambil dari harga master saat itu, **ditandai "nilai awal"** supaya selamanya bisa dibedakan dari hasil transaksi (§1.1). |

---

## 6. Prasyarat — harus selesai sebelum rekening pertanggungjawaban dinyalakan

**P1. Penjaga finalisasi opname.**
4 September, BNR memfinalisasi opname dengan **24 dari 43 bahan tidak pernah
diisi angkanya** — tersimpan 0 dan tercatat habis, senilai Rp1,2 juta. Kalau
rekening pertanggungjawaban sudah berjalan saat itu, **Rp1,2 juta itu langsung
jadi tanggungan crew BNR** atas barang yang kemungkinan besar masih ada di rak.

`opname_item` tidak punya kolom waktu (`id, opname_id, bahan_baku_id, qty_fisik,
qty_system, selisih, flagged, catatan`), jadi tidak ada cara membedakan "belum
dihitung" dari "memang nol" — baik oleh sistem maupun audit sesudahnya.

Minimal: peringatan di finalisasi yang menyebut berapa bahan belum terisi dan
berapa nilai yang akan dihapus. Lebih baik: bedakan NULL dari 0.

**P2. Pintu masuk pembelian harus membawa harga.**
Diukur 30 hari terakhir: **hanya 20 dari 222 pemasukan Gudang Pusat (9%) lewat
PO**; 126 lewat `adjustment`, 76 lewat `opname_selisih`. Selama ini belum
berubah, kantong bertanda "tidak terverifikasi" akan mendominasi dan Tahap 4
kehilangan maknanya. **Ini kesepakatan cara kerja purchasing, bukan pekerjaan
pemrograman.**

Catatan: aturan fondasi §4.0 membuat prasyarat ini **terukur sendiri** — persentase
nilai berharga terverifikasi jadi angka yang dipantau, bukan dugaan. Pakai angka
itu sebagai gerbang: kalau masih rendah, hentikan di Tahap 3.

**Sebelum jadi keputusan proses, selidiki dulu kenapa 126 pemasukan memilih jalur
`adjustment`.** Bisa jadi form PO merepotkan, bisa jadi memang ada pembelian yang
tak berdokumen PO. Menetapkan aturan tanpa tahu sebabnya akan diakali di lapangan.

**P3. Konfirmasi ke pemegang pembukuan.**
Pemilihan kantong secara manual tergolong **identifikasi khusus**. Standar
persediaan mengarahkan metode itu untuk barang yang tidak dapat dipertukarkan;
untuk barang massal seperti daging, arahannya FIFO atau rata-rata. Perlu
dikonfirmasi. **Ini bukan nasihat akuntansi.**

Jalan keluar bila ditolak: ganti pemilihan manual jadi otomatis-tertua. Seluruh
rancangan lain tetap berlaku tanpa perubahan, dan hasilnya menjadi FIFO yang
diakui standar. Titik keputusan ini sengaja dibuat murah untuk dibalik.

---

## 7. Urutan pembangunan

**Gerbang: tidak ada tahap yang dimulai sampai konsepnya pakem** (keputusan owner,
§1.1). Tahap 0 adalah pengecualian yang aman — ia cuma membaca, tidak mengubah
apa pun, dan justru dipakai untuk *menguji* apakah konsepnya pakem.

| Tahap | Isi | Bisa dipakai sendiri? |
|---|---|---|
| **0** | Laporan pertanggungjawaban dari data yang **sudah ada** (`harga_snapshot` + penjualan + opname + waste). Nol perubahan skema, nol tulisan ke DB. | Ya — menguji apakah persamaannya masuk akal sebelum ada kode dibangun |
| **1** | P1 penjaga finalisasi opname | Ya — menutup lubang yang sudah terbukti melukai |
| **2** | `stok_balance.nilai_rp` + `harga_satuan_terakhir` + rumus proporsional di `ledger_stamp_saldo` + nilai awal (§1.1) | Ya — menghentikan nilai persediaan bergerak sendiri |
| **3** | `ledger_stok.nilai_gerak` + HPP & waste pakai nilai tercap | Ya — menghentikan HPP periode berubah surut |
| **4** | `stok_lot` + `surat_jalan_item_lot` + layar pilih kantong | Menyempurnakan akurasi sumber harga |

Tahap 2 dan 3 memberi manfaat terbesar (Rp49,6 juta HPP berubah surut) dan
**tidak bergantung** pada Tahap 4. Tahap 4 adalah konsep kantong itu sendiri, dan
baru bermakna setelah P2 terpenuhi.

---

## 8. Yang sengaja TIDAK dilakukan

- **Kantong di outlet.** Ditolak: 1.530 kasus stok minus tidak punya jawaban di
  model kantong, dan outlet tidak perlu tahu vendor (prinsip yang sudah
  disepakati).
- **Setoran uang bahan baku dari crew.** Crew sudah menyetor 100% hasil
  penjualan; menambah setoran bahan baku berarti mereka membayar dua kali.
  Model yang dipilih adalah **pertanggungjawaban**, bukan pembayaran.
- **Mengubah harga master jadi rata-rata.** Harga master tetap jadi acuan
  pembelian dan anggaran. Yang berubah: ia berhenti dipakai menilai stok.
- **Menulis ulang HPP periode yang sudah lewat.** Data harga historis sebelum
  28 Agustus tidak pernah dicatat; rekonstruksi akan jadi karangan.
- **Menyentuh data sebelum garis mulai** — apa pun bentuknya. Lihat §1.1.
  Keputusan owner, bukan keterbatasan teknis.
- **Membandingkan angka yang melintasi garis mulai** tanpa penanda. Laporan wajib
  memberi tahu pembaca bahwa dasar perhitungannya berbeda.

---

## 9. Risiko

| Risiko | Catatan |
|---|---|
| **Skala satuan** | Sebagian besar dijinakkan rumus proporsional (§4.3.1) — penjualan, pengiriman, waste, **dan opname biasa** ikut kebal. Sisa risikonya tinggal **dua**: opname yang membalik skala (O4, hanya 7 baris nyata tersisa dan mati sendiri — O4b) dan saldo minus (O8). Uji keduanya dengan transaksi nyata di outlet tes, bukan arkeologi data. |
| **Tuduhan palsu ke crew** | Rekening ini menyentuh orang. Dua sumber tuduhan palsu: (a) opname setengah jadi — jangan nyalakan sebelum **P1**; (b) ambang selisih ditetapkan sebelum polanya diketahui — wajib **mode pantau** minimal satu siklus opname penuh, tanpa konsekuensi ke siapa pun (§4.5.1). Kalau jujur jadi merugikan crew, mereka berhenti jujur, dan dasar sistem ini runtuh. |
| **Pembulatan** | Total alokasi berwenang, `harga_snapshot` cuma tampilan (§4.2.1). Kalau aturan ini dilanggar di satu tempat saja, rekening tidak akan pernah tutup persis dan orang mengejar hantu. |
| **Beban stokis** | Batas atas 20 pemilihan/hari. Kalau lapangan mengeluh, alihkan ke otomatis-tertua — perubahan satu aturan, bukan pembongkaran. |
| **Kantong "tidak terverifikasi" mendominasi** | Bila P2 tak terpenuhi, hentikan di Tahap 3. Tahap 4 tidak akan memberi manfaat. |
| **Nilai awal** | 760 baris bersaldo perlu `nilai_rp` pembuka (§1.1 — ini bukan koreksi data lama). Bersinggungan dengan migrasi skala satuan yang baru selesai; kerjakan setelah 7 bumbu BNR di-opname. |
| **Garis mulai jadi kabur** | Kalau tanggal mulai tidak dipatok tegas dan ditulis di satu tempat, laporan akan mencampur dua dasar perhitungan tanpa ada yang sadar. Patok tanggalnya sebagai konstanta tunggal, bukan disebar di beberapa kueri. |

---

## 10. Yang belum terjawab

1. **Cara membetulkan `nilai_rp` yang tercemar harga salah.** Kelemahan
   melekat rata-rata bergerak. Riwayatnya nyata: KENTANG 25.000 → 250.000
   (28 Agu), BAWANG 32.500 → 650.000 (31 Agu). Penjagaan `f6f0af84` mencegah
   yang baru, tapi belum ada cara memulihkan yang terlanjur.
2. **Ambang selisih yang dianggap wajar** sebelum jadi tanggungan crew. Keputusan
   owner, bukan teknis — dan **tidak boleh ditetapkan sebelum datanya ada**
   (§4.5.1).
3. **Siapa yang menagih dan kapan** — per pengiriman, per minggu, atau per siklus
   opname.
4. **Apakah HPP per outlet dipakai menilai kinerja.** Kalau ya, outlet yang
   kebetulan menerima kantong mahal akan tampak lebih buruk tanpa kesalahan
   apa pun.

---

## 11. Keputusan yang sudah diambil dalam brainstorming ini

| Pertanyaan | Jawaban owner |
|---|---|
| Siapa memilih kantong saat kirim | Stokis, saat kirim |
| Kantong ikut ke outlet? | Tidak — berhenti di gudang. *"Outlet gausah tau itu bahan pake vendor yang mana"* |
| Setoran bahan baku sudah jalan? | Belum. Yang berjalan baru setoran hasil penjualan |
| Tafsir setoran | **A — pertanggungjawaban barang**, bukan pembayaran kedua |
| Data lama | **Dibiarkan.** Ini sistem baru; tidak ada koreksi mundur. Lihat §1.1 |
| Kapan mulai | **Syaratnya yang ditetapkan, bukan tanggalnya.** Tanggal lahir saat 7 syarat di §1.1 terpenuhi; bentuknya awal bulan tepat setelah opname penuh |
| Gramasi | **Tidak diubah sama sekali** — stok, BOM, opname, tampilan tetap seperti sekarang. Lapisan nilai menempel di belakang. Lihat §4.3.1 |
| Bentuk baris kiriman | Satu baris berharga campuran (bukan dipecah per kantong), supaya perbedaan vendor tidak bocor ke outlet. Lihat §4.2.1 |
| **Kapan kantong dipilih** | **Saat gudang menyetujui permintaan outlet** (Saat A), bukan saat barang berangkat. Konsekuensinya kantong harus dipesan lebih dulu. Lihat §4.2 |
| **Invarian kantong** | Setiap gram wajib punya tepat satu kantong — termasuk barang masuk tanpa PO, yang dibentuk kantong bertanda "tidak terverifikasi". Lihat §4.0 |
| Yang disimpan di kantong | qty (skala baris stok) + `nilai_rp`. Harga per satuan diturunkan, tidak disimpan — sama dengan model di outlet |
| Pesanan vs fisik | Fisik yang menang; pengurangan memakan `tersedia` dulu; begitu pesanan tersentuh, surat jalan **ditandai seketika**, bukan saat pengiriman gagal. Opname gudang **tidak** diblokir demi menjaga pesanan. Lihat §4.2.2 |
| **Barang di jalan** | **Tanggung jawab gudang** sampai diterima outlet. Tidak perlu pihak ketiga. Lihat §4.2.3 |
| Selisih saat terima | Nilai masuk outlet mengikuti `qty_terima`, bukan `qty_dikirim`. Kekurangan jadi kerugian gudang |

---

## 12. Status & langkah berikutnya

**Status: menunggu konsep dinyatakan pakem oleh owner.** Tidak ada kode yang
ditulis, tidak ada skema yang disentuh, tidak ada data yang berubah.

Yang bisa dikerjakan tanpa menunggu, karena keduanya cuma membaca atau menutup
lubang yang sudah terbukti melukai:

1. **Tahap 0** — laporan pertanggungjawaban dari data yang sudah ada, untuk 1–2
   outlet sebulan terakhir. Ini justru alat untuk menguji apakah konsepnya pakem.
2. **P1** — penjaga finalisasi opname. Berdiri sendiri, bermanfaat terlepas dari
   nasib rancangan ini, dan sudah terbukti perlu (BNR, 4 September).

Yang menunggu keputusan owner sebelum boleh dimulai: Tahap 1–4, penetapan tanggal
garis mulai, dan jawaban atas empat pertanyaan terbuka di §10.
