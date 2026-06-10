-- Auto-create ledger entries when surat jalan is verified (status = diterima_lengkap)
-- Called from verification form after all items are verified

create or replace function finalize_surat_jalan_and_ledger(
  p_surat_jalan_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_outlet_id uuid;
  v_item record;
  v_qty_terima numeric;
begin
  -- Get surat jalan outlet_id
  select outlet_id into v_outlet_id
  from surat_jalan
  where id = p_surat_jalan_id;

  if v_outlet_id is null then
    raise exception 'Surat jalan not found';
  end if;

  -- Create ledger entries for each verified item
  for v_item in
    select
      sji.id,
      sji.bahan_baku_id,
      sji.qty_terima,
      sji.kondisi
    from surat_jalan_item sji
    where sji.surat_jalan_id = p_surat_jalan_id
      and sji.qty_terima is not null
  loop
    -- Only create ledger for items received in good condition
    -- Items with damage/loss handled separately in next phase
    if v_item.kondisi = 'baik' or v_item.kondisi is null then
      insert into ledger_stok (
        outlet_id,
        bahan_baku_id,
        tipe,
        qty,
        ref_shipment_id,
        catatan,
        created_at
      )
      values (
        v_outlet_id,
        v_item.bahan_baku_id,
        'terima_kiriman',
        v_item.qty_terima,
        p_surat_jalan_id,
        'Auto-entry from surat jalan verification',
        now()
      );
    end if;
  end loop;

  -- Update surat jalan status to diterima_lengkap
  update surat_jalan
  set status = 'diterima_lengkap'
  where id = p_surat_jalan_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Verifikasi selesai, ledger entries created'
  );
end;
$$;
