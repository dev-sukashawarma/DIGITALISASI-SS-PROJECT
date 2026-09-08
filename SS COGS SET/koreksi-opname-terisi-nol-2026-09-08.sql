-- Koreksi stok yang terhapus karena diisi 0 saat opname 1-7 September 2026.
-- Dijalankan 8 September 2026 atas persetujuan owner.
--
-- Kriteria baris yang masuk (disaring dari 120 opname finalized, seluruh outlet):
--   1. Saat opname, stok sistem > 0 tapi crew mengisi 0 (bukan mengosongkan).
--   2. Sampai sekarang saldonya masih kosong -- tidak pernah dihitung ulang
--      pada opname sesudahnya.
--   3. Ada hitungan fisik nyata sebelum penghapusan sebagai acuan (bukan angka
--      karangan), dan nilainya >= 1 satuan menengah.
--
-- SENGAJA DIKELUARKAN:
--   - ES BATU & Sayur/lettuce: barang habis harian, nol kemungkinan besar benar.
--   - SAOS TOMAT KOMPAN di Beji: acuannya sendiri (8 Dus) tidak wajar -- semua
--     hari lain 0 dan outlet lain hanya 0-1 Dus. Merestorasinya = stok hantu.
--   - Seluruh baris BNR: catatan stoknya sudah korup sejak sebelum September
--     (mis. tercatat 400 Dus PLASTIK VACUM). Perlu opname fisik menyeluruh,
--     bukan koreksi per baris.
--
-- SOP: lewat ledger_stok, bukan UPDATE stok_balance. Delta dihitung dari saldo
-- live saat eksekusi; baris dengan delta 0 dilewati, jadi aman dijalankan ulang.

INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
SELECT sb.outlet_id,
       sb.bahan_baku_id,
       'adjustment',
       t.target - sb.saldo,
       'Koreksi: stok terhapus karena diisi 0 saat opname. Dikembalikan ke hitungan fisik terakhir (' || t.label || ').'
  FROM (VALUES
  ('550e8400-e29b-41d4-a716-446655440014'::uuid, '7a4cf7fa-bf85-488f-b3d9-f74900bc94d2'::uuid, 350::numeric, '1.40 Ikat — opname 2026-09-02'),
  ('550e8400-e29b-41d4-a716-446655440014'::uuid, '0c9bf83c-2905-4130-aae7-0d70bd4687b7'::uuid, 50::numeric, '2.00 Pack — opname 2026-09-06'),
  ('550e8400-e29b-41d4-a716-446655440017'::uuid, '18c50c96-12f6-46b4-9cab-295a02358202'::uuid, 1000::numeric, '0.08 Dus — opname 2026-08-30'),
  ('550e8400-e29b-41d4-a716-446655440017'::uuid, '0c9bf83c-2905-4130-aae7-0d70bd4687b7'::uuid, 63::numeric, '2.52 Pack — opname 2026-09-04'),
  ('550e8400-e29b-41d4-a716-446655440019'::uuid, '115bc2de-673f-498f-94aa-45f507f7fc84'::uuid, 3000::numeric, '1.00 tabung — opname 2026-09-06'),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, 'ef7fdaf9-1e51-4e46-9ef2-3df1159a4273'::uuid, 250::numeric, '1.00 Ikat — opname 2026-09-06'),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, 'cd96cf70-ec36-4e05-95f7-f311348ffc87'::uuid, 200::numeric, '0.40 Ikat — opname 2026-09-06'),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, 'd86d96e6-d7eb-4ddc-ae5c-60303a41c55b'::uuid, 7000::numeric, '0.37 Tube — opname 2026-09-06'),
  ('550e8400-e29b-41d4-a716-446655440011'::uuid, 'cf2abde4-4b5a-4f26-94c8-aeacf18a0120'::uuid, 202::numeric, '0.10 Dus — opname 2026-09-01'),
  ('550e8400-e29b-41d4-a716-446655440011'::uuid, '4804d1fc-f06c-4306-adfd-a798bda1275a'::uuid, 27408::numeric, '0.75 Dus — opname 2026-09-03'),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'd86d96e6-d7eb-4ddc-ae5c-60303a41c55b'::uuid, 11000::numeric, '0.58 Tube — opname 2026-08-31'),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'e88b2d74-748b-4360-b47e-7f9a5a2f0776'::uuid, 2::numeric, '2 Unit — opname 2026-09-01'),
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, 'd86d96e6-d7eb-4ddc-ae5c-60303a41c55b'::uuid, 4000::numeric, '0.21 Tube — opname 2026-09-06'),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, 'd86d96e6-d7eb-4ddc-ae5c-60303a41c55b'::uuid, 10000::numeric, '0.53 Tube — opname 2026-09-04'),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '115bc2de-673f-498f-94aa-45f507f7fc84'::uuid, 3000::numeric, '1.00 tabung — opname 2026-09-06'),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '8dba860c-afd7-4d2c-8ee5-a063aca1dee1'::uuid, 8::numeric, '8 Pack — opname 2026-09-02')
       ) AS t(outlet_id, bahan_baku_id, target, label)
  JOIN public.stok_balance sb
    ON sb.outlet_id = t.outlet_id AND sb.bahan_baku_id = t.bahan_baku_id
 WHERE ROUND(t.target - sb.saldo, 4) <> 0;
