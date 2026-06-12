-- DEV SAMPLE ONLY. Insert sample surat_jalan for testing.
-- (Assumes outlets + bahan_baku + outlet_staff already seeded from M0 + M2)

-- Insert 2 sample surat_jalan (one per outlet, different statuses)
INSERT INTO surat_jalan (outlet_id, status, created_by, notes)
SELECT id, 'dikirim',
  (SELECT id FROM outlet_staff WHERE role = 'spv' LIMIT 1),
  'Sample SJ untuk testing'
FROM outlets LIMIT 2
ON CONFLICT DO NOTHING;

-- Insert sample items for the first surat_jalan
INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
SELECT sj.id, bb.id, 50
FROM surat_jalan sj
JOIN bahan_baku bb ON bb.nama = 'Daging Ayam'
WHERE sj.status = 'dikirim'
LIMIT 1
ON CONFLICT (surat_jalan_id, bahan_baku_id) DO NOTHING;

INSERT INTO surat_jalan_item (surat_jalan_id, bahan_baku_id, qty_dikirim)
SELECT sj.id, bb.id, 100
FROM surat_jalan sj
JOIN bahan_baku bb ON bb.nama = 'Roti Pita'
WHERE sj.status = 'dikirim'
LIMIT 1
ON CONFLICT (surat_jalan_id, bahan_baku_id) DO NOTHING;
