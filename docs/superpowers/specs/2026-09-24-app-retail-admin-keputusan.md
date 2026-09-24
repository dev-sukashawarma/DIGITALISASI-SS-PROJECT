# Pengaturan Aplikasi Pelanggan di Admin-Dashboard — Keputusan Owner

**Tanggal:** 2026-09-24 · **Sumber:** sesi grilling dengan owner · **Status:** keputusan final, belum ada kode

Konteks: aplikasi pelanggan live sejak 2026-09-23 untuk 21 outlet (11 milik + 10 mitra),
18 menu (migration `20260923190000`). Grup **App Retail** di admin-dashboard saat itu berisi
Ringkasan, Menu Aplikasi, Outlet Aplikasi, Banner Aplikasi, Splash Aplikasi.

## Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Siapa yang mengoperasikan | **Pusat (OWNER/ADMIN) lewat admin-dashboard**, termasuk untuk outlet mitra. Outlet menelepon pusat bila ada kendala. |
| 2 | Jam buka | Satu jam untuk semua hari, dari `outlets.open_hour` / `close_hour` (kini semua 14:00–22:00, cocok dengan jam order nyata 30 hari). **Ditegakkan di gateway** (checkout ditolak), bukan hanya tampilan. Pesan terakhir **30 menit sebelum tutup** (bisa diatur). Di luar jam: outlet tampil "Tutup · buka 14.00", menu bisa dilihat, tak bisa checkout. |
| 3 | Pengecualian | Tombol **"Tutup sementara"** per outlet + **"Tutup semua outlet"**, dengan "sampai kapan" (tutup hari ini / besok buka / tanggal-jam) dan **aktif lagi otomatis**. Alasan opsional tampil ke pelanggan. `app_enabled` tetap terpisah untuk mencabut outlet permanen. |
| 4 | Menu habis per outlet | **Satu sumber dengan POS:** gateway menghormati `kiosk_settings.unavailable_menu_ids` per outlet **dan** `menu_items.available_outlets`. Outlet Aplikasi punya daftar menu per outlet yang mengedit daftar yang sama. Tidak reset otomatis (perilaku POS tak diubah). Tinjau dulu 4 outlet yang sudah punya isian (terakhir 24 Agu) sebelum live. |
| 5 | Refund | Halaman **Pesanan Aplikasi** dengan antrean **"Perlu dikembalikan"**: pesanan batal setelah bayar + nominal + kontak WA pelanggan. Pusat transfer manual → "Sudah dikembalikan" + catatan/referensi → notifikasi ke pelanggan. Refund otomatis Xendit ditunda. |
| 6 | Pesanan tertahan | Di halaman yang sama: pesanan hari ini per outlet; **sudah bayar tapi belum diproses > N menit ditandai merah** + telepon outlet. N bisa diatur, **bawaan 10 menit**. Tanpa notifikasi WA/push ke pusat dulu. |
| 7 | Pelanggan | Halaman **Pelanggan**, lihat saja: nama, WA, email, tanggal daftar, jumlah pesanan, total belanja, riwayat. **Tanpa blokir.** |
| 8 | Broadcast | Halaman **Kirim Notifikasi**: judul, teks, tujuan ketuk (sama dengan Banner), sasaran semua / per outlet, riwayat, hormati `notify_promotions`, **maks 1 broadcast/hari**. Prasyarat: push ke HP terbukti jalan (token = 0 saat ini). |
| 9 | Voucher | Voucher bervariasi yang bisa diatur admin; menggantikan `DISKON_PILOT_PERSEN = 0` yang ditanam di gateway. |
| 10 | Jenis potongan | Semua: persen (+ batas maks) · nominal Rp · gratis item · beli X gratis Y · harga spesial menu. |
| 11 | Cara pakai | **Publik** (tampil di daftar voucher aplikasi) dan **rahasia** (kode). **Maks 1 voucher per pesanan.** |
| 12 | Syarat | Semua opsional & bebas diatur: periode, kuota total, batas per pelanggan, minimal belanja, khusus pesanan pertama, outlet tertentu, hari/jam, menu/kategori tertentu. Pengaman tetap: potongan ≤ total & ≤ 50%; **kuota dihitung saat lunas**. |
| 13 | Tanggungan voucher | Masuk baris **"Potongan"** outlet (sama dengan promo GoFood/POS; `mitraPnl.ts` laba = omzet − potongan − HPP − opex − waste − fee). Mengurangi laba mitra. Laporan mitra menampilkan rinciannya. Alasan: mitra juga dikelola pusat, semua promo keputusan pusat. |
| 14 | Biaya Xendit (~0,7% QRIS) | Masuk **"Potongan"** outlet per pesanan, seperti komisi GoFood/Grab. |
| 15 | Laporan | **Tidak ada halaman laporan baru.** Keuangan lewat Rangkuman Penjualan filter "Aplikasi" (channel `app` sudah dikenali). **Ringkasan App Retail** jadi papan pantau operasional: omzet & pesanan hari ini/bulan, pelanggan baru, tertahan, antrean refund, voucher terpakai, outlet teratas. |
| 16 | Pengaturan Aplikasi | Halaman baru berisi: batas pesan terakhir · batas tertahan · estimasi waktu siap (ganti "15–20 mnt" tertanam) · WA CS · versi minimum aplikasi (paksa update) · link S&K dan Kebijakan Privasi · kurasi Menu Terlaris. |
| 17 | Akses | OWNER + ADMIN boleh semua. **Log wajib** (siapa, kapan, apa) untuk voucher, refund, broadcast, tutup sementara. **Cek role di server**, bukan hanya menu. |
| 18 | Urutan | Lihat bawah. |

## Urutan pengerjaan

1. **Pengaman operasional** — jam buka + pesan terakhir di gateway · tutup sementara / semua · menu habis per outlet (+ perbaikan `available_outlets`) · Pesanan Aplikasi (tertahan + refund) · Pengaturan Aplikasi · log & cek role. **APK tahap ini wajib membawa pengecekan versi minimum**, supaya update berikutnya (voucher) bisa dipaksakan.
2. **Pantau** — Ringkasan jadi papan pantau · halaman Pelanggan · kurasi Menu Terlaris.
3. **Voucher** — 5 jenis, 8 syarat, publik/rahasia · potongan voucher & biaya Xendit masuk "Potongan".
4. **Broadcast** — buktikan push ke HP jalan dulu, baru halaman Kirim Notifikasi.

## Temuan saat grilling (bug, belum diperbaiki)

- Gateway katalog **mengabaikan** `kiosk_settings.unavailable_menu_ids` dan `menu_items.available_outlets` — menu yang disembunyikan POS di suatu outlet tetap dijual di aplikasi. Saat ini 0 menu aplikasi terdampak `available_outlets`.
- Pesanan aplikasi yang dibatalkan setelah bayar hanya mengirim notifikasi "dibatalkan"; **tidak ada refund** dan tidak tercatat di mana pun.
- `outlets.open_hour` / `close_hour` sudah bisa diedit di form Outlet admin tetapi tidak dibaca gateway maupun aplikasi.
