# Wizard Penutupan Outlet — Design

**Tanggal:** 13 Nov 2026 · **Status:** draf, menunggu persetujuan owner
**Terkait:** `docs/SOP-PENUTUPAN-OUTLET.md`, Wizard Pembukaan Outlet
(`docs/superpowers/specs/2026-11-13-wizard-pembukaan-outlet-design.md`).

## 1. Kenapa

Penutupan outlet selama ini hanya berupa mengubah status jadi nonaktif. Semua
pekerjaan sesudahnya bergantung pada ingatan orang, dan terbukti bocor. Contoh
SAWANGAN (INTERNAL), yang berganti jadi Mitra Sawangan DTC sekitar 25 Sep:

- Stok Rp 26,1 jt di 4 outlet tutup tetap tercatat di nilai persediaan
  sampai 13 Nov.
- 3 outlet tutup masih tampil di aplikasi pelanggan.
- Pesanan website & GoFood terus masuk ke outlet tutup sampai 8 Nov.
- Tanggal tutup tercatat 8 Nov (dari pesanan nyasar), bukan ±25 Sep.

Outlet sering tutup **mendadak**. Linimasa H-7 di SOP hanya panduan, dan
sistem tidak boleh menghalangi penutupan.

## 2. Tujuan, bukan tujuan, anti-tujuan

**Tujuan**
- Outlet bisa ditutup kapan saja dengan satu tombol, mencatat **tanggal
  terakhir jualan yang sebenarnya** beserta alasannya.
- Langkah yang aman dan bisa dibalik dijalankan otomatis saat tombol ditekan.
- Sesudah tutup, ada **papan Penutupan**: checklist pembersihan yang dibaca
  langsung dari data, dengan penanggung jawab dan tautan ke tempat
  mengerjakannya, sampai outlet bisa ditandai **"Penutupan selesai"**.
- Outlet yang sudah telanjur tutup (Sawangan Internal, Sukmajaya, Ciseeng,
  Jatiasih) ikut tampil di papan.

**Bukan tujuan**
- Aturan "outlet tampil sampai akhir bulan tutup" di semua app. Ini proyek
  terpisah yang memakai `nonaktif_at` yang dihasilkan wizard ini.
- Menutup merchant GoFood/Grab/Shopee/TikTok GO lewat API. Itu dikerjakan
  manual di portal masing-masing dan hanya dicentang di checklist.
- Mengubah perhitungan ROI/bagi hasil mitra.

**Anti-tujuan** (gagal walau "jalan")
- Penutupan terhalang karena checklist belum selesai.
- Wizard menolkan stok atau memindahkan crew **secara otomatis**. Itu
  keputusan manusia (stok bisa dimutasi, crew bisa dipindah ke mana saja).
- Bulan yang sudah closing ikut berubah angkanya.
- Outlet atau datanya dihapus.

## 3. Pendekatan

| | Pendekatan | Keputusan |
|---|---|---|
| A | **Tutup dulu, beres-beres sesudahnya**: nonaktif langsung, lalu papan checklist sampai "selesai" | **Dipilih owner** |
| B | Checklist dulu, tombol Tutup baru terbuka setelah semua selesai (cermin Wizard Pembukaan) | Ditolak: tidak cocok untuk tutup mendadak, orang akan selalu memaksa |
| C | Tanpa wizard, hanya pengingat bot/grup saat outlet nonaktif | Ditolak: tidak ada tempat melihat apa yang belum beres |

## 4. Alur

```
Halaman Outlet ── [Tutup Outlet] ──► Modal:
                                      - Tanggal terakhir jualan (default hari ini, boleh mundur)
                                      - Alasan (wajib, min 10 karakter)
                                      - Ketik nama outlet untuk konfirmasi
                                     │
                                     ▼
                         RPC tutup_outlet() — satu transaksi:
                           status=inactive, is_active=false,
                           nonaktif_at = tanggal terakhir jualan 23:59 WIB,
                           app_enabled=false, promo outlet dimatikan,
                           catat log 'ditutup'
                         + server action: sinkron Order Online is_active=false
                                     │
                                     ▼
                     Papan Penutupan /dashboard/penutupan-outlet/[id]
                     checklist hidup dari data ─► semua wajib hijau
                                     │
                                     ▼
                     [Tandai Penutupan Selesai] → penutupan_selesai_at
```

Daftar `/dashboard/penutupan-outlet` berisi outlet nonaktif yang penutupannya
belum selesai. Navigasinya mengikuti pola tab di menu Outlet (Semua Outlet ·
Persiapan · **Penutupan**).

## 5. Checklist (satu sumber: RPC `status_penutupan_outlet(p_outlet_id)`)

Polanya sama dengan `status_persiapan_outlet`: JSON berisi daftar langkah
`{kunci, label, penanggung_jawab, wajib, selesai, info, tautan}`.

| Kunci | Langkah | PJ | Wajib | Selesai bila |
|---|---|---|---|---|
| `crew` | Crew dipindah / dinonaktifkan | HR | ya | 0 `outlet_staff` aktif ber-`outlet_id` ini |
| `penugasan` | Penugasan AM & leader ditutup | HR | ya | 0 `am_outlet_assignments` berlaku sesudah tanggal tutup; 0 `staff_outlets` leader aktif |
| `order` | Tidak ada pesanan menggantung | AM | ya | 0 order status selain completed/cancelled yang dibuat dalam 30 hari sebelum `nonaktif_at` atau sesudahnya. Pesanan macet yang lebih tua hanya ditampilkan di `info`. |
| `pesanan_nyasar` | Pesanan masuk sesudah tanggal tutup | Admin | **tidak (peringatan)** | 0 order `created_at` > `nonaktif_at`. `info` menampilkan jumlah, kanal (`sales_source`), dan bulannya, supaya ketahuan kanal mana yang belum dimatikan. Pesanannya tidak diubah; pemindahan ke outlet pengganti (bulan belum closing) dikerjakan developer. |
| `sj` | Surat jalan beres | Kitchen | ya | 0 SJ ke outlet ini berstatus `draft`/`dikirim`; 0 mutasi stok dari/ke outlet menggantung |
| `stok` | Sisa stok dikosongkan | Admin | ya | `sum(abs(saldo)) = 0` di `stok_balance` (info: jumlah bahan + nilai Rp dari `nilai_persediaan_spv`). Diselesaikan dengan tombol **"Nolkan sisa stok"** di papan (lihat §6). |
| `kas_kecil` | Kas kecil bersih | Finance | ya | 0 top-up / pengajuan kas kecil berstatus menunggu |
| `kanal_online` | Aplikasi & Order Online mati | Admin | ya | `app_enabled = false` (otomatis); Order Online dicek manual (centang) |
| `merchant_ojol` | Merchant GoFood/Grab/Shopee/TikTok GO ditutup | Marcom | ya | **centang manual** |
| `aset` | Aset (freezer, printer, tablet) dipindah | AM | tidak | **centang manual** |
| `biaya_rutin` | Biaya rutin (sewa, PLN, internet) dihentikan | Finance | tidak | **centang manual** |
| `mitra` (mitra saja) | Bagi hasil bulan terakhir ditransfer | Owner / Finance | ya | **centang manual** |

**Centang manual** disimpan di tabel `outlet_penutupan_centang (outlet_id,
kunci, oleh, at, catatan)`, ditulis lewat RPC. Centang boleh dibatalkan.

"Tandai Penutupan Selesai" baru aktif bila semua langkah wajib selesai, tanpa
opsi paksa. Penutupan sudah terjadi, yang ditandai hanya kebersihan datanya.

## 6. Data & penjaga

- Kolom baru `outlets`: `alasan_tutup text`, `ditutup_by uuid`,
  `penutupan_selesai_at timestamptz`, `penutupan_selesai_by uuid`.
  `nonaktif_at` (sudah ada) diisi RPC dengan tanggal terakhir jualan.
  ⚠️ Trigger `trg_outlets_catat_nonaktif` (`20261113190000`) menimpa
  `nonaktif_at := now()` saat transisi ke nonaktif. Trigger ini perlu
  menghormati nilai yang diberikan RPC (misalnya lewat GUC
  `app.penutupan_outlet`, pola sama dengan `app.pembukaan_outlet`).
- RPC `koreksi_tanggal_tutup(p_outlet_id, p_tanggal, p_alasan)`: untuk outlet
  lama (mis. Sawangan ±25 Sep), tercatat di log.
- Log: tabel `outlet_pembukaan_log` dipakai bersama; CHECK `aksi` ditambah
  `'ditutup'`, `'penutupan_selesai'`, `'tanggal_tutup_dikoreksi'`,
  `'dibuka_kembali'`, `'stok_dinolkan'`, `'centang'`.
- **Penjaga status (dua arah):** pada outlet internal/mitra, transisi
  `active → inactive` hanya lewat `tutup_outlet`, dan `inactive → active`
  hanya lewat `buka_kembali_outlet` (keduanya memakai GUC
  `app.penutupan_outlet`). Polanya sama dengan `trg_zz_outlets_jaga_persiapan`.
  Penulis lain **ditahan diam-diam** (status tetap), tidak ditolak. Alasannya,
  `saveGlobalConfig` di app absensi (`apps/absensi/src/app/dashboard/pengaturan/actions.ts`)
  menulis `is_active` ke semua baris outlet sekaligus: kalau ditolak, simpan
  pengaturan absensi gagal total; kalau dibiarkan, semua outlet tutup bisa
  hidup kembali dan `nonaktif_at` terhapus. Tombol nonaktif lama di halaman
  Outlet dan POS Admin dialihkan ke modal Tutup Outlet, sehingga jalur yang
  dipakai orang tidak pernah tertahan tanpa sebab.
- **Nolkan sisa stok:** RPC `nolkan_sisa_stok_outlet(p_outlet_id, p_alasan)`
  (admin/developer, hanya untuk outlet yang sudah ditutup) menulis ledger
  `adjustment = -saldo` untuk setiap baris `stok_balance` ≠ 0. Polanya sama
  dengan skrip `SS COGS SET/penutupan-outlet-nolkan-stok-dan-pindah-pesanan-2026-11-13.sql`:
  alert stok dimatikan lewat GUC `app.ganti_satuan`, dan tidak pernah
  `UPDATE stok_balance` langsung. Modal menampilkan jumlah bahan + nilai Rp
  sebelum dikonfirmasi; nilai itu dicatat di log (`aksi='stok_dinolkan'`).
  Barang yang masih layak dipindah lewat Mutasi Stok **sebelum** tutup
  (SOP), bukan lewat tombol ini.
- **Mitra:** `tutup_outlet` memendekkan `rab_outlet_otomatis.berlaku_sampai`
  menjadi paling lambat tanggal tutup. Akun mitra (`mitra_profiles`) dan
  `mitra_investments` **tidak disentuh**: investor tetap bisa melihat laporan
  bulan terakhir, dan ROI/bagi hasil di luar lingkup.
- **Buka kembali** (salah tutup): RPC `buka_kembali_outlet` (admin/developer,
  alasan wajib) mengembalikan status aktif, mengosongkan kolom penutupan,
  dan mencatat log. `app_enabled` & promo **tidak** dinyalakan otomatis.
- Peran: tutup/buka kembali/tandai selesai/koreksi tanggal =
  admin/developer (sama dengan Go-Live). Baca papan = admin/owner/developer.
  Centang manual = admin/owner/developer + admin_finance (langkah Finance).
  Server action memakai **klien sesi**, bukan service role, karena RPC
  memeriksa `auth.uid()`.

## 7. Backfill

Papan menampilkan outlet yang `alasan_tutup IS NOT NULL` dan
`penutupan_selesai_at IS NULL`. Migration **menstempel sekali** empat outlet
yang sudah tutup: Sawangan Internal, Sukmajaya, Ciseeng, dan Jatiasih.
Stempelnya `alasan_tutup = '(ditutup sebelum wizard)'` + baris log `ditutup`.
Daftarnya tidak dihitung ulang, supaya outlet tidak hilang dari papan sebelum
beres. Stok keempatnya sudah 0 (dinolkan 13 Nov). Outlet nonaktif yang lebih
lama tidak ditampilkan.

## 8. Keputusan

**Owner (13 Nov 2026):**
- Pendekatan A (tutup dulu, beres-beres sesudahnya).
- Ada tombol "Nolkan sisa stok" di papan.
- Pesanan sesudah tanggal tutup cukup jadi peringatan.

**Dibuat penulis spec (koreksi bila tidak setuju):**
- Penjaga status dua arah dan menahan diam-diam (§6), karena ada penulis
  massal di app absensi.
- Langkah `order` hanya menghitung 30 hari sebelum tutup ke depan, supaya
  pesanan macet lama tidak mengunci status "selesai" selamanya.
- Backfill distempel sekali oleh migration, bukan dihitung ulang tiap hari.
- Akun & investasi mitra dibiarkan; masa RAB dipendekkan ke tanggal tutup.
- "Tandai selesai" tanpa opsi paksa.

## 9. Yang diserahkan ke builder

- Tata letak papan & modal (ikuti komponen papan Wizard Pembukaan).
- Sumber angka "kas kecil menunggu" (pakai yang dipakai Hub Approval).
- Cara mengecek mutasi stok menggantung (tabel mutasi app Stok).
- Uji SQL di `supabase/verifikasi/penutupan_outlet/` dengan kontrol negatif,
  mengikuti pola `pembukaan_outlet`.
- Penomoran migration: cek `schema_migrations` hari itu dan hindari bentrok.
