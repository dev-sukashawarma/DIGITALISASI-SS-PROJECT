-- Stokist Telegram bot: private opt-in links for Stok and Distribusi staff.
-- Hermes CEO uses a separate bot and is unaffected by these tables.

CREATE TABLE IF NOT EXISTS public.bot_telegram_links (
  staff_id uuid PRIMARY KEY REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  telegram_user_id text NOT NULL UNIQUE,
  chat_id text NOT NULL,
  telegram_username text,
  telegram_first_name text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_telegram_user_id_format CHECK (telegram_user_id ~ '^[0-9]{1,24}$'),
  CONSTRAINT bot_telegram_chat_id_format CHECK (chat_id ~ '^[0-9]{1,24}$')
);

CREATE TABLE IF NOT EXISTS public.bot_telegram_link_tokens (
  token_hash text PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_telegram_tokens_staff_idx
  ON public.bot_telegram_link_tokens (staff_id, created_at DESC);

ALTER TABLE public.bot_telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_telegram_link_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_links, public.bot_telegram_link_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bot_telegram_links, public.bot_telegram_link_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.bot_telegram_tautkan(
  p_token_hash text,
  p_telegram_user_id text,
  p_chat_id text,
  p_username text,
  p_first_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_telegram_user_id !~ '^[0-9]{1,24}$'
    OR p_chat_id !~ '^[0-9]{1,24}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('telegram-link:' || p_telegram_user_id, 0));
  SELECT t.staff_id INTO v_staff_id
  FROM public.bot_telegram_link_tokens t
  JOIN public.outlet_staff s ON s.id = t.staff_id AND s.status = 'active'
  WHERE t.token_hash = p_token_hash AND t.used_at IS NULL AND t.expires_at > now()
  FOR UPDATE OF t;

  IF v_staff_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bot_telegram_links l
    WHERE l.telegram_user_id = p_telegram_user_id AND l.staff_id <> v_staff_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'linked_elsewhere');
  END IF;

  DELETE FROM public.bot_telegram_links WHERE staff_id = v_staff_id;
  INSERT INTO public.bot_telegram_links (
    staff_id, telegram_user_id, chat_id, telegram_username, telegram_first_name, linked_at
  ) VALUES (
    v_staff_id, p_telegram_user_id, p_chat_id,
    left(p_username, 100), left(p_first_name, 100), now()
  );
  UPDATE public.bot_telegram_link_tokens SET used_at = now()
  WHERE token_hash = p_token_hash;
  DELETE FROM public.bot_telegram_link_tokens
  WHERE staff_id = v_staff_id AND token_hash <> p_token_hash;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_telegram_putuskan(p_telegram_user_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bot_telegram_links
  WHERE telegram_user_id = p_telegram_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_tautkan(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_telegram_putuskan(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_tautkan(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_telegram_putuskan(text) TO service_role;

COMMENT ON TABLE public.bot_telegram_links IS
  'Akun staf yang memilih menerima alert Stok/Distribusi dari bot Stokist.';
