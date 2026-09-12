-- 20260911120000_drop_ship_skema.sql
-- Skema drop-ship: vendor mengantar LANGSUNG ke outlet (sayur/Pak Aziz).
-- Spec: docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md
-- Belum ada penulis stok di migration ini -- trigger & RPC di 20260911121000.

-- ledger_stok dilewati tiap order POS. Kalau lock-nya tak didapat cepat, GAGAL
-- dan ulangi nanti -- jangan mengantre lalu memblokir penjualan di belakangnya.
SET lock_timeout = '5s';

-- Peran pemanggil, satu tempat. NULL bila bukan staff aktif.
CREATE OR REPLACE FUNCTION public.peran_saya()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.role FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active'
$$;
REVOKE ALL ON FUNCTION public.peran_saya() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peran_saya() TO authenticated, service_role;

-- Periode tagihan tetap: 1-10 -> tgl 10, 11-20 -> tgl 20, 21-akhir -> hari terakhir.
-- CERMIN apps/stok/src/lib/stok/periodeTagihan.ts -- ubah keduanya bersamaan.
CREATE OR REPLACE FUNCTION public.periode_tagihan(p_tanggal date)
RETURNS TABLE(mulai date, akhir date, tanggal_tagihan date)
LANGUAGE sql IMMUTABLE AS $$
  WITH b AS (SELECT date_trunc('month', p_tanggal)::date AS awal,
                    (date_trunc('month', p_tanggal) + interval '1 month - 1 day')::date AS akhir_bulan,
                    extract(day FROM p_tanggal)::int AS hari)
  SELECT CASE WHEN hari <= 10 THEN awal WHEN hari <= 20 THEN awal + 10 ELSE awal + 20 END,
         CASE WHEN hari <= 10 THEN awal + 9 WHEN hari <= 20 THEN awal + 19 ELSE akhir_bulan END,
         CASE WHEN hari <= 10 THEN awal + 9 WHEN hari <= 20 THEN awal + 19 ELSE akhir_bulan END
    FROM b
$$;

CREATE TABLE IF NOT EXISTS public.nota_vendor (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid NOT NULL REFERENCES public.supplier(id),
  periode_mulai    date NOT NULL,
  periode_akhir    date NOT NULL,
  tanggal_tagihan  date NOT NULL,
  total_kg_nota    numeric NOT NULL CHECK (total_kg_nota > 0),
  total_rupiah_nota numeric NOT NULL CHECK (total_rupiah_nota > 0),
  foto_nota_url    text NOT NULL CHECK (length(btrim(foto_nota_url)) > 0),
  status           text NOT NULL DEFAULT 'disahkan' CHECK (status IN ('disahkan','dibatalkan')),
  disahkan_oleh    uuid REFERENCES public.outlet_staff(id),
  disahkan_at      timestamptz NOT NULL DEFAULT now(),
  purchase_order_id uuid REFERENCES public.purchase_order(id),
  catatan_selisih  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- Satu nota sah per vendor per periode.
CREATE UNIQUE INDEX IF NOT EXISTS nota_vendor_unik_periode
  ON public.nota_vendor (supplier_id, tanggal_tagihan) WHERE status = 'disahkan';

CREATE TABLE IF NOT EXISTS public.nota_vendor_rincian (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_vendor_id  uuid NOT NULL REFERENCES public.nota_vendor(id) ON DELETE CASCADE,
  outlet_id       uuid NOT NULL REFERENCES public.outlets(id),
  tanggal_kirim   date,
  qty_kg          numeric NOT NULL CHECK (qty_kg > 0)
);

CREATE TABLE IF NOT EXISTS public.terima_vendor_outlet (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id       uuid NOT NULL REFERENCES public.outlets(id),
  supplier_id     uuid NOT NULL REFERENCES public.supplier(id),
  bahan_baku_id   uuid NOT NULL REFERENCES public.bahan_baku(id),
  qty             numeric NOT NULL CHECK (qty > 0),           -- SATUAN BESAR
  harga_snapshot  numeric NOT NULL DEFAULT 0 CHECK (harga_snapshot >= 0),
  tanggal_terima  date NOT NULL,
  status          text NOT NULL DEFAULT 'dicatat' CHECK (status IN ('dicatat','disahkan','ditolak')),
  nota_vendor_id  uuid REFERENCES public.nota_vendor(id),
  catatan         text,
  foto_url        text,
  dicatat_oleh    uuid NOT NULL REFERENCES public.outlet_staff(id),
  dicatat_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tvo_periode ON public.terima_vendor_outlet (supplier_id, tanggal_terima);
CREATE INDEX IF NOT EXISTS tvo_outlet  ON public.terima_vendor_outlet (outlet_id, tanggal_terima);

-- ledger_stok: ~664 ribu baris, tabel panas (setiap potongan BOM tiap order lewat
-- sini). ADD COLUMN nullable tanpa FK inline dulu, baru tambah constraint NOT VALID
-- + VALIDATE sebagai statement terpisah -- hindari ACCESS EXCLUSIVE lock lama yang
-- sekaligus scan+validate (ruling R2, brief Task 2).
ALTER TABLE public.ledger_stok
  ADD COLUMN IF NOT EXISTS ref_terima_vendor_id uuid;

-- Postgres tidak punya "ADD CONSTRAINT IF NOT EXISTS" untuk FK -- guard manual
-- lewat pg_constraint agar migration ini aman dijalankan ulang.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ledger_stok_ref_terima_vendor_id_fkey'
       AND conrelid = 'public.ledger_stok'::regclass
  ) THEN
    ALTER TABLE public.ledger_stok
      ADD CONSTRAINT ledger_stok_ref_terima_vendor_id_fkey
      FOREIGN KEY (ref_terima_vendor_id) REFERENCES public.terima_vendor_outlet(id) NOT VALID;
  END IF;
END $$;

-- No-op cepat (cek flag convalidated) bila constraint sudah tervalidasi sebelumnya.
ALTER TABLE public.ledger_stok
  VALIDATE CONSTRAINT ledger_stok_ref_terima_vendor_id_fkey;

CREATE INDEX IF NOT EXISTS ledger_ref_terima_vendor ON public.ledger_stok (ref_terima_vendor_id)
  WHERE ref_terima_vendor_id IS NOT NULL;

ALTER TABLE public.purchase_order
  ADD COLUMN IF NOT EXISTS nota_vendor_id uuid REFERENCES public.nota_vendor(id);

-- RLS: baca ber-scope, tulis HANYA lewat RPC.
ALTER TABLE public.terima_vendor_outlet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_vendor          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_vendor_rincian  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tvo_select ON public.terima_vendor_outlet;
CREATE POLICY tvo_select ON public.terima_vendor_outlet FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids())
         OR public.peran_saya() IN ('purchasing','kitchen','admin','owner','admin_finance'));

DROP POLICY IF EXISTS nv_select ON public.nota_vendor;
CREATE POLICY nv_select ON public.nota_vendor FOR SELECT TO authenticated
  USING (public.peran_saya() IN ('purchasing','kitchen','admin','owner','admin_finance'));

DROP POLICY IF EXISTS nvr_select ON public.nota_vendor_rincian;
CREATE POLICY nvr_select ON public.nota_vendor_rincian FOR SELECT TO authenticated
  USING (public.peran_saya() IN ('purchasing','kitchen','admin','owner','admin_finance'));

REVOKE ALL ON public.terima_vendor_outlet, public.nota_vendor, public.nota_vendor_rincian FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.terima_vendor_outlet, public.nota_vendor, public.nota_vendor_rincian FROM authenticated;
GRANT SELECT ON public.terima_vendor_outlet, public.nota_vendor, public.nota_vendor_rincian TO authenticated;

-- Bucket foto: nota (pengesah) & bukti terima opsional (crew).
-- po-invoices tidak dipakai: INSERT-nya hanya admin & kitchen, purchasing ditolak.
INSERT INTO storage.buckets (id, name, public) VALUES ('drop-ship', 'drop-ship', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS drop_ship_insert ON storage.objects;
CREATE POLICY drop_ship_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'drop-ship' AND public.peran_saya() IS NOT NULL);
DROP POLICY IF EXISTS drop_ship_select ON storage.objects;
CREATE POLICY drop_ship_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'drop-ship' AND public.peran_saya() IS NOT NULL);

-- DOWN:
-- DROP POLICY IF EXISTS drop_ship_select ON storage.objects;
-- DROP POLICY IF EXISTS drop_ship_insert ON storage.objects;
-- ALTER TABLE public.purchase_order DROP COLUMN IF EXISTS nota_vendor_id;
-- ALTER TABLE public.ledger_stok DROP CONSTRAINT IF EXISTS ledger_stok_ref_terima_vendor_id_fkey;
-- ALTER TABLE public.ledger_stok DROP COLUMN IF EXISTS ref_terima_vendor_id;
-- DROP TABLE IF EXISTS public.terima_vendor_outlet, public.nota_vendor_rincian, public.nota_vendor;
-- DROP FUNCTION IF EXISTS public.periode_tagihan(date), public.peran_saya();
