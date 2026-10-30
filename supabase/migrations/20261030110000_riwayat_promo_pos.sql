-- Riwayat promo POS: kapan sebuah promo dinyalakan, dimatikan, diubah, atau
-- dilepas dari outlet — lengkap dengan jam.
--
-- outlet_promos hanya menyimpan keadaan SAAT INI, dan updated_at tidak
-- dipelihara trigger mana pun. Jadi sebelum migration ini tak ada cara
-- menjawab "promo ini aktif dari kapan sampai kapan". Tabel ini mencatat
-- setiap perubahan konfigurasi/status per baris outlet.
--
-- current_usage SENGAJA tidak memicu pencatatan: kolom itu bertambah tiap
-- order yang memakai promo (increment_promo_usage), jadi kalau ikut dicatat
-- tabel ini akan tumbuh satu baris per transaksi. Pemakaian dibaca dari
-- promo_redemptions lewat riwayat_pemakaian_promo() di bawah.
--
-- Penonaktifan otomatis oleh kasir saat kuota habis (UPDATE is_active=false
-- lewat service role) tercatat dengan diubah_oleh NULL = sistem.

CREATE TABLE IF NOT EXISTS public.outlet_promo_riwayat (
  id           bigserial PRIMARY KEY,
  promo_row_id uuid NOT NULL,           -- outlet_promos.id; tanpa FK agar baris yang dihapus tetap punya jejak
  outlet_id    uuid,
  scope        text NOT NULL,
  menu_item_id uuid,
  aksi         text NOT NULL CHECK (aksi IN ('awal', 'dibuat', 'dinyalakan', 'dimatikan', 'diubah', 'dilepas', 'dihapus')),
  is_active    boolean NOT NULL,
  is_assigned  boolean NOT NULL,
  konfigurasi  jsonb NOT NULL,          -- salinan baris saat itu (tanpa current_usage)
  diubah_pada  timestamptz NOT NULL DEFAULT now(),
  diubah_oleh  uuid                     -- auth.uid(); NULL = sistem / service role
);

CREATE INDEX IF NOT EXISTS outlet_promo_riwayat_waktu_idx ON public.outlet_promo_riwayat (diubah_pada DESC);
CREATE INDEX IF NOT EXISTS outlet_promo_riwayat_row_idx ON public.outlet_promo_riwayat (promo_row_id, diubah_pada);

ALTER TABLE public.outlet_promo_riwayat ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outlet_promo_riwayat FROM anon, authenticated;
GRANT SELECT ON public.outlet_promo_riwayat TO authenticated;

DROP POLICY IF EXISTS outlet_promo_riwayat_baca ON public.outlet_promo_riwayat;
CREATE POLICY outlet_promo_riwayat_baca ON public.outlet_promo_riwayat
  FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'owner', 'developer', 'marcom'));

CREATE OR REPLACE FUNCTION public.catat_riwayat_promo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baris outlet_promos;
  v_aksi  text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_baris := OLD;
    v_aksi := 'dihapus';
  ELSE
    v_baris := NEW;
    IF TG_OP = 'INSERT' THEN
      v_aksi := 'dibuat';
    ELSIF OLD.is_assigned IS DISTINCT FROM NEW.is_assigned AND NEW.is_assigned IS FALSE THEN
      v_aksi := 'dilepas';
    ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_aksi := CASE WHEN NEW.is_active THEN 'dinyalakan' ELSE 'dimatikan' END;
    ELSE
      v_aksi := 'diubah';
    END IF;
  END IF;

  INSERT INTO outlet_promo_riwayat
    (promo_row_id, outlet_id, scope, menu_item_id, aksi, is_active, is_assigned, konfigurasi, diubah_oleh)
  VALUES
    (v_baris.id, v_baris.outlet_id, v_baris.scope, v_baris.menu_item_id, v_aksi,
     COALESCE(v_baris.is_active, false), COALESCE(v_baris.is_assigned, true),
     to_jsonb(v_baris) - 'current_usage', auth.uid());

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_riwayat_promo_tambah_hapus ON public.outlet_promos;
CREATE TRIGGER trg_riwayat_promo_tambah_hapus
  AFTER INSERT OR DELETE ON public.outlet_promos
  FOR EACH ROW EXECUTE FUNCTION public.catat_riwayat_promo();

-- Daftar kolom sama dengan trigger kb_cs_promo_ubah, ditambah is_assigned &
-- quota_scope. current_usage / quota_pool_id / updated_at sengaja tidak ada.
DROP TRIGGER IF EXISTS trg_riwayat_promo_ubah ON public.outlet_promos;
CREATE TRIGGER trg_riwayat_promo_ubah
  AFTER UPDATE ON public.outlet_promos
  FOR EACH ROW
  WHEN (
       OLD.is_active IS DISTINCT FROM NEW.is_active
    OR OLD.is_assigned IS DISTINCT FROM NEW.is_assigned
    OR OLD.promo_name IS DISTINCT FROM NEW.promo_name
    OR OLD.scope IS DISTINCT FROM NEW.scope
    OR OLD.menu_item_id IS DISTINCT FROM NEW.menu_item_id
    OR OLD.discount_type IS DISTINCT FROM NEW.discount_type
    OR OLD.discount_value IS DISTINCT FROM NEW.discount_value
    OR OLD.min_purchase IS DISTINCT FROM NEW.min_purchase
    OR OLD.start_date IS DISTINCT FROM NEW.start_date
    OR OLD.end_date IS DISTINCT FROM NEW.end_date
    OR OLD.daily_start_time IS DISTINCT FROM NEW.daily_start_time
    OR OLD.daily_end_time IS DISTINCT FROM NEW.daily_end_time
    OR OLD.daily_schedule IS DISTINCT FROM NEW.daily_schedule
    OR OLD.buy_quantity IS DISTINCT FROM NEW.buy_quantity
    OR OLD.get_quantity IS DISTINCT FROM NEW.get_quantity
    OR OLD.reward_menu_item_id IS DISTINCT FROM NEW.reward_menu_item_id
    OR OLD.apply_to_food_apps IS DISTINCT FROM NEW.apply_to_food_apps
    OR OLD.outlet_id IS DISTINCT FROM NEW.outlet_id
    OR OLD.excluded_menu_item_ids IS DISTINCT FROM NEW.excluded_menu_item_ids
    OR OLD.usage_limit IS DISTINCT FROM NEW.usage_limit
    OR OLD.quota_scope IS DISTINCT FROM NEW.quota_scope
  )
  EXECUTE FUNCTION public.catat_riwayat_promo();

-- Titik awal untuk baris yang sudah ada: keadaan SAAT riwayat mulai dicatat,
-- ditanggali created_at baris itu. Layar menandainya sebagai "sebelum riwayat
-- dicatat" — konfigurasinya bisa saja sudah berubah sejak tanggal dibuat.
INSERT INTO public.outlet_promo_riwayat
  (promo_row_id, outlet_id, scope, menu_item_id, aksi, is_active, is_assigned, konfigurasi, diubah_pada, diubah_oleh)
SELECT p.id, p.outlet_id, p.scope, p.menu_item_id, 'awal',
       COALESCE(p.is_active, false), COALESCE(p.is_assigned, true),
       to_jsonb(p) - 'current_usage', COALESCE(p.created_at, now()), NULL
FROM public.outlet_promos p
WHERE NOT EXISTS (SELECT 1 FROM public.outlet_promo_riwayat r WHERE r.promo_row_id = p.id AND r.aksi = 'awal');

-- Waktu pemakaian per baris promo dari promo_redemptions (tabel itu hanya
-- bisa dibaca service role, jadi dibuka lewat fungsi ber-gerbang role).
-- Dikembalikan sebagai daftar waktu, bukan ringkasan, supaya layar bisa
-- membagi pemakaian tepat ke tiap periode aktif. Satu baris per promo, jadi
-- jumlah baris tetap jauh di bawah batas 1.000 PostgREST.
DROP FUNCTION IF EXISTS public.riwayat_pemakaian_promo();
CREATE FUNCTION public.riwayat_pemakaian_promo()
RETURNS TABLE (promo_id uuid, waktu timestamptz[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(get_user_role(), '') NOT IN ('admin', 'owner', 'developer', 'marcom') THEN
    RAISE EXCEPTION 'Tidak berhak membaca riwayat promo' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.promo_id, array_agg(r.created_at ORDER BY r.created_at)
    FROM promo_redemptions r
    WHERE r.promo_id IS NOT NULL
    GROUP BY r.promo_id;
END $$;

REVOKE ALL ON FUNCTION public.riwayat_pemakaian_promo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.riwayat_pemakaian_promo() TO authenticated;
