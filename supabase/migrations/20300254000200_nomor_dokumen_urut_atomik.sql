-- =============================================================================
-- Penomoran dokumen harian yang atomik (SJ & retur)
-- =============================================================================
-- Masalah:
--   * generate_surat_jalan_number: MAX(urutan hari ini) + 1 tanpa kunci. Dua SJ
--     yang dibuat bersamaan (web + native, persetujuan permintaan + SJ pengganti
--     retur) mendapat nomor sama -> 23505 di surat_jalan_document_number_key.
--     Tanggalnya juga ikut zona waktu sesi, bukan WIB.
--   * ajukan_retur_stok: COUNT(retur hari ini) + 1. Selain balapan yang sama,
--     begitu satu retur hari itu terhapus, COUNT+1 menunjuk nomor yang sudah ada
--     dan SEMUA pengajuan berikutnya hari itu gagal.
--
-- Solusi: satu tabel penghitung per (lingkup, tanggal) yang dinaikkan dengan
-- satu pernyataan INSERT ... ON CONFLICT DO UPDATE ... RETURNING. Atomik, tanpa
-- scan tabel dokumen, dan hanya mengunci SATU baris penghitung milik lingkup &
-- hari itu (tidak menghambat lingkup lain). Lingkup baru (PO, mutasi, dst.)
-- tinggal memakai fungsi yang sama.
--
-- Catatan: nomor yang sudah diambil lalu transaksinya gagal akan "terlewat"
-- (celah). Itu sifat wajar penghitung atomik dan aman: yang dijamin adalah unik,
-- bukan rapat tanpa celah.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.nomor_dokumen_urut (
  lingkup    text        NOT NULL,
  tanggal    date        NOT NULL,
  terakhir   integer     NOT NULL CHECK (terakhir >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lingkup, tanggal)
);

COMMENT ON TABLE public.nomor_dokumen_urut IS
  'Penghitung nomor dokumen harian per lingkup (SJ/KITCHEN, RET, ...). Hanya diakses lewat nomor_urut_berikut().';

-- Hanya fungsi SECURITY DEFINER yang menyentuh tabel ini: RLS nyala tanpa policy.
ALTER TABLE public.nomor_dokumen_urut ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nomor_dokumen_urut FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nomor_urut_berikut(p_lingkup text, p_tanggal date)
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  INSERT INTO public.nomor_dokumen_urut AS n (lingkup, tanggal, terakhir)
  VALUES (p_lingkup, p_tanggal, 1)
  ON CONFLICT (lingkup, tanggal)
  DO UPDATE SET terakhir = n.terakhir + 1, updated_at = now()
  RETURNING n.terakhir;
$function$;

-- Hanya untuk dipanggil fungsi DB lain; klien tidak boleh "membakar" nomor.
REVOKE ALL ON FUNCTION public.nomor_urut_berikut(text, date) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Benih: lanjutkan dari nomor tertinggi yang sudah terbit (kemarin & hari ini WIB),
-- supaya hari penerapan tidak mengulang nomor yang sudah ada. Idempoten.
-- -----------------------------------------------------------------------------
INSERT INTO public.nomor_dokumen_urut AS n (lingkup, tanggal, terakhir)
SELECT 'SJ/KITCHEN',
       to_date(split_part(sj.document_number, '/', 3), 'YYYYMMDD'),
       max(split_part(sj.document_number, '/', 4)::integer)
  FROM public.surat_jalan sj
 WHERE sj.document_number ~ '^SJ/KITCHEN/[0-9]{8}/[0-9]+$'
   AND to_date(split_part(sj.document_number, '/', 3), 'YYYYMMDD')
       >= (now() AT TIME ZONE 'Asia/Jakarta')::date - 1
 GROUP BY 2
ON CONFLICT (lingkup, tanggal)
DO UPDATE SET terakhir = GREATEST(n.terakhir, EXCLUDED.terakhir), updated_at = now();

INSERT INTO public.nomor_dokumen_urut AS n (lingkup, tanggal, terakhir)
SELECT 'RET',
       to_date(substr(r.nomor_retur, 5, 8), 'YYYYMMDD'),
       max(split_part(r.nomor_retur, '-', 3)::integer)
  FROM public.retur_stok r
 WHERE r.nomor_retur ~ '^RET-[0-9]{8}-[0-9]+$'
   AND to_date(substr(r.nomor_retur, 5, 8), 'YYYYMMDD')
       >= (now() AT TIME ZONE 'Asia/Jakarta')::date - 1
 GROUP BY 2
ON CONFLICT (lingkup, tanggal)
DO UPDATE SET terakhir = GREATEST(n.terakhir, EXCLUDED.terakhir), updated_at = now();

-- -----------------------------------------------------------------------------
-- Nomor SJ: SJ/KITCHEN/YYYYMMDD/NNNN (format tetap), tanggal kini tegas WIB.
-- Lebar urutan minimal 4 digit dan tumbuh bila lewat 9999 (lpad lama memotong).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_surat_jalan_number(p_outlet_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tanggal date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_seq     integer;
BEGIN
  -- p_outlet_id dipertahankan demi kompatibilitas tanda tangan; kode lokasi
  -- memang selalu KITCHEN (migration 20260610000900).
  v_seq := public.nomor_urut_berikut('SJ/KITCHEN', v_tanggal);
  RETURN 'SJ/KITCHEN/' || to_char(v_tanggal, 'YYYYMMDD') || '/'
         || lpad(v_seq::text, GREATEST(4, length(v_seq::text)), '0');
END;
$function$;

-- Klien tidak pernah memanggil ini langsung (dicek web & native); penggunanya
-- create_surat_jalan_with_number & verifikasi_kitchen_dan_buat_sj (DEFINER).
REVOKE ALL ON FUNCTION public.generate_surat_jalan_number(uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Nomor retur: RET-YYYYMMDD-NNNN dari penghitung, bukan COUNT.
-- Isi selebihnya identik dengan versi live.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ajukan_retur_stok(p_outlet_id uuid, p_tipe_retur text, p_items jsonb, p_catatan text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_retur_id UUID;
  v_nomor_retur TEXT;
  v_tanggal DATE;
  v_seq INT;
  v_item JSONB;
  v_bahan_id UUID;
  v_qty NUMERIC;
  v_foto_fisik TEXT;
  v_foto_timbangan TEXT;
  v_alasan TEXT;
  v_item_catatan TEXT;
  v_is_refundable BOOLEAN;
  v_scaled_qty NUMERIC;
BEGIN
  -- Validasi akses outlet
  IF NOT (p_outlet_id IN (SELECT public.accessible_outlet_ids())) THEN
    RAISE EXCEPTION 'Akses ditolak untuk outlet ini' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Generate nomor retur: RET-YYYYMMDD-XXXX (penghitung atomik per hari WIB)
  v_tanggal := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
  v_seq := public.nomor_urut_berikut('RET', v_tanggal);
  v_nomor_retur := 'RET-' || TO_CHAR(v_tanggal, 'YYYYMMDD') || '-'
                   || LPAD(v_seq::TEXT, GREATEST(4, LENGTH(v_seq::TEXT)), '0');

  -- Insert header retur_stok
  INSERT INTO public.retur_stok (
    nomor_retur,
    outlet_id,
    tipe_retur,
    status,
    catatan_outlet,
    catatan_kitchen,
    created_by
  ) VALUES (
    v_nomor_retur,
    p_outlet_id,
    COALESCE(p_tipe_retur, 'chiller_outlet'),
    'diajukan',
    p_catatan,
    p_catatan,
    auth.uid()
  ) RETURNING id INTO v_retur_id;

  -- Loop item klaim
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_bahan_id := (v_item->>'bahan_baku_id')::UUID;
    v_qty := (v_item->>'qty_klaim')::NUMERIC;
    v_foto_fisik := v_item->>'foto_fisik_url';
    v_foto_timbangan := v_item->>'foto_timbangan_url';
    v_alasan := v_item->>'alasan';
    v_item_catatan := v_item->>'catatan';

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Kuantitas retur harus lebih besar dari 0' USING ERRCODE = 'check_violation';
    END IF;

    -- Validasi is_refundable
    SELECT is_refundable INTO v_is_refundable
    FROM public.bahan_baku
    WHERE id = v_bahan_id;

    IF v_is_refundable IS NOT TRUE THEN
      RAISE EXCEPTION 'Bahan baku ini tidak memenuhi syarat untuk diretur/refund' USING ERRCODE = 'check_violation';
    END IF;

    -- Insert ke retur_stok_item
    INSERT INTO public.retur_stok_item (
      retur_stok_id,
      bahan_baku_id,
      qty_klaim,
      foto_fisik_url,
      foto_timbangan_url,
      alasan,
      catatan
    ) VALUES (
      v_retur_id,
      v_bahan_id,
      v_qty,
      v_foto_fisik,
      v_foto_timbangan,
      v_alasan,
      v_item_catatan
    );

    -- Potong saldo outlet jika retur berasal dari chiller (pasca-terima)
    IF p_tipe_retur = 'chiller_outlet' THEN
      v_scaled_qty := public.to_ledger_scale(p_outlet_id, v_bahan_id, v_qty);

      INSERT INTO public.ledger_stok (
        outlet_id,
        bahan_baku_id,
        tipe,
        qty,
        catatan,
        ref_retur_id,
        created_by
      ) VALUES (
        p_outlet_id,
        v_bahan_id,
        'retur_ke_pusat',
        -v_scaled_qty,
        'Pengajuan retur ' || v_nomor_retur || ': ' || COALESCE(v_alasan, ''),
        v_retur_id,
        auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'retur_id', v_retur_id,
    'nomor_retur', v_nomor_retur
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ajukan_retur_stok(uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajukan_retur_stok(uuid, text, jsonb, text) TO authenticated, service_role;
