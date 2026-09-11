# Saldo per Vendor di Gudang Pusat + Pilih Vendor di Surat Jalan

**Tanggal:** 2026-09-11 · **Status:** desain disetujui owner per bagian, belum dibangun
**Asal:** keputusan "jalan tengah" 10 Sep (kitchen memilih vendor saat menyiapkan kiriman,
surat jalan menyimpan vendor + harganya) — disetujui tapi tak pernah dibangun.

## 1. Masalah

Sistem tidak tahu vendor mana yang dikirim ke outlet. `surat_jalan_item` hanya punya
`harga_snapshot` (diisi `fill_harga_snapshot` dari **harga master**), tanpa vendor.
Akibatnya:
- Keluhan mutu ("daging alot tgl 3") tak bisa ditelusuri ke vendor.
- Biaya bahan per outlet memakai harga master, bukan harga vendor yang benar-benar dikirim.
- Stok Gudang Pusat hanya satu angka per bahan; "Altindo kosong, Ekadharma 928 roll"
  cuma diketahui dari hitungan fisik, bukan sistem.

## 2. Keputusan owner (jangan dibuka ulang tanpa alasan baru)

| # | Keputusan |
|---|---|
| K1 | Bahan dengan **satu** vendor: vendor terisi otomatis, kitchen tak memilih. |
| K2 | Bahan multi-vendor: kitchen **wajib** memilih vendor yang **sisanya cukup** — blokir, bukan peringatan. |
| K3 | Sisa per vendor dicatat di **buku terpisah** (pendekatan A), `ledger_stok` tidak diubah strukturnya. |
| K4 | Pak Aziz Tempo 10/15/30 = **satu vendor** untuk gudang. Termin tetap berlaku untuk PO/utang. |
| K5 | Satu bahan **boleh dipecah ke dua vendor** dalam satu surat jalan (mis. 3 Djafafood + 2 Pak Aziz). |
| K6 | Titik awal = hitung fisik per vendor sekali; opname gudang bahan multi-vendor seterusnya **per vendor**. |
| K7 | Katalog AYAM–Dunia Plastik Depok **salah** → dinonaktifkan. Pak Aziz memang mengirim SAPI. |

Tetap berlaku dari keputusan sebelumnya: vendor adalah atribut pembelian, bukan identitas
barang — stok outlet **tidak** dipisah per vendor; hanya isi kemasan berbeda yang memaksa
bahan dipecah (memori `vendor-bukan-identitas-barang`).

## 3. Fakta sistem (diverifikasi 2026-09-11)

- Surat jalan dibuat lewat dua jalur: `approve_permintaan_svc(p_permintaan_id, p_items)` →
  `create_surat_jalan(p_outlet_id, p_items)` (layar `ApprovalModal.tsx`, app stok), dan form
  manual `SuratJalanForm.tsx` (app distribusi, INSERT langsung ke `surat_jalan_item`).
- Stok Gudang Pusat (`d23e11b3-23f1-4f9a-b428-cc73e1aa9b90`) dipotong trigger
  `sj_on_dikirim_kurangi_kitchen` saat status → `dikirim` (`transfer_keluar`, skala
  `to_ledger_scale`).
- `surat_jalan_item` punya UNIQUE `(surat_jalan_id, bahan_baku_id)`; 0 baris ganda historis.
- `finalize_surat_jalan_and_ledger`, `verify_surat_jalan_item`, `auto_verifikasi_surat_jalan`
  bekerja **per id baris**, bukan per bahan — memecah bahan jadi beberapa baris aman bagi
  penulis stok outlet.
- Opname Gudang Pusat terakhir: **31 Agustus 2026**.
- `ledger_stok` ada di publication `supabase_realtime`; DDL di sana pernah deadlock
  (2026-09-11) → wajib `lock_timeout` + ulang.
- Hanya Pak Aziz yang satu usaha tercatat di beberapa baris supplier.

**Bahan multi-vendor (14, setelah K7):** BAWANG · FOIL · JINTEN · KENTANG · KETUMBAR ·
KUNYIT · MAYONAISE · MINYAK · PLASTIK MERAH · PLASTIK VACUUM JUMBO · POLYBAG · SAOS SAMYANG ·
SAOS TOMAT POUCH · SAPI (Djafafood + grup Pak Aziz). AYAM keluar dari daftar: setelah
Dunia Plastik dinonaktifkan tinggal satu vendor (Meyer Proteindo). Daftar pasti dihitung
ulang dari katalog saat implementasi, bukan disalin dari sini.

## 4. Desain

### 4.1 Data

1. **`supplier.vendor_induk_id uuid NULL REFERENCES supplier(id)`** — NULL = induk bagi dirinya.
   Pak Aziz Tempo 15 & 30 → Tempo 10. Kunci vendor = `COALESCE(vendor_induk_id, id)`.
2. **`stok_vendor_gudang_mutasi`** — `id, bahan_baku_id, vendor_id` (induk), `qty numeric`
   (bertanda, **skala stok Gudang Pusat** = `to_ledger_scale(gudang, bahan, qty_besar)`),
   `sumber` ∈ {`po`, `sj_kirim`, `sj_batal`, `hitung_fisik`, `koreksi`}, rujukan
   (`ref_ledger_id`, `ref_surat_jalan_item_id`, `ref_opname_item_id`), `catatan`
   (wajib untuk `koreksi`), `dibuat_oleh`, `created_at`.
   Unique parsial per rujukan per sumber → satu PO/baris SJ/baris opname = satu mutasi.
   RLS: SELECT untuk kitchen/purchasing/admin/owner; tulis hanya lewat trigger/RPC.
3. **View `stok_vendor_gudang`** (`security_invoker = true`) — sisa per (bahan, vendor) +
   nama vendor + `aktif` (= bahan itu sudah punya mutasi `hitung_fisik`).
4. **`surat_jalan_item.vendor_id uuid NULL`** (vendor induk). UNIQUE lama diganti UNIQUE
   `(surat_jalan_id, bahan_baku_id, vendor_id) NULLS NOT DISTINCT` — baris lama (vendor NULL)
   tetap satu per bahan.
5. **Harga snapshot**: `fill_harga_snapshot` memakai harga katalog vendor
   (`bahan_baku_supplier.harga` > 0 dari baris supplier dalam grup vendor itu, termuda) bila
   `vendor_id` terisi; selain itu harga master seperti sekarang.
6. **Cakupan buku vendor**: hanya bahan dengan ≥2 vendor induk aktif di katalog. Bahan satu
   vendor: `vendor_id` terisi otomatis, tanpa mutasi, tanpa penjaga.

### 4.2 Penulis mutasi

| Sumber | Pemicu | Catatan |
|---|---|---|
| `po` | AFTER INSERT `ledger_stok` untuk `tipe='pembelian_supplier'`, `ref_po_id` terisi, outlet = Gudang Pusat | Vendor = induk dari `purchase_order.supplier_id`. Trigger dipasang terpisah dengan `lock_timeout` + ulang. `verifikasi_terima_po` tidak disentuh. |
| `sj_kirim` | Saat SJ → `dikirim` (dalam/berdampingan `sj_on_dikirim_kurangi_kitchen`) | Per baris ber-`vendor_id` bahan multi-vendor. |
| `sj_batal` | Hanya bila ada jalur pembatalan SJ terkirim yang mengembalikan stok gudang — **diperiksa di plan**; bila tak ada, sumber ini dibuang. | |
| `hitung_fisik` | Finalisasi opname Gudang Pusat | qty = hitungan − sisa sistem saat itu (idempoten). |
| `koreksi` | RPC khusus kitchen/admin | Catatan wajib. |

### 4.3 Alur kitchen

- **`ApprovalModal`** (jalur utama): tiap bahan multi-vendor menampilkan vendor + sisanya.
  Satu vendor cukup → pilih satu. Tak ada yang cukup → "+ pecah vendor", jumlah pecahan harus
  = qty disetujui. Vendor bersisa 0 tak bisa dipilih. Bahan satu vendor: teks saja.
  "Setujui" terkunci sampai semua bahan multi-vendor lengkap & pas.
- **`SuratJalanForm`** (distribusi): pemilih yang sama, fungsi logika bersama.
- `p_items` `approve_permintaan_svc`/`create_surat_jalan` menerima `vendor_id` per baris dan
  boleh memuat bahan yang sama lebih dari sekali (beda vendor).

### 4.4 Penjaga

1. **UI** — vendor tanpa sisa tak bisa dipilih (kenyamanan).
2. **DB saat → `dikirim`** — untuk bahan multi-vendor yang `aktif`: qty baris (skala gudang)
   ≤ sisa vendor, else tolak dengan pesan terbaca ("Sisa SAPI Djafafood tinggal 1 Blok, surat
   jalan butuh 3"). Bahan multi-vendor tanpa `vendor_id` ditolak (baris baru wajib vendor).
   Bahan belum `aktif` → vendor wajib, tanpa blokir sisa.
3. Draft **tidak memesan** sisa (sengaja).
4. Penjaga stok total yang ada (anti-minus `transfer_keluar`) tetap berlaku.

### 4.5 Opname Gudang Pusat per vendor

- Hanya saat outlet = Gudang Pusat: bahan multi-vendor tampil dengan sub-baris per vendor;
  total = jumlah sub-baris (tak bisa diketik) → masuk opname seperti biasa (`opname_selisih`,
  gerbang turun-drastis tak berubah).
- Semua sub-baris diisi atau semua kosong (= dilewati). Sebagian terisi ditolak.
- Finalisasi menulis `hitung_fisik` per vendor. Opname pertama setelah live = titik awal.

### 4.6 Selisih wajar

Waste/penyesuaian/opname-selisih gudang mengurangi total tapi tidak sisa vendor → Σ sisa
vendor bisa > total di antara dua opname. Tidak bisa membuat gudang minus (penjaga total).
Pemantau menandai bahan dengan selisih besar sebagai "hitung ulang".

## 5. Bersih-bersih data

- Nonaktifkan `bahan_baku_supplier` AYAM–Dunia Plastik Depok (bukan DELETE).
- `vendor_induk_id` Pak Aziz Tempo 15 & 30 → Tempo 10.
- SJ lama: `vendor_id` NULL, tanpa isi mundur.

## 6. Pengujian

- **SQL** (BEGIN…ROLLBACK, sebagai kitchen asli, kontrol negatif tiap blok): (1) PO gudang →
  satu mutasi `po` vendor benar; (2) SJ pecah 3+2 → 2 baris, 2 `sj_kirim`, harga per vendor;
  (3) kirim > sisa ditolak, bahan belum aktif tidak; (4) bahan satu vendor otomatis, nol
  mutasi; (5) opname per vendor → `hitung_fisik` tepat, idempoten, sebagian-terisi ditolak;
  (6) stok total, potongan BOM, SJ lama tak berubah.
- **TS**: fungsi murni validasi pembagian vendor.
- **Login sungguhan** di outlet tes sebelum diumumkan.

## 7. Operasional go-live

1. Deploy (migration + redeploy `stok` & `distribusi`).
2. Satu sesi hitung fisik per vendor di Gudang Pusat untuk bahan multi-vendor.
3. Umumkan ke kitchen: vendor wajib dipilih saat menyetujui permintaan.

## 8. Di luar cakupan

Pelacakan lot sampai porsi shawarma · stok outlet per vendor · pengisian vendor mundur untuk
SJ lama · pemecahan FOIL per ukuran (tetap spec `2026-09-09-foil-dua-ukuran-design.md`).
