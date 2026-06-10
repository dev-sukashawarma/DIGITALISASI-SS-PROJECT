-- Real bahan_baku dari outlet master (38 items)
INSERT INTO bahan_baku (nama, satuan, kategori, default_reorder_point) VALUES
  ('SAUS X HOT', 'crt', 'saus', 5),
  ('SAUS TOMAT', 'crt', 'saus', 5),
  ('SAOS SAMYANG', 'crt', 'saus', 5),
  ('MAYONES', 'crt', 'saus', 5),
  ('KULIT 25', 'pack', 'kemasan', 20),
  ('KULIT 28', 'pack', 'kemasan', 20),
  ('KULIT 32', 'pack', 'kemasan', 20),
  ('AYAM', 'kg', 'protein', 30),
  ('SAPI', 'pcs', 'protein', 10),
  ('KENTANG', 'pack', 'sayur', 10),
  ('TEPUNG', 'kg', 'bumbu', 10),
  ('TUM', 'kg', 'bumbu', 5),
  ('BAWANG', 'kg', 'sayur', 5),
  ('MINYAK SAYUR', 'kompan', 'saus', 2),
  ('POLYBAG', 'pack', 'kemasan', 50),
  ('PLASTIK MERAH', 'pack', 'kemasan', 50),
  ('FOIL', 'crt', 'kemasan', 10),
  ('KEJU', 'crt', 'saus', 5),
  ('PLASTIK BESAR', 'pack', 'kemasan', 50),
  ('SARUNG TANGAN BENI', 'pack', 'kemasan', 30),
  ('KERTAS STRUK', 'pack', 'kemasan', 50),
  ('PAPER WRAP', 'pcs', 'kemasan', 100),
  ('LETTUCE', 'kg', 'sayur', 5),
  ('GAS 3Kg', 'pcs', 'lainnya', 2),
  ('SABUN', 'pcs', 'lainnya', 10),
  ('SASA', 'pack', 'saus', 5),
  ('GARAM', 'pack', 'bumbu', 5),
  ('KUNYIT', 'crt', 'bumbu', 5),
  ('KETUMBAR', 'kg', 'bumbu', 2),
  ('KAYU MANIS', 'kg', 'bumbu', 2),
  ('PLASTIK KECIL', 'ikat', 'kemasan', 50),
  ('JINTEN', 'kg', 'bumbu', 2),
  ('CENGKEH', 'kg', 'bumbu', 2)
ON CONFLICT (nama) DO NOTHING;

-- BOM (resep/resep_item) structure is built for M2 but not seeded.
-- M2 does NOT auto-deduct BOM (awaiting POS feed in M4).
-- Resep can be created manually in M4 owner dashboard for M5 auto-deduction.
