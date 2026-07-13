-- Aktifkan realtime untuk apps/stok: ledger, opname, dan waste report saat ini
-- hanya polling/refresh manual. stok_balance & permintaan_bahan sudah ada di
-- publication (lihat 20260626110000 & 20260615000400) — tidak disentuh di sini.
--
-- Catatan biaya: menambah tabel ke publication menambah beban WAL decode
-- Realtime (lihat docs/PERFORMANCE.md). ledger_stok ditulis tiap transaksi
-- (order kasir dsb, 19 outlet) — trade-off sadar, diredam via debounce di
-- sisi client (lihat apps/stok/src/lib/realtime).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ledger_stok'
  ) then
    alter publication supabase_realtime add table public.ledger_stok;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opname'
  ) then
    alter publication supabase_realtime add table public.opname;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opname_item'
  ) then
    alter publication supabase_realtime add table public.opname_item;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stok_waste_reports'
  ) then
    alter publication supabase_realtime add table public.stok_waste_reports;
  end if;
end $$;

-- REPLICA IDENTITY FULL agar event UPDATE/DELETE ber-filter (mis. outlet_id,
-- reported_by) tetap lolos evaluasi filter Realtime & RLS (default identity
-- hanya membawa kolom primary key untuk OLD row).
alter table public.ledger_stok replica identity full;
alter table public.opname replica identity full;
alter table public.opname_item replica identity full;
alter table public.stok_waste_reports replica identity full;
