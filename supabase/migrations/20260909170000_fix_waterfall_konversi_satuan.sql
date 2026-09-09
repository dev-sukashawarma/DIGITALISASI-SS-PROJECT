-- 20260909170000_fix_waterfall_konversi_satuan.sql
-- process_waterfall_deduction: sisa potongan dilacak dalam SATUAN KECIL.
--
-- BUG YANG DITUTUP
--   Versi sebelumnya (20300105000017) menyimpan sisa potongan dalam satuan
--   BESAR bahan UTAMA, lalu saat melimpah ke bahan pengganti mengalikannya
--   dengan faktor_tampilan si PENGGANTI. Kalau kedua bahan beda faktor, potongan
--   meleset sebesar rasionya.
--
--   Terbukti hidup di produksi: SAOS TOMAT POUCH (12.000 g/Dus) -> SAOS TOMAT
--   KOMPAN (16.500 g/Dus), rasio 1,375. Resep 30 gram memotong 41,25 gram.
--   2.185 baris sejak 2 Agustus, 88.003,61 g dipotong, 24.000,98 g di antaranya
--   tidak pernah benar-benar terpakai.
--
--   Saldo outlet TIDAK dikoreksi mundur: kelima outlet terdampak melakukan
--   opname hampir harian, dan tiap opname_selisih sudah menyetelnya ke hitungan
--   fisik. Menyuntik adjustment sekarang akan menambah stok hantu.
--
-- CARA PERBAIKANNYA
--   Satuan kecil (gram/cm) adalah basis yang dipakai BERSAMA oleh bahan utama
--   dan penggantinya -- itulah sebabnya substitusi hanya sah bila satuan
--   kecilnya sama. Sisa potongan kini dilacak di situ, dan tiap bahan
--   mengonversi ke skala ledger-nya SENDIRI saat menulis baris.
--
-- YANG SENGAJA TIDAK BERUBAH
--   - Signature & tipe balik (trg_process_bom_stok tak perlu disentuh).
--   - Kontrak masukan: p_total_deduction tetap dalam satuan BESAR bahan utama.
--   - Bahan TANPA pengganti tetap menghasilkan SATU baris ledger dan tetap
--     boleh minus -- perilaku lama, dan ini jalur mayoritas tiap order.
--   - Urutan pengganti tetap bahan_baku_substitusi.urutan ASC.
--   - Sisa yang tak tertutup tetap dipaksa ke bahan utama (boleh minus).
--   - SECURITY DEFINER + search_path + REVOKE dipertahankan.
--
-- PERBAIKAN IKUTAN
--   Versi lama membaca faktor bahan utama lewat JOIN ke stok_balance; kalau
--   outlet belum pernah punya baris untuk bahan itu, faktornya NULL dan
--   perhitungan diam-diam jatuh ke besar-scale. Kini faktor bahan utama dibaca
--   langsung dari bahan_baku, jadi selalu ada.
--
-- ⚠️ UTANG TIMESTAMP
--   Fungsi ini juga didefinisikan 20300103000010 / 20300104000005 /
--   20300105000017 yang bertimestamp 2030. Pada replay riwayat dari nol,
--   ketiganya jalan SETELAH file ini dan akan menimpanya. Timestamp 2030
--   TIDAK dipakai di sini karena scripts/migration-timestamp-lint.mjs menolak
--   timestamp >2 hari ke depan (FUTURE_WINDOW_DAYS = 2). Ketiga migration itu
--   sudah applied & ter-stempel di DB produksi sehingga db push tak akan
--   menjalankannya lagi -- risikonya hanya pada environment baru dari nol.
--   Kalau suatu hari ranjau 2030 dibereskan, pindahkan fix ini ke urutan
--   setelahnya.
--
-- Idempoten (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.process_waterfall_deduction(
  p_outlet_id       uuid,
  p_bahan_baku_id   uuid,
  p_total_deduction numeric,
  p_catatan         text,
  p_ref_order_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_faktor_utama  NUMERIC;
  v_sisa_kecil    NUMERIC;   -- SELALU dalam satuan kecil
  v_ada_pengganti BOOLEAN;
  v_stock         NUMERIC;
  v_is_gram       BOOLEAN;
  v_faktor        NUMERIC;
  v_stock_kecil   NUMERIC;
  v_ambil_kecil   NUMERIC;
  v_qty_ledger    NUMERIC;
  sub_rec         RECORD;
BEGIN
  IF p_total_deduction IS NULL OR p_total_deduction <= 0 THEN
    RETURN;
  END IF;

  SELECT NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
    INTO v_faktor_utama
    FROM public.bahan_baku b
   WHERE b.id = p_bahan_baku_id;
  v_faktor_utama := COALESCE(v_faktor_utama, 1);

  v_sisa_kecil := p_total_deduction * v_faktor_utama;

  SELECT EXISTS (
    SELECT 1 FROM public.bahan_baku_substitusi
     WHERE bahan_baku_utama_id = p_bahan_baku_id
  ) INTO v_ada_pengganti;

  -- ---------- bahan utama ----------
  SELECT sb.saldo, saldo_is_gram(sb), NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
    INTO v_stock, v_is_gram, v_faktor
    FROM public.stok_balance sb
    JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
   WHERE sb.outlet_id = p_outlet_id
     AND sb.bahan_baku_id = p_bahan_baku_id;

  IF NOT FOUND THEN
    v_stock := 0; v_is_gram := false; v_faktor := v_faktor_utama;
  END IF;
  v_stock   := COALESCE(v_stock, 0);
  v_is_gram := COALESCE(v_is_gram, false);
  v_faktor  := COALESCE(v_faktor, 1);

  v_stock_kecil := CASE WHEN v_is_gram THEN v_stock ELSE v_stock * v_faktor END;

  IF NOT v_ada_pengganti OR v_stock_kecil >= v_sisa_kecil THEN
    -- tanpa pengganti: ambil semua (boleh minus) -- perilaku lama
    v_ambil_kecil := v_sisa_kecil;
    v_sisa_kecil  := 0;
  ELSIF v_stock_kecil > 0 THEN
    v_ambil_kecil := v_stock_kecil;
    v_sisa_kecil  := v_sisa_kecil - v_stock_kecil;
  ELSE
    v_ambil_kecil := 0;
  END IF;

  IF v_ambil_kecil > 0 THEN
    v_qty_ledger := CASE WHEN v_is_gram THEN v_ambil_kecil ELSE v_ambil_kecil / v_faktor END;
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_qty_ledger, p_catatan, p_ref_order_id, NOW()
    );
  END IF;

  -- ---------- bahan pengganti, urut prioritas ----------
  FOR sub_rec IN
    SELECT bahan_baku_pengganti_id
      FROM public.bahan_baku_substitusi
     WHERE bahan_baku_utama_id = p_bahan_baku_id
     ORDER BY urutan ASC
  LOOP
    EXIT WHEN v_sisa_kecil <= 0;

    SELECT sb.saldo, saldo_is_gram(sb), NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
      INTO v_stock, v_is_gram, v_faktor
      FROM public.stok_balance sb
      JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
     WHERE sb.outlet_id = p_outlet_id
       AND sb.bahan_baku_id = sub_rec.bahan_baku_pengganti_id;

    CONTINUE WHEN NOT FOUND;

    v_stock   := COALESCE(v_stock, 0);
    v_is_gram := COALESCE(v_is_gram, false);
    v_faktor  := COALESCE(v_faktor, 1);

    v_stock_kecil := CASE WHEN v_is_gram THEN v_stock ELSE v_stock * v_faktor END;
    CONTINUE WHEN v_stock_kecil <= 0;

    v_ambil_kecil := LEAST(v_stock_kecil, v_sisa_kecil);
    v_sisa_kecil  := v_sisa_kecil - v_ambil_kecil;

    v_qty_ledger := CASE WHEN v_is_gram THEN v_ambil_kecil ELSE v_ambil_kecil / v_faktor END;
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, sub_rec.bahan_baku_pengganti_id, 'pemakaian', -v_qty_ledger,
      p_catatan, p_ref_order_id, NOW()
    );
  END LOOP;

  -- ---------- sisa dipaksa ke bahan utama (boleh minus) ----------
  IF v_sisa_kecil > 0 THEN
    SELECT saldo_is_gram(sb), NULLIF(COALESCE(b.faktor_tampilan, 1), 0)
      INTO v_is_gram, v_faktor
      FROM public.stok_balance sb
      JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
     WHERE sb.outlet_id = p_outlet_id
       AND sb.bahan_baku_id = p_bahan_baku_id;

    IF NOT FOUND THEN
      v_is_gram := false; v_faktor := v_faktor_utama;
    END IF;
    v_is_gram := COALESCE(v_is_gram, false);
    v_faktor  := COALESCE(v_faktor, 1);

    v_qty_ledger := CASE WHEN v_is_gram THEN v_sisa_kecil ELSE v_sisa_kecil / v_faktor END;
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
    ) VALUES (
      p_outlet_id, p_bahan_baku_id, 'pemakaian', -v_qty_ledger, p_catatan, p_ref_order_id, NOW()
    );
    v_sisa_kecil := 0;
  END IF;
END;
$function$;

-- CREATE OR REPLACE tidak mereset hak akses, tapi ditegaskan ulang agar
-- migration ini aman dijalankan di environment yang belum pernah kena
-- 20300104000005.
REVOKE ALL ON FUNCTION public.process_waterfall_deduction(uuid, uuid, numeric, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- DOWN:
-- Jalankan ulang blok CREATE OR REPLACE dari
-- supabase/migrations/20300105000017_scale_aware_ledger_writers.sql.
-- Itu mengembalikan bug 1,375x -- hanya lakukan bila perbaikan ini terbukti
-- merusak sesuatu yang lebih besar.
