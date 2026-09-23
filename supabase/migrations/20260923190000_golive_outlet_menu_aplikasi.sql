-- Go-live aplikasi pelanggan: outlet & menu (2026-09-23, keputusan owner).
--
-- Murni data. Jalur kode (gateway /api/v1/outlets & /api/v1/catalog, halaman
-- admin "Outlet Aplikasi" & "Pengaturan Menu Aplikasi") sudah ada; yang kurang
-- hanya datanya -- sebelum ini cuma "outlet tes" yang app_enabled.
--
-- 1. 21 outlet operasional (11 milik + 10 mitra) dinyalakan.
--    Sengaja TIDAK: GUDANG SS ONLINE, GUDANG PUSAT (HQ), KANTOR PUSAT,
--    SS BACKUP (tanpa koordinat), marketplace.
-- 2. "outlet tes" dimatikan agar tak muncul di pemilih outlet pelanggan.
--    Developer menyalakannya lagi sementara lewat halaman Outlet Aplikasi.
-- 3. "Original Ayam Reguler" dikeluarkan dari aplikasi: harga POS-nya Rp 1
--    (sengaja dibiarkan owner di POS), di aplikasi pelanggan bisa membelinya
--    seharga Rp 1. POS tidak berubah.
--
-- Id eksplisit, bukan nama (nama bisa diubah admin). Idempoten.
--
-- Risiko yang diketahui, belum diselesaikan di sini:
--   - Tak ada jam buka: pelanggan bisa bayar QRIS di luar jam operasional.
--   - Uang QRIS pesanan aplikasi outlet mitra masuk rekening pusat, sementara
--     P&L mitra menghitungnya sebagai omzet outlet -> perlu aturan settlement.
--
-- Rollback: set app_enabled=false untuk 21 id di bawah, true untuk outlet tes,
-- tampil_di_app=true untuk menu 4a9c2877-....

UPDATE outlets SET app_enabled = true
WHERE id IN (
  -- milik sendiri
  '550e8400-e29b-41d4-a716-446655440007', -- BEJI
  '550e8400-e29b-41d4-a716-446655440001', -- BNR
  '550e8400-e29b-41d4-a716-446655440004', -- CIMANGGU
  '550e8400-e29b-41d4-a716-446655440011', -- CIRENDEU
  '550e8400-e29b-41d4-a716-446655440005', -- DEPOK SUKMAJAYA
  '550e8400-e29b-41d4-a716-446655440013', -- DRAMAGA
  '550e8400-e29b-41d4-a716-446655440002', -- EMPANG
  '550e8400-e29b-41d4-a716-446655440006', -- JAGAKARSA
  '550e8400-e29b-41d4-a716-446655440010', -- JATIWARINGIN
  '550e8400-e29b-41d4-a716-446655440009', -- PAJAJARAN
  '550e8400-e29b-41d4-a716-446655440008', -- SAWANGAN
  -- mitra
  '550e8400-e29b-41d4-a716-446655440014', -- CIBINONG
  '3f38c41d-11e3-49ce-a189-d7303e45f9ad', -- CIBUBUR
  'd9a2ef93-c298-4501-a471-1c5e2b3dff08', -- CICURUG
  '62a56103-2085-4dd5-9d25-a3c0cffc88ff', -- CILEUNGSI
  '550e8400-e29b-41d4-a716-446655440017', -- CISEENG
  '550e8400-e29b-41d4-a716-446655440019', -- KALISARI
  '550e8400-e29b-41d4-a716-446655440003', -- PALEDANG
  'bba67dba-2dca-4e98-bdb2-6a9e265e288c', -- PAMULANG
  '550e8400-e29b-41d4-a716-446655440018', -- PEKAYON
  '43b7bbd1-1fd4-44b5-87ca-b07a271151af'  -- SENTUL
)
AND app_enabled IS DISTINCT FROM true;

UPDATE outlets SET app_enabled = false
WHERE id = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a' -- outlet tes
  AND app_enabled IS DISTINCT FROM false;

UPDATE menu_items SET tampil_di_app = false
WHERE id = '4a9c2877-3c8a-42c8-8644-479988c84873' -- Original Ayam Reguler (Rp 1)
  AND tampil_di_app IS DISTINCT FROM false;

DO $$
DECLARE
  v_outlet int;
  v_tes    boolean;
  v_menu   int;
  v_rp1    int;
BEGIN
  SELECT count(*) INTO v_outlet FROM outlets WHERE app_enabled;
  SELECT app_enabled INTO v_tes FROM outlets WHERE id = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';
  SELECT count(*) INTO v_menu FROM menu_items WHERE tampil_di_app;
  SELECT count(*) INTO v_rp1 FROM menu_items WHERE tampil_di_app AND price <= 1
    AND COALESCE(NULLIF(channel_prices->>'aplikasi', ''), '0')::numeric <= 1;

  IF v_outlet <> 21 THEN RAISE EXCEPTION 'outlet app_enabled = %, harap 21', v_outlet; END IF;
  IF v_tes THEN RAISE EXCEPTION 'outlet tes masih app_enabled'; END IF;
  IF v_menu <> 18 THEN RAISE EXCEPTION 'menu tampil_di_app = %, harap 18', v_menu; END IF;
  IF v_rp1 <> 0 THEN RAISE EXCEPTION 'masih ada % menu aplikasi berharga <= Rp 1', v_rp1; END IF;
END $$;
