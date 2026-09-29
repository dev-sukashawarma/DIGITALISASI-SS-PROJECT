-- Push ceklist harian ke HR: kalimat penutup kini mengajak meninjau & menyetujui,
-- karena HR boleh menyetujui sejak 20260929200000. Hanya teks; fungsi milik
-- migration 20260929180000 (tidak didefinisikan migration lain). Idempoten.

CREATE OR REPLACE FUNCTION public.ceklist_harian_isi_push_hr(p_ceklist_id UUID)
RETURNS TABLE (judul TEXT, isi TEXT, url TEXT, kirim BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c RECORD;
  v_outlet TEXT;
  v_tipe TEXT;
  v_baru BOOLEAN;
BEGIN
  SELECT * INTO v_c FROM public.ceklist_harian WHERE id = p_ceklist_id;
  IF NOT FOUND THEN
    kirim := false; RETURN NEXT; RETURN;
  END IF;
  SELECT o.name, o.type INTO v_outlet, v_tipe FROM public.outlets o WHERE o.id = v_c.outlet_id;
  v_baru := v_c.created_at = v_c.updated_at;

  kirim := COALESCE(v_tipe, 'outlet') NOT IN ('test', 'marketplace');
  judul := CASE WHEN v_baru THEN '📋 Ceklist Harian Masuk' ELSE '📋 Ceklist Harian Diperbarui' END
    || ' · ' || COALESCE(NULLIF(btrim(v_outlet), ''), 'Outlet');
  isi := regexp_replace(public.ceklist_harian_isi_push_rm(p_ceklist_id, v_baru), E'\\n[^\\n]*menyetujui\\.$', '')
    || E'\nKetuk untuk meninjau & menyetujui di web HR.';
  url := 'https://hr.sukashawarma.com/ceklist-harian?tanggal=' || v_c.tanggal || '&outlet=' || v_c.outlet_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ceklist_harian_isi_push_hr(UUID) FROM PUBLIC, anon, authenticated;
