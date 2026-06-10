-- Allow unauthenticated users to insert surat jalan (for testing)
create policy surat_jalan_insert_anon
  on surat_jalan for insert
  to anon
  with check (true);

create policy surat_jalan_item_insert_anon
  on surat_jalan_item for insert
  to anon
  with check (true);
