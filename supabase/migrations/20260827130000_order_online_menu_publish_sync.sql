alter table public.menu_items
  add column if not exists is_published_order_online boolean not null default false,
  add column if not exists order_online_sync_status text not null default 'not_published'
    check (order_online_sync_status in ('not_published','pending','synced','failed')),
  add column if not exists order_online_sync_error text,
  add column if not exists order_online_sync_updated_at timestamptz;

create table if not exists public.order_online_category_mapping (
  admin_category_id uuid primary key references public.categories(id) on delete cascade,
  online_category_id uuid not null,
  admin_name_snapshot text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_online_menu_sync_queue (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid,
  operation text not null check (operation in ('upsert','delete')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','succeeded','failed')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists order_online_menu_sync_active_idx
  on public.order_online_menu_sync_queue (menu_item_id)
  where status in ('pending','processing','failed');

create index if not exists order_online_menu_sync_due_idx
  on public.order_online_menu_sync_queue (next_attempt_at)
  where status in ('pending','failed');

create or replace function public.touch_order_online_menu_sync_queue()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_order_online_menu_sync_queue on public.order_online_menu_sync_queue;
create trigger trg_touch_order_online_menu_sync_queue
before update on public.order_online_menu_sync_queue
for each row execute function public.touch_order_online_menu_sync_queue();

alter table public.order_online_category_mapping enable row level security;
alter table public.order_online_menu_sync_queue enable row level security;

drop policy if exists order_online_category_mapping_admin on public.order_online_category_mapping;
create policy order_online_category_mapping_admin on public.order_online_category_mapping
for all to authenticated using (true) with check (true);

drop policy if exists order_online_menu_sync_queue_admin on public.order_online_menu_sync_queue;
create policy order_online_menu_sync_queue_admin on public.order_online_menu_sync_queue
for all to authenticated using (true) with check (true);
