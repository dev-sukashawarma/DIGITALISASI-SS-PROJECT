-- HPP "SS Online" hanya untuk marketplace (Shopee toko & TikTok Shop).
--
-- Keputusan owner 2026-09-28: channel_hpp.ss_online / shopee_shop / tiktok_shop
-- HANYA berlaku untuk marketplace. ShopeeFood & TikTok GO adalah food apps dan
-- memakai hpp_override biasa.
--
-- Bug: kondisi `v_norm_ch LIKE '%shopee%' OR LIKE '%tiktok%'` ikut menangkap
-- kanal order 'shopeefood' (dan 'tiktokgo'), sehingga HPP ShopeeFood di outlet
-- mitra memakai HPP SS Online yang 11–23% lebih murah. September 2026: HPP
-- mitra kurang Rp 17.574.728 → laba & bagi hasil mitra kelebihan sebesar itu.
-- Tabel `orders` tidak pernah memuat order marketplace (itu ada di
-- ecommerce_sales), jadi pencocokan persis tidak menghilangkan kasus sah apa pun.
--
-- Badan fungsi disalin dari definisi LIVE (20260925153000); hanya kondisi kanal
-- yang berubah. Sengaja TANPA `SET search_path` — memblokir inlining dan pernah
-- membuat ringkasan mitra timeout (lihat 20260925153000).
--
-- Salinan TypeScript yang harus tetap sepakat:
--   apps/admin-dashboard/src/lib/hpp/kanalSsOnline.ts
--   apps/finance/src/lib/hpp/kanalSsOnline.ts
--
-- ⚠️ Utang replay: 20300125000000_fix_mitra_pnl_omzet_acuan.sql juga
-- mendefinisikan fungsi ini dan terurut SESUDAH berkas ini (ranjau timestamp
-- 2030). Produksi aman karena berkas itu sudah terstempel; replay dari nol akan
-- memulihkan versi lama. Timestamp 2030 tidak dipakai karena ditolak
-- scripts/migration-timestamp-lint.mjs (preseden 2026-09-09).

CREATE OR REPLACE FUNCTION public.get_mitra_item_hpp_base(p_menu_item_id uuid, p_channel text, p_tanggal date DEFAULT NULL::date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
  DECLARE
      v_base_hpp numeric := 0;
      v_is_package boolean;
      v_hpp_override numeric;
      v_channel_hpp jsonb;
      v_norm_ch text := lower(btrim(p_channel));
      v_ch_val numeric;
      v_pkg RECORD;
  BEGIN
      SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = p_menu_item_id;
      IF NOT FOUND THEN
          RETURN 0;
      END IF;

      -- Nilai HPP yang berlaku pada tanggal order (NULL = hari ini)
      SELECT h.hpp_override, h.channel_hpp INTO v_hpp_override, v_channel_hpp
      FROM public.menu_hpp_pada(p_menu_item_id, p_tanggal) h;

      IF v_channel_hpp IS NOT NULL AND v_norm_ch IS NOT NULL THEN
          -- Hanya marketplace (dicocokkan PERSIS, bukan LIKE).
          IF v_norm_ch IN ('ss-online', 'ss_online', 'shopee_shop', 'tiktok_shop',
                           'f3305089-b9e4-4b92-95da-14bf6e7fb6d5',   -- TikTokShop
                           'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584')   -- Shopee
          THEN
              v_ch_val := COALESCE(
                  (v_channel_hpp->>'ss_online')::numeric,
                  (v_channel_hpp->>'tiktok_shop')::numeric,
                  (v_channel_hpp->>'shopee_shop')::numeric,
                  (v_channel_hpp->>v_norm_ch)::numeric
              );
          ELSE
              v_ch_val := (v_channel_hpp->>v_norm_ch)::numeric;
          END IF;
      END IF;

      IF v_ch_val IS NOT NULL AND v_ch_val > 0 THEN
          v_base_hpp := v_ch_val;
      ELSIF v_hpp_override IS NOT NULL AND v_hpp_override > 0 THEN
          v_base_hpp := v_hpp_override;
      ELSIF v_is_package THEN
          -- Komponen paket selalu dihitung dari hpp_override bahan dasar (NULL channel)
          -- agar identik dengan useHpp.ts di Admin Dashboard (ProfitView)
          FOR v_pkg IN (
              SELECT menu_item_id, quantity
              FROM public.menu_packages
              WHERE package_id = p_menu_item_id
          ) LOOP
              v_base_hpp := v_base_hpp
                  + public.get_mitra_item_hpp_base(v_pkg.menu_item_id, NULL, p_tanggal)
                    * COALESCE(v_pkg.quantity, 1);
          END LOOP;
      END IF;

      RETURN v_base_hpp;
  END;
$function$;
