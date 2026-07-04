-- update-plastik-merah-satuan.sql
-- PLASTIK MERAH sudah ada di master (seed 20260609001800, satuan='pack').
-- Disetujui owner (2026-07-04): ubah satuan ke per-lembar karena isi per pack
-- tidak tetap (kadang 20, kadang 50 lembar) — harga per lembar konsisten Rp200,
-- jadi stok sebaiknya dicatat per-lembar langsung, bukan per-pack.
--
-- ⚠️ satuan = 'pcs' (BUKAN 'lembar') karena bahan_baku.satuan punya CHECK
-- constraint yang cuma mengizinkan: kg, gram, liter, ml, pcs, box, pack, ikat,
-- botol, crt, kompan. 'lembar' akan DITOLAK oleh database. 'pcs' di sini artinya
-- 1 pcs = 1 lembar plastik (cocok dengan resep_item yang pakai satuan 'lembar').
--
-- ⚠️ default_reorder_point lama (50) dihitung dalam satuan PACK. Setelah satuan
-- jadi PCS/LEMBAR, angka reorder harus di-skalakan ulang (mis. 50 pack x ~35
-- lembar rata-rata = ~1750 lembar) — angka di bawah PERKIRAAN, mohon dikonfirmasi
-- owner sebelum dipakai untuk alert reorder produksi.
--
-- ⚠️ Cek juga apakah ada stok_balance / ledger_stok existing untuk PLASTIK MERAH
-- yang tercatat dalam satuan pack — kalau ada histori, angka itu TIDAK otomatis
-- terkonversi (tetap tercatat sebagai angka pack lama). Perlu penyesuaian manual
-- kalau outlet sudah punya saldo stok PLASTIK MERAH sebelum migration ini.

UPDATE bahan_baku
SET satuan = 'pcs', default_reorder_point = 1750
WHERE nama = 'PLASTIK MERAH' AND satuan = 'pack';
