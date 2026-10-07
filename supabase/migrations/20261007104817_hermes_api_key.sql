-- Kunci API untuk Hermes Agent (bot divisi) + log panggilan.
-- Versi berkas = stempel yang dicatat apply_migration (20261007104817), diterapkan 2026-10-07.
-- Spec: docs/superpowers/specs/2026-10-07-hermes-api-design.md §5.
-- Hanya service role (route /api/hermes/* dan server action halaman admin) yang menyentuh tabel ini.

CREATE TABLE IF NOT EXISTS public.hermes_api_key (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 3 AND 60),
  prefix text NOT NULL UNIQUE CHECK (prefix ~ '^[0-9a-f]{8}$'),
  hash_kunci text NOT NULL CHECK (hash_kunci ~ '^[0-9a-f]{64}$'),
  scope text[] NOT NULL CHECK (
    cardinality(scope) > 0
    AND scope <@ ARRAY['penjualan','gudang','absensi','finance']::text[]
  ),
  ip_diizinkan text[] NOT NULL DEFAULT '{}',
  aktif boolean NOT NULL DEFAULT true,
  dibuat_oleh uuid REFERENCES public.outlet_staff(id),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  dicabut_at timestamptz,
  terakhir_dipakai_at timestamptz,
  CONSTRAINT hermes_api_key_dicabut_konsisten CHECK (aktif OR dicabut_at IS NOT NULL)
);

COMMENT ON TABLE public.hermes_api_key IS
  'Kunci per bot Hermes. Kunci asli hanya ditampilkan sekali; yang disimpan SHA-256. ip_diizinkan kosong = tolak semua.';

CREATE TABLE IF NOT EXISTS public.hermes_api_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kunci_id uuid REFERENCES public.hermes_api_key(id) ON DELETE SET NULL,
  prefix text,
  alat text,
  status text NOT NULL CHECK (status IN ('ok', 'galat', 'ditolak')),
  alasan text,
  ip text,
  durasi_ms integer,
  at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hermes_api_log IS 'Log panggilan Hermes. Tanpa isi jawaban.';

CREATE INDEX IF NOT EXISTS hermes_api_log_at_idx ON public.hermes_api_log (at DESC);
CREATE INDEX IF NOT EXISTS hermes_api_log_kunci_idx ON public.hermes_api_log (kunci_id, at DESC);

ALTER TABLE public.hermes_api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_api_log ENABLE ROW LEVEL SECURITY;

-- Default privileges Supabase memberi ALL ke tabel baru: cabut eksplisit.
REVOKE ALL ON TABLE public.hermes_api_key FROM anon, authenticated;
REVOKE ALL ON TABLE public.hermes_api_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.hermes_api_log_id_seq FROM anon, authenticated;
