-- Snapshot total_cogs Owner Dashboard per periode × outlet. Dijalankan sebagai postgres
-- (auth.uid() NULL → akses penuh). Output deterministik agar bisa di-diff.
--
-- ⚠️ JANGAN JALANKAN BERKAS INI SEBAGAI SATU PANGGILAN CLI. Query ini adalah
-- definisi KANONIK (dipakai sebagai dokumentasi/acuan logika saja) — CROSS
-- JOIN 2 periode × 31 target outlet = 62 pemanggilan get_owner_dashboard_summary
-- dalam SATU statement. Tiap pemanggilan fungsi sendiri cepat (~200-600ms),
-- tapi menjalankan ke-62-nya sekaligus lewat `supabase db query --linked -f`
-- melebihi batas keras gateway Management API Supabase (~100 detik per
-- panggilan HTTP, via Cloudflare — 524 timeout) SEBELUM statement_timeout
-- Postgres sempat jadi masalah. Menaikkan statement_timeout TIDAK menolong;
-- itu bukan penyebabnya.
--
-- Cara menjalankan yang benar: `bash jalankan_baseline.sh <label>` — memecah
-- query ini per periode (baseline_owner_2026-08.sql, baseline_owner_2026-09.sql,
-- logikanya identik dengan berkas ini, hanya periode dipatok) sehingga tiap
-- panggilan CLI hanya CROSS JOIN 31 outlet (~10-17 detik, aman di bawah batas
-- gateway), lalu menggabung `rows` hasilnya (Agustus dulu, baru September —
-- sama dengan ORDER BY 1,2 di bawah karena '2026-08' < '2026-09-01..24'
-- secara leksikal).
WITH periode(nama, dari, sampai) AS (VALUES
  ('2026-08',        timestamptz '2026-08-01 00:00:00+07', timestamptz '2026-08-31 23:59:59.999+07'),
  ('2026-09-01..24', timestamptz '2026-09-01 00:00:00+07', timestamptz '2026-09-24 23:59:59.999+07')
),
target AS (
  SELECT NULL::uuid AS outlet_id, '~SEMUA' AS outlet
  UNION ALL
  SELECT o.id, o.name || ' [' || o.id || ']' FROM public.outlets o
)
SELECT p.nama AS periode, t.outlet,
       public.get_owner_dashboard_summary(p.dari, p.sampai, t.outlet_id) ->> 'total_cogs' AS total_cogs
FROM periode p CROSS JOIN target t
ORDER BY 1, 2;
