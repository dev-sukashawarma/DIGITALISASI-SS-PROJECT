# Task Plan: Promo Buy 1 Get 1

## Goal
Merancang dan kemudian mengimplementasikan promo Buy 1 Get 1 yang dikonfigurasi dari Admin Dashboard dan dihitung konsisten di POS native maupun web POS.

## Current Phase
Phase 4 — implementasi selesai; menunggu verifikasi build di host Windows.

## Phases

### Phase 1: Requirements & Discovery
- [x] Identifikasi sistem promo yang sudah ada (`outlet_promos`).
- [x] Interview aturan bisnis Buy 1 Get 1.
- [x] Petakan jalur Admin → database → POS.
- **Status:** complete

### Phase 2: Contract & UX Design
- [x] Tentukan schema/migration dan validasi server.
- [x] Tentukan form Admin dan tampilan/aplikasi otomatis di POS.
- [x] Tentukan aturan kombinasi promo, stok, kanal, dan pembatalan.
- **Status:** complete

### Phase 3: Implementation
- [x] Uraikan perubahan Admin Dashboard.
- [x] Uraikan perubahan backend/Supabase dan POS native/web.
- [x] Rancang test cases dan rollout.
- **Status:** complete

### Phase 4: Delivery
- [x] Finalisasi plan yang siap ditinjau user.
- [x] Terapkan kontrak database, Admin Dashboard, POS native, histori, dan laporan.
- [ ] Jalankan build/test penuh setelah runtime Gradle dan pnpm host pulih.
- **Status:** in_progress

## Key Questions
1. [Answered — corrected] Produk hadiah harus sama dengan produk pemicu; produk lain tidak boleh dipilih.
2. [Answered] Maksimal satu hadiah untuk satu transaksi; tidak berulang per kelipatan kuantitas.
3. [Answered] Hanya berlaku di POS kasir offline; tidak berlaku untuk food apps atau kanal lain.
4. [Answered] Pembelian satu unit produk promo langsung memenuhi syarat; tidak ada minimum nilai belanja atau syarat tambahan.
5. [Answered] Buy 1 Get 1 eksklusif; tidak dapat digabung dengan promo/diskon lain untuk produk tersebut.
6. [Answered] Stok/porsi di sistem tidak memblokir promo; promo tetap berjalan meskipun sistem mencatat stok kurang dari dua.
7. [Answered] Admin mengatur produk, outlet, aktif/nonaktif, tanggal mulai/berakhir, dan jam harian.

## Decisions Made
| Decision | Rationale |
|---|---|
| Gunakan `outlet_promos` sebagai titik awal | Admin Dashboard sudah memiliki halaman dan kontrak promo berbasis outlet. |
| Produk hadiah sama dengan produk pemicu | Aturan bisnis final menolak hadiah produk berbeda; POS dapat menambahkan produk yang sama secara otomatis. |
| Batasi satu hadiah per transaksi | Pembelian lebih dari satu paket pemicu tetap hanya mendapatkan satu produk gratis. |
| Batasi ke POS kasir offline | Food apps dan kanal pemesanan lain dikecualikan dari Buy 1 Get 1. |
| Tidak ada minimum transaksi | Satu unit produk pemicu langsung menghasilkan satu unit hadiah gratis. |
| Buy 1 Get 1 eksklusif | Tidak boleh dikombinasikan dengan diskon atau promo lain pada produk yang sama. |
| Jangan jadikan stok sistem sebagai syarat | Catatan stok dapat berbeda dengan stok fisik; promo tetap harus berjalan. |
| Konfigurasi penuh dikelola Admin | Admin memiliki kendali langsung atas produk, jadwal, dan status promo. |
| Reward direpresentasikan sebagai baris order Rp0 | Bukti promo terlihat di keranjang, kitchen ticket, receipt, histori, dan jumlahnya tetap ikut mengurangi stok. |
| Eksklusivitas diberlakukan pada seluruh keranjang | Bila B1G1 diterapkan, kalkulator tidak menerapkan diskon/promo biasa lain pada transaksi itu. |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Tidak dapat memanggil pop-up pilihan Codex pada mode percakapan ini | 1 | Menggunakan interview teks sampai UI dialog tersedia. |
| Patch plan tidak cocok dengan isi file saat ini | 1 | Membaca ulang file dan menerapkan patch berdasarkan teks aktual. |
| PowerShell gagal membaca dua file Admin karena path tidak di-quote benar | 1 | Gunakan `-LiteralPath` per file pada pemeriksaan berikutnya. |
| Gradle unit test tidak dapat memulai daemon karena loopback socket Windows | 1 | Validasi source dengan pemeriksaan statis; build harus dijalankan setelah daemon/JDK host pulih. |
| Type-check Admin berhenti sebelum memeriksa source karena proses `pnpm install` anak gagal (exit `3221226505`) | 1 | Tidak mengubah dependency; verifikasi penuh menunggu runtime Node/pnpm host pulih. |

## Implementation Plan

### 1. Database & kontrak promo
- Buat migration Supabase yang menambah `buy_one_get_one` pada `outlet_promos.discount_type`; hanya valid untuk `scope='item'`, `menu_item_id` wajib, dan nilainya tidak pernah boleh untuk promo global.
- Pertahankan `discount_value` positif secara teknis agar kompatibel dengan constraint lama, tetapi kalkulator mengabaikannya untuk B1G1.
- Validasi server memaksa `apply_to_food_apps=false`; B1G1 tak disinkronkan ke Order Online.
- Tambahkan metadata audit di `order_items` (contoh: `is_promo_reward`, `promo_id`, `original_unit_price`) sehingga baris hadiah Rp0 dapat dibedakan dari override harga manual.
- Pastikan proses pengurangan stok membaca **semua** `order_items`, termasuk reward Rp0. Satu pembelian B1G1 harus mengirim satu line berbayar dan satu line reward; keduanya memakai `menu_item_id` yang sama dan masing-masing quantity 1.
- Jangan menurunkan stok di UI POS. Server/RPC order yang sama harus mencatat order, item berbayar, item hadiah, dan mutasi stok secara atomik agar retry atau kegagalan jaringan tidak mengurangi stok dua kali.
- Gunakan realtime `outlet_promos` yang sudah aktif; tidak perlu tabel promo atau kanal sinkronisasi baru.

### 2. Admin Dashboard
- Tambahkan pilihan **Buy 1 Get 1** di kartu promo per-menu pada `PromoView.tsx`; jangan tampilkan pada promo global.
- Saat dipilih, sembunyikan nilai diskon, minimum belanja, dan opsi food apps; tampilkan aturan tetap: beli ≥1, dapat gratis 1 produk sama, maksimal sekali/transaksi, stok sistem tidak memblokir, eksklusif.
- Pertahankan konfigurasi nama promo, aktif/nonaktif, tanggal mulai/akhir, dan happy hour dalam WIB.
- Perbarui `savePromosAction` dengan validasi tipe/scope/kanal server-side dan lewati jalur Order Online untuk B1G1.

### 3. POS native dan parity web POS
- Perluas DTO, mapper, `DiscountType`, dan `Promo` agar mengenali `buy_one_get_one` dari realtime.
- Tambahkan evaluator B1G1 tingkat keranjang: cari promo item aktif yang memenuhi jadwal/kuota serta berasal dari POS offline; jika ada sedikitnya satu item pemicu, hasilkan tepat satu reward dari menu yang sama dengan harga Rp0.
- Tambahkan relasi reward ke item pemicu dan promo. Re-evaluasi saat cart/promo berubah; hadiah ditambah/hapus otomatis dan kasir tidak dapat mengubah kuantitas atau harganya.
- Saat B1G1 aktif, lewati diskon/promo normal seluruh transaksi. Jangan gunakan stok/porsi sistem sebagai syarat.
- Tampilkan reward “Gratis — [nama promo]” pada cart, pembayaran, kitchen ticket, receipt, histori, dan payload order. Total menagih satu unit, sementara order memuat satu line berbayar dan satu line hadiah.
- Pada halaman Histori POS native, beri badge **Buy 1 Get 1** pada kartu/detail order lalu label **Gratis** di item hadiah; jangan mengandalkan `unit_price = 0` saja karena harga nol juga bisa muncul dari koreksi manual.
- Port perilaku yang sama ke `apps/pos-kasir` agar POS browser dan native identik.

### 4. Pencatatan, kuota & pembatalan
- Tambah `current_usage` satu kali hanya setelah order berhasil tersimpan; kuantitas pemicu lebih dari satu tidak menambah pemakaian kedua.
- Simpan id/nama promo pada reward/order untuk audit laporan. Void/cancel membatalkan kedua line bersama-sama.
- Promo tidak dievaluasi untuk food apps, Order Online, atau order yang sumbernya selain POS kasir.
- Realtime: POS merefresh konfigurasi promo ketika `outlet_promos` berubah. Riwayat/reports dan Admin Ringkasan Bisnis harus merefresh order yang baru masuk lewat kanal realtime yang sudah dipakai aplikasi; badge berasal dari metadata order item, bukan hasil hitung ulang berdasarkan promo saat ini.
- Admin Ringkasan Bisnis (`dashboard/owner/OwnerDashboardView.tsx`) dan Pusat Laporan (`dashboard/reports/pos/ReportsView.tsx`) menerima penanda B1G1 pada detail transaksi serta agregat jumlah reward/produk promo bila laporan memang menampilkan agregat item. Omzet tetap memakai line subtotal sebenarnya; line hadiah Rp0 tidak menambah omzet.

### 5. Tests & rollout
- Unit test: status aktif, jadwal/happy hour, kuota, item pemicu ada/tidak, quantity 1/2/lebih, dan stok sistem kosong.
- Unit test eksklusivitas: B1G1 tidak stack dengan diskon item/global dan tidak layak untuk food apps.
- Integration test: payload berisi satu paid line + satu reward Rp0, total benar, metadata audit ada, dan usage naik sekali setelah insert sukses.
- Test stok: order B1G1 mengurangi stok dua unit; retry request yang sama tidak membuat mutasi stok kedua; order gagal tidak mengurangi stok sama sekali.
- Test tampilan: detail Histori native, Ringkasan Bisnis, dan Pusat Laporan menampilkan badge promo serta item hadiah berlabel Gratis, termasuk setelah promo dimatikan atau diubah Admin.
- UI test Admin: B1G1 hanya per-menu, field tidak relevan tidak dikirim, jadwal valid, dan tidak tersinkron ke Order Online.
- Rollout: deploy migration → Admin + POS web/native → pilot satu outlet → periksa struk, `order_items`, laporan omzet, dan realtime sebelum aktifkan semua outlet.
