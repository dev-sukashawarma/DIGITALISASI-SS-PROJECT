-- 20300254004800_finance_bot_trigger_catalog.sql
-- Daftarkan 7 katalog trigger operasional Bot Finance ke dalam tabel public.bot_trigger_catalog
-- Sinkron otomatis dua arah: Native SuperApp (Tab Trigger) & Telegram Bot Finance (/help)

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
    'tg_fin_po_due_reminder',
    'admin_finance',
    'finance',
    'Pengingat Jatuh Tempo PO Supplier (Hari H, Overdue & H-3)',
    'Memeriksa PO supplier belum lunas (unpaid) yang barangnya sudah diterima saat jatuh tempo hari ini, lewat tempo, atau 3 hari ke depan.',
    'Cron Harian 08:15 WIB',
    false,
    true,
    1,
    true
  ),
  (
    'tg_fin_pending_treasury',
    'admin_finance',
    'finance',
    'Alert Transaksi Treasury Menunggu Approval',
    'Notifikasi saat ada transaksi cash/bank baru berstatus pending approval (pembayaran supplier, kas kecil, setoran, atau payroll).',
    'Trigger Real-Time (cash_transaction -> pending_approval)',
    true,
    true,
    2,
    true
  ),
  (
    'tg_fin_cash_variance',
    'admin_finance',
    'finance',
    'Alert Selisih Kasir Tutup Shift Cabang',
    'Notifikasi anomali selisih uang fisik kasir vs POS saat closing shift outlet.',
    'Trigger Closing Shift Kasir',
    true,
    true,
    3,
    true
  ),
  (
    'tg_fin_petty_cash_request',
    'admin_finance',
    'finance',
    'Pengajuan Top Up / Penyesuaian Petty Cash Outlet',
    'Notifikasi permintaan pengisian saldo kas kecil (petty cash) outlet yang butuh verifikasi & pencairan dana.',
    'Trigger Pengajuan Kas Kecil (petty_cash_topups)',
    true,
    true,
    4,
    true
  ),
  (
    'tg_fin_setoran_reconcile',
    'admin_finance',
    'finance',
    'Notifikasi Input Setoran Kas Outlet',
    'Notifikasi saat kasir/outlet mengunggah bukti dan nominal setoran penjualan tunai harian ke bank.',
    'Trigger Input Setoran Outlet',
    true,
    true,
    5,
    true
  ),
  (
    'tg_fin_void_fraud',
    'admin_finance',
    'finance',
    'Audit Pembatalan / Void Order POS Bernilai Tinggi',
    'Eskalasi pembatalan transaksi kasir bernilai signifikan (>= Rp 50.000) untuk pencegahan potensi selisih kas.',
    'Trigger Void POS (orders -> cancelled >= 50k)',
    true,
    true,
    6,
    true
  ),
  (
    'tg_fin_eom_closing_reminder',
    'admin_finance',
    'finance',
    'Pengingat Closing Buku Akhir Bulan (EOM Hub)',
    'Pengingat batas akhir penyelesaian rekonsiliasi kas, opname stok akhir bulan, dan finalisasi seluruh invoice supplier.',
    'Jadwal Akhir Bulan (H-3 & H-1 Closing EOM)',
    false,
    true,
    7,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  judul = EXCLUDED.judul,
  deskripsi = EXCLUDED.deskripsi,
  jadwal_atau_trigger = EXCLUDED.jadwal_atau_trigger,
  is_realtime = EXCLUDED.is_realtime,
  sudah_tertaut_telegram = EXCLUDED.sudah_tertaut_telegram,
  urutan = EXCLUDED.urutan,
  is_active = EXCLUDED.is_active,
  updated_at = now();
