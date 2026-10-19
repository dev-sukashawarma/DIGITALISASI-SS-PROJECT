-- 20300254003400_manager_stok_opname_and_retur_alerts.sql
-- Sistem Notifikasi Telegram untuk Area Manager (AM) dan Regional Manager (RM)
-- Tahap 3:
-- 1. Monitoring Status Stok Opname Harian (Sudah vs Belum SO) pada jam 21:30 & 22:30 WIB
-- 2. Alert Stok Kritis / Out-of-Stock Risk ke Area Manager
-- 3. Alert Pengajuan Retur Bahan Baku ke AM & RM

-- ─────────────────────────────────────────────────────────── 1. Alert Retur Bahan Baku
CREATE OR REPLACE FUNCTION public.bot_manager_alert_retur_stok()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_outlet_name text;
  v_reporter_name text;
  v_item_count int;
  v_sample_item text;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com/approvals';
  v_am record;
  v_rm record;
BEGIN
  IF NEW.status <> 'diajukan' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT name INTO v_reporter_name FROM public.outlet_staff WHERE id = NEW.created_by;

  SELECT count(*), max(b.nama)
  INTO v_item_count, v_sample_item
  FROM public.retur_stok_item ri
  JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
  WHERE ri.retur_stok_id = NEW.id;

  v_title := '🔄 Pengajuan Retur Bahan Baku';
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nNomor Retur: ' || NEW.nomor_retur
    || E'\nTipe: ' || CASE WHEN NEW.tipe_retur = 'inbound_sj' THEN 'Tolak saat Terima SJ' ELSE 'Chiller Outlet / Rusak' END
    || (CASE WHEN v_item_count > 0 THEN E'\nJumlah Item: ' || v_item_count || ' item (' || COALESCE(v_sample_item, '') || (CASE WHEN v_item_count > 1 THEN ' dll' ELSE '' END) || ')' ELSE '' END)
    || E'\nPelapor: ' || COALESCE(v_reporter_name, 'Kru Cabang')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB'
    || E'\n\nHarap verifikasi dan setujui sebelum kurir penjemputan berangkat!';

  -- Kirim ke Area Manager (AM) pengawas outlet
  FOR v_am IN
    SELECT so.staff_id 
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'retur:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  -- Kirim juga ke seluruh Regional Manager (RM) untuk koordinasi gudang/logistik
  FOR v_rm IN
    SELECT s.id AS staff_id 
    FROM public.outlet_staff s
    WHERE s.role IN ('regional_manager', 'developer')
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'retur_rm:' || NEW.id,
      v_rm.staff_id,
      '📋 [INFO REGIONAL] ' || v_title,
      v_body,
      v_url
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert retur manager: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_manager_alert_retur ON public.retur_stok;
CREATE TRIGGER trg_bot_manager_alert_retur
  AFTER INSERT ON public.retur_stok
  FOR EACH ROW EXECUTE FUNCTION public.bot_manager_alert_retur_stok();

-- ─────────────────────────────────────────────────────────── 2. Alert Stok Kritis (ke Area Manager)
CREATE OR REPLACE FUNCTION public.bot_manager_alert_stok_kritis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item_name text;
  v_satuan text;
  v_threshold numeric;
  v_outlet_name text;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
  v_am record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.saldo IS NOT DISTINCT FROM OLD.saldo THEN
    RETURN NEW;
  END IF;

  SELECT b.nama, b.satuan,
         COALESCE(orp.reorder_point, b.default_reorder_point, 10),
         o.name
  INTO v_item_name, v_satuan, v_threshold, v_outlet_name
  FROM public.bahan_baku b
  JOIN public.outlets o ON o.id = NEW.outlet_id AND o.is_active IS TRUE
  LEFT JOIN public.outlet_reorder_point orp
    ON orp.outlet_id = NEW.outlet_id AND orp.bahan_baku_id = NEW.bahan_baku_id
  WHERE b.id = NEW.bahan_baku_id AND b.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  -- Hanya kirim jika saldo berada di bawah batas minimum (reorder point)
  IF v_item_name IS NULL OR NEW.saldo > v_threshold THEN
    RETURN NEW;
  END IF;

  -- Hindari spam alert jika saldo sebelumnya sudah di bawah threshold
  IF TG_OP = 'UPDATE' AND OLD.saldo <= v_threshold THEN
    RETURN NEW;
  END IF;

  v_title := '⚠️ STOK BAHAN KRITIS';
  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || v_item_name
    || E'\nSisa Stok: ' || NEW.saldo || ' ' || COALESCE(v_satuan, '')
    || E'\nBatas Reorder: ' || v_threshold || ' ' || COALESCE(v_satuan, '')
    || E'\nStatus: Berisiko kehabisan stok hari ini!'
    || E'\n\nSegera koordinasikan pengiriman darurat atau mutasi antar cabang.';

  -- Kirim ke Area Manager (AM) pembina outlet
  FOR v_am IN
    SELECT so.staff_id 
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'stok_kritis:' || NEW.outlet_id || ':' || NEW.bahan_baku_id || ':' || (now() AT TIME ZONE 'Asia/Jakarta')::date,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert stok kritis manager: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_manager_stok_kritis ON public.stok_balance;
CREATE TRIGGER trg_bot_manager_stok_kritis
  AFTER INSERT OR UPDATE ON public.stok_balance
  FOR EACH ROW EXECUTE FUNCTION public.bot_manager_alert_stok_kritis();

-- ─────────────────────────────────────────────────────────── 3. Monitoring Stok Opname (Sudah / Belum SO)
CREATE OR REPLACE FUNCTION public.bot_manager_cek_status_opname_harian(p_is_cutoff boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_am record;
  v_rm record;
  v_outlet record;
  v_sudah text[];
  v_draft text[];
  v_belum text[];
  v_sudah_count int;
  v_draft_count int;
  v_belum_count int;
  v_total int;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com';
  v_reg_belum_count int := 0;
  v_reg_total_count int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('bot-manager-opname-monitor-' || p_is_cutoff::text)) THEN
    RETURN;
  END IF;

  -- Loop setiap Area Manager aktif
  FOR v_am IN
    SELECT s.id, s.name
    FROM public.outlet_staff s
    WHERE s.role = 'area_manager' AND s.status = 'active'
  LOOP
    v_sudah := '{}';
    v_draft := '{}';
    v_belum := '{}';

    -- Evaluasi status opname untuk seluruh outlet binaan AM ini
    FOR v_outlet IN
      SELECT o.id, o.name, op.status AS opname_status
      FROM public.staff_outlets so
      JOIN public.outlets o ON o.id = so.outlet_id
      LEFT JOIN public.opname op 
        ON op.outlet_id = o.id 
       AND op.tanggal = v_today 
       AND op.tipe = 'harian'
      WHERE so.staff_id = v_am.id
        AND o.is_active IS TRUE
        AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
        AND o.name NOT ILIKE '%kantor pusat%'
        AND o.name NOT ILIKE '%gudang%'
      ORDER BY o.name
    LOOP
      IF v_outlet.opname_status = 'finalized' THEN
        v_sudah := array_append(v_sudah, v_outlet.name);
      ELSIF v_outlet.opname_status = 'draft' THEN
        v_draft := array_append(v_draft, v_outlet.name);
      ELSE
        v_belum := array_append(v_belum, v_outlet.name);
      END IF;
    END LOOP;

    v_sudah_count := COALESCE(cardinality(v_sudah), 0);
    v_draft_count := COALESCE(cardinality(v_draft), 0);
    v_belum_count := COALESCE(cardinality(v_belum), 0);
    v_total := v_sudah_count + v_draft_count + v_belum_count;

    IF v_total = 0 THEN
      CONTINUE;
    END IF;

    -- Saat cut-off final (22:30), hanya kirim alert jika masih ada outlet yang belum finalized
    IF p_is_cutoff AND (v_draft_count + v_belum_count) = 0 THEN
      CONTINUE;
    END IF;

    v_title := CASE 
      WHEN p_is_cutoff THEN '🚨 ALERT CUT-OFF: OUTLET BELUM SELESAI OPNAME'
      ELSE '📦 MONITORING STOK OPNAME HARIAN (21:30 WIB)'
    END;

    v_body := 'Area: ' || v_am.name
      || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
      || E'\nProgress: ' || v_sudah_count || ' / ' || v_total || ' Cabang Finalized'
      || (CASE WHEN v_sudah_count > 0 THEN E'\n\n✅ SUDAH OPNAME (' || v_sudah_count || '):' || E'\n• ' || array_to_string(v_sudah, E'\n• ') ELSE '' END)
      || (CASE WHEN v_draft_count > 0 THEN E'\n\n⏳ MASIH DRAFT (' || v_draft_count || '):' || E'\n• ' || array_to_string(v_draft, E'\n• ') ELSE '' END)
      || (CASE WHEN v_belum_count > 0 THEN E'\n\n🚨 BELUM OPNAME (' || v_belum_count || '):' || E'\n• ' || array_to_string(v_belum, E'\n• ') ELSE '' END)
      || (CASE WHEN (v_draft_count + v_belum_count) > 0 
          THEN E'\n\nHarap segera instruksikan kru cabang untuk menyelesaikan penghitungan stok fisik!'
          ELSE E'\n\nSemua cabang binaan telah menyelesaikan stock opname harian.' END);

    PERFORM public.bot_manager_antrekan(
      'opname_mon:' || v_am.id || ':' || v_today || (CASE WHEN p_is_cutoff THEN ':cutoff' ELSE ':digest' END),
      v_am.id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  -- Evaluasi Ringkasan Regional untuk RM saat Cut-off (22:30 WIB)
  IF p_is_cutoff THEN
    SELECT 
      count(*) FILTER (WHERE op.id IS NULL OR op.status <> 'finalized'),
      count(*)
    INTO v_reg_belum_count, v_reg_total_count
    FROM public.outlets o
    LEFT JOIN public.opname op 
      ON op.outlet_id = o.id 
     AND op.tanggal = v_today 
     AND op.tipe = 'harian'
    WHERE o.is_active IS TRUE
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%';

    IF v_reg_belum_count > 0 THEN
      FOR v_rm IN
        SELECT s.id, s.name
        FROM public.outlet_staff s
        WHERE s.role IN ('regional_manager', 'developer') AND s.status = 'active'
      LOOP
        PERFORM public.bot_manager_antrekan(
          'opname_rm_cutoff:' || v_rm.id || ':' || v_today,
          v_rm.id,
          '🚨 [ESKALASI RM] REKAP CUT-OFF OPNAME BELUM LENGKAP',
          'Tanggal: ' || to_char(v_today, 'DD-MM-YYYY')
            || E'\nStatus Cut-off: ' || v_reg_belum_count || ' dari ' || v_reg_total_count || ' cabang belum menyelesaikan opname fisik.'
            || E'\n\nMohon lakukan peneguran kepada Area Manager terkait agar opname diselesaikan sebelum pergantian hari.',
          v_url
        );
      END LOOP;
    END IF;
  END IF;

END;
$$;

REVOKE ALL ON FUNCTION public.bot_manager_alert_retur_stok(),
  public.bot_manager_alert_stok_kritis(),
  public.bot_manager_cek_status_opname_harian(boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bot_manager_cek_status_opname_harian(boolean) TO service_role;

-- ─────────────────────────────────────────────────────────── 4. Schedules (pg_cron)
-- pg_cron berjalan dalam UTC.
-- 21:30 WIB = 14:30 UTC -> Pengingat / Monitoring Pra-Closing Harian
SELECT cron.schedule('bot-manager-opname-pra-closing', '30 14 * * *', 'SELECT public.bot_manager_cek_status_opname_harian(false);');
-- 22:30 WIB = 15:30 UTC -> Alert Cut-off Final jika masih ada yang belum opname
SELECT cron.schedule('bot-manager-opname-cutoff', '30 15 * * *', 'SELECT public.bot_manager_cek_status_opname_harian(true);');
