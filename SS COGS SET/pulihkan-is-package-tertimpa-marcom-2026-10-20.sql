-- Pulihkan menu_items.is_package untuk paket yang flag-nya tertimpa false oleh
-- editor menu app marcom (10, 13 & 15 Okt 2026).
--
-- Akar: apps/marcom/src/app/dashboard/menu/actions.ts menulis
--   is_package: form.is_package || false
-- padahal form marcom tidak pernah mengirim is_package → setiap simpan dari marcom
-- (ubah harga/foto/campaign) menjadikan paket "satuan". Isi paket (menu_packages)
-- tidak terhapus, jadi menu yang punya baris menu_packages pasti paket.
--
-- Dampak sebelum dipulihkan (diukur 20 Okt 2026):
--   34 menu ber-isi paket dengan is_package = false (15 di antaranya punya pilihan
--   "A atau B", mis. Ice Tea / Orange Juice) → POS tidak menampilkan pilihan, BOM
--   tidak menguraikan paket (nol resep sendiri) → 511 porsi sejak 10 Okt tidak
--   memotong stok isinya, dan HPP combo tanpa hpp_override terbaca 0.
--
-- Efek sesudah: POS menampilkan & mewajibkan pilihan, BOM memotong stok isi paket
-- untuk order BARU. Ledger order lama tidak disentuh (opname rutin menyerapnya).
-- Trigger yang ikut jalan: kb_cs_menu_ubah (tandai KB CS) — tidak menyentuh HPP.
--
-- Pembalikan: UPDATE menu_items SET is_package = false WHERE id IN (<id hasil RETURNING>).

UPDATE public.menu_items mi
SET is_package = true,
    updated_at = now(),
    updated_by = 'Claude (is_package dipulihkan setelah tertimpa editor marcom, 20 Okt 2026)'
WHERE mi.is_package = false
  AND EXISTS (SELECT 1 FROM public.menu_packages mp WHERE mp.package_id = mi.id)
RETURNING mi.id, mi.name;
