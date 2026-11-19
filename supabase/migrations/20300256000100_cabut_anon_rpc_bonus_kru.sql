-- Keamanan: cabut akses anon ke 4 RPC bonus (temuan audit iOS, HANDOFF iOS §9).
--
-- Keempat fungsi ini SECURITY DEFINER dan tidak memeriksa auth.uid(), sehingga siapa pun yang memegang
-- anon key (yang memang publik: tertanam di web & app) bisa membaca rincian bonus/gaji kru, AM, dan RM
-- tanpa login. Per 2026-11-19 `has_function_privilege('anon', …, 'EXECUTE')` = true untuk keempatnya.
--
-- Pemanggil yang ada (semua sudah login atau memakai service client, jadi tidak terdampak):
--   apps/admin-dashboard: lib/server/ringkasanPayrollHr.ts, actions/prorataAuxiliary.ts, actions/mitraPnl.ts,
--                         hooks/useCrewBonus.ts, hooks/usePayrollMutations.ts, components/PayrollSlipForm.tsx
--   apps/HR:              actions/users.ts (service), hooks/useCrewBonus.ts, hooks/usePayrollMutations.ts,
--                         components/modules/PayrollSlipForm.tsx
--   iOS Suka Admin:       RingkasanPayrollHrLoader, ProrataAuxiliaryLoader (JWT pengguna)
--
-- Migration ini HANYA mengubah hak EXECUTE (badan fungsi tidak disentuh). Pembatasan lebih lanjut per peran
-- (mis. hanya owner/admin/HR) perlu cek di dalam fungsi dan sebaiknya dibahas terpisah, karena pemanggil
-- service client tidak membawa auth.uid().

REVOKE EXECUTE ON FUNCTION public.get_monthly_crew_bonus(integer, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_am_bonus(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_rm_bonus(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_daily_outlet_bonus_detail(integer, integer, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_monthly_crew_bonus(integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_am_bonus(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_rm_bonus(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_outlet_bonus_detail(integer, integer, uuid) TO authenticated, service_role;

-- Verifikasi setelah diterapkan (harus false untuk anon, true untuk authenticated):
--   select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('get_monthly_crew_bonus','get_monthly_am_bonus','get_monthly_rm_bonus','get_daily_outlet_bonus_detail');
