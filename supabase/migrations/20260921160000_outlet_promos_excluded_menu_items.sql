-- Pengecualian menu pada promo global ("Promo Semua Menu").
--
-- Admin bisa memilih menu yang TIDAK ikut promo global. Kolom hidup di tiap
-- baris outlet_promos (satu promo = satu baris per outlet), diisi identik oleh
-- server action admin-dashboard untuk semua outlet yang dipilih.
--
-- Semantik di kasir (web pos-kasir & POS native): menu yang ada di daftar ini
-- dilewati oleh promo global dan jatuh ke promo per-menu bila ada. Daftar
-- kosong = perilaku lama (promo berlaku untuk semua menu). Hanya bermakna pada
-- scope='global'; baris scope='item' selalu '{}'.
--
-- Aditif & idempoten. Klien lama yang belum mengenal kolom ini tetap jalan:
-- mereka memakai SELECT * dan mengabaikan kolom asing.

ALTER TABLE public.outlet_promos
  ADD COLUMN IF NOT EXISTS excluded_menu_item_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.outlet_promos.excluded_menu_item_ids IS
  'Menu yang dikecualikan dari promo global. Kosong = semua menu ikut. Hanya dipakai saat scope=global.';
