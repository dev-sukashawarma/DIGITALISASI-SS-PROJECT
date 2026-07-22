-- 20300103000008_ledger_stamp_saldo_exempt_terima_kiriman.sql
-- Ikuti pola file 20300103000007: nomor SETELAH ranjau timestamp 2030 supaya
-- versi ini yang selalu menang. JANGAN edit file bertanggal lebih awal yang
-- mendefinisikan fungsi ini. Cek dulu: grep -rn "ledger_stamp_saldo" supabase/migrations/
--
-- INSIDEN 2026-07-22: surat jalan ke outlet Dramaga (SJ-231DA391) tidak bisa
-- di-finalize. finalize_surat_jalan_and_ledger() insert 'terima_kiriman'
-- (barang MASUK, qty > 0) untuk PLASTIK MERAH, tapi ditolak trigger dengan
-- "Stok tidak cukup" karena saldo outlet itu sudah minus dari pemakaian POS
-- sebelumnya (pemakaian sengaja dikecualikan dari guard ini) dan +0.2 belum
-- cukup menutup defisit. 'terima_kiriman' selalu MENAMBAH saldo (tidak pernah
-- memperburuk kondisi minus), jadi tidak seharusnya pernah diblokir guard ini
-- -- beda dengan transaksi keluar (transfer_keluar, waste, adjustment negatif)
-- yang memang harus ditahan bila saldo tak cukup.
--
-- Fix: tambah 'terima_kiriman' ke daftar tipe yang dikecualikan.

CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_saldo NUMERIC;
DECLARE bahan_nama TEXT;
DECLARE bahan_satuan TEXT;
BEGIN
  -- Increment atomik: ON CONFLICT memegang row-lock stok_balance
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;

  -- Guard no-negative-balance
  -- Dikecualikan: 'pemakaian' (penjualan POS tak boleh gagal),
  -- 'terima_kiriman' (barang masuk selalu menambah saldo, tak pernah
  -- memperburuk defisit meski hasil akhirnya masih minus dari sebelumnya).
  IF NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman', 'pemakaian', 'terima_kiriman')
  THEN
    SELECT nama, satuan INTO bahan_nama, bahan_satuan
    FROM bahan_baku WHERE id = NEW.bahan_baku_id;

    RAISE EXCEPTION 'Stok "%" tidak cukup: saldo saat ini % %, pengurangan % %',
      bahan_nama, trim_scale(NEW.saldo_sebelum), bahan_satuan,
      trim_scale(ABS(NEW.qty)), bahan_satuan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
