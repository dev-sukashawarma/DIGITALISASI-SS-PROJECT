-- Tipe outlet disederhanakan: outlet sungguhan hanya INTERNAL atau MITRA.
--
-- Keputusan owner 2026-10-03: "untuk tipe outlet hanya ada dua yaitu MITRA dan
-- INTERNAL". Disimpan huruf kecil ('internal' / 'mitra'); label huruf besar
-- urusan tampilan. 'mitra' sengaja TIDAK diubah ke 'MITRA': nilai itu dibaca
-- puluhan tempat (get_owner_dashboard_summary, bagi hasil mitra, HPP x1,1, dst).
--
-- 'outlet' -> 'internal'.
--
-- Baris lokasi NON-outlet (gudang, office, marketplace, system, test) TETAP
-- memakai tipenya: tipe itulah yang mengeluarkan mereka dari perhitungan
-- omzet/HPP/nilai persediaan (outlet_ids_terhitung, nilai_persediaan_spv,
-- valid_operational_outlets, penyaring di 9 app). Menjadikannya internal/mitra
-- akan memasukkan outlet tes, Shopee/TikTok Shop, dan Gudang Pusat ke laporan.
--
-- Sekalian: MITRA CILEUDUG (dibuat 3 Okt 08:38, 0 order) tersimpan 'MITRA '
-- (huruf besar + spasi) dari kolom isian bebas -> tidak terbaca sebagai mitra di
-- mana pun. CHECK di bawah mencegah salah ketik semacam itu terulang.

SET lock_timeout = '5s';

UPDATE public.outlets SET type = 'internal' WHERE type = 'outlet';
UPDATE public.outlets SET type = 'mitra'
 WHERE lower(btrim(type)) = 'mitra' AND type <> 'mitra';

ALTER TABLE public.outlets ALTER COLUMN type SET DEFAULT 'internal';
ALTER TABLE public.outlets ALTER COLUMN type SET NOT NULL;

ALTER TABLE public.outlets DROP CONSTRAINT IF EXISTS outlets_type_check;
ALTER TABLE public.outlets ADD CONSTRAINT outlets_type_check
  CHECK (type IN ('internal', 'mitra', 'gudang', 'office', 'marketplace', 'system', 'test'));

COMMENT ON COLUMN public.outlets.type IS
  'Outlet: internal | mitra. Lokasi non-outlet (dikecualikan dari laporan): gudang | office | marketplace | system | test.';

-- Satu-satunya objek DB yang membandingkan dengan 'outlet' (diperiksa:
-- pg_proc, pg_views, pg_policies). Definisi lain dipertahankan apa adanya.
CREATE OR REPLACE VIEW public.sales_board_outlets AS
 SELECT ou.id,
    ou.name
   FROM (outlets ou
     JOIN valid_operational_outlets vo ON ((vo.id = ou.id)))
  WHERE ((ou.is_active = true) AND (ou.type = ANY (ARRAY['internal'::text, 'mitra'::text])) AND (ou.slug <> 'ss-backup'::text));
