-- One-time admin-issued Telegram activation links, scoped to one selected bot profile.
CREATE TABLE IF NOT EXISTS public.hermes_telegram_activation_invites (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  bot_slug text NOT NULL REFERENCES public.hermes_bot_registry(slug) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  bot_username text NOT NULL CHECK (bot_username ~ '^[A-Za-z0-9_]{5,32}$'),
  issued_by uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS hermes_telegram_invites_staff_idx
  ON public.hermes_telegram_activation_invites (staff_id, bot_slug, created_at DESC);

ALTER TABLE public.hermes_telegram_activation_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_telegram_activation_invites FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.hermes_telegram_activation_invites TO service_role;

CREATE OR REPLACE FUNCTION public.hermes_telegram_redeem_activation_invite(
  p_token_hash text,
  p_telegram_user_id text,
  p_username text,
  p_first_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_bot_slug text;
  v_bot_username text;
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_telegram_user_id !~ '^[0-9]{1,24}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('telegram-link:' || p_telegram_user_id, 0));
  SELECT i.staff_id, i.bot_slug, i.bot_username
    INTO v_staff_id, v_bot_slug, v_bot_username
  FROM public.hermes_telegram_activation_invites i
  JOIN public.outlet_staff s ON s.id = i.staff_id AND s.status = 'active'
  WHERE i.token_hash = p_token_hash
    AND i.used_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  FOR UPDATE OF i;

  IF v_staff_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF NOT (
    (v_bot_slug = 'stokis' AND EXISTS (
      SELECT 1 FROM public.bot_telegram_access a WHERE a.staff_id = v_staff_id
    ))
    OR EXISTS (
      SELECT 1 FROM public.hermes_bot_user_access a
      WHERE a.bot_slug = v_bot_slug AND a.staff_id = v_staff_id
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'access_revoked');
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
    v_staff_id, p_telegram_user_id, p_telegram_user_id,
    left(p_username, 100), left(p_first_name, 100), now()
  );

  UPDATE public.hermes_telegram_activation_invites
    SET used_at = now()
  WHERE token_hash = p_token_hash;
  UPDATE public.hermes_telegram_activation_invites
    SET revoked_at = now()
  WHERE staff_id = v_staff_id AND used_at IS NULL AND revoked_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'bot_username', v_bot_username);
END;
$$;

REVOKE ALL ON FUNCTION public.hermes_telegram_redeem_activation_invite(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_telegram_redeem_activation_invite(text, text, text, text)
  TO service_role;
