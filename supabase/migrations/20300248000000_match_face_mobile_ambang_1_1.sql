-- Ambang pencocokan wajah native dibedakan per mode.
--
-- 1:1 (HP pribadi, p_lock_to_staff_id terisi) turun 0.65 -> 0.60. Wajah hanya dibandingkan
-- dengan pemilik akun yang sedang login, jadi "orang lain lolos" butuh orang itu memegang HP
-- yang sudah login DAN lolos liveness + geofence. Di 0.65 wajah asli sering ditolak saat
-- cahaya/backlight berbeda dari foto enroll (skor orang yang sama turun ke 0.58–0.63).
--
-- 1:N (kiosk, p_lock_to_staff_id NULL) TETAP 0.65: di sana wajah dicari di antara banyak
-- staf, dan ambang rendah membuat dua orang yang mirip bisa tertukar.
--
-- WAJIB sama dengan FaceMatcherLokal.AMBANG_1_1 / AMBANG di SUPER-APPS-SS-MOBILE
-- (core/camera/.../face_domain/FaceMatcherLokal.kt) — pencocokan offline di HP.
-- Isi fungsi selain ambang tidak berubah dari definisi live per 28 Sep 2026.

CREATE OR REPLACE FUNCTION public.match_face_mobile(embedding real[], p_outlet_id uuid, p_lock_to_staff_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_ambang     double precision;
  rec          record;
  i            int;
  MATCH_THRESHOLD     constant double precision := 0.65; -- 1:N kiosk
  MATCH_THRESHOLD_1_1 constant double precision := 0.60; -- 1:1 HP pribadi
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  v_dim := array_length(embedding, 1);
  IF embedding IS NULL OR v_dim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  v_ambang := CASE WHEN p_lock_to_staff_id IS NOT NULL THEN MATCH_THRESHOLD_1_1 ELSE MATCH_THRESHOLD END;

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

  IF v_best_id IS NULL OR v_best_sim < v_ambang THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_face', 'best_similarity', coalesce(v_best_sim, -1));
  END IF;

  RETURN jsonb_build_object('ok', true, 'staff_id', v_best_id, 'name', v_best_name, 'similarity', v_best_sim);
END;
$function$;
