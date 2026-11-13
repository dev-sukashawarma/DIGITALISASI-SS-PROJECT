-- Pemantau kasbon dicairkan finance (spec 2026-11-13-kasbon-pencairan-finance-design.md).
-- Jalankan SATU kueri per giliran. Q1, Q3, Q4 harus 0 baris.
-- Ganti '2026-11-13' dengan tanggal migration 20261113140000 diterapkan bila berbeda.

-- Q1: kasbon aktif yang lahir sesudah alur baru tapi tidak pernah dicairkan finance (harus 0).
SELECT k.id, s.name, k.amount, k.status_hr, k.created_at
FROM cash_advances k LEFT JOIN outlet_staff s ON s.id = k.staff_id
WHERE k.status = 'active' AND k.status_hr = 'approved' AND k.dicairkan_at IS NULL
  AND k.approved_at >= '2026-11-13'
ORDER BY k.approved_at;

-- Q2: antrean pencairan (paling lama di atas); > 24 jam = perlu dikejar.
SELECT k.id, s.name, k.amount, k.approved_at,
       round(extract(epoch FROM now() - k.approved_at) / 3600) AS jam_menunggu
FROM cash_advances k LEFT JOIN outlet_staff s ON s.id = k.staff_id
WHERE k.status_hr = 'approved' AND k.status = 'menunggu_cair'
ORDER BY k.approved_at;

-- Q3: transaksi kasbon non-void yang kasbonnya tidak berjalan/lunas (harus 0).
SELECT t.id, t.amount, t.status, k.status AS status_kasbon, k.status_hr
FROM cash_transaction t LEFT JOIN cash_advances k ON k.id = t.source_id
WHERE t.source_type = 'kasbon' AND t.status <> 'void'
  AND (k.id IS NULL OR k.status NOT IN ('active', 'paid_off') OR k.cash_transaction_id IS DISTINCT FROM t.id);

-- Q4: cicilan pada kasbon yang belum dicairkan, sejak alur baru (harus 0).
SELECT p.id, p.cash_advance_id, p.amount, k.status
FROM cash_advance_payments p JOIN cash_advances k ON k.id = p.cash_advance_id
WHERE k.status <> 'active' AND k.status <> 'paid_off' AND p.created_at >= '2026-11-13';
