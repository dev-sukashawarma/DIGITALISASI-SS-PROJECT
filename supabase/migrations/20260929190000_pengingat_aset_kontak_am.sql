-- Pengingat aset: kontak WhatsApp Area Manager + jejak konfirmasi (2026-09-29).
--
-- Sebelum menindaklanjuti barang RUSAK / PERLU PERBAIKAN, HR wajib melewati
-- langkah konfirmasi dan bisa langsung membuka WhatsApp ke Area Manager.
--
--   1. inventaris_tindak_lanjut.konfirmasi_wa — true bila HR membuka WhatsApp
--      ke AM sebelum menyimpan keputusan (jejak audit; tidak memengaruhi
--      aturan pengingat).
--   2. inventaris_pengingat_aset() ditambah kontak_nama & kontak_hp:
--        pelapor laporan inventaris terakhir bila nomornya ada, kalau tidak
--        Area Manager binaan outlet (staff_outlets) pertama yang punya nomor.
--      Nomor = outlet_staff.whatsapp, lalu outlet_staff.phone.
--      Tipe kembalian berubah, jadi fungsi di-DROP lalu dibuat ulang (fungsi
--      milik migration 20260929170000, tidak didefinisikan migration lain).

set local lock_timeout = '5s';

ALTER TABLE public.inventaris_tindak_lanjut
  ADD COLUMN IF NOT EXISTS konfirmasi_wa BOOLEAN NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.inventaris_pengingat_aset();

CREATE FUNCTION public.inventaris_pengingat_aset()
RETURNS TABLE (
  outlet_id UUID,
  outlet_name TEXT,
  master_item_id UUID,
  item_name TEXT,
  subsection TEXT,
  umur_ekonomis_bulan INTEGER,
  purchase_date DATE,
  kondisi TEXT,
  observed_qty NUMERIC,
  is_present BOOLEAN,
  brand TEXT,
  catatan TEXT,
  dilaporkan_oleh TEXT,
  dilaporkan_at TIMESTAMPTZ,
  kontak_nama TEXT,
  kontak_hp TEXT,
  tl_umur_keputusan TEXT,
  tl_umur_ingatkan_lagi DATE,
  tl_umur_acuan_tanggal DATE,
  tl_umur_catatan TEXT,
  tl_umur_oleh TEXT,
  tl_umur_at TIMESTAMPTZ,
  tl_kondisi_keputusan TEXT,
  tl_kondisi_ingatkan_lagi DATE,
  tl_kondisi_acuan TEXT,
  tl_kondisi_catatan TEXT,
  tl_kondisi_oleh TEXT,
  tl_kondisi_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH terbaru AS (
    SELECT DISTINCT ON (s.outlet_id) s.id, s.outlet_id, s.submitted_by, s.updated_at
    FROM public.inventaris_submissions s
    ORDER BY s.outlet_id, s.updated_at DESC, s.created_at DESC
  ),
  tl AS (
    SELECT DISTINCT ON (t.outlet_id, t.master_item_id, t.pemicu)
      t.outlet_id, t.master_item_id, t.pemicu, t.keputusan, t.ingatkan_lagi,
      t.acuan_tanggal_beli, t.acuan_kondisi, t.catatan, t.dibuat_at,
      st.name AS oleh
    FROM public.inventaris_tindak_lanjut t
    LEFT JOIN public.outlet_staff st ON st.id = t.dibuat_oleh
    ORDER BY t.outlet_id, t.master_item_id, t.pemicu, t.dibuat_at DESC
  ),
  kontak AS (
    -- Satu kontak per outlet: pelapor bila bernomor, lalu AM binaan bernomor.
    SELECT DISTINCT ON (t.outlet_id)
      t.outlet_id,
      k.name AS nama,
      COALESCE(NULLIF(btrim(k.whatsapp), ''), NULLIF(btrim(k.phone), '')) AS hp
    FROM terbaru t
    JOIN LATERAL (
      SELECT s.name, s.whatsapp, s.phone, 0 AS urut
      FROM public.outlet_staff s WHERE s.id = t.submitted_by
      UNION ALL
      SELECT s.name, s.whatsapp, s.phone, 1
      FROM public.staff_outlets so
      JOIN public.outlet_staff s ON s.id = so.staff_id
      WHERE so.outlet_id = t.outlet_id AND s.role = 'area_manager' AND s.status = 'active'
    ) k ON true
    ORDER BY t.outlet_id,
             (COALESCE(NULLIF(btrim(k.whatsapp), ''), NULLIF(btrim(k.phone), '')) IS NULL),
             k.urut, k.name
  )
  SELECT
    t.outlet_id,
    o.name,
    m.id,
    m.name,
    m.subsection,
    m.umur_ekonomis_bulan,
    i.purchase_date,
    i.kondisi,
    i.observed_qty,
    i.is_present,
    i.brand,
    i.catatan,
    pelapor.name,
    t.updated_at,
    kt.nama,
    kt.hp,
    tu.keputusan, tu.ingatkan_lagi, tu.acuan_tanggal_beli, tu.catatan, tu.oleh, tu.dibuat_at,
    tk.keputusan, tk.ingatkan_lagi, tk.acuan_kondisi, tk.catatan, tk.oleh, tk.dibuat_at
  FROM terbaru t
  JOIN public.outlets o ON o.id = t.outlet_id
  JOIN public.inventaris_submission_items i ON i.submission_id = t.id
  JOIN public.inventaris_master_items m ON m.id = i.master_item_id AND m.is_active
  LEFT JOIN public.outlet_staff pelapor ON pelapor.id = t.submitted_by
  LEFT JOIN kontak kt ON kt.outlet_id = t.outlet_id
  LEFT JOIN tl tu ON tu.outlet_id = t.outlet_id AND tu.master_item_id = m.id AND tu.pemicu = 'umur'
  LEFT JOIN tl tk ON tk.outlet_id = t.outlet_id AND tk.master_item_id = m.id AND tk.pemicu = 'kondisi'
  WHERE COALESCE(o.type, 'outlet') NOT IN ('test', 'marketplace')
    AND (m.umur_ekonomis_bulan IS NOT NULL OR i.kondisi IN ('rusak', 'perlu_perbaikan'))
  ORDER BY o.name, m.section, m.sort_order;
$$;

REVOKE ALL ON FUNCTION public.inventaris_pengingat_aset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventaris_pengingat_aset() TO authenticated;
