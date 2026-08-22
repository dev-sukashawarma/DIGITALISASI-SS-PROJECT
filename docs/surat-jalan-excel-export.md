# Ekspor Excel Surat Jalan

## Ringkasan

Ekspor surat jalan tersedia sebagai file `.xlsx` dari daftar dan halaman detail. File dibuat untuk langsung dicetak di A4 landscape dan mengikuti format formulir operasional: identitas perusahaan, data tujuan dan dokumen, tabel barang, catatan, serta tiga area tanda tangan.

## Keputusan

- Satu sheet bernama `Surat Jalan`, bukan sheet data terpisah.
- Kolomnya `No`, `Nama Barang`, `Satuan`, `Jumlah`, dan `Check List`; checklist sengaja kosong untuk diisi manual setelah dicetak.
- Area tanda tangan selalu memuat Admin Gudang, Pengirim, dan Penerima.
- Workbook dibuat di browser tanpa mengirim data ke layanan lain.

## Risiko dan penanganan

Jika data surat jalan tidak dapat diambil dari daftar, unduhan dibatalkan dan pengguna menerima pesan kesalahan. Tidak ada perubahan data pada proses ekspor.
