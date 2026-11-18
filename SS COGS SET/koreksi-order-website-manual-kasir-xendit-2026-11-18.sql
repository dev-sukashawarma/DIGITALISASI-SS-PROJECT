-- ============================================================================
-- Koreksi lanjutan pesanan website vs Xendit — 2026-11-18 (sore)
-- SUDAH DIJALANKAN (COMMIT) 2026-11-18 atas izin user, setelah uji coba ROLLBACK lolos
-- (relabel=6, batal=2, xendit_cocok=6). Arsip — jangan dijalankan ulang.
--
-- Temuan: pesanan website yang "expired" di Order Online padahal dibayar sering
-- SUDAH DILAYANI dan diinput MANUAL oleh kasir (sebagai pesanan kasir / PreOrder WA,
-- QRIS, tanpa biaya 0,6%). Pesanan manual itu yang asli (sudah memotong stok).
--
-- A. Koreksi pagi tadi (koreksi-order-website-oktober-xendit-2026-11-18.sql) MENDOBEL 2:
--    Jagakarsa #55 (10 Okt, Omar)  — sudah ada manual #32
--    Cileungsi #108 (13 Okt, Haris) — sudah ada manual #107
--    → #55 & #108 dibatalkan (total 0), external_order_id dilepas (dicatat di notes).
-- B. 6 pesanan manual ditandai sebagai pesanan website (sumber Website, ID Order Online,
--    total = nominal Xendit):
--    Jagakarsa #32  10 Okt  34.000 → 34.204  (JAG-101026-001)
--    Cileungsi #107 13 Okt  60.000 → 60.360  (MIT-131026-004)
--    Paledang #38    3 Nov  72.000 → 72.432  (PAL-031126-001)
--    Cileudug #69    7 Nov 228.000 → 229.368 (MIT-071126-003)
--    Dramaga #14     9 Nov  31.000 → 31.186  (DRA-091126-001)
--    Karawaci #40   13 Nov 122.000 → 122.732 (MIT-131126-004)
-- Stok tidak bergerak; notifikasi/bot tidak terkirim (session_replication_role = replica).
-- Pembalik: lihat nilai lama di notes "[KOREKSI XENDIT 2026-11-18 SORE]".
-- ============================================================================
BEGIN;
SET LOCAL session_replication_role = replica;

-- A. batalkan duplikat
UPDATE public.orders
SET status = 'cancelled', total_amount = 0,
    notes = notes || E'\n[KOREKSI XENDIT 2026-11-18 SORE] DIBATALKAN: duplikat input manual kasir. external_order_id lama ' || external_order_id || ', total lama ' || total_amount::text,
    external_order_id = NULL, updated_at = now()
WHERE external_order_id IN ('3bd7eeb7-fd79-47a3-8832-07c7b97e92e8','2113fa93-b221-4636-bb34-c7d96e5baf04')
  AND notes LIKE '%[KOREKSI XENDIT 2026-11-18]%' AND status = 'completed';

-- B. tandai pesanan manual sebagai website
UPDATE public.orders o
SET external_order_id = v.ext, sales_source = 'online', source = 'online', channel = NULL,
    notes = COALESCE(o.notes, '') || E'\n[KOREKSI XENDIT 2026-11-18 SORE] pesanan website ' || v.kode ||
            ' diinput manual kasir; ditautkan ke Order Online. Lama: sales_source=' || o.sales_source ||
            ', channel=' || COALESCE(o.channel, '-') || ', total=' || o.total_amount::text,
    total_amount = v.total, updated_at = now()
FROM (VALUES
  ('b22fca74-7d92-4619-be3f-d9393a4a09b5'::uuid, '3bd7eeb7-fd79-47a3-8832-07c7b97e92e8', 34204, 'JAG-101026-001', 34000),
  ('a133d0ac-402a-4f49-8b89-308a4bd3784e', '2113fa93-b221-4636-bb34-c7d96e5baf04', 60360, 'MIT-131026-004', 60000),
  ('3d313cac-1e45-46bd-9fe3-33fc9cef6007', '1e903964-991b-494e-9570-4074ceb07a54', 72432, 'PAL-031126-001', 72000),
  ('3c2b5b48-104a-42c5-ae61-3455d515b9ca', '107c4580-4da6-4a65-aadd-989168b78149', 229368, 'MIT-071126-003', 228000),
  ('ed0c1cc6-0746-4d7f-855c-399fe7b1e6da', 'be718078-12e9-43fb-9ca2-c1351d1c2604', 31186, 'DRA-091126-001', 31000),
  ('eefea0e9-85a2-4fff-91e3-9b655db82cfd', 'bb7173cb-61d0-4102-a7f2-f0506bc2afa9', 122732, 'MIT-131126-004', 122000)
) v(id, ext, total, kode, total_lama)
WHERE o.id = v.id AND o.external_order_id IS NULL AND o.total_amount = v.total_lama AND o.status = 'completed';

SET LOCAL session_replication_role = origin;

DO $$
DECLARE n int; d int; x int;
BEGIN
  SELECT count(*) INTO n FROM public.orders WHERE notes LIKE '%pesanan website%diinput manual kasir%' AND sales_source = 'online';
  SELECT count(*) INTO d FROM public.orders WHERE notes LIKE '%DIBATALKAN: duplikat input manual kasir%' AND status = 'cancelled' AND external_order_id IS NULL;
  -- setiap pembayaran Xendit yang ditaut ke 6 pesanan kini menemukan pesanan selesai bernominal sama
  SELECT count(*) INTO x FROM public.xendit_pembayaran p JOIN public.orders o ON o.external_order_id = p.external_order_id
   WHERE o.status = 'completed' AND round(o.total_amount) = round(p.nominal)
     AND p.external_order_id IN ('3bd7eeb7-fd79-47a3-8832-07c7b97e92e8','2113fa93-b221-4636-bb34-c7d96e5baf04','1e903964-991b-494e-9570-4074ceb07a54','107c4580-4da6-4a65-aadd-989168b78149','be718078-12e9-43fb-9ca2-c1351d1c2604','bb7173cb-61d0-4102-a7f2-f0506bc2afa9');
  IF n <> 6 OR d <> 2 OR x <> 6 THEN RAISE EXCEPTION 'ASERSI GAGAL: relabel=% batal=% xendit_cocok=%', n, d, x; END IF;
END $$;

-- Ganti ROLLBACK -> COMMIT setelah disetujui.
ROLLBACK;
