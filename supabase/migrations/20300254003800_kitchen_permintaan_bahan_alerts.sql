-- 20300254003800_kitchen_permintaan_bahan_alerts.sql
-- Alert otomatis ke tim Kitchen via Bot Telegram saat cabang membuat Permintaan Bahan Baku baru.
-- Menggunakan CONSTRAINT TRIGGER DEFERRED agar dieksekusi saat commit transaksi,
-- memastikan seluruh rincian baris bahan (permintaan_bahan_item) sudah tersimpan.

CREATE OR REPLACE FUNCTION public.bot_telegram_alert_permintaan_bahan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet_name text;
  v_creator_name text;
  v_item_count int := 0;
  v_sample_items text;
  v_title text;
  v_body text;
  v_url text := 'https://stok.sukashawarma.com/stok/permintaan';
  r record;
BEGIN
  -- Hanya proses permintaan yang berstatus 'menunggu'
  IF NEW.status <> 'menunggu' THEN
    RETURN NEW;
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.outlets o
  WHERE o.id = NEW.outlet_id AND o.is_active IS TRUE
    AND COALESCE(o.type, '') NOT IN ('test', 'marketplace');

  IF v_outlet_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.name INTO v_creator_name
  FROM public.outlet_staff s
  WHERE s.id = NEW.dibuat_oleh;

  -- Hitung total baris item
  SELECT count(*)::int INTO v_item_count
  FROM public.permintaan_bahan_item
  WHERE permintaan_id = NEW.id;

  -- Ambil sampel 3 bahan pertama untuk preview pesan
  SELECT string_agg(sub.item_desc, ', ' ORDER BY sub.nama)
  INTO v_sample_items
  FROM (
    SELECT b.nama,
           b.nama || ' (' || public.bot_telegram_format_angka(pbi.qty_diminta) || ' ' || COALESCE(b.satuan, '') || ')' AS item_desc
    FROM public.permintaan_bahan_item pbi
    JOIN public.bahan_baku b ON b.id = pbi.bahan_baku_id
    WHERE pbi.permintaan_id = NEW.id
    ORDER BY b.nama
    LIMIT 3
  ) sub;

  v_title := '📦 Permintaan Bahan Masuk · ' || v_outlet_name;
  v_body := 'Outlet: ' || v_outlet_name
    || (CASE WHEN v_item_count > 0 THEN E'\nJumlah Item: ' || v_item_count || ' item' ELSE '' END)
    || (CASE WHEN v_sample_items IS NOT NULL AND btrim(v_sample_items) <> '' THEN E'\nRincian: ' || v_sample_items || (CASE WHEN v_item_count > 3 THEN ' dll' ELSE '' END) ELSE '' END)
    || E'\nDibuat oleh: ' || COALESCE(v_creator_name, 'Kru Outlet')
    || E'\nWaktu: ' || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI') || ' WIB'
    || E'\n\nMohon tim dapur pusat meninjau permintaan dan memproses surat jalan pengiriman.';

  -- Kirim ke seluruh staf kitchen aktif yang memiliki akses bot Telegram
  FOR r IN
    SELECT DISTINCT s.id
    FROM public.outlet_staff s
    WHERE s.status = 'active'
      AND s.role = 'kitchen'
  LOOP
    PERFORM public.bot_telegram_kirim_alert(
      r.id,
      'stok',
      v_title,
      v_body,
      v_url,
      NEW.outlet_id
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Peringatan alert tidak boleh menggagalkan transaksi permintaan bahan
  RAISE WARNING 'Gagal memproses alert Telegram permintaan bahan: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_telegram_alert_permintaan_bahan() FROM PUBLIC, anon, authenticated;

-- Pasang deferred constraint trigger pada permintaan_bahan
DROP TRIGGER IF EXISTS trg_bot_telegram_permintaan_bahan ON public.permintaan_bahan;
CREATE CONSTRAINT TRIGGER trg_bot_telegram_permintaan_bahan
  AFTER INSERT ON public.permintaan_bahan
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_telegram_alert_permintaan_bahan();

COMMENT ON FUNCTION public.bot_telegram_alert_permintaan_bahan() IS
  'Mengirim alert Telegram ke tim Kitchen saat ada pengajuan permintaan bahan baku baru dari outlet cabang.';
