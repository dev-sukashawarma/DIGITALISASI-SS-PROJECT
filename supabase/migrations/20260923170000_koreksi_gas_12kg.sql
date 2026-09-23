-- Koreksi master GAS 12 KG (dibuat 2026-09-23 09:05 lewat form "Tambah Bahan").
--
-- Dua bug form yang diperbaiki di commit yang sama (spec
-- docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md, Tahap 0):
--   1. createBahanBakuAction menulis bahan_baku_harga.updated_at (kolom tak ada)
--      dan tak memeriksa galat → harga_beli tak pernah tersimpan (SKU-nya
--      sendiri mencatat 220.000).
--   2. Form mengirim isian "1 tengah = ... kecil" sebagai faktor_tampilan dan tak
--      mengisi faktor_konversi (default DB = 1) → invarian faktor dilanggar.
--
-- Nilai benar (konfirmasi owner 2026-09-23): 1 tabung = 12 kg = 12.000 gram,
-- Rp 220.000 per tabung. Pola disamakan dengan GAS 3Kg (tabung / gram / 3000).
-- Dipakai hanya di Kitchen & outlet BNR — sistem belum punya cakupan per outlet,
-- jadi peruntukan = 'keduanya' (celah dicatat di spec).
--
-- Aman: bahan belum punya baris stok_balance / ledger_stok (dicek sebelum apply).
-- Idempoten: semua UPDATE bersyarat, riwayat harga hanya ditulis bila harga berubah.

DO $$
DECLARE
  c_id constant uuid := '186a7062-705a-4e9b-90f0-e44a33301be9';
  v_harga_lama numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bahan_baku WHERE id = c_id AND nama = 'GAS 12 KG') THEN
    RAISE NOTICE 'GAS 12 KG tidak ditemukan, dilewati';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM ledger_stok WHERE bahan_baku_id = c_id)
     OR EXISTS (SELECT 1 FROM stok_balance WHERE bahan_baku_id = c_id AND saldo <> 0) THEN
    RAISE EXCEPTION 'GAS 12 KG sudah punya riwayat stok — koreksi satuan harus lewat prosedur Ganti Satuan';
  END IF;

  -- 1. Satuan & faktor. Faktor dulu, baru harga (sync_harga_beli_display membaca faktor).
  UPDATE bahan_baku
     SET satuan = 'tabung',
         satuan_tengah = NULL,
         faktor_tengah = NULL,
         satuan_kecil = 'gram',
         faktor_tampilan = 12000,
         faktor_konversi = 12000,
         satuan_po = 'tabung',
         satuan_distribusi = 'tabung'
   WHERE id = c_id
     AND (satuan IS DISTINCT FROM 'tabung'
          OR faktor_konversi IS DISTINCT FROM 12000
          OR faktor_tampilan IS DISTINCT FROM 12000
          OR faktor_tengah IS NOT NULL
          OR satuan_po IS DISTINCT FROM 'tabung');

  -- peruntukan belum tentu ada saat replay dari nol (kolom ditambah migration
  -- lain), jadi dijaga.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'bahan_baku' AND column_name = 'peruntukan') THEN
    EXECUTE 'UPDATE bahan_baku SET peruntukan = ''keduanya'' WHERE id = $1 AND peruntukan IS DISTINCT FROM ''keduanya'''
      USING c_id;
  END IF;

  -- 2. SKU default ikut nama satuan besar yang benar.
  UPDATE bahan_baku_sku
     SET nama_kemasan = 'tabung'
   WHERE bahan_baku_id = c_id AND is_default AND nama_kemasan = 'Kg';

  -- 3. Harga master + riwayat.
  SELECT harga_beli INTO v_harga_lama FROM bahan_baku_harga WHERE bahan_baku_id = c_id;

  INSERT INTO bahan_baku_harga (bahan_baku_id, harga_beli, kemasan_qty, kemasan_satuan, harga_updated_at)
  VALUES (c_id, 220000, 12000, 'gram', now())
  ON CONFLICT (bahan_baku_id) DO UPDATE
     SET harga_beli = EXCLUDED.harga_beli,
         kemasan_qty = EXCLUDED.kemasan_qty,
         kemasan_satuan = EXCLUDED.kemasan_satuan,
         harga_updated_at = EXCLUDED.harga_updated_at
   WHERE bahan_baku_harga.harga_beli IS DISTINCT FROM EXCLUDED.harga_beli
      OR bahan_baku_harga.kemasan_qty IS DISTINCT FROM EXCLUDED.kemasan_qty;

  IF v_harga_lama IS DISTINCT FROM 220000 THEN
    INSERT INTO bahan_baku_harga_history (bahan_baku_id, harga_lama, harga_baru, catatan)
    VALUES (c_id, v_harga_lama, 220000,
            'Harga awal GAS 12 KG (Rp 220.000/tabung, konfirmasi owner 2026-09-23) — hilang saat dibuat karena bug kolom updated_at');
  END IF;
END $$;
