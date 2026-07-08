-- 20260708100001_fix_ledger_saldo_atomic.sql
-- FIX (data stok): lost-update race pada stamping saldo ledger_stok.
--
-- Bug: dulu saldo di-hitung dua langkah non-atomik:
--   1. BEFORE INSERT ledger_stamp_saldo() -> SELECT saldo FROM stok_balance (TANPA lock),
--      lalu stamp NEW.saldo_sebelum/sesudah dari nilai yang dibaca.
--   2. AFTER INSERT  ledger_apply_balance() -> upsert stok_balance = NEW.saldo_sesudah.
-- Dua order yang selesai bersamaan untuk (outlet, bahan) yang sama (rutin sejak BOM
-- automation menulis ledger tiap order 'completed') sama-sama membaca cur=100 sebelum
-- salah satu commit, keduanya stamp 100->90, dan upsert terakhir menimpa saldo jadi 90.
-- Akibat: satu potongan (-10) hilang; stok fisik 80, tercatat 90.
--
-- Fix (altitude): gabung jadi SATU langkah atomik di BEFORE INSERT. Upsert
-- stok_balance dengan increment relatif (saldo = saldo + NEW.qty) memakai row-lock
-- yang dipegang ON CONFLICT, lalu turunkan saldo_sebelum/sesudah dari nilai OTORITATIF
-- hasil upsert (RETURNING). Trigger AFTER INSERT lama dibuang supaya tak double-write.
-- Aditif terhadap perilaku (nilai saldo yang benar); tanda tangan trigger tetap.

CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger AS $$
DECLARE new_saldo NUMERIC;
BEGIN
  -- Increment atomik: ON CONFLICT memegang row-lock stok_balance sehingga order
  -- konkuren untuk (outlet, bahan) yang sama terserialisasi -- tak ada lost update.
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Balance kini di-maintain di BEFORE trigger (atomik). Buang AFTER trigger lama
-- agar stok_balance tidak ditulis dua kali (write kedua-lah yang bisa menimpa
-- update transaksi konkuren dengan nilai basi).
DROP TRIGGER IF EXISTS trg_ledger_apply_balance ON ledger_stok;
DROP FUNCTION IF EXISTS ledger_apply_balance();

-- DOWN:
-- (kembalikan pola dua-trigger lama -- rawan lost update, hanya untuk rollback darurat)
-- CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger AS $$
-- DECLARE cur NUMERIC;
-- BEGIN
--   SELECT saldo INTO cur FROM stok_balance
--     WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;
--   cur := COALESCE(cur, 0);
--   NEW.saldo_sebelum := cur;
--   NEW.saldo_sesudah := cur + NEW.qty;
--   RETURN NEW;
-- END; $$ LANGUAGE plpgsql;
-- CREATE OR REPLACE FUNCTION ledger_apply_balance() RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
--   VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.saldo_sesudah, NOW())
--   ON CONFLICT (outlet_id, bahan_baku_id)
--   DO UPDATE SET saldo = NEW.saldo_sesudah, updated_at = NOW();
--   RETURN NEW;
-- END; $$ LANGUAGE plpgsql;
-- CREATE TRIGGER trg_ledger_apply_balance AFTER INSERT ON ledger_stok
--   FOR EACH ROW EXECUTE FUNCTION ledger_apply_balance();
