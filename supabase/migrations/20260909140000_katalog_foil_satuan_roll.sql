-- 20260909140000_katalog_foil_satuan_roll.sql
-- Katalog harga vendor FOIL: satuan beli diubah dari `Dus` ke `roll`.
--
-- Permintaan owner 9 September 2026, saat smoke test halaman katalog.
--
-- Kenapa barisnya semula `Dus`: seed (`20260908233000`) memakai
-- `bahan_baku.satuan` karena `purchase_order_item.harga_terima` tersimpan per
-- satuan BESAR. Untuk baris yang benar-benar membawa harga, itu benar dan
-- harus dipertahankan.
--
-- Tapi kedua baris FOIL berharga 0 -- keduanya berasal dari PO pra-guard
-- 4 September, jadi harganya sengaja tidak diseed (lihat komentar seed).
-- Tidak ada angka yang perlu dijaga konsistensinya, sementara satuannya
-- memaksa operator mengetik harga per Dus padahal nota vendor berbunyi
-- "48 roll @ 8.791". Spec 4.1 pun menetapkan default `satuan_beli` =
-- `bahan_baku.satuan_po`, yang untuk FOIL adalah `roll`.
--
-- 1 roll = 760 cm (`bahan_baku.faktor_po`), vs 1 Dus = 36.480 cm.
--
-- ⚠️ PENJAGA: hanya menyentuh baris ber-`harga = 0`. Mengubah satuan pada
-- baris berharga TANPA mengubah angkanya akan menyalahkannya 48x -- persis
-- kelas kesalahan yang menghasilkan insiden FOIL Rp413,6 juta. Saat migration
-- ini ditulis, nol baris FOIL yang berharga; penjaga ini untuk masa depan.
--
-- Idempoten.

UPDATE public.bahan_baku_supplier bs
   SET satuan_beli      = b.satuan_po,
       isi_satuan_kecil = b.faktor_po
  FROM public.bahan_baku b
 WHERE b.id = bs.bahan_baku_id
   AND b.nama = 'FOIL'
   AND bs.harga = 0
   AND b.satuan_po IS NOT NULL
   AND b.faktor_po IS NOT NULL
   AND b.faktor_po > 0
   AND (bs.satuan_beli IS DISTINCT FROM b.satuan_po
        OR bs.isi_satuan_kecil IS DISTINCT FROM b.faktor_po);

-- DOWN:
-- UPDATE public.bahan_baku_supplier bs
--    SET satuan_beli = b.satuan, isi_satuan_kecil = b.faktor_tampilan
--   FROM public.bahan_baku b
--  WHERE b.id = bs.bahan_baku_id AND b.nama = 'FOIL' AND bs.harga = 0;
