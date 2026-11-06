-- Uji logika order_tandai_preorder_wa() TANPA menyentuh public.orders:
-- fungsi dipasang ke tabel sementara berkolom sama. Jalankan dalam transaksi.
BEGIN;

CREATE TEMP TABLE t_orders (
  id int, channel text, sales_source text, customer_name text, created_at timestamptz
) ON COMMIT DROP;

CREATE TRIGGER t_trg BEFORE INSERT OR UPDATE ON t_orders
  FOR EACH ROW EXECUTE FUNCTION public.order_tandai_preorder_wa();

INSERT INTO t_orders VALUES
  (1, 'website', 'online', 'omar [Jam Ambil: 17.00]', '2026-11-06 10:00+00'),  -- kena
  (2, 'website', 'pos',    'Evan [Jam Ambil: 20.30]', '2026-10-01 00:00+07'),  -- kena (batas tepat)
  (3, 'website', 'pos',    'sekar [Jam Ambil: 16.00]','2026-09-30 23:59+07'),  -- September: tidak
  (4, NULL,      'online', 'Omar',                    '2026-11-06 10:00+00'),  -- pesanan web asli: tidak
  (5, 'website', 'online', 'Tanpa penanda',           '2026-11-06 10:00+00'),  -- tanpa [Jam Ambil: tidak
  (6, 'preorder_wa', 'online', 'x',                   '2026-11-06 10:00+00'),  -- sudah preorder: sales_source dipaksa pos
  (7, 'gofood',  'pos',    'F-1234 [Jam Ambil: 1]',   '2026-11-06 10:00+00');  -- food apps: tidak

DO $$
DECLARE v text;
BEGIN
  IF (SELECT count(*) FROM t_orders WHERE id IN (1,2,6) AND channel='preorder_wa' AND sales_source='pos') <> 3 THEN
    RAISE EXCEPTION 'GAGAL: baris 1/2/6 harus jadi preorder_wa + pos';
  END IF;
  SELECT string_agg(id::text||':'||coalesce(channel,'-')||'/'||sales_source, ',' ORDER BY id) INTO v
    FROM t_orders WHERE id IN (3,4,5,7);
  IF v <> '3:website/pos,4:-/online,5:website/online,7:gofood/pos' THEN
    RAISE EXCEPTION 'GAGAL: baris yang tak boleh berubah ikut berubah: %', v;
  END IF;
  -- UPDATE kolom terkait juga memicu penanda
  UPDATE t_orders SET customer_name = 'Tanpa penanda [Jam Ambil: 18.00]' WHERE id = 5;
  IF (SELECT channel FROM t_orders WHERE id = 5) <> 'preorder_wa' THEN
    RAISE EXCEPTION 'GAGAL: UPDATE customer_name tidak menandai';
  END IF;
  RAISE NOTICE 'LULUS t1_trigger';
END $$;

ROLLBACK;
