-- supabase/migrations/20260923180000_peruntukan_is_opname_bahan_baku.sql
--
-- Mengambil alih berkas WIP 20300235000000_add_peruntukan_and_is_opname_bahan_baku.sql
-- (untracked, timestamp 2030 ditolak lint CI, tak pernah distempel) — spec
-- 2026-09-23 K9. Kedua kolom SUDAH ADA di produksi dan sudah disunting manual
-- (mis. GAS 12 KG = keduanya), jadi pengisian awal berbasis nama HANYA jalan bila
-- kolomnya baru dibuat saat ini juga (replay dari nol). Di produksi blok itu mati.

DO $$
DECLARE
  v_peruntukan_baru boolean;
  v_opname_baru boolean;
BEGIN
  v_peruntukan_baru := NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bahan_baku' AND column_name = 'peruntukan');
  v_opname_baru := NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bahan_baku' AND column_name = 'is_opname');

  ALTER TABLE public.bahan_baku
    ADD COLUMN IF NOT EXISTS peruntukan TEXT NOT NULL DEFAULT 'outlet',
    ADD COLUMN IF NOT EXISTS is_opname BOOLEAN NOT NULL DEFAULT true;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bahan_baku_peruntukan_check') THEN
    ALTER TABLE public.bahan_baku
      ADD CONSTRAINT bahan_baku_peruntukan_check
      CHECK (peruntukan IN ('outlet', 'gudang', 'keduanya'));
  END IF;

  IF v_opname_baru THEN
    UPDATE public.bahan_baku SET is_opname = false
     WHERE UPPER(TRIM(kategori)) IN ('ASET', 'PERLENGKAPAN')
        OR UPPER(TRIM(nama)) IN ('PRINTER THERMAL', 'ID CARD');
  END IF;

  IF v_peruntukan_baru THEN
    UPDATE public.bahan_baku SET peruntukan = 'gudang'
     WHERE UPPER(TRIM(nama)) IN ('GARAM', 'JINTEN', 'KAYU MANIS', 'KETUMBAR', 'KUNYIT', 'SASA', 'CENGKEH');
    UPDATE public.bahan_baku SET peruntukan = 'keduanya'
     WHERE UPPER(TRIM(nama)) IN (
       'SAOS CABE', 'SAOS TOMAT', 'SAOS SAMYANG', 'MAYONES',
       'KULIT 25', 'KULIT 28', 'KULIT 32',
       'AYAM', 'SAPI', 'KENTANG', 'KEJU', 'TUM', 'BAWANG', 'TEPUNG',
       'MINYAK SAYUR', 'FOIL', 'SARUNG TANGAN BENING', 'KERTAS STRUK',
       'PLASTIK BESAR', 'PLASTIK KECIL', 'PLASTIK VACUM', 'PLASTIK MERAH',
       'POLYBAG', 'PAPER WRAP', 'POWDER TEH', 'POWDER JERUK', 'POWDER MIX',
       'CUP + TUTUP', 'SEDOTAN', 'STIKER', 'GAS 12 KG');
  END IF;
END $$;
