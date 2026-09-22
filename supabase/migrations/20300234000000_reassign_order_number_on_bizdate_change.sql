-- ============================================================
-- Migration: nomor antrean ikut berpindah saat tanggal bisnis order berubah
--
-- Latar (22 Sep 2026): Edge Function sync-pos-sales gagal tiap 10 menit
-- (154x sejak 21 Sep 15:20 WIB) dengan 23505 pada
-- orders_outlet_bizdate_number_uq, cursor pos_sync_cursor macet di 12 Sep.
--
-- Akar: dua penulis tidak sepakat soal created_at.
--   1. pull-online-orders (pos-kasir) menyisipkan order online TANPA
--      created_at -> default now() = jam ditarik, mis. 14 Sep 09:03.
--      trg_assign_order_number memberi nomor untuk tanggal 14 Sep (#1).
--   2. sync-pos-sales lalu meng-UPSERT (ON CONFLICT external_order_id DO
--      UPDATE) dengan created_at asli dari sistem order = 13 Sep.
--      Tanggal bisnis bergeser, tapi order_number tetap #1 karena trigger
--      hanya BEFORE INSERT -> tabrakan dengan #1 milik 13 Sep.
--
-- Perbaikan: assign_order_number() juga dijalankan BEFORE UPDATE OF
-- created_at ketika tanggal bisnis (Asia/Jakarta) berubah, sehingga
-- invarian "order_number selalu milik tanggal bisnis barisnya" terjaga
-- untuk penulis mana pun. Nomor lama di tanggal lama tidak dipakai ulang.
--
-- Dry run 22 Sep 2026 di produksi (di-rollback): order 6067ac91 pindah
-- 14 Sep -> 13 Sep, nomor 1 -> 91 (counter 13 Sep = 90), tanpa 23505.
-- ============================================================

DROP TRIGGER IF EXISTS trg_reassign_order_number_on_bizdate ON public.orders;

CREATE TRIGGER trg_reassign_order_number_on_bizdate
  BEFORE UPDATE OF created_at ON public.orders
  FOR EACH ROW
  WHEN (
    ((OLD.created_at AT TIME ZONE 'Asia/Jakarta')::date)
      IS DISTINCT FROM
    ((NEW.created_at AT TIME ZONE 'Asia/Jakarta')::date)
  )
  EXECUTE FUNCTION public.assign_order_number();

COMMENT ON TRIGGER trg_reassign_order_number_on_bizdate ON public.orders IS
  'Alokasikan ulang order_number bila created_at pindah tanggal bisnis (Asia/Jakarta); mencegah 23505 orders_outlet_bizdate_number_uq saat sync-pos-sales menimpa created_at.';
