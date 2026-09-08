-- Koreksi saldo TUTUP PACK di MITRA PALEDANG — 8 September 2026.
--
-- Opname 7 Sep 21:36 (Emul Mulyana, leader) mengisi "0 Pack" padahal sistem
-- mencatat 57 Pcs, sehingga stoknya terhapus (nilai ≈ Rp203 rb). Item ini
-- bagian dari 13 bahan yang diisi 0 secara kebiasaan pada opname yang sama.
--
-- Target = hitungan fisik terakhir yang benar-benar dilakukan:
--   opname 6 Sep 21:41 -> "2 Pack + 7 Pcs" = 57 Pcs
-- Angka yang sama juga tercatat pada opname 4 dan 5 Sep, dan TUTUP PACK tidak
-- dipakai resep BOM (nol baris 'pemakaian'), jadi tidak ada yang perlu
-- dikurangkan setelah hitungan itu.
--
-- SOP: lewat ledger_stok, bukan UPDATE stok_balance. Delta dihitung dari saldo
-- live dan baris delta 0 dilewati, jadi aman dijalankan ulang.

INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
SELECT sb.outlet_id,
       sb.bahan_baku_id,
       'adjustment',
       57 - sb.saldo,
       'Koreksi TUTUP PACK: samakan dengan opname 6 Sep 2026 (2 Pack + 7 Pcs). Opname 7 Sep terisi 0 Pack karena salah input.'
  FROM public.stok_balance sb
 WHERE sb.outlet_id = '550e8400-e29b-41d4-a716-446655440003'
   AND sb.bahan_baku_id = '0c9bf83c-2905-4130-aae7-0d70bd4687b7'
   AND ROUND(57 - sb.saldo, 4) <> 0;
