-- Migration: 20300255111000_etoll_card_registrar_rls.sql
-- Ketatkan hak pendaftaran & pengelolaan master kartu e-Toll khusus role admin_finance & developer.

DROP POLICY IF EXISTS "etoll_cards_write_finance" ON public.etoll_cards;
CREATE POLICY "etoll_cards_write_registrar"
  ON public.etoll_cards FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin_finance', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin_finance', 'developer')
    )
  );

DROP POLICY IF EXISTS "etoll_assignments_write_finance" ON public.etoll_card_assignments;
CREATE POLICY "etoll_assignments_write_registrar"
  ON public.etoll_card_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin_finance', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin_finance', 'developer')
    )
  );

DROP POLICY IF EXISTS "etoll_pending_taps_finance" ON public.etoll_pending_taps;
CREATE POLICY "etoll_pending_taps_registrar"
  ON public.etoll_pending_taps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin_finance', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.status = 'active'
        AND s.role IN ('admin_finance', 'developer')
    )
  );

NOTIFY pgrst, 'reload schema';
