-- =============================================================================
-- Pelacakan driver distribusi — skema, RLS, pengaturan, pengetatan update SJ.
-- Spec: docs/superpowers/specs/2026-10-27-pelacakan-driver-design.md (§5, §6.1, §6.6)
--
-- Tabel pelacakan hanya ditulis lewat RPC SECURITY DEFINER milik driver
-- (migration 20261027141000). Di sini: tulis langsung dicabut, baca lewat RLS.
-- Pelacakan TIDAK pernah menulis ledger_stok / stok_balance / status SJ.
-- =============================================================================

-- ---------------------------------------------------------------- helper peran
CREATE OR REPLACE FUNCTION public.is_pelacak_driver()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
     WHERE id = auth.uid()
       AND status = 'active'
       AND role IN ('kitchen','admin','purchasing','owner','developer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_driver_aktif()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
     WHERE id = auth.uid() AND status = 'active' AND role = 'driver'
  );
$$;

REVOKE ALL ON FUNCTION public.is_pelacak_driver() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_driver_aktif()   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pelacak_driver() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_aktif()   TO authenticated;

-- ---------------------------------------------------------------- tabel
CREATE TABLE IF NOT EXISTS public.driver_perjalanan (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid NOT NULL REFERENCES public.outlet_staff(id),
  status          text NOT NULL DEFAULT 'berjalan'
                  CHECK (status IN ('berjalan','selesai','ditutup_otomatis')),
  berangkat_at    timestamptz NOT NULL DEFAULT now(),
  berangkat_lat   numeric,
  berangkat_lng   numeric,
  selesai_at      timestamptz,
  total_km        numeric,
  durasi_detik    int,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_perjalanan_satu_berjalan
  ON public.driver_perjalanan (driver_id) WHERE status = 'berjalan';
CREATE INDEX IF NOT EXISTS driver_perjalanan_berangkat_idx
  ON public.driver_perjalanan (berangkat_at DESC);

CREATE TABLE IF NOT EXISTS public.driver_perjalanan_stop (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perjalanan_id   uuid NOT NULL REFERENCES public.driver_perjalanan(id) ON DELETE CASCADE,
  surat_jalan_id  uuid NOT NULL REFERENCES public.surat_jalan(id),
  outlet_id       uuid NOT NULL REFERENCES public.outlets(id),
  urutan          int  NOT NULL,
  status          text NOT NULL DEFAULT 'menunggu'
                  CHECK (status IN ('menunggu','tiba','tidak_ditandai','dibatalkan')),
  tiba_at         timestamptz,
  tiba_sumber     text CHECK (tiba_sumber IN ('driver','verifikasi_outlet')),
  tiba_lat        numeric,
  tiba_lng        numeric,
  tiba_akurasi_m  numeric,
  tiba_jarak_m    numeric
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_perjalanan_stop_sj_aktif
  ON public.driver_perjalanan_stop (surat_jalan_id) WHERE status <> 'dibatalkan';
CREATE INDEX IF NOT EXISTS driver_perjalanan_stop_perjalanan_idx
  ON public.driver_perjalanan_stop (perjalanan_id, urutan);

CREATE TABLE IF NOT EXISTS public.driver_lokasi_terkini (
  driver_id       uuid PRIMARY KEY REFERENCES public.outlet_staff(id),
  perjalanan_id   uuid REFERENCES public.driver_perjalanan(id) ON DELETE SET NULL,
  lat             numeric NOT NULL,
  lng             numeric NOT NULL,
  akurasi_m       numeric,
  kecepatan_mps   numeric,
  arah_derajat    numeric,
  baterai_persen  int,
  direkam_at      timestamptz NOT NULL,
  diterima_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_lokasi_jejak (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perjalanan_id   uuid NOT NULL REFERENCES public.driver_perjalanan(id) ON DELETE CASCADE,
  driver_id       uuid NOT NULL REFERENCES public.outlet_staff(id),
  lat             numeric NOT NULL,
  lng             numeric NOT NULL,
  akurasi_m       numeric,
  direkam_at      timestamptz NOT NULL,
  diterima_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_lokasi_jejak_driver_waktu
  ON public.driver_lokasi_jejak (driver_id, direkam_at);
CREATE INDEX IF NOT EXISTS driver_lokasi_jejak_perjalanan_idx
  ON public.driver_lokasi_jejak (perjalanan_id, direkam_at);

-- ---------------------------------------------------------------- hak akses
REVOKE ALL ON public.driver_perjalanan, public.driver_perjalanan_stop,
              public.driver_lokasi_terkini, public.driver_lokasi_jejak
  FROM anon, authenticated;
GRANT SELECT ON public.driver_perjalanan, public.driver_perjalanan_stop,
                public.driver_lokasi_terkini, public.driver_lokasi_jejak
  TO authenticated;

ALTER TABLE public.driver_perjalanan      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_perjalanan_stop ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_lokasi_terkini  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_lokasi_jejak    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_perjalanan_baca ON public.driver_perjalanan;
CREATE POLICY driver_perjalanan_baca ON public.driver_perjalanan
  FOR SELECT TO authenticated
  USING ((SELECT public.is_pelacak_driver()) OR driver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS driver_perjalanan_stop_baca ON public.driver_perjalanan_stop;
CREATE POLICY driver_perjalanan_stop_baca ON public.driver_perjalanan_stop
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_pelacak_driver())
    OR EXISTS (SELECT 1 FROM public.driver_perjalanan p
                WHERE p.id = perjalanan_id AND p.driver_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS driver_lokasi_terkini_baca ON public.driver_lokasi_terkini;
CREATE POLICY driver_lokasi_terkini_baca ON public.driver_lokasi_terkini
  FOR SELECT TO authenticated
  USING ((SELECT public.is_pelacak_driver()) OR driver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS driver_lokasi_jejak_baca ON public.driver_lokasi_jejak;
CREATE POLICY driver_lokasi_jejak_baca ON public.driver_lokasi_jejak
  FOR SELECT TO authenticated
  USING ((SELECT public.is_pelacak_driver()) OR driver_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------- realtime
ALTER TABLE public.driver_lokasi_terkini  REPLICA IDENTITY FULL;
ALTER TABLE public.driver_perjalanan      REPLICA IDENTITY FULL;
ALTER TABLE public.driver_perjalanan_stop REPLICA IDENTITY FULL;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['driver_lokasi_terkini','driver_perjalanan','driver_perjalanan_stop'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- pengaturan
INSERT INTO public.global_settings (key, value, updated_at)
VALUES ('driver_tracking',
        '{"interval_detik":30,"jarak_min_m":100,"batas_tutup_wib":"21:00","retensi_hari":60}'::jsonb,
        now())
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- pengetatan SJ
-- accessible_outlet_ids() memberi driver semua outlet (20261027130000), sehingga
-- policy UPDATE di bawah ikut membuka tulis SJ ke driver. Driver tidak pernah
-- menulis SJ; ekspresi lama disalin persis dari pg_policy + AND NOT is_driver_aktif().
ALTER POLICY surat_jalan_update_scoped ON public.surat_jalan
  USING ((outlet_id IN (SELECT accessible_outlet_ids() AS accessible_outlet_ids)) AND NOT (SELECT public.is_driver_aktif()))
  WITH CHECK ((outlet_id IN (SELECT accessible_outlet_ids() AS accessible_outlet_ids)) AND NOT (SELECT public.is_driver_aktif()));

ALTER POLICY surat_jalan_item_update_scoped ON public.surat_jalan_item
  USING ((EXISTS (SELECT 1 FROM surat_jalan sj
                   WHERE sj.id = surat_jalan_item.surat_jalan_id
                     AND sj.outlet_id IN (SELECT accessible_outlet_ids() AS accessible_outlet_ids)))
         AND NOT (SELECT public.is_driver_aktif()))
  WITH CHECK ((EXISTS (SELECT 1 FROM surat_jalan sj
                        WHERE sj.id = surat_jalan_item.surat_jalan_id
                          AND sj.outlet_id IN (SELECT accessible_outlet_ids() AS accessible_outlet_ids)))
              AND NOT (SELECT public.is_driver_aktif()));

ALTER POLICY sj_item_update ON public.surat_jalan_item
  USING ((surat_jalan_id IN (SELECT surat_jalan.id FROM surat_jalan
                              WHERE surat_jalan.status = 'dikirim'::text
                                AND surat_jalan.outlet_id IN (SELECT outlet_staff.outlet_id FROM outlet_staff
                                                               WHERE outlet_staff.id = (SELECT auth.uid() AS uid))))
         AND NOT (SELECT public.is_driver_aktif()))
  WITH CHECK ((surat_jalan_id IN (SELECT surat_jalan.id FROM surat_jalan
                                   WHERE surat_jalan.status = 'dikirim'::text
                                     AND surat_jalan.outlet_id IN (SELECT outlet_staff.outlet_id FROM outlet_staff
                                                                    WHERE outlet_staff.id = (SELECT auth.uid() AS uid))))
              AND NOT (SELECT public.is_driver_aktif()));
