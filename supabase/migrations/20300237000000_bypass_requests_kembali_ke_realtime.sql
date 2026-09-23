-- =============================================================================
-- bypass_requests kembali ke publikasi supabase_realtime
-- =============================================================================
--
-- Gejala: log Postgres berulang kali mencatat
--   realtime_subscription_manager_pub | P0001 | invalid column for filter outlet_id
--
-- Penyebab: bypass_requests TIDAK ada di publikasi supabase_realtime, padahal
-- migration pembuatnya (20260709020000) memasukkannya dan 20300103000009 sendiri
-- menyebutnya sebagai tabel yang harus bertahan. Tabel ini tersapu oleh versi lama
-- yang men-drop lalu membangun ulang publikasi. Server Realtime memvalidasi kolom
-- filter terhadap tabel di publikasi, jadi langganan
--   POS native  OrderRealtimeManager  table=bypass_requests filter=outlet_id=eq.X
--   pos-kasir   GlobalBlockerMount    table=bypass_requests
-- ditolak dan event permintaan bypass (disetujui/ditolak) tidak pernah sampai ke
-- kasir lewat realtime — hanya lewat polling atau buka ulang layar.
--
-- REPLICA IDENTITY FULL disamakan dengan pasangannya, cancellation_requests: event
-- UPDATE/DELETE yang difilter per outlet butuh baris lama yang lengkap. Tabelnya
-- kecil (satu baris per permintaan), jadi biaya WAL tambahannya dapat diabaikan.
-- Idempoten.
-- =============================================================================

set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.bypass_requests') is not null and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bypass_requests'
  ) then
    alter publication supabase_realtime add table public.bypass_requests;
  end if;
end
$$;

alter table public.bypass_requests replica identity full;
