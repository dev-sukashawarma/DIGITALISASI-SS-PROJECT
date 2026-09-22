-- Cabut akses anon (dan hak TULIS authenticated) dari view definer.
--
-- Semua view di bawah dimiliki postgres TANPA security_invoker, jadi berjalan
-- dengan hak pemiliknya dan melewati RLS tabel dasarnya -- sementara grant
-- bawaan Supabase memberi anon & authenticated SEMUA hak. Terbukti 2026-09-22
-- lewat HTTP sungguhan hanya dengan anon key (tanpa login):
--   - baca: sales_summary_spv (4.523 baris), sales_items_spv & menu_sales_spv
--     (~63 ribu), hpp_*, ledger_feed_spv, monitoring_view_*, pembelian
--     supplier, rekap TikTok, target harian, pesan owner;
--   - TULIS: valid_operational_outlets & owner_messages_overview adalah view
--     yang bisa di-UPDATE/INSERT -> anon bisa mengubah 27 outlet & 81 pesan
--     owner, dan INSERT ke owner_messages memicu push notification FCM ke
--     staf (trigger handle_new_owner_message_notification).
--
-- Semua pemakai view ini adalah dashboard ber-login (authenticated) atau
-- server dengan service_role; tak ada fungsi INVOKER yang bisa dipanggil anon
-- yang membacanya, dan tak ada app yang MENULIS lewat view (semua menulis ke
-- tabel dasarnya). Jadi:
--   - anon: dicabut total;
--   - authenticated: tetap SELECT (perilaku dashboard tak berubah), hak tulis
--     dicabut.
-- Penyempitan akses authenticated lintas outlet (mis. crew membaca
-- po_payable_spv / sales_*_spv outlet lain) SENGAJA belum di sini -- butuh
-- keputusan per view karena sebagian memang sengaja definer.

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'daily_target_progress_scoped', 'daily_target_progress_spv',
    'hpp_barang_masuk_harian_spv', 'hpp_nilai_stok_harian_spv',
    'ledger_feed_spv',
    'menu_sales_scoped', 'menu_sales_spv',
    'monitoring_view_crew', 'monitoring_view_scoped', 'monitoring_view_spv',
    'opname_compliance_view',
    'owner_messages_overview',
    'pembelian_supplier_bulanan', 'pembelian_supplier_harian_spv',
    'po_payable_spv',
    'sales_board_outlets',
    'sales_daily_scoped', 'sales_daily_spv',
    'sales_hourly_scoped', 'sales_hourly_spv',
    'sales_items_spv', 'sales_pcs_hourly_spv', 'sales_summary_spv',
    'v_tiktok_rekap_harian',
    'valid_operational_outlets'
  ] LOOP
    IF to_regclass('public.' || v) IS NULL THEN
      RAISE NOTICE 'lewati % (tidak ada)', v;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', v);
  END LOOP;
END $$;
