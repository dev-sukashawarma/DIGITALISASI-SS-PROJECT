-- 20260707101000_bahan_baku_kategori_core.sql
-- Tag "Item Core" untuk bahan baku inti shawarma (terpisah dari kolom `kategori`
-- yang sudah dipakai untuk grouping supplier/laporan lain). Nullable: item yang
-- tidak termasuk 8 grup ini kategori_core-nya NULL.

ALTER TABLE public.bahan_baku
  ADD COLUMN kategori_core TEXT
  CHECK (kategori_core IN (
    'daging_ayam', 'daging_sapi', 'kulit', 'sayuran',
    'saos', 'kentang', 'keju', 'tum'
  ));

CREATE INDEX idx_bahan_baku_kategori_core ON public.bahan_baku(kategori_core);

UPDATE public.bahan_baku SET kategori_core = 'daging_ayam' WHERE nama = 'AYAM';
UPDATE public.bahan_baku SET kategori_core = 'daging_sapi' WHERE nama = 'SAPI';
UPDATE public.bahan_baku SET kategori_core = 'kulit'       WHERE nama IN ('KULIT 25', 'KULIT 28', 'KULIT 32');
UPDATE public.bahan_baku SET kategori_core = 'sayuran'     WHERE nama IN ('BAWANG', 'LETTUCE');
UPDATE public.bahan_baku SET kategori_core = 'saos'        WHERE nama IN
  ('SAUS X HOT', 'SAUS TOMAT', 'SAOS SAMYANG', 'MAYONES', 'MINYAK SAYUR', 'SASA', 'SAUS CABE/TOMAT');
UPDATE public.bahan_baku SET kategori_core = 'kentang'     WHERE nama = 'KENTANG';
UPDATE public.bahan_baku SET kategori_core = 'keju'        WHERE nama = 'KEJU';
UPDATE public.bahan_baku SET kategori_core = 'tum'         WHERE nama = 'TUM';

-- DOWN:
-- DROP INDEX IF EXISTS public.idx_bahan_baku_kategori_core;
-- ALTER TABLE public.bahan_baku DROP COLUMN IF EXISTS kategori_core;
