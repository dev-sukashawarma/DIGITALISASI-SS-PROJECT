-- Allow unauthenticated users to read outlets (reference data)
create policy outlets_read_anon
  on outlets for select
  to anon
  using (true);
