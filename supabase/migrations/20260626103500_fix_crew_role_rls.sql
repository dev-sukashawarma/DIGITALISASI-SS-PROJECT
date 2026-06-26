-- Update RLS policies from 'kasir' to 'crew'
DROP POLICY IF EXISTS "orders_update_kasir" ON orders;
CREATE POLICY "orders_update_crew" ON orders FOR UPDATE USING (outlet_id = get_user_outlet_id() AND get_user_role() = 'crew');

DROP POLICY IF EXISTS "kiosk_settings_all_kasir" ON kiosk_settings;
CREATE POLICY "kiosk_settings_all_crew" ON kiosk_settings FOR ALL USING (outlet_id = get_user_outlet_id() AND get_user_role() = 'crew');
