-- Ganti Satuan — perbaikan review I1: pratinjau melaporkan aktivitas stok terbaru.
-- Transaksi stok yang berjalan bersamaan dengan ganti satuan (penjualan/BOM, verifikasi SJ,
-- approval waste) membaca faktor/resep LAMA, menunggu kunci stok_balance, lalu menulis angka
-- skala lama SESUDAH konversi selesai — baris ledger itu tak ikut dikonversi. Database tak bisa
-- mencegahnya tanpa menghentikan semua penulis; mitigasinya: layar memperingatkan bila bahan
-- bergerak dalam 15 menit terakhir, dan runbook mewajibkan ganti satuan di luar jam operasional.
-- Uji: supabase/verifikasi/ganti_satuan/t5_aktivitas.sql.
DO $do$
DECLARE v_def text; v_baru text;
BEGIN
  v_def := pg_get_functiondef('public.pratinjau_ganti_satuan(uuid,jsonb,numeric)'::regprocedure);
  v_baru := replace(v_def,
    $a$'harga_master_baru', v_harga / v_kb);$a$,
    $b$'harga_master_baru', v_harga / v_kb,
    -- Review I1: transaksi stok yang berjalan bersamaan dengan ganti satuan membaca faktor lama
    -- lalu menulis angka skala lama sesudah konversi. Layar memperingatkan bila bahan sedang bergerak.
    'aktivitas_15_menit', (SELECT count(*) FROM public.ledger_stok
                            WHERE bahan_baku_id = p_bahan AND created_at > now() - interval '15 minutes'));$b$);
  IF v_baru = v_def THEN RAISE EXCEPTION 'pola tidak ditemukan'; END IF;
  EXECUTE v_baru;
END $do$;
