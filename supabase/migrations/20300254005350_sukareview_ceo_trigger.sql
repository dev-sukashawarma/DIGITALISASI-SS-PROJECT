-- 20300254005300_sukareview_ceo_trigger.sql
-- Pendaftaran trigger eskalasi ulasan negatif Google Maps dari SukaReview ke Bot CEO (J.A.R.V.I.S.)

SET lock_timeout = '10s';

INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  ('tg_ceo_review_kritis', 'owner', 'ceo',
   'Eskalasi Ulasan Negatif Google Maps (SukaReview)',
   'Peringatan instan real-time saat pelanggan memberikan ulasan buruk (<= 2 bintang), lonjakan ulasan negatif (negative spike), atau keluhan kritis terkait rasa, higienitas, dan pelayanan di Google Maps cabang.',
   'Trigger Real-Time SukaReview (rating <= 2 / negative spike)', true, true, 16, true),
  ('tg_admin_review_kritis', 'admin', 'ceo',
   'Eskalasi Ulasan Negatif Google Maps (SukaReview)',
   'Peringatan instan real-time saat pelanggan memberikan ulasan buruk (<= 2 bintang), lonjakan ulasan negatif (negative spike), atau keluhan kritis terkait rasa, higienitas, dan pelayanan di Google Maps cabang.',
   'Trigger Real-Time SukaReview (rating <= 2 / negative spike)', true, true, 16, true)
ON CONFLICT (id) DO UPDATE SET
  target_role = EXCLUDED.target_role,
  bot_slug = EXCLUDED.bot_slug,
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
