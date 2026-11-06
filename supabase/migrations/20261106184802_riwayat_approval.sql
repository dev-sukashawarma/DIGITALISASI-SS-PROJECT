-- Riwayat keputusan Hub Approval finance.
--
-- Satu baris per keputusan admin finance: petty cash (acc / tolak / serah ke AM),
-- approval PO (setuju / tolak), bayar vendor (setuju / tolak), dana kantor
-- (verifikasi / tolak). Terisi otomatis oleh trigger dari jalur mana pun,
-- kecuali dana kantor yang ditulis server action (jalurnya memakai service role,
-- jadi trigger tidak tahu pelakunya).
--
-- Trigger SENGAJA tahan galat: kalau pencatatan gagal, keputusannya tetap jalan
-- (RAISE WARNING, bukan EXCEPTION). Riwayat tidak boleh memblokir alur uang.
--
-- Data lama diisi sebisanya (dari_data_lama = true). Keputusan lama yang tidak
-- menyimpan jam tercatat dengan waktu NULL ("jam tidak tercatat").

CREATE TABLE IF NOT EXISTS public.approval_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis          text NOT NULL CHECK (jenis IN ('petty_cash', 'po', 'bayar_vendor', 'dana_kantor')),
  keputusan      text NOT NULL CHECK (keputusan IN ('setuju', 'tolak', 'serah_am')),
  sumber_id      uuid NOT NULL,
  judul          text,
  keterangan     text,
  nominal        numeric,
  alasan         text,
  pelaku         uuid REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  waktu          timestamptz,
  waktu_urut     timestamptz NOT NULL DEFAULT now(),
  dari_data_lama boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.approval_log IS
  'Riwayat keputusan Hub Approval finance. waktu NULL = jam tidak tercatat (data lama). Ditulis trigger/server action, tidak oleh klien.';

CREATE INDEX IF NOT EXISTS approval_log_waktu_urut_idx ON public.approval_log (waktu_urut DESC);
CREATE INDEX IF NOT EXISTS approval_log_sumber_idx ON public.approval_log (jenis, sumber_id);
-- Satu keputusan per sumber per jenis keputusan (isi awal idempoten, trigger tak dobel).
CREATE UNIQUE INDEX IF NOT EXISTS approval_log_unik_idx ON public.approval_log (jenis, keputusan, sumber_id);

ALTER TABLE public.approval_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approval_log FROM anon, authenticated;
GRANT SELECT ON public.approval_log TO authenticated;

DROP POLICY IF EXISTS approval_log_baca ON public.approval_log;
CREATE POLICY approval_log_baca ON public.approval_log
  FOR SELECT TO authenticated
  USING (
    public.kas_pencatat_ok()
    OR EXISTS (SELECT 1 FROM public.outlet_staff
                WHERE id = auth.uid() AND status = 'active' AND role = 'developer')
  );

-- Ambil teks di dalam penanda, mis. '[Ditolak Finance: stok habis]' -> 'stok habis'.
CREATE OR REPLACE FUNCTION public.approval_log_ambil_alasan(p_teks text, p_penanda text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(btrim((regexp_match(coalesce(p_teks, ''),
           '\[' || p_penanda || '\s*([^\]]*)\]'))[1]), '')
$$;

-- ── Petty cash ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_approval_log_petty_cash()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_keputusan text; v_pelaku uuid; v_outlet text;
BEGIN
  BEGIN
    IF OLD.status = 'forwarded_to_finance' AND NEW.status = 'approved_by_finance' THEN
      v_keputusan := 'setuju'; v_pelaku := coalesce(auth.uid(), NEW.finance_approved_by);
    ELSIF OLD.status = 'forwarded_to_finance' AND NEW.status = 'rejected' THEN
      v_keputusan := 'tolak'; v_pelaku := coalesce(auth.uid(), NEW.finance_approved_by);
    ELSIF OLD.status = 'approved_by_finance' AND NEW.status = 'forwarded_by_finance' THEN
      v_keputusan := 'serah_am'; v_pelaku := coalesce(auth.uid(), NEW.finance_forwarded_by);
    ELSE
      RETURN NEW;
    END IF;

    SELECT name INTO v_outlet FROM outlets WHERE id = NEW.outlet_id;
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut)
    VALUES ('petty_cash', v_keputusan, NEW.id, v_outlet, left(NEW.description, 200), NEW.amount,
            CASE WHEN v_keputusan = 'tolak' THEN approval_log_ambil_alasan(NEW.description, 'Ditolak Finance:') END,
            v_pelaku, now(), now())
    ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log petty_cash gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_approval_log_petty_cash ON public.petty_cash_topups;
CREATE TRIGGER trg_approval_log_petty_cash
  AFTER UPDATE OF status ON public.petty_cash_topups
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_approval_log_petty_cash();

-- ── Approval PO ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_approval_log_po()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_keputusan text; v_total numeric;
BEGIN
  BEGIN
    IF OLD.status <> 'menunggu_approval_finance' THEN RETURN NEW; END IF;
    IF NEW.status = 'dikirim_ke_supplier' THEN v_keputusan := 'setuju';
    ELSIF NEW.status = 'draft' THEN v_keputusan := 'tolak';
    ELSE RETURN NEW;
    END IF;

    SELECT coalesce(sum(subtotal), 0) INTO v_total FROM purchase_order_item WHERE purchase_order_id = NEW.id;
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut)
    VALUES ('po', v_keputusan, NEW.id, NEW.supplier_nama, NEW.nomor_po, v_total,
            CASE WHEN v_keputusan = 'tolak' THEN
              nullif(btrim(substring(coalesce(NEW.catatan, '') from '.*\[Ditolak finance\]\s*(.*)$')), '') END,
            coalesce(auth.uid(), NEW.disetujui_finance_oleh), now(), now())
    -- PO yang ditolak lalu diajukan & ditolak lagi: simpan keputusan terbaru.
    ON CONFLICT (jenis, keputusan, sumber_id) DO UPDATE
      SET nominal = EXCLUDED.nominal, alasan = EXCLUDED.alasan, pelaku = EXCLUDED.pelaku,
          waktu = EXCLUDED.waktu, waktu_urut = EXCLUDED.waktu_urut, dari_data_lama = false;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log po gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_approval_log_po ON public.purchase_order;
CREATE TRIGGER trg_approval_log_po
  AFTER UPDATE OF status ON public.purchase_order
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_approval_log_po();

-- ── Bayar vendor (transaksi kas supplier_po) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_approval_log_bayar_vendor()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_keputusan text; v_po record;
BEGIN
  BEGIN
    IF NEW.source_type IS DISTINCT FROM 'supplier_po' OR OLD.status <> 'pending_approval' THEN RETURN NEW; END IF;
    IF NEW.status = 'paid' THEN v_keputusan := 'setuju';
    ELSIF NEW.status = 'rejected' THEN v_keputusan := 'tolak';
    ELSE RETURN NEW;
    END IF;

    SELECT nomor_po, supplier_nama INTO v_po FROM purchase_order WHERE id = NEW.source_id;
    INSERT INTO approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut)
    VALUES ('bayar_vendor', v_keputusan, NEW.source_id, v_po.supplier_nama, v_po.nomor_po, NEW.amount,
            CASE WHEN v_keputusan = 'tolak' THEN approval_log_ambil_alasan(NEW.note, 'Ditolak:') END,
            coalesce(auth.uid(), NEW.approved_by), now(), now())
    -- Pembayaran yang ditolak lalu diajukan lagi: simpan keputusan terbaru.
    ON CONFLICT (jenis, keputusan, sumber_id) DO UPDATE
      SET nominal = EXCLUDED.nominal, alasan = EXCLUDED.alasan, pelaku = EXCLUDED.pelaku,
          waktu = EXCLUDED.waktu, waktu_urut = EXCLUDED.waktu_urut, dari_data_lama = false;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_log bayar_vendor gagal dicatat (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_approval_log_bayar_vendor ON public.cash_transaction;
CREATE TRIGGER trg_approval_log_bayar_vendor
  AFTER UPDATE OF status ON public.cash_transaction
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.source_type = 'supplier_po')
  EXECUTE FUNCTION public.trg_approval_log_bayar_vendor();

REVOKE ALL ON FUNCTION public.trg_approval_log_petty_cash() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_approval_log_po() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_approval_log_bayar_vendor() FROM PUBLIC, anon, authenticated;

-- ── Isi awal dari data lama (idempoten) ──────────────────────────────────────
-- PO yang pernah disetujui finance: siapa & kapan tercatat.
INSERT INTO public.approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, pelaku, waktu, waktu_urut, dari_data_lama)
SELECT 'po', 'setuju', po.id, po.supplier_nama, po.nomor_po,
       (SELECT coalesce(sum(i.subtotal), 0) FROM public.purchase_order_item i WHERE i.purchase_order_id = po.id),
       s.id, po.disetujui_finance_at, po.disetujui_finance_at, true
  FROM public.purchase_order po
  LEFT JOIN public.outlet_staff s ON s.id = po.disetujui_finance_oleh
 WHERE po.disetujui_finance_at IS NOT NULL
ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;

-- Petty cash yang pernah di-acc finance: jam acc tidak tercatat.
INSERT INTO public.approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, pelaku, waktu, waktu_urut, dari_data_lama)
SELECT 'petty_cash', 'setuju', t.id, o.name, left(t.description, 200), t.amount,
       s.id, NULL, coalesce(t.finance_forwarded_at, t.created_at), true
  FROM public.petty_cash_topups t
  LEFT JOIN public.outlets o ON o.id = t.outlet_id
  LEFT JOIN public.outlet_staff s ON s.id = t.finance_approved_by
 WHERE t.finance_approved_by IS NOT NULL
   AND t.status IN ('approved_by_finance', 'forwarded_by_finance', 'forwarded_by_area_manager',
                    'forwarded_by_leader', 'completed')
ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;

-- Petty cash yang ditolak finance (yang tercatat pelakunya): jam tidak tercatat.
INSERT INTO public.approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut, dari_data_lama)
SELECT 'petty_cash', 'tolak', t.id, o.name, left(t.description, 200), t.amount,
       public.approval_log_ambil_alasan(t.description, 'Ditolak Finance:'),
       s.id, NULL, t.created_at, true
  FROM public.petty_cash_topups t
  LEFT JOIN public.outlets o ON o.id = t.outlet_id
  LEFT JOIN public.outlet_staff s ON s.id = t.finance_approved_by
 WHERE t.status = 'rejected' AND t.finance_approved_by IS NOT NULL
ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;

-- Petty cash yang diserahkan finance ke AM: siapa & kapan tercatat.
INSERT INTO public.approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, pelaku, waktu, waktu_urut, dari_data_lama)
SELECT 'petty_cash', 'serah_am', t.id, o.name, left(t.description, 200), t.amount,
       s.id, t.finance_forwarded_at, t.finance_forwarded_at, true
  FROM public.petty_cash_topups t
  LEFT JOIN public.outlets o ON o.id = t.outlet_id
  LEFT JOIN public.outlet_staff s ON s.id = t.finance_forwarded_by
 WHERE t.finance_forwarded_at IS NOT NULL
ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;

-- Bayar vendor yang sudah diputuskan.
INSERT INTO public.approval_log (jenis, keputusan, sumber_id, judul, keterangan, nominal, alasan, pelaku, waktu, waktu_urut, dari_data_lama)
SELECT 'bayar_vendor', CASE ct.status WHEN 'paid' THEN 'setuju' ELSE 'tolak' END, ct.source_id,
       po.supplier_nama, po.nomor_po, ct.amount,
       CASE WHEN ct.status = 'rejected' THEN public.approval_log_ambil_alasan(ct.note, 'Ditolak:') END,
       s.id, ct.approved_at, coalesce(ct.approved_at, ct.created_at), true
  FROM public.cash_transaction ct
  LEFT JOIN public.purchase_order po ON po.id = ct.source_id
  LEFT JOIN public.outlet_staff s ON s.id = ct.approved_by
 WHERE ct.source_type = 'supplier_po' AND ct.status IN ('paid', 'rejected') AND ct.source_id IS NOT NULL
ON CONFLICT (jenis, keputusan, sumber_id) DO NOTHING;
