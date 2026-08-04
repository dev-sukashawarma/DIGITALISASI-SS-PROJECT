-- Migration: 20300105000011_permintaan_auto_cancel_stale.sql
--
-- Spec: docs/superpowers/specs/2026-08-03-permintaan-batch-nudge-design.md §5
-- (gerbang keputusan disetujui user 2026-08-04: batas 12 jam, auto-batalkan).
--
-- Masalah: pendingItemIds (apps/stok PermintaanForm.tsx) menyembunyikan bahan
-- yang punya permintaan_bahan status='menunggu' TANPA batas waktu -- kalau
-- admin_kitchen tak kunjung memproses, bahan itu nyangkut selamanya di form,
-- termasuk saat genuinely kritis/darurat.
--
-- Fix (dua sisi):
-- 1. Frontend (PermintaanForm.tsx) sudah dibebaskan hide-nya untuk permintaan
--    'menunggu' berumur >12 jam -- bahan itu kembali muncul di pilihan.
-- 2. DB: begitu crew mengajukan permintaan baru yang berisi bahan yang sama
--    dengan permintaan lama (status='menunggu', umur >12 jam) di outlet yang
--    sama, permintaan lama itu otomatis di-set 'dibatalkan' -- supaya
--    admin_kitchen tidak memproses 2 permintaan untuk bahan yang sama.
--
-- Catatan granularitas: status ada di level permintaan_bahan (satu request
-- bisa berisi banyak item), bukan per-item. created_at juga di level request
-- (semua item dalam satu request dibuat bersamaan) -- jadi kalau SATU item
-- dalam request lama itu >12 jam, SEMUA itemnya juga >12 jam, jadi
-- membatalkan seluruh request lama itu konsisten (bukan membatalkan item yang
-- tak diminta ulang secara tak sengaja).

ALTER TABLE permintaan_bahan DROP CONSTRAINT permintaan_bahan_status_check;
ALTER TABLE permintaan_bahan ADD CONSTRAINT permintaan_bahan_status_check
  CHECK (status IN ('menunggu','disetujui','ditolak','dibatalkan'));

CREATE OR REPLACE FUNCTION buat_permintaan_svc(
    p_outlet_id uuid,
    p_items json,
    p_dibuat_oleh uuid,
    p_target_metadata jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permintaan_id uuid;
    v_item json;
    v_bahan_ids uuid[];
BEGIN
    IF p_items IS NULL OR json_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'permintaan harus berisi minimal 1 item';
    END IF;

    SELECT array_agg((elem->>'bahan_baku_id')::uuid)
    INTO v_bahan_ids
    FROM json_array_elements(p_items) elem;

    -- Auto-batalkan permintaan lama (>12 jam, masih menunggu) di outlet ini
    -- yang mengandung bahan yang sama dengan permintaan baru ini.
    UPDATE permintaan_bahan pb
    SET status = 'dibatalkan',
        catatan_kitchen = 'Dibatalkan otomatis: diajukan ulang setelah >12 jam menunggu',
        updated_at = NOW()
    WHERE pb.outlet_id = p_outlet_id
      AND pb.status = 'menunggu'
      AND pb.created_at < NOW() - INTERVAL '12 hours'
      AND EXISTS (
        SELECT 1 FROM permintaan_bahan_item pbi
        WHERE pbi.permintaan_id = pb.id
          AND pbi.bahan_baku_id = ANY(v_bahan_ids)
      );

    INSERT INTO permintaan_bahan (outlet_id, dibuat_oleh, status, target_metadata)
    VALUES (p_outlet_id, p_dibuat_oleh, 'menunggu', p_target_metadata)
    RETURNING id INTO v_permintaan_id;

    FOR v_item IN SELECT * FROM json_array_elements(p_items)
    LOOP
        INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta)
        VALUES (
            v_permintaan_id,
            (v_item->>'bahan_baku_id')::uuid,
            (v_item->>'qty_diminta')::numeric
        );
    END LOOP;
END;
$$;
