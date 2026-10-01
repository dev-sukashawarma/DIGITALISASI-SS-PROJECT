-- Push notifikasi ke HR (role admin_hr) saat karyawan mengajukan cuti/izin
-- atau kasbon (2026-09-30).
--
-- Mekanismenya sama dengan push inventaris & ceklist harian
-- (20260929180000_hr_push_inventaris_ceklist): trigger → public.hr_kirim_push
-- → edge function `send-push` lewat pg_net (URL & secret dari Vault), payload
-- `url` = URL ABSOLUT web HR. pg_net baru mengirim setelah transaksi commit,
-- jadi pengajuan yang gagal tersimpan tidak memancarkan push. Kegagalan push
-- hanya WARNING — pengajuan tidak pernah gagal karena notifikasinya.
--
-- Kenapa trigger AFTER INSERT (bukan di RPC): pengajuan masuk lewat tiga
-- jalur yang menulis tabel langsung — web absensi, superapp native (termasuk
-- antrean offline) dan form HR — satu trigger menjaga semuanya.
--
-- Kenapa ke admin_hr saja: tahap SPV (`status_spv`) tidak pernah dipakai —
-- tak ada layar yang menyetujuinya; seluruh persetujuan cuti & kasbon
-- dilakukan HR di /perizinan.
--
-- Tidak dikirim bila:
--   * cuti yang masuk sudah bukan `pending` (impor staf massal menulis cuti
--     yang sudah disetujui), kasbon yang sudah lunas/ditolak/disetujui;
--   * yang memasukkan adalah admin_hr sendiri (HR menginput atas nama
--     karyawan dari layar persetujuan — tak perlu diberi tahu);
--   * pengaju adalah akun tes/bot/kiosk/mitra/owner atau staf outlet tes &
--     marketplace — mengikuti aturan `isTestOrDevStaff` di app HR.

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Identitas pengaju — dipakai kedua isi push
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hr_push_identitas_pengaju(p_staff_id UUID)
RETURNS TABLE (nama TEXT, jabatan TEXT, outlet TEXT, kirim BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s RECORD;
  v_outlet TEXT;
  v_tipe TEXT;
BEGIN
  SELECT st.name, st.display_name, st.role, st.outlet_id, st.account_category
    INTO v_s
    FROM public.outlet_staff st WHERE st.id = p_staff_id;
  IF NOT FOUND THEN
    nama := 'Karyawan'; jabatan := NULL; outlet := NULL; kirim := true;
    RETURN NEXT; RETURN;
  END IF;

  SELECT o.name, o.type INTO v_outlet, v_tipe FROM public.outlets o WHERE o.id = v_s.outlet_id;

  nama := COALESCE(NULLIF(btrim(v_s.name), ''), NULLIF(btrim(v_s.display_name), ''), 'Karyawan');
  jabatan := CASE lower(COALESCE(v_s.role, ''))
    WHEN 'crew' THEN 'Crew'
    WHEN 'kasir' THEN 'Kasir'
    WHEN 'leader' THEN 'Leader'
    WHEN 'spv' THEN 'SPV'
    WHEN 'korlap' THEN 'Korlap'
    WHEN 'area_manager' THEN 'Area Manager'
    WHEN 'regional_manager' THEN 'Regional Manager'
    WHEN 'kitchen' THEN 'Kitchen'
    WHEN 'staff_pusat' THEN 'Staf Pusat'
    WHEN 'developer' THEN 'Developer'
    WHEN 'purchasing' THEN 'Purchasing'
    WHEN 'admin_finance' THEN 'Admin Finance'
    WHEN 'admin' THEN 'Admin'
    ELSE NULLIF(initcap(replace(COALESCE(v_s.role, ''), '_', ' ')), '')
  END;
  outlet := NULLIF(btrim(v_outlet), '');
  kirim := NOT (
    (v_s.account_category IS NOT NULL AND v_s.account_category <> 'employee')
    OR lower(COALESCE(v_s.role, '')) IN ('kiosk', 'mitra', 'owner')
    OR COALESCE(v_tipe, 'outlet') IN ('test', 'marketplace')
  );
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_push_identitas_pengaju(UUID) FROM PUBLIC, anon, authenticated;

-- Tanggal pendek Indonesia: "2 Okt 2026".
CREATE OR REPLACE FUNCTION public.hr_push_tanggal(p_tgl DATE)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extract(day FROM p_tgl)::int || ' '
    || (ARRAY['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month FROM p_tgl)::int]
    || ' ' || extract(year FROM p_tgl)::int;
$$;

REVOKE ALL ON FUNCTION public.hr_push_tanggal(DATE) FROM PUBLIC, anon, authenticated;

-- Rupiah: "Rp 1.250.000".
CREATE OR REPLACE FUNCTION public.hr_push_rupiah(p_nilai NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'Rp ' || replace(to_char(round(COALESCE(p_nilai, 0)), 'FM999G999G999G990'), ',', '.');
$$;

REVOKE ALL ON FUNCTION public.hr_push_rupiah(NUMERIC) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Isi push pengajuan cuti / izin
--
--   🗓️ Pengajuan Cuti Tahunan · EMPANG
--   Andi (Crew · EMPANG) mengajukan Cuti Tahunan 3 hari.
--   📅 2 Okt – 4 Okt 2026
--   💬 Alasan: "Acara keluarga di kampung"
--   🧮 Sisa kuota cuti: 9 hari
--   📎 Ada lampiran
--   Menunggu persetujuan HR — ketuk untuk meninjau.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cuti_isi_push_hr(p_leave_id UUID)
RETURNS TABLE (judul TEXT, isi TEXT, url TEXT, kirim BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_l RECORD;
  p RECORD;
  v_jenis TEXT;
  v_tahunan BOOLEAN;
  v_kuota INTEGER;
  v_rentang TEXT;
  v_alasan TEXT;
BEGIN
  SELECT * INTO v_l FROM public.leave_requests WHERE id = p_leave_id;
  IF NOT FOUND THEN
    kirim := false; RETURN NEXT; RETURN;
  END IF;
  SELECT * INTO p FROM public.hr_push_identitas_pengaju(v_l.staff_id);

  v_tahunan := lower(COALESCE(v_l.leave_type, '')) IN ('annual', 'tahunan');
  v_jenis := CASE lower(COALESCE(v_l.leave_type, ''))
    WHEN 'annual' THEN 'Cuti Tahunan'
    WHEN 'tahunan' THEN 'Cuti Tahunan'
    WHEN 'sick' THEN 'Izin Sakit'
    WHEN 'sakit' THEN 'Izin Sakit'
    WHEN 'personal' THEN 'Izin Pribadi'
    WHEN 'pribadi' THEN 'Izin Pribadi'
    WHEN 'maternity' THEN 'Cuti Melahirkan'
    WHEN 'melahirkan' THEN 'Cuti Melahirkan'
    ELSE 'Izin Lainnya'
  END;

  IF v_l.start_date IS NULL THEN
    v_rentang := NULL;
  ELSIF v_l.end_date IS NULL OR v_l.end_date = v_l.start_date THEN
    v_rentang := public.hr_push_tanggal(v_l.start_date);
  ELSIF date_trunc('year', v_l.start_date) = date_trunc('year', v_l.end_date) THEN
    v_rentang := regexp_replace(public.hr_push_tanggal(v_l.start_date), ' \d{4}$', '')
      || ' – ' || public.hr_push_tanggal(v_l.end_date);
  ELSE
    v_rentang := public.hr_push_tanggal(v_l.start_date) || ' – ' || public.hr_push_tanggal(v_l.end_date);
  END IF;

  kirim := p.kirim AND v_l.status = 'pending';
  judul := '🗓️ Pengajuan ' || v_jenis || COALESCE(' · ' || p.outlet, '');
  isi := p.nama
    || CASE WHEN p.jabatan IS NOT NULL OR p.outlet IS NOT NULL
         THEN ' (' || concat_ws(' · ', p.jabatan, p.outlet) || ')' ELSE '' END
    || ' mengajukan ' || v_jenis
    || CASE WHEN COALESCE(v_l.days, 0) > 0 THEN ' ' || v_l.days || ' hari' ELSE '' END || '.';
  IF v_rentang IS NOT NULL THEN
    isi := isi || E'\n📅 ' || v_rentang;
  END IF;

  v_alasan := NULLIF(btrim(regexp_replace(COALESCE(v_l.reason, ''), '\s+', ' ', 'g')), '');
  IF v_alasan IS NOT NULL THEN
    isi := isi || E'\n💬 Alasan: "'
      || CASE WHEN length(v_alasan) > 120 THEN left(v_alasan, 117) || '...' ELSE v_alasan END || '"';
  END IF;

  IF v_tahunan THEN
    SELECT st.leave_quota INTO v_kuota FROM public.outlet_staff st WHERE st.id = v_l.staff_id;
    IF v_kuota IS NOT NULL THEN
      isi := isi || E'\n🧮 Sisa kuota cuti: ' || v_kuota || ' hari'
        || CASE WHEN COALESCE(v_l.days, 0) > v_kuota THEN ' ⚠️ kurang dari yang diajukan' ELSE '' END;
    END IF;
  END IF;

  IF COALESCE(btrim(v_l.attachment_url), '') <> '' THEN
    isi := isi || E'\n📎 Ada lampiran';
  END IF;

  isi := isi || E'\nMenunggu persetujuan HR — ketuk untuk meninjau.';
  url := 'https://hr.sukashawarma.com/perizinan/izin';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cuti_isi_push_hr(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Isi push pengajuan kasbon
--
--   💰 Pengajuan Kasbon · EMPANG
--   Andi (Crew · EMPANG) mengajukan kasbon Rp 300.000.
--   🔁 Dicicil 2 bulan (± Rp 150.000/bulan)
--   💬 Alasan: "Biaya berobat anak"
--   ⚠️ Kasbon lain belum lunas: Rp 200.000
--   Menunggu persetujuan HR — ketuk untuk meninjau.
--
-- `cash_advances.status` bukan status persetujuan (default 'active' sejak
-- diajukan); pengajuan baru dikenali dari INSERT itu sendiri.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kasbon_isi_push_hr(p_kasbon_id UUID)
RETURNS TABLE (judul TEXT, isi TEXT, url TEXT, kirim BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_k RECORD;
  p RECORD;
  v_cicil INTEGER;
  v_sisa_lain NUMERIC;
  v_alasan TEXT;
BEGIN
  SELECT * INTO v_k FROM public.cash_advances WHERE id = p_kasbon_id;
  IF NOT FOUND THEN
    kirim := false; RETURN NEXT; RETURN;
  END IF;
  SELECT * INTO p FROM public.hr_push_identitas_pengaju(v_k.staff_id);

  kirim := p.kirim
    AND COALESCE(v_k.status, 'active') NOT IN ('paid_off', 'rejected')
    AND COALESCE(v_k.status_hr, 'pending') NOT IN ('approved', 'rejected');
  judul := '💰 Pengajuan Kasbon' || COALESCE(' · ' || p.outlet, '');
  isi := p.nama
    || CASE WHEN p.jabatan IS NOT NULL OR p.outlet IS NOT NULL
         THEN ' (' || concat_ws(' · ', p.jabatan, p.outlet) || ')' ELSE '' END
    || ' mengajukan kasbon ' || public.hr_push_rupiah(v_k.amount) || '.';

  v_cicil := COALESCE(v_k.installment_months, 1);
  IF v_cicil > 1 THEN
    isi := isi || E'\n🔁 Dicicil ' || v_cicil || ' bulan (± '
      || public.hr_push_rupiah(v_k.amount / v_cicil) || '/bulan)';
  ELSE
    isi := isi || E'\n🔁 Potong gaji sekali (1 bulan)';
  END IF;

  v_alasan := NULLIF(btrim(regexp_replace(COALESCE(v_k.reason, ''), '\s+', ' ', 'g')), '');
  IF v_alasan IS NOT NULL THEN
    isi := isi || E'\n💬 Alasan: "'
      || CASE WHEN length(v_alasan) > 120 THEN left(v_alasan, 117) || '...' ELSE v_alasan END || '"';
  END IF;

  SELECT sum(COALESCE(c.remaining, c.amount)) INTO v_sisa_lain
    FROM public.cash_advances c
    WHERE c.staff_id = v_k.staff_id AND c.id <> v_k.id
      AND c.status = 'active' AND COALESCE(c.remaining, c.amount) > 0;
  IF COALESCE(v_sisa_lain, 0) > 0 THEN
    isi := isi || E'\n⚠️ Kasbon lain belum lunas: ' || public.hr_push_rupiah(v_sisa_lain);
  END IF;

  isi := isi || E'\nMenunggu persetujuan HR — ketuk untuk meninjau.';
  url := 'https://hr.sukashawarma.com/perizinan/kasbon';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.kasbon_isi_push_hr(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_cuti_push_hr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  -- Diinput HR sendiri dari layar persetujuan.
  IF auth.uid() IS NOT NULL AND public.is_admin_hr() THEN
    RETURN NULL;
  END IF;
  BEGIN
    SELECT * INTO p FROM public.cuti_isi_push_hr(NEW.id);
    IF p.kirim THEN
      PERFORM public.hr_kirim_push(p.judul, p.isi, p.url);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push pengajuan cuti ke HR gagal: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_cuti_push_hr() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cuti_push_hr ON public.leave_requests;
CREATE TRIGGER trg_cuti_push_hr
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cuti_push_hr();

CREATE OR REPLACE FUNCTION public.trg_kasbon_push_hr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_admin_hr() THEN
    RETURN NULL;
  END IF;
  BEGIN
    SELECT * INTO p FROM public.kasbon_isi_push_hr(NEW.id);
    IF p.kirim THEN
      PERFORM public.hr_kirim_push(p.judul, p.isi, p.url);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push pengajuan kasbon ke HR gagal: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_kasbon_push_hr() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kasbon_push_hr ON public.cash_advances;
CREATE TRIGGER trg_kasbon_push_hr
  AFTER INSERT ON public.cash_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kasbon_push_hr();
