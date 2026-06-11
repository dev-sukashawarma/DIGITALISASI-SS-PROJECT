-- ============================================================
-- FIX: Menghapus outlet_staff gagal karena foreign key constraint
--   contoh error: update or delete on table "outlet_staff" violates
--   foreign key constraint "opname_created_by_fkey" on table "opname"
--
-- Penyebab: 7 kolom mereferensikan outlet_staff.id dengan perilaku
-- default ON DELETE NO ACTION (memblokir penghapusan). Selama staf
-- pernah membuat opname / ledger / surat jalan / centang checklist
-- atau punya data absensi, baris outlet_staff tidak bisa dihapus.
--
-- Perbaikan:
--   - Referensi audit (created_by / verified_by / ticked_by / consent_by)
--     -> ON DELETE SET NULL  (record bisnis tetap, hanya pelaku dikosongkan)
--   - attendance.outlet_staff_id (absensi milik staf itu sendiri)
--     -> ON DELETE CASCADE   (ikut terhapus bersama stafnya)
--
-- Idempotent: aman dijalankan ulang. Jalankan di Supabase SQL Editor
-- atau via migration.
-- ============================================================

DO $$
DECLARE
  targets TEXT[][] := ARRAY[
    ARRAY['outlet_staff',          'consent_by',  'SET NULL'],
    ARRAY['daily_checklist_ticks', 'ticked_by',   'SET NULL'],
    ARRAY['surat_jalan',           'created_by',  'SET NULL'],
    ARRAY['surat_jalan_item',      'verified_by', 'SET NULL'],
    ARRAY['opname',                'created_by',  'SET NULL'],
    ARRAY['ledger_stok',           'created_by',  'SET NULL'],
    ARRAY['attendance',            'outlet_staff_id', 'CASCADE']
  ];
  t TEXT; c TEXT; act TEXT;
  conname TEXT;
BEGIN
  FOR i IN 1..array_length(targets, 1) LOOP
    t := targets[i][1]; c := targets[i][2]; act := targets[i][3];

    -- temukan FK aktual pada (t.c) -> outlet_staff, tanpa bergantung pada nama constraint
    SELECT con.conname INTO conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY(con.conkey)
    WHERE con.contype = 'f'
      AND con.conrelid  = ('public.' || t)::regclass
      AND con.confrelid = 'public.outlet_staff'::regclass
      AND att.attname = c
    LIMIT 1;

    IF conname IS NULL THEN
      RAISE NOTICE 'lewati %.% (FK tidak ditemukan)', t, c;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, conname);

    IF act = 'SET NULL' THEN
      -- kolom harus nullable agar SET NULL bisa bekerja
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', t, c);
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.outlet_staff(id) ON DELETE %s',
      t, conname, c, act
    );

    RAISE NOTICE 'diperbaiki %.% -> ON DELETE %', t, c, act;
  END LOOP;
END $$;
