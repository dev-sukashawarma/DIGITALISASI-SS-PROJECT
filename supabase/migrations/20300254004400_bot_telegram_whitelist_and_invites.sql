-- 20300254004400_bot_telegram_whitelist_and_invites.sql
-- Skema penautan ID Telegram mandiri per bot (decoupled dari tabel staf/app)
-- Mendukung penautan via kode undangan (invite code / deep link) & direct whitelist

-- 1. Tambahkan kolom bot_username ke katalog bot agar bisa membuat deep link t.me/<bot_username>
ALTER TABLE public.hermes_bot_registry 
  ADD COLUMN IF NOT EXISTS bot_username text;

-- 2. Tabel Whitelist Telegram ID per Bot (Standalone)
CREATE TABLE IF NOT EXISTS public.bot_telegram_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_slug text NOT NULL REFERENCES public.hermes_bot_registry(slug) ON DELETE CASCADE,
  telegram_user_id text NOT NULL,
  nama_pengguna text NOT NULL,
  username_telegram text,
  is_active boolean NOT NULL DEFAULT true,
  catatan text,
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  dibuat_oleh uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  CONSTRAINT uq_bot_telegram_whitelist UNIQUE (bot_slug, telegram_user_id),
  CONSTRAINT chk_bot_whitelist_telegram_id CHECK (telegram_user_id ~ '^[0-9]{1,24}$')
);

CREATE INDEX IF NOT EXISTS idx_bot_whitelist_bot_active 
  ON public.bot_telegram_whitelist (bot_slug, is_active);

CREATE INDEX IF NOT EXISTS idx_bot_whitelist_telegram_user 
  ON public.bot_telegram_whitelist (telegram_user_id);

ALTER TABLE public.bot_telegram_whitelist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_whitelist FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bot_telegram_whitelist TO service_role;

-- 3. Tabel Kode Undangan (Invite Codes)
CREATE TABLE IF NOT EXISTS public.bot_telegram_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (code ~ '^[a-zA-Z0-9_-]{4,64}$'),
  bot_slug text NOT NULL REFERENCES public.hermes_bot_registry(slug) ON DELETE CASCADE,
  label text,
  max_uses integer DEFAULT 1, -- NULL berarti penggunaan tak terbatas
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,     -- NULL berarti tidak ada waktu kedaluwarsa
  is_active boolean NOT NULL DEFAULT true,
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  dibuat_oleh uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_invite_codes_lookup 
  ON public.bot_telegram_invite_codes (code) WHERE is_active = true;

ALTER TABLE public.bot_telegram_invite_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_invite_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bot_telegram_invite_codes TO service_role;

-- 4. RPC untuk Redeem Invite Code saat user menekan /start <code_atau_inv_code>
CREATE OR REPLACE FUNCTION public.bot_telegram_redeem_invite_code(
  p_code text,
  p_telegram_user_id text,
  p_nama text DEFAULT 'User Telegram',
  p_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_clean_code text;
  v_bot record;
BEGIN
  IF p_code IS NULL OR p_telegram_user_id !~ '^[0-9]{1,24}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  -- Bersihkan prefix 'inv_' jika ada
  v_clean_code := regexp_replace(trim(p_code), '^inv_', '');

  -- Gunakan advisory lock per code agar aman saat konkurensi klaim bersamaan
  PERFORM pg_advisory_xact_lock(hashtextextended('tg-invite:' || v_clean_code, 0));

  SELECT * INTO v_invite
  FROM public.bot_telegram_invite_codes
  WHERE code = v_clean_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'code_not_found_or_expired');
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.used_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quota_exceeded');
  END IF;

  -- Ambil detail bot
  SELECT slug, nama, bot_username INTO v_bot
  FROM public.hermes_bot_registry
  WHERE slug = v_invite.bot_slug;

  -- Masukkan atau aktifkan di whitelist
  INSERT INTO public.bot_telegram_whitelist (
    bot_slug,
    telegram_user_id,
    nama_pengguna,
    username_telegram,
    is_active,
    catatan
  )
  VALUES (
    v_invite.bot_slug,
    p_telegram_user_id,
    COALESCE(NULLIF(trim(p_nama), ''), 'User Telegram'),
    NULLIF(trim(p_username), ''),
    true,
    'Via invite code: ' || v_clean_code || COALESCE(' (' || v_invite.label || ')', '')
  )
  ON CONFLICT (bot_slug, telegram_user_id) DO UPDATE
  SET is_active = true,
      nama_pengguna = EXCLUDED.nama_pengguna,
      username_telegram = EXCLUDED.username_telegram,
      catatan = public.bot_telegram_whitelist.catatan || ' | Diaktifkan kembali via invite: ' || v_clean_code;

  -- Update pemakaian kuota invite
  UPDATE public.bot_telegram_invite_codes
  SET used_count = used_count + 1
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'bot_slug', v_bot.slug,
    'bot_nama', v_bot.nama,
    'bot_username', v_bot.bot_username
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_redeem_invite_code(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_redeem_invite_code(text, text, text, text) TO service_role;
