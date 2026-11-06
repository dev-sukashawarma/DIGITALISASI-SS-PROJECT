-- Nama pelaku disimpan di riwayat (snapshot saat keputusan dicatat).
--
-- RLS outlet_staff membatasi baris yang boleh dibaca admin finance (diukur:
-- hanya 21 dari ~980 nama pelaku terbaca lewat join), sehingga kolom "oleh"
-- di Hub Approval hampir selalu kosong. Trigger BEFORE INSERT SECURITY DEFINER
-- mengisi nama dari outlet_staff untuk semua penulis (trigger & server action).

ALTER TABLE public.approval_log ADD COLUMN IF NOT EXISTS pelaku_nama text;

CREATE OR REPLACE FUNCTION public.trg_approval_log_isi_nama_pelaku()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pelaku IS NOT NULL AND NEW.pelaku_nama IS NULL THEN
    SELECT name INTO NEW.pelaku_nama FROM outlet_staff WHERE id = NEW.pelaku;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'approval_log nama pelaku gagal diisi: %', SQLERRM;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.trg_approval_log_isi_nama_pelaku() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_approval_log_isi_nama_pelaku ON public.approval_log;
CREATE TRIGGER trg_approval_log_isi_nama_pelaku
  BEFORE INSERT OR UPDATE OF pelaku ON public.approval_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_approval_log_isi_nama_pelaku();

UPDATE public.approval_log a
   SET pelaku_nama = s.name
  FROM public.outlet_staff s
 WHERE s.id = a.pelaku AND a.pelaku_nama IS NULL;
