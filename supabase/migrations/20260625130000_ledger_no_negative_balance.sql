-- Tambah guard di trigger ledger_stamp_saldo: tolak insert jika saldo_sesudah < 0.
-- Ini mencegah stok_balance turun di bawah 0 dari jalur manapun (app, RPC, service role).
-- Pengecualian: tipe 'opname_selisih' dan 'rejected_kiriman' boleh hasilkan saldo negatif
-- karena keduanya merekam kondisi nyata (fisik sudah minus/barang ditolak setelah terpakai).
CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger AS $$
DECLARE cur NUMERIC;
BEGIN
  SELECT saldo INTO cur FROM stok_balance
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;
  cur := COALESCE(cur, 0);
  NEW.saldo_sebelum := cur;
  NEW.saldo_sesudah := cur + NEW.qty;

  IF NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman')
  THEN
    RAISE EXCEPTION 'Stok tidak cukup: saldo saat ini % %, pengurangan % %',
      cur, (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id),
      ABS(NEW.qty), (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
