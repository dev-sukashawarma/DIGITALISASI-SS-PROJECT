-- Foto boleh masuk sebagai upload sementara sebelum dikonversi oleh server.
-- Setelah proses background selesai, file tetap ditimpa sebagai WebP.
UPDATE storage.buckets
SET file_size_limit = 12582912,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
WHERE id = 'inventaris-foto';
