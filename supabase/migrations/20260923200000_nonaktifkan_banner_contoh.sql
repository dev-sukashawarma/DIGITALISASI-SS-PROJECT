-- Matikan banner penanda-tempat sebelum aplikasi pelanggan dipakai outlet nyata
-- (go-live 2026-09-23, lihat 20260923190000).
--
-- Tiga carousel "Contoh Banner 1/2/3" (badge CONTOH) dan satu popup berjudul
-- "tester" masih aktif; popup itu akan muncul sekali ke setiap pelanggan baru.
-- DINONAKTIFKAN, bukan dihapus: admin menggantinya lewat Dashboard > Banner
-- Aplikasi. Tanpa banner aktif, Beranda langsung menampilkan menu (perilaku
-- yang sudah didukung aplikasi).

UPDATE app_banners SET aktif = false
WHERE id IN (
  '533b6cd5-e8e3-4bee-8148-cb72af7e7256', -- Contoh Banner 1
  '7a476524-9fb9-401f-b9b7-2e1963a3fef3', -- Contoh Banner 2
  '6979b241-1e20-458d-87b5-73c3ff98e237', -- Contoh Banner 3
  '162bd392-b3cf-4659-942d-102521e691fe'  -- popup "tester"
)
AND aktif IS DISTINCT FROM false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM app_banners
    WHERE aktif AND (badge = 'CONTOH' OR judul ILIKE 'contoh%' OR judul ILIKE 'tester%')
  ) THEN
    RAISE EXCEPTION 'masih ada banner contoh/tester yang aktif';
  END IF;
END $$;
