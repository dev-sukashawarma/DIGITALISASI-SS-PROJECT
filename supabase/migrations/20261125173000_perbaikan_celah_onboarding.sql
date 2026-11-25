-- Perbaikan celah onboarding outlet (bug hunt 2026-11-25, keputusan owner hari yang sama).
-- 1. buka_kembali_outlet menolak outlet yang pembukaannya dibatalkan (belum pernah Go-Live).
-- 2. Order untuk outlet Persiapan ditolak di database (dulu hanya diblokir POS web).
-- 3. Ganti jenis Mitra → Internal tetap boleh (perubahan 16 Nov), tapi masa RAB dihapus
--    dan akses mitra ke outlet itu dicabut.
-- 4. Batalkan pembukaan outlet mitra: akun mitra tak lagi menahan penghapusan; profil &
--    akun mitra dibersihkan di kedua jalur (hapus / nonaktif).
-- Badan fungsi yang diubah = definisi live (pg_get_functiondef) + tambahan bertanda komentar.

-- ---------------------------------------------------------------------------
-- Penanda: outlet ini pembukaannya dibatalkan dan belum pernah Go-Live.
CREATE OR REPLACE FUNCTION public.pembukaan_outlet_dibatalkan(p_outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlets o
    WHERE o.id = p_outlet_id
      AND o.go_live_at IS NULL
      AND EXISTS (SELECT 1 FROM public.outlet_pembukaan_log l
                  WHERE l.outlet_id = o.id AND l.aksi = 'dinonaktifkan'));
$$;
REVOKE ALL ON FUNCTION public.pembukaan_outlet_dibatalkan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pembukaan_outlet_dibatalkan(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cabut akses mitra ke satu outlet: keluarkan dari mitra_profiles.outlet_ids; akun
-- mitra yang outlet utamanya (outlet_staff.outlet_id) di sini dipindah ke outlet lain
-- di profilnya, atau dinonaktifkan bila tidak punya outlet lain.
CREATE OR REPLACE FUNCTION public._lepas_akses_mitra_outlet(p_outlet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s      record;
  v_lain uuid;
BEGIN
  UPDATE public.mitra_profiles
     SET outlet_ids = array_remove(outlet_ids, p_outlet_id), updated_at = now()
   WHERE p_outlet_id = ANY (outlet_ids);

  FOR s IN
    SELECT id FROM public.outlet_staff WHERE outlet_id = p_outlet_id AND role = 'mitra'
  LOOP
    SELECT x INTO v_lain
    FROM public.mitra_profiles mp, unnest(mp.outlet_ids) WITH ORDINALITY AS u(x, n)
    WHERE mp.user_id = s.id AND x <> p_outlet_id
    ORDER BY n
    LIMIT 1;

    IF v_lain IS NOT NULL THEN
      UPDATE public.outlet_staff SET outlet_id = v_lain WHERE id = s.id;
    ELSE
      UPDATE public.outlet_staff SET outlet_id = NULL, status = 'inactive' WHERE id = s.id;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._lepas_akses_mitra_outlet(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buka_kembali_outlet(p_outlet_id uuid, p_alasan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.outlets%ROWTYPE; v_rab_asli date;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' THEN
    RAISE EXCEPTION 'Outlet % tidak sedang ditutup', o.name;
  END IF;
  -- Outlet yang pembukaannya dibatalkan belum pernah Go-Live: mengaktifkannya di sini
  -- melewati seluruh checklist, seed stok, dan tanggal mulai mitra (bug hunt 25 Nov).
  IF public.pembukaan_outlet_dibatalkan(p_outlet_id) THEN
    RAISE EXCEPTION 'Pembukaan outlet % dibatalkan dan belum pernah Go-Live, jadi tidak bisa dibuka kembali. Buat outlet baru lewat Tambah Outlet.', o.name;
  END IF;
  IF length(btrim(coalesce(p_alasan, ''))) < 10 THEN
    RAISE EXCEPTION 'Alasan wajib diisi, minimal 10 karakter';
  END IF;

  PERFORM set_config('app.penutupan_outlet', 'on', true);
  UPDATE public.outlets
     SET status = 'active', is_active = true,
         alasan_tutup = NULL, ditutup_by = NULL,
         penutupan_selesai_at = NULL, penutupan_selesai_by = NULL,
         updated_at = now()
   WHERE id = p_outlet_id;
  PERFORM set_config('app.penutupan_outlet', '', true);

  v_rab_asli := public._penutupan_rab_asli(p_outlet_id);
  IF v_rab_asli IS NOT NULL THEN
    UPDATE public.rab_outlet_otomatis SET berlaku_sampai = v_rab_asli WHERE outlet_id = p_outlet_id;
  END IF;

  DELETE FROM public.outlet_penutupan_centang WHERE outlet_id = p_outlet_id;

  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'dibuka_kembali', btrim(p_alasan),
    jsonb_build_object('nonaktif_at_sebelumnya', o.nonaktif_at, 'alasan_tutup_sebelumnya', o.alasan_tutup,
                       'rab_dipulihkan_ke', v_rab_asli, 'rab_sampai_asli', NULL));
END;
$function$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.batalkan_pembukaan_outlet(p_outlet_id uuid, p_alasan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Akun mitra yang outlet utamanya di sini dipindah/dinonaktifkan dulu supaya tidak
  -- dihitung sebagai "data" (dulu batal outlet mitra ber-akun baru tak pernah bisa dihapus)
  -- dan mitra tidak lagi melihat outlet yang dibatalkan.
  PERFORM public._lepas_akses_mitra_outlet(p_outlet_id);

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
    DELETE FROM public.outlets WHERE id = p_outlet_id;
    PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'dihapus', btrim(p_alasan), NULL);
    RETURN jsonb_build_object('aksi', 'dihapus', 'sisa', '[]'::jsonb);
  END IF;

  PERFORM set_config('app.pembukaan_outlet', 'on', true);
  UPDATE public.outlets
  SET status = 'inactive', inactive_reason = 'Pembukaan dibatalkan: ' || btrim(p_alasan), updated_at = now()
  WHERE id = p_outlet_id;
  PERFORM set_config('app.pembukaan_outlet', '', true);
  PERFORM public._pembukaan_outlet_log(p_outlet_id, o.name, 'dinonaktifkan', btrim(p_alasan),
    jsonb_build_object('sisa', v_sisa));
  RETURN jsonb_build_object('aksi', 'dinonaktifkan', 'sisa', v_sisa);
END;
$function$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_mitra_investment_on_outlet_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'mitra' THEN
    UPDATE public.mitra_investments
    SET is_profit_sharing_active = true,
        updated_at = now()
    WHERE outlet_id = NEW.id;

    IF NOT FOUND THEN
      INSERT INTO public.mitra_investments (
        outlet_id,
        nilai_investasi,
        tanggal_mulai,
        persentase_bagi_hasil,
        management_fee,
        is_profit_sharing_active
      )
      VALUES (
        NEW.id,
        0,
        coalesce(NEW.tanggal_grand_opening, (now() AT TIME ZONE 'Asia/Jakarta')::date),
        100,
        3,
        true
      );
    END IF;
  ELSE
    UPDATE public.mitra_investments
    SET is_profit_sharing_active = false,
        updated_at = now()
    WHERE outlet_id = NEW.id;

    -- Mitra → Internal (owner 25 Nov: izinkan + bersihkan): masa RAB tak berlaku untuk
    -- outlet internal, dan mitra tidak boleh lagi melihat outlet ini. Riwayat investasi
    -- tetap tersimpan (hanya dinonaktifkan di atas).
    IF OLD.type = 'mitra' THEN
      DELETE FROM public.rab_outlet_otomatis WHERE outlet_id = NEW.id;
      PERFORM public._lepas_akses_mitra_outlet(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Order untuk outlet Persiapan ditolak (POS web memblokir di browser; POS native,
-- impor, dan jalur API lain tidak boleh lolos).
CREATE OR REPLACE FUNCTION public.orders_tolak_outlet_persiapan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nama text;
BEGIN
  SELECT name INTO v_nama FROM public.outlets WHERE id = NEW.outlet_id AND status = 'pending';
  IF FOUND THEN
    RAISE EXCEPTION 'Outlet % belum dibuka (masih Persiapan): pesanan baru bisa dicatat setelah Go-Live', v_nama
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_00_tolak_outlet_persiapan ON public.orders;
CREATE TRIGGER trg_orders_00_tolak_outlet_persiapan
  BEFORE INSERT OR UPDATE OF outlet_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_tolak_outlet_persiapan();
