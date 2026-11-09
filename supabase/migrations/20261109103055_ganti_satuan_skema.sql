-- Ganti Satuan bahan baku — Task 1: skema & penjaga trigger efek samping.
-- Spec: docs/superpowers/specs/2026-11-09-ganti-satuan-bahan-baku-design.md
-- Plan: docs/superpowers/plans/2026-11-09-ganti-satuan-bahan-baku.md (Task 1)
--
-- 1. bahan_baku.satuan_diganti_at — kapan satuan terakhir diganti (dibaca app stok untuk
--    membuang isian draft opname lokal yang dibuat sebelum ganti satuan).
-- 2. bahan_baku_ganti_satuan — log setiap ganti satuan (hanya ditulis fungsi SECURITY DEFINER).
-- 3. Sepuluh trigger efek samping diberi WHEN agar diam saat app.ganti_satuan='on':
--    konversi satuan mengubah ANGKA, bukan kuantitas barang, jadi tidak boleh memicu
--    notifikasi stok, alarm bot, atau menulis baris ledger baru (sync waste/terima vendor).
--    Definisi trigger diambil dari pg_get_triggerdef (event/fungsi tidak diketik ulang).
--    ⚠️ Beberapa trigger ini juga didefinisikan migration bertimestamp 2030; replay dari nol
--    akan membuang WHEN. Produksi aman (sudah terstempel).

SET lock_timeout = '5s';

ALTER TABLE public.bahan_baku ADD COLUMN IF NOT EXISTS satuan_diganti_at timestamptz;

CREATE TABLE IF NOT EXISTS public.bahan_baku_ganti_satuan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id uuid NOT NULL REFERENCES public.bahan_baku(id),
  satuan_lama   jsonb NOT NULL,
  satuan_baru   jsonb NOT NULL,
  jembatan      numeric NOT NULL,
  k_kecil       numeric NOT NULL,
  k_besar       numeric NOT NULL,
  jumlah_baris  jsonb NOT NULL,
  alasan        text NOT NULL,
  dibuat_oleh   uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bahan_baku_ganti_satuan_bahan_idx
  ON public.bahan_baku_ganti_satuan (bahan_baku_id, created_at DESC);

ALTER TABLE public.bahan_baku_ganti_satuan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bahan_baku_ganti_satuan FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bahan_baku_ganti_satuan TO authenticated;
DROP POLICY IF EXISTS bbgs_read ON public.bahan_baku_ganti_satuan;
CREATE POLICY bbgs_read ON public.bahan_baku_ganti_satuan
  FOR SELECT TO authenticated USING (public.is_owner_or_admin());

DO $$
DECLARE
  c_daftar constant text[][] := ARRAY[
    ['stok_balance','on_stok_balance_update_send_push'],
    ['stok_balance','trg_bot_manager_stok_drop50'],
    ['stok_balance','trg_bot_manager_stok_kritis'],
    ['stok_balance','trg_bot_telegram_penurunan_stok_tidak_wajar'],
    ['stok_balance','trg_bot_telegram_stok_kritis'],
    ['stok_waste_reports','trg_sync_waste_ledger'],
    ['stok_waste_reports','trg_validate_stok_waste_report_input'],
    ['stok_waste_reports','trg_waste_report_approval'],
    ['stok_waste_reports','trg_stok_push_waste_pending_approval'],
    ['terima_vendor_outlet','trg_sync_terima_vendor_ledger']];
  c_syarat constant text := 'COALESCE(current_setting(''app.ganti_satuan'', true), '''') <> ''on''';
  i int; v_oid oid; v_def text; v_baru text;
BEGIN
  FOR i IN 1 .. array_length(c_daftar, 1) LOOP
    SELECT t.oid INTO v_oid FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal
       AND c.relname = c_daftar[i][1] AND t.tgname = c_daftar[i][2];
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Trigger %.% tidak ditemukan', c_daftar[i][1], c_daftar[i][2];
    END IF;
    v_def := pg_get_triggerdef(v_oid);
    CONTINUE WHEN v_def ~ 'app\.ganti_satuan';
    IF position(' WHEN (' IN v_def) > 0 THEN
      v_baru := regexp_replace(v_def, ' WHEN \((.*)\) EXECUTE ', ' WHEN ((\1) AND ' || c_syarat || ') EXECUTE ');
    ELSE
      v_baru := replace(v_def, ' EXECUTE ', ' WHEN (' || c_syarat || ') EXECUTE ');
    END IF;
    IF v_baru = v_def THEN
      RAISE EXCEPTION 'Gagal menyisipkan WHEN pada %.%: %', c_daftar[i][1], c_daftar[i][2], v_def;
    END IF;
    EXECUTE format('DROP TRIGGER %I ON public.%I', c_daftar[i][2], c_daftar[i][1]);
    EXECUTE v_baru;
  END LOOP;

  -- Asersi akhir: kesepuluhnya ada dan berpenjaga.
  FOR i IN 1 .. array_length(c_daftar, 1) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = c_daftar[i][1]
                      AND t.tgname = c_daftar[i][2] AND pg_get_triggerdef(t.oid) ~ 'app\.ganti_satuan') THEN
      RAISE EXCEPTION 'Asersi: %.% tidak berpenjaga', c_daftar[i][1], c_daftar[i][2];
    END IF;
  END LOOP;
END $$;
