CREATE OR REPLACE FUNCTION resolve_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_count INT;
BEGIN
  -- Cek langsung jika email lengkap diberikan
  IF p_username LIKE '%@%' THEN
    RETURN p_username;
  END IF;

  -- Cari user yang emailnya cocok dengan username prefix (contoh: budi.jkt01@ss.com)
  -- Polanya: p_username || '.%@ss.com'
  SELECT count(*), max(email) INTO v_count, v_email
  FROM auth.users
  WHERE email LIKE p_username || '.%@ss.com' OR email = p_username || '@ss.com';
  
  IF v_count = 1 THEN
    RETURN v_email;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;


-- Merged from 20260610000700_update_signature_rpc_with_image.sql
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
