CREATE TABLE IF NOT EXISTS pos_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marcom_endorsement_id BIGINT UNIQUE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  outlet_name TEXT NOT NULL,
  kol_id BIGINT,
  kol_name TEXT NOT NULL,
  kol_handle TEXT,
  kol_phone TEXT,
  schedule_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CLAIMED', 'EXPIRED', 'CANCELLED')),
  claimed_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  pos_order_number INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_endorsements_outlet_date ON pos_endorsements(outlet_id, schedule_date, status);

ALTER TABLE pos_endorsements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_endorsements_select_all" ON pos_endorsements;
CREATE POLICY "pos_endorsements_select_all" ON pos_endorsements FOR SELECT USING (true);

DROP POLICY IF EXISTS "pos_endorsements_all_service" ON pos_endorsements;
CREATE POLICY "pos_endorsements_all_service" ON pos_endorsements FOR ALL USING (true);
