-- Index untuk kolom FK yang menunjuk ke public.orders.
--
-- MASALAH (terukur 2026-07-31):
-- DELETE di `orders` kena `canceling statement due to statement timeout`.
-- SELECT baris yang sama hanya 1,5 ms (1.688 baris, pakai idx_orders_outlet_created),
-- jadi yang lambat murni DELETE-nya. Sebabnya: dua tabel merujuk `orders` lewat
-- FK yang kolomnya TIDAK diindeks, sehingga Postgres wajib men-scan tabel perujuk
-- untuk SETIAP baris yang dihapus:
--
--   ledger_stok.ref_order_id          ON DELETE SET NULL   70.575 baris
--   cancellation_requests.order_id    ON DELETE CASCADE        35 baris
--
-- Hapus 1.688 order = ~119 juta pemeriksaan baris di ledger_stok saja.
-- Dampaknya bukan cuma fitur import Pawoon — SEMUA penghapusan order di app mana
-- pun kena pelambatan yang sama.
--
-- CATATAN PENAMAAN: timestamp 2030 dipakai mengikuti preseden migration
-- 20300103000006/7/8 — repo ini punya 8 migration bertimestamp 2030 yang, karena
-- diurutkan berdasarkan nama, SELALU jalan paling akhir. Migration bertanggal
-- wajar akan berada di bawah "lantai" itu. Ini utang teknis yang sudah tercatat
-- (lihat memory `migration-timestamp-lint-guard`), bukan pilihan yang disukai.
--
-- Aditif: hanya menambah index, tidak mengubah data maupun skema kolom.
-- CREATE INDEX (non-concurrent) mengunci tulis ke tabel selama pembuatan; pada
-- 70k baris ini hitungan sub-detik. `supabase db push` membungkus migration dalam
-- transaksi, jadi CONCURRENTLY tidak bisa dipakai di sini.

CREATE INDEX IF NOT EXISTS idx_ledger_stok_ref_order_id
  ON public.ledger_stok (ref_order_id);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_order_id
  ON public.cancellation_requests (order_id);
