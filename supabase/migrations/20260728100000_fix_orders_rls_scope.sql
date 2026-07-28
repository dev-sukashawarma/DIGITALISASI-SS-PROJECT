-- Audit lintas-app 2026-07-27/28: orders_select_public / orders_insert_public
-- adalah USING(true)/WITH CHECK(true) sejak migration awal (20260612000001),
-- tak pernah ditutup. Efeknya siapa pun yang bersesi (crew/kasir/mitra di
-- outlet mana pun) bisa baca omzet SEMUA outlet & insert order palsu lewat
-- REST langsung (anon key + sesi), lepas dari filter outlet_id di UI mana pun.
--
-- Scoped via accessible_outlet_ids() — sumber kebenaran yang sama dipakai
-- ledger_stok (`ledger_read`) dan mitra scoped views (20260629100000):
-- admin/owner/spv/kitchen/admin_finance/admin_hr = semua outlet;
-- leader/korlap = via staff_outlets; crew/kasir/kiosk/mitra = outlet sendiri.
--
-- Policy lama orders_update_kasir/orders_update_crew/orders_all_admin TIDAK
-- disentuh (sudah scoped dengan benar, dan RLS mem-OR-kan policy permisif
-- untuk command yang sama — tidak konflik dengan yang baru).
DROP POLICY IF EXISTS "orders_select_public" ON orders;
DROP POLICY IF EXISTS "orders_insert_public" ON orders;

CREATE POLICY "orders_select_scoped" ON orders
  FOR SELECT
  USING (outlet_id IN (SELECT accessible_outlet_ids()));

CREATE POLICY "orders_insert_scoped" ON orders
  FOR INSERT
  WITH CHECK (outlet_id IN (SELECT accessible_outlet_ids()));
