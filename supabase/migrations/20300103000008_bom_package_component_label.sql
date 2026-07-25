-- 20300103000008_bom_package_component_label.sql
--
-- Dua perbaikan keterbacaan ledger untuk penjualan paket/combo. Tidak mengubah
-- satu pun angka qty -- saldo stok sebelum & sesudah migration ini identik.
--
-- MASALAH 1: catatan paket tidak menyebut komponen
--   Trigger menulis satu baris per (komponen paket x bahan), tapi catatan semua baris
--   berbunyi sama: 'Penjualan Paket #3 (TRIPLE SERU)'. UI ledger
--   (TransaksiExpandedDetail di LedgerList.tsx) mengelompokkan baris berdasarkan teks
--   di dalam kurung terakhir, jadi seluruh isi paket jatuh ke SATU grup dan bahan yang
--   dipakai beberapa komponen tampil kembar tanpa keterangan.
--
--   Contoh nyata (EMPANG #3, TRIPLE SERU, 22 Juli): 39 baris untuk 17 bahan unik --
--   PLASTIK MERAH muncul 3x, SAOS TOMAT 3x, TEPUNG 2x, semua berlabel sama.
--
--   Perbaikan: catatan jadi 'Penjualan Paket #3 (TRIPLE SERU > Mix Jumbo)'.
--   UI otomatis memecah jadi satu grup per komponen, tetap dalam satu kartu transaksi
--   (pengelompokan kartu memakai ref_order_id, tidak disentuh di sini).
--
-- MASALAH 2: ledger_transaksi_ringkas.jumlah_bahan menghitung baris, bukan bahan
--   count(*) membuat kartu order di atas bertuliskan '39 bahan' padahal bahannya 17.
--   Perbaikan: count(DISTINCT bahan_baku_id).
--
--   Aman untuk konsumen lain: satu-satunya pemakaian di luar tampilan adalah tebakan
--   'entri manual' di LedgerList.tsx (jumlah_bahan = 1 DAN tanpa ref apa pun). Entri
--   manual hanya punya satu baris, jadi count(*) dan count(DISTINCT) sama-sama 1.
--
-- Basis fungsi = 20300103000007 apa adanya (termasuk guard Pawoon), HANYA blok catatan
-- paket yang berubah. Menyalin basis lama tanpa sadar adalah penyebab regresi yang
-- diperbaiki di 20300103000006 dan 20300103000007 -- jangan ulangi.

CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  r_item RECORD;
  l_item RECORD;
  p_item RECORD;
  v_resep_id UUID;
  v_allowed_outlets TEXT;
  v_is_package BOOLEAN;
  v_selected_item_id UUID;
  v_item_label TEXT;
  v_child_label TEXT;
BEGIN
  -- GUARD Pawoon: order hasil import Pawoon adalah data historis dan TIDAK boleh
  -- memotong stok bahan baku, tanggal berapa pun.
  IF NEW.external_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Guard allowlist: kalau key tidak ada / outlet_id tidak terdaftar -> skip semua logika BOM
  -- (order tetap completed/cancelled normal, cuma tidak ada potongan/pengembalian stok BOM).
  SELECT value INTO v_allowed_outlets FROM public.global_settings
    WHERE key = 'bom_automation_allowed_outlets';

  IF v_allowed_outlets IS NULL
     OR NOT (NEW.outlet_id::text = ANY (string_to_array(v_allowed_outlets, ','))) THEN
    RETURN NEW;
  END IF;

  -- Handle when an order is completed (either updated to completed, or inserted as completed)
  IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN

    FOR rec IN SELECT menu_item_id, quantity, package_choices, menu_item_name
               FROM public.order_items WHERE order_id = NEW.id LOOP
      IF rec.menu_item_id IS NOT NULL THEN

        -- /api/checkout menyisipkan metadata ke menu_item_name lewat pemisah '|'
        -- (|ID|, |PARENT|, |NOTE|). Ambil nama menunya saja agar catatan ledger tetap terbaca.
        v_item_label := COALESCE(NULLIF(split_part(rec.menu_item_name, '|', 1), ''), 'Item');

        SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = rec.menu_item_id;

        IF v_is_package THEN
          FOR p_item IN SELECT id, menu_item_id, or_menu_item_id, quantity FROM public.menu_packages WHERE package_id = rec.menu_item_id LOOP
            -- Determine which item was chosen (default to primary)
            v_selected_item_id := p_item.menu_item_id;

            -- If the cashier selected an alternative option for this package item
            IF rec.package_choices IS NOT NULL AND (rec.package_choices->>p_item.id::text) IS NOT NULL THEN
              v_selected_item_id := (rec.package_choices->>p_item.id::text)::uuid;
            END IF;

            -- Nama komponen yang benar-benar dipilih. Dipakai di catatan supaya potongan
            -- bisa ditelusuri sampai menu isinya, bukan cuma nama paketnya.
            SELECT name INTO v_child_label FROM public.menu_items WHERE id = v_selected_item_id;
            v_child_label := COALESCE(NULLIF(v_child_label, ''), 'Komponen');

            -- Find the active recipe for this selected child item
            v_resep_id := NULL;
            SELECT id INTO v_resep_id
            FROM public.resep
            WHERE menu_item_ref = v_selected_item_id::text
              AND is_active = true
              AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
            ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
            LIMIT 1;

            IF v_resep_id IS NOT NULL THEN
              FOR r_item IN
                SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
                FROM public.resep_item ri
                JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
                WHERE ri.resep_id = v_resep_id
              LOOP
                INSERT INTO public.ledger_stok (
                  outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
                ) VALUES (
                  NEW.outlet_id,
                  r_item.bahan_baku_id,
                  'pemakaian',
                  -(r_item.qty_per_porsi * rec.quantity * p_item.quantity / r_item.faktor_konversi),
                  'Penjualan Paket #' || COALESCE(NEW.order_number::text, 'N/A')
                    || ' (' || v_item_label || ' > ' || v_child_label || ')',
                  NEW.id,
                  NOW()
                );
              END LOOP;
            END IF;
          END LOOP;
        ELSE
          -- Normal item (Original logic)
          v_resep_id := NULL;
          SELECT id INTO v_resep_id
          FROM public.resep
          WHERE menu_item_ref = rec.menu_item_id::text
            AND is_active = true
            AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
          ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
          LIMIT 1;

          IF v_resep_id IS NOT NULL THEN
            FOR r_item IN
              SELECT ri.bahan_baku_id, ri.qty_per_porsi, b.faktor_konversi
              FROM public.resep_item ri
              JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
              WHERE ri.resep_id = v_resep_id
            LOOP
              INSERT INTO public.ledger_stok (
                outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
              ) VALUES (
                NEW.outlet_id,
                r_item.bahan_baku_id,
                'pemakaian',
                -(r_item.qty_per_porsi * rec.quantity / r_item.faktor_konversi),
                'Penjualan Otomatis #' || COALESCE(NEW.order_number::text, 'N/A') || ' (' || v_item_label || ')',
                NEW.id,
                NOW()
              );
            END LOOP;
          END IF;
        END IF;
      END IF;
    END LOOP;

  -- Order dibatalkan (restore stok) -- reverse hanya SISA potongan bersih per bahan.
  -- JANGAN reverse tiap baris 'pemakaian' satu per satu: order yang sempat completed >1x
  -- punya beberapa baris pemakaian; membalik semuanya mengembalikan stok lebih banyak
  -- daripada yang benar-benar keluar. 'adjustment' ikut dijumlahkan supaya pengembalian
  -- sebelumnya terhitung -> kalau net = 0, HAVING menyaringnya (idempoten).
  --
  -- Catatan: agregasi per bahan ini SENGAJA tidak dipecah per komponen paket. Yang
  -- dikembalikan adalah sisa bersih per bahan, jadi memecahnya justru bisa over-restore.
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'completed') THEN

    FOR l_item IN
      SELECT bahan_baku_id, SUM(qty) AS net_qty
      FROM public.ledger_stok
      WHERE ref_order_id = NEW.id AND tipe IN ('pemakaian', 'adjustment')
      GROUP BY bahan_baku_id
      HAVING SUM(qty) < 0
    LOOP
      INSERT INTO public.ledger_stok (
        outlet_id, bahan_baku_id, tipe, qty, catatan, ref_order_id, created_at
      ) VALUES (
        NEW.outlet_id,
        l_item.bahan_baku_id,
        'adjustment',
        -l_item.net_qty,
        'Pengembalian Void #' || COALESCE(NEW.order_number::text, 'N/A'),
        NEW.id,
        NOW()
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$function$;


-- MASALAH 2: jumlah_bahan menghitung baris, bukan bahan unik.
-- Definisi di bawah = view live apa adanya, HANYA count(*) -> count(DISTINCT bahan_baku_id).
-- View ini sengaja BUKAN security definer: ia ikut RLS ledger_stok.
CREATE OR REPLACE VIEW public.ledger_transaksi_ringkas AS
SELECT COALESCE(ref_order_id::text, ref_opname_id::text, ref_shipment_id::text, ref_transfer_id::text, id::text) AS transaksi_key,
    outlet_id,
    min(created_at) AS created_at,
    count(DISTINCT bahan_baku_id) AS jumlah_bahan,
    max(ref_order_id::text) AS ref_order_id,
    max(ref_opname_id::text) AS ref_opname_id,
    max(ref_shipment_id::text) AS ref_shipment_id,
    max(ref_transfer_id::text) AS ref_transfer_id,
    max(bahan_baku_id::text) AS single_bahan_baku_id,
    max(tipe) AS single_tipe,
    max(qty) AS single_qty,
    max(catatan) AS single_catatan,
    max(saldo_sesudah) AS single_saldo_sesudah
   FROM ledger_stok
  GROUP BY (COALESCE(ref_order_id::text, ref_opname_id::text, ref_shipment_id::text, ref_transfer_id::text, id::text)), outlet_id;

-- CATATAN untuk yang menyentuh trg_process_bom_stok berikutnya:
-- ADA MIGRATION BERTIMESTAMP TAHUN 2030 YANG SELALU JALAN PALING AKHIR saat build dari nol.
-- Selalu jalankan dulu: grep -rn "trg_process_bom_stok" supabase/migrations/
