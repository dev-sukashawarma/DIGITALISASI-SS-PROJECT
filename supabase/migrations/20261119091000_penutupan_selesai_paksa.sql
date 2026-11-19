-- Tandai Penutupan Selesai paksa (permintaan owner 19 Nov 2026).
-- Admin/developer (penutupan_outlet_cek_peran('tulis'), sama dengan selesai biasa)
-- boleh menandai penutupan outlet selesai walau langkah wajib di papan belum beres,
-- ASAL memberi alasan (min 10 karakter). Alasan + kunci langkah yang dilewati dicatat
-- di outlet_pembukaan_log (aksi 'penutupan_selesai', detail.paksa = true).
-- Tanpa alasan perilakunya sama seperti dulu.
-- Tanda tangan berubah (parameter ke-2 ber-DEFAULT) -> DROP dulu agar PostgREST tidak
-- melihat dua overload. Pemanggil 1 argumen tetap jalan.

DROP FUNCTION IF EXISTS public.tandai_penutupan_selesai(uuid);

CREATE FUNCTION public.tandai_penutupan_selesai(
  p_outlet_id uuid, p_alasan_paksa text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o          public.outlets%ROWTYPE;
  v_status   jsonb;
  v_kurang   text;
  v_paksa    boolean := false;
  v_dilewati jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.penutupan_outlet_cek_peran('tulis');
  o := public._penutupan_ambil_outlet(p_outlet_id);
  IF o.status <> 'inactive' OR o.alasan_tutup IS NULL THEN
    RAISE EXCEPTION 'Outlet % tidak sedang dalam penutupan', o.name;
  END IF;
  IF o.penutupan_selesai_at IS NOT NULL THEN
    RAISE EXCEPTION 'Penutupan outlet % sudah ditandai selesai', o.name;
  END IF;

  v_status := public.status_penutupan_outlet(p_outlet_id);
  IF NOT (v_status->>'siap_selesai')::boolean THEN
    SELECT string_agg(e->>'label', '; '), coalesce(jsonb_agg(e->>'kunci'), '[]'::jsonb)
      INTO v_kurang, v_dilewati
      FROM jsonb_array_elements(v_status->'langkah') e
     WHERE (e->>'wajib')::boolean AND NOT (e->>'selesai')::boolean;
    IF length(btrim(coalesce(p_alasan_paksa, ''))) < 10 THEN
      RAISE EXCEPTION 'Penutupan belum bisa ditandai selesai. Belum beres: %. Tandai selesai paksa butuh alasan (minimal 10 karakter).', v_kurang;
    END IF;
    v_paksa := true;
  END IF;

  UPDATE public.outlets
     SET penutupan_selesai_at = now(), penutupan_selesai_by = auth.uid(), updated_at = now()
   WHERE id = p_outlet_id;

  PERFORM public._pembukaan_outlet_log(
    p_outlet_id,
    o.name,
    'penutupan_selesai',
    CASE WHEN v_paksa THEN btrim(p_alasan_paksa) END,
    jsonb_build_object('paksa', v_paksa, 'langkah_dilewati', v_dilewati)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tandai_penutupan_selesai(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tandai_penutupan_selesai(uuid, text) TO authenticated;
