-- Biaya Xendit per pembayaran (spec 2026-11-18-biaya-xendit-rangkuman-penjualan).
-- Diisi saat file Balance History diunggah; dibaca Rangkuman Penjualan untuk kartu
-- Admin Fee pesanan website. NULL = belum diketahui (baris dari webhook yang belum
-- pernah ada di file) → laporan memakai estimasi tarif. RLS & grant tidak berubah.

ALTER TABLE public.xendit_pembayaran
  ADD COLUMN IF NOT EXISTS biaya_mdr numeric,
  ADD COLUMN IF NOT EXISTS biaya_proses numeric;

COMMENT ON COLUMN public.xendit_pembayaran.biaya_mdr IS
  'MDR + PPN (baris FEE/VAT ber-Transaction ID sama di Balance History). 0 = memang tak kena MDR. NULL = belum diketahui.';
COMMENT ON COLUMN public.xendit_pembayaran.biaya_proses IS
  'Processing Fee + PPN pembayaran ini (Rp 4.440 sejak 1 Okt 2026 WIB, 0 sebelumnya). NULL = belum diketahui.';
