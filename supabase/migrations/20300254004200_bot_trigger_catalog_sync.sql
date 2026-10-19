-- 20300254004200_bot_trigger_catalog_sync.sql
-- Single Source of Truth (Katalog Trigger Terpusat) untuk sinkronisasi otomatis dua arah
-- antara Bot Telegram (@Manager_ss_bot / @Hrd_ss_bot / @Stokis_ss_bot) dan Native SuperApp (Tab Trigger).
-- Setiap perubahan/penambahan baris di tabel public.bot_trigger_catalog otomatis tampil di:
-- 1. Tab "Trigger" pada aplikasi Android SUKA Superapp (tanpa perlu update APK)
-- 2. Perintah /start dan /help pada Bot Telegram

SET lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.bot_trigger_catalog (
  id text PRIMARY KEY,
  target_role text NOT NULL CHECK (target_role IN ('regional_manager', 'area_manager', 'owner', 'admin_hr', 'kitchen', 'purchasing', 'admin_finance', 'stokist')),
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
   'Jadwal 15:00, 19:30 & 22:30 WIB', false, true, 10, true),

  -- ── STOKIST & DISTRIBUSI (11 TRIGGERS) ──
  ('tg_stok_permintaan_masuk', 'stokist', 'stokist',
   'Notifikasi Permintaan Bahan Masuk dari Outlet',
   'Notifikasi instan real-time saat outlet cabang membuat permintaan bahan baru ke Kitchen / Gudang Pusat.',
   'Trigger Permintaan (permintaan_bahan -> menunggu)', true, true, 1, true),
  ('tg_stok_defisit_gudang', 'stokist', 'stokist',
   'Alert Defisit Stok Gudang Pusat Terhadap Permintaan Cabang',
   'Alert darurat real-time saat total kuantiti bahan yang diminta outlet melebihi sisa fisik di Gudang Pusat.',
   'Trigger Defisit Gudang Pusat', true, true, 2, true),
  ('tg_stok_rekap_pengadaan_0830', 'stokist', 'stokist',
   'Rekap Harian Saran Pengadaan / PO Gudang Pusat (08:30 WIB)',
   'Rangkuman otomatis setiap pagi pukul 08:30 WIB berisi daftar bahan yang defisit atau di bawah batas aman untuk dibuatkan PO.',
   'Cron Rekap Pengadaan Pagi (08:30 WIB)', false, true, 3, true),
  ('tg_stok_rop_minimum', 'stokist', 'stokist',
   'Peringatan Stok Kritis / Batas Minimum (ROP)',
   'Peringatan saat saldo bahan baku di cabang atau gudang mendekati atau di bawah batas minimum pemesanan kembali.',
   'Trigger Saldo Stok Minimum', true, true, 4, true),
  ('tg_stok_drop50_anomali', 'stokist', 'stokist',
   'Alert Anomali Penurunan Stok Drastis (>= 50%)',
   'Deteksi dini potensi kehilangan/shrinkage saat stok berkurang minimal 50% dalam satu transaksi mutasi.',
   'Trigger Mutasi Saldo Stok', true, true, 5, true),
  ('tg_stok_verifikasi_sj', 'stokist', 'stokist',
   'Notifikasi Verifikasi Pengiriman Surat Jalan',
   'Notifikasi saat armada logistik mulai diberangkatkan dan saat kru outlet menyelesaikan verifikasi penerimaan barang fisik.',
   'Trigger Surat Jalan (dikirim / diterima)', true, true, 6, true),
  ('tg_stok_selisih_terima', 'stokist', 'stokist',
   'Alert Selisih Penerimaan Barang Surat Jalan',
   'Alert otomatis jika terdapat ketidaksesuaian kuantiti barang yang dikirim dari gudang dengan fisik yang diterima outlet.',
   'Trigger Verifikasi Surat Jalan (selisih != 0)', true, true, 7, true),
  ('tg_stok_sj_gantung_2h', 'stokist', 'stokist',
   'Alert Surat Jalan Menggantung (> 2 Jam Belum Diterima)',
   'Peringatan jika pengiriman barang sudah berstatus dikirim lebih dari 2 jam namun belum diverifikasi penerimaannya oleh outlet.',
   'Cron Cek Distribusi Tiap 15 Menit', false, true, 8, true),
  ('tg_stok_waste_approval', 'stokist', 'stokist',
   'Alert Pengajuan Waste / Bahan Rusak Menunggu Approval',
   'Alert saat ada pengajuan bahan rusak/basi/terbuang yang memerlukan otorisasi atau persetujuan supervisor/manajer.',
   'Trigger Laporan Waste', true, true, 9, true),
  ('tg_stok_opname_reminder', 'stokist', 'stokist',
   'Pengingat Jadwal Stock Opname Harian Cabang',
   'Reminder otomatis kepada tim cabang untuk melakukan input stock opname harian serta peringatan jika pengisian terlambat.',
   'Cron Reminder Opname Sore & Malam', false, true, 10, true),
  ('tg_stok_opname_rekap_2230', 'stokist', 'stokist',
   'Rekapitulasi Kepatuhan Opname Harian Seluruh Outlet (22:30 WIB)',
   'Laporan konsolidasi kepatuhan opname harian seluruh outlet sebelum cut-off operasional malam (outlet finalized vs belum opname).',
   'Cron Cut-Off Opname Malam (22:30 WIB)', false, true, 11, true)
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
