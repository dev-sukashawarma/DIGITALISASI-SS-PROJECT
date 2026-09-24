-- Spec 2026-09-23 K10.2: setelah semua layar memakai RPC (Tahap 2), cabut hak tulis
-- langsung ke tabel master. Penulis sah yang tersisa: fungsi SECURITY DEFINER (RPC
-- master, verifikasi_terima_po, katalog_tulis_dari_po, sahkan_nota_vendor, trigger
-- turunan harga) dan service_role — keduanya tak terpengaruh.
--
-- ⚠️ URUTAN WAJIB: apply HANYA setelah admin-dashboard, stok, dan finance versi Tahap 2
-- ter-deploy dan diperiksa. Diterapkan lebih awal = layar lama yang masih live gagal
-- menyimpan (permission denied).
--
-- SELECT tidak disentuh (katalog pelanggan & layar baca tetap jalan).
-- Policy tulis lama dibiarkan: tanpa grant, policy tak berarti; mencabutnya terpisah
-- tidak menambah keamanan.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.bahan_baku,
  public.bahan_baku_sku,
  public.bahan_baku_harga,
  public.bahan_baku_supplier,
  public.supplier
FROM anon, authenticated;
