-- Migration: 20300105000001_fix_buat_permintaan_svc_stale_overload.sql
--
-- Bug ditemukan: migration 20260709044000 mencoba mengganti buat_permintaan_svc
-- (menambah p_target_metadata) dengan:
--   DROP FUNCTION IF EXISTS buat_permintaan_svc(uuid, json, uuid);
-- Tapi fungsi asli (20260617140000) dideklarasikan dengan tipe p_items JSONB,
-- bukan JSON — DROP dengan signature (uuid, json, uuid) tidak match apa pun
-- (JSON dan JSONB adalah tipe berbeda di Postgres) dan diam-diam no-op.
-- Akibatnya CREATE OR REPLACE membuat OVERLOAD BARU (uuid, json, uuid, jsonb)
-- alih-alih mengganti yang lama, dan overload lama
-- buat_permintaan_svc(uuid, jsonb, uuid) — tanpa p_target_metadata, RETURNS
-- permintaan_bahan, tanpa validasi item kosong — tetap nyangkut di database.
-- Dua fungsi bernama sama dengan signature mirip berisiko bikin PostgREST
-- salah pilih kandidat / connection pooler menahan definisi basi di cache.
--
-- Fix: buang overload lama secara eksplisit dengan tipe yang benar, dan
-- pastikan definisi yang dipakai (4-arg, p_items JSON) utuh + kembalikan
-- validasi "minimal 1 item" yang hilang saat rewrite 20260709044000.

DROP FUNCTION IF EXISTS buat_permintaan_svc(uuid, jsonb, uuid);

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
BEGIN
    IF p_items IS NULL OR json_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'permintaan harus berisi minimal 1 item';
    END IF;

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
