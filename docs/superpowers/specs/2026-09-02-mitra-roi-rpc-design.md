# Sub-proyek 0,5 — Perhitungan ROI/BEP Mitra Pindah ke Database

**Tanggal:** 2026-09-02
**Status:** Disetujui untuk dilanjutkan ke rencana implementasi
**Menyentuh:** `supabase/migrations` (fungsi baru), `apps/admin-dashboard` (satu berkas)
**Memblokir:** sub-proyek 1 (layar "Dashboard Saya" mitra di Android)

## Latar

Aplikasi Android mitra (sub-proyek 1) perlu menampilkan ROI dan status BEP. Perhitungan itu hari ini hidup sebagai TypeScript di `apps/admin-dashboard/src/app/actions/mitraRoi.ts`, sehingga Android tidak bisa memakainya — beda bahasa, beda aplikasi. Membiarkannya berarti menulis salinan kedua aturan bagi hasil di Kotlin.

Dua salinan aturan uang di dua bahasa akan berbeda begitu salah satunya diperbarui, dan perbedaannya tidak muncul sebagai galat — ia muncul sebagai mitra bertanya kenapa angka di HP berbeda dari di laptop. Karena itu perhitungannya dipindahkan ke satu fungsi di database yang dipanggil web maupun Android.

Dikerjakan terpisah dari sub-proyek 1 karena memindahkan perhitungan web berarti mengubah angka bagi hasil yang dilihat 9 mitra yang sedang memakai portal hari ini. Momen itu layak punya gerbang verifikasinya sendiri.

## Temuan yang mendasari desain

Semua diverifikasi langsung ke DB produksi (`khpkoreaaucvyqfhynfq`).

### 1. Bagian terberat sudah ada di database

`get_mitra_orders_summary(p_outlet_ids uuid[], p_from timestamp, p_to timestamp)` sudah ada dan mengembalikan `gross_revenue`, `deductions`, `cogs` per outlet. Jalur TypeScript yang menarik seluruh order sejak 1 Agustus lalu menghitung ulang HPP dari nol hanyalah **fallback** bila RPC itu gagal.

Artinya perhitungan terberat — HPP per channel, penguraian menu paket, pengali 1,10 khusus outlet mitra — tidak perlu disentuh sama sekali.

### 2. Web sudah punya dua implementasi di dalam dirinya sendiri

Jalur fallback itu dapat menghasilkan angka berbeda dari jalur RPC, dan menyala tanpa pemberitahuan. Mitra tidak punya cara mengetahui mana yang menghasilkan angka di layarnya. Ini bukan risiko teoretis di masa depan — ia ada sekarang.

### 3. Ada dua definisi "modal sudah kembali" yang saling bertentangan

Dalam satu fungsi yang sama:

| Dipakai untuk | Rumus |
|---|---|
| Menentukan kapan bagi hasil jadi 50:50 | omzet historis + transfer historis + **transfer tercatat di sistem** |
| Menampilkan ROI & status BEP di kartu | omzet historis + transfer historis + **bagi hasil periode berjalan** |

Seorang mitra bisa melihat kartunya menyatakan "BEP 100%" sementara aturan bagi hasilnya masih menganggapnya belum balik modal. Selama ini tidak ketahuan karena keduanya berjarak ~40 baris dalam satu berkas.

Keduanya bukan salah — mereka menjawab pertanyaan berbeda: *"berapa yang sudah saya terima"* versus *"berapa yang sudah jadi hak saya"*.

### 4. Semua tabel sudah bisa dibaca mitra untuk outletnya sendiri

| Tabel | Jalur akses mitra |
|---|---|
| `orders` | `orders_select_scoped` via `accessible_outlet_ids()` |
| `expenses` | `expenses_select_scoped` via `accessible_outlet_ids()` |
| `petty_cash_expenses` | `petty_cash_expenses_select` via `outlet_staff.outlet_id` |
| `mitra_investments`, `mitra_transfers`, `mitra_profiles` | policy `_select_own` |

`accessible_outlet_ids()` sudah menangani role `mitra`. Tidak ada perubahan RLS yang dibutuhkan.

### 5. `get_waste_periode` menyaring lewat identitas pemanggil

Fungsi itu memakai `accessible_outlet_ids()` di dalamnya. Dipanggil tanpa konteks pengguna — misalnya oleh skrip service-role — ia mengembalikan **nol baris, bukan galat**. Ada 287 laporan waste `APPROVED` di database (terbaru 1 September) yang tak terlihat sama sekali dari jalur itu.

Ini menetapkan satu batasan metodologis: **patokan verifikasi tidak boleh diambil dari skrip service-role.** Konsekuensi lebih luas, di luar cakupan sub-proyek ini: puluhan skrip `check_*.js` di root repo berpola sama dan akan diam-diam mendapat hasil kosong dari fungsi ber-scope mana pun.

## Keputusan

**Basis BEP untuk aturan 50:50 adalah kas** — omzet historis + transfer historis + transfer tercatat di sistem. Mitra dianggap balik modal setelah uangnya benar-benar berpindah, bukan saat labanya baru tercatat sebagai hak.

**Kartu ROI menampilkan dua angka**, bukan memilih salah satu:

- **"Sudah diterima"** (utama) — basis kas, sama dengan basis aturan 50:50
- **"Sudah jadi hak"** (pendamping) — termasuk bagi hasil yang belum ditransfer

Selisih keduanya adalah informasi berharga tersendiri: jumlah yang menunggu ditransfer ke mitra.

**Web ikut pindah ke fungsi baru.** Kalau web tetap memakai TypeScript-nya, kita justru punya dua implementasi di dua bahasa — persis yang hendak dihindari.

## Desain

### Fungsi `get_mitra_roi(p_outlet_ids, p_from, p_to)`

Mengembalikan satu baris per outlet:

| Kelompok | Kolom |
|---|---|
| Investasi | `modal_investasi`, `omzet_historis`, `transfer_historis`, `transfer_sistem` |
| Komponen laba | `omzet`, `deduksi`, `cogs`, `opex`, `waste`, `management_fee`, `laba_bersih` |
| Bagi hasil | `persentase`, `bagi_hasil_mitra` |
| Hasil (kas) | `dana_kembali_kas`, `roi_kas_pct`, `bep_kas_pct`, `is_bep`, `sisa_modal` |
| Hasil (hak) | `dana_kembali_hak`, `roi_hak_pct` |

Dua kolom yang mudah tertukar, jadi ditegaskan di sini: `persentase` adalah persentase bagi hasil **setelah** aturan 50:50 diterapkan, bukan nilai mentah dari `mitra_investments`. `bep_kas_pct` adalah `roi_kas_pct` yang dibatasi maksimum 100 dan dibulatkan satu desimal — dipakai untuk bilah kemajuan; `roi_kas_pct` sendiri tidak dibatasi, sehingga Cibinong tetap tampil 162,9%.

**Berjalan sebagai pemanggil (`SECURITY INVOKER`), bukan sebagai pemilik database.** Keputusan sengaja: karena setiap tabel sudah punya aturan akses yang benar (temuan 4), mitra yang memanggil fungsi ini otomatis hanya mendapat outlet miliknya — walau ia mengirim daftar outlet orang lain sebagai parameter. Alternatifnya mengharuskan kita menulis sendiri pemeriksaan hak akses di dalam fungsi, dan proyek ini sudah pernah kebobolan persis di pola itu (empat Server Action `apps/stok` memakai service-role tanpa memeriksa role sama sekali; lihat memori `server-action-authz-gap`).

Efek samping yang disengaja: `get_waste_periode` yang dipanggil di dalamnya juga berjalan dengan identitas pengguna, sehingga waste ikut terhitung dengan benar untuk mitra.

**Memanggil ulang yang sudah ada, bukan menyalinnya.** Omzet, deduksi, dan COGS tetap dari `get_mitra_orders_summary`; waste tetap dari `get_waste_periode`. Fungsi baru hanya menambahkan lapisan aturan bisnis. Perhitungan HPP tidak disentuh, jadi tidak ada peluang ia bergeser.

**Tanggal mulai jadi parameter** dengan nilai bawaan `2026-08-01 00:00 WIB` — sekarang tertanam sebagai konstanta di kode web. Menjadikannya parameter membuat periode lain bisa diuji tanpa mengubah kode, dan menegaskan bahwa tanggal itu sebuah keputusan, bukan konstanta ajaib.

### Perubahan di web

`getMitraRoiStats` menjadi pemanggil tipis fungsi baru. `getMitraRealtimeBepBreakdown` — sekitar 200 baris penarik order dan penghitung ulang HPP — dihapus.

**Bentuk data yang dikembalikan dipertahankan**, ditambah dua field baru untuk angka "sudah jadi hak". Ketiga pemakainya tidak perlu diubah selain menampilkan angka pendamping:

- `app/dashboard/mitra/page.tsx`
- `app/dashboard/mitra/MitraDashboardView.tsx`
- `app/dashboard/owner/kelola-mitra/page.tsx` — halaman milik owner, bukan mitra

**Jalur fallback dihapus.** Setelah perpindahan, kegagalan fungsi database tampil sebagai galat yang jujur, bukan angka lain yang menyamar sebagai angka benar. Ini pengurangan ketahanan yang disengaja: fallback yang diam-diam mengubah cara hitung lebih berbahaya daripada halaman yang berterus terang gagal.

Setelah merge, `admin-dashboard` wajib di-redeploy di Coolify.

### Gerbang verifikasi

Dipecah dua karena satu ukuran tidak cocok untuk keduanya.

**Komponen perhitungan** — omzet, deduksi, COGS, opex, waste, management fee, laba bersih, bagi hasil — wajib **sama persis** dengan produksi, per outlet. Tidak ada perubahan perilaku yang disengaja di sini, jadi selisih apa pun berarti bug dan pekerjaan berhenti sampai sebabnya ditemukan.

**ROI dan status BEP** memang **sengaja berubah**. Gerbangnya bukan kesamaan, melainkan: tunjukkan sebelum-sesudah untuk kesembilan outlet, setiap selisih harus bisa dijelaskan sebagai "bagi hasil yang belum ditransfer", dan pemilik produk menyetujuinya secara eksplisit sebelum web diganti.

**Patokan diambil dari layar produksi, bukan dari skrip.** Karena temuan 5, patokan waste dan komponen lain diambil dari halaman `/dashboard/owner/kelola-mitra` yang berjalan sebagai pengguna sungguhan. Skrip pembanding sekali pakai boleh dipakai untuk mempercepat, tetapi keluarannya harus divalidasi ke layar lebih dulu sebelum dijadikan patokan.

### Patokan awal (waste BELUM termasuk)

Diambil 2026-09-02 dengan service role, jadi angka waste kosong dan laba bersih di sini **terlalu besar**. Dipakai sebagai indikasi arah, bukan patokan final.

| Outlet | Omzet | Laba bersih* | ROI "hak" | ROI "kas" | Selisih |
|---|---:|---:|---:|---:|---:|
| Cibinong | 215,0 jt | 39,6 jt | 168,8% | 162,9% | −5,9 |
| Cibubur | 248,9 jt | 28,2 jt | 39,1% | 28,3% | −10,8 |
| Cicurug | 233,8 jt | 40,2 jt | 32,2% | 12,6% | −19,6 |
| Cileungsi | 395,9 jt | 49,9 jt | 33,3% | 0,0% | −33,3 |
| Ciseeng | 86,9 jt | 14,5 jt | 28,1% | 24,0% | −4,1 |
| Kalisari | 69,3 jt | 12,1 jt | 25,4% | 22,0% | −3,4 |
| Paledang | 123,9 jt | 16,5 jt | 27,0% | 22,3% | −4,8 |
| Pekayon | 86,4 jt | 17,2 jt | 36,3% | 32,8% | −3,5 |
| Sentul | 115,1 jt | 21,0 jt | 44,4% | 46,3% | **+1,9** |

Delapan turun, satu naik. Sentul naik karena transfer yang sudah dibayarkan (24,9 jt) melebihi bagi hasil periode berjalan (21,0 jt) — sekaligus menyingkap bahwa definisi lama membandingkan periode tak setara: bagi hasil hanya dihitung sejak 1 Agustus, sementara transfer mencakup seluruh riwayat.

**Tidak ada outlet yang berubah status BEP-nya.** Hanya Cibinong yang sudah melewati modal, dan ia melewatinya jauh (162,9%) dengan definisi mana pun. Delapan sisanya masih jauh di bawah modal. Aturan 50:50 tidak akan menyala atau padam untuk siapa pun akibat perubahan ini.

**Cileungsi bukan data yang bermasalah.** Order pertamanya 8 Agustus 2026, tanggal mulai investasi 10 Agustus — memang tidak ada riwayat sebelum sistem berjalan, dan nol transfer berarti mitranya belum pernah menerima pembayaran. Dalam 3,5 minggu outlet ini beromzet paling besar di antara semua mitra. Angka 0,0% benar secara faktual, dan justru itulah alasan kartu menampilkan dua angka.

## Pengujian

Aturan bisnis berada di SQL, jadi diuji lewat perbandingan terhadap patokan produksi per outlet, bukan unit test bahasa pemrograman. Yang wajib dibuktikan:

1. Kesembilan outlet: setiap komponen perhitungan identik dengan patokan layar.
2. Mitra yang memanggil fungsi dengan `p_outlet_ids` berisi outlet milik orang lain hanya menerima barisnya sendiri.
3. Outlet tanpa baris `mitra_investments` tidak membuat fungsi gagal.
4. Modal investasi bernilai nol tidak menghasilkan pembagian dengan nol.
5. Laba bersih negatif menghasilkan bagi hasil nol, bukan angka negatif.

## Di luar cakupan

- Layar Android "Dashboard Saya" — sub-proyek 1, memakai fungsi ini.
- Memperbaiki puluhan skrip `check_*.js` yang diam-diam mendapat hasil kosong dari fungsi ber-scope (temuan 5).
- F5/F6/F7 dari spec sub-proyek 0 — tetap prasyarat sub-proyek 1, bukan sub-proyek ini.
