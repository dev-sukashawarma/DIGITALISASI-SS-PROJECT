-- Add document_number field and create/update RPC for numbering
alter table surat_jalan
add column if not exists document_number text unique;

-- Function to generate formatted document number
-- Format: SJ/[OUTLET-CODE]/[YYYYMMDD]/[SEQUENCE]
create or replace function generate_surat_jalan_number(p_outlet_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_outlet_code text;
  v_date text;
  v_sequence integer;
  v_number text;
begin
  -- Get outlet code (use outlet slug or name)
  select slug into v_outlet_code
  from outlets
  where id = p_outlet_id;

  if v_outlet_code is null then
    raise exception 'Outlet not found';
  end if;

  -- Format date as YYYYMMDD
  v_date := to_char(now(), 'YYYYMMDD');

  -- Get next sequence for today
  select coalesce(max(
    (string_to_array(document_number, '/'))[4])::integer, 0) + 1
  into v_sequence
  from surat_jalan
  where outlet_id = p_outlet_id
    and document_number like 'SJ/' || v_outlet_code || '/' || v_date || '/%';

  -- Format: SJ/KITCHEN/20260610/0001
  v_number := 'SJ/' || upper(v_outlet_code) || '/' || v_date || '/' ||
              lpad(v_sequence::text, 4, '0');

  return v_number;
end;
$$;

-- Function to create surat jalan with auto-generated number
create or replace function create_surat_jalan_with_number(
  p_outlet_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sj_id uuid;
  v_document_number text;
begin
  -- Generate document number
  v_document_number := generate_surat_jalan_number(p_outlet_id);

  -- Create surat jalan
  insert into surat_jalan (outlet_id, status, document_number, signatures)
  values (p_outlet_id, 'draft', v_document_number, '[]'::jsonb)
  returning id into v_sj_id;

  return jsonb_build_object(
    'id', v_sj_id,
    'document_number', v_document_number
  );
end;
$$;
