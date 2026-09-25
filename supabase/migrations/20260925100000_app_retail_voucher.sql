-- App Retail Tahap 3: voucher aplikasi pelanggan.
-- Spec: docs/superpowers/specs/2026-09-25-app-retail-tahap3-voucher-design.md
-- Sengaja TIDAK menumpang public.promos (harga otomatis POS tanpa identitas
-- pelanggan; digabung berarti voucher aplikasi bisa ikut menyala di kasir).

CREATE TABLE IF NOT EXISTS retail.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 60),
  deskripsi text NULL CHECK (deskripsi IS NULL OR char_length(deskripsi) <= 200),
  -- NULL = publik. Disimpan huruf besar supaya keunikan tak membedakan huruf.
  kode text NULL CHECK (kode IS NULL OR kode ~ '^[A-Z0-9]{3,20}$'),
  jenis text NOT NULL CHECK (jenis IN ('persen','nominal','gratis_item','beli_x_gratis_y','harga_spesial')),
  nilai numeric NULL,
  maks_potongan numeric NULL CHECK (maks_potongan IS NULL OR maks_potongan > 0),
  menu_item_id uuid NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  beli_qty int NULL CHECK (beli_qty IS NULL OR beli_qty >= 1),
  gratis_qty int NULL CHECK (gratis_qty IS NULL OR gratis_qty >= 1),
  harga_spesial numeric NULL CHECK (harga_spesial IS NULL OR harga_spesial >= 0),
  mulai timestamptz NULL,
  selesai timestamptz NULL,
  kuota_total int NULL CHECK (kuota_total IS NULL OR kuota_total >= 1),
  batas_per_pelanggan int NULL CHECK (batas_per_pelanggan IS NULL OR batas_per_pelanggan >= 1),
  min_belanja numeric NULL CHECK (min_belanja IS NULL OR min_belanja >= 0),
  khusus_pesanan_pertama boolean NOT NULL DEFAULT false,
  outlet_ids uuid[] NULL,
  hari smallint[] NULL CHECK (hari IS NULL OR hari <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  jam_mulai time NULL,
  jam_selesai time NULL,
  menu_ids uuid[] NULL,
  kategori_ids uuid[] NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CHECK (selesai IS NULL OR mulai IS NULL OR selesai > mulai),
  CHECK ((jam_mulai IS NULL) = (jam_selesai IS NULL)),
  -- Satu jenis tidak boleh berisi nilai yang tidak lengkap.
  -- Catatan: kolom nullable wajib dicek IS NOT NULL secara eksplisit di sini —
  -- CHECK constraint Postgres hanya menolak hasil FALSE, bukan NULL/UNKNOWN
  -- (mis. `nilai > 0` saat nilai NULL menghasilkan NULL, bukan FALSE, sehingga
  -- lolos diam-diam kalau tidak dicek eksplisit).
  CHECK (jenis <> 'persen' OR (nilai IS NOT NULL AND nilai > 0 AND nilai <= 100)),
  CHECK (jenis <> 'nominal' OR (nilai IS NOT NULL AND nilai > 0)),
  CHECK (jenis <> 'gratis_item' OR menu_item_id IS NOT NULL),
  CHECK (jenis <> 'beli_x_gratis_y' OR (beli_qty IS NOT NULL AND gratis_qty IS NOT NULL AND menu_ids IS NOT NULL AND cardinality(menu_ids) >= 1)),
  CHECK (jenis <> 'harga_spesial' OR (menu_item_id IS NOT NULL AND harga_spesial IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS vouchers_kode_uk ON retail.vouchers (kode) WHERE kode IS NOT NULL;

CREATE TABLE IF NOT EXISTS retail.voucher_pemakaian (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES retail.vouchers(id) ON DELETE RESTRICT,
  draft_id uuid NOT NULL UNIQUE REFERENCES retail.order_drafts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES retail.customers(id) ON DELETE CASCADE,
  potongan numeric NOT NULL CHECK (potongan >= 0),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  lunas_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS voucher_pemakaian_lunas_idx
  ON retail.voucher_pemakaian (voucher_id, customer_id) WHERE lunas_at IS NOT NULL;

CREATE OR REPLACE VIEW retail.voucher_ringkasan WITH (security_invoker = true) AS
SELECT voucher_id,
       count(*) FILTER (WHERE lunas_at IS NOT NULL)::int AS terpakai,
       COALESCE(sum(potongan) FILTER (WHERE lunas_at IS NOT NULL), 0) AS total_potongan
FROM retail.voucher_pemakaian
GROUP BY voucher_id;

-- Aksi log baru (CHECK asal: 20260924100000).
ALTER TABLE public.app_retail_log DROP CONSTRAINT IF EXISTS app_retail_log_aksi_check;
ALTER TABLE public.app_retail_log ADD CONSTRAINT app_retail_log_aksi_check CHECK (aksi IN (
  'pengaturan_ubah','tutup_sementara','buka_sekarang','jam_ubah','menu_habis_ubah','refund_selesai',
  'voucher_buat','voucher_ubah','voucher_aktif','voucher_hapus'));

REVOKE ALL ON retail.vouchers, retail.voucher_pemakaian, retail.voucher_ringkasan FROM anon, authenticated;
ALTER TABLE retail.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_pemakaian ENABLE ROW LEVEL SECURITY;
-- Tanpa policy: hanya service role (gateway & server action admin) yang menyentuh.
