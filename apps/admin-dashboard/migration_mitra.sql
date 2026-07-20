-- ============================================================
-- MITRA DASHBOARD MIGRATION
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Profil mitra (1 mitra bisa banyak outlet)
CREATE TABLE IF NOT EXISTS mitra_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_mitra  text NOT NULL,
  outlet_ids  uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Data investasi per outlet
CREATE TABLE IF NOT EXISTS mitra_investments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id        uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  nilai_investasi  numeric(15,2) NOT NULL DEFAULT 0,
  tanggal_mulai    date NOT NULL,
  catatan          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outlet_id)
);

-- 3. Bukti transfer bulanan (admin upload)
CREATE TABLE IF NOT EXISTS mitra_transfers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id  uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  bulan      date NOT NULL,
  nominal    numeric(15,2) NOT NULL,
  bukti_url  text NOT NULL,
  catatan    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outlet_id, bulan)
);

-- 4. Saran dari mitra
CREATE TABLE IF NOT EXISTS mitra_suggestions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  outlet_id  uuid REFERENCES outlets(id),
  isi_saran  text NOT NULL,
  status     text NOT NULL DEFAULT 'baru'
             CHECK (status IN ('baru', 'dibaca', 'ditanggapi')),
  tanggapan  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE mitra_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitra_investments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitra_transfers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitra_suggestions  ENABLE ROW LEVEL SECURITY;

-- mitra_profiles
CREATE POLICY "mitra_profiles_select_own" ON mitra_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mitra_profiles_admin_all" ON mitra_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
  );

-- mitra_investments
CREATE POLICY "mitra_investments_select_own" ON mitra_investments
  FOR SELECT USING (
    outlet_id = ANY(SELECT unnest(outlet_ids) FROM mitra_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "mitra_investments_admin_all" ON mitra_investments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
  );

-- mitra_transfers
CREATE POLICY "mitra_transfers_select_own" ON mitra_transfers
  FOR SELECT USING (
    outlet_id = ANY(SELECT unnest(outlet_ids) FROM mitra_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "mitra_transfers_admin_all" ON mitra_transfers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
  );

-- mitra_suggestions
CREATE POLICY "mitra_suggestions_select_own" ON mitra_suggestions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mitra_suggestions_insert_own" ON mitra_suggestions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mitra_suggestions_admin_all" ON mitra_suggestions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
  );

-- ============================================================
-- STORAGE POLICIES (jalankan setelah buat bucket 'mitra-transfers')
-- ============================================================

CREATE POLICY "admin_upload_mitra_transfers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mitra-transfers'
    AND EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
  );

CREATE POLICY "mitra_download_own_transfers" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mitra-transfers'
    AND (
      EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
      OR split_part(name,'/',1)::uuid = ANY(
        SELECT unnest(outlet_ids) FROM mitra_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "admin_delete_mitra_transfers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mitra-transfers'
    AND EXISTS (SELECT 1 FROM outlet_staff WHERE outlet_staff.id = auth.uid() AND outlet_staff.role IN ('admin','owner'))
  );
