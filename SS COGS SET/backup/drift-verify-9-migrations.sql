-- drift-verify-9-migrations.sql
-- Cek apakah objek dari 9 migration "unrecorded" (2026-07-01 s/d 2026-07-03) SUDAH ADA
-- di skema database, meski histori migration-nya tidak tercatat (drift).
-- READ-ONLY. Jalankan di SQL Editor, tempel hasilnya.

SELECT '20260701140000_petty_cash_hardening' AS migration,
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_expenses_created_by') AS sudah_ada
UNION ALL
SELECT '20260701150000_add_petty_cash_receipts',
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'petty-cash-receipts')
       OR EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_petty_cash')
UNION ALL
SELECT '20260702010000_petty_cash_separation',
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='petty_cash_topups')
UNION ALL
SELECT '20260702020000_petty_cash_approval',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'review_petty_cash_topup')
UNION ALL
SELECT '20260702030000_update_shift_start_petty_cash',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shifts' AND column_name='starting_petty_cash')
UNION ALL
SELECT '20260702040000_petty_cash_shift_scoped',
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'close_shift_blind')
UNION ALL
SELECT '20260702050000_fix_expenses_constraints',
       NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_category_check1')
UNION ALL
SELECT '20260702060000_create_system_guides',
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_guides')
UNION ALL
SELECT '20260702070000_update_guides_for_html',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_guides' AND column_name='content_html')
UNION ALL
SELECT '20260702080000_fix_system_guides_rls',
       EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_guides' AND policyname='Allow insert for admin and owner')
UNION ALL
SELECT '20260703000000_bom_automation',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ledger_stok' AND column_name='ref_order_id')
       AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_bom_stok')
UNION ALL
SELECT '20260703010000_petty_cash_expenses_table',
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='petty_cash_expenses')
ORDER BY 1;

-- Bonus: cek isi migration remote-only yang tidak ada file lokalnya (20260704100000)
-- supaya tahu itu perubahan apa sebelum diabaikan/diadopsi.
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version = '20260704100000';
