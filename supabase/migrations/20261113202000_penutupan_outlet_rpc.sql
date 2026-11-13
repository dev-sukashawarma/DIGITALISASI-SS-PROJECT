-- Wizard Penutupan Outlet — RPC tulis (Task 3). Spec §4, §6.
-- Semua SECURITY DEFINER + penjaga role di dalam (penutupan_outlet_cek_peran),
-- dipanggil server action dengan klien SESI (auth.uid() wajib terisi).
-- Perubahan status outlet memakai GUC app.penutupan_outlet supaya lolos
-- penjaga trg_zz_outlets_jaga_penutupan (20261113200000).

-- Validasi bersama: tanggal terakhir jualan (WIB) & alasan.
CREATE OR REPLACE FUNCTION public._penutupan_cek_tanggal_alasan(
  o public.outlets, p_tanggal date, p_alasan text
) RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF length(btrim(coalesce(p_alasan, ''))) < 10 THEN
    RAISE EXCEPTION 'Alasan wajib diisi, minimal 10 karakter';
  END IF;
  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION 'Tanggal terakhir jualan wajib diisi';
  END IF;
  IF p_tanggal > (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
    RAISE EXCEPTION 'Tanggal terakhir jualan tidak boleh di masa depan';
  END IF;
  IF p_tanggal < (o.created_at AT TIME ZONE 'Asia/Jakarta')::date THEN
    RAISE EXCEPTION 'Tanggal terakhir jualan tidak boleh sebelum outlet dibuat (%)',
      to_char(o.created_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._penutupan_cek_tanggal_alasan(public.outlets, date, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._penutupan_ambil_outlet(p_outlet_id uuid)
RETURNS public.outlets
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  o public.outlets%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.outlets WHERE id = p_outlet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan' USING ERRCODE = 'no_data_found';
  END IF;
  IF o.type NOT IN ('internal','mitra') THEN
    RAISE EXCEPTION 'Penutupan hanya untuk outlet Internal atau Mitra';
  END IF;
  RETURN o;
END;
$$;
REVOKE ALL ON FUNCTION public._penutupan_ambil_outlet(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tutup_outlet(p_outlet_id uuid, p_tanggal_terakhir date, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o       public.outlets%ROWTYPE;
  v_promo int;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status = 'pending' THEN
    RAISE EXCEPTION 'Outlet masih Persiapan — pakai Batalkan pembukaan di menu Pembukaan Outlet';
  END IF;
  IF o.status = 'inactive' OR NOT o.is_active THEN
    RAISE EXCEPTION 'Outlet % sudah ditutup', o.name;
  END IF;
  PERFORM public._penutupan_cek_tanggal_alasan(o, p_tanggal_terakhir, p_alasan);

  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets
     SET status = 'inactive', is_active = false,
         nonaktif_at = (p_tanggal_terakhir + time '23:59:59') AT TIME ZONE 'Asia/Jakarta',
         alasan_tutup = btrim(p_alasan), ditutup_by = auth.uid(),
         app_enabled = false,
         penutupan_selesai_at = NULL, penutupan_selesai_by = NULL,
         updated_at = now()
   WHERE id = p_outlet_id;
  PERFORM set_config('app.penutupan_outlet', '', true);

  UPDATE public.outlet_promos SET is_active = false, updated_at = now()
   WHERE outlet_id = p_outlet_id AND is_active;
  GET DIAGNOSTICS v_promo = ROW_COUNT;

  UPDATE public.rab_outlet_otomatis SET berlaku_sampai = greatest(berlaku_mulai, p_tanggal_terakhir)
   WHERE outlet_id = p_outlet_id AND berlaku_sampai > p_tanggal_terakhir;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'ditutup', btrim(p_alasan),
    jsonb_build_object('tanggal_terakhir', p_tanggal_terakhir, 'promo_dimatikan', v_promo));
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buka_kembali_outlet(p_outlet_id uuid, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.outlets%ROWTYPE;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' THEN
    RAISE EXCEPTION 'Outlet % tidak sedang ditutup', o.name;
  END IF;
  IF length(btrim(coalesce(p_alasan, ''))) < 10 THEN
    RAISE EXCEPTION 'Alasan wajib diisi, minimal 10 karakter';
  END IF;

  -- app_enabled & promo sengaja TIDAK dinyalakan otomatis.
  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets
     SET status = 'active', is_active = true,
         alasan_tutup = NULL, ditutup_by = NULL,
         penutupan_selesai_at = NULL, penutupan_selesai_by = NULL,
         updated_at = now()
   WHERE id = p_outlet_id;
  PERFORM set_config('app.penutupan_outlet', '', true);

  DELETE FROM public.outlet_penutupan_centang WHERE outlet_id = p_outlet_id;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'dibuka_kembali', btrim(p_alasan),
    jsonb_build_object('nonaktif_at_sebelumnya', o.nonaktif_at, 'alasan_tutup_sebelumnya', o.alasan_tutup));
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koreksi_tanggal_tutup(p_outlet_id uuid, p_tanggal date, p_alasan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.outlets%ROWTYPE;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' THEN
    RAISE EXCEPTION 'Outlet % tidak sedang ditutup', o.name;
  END IF;
  PERFORM public._penutupan_cek_tanggal_alasan(o, p_tanggal, p_alasan);

  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets
     SET nonaktif_at = (p_tanggal + time '23:59:59') AT TIME ZONE 'Asia/Jakarta', updated_at = now()
   WHERE id = p_outlet_id;
  PERFORM set_config('app.penutupan_outlet', '', true);

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'tanggal_tutup_dikoreksi', btrim(p_alasan),
    jsonb_build_object('dari', to_char(o.nonaktif_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'), 'ke', p_tanggal));
END;
$$;

-- ---------------------------------------------------------------------------
-- Stok tidak pernah di-UPDATE langsung: ledger adjustment = -saldo, trigger
-- ledger_stamp_saldo yang mengurus stok_balance. Alert stok dimatikan lewat
-- GUC app.ganti_satuan (dihormati 5 trigger notifikasi stok_balance).
CREATE OR REPLACE FUNCTION public.nolkan_sisa_stok_outlet(p_outlet_id uuid, p_alasan text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o       public.outlets%ROWTYPE;
  v_nilai numeric;
  v_n     int;
  v_sisa  numeric;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' OR o.alasan_tutup IS NULL THEN
    RAISE EXCEPTION 'Sisa stok hanya bisa dinolkan untuk outlet yang sudah ditutup lewat Tutup Outlet';
  END IF;
  IF length(btrim(coalesce(p_alasan, ''))) < 10 THEN
    RAISE EXCEPTION 'Alasan wajib diisi, minimal 10 karakter';
  END IF;

  SELECT round(coalesce(sum(nilai), 0)) INTO v_nilai FROM public.nilai_persediaan_spv WHERE outlet_id = p_outlet_id;

  PERFORM set_config('app.ganti_satuan', 'on', true);
  INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan, created_by)
  SELECT b.outlet_id, b.bahan_baku_id, 'adjustment', -b.saldo,
         'Penutupan outlet: ' || btrim(p_alasan), auth.uid()
    FROM public.stok_balance b
   WHERE b.outlet_id = p_outlet_id AND b.saldo <> 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.ganti_satuan', '', true);

  IF v_n = 0 THEN
    RAISE EXCEPTION 'Tidak ada sisa stok untuk dinolkan';
  END IF;
  SELECT coalesce(sum(abs(saldo)), 0) INTO v_sisa FROM public.stok_balance WHERE outlet_id = p_outlet_id;
  IF v_sisa <> 0 THEN
    RAISE EXCEPTION 'Penolan stok gagal: sisa saldo % setelah dinolkan', v_sisa;
  END IF;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'stok_dinolkan', btrim(p_alasan),
    jsonb_build_object('jumlah_bahan', v_n, 'nilai', v_nilai));
  RETURN jsonb_build_object('jumlah_bahan', v_n, 'nilai', v_nilai);
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.centang_langkah_penutupan(
  p_outlet_id uuid, p_kunci text, p_catatan text, p_batal boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.outlets%ROWTYPE;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('centang');
  IF p_kunci NOT IN ('kanal_online','merchant_ojol','mitra','aset','biaya_rutin') THEN
    RAISE EXCEPTION 'Langkah % tidak bisa dicentang manual', p_kunci;
  END IF;
  SELECT * INTO o FROM public.outlets WHERE id = p_outlet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan' USING ERRCODE = 'no_data_found';
  END IF;
  IF o.status <> 'inactive' OR o.alasan_tutup IS NULL THEN
    RAISE EXCEPTION 'Outlet % tidak sedang dalam penutupan', o.name;
  END IF;

  IF p_batal THEN
    DELETE FROM public.outlet_penutupan_centang WHERE outlet_id = p_outlet_id AND kunci = p_kunci;
    PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'centang_dibatalkan', NULLIF(btrim(coalesce(p_catatan,'')),''),
      jsonb_build_object('kunci', p_kunci));
  ELSE
    INSERT INTO public.outlet_penutupan_centang (outlet_id, kunci, oleh, oleh_nama, catatan)
    VALUES (p_outlet_id, p_kunci, auth.uid(),
            (SELECT name FROM public.outlet_staff WHERE id = auth.uid()),
            NULLIF(btrim(coalesce(p_catatan,'')),''))
    ON CONFLICT (outlet_id, kunci) DO UPDATE
      SET oleh = EXCLUDED.oleh, oleh_nama = EXCLUDED.oleh_nama,
          catatan = EXCLUDED.catatan, dibuat_at = now();
    PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'centang', NULLIF(btrim(coalesce(p_catatan,'')),''),
      jsonb_build_object('kunci', p_kunci));
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tandai_penutupan_selesai(p_outlet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o        public.outlets%ROWTYPE;
  v_status jsonb;
  v_kurang text;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' OR o.alasan_tutup IS NULL THEN
    RAISE EXCEPTION 'Outlet % tidak sedang dalam penutupan', o.name;
  END IF;
  IF o.penutupan_selesai_at IS NOT NULL THEN
    RAISE EXCEPTION 'Penutupan outlet % sudah ditandai selesai', o.name;
  END IF;

  v_status := public.status_penutupan_outlet(p_outlet_id);
  IF NOT (v_status->>'siap_selesai')::boolean THEN
    SELECT string_agg(e->>'label', '; ') INTO v_kurang
      FROM jsonb_array_elements(v_status->'langkah') e
     WHERE (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean;
    RAISE EXCEPTION 'Penutupan belum bisa ditandai selesai. Belum beres: %', v_kurang;
  END IF;

  UPDATE public.outlets
     SET penutupan_selesai_at = now(), penutupan_selesai_by = auth.uid(), updated_at = now()
   WHERE id = p_outlet_id;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'penutupan_selesai', NULL, NULL);
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.tutup_outlet(uuid, date, text)',
    'public.buka_kembali_outlet(uuid, text)',
    'public.koreksi_tanggal_tutup(uuid, date, text)',
    'public.nolkan_sisa_stok_outlet(uuid, text)',
    'public.centang_langkah_penutupan(uuid, text, text, boolean)',
    'public.tandai_penutupan_selesai(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
