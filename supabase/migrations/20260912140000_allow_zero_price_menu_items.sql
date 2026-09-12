-- Migration: Allow menu items to have price = 0 (Gratis)
-- Author: Antigravity
-- Date: 2026-09-12

ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS menu_items_price_check;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_price_check CHECK (price >= 0);
