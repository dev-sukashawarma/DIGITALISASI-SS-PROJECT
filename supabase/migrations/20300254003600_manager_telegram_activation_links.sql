-- 20300254003600_manager_telegram_activation_links.sql
-- Generator Tautan Aktivasi Instan (Deep Linking) Telegram untuk AM & RM.
-- Alur: Staf klik link -> Buka Telegram -> Klik "START" -> Otomatis tertaut tanpa ketik ID!

CREATE OR REPLACE FUNCTION public.bot_manager_buat_link_aktivasi(
  p_staff_id uuid,
  p_bot_username text DEFAULT 'sukashawarma_manager_bot'
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff record;
  v_token_raw text;
  v_token_hash text;
  v_bot_clean text;
BEGIN
  SELECT id, name, role, status INTO v_staff
  FROM public.outlet_staff
  WHERE id = p_staff_id;

  IF v_staff.id IS NULL THEN
    RAISE EXCEPTION 'Staf ID % tidak ditemukan', p_staff_id;
  END IF;

  IF v_staff.status <> 'active' THEN
    RAISE EXCEPTION 'Staf % (%) berstatus tidak aktif (%)', v_staff.name, v_staff.id, v_staff.status;
  END IF;

  v_bot_clean := replace(replace(COALESCE(p_bot_username, 'sukashawarma_manager_bot'), '@', ''), ' ', '');

  -- Buat token unik raw 64 karakter hex dari 2 uuid (pasti valid dan unik)
  v_token_raw := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(v_token_raw::bytea), 'hex');

  -- Hapus token lama yang belum terpakai untuk staf ini
  DELETE FROM public.bot_telegram_link_tokens
  WHERE staff_id = p_staff_id AND used_at IS NULL;

  -- Buat token baru berlaku 7 hari
  INSERT INTO public.bot_telegram_link_tokens (
    token_hash, staff_id, expires_at, created_at
  ) VALUES (
    v_token_hash, p_staff_id, now() + interval '7 days', now()
  );

  RETURN 'https://t.me/' || v_bot_clean || '?start=' || v_token_raw;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_manager_daftar_link_aktivasi(
  p_bot_username text DEFAULT 'sukashawarma_manager_bot'
)
RETURNS TABLE (
  staff_id uuid,
  nama text,
  role text,
  status_link text,
  telegram_user_id text,
  link_aktivasi text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS staff_id,
    s.name::text AS nama,
    s.role::text AS role,
    CASE 
      WHEN l.chat_id IS NOT NULL THEN 'TERHUBUNG'
      ELSE 'BELUM TERHUBUNG'
    END AS status_link,
    l.telegram_user_id::text,
    CASE 
      WHEN l.chat_id IS NOT NULL THEN NULL
      ELSE public.bot_manager_buat_link_aktivasi(s.id, p_bot_username)
    END AS link_aktivasi
  FROM public.outlet_staff s
  LEFT JOIN public.bot_telegram_links l ON l.staff_id = s.id
  WHERE s.role IN ('area_manager', 'regional_manager', 'developer')
    AND s.status = 'active'
  ORDER BY s.role, s.name;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_manager_buat_link_aktivasi(uuid, text),
  public.bot_manager_daftar_link_aktivasi(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bot_manager_buat_link_aktivasi(uuid, text),
  public.bot_manager_daftar_link_aktivasi(text) TO service_role;
