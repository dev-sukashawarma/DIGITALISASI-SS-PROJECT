-- Pre-Order WA: order manual kasir "[Jam Ambil: ...]" digabung ke Offline.
--
-- Keputusan owner 2026-11-06. Tab "Order Website — Backup Mandiri" di POS
-- dipakai kasir untuk pesanan WhatsApp/telepon yang dibayar ke QRIS outlet.
-- Order itu disimpan channel='website' sehingga laporan menghitungnya sebagai
-- omzet Website, padahal uangnya tidak lewat Xendit dan tak ada jejaknya di
-- database website (audit Okt–6 Nov: 31 dari 39 tanpa pasangan; 3 lainnya
-- malah salinan dobel pesanan web yang sudah masuk otomatis).
--
-- Mulai 1 Okt 2026 WIB order seperti ini ditandai channel='preorder_wa' dan
-- sales_source='pos'. Semua resolver (DB resolve_sales_source, Ringkasan
-- Bisnis, resolveOrderSource di app) tidak mengenal 'preorder_wa' sebagai
-- kanal, jadi otomatis jatuh ke Offline / POS Kasir; badge "Pre-Order WA"
-- menjadi penandanya di daftar order.
--
-- September 2026 SENGAJA tidak disentuh (sudah tutup buku) — order Sep tetap
-- 'website'. Total omzet tidak berubah, hanya pembagian kanalnya.
--
-- Trigger menormalkan di DB, bukan di app, karena order ini dibuat lebih dari
-- satu klien (sejak 18 Agu tercatat source='online', bukan route web kasir).

SET lock_timeout = '5s';

-- 1. VA hanya boleh untuk order website — kini juga untuk Pre-Order WA
--    (CHECK dievaluasi SETELAH trigger BEFORE, jadi wajib diperluas dulu).
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (
  payment_method IS NULL
  OR payment_method = ANY (ARRAY['cash'::text, 'qris'::text, 'card'::text])
  OR (payment_method = 'va'::text
      AND lower(btrim(COALESCE(channel, ''::text))) = ANY (ARRAY['website'::text, 'preorder_wa'::text]))
) NOT VALID;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_payment_method_check;

-- 2. Penanda otomatis
CREATE OR REPLACE FUNCTION public.order_tandai_preorder_wa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_at >= timestamptz '2026-10-01 00:00:00+07'
     AND (
       lower(btrim(COALESCE(NEW.channel, ''))) = 'preorder_wa'
       OR (lower(btrim(COALESCE(NEW.channel, ''))) = 'website'
           AND COALESCE(NEW.customer_name, '') ILIKE '%[Jam Ambil:%')
     ) THEN
    NEW.channel := 'preorder_wa';
    NEW.sales_source := 'pos';
  END IF;
  RETURN NEW;
END;
$$;

-- "zz" agar berjalan PALING AKHIR di antara trigger BEFORE (urut nama),
-- setelah trg_force_online_sales_source yang bisa mengisi sales_source.
DROP TRIGGER IF EXISTS trg_zz_order_tandai_preorder_wa ON public.orders;
CREATE TRIGGER trg_zz_order_tandai_preorder_wa
  BEFORE INSERT OR UPDATE OF channel, customer_name, sales_source ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_tandai_preorder_wa();

-- 3. Backfill sejak 1 Okt 2026 WIB. Status tidak diubah, jadi trigger BOM
--    (hanya bereaksi pada transisi status) tidak memotong/mengembalikan stok.
UPDATE public.orders
SET channel = 'preorder_wa', sales_source = 'pos'
WHERE created_at >= timestamptz '2026-10-01 00:00:00+07'
  AND lower(btrim(channel)) = 'website'
  AND customer_name ILIKE '%[Jam Ambil:%';
