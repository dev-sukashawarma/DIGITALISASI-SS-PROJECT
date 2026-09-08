# Catatan Lanjutan — Harga & Stok Bahan Baku

**Dibuat:** 3 September 2026
**Dipakai untuk:** melanjutkan pekerjaan sepotong-sepotong tanpa harus membaca
ulang seluruh pembahasan. Tiap butir berdiri sendiri.

---

## 🛠️ PERBAIKAN FORM — menutup akar dari tiga kekeliruan sekaligus

Tiga kekeliruan yang ditambal terpisah sepanjang 8 September ternyata satu akar:
**form meminta angka tanpa menyebut satuannya, dan tak menunjukkan hasilnya
sebelum disimpan.** ⚠️ **Perlu redeploy `stok` dan `finance`** — ini satu-satunya
perubahan kode di rangkaian sesi ini; sisanya semua di basis data.

### 1. Form penyesuaian stok (`apps/stok` ManualEntryForm)

Pemilih satuan **sudah lama ada** dan default-nya satuan besar. Yang tidak ada:
tampilan apa yang benar-benar akan tercatat. Ditambahkan kotak pratinjau di
bawah kolom kuantitas:

- **"Akan tercatat"** — hasil konversi dalam satuan majemuk yang terbaca
- **"Stok setelah disimpan"**
- **Peringatan merah** bila jumlahnya ≥ 10× stok terpasang, menyebutkan satuan
  yang sedang terpilih secara eksplisit

Untuk insiden FOIL: 1.000 × 36.480 = 36.480.000 berbanding stok 108.680 →
**336×** → peringatan menyala, dan angka "48.000 Roll" terpampang sebelum
tombol simpan ditekan.

Rumusnya sengaja disalin persis dari `createDraftItemFromCurrentState` —
pratinjau yang memakai jalur hitung sendiri akan berbohong tepat ketika paling
dibutuhkan.

#### Susulan: peringatan harus IKUT ke daftar item

Ketahuan saat smoke test owner. Peringatan di area input **menguap** begitu
tombol "Tambah item" ditekan — item pindah ke "Daftar Item Entri", kolom bahan
ter-reset, dan yang tersisa cuma satu baris datar berhuruf kecil:

```
Penyesuaian: Penambahan 1000 Dus -> Target: 1022 Dus + 40 Roll
```

Angkanya mengerikan, nadanya tidak. Setelah itu tombol "Simpan Semua Entri"
tanpa penghalang apa pun — **persis celah yang meloloskan insiden FOIL.**

Diperbaiki: `lipatStok` dibawa serta di `DraftItem`, dan baris daftar yang
≥10× dirender merah lengkap dengan peringatannya. Peringatannya kini bertahan
sampai detik tombol simpan ditekan.

**Sengaja BUKAN modal konfirmasi kedua.** Sesi "FOIL Dus & Gerbang Nol" sudah
membuktikan dua peringatan beruntun justru melatih orang menekan "lanjut"
(§3 entri CLAUDE.md-nya). Satu tanda yang menetap lebih kuat daripada dua
tanda yang berkedip.

### 2. Form terima PO (`apps/finance` VerifikasiTerimaModal)

Labelnya **"Harga Aktual"** — tanpa satuan sama sekali. Itu akar kekeliruan
PLASTIK MERAH yang berulang dua kali (Agustus & September): satuan bahannya
Ikat, operator mengisi Rp18.000 yang merupakan harga per **Pack**.

- Label → **"Harga Aktual per {satuan}"**, satuannya diberi warna aksen
- Satuan ditempel **di dalam** kolom "Fisik Tiba Hari Ini", bukan cuma di baris
  keterangan di atasnya — mata orang yang mengetik ada di kolomnya
- Baris hasil: `{qty} {satuan} × {harga} = {total}`

### ⚠️ Belum diuji di browser

Tidak ada `.env.local` di `apps/stok` maupun `apps/finance` di lingkungan kerja
ini, jadi dev server tak bisa dijalankan. Yang terverifikasi baru `type-check`
(bersih di kedua app; sisa galat `useExpenses.ts` adalah baseline lama di berkas
yang tak disentuh).

**Yang perlu dilihat sekali saat smoke test:** pilih FOIL di form penyesuaian,
ketik 1000 dengan satuan "Dus" — kotak pratinjau harus merah dan menyebut
kelipatannya. Lalu buka satu PO PLASTIK MERAH — labelnya harus berbunyi
"Harga Aktual per Ikat".

---

## 🎯 KEPUTUSAN METODE BASIS HARGA — pengukuran final 8 September

Diukur ulang setelah jendela 1 September dibersihkan dan tiga baris PO ditandai
satuannya. Dasar: **`subtotal`** (uang selalu benar) dibagi jumlah yang sudah
dinormalkan ke satuan besar, menghormati `satuan_ad_hoc`. PO uji coba dikecualikan.

| Bahan | Saldo gudang | Master | WAC on-hand | Dampak |
|---|--:|--:|--:|--:|
| PLASTIK 24 | 482 Pack | 13.000 | 12.415 | +Rp282.000 |
| STIKER | 89,87 Lembar | 5.300 | 5.570 | −Rp24.265 |
| KEJU | 5,13 Dus | 289.056 | 289.048 | +Rp41 |
| MAYONAISE | 7 Dus | 248.004 | 248.000 | +Rp28 |
| **Total** | | | | **+Rp257.804** |

**Selisih antara "harga terakhir" dan "rata-rata tertimbang" untuk SELURUH
persediaan = Rp257.804**, atau sekitar **0,07%** dari nilai persediaan pasti
(±Rp359 juta). Konsisten dengan pengukuran 3 September (nol) dan pagi ini
(Rp277.735) — tiga pengukuran independen, kesimpulan sama.

**PLASTIK MERAH hilang dari daftar** setelah kedua baris PO-nya ditandai:
rata-ratanya pas Rp90.000, sama dengan master. Itu memvalidasi cara ukurnya.

### ✅ DITUTUP: saldo FOIL gudang — satu salah ketik satuan, −Rp413,6 juta

Pengukuran menandai FOIL −Rp44,3 juta, tetapi **itu bukan selisih metode**.
Saldo FOIL di Gudang Pusat **36.588.680 cm ≈ 1.003 Dus ≈ 48.143 Roll** —
mustahil secara fisik. Asalnya:

| Tipe ledger | Baris | Total cm |
|---|--:|--:|
| **adjustment** | 12 | **+36.231.799** |
| pembelian_supplier | 1 | +760.000 |
| transfer_keluar | 64 | −407.861 |
| opname_selisih | 11 | +188 |

**KOREKSI atas dugaan awal saya:** saya sempat menulis "12 baris penyesuaian
sejak 23 Juli". Salah — hampir seluruhnya **satu baris, hari itu juga**:

```
13:47:33  EMPANG        +36.480.000 cm  "ekadharma"    <- salah outlet + satuan
13:52:07  EMPANG        -36.480.000 cm  "salah input"  <- dibatalkan sendiri
13:53:07  GUDANG PUSAT  +36.480.000 cm  "ekadharma"    <- diulang, satuan masih salah
```

Penerimaan **1.000 Roll** dari Ekadharma diketik "1.000" lalu dikali **36.480**
(cm per **Dus**) alih-alih **760** (cm per **Roll**) → tercatat 48.000 Roll.

**Formnya tidak salah hitung.** Satuan besar FOIL baru berubah Roll → Dus
**pagi itu juga** (`20260908103000`), jadi form meminta Dus sementara orang
gudang masih berpikir Roll. Operator sempat sadar salah outlet dan
membatalkannya — tapi tidak sadar satuannya ikut berubah.

**Diperbaiki** `20260908220000` — opname fisik owner **1.096 Roll**, ditulis
lewat ledger `adjustment` (SOP: jangan `UPDATE stok_balance` langsung), delta
dihitung saat jalan sehingga idempoten:

| | cm | Roll | Dus | Nilai |
|---|--:|--:|--:|--:|
| Sistem | 36.588.680 | 48.143,00 | 1.002,98 | Rp423.234.742 |
| Fisik | 832.960 | 1.096,00 | 22,83 | Rp9.635.155 |
| **Koreksi** | **−35.755.720** | | | **−Rp413.599.586** |

Uji kewarasan: saldo sebelum penyesuaian salah = 143 Roll; ditambah 1.000 Roll
yang benar-benar datang = 1.143 Roll. Hitungan fisik 1.096 Roll — selisih 47
Roll (≈1 Dus), wajar untuk pemakaian/kiriman yang belum tercatat.

Seluruh outlet lain diperiksa dan **sehat** (0,8–110 Roll). Tidak ada PO FOIL
menggantung, jadi koreksi ini tak akan tertimpa verifikasi susulan.

### Kronologi lengkapnya (keterangan owner + jejak ledger, 8 September)

Dua PO FOIL berdekatan: **Ekadharma 31 Agustus** dan **Altindo 2 September**.
Barang **Altindo datang duluan**, tetapi saat verifikasi yang dieksekusi PO
**Ekadharma**. Ketahuan, dibatalkan, dimasukkan ulang ke Altindo. Hari ini
barang Ekadharma yang sungguhan datang — PO-nya sudah terpakai, jadi masuk
lewat penyesuaian ledger.

```
02 Sep 16:02  terima PO Ekadharma        +1.000 Roll   <- barangnya Altindo
02 Sep 16:04  adjustment "salah vendor"  -1.000 Roll   <- dibatalkan
02 Sep 16:04  adjustment ke FOIL (48)    +1.000 Roll   <- dipindah ke vendor benar
03 Sep 13:45  terima PO Altindo          +1.000 Roll
03 Sep 13:46  adjustment "double input"  -1.000 Roll   <- dobelnya dibatalkan
03 Sep 15:53  penggabungan FOIL(48)->FOIL  ±672 Roll
08 Sep 13:53  adjustment "ekadharma"    +48.000 Roll   <- SATUAN SALAH
08 Sep 14:21  koreksi opname fisik      -47.047 Roll
```

**Tiga kekeliruan pertama ditangkap dan dibalik dengan catatan yang jelas.**
Yang keempat lolos justru karena satu-satunya yang tak bisa dilihat siapa pun:
satuan FOIL berubah pagi itu, dan tak ada layar yang menunjukkan hasil
konversinya. **Ini bukan soal kedisiplinan orang gudang — disiplinnya terbukti
bagus. Alatnya yang tidak memberi tahu.**

### 🅿️ DIPARKIR (keputusan owner 8 September: "nanti dulu")

**`SPB/PO/VII/2026/021` — Altindo, 15 Agustus, 2.000 Roll, Rp17.582.400, LUNAS.**
Statusnya `diterima_lengkap` tetapi **tidak pernah menulis satu baris pun ke
`ledger_stok`**. Stoknya tak pernah dikreditkan lewat jalur penerimaan; kalau
barangnya memang masuk, ia baru muncul lewat opname/penyesuaian belakangan.

Tidak mendesak: hitungan fisik 8 September sudah jadi acuan dan opname memang
mekanisme pelurusnya. Tapi kalau suatu saat ditanya "ke mana 2.000 Roll bulan
Agustus", jejak penerimaannya memang tidak ada di ledger. Perlu ditelusuri
bersama pola PO lain yang juga tak menulis ledger (`036`, `039` — lihat
bagian PO di atas).

⚠️ **Perangkapnya masih terpasang.** Siapa pun yang memasukkan FOIL dalam Roll
lewat form penyesuaian akan kena 48× lagi. Itu pekerjaan berikutnya: label
form harus menyebut satuan bahannya secara eksplisit — sama persis dengan
akar masalah pengisian harga per-Pack di form terima PO.

### ✅ DIPUTUSKAN 8 September: metode sekarang DIPERTAHANKAN

**Keputusan owner:** ditanya apakah persediaan dilaporkan ke pihak luar
(pajak/audit) atau murni kendali internal —

> "murni kendali internal"

Dengan itu **pertanyaan PSAK 14 gugur.** Satu-satunya alasan tersisa untuk
pindah metode adalah kepatuhan pelaporan eksternal, dan itu tidak ada. Dari
sisi akurasi selisihnya 0,07% — tidak ada yang perlu diperbaiki.

**Jangan bangun FIFO batch atau rata-rata tertimbang.** Ukur ulang HANYA kalau:

1. Mulai ada pelaporan persediaan ke pihak luar, atau
2. Muncul bahan berperputaran lambat yang stok dua vendornya menumpuk
   bersamaan. Sampai 8 September belum pernah terjadi: stok on-hand tiap bahan
   selalu ditutupi satu vendor saja.

**Ini juga menutup pertanyaan yang membuka rangkaian sesi ini** — "bahan dengan
2 vendor, bagaimana menanganinya dari PO sampai outlet order supaya tidak
tumpang tindih". Jawabannya: **tidak perlu mekanisme khusus.** Perputaran
barang cukup cepat sehingga stok vendor lama habis sebelum vendor baru datang,
dan dampaknya ke HPP terukur nol tiga kali berturut-turut.

Yang lebih layak digarap lebih dulu, karena benar-benar menggeser angka:
saldo FOIL gudang di atas, dan **form terima PO** yang labelnya generik
sehingga operator berulang kali mengisi harga per sub-satuan (dua kali untuk
PLASTIK MERAH, dua bulan berbeda).

---

## 📏 PENGUKURAN ULANG 8 SEPTEMBER — metode basis harga

Mengukur ulang selisih **harga master vs rata-rata tertimbang stok yang benar-benar
ada** di Gudang Pusat (FIFO mundur dari penerimaan PO terbaru sampai menutupi saldo).
Menggantikan pengukuran 3 September.

| Bahan | Saldo | Master | WAC on-hand | Rasio | Dampak |
|---|---:|---:|---:|---:|---:|
| PLASTIK MERAH | 51,80 Ikat | 90.000 | 18.000 | **5,00×** | Rp3.729.600 |
| POLYBAG | 5,67 Pack | 25.000 | 600.000 | **0,04×** | −Rp3.258.333 |
| FOIL | 5,98 Dus | 421.978 | 11.554 | **36,52×** | Rp2.453.991 |
| PLASTIK 24 | 502 Pack | 13.000 | 12.398 | 1,05× | Rp302.000 |
| STIKER | 89,87 Lembar | 5.300 | 5.570 | 0,95× | −Rp24.265 |
| MAYONAISE / KEJU / KUNYIT | — | — | — | 1,00× | ≤ Rp72 (pembulatan) |

**Tiga yang terbesar BUKAN selisih metode — itu salah basis satuan di baris PO lama:**

- **FOIL** master per **Dus**, `harga_terima` diisi per **Roll**. Buktinya pas:
  421.977,6 ÷ 48 (`faktor_tengah`) = **8.791,2** — persis salah satu nilai
  `harga_terima` yang tercatat.
- **PLASTIK MERAH** master per **Ikat**, diisi per **Pack** (faktor 5).
- **POLYBAG** master per **Pack**, diisi per **Bal** (≈25).

**Selisih metode yang sungguhan hanya dua: PLASTIK 24 +Rp302.000 dan STIKER
−Rp24.265 — bersih Rp277.735 untuk SELURUH nilai persediaan.**

### Temuan pokok: masalah dua-vendor masih belum ada

Untuk **setiap** bahan, stok yang ada di Gudang Pusat ditutupi oleh **satu vendor
saja** (`jml_vendor_menutupi_saldo = 1`, tanpa kecuali). Sama seperti 3 September:
perputaran cukup cepat sehingga stok vendor lama habis sebelum vendor baru datang.

### Metode yang benar-benar berjalan sekarang

`verifikasi_terima_po` menimpa `bahan_baku_harga.harga_beli` dengan `harga_terima`
tiap penerimaan → **"harga pembelian terakhir"**, yang **bukan** metode yang diakui
PSAK 14 (yang diakui: FIFO dan rata-rata tertimbang).

Tapi lebih tepatnya bahkan bukan itu: **STIKER** punya master 5.300 sementara
satu-satunya `harga_terima` yang pernah tercatat 5.570 — masternya diketik manual,
bukan dari PO. Jadi metode nyatanya adalah **"harga apa pun yang terakhir diketik"**,
campuran penerimaan PO dan suntingan manual.

### Risiko terbuka yang ternyata SUDAH ditutup

Catatan 3 September menandai jalur penerimaan PO sebagai risiko belum-diaudit.
Sudah ditutup orang lain sehari kemudian: **"GUARD SALAH SATUAN (2026-09-04)"** di
`verifikasi_terima_po` menolak `harga_terima` yang rasionya terhadap master persis
sama dengan salah satu faktor konversi bahan (toleransi 1%), mencatatnya sebagai
`DITOLAK` di `bahan_baku_harga_history` alih-alih menimpa master. Sudah menolak 1×.

⚠️ **Guard itu tidak menangkap POLYBAG.** Rasionya ≈25, sedangkan faktor POLYBAG yang
terdaftar hanya 9 — angka 25 ("1 bal = 25 pak", catatan owner) tak ada di kolom
faktor mana pun. Guard hanya sekuat data faktor bahannya.

### Urutan yang benar kalau mau pindah metode

Dari 51 baris PO berharga, **42 dibuat sebelum guard ada**. Rata-rata tertimbang
dihitung **dari riwayat pembelian** — jadi menerapkannya di atas riwayat yang basis
satuannya campur akan menghasilkan angka yang **lebih buruk** daripada metode
sekarang. Bersih-bersih basis satuan 42 baris itu adalah prasyarat, bukan pekerjaan
sesudahnya.

---

## 🔗 RANTAI HARGA: PO → master → surat jalan (8 September)

**Terkonfirmasi di kode:** `SuratJalanForm.tsx:177` menulis
`qty_dikirim = convertToBaseUnit(qty, bahan)` = `qty ÷ getDistribusiFactor(b)`,
dan faktor itu menurunkan dari `satuan_distribusi` ke `satuan`. Jadi
**`qty_dikirim` disimpan dalam satuan besar** — sesuai catatan sesi FOIL-Dus.

**Rantainya:** `verifikasi_terima_po` menimpa `bahan_baku_harga.harga_beli` →
trigger `fill_harga_snapshot` menyalinnya APA ADANYA ke
`surat_jalan_item.harga_snapshot` saat SJ dibuat. Tidak ada kode app yang
menulis kolom itu; trigger satu-satunya pengisi. Snapshot **beku**: memperbaiki
baris PO tidak mengubahnya.

Semua **2.626** baris SJ punya snapshot (18 Juli–8 September).

### Konsekuensinya: snapshot mewarisi basis master saat itu

`harga_beli` baru dinormalkan ke satuan besar pada 3 September
(`20300122000000`/`20300122000001`). Snapshot yang dibekukan sebelum itu
memakai basis lama yang campur, sementara `qty_dikirim` selalu satuan besar —
jadi `qty × snapshot` pada baris-baris itu tidak sebanding.

Pemisahan kasar (rasio snapshot terhadap master kini):

| Kelompok | Nilai beku |
|---|---:|
| Rasio ≥ 3× — hampir pasti beda basis | ~Rp24,2 juta |
| Rasio 1,5–3× — ambigu, didominasi AYAM | ~Rp97,7 juta |

⚠️ **Angka itu perkiraan kasar, jangan dikutip sebagai kerugian.** Pemisah yang
dipakai (rasio cocok dengan faktor konversi) mewarisi kelemahan yang sama dengan
GUARD SALAH SATUAN: **kalau harganya ikut bergerak, rasionya tidak lagi mendarat
persis di faktor**. KENTANG 24.000 (rasio 10,42) jelas per-Pack tapi lolos ke
kelompok "harga lama" hanya karena bukan tepat 10,00. Pemisah yang benar butuh
master per-tanggal, dan `bahan_baku_harga_history` tidak lengkap.

### Yang terbukti tanpa keraguan

**PO uji coba menulis harga ke master produksi.** Riwayat mencatat AYAM
51.000 → **35.000** pada 28 Agustus dari PO bernama
`TEST/PO/PARTIAL/1787895628258`, kembali ke 53.500 pada 1 September. **22 baris
surat jalan** bertanggal 29 Agu–1 Sep membekukan harga tes itu, senilai
**Rp19.950.000**. Pola yang sama dengan kebocoran outlet tes, lewat pintu
berbeda: **jalur PO belum punya penyaring dokumen uji coba.**

### ✅ Ditutup 8 September: satuan asli dua baris PO FOIL ditandai

Migration `20260908160000_tandai_satuan_baris_po_foil.sql` — **applied &
diverifikasi**. `satuan_ad_hoc = 'Roll'` diisi pada dua baris itu.
**Nol angka diubah**: qty 2.000/1.000, harga 8.791,2/11.554, dan subtotal
Rp17.582.400/Rp11.554.000 identik sebelum dan sesudah. Utang supplier tidak
bergerak (po_payable_spv memakai `subtotal`).

Keputusan owner: **menandai, bukan menskala** — menskala ke Dus akan membuat
dokumen tidak cocok lagi dengan faktur supplier yang menyebut 2.000 Roll, dan
memasukkan pecahan berulang (2.000/48) ke dokumen pembelian.

Aman karena inert: semua pembaca `satuan_ad_hoc` memakainya sebagai **cadangan**
setelah `bahan_baku.satuan`, dan kedua baris punya `bahan_baku_id`
(`COALESCE(b.satuan, poi.satuan_ad_hoc, …)` di `verifikasi_terima_po`;
`bahan_baku?.satuan || satuan_ad_hoc` di PODetailView, KitchenVerifikasiModal;
VerifikasiTerimaModal hanya memakainya untuk baris ad-hoc). Diuji idempoten:
dijalankan dua kali, yang kedua nol baris.

`PO/KITCHEN/20260902/0001` sengaja tidak disentuh — memakai bahan lama
"FOIL (48) (DIGABUNG KE FOIL)" yang satuannya memang masih Roll.

**Masih terbuka:** PLASTIK MERAH (butuh catatan pembayaran ke Pak Aji untuk
memastikan 50 Pack atau 50 Ikat) dan POLYBAG (master datanya sendiri ditahan).

### ⚠️ KOREKSI: "4 baris PO salah" ternyata keliru — uangnya sudah benar

Diperiksa 8 September, dan ini membatalkan cara saya membingkainya sebelumnya.
`subtotal` keempat baris = `qty × harga` **persis**, dan rupiahnya benar:

| PO | Baris | qty × harga | subtotal | Status uang |
|---|---|---|---|---|
| SPB/PO/VII/2026/021 | FOIL | 2.000 × 8.791,2 | Rp17.582.400 | benar (2.000 **Roll**) |
| PO/KITCHEN/20260831/0002 | FOIL | 1.000 × 11.554 | Rp11.554.000 | benar (1.000 **Roll**), ada faktur |
| SPB/PO/VII/2026/039 | POLYBAG | 2 × 600.000 | Rp1.200.000 | benar (2 **Bal**) |
| SPB/PO/VII/2026/036 | PLASTIK MERAH | 50 × 18.000 | Rp900.000 | **ambigu** |

Yang salah **hanya label satuannya**, bukan uangnya. Dan `po_payable_spv.total`
memakai kolom `subtotal` yang tersimpan, bukan `qty × harga` — jadi utang ke
supplier tidak bergantung pada qty/harga sama sekali.

**Dua baris FOIL bukan kesalahan operator.** Saat dibuat (15 & 31 Agustus)
satuan FOIL memang **Roll**, jadi labelnya benar pada waktunya. Baru menjadi
salah ketika migration `20260908103000` mengubah satuan FOIL ke Dus tanpa
menskala ulang riwayat PO. Sesi itu menskala 26 baris surat jalan yang masih
berjalan, tetapi riwayat PO tidak ikut — memang di luar lingkupnya.

**PLASTIK MERAH ambigu dan butuh manusia:** 50 Pack @18.000 (= 10 Ikat, uang
Rp900.000 tetap) atau 50 Ikat @90.000 (uang jadi Rp4.500.000)? `paid_amount`
NULL, tidak ada faktur terlampir, dan PO ini tidak pernah menulis ledger — tidak
ada bukti stok untuk menengahi. Hanya catatan pembayaran ke Pak Aji yang bisa.

**POLYBAG jangan disentuh dulu:** master datanya sendiri masih ditahan — catatan
owner "1 bal = 25 pak" bertentangan dengan faktor terdaftar (9). Menskala
memakai angka yang belum disepakati akan menambah kekacauan.

**Dampak nyata hari ini: nol.** Uang benar, ledger benar, dan tak ada laporan
yang membaca `qty_terima` sebagai satuan besar. Satu-satunya yang terganggu
adalah perhitungan rata-rata tertimbang di masa depan — metode yang belum
diputuskan.

### ✅ Ditutup 8 September: PO uji coba tak boleh menulis harga master

Migration `20260908150000_guard_harga_master_po_uji_coba.sql` — **applied &
diverifikasi di DB live**. Memakai ulang jalur penolakan milik guard salah
satuan (`20260904120000`): master tidak ditimpa, sebabnya dicatat di
`bahan_baku_harga_history` supaya terlihat.

Pola dijangkarkan di **awal** nomor PO: `^(test|dummy|coba|demo)[/_-]`.
Diuji langsung ke 50 PO nyata — 49 lolos, 1 (`TEST/…`) ditolak. Pemisah
`[/_-]` mencegah salah tangkap: `TESTINDO/PO/2026/1`, `PO/TESTIMONI/2026/01`,
dan `SPB/PROTEST/2026/7` semuanya **lolos**.

Verifikasi pasca-terap (`pg_get_functiondef`): guard baru terpasang, guard salah
satuan lama utuh, `to_ledger_scale` utuh, `can_manage_po` utuh,
`prosecdef = true`.

**Sengaja TIDAK diubah:** PO uji coba tetap menulis `ledger_stok`. Ruang lingkup
perubahan ini hanya harga; menghentikan pergerakan stoknya keputusan terpisah
yang belum diambil.

**Riwayat migration sengaja tidak di-stempel** (`migration repair` tidak
dijalankan). Menulis ke tabel riwayat DB bersama tanpa persetujuan pernah jadi
insiden di proyek ini (Session 2026-07-14). Isinya `CREATE OR REPLACE`, jadi
`db push` berikutnya menerapkannya ulang dengan aman. Keputusan stempel = owner.

### ✅ 1 September ditetapkan sebagai titik mulai bersih (8 September)

Migration `20260908170000_koreksi_harga_beku_surat_jalan_sejak_1sep.sql` —
applied & diverifikasi. **Hanya 9 baris disentuh.**

| Bahan | Baris | Sebelum | Sesudah |
|---|--:|---|---|
| AYAM | 6 | Rp35.000 (harga dari PO uji coba) | Rp53.500 |
| CUP | 2 | Rp1.780 (per pcs) | Rp44.500 (×25, per Pack) |
| KERTAS STRUK | 1 | Rp1.600 (per roll) | Rp16.000 (×10, per pack) |

Dikalikan faktornya, bukan diganti master hari ini — supaya tingkat harga saat
pengiriman tetap terjaga. Diuji idempoten (jalan kedua = nol baris).

Keadaan jendela 1–8 September sebelum koreksi: 478 baris, **386 sudah bersih**
(Rp176 jt), 35 baris harga beda tapi satuan benar (pembekuan yang memang
bekerja — SAPI 100.000, FOIL lama 11.554: JANGAN disentuh), 57 baris tersangka.

### ✅ 1 SEPTEMBER 2026 = TITIK MULAI BERSIH (selesai 8 September)

Keadaan akhir jendela 1–8 September, **483 baris surat jalan**:

| Keadaan | Baris |
|---|--:|
| Harga beku = master (bersih) | **443** |
| Harga beku beda wajar — **ini normal**, memang guna pembekuan | 30 |
| FOIL — sudah benar, sengaja tak disentuh | 10 |

Tidak ada lagi baris yang menunggu keputusan.

Tiga migration menutupnya: `20260908170000` (AYAM/CUP/KERTAS STRUK, 9 baris),
`20260908180000` (kedua saos, 9 baris), `20260908190000` (5 bahan sisa, 35
baris). Ketiganya idempoten dan sudah diuji dijalankan dua kali.

**Kebijakan yang dipakai (keputusan owner):** *"pakai B, nanti kalau setelah
audit ada perubahan harga nanti inject saja perubahan harganya."* Harga yang
dikonfirmasi hari ini jadi dasar; selisih dari audit disuntikkan belakangan.

### ✅ POLYBAG & PLASTIK MERAH — dua gantungan terakhir ditutup

Keterangan owner 8 September: *"polybag 1 bal harganya 600.000 isi 25 pack,
1 pack 24.000, plastik merah 50 pack"*. Migration `20260908200000`, idempoten.

**⚠️ Harga POLYBAG diubah Rp25.000 → Rp24.000 per Pack — mengganti angka yang
sebelumnya sudah dikonfirmasi.** Migration `20300122000003` (3 September)
menetapkan Rp25.000 dan menyebutnya "jawaban konfirmasi". Yang baru dipakai
karena punya dua penopang, bukan sekadar ingatan: Rp600.000 ÷ 25 = Rp24.000
tanpa sisa, dan PO `SPB/PO/VII/2026/039` mencatat 2 × Rp600.000 = Rp1.200.000
(= 2 Bal). Rp25.000 kemungkinan pembulatan saat konfirmasi lisan.

8 baris surat jalan POLYBAG di jendela September ikut diseragamkan ke 24.000
(termasuk 6 baris yang tadinya 25.000), mengikuti kebijakan yang sama.

**Struktur satuan TIDAK diubah.** "Bal" adalah kemasan pembelian (25 Pack),
bukan tingkat operasional. Keputusan 3 September tetap: POLYBAG hanya Pack dan
Pcs. Menambah tingkat di atas Pack akan mengulang persoalan FOIL — dokumen
historis berpindah arti diam-diam.

**Dua baris PO ditandai satuannya, nol angka berubah** (pola yang sama dengan
dua baris FOIL di `20260908160000`):

| PO | Tercatat | Sebenarnya | Uang |
|---|---|---|---|
| SPB/PO/VII/2026/039 | 2 "Pack" | 2 **Bal** (= 50 Pack) | Rp1.200.000 tetap |
| SPB/PO/VII/2026/036 | 50 "Ikat" | 50 **Pack** (= 10 Ikat) | Rp900.000 tetap |

PLASTIK MERAH terbukti konsisten sendiri: master Rp90.000/Ikat dengan 1 Ikat =
5 Pack berarti Rp18.000/Pack — persis `harga_terima`-nya. Jadi masternya benar,
hanya labelnya yang keliru.

### ⚠️ KENAPA HARGA BEKU TIDAK BISA DIPULIHKAN DENGAN PERKALIAN

Temuan ini membatalkan kolom "faktor" yang sempat saya sodorkan. **Normalisasi
3 September tidak mengalikan harga lama — ia menggantinya.** Nilai lama hanya
kunci pengaman:

```sql
UPDATE bahan_baku_harga SET harga_beli = 248004, kemasan_qty = 12000
  WHERE nama = 'MAYONAISE' AND harga_beli = 23706;
```

248.004 tidak dihitung dari 23.706. Batch pertama menyatakannya terang-terangan:
`KEJU  Rp12.044 per Pack  10.850 -> 289.056  10 -> 240` — basis keju yang benar
Rp12.044/Pack (×24 = 289.056), sementara yang beku 10.850. Itu bukan soal
satuan, memang harga yang lebih lama.

**Rasio harga-beku terhadap master mencampur perubahan SATUAN dan perubahan
HARGA sekaligus**, dan basis harga lama tidak tercatat di mana pun — tidak di
master, tidak di riwayat, tidak di migration. Tidak ada perkalian yang
memulihkannya. Bukti pergerakan harga nyata: normalisasi menetapkan SAOS TOMAT
POUCH ke 140.004, hari ini 141.000 — berubah oleh PO 31 Agustus (80 Dus @
141.000).

**Kedua saos berhasil bukan karena metode menemukan faktornya, melainkan karena
owner menyebutkan harganya.**

### ✅ SAOS CABE & SAOS SAMYANG — 9 baris terakhir, dari keterangan owner

Migration `20260908180000` — applied & idempoten. SAOS CABE 7 baris
Rp14.179 → **Rp244.002** (21 baris September kini seragam); SAOS SAMYANG
2 baris Rp14.774 → **Rp280.000** (6 baris seragam).

Dasarnya keterangan owner 8 September: *"saos cabe per dus = 244000, saos
samyang per dus = 280000"*. Dipakai 244.002 bukan 244.000 supaya seragam dengan
14 baris September lain (selisih Rp14 total).

**KOREKSI klaim saya sebelumnya:** saya menulis bahwa "isi kemasan 4 bahan belum
terdaftar benar". **Itu salah.** Faktornya lengkap — SAOS CABE 1 Dus = 3 Kompan
= 16.500 g; SAOS SAMYANG 1 Dus = 5 Kg. Yang tidak lengkap adalah **daftar
kandidat faktor di kueri saya**: saya tak pernah menguji **kg per satuan besar**
(`faktor_tampilan / 1000`), padahal `satuan_distribusi` kedua bahan itu 'kg' dan
`getDistribusiFactor` di kode punya aturan khusus persis untuk itu.

Untuk SAOS CABE faktornya 16,5 kg/Dus → 244.002/16,5 = 14.788, dekat dengan
harga beku 14.179. SAOS SAMYANG tetap tak terjelaskan dari data (rasio 18,95
sementara 1 Dus = 5 Kg) — hanya keterangan owner yang menutupnya.

### Sisa jendela 1 September: 35 baris, semua LOLOS uji sisi-qty

Bentuk angka qty sama di kedua sisi perubahan harga — tak ada lompatan seperti
FOIL. Faktor yang cocok, dengan daftar kandidat yang sudah diperbaiki:

| Bahan | Baris | Harga beku | Faktor | Tersirat per satuan besar | Master kini |
|---|--:|--:|--:|--:|--:|
| MAYONAISE | 14 | 23.706 /kg | ×12 kg/Dus | 284.472 | 248.004 |
| SAOS TOMAT POUCH | 7 | 10.613 /kg | ×12 kg/Dus | 127.356 | 141.000 |
| PAPER WRAP | 10 | 160 /pcs | ×5.000 pcs/Ikat | 800.000 | 925.000 |
| KEJU | 2 | 10.850 /pack | ×24 pack/Dus | 260.400 | 289.056 |
| PLASTIK MERAH | 2 | 23.500 /pack | ×5 pack/Ikat | 117.500 | 90.000 |

Semua tersiratnya dalam jarak wajar dari master (0,77–1,16×) — konsisten dengan
pergerakan harga biasa, bukan salah faktor. **Tetap menunggu konfirmasi harga
per satuan besar dari owner**, mengikuti cara yang sama seperti kedua saos.

FOIL (10 baris) dan POLYBAG (2) tetap di luar: yang pertama sudah benar, yang
kedua master datanya ditahan.

### 🚨 NYARIS SALAH: FOIL 10 baris — tampak salah 48×, ternyata benar

Sepuluh baris FOIL (3–8 September) membeku di Rp8.791,2 sementara master kini
Rp421.977,6. Klasifikasi otomatis menandainya "salah satuan" dengan keyakinan
**tertinggi** (sisa rasio pas 1,00). Kalau dijalankan, harganya dikalikan 48
sementara qty tetap Roll → **+Rp83 juta nilai fiktif**.

Yang menyelamatkan: **qty bernilai 48 muncul empat kali** — persis faktor
bahannya. 48 Dus foil ke satu outlet dalam sehari itu mustahil. Saat surat
jalan itu dibuat satuan FOIL masih Roll, jadi `qty_dikirim` JUGA dalam Roll.
Pasangannya konsisten: 48 Roll × 8.791,2 = Rp421.977,6 = tepat 1 Dus.

**Kesalahan metodologis yang sama untuk keempat kalinya di sesi ini:**
membandingkan satu sisi tanpa memeriksa sisi lainnya. Membandingkan harga
terhadap master TIDAK CUKUP — untuk tiap bahan yang satuannya pernah berubah,
qty ikut berpindah basis.

**Uji yang benar: apakah `qty × harga` menghasilkan rupiah yang masuk akal**,
bukan apakah harga sebanding dengan master.

⚠️ **Karena itu angka "481 baris / Rp381,9 juta" di bagian bahan keputusan di
atas TIDAK BISA DIPERCAYA** — ia dihitung dengan pemisah yang cacat ini, dan
setidaknya 74 baris FOIL di dalamnya adalah positif palsu. Perlu dihitung ulang
dengan uji sisi-qty sebelum dipakai untuk keputusan apa pun.

### Sisa pekerjaan di jendela 1 September

- **Terhalang master data:** SAOS CABE (7 baris) & SAOS SAMYANG (2) — isi
  kemasannya belum terdaftar di `bahan_baku`, jadi tak ada faktor sah. Ini
  **salah hari ini juga**, bukan cuma soal riwayat.
- **Menunggu pemeriksaan sisi qty:** MAYONAISE (14), SAOS TOMAT POUCH (7),
  KEJU (2), PLASTIK MERAH (2), PAPER WRAP (10).

### Bahan keputusan: nasib 2.626 snapshot surat jalan

Metode pemisahan (8 September, menggantikan pemisah sebelumnya yang cacat):
untuk tiap (bahan, nilai snapshot), cari faktor `f` dari kandidat
{1, faktor_tengah, faktor_tampilan, faktor_konversi, tampilan/tengah} yang
membuat `snapshot × f` **paling dekat** ke master. Sisa rasionya jadi ukuran
keyakinan. Ini tidak menuntut rasio mendarat persis di faktor, sehingga tidak
runtuh saat harga ikut bergerak — kelemahan pemisah sebelumnya dan juga
kelemahan GUARD SALAH SATUAN.

| Kelompok | Grup | Baris | Nilai apa adanya | Kalau diskala |
|---|--:|--:|--:|--:|
| Basis sub-satuan (f > 1) | 14 | 481 | Rp20,9 jt | Rp381,9 jt |
| Tidak terjelaskan | 6 | 162 | Rp2,3 jt | — |
| Basis benar (f = 1) | 45 | 1.983 | Rp937,6 jt | tak berubah |

**Basis sub-satuan** — snapshot per sub-satuan sementara `qty_dikirim` satuan
besar. Keyakinan per grup dari sisa rasio: **kuat** (≈1,00) KENTANG 25.000,
FOIL 8.791, KERTAS STRUK, BAWANG, CUP, KENTANG 24.000; **lemah** (harga ikut
bergerak) MAYONAISE 1,15, FOIL 11.957/11.554 1,36/1,31, PLASTIK MERAH 1,31,
KEJU 0,90, SAOS TOMAT POUCH 0,90, PAPER WRAP 0,86.

⚠️ **PAPER WRAP perlu dilihat manusia**: 37 baris, nilai apa adanya Rp8.176
menjadi Rp40,9 juta kalau diskala (f = 5.000). Lonjakan sebesar itu dari angka
sekecil itu patut dicurigai — mungkin masternya sendiri (Rp925.000/Ikat) yang
salah, bukan snapshotnya.

**Tidak terjelaskan** — tak ada faktor terdaftar yang mendekatkan snapshot ke
master. Uangnya kecil (Rp2,3 jt) tetapi diagnostik: menandakan **faktor kemasan
bahan itu belum terdaftar benar**. SAOS CABE butuh ~16, SAOS SAMYANG ~19,
PLASTIK MERAH ~450, STIKER ~13 — tak satu pun ada di kolom faktornya.

### Tidak ada jendela historis yang bersih

Perubahan satuan FOIL (8 September) membuat 10 baris SJ tertanggal 3–8
September ikut tidak sebanding — jadi bahkan periode sesudah normalisasi 3
September pun tidak bersih. Batas bersih yang jujur adalah **sejak hari ini ke
depan**, dan hanya bertahan kalau setiap perubahan satuan berikutnya ikut
menskala dokumen historisnya.

### Meredakan: belum ada laporan yang salah hari ini

`harga_snapshot` hanya dibaca `hpp_nilai_stok_harian_spv` dan
`hpp_barang_masuk_harian_spv`, yang memberi makan `get_hpp_periode` — dan itu
**dorman** (produksi memakai `menu_items.hpp_override`). Jadi tidak ada angka
yang sedang salah di layar. Tapi view itulah yang menyala kalau HPP dinamis atau
rata-rata tertimbang dinyalakan — snapshot berbasis campur akan langsung jadi
masalah saat itu.

---

## ⛔ ATURAN — "outlet tes" JANGAN masuk perhitungan apa pun

**Keputusan owner, 8 September 2026:**

> "outlet tes hanya untuk testing oleh developer, jadi jangan masuk ke
> perhitungan"

Berlaku untuk **semua** angka: omzet, HPP, laba, nilai persediaan, waste,
laporan apa pun. Isinya angka karangan — sisa uji bug skala opname, "reset ke
10× reorder point", dan percobaan lain.

**Cara mengenalinya:** `outlets.type = 'test'` (bukan lewat nama — nama bisa
berubah). Saat ini hanya satu baris: "outlet tes".

Ikut dikecualikan dengan alasan berbeda: `type = 'marketplace'` (Shopee &
TikTok Shop) — outlet virtual yang tak pernah memegang barang fisik, jadi tak
masuk hitungan **persediaan**. Untuk omzet, marketplace justru sah dihitung —
jangan disamakan dengan outlet tes.

### Sudah ditutup

| Tempat | Status |
|---|---|
| `nilai_persediaan_spv` | ✅ dikecualikan (`20300131000000`) |
| HPP & waste — 6 fungsi RPC | ✅ lewat helper `outlet_ids_terhitung()` (`20300132000000`) |
| `sales_summary_spv` & `menu_sales_spv` | ✅ dikecualikan (`20300133000000`) |
| Sisi klien — daftar outlet tiap app | ✅ ditutup 8 Sep (rincian di bawah) |

**Helper baru `outlet_ids_terhitung()`** — pakai ini untuk agregasi laporan
baru. Ia = `accessible_outlet_ids()` minus lokasi non-operasional.
`accessible_outlet_ids()` SENGAJA tidak diubah: itu mengatur hak baca, dan
kalau outlet tes dikeluarkan dari sana, developer tak bisa lagi melihat data
ujinya sendiri. Aturannya "jangan dihitung", bukan "jangan dilihat".

Dibuktikan tak ada efek samping: omzet total 1.679.672.213 → 1.678.792.213
(−Rp880.000, tepat sebesar omzet outlet tes), baris view −7 dan −26 persis
seperti yang diukur sebelum perubahan.

Sebelum ditutup, halaman Nilai Persediaan menampilkan **Rp2,45 miliar** di
kartu "Belum Pasti" — **Rp2,37 miliar** di antaranya murni dari outlet tes.
Angka jujurnya: pasti Rp358,8 juta, belum pasti Rp75,0 juta.

### ⚠️ Yang masih terbuka

Outlet tes tetap **aktif** (`is_active = true`) dan datanya masih ada di tabel
dasar — 17 order, 1.663 baris ledger, 2 laporan waste. Itu **disengaja**: ia
memang outlet uji dan harus tetap bisa dipakai. Yang sudah ditutup adalah
jalur **perhitungannya**, bukan datanya.

**Kalau menggarap yang tersisa:** cari agregasi yang mengelompokkan per
`outlet_id` tanpa memeriksa `type`. Untuk yang di database, pakai
`outlet_ids_terhitung()` yang sudah ada. **Jangan andalkan `is_active`** —
outlet tes justru `is_active=true`, dan banyak agregasi tak memeriksanya.

### Sisi klien — daftar outlet tiap app (ditutup 8 September)

Tiap app menarik daftar outletnya sendiri; memperbaiki satu tidak memperbaiki
yang lain (pola yang sama dengan kebocoran marketplace, Session 2026-08-05
butir 1b). Ditelusuri satu per satu, bukan ditebak:

| App | Tempat | Tindakan |
|---|---|---|
| admin-dashboard | `lib/outletFilters.ts` + ~20 pemakai | sudah ditutup lebih dulu (`f8f01556`) |
| HR | `hooks/useOutlets.ts` | sudah ditutup lebih dulu |
| finance | `hooks/useOutlets.ts`, `hooks/useCashDeposit.ts` | ✅ disaring |
| owner-dashboard | `hooks/useSalesSummary.ts` + 3 halaman dashboard | ✅ disaring |
| manager | `app/page.tsx`, `app/reports/page.tsx` | ✅ daftar outlet **dan** agregat order/waste |
| distribusi | `hooks/useOutlets.ts` (tujuan surat jalan) | ✅ disaring |
| stok | `lib/queries/monitoring.ts` `fetchOutletsList` | ✅ disaring |
| stok | `hooks/useOutletScope.tsx` (OutletSwitcher) | ⬜ **sengaja dibiarkan** |
| inventori | peta nama outlet di laporan inventaris | ⬜ sengaja dibiarkan |

**Dua yang sengaja dibiarkan, dan alasannya:**

- **OutletSwitcher di app stok** adalah pintu masuk developer untuk menjalankan
  pengujian (opname, mutasi, permintaan) di outlet tes. Aturannya "jangan
  dihitung", bukan "jangan dilihat" — sama persis dengan alasan
  `accessible_outlet_ids()` tidak diubah.
- **Laporan inventaris di app inventori** hanya memakai daftar outlet sebagai
  peta id→nama untuk menampilkan label; ia tidak menjumlahkan uang.

**Di `apps/manager` daftar outletnya saja tidak cukup** — halaman utamanya
menjumlahkan `orders` dan `stok_waste_reports` langsung dari tabel mentah, jadi
penyaring dipasang di tiap agregat juga.

**Catatan penyaring:** app-app baru memakai `TEST_OUTLET_ID` + `outlets.type`
(`apps/{stok,distribusi,owner-dashboard,manager}/src/lib/outletFilters.ts`),
bukan kecocokan potongan nama seperti berkas serupa di admin-dashboard/finance/
HR. Hari ini keduanya memberi hasil sama (diperiksa: dari 29 outlet hanya
"outlet tes" yang kena), tetapi nama outlet bisa diubah admin kapan saja
sedangkan `type` diisi oleh skema.

**Ukuran masalahnya, supaya tak dibesar-besarkan:** omzet outlet tes 0,051% dari
total (Rp0,88 jt dari Rp1.739 jt), dan karena semua laporan dikelompokkan per
outlet, ia muncul sebagai baris sendiri — tidak pernah mencemari angka outlet
lain. Menambal sisa jalur ini soal kerapian, bukan kebenaran angka.

**Catatan terpisah:** KANTOR PUSAT (`type = 'office'`) juga dummy, tapi
**tidak** bisa disaring per-type — jenis itu memuat GUDANG PUSAT (HQ) yang
merupakan gudang sungguhan dan pemegang persediaan terbesar. Nilainya kecil
(2 baris, Rp2,4 juta) dan dibiarkan tampil, bukan disembunyikan lewat
penyaring nama yang rapuh. Bersih-bersih datanya pekerjaan tersendiri.

---

## SUDAH SELESAI

- **FOIL digabung** — FOIL (48) dinonaktifkan, saldo dipindah lewat 42 baris
  ledger berpasangan (jumlah bersih nol), harga disesuaikan ke Rp8.791,2 dengan
  jejak riwayat. Hasil: outlet minus 17 → 1, nilai persediaan foil Rp14,3 juta.

### Sudah dikerjakan orang lain di `main` (jangan diulang)

Diperiksa 3 September setelah merge. Beberapa hal yang semula dicatat sebagai
pekerjaan tersisa ternyata sudah selesai:

| Migration di `main` | Menyelesaikan |
|---|---|
| `20300122000002_hpp_periode_pakai_kemasan_qty` | rumus HPP pakai `kemasan_qty` — migration duplikat buatan sesi ini sudah dibuang |
| `20300120000001_fix_waste_breakdown_faktor_penuh` | `get_waste_breakdown` kini pakai faktor penuh |
| `20300122000003_polybag_faktor_dan_harga` | POLYBAG — owner konfirmasi satuannya hanya Pack & Pcs; tingkat "Ikat" tidak ada di lapangan. Terverifikasi di DB: satuan kini Pack, kemasan_qty 9 |
| `20300120000000_fix_faktor_konversi_14_bahan` | faktor konversi 14 bahan |
| `20300122000001` + `20300122000004` | normalisasi harga 51 bahan |

**Pelajaran:** ada kerja paralel di repo ini. Sebelum menggarap butir mana pun
di bawah, cek dulu `main` — bisa jadi sudah dikerjakan.

---

## MULAI DARI SINI (untuk sesi berikutnya)

**Tugasnya:** memutuskan metode basis harga bahan baku (butir 1 di bawah).

**Baca dulu, jangan mulai dari nol:**

1. Bagian "MENUNGGU KEPUTUSAN" tepat di bawah ini — tiga pilihan beserta angkanya
2. `docs/AUDIT-2026-09-02-HARGA-BAHAN-DUA-VENDOR.md` Bagian IV — pengukuran lengkap
3. `docs/SKENARIO-BAHAN-DUA-VENDOR-BAHASA-AWAM.md` Bagian 7 — sisi akuntansi

**Yang sudah ditolak — jangan diusulkan ulang:**

| Pernah diusulkan | Kenapa tidak jadi |
|---|---|
| FIFO per batch | Menuntut stokis memilih batch tiap kirim di 19 outlet, demi selisih yang terukur nol |
| Pisahkan bahan per vendor | Sudah dicoba pada FOIL dan terbukti merusak — 17 outlet bersaldo minus |
| Harga standar | Butuh ritual tinjauan bulanan yang belum ada pemiliknya |

**Angka terakhir (4 September):**

- Dampak dua-vendor ke HPP: **nol** — perputaran cepat, stok sisa selalu dari kiriman terakhir
- Nilai persediaan: pasti Rp348,2 jt · belum pasti 79 baris (seluruhnya BNR)
- Nilai persediaan bergeser ~Rp2,3 juta/minggu **tanpa transaksi** — ini alasan
  utama mempertimbangkan perubahan, bukan selisih HPP-nya

**PRASYARAT yang belum terpenuhi: BNR belum opname.** Selama 79 baris itu skalanya
belum pasti, rata-rata tertimbang akan menghitung dari satuan campuran — kelas
kesalahan yang sudah tiga kali menyesatkan di sesi sebelumnya. Periksa dulu:

```sql
SELECT count(*) FILTER (WHERE saldo_is_gram(sb)) AS sudah,
       count(*) FILTER (WHERE NOT saldo_is_gram(sb)
                        AND sb.saldo <> 0 AND b.is_active) AS belum_perlu_digarap
FROM stok_balance sb JOIN bahan_baku b ON b.id = sb.bahan_baku_id;
```

Kalau `belum_perlu_digarap` masih puluhan, BNR belum opname — selesaikan itu dulu.

**Dijalankan 4 September (sesi lanjutan): `belum_perlu_digarap` = 79, dengan 39
di BNR. Masih terhalang.** Catatan praktis: `exec_sql` mengembalikan `void`,
jadi tidak bisa dipakai membaca. Untuk kueri baca pakai
`supabase db query "<sql>" --linked` — terbukti jalan dari mesin ini.

**Butir 2 (konfirmasi PSAK) tidak butuh sesi coding.** Jawabannya menentukan
seberapa mendesak butir 1: kalau metode sekarang memang tidak diakui standar,
itu alasan mengubahnya yang berdiri sendiri, terlepas dari selisih angkanya
yang nol.

**Prinsip yang sudah disepakati** ada di bagian paling bawah dokumen ini —
vendor tidak boleh naik jadi identitas barang.

---

## MENUNGGU KEPUTUSAN

### 1. Metode basis harga bahan baku

**Tiga pilihan, belum diputuskan:**

| | Artinya | Konsekuensi |
|---|---|---|
| Terima temuan | Tidak mengubah cara hitung | Paling cepat; tinjau lagi kalau ada bahan berputar lambat |
| Rata-rata tertimbang | Harga = campuran sesuai stok | Menutup "nilai bergerak tanpa transaksi" |
| Tunda | Ukur ulang beberapa minggu lagi | Tidak ada yang dikerjakan sekarang |

**Yang sudah diukur:** dampak dua-vendor ke HPP = **nol** (perputaran barang
cepat, stok sisa selalu dari kiriman terakhir). Tapi dari sisi **neraca**, metode
sekarang membuat nilai persediaan bergerak tanpa transaksi — Rp2,3 juta/minggu
dari pergerakan harga wajar.

**Rincian:** `docs/AUDIT-2026-09-02-HARGA-BAHAN-DUA-VENDOR.md` Bagian IV,
dan `docs/SKENARIO-BAHAN-DUA-VENDOR-BAHASA-AWAM.md` Bagian 7.

### 2. Konfirmasi ke pemegang pembukuan

Setahu saya PSAK 14 hanya mengakui **FIFO** dan **rata-rata tertimbang** sebagai
cara menghitung biaya persediaan. Metode berjalan sekarang adalah "harga
pembelian terakhir", yang bukan salah satunya.

**Ini bukan nasihat akuntansi** — perlu dikonfirmasi ke yang memegang pembukuan.
Kalau benar, keputusan butir 1 jadi lebih mendesak.

---

## PEKERJAAN KECIL, BISA DICICIL

### 3. Sapuan berkala FOIL (48)

Cek kapan saja:

```sql
SELECT count(*) AS outlet, round(COALESCE(sum(saldo),0)) AS total
FROM stok_balance
WHERE bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'::uuid
  AND saldo <> 0;
```

Hasil >0 → jalankan ulang LANGKAH 2 & 3 di
`docs/draft-sql/gabung-foil-48-ke-foil.sql`.

**Ritme:** seminggu lagi, lalu bulanan. Aman diulang.
**Jangan** menunggu 26 surat jalan lama tuntas — 130 dari 198 surat jalan
'dikirim' di sistem ini sudah >2 minggu, jadi itu takkan terjadi.

**Status 3 September (setelah 25 SJ diverifikasi owner):** saldo FOIL (48) masih
**0**, sapuan belum perlu. 25 dokumen yang dituntaskan itu berstatus
`diterima_lengkap`/`diterima_sebagian` — stoknya sudah mendarat di outlet
sebelum penyapuan kemarin, jadi ikut tersapu. Yang memuat FOIL (48) dan masih
menggantung tinggal 21 `dikirim` + 5 `draft`; keduanya belum menaruh stok
karena barangnya belum diterima outlet.

### 4. Opname FOIL di Cirendeu

Saldo −4.622 cm (±6 Roll). Ini selisih fisik nyata, sudah ada sejak sebelum
penggabungan. Perlu hitung fisik, bukan penyesuaian di sistem.

### 5. Beri tahu tim

- **Purchasing:** pesan foil ke bahan **"FOIL"**, bukan "FOIL (48)".
- **Distribusi:** kirim **"FOIL"** ke outlet.

FOIL (48) sudah nonaktif, jadi tak akan muncul di daftar pilihan — tapi kalau
belum diberi tahu, mereka akan bingung mencari barangnya.

### 6. Risiko basis satuan di nota PO berikutnya

POLYBAG **sudah beres** lewat `main` (lihat bagian Sudah Selesai). Yang tersisa
tinggal satu risiko, bukan kesalahan data:

PLASTIK MERAH master-nya Rp90.000 per Ikat (isi 100 lembar) — sudah benar. Tapi
nota PO lama mencatatnya Rp18.000, yaitu harga **per Pack**. Kalau nota
berikutnya diinput dengan cara yang sama, harga master jatuh 90.000 → 18.000 dan
biaya **18 resep** ikut anjlok 80% tanpa peringatan apa pun.

**Catatan baik:** form PO di sistem tidak bermasalah — 10 dari 10 baris
PO/KITCHEN basisnya benar. Penyimpangan hanya di dokumen SPB lama.

**Langkah pertama kalau mau digarap:** tambahkan penjagaan di layar penerimaan
PO — tampilkan satuan master ("Harga per Ikat, isi 100 Lembar") dan beri
peringatan kalau harga yang diinput menyimpang jauh dari harga master.

### 7. Waste — sebagian sudah beres, satu belum diperiksa

`get_waste_breakdown` **sudah diperbaiki** di `main`
(`20300120000001_fix_waste_breakdown_faktor_penuh`) — terverifikasi memakai
faktor penuh.

Yang belum jelas: `get_waste_periode` tidak memakai `kemasan_qty` maupun faktor
apa pun — rumusnya `w.qty * harga_beli` polos. Itu benar HANYA kalau `w.qty`
tersimpan dalam satuan besar. Belum diverifikasi. Kalau ternyata `w.qty` dalam
satuan kecil (gram/lembar), nilai waste meleset sebesar faktor kemasan.

**Langkah pertama:** ambil beberapa baris `stok_waste_reports` dan bandingkan
besaran `qty`-nya dengan satuan bahannya.

### 8. ~~Laporan nilai persediaan belum ada~~ — SUDAH DIBUAT

Persediaan bernilai **Rp409 juta** (gudang Rp161,8 jt + 24 outlet Rp247,1 jt)
dulu tidak terhitung di halaman mana pun. Sekarang sudah ada, dan sudah di
`main`:

- `supabase/migrations/20300129000000_nilai_persediaan_view.sql`
- `apps/stok/src/app/stok/nilai-persediaan/page.tsx`
- `apps/stok/src/components/nilai-persediaan/NilaiPersediaanBoard.tsx`
- `apps/stok/src/hooks/useNilaiPersediaan.ts`

Halaman ini sengaja **jujur soal yang belum pasti** — memisahkan nilai yang
pasti dari baris yang skalanya belum tentu. Selama BNR belum opname, bagian
"belum pasti" itu tidak akan kosong.

### 9. Surat jalan menggantung

130 surat jalan berstatus 'dikirim' berumur >2 minggu, menahan barang senilai
**Rp1,2 juta** — sudah keluar dari catatan gudang, belum masuk catatan outlet.
Ditambah 37 draft berumur >2 minggu.

Bukan urusan foil, dan nilainya kecil. Tapi artinya ada kebiasaan surat jalan
tidak ditutup, dan itu membuat angka stok gudang & outlet terus meleset tipis.

---

## STATUS BRANCH

**Seluruh isi branch `claude/new-session-0f1553` sudah ada di `main`** (dicek 4
September setelah `git fetch`) — migration `20300127`–`20300130`, halaman Nilai
Persediaan, koreksi satuan, dan ketiga dokumen. Tidak ada lagi yang menggantung
di branch.

⚠️ **Hati-hati membandingkan ke `main` lokal yang belum di-fetch.** Sesi 4
September sempat menyimpulkan "empat migration tidak punya jejak di riwayat"
— salah, karena `main` lokal tertinggal 50-an commit dari `origin/main`.
`git fetch` dulu sebelum menyimpulkan apa pun soal apa yang sudah/belum masuk.

Yang **memang tidak punya jejak di migration**: penggabungan FOIL dan
penyesuaian harganya, karena dijalankan lewat SQL Editor. Kalau database
dibangun ulang dari nol, penggabungan FOIL tidak ikut. Naskahnya disimpan di
`docs/draft-sql/gabung-foil-48-ke-foil.sql` sebagai catatan apa yang
dijalankan.

---

## PRINSIP YANG SUDAH DISEPAKATI

Untuk bahan dengan lebih dari satu vendor:

> **Vendor adalah urusan dokumen pembelian. Ia tidak pernah naik ke identitas
> barang, ke resep, atau ke outlet.**

Turunannya:

1. Satu barang = satu bahan baku, berapa pun vendornya — pemisahan hanya sah
   kalau spesifikasi barangnya memang berbeda *(FOIL membuktikan pelanggarannya
   merusak)*
2. Basis satuan dikunci di master, vendor yang menyesuaikan
3. Harga tiap pembelian disimpan utuh per vendor, selamanya — jangan diratakan
4. Harga master mewakili barang yang **ada**, bukan pembelian terakhir
   *(← ini yang belum terpenuhi, isi keputusan butir 1)*
5. Perbedaan vendor dilaporkan terpisah, bukan diaduk ke HPP

---


---

## CATATAN: migrasi skala satuan yang belum selesai

Ditemukan 3 September lewat uji langsung di "outlet tes". Awalnya dikira bug
konversi satuan; setelah diuji, **ternyata bukan bug**. Dicatat di sini supaya
tidak ada yang mengejar hantu yang sama.

### Apa yang terlihat seperti bug

Uji: kirim FOIL 1 Roll dari Gudang Pusat ke outlet tes.

```
16:45:59  GUDANG PUSAT   transfer_keluar   −760
16:46:52  outlet tes     terima_kiriman      +1
```

Terlihat seperti 759 unit menguap. **Tidak.** Keduanya mewakili barang yang
sama — 1 Roll. Gudang menyimpan FOIL dalam cm, outlet tes menyimpan dalam Roll.

### Mekanismenya

`to_ledger_scale(outlet, bahan, qty_besar)` mengubah qty ke skala penyimpanan
**baris itu sendiri**, ditentukan oleh:

```sql
saldo_is_gram(sb) = EXISTS(opname_selisih untuk (outlet,bahan) sejak
                           2026-08-01 20:32)
```

Jadi sebuah baris stok "pindah" ke skala satuan kecil begitu outlet melakukan
opname atasnya. Ini penanda **migrasi bertahap** — dan migrasinya rampung
sendiri seiring outlet melakukan opname.

**Status 3 September: 981 baris sudah skala kecil, 579 belum** (dari 1.560).

Bukti konsistensinya ada di pemakaian: outlet skala-kecil memakai ~50 per porsi
(cm), outlet skala-besar memakai 0,019 (Roll). Tiap baris konsisten dengan
satuannya sendiri.

### Yang benar-benar perlu diperhatikan

Tidak semua penulis ledger sadar skala:

| Fungsi | Sadar skala? |
|---|---|
| `finalize_surat_jalan` (terima kiriman) | ✅ `to_ledger_scale` |
| `sj_on_dikirim_kurangi_kitchen` (kirim) | ✅ `to_ledger_scale` |
| `process_waterfall_deduction` (BOM) | ✅ `saldo_is_gram` |
| **`finalize_opname`** | ❌ tidak |
| **`process_waste_report_approval`** | ❌ tidak |

Dua yang terakhir menulis angka mentah. Diperiksa empiris: besaran waste
konsisten dengan pemakaian (sapi ~100 gram/porsi vs waste 2.000–8.000 gram),
jadi **belum terlihat kerusakan nyata** — tapi keduanya rawan, dan
`finalize_opname` khususnya ironis karena opname-lah yang menentukan skala
sebuah baris.

**Langkah pertama kalau digarap:** buat keduanya memakai `to_ledger_scale`
seperti penulis lain, lalu uji ulang dengan pola yang sama (satu transaksi
percobaan di outlet tes, periksa baris ledger yang keluar).

### Pelajaran metodologis

Tiga kali dalam sesi ini angka besar yang mengkhawatirkan menyusut atau hilang
setelah diverifikasi: Rp47 juta → Rp9,8 juta → nol (dampak dua-vendor), dan
"162 baris kurang kredit" → bukan bug sama sekali. Pola penyebabnya sama:
**menyimpulkan dari perbandingan angka tanpa memeriksa apakah kedua angka itu
memakai satuan yang sama.**

Untuk temuan stok di sistem ini, uji langsung satu transaksi jauh lebih murah
dan lebih meyakinkan daripada arkeologi data historis.

---

## BUG TERKONFIRMASI (3 September) — finalize_opname tidak sadar skala

Dibuktikan lewat **dua uji langsung** di outlet tes, bukan dugaan.

### Uji 1 — fisik pas, tanpa selisih

AYAM outlet tes, saldo tersimpan 10 (satuan besar = 10 Kg), belum gram-scale.

```
qty_fisik 10.000   qty_system 10.000   selisih 0
-> tidak ada baris ledger ditulis
-> baris TIDAK pernah terkonversi, tetap 10
```

### Uji 2 — fisik 9 Kg

```
qty_fisik 9.000   qty_system 10.000   selisih -1.000
-> ledger opname_selisih -1.000
-> saldo = 10 + (-1.000) = -990
-> baris jadi gram-scale, -990 dibaca sebagai -990 GRAM
```

Stok yang seharusnya 9.000 gram tercatat **−990**. Terlihat juga di layar
pengguna: "STOK AKTUAL −990 Gram".

### Akarnya

Form opname **membaca saldo dalam satuan besar** (menampilkan "Sistem: 10 Kg" —
benar) tapi **menyimpan dalam satuan kecil** (`qty_fisik` 9.000 gram, `selisih`
−1.000 gram). Lalu `finalize_opname` menambahkan selisih gram itu ke saldo yang
masih tersimpan dalam satuan besar.

Ini juga menjelaskan kenapa migrasi skala **mandek di 579 baris**: opname tanpa
selisih tidak membalik skala (tak ada baris ledger), opname dengan selisih
merusak angkanya. Barisnya terjebak di antara keduanya.

### Perbaikan

`supabase/migrations/20300128000000_finalize_opname_sadar_skala.sql`
— **sudah diterapkan & sudah masuk `main`.** Diverifikasi ulang 4 September
lewat `pg_get_functiondef('finalize_opname')`: badan fungsi di produksi memang
sudah memakai `saldo_is_gram`.

```
delta = qty_fisik - saldo_tersimpan     (untuk baris belum gram-scale)
delta = selisih                          (untuk baris sudah gram-scale, tak berubah)
```

Pemulihan baris uji: `docs/draft-sql/pulihkan-ayam-outlet-tes.sql`.

---

## BUTIR BARU — layar salah melabeli satuan untuk baris belum terkonversi

Terungkap dari tangkapan layar saat uji di atas.

Layar **selalu melabeli angka ledger dengan satuan kecil**, tanpa memeriksa
apakah baris itu sudah terkonversi:

```
Adjustment  +21,16 Gram        <- terjadi saat baris masih satuan besar,
                                  aslinya 21,16 Kg
Terpakai Penjualan (BOM): 0,6 Gram   <- aslinya 0,6 Kg
```

Untuk **579 baris** yang masih berskala satuan besar, seluruh angka riwayatnya
tampil dengan satuan yang salah — 1.000× lebih kecil dari kenyataan (atau
sebesar faktor kemasan masing-masing).

Ini **tidak merusak data**, tapi membuat orang salah baca. Dan lebih buruk lagi:
ia **menyembunyikan** bug opname di atas, karena angka yang salah tetap terlihat
wajar.

**Langkah pertama kalau digarap:** komponen tampilan stok perlu memeriksa
`saldo_is_gram` sebelum memilih label satuan — sama seperti form opname yang
sudah melakukannya dengan benar.

Butir ini otomatis hilang begitu 579 baris itu terkonversi semua.

---

## VERIFIKASI 4 SEPTEMBER — opname malam pertama setelah perbaikan

Opname rutin 3 September malam: **21 opname, 18 outlet, 720 item dihitung.**

**Perbaikan `finalize_opname` bertahan.** Tidak ada kerusakan; saldo minus justru
turun **63 → 57**. Ini malam pertama fungsi baru itu dipakai massal.

### Migrasi skala satuan: praktis selesai

Angka "577 baris belum terkonversi" **menyesatkan**. Rinciannya:

```
577 baris belum terkonversi
├─ 437  saldonya NOL              → tak ada yang perlu dikonversi
├─  59  bahan sudah dinonaktifkan → sisa stok bahan mati
└─  81  aktif & bersaldo          ← pekerjaan sebenarnya
```

Dari 81 itu:

| Lokasi | Baris | Perlu digarap? |
|---|---|---|
| **SUKA SHAWARMA BNR** | **41** | ✅ ya |
| outlet tes | 22 | tidak (outlet uji) |
| KANTOR PUSAT | 17 | tidak (outlet dummy) |
| GUDANG SS ONLINE | 1 | tidak (marketplace) |

**Dihitung ulang 4 September (sesi lanjutan):** 1.561 baris total — 984 sudah
skala kecil, 577 belum, dari situ **79 aktif & bersaldo**. Sebarannya sama,
BNR turun tipis 41 → **39**. Praktis tidak bergerak.

---

## 🔴 BNR HARUS OPNAME — ditunda atas keputusan owner 4 September

**Keadaan (diverifikasi 4 September):**

| Outlet | Opname 30 hari | Order 30 hari |
|---|---|---|
| **SUKA SHAWARMA BNR** | **0** | 606 |
| Outlet lain (18) | 20–25 | 900–2.500 |

BNR **tidak pernah opname sama sekali** dalam 30 hari, padahal beroperasi normal.

**Temuan tambahan 4 September:** sepanjang riwayat BNR cuma punya **6 opname**,
dan satu-satunya dalam 30 hari terakhir adalah **draft 13 Agustus yang tidak
pernah difinalisasi**. Jadi bukan sekadar telat — prosesnya berhenti di tengah.
Sebelum meminta BNR opname ulang, ada baiknya dicek dulu apakah ada hambatan
teknis yang membuat draft itu mandek, bukan sekadar kelalaian.

**Akibatnya, dan ini bukan sekadar soal laporan:**

Karena tak pernah di-opname, 41 baris stoknya masih berskala satuan besar.
Pemotongan BOM tiap penjualan memakai skala itu, sehingga stok **hampir tidak
pernah berkurang di sistem**. Contoh terukur:

```
FOIL di BNR        : saldo 34.466 (isi cm), dipotong 0,060 per order
FOIL di outlet lain: saldo serupa,          dipotong ~50 per order
```

Dengan 0,06 per order, stok foil BNR baru habis setelah 574.000 order.

Konsekuensi praktis:
- Angka stok BNR tidak bisa dipercaya
- Peringatan stok menipis tidak akan pernah menyala di BNR
- Permintaan bahan BNR kemungkinan tidak mencerminkan kebutuhan asli
- BNR ikut mengotori laporan Nilai Persediaan (masuk kategori
  "skala belum pasti", 41 dari 79 baris)

**Tindakannya sederhana:** minta BNR melakukan **opname penuh** — hitung
41 bahan sekaligus, bukan sebagian. Sekali jalan semuanya terkoreksi, lalu BNR
ikut ritme normal seperti 18 outlet lain.

**Ini juga prasyarat keputusan metode basis harga** (butir 1 di atas). Syarat
"tunggu satuannya seragam" tinggal menunggu BNR.
