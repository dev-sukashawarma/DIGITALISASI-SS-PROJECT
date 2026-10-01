-- Area manager (dan role berbinaan lain) tidak bisa membaca record/centangan checklist
-- outlet binaannya: policy baca daily_checklist_records/ticks hanya mengenal outlet
-- utama (auth_outlet_id) dan daftar role supervisor, sementara checklist_categories/
-- items sudah memakai accessible_outlet_ids(). Akibatnya gerbang absen pulang di app
-- menemukan item wajib tapi tidak melihat centangannya, sehingga AM terkunci
-- "Checklist penutupan outlet belum selesai" walau checklist sudah lengkap.
-- Hanya menambah akses BACA; hak tulis tidak berubah.

create policy checklist_records_read_accessible on public.daily_checklist_records
  for select to authenticated
  using (outlet_id in (select public.accessible_outlet_ids()));

create policy checklist_ticks_read_accessible on public.daily_checklist_ticks
  for select to authenticated
  using (exists (
    select 1 from public.daily_checklist_records r
    where r.id = daily_checklist_ticks.record_id
      and r.outlet_id in (select public.accessible_outlet_ids())
  ));
