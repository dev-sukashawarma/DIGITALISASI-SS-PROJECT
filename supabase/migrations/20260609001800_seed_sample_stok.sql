-- DEV SAMPLE ONLY. Real bahan_baku list menyusul from owner; safe to delete later.
INSERT INTO bahan_baku (nama, satuan, kategori, default_reorder_point) VALUES
  ('Daging Ayam', 'kg', 'protein', 30),
  ('Daging Sapi', 'kg', 'protein', 20),
  ('Roti Pita', 'pcs', 'roti', 100),
  ('Saus Mayo', 'botol', 'saus', 12),
  ('Saus Sambal', 'botol', 'saus', 12),
  ('Selada', 'kg', 'sayur', 8),
  ('Tomat', 'kg', 'sayur', 8),
  ('Bawang Bombay', 'kg', 'sayur', 5),
  ('Kemasan Box', 'pcs', 'kemasan', 200),
  ('Bumbu Shawarma', 'pack', 'bumbu', 10)
ON CONFLICT (nama) DO NOTHING;

-- one global recipe (BOM) example: shawarma ayam
INSERT INTO resep (menu_item_ref, nama, scope) VALUES ('menu-shawarma-ayam','Shawarma Ayam','global')
ON CONFLICT DO NOTHING;

INSERT INTO resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
SELECT r.id, b.id, v.qty, b.satuan
FROM resep r
JOIN (VALUES ('Daging Ayam',0.15),('Roti Pita',1),('Saus Mayo',0.02),('Selada',0.03))
     AS v(nama, qty) ON true
JOIN bahan_baku b ON b.nama = v.nama
WHERE r.menu_item_ref = 'menu-shawarma-ayam'
ON CONFLICT (resep_id, bahan_baku_id) DO NOTHING;
