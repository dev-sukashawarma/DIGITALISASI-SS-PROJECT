-- supabase/migrations/20260915233000_rpc_hpp_dinamis.sql
-- Spec §2 (grain), §7. Harga diselesaikan saat dibaca; ledger tidak disentuh.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_hpp_dinamis_bahan(p_outlet uuid, p_from date, p_to date)
RETURNS TABLE(
  bahan_baku_id uuid, nama_bahan text, satuan text, satuan_kecil text, is_gram boolean,
  qty_pemakaian numeric, nilai numeric,
  sumber_harga_terakhir text, ref_id_terakhir uuid, ref_tanggal_terakhir date,
  nilai_kiriman numeric, nilai_drop_ship numeric, nilai_master_historis numeric,
  nilai_master_sekarang numeric, nilai_tidak_ada numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_view_hpp_dinamis() THEN
    RAISE EXCEPTION 'Tidak berwenang melihat HPP dinamis' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_outlet NOT IN (SELECT public.outlet_ids_terhitung())
     OR p_outlet NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Outlet di luar cakupan' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_to < p_from OR p_to - p_from > 92 THEN
    RAISE EXCEPTION 'Rentang maksimal 92 hari';
  END IF;

  -- #variable_conflict use_column: kolom OUT (bahan_baku_id, nilai, satuan, ...)
  -- bernama sama dengan kolom CTE; tanpa ini plpgsql melempar "ambiguous".
  RETURN QUERY
  WITH pem AS (
    -- pemakaian BOM + adjustment pembalik void (ref_order_id), net per bahan per hari
    SELECT l.bahan_baku_id, (l.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl, -SUM(l.qty) AS qty
    FROM public.ledger_stok l
    WHERE l.outlet_id = p_outlet AND l.ref_order_id IS NOT NULL
      AND l.tipe IN ('pemakaian','adjustment')
      AND (l.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    GROUP BY 1, 2
  ),
  skala AS (
    SELECT sb.bahan_baku_id, public.saldo_is_gram(sb) AS g FROM public.stok_balance sb WHERE sb.outlet_id = p_outlet
  ),
  harian AS (
    SELECT p.bahan_baku_id, p.tgl, p.qty, COALESCE(s.g, false) AS g,
           h.harga_besar, h.harga_kecil, h.sumber_harga, h.ref_id, h.ref_tanggal,
           CASE WHEN COALESCE(s.g,false) THEN p.qty * h.harga_kecil ELSE p.qty * h.harga_besar END AS nilai_hari
    FROM pem p
    LEFT JOIN skala s ON s.bahan_baku_id = p.bahan_baku_id
    CROSS JOIN LATERAL public.harga_bahan_efektif(p_outlet, p.bahan_baku_id, p.tgl) h
  )
  SELECT hr.bahan_baku_id, b.nama, b.satuan, b.satuan_kecil, bool_or(hr.g),
         SUM(hr.qty), SUM(hr.nilai_hari),
         (array_agg(hr.sumber_harga ORDER BY hr.tgl DESC))[1],
         (array_agg(hr.ref_id ORDER BY hr.tgl DESC))[1],
         (array_agg(hr.ref_tanggal ORDER BY hr.tgl DESC))[1],
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'kiriman'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'drop_ship'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'master_historis'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'master_sekarang'),
         SUM(hr.nilai_hari) FILTER (WHERE hr.sumber_harga = 'tidak_ada')
  FROM harian hr JOIN public.bahan_baku b ON b.id = hr.bahan_baku_id
  GROUP BY hr.bahan_baku_id, b.nama, b.satuan, b.satuan_kecil
  ORDER BY SUM(hr.nilai_hari) DESC NULLS LAST;
END $$;

CREATE OR REPLACE FUNCTION public.get_hpp_dinamis_menu(p_outlet uuid, p_from date, p_to date)
RETURNS TABLE(
  menu_item_id uuid, menu_nama text, harga_jual numeric, qty_terjual numeric,
  punya_resep boolean, hpp_override_unit numeric, hpp_override_total numeric,
  hpp_teoritis_total numeric, hpp_teoritis_unit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.can_view_hpp_dinamis() THEN
    RAISE EXCEPTION 'Tidak berwenang melihat HPP dinamis' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_outlet NOT IN (SELECT public.outlet_ids_terhitung())
     OR p_outlet NOT IN (SELECT public.accessible_outlet_ids()) THEN
    RAISE EXCEPTION 'Outlet di luar cakupan' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_to < p_from OR p_to - p_from > 92 THEN
    RAISE EXCEPTION 'Rentang maksimal 92 hari';
  END IF;

  RETURN QUERY
  WITH terjual AS (
    SELECT oi.menu_item_id, (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl, SUM(oi.quantity) AS qty
    FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.outlet_id = p_outlet AND o.status = 'completed' AND oi.menu_item_id IS NOT NULL
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    GROUP BY 1, 2
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.menu_item_id) t.menu_item_id, r.id AS resep_id
    FROM (SELECT DISTINCT tj.menu_item_id FROM terjual tj) t
    JOIN public.resep r ON r.menu_item_ref = t.menu_item_id::text AND r.is_active
     AND ((r.scope = 'outlet' AND r.outlet_id = p_outlet) OR r.scope = 'global')
    ORDER BY t.menu_item_id, CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  teoritis AS (
    SELECT t.menu_item_id, SUM(t.qty * ri.qty_per_porsi * h.harga_kecil) AS total
    FROM terjual t
    JOIN resep_terpilih rt ON rt.menu_item_id = t.menu_item_id
    JOIN public.resep_item ri ON ri.resep_id = rt.resep_id
    CROSS JOIN LATERAL public.harga_bahan_efektif(p_outlet, ri.bahan_baku_id, t.tgl) h
    GROUP BY t.menu_item_id
  ),
  agg AS (SELECT tj.menu_item_id, SUM(tj.qty) AS qty FROM terjual tj GROUP BY tj.menu_item_id)
  SELECT a.menu_item_id, m.name, COALESCE(m.price,0), a.qty,
         (rt.resep_id IS NOT NULL),
         COALESCE(m.hpp_override,0), COALESCE(m.hpp_override,0) * a.qty,
         te.total, CASE WHEN a.qty > 0 THEN te.total / a.qty END
  FROM agg a
  JOIN public.menu_items m ON m.id = a.menu_item_id
  LEFT JOIN resep_terpilih rt ON rt.menu_item_id = a.menu_item_id
  LEFT JOIN teoritis te ON te.menu_item_id = a.menu_item_id
  ORDER BY a.qty DESC;
END $$;

REVOKE ALL ON FUNCTION public.get_hpp_dinamis_bahan(uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_hpp_dinamis_menu(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hpp_dinamis_bahan(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hpp_dinamis_menu(uuid,date,date) TO authenticated;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE proname IN ('get_hpp_dinamis_bahan','get_hpp_dinamis_menu') AND prosecdef) <> 2 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: RPC HPP dinamis tidak terpasang sebagai DEFINER';
  END IF;
END $$;
COMMIT;
