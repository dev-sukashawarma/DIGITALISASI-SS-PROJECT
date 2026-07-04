-- Bahan baku baru dari COGS cards (SS COGS SET) yang belum ada di master.
-- satuan/kategori provisional (ikut gaya seed 20260609001800). Sesuaikan bila perlu.
-- Aman dijalankan ulang: ON CONFLICT (nama) DO NOTHING.
--
-- SAUS CABE/TOMAT: satuan = kg (BUKAN crt) — disetujui owner 2026-07-04, karena kemasan
-- datang tidak tetap (kompan 5,5kg / pouch 1kg). Stok dicatat berdasarkan berat aktual.
-- default_reorder_point 15 kg = tebakan awal (setara ~3 kompan/15 pouch); sesuaikan owner.

INSERT INTO bahan_baku (nama, satuan, kategori, default_reorder_point) VALUES
  ('SAUS CABE/TOMAT', 'kg',  'saus',    15),
  ('PLASTIK VACUM',   'pcs', 'kemasan', 50),
  ('CUP + TUTUP',     'pcs', 'kemasan', 50),
  ('DUS PACKING',     'pcs', 'kemasan', 50),
  ('ES BATU',         'pcs', 'minuman', 20),
  ('MIE',             'pcs', 'lainnya', 20),
  ('POWDER MIX',      'kg',  'minuman', 5),
  ('STIKER',          'pcs', 'kemasan', 50)
ON CONFLICT (nama) DO NOTHING;
