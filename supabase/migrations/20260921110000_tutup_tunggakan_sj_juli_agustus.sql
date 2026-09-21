-- Menutup tunggakan surat jalan Juli-Agustus 2026 sebagai DOKUMEN saja (keputusan owner 2026-09-21).
-- Pola sama dengan 20260910181000: status 'selesai' + penanda ditutup_administratif_at, NOL baris ledger.
-- Stok tidak disentuh: Gudang Pusat sudah didebit saat SJ dikirim, dan sisi outlet sudah terserap opname.
-- Lingkup dijaga tiga lapis: dibuat sebelum 1 Sep 2026 WIB + status 'dikirim' + penanda masih NULL (idempoten).
DO $$
DECLARE v_led_sebelum bigint; v_led_sesudah bigint; v_n int;
BEGIN
  SELECT count(*) INTO v_led_sebelum FROM public.ledger_stok;

  UPDATE public.surat_jalan
     SET status = 'selesai',
         ditutup_administratif_at = now(),
         notes = COALESCE(NULLIF(notes, ''), '')
                 || '[Ditutup administratif 2026-09-21: tunggakan Juli-Agustus, nol baris ledger ditulis]',
         updated_at = now()
   WHERE status = 'dikirim'
     AND ditutup_administratif_at IS NULL
     AND created_at < TIMESTAMPTZ '2026-09-01 00:00:00+07';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  SELECT count(*) INTO v_led_sesudah FROM public.ledger_stok;
  IF v_led_sesudah <> v_led_sebelum THEN
    RAISE EXCEPTION 'Ledger berubah (% -> %), batal', v_led_sebelum, v_led_sesudah;
  END IF;
  RAISE NOTICE 'SJ ditutup: %', v_n;
END $$;

-- DOWN:
-- UPDATE public.surat_jalan SET status='dikirim', ditutup_administratif_at=NULL
--  WHERE ditutup_administratif_at::date = DATE '2026-09-21' AND created_at < TIMESTAMPTZ '2026-09-01 00:00:00+07';
