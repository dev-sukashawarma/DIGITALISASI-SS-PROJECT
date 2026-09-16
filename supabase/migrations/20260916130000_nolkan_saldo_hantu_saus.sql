-- =============================================================================
-- 20260916130000_nolkan_saldo_hantu_saus.sql
-- =============================================================================
-- Membersihkan sisa saldo minus dua bahan HANTU yang sudah dinonaktifkan:
--   SAUS CABE  (NONAKTIF, digabung ke SAOS CABE)
--   SAUS TOMAT (NONAKTIF, digabung ke SAOS TOMAT POUCH)
--
-- Asalnya: 20260914130000 menambahkan kedua bahan itu ke resep tanpa membuang
-- baris SAOS lama, sehingga 14-15 Sep saus terpotong DUA KALI. Potongan hantu
-- berhenti 15 Sep 16:29:45 WIB saat 20260915235000 memindahkan gramasinya ke
-- SAOS CABE / SAOS TOMAT POUCH (dibuktikan: SAOS tetap menerima 1.008 & 959
-- potongan SESUDAH menit itu - jadi peralihannya nyata, bukan penjualan yang
-- berhenti). Yang tertinggal hanya saldonya.
--
-- Diukur sebelum migration ini: 42 baris stok_balance saldo < 0 di 21 outlet
-- (outlet, mitra, dan outlet tes; NOL di Gudang Pusat - jadi penjaga vendor
-- trg_cek_penyesuaian_gudang_bervendor tidak terpicu sama sekali).
--
-- Nol dampak rupiah: kedua bahan tak punya harga, dan 0 resep aktif memakainya
-- setelah 20260915235000. Ini murni kebersihan papan monitoring.
--
-- Baris `pemakaian` historis 14-15 Sep SENGAJA DIBIARKAN - itu jejak audit dari
-- kejadian yang benar-benar terjadi. Yang dinolkan hanya saldo berjalannya,
-- lewat ledger `adjustment` sesuai SOP (JANGAN pernah UPDATE stok_balance
-- langsung; trigger ledger_stamp_saldo yang mengurus saldo).
--
-- Idempoten: delta dihitung dari saldo LIVE (`-sb.saldo`), dan baris bersaldo 0
-- dilewati. Menjalankan ulang tidak menulis apa pun.
-- =============================================================================
BEGIN;

INSERT INTO public.ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
SELECT sb.outlet_id, sb.bahan_baku_id, 'adjustment', -sb.saldo,
       'Nolkan saldo bahan hantu (digabung ke SAOS) - koreksi potongan dobel 14-15 Sep'
FROM public.stok_balance sb
JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
WHERE b.nama LIKE 'SAUS %NONAKTIF%'
  AND NOT b.is_active
  AND sb.saldo <> 0;

DO $$
DECLARE v_sisa int; v_aktif int;
BEGIN
  SELECT count(*) INTO v_sisa
    FROM public.stok_balance sb JOIN public.bahan_baku b ON b.id = sb.bahan_baku_id
   WHERE b.nama LIKE 'SAUS %NONAKTIF%' AND sb.saldo <> 0;
  IF v_sisa <> 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: masih % baris saldo hantu bukan-nol', v_sisa;
  END IF;

  -- Penjaga lingkup: pastikan tak ada bahan AKTIF yang ikut tersentuh.
  SELECT count(*) INTO v_aktif
    FROM public.ledger_stok l JOIN public.bahan_baku b ON b.id = l.bahan_baku_id
   WHERE l.catatan LIKE 'Nolkan saldo bahan hantu%' AND b.is_active;
  IF v_aktif <> 0 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: % baris koreksi menyentuh bahan AKTIF', v_aktif;
  END IF;
END $$;

COMMIT;
