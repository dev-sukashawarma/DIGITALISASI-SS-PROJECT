-- Review sidak manager dipisahkan dari submission inventaris AM.
-- Data sumber tetap immutable dari sisi review; manager hanya menambah hasil verifikasi.
CREATE TABLE IF NOT EXISTS public.inventaris_sidak_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.inventaris_submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.inventaris_sidak_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.inventaris_sidak_reviews(id) ON DELETE CASCADE,
  submission_item_id UUID NOT NULL REFERENCES public.inventaris_submission_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_checked' CHECK (status IN ('not_checked', 'ok', 'issue')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, submission_item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventaris_sidak_reviews_submission
  ON public.inventaris_sidak_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_inventaris_sidak_review_items_review
  ON public.inventaris_sidak_review_items(review_id);

ALTER TABLE public.inventaris_sidak_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaris_sidak_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventaris_sidak_reviews_manager_read ON public.inventaris_sidak_reviews;
CREATE POLICY inventaris_sidak_reviews_manager_read ON public.inventaris_sidak_reviews
  FOR SELECT TO authenticated
  USING (
    submission_id IN (
      SELECT s.id
      FROM public.inventaris_submissions s
      WHERE s.outlet_id IN (SELECT public.accessible_outlet_ids())
    )
    AND EXISTS (
      SELECT 1 FROM public.outlet_staff me
      WHERE me.id = auth.uid()
        AND me.role IN ('regional_manager', 'area_manager')
        AND me.status = 'active'
    )
  );

DROP POLICY IF EXISTS inventaris_sidak_review_items_manager_read ON public.inventaris_sidak_review_items;
CREATE POLICY inventaris_sidak_review_items_manager_read ON public.inventaris_sidak_review_items
  FOR SELECT TO authenticated
  USING (review_id IN (SELECT id FROM public.inventaris_sidak_reviews));

COMMENT ON TABLE public.inventaris_sidak_reviews IS 'Hasil verifikasi sidak Regional Manager/Area Manager atas submission inventaris AM.';
