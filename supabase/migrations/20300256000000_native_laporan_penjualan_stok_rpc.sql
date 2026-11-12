-- ============================================================================
-- Migrasi 20300256000000: RPC agregasi Laporan Penjualan (modul Stok, app native)
-- ============================================================================
-- LATAR: layar Laporan Penjualan native menarik SELURUH baris `orders` beserta
-- `order_items`-nya lalu menjumlahkannya di HP. Diukur 12 Nov 2026 untuk 1-10 Nov
-- (10.876 pesanan selesai): 22 halaman x ~0,52 dtk x 221 KB = ~11,5 dtk & 4,8 MB
-- dari PC, >90 dtk di HP. RPC agregasi sejenis (`native_laporan_analitik`) untuk
-- rentang yang sama: 0,46 dtk, 4,3 KB.
--
-- Fungsi ini mengembalikan semua angka layar dalam satu panggilan. Pola sama dengan
-- `native_laporan_analitik`: tanpa CTE bersama (lihat plan/laporan-analitik-rpc.sql
-- di repo native -- CTE yang dimateraikan pernah membuat planner memilih nested loop
-- 8 detik), hanya pernyataan pendek atas tabel nyata.
--
-- ATURAN ANGKA (cermin `ringkasPenjualan()` di feature/stok native):
--   * hanya status 'completed' yang dihitung sebagai uang; 'cancelled' hanya dicacah;
--   * omzet = KOTOR = total_amount + discount_amount + promo_subsidy;
--   * kanal dikembalikan mentah (lower/btrim); normalisasi `gofood`/`tiktok_go`/dst.
--     tetap di aplikasi (KanalJual.dari) supaya aturannya hanya ada di satu tempat;
--   * jam memakai zona Asia/Jakarta;
--   * rentang setengah terbuka: created_at >= p_dari AND created_at < p_sampai.
--
-- PENYARING OUTLET:
--   * p_outlet terisi  -> hanya outlet itu (dipilih sadar, apa adanya);
--   * p_outlet NULL    -> pesanan tanpa outlet + outlet di p_outlets (daftar gerai
--                         penjualan aktif yang disusun aplikasi; gudang pusat & outlet
--                         uji dibuang di sana). p_outlets NULL = semua yang lolos RLS.
--
-- SECURITY INVOKER: RLS `orders_select_scoped` tetap berlaku persis seperti saat
-- tabelnya dibaca langsung; tidak ada aturan akses yang ditiru di sini.
--
-- Index pendukung sudah ada: idx_order_items_order_id(_cover) dan index komposit
-- orders (outlet_id, created_at) / (status, created_at) -- lihat 20300254011700.
--
-- MEMBATALKAN: DROP FUNCTION public.native_laporan_penjualan_stok(timestamptz, timestamptz, uuid, uuid[]);
-- Aplikasi otomatis kembali ke jalur baris mentah (404); tidak ada data yang berubah.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.native_laporan_penjualan_stok(
  p_dari    timestamptz,
  p_sampai  timestamptz,
  p_outlet  uuid   DEFAULT NULL,
  p_outlets uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_omzet  numeric := 0;
  v_order  int     := 0;
  v_batal  int     := 0;
  v_kanal  jsonb   := '[]'::jsonb;
  v_outlet jsonb   := '[]'::jsonb;
  v_jam    jsonb   := '[]'::jsonb;
  v_menu   jsonb   := '[]'::jsonb;
BEGIN
  -- (1) Total.
  SELECT
    COALESCE(SUM(COALESCE(o.total_amount, 0) + COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0))
             FILTER (WHERE o.status = 'completed'), 0),
    COUNT(*) FILTER (WHERE o.status = 'completed'),
    COUNT(*) FILTER (WHERE o.status = 'cancelled')
  INTO v_omzet, v_order, v_batal
  FROM public.orders o
  WHERE o.created_at >= p_dari
    AND o.created_at <  p_sampai
    AND o.status IN ('completed', 'cancelled')
    AND (p_outlet IS NULL OR o.outlet_id = p_outlet)
    AND (p_outlet IS NOT NULL OR p_outlets IS NULL OR o.outlet_id IS NULL OR o.outlet_id = ANY (p_outlets));

  -- (2) Per kanal mentah.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kanal', k.kanal, 'jumlah', k.jumlah, 'omzet', k.omzet)
                            ORDER BY k.omzet DESC), '[]'::jsonb)
  INTO v_kanal
  FROM (
    SELECT lower(btrim(COALESCE(o.channel, '')))                                                AS kanal,
           COUNT(*)::int                                                                        AS jumlah,
           SUM(COALESCE(o.total_amount, 0) + COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)) AS omzet
    FROM public.orders o
    WHERE o.created_at >= p_dari
      AND o.created_at <  p_sampai
      AND o.status = 'completed'
      AND (p_outlet IS NULL OR o.outlet_id = p_outlet)
      AND (p_outlet IS NOT NULL OR p_outlets IS NULL OR o.outlet_id IS NULL OR o.outlet_id = ANY (p_outlets))
    GROUP BY 1
  ) k;

  -- (3) Per outlet. Porsi (jumlah qty item) dihitung pada subquery tersendiri yang
  --     sudah dikelompokkan per outlet, supaya join ke item tidak menggandakan
  --     total_amount sebanyak baris itemnya.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('outlet_id', p.outlet_id, 'jumlah', p.jumlah,
                                               'omzet', p.omzet, 'porsi', COALESCE(q.porsi, 0))
                            ORDER BY p.omzet DESC), '[]'::jsonb)
  INTO v_outlet
  FROM (
    SELECT o.outlet_id,
           COUNT(*)::int AS jumlah,
           SUM(COALESCE(o.total_amount, 0) + COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)) AS omzet
    FROM public.orders o
    WHERE o.created_at >= p_dari
      AND o.created_at <  p_sampai
      AND o.status = 'completed'
      AND (p_outlet IS NULL OR o.outlet_id = p_outlet)
      AND (p_outlet IS NOT NULL OR p_outlets IS NULL OR o.outlet_id IS NULL OR o.outlet_id = ANY (p_outlets))
    GROUP BY o.outlet_id
  ) p
  LEFT JOIN (
    SELECT o.outlet_id, SUM(COALESCE(oi.quantity, 0))::numeric AS porsi
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.created_at >= p_dari
      AND o.created_at <  p_sampai
      AND o.status = 'completed'
      AND (p_outlet IS NULL OR o.outlet_id = p_outlet)
      AND (p_outlet IS NOT NULL OR p_outlets IS NULL OR o.outlet_id IS NULL OR o.outlet_id = ANY (p_outlets))
    GROUP BY o.outlet_id
  ) q ON q.outlet_id IS NOT DISTINCT FROM p.outlet_id;

  -- (4) Omzet kotor per jam Jakarta, selalu 24 angka.
  SELECT COALESCE(jsonb_agg(COALESCE(c.omzet, 0) ORDER BY j.jam), '[]'::jsonb)
  INTO v_jam
  FROM generate_series(0, 23) AS j(jam)
  LEFT JOIN (
    SELECT EXTRACT(hour FROM (o.created_at AT TIME ZONE 'Asia/Jakarta'))::int AS jam,
           SUM(COALESCE(o.total_amount, 0) + COALESCE(o.discount_amount, 0) + COALESCE(o.promo_subsidy, 0)) AS omzet
    FROM public.orders o
    WHERE o.created_at >= p_dari
      AND o.created_at <  p_sampai
      AND o.status = 'completed'
      AND (p_outlet IS NULL OR o.outlet_id = p_outlet)
      AND (p_outlet IS NOT NULL OR p_outlets IS NULL OR o.outlet_id IS NULL OR o.outlet_id = ANY (p_outlets))
    GROUP BY 1
  ) c ON c.jam = j.jam;

  -- (5) 15 menu terlaris (nama apa adanya, sama seperti jalur lama).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('nama', m.nama, 'qty', m.qty, 'omzet', m.omzet)
                            ORDER BY m.qty DESC, m.nama), '[]'::jsonb)
  INTO v_menu
  FROM (
    SELECT oi.menu_item_name                     AS nama,
           SUM(COALESCE(oi.quantity, 0))::numeric AS qty,
           SUM(COALESCE(oi.subtotal, 0))          AS omzet
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.created_at >= p_dari
      AND o.created_at <  p_sampai
      AND o.status = 'completed'
      AND oi.menu_item_name IS NOT NULL
      AND (p_outlet IS NULL OR o.outlet_id = p_outlet)
      AND (p_outlet IS NOT NULL OR p_outlets IS NULL OR o.outlet_id IS NULL OR o.outlet_id = ANY (p_outlets))
    GROUP BY oi.menu_item_name
    ORDER BY 2 DESC, 1
    LIMIT 15
  ) m;

  RETURN jsonb_build_object(
    'omzet_kotor',   v_omzet,
    'jumlah_order',  v_order,
    'jumlah_batal',  v_batal,
    'per_kanal',     v_kanal,
    'per_outlet',    v_outlet,
    'per_jam',       v_jam,
    'menu_terlaris', v_menu
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.native_laporan_penjualan_stok(timestamptz, timestamptz, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.native_laporan_penjualan_stok(timestamptz, timestamptz, uuid, uuid[]) TO authenticated;

-- Verifikasi (harus dalam hitungan milidetik):
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT public.native_laporan_penjualan_stok('2026-11-01T00:00:00+07:00', '2026-11-11T00:00:00+07:00');
