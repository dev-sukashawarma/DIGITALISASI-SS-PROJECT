-- Menambahkan fitur toggle "Berlaku untuk Food Apps" pada promo
ALTER TABLE outlet_promos
ADD COLUMN apply_to_food_apps BOOLEAN DEFAULT false NOT NULL;
