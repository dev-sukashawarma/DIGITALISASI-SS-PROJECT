-- 20260623150000_daily_sales_targets.sql
-- Fitur: Target penjualan harian. Owner mengatur target default global +
-- override per-outlet. Angka berlaku tiap hari sampai diubah (riwayat via
-- effective_from). Progress = total omzet outlet hari ini (semua sumber, order
-- completed) / target. Dipakai realtime di POS-kasir (header) & dashboard owner.

-- ── Tabel target (riwayat append-only; baris terbaru = berlaku) ──────────────
-- outlet_id NULL  → target default global (berlaku ke outlet tanpa override)
-- outlet_id <uuid>→ override khusus outlet tsb.
CREATE TABLE IF NOT EXISTS public.daily_sales_targets (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id      UUID          REFERENCES public.outlets(id) ON DELETE CASCADE,
  target_amount  NUMERIC(12,2) NOT NULL CHECK (target_amount >= 0),
  effective_from DATE          NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  created_by     UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_sales_targets_lookup_idx
  ON public.daily_sales_targets (outlet_id, effective_from DESC, created_at DESC);

-- ── Resolusi target berlaku untuk outlet pada tanggal tertentu ───────────────
-- Override outlet menang; jika tidak ada, pakai default global; jika tidak ada, 0.
CREATE OR REPLACE FUNCTION public.resolve_daily_target(p_outlet UUID, p_date DATE)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT target_amount FROM public.daily_sales_targets
       WHERE outlet_id = p_outlet AND effective_from <= p_date
       ORDER BY effective_from DESC, created_at DESC LIMIT 1),
    (SELECT target_amount FROM public.daily_sales_targets
       WHERE outlet_id IS NULL AND effective_from <= p_date
       ORDER BY effective_from DESC, created_at DESC LIMIT 1),
    0
  );
$$;

-- ── View progress hari ini per outlet (definer, bypass RLS — pola sales_summary_spv) ──
CREATE OR REPLACE VIEW public.daily_target_progress_spv
WITH (security_barrier = true) AS
SELECT
  o.id                                                                   AS outlet_id,
  o.name                                                                 AS outlet_name,
  public.resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS target_amount,
  COALESCE((
    SELECT SUM(ord.total_amount)
    FROM public.orders ord
    WHERE ord.outlet_id = o.id
      AND ord.status = 'completed'
      AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date
  ), 0)                                                                  AS omzet_today
FROM public.outlets o;

GRANT SELECT ON public.daily_target_progress_spv TO authenticated;

-- ── RPC: owner set target (NULL outlet = default global) ─────────────────────
CREATE OR REPLACE FUNCTION public.set_daily_target(p_outlet UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh mengatur target';
  END IF;
  INSERT INTO public.daily_sales_targets (outlet_id, target_amount, created_by)
  VALUES (p_outlet, p_amount, auth.uid());
END;
$$;

-- ── RPC: hapus override outlet (kembali ikut default global) ─────────────────
CREATE OR REPLACE FUNCTION public.clear_daily_target_override(p_outlet UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh mengatur target';
  END IF;
  DELETE FROM public.daily_sales_targets WHERE outlet_id = p_outlet;
END;
$$;

-- ── RPC: progress target untuk outlet milik user (POS-kasir) ─────────────────
CREATE OR REPLACE FUNCTION public.get_my_target_progress()
RETURNS TABLE (
  outlet_id     UUID,
  outlet_name   TEXT,
  target_amount NUMERIC,
  omzet_today   NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.outlet_id, p.outlet_name, p.target_amount, p.omzet_today
  FROM public.daily_target_progress_spv p
  JOIN public.outlet_staff s ON s.id = auth.uid()
  WHERE p.outlet_id = s.outlet_id;
$$;

-- ── RPC: daftar target saat ini (default + override) untuk UI owner ──────────
CREATE OR REPLACE FUNCTION public.get_current_targets()
RETURNS TABLE (
  outlet_id    UUID,
  outlet_name  TEXT,
  target_amount NUMERIC,
  is_override  BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    public.resolve_daily_target(o.id, (now() AT TIME ZONE 'Asia/Jakarta')::date),
    EXISTS (SELECT 1 FROM public.daily_sales_targets t WHERE t.outlet_id = o.id)
  FROM public.outlets o
  ORDER BY o.name;
$$;

-- ── RLS: hanya owner/admin tulis/baca tabel mentah (POS pakai RPC/view) ──────
ALTER TABLE public.daily_sales_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_sales_targets_admin_all ON public.daily_sales_targets;
CREATE POLICY daily_sales_targets_admin_all ON public.daily_sales_targets
  FOR ALL USING (public.is_owner_or_admin()) WITH CHECK (public.is_owner_or_admin());
