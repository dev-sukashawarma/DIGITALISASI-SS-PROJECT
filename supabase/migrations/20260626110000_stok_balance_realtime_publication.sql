-- Fix: pos-kasir (lib/useStockAlerts.ts) berlangganan realtime ke tabel
-- `stok_balance` agar banner "stok menipis" di dashboard kasir update instan
-- saat stok bergerak, TAPI `stok_balance` tidak ada di publication
-- `supabase_realtime`. Akibatnya event postgres_changes tidak pernah
-- terkirim → kasir hanya melihat update lewat polling 30 detik, bukan
-- realtime sungguhan. Pola identik dengan bug `orders` yang sudah diperbaiki
-- di 20260623130000_orders_realtime_publication.sql, namun `stok_balance`
-- terlewat saat itu.
--
-- Catatan biaya: menambah tabel ke publication menambah beban WAL decode
-- Realtime (lihat docs/PERFORMANCE.md). `stok_balance` di-update tiap
-- transaksi ledger (pemakaian/terima/opname dll di 19 outlet), jadi frekuensi
-- tulisnya sedang — trade-off sadar agar notifikasi stok kritis benar-benar
-- realtime di kasir.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stok_balance'
  ) then
    alter publication supabase_realtime add table public.stok_balance;
  end if;
end $$;
