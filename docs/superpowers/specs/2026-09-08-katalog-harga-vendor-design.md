# Katalog Harga Vendor per Bahan Baku — Design

**Tanggal:** 8 September 2026
**Status:** Rancangan, menunggu review. **Belum ada kode ditulis.**
**Asal:** brainstorming dengan owner, 8 September 2026
**Terkait:** `docs/MASTER-SATUAN-PO-DAN-DISTRIBUSI.md` (v1.0, 8 Sep 2026),
`docs/SKENARIO-BAHAN-DUA-VENDOR-BAHASA-AWAM.md`,
`docs/superpowers/specs/2026-09-05-lock-harga-per-po-pertanggungjawaban-design.md`

---

## 1. Ringkasan

Satu tabel baru — **`bahan_baku_supplier`** — yang menjawab satu pertanyaan yang
hari ini tidak bisa dijawab sistem:

> Bahan X, dari vendor mana, satuannya apa, harganya berapa, kapan terakhir.

Katalog ini **lapisan referensi pembelian**. Ia tidak mengubah cara harga master
dihitung, tidak mengubah HPP, tidak mengubah nilai persediaan.

**Empat kegunaan** (dikonfirmasi owner, 8 Sep):

1. **Prefill PO** — pilih vendor, harga tiap item terisi harga vendor *itu*.
2. **Pembanding antar vendor** — bahan X di vendor A/B/C, disetarakan.
3. **Riwayat harga per vendor** — untuk melihat tren dan bahan negosiasi.
4. **Menyuplai harga master** — lewat jalur yang sudah ada (`verifikasi_terima_po`),
   dengan aturan lama yang **tidak diubah**.

### Yang sengaja TIDAK dikerjakan

| Tidak dikerjakan | Alasan |
|---|---|
| FIFO / rata-rata tertimbang (WAC) | Keputusan owner 8 Sep: persediaan murni kendali internal, metode harga terakhir dipertahankan. Selisih terukur 3 kali, sekitar 0,07% nilai persediaan. |
| Kantong harga per PO | Spec terpisah (5 Sep), sistem jauh lebih besar. Katalog ini tidak mendahului maupun menghalanginya. |
| Koreksi mundur data lama | Garis mulai; data sebelum katalog menyala tidak direkonstruksi. |
| Memisahkan bahan per vendor | Sudah terbukti merusak di sistem ini sendiri (FOIL vs FOIL (48), 17 outlet minus). Vendor hidup di dokumen pembelian, tidak naik jadi identitas barang. |
| Perubahan apa pun pada perhitungan HPP | Di luar lingkup. |

---

## 2. Keadaan hari ini (diverifikasi langsung ke DB produksi, 8 Sep 2026)

### 2.1 Yang sudah ada

| Objek | Isi | Kekurangannya |
|---|---|---|
| `supplier` | 25 baris, semua aktif | 1 pasang duplikat tersisa: **`Lettuce (Pak Aziz)` dua kali** |
| `supplier.bahan_baku_ids UUID[]` | 44 pasangan (vendor ke bahan) | daftar saja, **tanpa harga dan tanpa satuan** |
| `bahan_baku_harga` | 1 baris per bahan; `harga_beli` per satuan besar, `kemasan_qty` faktor penuh | **satu kotak global** — ditimpa vendor mana pun yang terakhir datang |
| `bahan_baku_harga_history` | jejak penimpaan harga master, ada `ref_po_id` | riwayat **master**, bukan riwayat per vendor |
| `purchase_order` / `_item` | 50 PO, 67 baris item | `harga_pesan` di-prefill dari harga master global |
| `verifikasi_terima_po` | RPC penerimaan + sync harga master | guard salah-satuan `20260904120000` menolak update kalau rasio sama persis dengan faktor konversi |

**Lubangnya di form PO**
([new/page.tsx:43](apps/admin-dashboard/src/app/dashboard/pembelian/new/page.tsx#L43)):
memilih supplier mengisi item dari `bahan.harga_beli` — harga vendor terakhir
siapa pun, bukan harga vendor yang sedang dipesan.

### 2.2 Angka yang menentukan bentuk rancangan

| Ukuran | Angka |
|---|---|
| Bahan aktif | 52 |
| Bahan yang pernah dibeli lewat PO | 32 |
| Bahan dengan lebih dari 1 vendor menurut riwayat PO | **11** |
| Pasangan (bahan, vendor) dari riwayat PO | **44** |
| — PO terakhirnya **setelah** guard 4 Sep | **15** (boleh dipercaya) |
| — PO terakhirnya **sebelum** guard 4 Sep | **27** (basis satuan campur) |
| — belum pernah diverifikasi | 2 |
| Pasangan dari `supplier.bahan_baku_ids` **tanpa** jejak PO | **27** |
| Perkiraan total baris katalog saat seed | **sekitar 71** |

### 2.3 Temuan `satuan_po` — kolom hidup, nol pembaca

`bahan_baku.satuan_po` terisi untuk **52 dari 52 bahan aktif** (migration
`20260908155000`). Tetapi:

```bash
grep -rn "satuan_po" apps/ packages/ --include=*.ts --include=*.tsx   # nol hasil
```

Klaim di `MASTER-SATUAN-PO-DAN-DISTRIBUSI.md` §4 — *"`usePurchaseOrder.ts`
menggunakan `satuan_po` sebagai unit default saat membuat PO"* — **belum benar
per 8 September 2026.** Kolomnya baru ada di DB; belum ada kode yang membacanya.
Dokumen master perlu dikoreksi agar tidak menyesatkan sesi berikutnya.

### 2.4 Ranjau: 3 bahan yang `satuan_po`-nya bukan satuan master

| Bahan | `satuan_po` | Satuan master | Faktor | Isi satuan kecil per `satuan_po` |
|---|---|---|---|---|
| **FOIL** | `roll` | `Dus` | **48x** | 36.480 / 48 = **760 cm** |
| **MIE** | `bungkus` | `Dus` | **40x** | **1** (`satuan_po` = satuan kecil) |
| **PLASTIK BESAR** | `pack` | `Ikat` | **5x** | 250 / 5 = **50 lembar** |

49 bahan lain `satuan_po` sama dengan satuan master, jadi aman.

**Bahayanya:** kalau form PO mulai menampilkan `satuan_po` sebagai label
sementara `verifikasi_terima_po` tetap membaca angkanya sebagai satuan master,
**qty masuk 48x / 40x / 5x lipat** ke ledger. Harganya sebagian terlindungi guard
`20260904120000` (rasio persis sama dengan faktor, update master ditolak);
**qty tidak punya penjaga sama sekali.** Ini pola yang sama dengan insiden FOIL
Rp413,6 juta, lewat pintu yang berbeda.

---

## 3. Bagian 0 — Prasyarat

Dikerjakan lebih dulu; katalog berdiri di atasnya.

### 3.1 `bahan_baku.faktor_po`

Kolom numerik baru: **berapa satuan kecil dalam 1 `satuan_po`**.

Di-seed dengan penurunan tiga-tingkat:

| `satuan_po` cocok dengan | `faktor_po` |
|---|---|
| `satuan` (besar) | `faktor_tampilan` |
| `satuan_tengah` | `faktor_tampilan / faktor_tengah` |
| `satuan_kecil` | `1` |

Setelah seed, **3 bahan di §2.4 diverifikasi satu per satu** terhadap angka di
`MASTER-SATUAN-PO-DAN-DISTRIBUSI.md` §3, bukan dipercaya begitu saja.

**Kenapa disimpan eksplisit, bukan diturunkan saat runtime.**
`getDistribusiFactor()` sudah memakai cara turunan itu dan membuktikan rapuhnya:
ia butuh tambalan sinonim (`bks` dan `bungkus`) dan **diam-diam mengembalikan 1
kalau tak ada label yang cocok**
([compositeUnit.ts:212](apps/stok/src/lib/format/compositeUnit.ts#L212)).
Diam-diam salah 1x adalah cara paling sunyi kehilangan 48x. Kolom eksplisit
membuat kesalahan kelihatan (NULL), bukan tersamar sebagai 1.

`faktor_po` wajib terisi untuk bahan aktif, dengan `CHECK (faktor_po > 0)`.

### 3.2 Dedup `Lettuce (Pak Aziz)`

Satu-satunya duplikat supplier tersisa. Tanpa ini katalognya pecah dua baris
untuk vendor yang sama, dan pembanding harga jadi bohong.

Saat menggabungkan, **dua** tempat harus ikut diperbarui:
`purchase_order.supplier_id` (FK) **dan** `purchase_order.supplier_nama`
(denormalisasi). Termin mana yang benar adalah pertanyaan untuk owner, bukan
tebakan.

---

## 4. Bagian 1 — Model data

### 4.1 `bahan_baku_supplier`

Satu baris per pasangan (bahan, vendor).

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid PK | |
| `bahan_baku_id` | uuid NOT NULL, FK `bahan_baku` ON DELETE CASCADE | |
| `supplier_id` | uuid NOT NULL, FK `supplier` ON DELETE CASCADE | |
| `satuan_beli` | text NOT NULL | default `bahan_baku.satuan_po`; **boleh menyimpang per vendor** |
| `isi_satuan_kecil` | numeric NOT NULL CHECK > 0 | default `bahan_baku.faktor_po`; **wajib diisi manual kalau `satuan_beli` menyimpang** |
| `harga` | numeric NOT NULL CHECK >= 0 | per `satuan_beli`, apa adanya sesuai nota |
| `harga_per_satuan_kecil` | numeric **GENERATED** `harga / isi_satuan_kecil` STORED | satu-satunya angka yang boleh dibandingkan antar vendor |
| `kode_vendor` | text NULL | kode barang di sisi vendor (opsional) |
| `is_preferred` | boolean NOT NULL DEFAULT false | vendor utama untuk bahan ini — dipakai sebagai vendor terpilih di layar pembanding dan saran "perlu dibeli". **Tidak** ikut menentukan harga master (lihat §11.1) |
| `is_active` | boolean NOT NULL DEFAULT true | vendor berhenti memasok, baris dinonaktifkan bukan dihapus |
| `sumber` | text NOT NULL CHECK IN (`po`, `manual`) | asal angka terakhir |
| `perlu_ditinjau` | boolean NOT NULL DEFAULT false | lihat §5 |
| `ref_po_id` | uuid NULL, FK `purchase_order` ON DELETE SET NULL | PO yang terakhir memperbaruinya |
| `harga_updated_at` | timestamptz | |
| `updated_by` | uuid, FK `outlet_staff` | |
| `created_at`, `updated_at` | timestamptz | trigger `updated_at` mengikuti pola `supplier_set_updated_at()` |

**Constraint:**

- `UNIQUE (bahan_baku_id, supplier_id)`
- Unique parsial pada `(bahan_baku_id) WHERE is_preferred` — maksimal satu
  vendor utama per bahan
- Index pada `(bahan_baku_id)` dan `(supplier_id)`

**Kenapa jangkarnya satuan kecil, bukan satuan besar.**
Kalau harga vendor disimpan relatif ke satuan besar, setiap kali satuan besar
bahan berubah semua baris katalog jadi salah tanpa gejala. Itu bukan
kekhawatiran teoretis: **hari ini juga** FOIL naik dari Roll ke Dus
(`20260908103000`), dan 26 surat jalan berjalan terpaksa dikonversi dibagi 48
justru karena `surat_jalan_item.qty_dikirim` menyimpan angka relatif ke satuan
besar. Dijangkar ke satuan kecil, baris katalog tetap benar tanpa disentuh.

### 4.2 `bahan_baku_supplier_history`

Pola sama persis dengan `bahan_baku_harga_history` yang sudah ada:

`id`, `bahan_baku_supplier_id`, `bahan_baku_id`, `supplier_id`, `harga_lama`,
`harga_baru`, `satuan_beli`, `isi_satuan_kecil`, `sumber`, `ref_po_id`,
`catatan`, `changed_by`, `changed_at`.

Baris ditulis oleh trigger pada setiap perubahan `harga`, `satuan_beli`, atau
`isi_satuan_kecil`. Index `(bahan_baku_id, changed_at DESC)`.

### 4.3 RLS

Cermin kebijakan `supplier` pasca `20260814110000` — audiens sama, karena harga
vendor sama sensitifnya dengan data supplier:

- **SELECT dan WRITE:** `admin`, `kitchen`, `purchase`, `purchasing`,
  `admin_finance`, `finance`, `owner`, `developer`
- History: **SELECT saja**, audiens sama. Tidak ada jalur tulis dari klien,
  hanya trigger.

### 4.4 `supplier.bahan_baku_ids` dipensiunkan

Katalog menggantikannya sebagai jawaban "vendor ini memasok apa" — dengan harga
dan satuan, bukan sekadar daftar.

Kolomnya **tidak di-drop** pada tahap ini (masa transisi; halaman supplier
existing masih membacanya). Ia berhenti *ditulis* begitu halaman supplier pindah
ke katalog. Penghapusan kolom adalah keputusan terpisah setelah semua pembaca
pindah.

---

## 5. Bagian 2 — Seed: 44 pasangan, tapi tidak semuanya boleh dipercaya

Seed berasal dari dua sumber:

1. **Riwayat PO** — 44 pasangan. Harga diambil dari `harga_terima` PO
   terverifikasi terakhir; `sumber = 'po'`; `ref_po_id` diisi.
2. **`supplier.bahan_baku_ids` tanpa jejak PO** — 27 pasangan. Tidak ada harga
   yang bisa dipercaya, jadi baris dibuat dengan `harga = 0`,
   `sumber = 'manual'`, `perlu_ditinjau = true`.

### Aturan `perlu_ditinjau`

Hanya **15 dari 44** pasangan yang PO terakhirnya diverifikasi **setelah** guard
salah-satuan (4 Sep 2026). **27 pasangan** berasal dari periode ketika basis
satuan input PO masih campur, dan **2 pasangan** belum pernah diverifikasi sama
sekali. Keduanya sama-sama ditandai `perlu_ditinjau = true` — jadi dari 44
pasangan riwayat PO, hanya 15 yang lolos bersih.

Baris yang ditandai tetap di-seed supaya pasangannya terdaftar, tapi:

- `perlu_ditinjau = true`
- **Tidak dipakai untuk prefill PO**
- Di layar pembanding tampil pucat, berlabel "belum ditinjau"

Bendera hilang saat seseorang menyunting dan menyimpan baris itu, atau saat PO
baru diverifikasi untuk pasangan tersebut.

**Kenapa tidak diimpor lugas.** Mengimpor 27 harga bercampur basis lalu
menyebutnya katalog akan menghasilkan angka yang **lebih buruk** daripada
keadaan sekarang, dan lebih berbahaya karena tampil sebagai data yang rapi.
Ini pelajaran yang sama dengan alasan WAC ditolak: menghitung di atas riwayat
bercampur basis memberi hasil yang lebih jelek dari metode sederhana.

Seed ditulis **idempoten**
(`ON CONFLICT (bahan_baku_id, supplier_id) DO NOTHING`) supaya boleh dijalankan
ulang.

---

## 6. Bagian 3 — Alur

```
1. Buat PO      pilih vendor, tiap item terisi dari KATALOG vendor itu
                (harga dan satuan belinya), bukan harga global terakhir.
                Baris perlu_ditinjau: kolom harga dikosongkan + peringatan.

2. Terima       operator mengetik qty dan harga APA ADANYA sesuai nota, dalam
                satuan beli vendor. Form yang mengonversi ke satuan kanonik
                sebelum dikirim ke verifikasi_terima_po.

3. Verifikasi   katalog (bahan, vendor) ter-update + 1 baris riwayat.
                Harga master TETAP aturan lama (harga terima terakhir);
                guard 20260904120000 TIDAK disentuh.

4. Pembanding   satu layar: bahan X, vendor A/B/C, disetarakan per satuan
                kecil, selisih persen, terakhir kapan, mana yang preferred.
```

### 6.1 Langkah 2 adalah inti perbaikannya

Hari ini form terima PO memaksa operator berhitung sendiri ke satuan induk.
Itu sudah dua kali melahirkan salah input PLASTIK MERAH (Agustus dan September)
dan menyumbang insiden FOIL. Dengan katalog menyimpan satuan beli berikut
faktornya, operator mengetik "48 roll @ 8.791" dan sistemlah yang mengubahnya.

Konsekuensinya **2 kolom aditif** di `purchase_order_item`: `satuan_input`
(text) dan `isi_satuan_input` (numeric), supaya jejak dokumen PO cocok dengan
notanya dan bisa diaudit belakangan. Kolom lama tetap menyimpan angka kanonik;
tidak ada perubahan arti pada kolom yang sudah ada.

### 6.2 Batas yang tegas

`verifikasi_terima_po` **hanya ditambah satu langkah**: menulis katalog dan
riwayat. Logika ledger, qty, status PO, jatuh tempo, dan sync harga master tidak
disentuh sama sekali. Guard salah-satuan tetap berlaku dan tetap menjadi jaring
pengaman terakhir.

---

## 7. Tahapan pengerjaan

| Tahap | Isi | Bisa berdiri sendiri? |
|---|---|---|
| **0** | `faktor_po` + verifikasi 3 bahan + dedup `Lettuce (Pak Aziz)` | Ya — bernilai walau tahap lain batal, menutup ranjau §2.4 |
| **1** | Tabel `bahan_baku_supplier` + history + RLS + seed | Ya — katalog terbaca, belum dipakai alur |
| **2** | Layar katalog dan pembanding (admin-dashboard) | Ya — nilai langsung: pembanding harga vendor |
| **3** | Form PO baca katalog (prefill harga + satuan beli) | Butuh tahap 1 |
| **4** | Form terima PO pakai satuan vendor, `verifikasi_terima_po` menulis balik | Butuh tahap 1 dan 3 |

Tahap 0 **mendesak dan kecil** — dikerjakan lebih dulu terlepas dari nasib tahap
lainnya, karena `satuan_po` sudah ada di DB dan siapa pun bisa mewirekannya ke
form kapan saja.

---

## 8. Penanganan galat

| Keadaan | Perilaku |
|---|---|
| Vendor belum punya baris katalog untuk bahan itu | Form PO membiarkan harga kosong dan menawarkan "tambahkan ke katalog". **Tidak** jatuh ke harga master global secara diam-diam. |
| `perlu_ditinjau = true` | Harga tidak di-prefill; label peringatan. |
| `satuan_beli` menyimpang tapi `isi_satuan_kecil` kosong | Ditolak di level constraint (NOT NULL). Tidak ada default diam-diam. |
| `faktor_po` NULL untuk bahan aktif | Baris katalog tidak bisa dibuat otomatis; ditandai untuk diisi manual. Bukan diasumsikan 1. |
| Rasio harga baru terhadap lama persis sama dengan faktor konversi bahan | Guard existing `20260904120000` tetap menolak update harga master. Katalog **ikut** menandai `perlu_ditinjau = true` alih-alih menyimpan diam-diam. |

---

## 9. Pengujian

**Unit (fungsi murni, TDD):**

- `hitungFaktorPo(bahan)` — ketiga cabang tingkat, plus kasus label tidak cocok
  (harus **NULL**, bukan 1)
- `konversiKeSatuanKecil(qty, satuanBeli, isiSatuanKecil)`
- `setarakanHargaAntarVendor(rows)` — perbandingan per satuan kecil, termasuk
  vendor yang satuan belinya berbeda
- `bolehPrefill(row)` — memperhatikan `perlu_ditinjau` dan `is_active`

**Data (dijalankan sekali terhadap DB, hasilnya dicatat):**

- `faktor_po` untuk FOIL = 760, PLASTIK BESAR = 50, MIE = 1
- Seed menghasilkan 15 baris `perlu_ditinjau = false`, sisanya `true`
- Nol baris katalog dengan `isi_satuan_kecil` NULL atau kurang dari sama dengan 0

**Manual (browser):**

- Buat PO ke vendor yang punya katalog: harga terisi dari vendor itu, bukan
  harga global
- Buat PO ke vendor dengan baris `perlu_ditinjau`: harga kosong dan ada
  peringatan
- Terima PO FOIL dalam `roll`: ledger bertambah setara, **bukan** 48x lipat
- Layar pembanding FOIL: Ekadharma dan Altindo tampil setara per cm

---

## 10. Risiko

| Risiko | Mitigasi |
|---|---|
| Seed pra-guard dipercaya orang | `perlu_ditinjau` + tidak dipakai prefill + tampil pucat |
| `satuan_po` diwirekan ke form sebelum `faktor_po` ada | Tahap 0 dikerjakan lebih dulu; dokumen master dikoreksi (§2.3) |
| Duplikat supplier baru muncul | Di luar lingkup; layak jadi constraint unik pada nama ternormalisasi di pekerjaan terpisah |
| Riwayat migration DB bersama berubah di tengah jalan | Cek `supabase migration list` tepat sebelum apply; verifikasi ground-truth lewat katalog sistem, jangan percaya status `migration list` |
| Katalog dianggap menggantikan spec kantong harga per PO | Tidak. Katalog adalah harga *pembelian*; kantong adalah nilai *persediaan*. Keduanya bisa hidup bersama. |

---

## 11. Keputusan yang sudah diambil (jangan dibongkar tanpa alasan baru)

1. **Harga master tidak berubah** — tetap "harga penerimaan terakhir".
   (Owner, 8 Sep. Selisih terhadap WAC terukur tiga kali, sekitar 0,07% nilai
   persediaan.)
2. **Katalog terisi otomatis dari penerimaan PO, boleh disunting.**
3. **Satuan beli disimpan berikut faktornya**, bukan sekadar label.
4. **`satuan_po` per bahan adalah default; vendor boleh menyimpang** dengan
   kewajiban mengisi faktornya.
5. **Vendor tidak pernah naik jadi identitas barang** — tidak ada pemecahan
   bahan per vendor.
