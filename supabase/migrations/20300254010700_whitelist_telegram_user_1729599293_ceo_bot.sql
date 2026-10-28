-- =============================================================================
-- Migration: 20300254010700_whitelist_telegram_user_1729599293_ceo_bot.sql
-- Tanggal: 2026-10-27
-- Deskripsi:
--   Mendaftarkan Telegram User ID 1729599293 ke dalam public.bot_telegram_whitelist
--   agar memiliki hak akses penuh ke Bot CEO (@Agent_SukaShawarma_Bot).
-- =============================================================================

INSERT INTO public.bot_telegram_whitelist (
  bot_slug,
  telegram_user_id,
  nama_pengguna,
  is_active,
  catatan,
  dibuat_at
)
VALUES (
  'ceo',
  '1729599293',
  'Eksekutif (1729599293)',
  true,
  'Akses Bot CEO (@Agent_SukaShawarma_Bot)',
  now()
)
ON CONFLICT (bot_slug, telegram_user_id) DO UPDATE SET
  is_active = true,
  catatan = EXCLUDED.catatan;
