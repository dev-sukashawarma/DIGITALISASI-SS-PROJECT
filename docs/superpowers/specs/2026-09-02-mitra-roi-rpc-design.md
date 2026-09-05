# Sub-proyek 0,5 — Perhitungan ROI/BEP Mitra Pindah ke Database

**Tanggal:** 2026-09-02 · **Direvisi:** 2026-09-05
**Status:** Disetujui untuk dilanjutkan ke rencana implementasi

> **Revisi 2026-09-05.** Antara penulisan dan revisi ini, PR #45/#49/#50 mendarat di `main` dan mengubah dasar spec: mesin kebijakan bagi hasil baru dengan cutoff 1 September (temuan 6), definisi omzet kotor yang diseragamkan lintas dashboard, signature `get_mitra_orders_summary` berubah ke `timestamptz`, dan tiga helper HPP pindah ke database. Arah dan keputusan tidak berubah — yang diperbarui dasarnya. Masalah inti (dua definisi "modal sudah kembali" yang bertentangan) **masih ada dan taruhannya membesar**.
**Menyentuh:** `supabase/migrations` (fungsi baru), `apps/admin-dashboard` (satu berkas)
**Memblokir:** sub-proyek 1 (layar "Dashboard Saya" mitra di Android)

## Latar

Aplikasi Android mitra (sub-proyek 1) perlu menampilkan ROI dan status BEP. Perhitungan itu hari ini hidup sebagai TypeScript di `apps/admin-dashboard/src/app/actions/mitraRoi.ts`, sehingga Android tidak bisa memakainya — beda bahasa, beda aplikasi. Membiarkannya berarti menulis salinan kedua aturan bagi hasil di Kotlin.

Dua salinan aturan uang di dua bahasa akan berbeda begitu salah satunya diperbarui, dan perbedaannya tidak muncul sebagai galat — ia muncul sebagai mitra bertanya kenapa angka di HP berbeda dari di laptop. Karena itu perhitungannya dipindahkan ke satu fungsi di database yang dipanggil web maupun Android.

Dikerjakan terpisah dari sub-proyek 1 karena menyentuh app yang sedang dipakai 9 mitra hari ini, dan yang dipertaruhkan adalah angka bagi hasil mereka. Perpindahan ini dirancang **tidak mengubah satu angka pun** — justru itulah yang harus dibuktikan, dan pembuktian semacam itu layak jadi gerbang tersendiri alih-alih langkah tengah dalam pekerjaan membangun layar Android.

## Temuan yang mendasari desain

Semua diverifikasi langsung ke DB produksi (`khpkoreaaucvyqfhynfq`).

### 1. Bagian terberat sudah ada di database

`get_mitra_orders_summary(p_outlet_ids uuid[], p_from timestamptz, p_to timestamptz)` sudah ada dan mengembalikan `gross_revenue`, `deductions`, `cogs` per outlet. Jalur TypeScript yang menarik seluruh order sejak 1 Agustus lalu menghitung ulang HPP dari nol hanyalah **fallback** bila RPC itu gagal.

Artinya perhitungan terberat — HPP per channel, penguraian menu paket, pengali 1,10 khusus outlet mitra — tidak perlu disentuh sama sekali.

**Diperbarui 2026-09-05:** perhitungan HPP kini juga sudah pindah ke database sebagai tiga fungsi — `get_mitra_item_hpp`, `get_mitra_item_hpp_base`, dan `get_mitra_item_hpp_by_name`. Fungsi `getItemHpp` TypeScript di `mitraRoi.ts` karena itu bukan lagi sekadar jalur cadangan, melainkan **duplikat dari fungsi database yang sudah ada** — alasan menghapusnya jadi lebih kuat, bukan lebih lemah.

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

### 6. Mesin kebijakan baru dengan cutoff 1 September 2026 (ditemukan 2026-09-05)

`apps/admin-dashboard/src/lib/mitraPolicy.ts` (berkas baru) memindahkan penentuan persentase dari kolom per-outlet ke aturan berbasis status BEP:

| Periode | Belum BEP | Sudah BEP |
|---|---|---|
| Sejak 2026-09-01 | bagi hasil **100%**, management fee **3%** | bagi hasil **50:50**, management fee **0%** |
| Sebelum 2026-09-01 | persentase & fee historis per outlet | persentase & fee historis per outlet |

Dua konsekuensi untuk sub-proyek ini:

**Fungsi database wajib mereproduksi aturan ini, termasuk cutoff tanggalnya.** Kalau tidak, ia akan menghitung periode September ke atas dengan persentase historis dan hasilnya salah untuk semua mitra.

**Taruhan pertentangan dua definisi BEP (temuan 3) membesar.** Sekarang `isBepAlready` (basis kas, `mitraRoi.ts:245`) yang menyetir mesin kebijakan, sementara `isBep` (basis hak, `mitraRoi.ts:320`) yang tampil di kartu. Dulu ketidaksepakatan keduanya hanya menggeser persentase bagi hasil; kini ia juga menentukan mitra dikenai management fee 3% atau dibebaskan. Seorang mitra bisa melihat kartunya menyatakan sudah balik modal sambil tetap dipotong fee 3%, atau sebaliknya.

## Keputusan

**Basis "modal sudah kembali" adalah bagian mitra dari laba** — omzet historis + transfer historis + (laba bersih × persentase bagi hasil). Dipakai untuk kartu ROI **dan** untuk aturan 50:50, sehingga dua definisi yang selama ini bertentangan (temuan 3) menyatu menjadi satu.

Ini definisi yang **sudah dipakai kartu ROI hari ini**. Yang berubah hanyalah aturan 50:50 ikut memakainya — sebelumnya aturan itu memakai basis kas.

Konsekuensinya besar dan menguntungkan: **tidak ada satu angka pun yang berubah di mata mitra.** Diverifikasi ulang terhadap data **2026-09-05**: status BEP kesembilan outlet tetap sama di kedua basis — Cibinong melewati modal di keduanya (169,0% hak, 162,9% kas), delapan lainnya tertinggi 34,9%, jauh dari ambang. Baik aturan 50:50 **maupun pembebasan management fee 3%** (temuan 6) tidak berpindah untuk siapa pun.

Perlu dicatat bahwa sejak temuan 6, keputusan basis ini menentukan lebih banyak daripada saat pertama diambil: ia kini juga menentukan apakah seorang mitra dikenai management fee 3% atau dibebaskan. Kesimpulan "tidak ada yang berubah" tetap berlaku hari ini, tetapi jarak ke ambang wajib diperiksa ulang tepat sebelum implementasi — outlet yang mendekati 100% akan membuat pilihan basis ini punya konsekuensi rupiah langsung.

Alternatif yang ditolak: **basis kas** (historis + transfer nyata). Lebih konservatif — mitra baru dianggap balik modal setelah uangnya benar-benar diterima — tetapi mengubah angka yang dilihat 9 mitra, paling tajam di Cileungsi (33,3% → 0,0%). Ditolak karena manfaatnya tidak sepadan dengan mengubah angka yang sudah berjalan. Konsekuensi yang diterima secara sadar: seorang mitra bisa dinyatakan balik modal, dan bagi hasilnya turun jadi 50:50, sebelum seluruh uangnya benar-benar dia terima.

Alternatif yang juga ditolak: **laba bersih penuh** tanpa dikalikan persentase. Menaikkan ROI empat outlet ber-bagi-hasil 50–60% (Cibinong jadi 184,7%, Pekayon 39,4%) dan mengubah angka yang berjalan.

**Kartu ROI menampilkan dua angka**, bukan memilih salah satu:

- **"Sudah jadi hak"** (utama) — basis di atas, sama dengan basis aturan 50:50
- **"Sudah diterima"** (pendamping) — hanya uang yang benar-benar sudah ditransfer

Angka pendamping ini tambahan murni; ia tidak mengubah apa pun yang sudah ada. Nilainya justru pada selisihnya: Cileungsi tampil berhak atas 33,3% sementara transfernya masih nol rupiah — jumlah yang menunggu dibayarkan, yang selama ini tidak terlihat di mana pun.

**Web ikut pindah ke fungsi baru.** Kalau web tetap memakai TypeScript-nya, kita justru punya dua implementasi di dua bahasa — persis yang hendak dihindari.

## Desain

### Fungsi `get_mitra_roi(p_outlet_ids, p_from, p_to)`

Mengembalikan satu baris per outlet:

| Kelompok | Kolom |
|---|---|
| Investasi | `modal_investasi`, `omzet_historis`, `transfer_historis`, `transfer_sistem` |
| Komponen laba | `omzet`, `deduksi`, `cogs`, `opex`, `waste`, `management_fee`, `laba_bersih` |
| Bagi hasil | `persentase`, `bagi_hasil_mitra` |
| Hasil — utama | `dana_kembali`, `roi_pct`, `bep_pct`, `is_bep`, `sisa_modal` |
| Hasil — pendamping | `sudah_diterima`, `roi_diterima_pct` |

Kolom utama memakai basis "bagian mitra dari laba" dan **inilah yang menentukan aturan 50:50** serta yang tampil sebagai angka besar di kartu. Kolom pendamping memakai basis transfer nyata; ia hanya ditampilkan, tidak memengaruhi perhitungan apa pun.

**Mesin kebijakan ikut pindah ke fungsi ini** (temuan 6). Untuk periode yang mulai pada atau sesudah `2026-09-01`, `persentase` dan `management_fee` **tidak** dibaca dari `mitra_investments` melainkan diturunkan dari `is_bep`: belum BEP → 100% dan fee 3%; sudah BEP → 50% dan fee 0%. Untuk periode sebelumnya, keduanya tetap dari kolom historis per outlet. Tanggal cutoff jadi konstanta bernama di dalam fungsi, sejajar dengan `MITRA_POLICY_SEPTEMBER_2026_CUTOFF` di `mitraPolicy.ts`.

Menaruh kebijakan di sini adalah inti tujuan sub-proyek: begitu Android ikut memanggil fungsi ini, aturan cutoff dan tarif fee tidak perlu ditulis ulang di Kotlin. `mitraPolicy.ts` boleh tetap ada untuk keperluan label UI (`statusLabel`), tetapi angka yang menentukan uang berasal dari satu tempat.

Tiga hal yang mudah tertukar, ditegaskan di sini:

- `persentase` adalah persentase bagi hasil **setelah** aturan 50:50 diterapkan, bukan nilai mentah dari `mitra_investments`.
- `bep_pct` adalah `roi_pct` yang dibatasi maksimum 100 dan dibulatkan satu desimal, untuk bilah kemajuan. `roi_pct` sendiri tidak dibatasi, sehingga Cibinong tetap tampil 169,0% (angka per 2026-09-05), bukan terpotong jadi 100%.
- `is_bep` bernilai benar hanya bila `modal_investasi > 0` **dan** `dana_kembali >= modal_investasi`. Outlet tanpa nilai investasi tidak pernah dianggap sudah balik modal.

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

Satu gerbang, dan ketat: **semua angka wajib sama persis dengan produksi, per outlet** — omzet, deduksi, COGS, opex, waste, management fee, laba bersih, bagi hasil, ROI, dan status BEP.

Ini akibat langsung dari keputusan memakai basis "bagian mitra dari laba": tidak ada perubahan perilaku yang disengaja di mana pun, sehingga **selisih apa pun berarti bug**. Tidak ada kategori "selisih yang bisa dijelaskan" yang bisa dipakai untuk melunakkan hasil yang mengecewakan. Kalau ada satu outlet saja yang tidak cocok, pekerjaan berhenti sampai sebabnya ditemukan.

Satu-satunya tambahan yang tidak punya pembanding adalah angka pendamping "sudah diterima", karena memang belum pernah ditampilkan. Ia diperiksa terpisah: nilainya harus sama dengan jumlah `nominal` di `mitra_transfers` untuk outlet tersebut.

**Patokan diambil dari layar produksi, bukan dari skrip.** Karena temuan 5, patokan waste dan komponen lain diambil dari halaman `/dashboard/owner/kelola-mitra` yang berjalan sebagai pengguna sungguhan. Skrip pembanding sekali pakai boleh dipakai untuk mempercepat, tetapi keluarannya harus divalidasi ke layar lebih dulu sebelum dijadikan patokan.

### Patokan awal (waste BELUM termasuk)

Diambil ulang **2026-09-05** dengan service role, jadi angka waste kosong dan laba bersih di sini **terlalu besar** (temuan 5). Persentase pada kolom masih persentase historis per outlet, belum melewati mesin kebijakan. Dipakai sebagai indikasi arah, bukan patokan final — patokan final diambil dari layar produksi.

| Outlet | Omzet | Opex | ROI (hak) | Sudah diterima | Selisih |
|---|---:|---:|---:|---:|---:|
| Cibinong | 151,2 jt | 16,0 jt | 169,0% | 162,9% | 6,2 |
| Cibubur | 110,6 jt | — | 33,4% | 28,3% | 5,1 |
| Cicurug | 159,4 jt | 18,8 jt | 27,1% | 12,6% | 14,5 |
| Cileungsi | 217,1 jt | 18,9 jt | 31,5% | 0,0% | 31,5 |
| Ciseeng | 53,9 jt | 9,9 jt | 26,7% | 24,0% | 2,7 |
| Kalisari | 48,1 jt | 7,8 jt | 24,2% | 22,0% | 2,2 |
| Paledang | 79,6 jt | 11,6 jt | 26,4% | 22,3% | 4,1 |
| Pekayon | 68,1 jt | 13,2 jt | 34,9% | 32,8% | 2,2 |
| Sentul | 85,1 jt | 14,1 jt | 41,0% | 46,3% | **−5,3** |

Kolom selisih adalah bagi hasil yang sudah jadi hak tetapi belum ditransfer. Sentul bertanda negatif: transfer yang sudah dibayarkan melampaui bagi hasil periode berjalan — akibat periode tak setara (bagi hasil dihitung sejak 1 Agustus, transfer mencakup seluruh riwayat). Angka pendamping ini karena itu bukan "sisa utang" yang presisi.

### ⚠️ Jebakan `expenses.type` — wajib dibaca sebelum menulis SQL

Pengambilan patokan pertama memakai filter `type = 'out'`, menyalin `mitraRoi.ts` versi lama. Ternyata **tidak ada satu pun** baris pengeluaran bertipe `out`: seluruh 302 baris sejak 1 Agustus bertipe **`expense`**, bernilai total Rp 345 juta. Akibatnya seluruh pengeluaran bulanan — gaji, listrik, sewa — tak pernah masuk OPEX, laba terlihat lebih besar, dan BEP terlihat lebih cepat tercapai. ROI di tabel ini turun 2–10 poin setelah dikoreksi.

`mitraRoi.ts` di `main` **sudah** memakai `type = 'expense'` (komentar di berkasnya mencatat bug ini pernah diperbaiki lebih dulu di `mitraPnl.ts` lalu salinannya di ROI terlewat). Fungsi database yang baru **wajib** memakai `'expense'`. Menyalin dari kode lama mana pun akan menghidupkan kembali bug yang menggelembungkan laba mitra.

**Perhatikan: omzet TURUN dibanding pengambilan 2 September** meski periodenya tiga hari lebih panjang — Pekayon 86,4 → 68,1 jt, Sentul 115,1 → 85,1 jt, dan deduksi anjlok jauh lebih tajam (Sentul 40,0 → 3,3 jt). Ini efek PR #49/#50 yang menyeragamkan acuan omzet kotor lintas dashboard, bukan penjualan yang merosot. Laba bersih justru naik di semua outlet. Angka lama sengaja tidak disimpan di sini agar tidak ada yang keliru memakainya sebagai patokan.

**Tetap tidak ada outlet yang berubah status BEP-nya.** Diperiksa ulang pada data 2026-09-05: hanya Cibinong yang melewati modal, dan lewat di kedua basis (169,0% hak, 162,9% kas). Delapan sisanya tertinggi 34,9% — jauh di bawah 100%, sehingga tidak ada yang berada di ambang. Baik aturan 50:50 maupun pembebasan management fee tidak menyala atau padam untuk siapa pun akibat keputusan basis di spec ini.

**Cileungsi bukan data yang bermasalah.** Order pertamanya 8 Agustus 2026, tanggal mulai investasi 10 Agustus — memang tidak ada riwayat sebelum sistem berjalan, dan nol transfer berarti mitranya belum pernah menerima pembayaran. Outlet ini beromzet paling besar di antara semua mitra. Inilah kasus yang paling menunjukkan gunanya angka pendamping: berhak atas 31,5%, diterima 0%.

## Pengujian

Aturan bisnis berada di SQL, jadi diuji lewat perbandingan terhadap patokan produksi per outlet, bukan unit test bahasa pemrograman. Yang wajib dibuktikan:

1. Kesembilan outlet: setiap komponen perhitungan identik dengan patokan layar.
2. Mitra yang memanggil fungsi dengan `p_outlet_ids` berisi outlet milik orang lain hanya menerima barisnya sendiri.
3. Outlet tanpa baris `mitra_investments` tidak membuat fungsi gagal.
4. Modal investasi bernilai nol tidak menghasilkan pembagian dengan nol.
5. Laba bersih negatif menghasilkan bagi hasil nol, bukan angka negatif.

Ditambah setelah temuan 6 — kebijakan cutoff wajib dipin, karena inilah aturan yang paling mudah salah dan paling mahal akibatnya:

6. Periode yang mulai **sebelum** 2026-09-01 memakai persentase & fee historis dari `mitra_investments`, bukan aturan baru.
7. Periode yang mulai **pada atau sesudah** 2026-09-01, outlet belum BEP → persentase 100 dan management fee 3.
8. Periode yang sama, outlet sudah BEP → persentase 50 dan management fee 0.
9. Periode yang melintasi tanggal cutoff diperlakukan konsisten dengan `mitraPolicy.ts` (ia memutuskan berdasarkan `periodFrom`, jadi fungsi database harus memakai `p_from` juga — bukan `p_to`, dan bukan tanggal hari ini).

## Di luar cakupan

- Layar Android "Dashboard Saya" — sub-proyek 1, memakai fungsi ini.
- Memperbaiki puluhan skrip `check_*.js` yang diam-diam mendapat hasil kosong dari fungsi ber-scope (temuan 5).
- F5/F6/F7 dari spec sub-proyek 0 — tetap prasyarat sub-proyek 1, bukan sub-proyek ini.
