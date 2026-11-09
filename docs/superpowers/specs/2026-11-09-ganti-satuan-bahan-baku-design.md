# Ganti Satuan Bahan Baku (Master Bahan Tahap 3, bagian 1)

**Tanggal:** 2026-11-09 · **Status:** desain, belum dibangun
**Konteks:** `docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md` §K4
("Bahan dengan riwayat stok: tombol Ganti Satuan …"). Penjaga yang sudah live
(`bahan_baku_tegakkan_faktor`, `simpan_bahan_baku`) menolak perubahan satuan bahan
ber-riwayat stok dan menunjuk ke prosedur ini; bendera `app.ganti_satuan='on'` sudah
disiapkan di trigger untuk dipakai prosedur ini.

## 1. Kenapa sekarang

Pemicu nyata (owner, 2026-11-09): **BAWANG PUTIH BUBUK ganti vendor.** Vendor lama (Bapak
Marwan) menjual per Dus isi 432 sachet (Dus → Bungkus ×6 → Sachet ×72). Vendor baru menjual
kiloan. Owner mencoba mengubah satuan di panel detail menjadi Kg/gram dan ditolak (benar,
karena bahan punya 315 baris ledger).

Fakta bahan ini per 2026-11-09:
- Jembatan dari owner: **1 sachet lama = 6 gram**.
- Satuan baru: **Kg → gram (1 Kg = 1.000 gram)**, tanpa satuan tengah. **Satuan PO = Kg,
  satuan distribusi (kirim ke outlet) = Kg.**
- Tidak dipakai di resep aktif mana pun → stok hanya bergerak lewat kiriman & opname.
- Gudang Pusat saldo ~0. 14 outlet memegang ±1.000 sachet total (skala sachet), BNR
  0,1667 Dus (skala Dus — belum pernah opname sejak 1 Agu).
- **4 draft opname** memuat bahan ini. Nol SJ/PO/permintaan terbuka.
- Harga vendor: 1 baris katalog (Bapak Marwan, dus, isi 432, Rp 400.000).

Fiturnya **umum** (berlaku untuk bahan mana pun), bukan skrip sekali jalan untuk bawang.

## 2. Tujuan, bukan tujuan, anti-tujuan

**Tujuan**
- Admin/owner bisa mengganti satuan bahan ber-riwayat stok dari panel detail bahan,
  termasuk mengganti **satuan terkecil** (sachet → gram) dengan jembatan konversi.
- Setelah diganti, **semua angka stok bermakna satuan baru**: saldo, riwayat ledger, hasil
  opname. Laporan selisih/Jurnal Rekonsiliasi lintas tanggal ganti tidak melonjak palsu.
- Nilai rupiah persediaan **tidak bergeser** karena ganti satuan (harga per satuan kecil
  dikonversi, bukan dibiarkan).
- Pratinjau sebelum eksekusi: saldo tiap lokasi sebelum → sesudah, jumlah baris yang ikut
  diubah, harga master sebelum → sesudah.
- Tercatat di tab Riwayat: siapa, kapan, satuan lama → baru, jembatan, alasan.

**Bukan tujuan**
- Memecah satu bahan jadi dua (kasus FOIL dua ukuran) — itu bahan baru + migrasi saldo.
- Mengubah catatan ketikan asli crew di `opname_item.catatan` (field `raw`/`f`/`s`/`d`) —
  dibiarkan sebagai jejak (keputusan owner).
- Memilih vendor baru / mengisi harga vendor baru di dalam prosedur ini (itu tetap lewat
  form harga vendor yang ada, dikerjakan **sesudah** ganti satuan).

**Anti-tujuan (gagal walau "jalan")**
- Saldo atau riwayat yang tercampur dua satuan untuk bahan yang sama.
- Stok outlet berubah nilai rupiahnya karena ganti satuan.
- Crew yang sedang setengah jalan opname mengetik angka sachet yang lalu dibaca sebagai gram.
- Ganti satuan yang separuh berhasil (harus satu transaksi; gagal = tidak ada yang berubah).
- Menulis ulang satu baris ledger dengan faktor yang salah karena salah menebak skala baris
  itu (lihat §4.3).

## 3. Keputusan yang sudah diambil

| # | Keputusan | Oleh |
|---|---|---|
| K1 | Riwayat stok & opname **ikut dikonversi** ke satuan baru | owner |
| K2 | Dokumen selesai (SJ/PO/permintaan/waste/terima vendor/retur/mutasi) **ikut dikonversi angkanya** ke satuan baru, nilai rupiah dijaga sama ("pake yang baru"). Menggantikan keputusan awal "dibiarkan": laporan lama (nilai waste = qty × harga saat ini; HPP Dinamis = harga_snapshot ÷ isi saat ini; tampilan label) membaca dokumen dengan satuan **saat ini**, jadi dokumen yang tak dikonversi akan salah baca ±k_besar kali | owner, 2026-11-09 |
| K3 | Catatan ketikan asli crew dibiarkan | owner |
| K4 | Bawang putih bubuk: Kg/gram 1.000, 1 sachet = 6 g, PO & distribusi Kg | owner |
| K5 | Ganti satuan **ditolak** bila ada dokumen terbuka yang memuat bahan: draft opname, SJ draft/dikirim, PO belum selesai, permintaan menunggu, terima-vendor menunggu nota | spec 23 Sep + konfirmasi chat |
| K6 | Hak akses: lingkup `data` (admin, owner, developer) — sama dengan ubah satuan bahan tanpa riwayat | builder's call, mengikuti `_peran_master('data')` |
| K7 | Bahan tetap **id yang sama** (nama boleh tetap) | desain |

## 4. Cara kerja

### 4.1 Masukan dari admin
Satuan baru dalam bentuk yang sama dengan form satuan yang ada (`IsianSatuanFields`:
satuan besar, tengah opsional + isi, kecil + isi), satuan PO, satuan distribusi, **satu
jembatan**, dan alasan (wajib).

**Jembatan = berapa satuan kecil BARU dalam 1 satuan kecil LAMA** (bawang: 1 sachet = 6 gram
→ jembatan 6). Bila satuan kecil tidak berganti (mis. Dus isi 432 → Dus isi 500 sachet),
jembatan = 1. Layar menulisnya sebagai kalimat: "1 Sachet lama = [6] gram baru".

Turunan (dihitung server, ditampilkan di pratinjau):
- `k_kecil` = jembatan → pengali untuk angka berskala satuan kecil.
- `k_besar` = `faktor_tampilan_lama × jembatan ÷ faktor_tampilan_baru` → pengali untuk
  angka berskala satuan besar (bawang: 432 × 6 ÷ 1000 = **2,592** Kg per Dus lama).
- Bahan tanpa satuan kecil (`faktor_tampilan` NULL, skala selalu = satuan besar): jembatan
  diartikan per satuan besar; `k_kecil = k_besar = jembatan`.

### 4.2 Penolakan (pra-syarat)
Dicek di server di dalam transaksi yang sama, dan juga ditampilkan di pratinjau dengan
daftar dokumen penghalang (nomor + outlet), supaya admin tahu apa yang harus diselesaikan:
- draft opname yang punya `opname_item` bahan ini (bawang hari ini: 4);
- SJ status draft/dikirim yang memuat bahan ini;
- PO belum `diterima_lengkap`/`dibatalkan`/`ditolak` yang memuat bahan ini;
- permintaan `menunggu`;
- terima vendor outlet berstatus belum disahkan/ditolak;
- bahan sedang jadi utama/pengganti di `bahan_baku_substitusi` **dan** satuan kecil
  berganti (waterfall mengandaikan satuan kecil sama antar pasangan) — tolak, minta
  keputusan manual.

Builder: daftar status "terbuka" per tabel ambil dari kode yang sudah ada (status enum
sungguhan), jangan dari tebakan di atas.

### 4.3 Yang diubah (satu transaksi, `SET LOCAL app.ganti_satuan='on'`, kunci baris bahan `FOR UPDATE`)

1. **`bahan_baku`**: satuan, tengah, kecil, `faktor_tampilan`, `faktor_tengah`,
   `satuan_po`, `satuan_distribusi` (trigger invarian menurunkan `faktor_konversi`,
   `faktor_po`, kemasan). `default_reorder_point`, `stok_ideal` × `k_besar`
   (builder: verifikasi skalanya — UI menyebut "Batas minimum bawaan (per Dus)").
2. **`outlet_reorder_point`** (`reorder_point`, `stok_ideal`) × faktor sesuai skala kolom
   (verifikasi; bawang 0 baris).
3. **`stok_balance`** per lokasi: × `k_kecil` bila baris berskala kecil, × `k_besar` bila
   berskala besar. Skala ditentukan `saldo_is_gram(sb)` **dihitung sebelum ledger diubah**.
4. **`ledger_stok`** semua baris bahan ini: `qty`, `saldo_sebelum`, `saldo_sesudah`
   dikalikan faktor sesuai **skala baris itu pada saat ditulis**:
   - per (outlet, bahan): baris sebelum `opname_selisih` pertama sejak
     `2026-08-01 20:32+07` → skala besar; baris sejak itu → skala kecil
     (aturan `saldo_is_gram`);
   - baris `opname_selisih` pertama itu sendiri = baris transisi: `saldo_sebelum` × k_besar,
     `saldo_sesudah` × k_kecil, `qty` = selisih keduanya.
   - **Builder wajib memverifikasi aturan ini terhadap data** sebelum menulis (lihat §6):
     setelah konversi, untuk tiap (outlet, bahan) `saldo_sesudah` baris terakhir harus sama
     dengan `stok_balance.saldo` baru, dan rantai `saldo_sebelum(n) = saldo_sesudah(n-1)`
     tidak boleh lebih rusak daripada sebelum konversi (rantai lama boleh saja sudah putus —
     bandingkan, jangan mengandaikan utuh). Bila asersi gagal → tolak seluruh transaksi.
   - Penulisan langsung ke `ledger_stok` di sini adalah **pengecualian sengaja** atas SOP
     "semua perubahan stok lewat ledger": ini bukan perubahan kuantitas, melainkan
     perubahan satuan ukur. Pastikan trigger INSERT ledger tak terpicu (UPDATE saja) dan
     cek trigger UPDATE yang ada di `ledger_stok`.
5. **`opname_item`** (semua opname bahan ini, finalized): `qty_fisik`, `qty_system`
   × faktor sesuai skala opname itu (sama dengan skala ledger outlet pada tanggal opname);
   `selisih` kolom generated — ikut sendiri. `catatan` tidak disentuh.
6. **`opname_item_vendor.qty_besar`**, **`stok_vendor_gudang_mutasi.qty`** × `k_besar`
   (keduanya berskala satuan besar — verifikasi).
7. **`resep_item.qty_per_porsi`** × `k_kecil` (+ kolom `satuan` diganti label kecil baru)
   untuk semua resep (aktif & nonaktif) — agar BOM berikutnya memotong angka yang benar.
   Bawang: 0 resep aktif.
8. **Harga:** `bahan_baku_harga.harga_beli` ÷ `k_besar` (harga per satuan besar baru;
   harga per satuan kecil lama ÷ jembatan = per kecil baru). Urutan: faktor dulu, baru harga
   (`sync_harga_beli_display` menghitung dari faktor).
   **`bahan_baku_supplier`**: `isi_satuan_kecil` × `k_kecil`; `satuan_beli` tidak diubah
   (vendor lama tetap "dus"); `harga` tidak diubah (harga per satuan beli vendor tidak
   berubah). Setelah itu `turunkan_harga_master` berjalan seperti biasa; pratinjau harus
   menunjukkan harga master sebelum ≈ sesudah setara (Rp per Dus lama ÷ 2,592 = Rp per Kg).
   Bawang: 400.000 per Dus → 154.321 per Kg; katalog Marwan: dus, isi 2.592 gram.
9. **Log:** satu baris di `master_bahan_audit` (via audit trigger + alasan) dan satu
   ringkasan khusus (tabel baru `bahan_baku_ganti_satuan`: bahan, satuan lama/baru JSON,
   jembatan, k_kecil, k_besar, jumlah baris per tabel yang diubah, pelaku, alasan, waktu)
   — ditampilkan di tab Riwayat.

10. **Dokumen selesai (K2):** setiap kolom qty dikali faktor sesuai skalanya, setiap
    kolom harga per satuan dibagi faktor yang sama, sehingga `qty × harga` per baris tetap
    (toleransi pembulatan). Tabel: `surat_jalan_item` (qty_dikirim/qty_terima/…,
    harga_snapshot — satuan besar → `k_besar`), `purchase_order_item`,
    `permintaan_bahan_item`, `stok_waste_reports`, `retur_stok_item`,
    `mutasi_antar_outlet_item`, `terima_vendor_outlet`, `inbound_outbound`,
    `purchase_request`, `bahan_baku_sku` (bila kolomnya qty/isi). **Builder wajib
    mengaudit tiap kolom angka tabel-tabel ini dan skalanya** (besar vs kecil vs ledger)
    dari kode penulisnya, menuliskan tabel kolom→faktor di plan, dan mengujinya. Kolom
    total rupiah (bukan per satuan) tidak diubah. Trigger yang terpicu UPDATE di tabel-tabel
    ini (mis. `trg_sync_waste_ledger` yang menulis adjustment saat qty waste APPROVED
    berubah, trigger SJ status) **tidak boleh** menghasilkan baris ledger baru — matikan
    lewat bendera `app.ganti_satuan` di trigger itu atau ubah kolomnya dengan cara yang
    tak memicunya; diuji: jumlah baris ledger sebelum = sesudah + 0.

**Tidak diubah:** `bahan_baku_harga_history`, `bahan_baku_supplier_history` (jejak harga
apa adanya, diberi catatan di log ganti satuan), `opname_item.catatan` (ketikan asli crew
— K3).

### 4.3a Asersi ledger relatif (keputusan builder-check)
Asersi §4.3 butir 4 dibuat **relatif**: jumlah (outlet, bahan) yang saldo akhir ledger ≠
`stok_balance` dan jumlah putus rantai **tidak boleh bertambah** dibanding sebelum
konversi. Data yang sudah rusak sejak dulu tidak memblokir. Opname transisi: `qty_system`
mengikuti skala `saldo_sebelum` baris `opname_selisih` pasangannya, `qty_fisik` mengikuti
skala `saldo_sesudah` — jangan satu pengali per baris.

### 4.3b Batas tahap ini (keputusan builder-check)
Hanya mendukung bahan yang **lama dan baru sama-sama punya satuan kecil**. Bila salah satu
sisi tanpa satuan kecil → tolak dengan pesan jelas. Bawang putih bubuk lolos.

### 4.4 Layar (admin-dashboard, panel detail bahan `PanelBahan`/`SeksiSatuan`)
- Bahan **tanpa** riwayat stok: tetap seperti sekarang (edit langsung).
- Bahan **dengan** riwayat stok: isian satuan read-only + tombol **"Ganti Satuan"** →
  modal:
  1. Isian satuan baru (pakai komponen yang ada) + PO + distribusi + jembatan (kalimat) +
     alasan.
  2. Tombol "Lihat pratinjau" → RPC pratinjau (tanpa tulis): penghalang (bila ada,
     berhenti di sini dengan daftar dokumen), tabel saldo per lokasi lama → baru dalam
     format yang dibaca manusia (mis. "144 Sachet → 864 gram (0,864 Kg)"), jumlah baris
     ledger/opname/resep/katalog yang ikut diubah, harga master lama → baru.
  3. "Ganti satuan" (konfirmasi ketik nama bahan, karena tak bisa dibatalkan otomatis).
- Kalimat lama "fitur Ganti Satuan menyusul" dihapus.
- Setelah sukses: toast + ajakan "Tambah harga vendor baru" (buka `FormHargaVendor`) dan
  tautan nonaktifkan vendor lama.

### 4.4a Hitungan yang belum sampai server (keputusan builder-check)
Draft opname bisa hidup di localStorage app stok web (Session 2026-08-13) dan mungkin di
native superapp. Kolom baru `bahan_baku.satuan_diganti_at` diisi prosedur. App stok
(web, dan native bila menyimpan draft lokal — builder verifikasi) saat melanjutkan draft
lokal **membuang isian bahan yang `satuan_diganti_at` > waktu draft dibuat** dan
menampilkan pemberitahuan "Satuan X diganti, hitung ulang". Penjaga server tidak
ditambahkan: draft opname di server sudah menjadi penghalang Ganti Satuan; yang tersisa hanya
draft lokal web. App opname native (repo `SS SUPERAPP/SUPER-APPS-SS-MOBILE`) tidak perlu
diubah: draft HP & antrean finalisasi offline-nya selalu terikat ke draft server, dan metadata
satuan dibaca dari `monitoring_view_scoped` (cache memori 60 dtk).
⚠️ Perlu redeploy `stok`. Tidak perlu rilis APK.

### 4.5 Tambahan kecil: bagian Vendor di panel detail bahan
Owner menanyakan pilihan vendor di panel detail. Tambahkan seksi **Vendor** di
`PanelBahan`: daftar baris `bahan_baku_supplier` bahan itu (vendor, satuan beli, isi,
harga, status) + tombol "Tambah harga vendor" (buka `FormHargaVendor` yang ada) +
nonaktifkan (RPC `nonaktifkan_harga_vendor` yang ada). Hanya untuk `bolehUbahHarga`.

## 5. Batasan teknis
- RPC baru `pratinjau_ganti_satuan(p_bahan, p_baru jsonb, p_jembatan)` (SECURITY DEFINER,
  read-only) dan `ganti_satuan_bahan(p_bahan, p_baru jsonb, p_jembatan, p_alasan)`
  (SECURITY DEFINER, `SET search_path=public`, `_peran_master('data')`, REVOKE dari
  PUBLIC/anon). Satu sumber rumus faktor: pratinjau & eksekusi memakai fungsi pembantu
  yang sama.
- `ledger_stok` ada di publication realtime dan pernah deadlock dengan migration; UPDATE
  massal per bahan biasanya ratusan–ribuan baris (AYAM bisa puluhan ribu). Pasang
  `lock_timeout` + `statement_timeout` wajar; bahan dengan baris sangat banyak boleh
  ditolak dengan pesan jelas (ambang = builder's call, catat).
- Migration timestamp mengikuti lint (`scripts/migration-timestamp-lint.mjs`), cek
  timestamp kembar & `schema_migrations` sebelum memilih. Fungsi baru — tidak menimpa
  fungsi bertimestamp 2030.
- Satuan kecil "gram" + distribusi "Kg": invarian trigger sudah mengizinkan label `kg`
  untuk distribusi bila kecil = gram; untuk **satuan PO** label harus salah satu tingkat —
  dengan satuan besar = Kg, `satuan_po = 'Kg'` sah.
- Format tampilan saldo memakai `formatTriUnitSaldoAdaptive`/`compositeUnit.ts` yang ada.

## 6. Verifikasi
- Uji SQL di `supabase/verifikasi/ganti_satuan/` (transaksi + ROLLBACK, dengan kontrol
  negatif yang benar-benar gagal): penolakan tiap penghalang; konversi bahan contoh
  (fixture) dengan baris skala besar, transisi, dan kecil; asersi saldo akhir ledger =
  stok_balance; nilai persediaan (`nilai_persediaan_spv`) bahan itu sama sebelum/sesudah
  (toleransi pembulatan); resep ikut dikali; katalog vendor isi ikut dikali.
- **Uji kering pada BAWANG PUTIH BUBUK** di dalam transaksi + ROLLBACK, bandingkan dengan
  angka §1 (Sawangan 144 sachet → 864 g; BNR 0,1667 Dus → 0,432 Kg; harga 400.000/Dus →
  ±154.321/Kg) sebelum dijalankan sungguhan.
- admin-dashboard: test fungsi murni (turunan jembatan, format pratinjau), type-check,
  build.

## 7. Urutan go-live bawang putih bubuk (setelah fitur live)
1. Finalisasi/batalkan 4 draft opname yang memuat bahan ini.
2. Ganti satuan lewat tombol (Kg/gram, PO Kg, distribusi Kg, 1 sachet = 6 gram).
3. Nonaktifkan harga vendor Bapak Marwan.
4. Tambah supplier baru bila belum ada, isi harga vendor baru per Kg.
5. Sachet lama yang masih di outlet tetap dihitung crew dalam gram saat opname
   (1 sachet = 6 g) — beri tahu outlet.

## 8. Diserahkan ke builder
- Nama tabel/kolom log, tata letak modal, ambang jumlah baris ledger.
- Detail status "terbuka" tiap tabel dokumen (§4.2).
- Perlu tidaknya `bahan_baku_sku` (isi kemasan SKU) ikut dikali — verifikasi arti kolomnya.

## 9. Keputusan yang diambil Claude (cek saat membaca)
- K6 hak akses admin/owner/developer.
- Konfirmasi ketik nama bahan sebelum eksekusi.
- Tabel log baru `bahan_baku_ganti_satuan` + kolom `bahan_baku.satuan_diganti_at`.
- §4.3a asersi relatif, §4.3b tolak bahan tanpa satuan kecil, §4.4a buang draft lokal basi.
- Seksi Vendor di panel detail bahan (§4.5).
- Bahan dengan baris ledger sangat banyak boleh ditolak (ambang ditentukan builder).
