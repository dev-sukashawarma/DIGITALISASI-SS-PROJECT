-- Riwayat HPP menu dengan tanggal berlaku.
-- Spec: docs/superpowers/specs/2026-09-25-riwayat-hpp-override-design.md (§3, §4)
-- Satu baris = satu angka (kunci 'hpp_override' atau kunci channel_hpp) yang berlaku mulai tanggal WIB.
-- Seed '2000-01-01' = angka saat migration ini dijalankan, jadi laporan lama tidak bergeser.
BEGIN;

CREATE TABLE public.menu_hpp_riwayat (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  kunci         text NOT NULL CHECK (btrim(kunci) <> ''),
  nilai         numeric NULL CHECK (nilai IS NULL OR nilai >= 0),
  berlaku_mulai date NOT NULL,
  sumber        text NOT NULL CHECK (sumber IN ('awal', 'layar', 'trigger')),
  alasan        text NULL,
  dicatat_oleh  uuid NULL,
  dicatat_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_hpp_riwayat_unik UNIQUE (menu_item_id, kunci, berlaku_mulai)
);
CREATE INDEX menu_hpp_riwayat_cari ON public.menu_hpp_riwayat (menu_item_id, kunci, berlaku_mulai DESC);
COMMENT ON TABLE public.menu_hpp_riwayat IS
  'Riwayat HPP override & HPP per kanal menu. Nilai berlaku dari berlaku_mulai (WIB) sampai baris berikutnya untuk kunci yang sama. Tulis hanya lewat ubah_hpp_menu / trigger.';

ALTER TABLE public.menu_hpp_riwayat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.menu_hpp_riwayat FROM anon, authenticated;
GRANT SELECT ON public.menu_hpp_riwayat TO authenticated;
CREATE POLICY menu_hpp_riwayat_baca ON public.menu_hpp_riwayat
  FOR SELECT TO authenticated USING (true);

-- Nilai JSON channel_hpp → numeric (angka atau teks angka; selain itu NULL)
CREATE OR REPLACE FUNCTION public._hpp_nilai_json(p jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE jsonb_typeof(p)
           WHEN 'number' THEN (p #>> '{}')::numeric
           WHEN 'string' THEN NULLIF(btrim(p #>> '{}'), '')::numeric
           ELSE NULL
         END
$$;

-- Upsert satu angka riwayat. Internal: hanya dipanggil fungsi SECURITY DEFINER di bawah.
CREATE OR REPLACE FUNCTION public._hpp_catat(
  p_menu uuid, p_kunci text, p_nilai numeric, p_tgl date, p_sumber text, p_alasan text)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.menu_hpp_riwayat (menu_item_id, kunci, nilai, berlaku_mulai, sumber, alasan, dicatat_oleh)
  VALUES (p_menu, p_kunci, p_nilai, p_tgl, p_sumber, NULLIF(btrim(p_alasan), ''), auth.uid())
  ON CONFLICT (menu_item_id, kunci, berlaku_mulai) DO UPDATE
    SET nilai = EXCLUDED.nilai, sumber = EXCLUDED.sumber, alasan = EXCLUDED.alasan,
        dicatat_oleh = EXCLUDED.dicatat_oleh, dicatat_at = now();
$$;
REVOKE ALL ON FUNCTION public._hpp_catat(uuid, text, numeric, date, text, text) FROM PUBLIC, anon, authenticated;

-- Seed titik awal (K3): nilai apa adanya
INSERT INTO public.menu_hpp_riwayat (menu_item_id, kunci, nilai, berlaku_mulai, sumber)
SELECT m.id, 'hpp_override', m.hpp_override, DATE '2000-01-01', 'awal' FROM public.menu_items m;
INSERT INTO public.menu_hpp_riwayat (menu_item_id, kunci, nilai, berlaku_mulai, sumber)
SELECT m.id, e.key, public._hpp_nilai_json(e.value), DATE '2000-01-01', 'awal'
FROM public.menu_items m CROSS JOIN LATERAL jsonb_each(COALESCE(m.channel_hpp, '{}'::jsonb)) e;

-- Rekonstruksi nilai pada tanggal (WIB). p_tanggal NULL = hari ini.
CREATE OR REPLACE FUNCTION public.menu_hpp_pada(p_menu_item_id uuid, p_tanggal date DEFAULT NULL)
RETURNS TABLE (hpp_override numeric, channel_hpp jsonb)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH tgl AS (SELECT COALESCE(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS t),
  efektif AS (
    SELECT DISTINCT ON (r.kunci) r.kunci, r.nilai
    FROM public.menu_hpp_riwayat r, tgl
    WHERE r.menu_item_id = p_menu_item_id AND r.berlaku_mulai <= tgl.t
    ORDER BY r.kunci, r.berlaku_mulai DESC
  ),
  punya AS (
    SELECT EXISTS (SELECT 1 FROM public.menu_hpp_riwayat r WHERE r.menu_item_id = p_menu_item_id) AS ada
  )
  SELECT (SELECT e.nilai FROM efektif e WHERE e.kunci = 'hpp_override'),
         COALESCE((SELECT jsonb_object_agg(e.kunci, e.nilai) FROM efektif e
                   WHERE e.kunci <> 'hpp_override' AND e.nilai IS NOT NULL), '{}'::jsonb)
  FROM punya WHERE punya.ada
  UNION ALL
  SELECT m.hpp_override, m.channel_hpp
  FROM public.menu_items m, punya
  WHERE m.id = p_menu_item_id AND NOT punya.ada;
$$;
GRANT EXECUTE ON FUNCTION public.menu_hpp_pada(uuid, date) TO authenticated, service_role;

-- Gerbang nol pergeseran di dalam migration: rekonstruksi hari ini = menu_items untuk semua menu
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM public.menu_items m CROSS JOIN LATERAL public.menu_hpp_pada(m.id, NULL) h
  WHERE h.hpp_override IS DISTINCT FROM m.hpp_override
     OR h.channel_hpp IS DISTINCT FROM COALESCE((
          SELECT jsonb_object_agg(e.key, public._hpp_nilai_json(e.value))
          FROM jsonb_each(COALESCE(m.channel_hpp, '{}'::jsonb)) e
          WHERE public._hpp_nilai_json(e.value) IS NOT NULL), '{}'::jsonb);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Seed riwayat HPP bergeser untuk % menu — migration dibatalkan', v_n;
  END IF;
END $$;

-- Jaring pengaman: tulisan langsung ke menu_items tetap meninggalkan jejak (berlaku hari ini)
CREATE OR REPLACE FUNCTION public.menu_hpp_catat_riwayat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tgl  date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_lama jsonb := '{}'::jsonb;
  v_baru jsonb := COALESCE(NEW.channel_hpp, '{}'::jsonb);
  v_kunci text;
BEGIN
  IF current_setting('app.hpp_via_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public._hpp_catat(NEW.id, 'hpp_override', NEW.hpp_override, DATE '2000-01-01', 'awal', NULL);
    FOR v_kunci IN SELECT jsonb_object_keys(v_baru) LOOP
      PERFORM public._hpp_catat(NEW.id, v_kunci, public._hpp_nilai_json(v_baru -> v_kunci), DATE '2000-01-01', 'awal', NULL);
    END LOOP;
    RETURN NEW;
  END IF;

  v_lama := COALESCE(OLD.channel_hpp, '{}'::jsonb);
  IF NEW.hpp_override IS DISTINCT FROM OLD.hpp_override THEN
    PERFORM public._hpp_catat(NEW.id, 'hpp_override', NEW.hpp_override, v_tgl, 'trigger', NULL);
  END IF;
  FOR v_kunci IN SELECT jsonb_object_keys(v_lama) UNION SELECT jsonb_object_keys(v_baru) LOOP
    IF (v_lama -> v_kunci) IS DISTINCT FROM (v_baru -> v_kunci) THEN
      PERFORM public._hpp_catat(NEW.id, v_kunci, public._hpp_nilai_json(v_baru -> v_kunci), v_tgl, 'trigger', NULL);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_menu_hpp_catat_riwayat
  AFTER INSERT OR UPDATE OF hpp_override, channel_hpp ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.menu_hpp_catat_riwayat();

-- Satu-satunya jalur tulis dari layar. Cek role DI SINI (guard halaman tidak melindungi).
CREATE OR REPLACE FUNCTION public.ubah_hpp_menu(
  p_menu_item_id uuid, p_perubahan jsonb, p_berlaku_mulai date DEFAULT NULL, p_alasan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_tgl      date := COALESCE(p_berlaku_mulai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_batas    date;
  v_kunci    text;
  v_json     jsonb;
  v_nilai    numeric;
  v_hpp      numeric;
  v_ch       jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.role IN ('owner', 'admin') AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh mengubah HPP menu' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE id = p_menu_item_id) THEN
    RAISE EXCEPTION 'Menu tidak ditemukan';
  END IF;
  IF p_perubahan IS NULL OR jsonb_typeof(p_perubahan) <> 'object' OR p_perubahan = '{}'::jsonb THEN
    RAISE EXCEPTION 'Perubahan HPP kosong';
  END IF;

  v_batas := CASE WHEN EXTRACT(DAY FROM v_hari_ini) <= 10
                  THEN (date_trunc('month', v_hari_ini) - INTERVAL '1 month')::date
                  ELSE date_trunc('month', v_hari_ini)::date END;
  IF v_tgl > v_hari_ini THEN
    RAISE EXCEPTION 'Tanggal berlaku % tidak boleh di masa depan', to_char(v_tgl, 'DD-MM-YYYY');
  END IF;
  IF v_tgl < v_batas THEN
    RAISE EXCEPTION 'Tanggal berlaku paling awal % (bulan lalu hanya bisa diubah sampai tanggal 10)',
      to_char(v_batas, 'DD-MM-YYYY');
  END IF;

  FOR v_kunci, v_json IN SELECT e.key, e.value FROM jsonb_each(p_perubahan) e LOOP
    IF btrim(v_kunci) = '' THEN
      RAISE EXCEPTION 'Kunci HPP kosong';
    END IF;
    IF jsonb_typeof(v_json) = 'null' THEN
      v_nilai := NULL;
    ELSIF jsonb_typeof(v_json) = 'number' THEN
      v_nilai := (v_json #>> '{}')::numeric;
    ELSE
      RAISE EXCEPTION 'Nilai HPP "%" harus angka atau null', v_kunci;
    END IF;
    IF v_nilai < 0 THEN
      RAISE EXCEPTION 'Nilai HPP "%" tidak boleh negatif', v_kunci;
    END IF;
    PERFORM public._hpp_catat(p_menu_item_id, v_kunci, v_nilai, v_tgl, 'layar', p_alasan);
  END LOOP;

  -- menu_items = angka yang berlaku HARI INI (perubahan mundur tak menimpa yang lebih baru)
  SELECT h.hpp_override, h.channel_hpp INTO v_hpp, v_ch FROM public.menu_hpp_pada(p_menu_item_id, v_hari_ini) h;
  PERFORM set_config('app.hpp_via_rpc', 'on', true);
  UPDATE public.menu_items SET hpp_override = v_hpp, channel_hpp = v_ch WHERE id = p_menu_item_id;
  PERFORM set_config('app.hpp_via_rpc', '', true);

  RETURN jsonb_build_object('hpp_override', v_hpp, 'channel_hpp', v_ch, 'berlaku_mulai', v_tgl);
END $$;
REVOKE ALL ON FUNCTION public.ubah_hpp_menu(uuid, jsonb, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ubah_hpp_menu(uuid, jsonb, date, text) TO authenticated, service_role;

COMMIT;
