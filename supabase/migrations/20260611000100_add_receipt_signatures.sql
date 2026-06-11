-- Tanda tangan serah-terima di sisi penerima (outlet tujuan).
-- Terpisah dari `signatures` (yang dipakai sisi pengirim saat draft).
-- Menyimpan array {signed_by, role, signed_at, signature_image}.

alter table surat_jalan
  add column if not exists receipt_signatures jsonb not null default '[]'::jsonb;

create or replace function sign_receipt_surat_jalan(
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
  v_sj record;
  v_sigs jsonb;
begin
  select id, status, receipt_signatures into v_sj
  from surat_jalan
  where id = p_surat_jalan_id;

  if v_sj.id is null then
    raise exception 'Surat jalan not found';
  end if;

  -- Hanya SJ yang sudah dikirim / sedang diterima yang boleh ditandatangani penerima.
  if v_sj.status not in ('dikirim', 'dikirim_lengkap', 'diterima_sebagian') then
    raise exception 'Surat jalan tidak dalam status penerimaan (status: %)', v_sj.status;
  end if;

  -- Hanya role penerima yang valid.
  if p_role not in ('Crew Penerima', 'Supir') then
    raise exception 'Role tidak valid untuk TTD penerimaan: %', p_role;
  end if;

  v_sigs := coalesce(v_sj.receipt_signatures, '[]'::jsonb);

  -- Cegah TTD ganda per role.
  if exists (
    select 1 from jsonb_array_elements(v_sigs) e
    where e->>'role' = p_role
  ) then
    raise exception '% sudah menandatangani penerimaan', p_role;
  end if;

  v_sigs := v_sigs || jsonb_build_array(
    jsonb_build_object(
      'signed_by', p_signed_by_name,
      'role', p_role,
      'signed_at', now(),
      'signature_image', p_signature_image
    )
  );

  update surat_jalan
  set receipt_signatures = v_sigs
  where id = p_surat_jalan_id;

  return jsonb_build_object(
    'success', true,
    'receipt_signatures', v_sigs,
    'total', jsonb_array_length(v_sigs)
  );
end;
$$;
