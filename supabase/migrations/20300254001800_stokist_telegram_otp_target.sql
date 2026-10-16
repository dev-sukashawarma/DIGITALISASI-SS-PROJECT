-- Bind each one-time verification code to the Telegram account it was sent to.
ALTER TABLE public.bot_telegram_link_tokens
  ADD COLUMN IF NOT EXISTS telegram_user_id text;
ALTER TABLE public.bot_telegram_link_tokens
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.bot_telegram_link_tokens
  ADD CONSTRAINT bot_telegram_link_token_user_id_format
  CHECK (telegram_user_id IS NULL OR telegram_user_id ~ '^[0-9]{1,24}$');

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
  v_target_user_id text;
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_telegram_user_id !~ '^[0-9]{1,24}$'
    OR p_chat_id !~ '^[0-9]{1,24}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('telegram-link:' || p_telegram_user_id, 0));
  SELECT t.staff_id, t.telegram_user_id INTO v_staff_id, v_target_user_id
  FROM public.bot_telegram_link_tokens t
  JOIN public.outlet_staff s ON s.id = t.staff_id AND s.status = 'active'
  WHERE t.token_hash = p_token_hash AND t.used_at IS NULL AND t.expires_at > now()
  FOR UPDATE OF t;

  IF v_staff_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF v_target_user_id IS NULL OR v_target_user_id <> p_telegram_user_id OR p_chat_id <> p_telegram_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
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

REVOKE ALL ON FUNCTION public.bot_telegram_tautkan(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_tautkan(text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.bot_telegram_tautkan_kode(
  p_staff_id uuid,
  p_token_hash text,
  p_telegram_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_target_user_id text;
  v_attempt_count integer;
  v_token_hash text;
BEGIN
  IF p_staff_id IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_telegram_user_id !~ '^[0-9]{1,24}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT telegram_user_id, attempt_count, token_hash INTO v_target_user_id, v_attempt_count, v_token_hash
  FROM public.bot_telegram_link_tokens
  WHERE staff_id = p_staff_id AND used_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;

  IF v_target_user_id IS NULL OR v_attempt_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = p_staff_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('telegram-link:' || p_telegram_user_id, 0));
  IF v_token_hash <> p_token_hash
    OR v_target_user_id <> p_telegram_user_id THEN
    UPDATE public.bot_telegram_link_tokens
    SET attempt_count = attempt_count + 1
    WHERE staff_id = p_staff_id AND used_at IS NULL;
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bot_telegram_links l
    WHERE l.telegram_user_id = p_telegram_user_id AND l.staff_id <> p_staff_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'linked_elsewhere');
  END IF;

  DELETE FROM public.bot_telegram_links WHERE staff_id = p_staff_id;
  INSERT INTO public.bot_telegram_links (staff_id, telegram_user_id, chat_id, linked_at)
  VALUES (p_staff_id, p_telegram_user_id, p_telegram_user_id, now());
  UPDATE public.bot_telegram_link_tokens
  SET used_at = now()
  WHERE staff_id = p_staff_id AND used_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_tautkan_kode(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_tautkan_kode(uuid, text, text) TO service_role;
