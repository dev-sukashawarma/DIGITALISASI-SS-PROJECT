-- Perbaiki bug pembacaan skala satuan di view `inbound_outbound_feed` untuk baris
-- `ledger_stok` yang tercatat sebelum opname pertama (atau di Gudang Pusat yang
-- belum pernah opname, sehingga `saldo_is_gram = false` dan angkanya tersimpan
-- dalam Satuan Besar seperti Dus/Pack, bukan Satuan Kecil seperti cm/Gram/Pcs).
-- Sekaligus selaraskan 19 baris `transfer_keluar` historis `FOIL 7,6M` di Gudang Pusat
-- agar tiap baris mencerminkan qty aktual `surat_jalan_item` pada basis 24 Roll/Dus.

CREATE OR REPLACE FUNCTION public.ledger_baris_skala_kecil(
    p_outlet_id uuid,
    p_bahan_baku_id uuid,
    p_created_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ledger_stok op
        WHERE op.outlet_id = p_outlet_id
          AND op.bahan_baku_id = p_bahan_baku_id
          AND op.tipe = 'opname_selisih'
          AND op.created_at >= '2026-08-01 20:32:00+07'::timestamptz
          AND op.created_at <= p_created_at
    );
$$;

COMMENT ON FUNCTION public.ledger_baris_skala_kecil(uuid, uuid, timestamptz) IS
    'Mengembalikan true bila pada saat p_created_at pasangan (outlet, bahan) sudah melewati opname_selisih pasca cutoff 2026-08-01 20:32+07 sehingga baris ledger_stok disimpan dalam satuan kecil.';

GRANT EXECUTE ON FUNCTION public.ledger_baris_skala_kecil(uuid, uuid, timestamptz) TO authenticated, service_role;

DO $$
DECLARE
    v_hq_id uuid := public.gudang_pusat_id();
    v_foil76_id uuid;
    v_adj_id uuid;
    v_last_saldo numeric;
    v_sb_saldo numeric;
BEGIN
    SELECT id INTO v_foil76_id
    FROM public.bahan_baku
    WHERE nama = 'FOIL 7,6M'
    LIMIT 1;

    IF v_hq_id IS NOT NULL AND v_foil76_id IS NOT NULL THEN
        SELECT id INTO v_adj_id
        FROM public.ledger_stok
        WHERE outlet_id = v_hq_id
          AND bahan_baku_id = v_foil76_id
          AND tipe = 'adjustment'
          AND qty < 0
          AND catatan LIKE 'Koreksi selisih skala transfer_keluar FOIL 7,6M di Gudang Pusat%'
        LIMIT 1;

        IF v_adj_id IS NOT NULL THEN
            -- 1. Selaraskan 19 baris transfer_keluar di Gudang Pusat sesuai qty_dikirim SJ (basis 24 Roll/Dus)
            UPDATE public.ledger_stok l
            SET qty = -sji.qty_dikirim
            FROM public.surat_jalan_item sji
            WHERE l.outlet_id = v_hq_id
              AND l.bahan_baku_id = v_foil76_id
              AND l.tipe = 'transfer_keluar'
              AND l.ref_shipment_id = sji.surat_jalan_id
              AND sji.bahan_baku_id = v_foil76_id
              AND sji.qty_dikirim > 0;

            -- 2. Netralkan baris adjustment kompensasi agregat tanpa menghapus baris audit
            UPDATE public.ledger_stok
            SET qty = 0,
                catatan = 'Audit rekonsiliasi FOIL 7,6M di Gudang Pusat (19 baris transfer_keluar telah diselaraskan langsung ke basis 24 Roll/Dus)'
            WHERE id = v_adj_id;

            -- 3. Hitung ulang rantai saldo_sebelum & saldo_sesudah secara kronologis di Gudang Pusat
            WITH rantai AS (
                SELECT
                    id,
                    COALESCE(
                        sum(qty) OVER (
                            ORDER BY created_at ASC, id ASC
                            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                        ),
                        0::numeric
                    ) AS s_awal,
                    sum(qty) OVER (
                        ORDER BY created_at ASC, id ASC
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS s_akhir
                FROM public.ledger_stok
                WHERE outlet_id = v_hq_id
                  AND bahan_baku_id = v_foil76_id
            )
            UPDATE public.ledger_stok l
            SET saldo_sebelum = r.s_awal,
                saldo_sesudah = r.s_akhir
            FROM rantai r
            WHERE l.id = r.id;

            SELECT saldo_sesudah INTO v_last_saldo
            FROM public.ledger_stok
            WHERE outlet_id = v_hq_id
              AND bahan_baku_id = v_foil76_id
            ORDER BY created_at DESC, id DESC
            LIMIT 1;

            SELECT saldo INTO v_sb_saldo
            FROM public.stok_balance
            WHERE outlet_id = v_hq_id
              AND bahan_baku_id = v_foil76_id;

            IF v_last_saldo IS DISTINCT FROM v_sb_saldo AND abs(COALESCE(v_last_saldo, 0) - COALESCE(v_sb_saldo, 0)) > 1e-9 THEN
                RAISE EXCEPTION 'Asersi gagal: saldo akhir ledger (%) tidak sama dengan stok_balance (%) untuk FOIL 7,6M di Gudang Pusat',
                    v_last_saldo, v_sb_saldo;
            END IF;
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE VIEW public.inbound_outbound_feed
WITH (security_invoker = true) AS
SELECT
    l.id,
    l.outlet_id,
    l.bahan_baku_id,
    CASE WHEN l.tipe = 'transfer_keluar' THEN 'OUT' ELSE 'IN' END           AS tipe,
    CASE
        WHEN l.tipe = 'pembelian_supplier' THEN 'vendor_po'
        WHEN l.tipe = 'transfer_keluar'    THEN 'kirim_outlet'
        ELSE 'vendor_manual'
    END                                                                     AS sumber,
    CASE
        WHEN l.tipe = 'pembelian_supplier' THEN 'Pembelian Vendor'
        WHEN l.tipe = 'transfer_keluar'    THEN 'Kirim ke Outlet'
        ELSE 'Barang Masuk (Manual)'
    END                                                                     AS kategori,
    CASE
        WHEN COALESCE(b.faktor_tampilan, 1) > 1
         AND NOT public.ledger_baris_skala_kecil(l.outlet_id, l.bahan_baku_id, l.created_at)
        THEN abs(l.qty) * b.faktor_tampilan
        ELSE abs(l.qty)
    END                                                                     AS qty,
    COALESCE(h.harga_beli_display, h.harga_beli)                            AS harga_satuan,
    l.catatan,
    l.created_by,
    l.created_at,
    staff.name                                                              AS pencatat_nama,
    b.nama                                                                  AS bahan_nama,
    b.satuan                                                                AS bahan_satuan,
    b.satuan_tengah,
    b.faktor_tengah,
    b.satuan_kecil,
    b.faktor_tampilan,
    b.satuan_distribusi,
    l.ref_shipment_id,
    tujuan.name                                                             AS tujuan_outlet_nama,
    sj.document_number                                                      AS nomor_sj,
    po.nomor_po,
    po.supplier_nama,
    CASE
        WHEN l.saldo_sesudah IS NULL THEN NULL
        WHEN COALESCE(b.faktor_tampilan, 1) > 1
         AND NOT public.ledger_baris_skala_kecil(l.outlet_id, l.bahan_baku_id, l.created_at)
        THEN l.saldo_sesudah * b.faktor_tampilan
        ELSE l.saldo_sesudah
    END                                                                     AS saldo_sesudah
FROM public.ledger_stok l
JOIN      public.bahan_baku       b      ON b.id            = l.bahan_baku_id
LEFT JOIN public.bahan_baku_harga h      ON h.bahan_baku_id = l.bahan_baku_id
LEFT JOIN public.outlet_staff     staff  ON staff.id        = l.created_by
LEFT JOIN public.surat_jalan      sj     ON sj.id           = l.ref_shipment_id
LEFT JOIN public.outlets          tujuan ON tujuan.id       = sj.outlet_id
LEFT JOIN public.purchase_order   po     ON po.id           = l.ref_po_id
WHERE l.qty <> 0
  AND (
        l.tipe = 'pembelian_supplier'
     OR l.tipe = 'transfer_keluar'
     OR (
            l.tipe = 'adjustment'
        AND l.qty > 0
        AND COALESCE(l.catatan, '') !~* '(koreksi|kesalahan input|salah input|belum opname|surat jalan|reorder|test)'
        )
      );

COMMENT ON VIEW public.inbound_outbound_feed IS
    'Arus barang masuk dari vendor & keluar ke outlet, diturunkan langsung dari ledger_stok dengan normalisasi skala satuan kecil untuk baris pra-opname.';

GRANT SELECT ON public.inbound_outbound_feed TO authenticated;
