-- Fase checklist: 'buka' (sebelum mulai kerja / setelah absen hadir) &
-- 'tutup' (sebelum absen pulang). Default 'buka' agar data lama tetap valid.
ALTER TABLE checklist_categories
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'buka'
  CHECK (phase IN ('buka', 'tutup'));

-- Seed mockup kategori fase 'tutup' (penutupan) untuk tiap outlet — kebalikan
-- dari checklist pembukaan. Idempotent: hanya jika outlet belum punya fase tutup.
DO $$
DECLARE
  outlet_row RECORD;
  cat_keamanan UUID;
  cat_kas UUID;
  cat_kebersihan UUID;
BEGIN
  FOR outlet_row IN SELECT id FROM outlets LOOP
    IF EXISTS (
      SELECT 1 FROM checklist_categories
      WHERE outlet_id = outlet_row.id AND phase = 'tutup'
    ) THEN
      CONTINUE;
    END IF;

    -- Penutupan & Keamanan (kebalikan dari pembukaan)
    INSERT INTO checklist_categories (id, outlet_id, name, phase)
    VALUES (gen_random_uuid(), outlet_row.id, 'Penutupan & Keamanan', 'tutup')
    RETURNING id INTO cat_keamanan;
    INSERT INTO checklist_items (category_id, task_name, is_required) VALUES
      (cat_keamanan, 'Matikan kompor & tutup regulator tabung gas', true),
      (cat_keamanan, 'Matikan peralatan listrik & lampu non-darurat', true),
      (cat_keamanan, 'Pastikan rekaman CCTV tersimpan', true),
      (cat_keamanan, 'Kunci pintu utama & pintu belakang', true);

    -- Kas & Laporan
    INSERT INTO checklist_categories (id, outlet_id, name, phase)
    VALUES (gen_random_uuid(), outlet_row.id, 'Kas & Laporan Harian', 'tutup')
    RETURNING id INTO cat_kas;
    INSERT INTO checklist_items (category_id, task_name, is_required) VALUES
      (cat_kas, 'Hitung & cocokkan uang di laci kasir', true),
      (cat_kas, 'Setor / amankan uang sesuai prosedur', true),
      (cat_kas, 'Catat total penjualan harian', true);

    -- Kebersihan Akhir
    INSERT INTO checklist_categories (id, outlet_id, name, phase)
    VALUES (gen_random_uuid(), outlet_row.id, 'Kebersihan Akhir', 'tutup')
    RETURNING id INTO cat_kebersihan;
    INSERT INTO checklist_items (category_id, task_name, is_required) VALUES
      (cat_kebersihan, 'Bersihkan panggangan & area dapur', true),
      (cat_kebersihan, 'Simpan sisa bahan baku ke pendingin', true),
      (cat_kebersihan, 'Buang sampah & ganti kantong sampah', true),
      (cat_kebersihan, 'Pel lantai area dapur & kasir', false);

  END LOOP;
END $$;


-- Merged from 20260611000300_ledger_feed_spv_view.sql
-- Live activity feed untuk papan monitoring SPV (lintas 19 outlet).
-- Mirror pola monitoring_view_spv: view definer (security_barrier, tanpa
-- security_invoker) sehingga authenticated SPV bisa lihat pergerakan stok
-- semua outlet tanpa terbentur RLS ledger_read (yang dibatasi per-outlet).
CREATE OR REPLACE VIEW ledger_feed_spv AS
SELECT
  l.id,
  l.outlet_id,
  o.name        AS outlet_name,
  l.bahan_baku_id,
  b.nama        AS item_name,
  b.satuan,
  l.tipe,
  l.qty,
  l.catatan,
  l.saldo_sesudah,
  l.created_at
FROM ledger_stok l
JOIN outlets o     ON l.outlet_id = o.id
JOIN bahan_baku b  ON l.bahan_baku_id = b.id
ORDER BY l.created_at DESC;

ALTER VIEW ledger_feed_spv SET (security_barrier = on);

-- Index global untuk query feed (ORDER BY created_at DESC LIMIT N lintas outlet).
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_stok(created_at DESC);
