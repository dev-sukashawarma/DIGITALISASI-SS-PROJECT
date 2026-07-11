-- Add region column to outlets table
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS region text;
