-- Naikkan batas upload khusus bukti foto inventaris menjadi 50 MB.
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'inventaris-foto';
