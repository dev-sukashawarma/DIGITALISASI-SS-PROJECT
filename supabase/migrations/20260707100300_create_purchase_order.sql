-- 20260707100300_create_purchase_order.sql
-- Tabel Purchase Order (PO): merekam pembelian bahan baku dari supplier ke Kitchen Bogor.
--
-- Alur: draft → dikirim_ke_supplier → (sebagian_diterima | diterima_lengkap) | dibatalkan
-- Saat PO diverifikasi (sebagian/lengkap), trigger otomatis:
--   1. Stok kitchen naik (ledger tipe='pembelian_supplier')
--   2. Harga bahan baku di bahan_baku_harga di-update ke harga_terima aktual

-- ============================================================
-- purchase_order: header dokumen pembelian
-- ============================================================
CREATE TABLE public.purchase_order (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_po        TEXT        NOT NULL UNIQUE,
  -- Format: PO/KITCHEN/YYYYMMDD/0001
  supplier_id     UUID        REFERENCES public.supplier(id) ON DELETE SET NULL,
  supplier_nama   TEXT        NOT NULL,
  -- Di-denormalisasi dari supplier.nama saat PO dibuat, agar histori stabil
  -- meski supplier di-rename atau dihapus.
  tanggal_po      DATE        NOT NULL DEFAULT CURRENT_DATE,
  tanggal_estimasi_tiba DATE,              -- estimasi supplier kirim (opsional)
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN (
                    'draft',               -- baru dibuat, belum dikirim ke supplier
                    'dikirim_ke_supplier', -- PO sudah dikirim/dikonfirmasi ke supplier
                    'sebagian_diterima',   -- sebagian item sudah diterima
                    'diterima_lengkap',    -- semua item diterima
                    'dibatalkan'           -- PO dibatalkan
                  )),
  catatan         TEXT,
  dibuat_oleh     UUID        REFERENCES public.outlet_staff(id),
  diverifikasi_oleh UUID      REFERENCES public.outlet_staff(id),
  diverifikasi_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_status     ON public.purchase_order(status);
CREATE INDEX idx_po_tanggal    ON public.purchase_order(tanggal_po DESC);
CREATE INDEX idx_po_supplier   ON public.purchase_order(supplier_id);
CREATE INDEX idx_po_created_at ON public.purchase_order(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.po_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_po_updated_at
  BEFORE UPDATE ON public.purchase_order
  FOR EACH ROW EXECUTE FUNCTION public.po_set_updated_at();

-- ============================================================
-- purchase_order_item: baris per bahan baku dalam 1 PO
-- ============================================================
CREATE TABLE public.purchase_order_item (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID      NOT NULL REFERENCES public.purchase_order(id) ON DELETE CASCADE,
  bahan_baku_id       UUID      NOT NULL REFERENCES public.bahan_baku(id) ON DELETE RESTRICT,

  -- Data pesan (dari negosiasi / estimasi)
  qty_pesan           NUMERIC   NOT NULL CHECK (qty_pesan > 0),
  harga_pesan         NUMERIC   NOT NULL DEFAULT 0 CHECK (harga_pesan >= 0),

  -- Data aktual saat terima barang (diisi saat verifikasi)
  qty_terima          NUMERIC   CHECK (qty_terima >= 0),
  harga_terima        NUMERIC   CHECK (harga_terima >= 0),
  kondisi             TEXT      CHECK (kondisi IN ('baik', 'rusak', 'kurang')),
  catatan             TEXT,

  -- Komputasi
  subtotal            NUMERIC   GENERATED ALWAYS AS (
    COALESCE(qty_terima, qty_pesan) * COALESCE(harga_terima, harga_pesan, 0)
  ) STORED,

  UNIQUE(purchase_order_id, bahan_baku_id)
);

CREATE INDEX idx_poi_po       ON public.purchase_order_item(purchase_order_id);
CREATE INDEX idx_poi_bahan    ON public.purchase_order_item(bahan_baku_id);

-- ============================================================
-- Auto-generate nomor PO: PO/KITCHEN/YYYYMMDD/0001
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_nomor_po()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date    TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_prefix  TEXT := 'PO/KITCHEN/' || v_date || '/';
  v_seq     INT;
  v_nomor   TEXT;
BEGIN
  SELECT COUNT(*) + 1
    INTO v_seq
    FROM public.purchase_order
    WHERE nomor_po LIKE v_prefix || '%';

  v_nomor := v_prefix || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_nomor;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_item TO authenticated;

-- DOWN:
-- DROP TABLE IF EXISTS public.purchase_order_item CASCADE;
-- DROP TABLE IF EXISTS public.purchase_order CASCADE;
-- DROP FUNCTION IF EXISTS public.generate_nomor_po();
