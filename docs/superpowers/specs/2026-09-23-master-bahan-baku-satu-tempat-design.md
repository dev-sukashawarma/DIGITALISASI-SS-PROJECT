# Master Bahan Baku — Satu Tempat

**Tanggal:** 2026-09-23
**Status:** Disetujui owner (sesi grilling 2026-09-23). Tahap 0 LIVE (8729fbe2). Tahap 1 (fondasi DB) LIVE — lihat plan 2026-09-23-master-bahan-baku-tahap1-fondasi-db.md.
**App utama:** `apps/admin-dashboard` (`/dashboard/bahan-baku`). Terdampak: stok, finance, portal.
**Terkait:** `2026-06-30-hpp-bahan-baku-master-harga-design.md` (asal `bahan_baku_harga`),
`2026-09-08-katalog-harga-vendor-design.md` (asal `bahan_baku_supplier`).

## 1. Masalah

Master bahan baku bisa ditulis dari **11 tempat di 5 app** + 3 fungsi DB, dengan aturan
berbeda-beda:

| Data | Penulis saat ini |
|---|---|
| Nama, satuan, SKU, gambar | admin `/dashboard/bahan-baku`, stok `/stok/harga-bahan`, **2 form publik tanpa login** (portal & admin, isinya sudah divergen) |
| Harga beli master | halaman master admin (tanpa riwayat), sinkron PO admin (tanpa riwayat), sinkron PO finance (**rusak**: `setHarga` tak dideklarasikan, file `@ts-nocheck`), sinkron stok, `verifikasi_terima_po`, `sahkan_nota_vendor` |
| Harga per vendor | admin `katalog-vendor` + otomatis dari PO |
| Supplier | admin **dan** finance (halaman disalin) |
| Batas minimum | `stok_ideal`/`threshold_*` di admin (**tidak dibaca apa pun**) vs `outlet_reorder_point` di stok + dashboard SPV |
| `faktor_konversi`, `kemasan_qty`, `faktor_po`, `is_active`, `default_reorder_point` | **tidak ada UI**, hanya SQL |

Bug aktif (diverifikasi ke DB live 2026-09-23):
1. `createBahanBakuAction` (admin & stok) dan `syncMasterPriceAction` menulis kolom
   `bahan_baku_harga.updated_at` yang **tidak ada** (kolomnya `harga_updated_at`). Galat
   tak diperiksa → bahan baru tersimpan **tanpa harga**. Bukti: GAS 12 KG (dibuat
   2026-09-23 09:05) punya 1 SKU, `harga_beli` NULL.
2. Edit harga manual di admin tak meninggalkan riwayat.
3. Sinkron harga PO di finance rusak.
4. Server action tambah bahan memakai service key **tanpa cek role**.
5. Form publik memakai token cadangan hardcoded bila `GUDANG_MAGIC_TOKEN` tak di-set.

## 2. Keputusan

### K1 — Hak akses
| Role | Hak |
|---|---|
| admin, owner | Semua: tambah, edit, nonaktifkan, satuan & faktor, harga, vendor |
| purchasing | Harga & vendor saja; nama/satuan hanya lihat |
| kitchen, spv, lainnya | Hanya lihat. Batas minimum **per outlet** tetap diatur di app stok (setelan operasional, bukan master) |

### K2 — Lokasi
Satu halaman `/dashboard/bahan-baku` di **admin-dashboard**, bertab: **Data Bahan · Harga ·
Vendor · Riwayat**. Menu dibuka untuk OWNER, ADMIN, PURCHASING; rute ditambahkan ke
allowlist PURCHASING di `components/layout/RoleContext.tsx`. Kitchen (tak bisa masuk
admin-dashboard) melihat lewat `/stok/harga-bahan` yang dijadikan **hanya-baca**.

### K3 — Jalur tulis lain
| Jalur | Nasib |
|---|---|
| Tambah bahan + sinkron harga di stok | Dicabut |
| Sinkron harga manual setelah PO (admin & finance) | Dicabut — `verifikasi_terima_po` sudah menanganinya dengan penjaga + riwayat |
| Halaman supplier finance | Dicabut, menu diarahkan ke halaman baru |
| Harga otomatis dari terima PO & sahkan nota | Tetap |
| Batas minimum per outlet (stok & SPV) | Tetap |
| 2 form publik `/public/form-bahan-baku` | **Dihapus.** Rotasi `GUDANG_MAGIC_TOKEN` di Coolify bila nilainya sama dengan fallback di kode (sudah ada di riwayat git repo publik) |

### K4 — Satuan & faktor
Invarian yang sudah berlaku (`docs/MASTER-SATUAN-PO-DAN-DISTRIBUSI.md`, migration
`20300120000000`, `20260915236000`) kini ditegakkan server, bukan tangan:
- **Satu input:** satuan besar / tengah / kecil + isi per tingkat. Server menurunkan
  `faktor_tampilan`, `faktor_konversi` (= `faktor_tampilan ÷ faktor_tengah`, atau sama bila
  tanpa tengah), `kemasan_qty` (= `faktor_tampilan`), `faktor_po` (trigger yang ada).
- **Label PO & distribusi** dipilih dari dropdown tingkat yang ada — `getDistribusiFactor()`
  diam-diam jatuh ke 1 bila label tak cocok (kelas bug 48× FOIL).
- **Bahan tanpa riwayat stok:** bebas diubah.
- **Bahan dengan riwayat stok:** tombol **Ganti Satuan**, ditolak bila ada: SJ draft/dikirim,
  PO terbuka, permintaan terbuka, draft opname, **atau baris `stok_balance` skala besar
  (`NOT saldo_is_gram`) yang tidak nol** di lokasi mana pun (per 2026-09-23: 520 baris skala
  besar, 93 tak nol). Bila lolos: harga per satuan besar disesuaikan agar harga per satuan
  kecil tetap; urutan faktor dulu, baru harga; tercatat di log.
- **Satuan kecil dikunci** di UI (itu migrasi data, bukan edit).
- **Sekali jalan:** rapikan 5 bahan yang melanggar invarian (HAND GLOVE, KERTAS STRUK,
  GALON AIR, KETUMBAR, GAS 12 KG); tulis ulang `docs/MASTER-SATUAN-PO-DAN-DISTRIBUSI.md`
  (basi: harga FOIL, SAOS SAMYANG, klaim saldo "selalu" satuan kecil).

### K5 — Harga: diketik per vendor, master diturunkan
Pemakai harga master di DB (16 fungsi/view; yang **hanya** membaca master): nilai persediaan,
4 fungsi nilai waste, `get_hpp_periode`, estimasi nilai permintaan, dan tier cadangan
HPP Dinamis / `fill_harga_snapshot`. Surat jalan sejak 12 Sep sudah memakai harga vendor
(602/657 baris ber-vendor).

- **Harga hanya diketik per vendor** (tab Vendor, `bahan_baku_supplier`); PO & nota tetap
  mengisi ke sini.
- **Harga master tidak bisa diketik.** Sistem menghitungnya = harga vendor **terpercaya**
  (`harga > 0`, `perlu_ditinjau = false`, aktif) yang paling baru diperbarui, dikonversi ke
  satuan besar. Sesuai keputusan owner 2026-09-08 "harga terakhir".
- `bahan_baku_harga` tetap ada, **hanya ditulis sistem** → 16 pemakai tak diubah.
- Vendor khusus **"Beli Tunai / Tanpa Vendor"** untuk bahan tanpa vendor / beli tunai.
- Edit harga vendor manual: wajib alasan, lewat penjaga rasio-faktor yang sama dengan jalur
  PO, selalu tercatat riwayat.
- Tab Harga menampilkan asal harga (PO/nota/manual + tanggal + oleh siapa).

### K6 — Peralihan (pilihan B)
25 bahan aktif belum punya harga vendor terpercaya (7 tanpa vendor, 18 `perlu_ditinjau`).
Harga master mereka **dibekukan** di nilai sekarang, ditandai "belum dikonfirmasi vendor",
dan muncul di **daftar kerja** tab Vendor. Begitu purchasing mengisi harga vendor
terpercaya, master otomatis mengikuti. Tak ada harga yang mendadak jadi nol.

### K7 — Hapus / nonaktif / gabung
| Aksi | Syarat | Efek |
|---|---|---|
| Hapus | Nol referensi di mana pun (ledger, resep, SJ, PO, opname, permintaan, waste, katalog) | Hapus beneran |
| Nonaktifkan | Ditolak bila masih di resep aktif (`trg_process_bom_stok` tak menyaring `is_active`), di dokumen berjalan, atau saldo ≠ 0 di lokasi mana pun | Hilang dari form baru, riwayat utuh |
| Gabungkan | **Tidak dibangun.** Tetap lewat migration yang direview | — |

### K8 — Batas minimum
- Tab Data Bahan menulis **`default_reorder_point`** (yang benar-benar dibaca
  `monitoring_view_spv/crew` & `trigger_stok_minimum_push_notification`), dalam satuan besar.
- UI `stok_ideal`/`threshold_type`/`threshold_persentase` **dibuang** (tak dibaca apa pun);
  kolom di-drop belakangan.
- Penimpa per outlet tetap di stok; tab hanya menampilkan jumlah outlet ber-batas khusus + tautan.
- Hapus kode mati: `admin-dashboard/src/hooks/useOutletThresholds.ts`
  (`useOutletThresholdMutations` menulis `reorder_point: 0`) dan
  `dashboard/kitchen/threshold/ThresholdTable.tsx` (tanpa `page.tsx`).

### K9 — Peruntukan & ikut opname
Kolom `peruntukan` & `is_opname` **sudah ada di DB live** (21 outlet / 6 gudang / 21
keduanya; 2 aktif non-opname) tetapi migration `20300235000000_…` untracked & tak
terstempel. Diambil alih (izin owner):
1. Migration dirapikan (timestamp wajar, idempoten — kolom sudah ada), di-commit, distempel.
2. Tab Data Bahan mengedit keduanya (admin/owner).
3. App stok membaca flag ini menggantikan tebakan berdasarkan nama (`opnameScope.ts`,
   badge sumber). Sebelum diganti: bandingkan hasil lama vs baru per bahan per lokasi.

### K10 — Penegakan
1. Semua tulis master lewat **fungsi DB `SECURITY DEFINER`**, satu per aksi, cek role di
   dalamnya dengan membaca `outlet_staff` langsung (**jangan** `is_finance()` /
   `can_manage_po()` — keduanya selalu true).
2. Cabut INSERT/UPDATE/DELETE langsung dari `authenticated`/`anon` pada `bahan_baku`,
   `bahan_baku_sku`, `bahan_baku_harga`, `bahan_baku_supplier`, `supplier` — **setelah**
   semua layar pindah (Tahap 2) dan penyisiran ulang app.
3. **Satu log perubahan master**: siapa, kapan, field, lama → baru, alasan. Tampil di tab Riwayat.
4. Uji per role dengan simulasi `request.jwt.claims` + `SET LOCAL ROLE authenticated` dalam
   transaksi + ROLLBACK, termasuk kontrol negatif (crew & kitchen ditolak).

## 3. Tahapan

| Tahap | Isi |
|---|---|
| **0 — Tambalan darurat** | Fix `updated_at` → `harga_updated_at` (admin & stok create, stok sync) + periksa galatnya · isi harga GAS 12 KG · hapus 2 form publik · hapus sinkron harga PO manual (admin & finance) |
| **1 — Fondasi DB** | Fungsi tulis ber-cek role · log perubahan · harga master turunan + pembekuan B · penegak invarian faktor · rapikan 5 bahan · migration peruntukan/opname · belum cabut tulis langsung |
| **2 — Halaman satu tempat** | Halaman bertab + daftar kerja 25 bahan · nav & allowlist · stok hanya-baca · cabut halaman supplier finance · buang kode mati · **lalu** cabut tulis langsung |
| **3 — Paling berisiko** | Tombol Ganti Satuan · stok membaca flag peruntukan/opname (dengan perbandingan) · tulis ulang dokumen satuan MASTER |

Redeploy sepanjang jalan: admin-dashboard, stok, finance, portal.

## 4. Di luar cakupan
- Penggabungan bahan (K7).
- Pemecahan FOIL per ukuran (menunggu keputusan beli Altindo lagi).
- Form PO memakai `faktor_po` (backlog terpisah).
- Normalisasi SABUN / SEDOTAN / TUTUP PACK (pertanyaan terbuka owner).
