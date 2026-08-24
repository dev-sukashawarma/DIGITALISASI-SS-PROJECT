# Desain Saldo Petty Cash Admin

## Ringkasan

- Admin memilih satu outlet lalu mengubah Modal Awal dan Saldo Petty Cash Saat Ini.
- Nilai baru langsung menimpa nilai pada shift terbaru outlet.
- Catatan perubahan wajib diisi.
- Area Manager, Leader, dan Crew di POS melihat angka terbaru yang sama.
- Admin dapat melihat histori perubahan, termasuk nilai sebelum dan sesudah.
- Transaksi top-up dan pengeluaran tidak dikelola satu per satu dari halaman ini.

## Asumsi

- Hanya role `ADMIN` yang boleh menyimpan perubahan.
- Outlet harus mempunyai shift agar saldo dapat diubah.
- Nominal tidak boleh negatif.
- Sinkronisasi antartampilan memakai Supabase Realtime dengan refetch sebagai cadangan.
- Histori perubahan tidak dapat diedit atau dihapus dari UI.

## Arsitektur

Kolom override saldo saat ini ditambahkan ke tabel `shifts`. Modal awal tetap memakai
`starting_petty_cash`, sedangkan saldo saat ini memakai kolom override baru pada shift
terbaru. Semua tampilan memakai override ketika nilainya tersedia; jika belum ada,
tampilan memakai hitungan lama: modal awal + top-up yang sudah diterima - pengeluaran.

RPC khusus Admin mengunci shift terbaru, memvalidasi nominal dan catatan, menulis kedua
saldo, lalu memasukkan snapshot sebelum/sesudah ke tabel histori dalam satu transaksi.
Shift baru mewarisi saldo override shift sebelumnya sebagai modal awal.

## UI

Submenu `Sistem > Saldo Petty Cash` membuka halaman dengan pemilih outlet. Setelah outlet
dipilih, halaman menampilkan status shift, kedua saldo, form edit, dan histori. Form memakai
input Rupiah, catatan wajib, serta konfirmasi yang menunjukkan nilai lama dan baru.

## Penanganan Error

- Outlet tanpa shift menampilkan petunjuk untuk membuka shift terlebih dahulu.
- RPC menolak pengguna selain Admin, nominal negatif, dan catatan kosong.
- Perubahan saldo dan histori tidak dapat tersimpan secara terpisah.
- UI mempertahankan input ketika server menolak penyimpanan dan menampilkan pesan server.

## Pengujian

- Uji fungsi pemilihan saldo override versus hitungan lama.
- Uji validasi form dan format Rupiah.
- Jalankan type-check dan build pada Admin Dashboard serta POS Kasir.
- Verifikasi manual bahwa perubahan tampil pada halaman Admin, Leader, Area Manager, dan POS.

## Decision Log

1. Saldo dikelola per outlet, bukan CRUD transaksi top-up atau pengeluaran.
2. Admin mengubah dua angka: Modal Awal dan Saldo Saat Ini.
3. Nilai langsung menimpa shift terbaru; risiko perubahan histori shift diterima.
4. Catatan wajib dan setiap perubahan masuk histori audit.
5. Top-up yang dibuat lewat alur lain tetap memakai approval yang sudah ada.
6. Pendekatan tabel saldo khusus dan kolom pada `outlets` tidak dipilih.
