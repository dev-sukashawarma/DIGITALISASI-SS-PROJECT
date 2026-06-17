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
  v_status text;
  v_item record;
  v_qty_terima numeric;
begin
  -- Get surat jalan outlet_id & status
  select outlet_id, status into v_outlet_id, v_status
  from surat_jalan
  where id = p_surat_jalan_id;

  if v_outlet_id is null then
    raise exception 'Surat jalan not found';
  end if;

  -- Idempotency: jika sudah diterima, return early (prevent dobel-ledger)
  if v_status in ('diterima_lengkap', 'diterima_sebagian') then
    return jsonb_build_object(
      'success', false,
      'message', 'Surat jalan sudah diverifikasi sebelumnya'
    );
  end if;

  -- Create ledger entries for each verified item
  for v_item in
    select
      sji.id,
      sji.bahan_baku_id,
      sji.qty_terima,
      sji.qty_dikirim,
      sji.kondisi,
      sji.catatan
    from surat_jalan_item sji
    where sji.surat_jalan_id = p_surat_jalan_id
      and sji.qty_terima is not null
  loop
    if v_item.kondisi = 'baik' or v_item.kondisi is null then
      -- Item diterima baik: masuk ke stok penerima
      insert into ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_shipment_id, catatan, created_at)
      values (v_outlet_id, v_item.bahan_baku_id, 'terima_kiriman', v_item.qty_terima,
              p_surat_jalan_id, 'Auto-entry from surat jalan verification', now());
    else
      -- Item rusak: audit trail qty=0, catatan mencatat qty yang ditolak
      insert into ledger_stok (outlet_id, bahan_baku_id, tipe, qty, ref_shipment_id, catatan, created_at)
      values (v_outlet_id, v_item.bahan_baku_id, 'rejected_kiriman', 0,
              p_surat_jalan_id,
              'Ditolak ' || coalesce(v_item.qty_dikirim::text, '?') || ' unit rusak'
                || case when v_item.catatan is not null then ': ' || v_item.catatan else '' end,
              now());
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


-- Merged from 20260610000500_m1_cron_mark_alpha.sql
-- M1: tandai alpha untuk staff aktif tanpa clock-in 'in' hari ini.
-- Dijalankan setiap hari pukul 23:55 (timezone UTC = 16:55 WIB).
CREATE OR REPLACE FUNCTION mark_alpha_for(target_date DATE)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status)
  SELECT
    gen_random_uuid(),
    s.id,
    s.outlet_id,
    'in',
    (target_date + TIME '23:59'),
    'alpha'
  FROM outlet_staff s
  WHERE s.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.outlet_staff_id = s.id
        AND a.type = 'in'
        AND a.ts_server::date = target_date
    );
$$;

SELECT cron.schedule(
  'mark-alpha',
  '55 23 * * *',
  $$ SELECT mark_alpha_for(CURRENT_DATE); $$
);

-- DOWN:
-- SELECT cron.unschedule('mark-alpha');
-- DROP FUNCTION IF EXISTS mark_alpha_for(DATE);
