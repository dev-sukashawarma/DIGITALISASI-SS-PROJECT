-- Staf membatalkan sendiri pengajuan cuti / kasbon yang BELUM diputuskan HR.
--
-- Kenapa dihapus, bukan status 'cancelled':
--   * leave_requests.status & cash_advances.status_hr dibatasi CHECK, dan dibaca oleh
--     apps/HR, admin-dashboard, payroll, papan kehadiran. Status baru = semua konsumen
--     itu harus diajari mengabaikannya.
--   * Payroll memotong kasbon berdasarkan cash_advances.status = 'active' (bukan
--     status_hr), jadi kasbon "dibatalkan" yang barisnya tetap ada malah ikut terpotong.
--   * Pengajuan pending belum menyentuh kuota cuti maupun uang, jadi tidak ada efek
--     samping yang perlu dibalik. trg_leave_status_harian sudah menangani DELETE.
--
-- Aman terhadap balapan dengan HR: DELETE ... WHERE status = 'pending' mengunci baris;
-- bila HR menyetujui di saat bersamaan, Postgres mengevaluasi ulang WHERE setelah kunci
-- dilepas dan baris yang sudah 'approved' tidak terhapus.

create or replace function public.batalkan_cuti(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'Sesi login tidak valid' using errcode = '28000';
  end if;

  delete from leave_requests
   where id = p_id
     and staff_id = v_uid
     and status = 'pending';
  if found then
    return;
  end if;

  select status into v_status from leave_requests where id = p_id and staff_id = v_uid;
  if v_status is null then
    raise exception 'Pengajuan cuti tidak ditemukan' using errcode = 'P0002';
  end if;
  raise exception 'Cuti sudah % HR, tidak bisa dibatalkan',
    case v_status when 'approved' then 'disetujui' else 'ditolak' end
    using errcode = 'P0001';
end;
$$;

create or replace function public.batalkan_kasbon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'Sesi login tidak valid' using errcode = '28000';
  end if;

  -- Kasbon yang sudah punya cicilan tercatat tidak boleh hilang (FK payments ON DELETE
  -- CASCADE akan ikut menghapus riwayat pembayaran).
  delete from cash_advances ca
   where ca.id = p_id
     and ca.staff_id = v_uid
     and ca.status_hr = 'pending'
     and not exists (select 1 from cash_advance_payments p where p.cash_advance_id = ca.id);
  if found then
    return;
  end if;

  select status_hr into v_status from cash_advances where id = p_id and staff_id = v_uid;
  if v_status is null then
    raise exception 'Pengajuan kasbon tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_status = 'pending' then
    raise exception 'Kasbon sudah memiliki pembayaran, hubungi HR' using errcode = 'P0001';
  end if;
  raise exception 'Kasbon sudah % HR, tidak bisa dibatalkan',
    case v_status when 'approved' then 'disetujui' else 'ditolak' end
    using errcode = 'P0001';
end;
$$;

revoke all on function public.batalkan_cuti(uuid) from public, anon;
revoke all on function public.batalkan_kasbon(uuid) from public, anon;
grant execute on function public.batalkan_cuti(uuid) to authenticated;
grant execute on function public.batalkan_kasbon(uuid) to authenticated;
