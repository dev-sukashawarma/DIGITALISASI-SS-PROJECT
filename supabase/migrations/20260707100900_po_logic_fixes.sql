-- 20260707100900_po_logic_fixes.sql
-- Fix 2 bug logic di modul Purchase Order:
--
-- BUG 1 (KRITIS): Trigger po_on_verified skip item kondisi != 'baik'
--   → Stok kitchen tidak naik meski barang fisik sudah diterima.
--   FIX: Hapus filter kondisi='baik'. Stok naik berdasarkan qty_terima,
--        berapapun kondisinya. Kondisi hanya untuk audit/catatan.
--
-- BUG 2 (MEDIUM): Race condition di generate_nomor_po()
--   → Dua request bersamaan bisa dapat nomor PO sama → UNIQUE violation.
--   FIX: Pakai pg_advisory_xact_lock() untuk lock per tanggal sebelum
--        generate nomor, sehingga hanya satu transaksi yang bisa generate
--        nomor untuk tanggal yang sama di waktu bersamaan.

-- ============================================================
-- FIX 1: po_on_verified — hapus filter kondisi='baik'
-- ============================================================
CREATE OR REPLACE FUNCTION public.po_on_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kitchen_id UUID := '550e8400-e29b-41d4-a716-446655440001';
  v_item       RECORD;
BEGIN
  -- Hanya jalan saat status berubah ke 'sebagian_diterima' atau 'diterima_lengkap'
  IF NEW.status NOT IN ('sebagian_diterima', 'diterima_lengkap') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW; -- tidak ada perubahan status, skip
  END IF;

  -- Loop tiap item yang sudah diverifikasi (qty_terima IS NOT NULL AND > 0)
  -- CATATAN: kondisi tidak difilter — barang 'kurang' atau 'rusak' tetap
  -- dicatat masuk ke stok (secara fisik sudah ada di kitchen).
  -- Kondisi 'rusak' / 'kurang' hanya untuk tujuan audit & klaim ke supplier.
  FOR v_item IN
    SELECT
      poi.id,
      poi.bahan_baku_id,
      poi.qty_terima,
      poi.harga_terima,
      poi.kondisi,
      b.nama AS nama_bahan
    FROM public.purchase_order_item poi
    JOIN public.bahan_baku b ON b.id = poi.bahan_baku_id
    WHERE poi.purchase_order_id = NEW.id
      AND poi.qty_terima IS NOT NULL
      AND poi.qty_terima > 0
      -- DIHAPUS: AND poi.kondisi = 'baik'
  LOOP
    -- a) Stok kitchen naik sebesar qty_terima, terlepas dari kondisi
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty,
      ref_po_id, catatan, created_by, created_at
    ) VALUES (
      v_kitchen_id,
      v_item.bahan_baku_id,
      'pembelian_supplier',
      v_item.qty_terima,
      NEW.id,
      'Terima dari supplier: ' || NEW.nomor_po
        || ' — ' || v_item.nama_bahan
        || CASE
             WHEN v_item.kondisi = 'kurang' THEN ' (kurang)'
             WHEN v_item.kondisi = 'rusak'  THEN ' ⚠ RUSAK'
             ELSE ''
           END,
      NEW.diverifikasi_oleh,
      NOW()
    );

    -- b) Update harga beli master (hanya jika harga_terima diisi dan kondisi bukan rusak)
    --    Barang rusak tidak update harga — harga tersebut tidak merepresentasikan
    --    nilai wajar karena barangnya tidak bisa dipakai.
    IF v_item.harga_terima IS NOT NULL
       AND v_item.harga_terima > 0
       AND v_item.kondisi != 'rusak'
    THEN
      INSERT INTO public.bahan_baku_harga (
        bahan_baku_id, harga_beli, harga_updated_at, updated_by
      ) VALUES (
        v_item.bahan_baku_id,
        v_item.harga_terima,
        NOW(),
        NEW.diverifikasi_oleh
      )
      ON CONFLICT (bahan_baku_id) DO UPDATE
        SET harga_beli       = EXCLUDED.harga_beli,
            harga_updated_at = EXCLUDED.harga_updated_at,
            updated_by       = EXCLUDED.updated_by;
    END IF;
  END LOOP;

  -- Catat waktu verifikasi jika belum diisi RPC
  IF NEW.diverifikasi_at IS NULL THEN
    NEW.diverifikasi_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- FIX 2: generate_nomor_po — advisory lock untuk cegah race condition
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_nomor_po()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date    TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_prefix  TEXT := 'PO/KITCHEN/' || v_date || '/';
  v_lock_key BIGINT;
  v_seq     INT;
  v_nomor   TEXT;
BEGIN
  -- Advisory lock per tanggal: hash string tanggal ke bigint
  -- pg_advisory_xact_lock: otomatis release saat transaksi selesai
  v_lock_key := ('x' || substr(md5(v_date), 1, 15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Hitung urutan dengan lock aktif → aman dari race condition
  SELECT COUNT(*) + 1
    INTO v_seq
    FROM public.purchase_order
    WHERE nomor_po LIKE v_prefix || '%';

  v_nomor := v_prefix || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_nomor;
END;
$$;

-- Tidak perlu DROP/CREATE TRIGGER karena fungsi diganti di tempat (CREATE OR REPLACE)
-- Trigger trg_po_on_verified tetap aktif dan otomatis pakai fungsi yang baru.

-- DOWN:
-- Restore versi lama dengan filter kondisi='baik' dan tanpa advisory lock
-- (lihat migration 20260707100500 dan 20260707100300 untuk versi original)
