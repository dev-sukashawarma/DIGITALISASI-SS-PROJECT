-- 20300103000009_optimize_realtime_publication.sql
-- Optimasi performa database dengan membatasi tabel pada publikasi supabase_realtime.
-- Menghilangkan system_health_log dan tabel log internal yang tidak didengar oleh client,
-- serta memastikan seluruh tabel operasional, katalog, dan finance tetap aktif di realtime.

-- 1) Pastikan publication ada. JANGAN di-DROP: file ini bertimestamp 2030 sehingga
-- selalu jalan PALING AKHIR, jadi drop+rebuild akan menyapu tabel yang ditambahkan
-- migration bertanggal wajar (mis. bypass_requests, cancellation_requests) tanpa error.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2) Tambahkan tabel operasional & katalog terpilih
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- Absensi & SDM
    'attendance', 'leave_requests', 'cash_advances', 'outlet_staff', 'outlet_attendance_config',
    -- Checklist
    'daily_checklist_records', 'daily_checklist_ticks', 'checklist_items', 'checklist_categories',
    -- POS & Keuangan & Kas Kecil
    'orders', 'daily_sales_targets', 'menu_items', 'kiosk_settings', 'petty_cash_topups', 'petty_cash_expenses',
    -- Stok & Distribusi & Opname (Menambahkan opname, opname_item, dan surat_jalan)
    'stok_balance', 'ledger_stok', 'stok_waste_reports', 'permintaan_bahan', 'opname', 'opname_item', 'surat_jalan',
    -- M5 Finance Treasury & Payroll (Menambahkan tabel modul keuangan global)
    'cash_location', 'cash_transaction', 'cash_balance', 'payroll_records', 'expenses', 'purchase_order',
    -- Katalog & Master Data (Dipertahankan sesuai request)
    'bahan_baku', 'bahan_baku_harga', 'resep', 'resep_item', 'supplier',
    -- Utilitas & Status
    'outlets', 'global_settings', 'owner_messages', 'owner_message_outlets'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 3) Pastikan REPLICA IDENTITY FULL disetel pada tabel yang butuh filter/RLS realtime
-- (agar event UPDATE/DELETE menyertakan seluruh kolom data lama)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'attendance', 'leave_requests', 'cash_advances', 'outlet_staff',
    'daily_checklist_ticks', 'daily_checklist_records', 'outlet_attendance_config',
    'ledger_stok', 'stok_waste_reports', 'orders', 'petty_cash_topups', 'petty_cash_expenses',
    'opname', 'opname_item', 'surat_jalan', 'cash_transaction', 'payroll_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;
