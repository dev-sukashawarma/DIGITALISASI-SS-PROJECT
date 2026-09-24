-- App Retail Tahap 1 -- pengaman operasional (spec 2026-09-24).
-- Aditif: 4 tabel baru + 1 trigger di orders. Tak mengubah kolom yang ada.

-- 1. Pengaturan aplikasi (satu baris)
CREATE TABLE IF NOT EXISTS public.app_pengaturan (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  menit_pesan_terakhir int NOT NULL DEFAULT 30 CHECK (menit_pesan_terakhir BETWEEN 0 AND 180),
  menit_tertahan int NOT NULL DEFAULT 10 CHECK (menit_tertahan BETWEEN 1 AND 120),
  estimasi_siap text NOT NULL DEFAULT '15–20 menit' CHECK (char_length(estimasi_siap) BETWEEN 1 AND 40),
  wa_cs text NULL CHECK (wa_cs IS NULL OR wa_cs ~ '^62[0-9]{8,13}$'),
  versi_minimum_android int NOT NULL DEFAULT 1 CHECK (versi_minimum_android >= 1),
  url_syarat text NULL CHECK (url_syarat IS NULL OR url_syarat ~ '^https://'),
  url_privasi text NULL CHECK (url_privasi IS NULL OR url_privasi ~ '^https://'),
  diubah_oleh uuid NULL,
  diubah_pada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_pengaturan (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Tutup sementara (outlet_id NULL = semua outlet). Tak pernah dihapus.
CREATE TABLE IF NOT EXISTS public.outlet_tutup_sementara (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  sampai timestamptz NOT NULL,
  alasan text NULL CHECK (alasan IS NULL OR char_length(alasan) <= 120),
  dibuat_oleh uuid NOT NULL,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  dicabut_oleh uuid NULL,
  dicabut_pada timestamptz NULL,
  CHECK (sampai > dibuat_pada)
);
CREATE INDEX IF NOT EXISTS outlet_tutup_sementara_aktif_idx
  ON public.outlet_tutup_sementara (outlet_id, sampai) WHERE dicabut_pada IS NULL;

-- 3. Antrean refund
CREATE TABLE IF NOT EXISTS retail.refund_pesanan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  nominal numeric NOT NULL CHECK (nominal >= 0),
  status text NOT NULL DEFAULT 'perlu' CHECK (status IN ('perlu','sudah')),
  catatan text NULL,
  diproses_oleh uuid NULL,
  diproses_pada timestamptz NULL,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'perlu' OR (catatan IS NOT NULL AND diproses_pada IS NOT NULL))
);

-- 4. Log perubahan (INSERT saja)
CREATE TABLE IF NOT EXISTS public.app_retail_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aksi text NOT NULL CHECK (aksi IN ('pengaturan_ubah','tutup_sementara','buka_sekarang','jam_ubah','menu_habis_ubah','refund_selesai')),
  sasaran_id uuid NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  oleh uuid NOT NULL,
  pada timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_retail_log_pada_idx ON public.app_retail_log (pada DESC);

-- 5. Trigger: pesanan aplikasi yang dibatalkan SETELAH dibayar -> antrean refund.
-- Trigger (bukan route gateway) karena sinyal POS -> gateway fire-and-forget.
CREATE OR REPLACE FUNCTION retail.catat_refund_pesanan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, retail
AS $$
BEGIN
  INSERT INTO retail.refund_pesanan (order_id, draft_id, customer_id, outlet_id, nominal)
  SELECT NEW.id, d.id, d.customer_id, d.outlet_id, d.total_amount
  FROM retail.order_drafts d
  WHERE d.pos_order_id = NEW.id AND d.status = 'dibayar'
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catat_refund_pesanan ON public.orders;
CREATE TRIGGER trg_catat_refund_pesanan
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.sales_source = 'app')
  EXECUTE FUNCTION retail.catat_refund_pesanan();

-- 6. Hak akses. Default privileges Supabase memberi ALL ke tabel baru.
REVOKE ALL ON public.app_pengaturan, public.outlet_tutup_sementara, public.app_retail_log FROM anon, authenticated;
REVOKE ALL ON retail.refund_pesanan FROM anon, authenticated;
GRANT SELECT ON public.app_pengaturan, public.outlet_tutup_sementara, public.app_retail_log TO authenticated;
GRANT SELECT ON retail.refund_pesanan TO authenticated;

ALTER TABLE public.app_pengaturan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_tutup_sementara ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_retail_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.refund_pesanan ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_pengaturan_baca ON public.app_pengaturan FOR SELECT TO authenticated USING (public.is_owner_or_admin());
CREATE POLICY outlet_tutup_sementara_baca ON public.outlet_tutup_sementara FOR SELECT TO authenticated USING (public.is_owner_or_admin());
CREATE POLICY app_retail_log_baca ON public.app_retail_log FOR SELECT TO authenticated USING (public.is_owner_or_admin());
CREATE POLICY refund_pesanan_baca ON retail.refund_pesanan FOR SELECT TO authenticated USING (public.is_owner_or_admin());

REVOKE ALL ON FUNCTION retail.catat_refund_pesanan() FROM PUBLIC, anon, authenticated;
