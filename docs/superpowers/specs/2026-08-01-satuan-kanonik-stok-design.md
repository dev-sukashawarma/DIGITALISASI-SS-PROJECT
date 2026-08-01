# Satuan Kanonik Stok — Design

**Tanggal:** 2026-08-01
**Status:** Disetujui (menunggu rencana implementasi)
**Cakupan:** `apps/stok`, `apps/distribusi`, trigger BOM di database — satuan kanonik, rincian per kemasan, dan penyatuan empat mekanisme kemasan yang sekarang berjalan sendiri-sendiri
**Terkait:** `SS COGS SET/unit-reconciliation.md`, `SS COGS SET/SATUAN-DISTRIBUSI.md`, memori `stok-balance-ledger-invariant`

---

## 1. Masalah

`stok_balance.saldo` dan `ledger_stok.qty` tidak punya satuan yang dideklarasikan. Lima jalur kode menulis ke kolom yang sama dengan **tiga satuan berbeda**, dan tidak ada satu pun yang menandai satuannya.

| Jalur | Berkas | Menulis dalam |
|---|---|---|
| Opname | `apps/stok/src/components/stok/OpnameForm.tsx:29-30` | **Satuan kecil** (gram) |
| Adjustment / waste / transfer | `apps/stok/src/components/stok/ManualEntryForm.tsx:76-81` | **Satuan besar** (dus) |
| Penjualan POS (BOM) | trigger `trg_process_bom_stok` → `qty_per_porsi / faktor_konversi` | **Satuan tengah** (kompan) |
| Surat jalan | `finalize_surat_jalan_and_ledger` menyalin `qty_terima` apa adanya; sumbernya `surat_jalan_item` yang diisi distribusi dalam satuan besar | **Satuan besar** (dus) |
| Tampilan | `apps/stok/src/lib/format/compositeUnit.ts` → `formatTriUnitSaldo` | membaca sebagai **satuan besar** |

### 1.1 Bukti di produksi

Sebaran `|qty|` di `ledger_stok` untuk SAOS CABE + SAOS TOMAT:

| tipe | baris | rata-rata | maks |
|---|---|---|---|
| `pemakaian` (BOM) | 13.988 | 0,00 | 0,06 |
| `adjustment` | 53 | 2,10 | 50 |
| `terima_kiriman` | 24 | 0,68 | 2,00 |
| `opname_selisih` | 247 | **464,94** | **25.317** |

Selisih 3–4 orde besaran di kolom yang sama.

Contoh satu bahan (KENTANG) di empat outlet:

| Outlet | Saldo tersimpan | Tafsiran yang masuk akal |
|---|---|---|
| GUDANG PUSAT (HQ) | 31 | 31 Dus |
| SUKA SHAWARMA CIRENDEU | 13,0275 | 13 Kg |
| SUKA SHAWARMA EMPANG | 6.600 | 6.600 Gram |
| MITRA PEKAYON | 20.000 | 20.000 Gram |

Akibat yang terlihat pengguna: saldo tampil sebagai `6.500 Dus`, stok minus padahal fisik ada, dan selisih opname ribuan.

### 1.2 Bug turunan yang sudah aktif di distribusi

`getDistribusiFactor` (`compositeUnit.ts`) mencocokkan **nama** `satuan_distribusi` dengan `satuan_tengah`/`satuan_kecil`. SAOS TOMAT punya `satuan_tengah = "Kg"` yang isinya **16.500 gram** (jeriken, bukan kilogram).

| Bahan | Gudang ketik | Pembagi terpilih | Tersimpan | Arti sebenarnya |
|---|---|---|---|---|
| KENTANG | 10 kg | 10 (`Kg` = kilogram) | 1,0 Dus | 10 kg ✅ |
| SAOS CABE | 11 kg | 16,5 (tambalan `gram/1000`) | 0,667 Dus | 11 kg ✅ |
| **SAOS TOMAT** | 10 kg | **12** (`"Kg"` = jeriken) | 0,833 Dus | **165 kg** ❌ |

Salah 16,5× tanpa error. Fungsi ini juga mengembalikan `1` diam-diam bila tidak ada nama yang cocok.

Rumus yang sama disalin di empat tempat: `compositeUnit.ts` (induk), `apps/distribusi/src/components/distribusi/SuratJalanForm.tsx`, `VerifikasiForm.tsx`, `SuratJalanDetail.tsx`.

---

## 2. Keputusan

**Satuan kanonik penyimpanan = satuan terkecil bahan** (`satuan_kecil`; bila tidak ada, `satuan`).

- DB menyimpan **satu angka** tanpa pecahan: gram / lembar / pcs.
- Semua konversi terjadi di lapisan UI, tidak pernah di lapisan simpan.
- Tampilan tetap berjenjang; jumlah tingkat mengikuti data bahan (3 tingkat: 15 bahan, 2 tingkat: 35 bahan, 1 tingkat: 3 bahan).
- Cara input pengguna **tidak berubah**: pelaku opname (leader / regional_manager) tetap mengisi kotak Dus/Kompan/Gram, gudang tetap mengetik satu angka dalam `satuan_distribusi`.

Alternatif yang ditolak:

| Alternatif | Alasan ditolak |
|---|---|
| Simpan dalam satuan besar (Dus) | 30 gram/porsi = 0,0018 Dus; pembulatan menghancurkan akurasi COGS |
| Perbaiki tampilan saja, DB tetap pecahan | Tidak menutup akar masalah — kode berikutnya tetap bisa salah tafsir |
| Kolom baru + tulis-ganda | Menghidupkan dua sumber kebenaran sekaligus; itu penyakit yang sedang diobati |

### 2.1 Invarian master yang dipakai

Terverifikasi di DB, **0 pengecualian** dari 50 bahan aktif ber-`satuan_kecil`:

```
faktor_tampilan = faktor_tengah × faktor_konversi   (15 bahan bertingkat 3)
faktor_tampilan = faktor_konversi                   (35 bahan bertingkat 2)
```

Artinya `faktor_tampilan` = jumlah satuan kecil per satu satuan besar. Ini satu-satunya faktor yang dipakai setelah perubahan; `faktor_konversi` berhenti dipakai sebagai pembagi di jalur simpan.

### 2.2 Kemasan bukan satuan

Akar kekacauan kedua: **kemasan diperlakukan sebagai satuan.**

- *Satuan* menjawab "berapa banyak" → satu skala tunggal (gram).
- *Kemasan* menjawab "datang dalam wadah apa" → kompan 5,5 kg, pouch 1 kg, dus.

Karena tercampur, saat ini ada **empat mekanisme** untuk satu masalah yang sama:

| # | Mekanisme | Status per 2026-08-01 |
|---|---|---|
| 1 | `satuan_tengah` / `satuan_kecil` + faktor | jalan, dipakai semua app |
| 2 | `bahan_baku_sku` (`nama_kemasan`, `qty_isi`, `harga_beli`, `is_default`) | **sudah ada**, baru 2 baris, `qty_isi` tidak konsisten dengan faktor master (SAOS CABE 144.000 vs 16.500; SAOS TOMAT 12.000 vs 198.000) |
| 3 | `bahan_baku_substitusi` + `process_waterfall_deduction` | masuk DB live 2026-08-01, **tidak menyala** (arah mapping terbalik terhadap bahan yang dipakai resep) |
| 4 | `bahan_baku_packaging_variant` + `stok_balance_packaging` | branch `feat/dual-packaging-variant` (22 Juli), belum merge, **migration-nya gagal** — RLS menyebut `outlet_staff.auth_user_id` yang tidak ada |

Dua di antaranya saling bertentangan: #3 memodelkan pouch sebagai **baris `bahan_baku` terpisah**, #4 sebagai **varian dari bahan yang sama**. Tidak bisa dua-duanya.

**Keputusan:** pouch/kompan = **kemasan**, bukan bahan dan bukan satuan.

| Lapis | Isi | Rumah |
|---|---|---|
| Berapa banyak | satu angka gram — satu-satunya saldo | `stok_balance.saldo` |
| Wadah apa + harganya | kompan 5.500 g, pouch 1.000 g, dus | **`bahan_baku_sku`** (sudah ada; `qty_isi` diperbaiki agar konsisten dengan `faktor_tampilan`) |
| Hasil hitung fisik per kemasan | 2 kompan · 3 pouch · 500 g lepas | tabel kecil baru, terikat ke `opname` |

Konsekuensinya:

- **Tidak ada `stok_balance_packaging`.** Kasir tidak mencatat kemasan mana yang dituang, jadi rincian per kemasan tidak bisa *dihitung* — hanya bisa *diamati* saat opname. Saldo kedua yang berkurang otomatis pasti melenceng dari total dan tidak ada yang merekonsiliasi sampai opname berikutnya (di BNR bisa 9 hari).
- **`bahan_baku_packaging_variant` tidak dibuat** — duplikat `bahan_baku_sku`, dan `bahan_baku_sku` bahkan punya `harga_beli` yang tidak dimiliki tabel usulan itu. Kerja Task 1–3 di branch diserap dengan mengganti sumber tabel; Task 4–7 (opname per kemasan, terima kiriman pilih kemasan, monitoring, CRUD admin) tetap dikerjakan.
- **`bahan_baku_substitusi` + waterfall dipensiunkan** untuk kasus saos. Waterfall hanya perlu ada *karena* pouch adalah bahan terpisah; begitu jadi satu kolam gram, tidak ada lagi "utama habis, limpahkan ke pengganti" — berikut bug konversi 5,5×-nya.
- Baris `bahan_baku` `SAOS CABE POUCH` / `SAOS TOMAT POUCH` **dilebur** ke induknya. Saldo POUCH yang ada (KALISARI 3.003, PEKAYON 1.000, dst) tidak dikonversi aritmetika — ikut ditetapkan ulang oleh opname pertama setelah cutover (§6).

---

## 3. Non-goals

Tidak dikerjakan di sini:

- Mengubah resep / `qty_per_porsi`.
- Mengubah harga, COGS, atau laporan laba.
- Memperbaiki `bahan_baku_substitusi` (arah mapping, konversi satuan, RLS, grant RPC). Tabelnya **dipensiunkan** oleh §2.2, bukan diperbaiki. Selama belum dipensiunkan resmi, lubang otorisasi `process_waterfall_deduction` (EXECUTE untuk `anon`/`authenticated`, tanpa `SET search_path`) tetap perlu ditutup terpisah — lihat §9.
- Ambang selisih berbasis nilai rupiah (butuh `harga_beli` per kemasan yang belum lengkap) — lihat §4.6.
- Mengganti nama `satuan_tengah` SAOS TOMAT dari `"Kg"` → `"Jeriken"` (disarankan, tapi keputusan data terpisah; tidak mengubah hitungan).
- Menormalkan satuan `stok_balance` historis lewat perhitungan aritmetika (lihat §6).

---

## 4. Perubahan per komponen

### 4.1 Database

| Objek | Sekarang | Jadinya |
|---|---|---|
| `stok_balance.saldo` | campur | satuan terkecil |
| `ledger_stok.qty` | campur | satuan terkecil |
| `surat_jalan_item.qty_dikirim` / `qty_terima` | satuan besar | satuan terkecil |
| `permintaan_item.qty_diminta` | satuan besar | satuan terkecil |
| `trg_process_bom_stok` | `qty_per_porsi / faktor_konversi` | `qty_per_porsi` apa adanya |
| `process_waterfall_deduction` | menerima qty hasil pembagian | menerima qty dalam satuan terkecil — **tanda tangan fungsi tidak berubah, hanya arti angkanya**. Perbaikan substitusi itu sendiri di luar cakupan (lihat §3) |
| `finalize_surat_jalan_and_ledger` | menyalin qty apa adanya | **tidak diubah** — sumbernya sudah satuan terkecil |
| `global_settings` | — | baris baru `unit_mode_outlets` (daftar `outlet_id` dipisah koma) |
| `bahan_baku_sku.qty_isi` | 2 baris, tidak konsisten (144.000 / 12.000) | diperbaiki + dilengkapi jadi master kemasan (kompan / pouch / dus) |
| hasil hitung kemasan saat opname | — | tabel kecil baru, terikat `opname` (bukan saldo — lihat §4.5) |
| `bahan_baku` `SAOS CABE POUCH` / `SAOS TOMAT POUCH` | baris bahan terpisah | dilebur ke induk; jadi kemasan di `bahan_baku_sku` |
| `bahan_baku` batas minimum selisih | — | kolom baru untuk ambang absolut (§4.6) |

`ledger_stamp_saldo` tidak diubah (sudah atomik + guard no-negative).

### 4.2 `apps/stok`

| Berkas | Perubahan |
|---|---|
| `components/stok/OpnameForm.tsx` | **Tidak berubah** — sudah menulis satuan terkecil |
| `components/stok/ManualEntryForm.tsx` | Hapus pembagian `faktor_tampilan`/`faktor_tengah`; kirim satuan terkecil |
| `components/permintaan/PermintaanForm.tsx` | `convertToBaseUnit` → konversi ke satuan terkecil |
| `components/permintaan/ApprovalModal.tsx`, `ApprovalList.tsx`, `PermintaanList.tsx` | Ikut helper baru |
| `lib/format/compositeUnit.ts` | `formatCompositeSaldo` / `formatTriUnitSaldo` menerima angka dalam satuan terkecil; `getDistribusiFactor` diganti (lihat §4.4) |

### 4.3 `apps/distribusi`

| Berkas | Perubahan |
|---|---|
| `components/distribusi/SuratJalanForm.tsx` | Buang salinan `getDistribusiFactor`; pakai helper bersama |
| `components/distribusi/VerifikasiForm.tsx` | Buang rumus inline; pakai helper bersama |
| `components/distribusi/SuratJalanDetail.tsx` | Buang rumus inline; pakai helper bersama |
| `hooks/useBahanBaku.ts` | Pastikan kolom faktor ikut ter-select (sudah) |

### 4.4 Helper bersama

`getDistribusiFactor` yang mencocokkan **nama satuan** dihapus. Penggantinya menjawab satu pertanyaan: *berapa satuan terkecil dalam satu satuan distribusi?*

- Sumber angka: kolom faktor, bukan pencocokan string.
- Bila satuan distribusi tidak bisa dipetakan ke tingkat mana pun, fungsi **gagal keras** (lempar/`null` yang ditangani UI), bukan diam-diam mengembalikan `1`.
- Tambalan khusus `'kg' + 'gram' → faktor_tampilan/1000` dihapus.

Karena tiga app menyalin logika ini, helper ditaruh di satu tempat yang bisa diimpor dua app. Mengikuti pola `print_layout` (Session 2026-07-16), duplikasi terkendali dengan berkas identik lebih disukai daripada membuat paket `@suka/*` baru — keputusan final soal ini diambil di rencana implementasi.

### 4.5 Rincian per kemasan

Rincian **tidak disimpan sebagai saldo**. Ia dihitung saat tampil: hasil hitung fisik terakhir + kiriman sejak itu; sisanya muncul terbuka sebagai baris "belum terbagi".

```
SAOS CABE                                    EMPANG
TOTAL                                      9,5 kg

Hasil hitung terakhir · 31 Jul 21.47
   Kompan utuh   (5,5 kg)     2 buah      11,0 kg
   Pouch utuh    (1 kg)       3 buah       3,0 kg
   Sisa terbuka                            0,0 kg
Pergerakan sejak itu
   + Terima kiriman   1 Kompan            + 5,5 kg
   − Terpakai penjualan (belum terbagi)   −10,0 kg
   TOTAL SEKARANG                           9,5 kg
```

Baris "belum terbagi" adalah inti rancangan ini: ketidaktahuan sistem ditampilkan, bukan disembunyikan di balik tebakan. Alternatif "tebak otomatis, habiskan kemasan terbuka dulu" ditolak untuk sekarang — bisa ditambahkan belakangan **di atas** rancangan ini tanpa membongkar apa pun, karena datanya sudah tersimpan.

Form opname berubah dari tiga kotak satuan (Dus/Kompan/Gram — "Dus" adalah satuan pembelian, bukan wadah yang ada di kulkas) menjadi hitungan wadah nyata:

```
Kompan utuh (5,5 kg)  [ 2 ]   Pouch utuh (1 kg)  [ 3 ]   Sisa terbuka (gram)  [ 500 ]
                                              Total = 14.500 gram
```

Form terima kiriman: pilih kemasan dari `bahan_baku_sku` + jumlah, bukan mengetik angka lalu berharap sistem menebak satuannya.

### 4.6 Selisih opname

Rumus **tidak berubah**: `selisih = qty_fisik − qty_system`. Yang berubah hanya bahwa kedua sisi kini bersatuan sama. Sebagian besar dari 247 baris `opname_selisih` yang rata-ratanya 465 diduga bukan kehilangan stok, melainkan gram dikurangi dus.

Penandaan (`isSelisihFlagged`) memakai **persentase**, bukan angka mutlak, jadi selamat dari perubahan satuan tanpa disentuh:

- barang timbang (gram/ml/kg/liter) → toleransi 5%
- barang hitung (pcs, pack) → toleransi 0%

**Satu tambahan yang disepakati: batas minimum absolut.**

```
flag bila |selisih| > maksimum( persen × saldo , batas_minimum )
```

Alasannya persentase murni rusak di dua ujung: 5% dari stok gudang (±310 kg kentang) = 15,5 kg boleh raib tanpa pertanyaan; 5% dari outlet kecil (±1,3 kg saos) = 64 gram, yang gampang terlampaui hanya oleh sisa menempel di wadah → flag menyala tiap malam → orang berhenti membacanya. Batas minimum per bahan (mis. 100 gram) menyelesaikan ujung bawah; aturan 5% tetap berlaku di ujung atas.

Pembulatan: simpan gram sebagai bilangan bulat, bulatkan di titik input (saat form menjumlahkan kotak), bukan di titik simpan — kalau tidak, resep berangka pecahan menghasilkan selisih 0,0001 yang akan mem-flag opname yang sebenarnya pas (toleransi barang hitung = 0%).

Ditunda, bukan ditolak:

| Gagasan | Kenapa ditunda |
|---|---|
| Ambang berbasis **rupiah** (mis. flag bila nilai selisih > Rp 50.000) | Lebih masuk akal daripada persen (5% saos ≠ 5% daging) dan langsung dimengerti owner, tapi `bahan_baku_sku.harga_beli` baru terisi 2 baris dan angkanya belum terverifikasi |
| Toleransi **asimetris** (minus lebih ketat daripada plus) | Fisik kurang = uang hilang; fisik lebih = salah catat. Berguna, tapi bukan penghalang |
| Kolom eksplisit `jenis_ukur` (`timbang`/`hitung`) | `MEASURABLE_UNITS` menggolongkan dari **nama satuan** — pola yang sama dengan penyebab bug 16,5×. Untuk data sekarang hasilnya kebetulan benar semua, tapi sudah butuh pengecualian tertulis untuk GAS (`pcs` + `gram`) |

---

## 5. Saklar & urutan rollout

### 5.1 Saklar

Satu baris `global_settings` bernama `unit_mode_outlets` berisi daftar `outlet_id` yang sudah pindah, dipisah koma. Kosong = tidak ada yang pindah.

Alasan saklar ada di database, bukan env var: **trigger BOM berubah seketika saat SQL dijalankan, sedangkan app Next.js baru berubah setelah di-redeploy manual di cPanel satu per satu.** Tanpa saklar bersama, ada jeda beberapa menit di mana trigger sudah menulis satuan terkecil sementara app masih menulis satuan besar — setiap order yang masuk pada jeda itu merusak saldo. Saklar di DB membuat keduanya pindah pada detik yang sama.

Pola ini menyalin `bom_automation_allowed_outlets` yang sudah terbukti dipakai di repo ini.

### 5.2 Rollout berpasangan

Satu surat jalan menghasilkan **dua baris ledger di dua outlet**: `transfer_keluar` di GUDANG PUSAT (349 baris historis) dan `terima_kiriman` di outlet tujuan. Kalau kedua outlet beda mode, satu angka ditafsir dua cara — Gudang Pusat bisa terpotong 11.000 Dus dari kiriman 11 kg.

Karena itu **GUDANG PUSAT ikut gelombang pertama**, tidak boleh ditinggal.

| Gelombang | Outlet | Alasan |
|---|---|---|
| 1 | GUDANG PUSAT (HQ) + SUKA SHAWARMA EMPANG | EMPANG opname 11 dari 14 hari → salah langsung ketahuan besok pagi |
| 2 | PAJAJARAN, PALEDANG, CIMANGGU, DRAMAGA | frekuensi opname tertinggi berikutnya |
| 3+ | sisanya, bertahap | — |

Jendela eksekusi: **07.00–11.00**. Outlet buka 13.00–22.00, opname 21.30–01.00, jadi 01.00–13.00 benar-benar sepi.

### 5.3 Konsekuensi yang harus diterima

Selama masa peralihan, **laporan stok gabungan lintas-outlet mencampur dua satuan dan tidak boleh dipakai untuk mengambil keputusan.** Angka per outlet tetap akurat. Ini harga dari rollout bertahap, dan disepakati sadar.

---

## 6. Data lama

Saldo yang ada sekarang **tidak dikonversi secara aritmetika**, karena satuan tiap baris tidak tercatat di mana pun — `0,234` bisa Dus, bisa Kompan. Mengalikan angka yang tidak diketahui satuannya hanya memindahkan kesalahan.

Sumber kebenaran satu-satunya adalah hitungan fisik. Maka:

1. Outlet masuk daftar `unit_mode_outlets` pagi hari.
2. Opname malam itu menulis ulang saldo dalam satuan terkecil — inilah momen data outlet tersebut menjadi benar.
3. Antara langkah 1 dan 2 (± setengah hari), saldo outlet tersebut masih angka lama; **jangan dipakai untuk keputusan pemesanan.**

Pola ini sama dengan reset baseline 2026-07-08: koreksi lewat ledger, bukan `UPDATE stok_balance` langsung. Invarian `stok_balance` ↔ `ledger_stok` tetap dijaga.

---

## 7. Verifikasi

### 7.1 Unit test (pure function)

- Konversi satuan distribusi → satuan terkecil untuk KENTANG (tengah = kilogram asli), SAOS CABE (tengah = Kompan), SAOS TOMAT (tengah bernama "Kg" tapi 16.500 gram). Ketiganya harus menghasilkan 1.000 gram per 1 kg yang diketik gudang.
- Satuan distribusi tak dikenal → gagal keras, bukan faktor `1`.
- `formatTriUnitSaldo` untuk bahan 3 / 2 / 1 tingkat, termasuk nilai negatif dan nilai tepat di batas tingkat.
- Penjumlahan input opname 3 kotak → satuan terkecil.

### 7.2 Kriteria keberhasilan di lapangan

Diukur pada gelombang 1, malam setelah cutover:

| Ukuran | Target |
|---|---|
| Selisih opname EMPANG | mendekati 0 (bukan ratusan/ribuan seperti sekarang) |
| Saldo minus padahal fisik ada | tidak ada |
| Tampilan saldo | tidak ada lagi angka seperti "6.500 Dus" |
| Surat jalan HQ → EMPANG | `transfer_keluar` dan `terima_kiriman` besarnya sama persis |

Kalau selisih opname masih besar, **balikkan saklar** dan periksa ulang sebelum melanjutkan ke gelombang 2.

---

## 8. Rollback

Keluarkan `outlet_id` dari `unit_mode_outlets`. Trigger dan app langsung kembali ke perilaku lama pada detik yang sama. Baris ledger yang sudah ditulis dalam satuan terkecil dikoreksi lewat opname berikutnya (bukan `UPDATE` langsung).

Rollback tidak menghapus data — hanya menghentikan penulisan bersatuan baru.

---

## 9. Isu terbuka

1. **Nama `satuan_tengah` SAOS TOMAT = `"Kg"` padahal 16.500 gram.** Menyesatkan pembaca manusia. Disarankan diganti `"Jeriken"`; tidak mengubah hitungan. Butuh konfirmasi owner.
2. **Lokasi helper bersama** — berkas kembar di dua app (pola `print_layout`) vs paket `@suka/*` baru. Diputuskan di rencana implementasi.
3. **Bahan tanpa `satuan_kecil` (3 bahan)** — satuan terkecilnya = `satuan` itu sendiri; perlu dipastikan tidak ada kode yang mengasumsikan `satuan_kecil` selalu ada.
4. **Peran `spv` sudah tidak dipakai (0 pengguna); penggantinya `regional_manager` (2 aktif).** Lapisan aplikasi sudah mengenalnya (`apps/stok/src/lib/stok/approver.ts`, `packages/auth/src/access.ts`), tetapi **tidak ada satu migration pun yang menyebutnya** — `accessible_outlet_ids()` masih memakai daftar lama (`'spv'` termasuk) sehingga mengembalikan **kosong** untuk `regional_manager`. Peran baru lain yang belum terdaftar di fungsi itu: `purchasing` (1), `area_manager` (1). Ini gangguan akses yang aktif di produksi dan **harus diperbaiki sebagai pekerjaan terpisah sebelum atau bersamaan dengan rollout ini** — setiap policy/RLS baru dalam desain ini wajib memakai daftar peran yang sudah diperbarui, bukan menyalin daftar lama.
5. **Lubang otorisasi `process_waterfall_deduction`** (migration `20300103000010`, sudah di DB live): `SECURITY DEFINER` tanpa `SET search_path`, `EXECUTE` terbuka untuk `PUBLIC`/`anon`/`authenticated` → siapa pun pemegang anon key bisa menulis baris `pemakaian` untuk outlet mana pun, dan `pemakaian` justru dikecualikan dari guard no-negative. Tabel `bahan_baku_substitusi` juga tanpa RLS dengan `anon = arwd`. Fungsi ini dipensiunkan oleh §2.2, tapi **selama masih ada di DB lubangnya aktif** — tutup terpisah, jangan menunggu rollout ini.
6. **Nasib branch `feat/dual-packaging-variant`** — belum merge, migration gagal (`outlet_staff.auth_user_id` tidak ada). Perlu keputusan eksplisit: tutup branch dan serap Task 4–7 ke rancangan ini, atau rebase. Jangan dibiarkan menggantung, karena ia menyentuh berkas yang sama (`OpnameForm`, jalur terima kiriman).
7. **Rincian kemasan dipakai untuk apa** — belum dijawab tuntas. Kalau untuk mencocokkan hitungan fisik saat opname, rancangan §4.5 sudah cukup. Kalau untuk menghitung nilai rupiah stok, perlu tambahan `harga_beli` per kemasan yang lengkap (lihat §4.6 dan isu #2 di sini).
8. **Ranjau timestamp 2030** — migration baru wajib bernomor setelah `20300104000001`, dan sebelum menyentuh `trg_process_bom_stok` jalankan `grep -rn "trg_process_bom_stok" supabase/migrations/`.
