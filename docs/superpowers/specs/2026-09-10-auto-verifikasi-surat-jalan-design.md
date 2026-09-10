# Auto-Verifikasi Surat Jalan — Design

**Tanggal:** 2026-09-10
**Status:** Spec — seluruh keputusan owner sudah masuk. Rencana kerja:
`docs/superpowers/plans/2026-09-10-auto-verifikasi-surat-jalan.md`
**Yang memutuskan:** owner

---

## 1. Masalah

Separuh kiriman dari Gudang Pusat ke outlet tidak pernah diverifikasi crew.

| Periode | SJ dibuat | Diverifikasi | Menggantung |
|---|---:|---:|---:|
| Agustus 2026 | 418 | 209 (50%) | **209** |
| 1–9 September 2026 | 93 | 52 (56%) | **39** |

Sebabnya kata owner: lupa atau malas. Bukan masalah teknis.

Angka di atas diukur 10 September pukul 17:00 WIB. Tunggakannya **bertambah
tiap hari** — sore itu juga sudah masuk 10 SJ baru. Lihat §7 butir 3.

Akibatnya rantai stok putus sebelah:

```
SJ ditandai "dikirim"  ->  stok Gudang Pusat BERKURANG
SJ tak diverifikasi    ->  stok outlet TIDAK BERTAMBAH
outlet tetap jualan    ->  stoknya turun terus
opname harian          ->  angkanya dipaksa ikut hitungan fisik
```

Nilai yang menggantung di September saja: **Rp 105.461.894**, dari 219 baris
pengurangan stok gudang, di 17 outlet.

### Kenapa stok outlet tidak minus

Kalau separuh kiriman tak pernah masuk sistem tapi barangnya terus dipakai,
stok outlet mestinya minus di mana-mana. Nyatanya cuma **31 baris yang minus**,
dan **20 di antaranya milik BNR** yang datanya memang sudah rusak sejak sebelum
September. Sisanya cuma 11 baris.

Yang menahan angkanya cuma satu: **opname**. Jadi selama ini opname yang
menambal barang yang tak pernah tercatat masuk. Karena itu opname berhenti jadi
alat pemeriksa. Owner sudah merasakannya: *"track barangnya berantakan sehingga
angka opname pun berantakan."*

**Yang hilang bukan uangnya, tapi jejaknya.** Barang yang kurang larut di dalam
opname, dan tidak ada yang bisa ditanya.

---

## 2. Keputusan owner (10 September 2026)

> "solusinya auto verifikasi, jadi ketika [dikirim] dan sudah lewat hari maka
> barang tersebut di auto distribusi barang diterima apa adanya sesuai di kirim
> digudang, dan jika ada kurang atau lebih itu tanggung jawab outlet"

Surat jalan yang lewat tenggat ditutup sendiri oleh sistem, dianggap diterima
sejumlah yang dikirim. Selisihnya jadi tanggung jawab outlet.

Yang membuat ini berguna bukan penutupan otomatisnya, tapi **selisihnya jadi
punya alamat** — bisa ditunjuk outlet mana.

---

## 3. Fakta dari database (10 September 2026)

### 3.1 Berapa lama tenggatnya

Diukur dari `surat_jalan_item.verified_at` — saat outlet benar-benar
memverifikasi. 216 SJ sejak 1 Agustus:

| Kapan diverifikasi | Jumlah |
|---|---:|
| **Hari yang sama dengan SJ dibuat** | **212 (98%)** |
| Besoknya (H+1) | 4 (2%) |
| Lebih dari itu | **0** |

Kesimpulannya: **kalau tidak diverifikasi hari itu juga, praktis tidak akan
pernah.** Jadi tenggatnya cukup "lewat hari", tidak perlu berjam-jam.

⚠️ **Koreksi terhadap draf pertama spec ini.** Draf awal memakai 72 jam,
diambil dari jeda `created_at` → `updated_at` pada SJ berstatus `selesai`.
Itu salah ukur: yang terukur adalah jarak sampai **Pusat menutup dokumen**
(tahap 2, §3.4), bukan sampai outlet memverifikasi (tahap 1). Angka 72 jam
dibuang.

Owner juga memberi fakta lapangan yang cocok dengan data ini: **barang tiba di
outlet paling lambat pukul 21:00.** Jadi begitu hari berganti, outlet sudah
punya kesempatan penuh.

Empat SJ yang diverifikasi H+1, semuanya antara 14:00–16:40 WIB:

| SJ dibuat | Diverifikasi | Jeda | Outlet |
|---|---|---:|---|
| 07/08 **07:48** | 08/08 15:20 | 31,5 jam | m:Cileungsi |
| 12/08 **21:10** | 13/08 16:40 | 19,5 jam | Cirendeu |
| 13/08 **20:56** | 14/08 15:18 | 18,4 jam | m:Cicurug |
| 18/08 **13:38** | 19/08 14:01 | 24,4 jam | m:Sentul |

Dua di antaranya (21:10 dan 20:56) dibuat setelah jam kedatangan — barangnya
memang baru jalan malam itu. Lihat §4.1.1.

### 3.2 Fungsi verifikasi yang sudah ada — dipakai lagi, jangan bikin baru

`finalize_surat_jalan_and_ledger(id)` — sudah ada sejak `20300105000017`:

- Menolak SJ yang sudah pernah diverifikasi.
- Hanya memproses barang yang kolom "qty terima"-nya sudah diisi. Jadi
  auto-verifikasi tinggal isi qty terima = qty kirim, lalu panggil fungsi ini.
- Sudah benar menangani satuan gram vs satuan besar (`to_ledger_scale`).
- Sudah bisa mencatat barang yang ditolak/rusak.

⚠️ **Jangan bikin fungsi pencatat stok baru.** Tanggal 9 September kita habis
sehari menutup bug persis di situ — salah konversi satuan di fungsi pencatat
stok. Bikin jalur baru sama saja mengundangnya lagi.

### 3.3 Cara menjadwalkannya

**`pg_cron` dan `pg_net` sudah terpasang di database ini.** Jadi tugasnya bisa
jalan di dalam database sendiri.

Ini penting karena `apps/distribusi` — tempat surat jalan berada — **tidak punya
cron sama sekali** (cuma ada route `health`). Satu-satunya `CRON_SECRET` yang
terpasang di Coolify milik `admin-dashboard`. Menumpang cron app lain berarti
menaruh urusan distribusi di app yang salah, dan menambah satu titik gagal: app
itu mati, verifikasi ikut berhenti.

### 3.4 Ternyata alurnya dua tahap

Status yang dipakai sejak 1 Juli: `selesai` 322 · `dikirim` 219 · `dibatalkan` 51.

Fungsi verifikasi berhenti di `diterima_lengkap`. Yang mengubahnya jadi
`selesai` ternyata **tombol lain**, bukan otomatis: `handleVerifyPusat` di
`apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx:242`, tombol
"Verifikasi & Selesaikan Dokumen" (tahap 4 dari 4). Tombol itu cuma mengubah
status, tidak menyentuh stok.

| Tahap | Siapa | Status jadi | Stok berubah? |
|---|---|---|---|
| 1. Terima barang | **Outlet** | `diterima_lengkap` | **Ya, stok outlet bertambah** |
| 2. Validasi & tutup | **Pusat** | `selesai` | Tidak |

**219 SJ yang menggantung macet di tahap 1.** Outlet tak pernah memverifikasi,
jadi stoknya tak pernah bertambah. Tahap 2 milik Pusat dan bukan sumber masalah.

Catatan: ada dua jalur verifikasi di kode. `VerifikasiForm.tsx` memakai
`finalize_surat_jalan_and_ledger`, `useSuratJalan.ts:148` memakai
`finalize_surat_jalan` yang lama. Kita pakai yang `_and_ledger`.

---

## 4. Rancangan

### 4.1 Alurnya

```
pg_cron (sekali sehari, 02:00 WIB)
  -> cari SJ yang status "dikirim" dan HARI KIRIMNYA sudah lewat
     dan tanggalnya setelah <TANGGAL MULAI>       <- lihat 4.3
     dan lolos semua penjaga                      <- lihat 4.4
  -> isi qty terima = qty kirim
  -> tandai auto_verified_at
  -> panggil finalize_surat_jalan_and_ledger
```

**Keputusan owner 2026-09-10: ditutup dini hari.** Jalan sekali sehari pukul
02:00 WIB. Kiriman hari Senin ditutup Selasa dini hari.

Tanggal kirim diambil dari **`updated_at`**, bukan tanggal dibuat — itu saat SJ
benar-benar ditandai `dikirim`, alias saat barang keluar gudang.

⚠️ `pg_cron` menjadwal dalam **UTC**. 02:00 WIB = **19:00 UTC hari sebelumnya**.
Salah pasang di sini menggeser tenggat 7 jam tanpa gejala apa pun — wajib
diverifikasi setelah dipasang.

Konsekuensi yang diterima: keempat verifikasi H+1 di §3.1 akan didahului sistem
(mereka verifikasi jam 14:00–16:40, sistem menutup jam 02:00). Itu 2% dari yang
pernah terjadi.

### 4.1.1 Kiriman malam dihitung sebagai hari berikutnya

Owner menyebut barang tiba paling lambat **21:00**. Kiriman yang ditandai
dikirim **pukul 21:00 ke atas** berarti barangnya baru jalan malam itu — outlet
belum punya kesempatan sama sekali. Kalau memakai tanggal kalender polos,
kiriman pukul 21:10 Senin akan ditutup Selasa 02:00, cuma **5 jam kemudian**,
seluruhnya saat outlet tutup.

Karena itu **hari kirim dihitung berakhir pukul 21:00**, bukan tengah malam:
SJ yang ditandai dikirim pukul 21:00 ke atas dianggap milik hari berikutnya,
sehingga baru ditutup pada dini hari berikutnya lagi.

Ini bukan pelonggaran tenggat, melainkan penerapan premis owner sendiri: kiriman
malam belum melewati harinya. Terdampak **21 dari 524 SJ (4%)** sejak 1 Agustus
— termasuk 2 dari 4 kasus H+1 di §3.1, yang dengan aturan ini tidak lagi
terhitung terlambat.

Kalau owner lebih suka aturan tanggal kalender polos, batas 21:00 ini tinggal
dihapus; sisa rancangan tidak berubah.

### 4.2 Berhenti di tahap 1, jangan sampai tahap 2

Auto-verifikasi hanya menggantikan **tahap 1** (sisi outlet). Tahap 2 jangan
disentuh.

Alasannya bukan cuma soal batas kerja. SJ yang ditutup otomatis akan **masuk
antrean validasi Pusat**, di layar yang sudah ada. Jadi orang yang memeriksa —
yang tadinya saya bilang harus dicari — **ternyata sudah ada tempatnya.**

Kalau auto-verifikasi ikut menutup sampai `selesai`, hasilnya malah terbalik:
kiriman yang tidak diperiksa siapa pun justru jadi satu-satunya yang lolos tanpa
dilihat manusia sama sekali.

Efeknya antrean Pusat akan makin panjang. Itu memang tujuannya — beban
pemeriksaan pindah dari 17 outlet ke satu meja Pusat yang memang pegang gudang.

### 4.3 Hanya untuk kiriman baru — ini wajib

Tugas ini **TIDAK BOLEH** menyentuh 248 SJ tunggakan (209 Agustus + 39
September).

Barangnya sudah lama terserap opname. Kalau sekarang dimasukkan lagi ke sistem,
stok outlet akan bertambah ratusan juta di atas angka yang sudah benar. Stok
hantu.

Dipasang sebagai tanggal tetap di dalam fungsinya, bukan sekadar diingat-ingat.

**Tanggal mulai: 14 September 2026** (keputusan owner 2026-09-10). SJ yang
dikirim sebelum tanggal itu tidak akan pernah tersentuh auto-verifikasi.

### 4.4 Penjaga

| Penjaga | Kenapa |
|---|---|
| Lewati kalau ada bahan yang sudah nonaktif | 6 SJ menggantung berisi `FOIL (48)` yang sudah dimatikan 3 Sep. Kalau diproses, stok bahan mati jadi hidup lagi. |
| Lewati outlet tes | Aturan owner 8 Sep: outlet tes tidak ikut hitungan apa pun. |
| Lewati kalau qty terima sudah ada isinya | Berarti crew sedang memverifikasi. Jangan didahului. |
| Lewati kalau stoknya sudah pernah dicatat masuk | Pengaman kedua supaya tidak dobel. |
| Maksimal 50 SJ sekali jalan | Supaya jalan pertama tidak memproses ribuan baris sekaligus. |

### 4.5 Penanda `auto_verified_at`

Tambah kolom `surat_jalan.auto_verified_at`, diisi sebelum fungsi verifikasi
dipanggil.

Perlu, karena catatan yang ditulis fungsi verifikasi sama persis untuk semua
kiriman. Tanpa penanda ini, kiriman yang ditutup otomatis tidak bisa dibedakan
dari yang diverifikasi crew — dan kalau nanti opname outlet itu kurang, tidak
bisa ditelusuri dari mana. Penanda di tabel induk cukup; fungsi verifikasinya
tidak perlu diubah sedikit pun.

### 4.6 Aman kalau jalan dua kali

Tiga lapis: fungsi verifikasi menolak SJ yang sudah diverifikasi · penjaga stok
sudah tercatat (4.4) · kolom `auto_verified_at` sudah terisi.

---

## 5. Yang sengaja tidak dikerjakan

- **248 SJ tunggakan tidak disentuh** (§4.3).
- **Fungsi verifikasi tidak diubah** (§3.2).
- **Cara hitung harga tidak berubah** — tetap harga pembelian terakhir.
- **Verifikasi manual tetap jalan.** Auto-verifikasi cuma jaring pengaman. Crew
  tetap bisa memverifikasi sendiri dalam 72 jam, termasuk menolak barang rusak
  seperti yang sudah dilakukan Sawangan, Kalisari, Cimanggu, dan Dramaga.
- **Tidak ada perubahan tampilan.**

---

## 6. Batasnya

**Auto-verifikasi merapikan CATATAN, bukan BARANG.**

Kalau crew tetap tidak mengecek fisik, hasilnya catatan rapi di atas kenyataan
yang tidak diperiksa. Yang berubah cuma satu: selisihnya sekarang ada alamatnya.

Jadi ini baru berhasil kalau **antrean validasi Pusat benar-benar dikerjakan**.
Kalau tidak, ini cuma penutupan dokumen otomatis tanpa akibat — dan crew makin
punya alasan untuk tidak memverifikasi.

Satu hal yang perlu diterima sadar: **barang yang hilang di jalan akan jadi
tanggungan outlet.** Jendela 72 jam itu jalan keluarnya — selama tenggat itu
outlet masih bisa memverifikasi sambil menolak barang yang kurang.

---

## 7. Yang perlu dijawab sebelum rencana kerja ditulis

1. ~~Apa yang mengubah status jadi `selesai`?~~ **Sudah terjawab** — tombol
   Pusat, bukan otomatis. Lihat §3.4 dan §4.2.
2. ~~Siapa yang mengerjakan antrean validasi Pusat?~~ **Sudah diputuskan** —
   role **`kitchen`**, tetap di level role, bukan orang tertentu (owner,
   2026-09-10, ditegaskan saat ditanya ulang).
   **Antreannya sudah punya tempat:** dashboard `apps/distribusi`, kartu &
   tab **"Perlu Verif"**, yang menyaring persis `diterima_lengkap` +
   `diterima_sebagian`. Jadi siapa pun yang login sebagai `kitchen` melihatnya
   di halaman depan — tidak perlu dicari, dan tidak perlu layar baru.
   ⚠️ Sisa yang belum ditentukan: **seberapa sering** meja itu dikosongkan.
   Role `kitchen` punya 5 akun aktif — Admin Kitchen 2, Muhammad Abyansah
   Mandala, Rusly Irawan, plus **Kitchen Test** dan **Admin SS Online** yang
   tampaknya bukan orang untuk tugas ini. Menugaskan ke role dan bukan ke orang
   berisiko jatuh di antara kursi — persis penyakit yang sedang diobati.
3. ~~Tunggakan September mau diapakan?~~ **Sudah diputuskan** — **ditutup
   sebagai dokumen, tanpa mengubah stok** (owner, 2026-09-10). Status jadi
   `selesai`, penanda `ditutup_administratif_at`, **nol baris stok ditulis**.
   Daftarnya disusun ulang pada hari go-live karena bertambah tiap hari.
   ⚠️ **Jumlahnya bertambah tiap hari.** Per 10 September pukul 17:00: 39 SJ
   sudah lewat hari (Rp 105.461.894) + 10 SJ hari itu (Rp 29.122.410) yang belum
   terlambat. Dengan laju ~5 SJ/hari tak terverifikasi, perkiraan **60–65 SJ**
   saat fitur berlaku 14 September.
   ⚠️ **6 SJ memuat `FOIL (48)`** (bahan nonaktif), semuanya 2–3 September —
   apa pun keputusannya, keenam SJ itu tidak boleh menulis stok.
   ⚠️ **209 SJ Agustus TIDAK termasuk pertanyaan ini** — Agustus dilewati atas
   keputusan owner (2026-09-09, ditegaskan 2026-09-10). Jangan ditawarkan,
   jangan ikut diproses.
4. ~~Mulai tanggal berapa?~~ **Sudah diputuskan** — target **14 September 2026**
   (owner, 2026-09-10). SJ yang dikirim sebelum tanggal itu masuk kategori
   tunggakan (butir 3) dan tidak tersentuh auto-verifikasi.
5. ~~Cron tiap berapa lama?~~ **Sudah diputuskan** — sekali sehari, 02:00 WIB
   (owner, 2026-09-10). Lihat §4.1.
6. **Batas 21:00 untuk kiriman malam** (§4.1.1) — diambil dari premis owner
   sendiri, tapi belum dikonfirmasi eksplisit. Kalau tidak dipakai, tinggal
   dihapus.
7. **Di luar bahasan ini, tapi ketemu waktu menelusuri:** tombol
   `handleVerifyPusat` mengubah status langsung dari browser, tanpa lewat fungsi
   database dan tanpa cek role di kodenya. Polanya sama dengan lubang otorisasi
   yang sudah dicatat di CLAUDE.md (sesi 20 Juli). Perlu diperiksa terpisah.
   Rancangan ini tidak memperburuknya karena tidak menyentuh tahap 2.

---

## 8. Risiko

| Risiko | Cara menahannya |
|---|---|
| Tunggakan ikut terproses | Tanggal mulai dipasang di dalam fungsi (§4.3) |
| Bahan nonaktif jadi hidup lagi | Penjaga bahan nonaktif (§4.4) |
| Stok masuk dobel | Tiga lapis pengaman (§4.6) |
| Salah konversi satuan | Pakai fungsi lama apa adanya (§3.2) |
| Crew makin malas verifikasi | Diterima; ditahan lewat antrean Pusat (§4.2, §6) |
| Cron mati diam-diam | Tugasnya mencatat jumlah yang diproses — cara melihatnya dibahas di rencana kerja |
| Barang hilang di jalan jadi beban outlet | Konsekuensi yang diterima owner; jendela 72 jam jalan keluarnya |

---

## 9. Kalau mau dibatalkan

Matikan jadwalnya (`cron.unschedule`). SJ yang telanjur diproses bisa dicari
lewat `auto_verified_at`, dan catatan stoknya lewat `ref_shipment_id` — keduanya
bisa dibalik dengan penyesuaian stok kalau perlu. Kolom `auto_verified_at` aman
ditinggal.
