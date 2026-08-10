ALTER TABLE mitra_investments 
ADD COLUMN IF NOT EXISTS omzet_historis numeric DEFAULT 0;

ALTER TABLE mitra_investments 
ADD COLUMN IF NOT EXISTS transfer_historis numeric DEFAULT 0;
