-- Audit lintas-app 2026-07-27/28: dua lapis lubang di surat_jalan/surat_jalan_item.
--
-- LAPIS 1 — RLS tabel:
--  a) surat_jalan_insert_anon / surat_jalan_item_insert_anon (20260610000300)
--     adalah `TO anon WITH CHECK(true)`, komentar aslinya "for testing", tak
--     pernah dihapus → tulis TANPA login sama sekali.
--  b) surat_jalan_insert/update & surat_jalan_item_insert/update (20260610000400)
--     hanya cek `auth.role()='authenticated'` — bukan role/outlet. Siapa pun
--     yang login bisa `.update({status:'diterima_lengkap',...})` outlet mana
--     pun langsung lewat REST, melewati SEMUA validasi bisnis yang ada di RPC
--     verify_surat_jalan_item/finalize_surat_jalan (qty per-item, kondisi,
--     foto wajib jika flagged, dst).
--
-- LAPIS 2 — RPC SECURITY DEFINER (create_surat_jalan, create_surat_jalan_with_number):
--  fungsi SECURITY DEFINER berjalan dengan privilege pemilik fungsi (postgres,
--  BYPASSRLS) — jadi RLS tabel di Lapis 1 TIDAK melindungi jalur RPC ini sama
--  sekali. Kedua RPC nol validasi role/outlet: siapa pun bersesi bisa
--  menerbitkan nomor dokumen + kode verifikasi surat jalan untuk outlet
--  mana pun. Makanya RPC-nya sendiri WAJIB diperbaiki, bukan cuma RLS.
--
-- Yang boleh MENERBITKAN surat jalan (create) = Gudang Pusat (kitchen) +
-- admin/owner untuk eskalasi — konsisten dengan aturan approve_permintaan_svc
-- (lihat apps/stok/src/lib/stok/approver.ts, canApprovePermintaan).
-- UPDATE (send/verify/finalize) di-scope via accessible_outlet_ids() —
-- validasi bisnis rinci (siapa boleh verify item, qty, dst) tetap di RPC
-- send_surat_jalan/verify_surat_jalan_item/finalize_surat_jalan yang sudah
-- benar; policy RLS di sini hanya jaring pengaman terakhir kalau ada yang
-- coba lewat REST langsung.

DROP POLICY IF EXISTS surat_jalan_insert_anon ON surat_jalan;
DROP POLICY IF EXISTS surat_jalan_item_insert_anon ON surat_jalan_item;
DROP POLICY IF EXISTS surat_jalan_insert ON surat_jalan;
DROP POLICY IF EXISTS surat_jalan_update ON surat_jalan;
DROP POLICY IF EXISTS surat_jalan_item_insert ON surat_jalan_item;
DROP POLICY IF EXISTS surat_jalan_item_update ON surat_jalan_item;

CREATE POLICY surat_jalan_insert_scoped
  ON surat_jalan
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner')
    )
  );

CREATE POLICY surat_jalan_update_scoped
  ON surat_jalan
  FOR UPDATE
  USING (outlet_id IN (SELECT accessible_outlet_ids()))
  WITH CHECK (outlet_id IN (SELECT accessible_outlet_ids()));

CREATE POLICY surat_jalan_item_insert_scoped
  ON surat_jalan_item
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner')
    )
  );

CREATE POLICY surat_jalan_item_update_scoped
  ON surat_jalan_item
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM surat_jalan sj
      WHERE sj.id = surat_jalan_item.surat_jalan_id
        AND sj.outlet_id IN (SELECT accessible_outlet_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM surat_jalan sj
      WHERE sj.id = surat_jalan_item.surat_jalan_id
        AND sj.outlet_id IN (SELECT accessible_outlet_ids())
    )
  );

-- Lapis 2: gerbang role di dalam RPC itu sendiri (RLS tak berlaku untuk
-- SECURITY DEFINER, jadi ini WAJIB, bukan opsional).
CREATE OR REPLACE FUNCTION create_surat_jalan(
  p_outlet_id UUID,
  p_items JSONB
)
RETURNS surat_jalan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj surat_jalan;
  v_item JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen) atau admin/owner yang boleh menerbitkan surat jalan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;

  INSERT INTO surat_jalan (outlet_id, created_by)
  VALUES (p_outlet_id, auth.uid())
  RETURNING * INTO v_sj;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
    VALUES (v_sj.id, (v_item->>'bahan_baku_id')::UUID, (v_item->>'qty_dikirim')::NUMERIC);
  END LOOP;

  RETURN v_sj;
END;
$$;

CREATE OR REPLACE FUNCTION create_surat_jalan_with_number(
  p_outlet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sj_id uuid;
  v_document_number text;
  v_verification_code text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('kitchen', 'admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Forbidden: hanya Gudang Pusat (kitchen) atau admin/owner yang boleh menerbitkan surat jalan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM outlets WHERE id = p_outlet_id) THEN
    RAISE EXCEPTION 'outlet % not found', p_outlet_id;
  END IF;

  v_document_number := generate_surat_jalan_number(p_outlet_id);

  INSERT INTO surat_jalan (outlet_id, status, document_number, signatures)
  VALUES (p_outlet_id, 'draft', v_document_number, '[]'::jsonb)
  RETURNING id, verification_code INTO v_sj_id, v_verification_code;

  RETURN jsonb_build_object(
    'id', v_sj_id,
    'document_number', v_document_number,
    'verification_code', v_verification_code
  );
END;
$$;
