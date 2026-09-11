# Drop-Ship Sayur — Kiriman Langsung Vendor ke Outlet

**Tanggal:** 2026-09-11
**Status:** Spec — **belum dieksekusi.** Semua keputusan di §2 berasal dari sesi
grilling dengan owner pada 2026-09-11; semua angka di §1 diukur ke DB produksi pada
hari yang sama.
**Pemilik keputusan:** owner

---

## 1. Masalah

### Alur fisik yang sebenarnya

1. Crew outlet **memesan langsung ke Pak Aziz**.
2. Sayur **diantar langsung ke outlet** — Gudang Pusat tidak tersentuh sama sekali.
3. Tiap **tanggal 10, 20, dan 30**, Pak Aziz memberi **nota rekapan** dan
   pembayaran terjadi di tanggal itu.
4. Nota itu **satu lembar gabungan untuk semua outlet**, tapi Pak Aziz **menyimpan
   catatannya sendiri per pengiriman** (outlet mana, berapa kg).

### Sistem tidak punya konsep drop-ship

| Fakta | Bukti |
|---|---|
| `purchase_order` tidak punya kolom outlet | Setiap PO diam-diam berarti "untuk Gudang Pusat" |
| `pembelian_supplier` hanya pernah terjadi di Gudang Pusat | 42 baris di GUDANG PUSAT (HQ); 1 baris nyasar di BNR 9 Juli |
| Jatuh tempo hanya bergulir | `computeDueDate` (TS, dua salinan identik) dan `verifikasi_terima_po` (DB) sama-sama `tanggal datang + termin_hari` |
| Supplier sayur ada, tak pernah dipakai | `Lettuce (Pak Aziz) - Tempo 10`: termin 10, **0 PO**, katalog memetakan Sayur (lettuce) ke sana dengan harga Rp 0 (`perlu_ditinjau`) |

### Akibatnya (September 1–10)

| | |
|---|---:|
| Sayur dipotong BOM | **10.175** kali, otomatis |
| Sayur dicatat masuk (`adjustment` manual) | **50** kali — dan banyak di antaranya **bukan pembelian** (pembalikan void, pinjam antar outlet, satu batch Empang 4.870 kg yang hampir pasti salah satuan) |
| Lewat PO / surat jalan / petty cash | **nol** |
| Outlet dengan saldo sayur minus | **9 dari 26** |
| `opname_selisih` sayur | **−4.172 kg** — opname jadi tukang tambal tiap malam |
| Belanja sayur tak tercatat di mana pun | **± Rp 55 juta/bulan** (843 kg per 10 hari × Rp 22.000) |

Sayur tidak dicatat lewat jalur resmi **bukan karena crew malas — tidak ada jalur
yang cocok untuk dilalui.** Bandingkan gas dan mie: crew membelinya tunai dan
mencatatnya rapi di petty cash ("gas elpiji", "isi ulang gas 2x", "Indomie"). Crew
mau mencatat asal tempatnya satu dan jelas.

---

## 2. Keputusan owner (urut — jangan dibuka ulang tanpa alasan baru)

| # | Keputusan | Catatan |
|---|---|---|
| K1 | **Crew mencatat terima, Pusat mengesahkan** (dua tahap) | Bukan crew sendirian |
| K2 | **Pengesah: purchasing, kitchen, atau admin** — ketiganya boleh | |
| K3 | **Stok bertambah saat crew mencatat**, harian | Owner semula memilih "stok saat disahkan", lalu berubah setelah ketahuan pengesahan cuma tiap 10 hari = stok salah sampai 10 hari |
| K4 | **Pengesahan = mencocokkan total catatan crew dengan nota Pak Aziz**, lalu jadi utang vendor | Nota vendor = pemeriksa dari **luar** sistem yang tidak bisa dipalsukan crew |
| K5 | **Periode tagihan tetap kalender: 10 / 20 / 30** | Bukan termin bergulir |
| K6 | **Nota gabungan; catatan pengiriman Pak Aziz dipakai untuk pencocokan per outlet** bila tersedia | Kalau tidak tersedia, turun ke pencocokan total |

### Kenapa K3 aman walaupun stok bisa minus sementara

`ledger_stamp_saldo` mengecualikan `pemakaian` dari penjaga anti-minus
("penjualan POS tak boleh gagal"). Jadi kalau sayur datang terlambat dan BOM
memotong duluan, order tetap jalan; saldo cuma minus sampai crew mencatat.

### Kenapa K4 menutup risiko K3

Keberatan wajar terhadap K3: crew bisa menggelembungkan stok outletnya sendiri.
Tapi tiap tanggal 10/20/30 catatan crew dicocokkan dengan **nota Pak Aziz** — dan
bila ada, dengan **catatan pengiriman Pak Aziz per outlet**. Crew mencatat 50 kg,
Pak Aziz mengirim 42 kg → ketahuan. Itu pemeriksaan terhadap dokumen luar, lebih
kuat daripada Pusat mengklik "setuju" per kiriman tanpa pernah melihat sayurnya.

---

## 3. Prinsip desain

1. **Dua irama, sengaja dipisah.** Stok bergerak harian (catatan crew). Uang
   bergerak periodik (nota). Pengesahan mengunci **tagihan**, bukan stok.
2. **Hanya mencatat yang benar-benar diketahui seseorang saat kejadian.** Crew tahu
   berapa kg yang diterima; ia tidak tahu harga — maka crew tidak pernah mengetik
   harga.
3. **Pakai ulang, jangan bangun ulang.** Stok lewat `ledger_stok` tipe
   `pembelian_supplier`. Utang lewat `purchase_order`, supaya otomatis muncul di
   layar utang finance yang sudah ada.
4. **Tidak menyentuh jalur Gudang Pusat.** Surat jalan, `verifikasi_terima_po`, dan
   layar kitchen `penerimaan-po` tidak diubah.
5. **Umum di model, sempit di isi.** Tabelnya berlaku untuk vendor & outlet mana
   pun; yang mengisinya hari ini hanya sayur/Pak Aziz — satu-satunya kiriman
   langsung vendor di data September.

---

## 4. Model data

### 4.1 `terima_vendor_outlet` — catatan terima harian crew (tabel baru)

| Kolom | Tipe | Arti |
|---|---|---|
| `id` | uuid PK | |
| `outlet_id` | uuid FK outlets | Outlet penerima |
| `supplier_id` | uuid FK supplier | Default untuk sayur: `Lettuce (Pak Aziz) - Tempo 10` |
| `bahan_baku_id` | uuid FK bahan_baku | |
| `qty` | numeric > 0 | **Satuan besar** — sama dengan kontrak `stok_waste_reports.qty`, dikonversi dari pilihan satuan crew |
| `harga_snapshot` | numeric ≥ 0 | Dikunci saat dicatat: harga katalog vendor bila > 0, selain itu harga master. **Tidak diketik crew.** |
| `tanggal_terima` | date | Menentukan periode tagihan |
| `status` | text | `dicatat` → `disahkan` / `ditolak` |
| `nota_vendor_id` | uuid FK, nullable | Terisi saat disahkan |
| `dicatat_oleh`, `dicatat_at` | | |
| `catatan`, `foto_url` | | Opsional |

**Stok ditulis oleh trigger**, meniru pola `sync_waste_ledger` yang sudah terbukti:
setiap INSERT/UPDATE merekonsiliasi *target* (`to_ledger_scale(outlet, bahan, qty)`
bila status `dicatat`/`disahkan`, 0 bila `ditolak`) terhadap jumlah baris ledger
yang sudah merujuk catatan ini, lalu menulis selisihnya. Idempoten, dan koreksi qty
sebelum disahkan otomatis menyesuaikan stok.

⚠️ Pelajaran sesi 2026-09-10: meralat catatan ini **menggerakkan stok**. Itu memang
diinginkan di sini — tapi jangan pernah menulis `adjustment` pembalik manual di atas
koreksi yang sudah dilakukan trigger.

**Kolom baru di `ledger_stok`: `ref_terima_vendor_id`** (nullable, FK) — aditif,
sejajar dengan `ref_waste_id`. Tanpanya, stok drop-ship tak bisa dilacak balik ke
catatannya.

### 4.2 `nota_vendor` — nota rekapan per periode (tabel baru)

| Kolom | Arti |
|---|---|
| `id`, `supplier_id` | |
| `periode_mulai`, `periode_akhir` | Mis. 1–10 September |
| `tanggal_tagihan` | 10 / 20 / 30 (lihat §4.4) |
| `total_kg_nota`, `total_rupiah_nota` | Diisi dari nota fisik |
| `foto_nota_url` | Wajib |
| `status` | `draft` → `disahkan` / `ditolak` |
| `disahkan_oleh`, `disahkan_at` | |
| `purchase_order_id` | Terisi saat disahkan |
| `catatan_selisih` | Wajib diisi bila catatan crew ≠ nota |

**`nota_vendor_rincian`** (opsional) — catatan pengiriman Pak Aziz:
`nota_vendor_id, outlet_id, tanggal_kirim, qty_kg`. Bila diisi, pencocokan turun
ke tingkat outlet atau per pengiriman. Bila kosong, pencocokan hanya total.

### 4.3 PO sebagai wadah utang — dibuat saat pengesahan

Saat nota disahkan, RPC membuat **satu `purchase_order` per nota**: supplier
`Tempo 10`, status langsung **`diterima_lengkap`**, `payment_status = 'unpaid'`,
`jatuh_tempo = tanggal_tagihan` (tetap, bukan bergulir), satu baris item per bahan
dengan qty & harga dari nota.

**Kolom baru di `purchase_order`: `nota_vendor_id`** (nullable, FK). Dibutuhkan
bukan untuk alur, tapi supaya sistem tahu stok PO ini **sudah** masuk di outlet —
bukan di Gudang Pusat.

⛔ **Tiga larangan yang wajib dipegang implementasi:**

1. **Jangan pernah lewat `verifikasi_terima_po`.** Fungsi itu menulis
   `pembelian_supplier` ke Gudang Pusat (UUID ditulis mati). Stok sayur sudah masuk
   ke outlet lewat §4.1 — lewat sana = stok dobel, di lokasi yang salah.
2. **Jangan mengesahkan dengan meng-UPDATE status PO.** `po_status_transition_guard`
   (BEFORE **UPDATE** saja) mengizinkan status diterima hanya untuk
   kitchen/admin/owner — **purchasing tidak termasuk**, padahal K2 membolehkannya.
   PO dibuat lewat **INSERT** di dalam RPC yang memeriksa perannya sendiri.
3. **Pemeriksa "PO diterima tanpa baris ledger" harus mengecualikan PO ber-
   `nota_vendor_id`.** Kalau tidak, setiap nota sayur akan tampak seperti kasus
   impor Excel Agustus (24 PO tanpa ledger).

Diverifikasi 2026-09-11: tidak ada trigger di `purchase_order` maupun
`purchase_order_item` yang menulis stok. `po_on_verified()` yang disebut komentar
`dueDate.ts` **tidak ada** — komentarnya basi.

### 4.4 Periode tagihan tetap

Fungsi murni `periode_tagihan(tanggal) → (mulai, akhir, tanggal_tagihan)`, dengan
salinan TS untuk tampilan (pola `computeDueDate`).

| Tanggal terima | Periode | Ditagih |
|---|---|---|
| 1–10 | 1–10 | tgl 10 |
| 11–20 | 11–20 | tgl 20 |
| 21–akhir bulan | 21–akhir | **asumsi: akhir bulan** |

⚠️ **Belum diputuskan owner:** bulan 31 hari (tanggal 31 ikut periode ketiga?) dan
Februari (tidak ada tanggal 30). Lihat §9.

---

## 5. Alur & layar

### 5.1 Crew — "Terima dari Vendor" (app stok, rute baru)

Saudara `penerimaan-po`, **bukan** pakai ulang: `penerimaan-po` adalah layar
**kitchen** untuk PO yang sudah dibuat lebih dulu dan tiba di Gudang Pusat.
Aktornya beda, dokumennya beda.

- Pilih vendor (terisi otomatis bila outlet cuma punya satu vendor untuk bahan itu)
- Pilih bahan, isi jumlah dengan **pemilih satuan** (pola `WasteModal`: kecil /
  tengah / besar, dikonversi sebelum disimpan)
- Tampil **"Akan tercatat"** dan **"Stok setelah disimpan"** (pola `ManualEntryForm`)
- **Gerbang kewajaran berbatas dua sisi** — tahan bila jumlah jauh di atas
  kebiasaan outlet itu (bukan cuma menolak nol/minus). Pelajaran 2026-09-10: tiga
  ton daging lolos karena tidak ada yang menahan angka mustahil.
- Foto opsional

Setelah dicatat, stok outlet langsung bertambah. Catatan masih bisa dikoreksi
selama belum disahkan.

### 5.2 Pusat — "Cocokkan Nota Vendor"

Untuk purchasing / kitchen / admin.

1. Pilih vendor + periode. Sistem menampilkan **total catatan crew per outlet**.
2. Masukkan nota: total kg, total rupiah, foto.
3. (Opsional) masukkan rincian pengiriman dari catatan Pak Aziz.
4. Sistem menandai selisih: total, dan per outlet bila rincian ada.
5. **Sahkan** → RPC membuat PO utang (§4.3), menandai semua catatan periode itu
   `disahkan`, mengunci qty-nya. Selisih wajib diberi `catatan_selisih`.
6. **Tolak** satu catatan crew → statusnya `ditolak`, trigger membalik stoknya.

Beda harga nota vs `harga_snapshot` ditandai, dan baris katalog vendor
diperbarui dari nota. **Harga master tidak disentuh di fase ini** (§9).

---

## 6. Otorisasi

Mengikuti tiga pelajaran yang mahal:

- **Server Action + service-role + RPC SECURITY DEFINER = nol otorisasi** kalau RPC
  tidak memeriksa peran sendiri (2026-07-20). Setiap RPC di sini memeriksa peran
  **di dalam fungsi**, bukan cuma di halaman atau middleware.
- **Crew hanya boleh mencatat untuk outletnya sendiri** — pakai
  `outlet_staff.outlet_id`, **bukan** `accessible_outlet_ids()`. Yang kedua
  mengembalikan semua outlet untuk kitchen, dan persis itu yang membuka lubang
  opname lintas-outlet (2026-08-13, masih terbuka).
- **Tidak ada policy `USING(true)`** di tabel baru (sapuan 2026-09-10 menemukan pola
  itu di `payroll_records`, `bahan_baku`, dan lainnya). SELECT ber-scope
  `accessible_outlet_ids()`; semua penulisan hanya lewat RPC; grant tulis tabel
  langsung dicabut dari `anon` dan `authenticated`.

Predikat pengesah dibuat satu tempat (pola `canApprovePermintaan` di
`apps/stok/src/lib/stok/approver.ts`) dan dipakai **sama** oleh UI dan RPC — supaya
tidak ada dua tempat yang menebak aturan peran sendiri-sendiri.

---

## 7. Yang sengaja tidak disentuh

- Surat jalan, ledger Gudang Pusat, `verifikasi_terima_po`, layar `penerimaan-po`
- HPP resep (`get_hpp_periode` — resep × penjualan × harga master)
- Harga master (`bahan_baku_harga`) — lihat §9
- Belanja tunai crew (gas, mie, es batu, galon) — kelas lain; uangnya sudah tercatat
  di petty cash, yang kurang cuma stoknya
- Baris `adjustment` sayur yang lama — dibiarkan sebagai jejak

---

## 8. Dampak ke laporan & pemeriksaan lain

| | Tindakan |
|---|---|
| `hpp_barang_masuk_harian_spv` hanya membaca surat jalan | Sayur drop-ship **tak akan terhitung** di sana. Perluas view atau buat view saudara — dibutuhkan untuk rekonsiliasi "nilai keluar terkunci vs BOM terpakai" |
| Pemeriksa PO-tanpa-ledger | Kecualikan `nota_vendor_id IS NOT NULL` (§4.3) |
| Gerbang kewajaran waste | Setelah stok sayur benar, gerbang berbasis stok mulai bermakna untuk sayur |
| Detektor `vendor_konflik_spesifikasi` | Tidak terpengaruh — sayur single-vendor, isi kemasan 1.000 g/kg konsisten |

---

## 9. Pertanyaan terbuka (untuk owner)

1. **Periode ketiga:** tanggal 31 ikut periode 21–31? Februari ditagih tanggal 28/29?
2. **Tanggal mulai.** Paling bersih di awal periode (tanggal 11 atau 21), didahului
   opname sayur di semua outlet sebagai baseline.
3. **Harga master ikut nota?** Untuk sayur yang single-vendor, masuk akal. Tapi itu
   menggeser HPP resep — lebih aman diputuskan terpisah.
4. **Catatan pengiriman Pak Aziz bentuknya apa** (kertas, foto, WhatsApp) dan
   apakah bisa diminta rutin tiap nota?
5. **Foto bukti terima wajib atau opsional** untuk crew?

---

## 10. Urutan pengerjaan

| Fase | Isi | Bisa jalan tanpa |
|---|---|---|
| **F1 — Database** | Tabel §4.1–4.2, kolom `ledger_stok.ref_terima_vendor_id` & `purchase_order.nota_vendor_id`, trigger sinkron stok, fungsi periode, RPC catat, RLS | — |
| **F2 — Layar crew** | §5.1 | F3 |
| **F3 — Layar nota** | §5.2 + RPC sahkan/tolak | — |
| **F4 — Laporan** | §8 | — |

F1+F2 saja sudah memperbaiki masalah terbesar (stok sayur benar tiap pagi). F3
membuat uangnya terlihat.

---

## 11. Verifikasi wajib (pelajaran sesi 2026-09-10/11)

- **DDL lewat `supabase db query --linked -f file`**, lalu verifikasi ke katalog —
  bentuk inline bisa diam-diam tidak menjalankan apa pun.
- **Asersi berbatas dua sisi.** `saldo < 0` saja pernah lolos saat saldo melonjak ke
  angka positif yang mustahil.
- **Periksa `pg_trigger` sebelum meng-UPDATE tabel produksi mana pun.**
- **Kontrol positif sebagai crew asli** (`request.jwt.claims` + `SET LOCAL ROLE
  authenticated`, di dalam transaksi + `ROLLBACK`): crew bisa mencatat untuk
  outletnya, **tidak bisa** untuk outlet lain; purchasing bisa mengesahkan.
- **Kontrol negatif** di tiap blok asersi, membuktikan jalan senyap = lulus.
- **Uji jalur mayoritas**: trigger baru duduk di `ledger_stok`, tabel yang dilewati
  setiap potongan BOM setiap order — pastikan `pemakaian` tidak terganggu.
- **Sebelum commit:** `git branch --show-current` — otomasi repo memindahkan HEAD di
  tengah sesi.
