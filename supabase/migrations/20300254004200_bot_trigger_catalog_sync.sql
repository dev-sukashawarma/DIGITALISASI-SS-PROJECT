-- 20300254004200_bot_trigger_catalog_sync.sql
-- Single Source of Truth (Katalog Trigger Terpusat) untuk sinkronisasi otomatis dua arah
-- antara Bot Telegram (@Manager_ss_bot / @Hrd_ss_bot / @Stokis_ss_bot) dan Native SuperApp (Tab Trigger).
-- Setiap perubahan/penambahan baris di tabel public.bot_trigger_catalog otomatis tampil di:
-- 1. Tab "Trigger" pada aplikasi Android SUKA Superapp (tanpa perlu update APK)
-- 2. Perintah /start dan /help pada Bot Telegram

SET lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.bot_trigger_catalog (
  id text PRIMARY KEY,
  target_role text NOT NULL CHECK (target_role IN ('regional_manager', 'area_manager', 'owner', 'admin_hr', 'kitchen', 'purchasing', 'admin_finance')),
  bot_slug text NOT NULL DEFAULT 'manager',
  judul text NOT NULL,
  deskripsi text NOT NULL,
  jadwal_atau_trigger text NOT NULL,
  is_realtime boolean NOT NULL DEFAULT true,
  sudah_tertaut_telegram boolean NOT NULL DEFAULT true,
  urutan int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_trigger_catalog_role_urutan
  ON public.bot_trigger_catalog (target_role, is_active, urutan);

ALTER TABLE public.bot_trigger_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bot_trigger_catalog_select_authenticated ON public.bot_trigger_catalog;
CREATE POLICY bot_trigger_catalog_select_authenticated
  ON public.bot_trigger_catalog FOR SELECT
  TO authenticated
  USING (is_active = true);

REVOKE ALL ON public.bot_trigger_catalog FROM PUBLIC, anon;
GRANT SELECT ON public.bot_trigger_catalog TO authenticated;
GRANT ALL ON public.bot_trigger_catalog TO service_role;

COMMENT ON TABLE public.bot_trigger_catalog IS
  'Katalog terpusat (Single Source of Truth) daftar pemicu otomatis Bot yang dibaca langsung oleh Native SuperApp (Tab Trigger) dan Bot Telegram (/start & /help).';

-- Seed / Upsert 12 Trigger Regional Manager (RM) & 12 Trigger Area Manager (AM)
INSERT INTO public.bot_trigger_catalog (
  id, target_role, bot_slug, judul, deskripsi, jadwal_atau_trigger, is_realtime, sudah_tertaut_telegram, urutan, is_active
) VALUES
  -- ── REGIONAL MANAGER (RM) ──
  ('tg_rm_opname_finalized', 'regional_manager', 'manager',
   'Notifikasi Finalize Opname Cabang (Rekap Sudah & Belum Opname)',
   'Notifikasi real-time setiap kali ada cabang yang melakukan Finalize Stock Opname, lengkap dengan daftar cabang yang ✅ Sudah Opname, ⏳ Masih Draft, dan 🚨 Belum Opname hari ini.',
   'Trigger Finalize Opname (opname -> finalized)', true, true, 1, true),
  ('tg_rm_zero_sales_1930', 'regional_manager', 'manager',
   'Eskalasi Cabang Masih Rp 0 Transaksi (19:30 WIB)',
   'Alert eskalasi ke Regional Manager pada prime time malam (19:30 WIB) jika ada cabang aktif yang sudah buka namun masih mencatat 0 order POS (Rp 0).',
   'Cron Audit Omzet Malam (19:30 WIB)', false, true, 2, true),
  ('tg_rm_late_open_30m', 'regional_manager', 'manager',
   'Eskalasi Keterlambatan Buka Outlet (>= 30 Menit)',
   'Alert eskalasi ke Regional Manager jika cabang belum buka kasir dan belum ada kru absen masuk >= 30 menit dari jadwal buka.',
   'Cron Operasional Jam Buka (>= 30 Menit)', false, true, 3, true),
  ('tg_rm_cash_var_100k', 'regional_manager', 'manager',
   'Eskalasi Selisih Kas Kritis (> Rp 100.000)',
   'Notifikasi audit ke Regional Manager saat kasir tutup shift dengan selisih kas laci atau petty cash melebihi Rp 100.000.',
   'Trigger Closing Shift Kasir (> Rp 100rb)', true, true, 4, true),
  ('tg_rm_void_fraud', 'regional_manager', 'manager',
   'Eskalasi Pembatalan / Void Order POS Mencurigakan',
   'Peringatan instan ke Regional Manager saat terjadi pembatalan order (cancelled/void) bernilai >= Rp 50.000 atau beruntun >= 2x di cabang yang sama.',
   'Trigger Pembatalan Order (orders -> cancelled)', true, true, 5, true),
  ('tg_rm_stok_drop50', 'regional_manager', 'manager',
   'Alert Anomali Penurunan Stok Drastis (>= 50%)',
   'Deteksi dini potensi kebocoran/shrinkage saat saldo bahan baku utama cabang turun >= 50% dalam satu mutasi.',
   'Trigger Mutasi Saldo Stok (stok_balance)', true, true, 6, true),
  ('tg_rm_waste_150k', 'regional_manager', 'manager',
   'Eskalasi Pengajuan Waste Bahan (> Rp 150.000)',
   'Otorisasi khusus ke Regional Manager saat cabang mengajukan laporan waste bahan baku dengan estimasi kerugian di atas Rp 150.000.',
   'Trigger Laporan Waste (> Rp 150rb)', true, true, 7, true),
  ('tg_rm_sidak_review', 'regional_manager', 'manager',
   'Notifikasi Hasil Sidak Ceklist Harian AM',
   'Laporan instan ke Regional Manager saat Area Manager menyelesaikan sidak cabang beserta rincian poin Perhatian/Buruk untuk direview.',
   'Trigger Submit Sidak Ceklist AM', true, true, 8, true),
  ('tg_rm_opname_cutoff', 'regional_manager', 'manager',
   'Eskalasi Cut-Off Stok Opname (22:30 WIB)',
   'Rekap eskalasi ke Regional Manager pukul 22:30 WIB berisi daftar cabang per area yang masih belum menyelesaikan Stok Opname fisik.',
   'Cron Cut-Off Malam (22:30 WIB)', false, true, 9, true),
  ('tg_rm_omzet_3x', 'regional_manager', 'manager',
   'Broadcast Omzet Regional & Leaderboard AM (3 Sesi)',
   'Executive summary total omzet regional, porsi terjual, dan leaderboard perbandingan performa antar Area Manager (15:00, 19:30 & 22:30 WIB).',
   'Jadwal 15:00, 19:30 & 22:30 WIB', false, true, 10, true),

  -- ── AREA MANAGER (AM) ──
  ('tg_am_opname_finalized', 'area_manager', 'manager',
   'Notifikasi Cabang Finalize Opname (Rekap Sudah & Belum Opname)',
   'Notifikasi real-time ke Area Manager setiap kali cabang binaan melakukan Finalize Stock Opname, dilengkapi daftar cabang area yang ✅ Sudah Opname, ⏳ Masih Draft, dan 🚨 Belum Opname.',
   'Trigger Finalize Opname (opname -> finalized)', true, true, 1, true),
  ('tg_am_zero_sales_1700', 'area_manager', 'manager',
   'Alert Cabang Zero Sales / Rp 0 di Jam Operasional Sore (17:00 WIB)',
   'Peringatan otomatis pukul 17:00 WIB (setelah jam buka sore berjalan) jika ada cabang binaan aktif yang belum mencatat satu pun transaksi POS hari ini.',
   'Cron Audit Omzet Sore (17:00 WIB)', false, true, 2, true),
  ('tg_am_late_open_5m', 'area_manager', 'manager',
   'Alert Outlet Binaan Telat Buka (+5 Menit)',
   'Peringatan cepat ke Area Manager jika cabang binaan belum buka shift kasir dan belum ada kru clock-in 5 menit setelah jam buka.',
   'Cron Operasional Jam Buka (+5 Menit)', false, true, 3, true),
  ('tg_am_cash_var_20k', 'area_manager', 'manager',
   'Alert Selisih Kas Closing Cabang Binaan (> Rp 20.000)',
   'Notifikasi ke Area Manager setiap kali kasir di cabang binaan menutup shift dengan selisih kas laci atau petty cash di atas Rp 20.000.',
   'Trigger Closing Shift Kasir (> Rp 20rb)', true, true, 4, true),
  ('tg_am_void_order', 'area_manager', 'manager',
   'Alert Pembatalan / Void Order POS Cabang Binaan',
   'Notifikasi real-time ke Area Manager setiap kali kasir cabang binaan membatalkan order (cancelled/void) untuk mencegah kecurangan kasir.',
   'Trigger Pembatalan Order (orders -> cancelled)', true, true, 5, true),
  ('tg_am_stok_drop50', 'area_manager', 'manager',
   'Alert Penurunan Stok Tidak Wajar Cabang Binaan (>= 50%)',
   'Peringatan seketika ke Area Manager saat stok bahan di cabang binaan berkurang drastis >= 50% dalam satu mutasi.',
   'Trigger Mutasi Saldo Stok (stok_balance)', true, true, 6, true),
  ('tg_am_sj_gantung_2h', 'area_manager', 'manager',
   'Alert Surat Jalan Menggantung (> 2 Jam Belum Diterima)',
   'Pengingat ke Area Manager jika pengiriman barang (Surat Jalan) sudah berstatus dikirim > 2 jam namun belum diverifikasi terima oleh cabang.',
   'Cron Cek Distribusi Tiap 15 Menit', false, true, 7, true),
  ('tg_am_understaffed_h0', 'area_manager', 'manager',
   'Alert Izin Mendadak Hari Ini / Outlet Rawan Understaffed',
   'Notifikasi instan ke Area Manager saat kru cabang binaan mengajukan izin/sakit mendadak untuk shift hari ini (H-0) agar segera diatur kru pengganti.',
   'Trigger Pengajuan Izin H-0 (leave_requests)', true, true, 8, true),
  ('tg_am_waste_submit', 'area_manager', 'manager',
   'Notifikasi Pengajuan Waste Bahan Baku Cabang Binaan',
   'Pemberitahuan instan ke Area Manager saat kru cabang binaan menginput waste/barang rusak lengkap dengan foto bukti dan alasan.',
   'Trigger Input Waste (waste_reports)', true, true, 9, true),
  ('tg_am_omzet_3x', 'area_manager', 'manager',
   'Broadcast Omzet Area Binaan (15:00, 19:30 & 22:30 WIB)',
   'Laporan otomatis 3 sesi (Sore, Prime Time, Penutupan) berisi peringkat omzet cabang di area binaan serta daftar outlet 0 transaksi.',
   'Jadwal 15:00, 19:30 & 22:30 WIB', false, true, 10, true)
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
