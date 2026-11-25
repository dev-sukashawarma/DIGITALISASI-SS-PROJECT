-- Uji alur petty cash tanpa AM (migration 20261125120000_petty_cash_tanpa_am).
-- Jalankan seluruh berkas; selalu ROLLBACK, nol perubahan nyata.
-- Untuk uji SEBELUM migration diterapkan: sisipkan isi migration di penanda
-- "@@MIGRATION" (di dalam transaksi yang sama).
-- Lulus = tidak ada galat 'ASERSI GAGAL'. Blok kontrol di akhir sengaja gagal;
-- nonaktifkan setelah terbukti bahwa blok-blok sebelumnya benar-benar dijalankan.

BEGIN;

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text) ON COMMIT DROP;
GRANT ALL ON _t TO authenticated;

INSERT INTO _t SELECT 'leaderA', id::text FROM outlet_staff
 WHERE role = 'leader' AND status = 'active' AND COALESCE(is_active, true) AND outlet_id IS NOT NULL
 ORDER BY id LIMIT 1;
INSERT INTO _t SELECT 'outletA', outlet_id::text FROM outlet_staff WHERE id = (SELECT v::uuid FROM _t WHERE k = 'leaderA');
INSERT INTO _t SELECT 'leaderB', s.id::text FROM outlet_staff s
 WHERE s.role = 'leader' AND s.status = 'active' AND COALESCE(s.is_active, true) AND s.outlet_id IS NOT NULL
   AND s.outlet_id <> (SELECT v::uuid FROM _t WHERE k = 'outletA')
   AND NOT EXISTS (SELECT 1 FROM staff_outlets so WHERE so.staff_id = s.id AND so.outlet_id = (SELECT v::uuid FROM _t WHERE k = 'outletA'))
 ORDER BY s.id LIMIT 1;
INSERT INTO _t SELECT 'fin', id::text FROM outlet_staff WHERE role = 'admin_finance' AND status = 'active' ORDER BY id LIMIT 1;
INSERT INTO _t SELECT 'bank', id::text FROM cash_location
 WHERE grup = 'petty_cash' AND is_active AND scope = 'pusat' AND kind = 'bank' LIMIT 1;

DO $$ BEGIN
  IF (SELECT count(*) FROM _t) <> 5 THEN RAISE EXCEPTION 'ASERSI GAGAL (fixture): fixture tidak lengkap'; END IF;
END $$;

-- Baris berstatus tahap AM lama (untuk kasus f), disisipkan melewati penjaga INSERT.
ALTER TABLE petty_cash_topups DISABLE TRIGGER trg_petty_cash_enforce_flow_insert;
WITH x AS (INSERT INTO petty_cash_topups (outlet_id, amount, description, status, created_by)
  VALUES ((SELECT v::uuid FROM _t WHERE k = 'outletA'), 1000, 'uji f1', 'forwarded_to_area_manager', (SELECT v::uuid FROM _t WHERE k = 'leaderA')) RETURNING id)
INSERT INTO _t SELECT 'f1', id::text FROM x;
WITH x AS (INSERT INTO petty_cash_topups (outlet_id, amount, description, status, created_by)
  VALUES ((SELECT v::uuid FROM _t WHERE k = 'outletA'), 1000, 'uji f2', 'forwarded_by_finance', (SELECT v::uuid FROM _t WHERE k = 'leaderA')) RETURNING id)
INSERT INTO _t SELECT 'f2', id::text FROM x;
WITH x AS (INSERT INTO petty_cash_topups (outlet_id, amount, description, status, created_by)
  VALUES ((SELECT v::uuid FROM _t WHERE k = 'outletA'), 1000, 'uji f3', 'forwarded_by_area_manager', (SELECT v::uuid FROM _t WHERE k = 'leaderA')) RETURNING id)
INSERT INTO _t SELECT 'f3', id::text FROM x;
ALTER TABLE petty_cash_topups ENABLE TRIGGER trg_petty_cash_enforce_flow_insert;

-- @@MIGRATION

-- (f) baris tahap AM lama sudah dipindah
DO $$ BEGIN
  IF (SELECT status FROM petty_cash_topups WHERE id = (SELECT v::uuid FROM _t WHERE k = 'f1')) <> 'forwarded_to_finance'
  OR (SELECT status FROM petty_cash_topups WHERE id = (SELECT v::uuid FROM _t WHERE k = 'f2')) <> 'approved_by_finance'
  OR (SELECT status FROM petty_cash_topups WHERE id = (SELECT v::uuid FROM _t WHERE k = 'f3')) <> 'approved_by_finance' THEN
    RAISE EXCEPTION 'ASERSI GAGAL (f): status tahap AM lama tidak dipindah';
  END IF;
END $$;

-- (a) leader mengajukan -> langsung ke Finance
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT v FROM _t WHERE k = 'leaderA'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO _t SELECT 'a', create_petty_cash_topup((SELECT v::uuid FROM _t WHERE k = 'outletA'), 1000, 'uji a', NULL, NULL, NULL)::text;
INSERT INTO _t SELECT 'e1', create_petty_cash_topup((SELECT v::uuid FROM _t WHERE k = 'outletA'), 1000, 'uji e1', NULL, NULL, NULL)::text;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM petty_cash_topups WHERE id = (SELECT v::uuid FROM _t WHERE k = 'a')) <> 'forwarded_to_finance' THEN
    RAISE EXCEPTION 'ASERSI GAGAL (a): pengajuan baru tidak lahir di forwarded_to_finance (dapat %)',
      (SELECT status FROM petty_cash_topups WHERE id = (SELECT v::uuid FROM _t WHERE k = 'a'));
  END IF;
END $$;

-- (c) Finance approve tanpa bukti -> ditolak (NULL dan string kosong)
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT v FROM _t WHERE k = 'fin'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_bukti text;
BEGIN
  FOREACH v_bukti IN ARRAY ARRAY[NULL, '', '   '] LOOP
    BEGIN
      PERFORM finance_process_petty_cash_custom((SELECT v::uuid FROM _t WHERE k = 'a'), 'approve', 'transfer',
        (SELECT v::uuid FROM _t WHERE k = 'bank'), v_bukti, NULL, NULL);
      RAISE EXCEPTION 'ASERSI GAGAL (c): approve tanpa bukti (%) lolos', COALESCE(v_bukti, 'NULL');
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
      IF SQLERRM NOT ILIKE '%bukti%' THEN RAISE EXCEPTION 'ASERSI GAGAL (c): galat bukan soal bukti: %', SQLERRM; END IF;
    END;
  END LOOP;
END $$;

-- (b) Finance approve dengan bukti -> approved_by_finance + 1 transaksi kas keluar
SELECT finance_process_petty_cash_custom((SELECT v::uuid FROM _t WHERE k = 'a'), 'approve', 'transfer',
  (SELECT v::uuid FROM _t WHERE k = 'bank'), 'https://contoh/bukti.jpg', NULL, NULL);
SELECT finance_process_petty_cash_custom((SELECT v::uuid FROM _t WHERE k = 'e1'), 'approve', 'transfer',
  (SELECT v::uuid FROM _t WHERE k = 'bank'), 'https://contoh/bukti.jpg', NULL, NULL);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM petty_cash_topups WHERE id = (SELECT v::uuid FROM _t WHERE k = 'a')) <> 'approved_by_finance' THEN
    RAISE EXCEPTION 'ASERSI GAGAL (b): status setelah approve bukan approved_by_finance';
  END IF;
  IF (SELECT count(*) FROM cash_transaction WHERE source_type = 'petty_cash_topup' AND source_id = (SELECT v::uuid FROM _t WHERE k = 'a')) <> 1 THEN
    RAISE EXCEPTION 'ASERSI GAGAL (b): transaksi kas pencairan tidak tepat satu';
  END IF;
END $$;

-- (d) leader outlet lain ditolak; leader outlet sendiri berhasil
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT v FROM _t WHERE k = 'leaderB'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM leader_forward_funds((SELECT v::uuid FROM _t WHERE k = 'a'));
    RAISE EXCEPTION 'ASERSI GAGAL (d): leader outlet lain bisa mengonfirmasi';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT v FROM _t WHERE k = 'leaderA'), 'role', 'authenticated')::text, true);
SELECT leader_forward_funds((SELECT v::uuid FROM _t WHERE k = 'a'));
RESET ROLE;
DO $$ BEGIN
  IF (SELECT status FROM petty_cash_topups WHERE id = (SELECT v::uuid FROM _t WHERE k = 'a')) <> 'forwarded_by_leader' THEN
    RAISE EXCEPTION 'ASERSI GAGAL (d): konfirmasi leader outlet sendiri gagal';
  END IF;
END $$;

-- (e) tolak setelah dana cair -> ditolak penjaga status
DO $$
DECLARE v_k text;
BEGIN
  FOREACH v_k IN ARRAY ARRAY['e1', 'a'] LOOP
    BEGIN
      UPDATE petty_cash_topups SET status = 'rejected' WHERE id = (SELECT v::uuid FROM _t WHERE k = v_k);
      RAISE EXCEPTION 'ASERSI GAGAL (e): baris % bisa ditolak setelah dana cair', v_k;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- (g) fungsi tahap AM lama mengembalikan pesan jelas
DO $$ BEGIN
  BEGIN
    PERFORM area_manager_process_petty_cash((SELECT v::uuid FROM _t WHERE k = 'f1'), 'approve');
    RAISE EXCEPTION 'ASERSI GAGAL (g): area_manager_process_petty_cash masih jalan';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASERSI GAGAL%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%Tahap Area Manager sudah dihapus%' THEN RAISE EXCEPTION 'ASERSI GAGAL (g): pesan salah: %', SQLERRM; END IF;
  END;
END $$;

-- Kontrol: membuktikan eksekusi sampai sini. Nonaktifkan setelah terlihat gagal sekali.
-- DO $$ BEGIN RAISE EXCEPTION 'ASERSI GAGAL (kontrol): semua blok di atas dijalankan'; END $$;

SELECT 'LULUS' AS hasil;
ROLLBACK;
