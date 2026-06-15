-- outlet_staff table: canonical identity for all outlet workers
CREATE TABLE outlet_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('crew', 'kasir', 'spv', 'kepala_outlet')),
  face_descriptor JSONB,
  ref_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, name)
);

-- Indexes
CREATE INDEX idx_outlet_staff_outlet_id ON outlet_staff(outlet_id);
CREATE INDEX idx_outlet_staff_outlet_role ON outlet_staff(outlet_id, role);
CREATE INDEX idx_outlet_staff_status ON outlet_staff(status);
