-- =============================================================================
-- Insert stok_balance (saldo 0) untuk bahan baku yang belum punya record stok
-- di outlet-outlet yang ada, agar muncul di layar monitoring (karena view-nya
-- memakai INNER JOIN ke stok_balance).
-- =============================================================================

INSERT INTO public.stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
SELECT o.id, b.id, 0, NOW()
FROM public.outlets o
CROSS JOIN public.bahan_baku b
WHERE b.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM public.stok_balance sb 
    WHERE sb.outlet_id = o.id 
      AND sb.bahan_baku_id = b.id
  );
