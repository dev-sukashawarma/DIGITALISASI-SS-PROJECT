-- ============================================================
-- Nomor antrian POS: satu counter atomik per outlet per hari.
--
-- Mengganti DUA trigger BEFORE INSERT yang selama ini berebut:
--   * trg_fill_order_number       -> nextval(pos_sync_order_number_seq)
--   * trigger_generate_order_number -> SELECT MAX(order_number)+1  (balapan!)
-- Yang kedua selalu menang karena trigger dieksekusi urut abjad, dan ia
-- menimpa tanpa syarat -- termasuk menimpa nomor dari sequence sync.
--
-- MAX+1 tidak atomik: dua insert bersamaan di satu outlet bisa mendapat
-- nomor yang sama, dan tidak ada constraint yang menolaknya.
-- ============================================================

-- 1. Tabel counter. Tabel lama bernama sama SUDAH ADA di produksi dengan
--    bentuk (outlet_id, last_number) tanpa biz_date, kosong, dan tidak
--    dirujuk trigger/fungsi mana pun. CREATE TABLE IF NOT EXISTS akan
--    diam-diam melewatinya dan menyisakan tabel tanpa biz_date, jadi
--    tabel lama dibuang lebih dulu.
DROP TABLE IF EXISTS public.outlet_order_counters;

CREATE TABLE public.outlet_order_counters (
  outlet_id   uuid    NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  biz_date    date    NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (outlet_id, biz_date)
);

COMMENT ON TABLE public.outlet_order_counters IS
  'Counter nomor antrian per outlet per hari bisnis (Asia/Jakarta). Hanya ditulis oleh assign_order_number().';

-- Ditulis eksklusif lewat trigger SECURITY DEFINER; tidak ada akses langsung.
ALTER TABLE public.outlet_order_counters ENABLE ROW LEVEL SECURITY;

-- 2. Seed dari data yang sudah ada supaya nomor hari ini LANJUT, tidak
--    mengulang dari 1 dan menabrak order yang sudah tercetak strukmya.
INSERT INTO public.outlet_order_counters (outlet_id, biz_date, last_number)
SELECT
  outlet_id,
  (created_at AT TIME ZONE 'Asia/Jakarta')::date AS biz_date,
  MAX(order_number)
FROM public.orders
WHERE outlet_id IS NOT NULL
  AND order_number IS NOT NULL
  AND created_at >= now() - interval '2 days'
GROUP BY 1, 2;

-- 3. Trigger function tunggal. SECURITY DEFINER karena penulis order
--    (authenticated / service_role) tidak punya policy tulis ke tabel counter.
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_biz_date date;
  v_next     integer;
BEGIN
  IF NEW.outlet_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_biz_date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::date;

  -- Satu pernyataan, atomik. Tidak ada jendela balapan antara baca dan tulis.
  INSERT INTO public.outlet_order_counters AS c (outlet_id, biz_date, last_number)
  VALUES (NEW.outlet_id, v_biz_date, 1)
  ON CONFLICT (outlet_id, biz_date)
  DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_next;

  -- order_number yang dikirim client SENGAJA diabaikan. Server satu-satunya
  -- yang membagi nomor; client hanya menampilkan perkiraan saat offline.
  NEW.order_number := v_next;
  RETURN NEW;
END;
$$;

-- 4. Pasang trigger baru, buang dua trigger lama.
DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;
CREATE TRIGGER trg_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS trg_fill_order_number ON public.orders;

-- Fungsi lama dibiarkan ada (tanpa trigger) supaya migrasi lama yang
-- mereferensikannya tetap bisa dijalankan ulang tanpa error. Sequence
-- pos_sync_order_number_seq juga dibiarkan -- efektif tidak terpakai.

-- 5. Nomor kembar kini DITOLAK, bukan lolos diam-diam.
--    (Verified 2026-08-03: 0 grup duplikat sepanjang riwayat.)
CREATE UNIQUE INDEX IF NOT EXISTS orders_outlet_bizdate_number_uq
  ON public.orders (
    outlet_id,
    ((created_at AT TIME ZONE 'Asia/Jakarta')::date),
    order_number
  );
