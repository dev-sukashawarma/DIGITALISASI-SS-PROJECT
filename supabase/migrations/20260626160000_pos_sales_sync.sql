-- ============================================================
-- POS Sales Sync — infrastruktur untuk menyalin penjualan POS
-- (paid + selesai) dari project "sistem order" (qntuh…) ke
-- tabel public.orders DB Utama, agar masuk view SPV & dashboard.
--
-- Aditif & idempoten. Tidak mengubah perilaku insert aplikasi
-- yang sudah mengisi order_number sendiri.
-- ============================================================

-- 1. Tabel pemetaan outlet: id outlet sistem order -> id outlet DB Utama.
--    (id antar project BERBEDA, nama/slug tidak sejajar 1:1.)
CREATE TABLE IF NOT EXISTS public.pos_outlet_map (
  source_outlet_id uuid PRIMARY KEY,
  main_outlet_id   uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  source_name      text,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Seed pemetaan (22 outlet; 2 outlet uji 'cabang baru buka' & 'test' sengaja
-- tidak dipetakan → otomatis dilewati saat sync). Cibubur ganda → 1 outlet utama.
INSERT INTO public.pos_outlet_map (source_outlet_id, main_outlet_id, source_name) VALUES
  ('0dbe64fd-5019-4d24-ae1a-0a7f977790ac','550e8400-e29b-41d4-a716-446655440007','SUKA Shawarma Beji'),
  ('f03b9742-f19f-431d-b278-6885c12434ac','550e8400-e29b-41d4-a716-446655440014','SUKA Shawarma Cibinong (MITRA)'),
  ('b64f37e0-6004-4b2e-8b0d-c93e7342610c','3f38c41d-11e3-49ce-a189-d7303e45f9ad','SUKA Shawarma Cibubur'),
  ('ec0384f4-5eab-4432-83a6-2f313546dde7','3f38c41d-11e3-49ce-a189-d7303e45f9ad','SUKA SHAWARMA CIBUBUR (dup)'),
  ('0a952b3e-3d12-46ce-b325-8244a0709765','550e8400-e29b-41d4-a716-446655440004','SUKA Shawarma Cimanggu'),
  ('13522936-23fa-43e0-a94f-535b502cd098','550e8400-e29b-41d4-a716-446655440011','SUKA Shawarma Cirendeu'),
  ('ce4ad321-2b51-4c05-9f0a-48bec8d47615','550e8400-e29b-41d4-a716-446655440017','SUKA Shawarma Ciseeng (MITRA)'),
  ('fc1c5a2d-1063-4940-8b25-fc83bf32ebf3','550e8400-e29b-41d4-a716-446655440015','SUKA Shawarma Citayam (MITRA)'),
  ('86f89911-843f-450e-9ad4-bc0a9a134254','550e8400-e29b-41d4-a716-446655440005','SUKA Shawarma Depok Sukmajaya'),
  ('6e10168e-4cb6-492b-8412-eee4fef1bd20','550e8400-e29b-41d4-a716-446655440013','SUKA SHAWARMA DRAMAGA'),
  ('f70585b0-8a88-4473-9798-9268719822b9','550e8400-e29b-41d4-a716-446655440002','SUKA Shawarma Empang'),
  ('a8c4bdb7-0961-43fd-a9b6-274452d3b754','d23e11b3-23f1-4f9a-b428-cc73e1aa9b90','SUKA SHAWARMA HQ'),
  ('889977aa-316e-4ed9-b334-0c92745c8ebc','550e8400-e29b-41d4-a716-446655440006','SUKA Shawarma Jagakarsa'),
  ('954a0f12-6e51-4c06-b05b-25e3cadd0ebc','550e8400-e29b-41d4-a716-446655440012','SUKA Shawarma Jatiasih'),
  ('fd863a24-32e8-4bbc-81cf-af420a632e74','550e8400-e29b-41d4-a716-446655440010','SUKA Shawarma Jatiwaringin'),
  ('69ce36db-74b9-4a45-a6bf-444059c0696e','550e8400-e29b-41d4-a716-446655440019','SUKA Shawarma Kalisari (MITRA)'),
  ('d63df55b-7038-405a-b53e-dbe7cee99ec2','550e8400-e29b-41d4-a716-446655440001','SUKA Shawarma Kitchen (PUSAT)'),
  ('ad29c254-697f-4977-9927-cf823f65ba34','550e8400-e29b-41d4-a716-446655440009','SUKA Shawarma Pajajaran'),
  ('240f1c1d-ddff-4338-8c50-baa330b45e3a','550e8400-e29b-41d4-a716-446655440003','SUKA Shawarma Paledang'),
  ('0cf76c85-7058-459d-91f7-8ceab0bc331c','550e8400-e29b-41d4-a716-446655440018','SUKA Shawarma Pekayon (MITRA)'),
  ('e22ea23c-0bf5-4c71-8aea-5d850e03eab3','550e8400-e29b-41d4-a716-446655440008','SUKA Shawarma Sawangan'),
  ('8d79e331-9cea-41aa-8b08-6a4781ae6cd3','550e8400-e29b-41d4-a716-446655440016','SUKA Shawarma Tebet (MITRA)')
ON CONFLICT (source_outlet_id) DO UPDATE
  SET main_outlet_id = EXCLUDED.main_outlet_id,
      source_name    = EXCLUDED.source_name;

-- 2. Index unik untuk UPSERT idempoten berdasarkan order asal.
--    (NULL boleh berulang di Postgres, jadi baris non-sync tak terganggu.)
CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_uq
  ON public.orders (external_order_id);

-- 3. Auto-isi order_number untuk baris hasil sync (yang tidak memberi nomor).
--    Sequence mulai tinggi (9.000.000) agar TIDAK bentrok dgn nomor aplikasi.
CREATE SEQUENCE IF NOT EXISTS public.pos_sync_order_number_seq START 9000000;

CREATE OR REPLACE FUNCTION public.fill_order_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := nextval('public.pos_sync_order_number_seq');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_order_number ON public.orders;
CREATE TRIGGER trg_fill_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fill_order_number();

-- 4. State sinkronisasi (cursor incremental untuk Edge Function sync-pos-sales).
CREATE TABLE IF NOT EXISTS public.pos_sync_state (
  key   text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
