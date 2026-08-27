do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'menu_items' and column_name = 'is_published_online') then
    alter table public.menu_items rename column is_published_online to is_published_order_online;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'menu_items' and column_name = 'online_sync_status') then
    alter table public.menu_items rename column online_sync_status to order_online_sync_status;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'menu_items' and column_name = 'online_sync_error') then
    alter table public.menu_items rename column online_sync_error to order_online_sync_error;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'menu_items' and column_name = 'online_sync_updated_at') then
    alter table public.menu_items rename column online_sync_updated_at to order_online_sync_updated_at;
  end if;
end $$;
