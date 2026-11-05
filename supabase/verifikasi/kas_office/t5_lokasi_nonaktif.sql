-- Uji: transaksi baru ke lokasi kas nonaktif ditolak, baris lama tetap bisa diurus.
-- Berakhir ROLLBACK. Penanda keberhasilan: 'KONTROL: T5 ...'.
BEGIN;
DO $$
DECLARE
  c_lama uuid := '0c116d5f-f147-4eff-9bc2-ce9d549e2869';
  c_baru uuid := 'b0955193-7630-4c0e-9a11-5e70a0000001';
  v_baris uuid; v_baru uuid;
BEGIN
  -- (a) INSERT langsung ke rekening lama (pola jalur AM Binaan) ditolak
  BEGIN
    INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, status, note)
    VALUES (c_lama, 'in', 1000, 'Setoran tunai', 'cash_deposit', 'reconciled', 'uji');
    RAISE EXCEPTION 'T5a: insert ke rekening nonaktif LOLOS';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%sudah nonaktif%' THEN RAISE; END IF;
  END;

  -- (b) INSERT ke rekening aktif tetap lolos
  INSERT INTO cash_transaction (cash_location_id, direction, amount, category, source_type, status, note)
  VALUES (c_baru, 'in', 1000, 'uji', 'manual', 'draft', 'uji') RETURNING id INTO v_baru;

  -- (c) baris lama di rekening nonaktif tetap bisa di-void & dikembalikan
  SELECT id INTO v_baris FROM cash_transaction WHERE cash_location_id = c_lama AND status = 'reconciled' LIMIT 1;
  UPDATE cash_transaction SET status = 'void' WHERE id = v_baris;
  UPDATE cash_transaction SET status = 'reconciled' WHERE id = v_baris;

  -- (d) memindahkan baris KELUAR dari rekening nonaktif boleh (skrip pemindahan November)
  UPDATE cash_transaction SET status = 'void' WHERE id = v_baris;
  UPDATE cash_transaction SET cash_location_id = c_baru, status = 'reconciled' WHERE id = v_baris;

  -- (e) memindahkan baris MASUK ke rekening nonaktif ditolak
  BEGIN
    UPDATE cash_transaction SET cash_location_id = c_lama WHERE id = v_baru;
    RAISE EXCEPTION 'T5e: pindah ke rekening nonaktif LOLOS';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%sudah nonaktif%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION 'KONTROL: T5 semua asersi lolos (sengaja dilempar)';
END $$;
ROLLBACK;
