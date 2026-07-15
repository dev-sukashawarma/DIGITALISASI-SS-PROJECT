-- Hapus panduan POS yang hardcoded dari update sebelumnya (karena menimpa panduan asli)
DELETE FROM public.system_guides WHERE system_code = 'pos';

-- Kembalikan (restore) panduan asli dari tabel guides lama ke system_guides
INSERT INTO public.system_guides (system_code, category, title, content_html, image_url, sort_order, created_at, updated_at)
SELECT 
    'pos', 
    category, 
    title, 
    '<p>' || REPLACE(content, E'\n', '<br/>') || '</p>', 
    image_url, 
    sort_order, 
    created_at, 
    updated_at
FROM public.guides
ON CONFLICT DO NOTHING;

-- Tambahkan panduan "Simulasi Bonus Kru" tanpa menimpa yang lain
INSERT INTO public.system_guides (system_code, category, title, content_html, sort_order) VALUES
(
  'pos', 
  'Panduan Fitur Baru', 
  'Cara Simulasi Bonus Kru', 
  '<p>Fitur ini digunakan untuk melihat seberapa besar perkiraan bonus yang akan didapat oleh kru jika mencapai target penjualan tertentu.</p><p><strong>1. Buka Halaman Histori & Bonus</strong><br/>Di menu utama, pilih halaman <strong>Histori & Bonus</strong>. Anda akan melihat kartu <strong>Simulasi Bonus Tambahan</strong>.</p><p><strong>2. Atur Target dan Kru</strong><br/>Gunakan tombol <strong>+</strong> dan <strong>-</strong> untuk mensimulasikan jumlah item/porsi ekstra yang terjual. Sesuaikan juga <strong>Jumlah Kru Aktif</strong>. Sistem akan secara otomatis menghitung berapa perkiraan bonus yang didapatkan per kru.</p>',
  99
);
