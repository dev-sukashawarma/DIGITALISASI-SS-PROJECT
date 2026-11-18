-- Retur bahan baku ke vendor dari Gudang Pusat — skema (2026-11-18)
-- Spec: docs/superpowers/specs/2026-11-18-retur-vendor-gudang-design.md
-- Plan: docs/superpowers/plans/2026-11-18-retur-vendor-gudang.md (Task 1)
--
-- Tabel retur_vendor (+ item) dan buku kredit vendor_kredit. Semua tulis lewat
-- RPC (task berikutnya); klien hanya boleh membaca lewat RLS.

SET lock_timeout = '5s';

-- ── Peran ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.retur_vendor_peran_ok(p_lingkup text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND status = 'active'
      AND role = ANY (CASE p_lingkup
        WHEN 'ajukan'     THEN ARRAY['purchasing','kitchen','admin','owner','admin_finance','developer']
        WHEN 'putus'      THEN ARRAY['admin','owner','admin_finance','developer']
        WHEN 'serah'      THEN ARRAY['purchasing','kitchen','admin','owner','developer']
        WHEN 'selesaikan' THEN ARRAY['purchasing','admin','owner','admin_finance','developer']
        WHEN 'uang'       THEN ARRAY['admin_finance','admin','owner','developer']
        ELSE ARRAY[]::text[] END)
  );
$$;
REVOKE ALL ON FUNCTION public.retur_vendor_peran_ok(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retur_vendor_peran_ok(text) TO authenticated;

-- ── Dokumen retur ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.retur_vendor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.supplier(id),
  vendor_induk uuid NOT NULL,
  status text NOT NULL DEFAULT 'diajukan'
    CHECK (status IN ('diajukan','disetujui','ditolak','dibatalkan','diserahkan','selesai')),
  alasan text NOT NULL
    CHECK (alasan IN ('rusak','kualitas_tidak_sesuai','salah_kirim','kadaluarsa','lainnya')),
  catatan text,
  bukti_urls text[] NOT NULL DEFAULT '{}',
  diajukan_oleh uuid,
  diajukan_at timestamptz NOT NULL DEFAULT now(),
  diputuskan_oleh uuid,
  diputuskan_at timestamptz,
  alasan_tolak text,
  dibatalkan_oleh uuid,
  dibatalkan_at timestamptz,
  alasan_batal text,
  diserahkan_oleh uuid,
  diserahkan_at timestamptz,
  penerima_vendor text,
  bukti_serah_url text,
  cara_penyelesaian text CHECK (cara_penyelesaian IN ('ganti_barang','potong_tagihan','uang_kembali')),
  catatan_penyelesaian text,
  bukti_vendor_url text,
  uang_dijanjikan numeric,
  uang_diterima numeric,
  cash_transaction_id uuid REFERENCES public.cash_transaction(id),
  nilai_tidak_dikompensasi numeric NOT NULL DEFAULT 0 CHECK (nilai_tidak_dikompensasi >= 0),
  alasan_tutup_sisa text,
  selesai_oleh uuid,
  selesai_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retur_vendor_lainnya_catatan
    CHECK (alasan <> 'lainnya' OR length(btrim(coalesce(catatan, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS idx_retur_vendor_status ON public.retur_vendor (status, diajukan_at);
CREATE INDEX IF NOT EXISTS idx_retur_vendor_induk ON public.retur_vendor (vendor_induk);

CREATE TABLE IF NOT EXISTS public.retur_vendor_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retur_vendor_id uuid NOT NULL REFERENCES public.retur_vendor(id) ON DELETE CASCADE,
  bahan_baku_id uuid NOT NULL REFERENCES public.bahan_baku(id),
  purchase_order_item_id uuid NOT NULL REFERENCES public.purchase_order_item(id),
  qty numeric NOT NULL CHECK (qty > 0),
  harga numeric NOT NULL CHECK (harga >= 0),
  subtotal numeric GENERATED ALWAYS AS (qty * harga) STORED,
  alasan text NOT NULL
    CHECK (alasan IN ('rusak','kualitas_tidak_sesuai','salah_kirim','kadaluarsa','lainnya')),
  catatan text,
  qty_pengganti_diterima numeric NOT NULL DEFAULT 0 CHECK (qty_pengganti_diterima >= 0),
  ledger_serah_id uuid,
  UNIQUE (retur_vendor_id, purchase_order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_retur_vendor_item_poi ON public.retur_vendor_item (purchase_order_item_id);

-- ── Buku kredit vendor ──────────────────────────────────────────────────────
-- Baris bertanda: + dari retur (aktif), − pemakaian (dicadangkan saat bayar
-- diajukan → aktif saat disetujui; dihapus saat ditolak). Saldo = SUM(jumlah).
CREATE TABLE IF NOT EXISTS public.vendor_kredit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_induk uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.supplier(id),
  jumlah numeric NOT NULL CHECK (jumlah <> 0),
  status text NOT NULL CHECK (status IN ('aktif','dicadangkan')),
  retur_vendor_id uuid REFERENCES public.retur_vendor(id),
  purchase_order_id uuid REFERENCES public.purchase_order(id),
  catatan text,
  dibuat_oleh uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_kredit_induk ON public.vendor_kredit (vendor_induk);
CREATE INDEX IF NOT EXISTS idx_vendor_kredit_po ON public.vendor_kredit (purchase_order_id) WHERE purchase_order_id IS NOT NULL;

-- ── Akses ───────────────────────────────────────────────────────────────────
ALTER TABLE public.retur_vendor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retur_vendor_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_kredit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.retur_vendor, public.retur_vendor_item, public.vendor_kredit FROM anon, authenticated;
GRANT SELECT ON public.retur_vendor, public.retur_vendor_item, public.vendor_kredit TO authenticated;
GRANT ALL ON public.retur_vendor, public.retur_vendor_item, public.vendor_kredit TO service_role;

DROP POLICY IF EXISTS retur_vendor_baca ON public.retur_vendor;
CREATE POLICY retur_vendor_baca ON public.retur_vendor FOR SELECT TO authenticated
  USING (retur_vendor_peran_ok('ajukan') OR retur_vendor_peran_ok('putus'));
DROP POLICY IF EXISTS retur_vendor_item_baca ON public.retur_vendor_item;
CREATE POLICY retur_vendor_item_baca ON public.retur_vendor_item FOR SELECT TO authenticated
  USING (retur_vendor_peran_ok('ajukan') OR retur_vendor_peran_ok('putus'));
DROP POLICY IF EXISTS vendor_kredit_baca ON public.vendor_kredit;
CREATE POLICY vendor_kredit_baca ON public.vendor_kredit FOR SELECT TO authenticated
  USING (retur_vendor_peran_ok('ajukan') OR retur_vendor_peran_ok('putus'));

-- ── Kolom di tabel yang ada ─────────────────────────────────────────────────
ALTER TABLE public.purchase_order_item
  ADD COLUMN IF NOT EXISTS qty_ditolak numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alasan_tolak text;
ALTER TABLE public.purchase_order_item DROP CONSTRAINT IF EXISTS poi_qty_ditolak_check;
ALTER TABLE public.purchase_order_item ADD CONSTRAINT poi_qty_ditolak_check CHECK (qty_ditolak >= 0);
ALTER TABLE public.purchase_order_item DROP CONSTRAINT IF EXISTS poi_alasan_tolak_check;
ALTER TABLE public.purchase_order_item ADD CONSTRAINT poi_alasan_tolak_check
  CHECK (alasan_tolak IS NULL OR alasan_tolak IN ('rusak','kualitas_tidak_sesuai','salah_kirim','kadaluarsa','lainnya'));

ALTER TABLE public.ledger_stok ADD COLUMN IF NOT EXISTS ref_retur_vendor_id uuid;
CREATE INDEX IF NOT EXISTS idx_ledger_stok_ref_retur_vendor
  ON public.ledger_stok (ref_retur_vendor_id) WHERE ref_retur_vendor_id IS NOT NULL;

-- ── CHECK diperluas ─────────────────────────────────────────────────────────
ALTER TABLE public.stok_vendor_gudang_mutasi DROP CONSTRAINT stok_vendor_gudang_mutasi_sumber_check;
ALTER TABLE public.stok_vendor_gudang_mutasi ADD CONSTRAINT stok_vendor_gudang_mutasi_sumber_check
  CHECK (sumber = ANY (ARRAY['po','sj_kirim','hitung_fisik','koreksi','penyesuaian','retur_vendor'])) NOT VALID;
ALTER TABLE public.stok_vendor_gudang_mutasi VALIDATE CONSTRAINT stok_vendor_gudang_mutasi_sumber_check;

ALTER TABLE public.cash_transaction DROP CONSTRAINT cash_transaction_source_type_check;
ALTER TABLE public.cash_transaction ADD CONSTRAINT cash_transaction_source_type_check
  CHECK (source_type = ANY (ARRAY['payroll','supplier_po','expense_pusat','kasbon','cash_deposit','manual',
    'transfer','petty_cash_topup','setor_bank','income_lain','top_up','refund_dana','retur_vendor'])) NOT VALID;
ALTER TABLE public.cash_transaction VALIDATE CONSTRAINT cash_transaction_source_type_check;

ALTER TABLE public.approval_log DROP CONSTRAINT approval_log_jenis_check;
ALTER TABLE public.approval_log ADD CONSTRAINT approval_log_jenis_check
  CHECK (jenis = ANY (ARRAY['petty_cash','po','bayar_vendor','dana_kantor','kasbon','retur_vendor']));
