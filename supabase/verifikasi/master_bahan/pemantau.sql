-- supabase/verifikasi/master_bahan/pemantau.sql — jalankan satu kueri per giliran.

-- Q1: pelanggar invarian faktor/kemasan (harus 0)
SELECT b.nama FROM bahan_baku b LEFT JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
 WHERE b.faktor_konversi IS DISTINCT FROM
       CASE WHEN b.satuan_kecil IS NULL THEN 1
            WHEN b.satuan_tengah IS NOT NULL THEN b.faktor_tampilan / b.faktor_tengah
            ELSE b.faktor_tampilan END
    OR (h.bahan_baku_id IS NOT NULL AND h.kemasan_qty IS DISTINCT FROM COALESCE(b.faktor_tampilan, 1));

-- Q2: daftar kerja "belum dikonfirmasi vendor" (harus turun ke 0 seiring purchasing bekerja)
SELECT nama, harga_master, harga_master_updated_at FROM bahan_baku_status_harga
 WHERE status = 'belum_dikonfirmasi' ORDER BY nama;

-- Q3: master yang menyimpang dari vendor terbaru (setelah penyelarasan harus 0; sebelum itu = daftar owner)
SELECT b.nama, h.harga_beli, t.harga_per_besar FROM bahan_baku b
  JOIN LATERAL harga_vendor_terpercaya(b.id) t ON true
  JOIN bahan_baku_harga h ON h.bahan_baku_id = b.id
 WHERE b.is_active AND abs(h.harga_beli - t.harga_per_besar) >= 0.01;

-- Q4: perubahan master 7 hari terakhir tanpa alasan (jalur lama yang belum pindah ke RPC)
SELECT tabel, aksi, changed_by, changed_at FROM master_bahan_audit
 WHERE alasan IS NULL AND changed_at > now() - interval '7 days' ORDER BY changed_at DESC;
