-- 20300120000000_fix_faktor_konversi_14_bahan.sql
--
-- KONTEKS: audit 2026-09-02 (pemicu: nilai waste Agustus terlihat janggal).
--
-- ATURAN KANONIK (ditetapkan 20300108000005):
--   Sistem satuan 3-tingkat: satuan (besar) -> satuan_tengah -> satuan_kecil.
--   faktor_tampilan = faktor PENUH (kecil per besar) = faktor_tengah * faktor_konversi.
--   faktor_konversi = porsi tengah->kecil saja.
--   trg_process_bom_stok memakai faktor_tampilan KETIKA faktor_tengah terisi,
--   dan JATUH KE faktor_konversi ketika faktor_tengah NULL.
--
-- MASALAH: 14 bahan aktif punya faktor_konversi = 1 (nilai placeholder), padahal
--   faktor penuhnya tersimpan di faktor_tampilan. Dua kelompok:
--
--   A. Punya faktor_tengah -> rantai putus (faktor_tengah * 1 != faktor_tampilan).
--      Belum merusak apa pun (BOM pakai faktor_tampilan untuk kelompok ini),
--      tapi master datanya salah dan menyesatkan pembaca berikutnya.
--
--   B. TANPA faktor_tengah -> RANJAU AKTIF. Karena faktor_tengah NULL, trigger BOM
--      jatuh ke cabang faktor_konversi = bagi 1, bukan bagi faktor penuh. Begitu
--      salah satu bahan ini dimasukkan ke resep, potongan stoknya langsung
--      kelebihan sebesar faktor penuh (mis. JINTEN: 1000x).
--
-- PREFLIGHT (diverifikasi ke DB live sebelum migration ini ditulis):
--   - 0 dari 14 bahan dipakai di resep_item -> BOM belum pernah terdampak,
--     tidak ada saldo historis yang perlu direkonsiliasi.
--   - calculate_bahan_baku_request / saran_qty pakai
--     COALESCE(faktor_tampilan, faktor_konversi, 1) -> tidak terpengaruh.
--   - to_ledger_scale() pakai faktor_tampilan -> ledger tidak terpengaruh.
--   - get_hpp_periode / estimasi_produksi / halaman resep hanya menyentuh bahan
--     yang ada di resep -> tidak terpengaruh.
--   - Semua nilai target adalah bilangan bulat (diverifikasi).
--
-- LINGKUP: HANYA memperbaiki master data faktor_konversi. TIDAK menyentuh
--   faktor_tampilan, faktor_tengah, harga_beli, saldo, maupun ledger.
--
-- CATATAN LANJUTAN (SENGAJA TIDAK DIKERJAKAN DI SINI):
--   sync_harga_beli_display() menghitung
--     harga_beli_display = harga_beli / faktor_konversi * kemasan_qty
--   dan hanya ter-trigger saat baris bahan_baku_harga di-tulis. Jadi migration ini
--   tidak mengubah harga_beli_display yang ada sekarang, TAPI update harga
--   berikutnya untuk bahan terdampak akan menghasilkan angka display berbeda.
--   Basis harga_beli (per satuan besar vs per satuan tengah) masih CAMPUR di data
--   dan menunggu konfirmasi owner -- lihat audit terpisah.

-- Kelompok A: punya faktor_tengah (faktor_konversi = faktor_tampilan / faktor_tengah)
UPDATE public.bahan_baku SET faktor_konversi =    72 WHERE nama = 'BAWANG PUTIH BUBUK' AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =  1000 WHERE nama = 'GALON AIR'          AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =   250 WHERE nama = 'GARAM'              AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =  1000 WHERE nama = 'KETUMBAR'           AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =    24 WHERE nama = 'KUNYIT'             AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =  1000 WHERE nama = 'MERICA'             AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =  1000 WHERE nama = 'SASA'               AND faktor_konversi = 1;

-- Kelompok B: tanpa faktor_tengah (faktor_konversi = faktor_tampilan)
UPDATE public.bahan_baku SET faktor_konversi =  1000 WHERE nama = 'CENGKEH'            AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =    24 WHERE nama = 'Cling Wrap'         AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =  1000 WHERE nama = 'JINTEN'             AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =  1000 WHERE nama = 'KAYU MANIS'         AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =    10 WHERE nama = 'KERTAS STRUK'       AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =   250 WHERE nama = 'SABUN'              AND faktor_konversi = 1;
UPDATE public.bahan_baku SET faktor_konversi =   250 WHERE nama = 'SEDOTAN'            AND faktor_konversi = 1;
