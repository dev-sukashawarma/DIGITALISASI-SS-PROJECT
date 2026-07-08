-- 20260708190000_update_bahan_baku_kategori_5_utama.sql
-- Update kolom `kategori` untuk semua bahan baku menjadi 5 kategori utama:
-- 'item core', 'bumbu', 'minuman', 'kemasan', 'lainnya'

-- 0. Hapus constraint lama yang membatasi nilai kategori ke kategori lama (jika ada)
ALTER TABLE public.bahan_baku DROP CONSTRAINT IF EXISTS bahan_baku_kategori_check;

-- 1. Kulit adalah Item Core, bukan kemasan
UPDATE public.bahan_baku
SET kategori = 'item core'
WHERE nama LIKE 'KULIT%';

-- 2. Daging (protein) -> Item Core
UPDATE public.bahan_baku
SET kategori = 'item core'
WHERE kategori = 'protein';

-- 3. Sayuran (Kentang, Lettuce, Bawang) -> Item Core
UPDATE public.bahan_baku
SET kategori = 'item core'
WHERE kategori = 'sayur';

-- 4. Saus -> Bumbu
UPDATE public.bahan_baku
SET kategori = 'bumbu'
WHERE kategori = 'saus';

-- 5. Kategori 'bumbu', 'kemasan', 'lainnya', 'minuman' sudah sesuai
-- (Kecuali yang sudah di-update di atas)

-- 6. Hapus constraint jika ada yang membatasi kategori (opsional, tapi sepertinya tidak ada)
-- (Tidak ada CHECK constraint di kolom `kategori`, hanya di `kategori_core`)

-- Verifikasi sisa kategori selain 5 utama
-- UPDATE yang tidak masuk 5 kategori utama menjadi 'lainnya'
UPDATE public.bahan_baku
SET kategori = 'lainnya'
WHERE kategori NOT IN ('item core', 'bumbu', 'minuman', 'kemasan', 'lainnya');
