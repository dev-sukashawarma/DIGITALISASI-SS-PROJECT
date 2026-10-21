-- 20300254005100_fix_triggers_data_accuracy.sql
-- Perbaikan komprehensif akurasi angka, waktu, dan keandalan notifikasi bot (Manager, CEO, SuperApp Push)
-- 1. Void Order POS (Manager & CEO):
--    - Perbaikan crash: Menghapus referensi 'NEW.staff_id' yang tidak ada di tabel orders (menggunakan voided_by dan cashier_name).
--    - Pengaman Backlog: Memastikan order lama yang tersinkronisasi/di-update offline tidak memicu false alert live.
--    - Filter Auto-Cancel: Mengabaikan pembatalan otomatis order kedaluwarsa/draft (expired > 5 jam).
--    - Waktu Transaksi Riil: Menggunakan coalesce(void_at, created_at) bukan now() server.
--    - Frekuensi Void: Mencegah '0x' dengan GREATEST(1, v_void_count).
-- 2. Waste Alert (Manager & CEO):
--    - Perbaikan crash bot_manager_alert_waste: Mengganti kolom 'created_at' menjadi 'harga_updated_at' pada bahan_baku_harga.
--    - Mengurutkan harga beli bahan baku terkini (ORDER BY harga_updated_at DESC NULLS LAST).
-- 3. Broadcast Omzet AM & RM (bot_manager_broadcast_omzet):
--    - Memperbaiki bug penggandaan omzet akibat relasi 1:N orders -> order_items.
--    - Menghitung omzet langsung dari tabel orders dan kuantiti pcs via subquery terpisah agar omzet tidak terlipat 2x-5x.
-- 4. Selisih Kas Closing (Manager & CEO):
--    - Format rapi Rupiah pada nilai minus ('-Rp 50,000' bukan 'Rp -50,000').
--    - Penanganan exception handler agar proses closing kasir tidak pernah terblokir oleh notifikasi.
-- 5. Retur Stok (trg_bot_manager_alert_retur):
--    - Mengubah trigger menjadi CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED agar item retur selesai di-insert sebelum notifikasi dirangkai.
-- 6. Ceklist Harian Push:
--    - Menghapus pemanggilan FCM duplikat (cukup via bot_manager_antrekan).
-- 7. Bot CEO Outbox Delivery Cron:
--    - Menjadwalkan cron.schedule 'bot-ceo-delivery' tiap menit agar antrean outbox CEO tidak macet.
--    - Membersihkan baris pending basi lama (> 1 jam) menjadi 'skipped' agar CEO tidak dibombardir alert masa lalu.

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Void Order Alert Bot Manager (AM & RM)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_manager_void_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_void_count int := 1;
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_am record;
  v_rm record;
  v_amt numeric := coalesce(NEW.total_amount, 0);
  v_kasir_name text;
  v_alasan text;
  v_order_label text;
  v_waktu_str text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Pengaman Backlog Historis: Lewati order masa lalu yang baru tersinkronisasi hari ini
  IF (coalesce(NEW.void_at, NEW.created_at) AT TIME ZONE 'Asia/Jakarta')::date < v_tgl_wib THEN
    RETURN NEW;
  END IF;

  -- Abaikan housekeeping pembatalan otomatis order kedaluwarsa/draft
  IF coalesce(NEW.void_reason, '') ILIKE '%melewati batas waktu%' 
     OR coalesce(NEW.void_reason, '') ILIKE '%otomatis batal%'
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%melewati batas waktu%'
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%otomatis batal%' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  -- Hitung seluruh order cancelled pada hari ini di cabang tersebut
  SELECT count(*) INTO v_void_count
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status = 'cancelled'
    AND (coalesce(void_at, updated_at, created_at) AT TIME ZONE 'Asia/Jakarta')::date = v_tgl_wib;

  v_void_count := GREATEST(1, coalesce(v_void_count, 1));

  -- Lookup kasir tanpa menyentuh field non-existent (orders tidak memiliki staff_id)
  v_kasir_name := NULL;
  IF NEW.voided_by IS NOT NULL THEN
    SELECT s.name INTO v_kasir_name FROM public.outlet_staff s WHERE s.id = NEW.voided_by;
  END IF;
  IF v_kasir_name IS NULL OR v_kasir_name = '' THEN
    v_kasir_name := coalesce(nullif(btrim(NEW.cashier_name), ''), 'Kasir POS');
  END IF;

  v_alasan := coalesce(nullif(btrim(NEW.void_reason), ''), nullif(btrim(NEW.cancellation_reason), ''), 'Tidak dicantumkan');
  v_order_label := '#' || coalesce(NEW.order_number::text, substr(NEW.id::text, 1, 8));
  v_waktu_str := to_char(coalesce(NEW.void_at, NEW.created_at) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB';

  -- A. Kirim ke Area Manager pembina cabang
  FOR v_am IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    JOIN public.staff_outlets so ON so.staff_id = s.id
    WHERE so.outlet_id = NEW.outlet_id
      AND s.role = 'area_manager'
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'void_am:' || NEW.id::text,
      v_am.id,
      '🛑 [ALERT VOID POS] Pembatalan Order ' || v_order_label || ' di ' || v_outlet_name,
      format(
        E'Transaksi POS dibatalkan (VOID/CANCELLED) di cabang binaan Anda.\nOutlet: %s\nNo. Order: %s\nNilai Order: Rp %s\nKasir: %s\nAlasan: %s\nTotal Void Hari Ini: %s transaksi\nWaktu Transaksi: %s\n\nSegera konfirmasi alasan pembatalan ke kasir/leader cabang.',
        v_outlet_name,
        v_order_label,
        to_char(v_amt, 'FM999,999,999'),
        v_kasir_name,
        v_alasan,
        v_void_count,
        v_waktu_str
      ),
      'bot'
    );
  END LOOP;

  -- B. Eskalasi ke Regional Manager jika nilai void >= Rp 50.000 atau void beruntun >= 2x hari ini
  IF v_amt >= 50000 OR v_void_count >= 2 THEN
    FOR v_rm IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('regional_manager', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'void_rm:' || NEW.id::text,
        v_rm.id,
        '🚨 [ESKALASI RM] Void Order Mencurigakan — ' || v_outlet_name,
        format(
          E'Deteksi pembatalan order (VOID) bernilai besar / beruntun di kasir POS.\nOutlet: %s\nNo. Order: %s\nNilai Void: Rp %s\nKasir: %s\nAlasan: %s\nFrekuensi Void Hari Ini: %sx di outlet ini\nWaktu Transaksi: %s\n\nMohon tinjau potensi anomali kasir bersama Area Manager.',
          v_outlet_name,
          v_order_label,
          to_char(v_amt, 'FM999,999,999'),
          v_kasir_name,
          v_alasan,
          v_void_count,
          v_waktu_str
        ),
        'bot'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_manager_void_order gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 2. Void Order Alert Bot CEO
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_void_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt numeric := coalesce(NEW.total_amount, 0);
  v_void_count int := 1;
  v_outlet_name text;
  v_tgl_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_ceo record;
  v_kasir_name text;
  v_alasan text;
  v_order_label text;
  v_waktu_str text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Pengaman Backlog Historis
  IF (coalesce(NEW.void_at, NEW.created_at) AT TIME ZONE 'Asia/Jakarta')::date < v_tgl_wib THEN
    RETURN NEW;
  END IF;

  -- Abaikan housekeeping order kedaluwarsa
  IF coalesce(NEW.void_reason, '') ILIKE '%melewati batas waktu%' 
     OR coalesce(NEW.void_reason, '') ILIKE '%otomatis batal%'
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%melewati batas waktu%'
     OR coalesce(NEW.cancellation_reason, '') ILIKE '%otomatis batal%' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(name, 'Cabang SS') INTO v_outlet_name
  FROM public.outlets
  WHERE id = NEW.outlet_id;

  SELECT count(*) INTO v_void_count
  FROM public.orders
  WHERE outlet_id = NEW.outlet_id
    AND status = 'cancelled'
    AND (coalesce(void_at, updated_at, created_at) AT TIME ZONE 'Asia/Jakarta')::date = v_tgl_wib;

  v_void_count := GREATEST(1, coalesce(v_void_count, 1));

  -- Lookup kasir yang aman
  v_kasir_name := NULL;
  IF NEW.voided_by IS NOT NULL THEN
    SELECT s.name INTO v_kasir_name FROM public.outlet_staff s WHERE s.id = NEW.voided_by;
  END IF;
  IF v_kasir_name IS NULL OR v_kasir_name = '' THEN
    v_kasir_name := coalesce(nullif(btrim(NEW.cashier_name), ''), 'Kasir POS');
  END IF;

  v_alasan := coalesce(nullif(btrim(NEW.void_reason), ''), nullif(btrim(NEW.cancellation_reason), ''), 'Tidak dicantumkan');
  v_order_label := '#' || coalesce(NEW.order_number::text, substr(NEW.id::text, 1, 8));
  v_waktu_str := to_char(coalesce(NEW.void_at, NEW.created_at) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') || ' WIB';

  IF v_amt >= 50000 OR v_void_count >= 2 THEN
    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('void_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🛑 [ESKALASI CEO] Pembatalan Order (VOID) Kritis — ' || coalesce(v_outlet_name, 'Cabang'),
        format(
          E'Deteksi pembatalan order (VOID) bernilai besar / beruntun di kasir POS.\nOutlet: %s\nNo. Order: %s\nNilai Void: Rp %s\nKasir: %s\nAlasan: %s\nFrekuensi Void Hari Ini: %sx di outlet ini\nWaktu Transaksi: %s\n\nTinjau detail transaksi melalui Admin Dashboard.',
          coalesce(v_outlet_name, 'Outlet'),
          v_order_label,
          to_char(v_amt, 'FM999,999,999'),
          v_kasir_name,
          v_alasan,
          v_void_count,
          v_waktu_str
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_void_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 3. Waste Alert Bot Manager (Fix kolom harga_updated_at)
CREATE OR REPLACE FUNCTION public.bot_manager_alert_waste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_outlet_name text;
  v_bahan_nama text;
  v_bahan_satuan text;
  v_reporter_name text;
  v_harga numeric := 0;
  v_est_kerugian numeric := 0;
  v_title text;
  v_body text;
  v_url text := 'https://manager.sukashawarma.com/waste';
  v_am record;
  v_rm record;
BEGIN
  IF upper(coalesce(NEW.status, 'PENDING')) <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT nama, coalesce(satuan, 'Unit') INTO v_bahan_nama, v_bahan_satuan FROM public.bahan_baku WHERE id = NEW.bahan_baku_id;
  SELECT name INTO v_reporter_name FROM public.outlet_staff WHERE id = NEW.reported_by;

  -- Mengambil harga beli master terkini (kolom timestamp valid: harga_updated_at)
  SELECT coalesce(harga_beli, 0) INTO v_harga 
  FROM public.bahan_baku_harga 
  WHERE bahan_baku_id = NEW.bahan_baku_id 
  ORDER BY harga_updated_at DESC NULLS LAST LIMIT 1;

  v_est_kerugian := round(coalesce(NEW.qty, 0) * coalesce(v_harga, 0), 0);

  v_title := CASE 
    WHEN v_est_kerugian > 150000 THEN '🚨 [ALERT WASTE] Bahan Bernilai Tinggi (> Rp 150rb)'
    ELSE '🗑️ Pengajuan Waste Bahan Baku — ' || coalesce(v_outlet_name, 'Outlet')
  END;

  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nBahan: ' || COALESCE(v_bahan_nama, 'Bahan Baku') || ' (' || NEW.qty || ' ' || COALESCE(v_bahan_satuan, 'satuan') || ')'
    || (CASE WHEN v_est_kerugian > 0 THEN E'\nEst. Kerugian: Rp ' || to_char(v_est_kerugian, 'FM999,999,999') ELSE '' END)
    || E'\nAlasan: ' || left(coalesce(btrim(NEW.reason), '-'), 200)
    || E'\nPelapor: ' || COALESCE(v_reporter_name, 'Kru Outlet')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB';

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
      'waste_am:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  -- Jika estimasi kerugian > Rp 150.000, eskalasi ke seluruh Regional Manager aktif
  IF v_est_kerugian > 150000 THEN
    FOR v_rm IN
      SELECT s.id AS staff_id 
      FROM public.outlet_staff s
      WHERE s.role IN ('regional_manager', 'developer') 
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'waste_rm:' || NEW.id,
        v_rm.staff_id,
        '🚨 [ESKALASI REGIONAL] ' || v_title,
        v_body || E'\n\nPerhatian RM: Estimasi kerugian bahan baku melebihi ambang batas toleransi Rp 150.000.',
        v_url
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_alert_waste gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 4. Waste Alert Bot CEO
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_waste_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_harga numeric := 0;
  v_est_kerugian numeric := 0;
  v_outlet_name text;
  v_bahan_name text;
  v_bahan_satuan text;
  v_ceo record;
BEGIN
  IF upper(coalesce(NEW.status, 'PENDING')) <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT b.nama, coalesce(b.satuan, 'Unit'), coalesce(h.harga_beli, 0)
  INTO v_bahan_name, v_bahan_satuan, v_harga
  FROM public.bahan_baku b
  LEFT JOIN public.bahan_baku_harga h ON h.bahan_baku_id = b.id
  WHERE b.id = NEW.bahan_baku_id
  ORDER BY h.harga_updated_at DESC NULLS LAST
  LIMIT 1;

  v_est_kerugian := round(coalesce(NEW.qty, 0) * coalesce(v_harga, 0), 0);

  IF v_est_kerugian > 150000 THEN
    SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('waste_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🥩 [ESKALASI WASTE > 150RB] ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Pengajuan waste bahan baku melebihi ambang batas toleransi Rp 150.000.\nOutlet: %s\nBahan: %s\nKuantiti: %s %s\nEstimasi Kerugian: Rp %s\nAlasan: %s\n\nNotifikasi eskalasi otomatis ke Direksi / Owner.',
          coalesce(v_outlet_name, 'Outlet'),
          coalesce(v_bahan_name, 'Bahan Baku'),
          NEW.qty::text,
          coalesce(v_bahan_satuan, ''),
          to_char(v_est_kerugian, 'FM999,999,999'),
          coalesce(NEW.reason, '-')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_waste_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 5. Broadcast Omzet AM & RM (Perbaikan Penggandaan Nilai)
CREATE OR REPLACE FUNCTION public.bot_manager_broadcast_omzet(p_sesi text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_sesi_label text;
  v_url text := 'https://manager.sukashawarma.com/dashboard';
  v_am record;
  v_outlet record;
  v_am_omzet numeric;
  v_am_pcs numeric;
  v_am_target numeric;
  v_am_pct numeric;
  v_am_lines text[];
  v_title text;
  v_body text;
  v_reg_omzet numeric := 0;
  v_reg_pcs numeric := 0;
  v_reg_target numeric := 0;
  v_reg_pct numeric := 0;
  v_reg_lines text[];
  v_area_item record;
  v_rm record;
BEGIN
  IF p_sesi NOT IN ('siang', 'dinner', 'closing') THEN
    RAISE EXCEPTION 'Sesi broadcast tidak valid: %', p_sesi;
  END IF;

  v_sesi_label := CASE p_sesi
    WHEN 'siang' THEN 'SIANG (15:00 WIB)'
    WHEN 'dinner' THEN 'DINNER (19:30 WIB)'
    WHEN 'closing' THEN 'CLOSING FINAL (22:30 WIB)'
  END;

  -- 1. Laporan Per Area Manager (AM)
  FOR v_am IN
    SELECT DISTINCT s.id, s.name
    FROM public.outlet_staff s
    WHERE s.role = 'area_manager' AND s.status = 'active'
    ORDER BY s.name
  LOOP
    v_am_omzet := 0;
    v_am_pcs := 0;
    v_am_target := 0;
    v_am_lines := '{}';

    FOR v_outlet IN
      SELECT 
        o.id,
        o.name,
        COALESCE(s.omzet, 0) AS outlet_omzet,
        COALESCE(s.total_pcs, 0) AS outlet_pcs,
        COALESCE(t.target_amount, 0) AS outlet_target,
        CASE WHEN COALESCE(t.target_amount, 0) > 0 
          THEN ROUND((COALESCE(s.omzet, 0) / t.target_amount) * 100, 1) 
          ELSE 0 END AS outlet_pct
      FROM public.staff_outlets so
      JOIN public.outlets o ON o.id = so.outlet_id
      CROSS JOIN LATERAL (
        SELECT
          COALESCE(SUM(ord.total_amount), 0) AS omzet,
          COALESCE((
            SELECT SUM(oi.quantity)
            FROM public.order_items oi
            JOIN public.orders ord2 ON ord2.id = oi.order_id
            WHERE ord2.outlet_id = o.id
              AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
              AND ord2.status IN ('completed', 'selesai', 'paid')
          ), 0) AS total_pcs
        FROM public.orders ord
        WHERE ord.outlet_id = o.id
          AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
          AND ord.status IN ('completed', 'selesai', 'paid')
      ) s
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
          0
        ) AS target_amount
      ) t
      WHERE so.staff_id = v_am.id
        AND o.is_active IS TRUE
        AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
        AND o.name NOT ILIKE '%kantor pusat%'
        AND o.name NOT ILIKE '%gudang%'
      ORDER BY s.omzet DESC, o.name
    LOOP
      v_am_omzet := v_am_omzet + v_outlet.outlet_omzet;
      v_am_pcs := v_am_pcs + v_outlet.outlet_pcs;
      v_am_target := v_am_target + v_outlet.outlet_target;

      v_am_lines := array_append(
        v_am_lines,
        '• ' || v_outlet.name || ': Rp ' || to_char(v_outlet.outlet_omzet, 'FM999,999,999')
          || ' (' || v_outlet.outlet_pcs || ' pcs)'
          || CASE WHEN v_outlet.outlet_target > 0 THEN ' [' || v_outlet.outlet_pct || '%]' ELSE '' END
      );
    END LOOP;

    IF COALESCE(cardinality(v_am_lines), 0) > 0 THEN
      v_am_pct := CASE WHEN v_am_target > 0 THEN ROUND((v_am_omzet / v_am_target) * 100, 1) ELSE 0 END;

      v_title := '📊 LAPORAN OMZET ' || v_sesi_label;
      v_body := 'Area: ' || v_am.name
        || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
        || E'\nTotal Omzet: Rp ' || to_char(v_am_omzet, 'FM999,999,999') || ' (' || v_am_pcs || ' pcs)'
        || (CASE WHEN v_am_target > 0 THEN E'\nCapaian Target: ' || v_am_pct || '% dari Rp ' || to_char(v_am_target, 'FM999,999,999') ELSE '' END)
        || E'\n\nPerforma Cabang Binaan:'
        || E'\n' || array_to_string(v_am_lines, E'\n')
        || (CASE 
            WHEN p_sesi = 'siang' AND v_am_pct < 40 THEN E'\n\n⚠️ Perhatian AM: Capaian siang masih di bawah 40%, mohon evaluasi jam operasional & stok cabang.'
            WHEN p_sesi = 'dinner' AND v_am_pct < 80 THEN E'\n\n⏳ Info AM: Masih butuh dorongan penjualan sebelum closing untuk mencapai target 100%.'
            WHEN p_sesi = 'closing' AND v_am_pct >= 100 THEN E'\n\n🎉 Selamat! Target area hari ini berhasil tercapai 100%.'
            ELSE '' END);

      PERFORM public.bot_manager_antrekan(
        'omzet_am:' || p_sesi || ':' || v_am.id || ':' || v_today,
        v_am.id,
        v_title,
        v_body,
        v_url
      );
    END IF;
  END LOOP;

  -- 2. Laporan Eksekutif Regional (ke Seluruh RM)
  v_reg_lines := '{}';

  FOR v_area_item IN
    SELECT 
      am.name AS am_name,
      COALESCE(SUM(s.omzet), 0) AS area_omzet,
      COALESCE(SUM(s.total_pcs), 0) AS area_pcs,
      COALESCE(SUM(t.target_amount), 0) AS area_target,
      CASE WHEN COALESCE(SUM(t.target_amount), 0) > 0 
        THEN ROUND((COALESCE(SUM(s.omzet), 0) / SUM(t.target_amount)) * 100, 1) 
        ELSE 0 END AS area_pct
    FROM public.outlet_staff am
    JOIN public.staff_outlets so ON so.staff_id = am.id
    JOIN public.outlets o ON o.id = so.outlet_id
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(SUM(ord.total_amount), 0) AS omzet,
        COALESCE((
          SELECT SUM(oi.quantity)
          FROM public.order_items oi
          JOIN public.orders ord2 ON ord2.id = oi.order_id
          WHERE ord2.outlet_id = o.id
            AND (ord2.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
            AND ord2.status IN ('completed', 'selesai', 'paid')
        ), 0) AS total_pcs
      FROM public.orders ord
      WHERE ord.outlet_id = o.id
        AND (ord.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
        AND ord.status IN ('completed', 'selesai', 'paid')
    ) s
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id = o.id AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        (SELECT target_amount FROM public.daily_sales_targets dst WHERE dst.outlet_id IS NULL AND dst.effective_from <= v_today ORDER BY dst.effective_from DESC, dst.created_at DESC LIMIT 1),
        0
      ) AS target_amount
    ) t
    WHERE am.role = 'area_manager' AND am.status = 'active'
      AND o.is_active IS TRUE
      AND COALESCE(o.type, '') NOT IN ('test', 'marketplace', 'system')
      AND o.name NOT ILIKE '%kantor pusat%'
      AND o.name NOT ILIKE '%gudang%'
    GROUP BY am.id, am.name
    ORDER BY area_omzet DESC
  LOOP
    v_reg_omzet := v_reg_omzet + v_area_item.area_omzet;
    v_reg_pcs := v_reg_pcs + v_area_item.area_pcs;
    v_reg_target := v_reg_target + v_area_item.area_target;

    v_reg_lines := array_append(
      v_reg_lines,
      '• Area ' || v_area_item.am_name || ': Rp ' || to_char(v_area_item.area_omzet, 'FM999,999,999')
        || ' (' || v_area_item.area_pcs || ' pcs)'
        || CASE WHEN v_area_item.area_target > 0 THEN ' [' || v_area_item.area_pct || '%]' ELSE '' END
    );
  END LOOP;

  IF COALESCE(cardinality(v_reg_lines), 0) > 0 THEN
    v_reg_pct := CASE WHEN v_reg_target > 0 THEN ROUND((v_reg_omzet / v_reg_target) * 100, 1) ELSE 0 END;

    v_title := '🌐 REKAP REGIONAL OMZET ' || v_sesi_label;
    v_body := 'Wilayah: Seluruh Regional'
      || E'\nTanggal: ' || to_char(v_today, 'DD-MM-YYYY')
      || E'\nTotal Omzet: Rp ' || to_char(v_reg_omzet, 'FM999,999,999') || ' (' || v_reg_pcs || ' pcs)'
      || (CASE WHEN v_reg_target > 0 THEN E'\nCapaian Target: ' || v_reg_pct || '% dari Rp ' || to_char(v_reg_target, 'FM999,999,999') ELSE '' END)
      || E'\n\nPerforma Antar Area:'
      || E'\n' || array_to_string(v_reg_lines, E'\n')
      || E'\n\nCatatan: Koordinasikan dorongan target dengan Area Manager terkait.';

    FOR v_rm IN
      SELECT s.id 
      FROM public.outlet_staff s 
      WHERE s.role IN ('regional_manager', 'developer') AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'omzet_rm:' || p_sesi || ':' || v_rm.id || ':' || v_today,
        v_rm.id,
        v_title,
        v_body,
        v_url
      );
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_broadcast_omzet gagal: %', SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────────────────── 6. Selisih Kas Bot Manager (+Rp / -Rp formatting)
CREATE OR REPLACE FUNCTION public.bot_manager_alert_selisih_kas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_laci_var numeric;
  v_petty_var numeric;
  v_max_var numeric;
  v_outlet_name text;
  v_staff_name text;
  v_title text;
  v_body text;
  v_url text;
  v_am record;
  v_rm record;
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  v_laci_var := COALESCE(NEW.variance, 0);
  v_petty_var := COALESCE(NEW.petty_cash_variance, 0);
  v_max_var := GREATEST(ABS(v_laci_var), ABS(v_petty_var));

  -- Ambang batas minimal selisih kas Rp 20.000
  IF v_max_var <= 20000 THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
  SELECT name INTO v_staff_name FROM public.outlet_staff WHERE id = COALESCE(NEW.closed_by, NEW.staff_id);

  v_title := CASE 
    WHEN v_max_var > 100000 THEN '🚨 Alert Selisih Kas Kritis (> Rp 100rb)'
    ELSE '⚠️ Peringatan Selisih Kas Closing'
  END;

  v_body := 'Outlet: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nKasir: ' || COALESCE(v_staff_name, '-')
    || E'\nWaktu Closing: ' || to_char(COALESCE(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB'
    || E'\nSelisih Laci: ' || CASE WHEN v_laci_var < 0 THEN '-Rp ' || to_char(abs(v_laci_var), 'FM999,999,999') ELSE '+Rp ' || to_char(v_laci_var, 'FM999,999,999') END
    || (CASE WHEN NEW.petty_cash_variance IS NOT NULL 
        THEN E'\nSelisih Petty Cash: ' || CASE WHEN v_petty_var < 0 THEN '-Rp ' || to_char(abs(v_petty_var), 'FM999,999,999') ELSE '+Rp ' || to_char(v_petty_var, 'FM999,999,999') END
        ELSE '' END)
    || (CASE WHEN NEW.notes IS NOT NULL AND btrim(NEW.notes) <> '' 
        THEN E'\nCatatan: ' || left(btrim(NEW.notes), 200)
        ELSE '' END);

  v_url := 'https://manager.sukashawarma.com/transactions';

  -- Kirim ke Area Manager (AM) pengawas outlet terkait
  FOR v_am IN 
    SELECT so.staff_id 
    FROM public.staff_outlets so
    JOIN public.outlet_staff s ON s.id = so.staff_id
    WHERE so.outlet_id = NEW.outlet_id 
      AND s.role = 'area_manager' 
      AND s.status = 'active'
  LOOP
    PERFORM public.bot_manager_antrekan(
      'selisih_kas:' || NEW.id,
      v_am.staff_id,
      v_title,
      v_body,
      v_url
    );
  END LOOP;

  -- Jika selisih kas > Rp 100.000, eskalasi ke seluruh Regional Manager aktif
  IF v_max_var > 100000 THEN
    FOR v_rm IN 
      SELECT s.id AS staff_id 
      FROM public.outlet_staff s
      WHERE s.role IN ('regional_manager', 'developer') 
        AND s.status = 'active'
    LOOP
      PERFORM public.bot_manager_antrekan(
        'selisih_kas_rm:' || NEW.id,
        v_rm.staff_id,
        '🚨 [ESKALASI REGIONAL] ' || v_title,
        v_body || E'\n\nPerhatian RM: Selisih kas melewati batas toleransi Rp 100.000.',
        v_url
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bot_manager_alert_selisih_kas gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 7. Selisih Kas Bot CEO (+Rp / -Rp formatting)
CREATE OR REPLACE FUNCTION public.trg_fn_bot_ceo_selisih_kas_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_laci_var numeric;
  v_petty_var numeric;
  v_max_var numeric;
  v_outlet_name text;
  v_staff_name text;
  v_ceo record;
BEGIN
  IF OLD.status <> 'open' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  v_laci_var := COALESCE(NEW.variance, 0);
  v_petty_var := COALESCE(NEW.petty_cash_variance, 0);
  v_max_var := GREATEST(ABS(v_laci_var), ABS(v_petty_var));

  -- Ambang batas eskalasi CEO: selisih kas > Rp 100.000
  IF v_max_var > 100000 THEN
    SELECT name INTO v_outlet_name FROM public.outlets WHERE id = NEW.outlet_id;
    SELECT name INTO v_staff_name FROM public.outlet_staff WHERE id = COALESCE(NEW.closed_by, NEW.staff_id);

    FOR v_ceo IN
      SELECT id FROM public.outlet_staff
      WHERE role IN ('owner', 'admin', 'developer')
        AND status = 'active'
    LOOP
      PERFORM public.bot_ceo_antrekan(
        format('selisih_kas_ceo:%s:%s', NEW.id::text, v_ceo.id::text),
        v_ceo.id,
        '🚨 [ALERT CEO] Selisih Kas Kritis (> Rp 100rb) — ' || coalesce(v_outlet_name, 'Outlet'),
        format(
          E'Selisih kas closing shift kasir melewati toleransi Rp 100.000.\nOutlet: %s\nKasir: %s\nSelisih Laci: %s\nWaktu Closing: %s WIB%s\nCatatan Kasir: %s\n\nAudit menyeluruh disarankan melalui Admin Dashboard.',
          coalesce(v_outlet_name, 'Outlet'),
          coalesce(v_staff_name, '-'),
          CASE WHEN v_laci_var < 0 THEN '-Rp ' || to_char(abs(v_laci_var), 'FM999,999,999') ELSE '+Rp ' || to_char(v_laci_var, 'FM999,999,999') END,
          to_char(COALESCE(NEW.end_time, now()) AT TIME ZONE 'Asia/Jakarta', 'HH24:MI'),
          CASE WHEN NEW.petty_cash_variance IS NOT NULL THEN E'\nSelisih Petty Cash: ' || CASE WHEN v_petty_var < 0 THEN '-Rp ' || to_char(abs(v_petty_var), 'FM999,999,999') ELSE '+Rp ' || to_char(v_petty_var, 'FM999,999,999') END ELSE '' END,
          coalesce(nullif(btrim(NEW.notes), ''), '-')
        ),
        'https://admin.sukashawarma.com'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_fn_bot_ceo_selisih_kas_alert gagal: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────── 8. Retur Stok Trigger Deferrable
DROP TRIGGER IF EXISTS trg_bot_manager_alert_retur ON public.retur_stok;
CREATE CONSTRAINT TRIGGER trg_bot_manager_alert_retur
  AFTER INSERT ON public.retur_stok
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.bot_manager_alert_retur_stok();

-- ─────────────────────────────────────────────────────────── 9. Ceklist Harian Push (Deduplikasi FCM)
CREATE OR REPLACE FUNCTION public.ceklist_harian_kirim_push(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Jalur Bot Manager: otomatis kirim Push HP Native (via bot_kirim_push_hp) + Telegram Outbox
  SELECT role INTO v_role FROM public.outlet_staff WHERE id = p_user_id;
  IF v_role IN ('regional_manager', 'area_manager', 'developer') THEN
    PERFORM public.bot_manager_antrekan(
      'ceklist:' || p_user_id || ':' || md5(p_title || p_body),
      p_user_id,
      p_title,
      p_body,
      'https://manager.sukashawarma.com'
    );
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────── 10. Jadwalkan Worker Bot CEO di pg_cron & Clean Stale
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-ceo-delivery') THEN
    PERFORM cron.unschedule('bot-ceo-delivery');
  END IF;
END
$$;

SELECT cron.schedule(
  'bot-ceo-delivery',
  '* * * * *',
  'SELECT public.bot_ceo_kirim_antrean();'
);

-- Bersihkan antrean historis lama di bot_ceo_alert_outbox agar tidak menjadi badai spam
UPDATE public.bot_ceo_alert_outbox
SET outcome = 'skipped'
WHERE outcome = 'pending' AND created_at < now() - interval '1 hour';
