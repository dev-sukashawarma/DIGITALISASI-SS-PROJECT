-- 20260914160000_skema_retur_refund_bahan.sql
-- Modul Retur & Refund Bahan Baku (Item Core: Ayam, Sapi, Kulit)
-- Alur: Outlet -> Persetujuan AM/RM -> Serah Terima Kurir (Internal/3PL) -> Timbang Kitchen -> SJ Pengganti

-- 1. Tambah kolom is_refundable pada tabel bahan_baku
ALTER TABLE public.bahan_baku
  ADD COLUMN IF NOT EXISTS is_refundable BOOLEAN DEFAULT FALSE;

-- Tandai item core sebagai refundable
UPDATE public.bahan_baku
SET is_refundable = TRUE
WHERE UPPER(TRIM(nama)) IN ('AYAM', 'SAPI', 'KULIT 25', 'KULIT 28', 'KULIT 32');

-- 2. Perluas CHECK constraint ledger_stok_tipe_check
ALTER TABLE public.ledger_stok DROP CONSTRAINT IF EXISTS ledger_stok_tipe_check;
ALTER TABLE public.ledger_stok ADD CONSTRAINT ledger_stok_tipe_check
  CHECK (tipe IN (
    'terima_kiriman',     -- outlet terima dari SJ kitchen
    'pemakaian',          -- BOM deduction per order
    'waste',              -- bahan terbuang/rusak
    'adjustment',         -- koreksi manual
    'opname_selisih',     -- selisih hasil stock opname
    'transfer_keluar',    -- kitchen kirim SJ ke outlet (stok kitchen berkurang)
    'transfer_masuk',     -- (reserved)
    'rejected_kiriman',   -- item SJ ditolak outlet saat kedatangan
    'pembelian_supplier', -- kitchen terima dari supplier
    'retur_ke_pusat',     -- outlet kembalikan bahan rusak ke kitchen (stok outlet berkurang)
    'terima_retur_outlet',-- kitchen terima fisik retur dari outlet
    'retur_ke_vendor'     -- kitchen serahkan bahan rusak ke supplier
  )) NOT VALID;

-- 3. Update ledger_stamp_saldo() agar retur_ke_pusat dikecualikan dari pemblokiran saldo negatif
CREATE OR REPLACE FUNCTION public.ledger_stamp_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_saldo NUMERIC;
  bahan_nama TEXT;
  bahan_satuan TEXT;
  v_faktor NUMERIC;
  v_is_gram BOOLEAN;
  v_disp_saldo NUMERIC;
  v_disp_qty NUMERIC;
BEGIN
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;

  -- Pengecualian guard no-negative-balance untuk kejadian fisik nyata
  IF NEW.qty < 0
    AND NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman', 'pemakaian', 'terima_kiriman', 'waste', 'retur_ke_pusat', 'retur_ke_vendor')
  THEN
    SELECT b.nama, b.satuan, b.faktor_tampilan, public.saldo_is_gram(sb)
    INTO bahan_nama, bahan_satuan, v_faktor, v_is_gram
    FROM public.bahan_baku b
    LEFT JOIN public.stok_balance sb
      ON sb.outlet_id = NEW.outlet_id AND sb.bahan_baku_id = NEW.bahan_baku_id
    WHERE b.id = NEW.bahan_baku_id;

    IF v_is_gram AND v_faktor IS NOT NULL AND v_faktor > 0 THEN
      v_disp_saldo := trim_scale(NEW.saldo_sebelum / v_faktor);
      v_disp_qty   := trim_scale(ABS(NEW.qty) / v_faktor);
    ELSE
      v_disp_saldo := trim_scale(NEW.saldo_sebelum);
      v_disp_qty   := trim_scale(ABS(NEW.qty));
    END IF;

    RAISE EXCEPTION 'Stok "%" tidak cukup: saldo saat ini % %, pengurangan % %',
      bahan_nama, v_disp_saldo, bahan_satuan,
      v_disp_qty, bahan_satuan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Tabel retur_stok
CREATE TABLE IF NOT EXISTS public.retur_stok (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_retur VARCHAR(64) NOT NULL UNIQUE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id),
  tipe_retur VARCHAR(32) NOT NULL DEFAULT 'chiller_outlet' CHECK (tipe_retur IN ('inbound_sj', 'chiller_outlet')),
  status VARCHAR(32) NOT NULL DEFAULT 'diajukan' CHECK (status IN (
    'diajukan',            -- Dibuat outlet, menunggu approval AM/RM
    'disetujui_manager',   -- Disetujui AM/RM, siap dijemput kurir
    'dalam_pengiriman',    -- Fisik diserahkan ke kurir (internal/3PL)
    'diterima_kitchen',    -- Tiba di Gudang Pusat & diverifikasi timbang
    'menunggu_stok',       -- Kitchen menunggu batch baru
    'dikirim_pengganti',   -- SJ Pengganti terbit & dalam perjalanan
    'selesai',             -- Outlet terima SJ Pengganti (1:1 matched)
    'ditolak'              -- Ditolak AM/RM atau Kitchen (konversi ke waste)
  )),
  -- Approval Manajerial (AM / RM)
  approved_by_manager UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  approved_manager_at TIMESTAMPTZ,
  catatan_manager TEXT,

  -- Penjemputan Logistik (Internal & 3PL)
  jenis_logistik VARCHAR(32) NOT NULL DEFAULT 'internal' CHECK (jenis_logistik IN (
    'internal', 'lalamove', 'gosend', 'grabexpress', 'deliveree', 'lainnya'
  )),
  nomor_resi_order VARCHAR(128),
  driver_nama VARCHAR(128),
  driver_kontak VARCHAR(64),
  driver_plat_kendaraan VARCHAR(32),
  foto_serah_terima_url TEXT,
  diserahkan_driver_at TIMESTAMPTZ,

  -- Verifikasi Central Kitchen
  verified_by_kitchen UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  verified_kitchen_at TIMESTAMPTZ,
  catatan_kitchen TEXT,

  -- Tautan Dokumen
  ref_surat_jalan_asal_id UUID REFERENCES public.surat_jalan(id) ON DELETE SET NULL,
  ref_surat_jalan_pengganti_id UUID REFERENCES public.surat_jalan(id) ON DELETE SET NULL,

  created_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabel retur_stok_item
CREATE TABLE IF NOT EXISTS public.retur_stok_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retur_stok_id UUID NOT NULL REFERENCES public.retur_stok(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES public.bahan_baku(id),
  qty_klaim NUMERIC(12, 4) NOT NULL CHECK (qty_klaim > 0),
  qty_diterima_kitchen NUMERIC(12, 4),
  foto_fisik_url TEXT NOT NULL,
  foto_timbangan_url TEXT,
  alasan VARCHAR(64) NOT NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tautan Surat Jalan Pengganti
ALTER TABLE public.surat_jalan
  ADD COLUMN IF NOT EXISTS is_retur_replacement BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ref_retur_id UUID REFERENCES public.retur_stok(id) ON DELETE SET NULL;

-- 7. Indeks
CREATE INDEX IF NOT EXISTS idx_retur_stok_outlet_status ON public.retur_stok(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_retur_stok_created_at ON public.retur_stok(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retur_stok_item_retur_id ON public.retur_stok_item(retur_stok_id);
CREATE INDEX IF NOT EXISTS idx_surat_jalan_ref_retur ON public.surat_jalan(ref_retur_id) WHERE ref_retur_id IS NOT NULL;

-- 8. Row Level Security (RLS)
ALTER TABLE public.retur_stok ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retur_stok_item ENABLE ROW LEVEL SECURITY;

-- Read Policy: sesuai accessible_outlet_ids()
DROP POLICY IF EXISTS retur_stok_read ON public.retur_stok;
CREATE POLICY retur_stok_read ON public.retur_stok
  FOR SELECT USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS retur_stok_item_read ON public.retur_stok_item;
CREATE POLICY retur_stok_item_read ON public.retur_stok_item
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.retur_stok r
      WHERE r.id = retur_stok_item.retur_stok_id
        AND r.outlet_id IN (SELECT public.accessible_outlet_ids())
    )
  );

-- Insert & Update via authenticated / RPC
DROP POLICY IF EXISTS retur_stok_insert ON public.retur_stok;
CREATE POLICY retur_stok_insert ON public.retur_stok
  FOR INSERT WITH CHECK (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS retur_stok_item_insert ON public.retur_stok_item;
CREATE POLICY retur_stok_item_insert ON public.retur_stok_item
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.retur_stok r
      WHERE r.id = retur_stok_item.retur_stok_id
        AND r.outlet_id IN (SELECT public.accessible_outlet_ids())
    )
  );

DROP POLICY IF EXISTS retur_stok_update ON public.retur_stok;
CREATE POLICY retur_stok_update ON public.retur_stok
  FOR UPDATE USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

-- 9. Storage Bucket retur_evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'retur_evidence', 
  'retur_evidence', 
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg'];

DROP POLICY IF EXISTS "retur_evidence public read" ON storage.objects;
CREATE POLICY "retur_evidence public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'retur_evidence');

DROP POLICY IF EXISTS "retur_evidence insert access" ON storage.objects;
CREATE POLICY "retur_evidence insert access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'retur_evidence');

DROP POLICY IF EXISTS "retur_evidence update access" ON storage.objects;
CREATE POLICY "retur_evidence update access"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'retur_evidence');

DROP POLICY IF EXISTS "retur_evidence delete access" ON storage.objects;
CREATE POLICY "retur_evidence delete access"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'retur_evidence');
