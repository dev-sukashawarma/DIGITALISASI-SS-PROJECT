-- Drop existing restrictive policies if they exist
drop policy if exists surat_jalan_spv_select on surat_jalan;
drop policy if exists surat_jalan_crew_select on surat_jalan;
drop policy if exists surat_jalan_insert on surat_jalan;
drop policy if exists surat_jalan_item_crew_update on surat_jalan_item;

-- Authenticated users can read all surat jalan (master data visibility)
create policy surat_jalan_select
  on surat_jalan
  for select
  using (auth.role() = 'authenticated');

create policy surat_jalan_insert
  on surat_jalan
  for insert
  with check (auth.role() = 'authenticated');

create policy surat_jalan_update
  on surat_jalan
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy surat_jalan_item_select
  on surat_jalan_item
  for select
  using (auth.role() = 'authenticated');

create policy surat_jalan_item_insert
  on surat_jalan_item
  for insert
  with check (auth.role() = 'authenticated');

create policy surat_jalan_item_update
  on surat_jalan_item
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
