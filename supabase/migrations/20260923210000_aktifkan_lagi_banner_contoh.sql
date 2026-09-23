-- Membatalkan sebagian 20260923200000 atas permintaan owner (2026-09-23):
-- carousel "Contoh Banner 1/2/3" dipakai dulu sebagai mockup sampai banner
-- promo asli diunggah lewat Dashboard > Banner Aplikasi.
--
-- Popup "tester" SENGAJA tetap nonaktif: isinya kosong dan akan muncul
-- sekali di depan setiap pelanggan baru.

UPDATE app_banners SET aktif = true
WHERE id IN (
  '533b6cd5-e8e3-4bee-8148-cb72af7e7256', -- Contoh Banner 1
  '7a476524-9fb9-401f-b9b7-2e1963a3fef3', -- Contoh Banner 2
  '6979b241-1e20-458d-87b5-73c3ff98e237'  -- Contoh Banner 3
)
AND aktif IS DISTINCT FROM true;

DO $$
BEGIN
  IF (SELECT count(*) FROM app_banners WHERE aktif AND slot = 'carousel') <> 3 THEN
    RAISE EXCEPTION 'carousel aktif harus 3';
  END IF;
  IF EXISTS (SELECT 1 FROM app_banners WHERE aktif AND slot = 'popup') THEN
    RAISE EXCEPTION 'popup tidak boleh aktif';
  END IF;
END $$;
