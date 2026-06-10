-- Drop existing restrictive policies if they exist
drop policy if exists surat_jalan_spv_select on surat_jalan;
drop policy if exists surat_jalan_crew_select on surat_jalan;
drop policy if exists surat_jalan_insert on surat_jalan;
drop policy if exists surat_jalan_item_crew_update on surat_jalan_item;

-- Allow all read/write for development/testing
create policy surat_jalan_all
  on surat_jalan
  for all
  using (true)
  with check (true);

create policy surat_jalan_item_all
  on surat_jalan_item
  for all
  using (true)
  with check (true);
