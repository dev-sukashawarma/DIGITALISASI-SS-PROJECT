-- Uji perapihan 6 index kembar pada orders & order_items, penyusutan bloat
-- idx_ledger_outlet_bahan_created, keutuhan seluruh index pengaman (UNIQUE/PK/FK/standalone),
-- serta rencana EXPLAIN tanpa regresi.
-- Jalankan utuh; selesai tanpa EXCEPTION = LULUS. Baca-saja (ROLLBACK di akhir).

BEGIN;

DO $$
DECLARE
  v_idx text;
  v_oid regclass;
  v_valid boolean;
  v_ready boolean;
  v_invalid_list text;
  v_ledger_idx_bytes bigint;
  v_ledger_tuples numeric;
  v_bytes_per_row numeric;
  v_outlet uuid;
  v_bahan uuid;
  v_order_id uuid;
  v_plan json;
  v_dropped_indexes constant text[] := ARRAY[
    'idx_orders_outlet_status_created',
    'idx_orders_status_created',
    'idx_orders_outlet_created',
    'idx_orders_completed_composite',
    'idx_order_items_order_menu',
    'idx_order_items_order_menu_qty'
  ];
  v_kept_indexes constant text[] := ARRAY[
    -- 6 index kembaran pengganti
    'idx_orders_outlet_status_created_covering',
    'idx_orders_status_created_covering',
    'idx_orders_outlet_created_at',
    'idx_orders_completed_outlet_created',
    'idx_order_items_order_id_cover',
    'idx_order_items_order_id_full',
    -- 10 index UNIQUE & PRIMARY KEY (penjaga anti-dobel / ON CONFLICT)
    'orders_pkey',
    'orders_outlet_bizdate_number_uq',
    'orders_client_order_id_key',
    'orders_external_order_id_uq',
    'orders_external_order_id_key',
    'uq_orders_online_order_id',
    'order_items_pkey',
    'ledger_stok_pkey',
    'idx_ledger_shipment_item',
    'ledger_stok_client_op_id_key',
    -- 11 index penopang Foreign Key
    'idx_ledger_bahan',
    'idx_ledger_stok_ref_order_id',
    'idx_ledger_ref_retur',
    'ledger_ref_terima_vendor',
    'idx_ledger_stok_ref_waste_id',
    'idx_ledger_stok_ref_opname_id',
    'idx_ledger_stok_ref_shipment_id',
    'idx_ledger_stok_ref_transfer_id',
    'idx_ledger_ref_po',
    'idx_order_items_menu_item_id',
    'idx_order_items_order_id',
    -- 4 index standalone non-kembar yang sengaja dibiarkan utuh
    'idx_orders_source_created',
    'orders_channel_idx',
    'orders_source_idx',
    'idx_order_items_is_promo_reward',
    -- 1 index Monitoring yang dirapatkan ulang (REINDEX)
    'idx_ledger_outlet_bahan_created'
  ];
BEGIN
  -- 1. Pastikan keenam index duplikat sudah dihapus
  FOREACH v_idx IN ARRAY v_dropped_indexes LOOP
    IF to_regclass('public.' || v_idx) IS NOT NULL THEN
      RAISE EXCEPTION 'index duplikat masih ada: public.%', v_idx;
    END IF;
  END LOOP;

  -- 2. Pastikan seluruh 32 index pengaman/pengganti masih ada dan valid
  FOREACH v_idx IN ARRAY v_kept_indexes LOOP
    v_oid := to_regclass('public.' || v_idx);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'index penting hilang: public.%', v_idx;
    END IF;

    SELECT i.indisvalid, i.indisready
      INTO v_valid, v_ready
    FROM pg_index i
    WHERE i.indexrelid = v_oid;

    IF COALESCE(v_valid, false) IS NOT TRUE OR COALESCE(v_ready, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'index penting tidak valid/ready: public.% (valid=%, ready=%)', v_idx, v_valid, v_ready;
    END IF;
  END LOOP;

  -- 3. Pastikan tidak ada satupun index cacat (mis. sisa _ccnew / _ccold) pada ketiga tabel
  SELECT string_agg(ci.relname, ', ')
    INTO v_invalid_list
  FROM pg_index i
  JOIN pg_class ci ON ci.oid = i.indexrelid
  JOIN pg_class ct ON ct.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = ct.relnamespace
  WHERE n.nspname = 'public'
    AND ct.relname IN ('orders', 'order_items', 'ledger_stok')
    AND (NOT i.indisvalid OR NOT i.indisready);

  IF v_invalid_list IS NOT NULL THEN
    RAISE EXCEPTION 'ditemukan index cacat/invalid pada orders/order_items/ledger_stok: %', v_invalid_list;
  END IF;

  -- Pastikan view kompatibilitas mundur APK lama tetap utuh
  IF to_regclass('public.ledger_transaksi_ringkas') IS NULL THEN
    RAISE EXCEPTION 'view kompatibilitas public.ledger_transaksi_ringkas hilang';
  END IF;

  -- 4. Pastikan kepadatan fisik idx_ledger_outlet_bahan_created sudah rapat
  --    (sebelum REINDEX: 156 MB / 1,86 juta baris = ~87,8 byte/baris;
  --     sesudah REINDEX rapat: ~88 MB / 1,86 juta baris = ~49,8 byte/baris untuk 2 UUID + timestamptz)
  v_ledger_idx_bytes := pg_relation_size('public.idx_ledger_outlet_bahan_created'::regclass);
  SELECT c.reltuples::numeric
    INTO v_ledger_tuples
  FROM pg_class c
  WHERE c.oid = 'public.idx_ledger_outlet_bahan_created'::regclass;

  IF COALESCE(v_ledger_tuples, 0) > 0 THEN
    v_bytes_per_row := v_ledger_idx_bytes::numeric / v_ledger_tuples;
    IF v_bytes_per_row >= 65 THEN
      RAISE EXCEPTION 'idx_ledger_outlet_bahan_created masih bengkak: % byte/baris (% bytes untuk % baris, batas < 65 byte/baris)',
        round(v_bytes_per_row, 2), v_ledger_idx_bytes, v_ledger_tuples::bigint;
    END IF;
  ELSIF v_ledger_idx_bytes >= 115343360 THEN
    RAISE EXCEPTION 'idx_ledger_outlet_bahan_created masih bengkak: % bytes', v_ledger_idx_bytes;
  END IF;

  -- 5. Verifikasi EXPLAIN pola kueri utama
  SELECT l.outlet_id, l.bahan_baku_id
    INTO v_outlet, v_bahan
  FROM (
    SELECT outlet_id, bahan_baku_id
    FROM public.ledger_stok
    WHERE created_at >= now() - interval '30 days'
    LIMIT 5000
  ) l
  GROUP BY l.outlet_id, l.bahan_baku_id
  ORDER BY count(*) ASC
  LIMIT 1;

  IF v_outlet IS NOT NULL AND v_bahan IS NOT NULL THEN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT tipe, qty, catatan, created_at FROM public.ledger_stok WHERE outlet_id = %L::uuid AND bahan_baku_id = %L::uuid ORDER BY created_at DESC LIMIT 50',
      v_outlet,
      v_bahan
    ) INTO v_plan;

    IF position('idx_ledger_outlet_bahan_created' IN v_plan::text) = 0 THEN
      RAISE EXCEPTION 'EXPLAIN fetchItemDetail tidak memakai idx_ledger_outlet_bahan_created: %', v_plan::text;
    END IF;
  END IF;

  SELECT oi.order_id
    INTO v_order_id
  FROM public.order_items oi
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT order_id, menu_item_id, quantity FROM public.order_items WHERE order_id = %L::uuid',
      v_order_id
    ) INTO v_plan;

    IF position('Seq Scan' IN v_plan::text) > 0 THEN
      RAISE EXCEPTION 'EXPLAIN order_items per order_id jatuh ke Seq Scan: %', v_plan::text;
    END IF;
  END IF;

  IF v_outlet IS NOT NULL THEN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT id, total_amount, discount_amount, promo_subsidy, channel, sales_source, is_endorse FROM public.orders WHERE outlet_id = %L::uuid AND status = %L ORDER BY created_at DESC LIMIT 50',
      v_outlet,
      'completed'
    ) INTO v_plan;

    IF position('Seq Scan' IN v_plan::text) > 0 THEN
      RAISE EXCEPTION 'EXPLAIN orders dashboard jatuh ke Seq Scan: %', v_plan::text;
    END IF;
  END IF;

  RAISE NOTICE 'LULUS — 6 index duplikat bersih, 32 index penting valid, idx_ledger_outlet_bahan_created = % MB',
    round(v_ledger_idx_bytes / 1048576.0, 2);
END $$;

ROLLBACK;
