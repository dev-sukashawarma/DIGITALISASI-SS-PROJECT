# Waste Dashboard Komprehensif + Laporan Per-Insiden

**Tanggal:** 2026-09-07
**App:** `apps/admin-dashboard`
**Halaman:** `/dashboard/owner/waste` ("Kerugian Waste")
**Akses:** owner/admin saja — tidak berubah dari sekarang

---

## 1. Masalah

Halaman waste sekarang (169 baris, `src/app/dashboard/owner/waste/page.tsx`) punya dua kekurangan.

**Angka tidak bisa dibandingkan antar-outlet.** Semua metrik disajikan dalam rupiah mentah. Outlet beromzet besar otomatis terlihat paling boros, padahal bisa jadi rasionya paling sehat. Tidak ada normalisasi terhadap omzet, dan tidak ada pembanding terhadap periode sebelumnya, sehingga tidak terjawab pertanyaan paling dasar: membaik atau memburuk?

**Tidak ada jejak per-insiden.** Tabel "Rincian Waste" memakai `get_waste_breakdown`, yang mengagregasi baris menjadi `(outlet, bahan, alasan, tanggal)`. Dua insiden berbeda pada hari yang sama melebur jadi satu baris, dan identitas laporannya hilang. RPC itu tidak pernah menyeleksi `id`, `reported_by`, `approved_by`, maupun `photo_url` — padahal `stok_waste_reports` menyimpan keempatnya sejak `20260709050000`. Akibatnya pertanyaan "siapa yang melapor, siapa yang menyetujui, mana foto buktinya" tidak terjawab di halaman ini.

## 2. Batasan yang membentuk desain

**Cap 1.000 baris PostgREST.** Hasil RPC ikut terpotong di 1.000 baris tanpa error. Satu bulan waste di 19 outlet berpotensi melewatinya, dan total yang terpotong lebih berbahaya daripada tidak ada total sama sekali karena angkanya tetap terlihat masuk akal. Konsekuensi: agregat dan baris insiden **wajib** datang dari query berbeda dengan bentuk berbeda — agregat di-*roll up* di server, insiden di-paginasi di server.

**Skala satuan belum seragam.** `ledger_stok.qty` tersimpan dalam gram-scale atau besar-scale tergantung `saldo_is_gram` outlet, sedangkan `stok_waste_reports.qty` selalu satuan besar. Membandingkan keduanya secara langsung akan memicu alarm palsu di lebih dari separuh baris.

**Basis harga kanonik (sejak 2026-09-03).** `harga_beli` = harga per satuan besar; `kemasan_qty` = faktor penuh; harga per satuan kecil = `harga_beli / kemasan_qty`.

## 3. Lapisan data

### 3.1 RPC baru: `get_waste_summary_v2(p_from date, p_to date)`

Agregat, hasil kecil dan terbatas — satu baris per `(outlet_id, bahan_baku_id, reason, tanggal)`. Menjadi sumber tunggal untuk seluruh tile, chart, dan ranking. Isinya sama dengan `get_waste_breakdown` sekarang, ditambah perbaikan valuasi di §3.3.

Kolom: `outlet_id, outlet_name, bahan_baku_id, bahan_nama, reason, tanggal, qty, qty_kecil, satuan_kecil, hpp_kecil, nilai, jumlah_insiden`.

`jumlah_insiden` adalah `COUNT(*)` laporan dalam grup — dibutuhkan tile "Jumlah Insiden" tanpa harus menarik baris insiden.

### 3.2 RPC baru: `get_waste_incidents(p_from date, p_to date, p_outlet_id uuid, p_limit int, p_offset int)`

Satu baris per laporan waste. Paginasi di server: `p_limit` default 25, dibatasi keras maksimum 100. Mengembalikan `total_count` (via window function `COUNT(*) OVER ()`) supaya UI bisa menampilkan jumlah halaman yang jujur.

Kolom baru yang belum pernah ada di halaman ini:

| Kolom | Sumber | Guna |
|---|---|---|
| `id` | `stok_waste_reports.id` | identitas laporan |
| `photo_url` | kolom yang sudah ada | foto bukti |
| `reporter_name` | `outlet_staff!reported_by` | siapa melapor |
| `approver_name` | `outlet_staff!approved_by` | siapa menyetujui |
| `created_at` | kolom yang sudah ada | waktu lapor |
| `updated_at` | di-set trigger approval | waktu approve *de facto* |
| `ledger_row_count` | `COUNT` baris `ledger_stok` dengan `ref_waste_id = w.id` | lihat §5.3 |

`rejection_reason` **tidak** disertakan: kedua RPC menyaring `status = 'APPROVED'`, sehingga kolom itu selalu null di sini. Baris yang ditolak adalah urusan tab History `apps/manager`.

`p_outlet_id` NULL berarti semua outlet yang boleh diakses.

### 3.3 Perbaikan valuasi `hpp_kecil`

Rumus sekarang membagi dengan `faktor_konversi`. Sejak normalisasi 2026-09-03 kolom itu hanya porsi tengah→kecil, bukan faktor penuh. Untuk bahan tiga tingkat seperti KEJU, kolom "HPP / satuan" yang tampil jadi meleset sebesar faktor tengah.

Pembagi diperbaiki mengikuti pola `get_hpp_periode` (`20300122000002`):

Faktor penuh memakai ekspresi kanonik yang **sudah ada** di repo — persis sama dengan `20300120000001`, `trg_process_bom_stok` (`20300108000005`), dan `to_ledger_scale()`:

```sql
-- faktor_penuh (kecil per besar)
GREATEST(
  COALESCE(
    CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
         THEN b.faktor_tampilan
         ELSE b.faktor_konversi
    END,
    1
  ),
  1
)
```

Pembagi `hpp_kecil` menjadi:

```sql
COALESCE(bh.harga_beli, 0) / COALESCE(NULLIF(bh.kemasan_qty, 0), <faktor_penuh>)
```

Yaitu: pakai `kemasan_qty`; bila kosong atau nol, jatuh ke faktor penuh. Karena faktor penuh dibungkus `GREATEST(..., 1)`, pembagi tidak pernah nol.

**Perbaikan ini tidak menggeser satu rupiah pun di total mana pun.** `nilai = qty × harga_beli` sudah benar di bawah basis kanonik dan tidak disentuh. Yang berubah hanya kolom tampilan per-satuan.

### 3.4 Keamanan

Kedua RPC `SECURITY DEFINER SET search_path = public`, dijaga `is_owner_or_admin()` persis seperti `get_waste_breakdown` sekarang, dan menyaring `status = 'APPROVED'` serta `outlet_id IN (SELECT public.accessible_outlet_ids())`.

Tidak ada perubahan RLS, tidak ada perubahan policy, tidak ada role baru yang menjangkau data ini.

### 3.5 Yang sengaja tidak diubah

- **`get_waste_periode`** — menyuplai halaman Profit dan Expenses. Mengubahnya akan menggeser Laba Bersih, termasuk Laba Bersih mitra.
- **`get_waste_breakdown`** — dibiarkan utuh supaya konsumen di luar halaman ini tidak patah. Halaman ini berpindah ke RPC baru.
- **Kolom `approved_at`** — tidak ditambahkan. `updated_at` di-set oleh trigger approval dan sudah memadai; kolom baru berarti backfill riwayat yang tidak bisa diketahui.

## 4. Dashboard

Prinsip penyusunan: **tiap blok menjawab tepat satu pertanyaan.**

### 4.1 Baris 1 — KPI, empat tile

| Tile | Menjawab |
|---|---|
| **Total Kerugian Waste** — Rp, dengan Δ% vs periode sebelumnya | Membaik atau memburuk? |
| **Waste % Omzet** | Besar tidak, relatif terhadap penjualan? |
| **Gap vs Alokasi BOM** — Gap % sebagai nilai, `Rp aktual vs Rp alokasi` di sub-baris | Sudah lewat dari yang dianggarkan resep? |
| **Jumlah Insiden** — jumlah, plus rata-rata per outlet | Banyak kerugian kecil, atau satu kerugian besar? |

"Periode sebelumnya" didefinisikan sebagai jendela **sama panjang yang persis mendahului** rentang filter. Ini panggilan kedua ke `get_waste_summary_v2` — hasil agregat, kecil, aman.

Omzet diambil dari hook `useSalesSummary` yang sudah ada. Nilai Budget Loss (rupiah) tetap ditampilkan, hanya pindah ke sub-baris tile Gap agar baris tetap empat.

### 4.2 Baris 2 — Tren Waktu

`WasteTrendChart` yang sudah ada, tidak berubah.

### 4.3 Baris 3 — dua kolom

**Ranking per Outlet.** Tabel yang sudah ada ditambah kolom **% Omzet**, dan bisa diurutkan menurut kolom mana pun. Rupiah saja membuat outlet besar selalu tampak bersalah; % omzet adalah pembanding yang adil. Disembunyikan saat filter outlet spesifik, sama seperti sekarang.

**Breakdown per Alasan.** Lima kategori tetap dari `WasteModal.tsx` (Basi/Expired · Jatuh/Tumpah · Gosong/Rusak Masak · Kualitas Buruk dari supplier · Lainnya) sebagai bar horizontal dengan rupiah dan porsi. `Kualitas Buruk (dari supplier)` diberi penekanan visual: kategori itu uang yang berpeluang diklaim ke supplier, bukan diserap sendiri.

### 4.4 Baris 4 — Ranking Bahan Baku (baru)

Bahan penyumbang rupiah terbesar, masing-masing dengan **sebaran outlet**: berapa outlet melaporkan bahan itu pada periode tersebut. Satu outlet berarti masalah lokal (penyimpanan, satu shift ceroboh). Lima belas outlet berarti sistemik: porsi resep salah, atau batch supplier jelek. Pembedaan yang sama, penanganan yang sama sekali berbeda.

Tidak menambah query — hanya pengelompokan ulang baris yang sudah ditarik.

## 5. Laporan per-insiden

Menggantikan tabel "Rincian Waste" yang sekarang.

### 5.1 Tabel Rincian Insiden

Kolom: `Tanggal · Outlet · Bahan Baku · Qty · Alasan · Pelapor · Penyetuju · Nilai · 📷`

Paginasi 25 per halaman ke server dengan jumlah total yang jujur. Kolom Outlet disembunyikan saat filter outlet spesifik. Kolom 📷 menandakan ada atau tidaknya foto bukti — **ikon yang redup itu sendiri sebuah temuan**, karena waste yang di-approve tanpa foto berarti persetujuan diberikan tanpa bukti.

Klik baris membuka modal detail.

### 5.2 Modal detail satu insiden

- **Foto bukti** ukuran besar. Bucket `waste_evidence` sudah publik (`20260709050000`), jadi tidak perlu signed URL. Bila `photo_url` null, tampilkan status "Tidak ada foto bukti" secara eksplisit.
- **Angka**: qty dalam satuan besar dan satuan kecil, HPP per satuan (dengan perbaikan §3.3), nilai rupiah.
- **Jejak waktu**: dilaporkan oleh *X* pada *[waktu]* → disetujui oleh *Y* pada *[waktu]*, beserta jeda di antaranya. Jeda tiga minggu bercerita lain daripada jeda tiga menit.
- **Status potongan stok**, dengan batasan di §5.3.

### 5.3 Pemeriksaan potongan stok — dan batasnya yang disengaja

Migration `20300120000002` mendokumentasikan empat laporan Agustus 2026 yang berstatus APPROVED namun **tidak menghasilkan satu pun baris `ledger_stok`** — laporan rupiah tetap menghitungnya, stoknya tidak pernah berkurang. Modal detail memunculkan tepat kasus itu lewat `ledger_row_count`.

**Yang dilaporkan adalah keberadaan, bukan kecocokan.** Tampilan hanya dua kemungkinan:

- `Potongan stok tercatat (N baris ledger)`
- `⚠️ Tidak ada baris ledger — stok tidak pernah terpotong`

Tidak ada klaim bahwa qty-nya cocok atau tidak cocok. Alasannya ada di §2: skala ledger bergantung `saldo_is_gram`, qty laporan selalu satuan besar, dan perbandingan langsung akan memicu alarm palsu di lebih dari separuh baris. Keberadaan bersifat bebas-skala dan tetap menangkap seluruh kelas bug yang jadi alasan migration itu ditulis. Rekonsiliasi kuantitas yang sesungguhnya adalah proyek tersendiri dan tidak diselundupkan ke sini.

## 6. Struktur kode

`page.tsx` akan jauh melewati 500 baris bila semuanya inline, jadi ia menjadi composition root tipis di atas komponen terekstrak:

```
src/app/dashboard/owner/waste/page.tsx      composition root
src/components/waste/WasteKpiRow.tsx
src/components/waste/WasteOutletRanking.tsx
src/components/waste/WasteReasonBreakdown.tsx
src/components/waste/WasteBahanRanking.tsx
src/components/waste/WasteIncidentTable.tsx
src/components/waste/WasteIncidentDetailModal.tsx
src/hooks/useWasteSummary.ts                get_waste_summary_v2
src/hooks/useWasteIncidents.ts              get_waste_incidents, paginated
src/lib/wasteMetrics.ts                     fungsi murni, ditulis test-first
```

`lib/wasteBreakdown.ts` dan `lib/wasteGap.ts` yang sudah ada dipertahankan dan dipakai ulang.

Seluruh aritmetika tinggal di fungsi murni di `wasteMetrics.ts` dan mendapat unit test, ditulis lebih dulu sesuai alur TDD proyek: `computeDelta` (vs periode sebelumnya), `computeWastePctOmzet`, `aggregateByReason`, `aggregateByBahanWithOutletSpread`, `computeIncidentPageCount`.

**Disiplin pembagian nol:** outlet dengan omzet nol pada periode itu mengembalikan `null` dan dirender `N/A` — tidak pernah `Infinity`, tidak pernah `0%` palsu. Mengikuti persis konvensi `computeWasteGap` yang sudah ada.

## 7. Di luar lingkup

- **Export Excel/CSV dan PDF.** Mudah ditambahkan nanti (`xlsx`, `papaparse`, `jspdf`, `jspdf-autotable` sudah terpasang di app ini), tapi tidak dibangun sekarang.
- **Metrik kedisiplinan pelaporan** (rasio tolak, outlet nol lapor, pelapor paling aktif). Butuh baris non-APPROVED yang sengaja disaring keluar oleh kedua RPC.
- **Rekonsiliasi kuantitas ledger** — lihat §5.3.
- **Perubahan `apps/manager` `/waste`.** Tab Pending dan History di sana tetap jadi permukaan approval untuk area manager dan leader. Halaman ini adalah pandangan strategis owner/admin lintas-outlet, bukan penggantinya.

## 8. Verifikasi

- `yarn type-check` bersih untuk berkas yang disentuh.
- Unit test `wasteMetrics.ts` hijau (ditulis lebih dulu).
- `yarn build` sukses, route `/dashboard/owner/waste` muncul.
- Migration diverifikasi *ground-truth* ke DB live lewat `pg_get_functiondef` dan `prosecdef`, **bukan** lewat status `supabase migration list` — riwayat migration di DB bersama ini terbukti berubah karena aktivitas dev lain.
- Uji penerimaan valuasi: pilih satu bahan tiga tingkat (mis. KEJU) dan pastikan kolom "HPP / satuan" berubah sementara kolom "Nilai" dan Total tidak bergeser sama sekali.

## 9. Deploy

Perlu **redeploy `admin-dashboard`** setelah merge. Migration di-apply terpisah, dan karena riwayat remote sering diverged oleh dev lain, apply langsung lalu stempel `migration repair --status applied` bila `db push` terhalang — sesuai kebiasaan proyek.
