-- App Retail: kurasi "Menu Terlaris" di Beranda aplikasi pelanggan (keputusan owner #16).
-- Aditif: satu kolom di app_pengaturan. Urutan array = urutan tampil.
-- Maks 6 supaya menu cadangan bisa naik bila yang di atas habis/tak dijual
-- di outlet pelanggan (Beranda menampilkan 2). Kosong = APK memakai aturan lama.
ALTER TABLE public.app_pengaturan
  ADD COLUMN IF NOT EXISTS menu_terlaris_ids uuid[] NOT NULL DEFAULT '{}'
  CHECK (cardinality(menu_terlaris_ids) <= 6);
