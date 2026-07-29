-- Rekap harian settlement food apps (ShopeeFood/GrabFood/GoFood) per outlet.
--
-- Kenapa rekap harian, bukan per transaksi: laporan platform tidak punya rincian
-- per-item, dan untuk periode transisi Pawoon transaksi food apps dicatat borongan
-- (1 struk = banyak order asli), sehingga pencocokan per-transaksi mustahil.
-- Tiga angka inilah yang dibutuhkan: omzet kotor & promo (untuk pembanding terhadap
-- data kita) dan commission (angka baru yang selama ini belum pernah masuk P&L).
--
-- Aditif: tabel baru, tidak mengubah objek lain.

CREATE TABLE IF NOT EXISTS public.platform_settlements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text NOT NULL CHECK (platform IN ('shopeefood', 'grabfood', 'gofood', 'tiktokgo')),
  outlet_id      uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  tanggal        date NOT NULL,
  omzet_kotor    numeric NOT NULL DEFAULT 0,
  promo_merchant numeric NOT NULL DEFAULT 0,
  commission     numeric NOT NULL DEFAULT 0,
  trx_count      integer NOT NULL DEFAULT 0,
  source_file    text,
  imported_at    timestamptz NOT NULL DEFAULT now(),
  imported_by    uuid,
  -- Upload ulang file periode yang sama = memperbarui baris, bukan menggandakan.
  CONSTRAINT platform_settlements_unik UNIQUE (platform, outlet_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_platform_settlements_tanggal
  ON public.platform_settlements (tanggal);
CREATE INDEX IF NOT EXISTS idx_platform_settlements_outlet_tanggal
  ON public.platform_settlements (outlet_id, tanggal);

ALTER TABLE public.platform_settlements ENABLE ROW LEVEL SECURITY;

-- Baca: ikut scope outlet pemanggil (owner/admin semua outlet, mitra satu outlet).
DROP POLICY IF EXISTS platform_settlements_select ON public.platform_settlements;
CREATE POLICY platform_settlements_select ON public.platform_settlements
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

-- Tulis: hanya lewat Server Action (service_role). Tidak ada policy tulis untuk
-- `authenticated` — otorisasi admin/owner ditegakkan di application layer via
-- requireRole(), sejalan dengan alur import Pawoon.
GRANT SELECT ON public.platform_settlements TO authenticated;

-- Pembanding: omzet kotor versi SISTEM KITA per outlet untuk satu rentang & channel.
-- Dipakai halaman preview import untuk menunjukkan selisih terhadap laporan platform
-- sebelum data di-sync.
--
-- p_channel: 'food_apps' (ShopeeFood/GrabFood/GoFood) atau 'tiktok_go' (TikTok Go).
--
-- Catatan penting untuk 'food_apps': angka yang dikembalikan menggabung SEMUA platform
-- food apps dan tidak bisa dipecah per platform, karena data periode Pawoon menandai
-- seluruh item "FOOD APPS" dengan satu tag yang sama tanpa membedakan Shopee/Grab/Go.
-- Jadi hasilnya harus dibaca sebagai batas atas: omzet satu platform semestinya
-- <= angka ini.
--
-- Sengaja TIDAK diberikan ke role `authenticated` — hanya dipanggil dari Server Action
-- yang sudah digerbangi requireRole(['admin','owner']).
CREATE OR REPLACE FUNCTION public.channel_gross_by_outlet(
  p_from date,
  p_to date,
  p_channel text
)
RETURNS TABLE (outlet_id uuid, omzet_kotor numeric, trx_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT o.outlet_id,
         COALESCE(SUM(oi.subtotal), 0)::numeric,
         COUNT(DISTINCT o.id)
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.status = 'completed'
    AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    AND (
      oi.channel = p_channel
      OR (p_channel = 'food_apps' AND o.channel IN ('gofood', 'grabfood', 'shopeefood'))
      OR (p_channel = 'tiktok_go' AND o.channel IN ('tiktokgo', 'tiktok'))
    )
  GROUP BY o.outlet_id;
$$;

REVOKE ALL ON FUNCTION public.channel_gross_by_outlet(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.channel_gross_by_outlet(date, date, text) TO service_role;
