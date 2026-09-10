-- verifikasi-auto-sj-2026-09.sql
-- READ-ONLY. Pemantau auto-verifikasi surat jalan (hidup sejak 11 Sep 2026).
--
-- Jalankan berkala. Q2 dan Q3 yang paling penting: keduanya memberi tahu kalau
-- rancangannya berhasil merapikan catatan tapi GAGAL memperbaiki kebiasaan.

-- ==========================================================================
-- Q1. Apakah cron benar-benar jalan, dan jamnya masih benar?
-- ==========================================================================
-- schedule HARUS '0 19 * * *'. pg_cron memakai UTC; 19:00 UTC = 02:00 WIB
-- keesokan harinya. Kalau suatu saat berubah jadi '0 2 * * *', tenggatnya
-- diam-diam bergeser 7 jam.
SELECT jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'auto-verifikasi-surat-jalan';

SELECT d.start_time, d.status, d.return_message
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
 WHERE j.jobname = 'auto-verifikasi-surat-jalan'
 ORDER BY d.start_time DESC
 LIMIT 14;

-- ==========================================================================
-- Q2. Ditutup sistem vs diverifikasi crew, per hari
-- ==========================================================================
-- Kolom `ditutup_sistem` yang makin mendominasi = crew makin tidak
-- memverifikasi. Itu SINYAL YANG HARUS DITINDAK, bukan tanda fitur berhasil.
-- Fitur ini merapikan catatan; ia tidak membuat barang terlacak.
SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date            AS tgl,
       count(*)                                                  AS total_sj,
       count(*) FILTER (WHERE auto_verified_at IS NOT NULL)       AS ditutup_sistem,
       count(*) FILTER (WHERE auto_verified_at IS NULL
                          AND ditutup_administratif_at IS NULL
                          AND status <> 'dikirim')                AS diverifikasi_crew,
       count(*) FILTER (WHERE status = 'dikirim')                 AS masih_menggantung
  FROM public.surat_jalan
 WHERE created_at >= DATE '2026-09-11'
 GROUP BY 1
 ORDER BY 1 DESC;

-- ==========================================================================
-- Q3. Antrean validasi Pusat (role kitchen)
-- ==========================================================================
-- Auto-verifikasi sengaja berhenti di tahap 1 (outlet menerima). Tahap 2 --
-- Pusat memvalidasi & menutup jadi 'selesai' -- tetap milik manusia.
-- Kalau angka ini terus naik, bebannya cuma PINDAH dari 17 outlet ke satu meja
-- Pusat, bukan selesai. Itu kegagalan yang paling mungkin terjadi.
SELECT count(*)                              AS menunggu_validasi_pusat,
       min(created_at)::date                 AS tertua,
       count(*) FILTER (WHERE auto_verified_at IS NOT NULL) AS di_antaranya_dari_sistem
  FROM public.surat_jalan
 WHERE status IN ('diterima_lengkap', 'diterima_sebagian');

-- ==========================================================================
-- Q4. Sudah lewat hari tapi TIDAK diproses -- mandek diam-diam
-- ==========================================================================
-- Biasanya karena kena penjaga: ada bahan nonaktif di dalamnya, atau crew
-- sudah mengisi sebagian qty_terima lalu ditinggal. Kalau daftar ini tumbuh,
-- ada yang perlu ditangani manual.
SELECT sj.id,
       (sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl_kirim,
       o.name                                            AS outlet,
       EXISTS (SELECT 1 FROM public.surat_jalan_item i
                 JOIN public.bahan_baku b ON b.id = i.bahan_baku_id
                WHERE i.surat_jalan_id = sj.id AND b.is_active = false) AS ada_bahan_nonaktif,
       EXISTS (SELECT 1 FROM public.surat_jalan_item i
                WHERE i.surat_jalan_id = sj.id AND i.qty_terima IS NOT NULL) AS crew_isi_sebagian
  FROM public.surat_jalan sj
  JOIN public.outlets o ON o.id = sj.outlet_id
 WHERE sj.status = 'dikirim'
   AND sj.auto_verified_at IS NULL
   AND sj.ditutup_administratif_at IS NULL
   AND (sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date >= DATE '2026-09-11'
   AND ((((sj.updated_at AT TIME ZONE 'Asia/Jakarta') + interval '3 hours')::date)
        < (((now()        AT TIME ZONE 'Asia/Jakarta') + interval '3 hours')::date))
 ORDER BY sj.updated_at;

-- ==========================================================================
-- Q5. Penjaga forward-only masih utuh?
-- ==========================================================================
-- HARUS mengembalikan NOL. Kalau tidak, auto-verifikasi menyentuh kiriman
-- pra-11-September -- barang yang sudah terserap opname. Menambahkan stoknya
-- lagi = stok hantu, dan ini kelas kesalahan yang paling mahal di sini.
SELECT count(*) AS pelanggaran_forward_only
  FROM public.surat_jalan
 WHERE auto_verified_at IS NOT NULL
   AND (updated_at AT TIME ZONE 'Asia/Jakarta')::date < DATE '2026-09-11';

-- ==========================================================================
-- Q6. Penutupan administratif tidak boleh pernah menulis stok
-- ==========================================================================
-- HARUS NOL. Seluruh keputusan "tutup tanpa mengubah stok" bersandar pada ini.
SELECT count(*) AS baris_stok_dari_penutupan_administratif
  FROM public.ledger_stok l
  JOIN public.surat_jalan sj ON sj.id = l.ref_shipment_id
 WHERE sj.ditutup_administratif_at IS NOT NULL
   AND l.tipe = 'terima_kiriman';
