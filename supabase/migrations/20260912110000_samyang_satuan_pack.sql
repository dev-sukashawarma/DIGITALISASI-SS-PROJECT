-- 20260912110000_samyang_satuan_pack.sql
--
-- SAOS SAMYANG: satuan TENGAH diperbaiki dari "Kg" menjadi "Pack".
--
-- Kenyataan lapangan (dikonfirmasi owner 2026-09-12): satuan PO-nya Dus,
-- 1 Dus = 20 pack, 1 pack = 250 gram. Jadi isi per Dus tetap 5.000 gram —
-- yang salah hanya tingkat tengahnya, yang selama ini tertulis "Kg" (5 per Dus).
-- Crew menghitung dalam pack, sementara form menawarkan Kg.
--
-- ============================================================================
-- KENAPA INI AMAN (beda dengan kasus FOIL ganti satuan Dus, 8 Sep)
-- ============================================================================
--
-- `faktor_tampilan` = 5.000 gram per Dus TIDAK BERUBAH. Itu satu-satunya
-- jembatan satuan-besar -> satuan-kecil, dipakai `to_ledger_scale()` dan
-- `trg_process_bom_stok`. Karena tak bergeser:
--   * seluruh `stok_balance` (gram) tetap sah,
--   * seluruh riwayat `ledger_stok` tetap sah,
--   * `surat_jalan_item.qty_dikirim` (disimpan dalam satuan BESAR/Dus) tetap
--     berarti sama — 18 surat jalan draft/dikirim yang memuat bahan ini tidak
--     perlu dikonversi. Inilah bedanya dengan FOIL, yang dulu mengubah
--     `faktor_tampilan` sehingga 26 baris SJ harus dibagi 48.
--   * `satuan_po`/`faktor_po` (dus / 5.000) tidak disentuh; harga beli
--     Rp 280.000 per Dus tetap benar.
--
-- `satuan_distribusi` sengaja DIBIARKAN 'kg'. Setelah satuan tengah bernama
-- Pack, `getDistribusiFactor()` tidak lagi cocok ke satuan tengah, tetapi
-- jatuh ke aturan implisit kg<->gram (`faktor_tampilan`/1000 = 5) — persis
-- angka yang berlaku sekarang. Jadi form surat jalan berperilaku sama.
-- Kalau kelak pengiriman mau dihitung per pack, ubah `satuan_distribusi`
-- menjadi 'pack' di migration tersendiri.
--
-- Draft opname yang menyimpan angka mentah bersatuan tengah lama: ada 7 baris,
-- semuanya milik opname draft 16 Agu - 7 Sep. Form hanya melanjutkan draft
-- HARI INI, jadi tak satu pun akan dibuka lagi.

SET lock_timeout = '5s';

DO $$
DECLARE
  v_saldo_sebelum numeric;
  v_saldo_sesudah numeric;
  v_id uuid;
  r record;
BEGIN
  SELECT id INTO v_id FROM public.bahan_baku WHERE nama = 'SAOS SAMYANG';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'SAOS SAMYANG tidak ditemukan';
  END IF;

  SELECT COALESCE(sum(saldo), 0) INTO v_saldo_sebelum
    FROM public.stok_balance WHERE bahan_baku_id = v_id;

  -- Idempoten + berpagar: hanya jalan bila masih konfigurasi lama, dan hanya
  -- bila isi per Dus memang 5.000 gram (kalau bukan, asumsinya sudah gugur).
  UPDATE public.bahan_baku
     SET satuan_tengah   = 'Pack',
         faktor_tengah   = 20,
         faktor_konversi = 250
   -- catatan: tabel bahan_baku tidak punya kolom updated_at
   WHERE id = v_id
     AND faktor_tampilan = 5000
     AND (satuan_tengah IS DISTINCT FROM 'Pack' OR faktor_tengah IS DISTINCT FROM 20
          OR faktor_konversi IS DISTINCT FROM 250);

  SELECT satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_konversi,
         faktor_tampilan, satuan_po, faktor_po
    INTO r
    FROM public.bahan_baku WHERE id = v_id;

  IF r.satuan_tengah <> 'Pack' OR r.faktor_tengah <> 20 OR r.faktor_konversi <> 250 THEN
    RAISE EXCEPTION 'Gagal: tengah=% faktor_tengah=% faktor_konversi=%',
      r.satuan_tengah, r.faktor_tengah, r.faktor_konversi;
  END IF;

  -- Yang WAJIB tidak bergeser.
  IF r.faktor_tampilan <> 5000 THEN
    RAISE EXCEPTION 'faktor_tampilan berubah jadi % — saldo & surat jalan jadi salah arti', r.faktor_tampilan;
  END IF;
  IF r.satuan <> 'Dus' OR lower(r.satuan_kecil) <> 'gram' THEN
    RAISE EXCEPTION 'satuan besar/kecil ikut berubah: % / %', r.satuan, r.satuan_kecil;
  END IF;
  IF r.satuan_po <> 'dus' OR r.faktor_po <> 5000 THEN
    RAISE EXCEPTION 'satuan_po/faktor_po ikut bergeser: % / %', r.satuan_po, r.faktor_po;
  END IF;
  IF (SELECT harga_beli FROM public.bahan_baku_harga WHERE bahan_baku_id = v_id) <> 280000 THEN
    RAISE EXCEPTION 'harga beli per Dus ikut bergeser';
  END IF;

  -- Saldo dibandingkan di dalam transaksi yang sama: stok bergerak terus
  -- (POS + surat jalan), jadi angka mutlak tak bisa dijadikan patokan.
  SELECT COALESCE(sum(saldo), 0) INTO v_saldo_sesudah
    FROM public.stok_balance WHERE bahan_baku_id = v_id;
  IF v_saldo_sesudah <> v_saldo_sebelum THEN
    RAISE EXCEPTION 'Saldo bergeser % -> % gram; perubahan satuan tak boleh menyentuh stok',
      v_saldo_sebelum, v_saldo_sesudah;
  END IF;
END $$;

-- DOWN:
-- UPDATE public.bahan_baku SET satuan_tengah='Kg', faktor_tengah=5, faktor_konversi=1000
--  WHERE nama='SAOS SAMYANG';
