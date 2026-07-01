-- 20260630120000_bahan_baku_harga.sql
-- Harga beli per bahan baku (global, terkini). Tabel terpisah dari bahan_baku
-- supaya harga bisa dikunci admin-only sementara nama/satuan tetap terbaca
-- semua staff (alur stok/permintaan/surat jalan tak terganggu).

CREATE TABLE bahan_baku_harga (
  bahan_baku_id    UUID PRIMARY KEY REFERENCES bahan_baku(id) ON DELETE CASCADE,
  harga_beli       NUMERIC NOT NULL DEFAULT 0 CHECK (harga_beli >= 0),
  harga_updated_at TIMESTAMPTZ,
  updated_by       UUID REFERENCES outlet_staff(id)
);

ALTER TABLE bahan_baku_harga ENABLE ROW LEVEL SECURITY;

-- Read: admin only.
CREATE POLICY bbh_read ON bahan_baku_harga FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));

-- Write (insert/update/delete): admin only.
CREATE POLICY bbh_write ON bahan_baku_harga FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'admin'));

-- DOWN:
-- DROP TABLE IF EXISTS bahan_baku_harga;
