-- Migration to sync harga_beli_display when harga_beli changes

CREATE OR REPLACE FUNCTION sync_harga_beli_display() RETURNS trigger AS $$
DECLARE
   v_fk NUMERIC;
BEGIN
   IF TG_OP = 'INSERT' OR NEW.harga_beli IS DISTINCT FROM OLD.harga_beli THEN
      SELECT COALESCE(faktor_konversi, 1) INTO v_fk FROM bahan_baku WHERE id = NEW.bahan_baku_id;
      
      -- Only calculate if kemasan_qty exists, otherwise fallback to harga_beli
      IF NEW.kemasan_qty IS NOT NULL AND NEW.kemasan_qty > 0 THEN
         NEW.harga_beli_display := (NEW.harga_beli / v_fk) * NEW.kemasan_qty;
      ELSE
         NEW.harga_beli_display := NEW.harga_beli;
      END IF;
   END IF;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_harga_beli_display ON bahan_baku_harga;
CREATE TRIGGER trg_sync_harga_beli_display
BEFORE INSERT OR UPDATE ON bahan_baku_harga
FOR EACH ROW EXECUTE FUNCTION sync_harga_beli_display();

-- Update existing corrupted rows manually for now (the ones updated before the trigger)
UPDATE bahan_baku_harga h
SET harga_beli_display = (h.harga_beli / COALESCE(b.faktor_konversi, 1)) * COALESCE(h.kemasan_qty, 1)
FROM bahan_baku b
WHERE h.bahan_baku_id = b.id AND h.kemasan_qty IS NOT NULL;
