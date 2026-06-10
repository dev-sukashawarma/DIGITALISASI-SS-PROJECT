-- Update RPC to hardcode KITCHEN as outlet code
drop function if exists generate_surat_jalan_number(uuid);

create or replace function generate_surat_jalan_number(p_outlet_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_outlet_code text := 'KITCHEN';
  v_date text;
  v_sequence integer;
  v_number text;
begin
  -- Format date as YYYYMMDD
  v_date := to_char(now(), 'YYYYMMDD');

  -- Get next sequence for today (using hardcoded KITCHEN code)
  select coalesce(max(
    (string_to_array(document_number, '/'))[4])::integer, 0) + 1
  into v_sequence
  from surat_jalan
  where document_number like 'SJ/' || v_outlet_code || '/' || v_date || '/%';

  -- Format: SJ/KITCHEN/20260610/0001
  v_number := 'SJ/' || v_outlet_code || '/' || v_date || '/' ||
              lpad(v_sequence::text, 4, '0');

  return v_number;
end;
$$;
