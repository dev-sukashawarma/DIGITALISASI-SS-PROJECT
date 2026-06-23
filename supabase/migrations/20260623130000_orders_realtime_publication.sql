-- Fix: pos-kasir berlangganan realtime ke tabel `orders` (OrderNotification =
-- bunyi pesanan masuk, kasir/page = daftar order live) lewat client project
-- utama, TAPI `orders` tidak ada di publication `supabase_realtime`. Akibatnya
-- event postgres_changes tidak pernah terkirim → notifikasi & update live mati
-- diam-diam. Tambahkan `orders` ke publication.
--
-- Catatan biaya: menambah tabel ke publication menambah beban WAL decode
-- Realtime (lihat docs/PERFORMANCE.md — WAL decode = line item #1). `orders`
-- adalah tabel tulis utama POS, jadi ini trade-off sadar: realtime order
-- berfungsi dengan biaya WAL yang sepadan untuk fitur inti kasir.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
