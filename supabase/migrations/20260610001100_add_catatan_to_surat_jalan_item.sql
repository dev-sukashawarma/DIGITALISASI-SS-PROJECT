-- Add catatan column to surat_jalan_item for crew rejection notes
-- Required when kondisi = 'rusak' to describe the reason for rejection
-- Apply: supabase db push  OR  paste into Supabase SQL Editor
ALTER TABLE surat_jalan_item ADD COLUMN IF NOT EXISTS catatan TEXT;
