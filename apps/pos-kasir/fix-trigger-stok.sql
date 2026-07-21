-- Perbaikan Trigger ledger_stamp_saldo
-- Trigger ini sebelumnya salah menggunakan "NEW.stok_masuk" yang tidak ada pada tabel ledger_stok.
-- Tabel ledger_stok menggunakan kolom "qty", di mana positif berarti masuk dan negatif berarti keluar.
-- Jalankan kode ini di SQL Editor Supabase Anda.

CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger AS $$
DECLARE cur NUMERIC;
BEGIN
  SELECT saldo INTO cur FROM stok_balance
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;
  cur := COALESCE(cur, 0);
  NEW.saldo_sebelum := cur;
  NEW.saldo_sesudah := cur + NEW.qty;

  -- Pengecualian: tipe 'opname_selisih', 'rejected_kiriman', dan 'pemakaian' boleh hasilkan saldo negatif
  IF NEW.saldo_sesudah < 0
    AND NEW.qty < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman', 'pemakaian')
  THEN
    RAISE EXCEPTION 'Stok tidak cukup: saldo saat ini % %, pengurangan % %',
      trim_scale(cur), (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id),
      trim_scale(ABS(NEW.qty)), (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
