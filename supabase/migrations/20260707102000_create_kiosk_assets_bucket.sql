insert into storage.buckets (id, name, public)
values ('kiosk-assets', 'kiosk-assets', true)
on conflict (id) do nothing;

create policy "kiosk-assets public access"
  on storage.objects for select
  using ( bucket_id = 'kiosk-assets' );

create policy "kiosk-assets insert access"
  on storage.objects for insert
  with check ( bucket_id = 'kiosk-assets' );

create policy "kiosk-assets update access"
  on storage.objects for update
  using ( bucket_id = 'kiosk-assets' );
