-- 20260707100200_create_supplier.sql
-- Tabel master supplier: pemasok bahan baku ke Gudang Pusat (Kitchen Bogor).
-- Dipakai sebagai referensi di purchase_order; bukan wajib (fallback ke nama teks).

CREATE TABLE public.supplier (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        TEXT        NOT NULL,
  kontak      TEXT,                         -- nomor HP / WhatsApp PIC supplier
  alamat      TEXT,                         -- alamat lengkap supplier
  kategori    TEXT        CHECK (kategori IN (
                'protein', 'sayur', 'bumbu', 'saus', 'kemasan',
                'minuman', 'gas', 'lainnya'
              )),                           -- kategori utama bahan yang dipasok
  catatan     TEXT,                         -- catatan bebas (syarat pembayaran, dll)
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        REFERENCES public.outlet_staff(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplier_is_active ON public.supplier(is_active);
CREATE INDEX idx_supplier_nama      ON public.supplier(nama);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.supplier_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_supplier_updated_at
  BEFORE UPDATE ON public.supplier
  FOR EACH ROW EXECUTE FUNCTION public.supplier_set_updated_at();

-- RLS
ALTER TABLE public.supplier ENABLE ROW LEVEL SECURITY;

-- SELECT: admin + kitchen
CREATE POLICY supplier_select ON public.supplier
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin', 'kitchen')
  ));

-- INSERT/UPDATE: admin + kitchen
CREATE POLICY supplier_write ON public.supplier
  FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'kitchen')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = auth.uid() AND role IN ('admin', 'kitchen')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier TO authenticated;

-- DOWN:
-- DROP TABLE IF EXISTS public.supplier CASCADE;
