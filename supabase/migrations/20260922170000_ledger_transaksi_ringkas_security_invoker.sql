-- Tutup kebocoran view ledger_transaksi_ringkas.
--
-- View ini dimiliki postgres TANPA security_invoker, sehingga dijalankan
-- dengan hak pemiliknya dan RLS ledger_stok (ledger_read /
-- accessible_outlet_ids()) terlewati. Terbukti 2026-09-22:
--   - role anon (anon key publik, tanpa login) membaca 100 baris ringkasan
--     ledger lintas outlet, sementara tabel ledger_stok untuk anon = 0 baris;
--   - crew membaca 50 transaksi outlet LAIN.
-- Dokumentasi lama (CLAUDE.md) menyebut view ini "ikut RLS" -- tidak benar.
--
-- security_invoker = true: view dievaluasi dengan hak PEMANGGIL, jadi RLS
-- ledger_stok berlaku. Pengguna sah tetap melihat outlet yang boleh mereka
-- akses. Pemakai satu-satunya adalah daftar Ledger app stok, yang sejak
-- migration 20260922160000 pindah ke RPC ledger_transaksi_page.
--
-- anon dicabut total; authenticated hanya SELECT (view agregat tak bisa
-- ditulisi, hak tulis bawaan Supabase sekadar dibersihkan).

ALTER VIEW public.ledger_transaksi_ringkas SET (security_invoker = true);

REVOKE ALL ON public.ledger_transaksi_ringkas FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.ledger_transaksi_ringkas FROM authenticated;
GRANT SELECT ON public.ledger_transaksi_ringkas TO authenticated;
