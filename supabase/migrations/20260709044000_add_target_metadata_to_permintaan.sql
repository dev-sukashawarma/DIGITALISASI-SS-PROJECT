-- Migration: 20260709044000_add_target_metadata_to_permintaan.sql

ALTER TABLE permintaan_bahan
ADD COLUMN target_metadata JSONB DEFAULT '[]'::jsonb;

-- Update the RPC buat_permintaan_svc to accept target_metadata
DROP FUNCTION IF EXISTS buat_permintaan_svc(uuid, json, uuid);

CREATE OR REPLACE FUNCTION buat_permintaan_svc(
    p_outlet_id uuid,
    p_items json,
    p_dibuat_oleh uuid,
    p_target_metadata jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_permintaan_id uuid;
    v_item json;
BEGIN
    -- 1. Insert ke permintaan_bahan
    INSERT INTO permintaan_bahan (outlet_id, dibuat_oleh, status, target_metadata)
    VALUES (p_outlet_id, p_dibuat_oleh, 'menunggu', p_target_metadata)
    RETURNING id INTO v_permintaan_id;

    -- 2. Insert tiap item ke permintaan_bahan_item
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
