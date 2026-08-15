-- Ikuti pola file 20300105000010/9: nomor SETELAH ranjau timestamp 2030 supaya
-- versi ini yang selalu menang. JANGAN edit file bertanggal lebih awal yang
-- mendefinisikan fungsi ini. Cek dulu: grep -rn "ledger_stamp_saldo" supabase/migrations/
--
-- INSIDEN 2026-08-15: manager coba batalkan order #28 (completed) via
-- forceCancelCompletedOrder (apps/manager). trg_process_bom_stok mencoba
-- me-restore stok FOIL dengan INSERT ledger_stok tipe='adjustment', qty=+2.9166
-- (POSITIF -- mengembalikan stok, bukan mengurangi). Ditolak oleh guard ini
-- dengan pesan "Stok tidak cukup" karena saldo FOIL outlet itu SUDAH minus
-- (-481.375, dari korupsi data sebelumnya) dan +2.9166 belum cukup menutup
-- defisit sampai ke atas 0.
--
-- Root cause: guard memblokir berdasarkan HASIL AKHIR (saldo_sesudah < 0) tanpa
-- memandang ARAH transaksi. Insert dengan qty POSITIF tidak pernah bisa
-- memperburuk kondisi stok -- ia hanya bisa memperbaikinya atau no-op. Guard
-- "insufficient stock" seharusnya hanya relevan untuk qty NEGATIF (pengurangan).
-- Whitelist per-tipe (pola 20300105000010 untuk 'terima_kiriman') tidak cukup
-- di sini karena tipe 'adjustment' dipakai baik untuk restore (qty>0, harus
-- selalu boleh) maupun koreksi turun (qty<0, harus tetap ditahan bila saldo
-- tak cukup) -- jadi generalisasi ke NEW.qty >= 0 dipakai, bukan tambah
-- 'adjustment' ke daftar tipe yang dikecualikan (itu akan ikut membolehkan
-- adjustment NEGATIF lolos, yang salah).
--
-- Fix: tambah syarat `NEW.qty < 0` ke guard -- qty positif tidak pernah lagi
-- diblokir, apa pun tipenya atau berapa pun defisit saldo saat ini.

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

  -- Guard no-negative-balance -- HANYA relevan untuk pengurangan (qty < 0).
  -- Insert qty >= 0 (restore/adjustment naik/terima_kiriman/dll) tidak pernah
  -- bisa memperburuk stok, jadi tidak pernah diblokir di sini, terlepas dari
  -- tipe atau seberapa minus saldo saat ini.
  -- Dikecualikan dari sisi tipe (untuk qty < 0): 'pemakaian' (penjualan POS
  -- tak boleh gagal), 'opname_selisih', 'rejected_kiriman' (merekam kondisi
  -- fisik nyata).
  IF NEW.qty < 0
    AND NEW.saldo_sesudah < 0
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
