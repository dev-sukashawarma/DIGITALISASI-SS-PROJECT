-- 20300125000000_finalize_opname_sadar_skala.sql
--
-- BELUM DITERAPKAN. Menunggu persetujuan — ini fungsi inti stok.
--
-- ============================================================================
-- MASALAH — dibuktikan lewat uji langsung di "outlet tes", 3 September 2026
-- ============================================================================
--
-- Sistem sedang di tengah migrasi skala satuan. Skala sebuah baris stok
-- ditentukan oleh:
--
--   saldo_is_gram(sb) = EXISTS(opname_selisih untuk (outlet,bahan)
--                              sejak 2026-08-01 20:32)
--
-- Baris yang sudah pernah di-opname menyimpan saldo dalam satuan KECIL;
-- yang belum, masih dalam satuan BESAR. Per 3 September: 981 sudah, 579 belum.
--
-- Form opname sadar skala — ia menampilkan qty_system dalam satuan kecil,
-- hasil konversi saldo tersimpan. Tapi finalize_opname menulis `selisih`
-- apa adanya ke ledger, dan ledger menambahkannya ke saldo yang masih
-- tersimpan dalam satuan besar. Dua satuan berbeda dijumlahkan.
--
-- UJI 1 — fisik pas, tanpa selisih:
--   AYAM outlet tes, saldo tersimpan 10 (satuan besar = 10 Kg)
--     qty_fisik 10.000   qty_system 10.000   selisih 0
--   -> selisih 0, tidak ada baris ledger ditulis
--   -> baris TIDAK pernah terkonversi, tetap 10
--
-- UJI 2 — fisik 9 Kg, ada selisih:
--     qty_fisik 9.000    qty_system 10.000   selisih -1.000
--   -> ledger opname_selisih -1.000
--   -> saldo = 10 + (-1.000) = -990
--   -> baris jadi gram-scale, jadi -990 dibaca sebagai -990 GRAM
--   Yang benar: 9.000 gram. Hasilnya -990. Meleset total, dan langsung minus.
--
-- Kedua uji itu menjelaskan kenapa migrasi mandek di 579 baris: opname TANPA
-- selisih tidak membalik skala (tak ada baris ledger), sedangkan opname DENGAN
-- selisih merusak angkanya. Barisnya terjebak di antara keduanya.
--
-- ============================================================================
-- PERBAIKAN
-- ============================================================================
--
-- Delta yang ditulis ke ledger harus membuat saldo SAMA DENGAN hitungan fisik:
--
--   delta = qty_fisik - saldo_tersimpan_apa_adanya
--
-- Untuk uji 2: 9.000 - 10 = 8.990  ->  saldo jadi 9.000  ✓
--
-- Rumus ini juga sekaligus mengonversi barisnya ke satuan kecil, karena baris
-- opname_selisih yang dihasilkan membalik saldo_is_gram() jadi true.
--
-- BATAS PERUBAHAN — sengaja sesempit mungkin:
--   - Baris yang SUDAH gram-scale (981 baris): perilaku TIDAK berubah sama
--     sekali, tetap menulis `selisih`. Nol risiko untuk yang sudah jalan benar.
--   - Baris yang BELUM gram-scale (579 baris): dipakai rumus re-baseline.
--     Perilaku sekarang untuk baris ini sudah pasti rusak, jadi tak ada yang
--     hilang.
--   - Syarat `selisih <> 0` diganti jadi `delta <> 0`. Tanpa ini, baris tanpa
--     selisih tak akan pernah terkonversi (uji 1).
--
-- CATATAN DESAIN yang perlu disadari: untuk baris belum-gram, delta dihitung
-- dari saldo SAAT FINALISASI, bukan qty_system yang dibekukan saat draft
-- dibuat. Artinya penjualan yang terjadi antara penghitungan fisik dan
-- penekanan tombol finalisasi ikut terserap. Untuk baris yang sedang
-- dikonversi itu justru diinginkan (opname = penetapan baseline baru), tapi
-- perilakunya memang berbeda dari jalur gram-scale.
--
-- Guard otorisasi, penguncian, dan pengecekan status TIDAK diubah.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_opname(p_opname_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_outlet   UUID;
  v_status   TEXT;
  v_caller   UUID := auth.uid();
  v_saldo    NUMERIC;
  v_is_gram  BOOLEAN;
  v_delta    NUMERIC;
  v_ada      BOOLEAN;
  r RECORD;
BEGIN
  SELECT outlet_id, status INTO v_outlet, v_status
    FROM opname WHERE id = p_opname_id FOR UPDATE;

  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'opname % not found', p_opname_id;
  END IF;
  IF v_status = 'finalized' THEN
    RAISE EXCEPTION 'opname % already finalized', p_opname_id;
  END IF;

  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM outlet_staff WHERE id = v_caller AND outlet_id = v_outlet
  ) THEN
    RAISE EXCEPTION 'not authorized for this outlet';
  END IF;

  FOR r IN
    SELECT bahan_baku_id, qty_fisik, selisih
    FROM opname_item
    WHERE opname_id = p_opname_id
      AND qty_fisik IS NOT NULL
  LOOP
    SELECT sb.saldo, public.saldo_is_gram(sb), TRUE
      INTO v_saldo, v_is_gram, v_ada
    FROM public.stok_balance sb
    WHERE sb.outlet_id = v_outlet
      AND sb.bahan_baku_id = r.bahan_baku_id;

    IF NOT FOUND THEN
      -- Belum punya baris saldo: hitungan fisik langsung jadi saldo pertama.
      v_delta := r.qty_fisik;
    ELSIF v_is_gram THEN
      -- Sudah berskala satuan kecil: perilaku lama, tidak diubah.
      v_delta := r.selisih;
    ELSE
      -- Masih berskala satuan besar: re-baseline ke hitungan fisik,
      -- sekaligus mengonversi barisnya.
      v_delta := r.qty_fisik - COALESCE(v_saldo, 0);
    END IF;

    IF v_delta IS NOT NULL AND v_delta <> 0 THEN
      INSERT INTO ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, ref_opname_id, created_by, catatan
      ) VALUES (
        v_outlet, r.bahan_baku_id, 'opname_selisih', v_delta,
        p_opname_id, v_caller, 'Auto dari finalize opname'
      );
    END IF;
  END LOOP;

  UPDATE opname SET status = 'finalized', updated_at = NOW() WHERE id = p_opname_id;
END;
$function$;


-- ============================================================================
-- VERIFIKASI SETELAH DITERAPKAN
-- ============================================================================
--
-- 1. Fungsinya tergantikan:
--      SELECT prosrc ILIKE '%re-baseline%' FROM pg_proc WHERE proname='finalize_opname';
--
-- 2. Uji ulang dengan pola yang sama di outlet tes. Ambil bahan yang BELUM
--    gram-scale, catat saldonya, opname dengan angka fisik yang berbeda dari
--    sistem, lalu pastikan saldo akhir SAMA PERSIS dengan angka fisik yang
--    dimasukkan -- bukan angka lain.
--
--      SELECT b.nama, public.saldo_is_gram(sb) AS gram, sb.saldo
--      FROM stok_balance sb JOIN bahan_baku b ON b.id = sb.bahan_baku_id
--      WHERE sb.outlet_id = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'::uuid
--        AND b.is_active AND b.faktor_tampilan > 1
--      ORDER BY public.saldo_is_gram(sb), b.nama;
--
-- 3. Pantau 579 baris yang belum terkonversi menyusut seiring outlet
--    melakukan opname rutin:
--
--      SELECT count(*) FILTER (WHERE public.saldo_is_gram(sb)) AS sudah,
--             count(*) FILTER (WHERE NOT public.saldo_is_gram(sb)) AS belum
--      FROM stok_balance sb;
-- ============================================================================
