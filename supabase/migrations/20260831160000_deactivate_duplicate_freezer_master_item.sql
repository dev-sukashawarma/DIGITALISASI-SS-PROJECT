-- Hanya gunakan satu item freezer gabungan pada form inventaris.
-- Riwayat submission lama tetap dipertahankan, tetapi master lama tidak lagi
-- muncul sebagai pilihan/input aktif.
UPDATE public.inventaris_master_items
SET is_active = false
WHERE name = 'FREEZER 300/600/750L';

UPDATE public.inventaris_master_items
SET is_active = true,
    sort_order = 10
WHERE name = 'FREEZER 400L/600L/750L';
