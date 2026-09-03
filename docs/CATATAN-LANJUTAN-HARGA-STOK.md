# Catatan Lanjutan — Harga & Stok Bahan Baku

**Dibuat:** 3 September 2026
**Dipakai untuk:** melanjutkan pekerjaan sepotong-sepotong tanpa harus membaca
ulang seluruh pembahasan. Tiap butir berdiri sendiri.

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

### 8. Laporan nilai persediaan belum ada

Persediaan bernilai **Rp409 juta** (gudang Rp161,8 jt + 24 outlet Rp247,1 jt),
dan **tidak ada satu halaman pun** yang menghitungnya. Diverifikasi: nol kode
aplikasi yang menyentuhnya.

Ini aset besar yang tidak terlihat di laporan mana pun. Perlu dibuat, terlepas
dari metode harga mana yang dipilih.

### 9. Surat jalan menggantung

130 surat jalan berstatus 'dikirim' berumur >2 minggu, menahan barang senilai
**Rp1,2 juta** — sudah keluar dari catatan gudang, belum masuk catatan outlet.
Ditambah 37 draft berumur >2 minggu.

Bukan urusan foil, dan nilainya kecil. Tapi artinya ada kebiasaan surat jalan
tidak ditutup, dan itu membuat angka stok gudang & outlet terus meleset tipis.

---

## STATUS BRANCH

Branch `claude/new-session-0f1553`, sudah di-merge dengan `main` (tanpa konflik).

Berisi tiga dokumen (audit teknis, skenario bahasa awam, catatan ini) dan satu
naskah SQL penggabungan FOIL. Migration HPP yang sempat dibuat sudah **dibuang**
karena `main` ternyata punya versinya.

Perubahan yang sudah **berjalan di produksi** (dijalankan lewat SQL Editor,
bukan lewat migration): penggabungan FOIL dan penyesuaian harganya. Ini artinya
perubahan itu **tidak ada jejaknya di migration** — kalau database dibangun
ulang dari nol, penggabungan FOIL tidak ikut. Naskahnya disimpan di
`docs/draft-sql/` sebagai catatan apa yang dijalankan.

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
