-- =============================================================================
-- SEED: Stok awal per outlet (19 outlet × 33 bahan baku)
-- Komposisi level: ~65% AMAN | ~25% MENIPIS | ~10% KRITIS
-- Qty di-generate berdasarkan default_reorder_point masing-masing bahan:
--   AMAN     → saldo  > 2× reorder_point
--   MENIPIS  → saldo  antara 1× dan 2× reorder_point
--   KRITIS   → saldo  < 1× reorder_point (≥ 1 supaya tidak nol)
--
-- Insert via ledger_stok tipe='adjustment' agar trigger otomatis memperbarui
-- stok_balance dan mengisi saldo_sebelum / saldo_sesudah dengan benar.
-- =============================================================================

DO $$
DECLARE
  -- Outlet IDs (sesuai 20260609000500_seed_outlets.sql)
  -- === INTERNAL OUTLETS (13) ===
  o01 UUID := '550e8400-e29b-41d4-a716-446655440001'; -- KITCHEN Bogor
  o02 UUID := '550e8400-e29b-41d4-a716-446655440002'; -- EMPANG Bogor
  o03 UUID := '550e8400-e29b-41d4-a716-446655440003'; -- PALEDANG Bogor
  o04 UUID := '550e8400-e29b-41d4-a716-446655440004'; -- CIMANGGU Bogor
  o05 UUID := '550e8400-e29b-41d4-a716-446655440005'; -- SUKMAJAYA Depok
  o06 UUID := '550e8400-e29b-41d4-a716-446655440006'; -- JAGAKARSA Jakarta
  o07 UUID := '550e8400-e29b-41d4-a716-446655440007'; -- BEJI Depok
  o08 UUID := '550e8400-e29b-41d4-a716-446655440008'; -- SAWANGAN Depok
  o09 UUID := '550e8400-e29b-41d4-a716-446655440009'; -- PAJAJARAN Bogor
  o10 UUID := '550e8400-e29b-41d4-a716-446655440010'; -- JATIWARINGIN Bekasi
  o11 UUID := '550e8400-e29b-41d4-a716-446655440011'; -- CIRENDEU Tangsel
  o12 UUID := '550e8400-e29b-41d4-a716-446655440012'; -- JATIASIH Bekasi
  o13 UUID := '550e8400-e29b-41d4-a716-446655440013'; -- DRAMAGA Bogor
  -- === MITRA OUTLETS (6) ===
  o14 UUID := '550e8400-e29b-41d4-a716-446655440014'; -- MITRA CIBINONG
  o15 UUID := '550e8400-e29b-41d4-a716-446655440015'; -- MITRA CITAYAM
  o16 UUID := '550e8400-e29b-41d4-a716-446655440016'; -- MITRA TEBET
  o17 UUID := '550e8400-e29b-41d4-a716-446655440017'; -- MITRA CISEENG
  o18 UUID := '550e8400-e29b-41d4-a716-446655440018'; -- MITRA PEKAYON
  o19 UUID := '550e8400-e29b-41d4-a716-446655440019'; -- MITRA KALISARI

  -- Bahan baku IDs (resolved via nama)
  b_saus_x_hot       UUID; b_saus_tomat        UUID; b_saos_samyang      UUID;
  b_mayones           UUID; b_kulit_25          UUID; b_kulit_28          UUID;
  b_kulit_32          UUID; b_ayam              UUID; b_sapi              UUID;
  b_kentang           UUID; b_tepung            UUID; b_tum               UUID;
  b_bawang            UUID; b_minyak_sayur      UUID; b_polybag           UUID;
  b_plastik_merah     UUID; b_foil              UUID; b_keju              UUID;
  b_plastik_besar     UUID; b_sarung_tangan     UUID; b_kertas_struk      UUID;
  b_paper_wrap        UUID; b_lettuce           UUID; b_gas_3kg           UUID;
  b_sabun             UUID; b_sasa              UUID; b_garam             UUID;
  b_kunyit            UUID; b_ketumbar          UUID; b_kayu_manis        UUID;
  b_plastik_kecil     UUID; b_jinten            UUID; b_cengkeh           UUID;
BEGIN
  -- Resolve UUIDs dari nama bahan baku
  SELECT id INTO b_saus_x_hot    FROM bahan_baku WHERE nama = 'SAUS X HOT';
  SELECT id INTO b_saus_tomat    FROM bahan_baku WHERE nama = 'SAUS TOMAT';
  SELECT id INTO b_saos_samyang  FROM bahan_baku WHERE nama = 'SAOS SAMYANG';
  SELECT id INTO b_mayones       FROM bahan_baku WHERE nama = 'MAYONES';
  SELECT id INTO b_kulit_25      FROM bahan_baku WHERE nama = 'KULIT 25';
  SELECT id INTO b_kulit_28      FROM bahan_baku WHERE nama = 'KULIT 28';
  SELECT id INTO b_kulit_32      FROM bahan_baku WHERE nama = 'KULIT 32';
  SELECT id INTO b_ayam          FROM bahan_baku WHERE nama = 'AYAM';
  SELECT id INTO b_sapi          FROM bahan_baku WHERE nama = 'SAPI';
  SELECT id INTO b_kentang       FROM bahan_baku WHERE nama = 'KENTANG';
  SELECT id INTO b_tepung        FROM bahan_baku WHERE nama = 'TEPUNG';
  SELECT id INTO b_tum           FROM bahan_baku WHERE nama = 'TUM';
  SELECT id INTO b_bawang        FROM bahan_baku WHERE nama = 'BAWANG';
  SELECT id INTO b_minyak_sayur  FROM bahan_baku WHERE nama = 'MINYAK SAYUR';
  SELECT id INTO b_polybag       FROM bahan_baku WHERE nama = 'POLYBAG';
  SELECT id INTO b_plastik_merah FROM bahan_baku WHERE nama = 'PLASTIK MERAH';
  SELECT id INTO b_foil          FROM bahan_baku WHERE nama = 'FOIL';
  SELECT id INTO b_keju          FROM bahan_baku WHERE nama = 'KEJU';
  SELECT id INTO b_plastik_besar FROM bahan_baku WHERE nama = 'PLASTIK BESAR';
  SELECT id INTO b_sarung_tangan FROM bahan_baku WHERE nama = 'SARUNG TANGAN BENI';
  SELECT id INTO b_kertas_struk  FROM bahan_baku WHERE nama = 'KERTAS STRUK';
  SELECT id INTO b_paper_wrap    FROM bahan_baku WHERE nama = 'PAPER WRAP';
  SELECT id INTO b_lettuce       FROM bahan_baku WHERE nama = 'LETTUCE';
  SELECT id INTO b_gas_3kg       FROM bahan_baku WHERE nama = 'GAS 3Kg';
  SELECT id INTO b_sabun         FROM bahan_baku WHERE nama = 'SABUN';
  SELECT id INTO b_sasa          FROM bahan_baku WHERE nama = 'SASA';
  SELECT id INTO b_garam         FROM bahan_baku WHERE nama = 'GARAM';
  SELECT id INTO b_kunyit        FROM bahan_baku WHERE nama = 'KUNYIT';
  SELECT id INTO b_ketumbar      FROM bahan_baku WHERE nama = 'KETUMBAR';
  SELECT id INTO b_kayu_manis    FROM bahan_baku WHERE nama = 'KAYU MANIS';
  SELECT id INTO b_plastik_kecil FROM bahan_baku WHERE nama = 'PLASTIK KECIL';
  SELECT id INTO b_jinten        FROM bahan_baku WHERE nama = 'JINTEN';
  SELECT id INTO b_cengkeh       FROM bahan_baku WHERE nama = 'CENGKEH';

  -- ===========================================================================
  -- OUTLET 01 – KITCHEN Bogor (dapur pusat, stok paling besar & aman)
  -- Reorder point reference: saus=5, kulit=20, ayam=30, sapi=10, dst.
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o01, b_saus_x_hot,       'adjustment', 22,  'Seed awal - AMAN'),      -- rp=5, aman >10
    (o01, b_saus_tomat,       'adjustment', 28,  'Seed awal - AMAN'),
    (o01, b_saos_samyang,     'adjustment', 18,  'Seed awal - AMAN'),
    (o01, b_mayones,          'adjustment', 20,  'Seed awal - AMAN'),
    (o01, b_kulit_25,         'adjustment', 72,  'Seed awal - AMAN'),      -- rp=20, aman >40
    (o01, b_kulit_28,         'adjustment', 78,  'Seed awal - AMAN'),
    (o01, b_kulit_32,         'adjustment', 65,  'Seed awal - AMAN'),
    (o01, b_ayam,             'adjustment', 110, 'Seed awal - AMAN'),      -- rp=30, aman >60
    (o01, b_sapi,             'adjustment', 32,  'Seed awal - AMAN'),      -- rp=10, aman >20
    (o01, b_kentang,          'adjustment', 42,  'Seed awal - AMAN'),      -- rp=10, aman >20
    (o01, b_tepung,           'adjustment', 38,  'Seed awal - AMAN'),      -- rp=10, aman >20
    (o01, b_tum,              'adjustment', 18,  'Seed awal - AMAN'),      -- rp=5, aman >10
    (o01, b_bawang,           'adjustment', 16,  'Seed awal - AMAN'),      -- rp=5, aman >10
    (o01, b_minyak_sayur,     'adjustment',  7,  'Seed awal - AMAN'),      -- rp=2, aman >4
    (o01, b_polybag,          'adjustment', 175, 'Seed awal - AMAN'),      -- rp=50, aman >100
    (o01, b_plastik_merah,    'adjustment', 148, 'Seed awal - AMAN'),
    (o01, b_foil,             'adjustment', 35,  'Seed awal - AMAN'),      -- rp=10, aman >20
    (o01, b_keju,             'adjustment', 18,  'Seed awal - AMAN'),      -- rp=5, aman >10
    (o01, b_plastik_besar,    'adjustment', 138, 'Seed awal - AMAN'),
    (o01, b_sarung_tangan,    'adjustment', 95,  'Seed awal - AMAN'),      -- rp=30, aman >60
    (o01, b_kertas_struk,     'adjustment', 158, 'Seed awal - AMAN'),      -- rp=50, aman >100
    (o01, b_paper_wrap,       'adjustment', 340, 'Seed awal - AMAN'),      -- rp=100, aman >200
    (o01, b_lettuce,          'adjustment', 18,  'Seed awal - AMAN'),      -- rp=5, aman >10
    (o01, b_gas_3kg,          'adjustment',  8,  'Seed awal - AMAN'),      -- rp=2, aman >4
    (o01, b_sabun,            'adjustment', 28,  'Seed awal - AMAN'),      -- rp=10, aman >20
    (o01, b_sasa,             'adjustment', 15,  'Seed awal - AMAN'),      -- rp=5, aman >10
    (o01, b_garam,            'adjustment', 16,  'Seed awal - AMAN'),
    (o01, b_kunyit,           'adjustment', 14,  'Seed awal - AMAN'),
    (o01, b_ketumbar,         'adjustment',  6,  'Seed awal - AMAN'),      -- rp=2, aman >4
    (o01, b_kayu_manis,       'adjustment',  6,  'Seed awal - AMAN'),
    (o01, b_plastik_kecil,    'adjustment', 155, 'Seed awal - AMAN'),      -- rp=50, aman >100
    (o01, b_jinten,           'adjustment',  6,  'Seed awal - AMAN'),
    (o01, b_cengkeh,          'adjustment',  7,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 02 – EMPANG Bogor (beberapa menipis, 1 kritis)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o02, b_saus_x_hot,       'adjustment',  8,  'Seed awal - MENIPIS'),   -- rp=5, menipis 5-10
    (o02, b_saus_tomat,       'adjustment', 20,  'Seed awal - AMAN'),
    (o02, b_saos_samyang,     'adjustment',  7,  'Seed awal - MENIPIS'),
    (o02, b_mayones,          'adjustment', 16,  'Seed awal - AMAN'),
    (o02, b_kulit_25,         'adjustment', 55,  'Seed awal - AMAN'),
    (o02, b_kulit_28,         'adjustment', 28,  'Seed awal - MENIPIS'),   -- rp=20, menipis 20-40
    (o02, b_kulit_32,         'adjustment', 60,  'Seed awal - AMAN'),
    (o02, b_ayam,             'adjustment', 75,  'Seed awal - AMAN'),
    (o02, b_sapi,             'adjustment',  3,  'Seed awal - KRITIS'),    -- rp=10, kritis <10
    (o02, b_kentang,          'adjustment', 32,  'Seed awal - AMAN'),
    (o02, b_tepung,           'adjustment', 25,  'Seed awal - AMAN'),
    (o02, b_tum,              'adjustment', 12,  'Seed awal - AMAN'),
    (o02, b_bawang,           'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o02, b_minyak_sayur,     'adjustment',  5,  'Seed awal - AMAN'),
    (o02, b_polybag,          'adjustment', 128, 'Seed awal - AMAN'),
    (o02, b_plastik_merah,    'adjustment', 108, 'Seed awal - AMAN'),
    (o02, b_foil,             'adjustment', 25,  'Seed awal - AMAN'),
    (o02, b_keju,             'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o02, b_plastik_besar,    'adjustment', 95,  'Seed awal - AMAN'),
    (o02, b_sarung_tangan,    'adjustment', 78,  'Seed awal - AMAN'),
    (o02, b_kertas_struk,     'adjustment', 118, 'Seed awal - AMAN'),
    (o02, b_paper_wrap,       'adjustment', 245, 'Seed awal - AMAN'),
    (o02, b_lettuce,          'adjustment', 12,  'Seed awal - AMAN'),
    (o02, b_gas_3kg,          'adjustment',  1,  'Seed awal - KRITIS'),    -- rp=2
    (o02, b_sabun,            'adjustment', 22,  'Seed awal - AMAN'),
    (o02, b_sasa,             'adjustment',  8,  'Seed awal - MENIPIS'),
    (o02, b_garam,            'adjustment', 12,  'Seed awal - AMAN'),
    (o02, b_kunyit,           'adjustment', 10,  'Seed awal - AMAN'),
    (o02, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o02, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o02, b_plastik_kecil,    'adjustment', 112, 'Seed awal - AMAN'),
    (o02, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o02, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 03 – PALEDANG Bogor (stok aman rata-rata)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o03, b_saus_x_hot,       'adjustment', 18,  'Seed awal - AMAN'),
    (o03, b_saus_tomat,       'adjustment', 22,  'Seed awal - AMAN'),
    (o03, b_saos_samyang,     'adjustment', 15,  'Seed awal - AMAN'),
    (o03, b_mayones,          'adjustment', 17,  'Seed awal - AMAN'),
    (o03, b_kulit_25,         'adjustment', 62,  'Seed awal - AMAN'),
    (o03, b_kulit_28,         'adjustment', 58,  'Seed awal - AMAN'),
    (o03, b_kulit_32,         'adjustment', 50,  'Seed awal - AMAN'),
    (o03, b_ayam,             'adjustment', 88,  'Seed awal - AMAN'),
    (o03, b_sapi,             'adjustment', 25,  'Seed awal - AMAN'),
    (o03, b_kentang,          'adjustment', 36,  'Seed awal - AMAN'),
    (o03, b_tepung,           'adjustment', 32,  'Seed awal - AMAN'),
    (o03, b_tum,              'adjustment', 14,  'Seed awal - AMAN'),
    (o03, b_bawang,           'adjustment', 13,  'Seed awal - AMAN'),
    (o03, b_minyak_sayur,     'adjustment',  6,  'Seed awal - AMAN'),
    (o03, b_polybag,          'adjustment', 155, 'Seed awal - AMAN'),
    (o03, b_plastik_merah,    'adjustment', 132, 'Seed awal - AMAN'),
    (o03, b_foil,             'adjustment', 30,  'Seed awal - AMAN'),
    (o03, b_keju,             'adjustment', 15,  'Seed awal - AMAN'),
    (o03, b_plastik_besar,    'adjustment', 118, 'Seed awal - AMAN'),
    (o03, b_sarung_tangan,    'adjustment', 88,  'Seed awal - AMAN'),
    (o03, b_kertas_struk,     'adjustment', 142, 'Seed awal - AMAN'),
    (o03, b_paper_wrap,       'adjustment', 305, 'Seed awal - AMAN'),
    (o03, b_lettuce,          'adjustment', 16,  'Seed awal - AMAN'),
    (o03, b_gas_3kg,          'adjustment',  7,  'Seed awal - AMAN'),
    (o03, b_sabun,            'adjustment', 26,  'Seed awal - AMAN'),
    (o03, b_sasa,             'adjustment', 13,  'Seed awal - AMAN'),
    (o03, b_garam,            'adjustment', 15,  'Seed awal - AMAN'),
    (o03, b_kunyit,           'adjustment', 13,  'Seed awal - AMAN'),
    (o03, b_ketumbar,         'adjustment',  6,  'Seed awal - AMAN'),
    (o03, b_kayu_manis,       'adjustment',  6,  'Seed awal - AMAN'),
    (o03, b_plastik_kecil,    'adjustment', 148, 'Seed awal - AMAN'),
    (o03, b_jinten,           'adjustment',  6,  'Seed awal - AMAN'),
    (o03, b_cengkeh,          'adjustment',  6,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 04 – CIMANGGU Bogor (kritis di beberapa item saus & kulit)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o04, b_saus_x_hot,       'adjustment',  4,  'Seed awal - KRITIS'),    -- rp=5, kritis
    (o04, b_saus_tomat,       'adjustment',  8,  'Seed awal - MENIPIS'),   -- rp=5
    (o04, b_saos_samyang,     'adjustment', 15,  'Seed awal - AMAN'),
    (o04, b_mayones,          'adjustment', 14,  'Seed awal - AMAN'),
    (o04, b_kulit_25,         'adjustment', 25,  'Seed awal - MENIPIS'),   -- rp=20
    (o04, b_kulit_28,         'adjustment', 62,  'Seed awal - AMAN'),
    (o04, b_kulit_32,         'adjustment',  9,  'Seed awal - KRITIS'),    -- rp=20
    (o04, b_ayam,             'adjustment', 68,  'Seed awal - AMAN'),
    (o04, b_sapi,             'adjustment', 22,  'Seed awal - AMAN'),
    (o04, b_kentang,          'adjustment', 14,  'Seed awal - MENIPIS'),   -- rp=10
    (o04, b_tepung,           'adjustment', 26,  'Seed awal - AMAN'),
    (o04, b_tum,              'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o04, b_bawang,           'adjustment', 12,  'Seed awal - AMAN'),
    (o04, b_minyak_sayur,     'adjustment',  4,  'Seed awal - AMAN'),
    (o04, b_polybag,          'adjustment', 118, 'Seed awal - AMAN'),
    (o04, b_plastik_merah,    'adjustment', 92,  'Seed awal - AMAN'),
    (o04, b_foil,             'adjustment', 22,  'Seed awal - AMAN'),
    (o04, b_keju,             'adjustment',  3,  'Seed awal - KRITIS'),    -- rp=5
    (o04, b_plastik_besar,    'adjustment', 98,  'Seed awal - AMAN'),
    (o04, b_sarung_tangan,    'adjustment', 72,  'Seed awal - AMAN'),
    (o04, b_kertas_struk,     'adjustment', 105, 'Seed awal - AMAN'),
    (o04, b_paper_wrap,       'adjustment', 215, 'Seed awal - AMAN'),
    (o04, b_lettuce,          'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o04, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o04, b_sabun,            'adjustment', 18,  'Seed awal - AMAN'),
    (o04, b_sasa,             'adjustment', 10,  'Seed awal - AMAN'),
    (o04, b_garam,            'adjustment', 12,  'Seed awal - AMAN'),
    (o04, b_kunyit,           'adjustment', 10,  'Seed awal - AMAN'),
    (o04, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o04, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o04, b_plastik_kecil,    'adjustment', 102, 'Seed awal - AMAN'),
    (o04, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o04, b_cengkeh,          'adjustment',  4,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 05 – SUKMAJAYA Depok (stok aman, 2 item menipis)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o05, b_saus_x_hot,       'adjustment', 16,  'Seed awal - AMAN'),
    (o05, b_saus_tomat,       'adjustment', 19,  'Seed awal - AMAN'),
    (o05, b_saos_samyang,     'adjustment', 13,  'Seed awal - AMAN'),
    (o05, b_mayones,          'adjustment', 15,  'Seed awal - AMAN'),
    (o05, b_kulit_25,         'adjustment', 52,  'Seed awal - AMAN'),
    (o05, b_kulit_28,         'adjustment', 55,  'Seed awal - AMAN'),
    (o05, b_kulit_32,         'adjustment', 45,  'Seed awal - AMAN'),
    (o05, b_ayam,             'adjustment', 80,  'Seed awal - AMAN'),
    (o05, b_sapi,             'adjustment', 24,  'Seed awal - AMAN'),
    (o05, b_kentang,          'adjustment', 30,  'Seed awal - AMAN'),
    (o05, b_tepung,           'adjustment', 28,  'Seed awal - AMAN'),
    (o05, b_tum,              'adjustment', 13,  'Seed awal - AMAN'),
    (o05, b_bawang,           'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o05, b_minyak_sayur,     'adjustment',  5,  'Seed awal - AMAN'),
    (o05, b_polybag,          'adjustment', 142, 'Seed awal - AMAN'),
    (o05, b_plastik_merah,    'adjustment', 116, 'Seed awal - AMAN'),
    (o05, b_foil,             'adjustment', 27,  'Seed awal - AMAN'),
    (o05, b_keju,             'adjustment', 13,  'Seed awal - AMAN'),
    (o05, b_plastik_besar,    'adjustment', 108, 'Seed awal - AMAN'),
    (o05, b_sarung_tangan,    'adjustment', 82,  'Seed awal - AMAN'),
    (o05, b_kertas_struk,     'adjustment', 128, 'Seed awal - AMAN'),
    (o05, b_paper_wrap,       'adjustment', 265, 'Seed awal - AMAN'),
    (o05, b_lettuce,          'adjustment', 13,  'Seed awal - AMAN'),
    (o05, b_gas_3kg,          'adjustment',  6,  'Seed awal - AMAN'),
    (o05, b_sabun,            'adjustment', 24,  'Seed awal - AMAN'),
    (o05, b_sasa,             'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o05, b_garam,            'adjustment', 14,  'Seed awal - AMAN'),
    (o05, b_kunyit,           'adjustment', 12,  'Seed awal - AMAN'),
    (o05, b_ketumbar,         'adjustment',  5,  'Seed awal - AMAN'),
    (o05, b_kayu_manis,       'adjustment',  5,  'Seed awal - AMAN'),
    (o05, b_plastik_kecil,    'adjustment', 125, 'Seed awal - AMAN'),
    (o05, b_jinten,           'adjustment',  5,  'Seed awal - AMAN'),
    (o05, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 06 – JAGAKARSA Jakarta (menipis di protein & bumbu)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o06, b_saus_x_hot,       'adjustment', 14,  'Seed awal - AMAN'),
    (o06, b_saus_tomat,       'adjustment', 17,  'Seed awal - AMAN'),
    (o06, b_saos_samyang,     'adjustment', 12,  'Seed awal - AMAN'),
    (o06, b_mayones,          'adjustment', 14,  'Seed awal - AMAN'),
    (o06, b_kulit_25,         'adjustment', 48,  'Seed awal - AMAN'),
    (o06, b_kulit_28,         'adjustment', 50,  'Seed awal - AMAN'),
    (o06, b_kulit_32,         'adjustment', 42,  'Seed awal - AMAN'),
    (o06, b_ayam,             'adjustment', 38,  'Seed awal - MENIPIS'),   -- rp=30
    (o06, b_sapi,             'adjustment', 14,  'Seed awal - MENIPIS'),   -- rp=10
    (o06, b_kentang,          'adjustment', 26,  'Seed awal - AMAN'),
    (o06, b_tepung,           'adjustment', 24,  'Seed awal - AMAN'),
    (o06, b_tum,              'adjustment', 10,  'Seed awal - AMAN'),
    (o06, b_bawang,           'adjustment', 10,  'Seed awal - AMAN'),
    (o06, b_minyak_sayur,     'adjustment',  1,  'Seed awal - KRITIS'),    -- rp=2
    (o06, b_polybag,          'adjustment', 122, 'Seed awal - AMAN'),
    (o06, b_plastik_merah,    'adjustment', 100, 'Seed awal - AMAN'),
    (o06, b_foil,             'adjustment', 23,  'Seed awal - AMAN'),
    (o06, b_keju,             'adjustment', 12,  'Seed awal - AMAN'),
    (o06, b_plastik_besar,    'adjustment', 88,  'Seed awal - AMAN'),
    (o06, b_sarung_tangan,    'adjustment', 68,  'Seed awal - AMAN'),
    (o06, b_kertas_struk,     'adjustment', 112, 'Seed awal - AMAN'),
    (o06, b_paper_wrap,       'adjustment', 235, 'Seed awal - AMAN'),
    (o06, b_lettuce,          'adjustment', 10,  'Seed awal - AMAN'),
    (o06, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o06, b_sabun,            'adjustment', 20,  'Seed awal - AMAN'),
    (o06, b_sasa,             'adjustment', 10,  'Seed awal - AMAN'),
    (o06, b_garam,            'adjustment', 11,  'Seed awal - AMAN'),
    (o06, b_kunyit,           'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o06, b_ketumbar,         'adjustment',  3,  'Seed awal - AMAN'),
    (o06, b_kayu_manis,       'adjustment',  3,  'Seed awal - AMAN'),
    (o06, b_plastik_kecil,    'adjustment', 108, 'Seed awal - AMAN'),
    (o06, b_jinten,           'adjustment',  3,  'Seed awal - AMAN'),
    (o06, b_cengkeh,          'adjustment',  4,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 07 – BEJI Depok (stok aman, outlet aktif)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o07, b_saus_x_hot,       'adjustment', 17,  'Seed awal - AMAN'),
    (o07, b_saus_tomat,       'adjustment', 21,  'Seed awal - AMAN'),
    (o07, b_saos_samyang,     'adjustment', 14,  'Seed awal - AMAN'),
    (o07, b_mayones,          'adjustment', 17,  'Seed awal - AMAN'),
    (o07, b_kulit_25,         'adjustment', 58,  'Seed awal - AMAN'),
    (o07, b_kulit_28,         'adjustment', 60,  'Seed awal - AMAN'),
    (o07, b_kulit_32,         'adjustment', 48,  'Seed awal - AMAN'),
    (o07, b_ayam,             'adjustment', 85,  'Seed awal - AMAN'),
    (o07, b_sapi,             'adjustment', 26,  'Seed awal - AMAN'),
    (o07, b_kentang,          'adjustment', 34,  'Seed awal - AMAN'),
    (o07, b_tepung,           'adjustment', 30,  'Seed awal - AMAN'),
    (o07, b_tum,              'adjustment', 14,  'Seed awal - AMAN'),
    (o07, b_bawang,           'adjustment', 13,  'Seed awal - AMAN'),
    (o07, b_minyak_sayur,     'adjustment',  6,  'Seed awal - AMAN'),
    (o07, b_polybag,          'adjustment', 145, 'Seed awal - AMAN'),
    (o07, b_plastik_merah,    'adjustment', 118, 'Seed awal - AMAN'),
    (o07, b_foil,             'adjustment', 28,  'Seed awal - AMAN'),
    (o07, b_keju,             'adjustment', 14,  'Seed awal - AMAN'),
    (o07, b_plastik_besar,    'adjustment', 112, 'Seed awal - AMAN'),
    (o07, b_sarung_tangan,    'adjustment', 85,  'Seed awal - AMAN'),
    (o07, b_kertas_struk,     'adjustment', 132, 'Seed awal - AMAN'),
    (o07, b_paper_wrap,       'adjustment', 275, 'Seed awal - AMAN'),
    (o07, b_lettuce,          'adjustment', 15,  'Seed awal - AMAN'),
    (o07, b_gas_3kg,          'adjustment',  7,  'Seed awal - AMAN'),
    (o07, b_sabun,            'adjustment', 25,  'Seed awal - AMAN'),
    (o07, b_sasa,             'adjustment', 13,  'Seed awal - AMAN'),
    (o07, b_garam,            'adjustment', 15,  'Seed awal - AMAN'),
    (o07, b_kunyit,           'adjustment', 13,  'Seed awal - AMAN'),
    (o07, b_ketumbar,         'adjustment',  5,  'Seed awal - AMAN'),
    (o07, b_kayu_manis,       'adjustment',  5,  'Seed awal - AMAN'),
    (o07, b_plastik_kecil,    'adjustment', 132, 'Seed awal - AMAN'),
    (o07, b_jinten,           'adjustment',  5,  'Seed awal - AMAN'),
    (o07, b_cengkeh,          'adjustment',  6,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 08 – SAWANGAN Depok (kritis di kemasan habis pakai)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o08, b_saus_x_hot,       'adjustment', 15,  'Seed awal - AMAN'),
    (o08, b_saus_tomat,       'adjustment', 18,  'Seed awal - AMAN'),
    (o08, b_saos_samyang,     'adjustment', 12,  'Seed awal - AMAN'),
    (o08, b_mayones,          'adjustment', 15,  'Seed awal - AMAN'),
    (o08, b_kulit_25,         'adjustment', 12,  'Seed awal - KRITIS'),    -- rp=20
    (o08, b_kulit_28,         'adjustment', 55,  'Seed awal - AMAN'),
    (o08, b_kulit_32,         'adjustment', 44,  'Seed awal - AMAN'),
    (o08, b_ayam,             'adjustment', 78,  'Seed awal - AMAN'),
    (o08, b_sapi,             'adjustment', 22,  'Seed awal - AMAN'),
    (o08, b_kentang,          'adjustment', 30,  'Seed awal - AMAN'),
    (o08, b_tepung,           'adjustment', 14,  'Seed awal - MENIPIS'),   -- rp=10
    (o08, b_tum,              'adjustment', 12,  'Seed awal - AMAN'),
    (o08, b_bawang,           'adjustment', 11,  'Seed awal - AMAN'),
    (o08, b_minyak_sayur,     'adjustment',  5,  'Seed awal - AMAN'),
    (o08, b_polybag,          'adjustment', 38,  'Seed awal - KRITIS'),    -- rp=50
    (o08, b_plastik_merah,    'adjustment', 102, 'Seed awal - AMAN'),
    (o08, b_foil,             'adjustment', 14,  'Seed awal - MENIPIS'),   -- rp=10
    (o08, b_keju,             'adjustment', 12,  'Seed awal - AMAN'),
    (o08, b_plastik_besar,    'adjustment', 95,  'Seed awal - AMAN'),
    (o08, b_sarung_tangan,    'adjustment', 72,  'Seed awal - AMAN'),
    (o08, b_kertas_struk,     'adjustment', 115, 'Seed awal - AMAN'),
    (o08, b_paper_wrap,       'adjustment', 248, 'Seed awal - AMAN'),
    (o08, b_lettuce,          'adjustment', 12,  'Seed awal - AMAN'),
    (o08, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o08, b_sabun,            'adjustment', 21,  'Seed awal - AMAN'),
    (o08, b_sasa,             'adjustment', 11,  'Seed awal - AMAN'),
    (o08, b_garam,            'adjustment', 13,  'Seed awal - AMAN'),
    (o08, b_kunyit,           'adjustment', 11,  'Seed awal - AMAN'),
    (o08, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o08, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o08, b_plastik_kecil,    'adjustment', 115, 'Seed awal - AMAN'),
    (o08, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o08, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 09 – PAJAJARAN Bogor (stok aman)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o09, b_saus_x_hot,       'adjustment', 18,  'Seed awal - AMAN'),
    (o09, b_saus_tomat,       'adjustment', 22,  'Seed awal - AMAN'),
    (o09, b_saos_samyang,     'adjustment', 15,  'Seed awal - AMAN'),
    (o09, b_mayones,          'adjustment', 17,  'Seed awal - AMAN'),
    (o09, b_kulit_25,         'adjustment', 58,  'Seed awal - AMAN'),
    (o09, b_kulit_28,         'adjustment', 60,  'Seed awal - AMAN'),
    (o09, b_kulit_32,         'adjustment', 48,  'Seed awal - AMAN'),
    (o09, b_ayam,             'adjustment', 86,  'Seed awal - AMAN'),
    (o09, b_sapi,             'adjustment', 26,  'Seed awal - AMAN'),
    (o09, b_kentang,          'adjustment', 34,  'Seed awal - AMAN'),
    (o09, b_tepung,           'adjustment', 30,  'Seed awal - AMAN'),
    (o09, b_tum,              'adjustment', 14,  'Seed awal - AMAN'),
    (o09, b_bawang,           'adjustment', 13,  'Seed awal - AMAN'),
    (o09, b_minyak_sayur,     'adjustment',  6,  'Seed awal - AMAN'),
    (o09, b_polybag,          'adjustment', 148, 'Seed awal - AMAN'),
    (o09, b_plastik_merah,    'adjustment', 122, 'Seed awal - AMAN'),
    (o09, b_foil,             'adjustment', 28,  'Seed awal - AMAN'),
    (o09, b_keju,             'adjustment', 14,  'Seed awal - AMAN'),
    (o09, b_plastik_besar,    'adjustment', 112, 'Seed awal - AMAN'),
    (o09, b_sarung_tangan,    'adjustment', 85,  'Seed awal - AMAN'),
    (o09, b_kertas_struk,     'adjustment', 135, 'Seed awal - AMAN'),
    (o09, b_paper_wrap,       'adjustment', 278, 'Seed awal - AMAN'),
    (o09, b_lettuce,          'adjustment', 15,  'Seed awal - AMAN'),
    (o09, b_gas_3kg,          'adjustment',  7,  'Seed awal - AMAN'),
    (o09, b_sabun,            'adjustment', 25,  'Seed awal - AMAN'),
    (o09, b_sasa,             'adjustment', 13,  'Seed awal - AMAN'),
    (o09, b_garam,            'adjustment', 15,  'Seed awal - AMAN'),
    (o09, b_kunyit,           'adjustment', 13,  'Seed awal - AMAN'),
    (o09, b_ketumbar,         'adjustment',  5,  'Seed awal - AMAN'),
    (o09, b_kayu_manis,       'adjustment',  5,  'Seed awal - AMAN'),
    (o09, b_plastik_kecil,    'adjustment', 130, 'Seed awal - AMAN'),
    (o09, b_jinten,           'adjustment',  5,  'Seed awal - AMAN'),
    (o09, b_cengkeh,          'adjustment',  6,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 10 – JATIWARINGIN Bekasi (beberapa menipis, 1 kritis)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o10, b_saus_x_hot,       'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o10, b_saus_tomat,       'adjustment', 19,  'Seed awal - AMAN'),
    (o10, b_saos_samyang,     'adjustment',  8,  'Seed awal - MENIPIS'),
    (o10, b_mayones,          'adjustment', 15,  'Seed awal - AMAN'),
    (o10, b_kulit_25,         'adjustment', 28,  'Seed awal - MENIPIS'),   -- rp=20
    (o10, b_kulit_28,         'adjustment', 52,  'Seed awal - AMAN'),
    (o10, b_kulit_32,         'adjustment', 44,  'Seed awal - AMAN'),
    (o10, b_ayam,             'adjustment', 70,  'Seed awal - AMAN'),
    (o10, b_sapi,             'adjustment', 18,  'Seed awal - AMAN'),
    (o10, b_kentang,          'adjustment', 15,  'Seed awal - MENIPIS'),   -- rp=10
    (o10, b_tepung,           'adjustment', 24,  'Seed awal - AMAN'),
    (o10, b_tum,              'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o10, b_bawang,           'adjustment',  3,  'Seed awal - KRITIS'),    -- rp=5
    (o10, b_minyak_sayur,     'adjustment',  5,  'Seed awal - AMAN'),
    (o10, b_polybag,          'adjustment', 128, 'Seed awal - AMAN'),
    (o10, b_plastik_merah,    'adjustment', 108, 'Seed awal - AMAN'),
    (o10, b_foil,             'adjustment', 24,  'Seed awal - AMAN'),
    (o10, b_keju,             'adjustment', 11,  'Seed awal - AMAN'),
    (o10, b_plastik_besar,    'adjustment', 92,  'Seed awal - AMAN'),
    (o10, b_sarung_tangan,    'adjustment', 70,  'Seed awal - AMAN'),
    (o10, b_kertas_struk,     'adjustment', 115, 'Seed awal - AMAN'),
    (o10, b_paper_wrap,       'adjustment', 238, 'Seed awal - AMAN'),
    (o10, b_lettuce,          'adjustment',  7,  'Seed awal - MENIPIS'),
    (o10, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o10, b_sabun,            'adjustment', 20,  'Seed awal - AMAN'),
    (o10, b_sasa,             'adjustment',  8,  'Seed awal - MENIPIS'),
    (o10, b_garam,            'adjustment', 12,  'Seed awal - AMAN'),
    (o10, b_kunyit,           'adjustment', 10,  'Seed awal - AMAN'),
    (o10, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o10, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o10, b_plastik_kecil,    'adjustment', 110, 'Seed awal - AMAN'),
    (o10, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o10, b_cengkeh,          'adjustment',  4,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 11 – CIRENDEU Tangsel (stok aman)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o11, b_saus_x_hot,       'adjustment', 16,  'Seed awal - AMAN'),
    (o11, b_saus_tomat,       'adjustment', 20,  'Seed awal - AMAN'),
    (o11, b_saos_samyang,     'adjustment', 14,  'Seed awal - AMAN'),
    (o11, b_mayones,          'adjustment', 16,  'Seed awal - AMAN'),
    (o11, b_kulit_25,         'adjustment', 55,  'Seed awal - AMAN'),
    (o11, b_kulit_28,         'adjustment', 57,  'Seed awal - AMAN'),
    (o11, b_kulit_32,         'adjustment', 46,  'Seed awal - AMAN'),
    (o11, b_ayam,             'adjustment', 82,  'Seed awal - AMAN'),
    (o11, b_sapi,             'adjustment', 25,  'Seed awal - AMAN'),
    (o11, b_kentang,          'adjustment', 32,  'Seed awal - AMAN'),
    (o11, b_tepung,           'adjustment', 28,  'Seed awal - AMAN'),
    (o11, b_tum,              'adjustment', 13,  'Seed awal - AMAN'),
    (o11, b_bawang,           'adjustment', 12,  'Seed awal - AMAN'),
    (o11, b_minyak_sayur,     'adjustment',  6,  'Seed awal - AMAN'),
    (o11, b_polybag,          'adjustment', 138, 'Seed awal - AMAN'),
    (o11, b_plastik_merah,    'adjustment', 115, 'Seed awal - AMAN'),
    (o11, b_foil,             'adjustment', 27,  'Seed awal - AMAN'),
    (o11, b_keju,             'adjustment', 13,  'Seed awal - AMAN'),
    (o11, b_plastik_besar,    'adjustment', 108, 'Seed awal - AMAN'),
    (o11, b_sarung_tangan,    'adjustment', 82,  'Seed awal - AMAN'),
    (o11, b_kertas_struk,     'adjustment', 128, 'Seed awal - AMAN'),
    (o11, b_paper_wrap,       'adjustment', 268, 'Seed awal - AMAN'),
    (o11, b_lettuce,          'adjustment', 14,  'Seed awal - AMAN'),
    (o11, b_gas_3kg,          'adjustment',  6,  'Seed awal - AMAN'),
    (o11, b_sabun,            'adjustment', 24,  'Seed awal - AMAN'),
    (o11, b_sasa,             'adjustment', 12,  'Seed awal - AMAN'),
    (o11, b_garam,            'adjustment', 14,  'Seed awal - AMAN'),
    (o11, b_kunyit,           'adjustment', 12,  'Seed awal - AMAN'),
    (o11, b_ketumbar,         'adjustment',  5,  'Seed awal - AMAN'),
    (o11, b_kayu_manis,       'adjustment',  5,  'Seed awal - AMAN'),
    (o11, b_plastik_kecil,    'adjustment', 125, 'Seed awal - AMAN'),
    (o11, b_jinten,           'adjustment',  5,  'Seed awal - AMAN'),
    (o11, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 12 – JATIASIH Bekasi (kritis di saus & kemasan)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o12, b_saus_x_hot,       'adjustment',  2,  'Seed awal - KRITIS'),    -- rp=5
    (o12, b_saus_tomat,       'adjustment',  8,  'Seed awal - MENIPIS'),
    (o12, b_saos_samyang,     'adjustment',  7,  'Seed awal - MENIPIS'),
    (o12, b_mayones,          'adjustment', 15,  'Seed awal - AMAN'),
    (o12, b_kulit_25,         'adjustment', 50,  'Seed awal - AMAN'),
    (o12, b_kulit_28,         'adjustment', 52,  'Seed awal - AMAN'),
    (o12, b_kulit_32,         'adjustment', 43,  'Seed awal - AMAN'),
    (o12, b_ayam,             'adjustment', 72,  'Seed awal - AMAN'),
    (o12, b_sapi,             'adjustment', 21,  'Seed awal - AMAN'),
    (o12, b_kentang,          'adjustment', 28,  'Seed awal - AMAN'),
    (o12, b_tepung,           'adjustment', 26,  'Seed awal - AMAN'),
    (o12, b_tum,              'adjustment', 12,  'Seed awal - AMAN'),
    (o12, b_bawang,           'adjustment', 11,  'Seed awal - AMAN'),
    (o12, b_minyak_sayur,     'adjustment',  4,  'Seed awal - AMAN'),
    (o12, b_polybag,          'adjustment', 32,  'Seed awal - KRITIS'),    -- rp=50
    (o12, b_plastik_merah,    'adjustment', 98,  'Seed awal - AMAN'),
    (o12, b_foil,             'adjustment', 22,  'Seed awal - AMAN'),
    (o12, b_keju,             'adjustment', 11,  'Seed awal - AMAN'),
    (o12, b_plastik_besar,    'adjustment', 88,  'Seed awal - AMAN'),
    (o12, b_sarung_tangan,    'adjustment', 68,  'Seed awal - AMAN'),
    (o12, b_kertas_struk,     'adjustment', 112, 'Seed awal - AMAN'),
    (o12, b_paper_wrap,       'adjustment', 225, 'Seed awal - AMAN'),
    (o12, b_lettuce,          'adjustment', 11,  'Seed awal - AMAN'),
    (o12, b_gas_3kg,          'adjustment',  4,  'Seed awal - AMAN'),
    (o12, b_sabun,            'adjustment', 20,  'Seed awal - AMAN'),
    (o12, b_sasa,             'adjustment', 10,  'Seed awal - AMAN'),
    (o12, b_garam,            'adjustment', 12,  'Seed awal - AMAN'),
    (o12, b_kunyit,           'adjustment', 10,  'Seed awal - AMAN'),
    (o12, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o12, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o12, b_plastik_kecil,    'adjustment', 108, 'Seed awal - AMAN'),
    (o12, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o12, b_cengkeh,          'adjustment',  4,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 13 – DRAMAGA Bogor (outlet kecil, sebagian menipis)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o13, b_saus_x_hot,       'adjustment', 12,  'Seed awal - AMAN'),
    (o13, b_saus_tomat,       'adjustment', 16,  'Seed awal - AMAN'),
    (o13, b_saos_samyang,     'adjustment', 11,  'Seed awal - AMAN'),
    (o13, b_mayones,          'adjustment', 13,  'Seed awal - AMAN'),
    (o13, b_kulit_25,         'adjustment', 24,  'Seed awal - MENIPIS'),   -- rp=20
    (o13, b_kulit_28,         'adjustment', 44,  'Seed awal - AMAN'),
    (o13, b_kulit_32,         'adjustment', 36,  'Seed awal - AMAN'),
    (o13, b_ayam,             'adjustment', 38,  'Seed awal - MENIPIS'),   -- rp=30
    (o13, b_sapi,             'adjustment', 14,  'Seed awal - MENIPIS'),   -- rp=10
    (o13, b_kentang,          'adjustment', 24,  'Seed awal - AMAN'),
    (o13, b_tepung,           'adjustment', 22,  'Seed awal - AMAN'),
    (o13, b_tum,              'adjustment', 10,  'Seed awal - AMAN'),
    (o13, b_bawang,           'adjustment',  7,  'Seed awal - MENIPIS'),   -- rp=5
    (o13, b_minyak_sayur,     'adjustment',  4,  'Seed awal - AMAN'),
    (o13, b_polybag,          'adjustment', 118, 'Seed awal - AMAN'),
    (o13, b_plastik_merah,    'adjustment', 98,  'Seed awal - AMAN'),
    (o13, b_foil,             'adjustment', 22,  'Seed awal - AMAN'),
    (o13, b_keju,             'adjustment', 10,  'Seed awal - AMAN'),
    (o13, b_plastik_besar,    'adjustment', 82,  'Seed awal - AMAN'),
    (o13, b_sarung_tangan,    'adjustment', 64,  'Seed awal - AMAN'),
    (o13, b_kertas_struk,     'adjustment', 108, 'Seed awal - AMAN'),
    (o13, b_paper_wrap,       'adjustment', 218, 'Seed awal - AMAN'),
    (o13, b_lettuce,          'adjustment',  8,  'Seed awal - MENIPIS'),
    (o13, b_gas_3kg,          'adjustment',  4,  'Seed awal - AMAN'),
    (o13, b_sabun,            'adjustment', 18,  'Seed awal - AMAN'),
    (o13, b_sasa,             'adjustment',  8,  'Seed awal - MENIPIS'),
    (o13, b_garam,            'adjustment', 11,  'Seed awal - AMAN'),
    (o13, b_kunyit,           'adjustment',  9,  'Seed awal - AMAN'),
    (o13, b_ketumbar,         'adjustment',  3,  'Seed awal - AMAN'),
    (o13, b_kayu_manis,       'adjustment',  3,  'Seed awal - AMAN'),
    (o13, b_plastik_kecil,    'adjustment', 102, 'Seed awal - AMAN'),
    (o13, b_jinten,           'adjustment',  3,  'Seed awal - AMAN'),
    (o13, b_cengkeh,          'adjustment',  4,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 14 – MITRA CIBINONG (stok aman, mitra aktif)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o14, b_saus_x_hot,       'adjustment', 15,  'Seed awal - AMAN'),
    (o14, b_saus_tomat,       'adjustment', 18,  'Seed awal - AMAN'),
    (o14, b_saos_samyang,     'adjustment', 13,  'Seed awal - AMAN'),
    (o14, b_mayones,          'adjustment', 15,  'Seed awal - AMAN'),
    (o14, b_kulit_25,         'adjustment', 48,  'Seed awal - AMAN'),
    (o14, b_kulit_28,         'adjustment', 52,  'Seed awal - AMAN'),
    (o14, b_kulit_32,         'adjustment', 42,  'Seed awal - AMAN'),
    (o14, b_ayam,             'adjustment', 72,  'Seed awal - AMAN'),
    (o14, b_sapi,             'adjustment', 22,  'Seed awal - AMAN'),
    (o14, b_kentang,          'adjustment', 28,  'Seed awal - AMAN'),
    (o14, b_tepung,           'adjustment', 25,  'Seed awal - AMAN'),
    (o14, b_tum,              'adjustment', 12,  'Seed awal - AMAN'),
    (o14, b_bawang,           'adjustment', 11,  'Seed awal - AMAN'),
    (o14, b_minyak_sayur,     'adjustment',  5,  'Seed awal - AMAN'),
    (o14, b_polybag,          'adjustment', 132, 'Seed awal - AMAN'),
    (o14, b_plastik_merah,    'adjustment', 110, 'Seed awal - AMAN'),
    (o14, b_foil,             'adjustment', 25,  'Seed awal - AMAN'),
    (o14, b_keju,             'adjustment', 12,  'Seed awal - AMAN'),
    (o14, b_plastik_besar,    'adjustment', 102, 'Seed awal - AMAN'),
    (o14, b_sarung_tangan,    'adjustment', 76,  'Seed awal - AMAN'),
    (o14, b_kertas_struk,     'adjustment', 122, 'Seed awal - AMAN'),
    (o14, b_paper_wrap,       'adjustment', 255, 'Seed awal - AMAN'),
    (o14, b_lettuce,          'adjustment', 13,  'Seed awal - AMAN'),
    (o14, b_gas_3kg,          'adjustment',  6,  'Seed awal - AMAN'),
    (o14, b_sabun,            'adjustment', 22,  'Seed awal - AMAN'),
    (o14, b_sasa,             'adjustment', 12,  'Seed awal - AMAN'),
    (o14, b_garam,            'adjustment', 13,  'Seed awal - AMAN'),
    (o14, b_kunyit,           'adjustment', 12,  'Seed awal - AMAN'),
    (o14, b_ketumbar,         'adjustment',  5,  'Seed awal - AMAN'),
    (o14, b_kayu_manis,       'adjustment',  5,  'Seed awal - AMAN'),
    (o14, b_plastik_kecil,    'adjustment', 118, 'Seed awal - AMAN'),
    (o14, b_jinten,           'adjustment',  5,  'Seed awal - AMAN'),
    (o14, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 15 – MITRA CITAYAM (kritis di protein, menipis lainnya)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o15, b_saus_x_hot,       'adjustment', 13,  'Seed awal - AMAN'),
    (o15, b_saus_tomat,       'adjustment', 16,  'Seed awal - AMAN'),
    (o15, b_saos_samyang,     'adjustment', 11,  'Seed awal - AMAN'),
    (o15, b_mayones,          'adjustment',  7,  'Seed awal - MENIPIS'),
    (o15, b_kulit_25,         'adjustment', 45,  'Seed awal - AMAN'),
    (o15, b_kulit_28,         'adjustment', 48,  'Seed awal - AMAN'),
    (o15, b_kulit_32,         'adjustment', 40,  'Seed awal - AMAN'),
    (o15, b_ayam,             'adjustment', 22,  'Seed awal - KRITIS'),    -- rp=30
    (o15, b_sapi,             'adjustment', 18,  'Seed awal - AMAN'),
    (o15, b_kentang,          'adjustment', 24,  'Seed awal - AMAN'),
    (o15, b_tepung,           'adjustment', 13,  'Seed awal - MENIPIS'),   -- rp=10
    (o15, b_tum,              'adjustment', 10,  'Seed awal - AMAN'),
    (o15, b_bawang,           'adjustment',  7,  'Seed awal - MENIPIS'),
    (o15, b_minyak_sayur,     'adjustment',  4,  'Seed awal - AMAN'),
    (o15, b_polybag,          'adjustment', 125, 'Seed awal - AMAN'),
    (o15, b_plastik_merah,    'adjustment', 105, 'Seed awal - AMAN'),
    (o15, b_foil,             'adjustment', 23,  'Seed awal - AMAN'),
    (o15, b_keju,             'adjustment', 12,  'Seed awal - AMAN'),
    (o15, b_plastik_besar,    'adjustment', 94,  'Seed awal - AMAN'),
    (o15, b_sarung_tangan,    'adjustment', 72,  'Seed awal - AMAN'),
    (o15, b_kertas_struk,     'adjustment', 118, 'Seed awal - AMAN'),
    (o15, b_paper_wrap,       'adjustment', 242, 'Seed awal - AMAN'),
    (o15, b_lettuce,          'adjustment', 12,  'Seed awal - AMAN'),
    (o15, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o15, b_sabun,            'adjustment', 20,  'Seed awal - AMAN'),
    (o15, b_sasa,             'adjustment', 11,  'Seed awal - AMAN'),
    (o15, b_garam,            'adjustment', 12,  'Seed awal - AMAN'),
    (o15, b_kunyit,           'adjustment', 11,  'Seed awal - AMAN'),
    (o15, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o15, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o15, b_plastik_kecil,    'adjustment', 113, 'Seed awal - AMAN'),
    (o15, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o15, b_cengkeh,          'adjustment',  4,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 16 – MITRA TEBET (beberapa menipis & kritis)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o16, b_saus_x_hot,       'adjustment',  8,  'Seed awal - MENIPIS'),
    (o16, b_saus_tomat,       'adjustment', 17,  'Seed awal - AMAN'),
    (o16, b_saos_samyang,     'adjustment',  7,  'Seed awal - MENIPIS'),
    (o16, b_mayones,          'adjustment', 14,  'Seed awal - AMAN'),
    (o16, b_kulit_25,         'adjustment', 47,  'Seed awal - AMAN'),
    (o16, b_kulit_28,         'adjustment', 27,  'Seed awal - MENIPIS'),   -- rp=20
    (o16, b_kulit_32,         'adjustment', 40,  'Seed awal - AMAN'),
    (o16, b_ayam,             'adjustment', 68,  'Seed awal - AMAN'),
    (o16, b_sapi,             'adjustment',  7,  'Seed awal - KRITIS'),    -- rp=10
    (o16, b_kentang,          'adjustment', 25,  'Seed awal - AMAN'),
    (o16, b_tepung,           'adjustment', 22,  'Seed awal - AMAN'),
    (o16, b_tum,              'adjustment',  6,  'Seed awal - MENIPIS'),
    (o16, b_bawang,           'adjustment', 10,  'Seed awal - AMAN'),
    (o16, b_minyak_sayur,     'adjustment',  4,  'Seed awal - AMAN'),
    (o16, b_polybag,          'adjustment', 118, 'Seed awal - AMAN'),
    (o16, b_plastik_merah,    'adjustment', 98,  'Seed awal - AMAN'),
    (o16, b_foil,             'adjustment', 21,  'Seed awal - AMAN'),
    (o16, b_keju,             'adjustment',  3,  'Seed awal - KRITIS'),    -- rp=5
    (o16, b_plastik_besar,    'adjustment', 88,  'Seed awal - AMAN'),
    (o16, b_sarung_tangan,    'adjustment', 68,  'Seed awal - AMAN'),
    (o16, b_kertas_struk,     'adjustment', 110, 'Seed awal - AMAN'),
    (o16, b_paper_wrap,       'adjustment', 228, 'Seed awal - AMAN'),
    (o16, b_lettuce,          'adjustment', 11,  'Seed awal - AMAN'),
    (o16, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o16, b_sabun,            'adjustment', 19,  'Seed awal - AMAN'),
    (o16, b_sasa,             'adjustment',  8,  'Seed awal - MENIPIS'),
    (o16, b_garam,            'adjustment', 11,  'Seed awal - AMAN'),
    (o16, b_kunyit,           'adjustment',  9,  'Seed awal - AMAN'),
    (o16, b_ketumbar,         'adjustment',  3,  'Seed awal - AMAN'),
    (o16, b_kayu_manis,       'adjustment',  3,  'Seed awal - AMAN'),
    (o16, b_plastik_kecil,    'adjustment', 106, 'Seed awal - AMAN'),
    (o16, b_jinten,           'adjustment',  3,  'Seed awal - AMAN'),
    (o16, b_cengkeh,          'adjustment',  4,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 17 – MITRA CISEENG (stok aman, mitra stabil)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o17, b_saus_x_hot,       'adjustment', 14,  'Seed awal - AMAN'),
    (o17, b_saus_tomat,       'adjustment', 17,  'Seed awal - AMAN'),
    (o17, b_saos_samyang,     'adjustment', 12,  'Seed awal - AMAN'),
    (o17, b_mayones,          'adjustment', 14,  'Seed awal - AMAN'),
    (o17, b_kulit_25,         'adjustment', 48,  'Seed awal - AMAN'),
    (o17, b_kulit_28,         'adjustment', 50,  'Seed awal - AMAN'),
    (o17, b_kulit_32,         'adjustment', 42,  'Seed awal - AMAN'),
    (o17, b_ayam,             'adjustment', 74,  'Seed awal - AMAN'),
    (o17, b_sapi,             'adjustment', 22,  'Seed awal - AMAN'),
    (o17, b_kentang,          'adjustment', 28,  'Seed awal - AMAN'),
    (o17, b_tepung,           'adjustment', 25,  'Seed awal - AMAN'),
    (o17, b_tum,              'adjustment', 12,  'Seed awal - AMAN'),
    (o17, b_bawang,           'adjustment', 11,  'Seed awal - AMAN'),
    (o17, b_minyak_sayur,     'adjustment',  5,  'Seed awal - AMAN'),
    (o17, b_polybag,          'adjustment', 132, 'Seed awal - AMAN'),
    (o17, b_plastik_merah,    'adjustment', 108, 'Seed awal - AMAN'),
    (o17, b_foil,             'adjustment', 24,  'Seed awal - AMAN'),
    (o17, b_keju,             'adjustment', 12,  'Seed awal - AMAN'),
    (o17, b_plastik_besar,    'adjustment', 100, 'Seed awal - AMAN'),
    (o17, b_sarung_tangan,    'adjustment', 75,  'Seed awal - AMAN'),
    (o17, b_kertas_struk,     'adjustment', 120, 'Seed awal - AMAN'),
    (o17, b_paper_wrap,       'adjustment', 252, 'Seed awal - AMAN'),
    (o17, b_lettuce,          'adjustment', 13,  'Seed awal - AMAN'),
    (o17, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o17, b_sabun,            'adjustment', 21,  'Seed awal - AMAN'),
    (o17, b_sasa,             'adjustment', 11,  'Seed awal - AMAN'),
    (o17, b_garam,            'adjustment', 12,  'Seed awal - AMAN'),
    (o17, b_kunyit,           'adjustment', 11,  'Seed awal - AMAN'),
    (o17, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o17, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o17, b_plastik_kecil,    'adjustment', 116, 'Seed awal - AMAN'),
    (o17, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o17, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 18 – MITRA PEKAYON Bekasi (beberapa menipis)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o18, b_saus_x_hot,       'adjustment', 16,  'Seed awal - AMAN'),
    (o18, b_saus_tomat,       'adjustment',  8,  'Seed awal - MENIPIS'),
    (o18, b_saos_samyang,     'adjustment', 13,  'Seed awal - AMAN'),
    (o18, b_mayones,          'adjustment', 15,  'Seed awal - AMAN'),
    (o18, b_kulit_25,         'adjustment', 50,  'Seed awal - AMAN'),
    (o18, b_kulit_28,         'adjustment', 52,  'Seed awal - AMAN'),
    (o18, b_kulit_32,         'adjustment', 42,  'Seed awal - AMAN'),
    (o18, b_ayam,             'adjustment', 76,  'Seed awal - AMAN'),
    (o18, b_sapi,             'adjustment', 21,  'Seed awal - AMAN'),
    (o18, b_kentang,          'adjustment', 28,  'Seed awal - AMAN'),
    (o18, b_tepung,           'adjustment', 15,  'Seed awal - MENIPIS'),
    (o18, b_tum,              'adjustment', 12,  'Seed awal - AMAN'),
    (o18, b_bawang,           'adjustment', 11,  'Seed awal - AMAN'),
    (o18, b_minyak_sayur,     'adjustment',  5,  'Seed awal - AMAN'),
    (o18, b_polybag,          'adjustment', 135, 'Seed awal - AMAN'),
    (o18, b_plastik_merah,    'adjustment', 112, 'Seed awal - AMAN'),
    (o18, b_foil,             'adjustment', 26,  'Seed awal - AMAN'),
    (o18, b_keju,             'adjustment',  7,  'Seed awal - MENIPIS'),
    (o18, b_plastik_besar,    'adjustment', 100, 'Seed awal - AMAN'),
    (o18, b_sarung_tangan,    'adjustment', 76,  'Seed awal - AMAN'),
    (o18, b_kertas_struk,     'adjustment', 122, 'Seed awal - AMAN'),
    (o18, b_paper_wrap,       'adjustment', 255, 'Seed awal - AMAN'),
    (o18, b_lettuce,          'adjustment', 13,  'Seed awal - AMAN'),
    (o18, b_gas_3kg,          'adjustment',  5,  'Seed awal - AMAN'),
    (o18, b_sabun,            'adjustment', 21,  'Seed awal - AMAN'),
    (o18, b_sasa,             'adjustment', 12,  'Seed awal - AMAN'),
    (o18, b_garam,            'adjustment', 13,  'Seed awal - AMAN'),
    (o18, b_kunyit,           'adjustment', 12,  'Seed awal - AMAN'),
    (o18, b_ketumbar,         'adjustment',  4,  'Seed awal - AMAN'),
    (o18, b_kayu_manis,       'adjustment',  4,  'Seed awal - AMAN'),
    (o18, b_plastik_kecil,    'adjustment', 118, 'Seed awal - AMAN'),
    (o18, b_jinten,           'adjustment',  4,  'Seed awal - AMAN'),
    (o18, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

  -- ===========================================================================
  -- OUTLET 19 – MITRA KALISARI Jakarta Timur (stok aman)
  -- ===========================================================================
  INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan) VALUES
    (o19, b_saus_x_hot,       'adjustment', 17,  'Seed awal - AMAN'),
    (o19, b_saus_tomat,       'adjustment', 20,  'Seed awal - AMAN'),
    (o19, b_saos_samyang,     'adjustment', 14,  'Seed awal - AMAN'),
    (o19, b_mayones,          'adjustment', 16,  'Seed awal - AMAN'),
    (o19, b_kulit_25,         'adjustment', 55,  'Seed awal - AMAN'),
    (o19, b_kulit_28,         'adjustment', 56,  'Seed awal - AMAN'),
    (o19, b_kulit_32,         'adjustment', 45,  'Seed awal - AMAN'),
    (o19, b_ayam,             'adjustment', 80,  'Seed awal - AMAN'),
    (o19, b_sapi,             'adjustment', 24,  'Seed awal - AMAN'),
    (o19, b_kentang,          'adjustment', 32,  'Seed awal - AMAN'),
    (o19, b_tepung,           'adjustment', 28,  'Seed awal - AMAN'),
    (o19, b_tum,              'adjustment', 13,  'Seed awal - AMAN'),
    (o19, b_bawang,           'adjustment', 12,  'Seed awal - AMAN'),
    (o19, b_minyak_sayur,     'adjustment',  6,  'Seed awal - AMAN'),
    (o19, b_polybag,          'adjustment', 140, 'Seed awal - AMAN'),
    (o19, b_plastik_merah,    'adjustment', 115, 'Seed awal - AMAN'),
    (o19, b_foil,             'adjustment', 27,  'Seed awal - AMAN'),
    (o19, b_keju,             'adjustment', 13,  'Seed awal - AMAN'),
    (o19, b_plastik_besar,    'adjustment', 105, 'Seed awal - AMAN'),
    (o19, b_sarung_tangan,    'adjustment', 80,  'Seed awal - AMAN'),
    (o19, b_kertas_struk,     'adjustment', 128, 'Seed awal - AMAN'),
    (o19, b_paper_wrap,       'adjustment', 265, 'Seed awal - AMAN'),
    (o19, b_lettuce,          'adjustment', 14,  'Seed awal - AMAN'),
    (o19, b_gas_3kg,          'adjustment',  6,  'Seed awal - AMAN'),
    (o19, b_sabun,            'adjustment', 24,  'Seed awal - AMAN'),
    (o19, b_sasa,             'adjustment', 13,  'Seed awal - AMAN'),
    (o19, b_garam,            'adjustment', 14,  'Seed awal - AMAN'),
    (o19, b_kunyit,           'adjustment', 13,  'Seed awal - AMAN'),
    (o19, b_ketumbar,         'adjustment',  5,  'Seed awal - AMAN'),
    (o19, b_kayu_manis,       'adjustment',  5,  'Seed awal - AMAN'),
    (o19, b_plastik_kecil,    'adjustment', 125, 'Seed awal - AMAN'),
    (o19, b_jinten,           'adjustment',  5,  'Seed awal - AMAN'),
    (o19, b_cengkeh,          'adjustment',  5,  'Seed awal - AMAN');

END $$;

-- =============================================================================
-- VERIFIKASI RINGKASAN
-- Jalankan query ini setelah migration untuk cek distribusi status stok:
--
-- SELECT
--   CASE
--     WHEN sb.saldo < b.default_reorder_point THEN 'KRITIS'
--     WHEN sb.saldo < b.default_reorder_point * 2 THEN 'MENIPIS'
--     ELSE 'AMAN'
--   END AS status,
--   COUNT(*) AS jumlah,
--   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS persen
-- FROM stok_balance sb
-- JOIN bahan_baku b ON sb.bahan_baku_id = b.id
-- GROUP BY 1
-- ORDER BY jumlah DESC;
-- =============================================================================
