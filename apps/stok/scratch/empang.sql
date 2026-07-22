INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
SELECT '550e8400-e29b-41d4-a716-446655440009', b.id, 'adjustment', 8000.0/16500,
  'Opname manual oleh admin — Pajajaran: Saos Tomat 8 pouch @1kg (22 Juli 2026)'
FROM bahan_baku b WHERE b.nama='SAOS TOMAT';
