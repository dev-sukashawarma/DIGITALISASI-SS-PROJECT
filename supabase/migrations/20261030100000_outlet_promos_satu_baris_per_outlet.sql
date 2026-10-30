-- Satu baris outlet_promos per (outlet, scope, menu).
--
-- Halaman admin kini mengizinkan promo yang BERBEDA antar outlet untuk scope +
-- menu yang sama (outlet A diskon 10% semua menu, outlet B Beli 1 Gratis 1
-- semua menu). Kasir — web maupun native — membaca promo outletnya lalu
-- mengambil baris `global` PERTAMA yang lolos jadwal; kalau sampai ada dua
-- baris global aktif untuk satu outlet, baris mana yang menang tidak
-- ditentukan. Server action menjaga ini lewat pemetaan id, tapi tabelnya
-- sendiri belum pernah menjaminnya. Diperiksa 2026-10-30: nol duplikat.
--
-- Index parsial per scope karena menu_item_id NULL untuk scope global dan
-- NULL tidak pernah sama dengan NULL di UNIQUE biasa.
CREATE UNIQUE INDEX IF NOT EXISTS outlet_promos_outlet_global_uniq
  ON public.outlet_promos (outlet_id)
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS outlet_promos_outlet_item_uniq
  ON public.outlet_promos (outlet_id, menu_item_id)
  WHERE scope = 'item';
