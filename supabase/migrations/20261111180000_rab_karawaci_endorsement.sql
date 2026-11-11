-- Endorsement Mitra Karawaci ikut RAB selama periode RAB (s.d. 30 Nov 2026).
-- Koreksi keputusan owner 11 Nov 2026 atas 20261111170000: endorsement bukan
-- lagi pengecualian. Yang tetap OPEX: gas, PLN, PDAM, internet, utilitas, sewa.
-- 2 fee endorsement 10 Nov (Rp 400.000) sudah RAB; baris endorsement lain di
-- periode ini (bila ada) ikut dikonversi lewat trigger rab_otomatis_terapkan.

UPDATE public.rab_outlet_otomatis
SET kategori_kecuali = array_remove(kategori_kecuali, 'endorsement'),
    catatan = 'Opening Mitra Karawaci: ditanggung RAB s.d. akhir November 2026, termasuk endorsement (keputusan owner 11 Nov 2026)'
WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c'
  AND 'endorsement' = ANY (kategori_kecuali);

UPDATE public.expenses SET type = type
WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c'
  AND type = 'expense' AND lower(category) = 'endorsement'
  AND expense_date <= DATE '2026-11-30';

UPDATE public.petty_cash_expenses SET type = type
WHERE outlet_id = 'a85330a1-c150-4389-9a94-c23b66aaed7c'
  AND type = 'expense' AND lower(category) = 'endorsement'
  AND expense_date <= DATE '2026-11-30' AND deleted_at IS NULL;
