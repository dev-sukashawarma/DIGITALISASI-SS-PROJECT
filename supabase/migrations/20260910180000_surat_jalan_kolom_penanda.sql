-- 20260910180000_surat_jalan_kolom_penanda.sql
-- Dua penanda di surat_jalan, keduanya aditif dan nullable.
--
-- KENAPA PERLU
--   finalize_surat_jalan_and_ledger menulis catatan ledger yang sama persis
--   untuk semua verifikasi ('Auto-entry from surat jalan verification'). Tanpa
--   penanda di tabel induk, kiriman yang ditutup sistem tak bisa dibedakan dari
--   yang diverifikasi crew -- dan kalau opname outlet itu kemudian kurang,
--   selisihnya tak bisa ditelusuri asalnya.
--
-- DUA PENANDA, DUA FAKTA BERBEDA
--   auto_verified_at         : ditutup sistem karena lewat hari, stok DITULIS
--   ditutup_administratif_at : tunggakan ditutup sebagai dokumen, stok TIDAK
--                              ditulis sama sekali
--
--   Jangan digabung jadi satu kolom. Yang pertama menambah stok, yang kedua
--   tidak; membedakannya nanti dari satu kolom saja mustahil.
--
-- Spec: docs/superpowers/specs/2026-09-10-auto-verifikasi-surat-jalan-design.md
-- Idempoten.

ALTER TABLE public.surat_jalan
  ADD COLUMN IF NOT EXISTS auto_verified_at timestamptz;

ALTER TABLE public.surat_jalan
  ADD COLUMN IF NOT EXISTS ditutup_administratif_at timestamptz;

COMMENT ON COLUMN public.surat_jalan.auto_verified_at IS
  'Diisi saat SJ ditutup otomatis karena lewat hari. Stok outlet DITAMBAH lewat finalize_surat_jalan_and_ledger. NULL = diverifikasi manusia atau belum ditutup.';

COMMENT ON COLUMN public.surat_jalan.ditutup_administratif_at IS
  'Diisi saat SJ tunggakan ditutup sebagai dokumen saja. Stok TIDAK disentuh, karena barangnya sudah terserap opname. NULL = bukan penutupan administratif.';

-- DOWN:
-- ALTER TABLE public.surat_jalan DROP COLUMN IF EXISTS auto_verified_at;
-- ALTER TABLE public.surat_jalan DROP COLUMN IF EXISTS ditutup_administratif_at;
