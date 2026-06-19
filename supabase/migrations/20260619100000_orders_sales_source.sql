-- orders.sales_source: pembeda Sumber Omzet (ADR-0009)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_source TEXT NOT NULL DEFAULT 'pos'
  CHECK (sales_source IN ('pos','online','gofood','grabfood','shopeefood','tiktok'));

-- backfill eksplisit (semua order lama = POS Outlet)
UPDATE public.orders SET sales_source = 'pos' WHERE sales_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_source_created
  ON public.orders (sales_source, created_at);
