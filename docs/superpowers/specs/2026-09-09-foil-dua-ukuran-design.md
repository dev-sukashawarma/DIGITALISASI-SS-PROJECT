# FOIL Dua Ukuran — Pisah Bahan per Spesifikasi Kemasan + Waterfall

**Tanggal:** 2026-09-09
**Status:** Spec — menunggu persetujuan owner sebelum rencana eksekusi ditulis
**Pemilik keputusan:** owner

---

## 1. Masalah

Dua vendor memasok FOIL dengan **panjang roll berbeda**, dan ukurannya tidak
bisa diminta seragam:

| Vendor | Spesifikasi | Harga/roll | Harga/cm |
|---|---|---|---|
| Ekadharma International | 30 cm x **7,6 m** (760 cm) | Rp 11.554 | **15,2026** |
| PT Altindo Mulia | 30 cm x **5 m** (500 cm) | Rp 8.791 | **17,5820** |

> "A masalahnya kita gabisa request ukuran ke vendornya" — owner, 9 Sep 2026

Sistem hanya punya SATU bahan `FOIL`, dan panjang roll disimpan di
`bahan_baku.faktor_konversi` — **properti per-bahan, bukan per-vendor**.
Nilainya 760. Akibatnya:

- Setiap roll Altindo yang masuk dicatat 760 cm, padahal isinya 500 cm.
- Harga master memasangkan **harga per-roll Altindo** dengan **panjang roll
  Ekadharma** menjadi Rp 11,5674/cm — angka yang tidak dimiliki vendor mana pun.
- Selama dua panjang roll hidup berdampingan, tiap opname akan salah lagi.
  Koreksi satu kali tidak akan bertahan.

**Keputusan owner (9 Sep 2026):** pisahkan jadi dua bahan, dipasangkan dengan
mekanisme substitusi berjenjang (`bahan_baku_substitusi` +
`process_waterfall_deduction`) yang sudah ada di sistem.

Owner menerima lima konsekuensi yang diajukan: opname dua baris, distribusi
wajib memilih varian yang benar, penataan resep, hitung fisik Gudang Pusat,
dan tidak perlunya hitung ulang di outlet.

---

## 2. Fakta terverifikasi (DB live, 9 Sep 2026)

### 2.1 Bahan

`FOIL` — `4804d1fc-f06c-4306-adfd-a798bda1275a`, aktif

| Kolom | Nilai | Arti |
|---|---|---|
| `satuan` / `satuan_tengah` / `satuan_kecil` | Dus / Roll / cm | tiga tingkat |
| `faktor_tengah` | 48 | **Roll per Dus** |
| `faktor_konversi` | 760 | **cm per Roll — inilah yang beda antar vendor** |
| `faktor_tampilan` | 36.480 | cm per Dus (48 x 760) |
| `satuan_po` / `faktor_po` | roll / 760 | |
| `satuan_distribusi` | roll | |

`FOIL (48) (DIGABUNG KE FOIL)` — `fb243647-...` sudah **nonaktif**, saldo nol
di seluruh outlet, nol resep. Tidak menghalangi apa pun.

> ⚠️ Koreksi terhadap analisis lisan sebelumnya: yang membedakan vendor adalah
> `faktor_konversi` (cm per Roll), **bukan** `faktor_tengah`. `faktor_tengah = 48`
> adalah isi Dus dan tidak ada kaitannya dengan panjang roll.

### 2.2 Harga master

`bahan_baku_harga`: `harga_beli` 421.977,6 per **Dus**, `kemasan_qty` 36.480 cm
menjadi **11,5674/cm**. Nilai `harga_beli` ini berasal dari harga per-roll
Altindo (8.791,2 x 48); yang salah hanya `kemasan_qty`-nya.

### 2.3 Katalog vendor (`bahan_baku_supplier`, dibuat 8–9 Sep)

Kedua baris sudah membawa angka yang benar — katalog satu-satunya tempat di
sistem yang saat ini tahu bahwa ada dua ukuran:

| Supplier | `satuan_beli` | `isi_satuan_kecil` | `harga` | `harga_per_satuan_kecil` |
|---|---|---|---|---|
| PT Altindo Mulia | roll | **500** | 8.791 | 17,5820 |
| Ekadharma International | roll | **760** | 11.554 | 15,2026 |

### 2.4 Saldo (satuan kecil = cm)

| Lokasi | Saldo (cm) | Catatan |
|---|---|---|
| GUDANG PUSAT (HQ) | **832.960** | = 1.096 Roll bila dihitung @760; **campur dua ukuran** |
| outlet tes | 224.968 | dikecualikan dari perhitungan (aturan `outlets.type='test'`) |
| 21 lokasi operasional | **771.674** | **Altindo 500 cm saja** (konfirmasi owner) |
| JAGAKARSA | −205 | minus tipis, tak terkait |
| Cirendeu, Cibinong, Kantor Pusat | ~0 | sisa pembulatan float |

### 2.5 Resep

**16 resep global aktif** memotong FOIL, 35–50 cm per porsi, satuan `cm`.
Nol resep menunjuk `FOIL (48)`.

### 2.6 Dokumen berjalan

- **PO terbuka: 0.**
- **Surat jalan `draft`/`dikirim`: 26 baris**, `qty_dikirim` tersimpan dalam
  **satuan besar (Dus)**:
  - 9 Sep (draft): Sentul 1 Dus, Paledang 1 Dus
  - 7 Sep (dikirim): Cibinong 1 Dus
  - 4 Sep (dikirim): Cileungsi 2 Dus, Cirendeu 1 Dus
  - 21 sisanya Jul–Agu, 0,0009–0,08 Dus (1–4 Roll), basi

---

## 3. BLOKER — waterfall tidak mengonversi satuan antar bahan

**Harus diperbaiki sebelum FOIL dipecah, dan ia sudah merusak data hari ini.**

`trg_process_bom_stok` memanggil:

```
process_waterfall_deduction(outlet, bahan, qty_per_porsi / faktor_tampilan, ...)
```

— qty dalam **satuan besar bahan utama**. Di dalam fungsi, sisa yang tidak
tertutup dilimpahkan ke bahan pengganti **apa adanya**, tanpa dikalikan rasio
faktor. Bahan pengganti dengan `faktor_tampilan` berbeda dipotong salah
sebesar rasio itu.

### Bukti — sedang berjalan di produksi

| Bahan | `faktor_tampilan` |
|---|---|
| SAOS TOMAT POUCH (utama, 16 resep aktif) | 12.000 g/Dus |
| SAOS TOMAT KOMPAN (pengganti) | 16.500 g/Dus |

Order #38 "Original Sapi Jumbo", resep **30 gram**:

```
outlet yang POUCH-nya masih ada       -> ledger  -30      BENAR
Beji & Depok Sukmajaya (POUCH habis)  -> ledger  -41,25   SALAH   (16.500/12.000 = 1,375)
```

Sejak 2 Agu 2026: **2.185 baris**, total **88.004 g** dipotong dari KOMPAN,
di antaranya **24.001 g fiktif** (sekitar Rp 273.000 @ 11,3744/g). Tanda
tangan 1,375x (30 -> 41,25, 50 -> 68,75, 60 -> 82,5) membuktikan baris-baris
itu memang limpahan, bukan potongan resep langsung — KOMPAN nol resep aktif.

Pasangan SAOS CABE dorman (utama nol stok, nol resep) — tidak terdampak.

### Implikasi untuk FOIL

FOIL 5M (24.000 cm/Dus) ke FOIL 7,6M (36.480 cm/Dus) berasio 1,52. Tanpa
perbaikan, tiap limpahan akan memotong **52% terlalu banyak**.

### Perbaikan yang diperlukan

`process_waterfall_deduction` mengalikan sisa dengan
`faktor_penuh(utama) / faktor_penuh(pengganti)` saat berpindah bahan, dengan
`faktor_penuh` = `faktor_tampilan` bila `faktor_tengah` terisi, selain itu
`faktor_konversi` — **definisi yang sama persis** dengan divisor di
`trg_process_bom_stok` (migration `20300108000005`).

Perbaikan ini berdiri sendiri: bernilai walaupun FOIL tidak jadi dipecah.

> Koreksi terhadap pernyataan saya sebelumnya: mekanisme waterfall **tidak**
> "terbukti benar di produksi untuk SAOS". Ia berjalan, dan ia salah.

---

## 4. Rancangan

### 4.1 Prinsip: id lama tinggal bersama saldo yang sudah ada

Bahan `FOIL` yang ada **menjadi varian 5M**, bukan 7,6M. Alasannya bukan
selera melainkan letak data: id itu memegang saldo 21 outlet, dan outlet
**hanya memegang roll Altindo 5 m**. Membiarkannya menjadi 5M berarti:

- **nol perpindahan saldo di outlet**
- **nol perubahan resep** — 16 resep otomatis menunjuk 5M
- **nol perubahan riwayat ledger**

Varian 7,6 m menjadi bahan **baru**, dan hanya Gudang Pusat yang perlu diisi.

### 4.2 Dua bahan

| | `FOIL 5M` (id lama) | `FOIL 7,6M` (baru) |
|---|---|---|
| `satuan` / `tengah` / `kecil` | Dus / Roll / cm | Dus / Roll / cm |
| `faktor_tengah` | 48 (lihat §7) | 48 |
| `faktor_konversi` | **500** (dari 760) | **760** |
| `faktor_tampilan` | **24.000** (dari 36.480) | **36.480** |
| `satuan_po` / `faktor_po` | roll / **500** | roll / 760 |
| `satuan_distribusi` | roll | roll |
| Vendor di katalog | PT Altindo Mulia | Ekadharma International |
| Resep | **utama** (16 resep, tanpa diubah) | — |
| Substitusi | — | pengganti `urutan 1` |

Penamaan memakai **spesifikasi, bukan vendor** — vendor ketiga bisa memasok
5 m, dan mengikat nama ke vendor akan mengulang kesalahan `FOIL (48)`.

### 4.3 Substitusi

```
bahan_baku_substitusi: utama = FOIL 5M, pengganti = FOIL 7,6M, urutan = 1
```

Outlet memotong 5M sampai habis, lalu otomatis melimpah ke 7,6M. Resep tidak
disentuh sama sekali. Inilah yang menghilangkan kegagalan `FOIL (48)` dulu:
saat itu resep menunjuk satu varian sementara distribusi mengirim varian lain,
tanpa jembatan apa pun — 17 outlet jadi minus.

Bergantung mutlak pada perbaikan §3.

### 4.4 Harga master

Urutan wajib: **faktor dulu, baru harga** (`sync_harga_beli_display` menghitung
dari `faktor_tampilan`).

| | `harga_beli` (per Dus) | `kemasan_qty` | per cm |
|---|---|---|---|
| FOIL 5M | 421.977,6 *(tidak berubah)* | **24.000** (dari 36.480) | **17,5824** |
| FOIL 7,6M | **554.592** (11.554 x 48) | **36.480** | **15,2026** |

### 4.5 Nilai persediaan — apa yang benar-benar bergerak

**Outlet: nol rupiah.** Jumlah roll tidak berubah dan harga per roll tidak
berubah; cm hanyalah satuan antara.
771.674 x 11,5674 = 771.674 x (500/760) x 17,5824. Identik.

> Koreksi terhadap angka saya sebelumnya: klaim "outlet sekitar Rp 4 juta
> terlalu tinggi" **salah** — itu menghitung penyusutan cm tanpa ikut
> mengoreksi harga per cm. Yang berubah di outlet hanyalah **kebenaran angka
> cm** (771.674 menjadi 507.680), bukan nilainya.

**Gudang Pusat: tergantung hasil hitung fisik.** Hari ini seluruh 1.096 roll
dinilai dengan harga per-roll Altindo. Tiap roll yang ternyata Ekadharma
bernilai Rp 2.762,8 lebih tinggi (11.554 − 8.791,2):

```
delta nilai = N_ekadharma x Rp 2.762,8    ->   Rp 0 ... Rp 3.028.000
```

Inilah satu-satunya pertanyaan rupiah yang tersisa, dan hitung fisik
menjawabnya langsung.

---

## 5. Perpindahan data

| # | Aksi | Bergantung pada |
|---|---|---|
| 1 | Perbaiki `process_waterfall_deduction` (§3) | — |
| 2 | Koreksi 24.001 g SAOS TOMAT KOMPAN di Beji & Depok Sukmajaya lewat ledger `adjustment` | 1 |
| 3 | Bereskan 26 SJ berjalan (§6) | — |
| 4 | **Hitung fisik Gudang Pusat**, pisah roll 7,6 m dan 5 m | — |
| 5 | Buat bahan `FOIL 7,6M` + harga + baris katalog Ekadharma | 4 |
| 6 | Ubah `FOIL` menjadi `FOIL 5M`: faktor, lalu harga; katalog Altindo mengikuti | 4 |
| 7 | Pindahkan porsi Ekadharma dari saldo Gudang Pusat ke `FOIL 7,6M` lewat sepasang ledger `adjustment` | 4, 5, 6 |
| 8 | Pasang baris `bahan_baku_substitusi` | 5, 6 |

Saldo outlet **tidak disentuh** di langkah mana pun: angka cm-nya berubah arti
begitu `faktor_konversi` menjadi 500, dan itu memang koreksinya.

Semua penulisan stok lewat `ledger_stok` — jangan pernah `UPDATE stok_balance`
langsung (SOP 2026-07-08).

---

## 6. Dokumen berjalan — kelas kesalahan yang sama seperti insiden 8 Sep

`surat_jalan_item.qty_dikirim` tersimpan dalam **satuan besar** dan baru
dikalikan `faktor_tampilan` saat verifikasi. Mengubah `faktor_tampilan` FOIL
dari 36.480 ke 24.000 mengubah arti 26 baris yang sudah tersimpan.

- **21 baris Jul–Agu** (1–4 Roll, basi): **batalkan**. Sudah direkomendasikan
  di CLAUDE.md 8 Sep dan belum dikerjakan.
- **5 baris Sep** (Cileungsi 2, Cirendeu 1, Cibinong 1, draft Sentul 1, draft
  Paledang 1): gudang perlu menyebutkan varian mana yang benar-benar dikirim.
  Bila Altindo (kemungkinan besar — outlet hanya memegang Altindo), biarkan
  pada `FOIL 5M` dan verifikasi normal; nilainya otomatis benar.

Tidak ada PO terbuka, jadi sisi pembelian bersih.

---

## 7. Pertanyaan terbuka

1. **Berapa roll dalam 1 Dus Altindo?** Spec ini mengasumsikan 48, sama dengan
   Ekadharma, karena tingkat Dus dibuat 8 Sep dari dus Ekadharma. Belum
   terverifikasi. **Dijawab saat hitung fisik** — persis hal yang terlihat saat
   mengangkat dusnya. Bila bukan 48, hanya `faktor_tengah` dan `faktor_tampilan`
   FOIL 5M yang menyesuaikan; sisa rancangan tidak berubah.
2. **Berapa roll Ekadharma vs Altindo di Gudang Pusat?** Hanya hitung fisik yang
   tahu. Data tidak menyimpannya — 832.960 cm adalah satu angka campur.

---

## 8. Yang sengaja TIDAK dikerjakan

- **Metode basis harga tidak berubah** — tetap harga penerimaan terakhir. Tidak
  ada FIFO, tidak ada rata-rata tertimbang (keputusan owner 8 Sep).
- **Periode Juli–Agustus tidak direkonstruksi.**
- **`FOIL (48)` yang nonaktif dibiarkan** — riwayat audit.
- **16 resep tidak disentuh.**
- **Saldo 21 outlet tidak dihitung ulang.**

---

## 9. Risiko

| Risiko | Penanganan |
|---|---|
| Waterfall salah konversi (§3) | Bloker; diperbaiki lebih dulu, dengan tes yang mengunci rasio |
| SJ berjalan berpindah arti | §6, daftar id eksplisit, idempoten |
| Distribusi memilih varian salah | Konsekuensi yang diterima owner; layar distribusi menampilkan dua baris yang jelas berbeda nama |
| Opname bertambah satu baris di tiap outlet | Diterima owner. Memperburuk keluhan "43 item per outlet" — usul perampingan daftar tetap terbuka |
| Isi Dus Altindo ternyata bukan 48 | §7 — hanya menggeser dua kolom |
| Hitung fisik tertunda | Langkah 5–8 menunggu; langkah 1–3 tetap jalan dan berdiri sendiri |

---

## 10. Rollback

Langkah 5–8 dapat dibalik: nonaktifkan `FOIL 7,6M`, kembalikan
`faktor_konversi`/`faktor_tampilan`/`kemasan_qty` FOIL, hapus baris substitusi,
dan balik pasangan ledger `adjustment` langkah 7. Riwayat ledger tidak pernah
dihapus.

Langkah 1–2 tidak perlu di-rollback: keduanya memperbaiki kesalahan yang sudah
terbukti.
