# Audit: Harga Bahan Baku Dua Vendor — Peta Dampak Menyeluruh

**Tanggal:** 2026-09-02
**Status:** Audit saja. Belum ada keputusan desain, belum ada kode.
**Pemicu:** Bahan tertentu (contoh: SAPI) dipasok dua vendor dengan harga berbeda. Yang menentukan barang mana dikirim ke outlet adalah ketersediaan stok di gudang, sementara sistem hanya menyimpan **satu** harga per bahan.

---

## 1. Ringkasan untuk yang buru-buru

Ada **satu** kolom harga di seluruh sistem: `bahan_baku_harga.harga_beli` (satu baris per bahan). Kolom itu **ditimpa setiap kali PO diverifikasi**, oleh harga vendor yang kebetulan datang terakhir — lihat `po_on_verified()`.

Tujuh jalur membaca kolom itu. Semuanya ikut goyang.

**Temuan yang paling mengubah gambaran:** jalur HPP berbasis surat jalan (`harga_snapshot`) — yang semula dikira jalur utama — ternyata **sudah mati**. Perbaikan yang menyentuh surat jalan saja tidak akan mengubah angka HPP sama sekali. Rinciannya di bagian 3.

---

## 2. Sumber masalahnya

```
PO vendor A diterima  →  bahan_baku_harga.harga_beli = 95.000
PO vendor B diterima  →  bahan_baku_harga.harga_beli = 102.000   (menimpa)
```

`po_on_verified()` (migration `20260820155500`, direvisi `20260828113000`) melakukan UPSERT tanpa syarat: siapa pun vendornya, harga terakhir menang. Tidak ada kolom vendor, dan tidak ada riwayat per vendor yang dibaca ulang untuk perhitungan (`bahan_baku_harga_history` mencatat perubahan, tapi tak ada konsumen).

Akibatnya harga sapi di sistem berayun **95.000 ↔ 102.000 (±7,4%)** mengikuti urutan kedatangan truk, bukan mengikuti barang yang benar-benar dipakai.

---

## 3. TEMUAN UTAMA — jalur HPP surat jalan sudah mati

`get_hpp_periode()` didefinisikan ulang **tiga kali** dengan nama yang sama:

| Migration | Isi | Berlaku? |
|---|---|---|
| `20260701120000_hpp_reporting` | HPP dari opname + `surat_jalan_item.harga_snapshot` | ❌ tertimpa |
| `20260708225000_hpp_teoritis_periode` | **HPP teoritis: resep (BOM) × harga master** | ✅ **berlaku** |
| `20260720100000_hpp_periode_by_channel` | varian per channel, rumus sama | ✅ berlaku |

Karena `CREATE OR REPLACE` memakai nama yang sama, versi kedua **membuang** versi pertama tanpa keluhan apa pun. Konsekuensinya:

- `surat_jalan_item.harga_snapshot` masih **diisi** trigger `fill_harga_snapshot` tiap surat jalan dibuat, tapi **tidak dibaca siapa pun** untuk HPP.
- View `hpp_nilai_stok_harian_spv` dan `hpp_barang_masuk_harian_spv` menjadi yatim — diverifikasi: nol pemakaian di seluruh repo (app maupun SQL).

**Artinya:** memperbaiki `harga_snapshot` di surat jalan — seakurat apa pun — tidak akan menggerakkan satu angka pun di laporan HPP. Titik perbaikan yang sebenarnya adalah **harga master yang dibaca BOM**.

---

## 4. Peta tujuh jalur pembaca harga

Semua contoh memakai angka yang sama: sapi vendor A 95.000/kg, vendor B 102.000/kg.

### Jalur 1 — HPP utama (BOM) 🔴 paling berdampak

`get_hpp_periode(from, to)` — `20260708225000`

```sql
total_qty * (ri.qty_per_porsi / faktor_konversi) * bh.harga_beli
```

Biaya bahan dihitung dari **resep × qty terjual × harga master**. Tidak menyentuh stok fisik maupun surat jalan sama sekali.

- **Dampak:** setiap menu bersapi ikut berayun ±7,4% tanpa resep berubah sedikit pun.
- **Dipakai:** dashboard laba owner, laporan profit, perbandingan food cost antar outlet.
- **Bahaya khusus:** karena murni teoritis, angkanya tampak rapi dan stabil di layar — tidak ada tanda apa pun bahwa ia bergeser karena urusan vendor.

### Jalur 2 — HPP per channel 🔴

`get_hpp_periode_by_channel(from, to)` — `20260720100000`

Rumus identik jalur 1, dipecah per `sales_source`. Dipakai laporan Rekap Bulanan. Dampak sama, dan **melipatgandakan ketidakkonsistenan**: bila jalur 1 diperbaiki tanpa jalur 2, dua laporan akan menunjukkan HPP berbeda untuk periode yang sama.

### Jalur 3 — Anggaran belanja outlet 🟠

`estimate_permintaan_value`, `approve_permintaan_svc`, `request_budget_topup_svc`, `approve_budget_topup_svc` — `20260819100001`, `20260820110001`

```sql
v_harga := (SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = ...)
→ permintaan_bahan_item.harga_snapshot
```

Saat kitchen menyetujui permintaan, nilai belanja outlet dibekukan memakai harga master **saat itu**.

- **Dampak:** outlet bisa terpotong anggaran memakai harga vendor B padahal dikirimi daging vendor A. Ini menyentuh uang yang dirasakan outlet langsung, bukan sekadar laporan.
- **Catatan:** `permintaan_bahan_item.harga_snapshot` adalah kolom **berbeda** dari `surat_jalan_item.harga_snapshot` (jalur 6). Nama sama, tabel beda, umur beda.

### Jalur 4 — Valuasi waste 🟠

`get_waste_periode`, `get_waste_breakdown` — `20260714100000`

```sql
w.qty * bh.harga_beli
```

Waste dinilai memakai harga **saat laporan dibaca**, bukan harga saat barang diterima — ini keputusan sadar yang tertulis di komentar migrationnya.

- **Dampak:** nilai kerugian waste berubah surut ke belakang. Waste bulan Juli bisa menampilkan angka berbeda bila dibuka ulang bulan September, hanya karena vendor terakhir berganti. Angka historis jadi tidak bisa dipegang.

### Jalur 5 — Prefill form PO 🟡

`apps/finance/src/app/pembelian/new/page.tsx:47` (kembar di `admin-dashboard`)

```ts
harga_pesan: bahan?.harga_beli ? String(bahan.harga_beli) : ''
```

Buat PO ke vendor A, form mengisi harga vendor B. Petugas harus ingat sendiri untuk mengoreksi.

- **Dampak:** kesalahan masuk di hulu, lalu mengalir ke semua jalur di atas. Ini juga satu-satunya jalur yang **memperkuat dirinya sendiri**: harga salah yang tak dikoreksi akan tersimpan sebagai harga master berikutnya.

### Jalur 6 — Snapshot surat jalan ⚪ mati

`surat_jalan_item.harga_snapshot` + trigger `fill_harga_snapshot` — `20260701120000`

Masih ditulis setiap surat jalan, tidak dibaca siapa pun (lihat bagian 3).

- **Dampak hari ini:** nol.
- **Nilainya:** kolom ini justru **tempat paling wajar** untuk menaruh harga per-batch nanti, karena ia sudah terisi otomatis dan sudah per-pengiriman. Bangkai yang berguna, bukan sekadar sampah.

### Jalur 7 — Laporan keluar-masuk gudang ⚪ perlu dicek lapangan

`inbound_outbound.harga_satuan` — `20300108000007`, backfill `…0009`, `…0013`

Kolomnya bermaksud jadi snapshot ("snapshot of harga beli at the time of transaction"), tapi di migration yang ada ia hanya **diisi backfill** dari harga master saat itu. Belum ditemukan trigger yang mengisinya untuk transaksi baru — perlu diverifikasi ke DB live sebelum disimpulkan.

---

## 5. Rekapitulasi

| # | Jalur | Menyentuh | Tingkat | Beres oleh perbaikan surat jalan saja? |
|---|---|---|---|---|
| 1 | HPP utama (BOM) | laba & food cost semua outlet | 🔴 tinggi | ❌ tidak |
| 2 | HPP per channel | Rekap Bulanan | 🔴 tinggi | ❌ tidak |
| 3 | Anggaran outlet | uang outlet | 🟠 sedang | ❌ tidak |
| 4 | Valuasi waste | angka kerugian historis | 🟠 sedang | ❌ tidak |
| 5 | Prefill form PO | mutu data di hulu | 🟡 rendah | ❌ tidak |
| 6 | Snapshot surat jalan | — (mati) | ⚪ nol | — |
| 7 | Laporan inbound/outbound | belum pasti | ⚪ cek dulu | ❌ tidak |

**Enam dari tujuh jalur bermuara ke satu tempat yang sama: `bahan_baku_harga.harga_beli`.** Itu kabar baik — pengungkitnya tunggal. Perbaikan di titik itu merambat ke enam jalur sekaligus tanpa menyentuh `process_waterfall_deduction` maupun jalur order POS.

---

## 6. Yang belum diverifikasi (jangan dianggap fakta)

1. **Jalur 7** — apakah ada trigger pengisi `harga_satuan` untuk transaksi baru. Perlu `pg_get_functiondef` ke DB live.
2. **Berapa bahan yang benar-benar punya ≥2 vendor.** Angka ini menentukan besar masalahnya; bisa dijawab dengan menghitung tumpang tindih `supplier.bahan_baku_ids` di DB live. Semua analisis di atas berlaku umum, tapi skalanya belum terukur.
3. **Seberapa sering harga master benar-benar berayun.** `bahan_baku_harga_history` sudah merekamnya sejak `20260820155500` — bisa diukur, belum diukur.
4. **Apakah `get_hpp_periode` di DB live benar-benar versi BOM.** Riwayat migration proyek ini terbukti bisa menyesatkan (ranjau timestamp 2030, fungsi ditimpa diam-diam). Wajib dicek `pg_get_functiondef` sebelum keputusan apa pun diambil.

---

## 7. Keputusan yang menunggu

Belum diambil, dan tidak boleh diambil dari dokumen ini sendirian:

- Basis harga mana yang jadi kebenaran: FIFO per batch, rata-rata tertimbang, atau harga vendor utama. (FIFO dan rata-rata tertimbang sama-sama menjaga nilai total; harga-vendor-utama dan harga-terakhir tidak.)
- Apakah keenam jalur dipindah ke basis baru **serentak** (konsisten tapi besar) atau **bertahap** (cepat tapi dua laporan bisa berbeda angka untuk sementara).
- Apa yang terjadi pada angka historis: dihitung ulang, atau dibiarkan apa adanya dengan garis batas tanggal.

---

# BAGIAN II — Hasil Verifikasi ke DB Live (2026-09-02)

Dijalankan read-only via `supabase db query --linked`. Bagian ini **menggantikan**
dugaan di bagian 6; yang tertulis di bawah adalah fakta terukur, bukan pembacaan migration.

## V1. Jalur HPP surat jalan memang mati — TERKONFIRMASI

```
proname                    | pakai_bom | pakai_snapshot | pakai_harga_master
get_hpp_periode            | true      | FALSE          | true
get_hpp_periode_by_channel | true      | FALSE          | true
```

Fungsi yang hidup di produksi memang versi BOM. `harga_snapshot` tidak dibaca.
Dugaan di bagian 3 benar.

## V2. Skala masalah dua-vendor JAUH LEBIH KECIL dari dugaan

24 vendor aktif, 55 bahan aktif, 40 bahan terdaftar ke vendor.

**Terdaftar** di 2 vendor: 4 bahan — tapi tiga di antaranya data rusak, bukan
kasus dua-vendor sungguhan:

| Bahan | Vendor terdaftar | Penilaian |
|---|---|---|
| AYAM | Dunia Plastik Depok, PT Meyer Proteindo | ❌ salah daftar — vendor plastik dipasangkan ke ayam |
| BAWANG | Family Suplayer, `sadsad` | ❌ data sampah |
| KENTANG | Agro Boga Utama, PT Agro Boga Utama | ❌ perusahaan sama, beda penulisan nama |
| FOIL | Ekadharma International, PT Altindo Mulia | ✅ **nyata** |

**Kenyataan dari riwayat PO diterima** (31 PO, 15 Agu–1 Sep 2026, 16 vendor):
hanya **satu** bahan benar-benar dibeli dari dua vendor berbeda dengan harga berbeda.

```
FOIL   2.000 Roll @ 8.791,2   PT Altindo Mulia        15 Agu
FOIL   1.000 Roll @ 11.554    Ekadharma International 31 Agu   → selisih 31,4%
```

Satuan sama (Roll, faktor 760) — selisihnya asli, bukan salah satuan.
FOIL dipakai di **16 resep aktif**, jadi benar masuk ke HPP.

**SAPI — contoh yang kita pakai sepanjang diskusi — ternyata hanya punya SATU
vendor**, dua kali beli, harga identik 100.000. Belum jadi masalah hari ini.

## V3. Riwayat harga terlalu muda untuk mengukur frekuensi

`bahan_baku_harga_history` baru berisi **5 baris sejak 28 Agustus** (5 hari).
Tak cukup untuk menyimpulkan seberapa sering harga berayun. Tapi isinya
mengungkap sesuatu yang lebih besar:

| Bahan | Dari | Ke | Tanggal | Lipatan |
|---|---|---|---|---|
| KENTANG | 25.000 | 250.000 | 28 Agu | **10×** |
| BAWANG | 32.500 | 650.000 | 31 Agu | **20×** |
| AYAM | 51.000 | 35.000 | 28 Agu | 0,7× |
| AYAM | 35.000 | 53.500 | 1 Sep | 1,5× |
| MINYAK | 368.000 | 376.000 | 31 Agu | 1,02× |

Lonjakan 10× dan 20× hampir pasti **salah satuan** (per-kg vs per-karung), bukan
kenaikan harga. AYAM berayun 51.000 → 35.000 → 53.500 dalam empat hari.

---

# TEMUAN BARU YANG LEBIH BESAR DARI MASALAH DUA-VENDOR

`get_hpp_periode` **tidak punya dimensi waktu pada harga sama sekali**:

```
pakai_riwayat_harga : false
saring_tanggal_harga: false
```

Ia melakukan `LEFT JOIN bahan_baku_harga` polos — **tanpa penyaring tanggal**.
Artinya HPP periode mana pun dihitung memakai **harga hari ini**.

Akibatnya, dan ini berlaku untuk **seluruh 55 bahan**, bukan cuma yang dua vendor:

- HPP bulan Juli yang dibuka hari ini memakai harga 2 September.
- Ketika BAWANG dikoreksi 32.500 → 650.000 pada 31 Agustus, **semua** angka HPP
  historis yang mengandung bawang ikut berubah 20× — surut ke belakang, diam-diam.
- Laporan laba yang sudah dicetak dan disetujui bulan lalu **tidak akan cocok**
  bila dibuka ulang hari ini. Tak ada jejak mengapa.

Masalah dua-vendor adalah **satu kasus khusus** dari cacat ini: harga master
tertimpa, lalu seluruh sejarah dinilai ulang. Memperbaiki dua-vendor tanpa
memperbaiki kebutaan waktu ini hanya menutup satu dari sekian banyak pintu.

## Penilaian ulang prioritas

| Masalah | Cakupan terukur | Tingkat |
|---|---|---|
| HPP buta waktu (harga hari ini untuk periode lampau) | 55 bahan, semua outlet, semua periode | 🔴 **tertinggi** |
| Master data harga rusak (lonjakan 10×/20×, kemungkinan salah satuan) | ≥2 bahan terkonfirmasi | 🔴 tinggi |
| Master data vendor rusak (ayam→vendor plastik, `sadsad`, vendor duplikat) | 3 dari 4 pemetaan multi-vendor | 🟠 sedang |
| Dua vendor satu bahan | **1 bahan (FOIL)**, selisih 31,4% | 🟠 sedang, tapi akan tumbuh |

Catatan penting: riwayat PO baru berumur 2,5 minggu (mulai 15 Agustus). Kecilnya
angka dua-vendor hari ini mencerminkan **mudanya disiplin PO**, bukan bukti bahwa
masalahnya tak akan membesar. Kekhawatiran awal soal sapi tetap sah sebagai
antisipasi — ia hanya belum terjadi.

---

# BAGIAN III — Pasca Revisi Basis Harga (2026-09-03)

User merevisi basis harga 11 bahan pada 3 September. Pemeriksaan lanjutan
menemukan cacat yang **lebih besar dan lebih mendesak** dari seluruh isi Bagian I & II.

## Rumus HPP memakai faktor yang salah

`get_hpp_periode` menghitung:

```sql
qty_per_porsi / faktor_konversi * harga_beli
```

Tapi `harga_beli` adalah harga per **satuan beli** (Dus, Kompan, Bal), sementara
`faktor_konversi` di banyak bahan **bukan** jumlah unit-resep dalam satuan beli itu —
yang benar ada di `faktor_tampilan`.

Bukti dari resep nyata:

| Bahan | Satuan | Harga | f_konv | f_tampil | Per porsi | Biaya (f_konv) | Biaya (f_tampil) |
|---|---|---|---|---|---|---|---|
| KENTANG | Dus | 250.000 | 1.000 | 10.000 | 160 g | **Rp 40.000** | Rp 4.000 |
| MINYAK | kompan | 376.000 | 1.000 | 16.000 | 50 ml | **Rp 18.800** | Rp 1.175 |

Satu porsi kentang goreng tidak mungkin berbiaya bahan Rp 40.000.

## Dampak di tingkat menu — HPP melampaui harga jual

| Menu | Harga jual | HPP sekarang | HPP dgn f_tampil |
|---|---|---|---|
| Original Mix Jumbo | 47.000 | **104.026** | 25.866 |
| Suka Fried Chicken | 30.000 | **59.219** | 15.842 |
| Original Ayam Jumbo | 34.000 | **87.403** | 21.223 |

Seluruh laporan laba yang memakai `get_hpp_periode` (dashboard owner, halaman
profit, rekap bulanan per channel) saat ini menampilkan **kerugian semu** pada
menu-menu ini. Ini bukan risiko masa depan — sudah berjalan hari ini.

## JANGAN diseragamkan massal

24 bahan punya `faktor_konversi <> faktor_tampilan`; **11 di antaranya dipakai di
resep aktif**. Tapi tidak semua salah — uji kewajaran harga per kg:

| Bahan | /kg pakai f_konv | /kg pakai f_tampil | Faktor yang benar |
|---|---|---|---|
| MINYAK | 376.000 | 23.500 | f_tampil (kompan 16 L) |
| KENTANG | 250.000 | 25.000 | f_tampil (dus 10 kg) |
| SAOS CABE | 44.000 | 14.800 | f_tampil |
| SAOS TOMAT POUCH | 140.000 | 11.670 | f_tampil |
| MAYONAISE | 248.000 | 20.670 | f_tampil |
| ES BATU | 30.000 | 1.500 | f_tampil |
| SAOS SAMYANG | 280.000 | 56.000 | f_tampil |
| KEJU | 28.905/unit | 1.204/unit | f_tampil |
| PLASTIK MERAH | 4.500/pcs | 900/pcs | f_tampil (perlu konfirmasi isi ikat) |
| PAPER WRAP | 1.850/lbr | 185/lbr | f_tampil (perlu konfirmasi isi ikat) |
| **SAPI** | **103.000** | 51.500 | **f_konv** — daging sapi 103rb/kg wajar |

**SAPI adalah pengecualian dan dipakai di 9 resep.** Penyeragaman massal akan
merusaknya. Ini mengulang jebakan yang sudah tercatat sebelumnya di proyek ini:
"jangan samakan massal, bagi dengan faktor yang sama dengan pengalinya."

## Konsekuensi untuk rencana dua-vendor

Selama cacat faktor ini belum beres, seluruh rantai batch/FIFO yang dirancang di
Bagian I **tak ada gunanya** — ia akan menyalurkan harga yang akurat ke rumus yang
mengalikannya dengan faktor salah. Urutan kerja yang benar:

1. Tetapkan faktor yang benar per bahan (butuh keputusan manusia per item — data
   fisik: berapa isi 1 Dus, 1 Kompan, 1 Ikat, 1 Bal).
2. Perbaiki rumus HPP agar memakai faktor yang tepat.
3. Baru sambungkan harga per outlet/batch (rencana Bagian I).

## Belum diverifikasi

- Apakah `faktor_konversi` punya peran sah lain (skala ledger gram/besar) sehingga
  yang harus diubah adalah **rumus HPP**, bukan nilai kolomnya. Ini penting:
  mengubah `faktor_konversi` bisa merusak penulis ledger yang sudah scale-aware.
- Isi fisik sebenarnya untuk PLASTIK MERAH (ikat = 20 atau 100 pcs?) dan
  PAPER WRAP (ikat = 500 atau 5.000 lembar?).
