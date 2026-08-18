-- 20300108000007_permintaan_budget_outlet_schema.sql
-- Budget pembelian per outlet: plafon Rupiah per periode, diset owner.
-- Lihat docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md §4.
-- Aditif & idempoten.

CREATE TABLE IF NOT EXISTS outlet_budget_config (
  outlet_id      UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  nominal        NUMERIC NOT NULL CHECK (nominal >= 0),
  period_type    TEXT NOT NULL CHECK (period_type IN ('harian', 'mingguan', 'bulanan')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by     UUID REFERENCES outlet_staff(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE outlet_budget_config ENABLE ROW LEVEL SECURITY;

-- Read: outlet sendiri (crew) atau semua outlet accessible (kitchen/admin/owner/spv/leader).
DROP POLICY IF EXISTS obc_select ON outlet_budget_config;
CREATE POLICY obc_select ON outlet_budget_config FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));

-- Write: owner-only.
DROP POLICY IF EXISTS obc_write ON outlet_budget_config;
CREATE POLICY obc_write ON outlet_budget_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'owner' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'owner' AND status = 'active'));

-- Snapshot harga saat item disetujui (diisi oleh approve_permintaan_svc, lihat migration 20300108000008).
ALTER TABLE permintaan_bahan_item
  ADD COLUMN IF NOT EXISTS harga_snapshot NUMERIC;

-- Realtime: tambah ke publication supaya useRealtimeInvalidate di client bisa subscribe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'outlet_budget_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_budget_config;
  END IF;
END $$;

-- DOWN:
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS outlet_budget_config;
-- ALTER TABLE permintaan_bahan_item DROP COLUMN IF EXISTS harga_snapshot;
-- DROP TABLE IF EXISTS outlet_budget_config;
