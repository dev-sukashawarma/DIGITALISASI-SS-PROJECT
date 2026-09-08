-- Koreksi saldo FOIL — samakan dengan hasil opname terakhir yang BENAR-BENAR dihitung.
-- 8 September 2026, atas instruksi owner ("sesuaikan dengan opname terakhir aja").
--
-- Tiga outlet mengetik "0 Roll" pada opname 6-7 Sep sehingga stoknya terhapus,
-- padahal barangnya masih ada. Target = angka fisik dari opname 5 September:
--
--   Pajajaran   81 Roll          = 61.560 cm   (opname 5 Sep 22:26)
--   Jagakarsa   36 Roll          = 27.360 cm   (opname 5 Sep 21:33)
--   Paledang    14 Roll +  7 cm  = 10.647 cm   (opname 5 Sep 22:20)
--
-- CATATAN: angka ini adalah hitungan fisik 5 Sep APA ADANYA -- pemakaian BOM
-- yang tercatat sesudahnya (Pajajaran 5,9 / Jagakarsa 8,1 / Paledang 6,9 Roll)
-- TIDAK dikurangkan, sesuai instruksi. Jadi saldo akan sedikit lebih tinggi
-- dari stok nyata sampai opname fisik berikutnya menyetel ulang.
--
-- SOP: perubahan stok lewat ledger_stok, JANGAN UPDATE stok_balance langsung.
-- Trigger ledger_stamp_saldo yang menghitung saldo. Delta dihitung dari saldo
-- live saat eksekusi, dan baris dengan delta 0 dilewati -- jadi menjalankan
-- skrip ini dua kali tidak menggandakan koreksi.
--
-- Di luar cakupan (sengaja): Cirendeu & Cibinong menunggu verifikasi surat
-- jalan 48 Roll yang menggantung; Kalisari & Cileungsi menunggu hitung fisik
-- ulang dengan kolom Dus; Cicurug nol-nya asli (nol pemakaian BOM).

INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
SELECT sb.outlet_id,
       sb.bahan_baku_id,
       'adjustment',
       t.target - sb.saldo,
       'Koreksi FOIL: samakan dengan opname 5 Sep 2026 (' || t.label || '). Opname 6-7 Sep terisi 0 Roll karena salah input.'
  FROM (VALUES
         ('550e8400-e29b-41d4-a716-446655440009'::uuid, 61560::numeric, '81 Roll'),
         ('550e8400-e29b-41d4-a716-446655440006'::uuid, 27360::numeric, '36 Roll'),
         ('550e8400-e29b-41d4-a716-446655440003'::uuid, 10647::numeric, '14 Roll + 7 cm')
       ) AS t(outlet_id, target, label)
  JOIN public.stok_balance sb
    ON sb.outlet_id = t.outlet_id
   AND sb.bahan_baku_id = '4804d1fc-f06c-4306-adfd-a798bda1275a'
 WHERE ROUND(t.target - sb.saldo, 4) <> 0;
