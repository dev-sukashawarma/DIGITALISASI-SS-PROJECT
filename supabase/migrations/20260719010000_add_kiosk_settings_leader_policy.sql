CREATE POLICY "kiosk_settings_all_leader" ON public.kiosk_settings 
FOR ALL USING (outlet_id = get_user_outlet_id() AND get_user_role() = 'leader');
