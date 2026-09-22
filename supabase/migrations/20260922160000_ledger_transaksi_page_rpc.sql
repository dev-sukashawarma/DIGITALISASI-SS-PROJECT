-- ledger_transaksi_page: pengganti paginasi view ledger_transaksi_ringkas
-- untuk daftar Ledger (/stok/ledger).
--
-- Masalah: view ledger_transaksi_ringkas meng-GROUP BY SELURUH riwayat
-- ledger_stok satu outlet setiap kali dibuka, lalu mengurutkan & memotong
-- 50 grup. Outlet tersibuk (~95 ribu baris) terukur 5,1 dtk cache dingin,
-- ~300-450 ms hangat, sort tumpah ke disk 17 MB -- dan terus membengkak
-- seiring riwayat bertambah (terukur 2026-09-22).
--
-- Cara kerja: ambil jendela baris TERBARU lewat index (outlet_id,
-- created_at DESC), agregasi grup di dalam jendela dalam SATU jalan
-- (hitung grup lengkap + kemas isi halaman sekaligus), dan perbesar jendela
-- proporsional bila grup lengkapnya belum cukup untuk offset+limit. Biaya
-- kini sebanding dengan kedalaman halaman, bukan dengan panjang riwayat.
--
-- Hasil IDENTIK dengan view (kolom, tipe, dan isi per grup). Urutan:
-- created_at DESC lalu transaksi_key DESC (view hanya created_at DESC,
-- sehingga urutan antar grup ber-created_at sama di view tidak stabil antar
-- halaman; tie-break ini justru membuatnya stabil).
--
-- "Grup lengkap" = semua barisnya ada di jendela (created_at >= v_t).
-- Grup opname/kiriman/transfer/tunggal selalu tercatat di satu timestamp
-- (terukur: 0 dari ~22 ribu grup berjarak > 1 menit), jadi karena jendela
-- memuat SEMUA baris ber-created_at >= v_t (termasuk seri), grup itu selalu
-- lengkap. Grup ORDER bisa berjarak hari (pembalik void tercatat belakangan;
-- 103 dari 45.698 grup > 1 menit, terjauh 19 hari) -> dicek eksplisit lewat
-- index ref_order_id: grup order yang punya baris sebelum v_t BUKAN milik
-- jendela ini (posisinya di view ditentukan min(created_at)-nya yang lebih
-- tua) dan dikeluarkan.
--
-- SECURITY INVOKER: RLS ledger_stok (ledger_read, accessible_outlet_ids())
-- tetap berlaku persis seperti pada view.

CREATE OR REPLACE FUNCTION public.ledger_transaksi_page(
  p_outlet uuid,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  transaksi_key text,
  outlet_id uuid,
  created_at timestamptz,
  jumlah_bahan bigint,
  ref_order_id text,
  ref_opname_id text,
  ref_shipment_id text,
  ref_transfer_id text,
  single_bahan_baku_id text,
  single_tipe text,
  single_qty numeric,
  single_catatan text,
  single_saldo_sesudah numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  v_offset  int := GREATEST(COALESCE(p_offset, 0), 0);
  v_limit   int := LEAST(GREATEST(COALESCE(p_limit, 50), 0), 500);
  v_need    int;
  v_rows    int;
  v_t       timestamptz;
  v_fetched int;
  v_groups  int;
  v_page    jsonb;
BEGIN
  IF v_limit = 0 OR p_outlet IS NULL THEN
    RETURN;
  END IF;

  v_need := v_offset + v_limit;
  -- Tebakan awal: outlet tersibuk ~16 baris/grup (terukur 2026-09-22).
  v_rows := GREATEST(v_need * 25, 500);

  LOOP
    SELECT min(x.created_at), count(*)
      INTO v_t, v_fetched
      FROM (
        SELECT l.created_at
          FROM ledger_stok l
         WHERE l.outlet_id = p_outlet
         ORDER BY l.created_at DESC
         LIMIT v_rows
      ) x;

    IF v_fetched < v_rows THEN
      -- Seluruh riwayat outlet sudah tercakup: semua grup lengkap.
      v_t := '-infinity';
    END IF;

    -- Satu jalan: agregasi grup di jendela, buang grup tak lengkap, hitung
    -- jumlahnya, dan sekaligus kemas isi halaman (jsonb, tanpa ketergantungan
    -- ke tipe view). Jendela = SEMUA baris ber-created_at >= v_t (termasuk
    -- seri di v_t), jadi grup satu-timestamp tak pernah terpotong.
    WITH w AS (
      SELECT COALESCE(l.ref_order_id::text, l.ref_opname_id::text, l.ref_shipment_id::text,
                      l.ref_transfer_id::text, l.id::text) AS k,
             l.*
        FROM ledger_stok l
       WHERE l.outlet_id = p_outlet
         AND l.created_at >= v_t
    ), g AS (
      SELECT w.k                             AS transaksi_key,
             w.outlet_id,
             min(w.created_at)               AS created_at,
             count(DISTINCT w.bahan_baku_id) AS jumlah_bahan,
             max(w.ref_order_id::text)       AS ref_order_id,
             max(w.ref_opname_id::text)      AS ref_opname_id,
             max(w.ref_shipment_id::text)    AS ref_shipment_id,
             max(w.ref_transfer_id::text)    AS ref_transfer_id,
             max(w.bahan_baku_id::text)      AS single_bahan_baku_id,
             max(w.tipe)                     AS single_tipe,
             max(w.qty)                      AS single_qty,
             max(w.catatan)                  AS single_catatan,
             max(w.saldo_sesudah)            AS single_saldo_sesudah
        FROM w
       GROUP BY w.k, w.outlet_id
    ), lengkap AS (
      SELECT g.*,
             row_number() OVER (ORDER BY g.created_at DESC, g.transaksi_key DESC) AS rn
        FROM g
       WHERE g.ref_order_id IS NULL
          OR v_t = '-infinity'
          OR NOT EXISTS (
               SELECT 1 FROM ledger_stok o
                WHERE o.ref_order_id = g.ref_order_id::uuid
                  AND o.outlet_id = p_outlet
                  AND o.created_at < v_t
             )
    )
    SELECT count(*),
           COALESCE(jsonb_agg(to_jsonb(lengkap) - 'rn' ORDER BY lengkap.rn)
                      FILTER (WHERE lengkap.rn > v_offset AND lengkap.rn <= v_need),
                    '[]'::jsonb)
      INTO v_groups, v_page
      FROM lengkap;

    -- ">" (bukan ">="): wajib ada >= 1 grup lengkap setelah halaman ini,
    -- supaya grup terakhir halaman pasti bukan grup terpotong.
    EXIT WHEN v_t = '-infinity' OR v_groups > v_need;

    -- Perbesar jendela proporsional terhadap kekurangan (minimal 2x).
    v_rows := v_rows * GREATEST(2, ceil((v_need + 1)::numeric / GREATEST(v_groups, 1) * 1.3)::int);
  END LOOP;

  RETURN QUERY
  SELECT e.j ->> 'transaksi_key',
         (e.j ->> 'outlet_id')::uuid,
         (e.j ->> 'created_at')::timestamptz,
         (e.j ->> 'jumlah_bahan')::bigint,
         e.j ->> 'ref_order_id',
         e.j ->> 'ref_opname_id',
         e.j ->> 'ref_shipment_id',
         e.j ->> 'ref_transfer_id',
         e.j ->> 'single_bahan_baku_id',
         e.j ->> 'single_tipe',
         (e.j ->> 'single_qty')::numeric,
         e.j ->> 'single_catatan',
         (e.j ->> 'single_saldo_sesudah')::numeric
    FROM jsonb_array_elements(v_page) WITH ORDINALITY AS e(j, ord)
   ORDER BY e.ord;
END;
$function$;

REVOKE ALL ON FUNCTION public.ledger_transaksi_page(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ledger_transaksi_page(uuid, int, int) TO authenticated, service_role;
