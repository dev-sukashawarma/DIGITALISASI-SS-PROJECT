-- 20260805100000_marketplace_virtual_outlets.sql
-- Outlet virtual untuk platform marketplace nasional (TikTok Shop, Shopee) yang TIDAK
-- terikat ke outlet fisik manapun. Ditampilkan HANYA lewat dropdown "SS Online" baru di
-- Rangkuman Penjualan (apps/admin-dashboard) -- lihat
-- docs/superpowers/specs/2026-08-05-marketplace-sales-outlet-design.md.
--
-- type='marketplace' membedakan baris ini dari outlet fisik. App lain (stok/absensi/
-- distribusi) yang menampilkan daftar outlet untuk keperluan operasional fisik WAJIB
-- menyaring `type != 'marketplace'` di query-nya -- lihat spec §5 (belum diaudit di
-- plan ini, scope sengaja dibatasi ke admin-dashboard).

INSERT INTO public.outlets (id, slug, name, lat, lng, type, is_active)
VALUES
  (gen_random_uuid(), 'tiktok-shop', 'TikTok Shop', 0, 0, 'marketplace', true),
  (gen_random_uuid(), 'shopee', 'Shopee', 0, 0, 'marketplace', true)
ON CONFLICT (slug) DO NOTHING;

-- Perluas CHECK constraint orders.sales_source (didefinisikan di
-- 20260619100000_orders_sales_source.sql sebagai orders_sales_source_check).
-- 'shopee_shop' dipakai (bukan 'shopee') karena 'shopee' sudah dialiaskan ke channel
-- ShopeeFood (delivery) di apps/admin-dashboard/src/lib/channels.ts getChannel().
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_sales_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_sales_source_check
  CHECK (sales_source IN ('pos','online','gofood','grabfood','shopeefood','tiktok','tiktok_shop','shopee_shop'));
