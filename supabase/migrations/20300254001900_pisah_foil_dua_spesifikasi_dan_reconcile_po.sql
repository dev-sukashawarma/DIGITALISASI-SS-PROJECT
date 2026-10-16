-- 20300254001900_pisah_foil_dua_spesifikasi_dan_reconcile_po.sql
--
-- Pemisahan Bahan FOIL berdasarkan spesifikasi (FOIL 5M vs FOIL 7,6M),
-- penyiapan substitusi bertingkat (FOIL 5M -> FOIL 7,6M),
-- pembaruan katalog supplier (Altindo -> 5M, Ekadharma -> 7,6M),
-- pemolesan trigger cek_isi_kemasan_vendor,
-- rekonsiliasi PO Oktober (PO/KITCHEN/20261008/0001 diterima resmi, PO duplikat dibatalkan),
-- serta pembersihan saldo terjebak FOIL (48) nonaktif di Gudang Pusat.

BEGIN;

-- 1. Beri izin ubah faktor_tampilan pada bahan baku yang sudah punya riwayat stok
SET LOCAL app.ganti_satuan = 'on';

-- 2. Update Master Bahan Baku FOIL lama (4804d1fc-f06c-4306-adfd-a798bda1275a) menjadi FOIL 5M
--    Faktor: 48 roll/dus, 500 cm/roll -> 24.000 cm/dus
UPDATE public.bahan_baku
   SET nama = 'FOIL 5M',
       satuan = 'Dus',
       satuan_tengah = 'Roll',
       satuan_kecil = 'cm',
       faktor_tengah = 48,
       faktor_tampilan = 24000,
       satuan_po = 'roll',
       satuan_distribusi = 'roll'
 WHERE id = '4804d1fc-f06c-4306-adfd-a798bda1275a';

-- 3. Update Master Harga Bahan Baku FOIL 5M (48 roll x Rp 8.791,2 = Rp 421.977,6 / Dus)
UPDATE public.bahan_baku_harga
   SET kemasan_qty = 24000,
       kemasan_satuan = 'cm',
       harga_beli = 421977.6,
       harga_beli_display = 421977.6,
       harga_updated_at = now()
 WHERE bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a';

-- 4. Buat Master Bahan Baku FOIL 7,6M baru (id: 8c1b5a2e-7600-4a88-b500-f01176000000) untuk Ekadharma
--    Faktor: 48 roll/dus, 760 cm/roll -> 36.480 cm/dus
INSERT INTO public.bahan_baku (
  id, nama, satuan, satuan_tengah, satuan_kecil,
  faktor_tengah, faktor_tampilan, satuan_po, satuan_distribusi,
  kategori, peruntukan, is_active, is_opname, is_fisik_checked,
  default_reorder_point, threshold_type
) VALUES (
  '8c1b5a2e-7600-4a88-b500-f01176000000',
  'FOIL 7,6M',
  'Dus',
  'Roll',
  'cm',
  48,
  36480,
  'roll',
  'roll',
  'PACKAGING',
  'keduanya',
  true,
  true,
  true,
  1,
  'angka'
) ON CONFLICT (id) DO UPDATE
  SET nama = EXCLUDED.nama,
      faktor_tengah = EXCLUDED.faktor_tengah,
      faktor_tampilan = EXCLUDED.faktor_tampilan,
      satuan_po = EXCLUDED.satuan_po,
      satuan_distribusi = EXCLUDED.satuan_distribusi,
      is_active = true;

-- 5. Buat Master Harga Bahan Baku FOIL 7,6M (48 roll x Rp 11.554 = Rp 554.592 / Dus)
INSERT INTO public.bahan_baku_harga (
  bahan_baku_id, kemasan_qty, kemasan_satuan, harga_beli, harga_beli_display, harga_updated_at
) VALUES (
  '8c1b5a2e-7600-4a88-b500-f01176000000',
  36480,
  'cm',
  554592,
  554592,
  now()
) ON CONFLICT (bahan_baku_id) DO UPDATE
  SET kemasan_qty = EXCLUDED.kemasan_qty,
      harga_beli = EXCLUDED.harga_beli,
      harga_beli_display = EXCLUDED.harga_beli_display,
      harga_updated_at = now();

-- 6. Pasang Substitusi: FOIL 5M (utama) -> FOIL 7,6M (pengganti urutan 1)
INSERT INTO public.bahan_baku_substitusi (
  bahan_baku_utama_id, bahan_baku_pengganti_id, urutan
) VALUES (
  '4804d1fc-f06c-4306-adfd-a798bda1275a',
  '8c1b5a2e-7600-4a88-b500-f01176000000',
  1
) ON CONFLICT DO NOTHING;

-- 7. Hubungkan Katalog Supplier:
--    - Ekadharma (94ccc4a9-700d-404b-a7e8-f103a382bc24) diarahkan ke FOIL 7,6M
--    - Altindo (105edc3f-3f75-41bf-8314-6d02a1982b98) diarahkan ke FOIL 5M
DELETE FROM public.bahan_baku_supplier
 WHERE bahan_baku_id = '8c1b5a2e-7600-4a88-b500-f01176000000'
   AND supplier_id = '94ccc4a9-700d-404b-a7e8-f103a382bc24';

UPDATE public.bahan_baku_supplier
   SET bahan_baku_id = '8c1b5a2e-7600-4a88-b500-f01176000000',
       satuan_beli = 'roll',
       isi_satuan_kecil = 760,
       harga = 11554,
       is_active = true,
       perlu_ditinjau = false,
       sumber = 'manual',
       harga_updated_at = now()
 WHERE bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a'
   AND supplier_id = '94ccc4a9-700d-404b-a7e8-f103a382bc24';

UPDATE public.bahan_baku_supplier
   SET satuan_beli = 'roll',
       isi_satuan_kecil = 500,
       harga = 8791,
       is_active = true,
       perlu_ditinjau = false,
       sumber = 'manual',
       harga_updated_at = now()
 WHERE bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a'
   AND supplier_id = '105edc3f-3f75-41bf-8314-6d02a1982b98';

UPDATE public.bahan_baku_supplier
   SET is_active = false
 WHERE bahan_baku_id = 'fb243647-dd20-4ef1-b739-921b0a7307d7'
   AND supplier_id = '105edc3f-3f75-41bf-8314-6d02a1982b98';

UPDATE public.supplier
   SET bahan_baku_ids = ARRAY['4804d1fc-f06c-4306-adfd-a798bda1275a'::uuid]
 WHERE id = '105edc3f-3f75-41bf-8314-6d02a1982b98';

UPDATE public.supplier
   SET bahan_baku_ids = ARRAY['8c1b5a2e-7600-4a88-b500-f01176000000'::uuid, '4a34763b-e2c6-42ad-9f75-3bd27fb05a17'::uuid]
 WHERE id = '94ccc4a9-700d-404b-a7e8-f103a382bc24';

-- 8. Poles trigger cek_isi_kemasan_vendor agar angka master tidak dicetak dengan 14 angka nol di belakang koma
CREATE OR REPLACE FUNCTION public.cek_isi_kemasan_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_supplier   uuid;
  v_nomor_po   text;
  v_satuan     text;
  v_isi_vendor numeric;
  v_isi_master numeric;
  v_nama       text;
  v_vendor     text;
BEGIN
  IF NEW.tipe <> 'pembelian_supplier' OR NEW.ref_po_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT po.supplier_id, po.nomor_po INTO v_supplier, v_nomor_po
    FROM public.purchase_order po WHERE po.id = NEW.ref_po_id;

  IF v_supplier IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(btrim(bs.satuan_beli)), bs.isi_satuan_kecil
    INTO v_satuan, v_isi_vendor
    FROM public.bahan_baku_supplier bs
   WHERE bs.bahan_baku_id = NEW.bahan_baku_id
     AND bs.supplier_id   = v_supplier
     AND bs.is_active;

  IF v_satuan IS NULL OR v_isi_vendor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.nama,
         CASE
           WHEN v_satuan = lower(btrim(b.satuan))        THEN b.faktor_tampilan
           WHEN v_satuan = lower(btrim(b.satuan_tengah)) THEN b.faktor_tampilan / NULLIF(b.faktor_tengah, 0)
           WHEN v_satuan = lower(btrim(b.satuan_kecil))  THEN 1
           ELSE NULL
         END
    INTO v_nama, v_isi_master
    FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id;

  IF v_isi_master IS NULL OR v_isi_master <= 0 THEN
    RETURN NEW;
  END IF;

  IF abs(v_isi_vendor - v_isi_master) / v_isi_master > 0.001 THEN
    SELECT s.nama INTO v_vendor FROM public.supplier s WHERE s.id = v_supplier;

    RAISE EXCEPTION
      'Isi kemasan vendor berbeda dari master: % dari % berisi % % per %, '
      'sedangkan master menghitung % % per %. PO % tidak bisa diterima ke bahan '
      'ini karena satu bahan hanya punya satu jembatan satuan -- mencatatnya '
      'akan salah % persen. Pecah dulu bahannya per SPESIFIKASI (bukan per merek), '
      'lalu terima ulang. Kalau justru isi di Katalog Harga Vendor yang keliru, '
      'perbaiki di sana. Lihat docs/superpowers/specs/2026-09-09-foil-dua-ukuran-design.md',
      v_nama, COALESCE(v_vendor, 'vendor'), v_isi_vendor,
      COALESCE((SELECT b.satuan_kecil FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id), 'satuan kecil'),
      v_satuan,
      round(v_isi_master, 2),
      COALESCE((SELECT b.satuan_kecil FROM public.bahan_baku b WHERE b.id = NEW.bahan_baku_id), 'satuan kecil'),
      v_satuan,
      COALESCE(v_nomor_po, '?'),
      round(abs(v_isi_vendor - v_isi_master) / v_isi_master * 100, 1)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- 9. Rekonsiliasi PO dan Stok Gudang Pusat
-- 9a. Batalkan PO darurat / duplikat
UPDATE public.purchase_order
   SET status = 'dibatalkan',
       catatan = COALESCE(catatan || ' | ', '') || 'Dibatalkan sistem: PO darurat workaround FOIL (48) digantikan oleh penyelesaian resmi PO/KITCHEN/20261008/0001.'
 WHERE id = '9209709c-97e1-424d-b611-2d32c47654ec';

UPDATE public.purchase_order
   SET status = 'dibatalkan',
       catatan = COALESCE(catatan || ' | ', '') || 'Dibatalkan sistem: Percobaan PO duplikat saat PO/KITCHEN/20261008/0001 tertahan isu isi kemasan.'
 WHERE id = 'c49de760-cb69-4821-ba0a-31bde4e559dc';

-- 9b. Bersihkan saldo terjebak FOIL (48) di Gudang Pusat (3.040.000 cm menjadi 0) lewat ledger_stok
INSERT INTO public.ledger_stok (
  outlet_id, bahan_baku_id, tipe, qty, catatan, created_by, created_at
) VALUES (
  'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90',
  'fb243647-dd20-4ef1-b739-921b0a7307d7',
  'adjustment',
  -3040000,
  'Penyesuaian saldo sistem: nolkan saldo FOIL (48) nonaktif (stok dipindahkan ke bahan resmi FOIL 5M)',
  '30c35a53-79a0-4be1-970b-3f1b66c76222',
  now()
);

-- 9c. Reconcile PO/KITCHEN/20261008/0001 (PO asli yang tertahan)
UPDATE public.purchase_order_item
   SET qty_pesan = 2000.0 / 48,
       harga_pesan = 421977.6,
       qty_terima = 2000.0 / 48,
       harga_terima = 421977.6,
       satuan_ad_hoc = 'Roll'
 WHERE purchase_order_id = 'f31e711f-6baa-4de2-b80f-0562e0acd662';

UPDATE public.purchase_order
   SET status = 'diterima_lengkap',
       diverifikasi_oleh = '30c35a53-79a0-4be1-970b-3f1b66c76222',
       diverifikasi_at = now(),
       updated_at = now()
 WHERE id = 'f31e711f-6baa-4de2-b80f-0562e0acd662';

-- 9d. Masukkan ledger penerimaan resmi PO/KITCHEN/20261008/0001 ke FOIL 5M di Gudang Pusat (+1.000.000 cm = 2000 Roll x 500 cm)
INSERT INTO public.ledger_stok (
  outlet_id, bahan_baku_id, tipe, qty, ref_po_id, catatan, created_by, created_at
) VALUES (
  'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90',
  '4804d1fc-f06c-4306-adfd-a798bda1275a',
  'pembelian_supplier',
  1000000,
  'f31e711f-6baa-4de2-b80f-0562e0acd662',
  'Terima PO PO/KITCHEN/20261008/0001 — FOIL 5M (2000 Roll)',
  '30c35a53-79a0-4be1-970b-3f1b66c76222',
  now()
);

-- Rapikan drift float minor pada saldo Gudang Pusat (9.44e-13) agar persis 1.000.000
UPDATE public.stok_balance
   SET saldo = 1000000.0,
       updated_at = now()
 WHERE outlet_id = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'
   AND bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a';

-- Inisialisasi baris stok_balance untuk FOIL 7,6M di Gudang Pusat
INSERT INTO public.stok_balance (
  outlet_id, bahan_baku_id, saldo, updated_at
) VALUES (
  'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90',
  '8c1b5a2e-7600-4a88-b500-f01176000000',
  0,
  now()
) ON CONFLICT (outlet_id, bahan_baku_id) DO NOTHING;

COMMIT;
