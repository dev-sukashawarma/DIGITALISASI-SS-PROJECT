-- 20300104000005_lock_down_waterfall_deduction.sql
-- process_waterfall_deduction (dibuat di 20300103000010) adalah SECURITY DEFINER
-- TANPA SET search_path, dengan EXECUTE terbuka untuk PUBLIC/anon/authenticated.
-- Anon key ada di bundle browser semua app -> siapa pun bisa memanggil
-- /rest/v1/rpc/process_waterfall_deduction dan menulis baris 'pemakaian' untuk
-- outlet mana pun dengan qty bebas. Tipe 'pemakaian' dikecualikan dari guard
-- no-negative di ledger_stamp_saldo, jadi saldo bisa ditarik minus sedalam apa pun.
--
-- Tabel bahan_baku_substitusi juga tanpa RLS dengan anon=arwdDxtm -> mapping
-- pemotongan stok bisa diubah/dihapus anon.
--
-- Fungsi ini akan dipensiunkan oleh rencana satuan kanonik, tapi selama masih ada
-- di DB lubangnya aktif -> ditutup sekarang.
--
-- Mencabut EXECUTE tidak mematahkan trigger: trg_process_bom_stok SECURITY DEFINER,
-- jadi PERFORM di dalamnya berjalan sebagai pemilik yang tetap punya EXECUTE.

-- 1. search_path tetap, tanpa perlu mendefinisikan ulang badan fungsi
ALTER FUNCTION public.process_waterfall_deduction(uuid, uuid, numeric, text, uuid)
  SET search_path = public;

-- 2. Cabut EXECUTE dari pemanggil publik
REVOKE ALL ON FUNCTION public.process_waterfall_deduction(uuid, uuid, numeric, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- 3. RLS untuk tabel mapping
ALTER TABLE public.bahan_baku_substitusi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbs_read_authenticated ON public.bahan_baku_substitusi;
CREATE POLICY bbs_read_authenticated ON public.bahan_baku_substitusi
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS bbs_write_admin ON public.bahan_baku_substitusi;
CREATE POLICY bbs_write_admin ON public.bahan_baku_substitusi
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner', 'kitchen')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner', 'kitchen')
  ));

-- 4. Cabut hak tulis langsung dari anon (RLS sudah menggerbangi, ini lapis kedua)
REVOKE INSERT, UPDATE, DELETE ON public.bahan_baku_substitusi FROM anon;
