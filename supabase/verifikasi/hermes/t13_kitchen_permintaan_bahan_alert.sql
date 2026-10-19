-- Disposable database only. All send attempts go to a local outbox stub.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ss_kitchen_alert_test' THEN
    RAISE EXCEPTION 'Use a disposable database named ss_kitchen_alert_test';
  END IF;
END $$;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.outlets (id UUID PRIMARY KEY, name TEXT, type TEXT, is_active BOOLEAN);
CREATE TABLE public.bahan_baku (id UUID PRIMARY KEY, nama TEXT, satuan TEXT, default_reorder_point NUMERIC, is_active BOOLEAN);
CREATE TABLE public.outlet_staff (id UUID PRIMARY KEY, name TEXT, role TEXT, status TEXT, outlet_id UUID);
CREATE TABLE public.permintaan_bahan (
  id UUID PRIMARY KEY,
  outlet_id UUID REFERENCES outlets(id),
  dibuat_oleh UUID REFERENCES outlet_staff(id),
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.permintaan_bahan_item (
  id UUID PRIMARY KEY,
  permintaan_id UUID REFERENCES permintaan_bahan(id),
  bahan_baku_id UUID REFERENCES bahan_baku(id),
  qty_diminta NUMERIC
);

CREATE TABLE public.test_outbox (staff_id UUID, app TEXT, title TEXT, body TEXT);
CREATE FUNCTION public.bot_telegram_kirim_alert(UUID, TEXT, TEXT, TEXT, TEXT, UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = $1;
  IF v_role = 'leader' THEN
    RETURN;
  END IF;
  INSERT INTO public.test_outbox VALUES ($1, $2, $3, $4);
END;
$$;

\ir ../../migrations/20300254002800_telegram_stock_number_format.sql
\ir ../../migrations/20300254003800_kitchen_permintaan_bahan_alerts.sql

INSERT INTO outlets VALUES ('10000000-0000-0000-0000-000000000001','SS Pajajaran','outlet',TRUE);
INSERT INTO bahan_baku VALUES
  ('20000000-0000-0000-0000-000000000001','Daging Sapi Marinasi','kg',10,TRUE),
  ('20000000-0000-0000-0000-000000000002','Roti Pita','pack',20,TRUE);

INSERT INTO outlet_staff VALUES
  ('30000000-0000-0000-0000-000000000001','Ahmad Kru','crew','active','10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002','Doni Leader','leader','active','10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003','Chef Budi','kitchen','active',NULL);

-- TEST: Kru membuat permintaan bahan baru (menunggu)
INSERT INTO permintaan_bahan (id, outlet_id, dibuat_oleh, status)
VALUES ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'menunggu');

INSERT INTO permintaan_bahan_item (id, permintaan_id, bahan_baku_id, qty_diminta)
VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 15),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 30);

-- Verifikasi outbox sebelum commit / saat trigger dievaluasi
COMMIT;

-- Mulai transaksi baru untuk verifikasi hasil
BEGIN;
DO $$ BEGIN
  -- Staf Kitchen HARUS menerima alert
  IF NOT EXISTS (
    SELECT 1 FROM public.test_outbox
    WHERE staff_id = '30000000-0000-0000-0000-000000000003'
      AND title LIKE '%Permintaan Bahan Masuk · SS Pajajaran%'
      AND body LIKE '%Jumlah Item: 2 item%'
      AND body LIKE '%Daging Sapi Marinasi (15 kg)%'
      AND body LIKE '%Roti Pita (30 pack)%'
      AND body LIKE '%Dibuat oleh: Ahmad Kru%'
  ) THEN
    RAISE EXCEPTION 'FAIL: Kitchen did not receive proper material request alert!';
  END IF;

  -- Leader & Kru TIDAK BOLEH menerima
  IF EXISTS (SELECT 1 FROM public.test_outbox WHERE staff_id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')) THEN
    RAISE EXCEPTION 'FAIL: Non-kitchen staff received material request alert!';
  END IF;
END $$;

ROLLBACK;
