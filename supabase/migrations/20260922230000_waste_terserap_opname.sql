-- 20260922230000_waste_terserap_opname.sql
--
-- MASALAH (waste tercatat dua kali)
-- Waste baru memotong saldo saat DISETUJUI. Laporan yang dibuat sebelum
-- sebuah opname tapi disetujui sesudahnya:
--   1. saat opname, barangnya sudah dibuang -> tak ikut dihitung fisik,
--      Sistem belum turun -> selisih tampil sebagai loss;
--   2. opname difinalisasi -> saldo = hitungan fisik (sudah tanpa barang itu);
--   3. waste disetujui -> saldo dipotong LAGI -> sistem < fisik -> opname
--      berikutnya tampil surplus.
-- September 2026: 93 dari 409 laporan waste APPROVED kena pola ini.
--
-- PERBAIKAN (keputusan owner 22 Sep 2026, "opsi 2")
-- Laporan waste yang TERSERAP opname tidak memotong saldo lagi. Terserap =
--   - ada opname (finalized / pending_approval) di outlet yang sama yang
--     menghitung fisik bahan itu (opname_item.qty_fisik IS NOT NULL), dan
--     opname itu dibuat SETELAH waste dilaporkan; DAN
--   - laporan ini BELUM PERNAH punya baris ledger ber-qty <> 0.
-- Syarat kedua penting: laporan yang sudah memotong stok (termasuk 93 kasus
-- historis) tetap direkonsiliasi seperti biasa. Tanpa syarat ini, mengedit
-- laporan lama akan membalik potongannya dan menciptakan stok hantu di atas
-- saldo yang sudah dibetulkan opname-opname sesudahnya.
--
-- Jejak audit: laporan terserap mendapat satu baris ledger tipe 'waste'
-- ber-qty 0 (saldo tak berubah) dengan catatan yang menyebut opname-nya,
-- supaya pemeriksa "ada baris ledger untuk waste ini" tetap menemukan jejak.
--
-- Nilai waste di laporan keuangan (get_waste_* RPC) dihitung dari
-- stok_waste_reports, bukan ledger -> tidak terpengaruh.
--
-- ⚠️ UTANG TIMESTAMP: fungsi ini juga didefinisikan di
-- 20300120000002_waste_ledger_reconcile.sql (sudah terstempel). Pada replay
-- dari nol berkas 2030 itu jalan paling akhir dan menimpa versi ini. Timestamp
-- 2030 tak dipakai karena scripts/migration-timestamp-lint.mjs menolaknya.
-- Preseden: 20260909170000.

CREATE OR REPLACE FUNCTION public.sync_waste_ledger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff CONSTANT timestamptz := '2026-09-02 00:00:00+07';
  v_eps    CONSTANT numeric      := 0.000001;
  v_target numeric;
  v_sudah  numeric;
  v_delta  numeric;
  v_baris  integer;
  v_catatan text;
  v_opname_id uuid;
  v_opname_tgl date;
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

  -- Terserap opname? Hanya dinilai bila laporan ini belum pernah memotong
  -- stok sama sekali (lihat header).
  IF NEW.status = 'APPROVED'
     AND NOT EXISTS (SELECT 1 FROM public.ledger_stok l
                     WHERE l.ref_waste_id = NEW.id AND l.qty <> 0)
  THEN
    SELECT o.id, o.tanggal INTO v_opname_id, v_opname_tgl
    FROM public.opname o
    JOIN public.opname_item oi
      ON oi.opname_id = o.id
     AND oi.bahan_baku_id = NEW.bahan_baku_id
     AND oi.qty_fisik IS NOT NULL
    WHERE o.outlet_id = NEW.outlet_id
      AND o.status IN ('finalized', 'pending_approval')
      AND o.created_at > NEW.created_at
    ORDER BY o.created_at
    LIMIT 1;
  END IF;

  v_target := CASE
                WHEN NEW.status = 'APPROVED' AND v_opname_id IS NULL
                THEN -public.to_ledger_scale(NEW.outlet_id, NEW.bahan_baku_id, NEW.qty)
                ELSE 0
              END;

  -- Laporan lama (sebelum cutoff): HANYA isi ledger yang benar-benar hilang.
  -- Jangan pernah mengoreksi baris lama -- lihat catatan AMBANG WAKTU di
  -- 20300120000002.
  IF NEW.created_at < v_cutoff AND v_baris > 0 THEN
    RETURN NULL;
  END IF;

  -- Terserap & belum ada jejak: tulis satu baris qty 0 sebagai jejak audit.
  IF v_opname_id IS NOT NULL AND v_baris = 0 THEN
    INSERT INTO public.ledger_stok (
      outlet_id, bahan_baku_id, tipe, qty, catatan, ref_waste_id, created_by
    ) VALUES (
      NEW.outlet_id,
      NEW.bahan_baku_id,
      'waste',
      0,
      'Approval waste (terserap opname ' || v_opname_tgl || ', tidak memotong stok lagi): '
        || COALESCE(NEW.reason, '-'),
      NEW.id,
      COALESCE(NEW.approved_by, NEW.reported_by)
    );
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
  -- -> tipe 'adjustment' (konvensi reversal proyek ini, lihat
  -- 20300103000006). Rekonsiliasi di atas menjumlah SEMUA baris
  -- ber-ref_waste_id tanpa peduli tipe.
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
$function$;
