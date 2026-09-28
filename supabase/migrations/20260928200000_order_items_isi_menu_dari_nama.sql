-- Penjaga: baris order_items pesanan web yang masuk TANPA menu_item_id diisi dari namanya.
--
-- Kenapa di database, bukan di aplikasi:
-- pos-kasir sudah mencocokkan nama -> id sejak 2026-09-04 (lib/resolve-menu-id.ts, dipakai
-- /api/orders/pull-online dan /api/orders/incoming), dan 4-12 Sep 2026 semua baris web ber-id.
-- Tapi sejak 13 Sep 2026 baris web kembali masuk ber-id NULL, padahal kode di repo tak berubah;
-- penulisnya belum ketemu (order-system atau deploy yang berbeda). Tanpa id, laporan internal
-- (get_owner_dashboard_summary) membaca HPP-nya 0. Penjaga ini menutup lubang itu siapa pun
-- penulisnya. Baris September yang sudah terlanjur kosong ditautkan terpisah
-- (SS COGS SET/tautkan-menu-pesanan-web-september-2026-09-28.sql).
--
-- Aturan pencocokan (sama dengan penautan manual 2026-09-28):
--   * hanya pesanan orders.sales_source = 'online' — kasir/kiosk/impor lain tak disentuh;
--   * nama = bagian sebelum '|' pertama (metadata '|NOTE|..' dsb dibuang), dibandingkan
--     lower(btrim(..));
--   * kategori "Voucher Pamulang 10%" diabaikan (nama kembar dengan menu biasa);
--   * hanya diisi bila cocok ke TEPAT SATU menu — ragu = biarkan NULL.
--
-- Catatan: ini hanya mengisi id (HPP). Stok pesanan web tetap TIDAK dipotong karena
-- trg_process_bom_stok melewati pesanan ber-external_order_id (aturan Pawoon) — keputusan owner
-- terpisah.

CREATE OR REPLACE FUNCTION public.order_items_isi_menu_dari_nama()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nama  text;
  v_cocok uuid[];
BEGIN
  IF NEW.menu_item_id IS NOT NULL OR NEW.menu_item_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = NEW.order_id AND o.sales_source = 'online') THEN
    RETURN NEW;
  END IF;

  v_nama := lower(btrim(split_part(NEW.menu_item_name, '|', 1)));
  IF v_nama = '' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(m.id) INTO v_cocok
  FROM public.menu_items m
  LEFT JOIN public.categories c ON c.id = m.category_id
  WHERE lower(btrim(m.name)) = v_nama
    AND COALESCE(c.name, '') <> 'Voucher Pamulang 10%';

  IF cardinality(v_cocok) = 1 THEN
    NEW.menu_item_id := v_cocok[1];
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.order_items_isi_menu_dari_nama() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_order_items_isi_menu_dari_nama ON public.order_items;
CREATE TRIGGER trg_order_items_isi_menu_dari_nama
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_isi_menu_dari_nama();
