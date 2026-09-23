-- =============================================================================
-- RLS initplan + buang indeks duplikat
-- =============================================================================
--
-- 1) Fungsi di policy RLS dievaluasi PER BARIS kecuali dibungkus subquery.
--
--    `get_user_role() = 'admin'` di policy orders dipanggil ribuan kali untuk satu
--    query laporan (terukur 3.474 kali, 750 ms). `(SELECT get_user_role())` dijadikan
--    InitPlan oleh planner: dihitung sekali per query, hasilnya dipakai ulang. Advisor
--    Supabase (lint 0003 auth_rls_initplan) menandai 114 policy di 61 tabel, termasuk
--    tabel yang paling sering ditulis: staff_location_trails, staff_live_locations,
--    attendance, stok_balance, outlet_staff.
--
--    Semantiknya identik. Semua fungsi yang dibungkus di sini STABLE, skalar, dan tanpa
--    argumen, jadi nilainya memang sama untuk seluruh baris dalam satu statement.
--    accessible_outlet_ids() TIDAK disentuh: fungsinya SETOF dan sudah dipakai sebagai
--    subquery `IN (SELECT accessible_outlet_ids())`.
--
--    Ditulis sebagai loop atas pg_policies, bukan 196 ALTER POLICY tangan, supaya tidak
--    ada policy yang terlewat atau tersalin keliru. Idempoten: pemanggilan yang sudah
--    berbentuk `SELECT fungsi()` dilewati (lookbehind), jadi menjalankan ulang tidak
--    membungkus dua kali. Diverifikasi sebelum ditulis: 196 policy / 101 tabel berubah,
--    0 terbungkus ganda, 0 prefix skema rusak, 0 auth.uid() telanjang tersisa.
--
-- 2) Indeks identik hanya menambah biaya setiap INSERT/UPDATE dan memakan RAM cache.
--    - ledger_stok: idx_ledger_outlet_created (14 MB) = idx_ledger_stok_outlet_created_at.
--    - petty_cash_expenses: tiga indeks identik; dua yang dibuang tidak pernah dipakai
--      (idx_scan = 0). Tidak satu pun menopang constraint.
-- =============================================================================

-- Jangan menunggu lama antre di belakang query panjang: lebih baik gagal lalu diulang
-- daripada menahan tulisan kasir di belakang kunci ALTER.
set local lock_timeout = '5s';

do $$
declare
  r record;
  pola constant text :=
    '(?<!SELECT )((?:public\.)?\m(?:get_user_role|auth_outlet_id|is_owner_or_admin'
    '|auth_is_supervisor|is_hr_pusat|is_admin|can_manage_po|get_user_outlet_id|peran_saya'
    '|can_write_payroll|is_finance_checker|chat_is_pengelola|is_kitchen_staff'
    '|is_manager_or_admin|can_approve_po|can_set_harga_outlet|can_write_bahan_baku'
    '|is_finance)|\mauth\.(?:uid|role|jwt))\(\)';
  q text;
  c text;
  stmt text;
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    q := regexp_replace(r.qual, pola, '(SELECT \1())', 'g');
    c := regexp_replace(r.with_check, pola, '(SELECT \1())', 'g');
    continue when q is not distinct from r.qual and c is not distinct from r.with_check;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    -- Policy INSERT tidak punya USING, policy SELECT/DELETE tidak punya WITH CHECK.
    if q is not null then stmt := stmt || format(' USING (%s)', q); end if;
    if c is not null then stmt := stmt || format(' WITH CHECK (%s)', c); end if;
    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'RLS initplan: % policy diperbarui', n;
end
$$;

drop index if exists public.idx_ledger_outlet_created;
drop index if exists public.idx_petty_cash_active_date;
drop index if exists public.idx_petty_cash_outlet_date;
