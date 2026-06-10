-- Allow unauthenticated users to read bahan_baku (reference data)
create policy bahan_baku_read_anon
  on bahan_baku for select
  to anon
  using (is_active = true);
