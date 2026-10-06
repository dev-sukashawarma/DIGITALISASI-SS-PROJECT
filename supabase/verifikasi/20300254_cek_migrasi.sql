-- Cek baca-saja: apakah migrasi 20300254000000..400 sudah aktif di DB.
-- Tiap baris harus berstatus OK. Tidak mengubah data apa pun.
WITH fn AS (
  SELECT
    to_regprocedure('public.update_surat_jalan_item_vendor(uuid,uuid)')                 AS vendor,
    to_regprocedure('public.generate_surat_jalan_number(uuid)')                         AS gen_sj,
    to_regprocedure('public.nomor_urut_berikut(text,date)')                             AS nomor,
    to_regprocedure('public.ajukan_retur_stok(uuid,text,jsonb,text)')                   AS retur,
    to_regprocedure('public.verifikasi_kitchen_dan_buat_sj(uuid,jsonb,text,boolean)')   AS verif4,
    to_regprocedure('public.verifikasi_kitchen_dan_buat_sj(uuid,jsonb,text)')           AS verif3,
    to_regprocedure('public.finalize_surat_jalan_and_ledger(uuid)')                     AS finalize
)
SELECT cek, CASE WHEN lolos THEN 'OK' ELSE 'BELUM' END AS status
FROM fn, LATERAL (VALUES
  ('1 ganti vendor menggabung baris',
     pg_get_functiondef(vendor) LIKE '%item_dihapus%'),
  ('2 opname ditolak tidak mengunci hari',
     pg_get_indexdef('public.uniq_opname_harian_per_day'::regclass) LIKE '%rejected%'),
  ('3a tabel penghitung nomor ada',
     to_regclass('public.nomor_dokumen_urut') IS NOT NULL),
  ('3b nomor SJ pakai penghitung',
     pg_get_functiondef(gen_sj) LIKE '%nomor_urut_berikut%'),
  ('3c nomor retur pakai penghitung',
     pg_get_functiondef(retur) LIKE '%nomor_urut_berikut%'),
  ('3d klien tidak bisa membakar nomor',
     NOT has_function_privilege('anon', gen_sj, 'EXECUTE')
     AND NOT has_function_privilege('authenticated', nomor, 'EXECUTE')),
  ('4a SJ pengganti retur idempoten',
     pg_get_functiondef(verif4) LIKE '%sudah_diterbitkan%'),
  ('4b overload 3-argumen mendelegasikan',
     pg_get_functiondef(verif3) LIKE '%p_catatan, true)%'),
  ('5 finalisasi SJ mengunci baris',
     pg_get_functiondef(finalize) ~* 'where id = p_surat_jalan_id\s+for update')
) AS t(cek, lolos)
ORDER BY cek;
