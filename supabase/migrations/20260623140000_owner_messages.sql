-- 20260623140000_owner_messages.sql
-- Fitur: Owner mengirim pesan (kata-kata mutiara / info / peringatan) ke POS-kasir.
-- Target: SEMUA kasir atau outlet tertentu (multi). Persisten + realtime, popup
-- di POS tetap tampil sampai kasir klik OK (ditandai sudah dibaca). Owner set
-- waktu kadaluarsa sendiri saat kirim, dan bisa menonaktifkan manual.

-- ── Helper: apakah user saat ini owner/admin ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_owner_or_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- ── Tabel pesan ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_messages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID         REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  kind        TEXT         NOT NULL DEFAULT 'motivasi'
                           CHECK (kind IN ('motivasi', 'info', 'peringatan')),
  title       TEXT,
  body        TEXT         NOT NULL CHECK (length(trim(body)) > 0),
  target_type TEXT         NOT NULL DEFAULT 'all'
                           CHECK (target_type IN ('all', 'outlets')),
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ,                       -- NULL = tidak kadaluarsa
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Outlet sasaran (hanya dipakai saat target_type = 'outlets')
CREATE TABLE IF NOT EXISTS public.owner_message_outlets (
  message_id UUID NOT NULL REFERENCES public.owner_messages(id) ON DELETE CASCADE,
  outlet_id  UUID NOT NULL REFERENCES public.outlets(id)        ON DELETE CASCADE,
  PRIMARY KEY (message_id, outlet_id)
);

-- Status dibaca per user (kasir)
CREATE TABLE IF NOT EXISTS public.owner_message_reads (
  message_id UUID        NOT NULL REFERENCES public.owner_messages(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS owner_messages_active_idx
  ON public.owner_messages (is_active, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS owner_message_outlets_outlet_idx
  ON public.owner_message_outlets (outlet_id);

-- ── RPC: owner mengirim pesan (atomik: pesan + daftar outlet) ────────────────
CREATE OR REPLACE FUNCTION public.send_owner_message(
  p_kind        TEXT,
  p_title       TEXT,
  p_body        TEXT,
  p_target_type TEXT,
  p_outlet_ids  UUID[],
  p_expires_at  TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh mengirim pesan';
  END IF;

  INSERT INTO public.owner_messages (sender_id, kind, title, body, target_type, expires_at)
  VALUES (auth.uid(), COALESCE(NULLIF(p_kind, ''), 'motivasi'), NULLIF(p_title, ''),
          p_body, COALESCE(p_target_type, 'all'), p_expires_at)
  RETURNING id INTO v_id;

  IF COALESCE(p_target_type, 'all') = 'outlets' AND p_outlet_ids IS NOT NULL THEN
    INSERT INTO public.owner_message_outlets (message_id, outlet_id)
    SELECT v_id, unnest(p_outlet_ids)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_id;
END;
$$;

-- ── RPC: pesan aktif yang BELUM dibaca oleh user saat ini ────────────────────
-- Dipanggil POS-kasir saat mount & tiap ada event realtime INSERT owner_messages.
CREATE OR REPLACE FUNCTION public.get_my_active_messages()
RETURNS TABLE (
  id         UUID,
  kind       TEXT,
  title      TEXT,
  body       TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.kind, m.title, m.body, m.created_at, m.expires_at
  FROM public.owner_messages m
  WHERE m.is_active
    AND (m.expires_at IS NULL OR m.expires_at > now())
    AND (
      m.target_type = 'all'
      OR EXISTS (
        SELECT 1
        FROM public.owner_message_outlets mo
        JOIN public.outlet_staff s ON s.id = auth.uid()
        WHERE mo.message_id = m.id AND mo.outlet_id = s.outlet_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.owner_message_reads r
      WHERE r.message_id = m.id AND r.user_id = auth.uid()
    )
  ORDER BY m.created_at ASC;
$$;

-- ── RPC: tandai pesan sudah dibaca ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.owner_message_reads (message_id, user_id)
  VALUES (p_message_id, auth.uid())
  ON CONFLICT (message_id, user_id) DO NOTHING;
$$;

-- ── View ringkasan untuk panel riwayat owner (jumlah yang sudah baca) ────────
CREATE OR REPLACE VIEW public.owner_messages_overview
WITH (security_barrier = true) AS
SELECT
  m.id, m.kind, m.title, m.body, m.target_type, m.is_active,
  m.expires_at, m.created_at,
  (m.is_active AND (m.expires_at IS NULL OR m.expires_at > now())) AS is_live,
  COALESCE((SELECT count(*) FROM public.owner_message_reads r WHERE r.message_id = m.id), 0) AS read_count,
  COALESCE((SELECT array_agg(mo.outlet_id) FROM public.owner_message_outlets mo WHERE mo.message_id = m.id), '{}'::uuid[]) AS outlet_ids
FROM public.owner_messages m
ORDER BY m.created_at DESC;

GRANT SELECT ON public.owner_messages_overview TO authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.owner_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_message_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_message_reads   ENABLE ROW LEVEL SECURITY;

-- Owner/admin kelola penuh pesan (kasir akses lewat RPC definer, tak perlu select langsung).
DROP POLICY IF EXISTS owner_messages_admin_all ON public.owner_messages;
CREATE POLICY owner_messages_admin_all ON public.owner_messages
  FOR ALL USING (public.is_owner_or_admin()) WITH CHECK (public.is_owner_or_admin());

DROP POLICY IF EXISTS owner_message_outlets_admin_all ON public.owner_message_outlets;
CREATE POLICY owner_message_outlets_admin_all ON public.owner_message_outlets
  FOR ALL USING (public.is_owner_or_admin()) WITH CHECK (public.is_owner_or_admin());

-- Reads: owner/admin boleh lihat (untuk hitung), user boleh menandai miliknya sendiri.
DROP POLICY IF EXISTS owner_message_reads_select ON public.owner_message_reads;
CREATE POLICY owner_message_reads_select ON public.owner_message_reads
  FOR SELECT USING (public.is_owner_or_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS owner_message_reads_insert_own ON public.owner_message_reads;
CREATE POLICY owner_message_reads_insert_own ON public.owner_message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── Realtime: kasir berlangganan INSERT owner_messages → refetch get_my_active_messages ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'owner_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.owner_messages;
  END IF;
END $$;
