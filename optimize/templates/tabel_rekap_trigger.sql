-- TEMPLATE: tabel rekap per kunci yang dipelihara trigger.
-- Contoh nyata: attendance → attendance_harian (20260929130000_hr_skala_jangka_panjang.sql)
-- Ganti: <mentah>, <rekap>, kolom kunci (staff_id, outlet_id, tgl) & kolom agregat.

-- 1. Tabel rekap
CREATE TABLE IF NOT EXISTS public.<rekap> (
  staff_id   uuid        NOT NULL,
  outlet_id  uuid        NOT NULL,
  tgl        date        NOT NULL,                -- tanggal WIB
  jumlah     integer     NOT NULL DEFAULT 0,      -- contoh kolom agregat
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, outlet_id, tgl)
);
CREATE INDEX IF NOT EXISTS idx_<rekap>_tgl ON public.<rekap> (tgl DESC, staff_id);

-- 2. RLS: cermin persis policy SELECT tabel mentah; tulis hanya lewat trigger
ALTER TABLE public.<rekap> ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.<rekap> FROM anon, authenticated;
GRANT SELECT ON public.<rekap> TO authenticated;
CREATE POLICY <rekap>_read ON public.<rekap> FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));

-- 3. Hitung ulang SATU kunci dari sumber (idempoten)
CREATE OR REPLACE FUNCTION public.<rekap>_hitung(p_staff uuid, p_outlet uuid, p_tgl date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- serialisasi event bersamaan untuk kunci yang sama
  PERFORM pg_advisory_xact_lock(hashtextextended('<rekap>:' || p_staff || ':' || p_outlet || ':' || p_tgl, 0));

  INSERT INTO <rekap> AS r (staff_id, outlet_id, tgl, jumlah, updated_at)
  SELECT p_staff, p_outlet, p_tgl, count(*), now()
  FROM <mentah> m
  WHERE m.staff_id = p_staff AND m.outlet_id = p_outlet
    AND m.ts >= (p_tgl::timestamp AT TIME ZONE 'Asia/Jakarta')          -- sargable, WIB
    AND m.ts <  ((p_tgl + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
  HAVING count(*) > 0
  ON CONFLICT (staff_id, outlet_id, tgl) DO UPDATE
    SET jumlah = EXCLUDED.jumlah, updated_at = now();

  IF NOT FOUND THEN   -- kunci kosong → hapus rekap
    DELETE FROM <rekap> WHERE staff_id = p_staff AND outlet_id = p_outlet AND tgl = p_tgl;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.<rekap>_hitung(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- 4. Trigger: kunci BARU dan LAMA (UPDATE bisa memindah kunci)
CREATE OR REPLACE FUNCTION public.trg_<rekap>()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new date; v_old date;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := (NEW.ts AT TIME ZONE 'Asia/Jakarta')::date;
    PERFORM <rekap>_hitung(NEW.staff_id, NEW.outlet_id, v_new);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := (OLD.ts AT TIME ZONE 'Asia/Jakarta')::date;
    IF TG_OP = 'DELETE' OR OLD.staff_id IS DISTINCT FROM NEW.staff_id
       OR OLD.outlet_id IS DISTINCT FROM NEW.outlet_id OR v_old IS DISTINCT FROM v_new THEN
      PERFORM <rekap>_hitung(OLD.staff_id, OLD.outlet_id, v_old);
    END IF;
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.trg_<rekap>() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_<rekap> ON public.<mentah>;
CREATE TRIGGER trg_<rekap> AFTER INSERT OR UPDATE OR DELETE ON public.<mentah>
  FOR EACH ROW EXECUTE FUNCTION public.trg_<rekap>();

-- 5. Backfill idempoten
DO $$ DECLARE k record; BEGIN
  FOR k IN SELECT DISTINCT staff_id, outlet_id, (ts AT TIME ZONE 'Asia/Jakarta')::date AS tgl FROM <mentah> LOOP
    PERFORM <rekap>_hitung(k.staff_id, k.outlet_id, k.tgl);
  END LOOP;
END $$;
