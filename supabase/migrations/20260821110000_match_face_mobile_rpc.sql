-- RPC match_face_mobile: pencocokan wajah 1:1 (device personal, p_lock_to_staff_id
-- diisi) atau 1:N (kiosk outlet, null) KHUSUS untuk model native (facenet.tflite,
-- 192d) yang embedding-nya TIDAK comparable dengan model web (@vladmandic/human) —
-- makanya baca kolom `face_descriptor_mobile` (migration 20260717120000), BUKAN
-- `face_descriptor` yang dipakai endpoint web /api/face-match.
--
-- Perbandingan dikerjakan di server (SECURITY DEFINER) supaya descriptor biometrik
-- staff lain TIDAK PERNAH turun ke client manapun — beda dari /api/face-match yang
-- mengembalikan descriptor mentah kandidat match (catatan "temuan A2" di
-- AbsensiWebApi.kt); RPC ini sengaja tidak mengulang pola itu.

CREATE OR REPLACE FUNCTION public.match_face_mobile(
  embedding real[],
  p_outlet_id uuid,
  p_lock_to_staff_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid := auth.uid();
  v_dim        int;
  v_norm_a     double precision;
  v_norm_b     double precision;
  v_dot        double precision;
  v_sim        double precision;
  v_best_sim   double precision := -1;
  v_best_id    uuid;
  v_best_name  text;
  rec          record;
  i            int;
  MATCH_THRESHOLD constant double precision := 0.65; -- samakan dgn TfliteFaceEmbeddingExtractor.MOBILE_MATCH_THRESHOLD
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  v_dim := array_length(embedding, 1);
  IF embedding IS NULL OR v_dim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  v_norm_a := 0;
  FOR i IN 1..v_dim LOOP
    v_norm_a := v_norm_a + embedding[i] * embedding[i];
  END LOOP;
  v_norm_a := sqrt(v_norm_a);
  IF v_norm_a = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  FOR rec IN
    SELECT id, name, face_descriptor_mobile
    FROM outlet_staff
    WHERE status = 'active'
      AND face_descriptor_mobile IS NOT NULL
      AND (
        (p_lock_to_staff_id IS NOT NULL AND id = p_lock_to_staff_id)
        OR (p_lock_to_staff_id IS NULL AND (
          outlet_id = p_outlet_id
          OR role IN ('spv','admin','owner','admin_hr','leader','korlap','regional_manager','area_manager')
          OR EXISTS (
            SELECT 1 FROM staff_outlets so
            WHERE so.staff_id = outlet_staff.id AND so.outlet_id = p_outlet_id
          )
        ))
      )
  LOOP
    IF array_length(rec.face_descriptor_mobile, 1) IS DISTINCT FROM v_dim THEN
      CONTINUE; -- guard dimensi: descriptor lama/model beda -> skip, jangan crash
    END IF;

    v_dot := 0;
    v_norm_b := 0;
    FOR i IN 1..v_dim LOOP
      v_dot := v_dot + embedding[i] * rec.face_descriptor_mobile[i];
      v_norm_b := v_norm_b + rec.face_descriptor_mobile[i] * rec.face_descriptor_mobile[i];
    END LOOP;
    v_norm_b := sqrt(v_norm_b);
    IF v_norm_b = 0 THEN
      CONTINUE;
    END IF;

    v_sim := v_dot / (v_norm_a * v_norm_b);
    IF v_sim > v_best_sim THEN
      v_best_sim := v_sim;
      v_best_id := rec.id;
      v_best_name := rec.name;
    END IF;
  END LOOP;

  IF v_best_id IS NULL OR v_best_sim < MATCH_THRESHOLD THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_face', 'best_similarity', coalesce(v_best_sim, -1));
  END IF;

  RETURN jsonb_build_object('ok', true, 'staff_id', v_best_id, 'name', v_best_name, 'similarity', v_best_sim);
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_face_mobile(real[], uuid, uuid) TO authenticated;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.match_face_mobile(real[], uuid, uuid);
