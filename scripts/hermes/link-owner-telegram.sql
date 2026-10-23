DO $$
DECLARE
  v_staff_id uuid := '329ea998-9bfd-4cf2-8cdd-7ccaa9f5f267'::uuid;
  v_tg_id text := '217831843';
BEGIN
  -- 1. Pastikan role outlet_staff adalah owner & status active
  UPDATE public.outlet_staff 
  SET role = 'owner', status = 'active'
  WHERE id = v_staff_id;

  -- 2. Tautkan di bot_telegram_links
  INSERT INTO public.bot_telegram_links (staff_id, telegram_user_id, chat_id, linked_at)
  VALUES (v_staff_id, v_tg_id, v_tg_id, now())
  ON CONFLICT (staff_id) DO UPDATE SET
    telegram_user_id = EXCLUDED.telegram_user_id,
    chat_id = EXCLUDED.chat_id,
    linked_at = now();

  -- 3. Beri akses seluruh bot di hermes_bot_user_access
  INSERT INTO public.hermes_bot_user_access (bot_slug, staff_id, granted_at)
  VALUES 
    ('ceo', v_staff_id, now()),
    ('manager', v_staff_id, now()),
    ('finance', v_staff_id, now()),
    ('hrd', v_staff_id, now()),
    ('review', v_staff_id, now()),
    ('marcom', v_staff_id, now())
  ON CONFLICT (bot_slug, staff_id) DO NOTHING;

  -- 4. Akses bot stokis
  INSERT INTO public.bot_telegram_access (staff_id, granted_at)
  VALUES (v_staff_id, now())
  ON CONFLICT (staff_id) DO NOTHING;

  -- 5. Masukkan ke whitelist mandiri
  INSERT INTO public.bot_telegram_whitelist (bot_slug, telegram_user_id, nama_pengguna, is_active, catatan, dibuat_at)
  VALUES 
    ('ceo', v_tg_id, 'Owner SS', true, 'Aktivasi langsung Owner Telegram', now()),
    ('manager', v_tg_id, 'Owner SS', true, 'Aktivasi langsung Owner Telegram', now()),
    ('finance', v_tg_id, 'Owner SS', true, 'Aktivasi langsung Owner Telegram', now()),
    ('hrd', v_tg_id, 'Owner SS', true, 'Aktivasi langsung Owner Telegram', now())
  ON CONFLICT DO NOTHING;
END $$;
