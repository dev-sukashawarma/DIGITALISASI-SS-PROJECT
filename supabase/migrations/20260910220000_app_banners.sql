-- App Retail Tahap 2: banner promosi aplikasi pelanggan.
--
-- Dibaca gateway dengan service client (GET /api/v1/banners); ditulis
-- dashboard admin dengan sesi pengguna. Aplikasi Android TIDAK pernah
-- menyentuh tabel ini langsung.

CREATE TABLE IF NOT EXISTS public.app_banners (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot                text NOT NULL CHECK (slot IN ('carousel', 'popup')),
  urutan              integer NOT NULL DEFAULT 0,
  badge               text,
  judul               text NOT NULL,
  subjudul            text,
  teks_tombol         text,
  gambar_url          text,
  aksi                text NOT NULL DEFAULT 'tidak_ada'
                      CHECK (aksi IN ('tidak_ada', 'menu', 'menu_item')),
  target_menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  aktif               boolean NOT NULL DEFAULT false,
  dibuat_pada         timestamptz NOT NULL DEFAULT now(),
  diubah_pada         timestamptz NOT NULL DEFAULT now(),

  -- Target wajib ADA saat aksi 'menu_item', dan wajib KOSONG selain itu.
  -- Ditegakkan basis data: formulir bisa dilewati, CHECK tidak.
  CONSTRAINT app_banners_target_sesuai_aksi CHECK (
    (aksi = 'menu_item' AND target_menu_item_id IS NOT NULL)
    OR (aksi <> 'menu_item' AND target_menu_item_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS app_banners_slot_aktif_urutan_idx
  ON public.app_banners (slot, aktif, urutan);

-- Supabase memberi GRANT ALL ke anon & authenticated lewat default
-- privileges untuk setiap tabel baru. Menulis GRANT tidak membatasi apa
-- pun -- yang membatasi adalah REVOKE ini. (Pelajaran bahan_baku_supplier,
-- 2026-09-08.)
REVOKE ALL ON public.app_banners FROM anon, authenticated;

ALTER TABLE public.app_banners ENABLE ROW LEVEL SECURITY;

-- Satu policy tulis, role `admin` PERSIS -- pola menu_items_all_admin.
-- `owner` dan `admin_hr` adalah role berbeda dan sengaja tidak lolos.
-- NOL policy untuk anon: pelanggan membaca lewat gateway (service client),
-- bukan lewat RLS.
DROP POLICY IF EXISTS app_banners_all_admin ON public.app_banners;
CREATE POLICY app_banners_all_admin ON public.app_banners
  FOR ALL TO authenticated
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_banners TO authenticated;
