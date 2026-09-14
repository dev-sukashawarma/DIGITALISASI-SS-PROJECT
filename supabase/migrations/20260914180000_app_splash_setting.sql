-- App Retail: splash aplikasi pelanggan yang bisa diganti dari admin.
--
-- SATU baris saja (splash global, bukan per outlet). Kunci `id boolean`
-- dengan CHECK (id) membuat baris kedua mustahil: tak ada nilai lain yang
-- lolos CHECK itu, dan PRIMARY KEY menolak duplikat `true`.
--
-- Dibaca gateway dengan service client (GET /api/v1/splash); ditulis
-- dashboard admin dengan sesi pengguna. Aplikasi Android TIDAK pernah
-- menyentuh tabel ini langsung.
--
-- Gambar disimpan di bucket `app-banners` yang sudah ada (baca publik, tulis
-- role admin persis -- 20260912160000), di bawah awalan `splash/`.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.app_splash_setting (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- NULL = pakai gambar bawaan di dalam APK.
  gambar_url   text,
  -- Dibatasi 1-5 detik. Splash ditampilkan SETIAP kali aplikasi dibuka;
  -- lebih dari 5 detik sudah terasa seperti aplikasi macet.
  durasi_ms    integer NOT NULL DEFAULT 3000 CHECK (durasi_ms BETWEEN 1000 AND 5000),
  diubah_pada  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_splash_setting (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Default privileges Supabase memberi ALL ke anon & authenticated untuk tabel
-- baru. GRANT tidak membatasi apa pun; REVOKE inilah yang membatasi.
REVOKE ALL ON public.app_splash_setting FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.app_splash_setting TO authenticated;

ALTER TABLE public.app_splash_setting ENABLE ROW LEVEL SECURITY;

-- Tulis: role `admin` PERSIS, pola app_banners_all_admin. Hanya UPDATE:
-- barisnya sudah ada dan tak boleh dihapus atau ditambah dari aplikasi.
DROP POLICY IF EXISTS app_splash_update_admin ON public.app_splash_setting;
CREATE POLICY app_splash_update_admin ON public.app_splash_setting
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.status = 'active'
    )
  );

-- Baca: semua staf yang login. Isinya memang publik lewat gateway, dan tanpa
-- ini OWNER melihat halaman kosong yang tak bisa dibedakan dari galat.
DROP POLICY IF EXISTS app_splash_select_staff ON public.app_splash_setting;
CREATE POLICY app_splash_select_staff ON public.app_splash_setting
  FOR SELECT TO authenticated
  USING (true);
