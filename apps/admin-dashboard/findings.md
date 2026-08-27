# Findings & Decisions

## Requirements
- User meminta rencana fitur promo Buy 1 Get 1.
- Pengaturan promo dilakukan di Admin Dashboard.
- Hasil promo harus diterapkan di POS.
- User meminta sesi interview untuk menetapkan aturan bisnis sebelum plan final.
- Koreksi keputusan: produk hadiah harus sama dengan produk pemicu; produk berbeda tidak didukung.
- Promo hanya memberikan satu produk gratis per transaksi, tidak berulang untuk kelipatan kuantitas.
- Promo hanya berlaku di POS kasir offline; food apps dan kanal lain tidak ikut.
- Satu unit produk promo langsung memenuhi syarat; tanpa minimum nominal transaksi atau syarat tambahan.
- Buy 1 Get 1 eksklusif dan tidak dapat digabungkan dengan diskon/promo lain pada produk yang sama.
- Ketersediaan stok/porsi pada sistem tidak boleh memblokir Buy 1 Get 1 karena dapat berbeda dari stok fisik.
- Admin dapat langsung mengatur produk, aktif/nonaktif, tanggal mulai/berakhir, dan jam harian promo.
- Admin Action saat ini meng-upsert promo dengan key outlet/scope/menu dan memiliki jalur sinkronisasi Order Online; B1G1 harus dikecualikan secara eksplisit dari jalur itu.
- Cart dan kalkulator native belum memiliki metadata baris hadiah atau tipe promo B1G1; perubahan meliputi model, mapper, kalkulator, UI keranjang, dan payload order.
- `CartLine` native saat ini hanya menyimpan harga dan quantity. B1G1 perlu metadata reward agar UI tidak menyamakan item gratis dengan diskon harga manual.
- POS membuat order dan order items melalui RPC agar satu transaksi persist. Rencana harus menempatkan mutasi stok B1G1 pada transaksi server yang sama, bukan pada callback UI.
- Ringkasan Bisnis Admin ada di `src/app/dashboard/owner/OwnerDashboardView.tsx` dan Pusat Laporan ada di `src/app/dashboard/reports/pos/ReportsView.tsx`; keduanya perlu membaca metadata reward yang tersimpan, bukan mengkalkulasi promo berdasarkan konfigurasi saat ini.

## Research Findings
- Admin Dashboard adalah Next.js dan memiliki halaman promo pada `src/app/dashboard/pos-admin/promo/`.
- Kontrak promo saat ini menggunakan tabel `outlet_promos`, dengan field termasuk `scope`, `menu_item_id`, `discount_type`, `discount_value`, masa berlaku, limit pemakaian, dan `apply_to_food_apps`.
- POS native telah memiliki domain/use case promo dan model `Promo`; kompatibilitas kontrak perlu diperiksa sebelum desain final.
- Admin promo yang ada sudah mendukung nama promo, aktif/nonaktif, jadwal tanggal dan jam harian, serta penerapan serentak ke outlet.
- Perhitungan POS native saat ini hanya mendukung diskon `percentage` dan `nominal`; item promo diterapkan per baris dan global promo per keranjang.
- Kelayakan promo native saat ini sudah mengecek status aktif, kuota, jadwal, dan kanal food apps. Buy 1 Get 1 dapat menggunakan evaluasi yang sama namun wajib menambahkan aturan "POS offline saja" dan eksklusif.
- `outlet_promos` sudah mempunyai migration dan realtime sehingga perubahan Admin dapat disinkronkan ke POS tanpa polling khusus.

## Technical Decisions
| Decision | Rationale |
|---|---|
| Tunda detail schema sampai interview selesai | Buy 1 Get 1 memiliki variasi kebijakan yang mengubah data model dan perhitungan secara material. |
| Produk hadiah mengikuti produk pemicu | Tidak perlu konfigurasi reward menu terpisah karena hadiah wajib produk yang sama. |
| Terapkan batas satu reward per transaksi | Mengikuti aturan bisnis, sehingga 4 produk pemicu tidak menjadi 2 hadiah. |
| Evaluasi promo hanya untuk POS kasir offline | Mencegah perubahan harga/order di food apps dan kanal lain. |
| Aktifkan Buy 1 Get 1 sejak satu unit pemicu | Tidak ada syarat minimum nilai belanja. |
| Beri Buy 1 Get 1 prioritas eksklusif | Mencegah penumpukan diskon yang tidak diinginkan. |
| Abaikan stok sistem saat kelayakan promo | Promo tetap harus bisa diproses saat saldo stok aplikasi tidak mencerminkan stok nyata. |
| Tambah tipe promo Buy 1 Get 1 di kontrak promo yang sama | Memakai UI, Supabase realtime, jadwal, kuota, dan sinkronisasi promo yang sudah ada tanpa tabel promo kedua. |
| Buat baris reward terpisah berharga Rp0 | Menjaga total bayar, bukti kasir, ticket dapur, dan audit order konsisten. |
| Jangan sync B1G1 ke Order Online | Aturan bisnis membatasi fitur untuk POS kasir offline. |
| Kedua line B1G1 mengurangi stok | Produk paid dan hadiah sama-sama barang fisik yang keluar. |
| Catat reward secara atomik bersama order dan stok | Mencegah stok ganda saat retry dan mencegah stok berubah ketika order gagal. |
| Badge histori/report berasal dari metadata order | Perubahan promo di Admin tidak boleh mengubah catatan transaksi lama. |

## Issues Encountered
| Issue | Resolution |
|---|---|
| Dialog interaktif bawaan Codex tidak tersedia pada mode Default | Ajukan pertanyaan interview secara teks; tidak mengasumsikan kebijakan bisnis. |

## Resources
- `src/app/dashboard/pos-admin/promo/PromoView.tsx`
- `src/app/dashboard/pos-admin/promo/actions.ts`
- `src/app/dashboard/pos-admin/promo/page.tsx`
- `D:\PROJECT-APPS-NATIVE\POS\app\src\main\java\com\sukashawarma\pos\domain\model\Promo.kt`
- `D:\PROJECT-APPS-NATIVE\POS\app\src\main\java\com\sukashawarma\pos\domain\usecase\CalculateCartUseCase.kt`
- `C:\Users\Creator MPB\OneDrive\Desktop\New folder\DIGITALISASI-SS-PROJECT\supabase\migrations\20300108000000_outlet_promos_schedule.sql`

## Visual/Browser Findings
- Tidak ada.
