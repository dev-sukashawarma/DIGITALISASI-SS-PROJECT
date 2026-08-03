-- 20300105000003_saldo_is_gram_and_last_opname_date.sql
--
-- Root cause (2026-08-02/03): stok_balance.saldo tidak punya penanda satuan per
-- baris. Stock Opname (form dinamis) menulis saldo dalam SATUAN KECIL (gram),
-- sementara Distribusi/Manual/BOM masih menulis dalam SATUAN BESAR/TENGAH.
-- Setiap layar yang menampilkan saldo berjenjang (SPVTable, CrewList,
-- MonitoringDetailModal, LiveMonitoringPage, PermintaanForm, ManualEntryForm)
-- meng-Math.trunc(saldo) dan melabelinya sebagai satuan besar -> untuk baris
-- yang sudah "meloncat" ke gram lewat opname, ini menampilkan angka absurd
-- (contoh nyata: SAPI 8.553,755 gram tampil sebagai "8.553 Blok" = 17 ton).
--
-- Fix ini TIDAK menyentuh jalur tulis (stok_balance/ledger_stok tetap apa
-- adanya) -- murni menambah metadata baca: fungsi computed-column yang
-- menjawab "apakah tulisan TERAKHIR ke baris ini adalah opname_selisih?".
-- Kalau ya, sisi baca boleh percaya saldo dalam gram. Kalau bukan (baris
-- legacy yang belum pernah diopname dengan form baru, ATAU baris yang sudah
-- gram tapi baru saja disentuh distribusi/manual/BOM lagi), sisi baca TETAP
-- pakai tafsiran besar seperti sekarang -- tidak membuat lebih buruk, hanya
-- tidak (belum) memperbaiki kasus itu. Kasus itu ditutup tuntas oleh
-- penyatuan satuan tulis (lihat docs/superpowers/specs/2026-08-01-satuan-kanonik-stok-design.md).
--
-- Konvensi PostgREST "computed column": fungsi berargumen TUNGGAL bertipe row
-- tabel tampil sebagai kolom biasa saat SELECT dari tabel itu, sehingga bisa
-- dipakai baik di view (monitoring_view_spv/_crew) maupun langsung di query
-- `.from('stok_balance').select('..., saldo_is_gram')` (dipakai
-- useStokBalance.ts oleh PermintaanForm/ManualEntryForm) tanpa duplikasi logika.

CREATE OR REPLACE FUNCTION public.saldo_is_gram(sb public.stok_balance)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  -- Batas waktu 2026-08-01 20:32 WIB: saat skrip update_satuan_bahan_baku.cjs
  -- mengisi/memperbaiki satuan_kecil+faktor untuk banyak bahan 3-tingkat.
  -- Diverifikasi ke ledger: opname SEBELUM jam ini menulis angka kecil
  -- (besar-scale, mis. KENTANG 2,5), SESUDAHNYA langsung ribuan (gram-scale,
  -- mis. KENTANG 12.000,66) -- perbedaannya konsisten & tajam di semua sampel
  -- yang dicek. Opname sebelum batas ini TIDAK dipercaya sebagai gram walau
  -- tipenya opname_selisih, karena config bahan saat itu bisa saja belum
  -- lengkap (calculateTotalFisik jatuh ke cabang "return besar" apa adanya).
  SELECT COALESCE(
    (SELECT l.tipe = 'opname_selisih' AND l.created_at >= '2026-08-01 20:32:00+07'::timestamptz
     FROM public.ledger_stok l
     WHERE l.outlet_id = sb.outlet_id AND l.bahan_baku_id = sb.bahan_baku_id
     ORDER BY l.created_at DESC
     LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.last_opname_date(sb public.stok_balance)
 RETURNS timestamptz
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT l.created_at
  FROM public.ledger_stok l
  WHERE l.outlet_id = sb.outlet_id AND l.bahan_baku_id = sb.bahan_baku_id
    AND l.tipe = 'opname_selisih'
  ORDER BY l.created_at DESC
  LIMIT 1;
$$;

-- monitoring_view_spv: salinan definisi live (verifikasi 2026-08-02) + kolom baru
-- + last_opname_date diperbaiki (sebelumnya hardcode NULL, bug terpisah yang
-- ditemukan sekaligus saat investigasi ini).
CREATE OR REPLACE VIEW public.monitoring_view_spv AS
WITH resep_projection AS (
  SELECT ri.bahan_baku_id,
    res.outlet_id AS resep_outlet_id,
    res.scope AS resep_scope,
    res.nama AS resep_nama,
    ri.qty_per_porsi,
    ri.satuan AS ri_satuan
  FROM resep_item ri
  JOIN resep res ON res.id = ri.resep_id
  WHERE res.is_active = true AND ri.qty_per_porsi > 0::numeric
)
SELECT sb.outlet_id,
  o.name AS outlet_name,
  sb.bahan_baku_id,
  b.nama AS item_name,
  b.satuan,
  b.kategori,
  sb.saldo AS current_qty,
  COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) AS threshold,
  CASE
    WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) / 2.0) THEN 'below'::text
    WHEN (EXISTS (SELECT 1
       FROM resep_projection rp
      WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id) AND (sb.saldo IS NULL OR (sb.saldo / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric)) < COALESCE(o.marquee_warning_threshold, 7)::numeric))) THEN 'below'::text
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) THEN 'warning'::text
    ELSE 'ok'::text
  END AS status,
  (SELECT string_agg(((rp.resep_nama || ' ('::text) || floor(COALESCE(sb.saldo, 0::numeric) / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))::integer) || ' porsi)'::text, ' atau '::text) AS string_agg
     FROM resep_projection rp
    WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)) AS projection_text,
  false AS is_flagged,
  sb.updated_at AS last_updated,
  public.last_opname_date(sb) AS last_opname_date,
  public.saldo_is_gram(sb) AS saldo_is_gram
FROM stok_balance sb
JOIN outlets o ON sb.outlet_id = o.id
JOIN bahan_baku b ON sb.bahan_baku_id = b.id
LEFT JOIN outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
WHERE b.is_active = true
ORDER BY o.name, b.nama;

-- monitoring_view_crew: sama, urutan ORDER BY beda (tanpa outlet_name di depan
-- karena crew hanya lihat outlet sendiri) mengikuti definisi live.
CREATE OR REPLACE VIEW public.monitoring_view_crew AS
WITH resep_projection AS (
  SELECT ri.bahan_baku_id,
    res.outlet_id AS resep_outlet_id,
    res.scope AS resep_scope,
    res.nama AS resep_nama,
    ri.qty_per_porsi,
    ri.satuan AS ri_satuan
  FROM resep_item ri
  JOIN resep res ON res.id = ri.resep_id
  WHERE res.is_active = true AND ri.qty_per_porsi > 0::numeric
)
SELECT sb.outlet_id,
  o.name AS outlet_name,
  sb.bahan_baku_id,
  b.nama AS item_name,
  b.satuan,
  b.kategori,
  sb.saldo AS current_qty,
  COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) AS threshold,
  CASE
    WHEN sb.saldo < (COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) / 2.0) THEN 'below'::text
    WHEN (EXISTS (SELECT 1
       FROM resep_projection rp
      WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id) AND (sb.saldo IS NULL OR (sb.saldo / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric)) < COALESCE(o.marquee_warning_threshold, 7)::numeric))) THEN 'below'::text
    WHEN sb.saldo < COALESCE(orp.reorder_point, b.default_reorder_point, 10::numeric) THEN 'warning'::text
    ELSE 'ok'::text
  END AS status,
  (SELECT string_agg(((rp.resep_nama || ' ('::text) || floor(COALESCE(sb.saldo, 0::numeric) / NULLIF(calc_porsi_qty(rp.qty_per_porsi, rp.ri_satuan, b.satuan, b.satuan_kecil, b.faktor_tampilan), 0::numeric))::integer) || ' porsi)'::text, ' atau '::text) AS string_agg
     FROM resep_projection rp
    WHERE rp.bahan_baku_id = sb.bahan_baku_id AND (rp.resep_scope = 'global'::text OR rp.resep_outlet_id = sb.outlet_id)) AS projection_text,
  false AS is_flagged,
  sb.updated_at AS last_updated,
  public.last_opname_date(sb) AS last_opname_date,
  public.saldo_is_gram(sb) AS saldo_is_gram
FROM stok_balance sb
JOIN outlets o ON sb.outlet_id = o.id
JOIN bahan_baku b ON sb.bahan_baku_id = b.id
LEFT JOIN outlet_reorder_point orp ON orp.outlet_id = sb.outlet_id AND orp.bahan_baku_id = sb.bahan_baku_id
WHERE b.is_active = true
ORDER BY b.nama;

-- monitoring_view_scoped: pembungkus tipis monitoring_view_spv untuk leader
-- (filter accessible_outlet_ids()). Perlu diteruskan juga.
CREATE OR REPLACE VIEW public.monitoring_view_scoped AS
SELECT outlet_id,
  outlet_name,
  bahan_baku_id,
  item_name,
  satuan,
  kategori,
  current_qty,
  threshold,
  status,
  projection_text,
  is_flagged,
  last_updated,
  last_opname_date,
  saldo_is_gram
FROM public.monitoring_view_spv
WHERE outlet_id IN (SELECT accessible_outlet_ids());
