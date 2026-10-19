-- 20300254004100_gudang_pusat_pengadaan_dan_defisit_alerts.sql
-- Alert Stok & Pengadaan Gudang Pusat (HQ) ke Telegram:
-- 1. Real-time Defisit: Peringatan seketika saat permintaan cabang melebihi sisa stok fisik di Gudang Pusat.
-- 2. Rekap Harian Pagi (08:30 WIB): Rekap saran pengadaan / PO ke supplier untuk bahan gudang yang berstatus Mendesak atau Menipis.
-- Penerima: Tim Purchasing, Kitchen (Dapur Pusat), Owner, dan Admin.
-- Proteksi: Role 'leader' secara mutlak dikecualikan.

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────── 1. Tabel Log Deduplikasi Harian Rekap Pengadaan
CREATE TABLE IF NOT EXISTS public.bot_telegram_gudang_po_log (
  tanggal DATE PRIMARY KEY,
  jumlah_mendesak INT NOT NULL DEFAULT 0,
  jumlah_menipis INT NOT NULL DEFAULT 0,
  dikirim_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bot_telegram_gudang_po_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_telegram_gudang_po_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_telegram_gudang_po_log TO service_role;

-- ─────────────────────────────────────────────────────────── 2. Trigger Real-Time Defisit Permintaan Cabang
CREATE OR REPLACE FUNCTION public.bot_telegram_alert_gudang_defisit_permintaan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gudang_id uuid;
  v_gudang_name text;
  v_outlet_name text;
  v_defisit_list text;
  v_defisit_count int := 0;
  v_title text;
  v_body text;
  v_url text := 'https://stok.sukashawarma.com/stok/permintaan';
  r record;
BEGIN
  -- Hanya proses saat permintaan baru berstatus 'menunggu'
  IF NEW.status <> 'menunggu' THEN
    RETURN NEW;
  END IF;

  -- Cari outlet Gudang Pusat
  SELECT id, name INTO v_gudang_id, v_gudang_name
  FROM public.outlets
  WHERE is_active IS TRUE AND (type = 'gudang' OR slug = 'hq')
  ORDER BY (id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid) DESC
  LIMIT 1;

  IF v_gudang_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Jika yang membuat permintaan adalah Gudang Pusat sendiri, lewati
  IF NEW.outlet_id = v_gudang_id THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id;

  -- Kumpulkan item-item yang diminta yang melebihi saldo fisik di Gudang Pusat
  SELECT 
    string_agg(
      '• ' || b.nama || ': Diminta ' || public.bot_telegram_format_angka(pbi.qty_diminta) || ' ' || COALESCE(b.satuan, '')
      || ' | Sisa Gudang: ' || public.bot_telegram_format_angka(COALESCE(sb.saldo, 0)) || ' ' || COALESCE(b.satuan, '')
      || ' (Kurang: ' || public.bot_telegram_format_angka(pbi.qty_diminta - COALESCE(sb.saldo, 0)) || ' ' || COALESCE(b.satuan, '') || ')',
      E'\n'
    ),
    count(*)::int
  INTO v_defisit_list, v_defisit_count
  FROM public.permintaan_bahan_item pbi
  JOIN public.bahan_baku b ON b.id = pbi.bahan_baku_id AND b.is_active IS TRUE
  LEFT JOIN public.stok_balance sb ON sb.bahan_baku_id = pbi.bahan_baku_id AND sb.outlet_id = v_gudang_id
  WHERE pbi.permintaan_id = NEW.id
    AND pbi.qty_diminta > COALESCE(sb.saldo, 0);

  IF v_defisit_count = 0 OR v_defisit_list IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := '🚨 Defisit Stok Gudang Pusat · ' || COALESCE(v_outlet_name, 'Outlet');
  v_body := 'Permintaan bahan dari cabang MELEBIHI sisa stok fisik di Gudang Pusat:'
    || E'\n\nCabang Pemohon: ' || COALESCE(v_outlet_name, 'Outlet')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
    || E'\n\nDaftar Bahan Defisit (' || v_defisit_count || ' item):\n' || v_defisit_list
    || E'\n\n⚠️ Mohon tim Purchasing segera koordinasi pengadaan / PO ke supplier agar distribusi cabang tidak terhambat.';

  -- Kirim ke seluruh staf purchasing, kitchen, owner, dan admin
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('purchasing', 'kitchen', 'owner', 'admin')
      AND s.role <> 'leader'
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      v_title,
      v_body,
      v_url,
      v_gudang_id
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Gagal memproses alert defisit stok gudang pusat: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_gudang_defisit_permintaan() FROM PUBLIC, anon, authenticated;

-- Pasang deferred constraint trigger pada permintaan_bahan
DROP TRIGGER IF EXISTS trg_bot_telegram_gudang_defisit_permintaan ON public.permintaan_bahan;
CREATE CONSTRAINT TRIGGER trg_bot_telegram_gudang_defisit_permintaan
  AFTER INSERT OR UPDATE OF status ON public.permintaan_bahan
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_gudang_defisit_permintaan();

-- ─────────────────────────────────────────────────────────── 3. Fungsi Rekap Harian Pagi (08:30 WIB) Saran Pengadaan
CREATE OR REPLACE FUNCTION public.bot_telegram_rekap_pengadaan_gudang_pagi(
  p_sekarang TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_gudang_id UUID;
  v_gudang_name TEXT;
  v_mendesak_list TEXT := '';
  v_menipis_list TEXT := '';
  v_count_mendesak INT := 0;
  v_count_menipis INT := 0;
  v_total_perlu INT := 0;
  v_title TEXT;
  v_body TEXT;
  v_url TEXT := 'https://stok.sukashawarma.com/stok/monitoring';
  v_recipients INT := 0;
  r RECORD;
  recipient RECORD;
BEGIN
  IF p_sekarang IS NULL OR NOT isfinite(p_sekarang) THEN RETURN 0; END IF;
  v_date := (p_sekarang AT TIME ZONE 'Asia/Jakarta')::date;

  IF NOT pg_try_advisory_xact_lock(hashtext('gudang-rekap-po:' || v_date::text)) THEN
    RETURN 0;
  END IF;

  -- Cek apakah hari ini sudah pernah terkirim
  IF EXISTS (SELECT 1 FROM public.bot_telegram_gudang_po_log WHERE tanggal = v_date) THEN
    RETURN 0;
  END IF;

  -- Cari Gudang Pusat
  SELECT id, name INTO v_gudang_id, v_gudang_name
  FROM public.outlets
  WHERE is_active IS TRUE AND (type = 'gudang' OR slug = 'hq')
  ORDER BY (id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'::uuid) DESC
  LIMIT 1;

  IF v_gudang_id IS NULL THEN RETURN 0; END IF;

  -- Evaluasi stok gudang pusat vs ROP, permintaan cabang, dan PO berjalan
  FOR r IN
    WITH stok_hq AS (
      SELECT b.id AS bahan_baku_id,
             b.nama,
             b.satuan,
             COALESCE(sb.saldo, 0) AS saldo_gudang,
             CASE
               WHEN COALESCE(orp.threshold_type, b.threshold_type, 'angka') = 'persentase' THEN
                  (COALESCE(orp.threshold_persentase, b.threshold_persentase, 20) / 100.0) * COALESCE(orp.stok_ideal, b.stok_ideal, COALESCE(orp.reorder_point, b.default_reorder_point, 10))
               ELSE COALESCE(orp.reorder_point, b.default_reorder_point, 10)
             END AS threshold
      FROM public.bahan_baku b
      LEFT JOIN public.stok_balance sb ON sb.bahan_baku_id = b.id AND sb.outlet_id = v_gudang_id
      LEFT JOIN public.outlet_reorder_point orp ON orp.bahan_baku_id = b.id AND orp.outlet_id = v_gudang_id
      WHERE b.is_active IS TRUE
    ),
    permintaan_cabang AS (
      SELECT pbi.bahan_baku_id,
             COALESCE(SUM(pbi.qty_diminta), 0) AS total_diminta
      FROM public.permintaan_bahan_item pbi
      JOIN public.permintaan_bahan pb ON pb.id = pbi.permintaan_id
      WHERE pb.status = 'menunggu'
      GROUP BY pbi.bahan_baku_id
    ),
    po_aktif AS (
      SELECT poi.bahan_baku_id,
             COALESCE(SUM(poi.qty_pesan - COALESCE(poi.qty_terima, 0)), 0) AS po_jalan
      FROM public.purchase_order_item poi
      JOIN public.purchase_order po ON po.id = poi.purchase_order_id
      WHERE po.status IN ('menunggu_approval_finance', 'dikirim_ke_supplier', 'sebagian_diterima')
      GROUP BY poi.bahan_baku_id
    )
    SELECT sh.nama,
           sh.satuan,
           sh.saldo_gudang,
           sh.threshold,
           COALESCE(pc.total_diminta, 0) AS permintaan_pending,
           COALESCE(pa.po_jalan, 0) AS po_jalan,
           CASE
             -- MENDESAK: Stok kosong, atau stok di bawah antrean permintaan cabang, atau buffer <= 30% ROP
             WHEN sh.saldo_gudang <= 0
               OR (pc.total_diminta > 0 AND sh.saldo_gudang < pc.total_diminta)
               OR sh.saldo_gudang <= (sh.threshold * 0.3) THEN 'mendesak'
             -- MENIPIS: Stok menembus batas ROP atau stok + PO jalan belum mencukupi ROP + antrean
             WHEN sh.saldo_gudang <= sh.threshold
               OR (sh.saldo_gudang + COALESCE(pa.po_jalan, 0)) < (sh.threshold + COALESCE(pc.total_diminta, 0)) THEN 'menipis'
             ELSE 'aman'
           END AS status_kebutuhan
    FROM stok_hq sh
    LEFT JOIN permintaan_cabang pc ON pc.bahan_baku_id = sh.bahan_baku_id
    LEFT JOIN po_aktif pa ON pa.bahan_baku_id = sh.bahan_baku_id
    WHERE sh.saldo_gudang <= sh.threshold
       OR (pc.total_diminta > 0 AND sh.saldo_gudang < pc.total_diminta)
       OR (sh.saldo_gudang + COALESCE(pa.po_jalan, 0)) < (sh.threshold + COALESCE(pc.total_diminta, 0))
    ORDER BY 
      CASE WHEN sh.saldo_gudang <= 0 OR (pc.total_diminta > 0 AND sh.saldo_gudang < pc.total_diminta) THEN 0
           WHEN sh.saldo_gudang <= (sh.threshold * 0.3) THEN 1
           ELSE 2 END,
      sh.nama
  LOOP
    IF r.status_kebutuhan = 'mendesak' THEN
      v_count_mendesak := v_count_mendesak + 1;
      IF v_count_mendesak <= 12 THEN
        v_mendesak_list := v_mendesak_list || E'• *' || r.nama || E'*\n'
          || '  - Sisa Gudang: ' || public.bot_telegram_format_angka(r.saldo_gudang) || ' ' || COALESCE(r.satuan, '')
          || (CASE WHEN r.permintaan_pending > 0 THEN ' | Diminta Cabang: ' || public.bot_telegram_format_angka(r.permintaan_pending) || ' ' || COALESCE(r.satuan, '') ELSE '' END)
          || (CASE WHEN r.po_jalan > 0 THEN ' | PO Jalan: ' || public.bot_telegram_format_angka(r.po_jalan) || ' ' || COALESCE(r.satuan, '') ELSE ' | PO Jalan: 0' END)
          || E'\n';
      END IF;
    ELSIF r.status_kebutuhan = 'menipis' THEN
      v_count_menipis := v_count_menipis + 1;
      IF v_count_menipis <= 8 THEN
        v_menipis_list := v_menipis_list || E'• ' || r.nama
          || ': Sisa ' || public.bot_telegram_format_angka(r.saldo_gudang) || ' ' || COALESCE(r.satuan, '')
          || ' (Batas Aman: ' || public.bot_telegram_format_angka(r.threshold) || ' ' || COALESCE(r.satuan, '') || ')'
          || (CASE WHEN r.po_jalan > 0 THEN ', PO: ' || public.bot_telegram_format_angka(r.po_jalan) ELSE '' END)
          || E'\n';
      END IF;
    END IF;
  END LOOP;

  v_total_perlu := v_count_mendesak + v_count_menipis;

  -- Jika seluruh stok gudang aman, catat ke log dan selesaikan tanpa spam
  IF v_total_perlu = 0 THEN
    INSERT INTO public.bot_telegram_gudang_po_log (tanggal, jumlah_mendesak, jumlah_menipis, dikirim_at)
    VALUES (v_date, 0, 0, NOW())
    ON CONFLICT (tanggal) DO NOTHING;
    RETURN 0;
  END IF;

  v_title := '📋 Rekap Saran Pengadaan Gudang Pusat (08:30 WIB)';
  v_body := 'Evaluasi Buffer Stok Gudang Pusat & Antrean Cabang:'
    || E'\nTanggal: ' || to_char(p_sekarang AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY') || ' · 08:30 WIB\n';

  IF v_count_mendesak > 0 THEN
    v_body := v_body || E'\n🔴 *STATUS MENDESAK (' || v_count_mendesak || ' bahan):*\n' || v_mendesak_list;
    IF v_count_mendesak > 12 THEN
      v_body := v_body || '  ...dan ' || (v_count_mendesak - 12) || E' bahan mendesak lainnya\n';
    END IF;
  END IF;

  IF v_count_menipis > 0 THEN
    v_body := v_body || E'\n🟡 *STATUS MENIPIS (' || v_count_menipis || ' bahan):*\n' || v_menipis_list;
    IF v_count_menipis > 8 THEN
      v_body := v_body || '  ...dan ' || (v_count_menipis - 8) || E' bahan menipis lainnya\n';
    END IF;
  END IF;

  v_body := v_body || E'\n👉 *Tindakan Disarankan:* Segera buat Purchase Order (PO) ke supplier sebelum batas waktu cutoff pengiriman hari ini.';

  -- Kirim ke seluruh staf purchasing, kitchen, owner, admin
  FOR recipient IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role IN ('purchasing', 'kitchen', 'owner', 'admin')
      AND s.role <> 'leader'
  LOOP
    BEGIN
      PERFORM public.bot_telegram_kirim_alert(
        recipient.id,
        'stok',
        v_title,
        v_body,
        v_url,
        v_gudang_id
      );
      v_recipients := v_recipients + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Gagal mengirim rekap pengadaan gudang kepada staf %: %', recipient.id, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.bot_telegram_gudang_po_log (tanggal, jumlah_mendesak, jumlah_menipis, dikirim_at)
  VALUES (v_date, v_count_mendesak, v_count_menipis, NOW())
  ON CONFLICT (tanggal) DO UPDATE
  SET jumlah_mendesak = EXCLUDED.jumlah_mendesak,
      jumlah_menipis = EXCLUDED.jumlah_menipis,
      dikirim_at = EXCLUDED.dikirim_at;

  RETURN v_recipients;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_rekap_pengadaan_gudang_pagi(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_telegram_rekap_pengadaan_gudang_pagi(TIMESTAMPTZ) TO service_role;

-- ─────────────────────────────────────────────────────────── 4. Pemasangan Jadwal Cron pg_cron (08:30 WIB = 01:30 UTC)
DO $$ BEGIN
  PERFORM cron.unschedule('bot-telegram-gudang-saran-po-pagi');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('bot-telegram-gudang-saran-po-pagi', '30 1 * * *',
  $cron$SELECT public.bot_telegram_rekap_pengadaan_gudang_pagi();$cron$);

COMMENT ON FUNCTION public.bot_telegram_alert_gudang_defisit_permintaan() IS
  'Trigger real-time alert Telegram jika permintaan cabang melebihi ketersediaan stok fisik di Gudang Pusat. Dikirim ke Purchasing, Kitchen, Owner, dan Admin.';
COMMENT ON FUNCTION public.bot_telegram_rekap_pengadaan_gudang_pagi(TIMESTAMPTZ) IS
  'Rekap harian saran PO pengadaan Gudang Pusat pukul 08:30 WIB. Dikirim ke Purchasing, Kitchen, Owner, dan Admin.';
COMMENT ON TABLE public.bot_telegram_gudang_po_log IS
  'Log deduplikasi rekap saran pengadaan harian Gudang Pusat.';
