-- 20261026160000_laporan_wa_am.sql
--
-- Laporan WhatsApp otomatis untuk Area Manager (AM), dikirim lewat device GOWA
-- 'AM_REMINDER' (blast.sukashawarma.com). Spec:
-- docs/superpowers/specs/2026-10-26-laporan-wa-am-design.md
--
--   1. Status opname harian outlet binaan (21:30 progres, 22:30 cut-off).
--   2. Reminder setor tunai H+1 (08:00): omzet tunai kemarin per outlet,
--      total tunai, dan total omzet semua kanal.
--
-- Migration ini HANYA memasang skema + fungsi. Jadwal pg_cron dipasang di
-- migration terpisah setelah uji kirim ke satu nomor.
--
-- Kredensial GOWA dibaca dari Vault (tidak ditulis di sini):
--   gowa_base_url    mis. https://blast.sukashawarma.com
--   gowa_basic_auth  "user:password"
--
-- Catatan: omzet TIDAK memakai rumus bot_manager_broadcast_omzet, yang
-- menjumlah orders.total_amount setelah JOIN order_items (satu order terhitung
-- sebanyak jumlah itemnya; 25 Okt 2026 +56%).

-- ─────────────────────────────────────────────────────────── 1. opname.finalized_at
ALTER TABLE public.opname ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

COMMENT ON COLUMN public.opname.finalized_at IS
  'Waktu opname berstatus finalized (diisi trigger trg_opname_isi_finalized_at). '
  'Baris sebelum 2026-10-26 diisi dari updated_at, jadi hanya perkiraan.';

CREATE OR REPLACE FUNCTION public.opname_isi_finalized_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'finalized' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'finalized' THEN
      NEW.finalized_at := COALESCE(NEW.finalized_at, now());
    END IF;
  ELSE
    NEW.finalized_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opname_isi_finalized_at ON public.opname;
CREATE TRIGGER trg_opname_isi_finalized_at
  BEFORE INSERT OR UPDATE OF status ON public.opname
  FOR EACH ROW EXECUTE FUNCTION public.opname_isi_finalized_at();

-- Backfill. Hanya menyentuh kolom finalized_at, jadi trigger "UPDATE OF status"
-- yang lain (bot, pengalihan tanggal, vendor) tidak ikut terpicu.
UPDATE public.opname
   SET finalized_at = updated_at
 WHERE status = 'finalized' AND finalized_at IS NULL;

-- ─────────────────────────────────────────────────────────── 2. Antrean WA
CREATE TABLE IF NOT EXISTS public.wa_am_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  phone text NOT NULL,
  jenis text NOT NULL CHECK (jenis IN ('opname_progres', 'opname_cutoff', 'setor_tunai')),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  request_id bigint,
  attempted_at timestamptz,
  message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (event_key, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_am_outbox_aktif
  ON public.wa_am_outbox (created_at) WHERE status IN ('pending', 'sending');

ALTER TABLE public.wa_am_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_am_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.wa_am_outbox TO authenticated;

DROP POLICY IF EXISTS wa_am_outbox_baca ON public.wa_am_outbox;
CREATE POLICY wa_am_outbox_baca ON public.wa_am_outbox
  FOR SELECT TO authenticated USING (public.is_owner_or_admin());

-- ─────────────────────────────────────────────────────────── 3. Helper
-- Nomor WA ke format 628xxx (tanpa @s.whatsapp.net). NULL bila tak valid.
CREATE OR REPLACE FUNCTION public.wa_am_normalisasi_nomor(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL OR length(d) < 9 THEN NULL
    WHEN d LIKE '62%' THEN d
    WHEN d LIKE '0%'  THEN '62' || substr(d, 2)
    WHEN d LIKE '8%'  THEN '62' || d
    ELSE NULL
  END
  FROM (SELECT nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '') AS d) x;
$$;

CREATE OR REPLACE FUNCTION public.wa_am_rupiah(p numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Rp ' || replace(to_char(round(coalesce(p, 0)), 'FM999,999,999,990'), ',', '.');
$$;

CREATE OR REPLACE FUNCTION public.wa_am_tanggal(p date)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(dow FROM p)::int + 1]
    || ', ' || extract(day FROM p)::int || ' '
    || (ARRAY['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month FROM p)::int]
    || ' ' || extract(year FROM p)::int;
$$;

-- Outlet binaan operasional seorang AM (tanpa Kantor Pusat, gudang, tes,
-- marketplace, SS Backup, outlet nonaktif).
CREATE OR REPLACE FUNCTION public.wa_am_outlet_binaan(p_staff_id uuid)
RETURNS TABLE (outlet_id uuid, outlet_name text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT o.id, o.name
  FROM public.staff_outlets so
  JOIN public.outlets o ON o.id = so.outlet_id
  WHERE so.staff_id = p_staff_id
    AND o.is_active IS TRUE
    AND o.type IN ('internal', 'mitra')
    AND coalesce(o.slug, '') <> 'ss-backup'
    AND o.name !~* '(^|[^a-z])(tes|test|trial|demo)([^a-z]|$)';
$$;

-- Penerima: AM aktif dengan nomor valid (atau satu AM bila p_staff_id diisi).
CREATE OR REPLACE FUNCTION public.wa_am_penerima(p_staff_id uuid DEFAULT NULL)
RETURNS TABLE (staff_id uuid, staff_name text, phone text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT s.id, s.name, public.wa_am_normalisasi_nomor(s.phone)
  FROM public.outlet_staff s
  WHERE s.role = 'area_manager'
    AND s.status = 'active'
    AND (p_staff_id IS NULL OR s.id = p_staff_id)
    AND public.wa_am_normalisasi_nomor(s.phone) IS NOT NULL;
$$;

-- ─────────────────────────────────────────────────────────── 4. Penyusun: status opname
-- p_staff_id + p_phone_uji: susun untuk satu AM tapi kirim ke nomor uji
-- (event_key diberi awalan 'uji:' + waktu, jadi selalu masuk antrean).
CREATE OR REPLACE FUNCTION public.wa_am_susun_status_opname(
  p_cutoff boolean DEFAULT false,
  p_tanggal date DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_phone_uji text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tgl date := coalesce(p_tanggal, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_am record;
  v_total int;
  v_selesai int;
  v_baris text;
  v_body text;
  v_phone text;
  v_key text;
  v_n int := 0;
BEGIN
  IF p_phone_uji IS NOT NULL AND p_staff_id IS NULL THEN
    RAISE EXCEPTION 'p_phone_uji hanya boleh dipakai bersama p_staff_id';
  END IF;

  FOR v_am IN SELECT * FROM public.wa_am_penerima(p_staff_id) LOOP
    WITH status_outlet AS (
      SELECT b.outlet_name,
             bool_or(op.status = 'finalized') AS selesai,
             bool_or(op.id IS NOT NULL) AS ada,
             min(op.finalized_at) FILTER (WHERE op.status = 'finalized') AS jam
      FROM public.wa_am_outlet_binaan(v_am.staff_id) b
      LEFT JOIN public.opname op
        ON op.outlet_id = b.outlet_id AND op.tanggal = v_tgl AND op.tipe = 'harian'
      GROUP BY b.outlet_name
    )
    SELECT count(*),
           count(*) FILTER (WHERE selesai),
           string_agg(
             CASE
               WHEN selesai THEN '✅ ' || outlet_name || ' — '
                 || to_char(jam AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
               WHEN ada THEN '⏳ ' || outlet_name || ' — masih draft'
               ELSE '❌ ' || outlet_name || ' — belum opname'
             END,
             E'\n'
             ORDER BY CASE WHEN selesai THEN 2 WHEN ada THEN 1 ELSE 0 END, jam, outlet_name
           )
      INTO v_total, v_selesai, v_baris
    FROM status_outlet;

    CONTINUE WHEN coalesce(v_total, 0) = 0;
    CONTINUE WHEN p_cutoff AND v_selesai = v_total AND p_phone_uji IS NULL;

    v_body := '*' || CASE WHEN p_cutoff THEN '🚨 Cut-off Opname' ELSE 'Status Opname' END
      || ' — ' || public.wa_am_tanggal(v_tgl)
      || CASE WHEN p_cutoff THEN ' (22:30)' ELSE ' (21:30)' END || '*'
      || E'\nArea: ' || v_am.staff_name || ' · ' || v_selesai || '/' || v_total || ' selesai'
      || E'\n\n' || v_baris
      || E'\n\n' || CASE
           WHEN v_selesai = v_total THEN 'Semua outlet sudah opname. Terima kasih.'
           WHEN p_cutoff THEN 'Mohon segera ditindaklanjuti, opname harus selesai hari ini.'
           ELSE 'Mohon dipastikan selesai sebelum 22:30.'
         END;

    v_phone := coalesce(public.wa_am_normalisasi_nomor(p_phone_uji), v_am.phone);
    v_key := CASE WHEN p_phone_uji IS NOT NULL THEN 'uji:' || clock_timestamp() || ':' ELSE '' END
      || CASE WHEN p_cutoff THEN 'opname_cutoff:' ELSE 'opname_progres:' END || v_tgl;

    INSERT INTO public.wa_am_outbox (event_key, staff_id, phone, jenis, body)
    VALUES (v_key, v_am.staff_id, v_phone,
            CASE WHEN p_cutoff THEN 'opname_cutoff' ELSE 'opname_progres' END, v_body)
    ON CONFLICT (event_key, staff_id) DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;

  RETURN v_n;
END;
$$;

-- ─────────────────────────────────────────────────────────── 5. Penyusun: reminder setor tunai
-- Default tanggal jual = kemarin WIB (setor H+1).
CREATE OR REPLACE FUNCTION public.wa_am_susun_reminder_setor(
  p_tanggal_jual date DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_phone_uji text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jual date := coalesce(p_tanggal_jual, (now() AT TIME ZONE 'Asia/Jakarta')::date - 1);
  v_am record;
  v_jumlah int;
  v_tunai numeric;
  v_kotor numeric;
  v_baris text;
  v_body text;
  v_phone text;
  v_key text;
  v_n int := 0;
BEGIN
  IF p_phone_uji IS NOT NULL AND p_staff_id IS NULL THEN
    RAISE EXCEPTION 'p_phone_uji hanya boleh dipakai bersama p_staff_id';
  END IF;

  FOR v_am IN SELECT * FROM public.wa_am_penerima(p_staff_id) LOOP
    WITH binaan AS (
      SELECT * FROM public.wa_am_outlet_binaan(v_am.staff_id)
    ),
    pesanan AS (
      -- Agregasi per order dulu, baru per outlet: tidak ada fan-out item.
      SELECT o.id, o.outlet_id, o.payment_method, o.total_amount,
             o.discount_amount, o.promo_subsidy
      FROM public.orders o
      WHERE o.status = 'completed'
        AND ((o.created_at AT TIME ZONE 'Asia/Jakarta'))::date = v_jual
        AND o.outlet_id IN (SELECT outlet_id FROM binaan)
    ),
    item AS (
      SELECT oi.order_id, sum(oi.subtotal) AS subtotal
      FROM public.order_items oi
      WHERE oi.order_id IN (SELECT id FROM pesanan)
      GROUP BY oi.order_id
    ),
    per_outlet AS (
      SELECT b.outlet_name,
             count(p.id) AS n_order,
             coalesce(sum(p.total_amount) FILTER (WHERE p.payment_method = 'cash'), 0) AS tunai,
             -- Omzet Kotor acuan tunggal (= sales_daily_spv omzet + total_deductions)
             coalesce(sum(p.total_amount + CASE
               WHEN i.subtotal IS NULL
                 THEN coalesce(p.discount_amount, 0) + coalesce(p.promo_subsidy, 0)
               ELSE greatest(0, i.subtotal - coalesce(p.total_amount, 0))
             END), 0) AS kotor
      FROM binaan b
      LEFT JOIN pesanan p ON p.outlet_id = b.outlet_id
      LEFT JOIN item i ON i.order_id = p.id
      GROUP BY b.outlet_name
    )
    SELECT count(*), sum(tunai), sum(kotor),
           string_agg(
             '• ' || outlet_name || ': '
               || CASE WHEN n_order = 0 THEN 'tidak ada penjualan'
                       ELSE public.wa_am_rupiah(tunai) END,
             E'\n' ORDER BY tunai DESC, outlet_name)
      INTO v_jumlah, v_tunai, v_kotor, v_baris
    FROM per_outlet;

    CONTINUE WHEN coalesce(v_jumlah, 0) = 0;

    v_body := '*Reminder Setor Tunai — ' || public.wa_am_tanggal(v_jual + 1) || '*'
      || E'\nOmzet ' || public.wa_am_tanggal(v_jual) || ' · Area: ' || v_am.staff_name
      || E'\n\nTunai per outlet:\n' || v_baris
      || E'\n\n*Total tunai disetor: ' || public.wa_am_rupiah(v_tunai) || '*'
      || E'\nTotal omzet semua kanal: ' || public.wa_am_rupiah(v_kotor)
      || E'\n\n' || CASE WHEN v_tunai > 0
           THEN 'Mohon segera disetor hari ini.'
           ELSE 'Tidak ada uang tunai yang perlu disetor.' END;

    v_phone := coalesce(public.wa_am_normalisasi_nomor(p_phone_uji), v_am.phone);
    v_key := CASE WHEN p_phone_uji IS NOT NULL THEN 'uji:' || clock_timestamp() || ':' ELSE '' END
      || 'setor_tunai:' || v_jual;

    INSERT INTO public.wa_am_outbox (event_key, staff_id, phone, jenis, body)
    VALUES (v_key, v_am.staff_id, v_phone, 'setor_tunai', v_body)
    ON CONFLICT (event_key, staff_id) DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;

  RETURN v_n;
END;
$$;

-- ─────────────────────────────────────────────────────────── 6. Worker kirim
-- Dipanggil tiap menit. Satu putaran: (a) evaluasi respons GOWA dari putaran
-- sebelumnya, (b) kirim baris yang siap. pg_net asinkron, jadi hasil kiriman
-- baru terbaca di putaran berikutnya.
CREATE OR REPLACE FUNCTION public.wa_am_kirim_antrean()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base text;
  v_auth text;
  r record;
  v_resp record;
  v_json jsonb;
  v_req bigint;
  v_dikirim int := 0;
  v_dev record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('wa-am-kirim-antrean')) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_base FROM vault.decrypted_secrets WHERE name = 'gowa_base_url' LIMIT 1;
  SELECT decrypted_secret INTO v_auth FROM vault.decrypted_secrets WHERE name = 'gowa_basic_auth' LIMIT 1;
  IF coalesce(v_base, '') = '' OR coalesce(v_auth, '') = '' THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM public.wa_am_outbox
    WHERE status IN ('pending', 'sending')
    ORDER BY created_at, id
    LIMIT 20
    FOR UPDATE SKIP LOCKED
  LOOP
    -- (a) Evaluasi respons kiriman sebelumnya
    IF r.request_id IS NOT NULL THEN
      SELECT status_code, content, timed_out, error_msg
        INTO v_resp
        FROM net._http_response WHERE id = r.request_id;

      IF NOT FOUND THEN
        CONTINUE WHEN r.attempted_at > now() - interval '3 minutes';
        UPDATE public.wa_am_outbox
           SET status = 'pending', request_id = NULL, last_error = 'respons hilang'
         WHERE id = r.id;
        r.request_id := NULL;
        r.last_error := 'respons hilang';
      ELSE
        v_json := CASE WHEN v_resp.content IS JSON OBJECT THEN v_resp.content::jsonb END;

        IF v_resp.status_code = 200 AND v_json->>'code' = 'SUCCESS' THEN
          UPDATE public.wa_am_outbox
             SET status = 'sent', sent_at = now(), request_id = NULL, last_error = NULL,
                 message_id = v_json->'results'->>'message_id'
           WHERE id = r.id;
          CONTINUE;
        END IF;

        r.last_error := left(coalesce(
          v_json->>'code' || ': ' || coalesce(v_json->>'message', ''),
          v_resp.error_msg,
          'HTTP ' || v_resp.status_code || ' ' || left(coalesce(v_resp.content, ''), 200)
        ), 500);

        -- Nomor tidak terdaftar di WhatsApp: tidak ada gunanya diulang.
        IF v_json->>'code' = 'INVALID_JID' THEN
          r.attempts := 99;
        END IF;

        UPDATE public.wa_am_outbox
           SET status = 'pending', request_id = NULL, last_error = r.last_error
         WHERE id = r.id;
        r.request_id := NULL;
      END IF;
    END IF;

    -- Sedang menunggu respons
    CONTINUE WHEN r.request_id IS NOT NULL;

    -- (b) Batas percobaan
    IF r.attempts >= 3 THEN
      UPDATE public.wa_am_outbox SET status = 'failed' WHERE id = r.id;
      FOR v_dev IN
        SELECT id FROM public.outlet_staff WHERE role = 'developer' AND status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          'wa_am_gagal:' || r.id, v_dev.id,
          '⚠️ Laporan WA AM gagal terkirim',
          'Jenis: ' || r.jenis || E'\nNomor: ' || r.phone
            || E'\nGalat: ' || coalesce(r.last_error, '-')
            || E'\nCek tabel wa_am_outbox id ' || r.id || '.',
          NULL);
      END LOOP;
      CONTINUE;
    END IF;

    -- Backoff 2 / 5 menit setelah percobaan gagal
    CONTINUE WHEN r.attempted_at IS NOT NULL AND r.attempted_at >
      now() - CASE WHEN r.attempts <= 1 THEN interval '2 minutes' ELSE interval '5 minutes' END;

    -- Penerima masih AM aktif?
    IF NOT EXISTS (SELECT 1 FROM public.outlet_staff s
                   WHERE s.id = r.staff_id AND s.role = 'area_manager' AND s.status = 'active') THEN
      UPDATE public.wa_am_outbox SET status = 'skipped', last_error = 'bukan AM aktif' WHERE id = r.id;
      CONTINUE;
    END IF;

    -- Batasi 5 kiriman baru per putaran (jaga nomor dari pola spam)
    CONTINUE WHEN v_dikirim >= 5;

    BEGIN
      v_req := net.http_post(
        url := rtrim(v_base, '/') || '/send/message',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json',
          'User-Agent', 'SukaShawarma-WA-AM/1.0',
          'Authorization', 'Basic ' || replace(encode(convert_to(v_auth, 'UTF8'), 'base64'), E'\n', ''),
          'X-Device-Id', 'AM_REMINDER'
        ),
        body := jsonb_build_object(
          'phone', r.phone || '@s.whatsapp.net',
          'message', r.body
        ),
        timeout_milliseconds := 20000
      );
      UPDATE public.wa_am_outbox
         SET status = 'sending', request_id = v_req, attempted_at = now(), attempts = attempts + 1
       WHERE id = r.id;
      v_dikirim := v_dikirim + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.wa_am_outbox
         SET status = 'pending', request_id = NULL, attempted_at = now(),
             attempts = attempts + 1, last_error = left(SQLERRM, 500)
       WHERE id = r.id;
    END;
  END LOOP;

  DELETE FROM public.wa_am_outbox
   WHERE created_at < now() - interval '90 days' AND status IN ('sent', 'failed', 'skipped');
END;
$$;

-- ─────────────────────────────────────────────────────────── 7. Hak akses
REVOKE ALL ON FUNCTION
  public.wa_am_outlet_binaan(uuid),
  public.wa_am_penerima(uuid),
  public.wa_am_susun_status_opname(boolean, date, uuid, text),
  public.wa_am_susun_reminder_setor(date, uuid, text),
  public.wa_am_kirim_antrean()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.wa_am_susun_status_opname(boolean, date, uuid, text),
  public.wa_am_susun_reminder_setor(date, uuid, text),
  public.wa_am_kirim_antrean()
TO service_role;
