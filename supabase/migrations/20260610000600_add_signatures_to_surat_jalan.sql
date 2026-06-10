-- Add signatures JSONB field for SPV approval flow
-- Stores array of {signed_by, signed_at, role} objects

alter table surat_jalan
add column if not exists signatures jsonb default '[]'::jsonb;

-- Create RPC function to add signature
create or replace function sign_surat_jalan(
  p_surat_jalan_id uuid,
  p_signed_by_name text,
  p_role text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_signatures jsonb;
  v_sj record;
begin
  -- Get current surat jalan
  select id, status, signatures into v_sj
  from surat_jalan
  where id = p_surat_jalan_id;

  if v_sj.id is null then
    raise exception 'Surat jalan not found';
  end if;

  if v_sj.status != 'draft' then
    raise exception 'Only draft surat jalan can be signed';
  end if;

  -- Add signature to array
  v_signatures := coalesce(v_sj.signatures, '[]'::jsonb);
  v_signatures := v_signatures || jsonb_build_array(
    jsonb_build_object(
      'signed_by', p_signed_by_name,
      'role', p_role,
      'signed_at', now()
    )
  );

  -- Update surat jalan with new signatures
  update surat_jalan
  set signatures = v_signatures
  where id = p_surat_jalan_id;

  return jsonb_build_object(
    'success', true,
    'signatures', v_signatures,
    'total_signatures', jsonb_array_length(v_signatures)
  );
end;
$$;

-- Create RPC function to send surat jalan (after 3 signatures)
create or replace function send_surat_jalan_signed(
  p_surat_jalan_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sj record;
  v_sig_count integer;
begin
  select id, status, signatures into v_sj
  from surat_jalan
  where id = p_surat_jalan_id;

  if v_sj.id is null then
    raise exception 'Surat jalan not found';
  end if;

  v_sig_count := jsonb_array_length(v_sj.signatures);

  if v_sig_count < 1 then
    raise exception 'Minimal 1 signature required to send surat jalan';
  end if;

  -- Update status to dikirim
  update surat_jalan
  set status = 'dikirim'
  where id = p_surat_jalan_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Surat jalan sent with ' || v_sig_count || ' signature(s)',
    'signatures', v_sj.signatures
  );
end;
$$;
