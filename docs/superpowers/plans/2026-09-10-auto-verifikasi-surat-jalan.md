# Auto-Verifikasi Surat Jalan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surat jalan yang sudah lewat harinya ditutup otomatis oleh database, dianggap diterima sesuai yang dikirim — supaya rantai stok gudang→outlet tidak lagi putus sebelah, dan selisih fisik jadi punya alamat.

**Architecture:** Satu fungsi PL/pgSQL dijadwalkan `pg_cron` di dalam database. Fungsi itu mengisi `qty_terima := qty_dikirim` lalu memanggil `finalize_surat_jalan_and_ledger` yang sudah ada — nol penulis stok baru. Ditambah satu migration sekali-jalan untuk menutup tunggakan sebagai dokumen, tanpa menyentuh stok.

**Tech Stack:** PostgreSQL/PL-pgSQL (Supabase), `pg_cron`, diterapkan lewat RPC `exec_sql` + stempel manual `schema_migrations`.

**Spec:** `docs/superpowers/specs/2026-09-10-auto-verifikasi-surat-jalan-design.md`

## Global Constraints

- **Semua perubahan stok lewat `ledger_stok`.** Jangan pernah `UPDATE`/`INSERT` `stok_balance` langsung (SOP 2026-07-08).
- **Jangan bikin fungsi pencatat stok baru.** Pakai `finalize_surat_jalan_and_ledger` apa adanya. Sesi 9 September dihabiskan menutup bug salah konversi satuan di fungsi pencatat stok; jalur baru mengundangnya lagi.
- **Berlaku ke depan saja.** Tanggal mulai **14 September 2026** dipasang sebagai konstanta di dalam fungsi. SJ yang dikirim sebelum itu tidak boleh tersentuh auto-verifikasi.
- **Agustus dilewati.** Keputusan owner 2026-09-09, ditegaskan 2026-09-10. 209 SJ Agustus tidak masuk lingkup apa pun di rencana ini.
- **Verifikasi ground-truth di DB live.** Jangan percaya status `migration list`.
- **Migration idempoten**, masing-masing dengan blok `-- DOWN:` sebagai komentar.
- **Jangan sentuh kerja developer lain** yang belum di-commit. Tiap commit menyebut berkas eksplisit; `git add -A` dilarang.
- **Nol perubahan kode aplikasi.** Tidak ada app yang perlu redeploy karena rencana ini.

---

## Keputusan owner yang mengikat (jangan dibuka ulang saat eksekusi)

| # | Keputusan | Tanggal |
|---|---|---|
| K1 | Tenggat = **lewat hari**, ditutup **dini hari** (02:00 WIB), sekali sehari | 2026-09-10 |
| K2 | Antrean validasi Pusat dipegang role **`kitchen`** | 2026-09-10 |
| K3 | Mulai berlaku **14 September 2026** | 2026-09-10 |
| K4 | Tunggakan September **ditutup sebagai dokumen, tanpa mengubah stok** | 2026-09-10 |
| K5 | **Agustus dilewati seluruhnya** | 2026-09-09 |

### Kenapa K4 begitu

Barang tunggakan sudah lama terserap opname outlet. Kalau sekarang stoknya
ditambahkan, saldo outlet naik ratusan juta di atas angka yang sudah benar —
stok hantu. Jadi dokumennya ditutup, stoknya tidak disentuh sama sekali.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20260911100000_surat_jalan_kolom_penanda.sql` | Dua kolom penanda, aditif |
| `supabase/migrations/20260911110000_fungsi_auto_verifikasi_surat_jalan.sql` | Fungsi + penjaga, belum dijadwalkan |
| `supabase/migrations/20260914100000_jadwalkan_auto_verifikasi.sql` | Jadwal `pg_cron` 19:00 UTC |
| `supabase/migrations/20260914110000_tutup_tunggakan_sj_september.sql` | Penutupan tunggakan, daftar id disusun saat eksekusi |
| `SS COGS SET/verifikasi-auto-sj-2026-09.sql` | Skrip read-only: sebelum & sesudah |
| `CLAUDE.md` | Entri sesi |

---

## Task 1: Dua kolom penanda

**Files:**
- Create: `supabase/migrations/20260911100000_surat_jalan_kolom_penanda.sql`

**Interfaces:**
- Produces: `surat_jalan.auto_verified_at timestamptz NULL`, `surat_jalan.ditutup_administratif_at timestamptz NULL` — dipakai Task 2 dan Task 4.

- [ ] **Step 1: Tulis migration**

```sql
-- 20260911100000_surat_jalan_kolom_penanda.sql
-- Dua penanda di surat_jalan, keduanya aditif dan nullable.
--
-- KENAPA PERLU
--   finalize_surat_jalan_and_ledger menulis catatan ledger yang sama persis
--   untuk semua verifikasi ('Auto-entry from surat jalan verification'). Tanpa
--   penanda di tabel induk, kiriman yang ditutup sistem tak bisa dibedakan dari
--   yang diverifikasi crew -- dan kalau opname outlet itu kemudian kurang,
--   selisihnya tak bisa ditelusuri asalnya.
--
--   Seluruh gunanya rancangan ini bersandar pada selisih yang punya alamat.
--   Penanda inilah alamatnya.
--
-- DUA PENANDA, DUA FAKTA BERBEDA
--   auto_verified_at         : ditutup sistem karena lewat hari, stok DITULIS
--   ditutup_administratif_at : tunggakan ditutup sebagai dokumen, stok TIDAK
--                              ditulis sama sekali (keputusan owner K4)
--
--   Jangan digabung jadi satu kolom. Yang pertama menambah stok, yang kedua
--   tidak; membedakannya nanti dari satu kolom saja mustahil.
--
-- Idempoten.

ALTER TABLE public.surat_jalan
  ADD COLUMN IF NOT EXISTS auto_verified_at timestamptz;

ALTER TABLE public.surat_jalan
  ADD COLUMN IF NOT EXISTS ditutup_administratif_at timestamptz;

COMMENT ON COLUMN public.surat_jalan.auto_verified_at IS
  'Diisi saat SJ ditutup otomatis karena lewat hari. Stok outlet DITAMBAH lewat finalize_surat_jalan_and_ledger. NULL = diverifikasi manusia atau belum ditutup.';

COMMENT ON COLUMN public.surat_jalan.ditutup_administratif_at IS
  'Diisi saat SJ tunggakan ditutup sebagai dokumen saja. Stok TIDAK disentuh, karena barangnya sudah terserap opname. NULL = bukan penutupan administratif.';

-- DOWN:
-- ALTER TABLE public.surat_jalan DROP COLUMN IF EXISTS auto_verified_at;
-- ALTER TABLE public.surat_jalan DROP COLUMN IF EXISTS ditutup_administratif_at;
```

- [ ] **Step 2: Lint timestamp**

```bash
node scripts/migration-timestamp-lint.mjs supabase/migrations/20260911100000_surat_jalan_kolom_penanda.sql
```
Harapan: exit 0.

- [ ] **Step 3: Terapkan & verifikasi ground-truth**

Terapkan lewat `exec_sql`, lalu buktikan kolomnya benar-benar ada — pakai pola
assertion `DO` block, karena `exec_sql` mengembalikan `null` untuk `SELECT`:

```sql
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema='public' AND table_name='surat_jalan'
         AND column_name IN ('auto_verified_at','ditutup_administratif_at')) <> 2 THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: kolom penanda belum ada';
  END IF;
END $$;
```

Jalankan juga kontrol negatif (assertion yang pasti gagal) untuk membuktikan
kanalnya memang bisa melempar error. Lalu stempel `schema_migrations`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260911100000_surat_jalan_kolom_penanda.sql
git commit -m "feat(db): kolom penanda auto-verifikasi & penutupan administratif surat jalan"
```

---

## Task 2: Fungsi auto-verifikasi

**Files:**
- Create: `supabase/migrations/20260911110000_fungsi_auto_verifikasi_surat_jalan.sql`

**Interfaces:**
- Consumes: kolom dari Task 1, `finalize_surat_jalan_and_ledger(uuid)`, `outlets.type`, `bahan_baku.is_active`
- Produces: `auto_verifikasi_surat_jalan(p_dry_run boolean DEFAULT false) RETURNS TABLE(diproses int, dilewati int, daftar text)` — dipanggil Task 3.

- [ ] **Step 1: Tulis migration**

```sql
-- 20260911110000_fungsi_auto_verifikasi_surat_jalan.sql
-- Menutup surat jalan yang sudah lewat harinya, dianggap diterima sesuai kirim.
--
-- MASALAH YANG DITUTUP
--   Separuh kiriman gudang->outlet tak pernah diverifikasi crew (Agustus
--   209/418, September 39/93). Gudang Pusat sudah didebit saat SJ ditandai
--   dikirim, tapi outlet tak pernah dikredit. Yang menambal selama ini opname
--   -- sehingga opname berhenti berfungsi sebagai pemeriksa.
--
-- TENGGAT: LEWAT HARI (keputusan owner 2026-09-10)
--   Diukur dari surat_jalan_item.verified_at pada 216 SJ sejak 1 Agustus:
--   98% diverifikasi di hari yang sama, 2% besoknya, NOL lebih dari itu.
--   Kalau tidak diverifikasi hari itu, praktis tidak akan pernah.
--
-- HARI KIRIM BERAKHIR 21:00, BUKAN TENGAH MALAM
--   Owner: barang tiba di outlet paling lambat pukul 21:00. Kiriman yang
--   ditandai dikirim pukul 21:00 ke atas berarti barangnya baru jalan malam
--   itu -- outlet belum punya kesempatan. Tanpa aturan ini, kiriman 21:10 Senin
--   ditutup Selasa 02:00, cuma 5 jam kemudian, seluruhnya saat outlet tutup.
--   Terdampak 21 dari 524 SJ (4%).
--
--   Teknisnya: batas hari digeser dengan menambah 3 jam sebelum diambil
--   tanggalnya. Sen 21:10 + 3j = Sel 00:10 -> hari Selasa. Sen 20:00 + 3j =
--   Sen 23:00 -> hari Senin.
--
-- NOL PENULIS STOK BARU
--   Fungsi ini hanya mengisi qty_terima lalu memanggil
--   finalize_surat_jalan_and_ledger, yang sudah SECURITY DEFINER, sudah memakai
--   to_ledger_scale() (gram vs satuan besar), dan sudah menolak verifikasi
--   ganda. Sesi 9 September dihabiskan menutup bug salah konversi satuan di
--   fungsi pencatat stok -- jangan bikin jalur baru.
--
-- verified_at SENGAJA TIDAK DIISI
--   Kolom itu berarti "diverifikasi manusia" dan dipakai untuk mengukur
--   kebiasaan crew. Mengisinya di sini akan merusak pengukuran itu selamanya.
--   Penanda auto_verified_at di tabel induk yang menandai penutupan sistem.
--
-- BERHENTI DI diterima_lengkap, TIDAK SAMPAI selesai
--   Alurnya dua tahap: outlet menerima (stok bertambah), lalu Pusat memvalidasi
--   & menutup jadi 'selesai' lewat tombol handleVerifyPusat. Fungsi ini hanya
--   menggantikan tahap 1. Kiriman yang ditutup sistem sengaja mengendap di
--   antrean validasi Pusat (role kitchen, keputusan owner) -- kalau ikut
--   ditutup sampai 'selesai', kiriman yang tak diperiksa siapa pun justru jadi
--   satu-satunya yang lolos tanpa mata manusia.
--
-- Idempoten (CREATE OR REPLACE). Belum dijadwalkan -- lihat migration
-- 20260914100000.

CREATE OR REPLACE FUNCTION public.auto_verifikasi_surat_jalan(
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE(diproses int, dilewati int, daftar text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  -- Forward-only. SJ sebelum tanggal ini TIDAK BOLEH tersentuh: barangnya sudah
  -- terserap opname, menambahkannya lagi = stok hantu ratusan juta.
  c_mulai      CONSTANT date := DATE '2026-09-14';
  -- Geser batas hari dari 00:00 ke 21:00.
  c_geser      CONSTANT interval := interval '3 hours';
  c_batas      CONSTANT int := 50;   -- maksimal per jalan

  v_sj         RECORD;
  v_n          int := 0;
  v_skip       int := 0;
  v_daftar     text := '';
BEGIN
  FOR v_sj IN
    SELECT sj.id, sj.outlet_id, sj.updated_at
      FROM public.surat_jalan sj
     WHERE sj.status = 'dikirim'
       AND sj.auto_verified_at IS NULL
       AND sj.ditutup_administratif_at IS NULL
       -- hari kirimnya sudah lewat (batas 21:00 WIB)
       AND ((((sj.updated_at AT TIME ZONE 'Asia/Jakarta') + c_geser)::date)
            < (((now()          AT TIME ZONE 'Asia/Jakarta') + c_geser)::date))
       -- forward-only
       AND ((sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date) >= c_mulai
       -- outlet tes tidak masuk perhitungan apa pun (aturan owner 8 Sep)
       AND NOT EXISTS (
             SELECT 1 FROM public.outlets o
              WHERE o.id = sj.outlet_id AND o.type = 'test')
       -- jangan hidupkan stok di bahan yang sudah dinonaktifkan
       AND NOT EXISTS (
             SELECT 1 FROM public.surat_jalan_item i
               JOIN public.bahan_baku b ON b.id = i.bahan_baku_id
              WHERE i.surat_jalan_id = sj.id AND b.is_active = false)
       -- crew sedang memverifikasi sebagian: jangan didahului
       AND NOT EXISTS (
             SELECT 1 FROM public.surat_jalan_item i
              WHERE i.surat_jalan_id = sj.id AND i.qty_terima IS NOT NULL)
       -- sabuk pengaman: stok masuk belum pernah ditulis
       AND NOT EXISTS (
             SELECT 1 FROM public.ledger_stok l
              WHERE l.ref_shipment_id = sj.id AND l.tipe = 'terima_kiriman')
     ORDER BY sj.updated_at
     LIMIT c_batas
  LOOP
    v_daftar := v_daftar || v_sj.id::text || ' ';

    IF p_dry_run THEN
      v_n := v_n + 1;
      CONTINUE;
    END IF;

    UPDATE public.surat_jalan_item
       SET qty_terima = qty_dikirim
     WHERE surat_jalan_id = v_sj.id;

    UPDATE public.surat_jalan
       SET auto_verified_at = now()
     WHERE id = v_sj.id;

    PERFORM public.finalize_surat_jalan_and_ledger(v_sj.id);
    v_n := v_n + 1;
  END LOOP;

  -- Berapa yang lewat hari tapi sengaja dilewati penjaga -- angka ini yang
  -- memberi tahu kalau ada yang mandek diam-diam.
  SELECT count(*) INTO v_skip
    FROM public.surat_jalan sj
   WHERE sj.status = 'dikirim'
     AND sj.auto_verified_at IS NULL
     AND sj.ditutup_administratif_at IS NULL
     AND ((((sj.updated_at AT TIME ZONE 'Asia/Jakarta') + c_geser)::date)
          < (((now() AT TIME ZONE 'Asia/Jakarta') + c_geser)::date))
     AND ((sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date) >= c_mulai;
  v_skip := GREATEST(v_skip - v_n, 0);

  RETURN QUERY SELECT v_n, v_skip, NULLIF(btrim(v_daftar), '');
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_verifikasi_surat_jalan(boolean)
  FROM PUBLIC, anon, authenticated;

-- DOWN:
-- DROP FUNCTION IF EXISTS public.auto_verifikasi_surat_jalan(boolean);
```

- [ ] **Step 2: Lint timestamp**

```bash
node scripts/migration-timestamp-lint.mjs supabase/migrations/20260911110000_fungsi_auto_verifikasi_surat_jalan.sql
```

- [ ] **Step 3: Terapkan, lalu uji dengan DRY RUN**

Terapkan lewat `exec_sql`. Lalu jalankan **dry run** — ini fungsi yang menulis
stok, jadi jangan pernah dijalankan langsung tanpa melihat dulu apa yang akan
disentuhnya:

```sql
SELECT * FROM public.auto_verifikasi_surat_jalan(true);
```

Karena `exec_sql` tak bisa mengembalikan baris, panggil lewat PostgREST
(`s.rpc('auto_verifikasi_surat_jalan', { p_dry_run: true })`) dengan service
role.

**Harapan saat rencana ini ditulis: `diproses = 0`** — tanggal mulai 14
September belum tiba, jadi tidak ada satu pun SJ yang lolos filter. Kalau
angkanya bukan nol, **berhenti**: berarti konstanta tanggal salah pasang, dan
itu satu-satunya penjaga yang melindungi tunggakan.

- [ ] **Step 4: Verifikasi definisi fungsi di DB live**

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'auto_verifikasi_surat_jalan'
       AND prosecdef
       AND pg_get_functiondef(oid) LIKE '%2026-09-14%'
       AND pg_get_functiondef(oid) LIKE '%finalize_surat_jalan_and_ledger%'
  ) THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL';
  END IF;
END $$;
```

Stempel `schema_migrations` setelah lolos.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260911110000_fungsi_auto_verifikasi_surat_jalan.sql
git commit -m "feat(db): fungsi auto-verifikasi surat jalan (belum dijadwalkan)"
```

---

## Task 3: Jadwalkan `pg_cron`

⚠️ **Jangan kerjakan sebelum Task 2 lolos dry run dengan hasil nol.**

**Files:**
- Create: `supabase/migrations/20260914100000_jadwalkan_auto_verifikasi.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- 20260914100000_jadwalkan_auto_verifikasi.sql
-- Jadwalkan auto_verifikasi_surat_jalan sekali sehari.
--
-- ⚠️ pg_cron MENJADWAL DALAM UTC.
--   Owner minta ditutup dini hari, 02:00 WIB.
--   02:00 WIB = 19:00 UTC HARI SEBELUMNYA.
--   Salah pasang di sini menggeser tenggat 7 jam tanpa gejala apa pun.
--   Wajib diverifikasi setelah dipasang -- lihat Step 3.
--
-- Idempoten: unschedule dulu kalau namanya sudah ada.

SELECT cron.unschedule('auto-verifikasi-surat-jalan')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-verifikasi-surat-jalan');

SELECT cron.schedule(
  'auto-verifikasi-surat-jalan',
  '0 19 * * *',                                   -- 19:00 UTC = 02:00 WIB besoknya
  $$SELECT public.auto_verifikasi_surat_jalan();$$
);

-- DOWN:
-- SELECT cron.unschedule('auto-verifikasi-surat-jalan');
```

- [ ] **Step 2: Terapkan & stempel**

- [ ] **Step 3: Verifikasi jadwalnya benar-benar terdaftar dan jamnya benar**

```sql
DO $$
DECLARE v_sched text;
BEGIN
  SELECT schedule INTO v_sched FROM cron.job
   WHERE jobname = 'auto-verifikasi-surat-jalan';
  IF v_sched IS NULL THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: jadwal tidak terdaftar';
  END IF;
  IF v_sched <> '0 19 * * *' THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: jadwal % bukan 0 19 * * * (02:00 WIB)', v_sched;
  END IF;
END $$;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100000_jadwalkan_auto_verifikasi.sql
git commit -m "feat(db): jadwalkan auto-verifikasi surat jalan 02:00 WIB"
```

---

## Task 4: Tutup tunggakan sebagai dokumen

⚠️ **Dikerjakan pada hari go-live (14 September), bukan lebih awal.** Daftarnya
bertambah ~5 SJ/hari; menyusunnya sekarang akan meninggalkan sisa.

**Files:**
- Create: `supabase/migrations/20260914110000_tutup_tunggakan_sj_september.sql`

- [ ] **Step 1: Susun daftar terkini**

```sql
SELECT sj.id, sj.created_at::date AS tgl, o.name AS outlet, sj.status
  FROM public.surat_jalan sj
  JOIN public.outlets o ON o.id = sj.outlet_id
 WHERE sj.status = 'dikirim'
   AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date >= DATE '2026-09-01'
   AND (sj.created_at AT TIME ZONE 'Asia/Jakarta')::date <  DATE '2026-09-14'
 ORDER BY sj.created_at;
```

Perkiraan 60–65 baris. **Agustus tidak termasuk** (K5) — batas bawah
1 September itu penjaganya, jangan dilonggarkan.

- [ ] **Step 2: Tulis migration dengan id eksplisit**

```sql
-- 20260914110000_tutup_tunggakan_sj_september.sql
-- Menutup tunggakan surat jalan September sebagai DOKUMEN saja.
-- Keputusan owner 2026-09-10: "tutup sebagai dokumen tanpa mengubah stok".
--
-- KENAPA STOK TIDAK DISENTUH
--   Barangnya sudah diterima outlet (dikonfirmasi owner) dan sudah lama
--   terserap opname harian, yang menyetel saldo ke hitungan fisik. Kalau
--   stoknya ditambahkan sekarang, saldo outlet naik ratusan juta di atas angka
--   yang sudah benar. Gudang Pusat sudah didebit saat SJ ditandai dikirim, dan
--   debit itu memang benar -- barangnya nyata keluar.
--
--   Jadi kedua sisi buku sebenarnya sudah betul. Yang salah cuma dokumennya
--   yang menggantung.
--
-- NOL BARIS LEDGER DITULIS. Ini murni UPDATE status + penanda.
--
-- KENAPA 'selesai'
--   'dibatalkan' salah secara fakta -- barangnya sampai. 'selesai' adalah
--   status akhir yang benar; penanda ditutup_administratif_at yang membedakan
--   dari SJ yang melewati verifikasi sungguhan.
--
-- AGUSTUS TIDAK TERMASUK. Keputusan owner 2026-09-09, ditegaskan 2026-09-10.
-- 209 SJ Agustus dibiarkan apa adanya.
--
-- Daftar id eksplisit: idempoten, dan SJ baru tidak ikut tersapu.

UPDATE public.surat_jalan
   SET status = 'selesai',
       ditutup_administratif_at = now(),
       notes = COALESCE(NULLIF(notes, ''), '')
               || ' [Ditutup administratif 2026-09-14: barang sudah diterima, '
               || 'stok sudah tercermin lewat opname, tidak ada ledger ditulis]',
       updated_at = now()
 WHERE id IN (
   -- <TEMPEL id dari Step 1, satu per baris, dengan komentar outlet + tanggal>
 )
   AND status = 'dikirim';

-- DOWN:
-- UPDATE public.surat_jalan
--    SET status = 'dikirim', ditutup_administratif_at = NULL
--  WHERE id IN (<daftar id yang sama>) AND ditutup_administratif_at IS NOT NULL;
```

- [ ] **Step 3: Terapkan, lalu verifikasi TIGA hal**

```sql
DO $$
DECLARE v_sisa int; v_ledger int;
BEGIN
  -- 1. tak ada lagi tunggakan September yang berstatus dikirim
  SELECT count(*) INTO v_sisa FROM public.surat_jalan
   WHERE status = 'dikirim'
     AND (created_at AT TIME ZONE 'Asia/Jakarta')::date >= DATE '2026-09-01'
     AND (created_at AT TIME ZONE 'Asia/Jakarta')::date <  DATE '2026-09-14';
  IF v_sisa > 0 THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: masih ada % tunggakan', v_sisa;
  END IF;

  -- 2. NOL baris terima_kiriman ditulis untuk SJ yang baru ditutup
  SELECT count(*) INTO v_ledger FROM public.ledger_stok l
    JOIN public.surat_jalan sj ON sj.id = l.ref_shipment_id
   WHERE sj.ditutup_administratif_at IS NOT NULL
     AND l.tipe = 'terima_kiriman';
  IF v_ledger > 0 THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: % baris stok tertulis, seharusnya nol', v_ledger;
  END IF;

  -- 3. Agustus tidak tersentuh
  IF EXISTS (SELECT 1 FROM public.surat_jalan
              WHERE ditutup_administratif_at IS NOT NULL
                AND (created_at AT TIME ZONE 'Asia/Jakarta')::date < DATE '2026-09-01') THEN
    RAISE EXCEPTION 'VERIFIKASI GAGAL: ada SJ pra-September ikut tertutup';
  END IF;
END $$;
```

Pengecekan nomor 2 adalah yang terpenting: seluruh keputusan K4 bersandar pada
tidak adanya satu pun baris stok yang tertulis.

- [ ] **Step 4: Stempel & commit**

```bash
git add supabase/migrations/20260914110000_tutup_tunggakan_sj_september.sql
git commit -m "chore(db): tutup tunggakan surat jalan September sebagai dokumen"
```

---

## Task 5: Skrip pemantau & catatan sesi

**Files:**
- Create: `SS COGS SET/verifikasi-auto-sj-2026-09.sql`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Tulis skrip pemantau**

```sql
-- verifikasi-auto-sj-2026-09.sql
-- READ-ONLY. Dijalankan berkala setelah auto-verifikasi hidup.

-- Q1: apakah cron benar-benar jalan, dan jam berapa?
SELECT jobname, schedule, active FROM cron.job
 WHERE jobname = 'auto-verifikasi-surat-jalan';

SELECT start_time, status, return_message
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
 WHERE j.jobname = 'auto-verifikasi-surat-jalan'
 ORDER BY start_time DESC LIMIT 14;

-- Q2: berapa yang ditutup sistem vs diverifikasi crew, per hari.
-- Kalau kolom auto_verified_at mendominasi, artinya crew makin tidak
-- memverifikasi -- itu sinyal yang harus ditindak, bukan diabaikan.
SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS tgl,
       count(*) FILTER (WHERE auto_verified_at IS NOT NULL) AS ditutup_sistem,
       count(*) FILTER (WHERE auto_verified_at IS NULL
                          AND ditutup_administratif_at IS NULL
                          AND status <> 'dikirim')          AS diverifikasi_crew,
       count(*) FILTER (WHERE status = 'dikirim')           AS masih_menggantung
  FROM public.surat_jalan
 WHERE created_at >= DATE '2026-09-14'
 GROUP BY 1 ORDER BY 1 DESC;

-- Q3: antrean validasi Pusat (role kitchen). Kalau angka ini terus naik,
-- bebannya cuma pindah dari outlet ke Pusat, tidak selesai.
SELECT count(*) AS menunggu_validasi_pusat,
       min(created_at)::date AS tertua
  FROM public.surat_jalan
 WHERE status IN ('diterima_lengkap','diterima_sebagian');

-- Q4: SJ yang lewat hari tapi TIDAK diproses -- ketahuan mandek diam-diam
-- karena kena penjaga (bahan nonaktif, dsb).
SELECT sj.id, sj.created_at::date, o.name
  FROM public.surat_jalan sj JOIN public.outlets o ON o.id = sj.outlet_id
 WHERE sj.status = 'dikirim'
   AND sj.auto_verified_at IS NULL
   AND (sj.updated_at AT TIME ZONE 'Asia/Jakarta')::date >= DATE '2026-09-14'
   AND (((sj.updated_at AT TIME ZONE 'Asia/Jakarta') + interval '3 hours')::date)
       < (((now() AT TIME ZONE 'Asia/Jakarta') + interval '3 hours')::date)
 ORDER BY sj.created_at;
```

- [ ] **Step 2: Entri CLAUDE.md**

Isi minimal: masalahnya (separuh kiriman tak diverifikasi, opname yang menambal
sehingga berhenti jadi pemeriksa) · kelima keputusan owner K1–K5 · kenapa
tunggakan ditutup tanpa stok · ranjau UTC vs WIB pada `pg_cron` · alur dua tahap
dan kenapa auto-verifikasi berhenti di tahap 1 · nol app perlu redeploy · apa
yang harus dipantau (Q2 dan Q3 di atas).

- [ ] **Step 3: Commit**

```bash
git add "SS COGS SET/verifikasi-auto-sj-2026-09.sql" CLAUDE.md
git commit -m "docs: skrip pemantau auto-verifikasi + catatan sesi"
```

---

## Selesai

Setelah Task 5, hentikan.

**Yang tidak dikerjakan rencana ini, dan memang tidak boleh:**
- 209 SJ Agustus — dilewati (K5)
- Perubahan pada `finalize_surat_jalan_and_ledger`
- Perubahan tampilan aplikasi
- Penutupan sampai status `selesai` pada auto-verifikasi (tahap 2 milik Pusat)

**Yang tetap milik manusia:** role `kitchen` mengosongkan antrean validasi Pusat.
Sistem tidak bisa memaksanya, dan tanpa itu rancangan ini cuma memindahkan
antrean — bukan menutup kebocoran.
