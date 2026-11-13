-- Wizard Pembukaan Outlet — RPC (Task 4).
-- Semua SECURITY DEFINER + penjaga role di dalam (pembukaan_outlet_cek_peran).
-- Spec: docs/superpowers/specs/2026-11-13-wizard-pembukaan-outlet-design.md

CREATE OR REPLACE FUNCTION public._pembukaan_outlet_log(
  p_outlet_id uuid, p_nama text, p_aksi text, p_alasan text, p_detail jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.outlet_pembukaan_log (outlet_id, nama_outlet, aksi, alasan, detail, pelaku, pelaku_nama)
  VALUES (p_outlet_id, p_nama, p_aksi, p_alasan, p_detail, auth.uid(),
          (SELECT name FROM public.outlet_staff WHERE id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public._pembukaan_outlet_log(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tautkan_akun_mitra_outlet(
  p_outlet_id uuid, p_user_id uuid, p_nama_mitra text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);
  IF NOT EXISTS (SELECT 1 FROM public.outlets WHERE id = p_outlet_id AND type = 'mitra') THEN
    RAISE EXCEPTION 'Akun mitra hanya untuk outlet berjenis Mitra';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outlet_staff WHERE id = p_user_id AND role = 'mitra') THEN
    RAISE EXCEPTION 'Akun yang dipilih bukan akun mitra';
  END IF;

  INSERT INTO public.mitra_profiles (user_id, nama_mitra, outlet_ids)
  VALUES (p_user_id, btrim(p_nama_mitra), ARRAY[p_outlet_id])
  ON CONFLICT (user_id) DO UPDATE
    SET outlet_ids = CASE WHEN p_outlet_id = ANY (public.mitra_profiles.outlet_ids)
                          THEN public.mitra_profiles.outlet_ids
                          ELSE array_append(public.mitra_profiles.outlet_ids, p_outlet_id) END,
        updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simpan_masa_rab_outlet(
  p_outlet_id uuid, p_berlaku_sampai date, p_kategori_kecuali text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mulai date;
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);
  SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date INTO v_mulai
  FROM public.outlets WHERE id = p_outlet_id AND type = 'mitra';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Masa RAB hanya untuk outlet berjenis Mitra';
  END IF;
  IF p_berlaku_sampai IS NULL OR p_berlaku_sampai < v_mulai THEN
    RAISE EXCEPTION 'Tanggal akhir masa RAB tidak boleh sebelum outlet dibuat';
  END IF;

  DELETE FROM public.rab_outlet_otomatis WHERE outlet_id = p_outlet_id;
  INSERT INTO public.rab_outlet_otomatis (outlet_id, berlaku_mulai, berlaku_sampai, kategori_kecuali, catatan)
  VALUES (p_outlet_id, v_mulai, p_berlaku_sampai, coalesce(p_kategori_kecuali, '{}'),
          'Wizard Pembukaan Outlet');
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simpan_tanggal_grand_opening(p_outlet_id uuid, p_tanggal date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);
  IF p_tanggal IS NULL OR p_tanggal < (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
    RAISE EXCEPTION 'Tanggal grand opening tidak boleh sebelum hari ini';
  END IF;
  UPDATE public.outlets SET tanggal_grand_opening = p_tanggal, updated_at = now()
  WHERE id = p_outlet_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak berstatus Persiapan';
  END IF;
  -- Nilai sementara; Go-Live yang menetapkan tanggal mulai final.
  UPDATE public.mitra_investments SET tanggal_mulai = p_tanggal, updated_at = now()
  WHERE outlet_id = p_outlet_id;
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buat_outlet_persiapan(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       uuid;
  v_jenis    text := p->>'jenis';
  v_nama     text := btrim(coalesce(p->>'nama', ''));
  v_am       uuid := nullif(p->>'am_staff_id', '')::uuid;
  v_leader   uuid := nullif(p->>'leader_staff_id', '')::uuid;
  v_go       date := nullif(p->>'tanggal_grand_opening', '')::date;
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_mitra    jsonb := p->'mitra';
  v_rab      jsonb := p->'rab';
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);

  IF v_jenis NOT IN ('internal', 'mitra') OR v_jenis IS NULL THEN
    RAISE EXCEPTION 'Jenis outlet harus Internal atau Mitra';
  END IF;
  IF v_nama = '' THEN
    RAISE EXCEPTION 'Nama outlet wajib diisi';
  END IF;
  IF v_am IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.outlet_staff WHERE id = v_am AND role = 'area_manager' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'AM wajib dipilih dari staf Area Manager yang aktif';
  END IF;
  IF v_leader IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff WHERE id = v_leader AND role = 'leader' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Leader yang dipilih bukan staf Leader yang aktif';
  END IF;
  IF v_go IS NOT NULL AND v_go < v_hari_ini THEN
    RAISE EXCEPTION 'Tanggal grand opening tidak boleh sebelum hari ini';
  END IF;
  IF v_jenis = 'internal' AND (jsonb_typeof(v_mitra) = 'object' OR jsonb_typeof(v_rab) = 'object') THEN
    RAISE EXCEPTION 'Data mitra dan masa RAB hanya untuk outlet berjenis Mitra';
  END IF;
  IF v_jenis = 'mitra' AND jsonb_typeof(v_mitra) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Data investasi mitra wajib diisi untuk outlet Mitra';
  END IF;

  INSERT INTO public.outlets (name, type, status, address, lat, lng, phone, region,
                              open_hour, close_hour, tanggal_grand_opening)
  VALUES (v_nama, v_jenis, 'pending',
          nullif(btrim(coalesce(p->>'alamat', '')), ''),
          nullif(p->>'lat', '')::numeric, nullif(p->>'lng', '')::numeric,
          nullif(btrim(coalesce(p->>'telepon', '')), ''),
          nullif(btrim(coalesce(p->>'region', '')), ''),
          coalesce(nullif(p->>'jam_buka', '')::time, '14:00'),
          coalesce(nullif(p->>'jam_tutup', '')::time, '22:00'),
          v_go)
  RETURNING id INTO v_id;

  INSERT INTO public.staff_outlets (staff_id, outlet_id) VALUES (v_am, v_id) ON CONFLICT DO NOTHING;
  IF v_leader IS NOT NULL THEN
    INSERT INTO public.staff_outlets (staff_id, outlet_id) VALUES (v_leader, v_id) ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.am_outlet_assignments (staff_id, outlet_id, effective_from, reason, created_by)
  VALUES (v_am, v_id, v_hari_ini, 'Pembukaan outlet', auth.uid());

  IF v_jenis = 'mitra' THEN
    INSERT INTO public.mitra_investments (outlet_id, nilai_investasi, tanggal_mulai,
                                          persentase_bagi_hasil, management_fee, is_profit_sharing_active)
    VALUES (v_id,
            coalesce((v_mitra->>'nilai_investasi')::numeric, 0),
            coalesce(v_go, v_hari_ini),
            coalesce((v_mitra->>'persentase_bagi_hasil')::int, 100),
            coalesce((v_mitra->>'management_fee')::numeric, 3),
            true);
    IF nullif(v_mitra->>'mitra_user_id', '') IS NOT NULL THEN
      PERFORM public.tautkan_akun_mitra_outlet(v_id, (v_mitra->>'mitra_user_id')::uuid,
                                               coalesce(v_mitra->>'nama_mitra', v_nama));
    END IF;
    IF jsonb_typeof(v_rab) = 'object' THEN
      PERFORM public.simpan_masa_rab_outlet(
        v_id, (v_rab->>'berlaku_sampai')::date,
        ARRAY(SELECT jsonb_array_elements_text(coalesce(v_rab->'kategori_kecuali', '[]'::jsonb))));
    END IF;
  END IF;

  PERFORM public._pembukaan_outlet_log(v_id, v_nama, 'dibuat', NULL,
    jsonb_build_object('jenis', v_jenis, 'tanggal_grand_opening', v_go));
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.go_live_outlet(
  p_outlet_id uuid, p_konfirmasi_nama text, p_tanggal date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_status   jsonb;
  v_kurang   text;
  v_seed     int;
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);

  SELECT * INTO o FROM public.outlets WHERE id = p_outlet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan';
  END IF;
  IF o.status <> 'pending' THEN
    RAISE EXCEPTION 'Outlet sudah tidak berstatus Persiapan';
  END IF;
  IF lower(btrim(coalesce(p_konfirmasi_nama, ''))) <> lower(btrim(o.name)) THEN
    RAISE EXCEPTION 'Nama konfirmasi tidak cocok dengan nama outlet';
  END IF;
  IF p_tanggal IS NULL OR abs(p_tanggal - v_hari_ini) > 7 THEN
    RAISE EXCEPTION 'Tanggal Go-Live harus dalam 7 hari dari hari ini';
  END IF;

  v_status := public.status_persiapan_outlet(p_outlet_id);
  IF NOT (v_status->>'siap_go_live')::boolean THEN
    SELECT string_agg(e->>'label', ', ') INTO v_kurang
    FROM jsonb_array_elements(v_status->'langkah') e
    WHERE (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean;
    RAISE EXCEPTION 'Langkah wajib belum selesai: %', v_kurang;
  END IF;

  -- Baris stok nol untuk bahan yang belum punya baris, SEBELUM outlet aktif:
  -- trigger alert stok kritis melewati outlet nonaktif, dan GUC app.ganti_satuan
  -- di sini dipakai sebagai saklar "tanpa efek samping" (bukan karena ganti satuan)
  -- untuk trigger yang memeriksanya di klausa WHEN.
  PERFORM set_config('app.ganti_satuan', 'on', true);
  INSERT INTO public.stok_balance (outlet_id, bahan_baku_id, saldo)
  SELECT p_outlet_id, b.id, 0
  FROM public.bahan_baku b
  WHERE b.is_active AND b.peruntukan IN ('outlet', 'keduanya')
  ON CONFLICT (outlet_id, bahan_baku_id) DO NOTHING;
  GET DIAGNOSTICS v_seed = ROW_COUNT;
  PERFORM set_config('app.ganti_satuan', '', true);

  UPDATE public.outlets
  SET status = 'active', is_bom_enabled = true, go_live_at = now(), go_live_by = auth.uid(),
      tanggal_grand_opening = p_tanggal, updated_at = now()
  WHERE id = p_outlet_id;

  UPDATE public.mitra_investments SET tanggal_mulai = p_tanggal, updated_at = now()
  WHERE outlet_id = p_outlet_id;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'go_live', NULL,
    jsonb_build_object('tanggal', p_tanggal, 'stok_balance_dibuat', v_seed));

  RETURN jsonb_build_object('outlet_id', p_outlet_id, 'stok_balance_dibuat', v_seed);
END;
$$;

-- ---------------------------------------------------------------------------
-- Tabel konfigurasi buatan wizard/persiapan: boleh ikut terhapus. Tabel lain yang
-- merujuk outlet dianggap DATA — satu baris saja membuat outlet dinonaktifkan,
-- bukan dihapus (DELETE outlets meng-CASCADE orders, ledger_stok, surat_jalan, dll).
CREATE OR REPLACE FUNCTION public.batalkan_pembukaan_outlet(p_outlet_id uuid, p_alasan text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o       public.outlets%ROWTYPE;
  r       record;
  n       bigint;
  v_sisa  jsonb := '[]'::jsonb;
  v_konfig text[] := ARRAY[
    'staff_outlets','am_outlet_assignments','am_outlet_rotations','area_manager_outlets',
    'mitra_investments','rab_outlet_otomatis','checklist_categories','outlet_order_counters',
    'outlet_attendance_config','attendance_outlet_access','daily_sales_targets','historical_daily_targets',
    'kiosk_settings','menu_outlet_prices','outlet_reorder_point','outlet_budget_config',
    'outlet_tutup_sementara','owner_message_outlets','bot_telegram_stock_drop_alert_state',
    'pos_outlet_map','online_outlet_map','platform_store_mapping','stok_balance'];
BEGIN
  PERFORM public.pembukaan_outlet_cek_peran(true);
  IF length(btrim(coalesce(p_alasan, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi (minimal 5 karakter)';
  END IF;

  SELECT * INTO o FROM public.outlets WHERE id = p_outlet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet tidak ditemukan';
  END IF;
  IF o.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya outlet berstatus Persiapan yang bisa dibatalkan';
  END IF;

  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS kolom,
           (SELECT relname FROM pg_class WHERE oid = c.conrelid) AS nama
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.outlets'::regclass
  LOOP
    CONTINUE WHEN r.nama = ANY (v_konfig);
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.kolom) INTO n USING p_outlet_id;
    IF n > 0 THEN
      v_sisa := v_sisa || jsonb_build_object('jenis', r.nama, 'jumlah', n);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_sisa) = 0 THEN
    UPDATE public.mitra_profiles SET outlet_ids = array_remove(outlet_ids, p_outlet_id), updated_at = now()
    WHERE p_outlet_id = ANY (outlet_ids);
    DELETE FROM public.outlets WHERE id = p_outlet_id;
    PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'dihapus', btrim(p_alasan), NULL);
    RETURN jsonb_build_object('aksi', 'dihapus', 'sisa', '[]'::jsonb);
  END IF;

  UPDATE public.outlets
  SET status = 'inactive', inactive_reason = 'Pembukaan dibatalkan: ' || btrim(p_alasan), updated_at = now()
  WHERE id = p_outlet_id;
  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'dinonaktifkan', btrim(p_alasan),
    jsonb_build_object('sisa', v_sisa));
  RETURN jsonb_build_object('aksi', 'dinonaktifkan', 'sisa', v_sisa);
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'tautkan_akun_mitra_outlet(uuid,uuid,text)',
    'simpan_masa_rab_outlet(uuid,date,text[])',
    'simpan_tanggal_grand_opening(uuid,date)',
    'buat_outlet_persiapan(jsonb)',
    'go_live_outlet(uuid,text,date)',
    'batalkan_pembukaan_outlet(uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
