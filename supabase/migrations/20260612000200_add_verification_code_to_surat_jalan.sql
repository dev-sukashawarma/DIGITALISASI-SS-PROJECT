-- Add verification_code field to surat_jalan
ALTER TABLE surat_jalan ADD COLUMN IF NOT EXISTS verification_code text;

-- Update existing rows to have a unique random 6-character code
UPDATE surat_jalan
SET verification_code = UPPER(SUBSTRING(MD5(id::text || RANDOM()::text) FROM 1 FOR 6))
WHERE verification_code IS NULL;

-- Enforce UNIQUE constraint on verification_code
ALTER TABLE surat_jalan ADD CONSTRAINT surat_jalan_verification_code_key UNIQUE (verification_code);

-- Set default value for future insertions
ALTER TABLE surat_jalan ALTER COLUMN verification_code SET DEFAULT UPPER(SUBSTRING(MD5(gen_random_uuid()::text || RANDOM()::text) FROM 1 FOR 6));

-- Drop existing function first to avoid return type signature mismatch if any
DROP FUNCTION IF EXISTS create_surat_jalan_with_number(uuid);

-- Update RPC function to return verification_code in response
CREATE OR REPLACE FUNCTION create_surat_jalan_with_number(
  p_outlet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sj_id uuid;
  v_document_number text;
  v_verification_code text;
BEGIN
  -- Generate document number
  v_document_number := generate_surat_jalan_number(p_outlet_id);

  -- Create surat jalan
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
