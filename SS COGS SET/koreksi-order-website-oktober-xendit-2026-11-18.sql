-- ============================================================================
-- Koreksi pesanan website Oktober 2026 agar sama dengan Xendit
-- Disiapkan 2026-11-18. SUDAH DIJALANKAN (COMMIT) 2026-11-18 atas izin user,
-- setelah uji coba ROLLBACK lolos. Hasil: Cileungsi #120 & #108, Cicurug #100,
-- Jagakarsa #55, Pajajaran #31 = 32.192; 0 baris ledger_stok baru.
-- Arsip — JANGAN dijalankan ulang (aman karena idempoten, tapi tak perlu).
--
-- Aturan (keputusan owner 2026-11-18): untuk pesanan website, data Xendit
-- adalah kebenaran. Sumber: BALANCE_HISTORY_REPORT_20261001_20261031 Xendit,
-- dicocokkan ke database Order Online (FormOrder_SS) per nominal + jam bayar.
--
-- Isi:
--   A. Pajajaran #31 (21 Okt): total POS 69.000 -> 32.192 (Xendit & Order Online
--      PAJ-211026-001 = 32.192, isi 1x Suka Fried Chicken).
--   B. 4 pesanan yang SUDAH DIBAYAR di Xendit tapi ditandai "expired" oleh
--      Order Online, sehingga tak pernah masuk POS (total 208.242):
--        MIT-011026-006  Mitra Cileungsi  1 Okt 18:58  59.354
--        CIC-091026-001  Mitra Cicurug    9 Okt 14:33  54.324  (*)
--        JAG-101026-001  Jagakarsa       10 Okt 19:29  34.204
--        MIT-131026-004  Mitra Cileungsi 13 Okt 21:28  60.360
--      (*) Cicurug = pelanggan bayar DOBEL (pesanan keduanya CIC-091026-002
--      sudah ada di POS). Kalau uangnya DIKEMBALIKAN ke pelanggan, hapus baris
--      Cicurug dari daftar `koreksi` di bawah (dan sesuaikan asersi jumlah).
--
-- Yang SENGAJA tidak terjadi:
--   - Stok TIDAK dipotong. Barang (kalau dilayani) sudah keluar Oktober dan
--     selisihnya sudah terserap opname; memotong sekarang = stok minus palsu.
--   - Tidak ada notifikasi "pesanan baru" ke kasir.
--   Keduanya dicapai dengan session_replication_role = replica (semua trigger
--   user mati di transaksi ini saja). Akibatnya FK juga tak dicek otomatis —
--   karena itu ada asersi manual outlet & menu di bawah.
--   - Laporan closing Oktober (angka statis di admin-dashboard) TIDAK berubah;
--     yang bergeser: Rangkuman Penjualan, Ringkasan Bisnis, laporan live lain.
--
-- Idempoten: pesanan dilewati bila external_order_id sudah ada; Pajajaran hanya
-- diubah bila totalnya masih 69.000.
--
-- Pembalik (bila perlu):
--   DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE notes LIKE '%[KOREKSI XENDIT 2026-11-18]%');
--   DELETE FROM orders WHERE notes LIKE '%[KOREKSI XENDIT 2026-11-18]%';
--   UPDATE orders SET total_amount = 69000 WHERE external_order_id = '0fe51010-d602-444d-ae09-d35a9b1df5c7';
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- A. Pajajaran
UPDATE public.orders
SET total_amount = 32192,
    notes = TRIM(COALESCE(notes, '') || E'\n[KOREKSI XENDIT 2026-11-18] total 69000 -> 32192 sesuai Xendit'),
    updated_at = now()
WHERE external_order_id = '0fe51010-d602-444d-ae09-d35a9b1df5c7'
  AND total_amount = 69000;

-- ------------------------------------------------------- B. 4 pesanan hilang
SET LOCAL session_replication_role = replica;

DO $$
DECLARE
  k        jsonb;
  it       jsonb;
  v_id     uuid;
  v_no     bigint;
  v_date   date;
  koreksi  jsonb := '[
    {"ext":"27ffa672-43eb-478b-ba84-aa76548721dd","kode":"MIT-011026-006","outlet":"62a56103-2085-4dd5-9d25-a3c0cffc88ff",
     "bayar":"2026-10-01 18:58:50+07","total":59354,"nama":"Nizwar","wa":"6285282283971","ambil":"2026-10-01 19:30:00+07",
     "catatan":"Boleh ga yg fried chicken ditambahin dikit saos Samyang, pengen nyoba yg full Samyang tapi takut Padas bangat",
     "items":[{"menu":"410e8f2d-6bbf-4acd-a88a-8d291d78365d","nama":"Suka Fried Chicken","qty":1,"harga":30000},
              {"menu":"a80b91f8-e5dd-4f83-9c94-ebeba6b2da80","nama":"Original Ayam Besar","qty":1,"harga":29000}]},
    {"ext":"22a1629a-373f-4d3c-9c82-17e42740db59","kode":"CIC-091026-001","outlet":"d9a2ef93-c298-4501-a471-1c5e2b3dff08",
     "bayar":"2026-10-09 14:33:41+07","total":54324,"nama":"Anisa febriyanti","wa":"6289624673880","ambil":"2026-10-09 15:00:00+07",
     "catatan":"Pedasnya sedang",
     "items":[{"menu":"4adb4426-0d1f-4962-a5d9-2b9dfbb29ecd","nama":"Original Sapi Sedang|NOTE|Pedas sedang","qty":2,"harga":27000}]},
    {"ext":"3bd7eeb7-fd79-47a3-8832-07c7b97e92e8","kode":"JAG-101026-001","outlet":"550e8400-e29b-41d4-a716-446655440006",
     "bayar":"2026-10-10 19:29:18+07","total":34204,"nama":"Omar","wa":"6285215991749","ambil":"2026-10-10 19:30:00+07",
     "catatan":"Jangan pedes",
     "items":[{"menu":"fe01e7d3-ed72-45e9-9b74-2017522a2b64","nama":"Original Sapi Besar","qty":1,"harga":34000}]},
    {"ext":"2113fa93-b221-4636-bb34-c7d96e5baf04","kode":"MIT-131026-004","outlet":"62a56103-2085-4dd5-9d25-a3c0cffc88ff",
     "bayar":"2026-10-13 21:28:12+07","total":60360,"nama":"Haris putra kudanil","wa":"628999198930","ambil":"2026-10-13 21:30:00+07",
     "catatan":"Sapi pedes",
     "items":[{"menu":"a2c9433d-2525-4096-a28f-6e6f29dcf6df","nama":"Original Ayam Sedang","qty":1,"harga":26000},
              {"menu":"fe01e7d3-ed72-45e9-9b74-2017522a2b64","nama":"Original Sapi Besar","qty":1,"harga":34000}]}
  ]';
BEGIN
  FOR k IN SELECT * FROM jsonb_array_elements(koreksi) LOOP
    IF EXISTS (SELECT 1 FROM public.orders WHERE external_order_id = k->>'ext') THEN
      RAISE NOTICE 'Lewati %: sudah ada di POS', k->>'kode';
      CONTINUE;
    END IF;

    -- FK manual (trigger FK mati di mode replica)
    IF NOT EXISTS (SELECT 1 FROM public.outlets WHERE id = (k->>'outlet')::uuid) THEN
      RAISE EXCEPTION 'Outlet % tidak ada', k->>'outlet';
    END IF;
    FOR it IN SELECT * FROM jsonb_array_elements(k->'items') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE id = (it->>'menu')::uuid) THEN
        RAISE EXCEPTION 'Menu % tidak ada', it->>'menu';
      END IF;
    END LOOP;

    -- Nomor pesanan: lanjut dari nomor terakhir outlet di tanggal itu
    -- (meniru assign_order_number, yang ikut mati di mode replica).
    v_date := ((k->>'bayar')::timestamptz AT TIME ZONE 'Asia/Jakarta')::date;
    INSERT INTO public.outlet_order_counters AS c (outlet_id, biz_date, last_number)
    VALUES ((k->>'outlet')::uuid, v_date,
            COALESCE((SELECT MAX(order_number) FROM public.orders
                      WHERE outlet_id = (k->>'outlet')::uuid
                        AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = v_date), 0) + 1)
    ON CONFLICT (outlet_id, biz_date) DO UPDATE SET last_number = GREATEST(
      c.last_number + 1,
      COALESCE((SELECT MAX(order_number) FROM public.orders
                WHERE outlet_id = (k->>'outlet')::uuid
                  AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = v_date), 0) + 1)
    RETURNING c.last_number INTO v_no;

    v_id := gen_random_uuid();
    INSERT INTO public.orders (
      id, outlet_id, order_number, customer_name, customer_phone, notes,
      payment_method, total_amount, discount_amount, promo_subsidy, status,
      source, sales_source, external_order_id, pickup_time, order_type,
      cashier_name, created_at, updated_at
    ) VALUES (
      v_id, (k->>'outlet')::uuid, v_no, k->>'nama', k->>'wa',
      E'-- INFO PEMESAN ONLINE --\nNama: ' || (k->>'nama') || E'\nTelp: ' || (k->>'wa') ||
        E'\nPembayaran: QRIS\n\n-- CATATAN PELANGGAN --\n' || (k->>'catatan') ||
        E'\n\n[KOREKSI XENDIT 2026-11-18] ' || (k->>'kode') ||
        ' dibayar di Xendit tapi ditandai expired oleh Order Online; dimasukkan susulan tanpa potong stok.',
      'qris', (k->>'total')::numeric, 0, 0, 'completed',
      'online', 'online', k->>'ext', (k->>'ambil')::timestamptz, 'regular',
      'Koreksi Rekonsiliasi Xendit', (k->>'bayar')::timestamptz, (k->>'bayar')::timestamptz
    );

    FOR it IN SELECT * FROM jsonb_array_elements(k->'items') LOOP
      INSERT INTO public.order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, channel, created_at)
      VALUES (v_id, (it->>'menu')::uuid, it->>'nama', (it->>'qty')::int, (it->>'harga')::numeric,
              (it->>'qty')::int * (it->>'harga')::numeric, 'offline', (k->>'bayar')::timestamptz);
    END LOOP;
  END LOOP;
END $$;

SET LOCAL session_replication_role = origin;

-- ------------------------------------------------------------------ Asersi
DO $$
DECLARE n int; s numeric; l int;
BEGIN
  SELECT count(*), sum(total_amount) INTO n, s FROM public.orders
  WHERE external_order_id IN ('27ffa672-43eb-478b-ba84-aa76548721dd','22a1629a-373f-4d3c-9c82-17e42740db59',
                              '3bd7eeb7-fd79-47a3-8832-07c7b97e92e8','2113fa93-b221-4636-bb34-c7d96e5baf04');
  IF n <> 4 OR s <> 208242 THEN RAISE EXCEPTION 'ASERSI GAGAL: % pesanan, total %', n, s; END IF;

  -- tiap pesanan: jumlah item + biaya 0,6% = total (pola pesanan website)
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.notes LIKE '%[KOREKSI XENDIT 2026-11-18]%' AND o.external_order_id <> '0fe51010-d602-444d-ae09-d35a9b1df5c7'
      AND round((SELECT sum(subtotal) FROM public.order_items WHERE order_id = o.id) * 1.006) <> o.total_amount
  ) THEN RAISE EXCEPTION 'ASERSI GAGAL: item tidak cocok dengan total'; END IF;

  -- nomor pesanan tidak bentrok di outlet+tanggal yang sama
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.notes LIKE '%[KOREKSI XENDIT 2026-11-18]%'
      AND EXISTS (SELECT 1 FROM public.orders p WHERE p.id <> o.id AND p.outlet_id = o.outlet_id
                  AND p.order_number = o.order_number
                  AND (p.created_at AT TIME ZONE 'Asia/Jakarta')::date = (o.created_at AT TIME ZONE 'Asia/Jakarta')::date)
  ) THEN RAISE EXCEPTION 'ASERSI GAGAL: nomor pesanan bentrok'; END IF;

  -- stok tidak bergerak
  SELECT count(*) INTO l FROM public.ledger_stok
  WHERE ref_order_id IN (SELECT id FROM public.orders WHERE notes LIKE '%[KOREKSI XENDIT 2026-11-18]%'
                           AND external_order_id <> '0fe51010-d602-444d-ae09-d35a9b1df5c7');
  IF l <> 0 THEN RAISE EXCEPTION 'ASERSI GAGAL: % baris ledger stok tertulis', l; END IF;

  IF (SELECT total_amount FROM public.orders WHERE external_order_id = '0fe51010-d602-444d-ae09-d35a9b1df5c7') <> 32192 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: Pajajaran belum 32192';
  END IF;
END $$;

-- Ringkasan untuk dicek mata
SELECT ot.name AS outlet, o.order_number, to_char(o.created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD HH24:MI') AS waktu,
       o.total_amount::int AS total, o.status, o.sales_source
FROM public.orders o JOIN public.outlets ot ON ot.id = o.outlet_id
WHERE o.notes LIKE '%[KOREKSI XENDIT 2026-11-18]%'
ORDER BY o.created_at;

-- Ganti ROLLBACK -> COMMIT setelah owner setuju.
ROLLBACK;
