-- 1. Tambahkan kolom images dengan tipe JSONB
ALTER TABLE guides ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 2. Migrasi data lama dari image_url ke kolom images
UPDATE guides 
SET images = jsonb_build_array(
  jsonb_build_object('url', image_url, 'title', '')
)
WHERE image_url IS NOT NULL AND image_url != '';

-- 3. Hapus kolom image_url lama
ALTER TABLE guides DROP COLUMN IF EXISTS image_url;

-- 4. Perbarui panduan tentang 3 Kolom Order agar sesuai dengan sistem terbaru
UPDATE guides
SET title = 'Memahami 3 Kolom di Halaman Order',
    content = 'Halaman pesanan dibagi menjadi 3 kolom utama agar Anda lebih mudah memantau:

1. MENUNGGU PEMBAYARAN (Kolom Kiri):
Pesanan baru yang belum dibayar akan masuk ke sini. Jika pelanggan membayar tunai, Anda harus menerima uang dan menekan tombol "Tandai Lunas". Setelah lunas, tekan tombol "Mulai Masak" agar pesanan pindah ke kolom tengah.

2. SEDANG DIPROSES (Kolom Tengah):
Pesanan yang sudah lunas dan sedang disiapkan di dapur. Fokus siapkan pesanan yang ada di kolom ini. Setelah makanan siap disajikan, tekan tombol "Pesanan Siap".

3. PESANAN SELESAI (Kolom Kanan):
Pesanan yang sudah siap dan diserahkan ke pelanggan. Anda bisa menekan tombol "Sembunyikan" agar layar tetap rapi, namun pesanan tetap tercatat di Histori.'
WHERE title = 'Proses Pesanan (Dari Masuk s/d Selesai)';
