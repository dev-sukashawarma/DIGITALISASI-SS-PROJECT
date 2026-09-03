# Catatan Lanjutan — Harga & Stok Bahan Baku

**Dibuat:** 3 September 2026
**Dipakai untuk:** melanjutkan pekerjaan sepotong-sepotong tanpa harus membaca
ulang seluruh pembahasan. Tiap butir berdiri sendiri.

---

## SUDAH SELESAI

- **Rumus HPP tercatat ke migration** — `get_hpp_periode` &
  `get_hpp_periode_by_channel` di produksi sudah memakai `kemasan_qty`, tapi
  perbaikannya tak ada di file mana pun. Sekarang tercatat di
  `supabase/migrations/20260903100000_hpp_pakai_kemasan_qty.sql`.
- **FOIL digabung** — FOIL (48) dinonaktifkan, saldo dipindah lewat 42 baris
  ledger berpasangan (jumlah bersih nol), harga disesuaikan ke Rp8.791,2 dengan
  jejak riwayat. Hasil: outlet minus 17 → 1, nilai persediaan foil Rp14,3 juta.

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
**Jangan** menunggu 26 surat jalan lama tuntas — 130 dari 199 surat jalan
'dikirim' di sistem ini sudah >2 minggu, jadi itu takkan terjadi.

### 4. Opname FOIL di Cirendeu

Saldo −4.622 cm (±6 Roll). Ini selisih fisik nyata, sudah ada sejak sebelum
penggabungan. Perlu hitung fisik, bukan penyesuaian di sistem.

### 5. Beri tahu tim

- **Purchasing:** pesan foil ke bahan **"FOIL"**, bukan "FOIL (48)".
- **Distribusi:** kirim **"FOIL"** ke outlet.

FOIL (48) sudah nonaktif, jadi tak akan muncul di daftar pilihan — tapi kalau
belum diberi tahu, mereka akan bingung mencari barangnya.

### 6. Dua nota lama salah tingkat kemasan

| Bahan | Di nota PO | Di master | Beda |
|---|---|---|---|
| PLASTIK MERAH | Rp18.000 per Pack | Rp90.000 per Ikat | 5× |
| POLYBAG | Rp600.000 per Bal | Rp25.000 per Pack | 24× |

Harganya sama, cuma dinyatakan per satuan berbeda. **Bahayanya:** PLASTIK MERAH
dipakai 18 resep — kalau nota berikutnya diinput dengan cara yang sama, harga
master jatuh 90.000 → 18.000 dan biaya 18 menu ikut anjlok 80% tanpa peringatan.

POLYBAG punya pertanyaan terbuka sendiri: catatan owner menulis "1 bal = 25 pak"
sementara data menyimpan 1 Ikat = 5 Pack. Faktor konversinya yang perlu
diputuskan lebih dulu, bukan harganya.

**Catatan baik:** form PO di sistem tidak bermasalah — 10 dari 10 baris
PO/KITCHEN basisnya benar. Penyimpangan hanya di dokumen SPB lama.

### 7. Waste masih pakai faktor yang salah

`get_waste_periode` dan `get_waste_breakdown` masih membagi dengan
`faktor_konversi`, bukan `kemasan_qty` — pola yang sama dengan bug HPP yang sudah
diperbaiki. Artinya nilai waste kemungkinan salah dengan faktor yang sama
(sampai 24× untuk bahan tertentu).

Belum diperiksa dampaknya. Perbaikannya sejenis: ganti pembagi jadi
`COALESCE(NULLIF(kemasan_qty,0), faktor_tampilan, faktor_konversi, 1)`.

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

Branch `claude/new-session-0f1553`, **10 commit, belum di-push**.

Berisi: migration rumus HPP, tiga dokumen (audit teknis, skenario bahasa awam,
catatan ini), dan naskah SQL penggabungan FOIL.

Perubahan yang sudah **berjalan di produksi** (dijalankan lewat SQL Editor,
bukan lewat migration): penggabungan FOIL dan penyesuaian harganya.

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
