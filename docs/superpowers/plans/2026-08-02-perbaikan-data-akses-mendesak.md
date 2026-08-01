# Perbaikan Data & Akses Mendesak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup empat masalah yang sedang aktif di produksi — `regional_manager` tidak bisa melihat data outlet apa pun, faktor `MINYAK SAYUR` salah, 19 resep menunjuk bahan non-aktif, dan RPC `process_waterfall_deduction` bisa dipanggil siapa pun dengan anon key.

**Architecture:** Empat migration SQL berdiri sendiri, tanpa perubahan kode aplikasi dan tanpa redeploy. Setiap task diverifikasi langsung ke DB live (`supabase db query --linked`), bukan lewat status `migration list`. Tidak ada satu pun task yang menulis `stok_balance` secara langsung.

**Tech Stack:** PostgreSQL (Supabase), Supabase CLI v2.105 (`npx supabase`), plpgsql.

Rencana ini turunan dari `docs/superpowers/specs/2026-08-01-satuan-kanonik-stok-design.md` §9 (isu terbuka) dan Lampiran A.2. Ia **tidak** mengerjakan satuan kanonik — itu rencana terpisah, dan Rencana 1 ini tidak memblokirnya maupun bergantung padanya.

## Global Constraints

- **Timestamp migration wajib lebih besar dari `20300104000001`.** Ada 10 migration bertimestamp tahun 2030 di repo ini; karena diurutkan berdasarkan nama, apa pun yang bertanggal wajar akan dijalankan LEBIH DULU dan ditimpa oleh mereka. Migration baru di rencana ini: `20300104000002` s/d `20300104000005`.
- **Sebelum menyentuh fungsi DB apa pun, jalankan:** `grep -rn "<nama_fungsi>" supabase/migrations/` — repo ini punya riwayat fungsi yang di-`CREATE OR REPLACE` ulang oleh file bertanggal lebih awal sehingga perbaikan hilang tanpa keluhan.
- **Verifikasi ground-truth, jangan percaya `supabase migration list`.** DB ini dipakai bersama dan developer lain aktif push; tabel riwayat migration terbukti berubah di tengah sesi. Verifikasi selalu dengan `npx supabase db query "<sql>" --linked`.
- **JANGAN jalankan `supabase migration repair` sepihak.** Kalau `db push` terhalang migration remote-only milik orang lain, laporkan dan berhenti — jangan tandai apa pun `reverted`.
- **JANGAN `UPDATE` / `INSERT` `stok_balance` langsung.** Semua perubahan saldo stok wajib lewat `ledger_stok`. Tidak ada task di rencana ini yang perlu menyentuh saldo.
- **`outlet_staff.id` = `auth.users.id`.** Tidak ada kolom `auth_user_id` — menyebutnya membuat `CREATE POLICY` gagal.
- **`supabase db push` DIGATE.** Subagent TIDAK BOLEH menjalankannya. Subagent hanya menulis berkas migration + menjalankan query verifikasi *sebelum* (read-only). Controller menjalankan keempat push sekaligus setelah user menyetujui, lalu menjalankan query verifikasi *sesudah*.
- **Cek `git branch --show-current` sebelum commit.** Otomasi auto-commit di repo ini pernah menyapu berkas ke commit orang lain dengan pesan yang tidak berhubungan.
- **Di luar cakupan, jangan disentuh:** peran `area_manager` (punya tabel `area_manager_outlets` sendiri + 4 commit aktif hari ini) dan peran `purchasing` (butuh keputusan bisnis apakah berhak lihat semua outlet).

---

### Task 1: `accessible_outlet_ids()` — daftarkan `regional_manager`

`spv` punya **0 pengguna**; penggantinya `regional_manager` (2 aktif) tidak ada di satu cabang pun dalam fungsi ini, sehingga fungsi mengembalikan himpunan kosong dan seluruh RLS berbasis fungsi ini menolak barisnya. `packages/auth/src/access.ts:9` sudah memberi `regional_manager` akses ke 7 app termasuk `stok` dan `distribusi`.

`spv` **tetap dipertahankan** dalam daftar: tidak ada penggunanya, jadi tidak berbahaya, dan mencabutnya di task yang sama mencampur dua perubahan yang risikonya beda.

**Files:**
- Create: `supabase/migrations/20300104000002_accessible_outlet_ids_regional_manager.sql`

**Interfaces:**
- Consumes: —
- Produces: `public.accessible_outlet_ids() RETURNS SETOF uuid` — kontrak tidak berubah; hanya himpunan hasilnya bertambah untuk `regional_manager`.

- [ ] **Step 1: Cek tidak ada definisi lain yang akan menimpa**

```bash
grep -rn "accessible_outlet_ids" supabase/migrations/
```

Baca hasilnya. Kalau ada file bertimestamp **lebih besar** dari `20300104000002` yang men-`CREATE OR REPLACE` fungsi ini, STOP dan laporkan — nomor migration harus digeser ke atasnya.

- [ ] **Step 2: Tulis query verifikasi dan pastikan GAGAL sekarang**

```bash
npx supabase db query "select count(*) as outlet_terlihat from outlets where id in (select o.id from outlets o, (select id, role, outlet_id from outlet_staff where role='regional_manager' limit 1) me where me.role in ('admin','admin_hr','owner','spv','kitchen','admin_finance','regional_manager'));" --linked
```

Ini menyimulasikan cabang pertama fungsi dengan daftar peran yang SUDAH diperbaiki. Catat angkanya (jumlah seluruh outlet, mis. 24).

Lalu jalankan versi yang meniru fungsi **saat ini**:

```bash
npx supabase db query "select count(*) as outlet_terlihat from outlets o, (select id, role from outlet_staff where role='regional_manager' limit 1) me where me.role in ('admin','admin_hr','owner','spv','kitchen','admin_finance');" --linked
```

Expected: **`0`** — inilah bug-nya.

- [ ] **Step 3: Tulis migration**

Buat `supabase/migrations/20300104000002_accessible_outlet_ids_regional_manager.sql`:

```sql
-- 20300104000002_accessible_outlet_ids_regional_manager.sql
-- Peran 'spv' sudah 0 pengguna; penggantinya 'regional_manager' (2 aktif) tidak
-- terdaftar di fungsi ini sehingga accessible_outlet_ids() mengembalikan KOSONG
-- untuk mereka -> seluruh RLS berbasis fungsi ini menolak barisnya, padahal
-- packages/auth/src/access.ts sudah memberi mereka akses 7 app.
--
-- 'spv' sengaja DIPERTAHANKAN (0 pengguna = tidak berbahaya); pencabutannya
-- perubahan terpisah.
--
-- DI LUAR CAKUPAN: 'area_manager' (punya area_manager_outlets sendiri) dan
-- 'purchasing' (butuh keputusan bisnis).
--
-- Salinan verbatim definisi live per 2026-08-02, HANYA menambah satu peran.
-- Sebelum mengubah fungsi ini: grep -rn "accessible_outlet_ids" supabase/migrations/

CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen', 'admin_finance')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role IN ('leader', 'korlap') AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$function$;
```

- [ ] **Step 4: Terapkan**

```bash
# DIGATE: jangan dijalankan subagent. Controller yang push, setelah persetujuan user.
# npx supabase db push
```

Kalau gagal karena migration remote-only milik developer lain: **STOP, laporkan, jangan `migration repair`.**

- [ ] **Step 5: Verifikasi ground-truth di DB live**

```bash
npx supabase db query "select prosecdef, proconfig, pg_get_functiondef(oid) like '%regional_manager%' as sudah_ada from pg_proc where proname='accessible_outlet_ids';" --linked
```

Expected: `prosecdef = true`, `proconfig = ["search_path=public"]`, `sudah_ada = true`.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add supabase/migrations/20300104000002_accessible_outlet_ids_regional_manager.sql
git commit -m "fix(rls): daftarkan regional_manager di accessible_outlet_ids

Peran spv sudah 0 pengguna, penggantinya regional_manager tidak terdaftar
sehingga fungsi mengembalikan himpunan kosong dan semua RLS menolak barisnya."
```

---

### Task 2: Koreksi faktor `MINYAK SAYUR` — 1 kompan = 16 liter

Keputusan owner 2026-08-02: **1 kompan = 16 liter**. Ketiga faktor di DB salah, dan tingkat tengahnya dinamai `Liter` padahal isinya jeriken 18 liter.

| Kolom | Sekarang | Jadi |
|---|---|---|
| `faktor_tengah` | 18 | 16 |
| `faktor_tampilan` | 324.000 | 16.000 |
| `faktor_konversi` | 18.000 | 1.000 |

**Dampak yang harus disadari:** trigger BOM memotong `qty_per_porsi / faktor_konversi`. Setelah ini pembaginya 1.000 alih-alih 18.000, jadi potongan minyak menjadi **18× lebih besar** — memang itu yang benar (selama ini nyaris tidak tercatat), tapi saldo minyak di beberapa outlet akan turun tajam dan bisa menembus minus. Itu **tidak akan menggagalkan penjualan**: tipe `pemakaian` dikecualikan dari guard no-negative di `ledger_stamp_saldo`. Saldo yang benar ditetapkan ulang oleh opname berikutnya.

**Files:**
- Create: `supabase/migrations/20300104000003_fix_minyak_sayur_faktor.sql`

**Interfaces:**
- Consumes: —
- Produces: baris `bahan_baku` `MINYAK SAYUR` dengan faktor konsisten (`faktor_tampilan = faktor_tengah × faktor_konversi`).

- [ ] **Step 1: Verifikasi kondisi sekarang (harus salah)**

```bash
npx supabase db query "select nama, trim_scale(faktor_tengah) f_tengah, trim_scale(faktor_tampilan) f_tampilan, trim_scale(faktor_konversi) f_konversi, (faktor_tampilan = faktor_tengah*faktor_konversi) as invarian_ok from bahan_baku where nama='MINYAK SAYUR';" --linked
```

Expected: `f_tengah=18`, `f_tampilan=324000`, `f_konversi=18000`, `invarian_ok=true` (invariannya kebetulan konsisten, tapi angkanya bukan 16 liter).

- [ ] **Step 2: Catat jumlah resep yang terpengaruh**

```bash
npx supabase db query "select count(*) as resep_terpengaruh from resep_item ri join bahan_baku b on b.id=ri.bahan_baku_id where b.nama='MINYAK SAYUR';" --linked
```

Expected: `19`. Catat angka ini untuk laporan.

- [ ] **Step 3: Tulis migration**

Buat `supabase/migrations/20300104000003_fix_minyak_sayur_faktor.sql`:

```sql
-- 20300104000003_fix_minyak_sayur_faktor.sql
-- Keputusan owner 2026-08-02: 1 kompan MINYAK SAYUR = 16 liter.
-- Membatalkan angka "16 liter" yang tercatat di SS COGS SET/unit-reconciliation.md
-- (4 Juli) tapi tidak pernah ditulis ke DB, dan angka 18 yang ada sekarang.
--
-- Ketiga faktor salah:
--   faktor_tengah    18      -> 16      (liter per kompan)
--   faktor_tampilan  324000  -> 16000   (ml per kompan)
--   faktor_konversi  18000   -> 1000    (ml per liter)
--
-- 324.000 berasal dari 18 x 18.000, yaitu menganggap 1 "Liter" = 18 liter.
-- Nama tingkat tengah 'Liter' menyesatkan (isinya jeriken) -- penggantian nama
-- adalah keputusan data terpisah, tidak dilakukan di sini.
--
-- DAMPAK: trigger BOM memotong qty/faktor_konversi, jadi potongan minyak menjadi
-- 18x lebih besar (sebelumnya nyaris tak tercatat di 19 resep). Saldo bisa minus;
-- itu tidak menggagalkan penjualan karena tipe 'pemakaian' dikecualikan dari guard
-- no-negative di ledger_stamp_saldo. Saldo benar ditetapkan ulang oleh opname.

UPDATE public.bahan_baku
SET faktor_tengah   = 16,
    faktor_tampilan = 16000,
    faktor_konversi = 1000
WHERE nama = 'MINYAK SAYUR';
```

- [ ] **Step 4: Terapkan**

```bash
# DIGATE: jangan dijalankan subagent. Controller yang push, setelah persetujuan user.
# npx supabase db push
```

- [ ] **Step 5: Verifikasi ground-truth**

```bash
npx supabase db query "select nama, trim_scale(faktor_tengah) f_tengah, trim_scale(faktor_tampilan) f_tampilan, trim_scale(faktor_konversi) f_konversi, (faktor_tampilan = faktor_tengah*faktor_konversi) as invarian_ok from bahan_baku where nama='MINYAK SAYUR';" --linked
```

Expected: `f_tengah=16`, `f_tampilan=16000`, `f_konversi=1000`, `invarian_ok=true`.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add supabase/migrations/20300104000003_fix_minyak_sayur_faktor.sql
git commit -m "fix(bahan-baku): MINYAK SAYUR 1 kompan = 16 liter

Tiga faktor salah (18/324000/18000 -> 16/16000/1000). Potongan BOM minyak
selama ini 18x lebih kecil dari seharusnya di 19 resep."
```

---

### Task 3: Pindahkan 19 resep dari `SAOS TOMAT` (non-aktif) ke `SAOS TOMAT POUCH`

```
SAOS TOMAT          is_active=false  faktor_konversi=16500  <- 19 resep menunjuk ke sini
SAOS TOMAT KOMPAN   is_active=true   faktor_konversi=5500   <- 0 resep
SAOS TOMAT POUCH    is_active=true   faktor_konversi=1000   <- 0 resep
```

Trigger `trg_process_bom_stok` **tidak memfilter `is_active`**, jadi potongan tetap jalan dari baris usang dengan pembagi 16.500.

**Target = `SAOS TOMAT POUCH`** (keputusan owner 2026-08-02). Didukung sebaran stok: POUCH ada di 8 outlet (GUDANG PUSAT 14, CIMANGGU 11, JAGAKARSA 24.000, JATIWARINGIN 6.000, EMPANG 5, SAWANGAN 4,1, PEKAYON 1.000, JATIASIH 1,0), sedangkan KOMPAN hanya di 2 (KALISARI 4,5 · PALEDANG 11.000).

**DAMPAK — lebih tajam daripada opsi KOMPAN:** pembagi berubah dari 16.500 → **1.000**, jadi potongan tomat menjadi **16,5× lebih besar** (kalau KOMPAN hanya 3×). Selama ini tomat nyaris tidak terpotong. Saldo tomat di beberapa outlet akan turun tajam dan bisa menembus minus; itu tidak menggagalkan penjualan karena tipe `pemakaian` dikecualikan dari guard no-negative di `ledger_stamp_saldo`, dan saldo benar ditetapkan ulang oleh opname berikutnya.

Trigger **tidak diubah** di task ini. Menambahkan filter `is_active` akan membuat potongan dilewati secara senyap — lebih buruk daripada potongan yang salah besaran. Pengawasannya lewat query di Step 6 yang dijadikan pemeriksaan berkala.

**Files:**
- Create: `supabase/migrations/20300104000004_repoint_resep_saos_tomat.sql`

**Interfaces:**
- Consumes: —
- Produces: `resep_item.bahan_baku_id` untuk 19 baris menunjuk ke `SAOS TOMAT KOMPAN`.

- [ ] **Step 1: Verifikasi kondisi sekarang**

```bash
npx supabase db query "select b.nama, b.is_active, trim_scale(b.faktor_konversi) fk, count(ri.id) n_resep from bahan_baku b left join resep_item ri on ri.bahan_baku_id=b.id where b.nama like 'SAOS TOMAT%' group by b.nama, b.is_active, b.faktor_konversi order by b.nama;" --linked
```

Expected: `SAOS TOMAT` → `is_active=false`, `fk=16500`, `n_resep=19`; dua lainnya `n_resep=0`.

- [ ] **Step 2: Simpan daftar resep yang akan dipindah (untuk rollback)**

```bash
npx supabase db query "select r.nama || ' | qty=' || trim_scale(ri.qty_per_porsi) as r from resep_item ri join resep r on r.id=ri.resep_id join bahan_baku b on b.id=ri.bahan_baku_id where b.nama='SAOS TOMAT' order by r.nama;" --linked
```

Simpan keluarannya ke catatan task. 19 baris.

- [ ] **Step 3: Tulis migration**

Buat `supabase/migrations/20300104000004_repoint_resep_saos_tomat.sql`:

```sql
-- 20300104000004_repoint_resep_saos_tomat.sql
-- SAOS TOMAT sudah is_active=false, tapi 19 resep aktif masih menunjuk ke sana.
-- trg_process_bom_stok TIDAK memfilter is_active, jadi potongan tetap jalan dari
-- baris usang dengan faktor_konversi 16500, padahal kemasan nyatanya kompan 5500
-- -> stok tomat terpotong 3x lebih sedikit dari seharusnya.
--
-- Acuan owner 2026-08-01: tomat hanya ada versi POUCH dan KOMPAN.
-- Target POUCH (keputusan owner 2026-08-02), didukung sebaran stok: POUCH ada di
-- 8 outlet, KOMPAN hanya 2.
--
-- DAMPAK: pembagi 16.500 -> 1.000, jadi potongan tomat 16,5x lebih besar.
-- Saldo bisa minus; tidak menggagalkan penjualan ('pemakaian' dikecualikan dari
-- guard no-negative) dan ditetapkan ulang oleh opname berikutnya.
--
-- Trigger sengaja TIDAK diubah: menambah filter is_active akan membuat potongan
-- dilewati secara senyap, lebih buruk daripada salah besaran.

DO $$
DECLARE
  v_lama UUID;
  v_baru UUID;
  v_n INT;
BEGIN
  SELECT id INTO v_lama FROM public.bahan_baku WHERE nama = 'SAOS TOMAT' LIMIT 1;
  SELECT id INTO v_baru FROM public.bahan_baku WHERE nama = 'SAOS TOMAT POUCH' AND is_active LIMIT 1;

  IF v_lama IS NULL THEN
    RAISE NOTICE 'SAOS TOMAT tidak ditemukan, tidak ada yang dipindah';
    RETURN;
  END IF;

  IF v_baru IS NULL THEN
    RAISE EXCEPTION 'SAOS TOMAT POUCH tidak ditemukan atau tidak aktif -- batalkan';
  END IF;

  UPDATE public.resep_item SET bahan_baku_id = v_baru WHERE bahan_baku_id = v_lama;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'resep_item dipindah: % baris', v_n;
END;
$$;
```

- [ ] **Step 4: Terapkan**

```bash
# DIGATE: jangan dijalankan subagent. Controller yang push, setelah persetujuan user.
# npx supabase db push
```

Expected: notice `resep_item dipindah: 19 baris`.

- [ ] **Step 5: Verifikasi ground-truth**

```bash
npx supabase db query "select b.nama, b.is_active, trim_scale(b.faktor_konversi) fk, count(ri.id) n_resep from bahan_baku b left join resep_item ri on ri.bahan_baku_id=b.id where b.nama like 'SAOS TOMAT%' group by b.nama, b.is_active, b.faktor_konversi order by b.nama;" --linked
```

Expected: `SAOS TOMAT` → `n_resep=0`; `SAOS TOMAT POUCH` → `n_resep=19`; `SAOS TOMAT KOMPAN` → `n_resep=0`.

- [ ] **Step 6: Pasang pemeriksaan berkala (jalankan, catat hasilnya, tidak perlu migration)**

```bash
npx supabase db query "select b.nama, count(*) n from resep_item ri join bahan_baku b on b.id=ri.bahan_baku_id where b.is_active = false group by b.nama;" --linked
```

Expected setelah task ini: **0 baris**. Query ini mendeteksi resep yang menunjuk bahan non-aktif — masukkan ke catatan operasional untuk dijalankan tiap kali ada bahan dinonaktifkan.

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add supabase/migrations/20300104000004_repoint_resep_saos_tomat.sql
git commit -m "fix(resep): pindahkan 19 resep SAOS TOMAT ke SAOS TOMAT POUCH

Bahan lama sudah is_active=false tapi trigger BOM tidak memfilter is_active,
sehingga tomat terpotong dengan pembagi 16500. Target POUCH (keputusan owner
2026-08-02, POUCH tersedia di 8 outlet vs KOMPAN 2) -> pembagi 1000, potongan
menjadi 16,5x lebih besar."
```

---

### Task 4: Tutup lubang otorisasi `process_waterfall_deduction` + RLS `bahan_baku_substitusi`

Terverifikasi di DB live 2026-08-01:

```
process_waterfall_deduction   prosecdef=true   proconfig=NULL
  acl: =X/postgres, anon=X, authenticated=X, service_role=X
bahan_baku_substitusi         relrowsecurity=false   0 policy
  acl: anon=arwdDxtm, authenticated=arwdDxtm
```

`SECURITY DEFINER` tanpa `SET search_path`, dan `EXECUTE` terbuka untuk `PUBLIC`/`anon` → siapa pun pemegang anon key (ada di bundle browser semua app) bisa `POST /rest/v1/rpc/process_waterfall_deduction` dan menulis baris `pemakaian` untuk outlet mana pun dengan qty bebas. Tipe `pemakaian` justru **dikecualikan** dari guard no-negative, jadi saldo bisa ditarik minus sedalam apa pun. Tabelnya sendiri bisa di-`DELETE` oleh anon.

Fungsi ini akan dipensiunkan oleh rencana satuan kanonik, tapi **selama masih ada di DB lubangnya aktif** — karena itu ditutup di sini, tidak menunggu.

Mencabut `EXECUTE` **tidak** mematahkan trigger: `trg_process_bom_stok` adalah `SECURITY DEFINER`, jadi `PERFORM` di dalamnya berjalan sebagai pemilik fungsi (`postgres`) yang tetap punya `EXECUTE`.

**Files:**
- Create: `supabase/migrations/20300104000005_lock_down_waterfall_deduction.sql`

**Interfaces:**
- Consumes: —
- Produces: tanda tangan fungsi tidak berubah; hanya `search_path` dan hak akses.

- [ ] **Step 1: Verifikasi lubangnya masih terbuka**

```bash
npx supabase db query "select proname, prosecdef, proconfig, array_to_string(proacl,',') acl from pg_proc where proname='process_waterfall_deduction';" --linked
```

Expected: `proconfig` **null**, `acl` memuat `anon=X` dan `authenticated=X`.

```bash
npx supabase db query "select relname, relrowsecurity, array_to_string(relacl,',') acl from pg_class where relname='bahan_baku_substitusi';" --linked
```

Expected: `relrowsecurity=false`, `acl` memuat `anon=arwdDxtm`.

- [ ] **Step 2: Tulis migration**

Buat `supabase/migrations/20300104000005_lock_down_waterfall_deduction.sql`:

```sql
-- 20300104000005_lock_down_waterfall_deduction.sql
-- process_waterfall_deduction (dibuat di 20300103000010) adalah SECURITY DEFINER
-- TANPA SET search_path, dengan EXECUTE terbuka untuk PUBLIC/anon/authenticated.
-- Anon key ada di bundle browser semua app -> siapa pun bisa memanggil
-- /rest/v1/rpc/process_waterfall_deduction dan menulis baris 'pemakaian' untuk
-- outlet mana pun dengan qty bebas. Tipe 'pemakaian' dikecualikan dari guard
-- no-negative di ledger_stamp_saldo, jadi saldo bisa ditarik minus sedalam apa pun.
--
-- Tabel bahan_baku_substitusi juga tanpa RLS dengan anon=arwdDxtm -> mapping
-- pemotongan stok bisa diubah/dihapus anon.
--
-- Fungsi ini akan dipensiunkan oleh rencana satuan kanonik, tapi selama masih ada
-- di DB lubangnya aktif -> ditutup sekarang.
--
-- Mencabut EXECUTE tidak mematahkan trigger: trg_process_bom_stok SECURITY DEFINER,
-- jadi PERFORM di dalamnya berjalan sebagai pemilik yang tetap punya EXECUTE.

-- 1. search_path tetap, tanpa perlu mendefinisikan ulang badan fungsi
ALTER FUNCTION public.process_waterfall_deduction(uuid, uuid, numeric, text, uuid)
  SET search_path = public;

-- 2. Cabut EXECUTE dari pemanggil publik
REVOKE ALL ON FUNCTION public.process_waterfall_deduction(uuid, uuid, numeric, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- 3. RLS untuk tabel mapping
ALTER TABLE public.bahan_baku_substitusi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbs_read_authenticated ON public.bahan_baku_substitusi;
CREATE POLICY bbs_read_authenticated ON public.bahan_baku_substitusi
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS bbs_write_admin ON public.bahan_baku_substitusi;
CREATE POLICY bbs_write_admin ON public.bahan_baku_substitusi
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner', 'kitchen')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'owner', 'kitchen')
  ));

-- 4. Cabut hak tulis langsung dari anon (RLS sudah menggerbangi, ini lapis kedua)
REVOKE INSERT, UPDATE, DELETE ON public.bahan_baku_substitusi FROM anon;
```

- [ ] **Step 3: Terapkan**

```bash
# DIGATE: jangan dijalankan subagent. Controller yang push, setelah persetujuan user.
# npx supabase db push
```

- [ ] **Step 4: Verifikasi ground-truth**

```bash
npx supabase db query "select proname, proconfig, array_to_string(proacl,',') acl from pg_proc where proname='process_waterfall_deduction';" --linked
```

Expected: `proconfig = ["search_path=public"]`, `acl` **tidak lagi memuat** `anon=X` maupun `authenticated=X`.

```bash
npx supabase db query "select relname, relrowsecurity, (select count(*) from pg_policies p where p.tablename='bahan_baku_substitusi') policies from pg_class where relname='bahan_baku_substitusi';" --linked
```

Expected: `relrowsecurity=true`, `policies=2`.

- [ ] **Step 5: Pastikan penjualan masih jalan (trigger tetap bisa memanggil fungsi)**

```bash
npx supabase db query "select count(*) as pemakaian_24jam from ledger_stok where tipe='pemakaian' and created_at > now() - interval '24 hours';" --linked
```

Catat angkanya. Ulangi query yang sama **setelah outlet buka (>13.00)** dan pastikan angkanya bertambah. Kalau tidak bertambah sama sekali padahal ada order masuk, `REVOKE` mengenai jalur yang tidak diduga — **balikkan dengan** `GRANT EXECUTE ON FUNCTION public.process_waterfall_deduction(uuid, uuid, numeric, text, uuid) TO authenticated;` dan laporkan.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add supabase/migrations/20300104000005_lock_down_waterfall_deduction.sql
git commit -m "fix(security): tutup RPC process_waterfall_deduction dari anon

SECURITY DEFINER tanpa search_path + EXECUTE untuk PUBLIC/anon -> siapa pun
pemegang anon key bisa menulis ledger 'pemakaian' untuk outlet mana pun.
Tambah RLS untuk bahan_baku_substitusi (sebelumnya anon=arwd)."
```

---

## Verifikasi akhir

- [ ] **Semua empat perubahan terbukti ada di DB live** (bukan sekadar tercatat di `migration list`):

```bash
npx supabase db query "select 'accessible_outlet_ids punya regional_manager' as cek, (pg_get_functiondef(oid) like '%regional_manager%')::text hasil from pg_proc where proname='accessible_outlet_ids' union all select 'MINYAK SAYUR 16000 ml/kompan', (faktor_tampilan=16000)::text from bahan_baku where nama='MINYAK SAYUR' union all select 'resep menunjuk bahan non-aktif = 0', (count(*)=0)::text from resep_item ri join bahan_baku b on b.id=ri.bahan_baku_id where b.is_active=false union all select 'waterfall punya search_path', (proconfig is not null)::text from pg_proc where proname='process_waterfall_deduction' union all select 'bahan_baku_substitusi RLS aktif', relrowsecurity::text from pg_class where relname='bahan_baku_substitusi';" --linked
```

Expected: kelima baris `hasil = true`.

- [ ] **Smoke test manual dengan akun `regional_manager` nyata** — login, buka `stok.sukashawarma.com` monitoring, pastikan outlet muncul (sebelumnya kosong). Tidak perlu redeploy: perubahannya murni DB.

- [ ] **Laporkan angka sebelum/sesudah** untuk pemakaian minyak: bandingkan `sum(qty)` tipe `pemakaian` untuk `MINYAK SAYUR` pada hari sebelum vs hari sesudah — harus naik sekitar 18×.

```bash
npx supabase db query "select (created_at at time zone 'Asia/Jakarta')::date tgl, trim_scale(sum(abs(qty))) total_potong from ledger_stok l join bahan_baku b on b.id=l.bahan_baku_id where b.nama='MINYAK SAYUR' and l.tipe='pemakaian' and l.created_at > now() - interval '4 days' group by 1 order by 1;" --linked
```

---

## Di luar cakupan rencana ini

| Hal | Alasan |
|---|---|
| Peran `purchasing` di `accessible_outlet_ids()` | Butuh keputusan bisnis: apakah pengadaan berhak melihat semua outlet |
| Peran `area_manager` | Punya mekanisme sendiri (`area_manager_outlets`, migration `20260730000000`) dan ada 4 commit aktif hari ini — workstream orang lain |
| Mencabut `'spv'` dari daftar peran | 0 pengguna, tidak berbahaya; mencampurnya menambah risiko tanpa manfaat |
| 12 bahan berfaktor `×1` (Lampiran A.3) | 0 resep, belum melukai; butuh angka dari owner |
| `ES BATU` qty 16 gram atau pcs | Butuh konfirmasi owner; dampak 2 resep |
| Duplikat bahan (`KERTAS STRUK`/`THERMAL STRUK`, dll) | Butuh keputusan pensiunkan atau tetap |
| Mengganti nama `satuan_tengah` yang menyesatkan (`"Kg"`, `"Liter"` = jeriken) | Kosmetik data, tidak mengubah hitungan |
| Satuan kanonik, rincian kemasan, pensiun waterfall | Rencana terpisah |
