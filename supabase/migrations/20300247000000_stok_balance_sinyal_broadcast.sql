-- Sinyal "stok outlet berubah" lewat Broadcast from Database, pengganti langganan
-- postgres_changes di stok_balance untuk kasir (POS native & pos-kasir web).
--
-- Masalah (ukur 26 Sep 2026, pg_stat_statements 23 jam): Realtime `list_changes` memakan
-- 63,7% waktu eksekusi database. Penyumbang WAL terbesarnya stok_balance: ±174 rb UPDATE per
-- hari (±18 baris per penjualan lewat ledger_stamp_saldo), dan setiap perubahan diperiksa RLS
-- untuk tablet kasir outlet itu — 21 langganan postgres_changes yang hidup sepanjang hari.
-- Padahal kasir hanya memakai perubahan itu sebagai aba-aba menarik ulang
-- monitoring_view_crew; isi barisnya tidak pernah dipakai.
--
-- Perbaikan: SATU pesan broadcast per outlet per TRANSAKSI (bukan per baris) ke channel
-- privat 'stok:<outlet_id>'. Otorisasi terjadi sekali saat join channel (policy di
-- realtime.messages), bukan RLS per baris per pelanggan.
--
-- Aman bagi penjualan: pengiriman sinyal tidak pernah menggagalkan mutasi stok —
-- realtime.send menelan error-nya sendiri, dan pemanggilnya di sini dibungkus EXCEPTION.
--
-- Tahap: migrasi ini ADITIF. stok_balance TETAP di publication supabase_realtime, jadi klien
-- lama (POS <= 1.3.7, layar manajer superapp & web stok) tetap berjalan seperti biasa.
-- Mengeluarkannya dari publication adalah migrasi terpisah setelah semua klien pindah.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_stok_balance_sinyal_broadcast ON public.stok_balance;
--   DROP FUNCTION IF EXISTS public.stok_balance_sinyal_broadcast();
--   DROP POLICY IF EXISTS stok_sinyal_baca_outlet_yang_boleh ON realtime.messages;
BEGIN;

CREATE OR REPLACE FUNCTION public.stok_balance_sinyal_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_penanda text;
BEGIN
  IF NEW.outlet_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Satu penjualan menulis ±18 baris saldo outlet yang sama dalam satu transaksi; kasir
  -- cukup dibangunkan sekali. Penanda transaction-local (is_local = true) lenyap sendiri
  -- saat transaksi selesai, dan current_setting(..., true) mengembalikan NULL/'' bila belum ada.
  v_penanda := 'suka.stok_sinyal_' || replace(NEW.outlet_id::text, '-', '_');
  IF current_setting(v_penanda, true) = '1' THEN
    RETURN NULL;
  END IF;
  PERFORM set_config(v_penanda, '1', true);

  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('outlet_id', NEW.outlet_id),
      'stok_berubah',
      'stok:' || NEW.outlet_id::text,
      true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'stok_balance_sinyal_broadcast: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$;

-- Fungsi trigger tidak untuk dipanggil langsung.
REVOKE ALL ON FUNCTION public.stok_balance_sinyal_broadcast() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stok_balance_sinyal_broadcast ON public.stok_balance;
CREATE TRIGGER trg_stok_balance_sinyal_broadcast
AFTER INSERT OR UPDATE ON public.stok_balance
FOR EACH ROW EXECUTE FUNCTION public.stok_balance_sinyal_broadcast();

-- Join ke channel privat 'stok:<outlet_id>' hanya untuk staf yang boleh melihat outlet itu —
-- aturan yang sama dengan policy stok_balance_read. CASE menjamin cast uuid hanya dijalankan
-- untuk topic yang bentuknya sah (urutan evaluasi AND di Postgres tidak dijamin). Tanpa policy
-- INSERT, klien tidak bisa ikut mengirim pesan palsu ke topic ini.
DROP POLICY IF EXISTS stok_sinyal_baca_outlet_yang_boleh ON realtime.messages;
CREATE POLICY stok_sinyal_baca_outlet_yang_boleh
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND CASE
    WHEN (SELECT realtime.topic()) ~ '^stok:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN substring((SELECT realtime.topic()) FROM 6)::uuid IN (SELECT public.accessible_outlet_ids())
    ELSE false
  END
);

COMMIT;
