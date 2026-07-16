CREATE POLICY owner_messages_kasir_select ON public.owner_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY owner_message_outlets_kasir_select ON public.owner_message_outlets FOR SELECT TO authenticated USING (true);
