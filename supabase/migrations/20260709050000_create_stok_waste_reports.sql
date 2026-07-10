-- Create waste_evidence bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('waste_evidence', 'waste_evidence', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "waste_evidence public access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'waste_evidence' );

CREATE POLICY "waste_evidence insert access"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'waste_evidence' );

CREATE POLICY "waste_evidence update access"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'waste_evidence' );

CREATE POLICY "waste_evidence delete access"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'waste_evidence' );

-- Create stok_waste_reports table
CREATE TABLE stok_waste_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  qty NUMERIC NOT NULL CHECK (qty > 0),
  reason TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  rejection_reason TEXT,
  reported_by UUID REFERENCES outlet_staff(id),
  approved_by UUID REFERENCES outlet_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_waste_reports_outlet_status ON stok_waste_reports(outlet_id, status);

-- Add ref_waste_id to ledger_stok
ALTER TABLE ledger_stok ADD COLUMN ref_waste_id UUID REFERENCES stok_waste_reports(id);

-- Enable RLS
ALTER TABLE stok_waste_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY waste_reports_read ON stok_waste_reports
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

CREATE POLICY waste_reports_insert ON stok_waste_reports
  FOR INSERT TO authenticated
  WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

CREATE POLICY waste_reports_update ON stok_waste_reports
  FOR UPDATE TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

-- Trigger to deduct stock automatically when APPROVED
CREATE OR REPLACE FUNCTION process_waste_report_approval() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING' THEN
    INSERT INTO ledger_stok (
      outlet_id, 
      bahan_baku_id, 
      tipe, 
      qty, 
      catatan, 
      ref_waste_id, 
      created_by
    ) VALUES (
      NEW.outlet_id,
      NEW.bahan_baku_id,
      'waste',
      -NEW.qty,
      'Approval waste: ' || NEW.reason,
      NEW.id,
      NEW.approved_by
    );
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_waste_report_approval
  BEFORE UPDATE ON stok_waste_reports
  FOR EACH ROW EXECUTE FUNCTION process_waste_report_approval();
