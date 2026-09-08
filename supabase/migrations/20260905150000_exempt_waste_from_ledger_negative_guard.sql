-- 20260905150000_exempt_waste_from_ledger_negative_guard.sql
--
-- MASALAH:
-- Persetujuan laporan waste (stok_waste_reports -> APPROVED) gagal dengan error:
--   "Stok [bahan] tidak cukup: saldo saat ini [x], pengurangan [y]"
-- jika saldo stok di sistem lebih kecil dari kuantitas waste yang dilaporkan.
--
-- ROOT CAUSE:
-- 1. Laporan waste diajukan saat bahan rusak/basi fisik terjadi (misal malam hari).
--    Namun persetujuan oleh Leader/Area Manager seringkali baru dilakukan setelah
--    penjualan POS (pemakaian) terus berjalan, memotong saldo stok hingga berada di
--    bawah kuantitas waste yang diajukan.
-- 2. Fungsi trigger ledger_stamp_saldo() memiliki guard saldo negatif:
--      IF NEW.qty < 0 AND NEW.saldo_sesudah < 0 AND NEW.tipe NOT IN (...)
--    yang mengecualikan 'pemakaian', 'opname_selisih', 'rejected_kiriman', dan 'terima_kiriman'.
--    Tipe 'waste' adalah pencatatan kejadian fisik nyata (barang rusak/basi terbuang),
--    sehingga tidak boleh diblokir agar nilai kerugian waste tercatat di Laba Rugi.
-- 3. Format pesan error lama langsung mengambil satuan master (misal 'kg') untuk
--    angka yang tersimpan dalam gram pada outlet yang saldo_is_gram, sehingga
--    menampilkan teks ambigu seperti "saldo saat ini 583 kg, pengurangan 1000 kg"
--    padahal angka sebenarnya adalah 583 gram dan 1000 gram.
--
-- SOLUSI:
-- 1. Tambahkan tipe 'waste' ke daftar pengecualian no-negative-balance guard di ledger_stamp_saldo().
-- 2. Perbaiki formatting pesan error untuk tipe transaksi non-waste agar sadar skala
--    saldo_is_gram (mengonversi gram ke satuan master dengan membagi faktor_tampilan).

CREATE OR REPLACE FUNCTION public.ledger_stamp_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_saldo NUMERIC;
  bahan_nama TEXT;
  bahan_satuan TEXT;
  v_faktor NUMERIC;
  v_is_gram BOOLEAN;
  v_disp_saldo NUMERIC;
  v_disp_qty NUMERIC;
BEGIN
  -- Increment atomik: ON CONFLICT memegang row-lock stok_balance
  INSERT INTO stok_balance (outlet_id, bahan_baku_id, saldo, updated_at)
  VALUES (NEW.outlet_id, NEW.bahan_baku_id, NEW.qty, NOW())
  ON CONFLICT (outlet_id, bahan_baku_id)
  DO UPDATE SET saldo = stok_balance.saldo + NEW.qty, updated_at = NOW()
  RETURNING saldo INTO new_saldo;

  NEW.saldo_sesudah := new_saldo;
  NEW.saldo_sebelum := new_saldo - NEW.qty;

  -- Guard no-negative-balance -- HANYA relevan untuk pengurangan (qty < 0).
  -- Insert qty >= 0 (restore/adjustment naik/terima_kiriman/dll) tidak pernah
  -- bisa memperburuk stok, jadi tidak pernah diblokir di sini, terlepas dari
  -- tipe atau seberapa minus saldo saat ini.
  -- Dikecualikan dari sisi tipe (untuk qty < 0):
  -- - 'pemakaian' (penjualan POS tak boleh gagal)
  -- - 'opname_selisih' (merekam kondisi fisik nyata)
  -- - 'rejected_kiriman' (merekam kondisi fisik nyata retur/tolak)
  -- - 'terima_kiriman' (penambahan stok)
  -- - 'waste' (merekam kondisi fisik nyata bahan rusak/basi yang dibuang)
  IF NEW.qty < 0
    AND NEW.saldo_sesudah < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman', 'pemakaian', 'terima_kiriman', 'waste')
  THEN
    SELECT b.nama, b.satuan, b.faktor_tampilan, public.saldo_is_gram(sb)
    INTO bahan_nama, bahan_satuan, v_faktor, v_is_gram
    FROM public.bahan_baku b
    LEFT JOIN public.stok_balance sb
      ON sb.outlet_id = NEW.outlet_id AND sb.bahan_baku_id = NEW.bahan_baku_id
    WHERE b.id = NEW.bahan_baku_id;

    IF v_is_gram AND v_faktor IS NOT NULL AND v_faktor > 0 THEN
      v_disp_saldo := trim_scale(NEW.saldo_sebelum / v_faktor);
      v_disp_qty   := trim_scale(ABS(NEW.qty) / v_faktor);
    ELSE
      v_disp_saldo := trim_scale(NEW.saldo_sebelum);
      v_disp_qty   := trim_scale(ABS(NEW.qty));
    END IF;

    RAISE EXCEPTION 'Stok "%" tidak cukup: saldo saat ini % %, pengurangan % %',
      bahan_nama, v_disp_saldo, bahan_satuan,
      v_disp_qty, bahan_satuan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;
