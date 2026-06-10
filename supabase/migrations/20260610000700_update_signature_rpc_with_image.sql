-- Update RPC function to store signature image in the JSONB signatures array
drop function if exists sign_surat_jalan(uuid, text, text);

create or replace function sign_surat_jalan(
  p_surat_jalan_id uuid,
  p_signed_by_name text,
  p_role text,
  p_signature_image text default null
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

  -- Add signature to array (including image if provided)
  v_signatures := coalesce(v_sj.signatures, '[]'::jsonb);
  v_signatures := v_signatures || jsonb_build_array(
    jsonb_build_object(
      'signed_by', p_signed_by_name,
      'role', p_role,
      'signed_at', now(),
      'signature_image', p_signature_image
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
