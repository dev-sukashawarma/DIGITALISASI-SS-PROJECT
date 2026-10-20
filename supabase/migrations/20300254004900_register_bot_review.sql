-- 20300254004900_register_bot_review.sql
-- Daftarkan profil Bot SukaReview ke dalam hermes_bot_registry dan 6 trigger operasional ke bot_trigger_catalog

-- 1. Registrasi Bot di hermes_bot_registry
INSERT INTO public.hermes_bot_registry (slug, nama) VALUES
  ('review', 'Bot SukaReview (Google Reviews & Kepuasan Pelanggan)')
ON CONFLICT (slug) DO UPDATE
SET nama = EXCLUDED.nama;

-- 2. Daftarkan 6 katalog trigger operasional Bot SukaReview
INSERT INTO public.bot_trigger_catalog (
  id,
  target_role,
  bot_slug,
  judul,
  deskripsi,
  jadwal_atau_trigger,
  is_realtime,
  sudah_tertaut_telegram,
  urutan,
  is_active
) VALUES
  (
    'tg_rev_low_rating',
    'marcom',
    'review',
    'Alert Review Bintang 1-2 Baru Masuk',
    'Mendeteksi dan mengirimkan alert instan saat ada ulasan pelanggan baru dengan rating 1 atau 2 bintang masuk ke sistem.',
    'Trigger Real-Time (Google Review Ingestion <= 2⭐)',
    true,
    true,
    1,
    true
  ),
  (
    'tg_rev_negative_spike',
    'marcom',
    'review',
    'Alert Lonjakan Komplain / Review Negatif',
    'Memberi peringatan dini jika sebuah cabang menerima 3 ulasan negatif atau lebih dalam jendela waktu 24 jam.',
    'Trigger Real-Time (Lonjakan Komplain Cabang)',
    true,
    true,
    2,
    true
  ),
  (
    'tg_rev_rating_drop',
    'marcom',
    'review',
    'Alert Penurunan Rata-rata Rating Outlet',
    'Mendeteksi tren penurunan signifikan pada performa rating 7 hari terakhir dibanding 7 hari sebelumnya (turun >= 0.3⭐).',
    'Trigger Real-Time (Evaluasi Tren 7 Hari)',
    true,
    true,
    3,
    true
  ),
  (
    'tg_rev_low_outlet_rating',
    'marcom',
    'review',
    'Alert Outlet di Bawah Ambang Minimum (< 3.8⭐)',
    'Mengidentifikasi outlet yang akumulasi rating Google Maps-nya berada di bawah standar minimum operasional.',
    'Trigger Real-Time (Rating Outlet < Ambang Batas)',
    true,
    true,
    4,
    true
  ),
  (
    'tg_rev_daily_summary',
    'marcom',
    'review',
    'Rekap Harian Sentimen & Kepuasan Pelanggan',
    'Rangkuman harian ulasan baru, persentase sentimen positif vs negatif, dan cabang berkinerja ulasan terbaik.',
    'Cron Harian 09:00 WIB',
    false,
    true,
    5,
    true
  ),
  (
    'tg_rev_unreplied_warning',
    'marcom',
    'review',
    'Pengingat Ulasan Negatif Belum Dibalas',
    'Memeriksa ulasan pelanggan bintang 1-2 yang belum mendapatkan draft respon resmi dari tim manajemen.',
    'Cron Harian 15:00 WIB',
    false,
    true,
    6,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active;
