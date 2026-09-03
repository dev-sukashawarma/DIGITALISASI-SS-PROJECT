-- 20300120000002_waste_ledger_reconcile.sql
--
-- KONTEKS: audit 2026-09-02. Dua lubang di jalur approve waste yang membuat
-- ledger_stok dan stok_waste_reports bisa berbeda tanpa ada yang tahu.
--
-- LUBANG 1 -- approve di luar transisi PENDING -> APPROVED melewati potong stok.
--   Trigger lama: IF NEW.status='APPROVED' AND OLD.status='PENDING'.
--   Jalur lain (REJECTED -> APPROVED, atau baris di-INSERT langsung APPROVED)
--   tidak pernah menulis ledger, TAPI laporan Rupiah tetap menghitungnya
--   (get_waste_periode hanya menyaring status='APPROVED').
--   Bukti Agustus 2026: 4 laporan APPROVED tanpa satu pun baris ledger --
--   Cimanggu KULIT 25 (1 Pack), Paledang SAPI (0,628 Blok), Cibubur SAPI
--   (3 Blok), Cibubur KULIT 25 (0,5 Pack).
--
-- LUBANG 2 -- qty diedit SETELAH approve, ledger tidak ikut dikoreksi.
--   Bukti Agustus 2026 di SUKA SHAWARMA BEJI / Sayur (lettuce):
--     laporan 49560a48  ledger -2.906.000  qty sekarang 2,906  (1.000x)
--     laporan dc465377  ledger -2.554.000  qty sekarang 2,554  (1.000x)
--   Crew di outlet itu rutin mengetik angka gram ke kolom kg (lihat deretan
--   laporan yang ditolak SPV: 2378, 3244, 2876, 1490, 1228, 2780, 1500).
--   Dua yang lolos approve masuk sebagai ribuan kg, to_ledger_scale mengalikan
--   1.000 lagi jadi jutaan gram, lalu qty-nya diperbaiki manual belakangan --
--   sementara baris ledger-nya dibiarkan. Saldo Beji meledak ke jutaan dan
--   ditambal lewat opname berulang (-4.909.961, -4.958.047, -2.091.803,
--   -5.036.850, -10.194.060). Itu bukan opname, itu menutupi angka rusak, dan
--   melanggar invariant stok_balance <-> ledger_stok.
--
-- PENDEKATAN: rekonsiliasi selisih, bukan sekadar menambah kondisi IF.
--   target  = -to_ledger_scale(qty)  bila status APPROVED, 0 bila tidak
--   sudah   = SUM(qty) baris ledger yang ref_waste_id = laporan ini
--   delta   = target - sudah  -> ditulis sebagai SATU baris ledger baru
--   Idempoten dan menutup semua kasus dengan satu rumus: approve pertama kali,
--   approve ulang, edit qty, dan batal-approve (delta positif = pengembalian).
--   Sesuai SOP proyek: koreksi stok SELALU lewat ledger_stok, tidak pernah
--   UPDATE stok_balance langsung.
--
-- ⚠ AMBANG WAKTU (v_cutoff) -- disengaja, jangan dihapus.
--   Rekonsiliasi penuh HANYA berlaku untuk laporan yang dibuat sejak cutoff.
--   Untuk laporan lama, trigger hanya mengisi ledger yang HILANG, tidak pernah
--   mengoreksi yang sudah terlanjur salah. Alasannya: dua baris Beji di atas
--   saldonya SUDAH ditambal berkali-kali lewat opname. Kalau trigger ini
--   merekonsiliasinya, ia akan menulis +2.903.094 dan +2.551.446 ke outlet yang
--   saldonya sekarang sudah wajar -- merusak ulang, bukan memperbaiki.
--   Perbaikan dua baris itu = pekerjaan data terpisah yang butuh keputusan
--   owner (opname ulang), bukan efek samping migration.
--
-- LINGKUP: hanya jalur approve waste. Tidak menyentuh rumus valuasi, harga,
--   faktor konversi, maupun laporan.

-- ------------------------------------------------------------------
-- 1. Trigger BEFORE lama disederhanakan: cuma stempel updated_at.
--    Penulisan ledger dipindah ke trigger AFTER (di bawah) supaya jalur INSERT
--    juga tertutup -- INSERT tidak bisa menulis ledger dari BEFORE trigger
--    karena FK ref_waste_id belum punya baris induk.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_waste_report_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------
-- 2. Rekonsiliasi ledger.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_waste_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff CONSTANT timestamptz := '2026-09-02 00:00:00+07';
  v_eps    CONSTANT numeric      := 0.000001;
  v_target numeric;
  v_sudah  numeric;
  v_delta  numeric;
  v_baris  integer;
  v_catatan text;
BEGIN
  -- Pindah outlet/bahan pada laporan yang sudah punya ledger akan membuat
  -- baris ledger lama menggantung di outlet yang salah. Tolak tegas.
  IF TG_OP = 'UPDATE'
     AND (NEW.outlet_id IS DISTINCT FROM OLD.outlet_id
          OR NEW.bahan_baku_id IS DISTINCT FROM OLD.bahan_baku_id)
  THEN
    SELECT count(*) INTO v_baris FROM public.ledger_stok WHERE ref_waste_id = NEW.id;
    IF v_baris > 0 THEN
      RAISE EXCEPTION 'Outlet/bahan laporan waste % tidak boleh diubah: sudah ada % baris ledger yang merujuknya. Batalkan approval dulu, atau buat laporan baru.',
        NEW.id, v_baris USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT COALESCE(SUM(qty), 0), count(*)
    INTO v_sudah, v_baris
  FROM public.ledger_stok
  WHERE ref_waste_id = NEW.id;

  v_target := CASE
                WHEN NEW.status = 'APPROVED'
                THEN -public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, NEW.qty)
                ELSE 0
              END;

  -- Laporan lama (sebelum cutoff): HANYA isi ledger yang benar-benar hilang.
  -- Jangan pernah mengoreksi baris lama -- lihat catatan AMBANG WAKTU di header.
  IF NEW.created_at < v_cutoff AND v_baris > 0 THEN
    RETURN NULL;
  END IF;

  v_delta := v_target - v_sudah;
  IF abs(v_delta) < v_eps THEN
    RETURN NULL;
  END IF;

  v_catatan := CASE
                 WHEN v_baris = 0 THEN 'Approval waste: ' || COALESCE(NEW.reason, '-')
                 WHEN v_target = 0 THEN 'Pembatalan waste: ' || COALESCE(NEW.reason, '-')
                 ELSE 'Koreksi waste: ' || COALESCE(NEW.reason, '-')
                      || ' (qty jadi ' || NEW.qty || ')'
               END;

  -- Delta negatif = pembuangan tambahan -> tipe 'waste'.
  -- Delta positif = pengembalian stok (batal approve / qty dikoreksi turun)
  -- -> tipe 'adjustment', mengikuti konvensi reversal yang sudah dipakai di
  -- proyek ini (lihat 20300103000006 fix_bom_reversal_regression). Rekonsiliasi
  -- di atas menjumlah SEMUA baris ber-ref_waste_id tanpa peduli tipe, jadi
  -- perbedaan tipe ini tidak memengaruhi perhitungan delta berikutnya.
  INSERT INTO public.ledger_stok (
    outlet_id, bahan_baku_id, tipe, qty, catatan, ref_waste_id, created_by
  ) VALUES (
    NEW.outlet_id,
    NEW.bahan_baku_id,
    CASE WHEN v_delta < 0 THEN 'waste' ELSE 'adjustment' END,
    v_delta,
    v_catatan,
    NEW.id,
    COALESCE(NEW.approved_by, NEW.reported_by)
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_waste_ledger ON public.stok_waste_reports;
CREATE TRIGGER trg_sync_waste_ledger
  AFTER INSERT OR UPDATE OF status, qty, outlet_id, bahan_baku_id
  ON public.stok_waste_reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_waste_ledger();
