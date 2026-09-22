-- Uji perilaku sync_waste_ledger "waste terserap opname" (20260922230000).
-- Dijalankan di dalam transaksi; blok diakhiri RAISE agar SEMUA perubahan
-- (termasuk CREATE OR REPLACE bila disisipkan di depan) di-rollback.
-- LULUS  -> error 'LULUS (rollback disengaja)'.
-- GAGAL  -> error 'GAGAL: ...'.
do $$
declare
  v_op record; v_staff uuid; v_saldo0 numeric; v_saldo1 numeric;
  v_a uuid; v_b uuid; n_nonzero int; n_rows int; v_qty numeric;
  v_hist record; v_sum0 numeric; v_sum1 numeric;
begin
  -- Fixture: opname finalized terbaru yang menghitung fisik sebuah bahan
  select o.id, o.outlet_id, o.created_at, oi.bahan_baku_id into v_op
  from opname o join opname_item oi on oi.opname_id = o.id and oi.qty_fisik is not null
  join bahan_baku b on b.id = oi.bahan_baku_id and b.nama = 'KULIT 25'
  where o.status = 'finalized'
  order by o.created_at desc limit 1;
  select id into v_staff from outlet_staff where outlet_id = v_op.outlet_id limit 1;

  -- A: dilaporkan 1 jam SEBELUM opname, disetujui sekarang -> terserap
  select saldo into v_saldo0 from stok_balance where outlet_id = v_op.outlet_id and bahan_baku_id = v_op.bahan_baku_id;
  insert into stok_waste_reports (outlet_id, bahan_baku_id, qty, reason, status, reported_by, approved_by, created_at)
  values (v_op.outlet_id, v_op.bahan_baku_id, 0.1, 'uji terserap', 'APPROVED', v_staff, v_staff, v_op.created_at - interval '1 hour')
  returning id into v_a;
  select count(*) filter (where qty <> 0), count(*) into n_nonzero, n_rows from ledger_stok where ref_waste_id = v_a;
  select saldo into v_saldo1 from stok_balance where outlet_id = v_op.outlet_id and bahan_baku_id = v_op.bahan_baku_id;
  if n_nonzero <> 0 then raise exception 'GAGAL A: waste terserap masih memotong stok (% baris qty<>0)', n_nonzero; end if;
  if n_rows <> 1 then raise exception 'GAGAL A: jejak audit qty 0 tidak ada (% baris)', n_rows; end if;
  if v_saldo1 <> v_saldo0 then raise exception 'GAGAL A: saldo berubah % -> %', v_saldo0, v_saldo1; end if;

  -- A2: qty dikoreksi -> tetap tidak memotong stok
  update stok_waste_reports set qty = 0.15 where id = v_a;
  select count(*) filter (where qty <> 0) into n_nonzero from ledger_stok where ref_waste_id = v_a;
  if n_nonzero <> 0 then raise exception 'GAGAL A2: koreksi qty laporan terserap memotong stok'; end if;

  -- B: dilaporkan SETELAH opname terakhir -> memotong stok seperti biasa
  insert into stok_waste_reports (outlet_id, bahan_baku_id, qty, reason, status, reported_by, approved_by)
  values (v_op.outlet_id, v_op.bahan_baku_id, 0.1, 'uji normal', 'APPROVED', v_staff, v_staff)
  returning id into v_b;
  select coalesce(sum(qty),0) into v_qty from ledger_stok where ref_waste_id = v_b;
  if abs(v_qty + to_ledger_scale(v_op.outlet_id, v_op.bahan_baku_id, 0.1)) > 0.000001 then
    raise exception 'GAGAL B: waste normal tidak memotong stok dengan benar (sum=%)', v_qty;
  end if;

  -- C: laporan historis yang SUDAH memotong stok, dilaporkan sebelum sebuah
  -- opname -> koreksi qty harus rekonsiliasi biasa, bukan membalik potongan.
  select r.id, r.qty, r.outlet_id, r.bahan_baku_id into v_hist
  from stok_waste_reports r
  where upper(r.status) = 'APPROVED' and r.created_at >= '2026-09-02'
    and exists (select 1 from ledger_stok l where l.ref_waste_id = r.id and l.qty <> 0)
    and exists (select 1 from opname o join opname_item oi on oi.opname_id = o.id and oi.bahan_baku_id = r.bahan_baku_id and oi.qty_fisik is not null
                where o.outlet_id = r.outlet_id and o.status = 'finalized' and o.created_at > r.created_at)
  order by r.created_at desc limit 1;
  select sum(qty) into v_sum0 from ledger_stok where ref_waste_id = v_hist.id;
  update stok_waste_reports set qty = v_hist.qty + 0.001 where id = v_hist.id;
  select sum(qty) into v_sum1 from ledger_stok where ref_waste_id = v_hist.id;
  if abs(v_sum1 + to_ledger_scale(v_hist.outlet_id, v_hist.bahan_baku_id, v_hist.qty + 0.001)) > 0.000001 then
    raise exception 'GAGAL C: laporan historis tidak direkonsiliasi biasa (sum % -> %)', v_sum0, v_sum1;
  end if;

  raise exception 'LULUS (rollback disengaja): A terserap qty0 saldo tetap, A2 ok, B memotong %, C % -> %', v_qty, v_sum0, v_sum1;
end $$;
