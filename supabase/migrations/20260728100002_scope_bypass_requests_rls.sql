-- Audit lintas-app 2026-07-27/28: ketiga policy bypass_requests adalah
-- USING(true)/WITH CHECK(true) sejak dibuat (20260709020000) meski nama
-- policy menjanjikan scope per-outlet ("Kasir can view ... for their
-- outlet"). Siapa pun yang login (outlet mana pun) bisa baca/insert/update
-- SEMUA pengajuan bypass absensi lintas outlet lewat REST langsung.
--
-- CATATAN PENTING — ini menutup SEBAGIAN masalah, bukan semua:
-- Rute nyata `/api/bypass/approve` memakai service-role client (bypass RLS
-- sepenuhnya) dan middleware pos-kasir sengaja skip `/api/*` dari gate login
-- (magic-link UX untuk SPV yang approve dari WA tanpa perlu login). Baris
-- ini TIDAK menutup akar masalah "pemohon memegang kunci persetujuannya
-- sendiri" (lihat memory approval-key-held-by-requester) — itu perlu
-- keputusan produk (kirim WA server-side via API resmi, atau wajib login
-- approver) sebelum bisa diperbaiki tuntas. Migration ini hanya menutup
-- jalur REST-langsung lintas-outlet sebagai jaring pengaman tambahan.
DROP POLICY IF EXISTS "Kasir can insert bypass requests" ON public.bypass_requests;
CREATE POLICY "bypass_requests_insert_scoped"
    ON public.bypass_requests FOR INSERT
    WITH CHECK (outlet_id IN (SELECT accessible_outlet_ids()));

DROP POLICY IF EXISTS "Kasir can view bypass requests for their outlet" ON public.bypass_requests;
CREATE POLICY "bypass_requests_select_scoped"
    ON public.bypass_requests FOR SELECT
    USING (outlet_id IN (SELECT accessible_outlet_ids()));

DROP POLICY IF EXISTS "SPV can update bypass requests" ON public.bypass_requests;
CREATE POLICY "bypass_requests_update_scoped"
    ON public.bypass_requests FOR UPDATE
    USING (outlet_id IN (SELECT accessible_outlet_ids()))
    WITH CHECK (outlet_id IN (SELECT accessible_outlet_ids()));
