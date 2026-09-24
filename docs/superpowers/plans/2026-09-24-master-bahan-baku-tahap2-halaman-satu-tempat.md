# Master Bahan Baku — Tahap 2: Halaman Satu Tempat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu halaman `/dashboard/bahan-baku` di admin-dashboard (tab Data Bahan · Harga · Vendor · Riwayat) yang menulis master hanya lewat RPC Tahap 1, lalu menutup semua jalur tulis lain (stok, finance, tulis tabel langsung).

**Architecture:** Halaman klien bertab (`?tab=`) dengan komponen kecil per bagian di `src/components/master-bahan/`. Semua tulis lewat satu hook RPC (`useMutasiMasterBahan`). Logika murni (hak akses, galat RPC, pilihan satuan beli, ringkasan riwayat, penyaring data supplier) ada di `src/lib/masterBahan/` dengan uji vitest. Layar lama (modal detail 1.097 baris `@ts-nocheck`, modal tambah, mutasi tabel langsung, server action service-key) dihapus. Pencabutan hak tulis langsung (K10.2) ditulis sebagai migration yang **baru di-apply setelah** admin-dashboard, stok, dan finance ter-deploy.

**Tech Stack:** Next.js app router (client components), TypeScript, Tailwind (palet `suka-*`), TanStack React Query, Supabase JS (`supabase.rpc`), sonner, lucide-react, vitest. PostgreSQL untuk 2 migration.

**Spec:** `docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md` (K1, K2, K3, K5, K6, K7, K8, K10). Plan Tahap 1 (objek DB yang dipakai): `docs/superpowers/plans/2026-09-23-master-bahan-baku-tahap1-fondasi-db.md`.

## Global Constraints

- Hak akses (K1), WAJIB sama dengan `_peran_master()` di DB: lingkup **data** = role layar `ADMIN`, `OWNER`; lingkup **harga** (harga & vendor) = `ADMIN`, `OWNER`, `PURCHASING`. Role layar berasal dari `useRole()` (`src/components/layout/RoleContext.tsx`), selalu HURUF BESAR. Layar hanya menyembunyikan tombol; penjaga sesungguhnya di RPC.
- Semua tulis master lewat RPC berikut (sudah ada di DB, EXECUTE untuk `authenticated`):
  - `simpan_bahan_baku(p_id uuid, p_data jsonb, p_alasan text)` → uuid. Kunci `p_data` yang diizinkan: `nama, merek, kategori, peruntukan, is_opname, default_reorder_point, satuan, satuan_tengah, faktor_tengah, satuan_kecil, isi_kecil_per_tengah, satuan_po, satuan_distribusi, image_url, image_url_tengah, image_url_kecil, image_urls`. Kunci satuan (`satuan, satuan_tengah, faktor_tengah, satuan_kecil, isi_kecil_per_tengah`) dikirim sebagai SATU SET: bila salah satu dikirim, `satuan` dan `isi_kecil_per_tengah` wajib ada. `isi_kecil_per_tengah` = isi satuan kecil per satuan TENGAH (atau per BESAR bila tanpa tengah).
  - `nonaktifkan_bahan_baku(p_id, p_alasan)`, `aktifkan_bahan_baku(p_id, p_alasan)`, `hapus_bahan_baku(p_id, p_alasan)` — alasan wajib.
  - `simpan_sku(p_id, p_bahan_baku_id, p_data)` (kunci: `nama_kemasan, qty_isi, harga_beli, tingkatan_satuan, image_url, satuan_tengah, faktor_tengah, is_active`), `set_default_sku(p_id)`, `hapus_sku(p_id)`.
  - `simpan_harga_vendor(p_bahan, p_supplier, p_harga, p_satuan_beli, p_isi_satuan_kecil, p_alasan, p_paksa)` → uuid; alasan wajib; `p_paksa` melewati penjaga "dugaan salah satuan" dan "satuan beli tidak dikenali" (bukan penjaga isi berbeda).
  - `nonaktifkan_harga_vendor(p_id, p_alasan)`, `simpan_supplier(p_id, p_data, p_alasan)`, `nonaktifkan_supplier(p_id, p_alasan)`.
- Galat RPC dilempar apa adanya (objek `PostgrestError` dengan `code`) — jangan dibungkus `new Error(e.message)`, supaya kode `42501`/`22023`/`23505` terbaca.
- Harga master **tidak bisa diketik** di layar mana pun (K5). Harga hanya diketik per vendor; master diturunkan DB.
- Batas minimum yang diedit = `bahan_baku.default_reorder_point` (dibaca monitoring). UI `stok_ideal` / `threshold_*` dibuang (K8).
- Klien Supabase: `createClient()` dari `@/lib/supabase` di dalam `useMemo`. Toast: `sonner`. Spinner: `@suka/design-system`.
- Bucket foto: `bahan-baku`, path `${id}_${level}_${Date.now()}.${ext}` (sama dengan kode lama).
- Timestamp migration: `20260924HHMMSS`. Sebelum apply, cek tabrakan:
  - `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260924%';`
  - `ls supabase/migrations | cut -c1-14 | sort | uniq -d`
- Cara apply migration: MCP `mcp__supabase__execute_sql` dengan isi berkas → verifikasi katalog → stempel `INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES (...) ON CONFLICT DO NOTHING;` → SELECT ulang stempel.
- Perintah uji & build (jalankan dari root worktree; `npx` rusak di repo ini):
  - `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run <berkas>`
  - `cd apps/<app> && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
  - `cd apps/<app> && ../../node_modules/.bin/next build --webpack`
  - Kalau worktree tak punya `node_modules`, pakai binari repo utama: `"D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/.bin/<tool>"` (Node menemukan paket repo utama karena worktree ada di dalamnya).
- Galat type-check yang SUDAH ADA sebelum plan ini tidak dihitung; bandingkan dengan baseline yang dicatat di Task 2 Step 1 (admin-dashboard) dan Task 8 Step 1 (stok, finance).

---

## File Structure

**admin-dashboard — baru**
| Berkas | Tanggung jawab |
|---|---|
| `src/lib/masterBahan/akses.ts` (+test) | `bolehUbahData`, `bolehUbahHarga` |
| `src/lib/masterBahan/galatRpc.ts` (+test) | Terjemahkan galat RPC → pesan + `bisaDipaksa` |
| `src/lib/masterBahan/satuanBeli.ts` (+test) | Pilihan satuan beli + isi, pratinjau harga per besar |
| `src/lib/masterBahan/riwayat.ts` (+test) | Ringkas baris `riwayat_master_bahan` jadi kalimat |
| `src/lib/masterBahan/supplier.ts` (+test) | Saring payload supplier ke kunci yang diizinkan RPC |
| `src/hooks/masterBahan/useDaftarBahan.ts` | Query daftar bahan (aktif & nonaktif) |
| `src/hooks/masterBahan/useMutasiMasterBahan.ts` | Semua mutasi RPC + unggah foto |
| `src/hooks/masterBahan/useStatusHarga.ts` | `bahan_baku_status_harga` + `bahan_baku_harga_asal` |
| `src/hooks/masterBahan/useRiwayatMasterBahan.ts` | `riwayat_master_bahan` + nama pelaku |
| `src/hooks/masterBahan/useJumlahBatasOutlet.ts` | Jumlah outlet ber-batas khusus per bahan |
| `src/components/master-bahan/MasterBahanPage.tsx` | Kerangka tab (`?tab=`) |
| `src/components/master-bahan/DialogAlasan.tsx` | Dialog alasan (+opsi paksa) dipakai bersama |
| `src/components/master-bahan/IsianSatuanFields.tsx` | Isian satuan bertingkat dipakai bersama |
| `src/components/master-bahan/FormHargaVendor.tsx` | Form harga per vendor dipakai bersama |
| `src/components/master-bahan/TabDataBahan.tsx` | Daftar bahan + tombol tambah + panel |
| `src/components/master-bahan/FormBahanBaru.tsx` | Modal tambah bahan (+harga awal opsional) |
| `src/components/master-bahan/PanelBahan.tsx` | Panel detail: status, harga ringkas, seksi |
| `src/components/master-bahan/SeksiIdentitas.tsx` | Nama/merek/kategori/peruntukan/opname/batas |
| `src/components/master-bahan/SeksiSatuan.tsx` | Satuan bertingkat + label PO/distribusi |
| `src/components/master-bahan/SeksiFotoSku.tsx` | Foto per tingkat + SKU |
| `src/components/master-bahan/TabHarga.tsx` | Status harga + daftar kerja belum dikonfirmasi |
| `src/components/master-bahan/TabVendor.tsx` | Katalog vendor + tambah harga vendor + tautan supplier |
| `src/components/master-bahan/TabRiwayat.tsx` | Umpan riwayat perubahan |

**admin-dashboard — diubah / dihapus**
- Ubah: `src/app/dashboard/bahan-baku/page.tsx`, `src/lib/bahanBaku.ts`, `src/hooks/usePurchaseOrder.ts` (3 hook supplier), `src/hooks/useKatalogVendor.ts` (hapus `useKatalogVendorMutations`), `src/components/katalog-vendor/KatalogVendorBoard.tsx`, `src/app/dashboard/pembelian/katalog-vendor/page.tsx` (redirect), `src/components/layout/navConfig.ts` (+test), `src/components/layout/RoleContext.tsx`.
- Hapus: `src/components/BahanBakuTable.tsx`, `src/components/BahanBakuDetailModal.tsx`, `src/components/BahanBakuAddModal.tsx`, `src/hooks/useBahanBakuHarga.ts`, `src/hooks/useBahanBakuHargaMutations.ts`, `src/app/actions/bahanBakuActions.ts`, `src/hooks/useOutletThresholds.ts`, `src/app/dashboard/kitchen/threshold/` (seluruh folder).

**stok** — ubah `src/components/harga-bahan/HargaBahanBoard.tsx`, `src/hooks/useFluktuasiHarga.ts`, `src/app/actions/hargaBahan.ts`; hapus `src/components/harga-bahan/HargaBahanAddModal.tsx`, `SyncMasterModal.tsx`, `BatchActionBar.tsx`, `src/hooks/useBahanBakuMutations.ts`, `src/app/actions/bahanBakuActions.ts`, `src/lib/stok/satuanBahan.ts` + `.test.ts`.

**finance** — ubah `src/components/CashLayout.tsx`, `src/hooks/usePurchaseOrder.ts`; ganti `src/app/pembelian/supplier/page.tsx` dengan pemberitahuan.

**DB** — `supabase/migrations/20260924100000_simpan_supplier_bahan_baku_ids.sql` (Task 1, di-apply saat eksekusi), `supabase/migrations/20260924200000_cabut_tulis_langsung_master_bahan.sql` (Task 9, **di-apply setelah deploy**), uji `supabase/verifikasi/master_bahan/t9_*.sql`, `t10_*.sql`.

---

### Task 1: DB — `simpan_supplier` menerima `bahan_baku_ids` + view asal harga

**Files:**
- Create: `supabase/migrations/20260924100000_simpan_supplier_bahan_baku_ids.sql`
- Create: `supabase/verifikasi/master_bahan/t9_supplier_bahan_asal_harga.sql`

**Interfaces:**
- Produces: `simpan_supplier` menerima kunci tambahan `bahan_baku_ids` (array uuid; tiap id harus ada di `bahan_baku`). View `public.bahan_baku_harga_asal(bahan_baku_id, changed_at, changed_by, catatan, ref_po_id, harga_lama, harga_baru)` — satu baris per bahan: baris `bahan_baku_harga_history` terbaru. Dipakai `useStatusHarga` (Task 3).

Konteks: halaman Master Supplier mengirim `bahan_baku_ids` (daftar bahan yang biasa dipasok; dipakai `pembelian/new/page.tsx` L37 untuk mengisi item PO otomatis). RPC Tahap 1 belum menerima kunci itu, jadi tanpa task ini simpan supplier lewat RPC akan ditolak `22023`.

- [ ] **Step 1: Tulis uji**

```sql
-- supabase/verifikasi/master_bahan/t9_supplier_bahan_asal_harga.sql — harapan: tanpa error
BEGIN;
DO $$
DECLARE v_purch uuid; v_sup uuid; v_b1 uuid; v_b2 uuid; v_ok boolean; v_n int;
BEGIN
  SELECT id INTO v_purch FROM outlet_staff WHERE role='purchasing' AND status='active' LIMIT 1;
  SELECT id INTO v_b1 FROM bahan_baku WHERE nama='SAPI';
  SELECT id INTO v_b2 FROM bahan_baku WHERE nama='AYAM';
  IF v_purch IS NULL OR v_b1 IS NULL OR v_b2 IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_purch, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- (a) bahan_baku_ids tersimpan saat membuat
  v_sup := public.simpan_supplier(NULL, jsonb_build_object('nama','UJI T9 VENDOR','bahan_baku_ids', jsonb_build_array(v_b1, v_b2)), 'uji t9');
  IF (SELECT bahan_baku_ids FROM supplier WHERE id = v_sup) IS DISTINCT FROM ARRAY[v_b1, v_b2] THEN
    RAISE EXCEPTION 'GAGAL (a): bahan_baku_ids tak tersimpan';
  END IF;

  -- (b) update mengganti daftar; kunci lain tak tersentuh
  PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', jsonb_build_array(v_b2)), 'uji t9 ubah');
  IF (SELECT bahan_baku_ids FROM supplier WHERE id = v_sup) IS DISTINCT FROM ARRAY[v_b2]
     OR (SELECT nama FROM supplier WHERE id = v_sup) <> 'UJI T9 VENDOR' THEN
    RAISE EXCEPTION 'GAGAL (b): update bahan_baku_ids salah';
  END IF;

  -- (c) id yang tidak ada ditolak 22023
  v_ok := false;
  BEGIN
    PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', jsonb_build_array(gen_random_uuid())), 'uji');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (c): id bahan liar diterima'; END IF;

  -- (d) bukan array ditolak 22023
  v_ok := false;
  BEGIN
    PERFORM public.simpan_supplier(v_sup, jsonb_build_object('bahan_baku_ids', 'x'), 'uji');
  EXCEPTION WHEN invalid_parameter_value THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL (d): bahan_baku_ids bukan array diterima'; END IF;

  -- (e) view asal harga: satu baris per bahan, sama dengan riwayat terbaru
  SELECT count(*) - count(DISTINCT bahan_baku_id) INTO v_n FROM bahan_baku_harga_asal;
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (e): view asal harga punya baris kembar'; END IF;
  IF EXISTS (SELECT 1 FROM bahan_baku_harga_asal a
              WHERE a.changed_at <> (SELECT max(h.changed_at) FROM bahan_baku_harga_history h WHERE h.bahan_baku_id = a.bahan_baku_id)) THEN
    RAISE EXCEPTION 'GAGAL (e): view asal harga bukan riwayat terbaru';
  END IF;
  RAISE NOTICE 'HASIL T9: LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji, pastikan GAGAL**

Harapan: `Kolom "bahan_baku_ids" tidak boleh diubah lewat simpan_supplier` (22023) di (a).

- [ ] **Step 3: Ambil badan live `simpan_supplier`**

`SELECT pg_get_functiondef('public.simpan_supplier(uuid,jsonb,text)'::regprocedure);` — pastikan sama dengan badan di Step 4 selain bagian bertanda `-- BARU`. Kalau ada perbedaan lain (mis. kolom tambahan, urutan cek berbeda), pertahankan badan live dan sisipkan HANYA bagian `-- BARU`; kalau perbedaannya tak jelas maksudnya, BERHENTI dan lapor NEEDS_CONTEXT.

- [ ] **Step 4: Tulis migration**

```sql
-- supabase/migrations/20260924100000_simpan_supplier_bahan_baku_ids.sql
-- Tahap 2 master bahan baku (spec 2026-09-23 K2/K3):
-- 1. simpan_supplier menerima bahan_baku_ids — halaman Master Supplier menyimpannya dan
--    form PO (pembelian/new) memakainya untuk mengisi item otomatis. Tiap id wajib ada.
-- 2. View bahan_baku_harga_asal: riwayat harga master terbaru per bahan, untuk kolom
--    "asal harga" di tab Harga. security_invoker supaya RLS bbhh_select berlaku.

CREATE OR REPLACE FUNCTION public.simpan_supplier(p_id uuid, p_data jsonb, p_alasan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_boleh constant text[] := ARRAY['nama','kontak','alamat','kategori','catatan','termin_hari','vendor_induk_id',
                                   'bahan_baku_ids'];                                  -- BARU
  v_uid   uuid := public._peran_master('harga');
  v_kunci text;
  v_nama  text;
  v_id    uuid;
  v_ids   uuid[];                                                                     -- BARU
BEGIN
  FOR v_kunci IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT v_kunci = ANY (c_boleh) THEN
      RAISE EXCEPTION 'Kolom "%" tidak boleh diubah lewat simpan_supplier', v_kunci USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- BARU: validasi bahan_baku_ids
  IF p_data ? 'bahan_baku_ids' THEN
    IF jsonb_typeof(p_data -> 'bahan_baku_ids') <> 'array' THEN
      RAISE EXCEPTION 'bahan_baku_ids harus berupa daftar' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_ids := ARRAY(SELECT (x)::uuid FROM jsonb_array_elements_text(p_data -> 'bahan_baku_ids') x);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'bahan_baku_ids berisi id yang tidak sah' USING ERRCODE = '22023';
    END;
    IF EXISTS (SELECT 1 FROM unnest(v_ids) i WHERE NOT EXISTS (SELECT 1 FROM public.bahan_baku b WHERE b.id = i)) THEN
      RAISE EXCEPTION 'bahan_baku_ids memuat bahan yang tidak ada' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_nama := btrim(COALESCE(p_data ->> 'nama', (SELECT nama FROM public.supplier WHERE id = p_id)));
  IF COALESCE(v_nama, '') = '' THEN RAISE EXCEPTION 'Nama supplier wajib diisi' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.supplier WHERE is_active AND lower(btrim(nama)) = lower(v_nama)
                AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Sudah ada supplier aktif bernama "%"', v_nama USING ERRCODE = '23505';
  END IF;
  PERFORM set_config('app.alasan', COALESCE(p_alasan, ''), true);

  IF p_id IS NULL THEN
    INSERT INTO public.supplier (nama, kontak, alamat, kategori, catatan, termin_hari, vendor_induk_id, created_by, is_active,
                                 bahan_baku_ids)                                       -- BARU
    VALUES (v_nama, p_data ->> 'kontak', p_data ->> 'alamat', p_data ->> 'kategori', p_data ->> 'catatan',
            (p_data ->> 'termin_hari')::int, (p_data ->> 'vendor_induk_id')::uuid, v_uid, true,
            COALESCE(v_ids, '{}'::uuid[]))                                             -- BARU
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE public.supplier SET
    nama            = v_nama,
    kontak          = CASE WHEN p_data ? 'kontak' THEN p_data ->> 'kontak' ELSE kontak END,
    alamat          = CASE WHEN p_data ? 'alamat' THEN p_data ->> 'alamat' ELSE alamat END,
    kategori        = CASE WHEN p_data ? 'kategori' THEN p_data ->> 'kategori' ELSE kategori END,
    catatan         = CASE WHEN p_data ? 'catatan' THEN p_data ->> 'catatan' ELSE catatan END,
    termin_hari     = CASE WHEN p_data ? 'termin_hari' THEN (p_data ->> 'termin_hari')::int ELSE termin_hari END,
    vendor_induk_id = CASE WHEN p_data ? 'vendor_induk_id' THEN (p_data ->> 'vendor_induk_id')::uuid ELSE vendor_induk_id END,
    bahan_baku_ids  = CASE WHEN p_data ? 'bahan_baku_ids' THEN v_ids ELSE bahan_baku_ids END   -- BARU
  WHERE id = p_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Supplier % tidak ditemukan', p_id USING ERRCODE = 'P0002'; END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW public.bahan_baku_harga_asal WITH (security_invoker = true) AS
SELECT DISTINCT ON (h.bahan_baku_id)
       h.bahan_baku_id, h.changed_at, h.changed_by, h.catatan, h.ref_po_id, h.harga_lama, h.harga_baru
  FROM public.bahan_baku_harga_history h
 ORDER BY h.bahan_baku_id, h.changed_at DESC, h.id DESC;

REVOKE ALL ON public.bahan_baku_harga_asal FROM anon, authenticated;
GRANT SELECT ON public.bahan_baku_harga_asal TO authenticated;
```

Catatan: bila kolom `supplier.bahan_baku_ids` ternyata bertipe selain `uuid[]` (cek `SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid='public.supplier'::regclass AND attname='bahan_baku_ids'`), sesuaikan cast di migration dan uji; laporkan di DONE_WITH_CONCERNS.

- [ ] **Step 5: Apply, verifikasi, stempel**

```sql
SELECT position('bahan_baku_ids' in prosrc) > 0, prosecdef FROM pg_proc WHERE proname = 'simpan_supplier';   -- true, true
SELECT has_function_privilege('anon','public.simpan_supplier(uuid,jsonb,text)','EXECUTE');                    -- false
SELECT reloptions FROM pg_class WHERE relname = 'bahan_baku_harga_asal';                                     -- {security_invoker=true}
```
Stempel `('20260924100000','simpan_supplier_bahan_baku_ids')` lalu SELECT ulang stempelnya.

- [ ] **Step 6: Jalankan t9 (LULUS), lalu ulang uji Tahap 1 `t6` & `t8` di `supabase/verifikasi/master_bahan/` (tetap LULUS)**

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260924100000_simpan_supplier_bahan_baku_ids.sql supabase/verifikasi/master_bahan/t9_supplier_bahan_asal_harga.sql
git commit -m "feat(db): simpan_supplier terima bahan_baku_ids + view asal harga master"
```

---

### Task 2: Logika murni master bahan (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/masterBahan/akses.ts`, `akses.test.ts`
- Create: `apps/admin-dashboard/src/lib/masterBahan/galatRpc.ts`, `galatRpc.test.ts`
- Create: `apps/admin-dashboard/src/lib/masterBahan/satuanBeli.ts`, `satuanBeli.test.ts`
- Create: `apps/admin-dashboard/src/lib/masterBahan/riwayat.ts`, `riwayat.test.ts`
- Create: `apps/admin-dashboard/src/lib/masterBahan/supplier.ts`, `supplier.test.ts`

**Interfaces:**
- Produces (dipakai Task 3–6):
  - `bolehUbahData(role: string | null | undefined): boolean`, `bolehUbahHarga(role: string | null | undefined): boolean`
  - `type GalatRpc = { pesan: string; kode: string | null; bisaDipaksa: boolean }`, `bacaGalatRpc(e: unknown): GalatRpc`
  - `type TingkatSatuan = { satuan: string; satuan_tengah: string | null; faktor_tengah: number | null; satuan_kecil: string | null; faktor_tampilan: number | null }`, `type PilihanSatuanBeli = { label: string; isi: number }`, `pilihanSatuanBeli(b: TingkatSatuan): PilihanSatuanBeli[]`, `hargaPerSatuanBesar(harga: number, isi: number, faktorTampilan: number | null): number | null`
  - `type BarisRiwayat` (lihat kode), `ringkasRiwayat(r: BarisRiwayat): string[]`
  - `KUNCI_DATA_SUPPLIER`, `saringDataSupplier(p: Record<string, unknown>): Record<string, unknown>`

- [ ] **Step 1: Catat baseline type-check admin-dashboard**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"`
Catat angkanya di laporan task (baseline; task berikutnya tidak boleh menambah).

- [ ] **Step 2: Tulis uji kelima modul**

```ts
// apps/admin-dashboard/src/lib/masterBahan/akses.test.ts
import { describe, it, expect } from 'vitest'
import { bolehUbahData, bolehUbahHarga } from './akses'

describe('akses master bahan (cermin _peran_master)', () => {
  it('data: hanya ADMIN & OWNER', () => {
    expect(bolehUbahData('ADMIN')).toBe(true)
    expect(bolehUbahData('OWNER')).toBe(true)
    for (const r of ['PURCHASING', 'ADMIN_HR', 'MITRA', 'LEADER', 'AREA_MANAGER', '', null, undefined]) {
      expect(bolehUbahData(r)).toBe(false)
    }
  })
  it('harga: ADMIN, OWNER, PURCHASING', () => {
    expect(bolehUbahHarga('ADMIN')).toBe(true)
    expect(bolehUbahHarga('OWNER')).toBe(true)
    expect(bolehUbahHarga('PURCHASING')).toBe(true)
    for (const r of ['ADMIN_HR', 'MITRA', 'LEADER', 'AREA_MANAGER', 'admin', null]) {
      expect(bolehUbahHarga(r)).toBe(false)
    }
  })
})
```

```ts
// apps/admin-dashboard/src/lib/masterBahan/galatRpc.test.ts
import { describe, it, expect } from 'vitest'
import { bacaGalatRpc } from './galatRpc'

describe('bacaGalatRpc', () => {
  it('42501 → pesan hak akses, membawa pesan asli', () => {
    const g = bacaGalatRpc({ code: '42501', message: 'Peran purchasing tidak berhak mengubah master bahan baku (lingkup data)' })
    expect(g.kode).toBe('42501')
    expect(g.pesan).toContain('tidak berhak')
    expect(g.bisaDipaksa).toBe(false)
  })
  it('dugaan salah satuan → bisaDipaksa', () => {
    const g = bacaGalatRpc({ code: 'P0001', message: 'Harga ini 48x harga master (Rp 1), pas dengan faktor satuan 48 — kemungkinan salah satuan. Periksa lagi, atau simpan dengan paksa bila memang benar.' })
    expect(g.bisaDipaksa).toBe(true)
  })
  it('satuan beli tak dikenali → bisaDipaksa', () => {
    const g = bacaGalatRpc({ code: '22023', message: 'Satuan beli "rol" tidak dikenali untuk bahan ini (tingkat: Dus/Roll/cm); periksa ejaan atau simpan dengan paksa bila memang benar.' })
    expect(g.bisaDipaksa).toBe(true)
    expect(g.kode).toBe('22023')
  })
  it('isi berbeda → TIDAK bisa dipaksa', () => {
    const g = bacaGalatRpc({ message: 'Isi 1 roll dari vendor ini (500) berbeda dengan master (760). Bahan harus dipecah per spesifikasi dulu sebelum harga ini dicatat.' })
    expect(g.bisaDipaksa).toBe(false)
    expect(g.pesan).toContain('dipecah')
  })
  it('Error biasa & nilai aneh', () => {
    expect(bacaGalatRpc(new Error('putus')).pesan).toBe('putus')
    expect(bacaGalatRpc('x').pesan).toBe('Terjadi kesalahan')
    expect(bacaGalatRpc(null).kode).toBeNull()
  })
})
```

Sebelum menulis implementasi, cocokkan dua regex (`salah satuan`, `tidak dikenali`) dengan pesan `RAISE` yang sebenarnya di `simpan_harga_vendor`: `SELECT prosrc FROM pg_proc WHERE proname='simpan_harga_vendor';`. Bila bunyinya berbeda, ubah **string uji** agar memuat pesan asli dan sesuaikan regex — jangan sebaliknya.

```ts
// apps/admin-dashboard/src/lib/masterBahan/satuanBeli.test.ts
import { describe, it, expect } from 'vitest'
import { pilihanSatuanBeli, hargaPerSatuanBesar } from './satuanBeli'

describe('pilihanSatuanBeli (cermin hitung_faktor_po + kg→gram)', () => {
  it('tiga tingkat FOIL', () => {
    expect(pilihanSatuanBeli({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 48, satuan_kecil: 'cm', faktor_tampilan: 36480 }))
      .toEqual([{ label: 'Dus', isi: 36480 }, { label: 'Roll', isi: 760 }, { label: 'cm', isi: 1 }])
  })
  it('bahan gram mendapat kg = 1000', () => {
    expect(pilihanSatuanBeli({ satuan: 'Dus', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram', faktor_tampilan: 16500 }))
      .toEqual([{ label: 'Dus', isi: 16500 }, { label: 'gram', isi: 1 }, { label: 'kg', isi: 1000 }])
  })
  it('tidak menggandakan kg bila Kg sudah jadi tingkat', () => {
    const p = pilihanSatuanBeli({ satuan: 'Kg', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'Gram', faktor_tampilan: 1000 })
    expect(p).toEqual([{ label: 'Kg', isi: 1000 }, { label: 'Gram', isi: 1 }])
  })
  it('satu tingkat: isi 1', () => {
    expect(pilihanSatuanBeli({ satuan: 'Unit', satuan_tengah: null, faktor_tengah: null, satuan_kecil: null, faktor_tampilan: null }))
      .toEqual([{ label: 'Unit', isi: 1 }])
  })
  it('faktor tak valid tidak menghasilkan isi palsu', () => {
    expect(pilihanSatuanBeli({ satuan: 'Dus', satuan_tengah: 'Roll', faktor_tengah: 0, satuan_kecil: 'cm', faktor_tampilan: null }))
      .toEqual([{ label: 'cm', isi: 1 }])
  })
})

describe('hargaPerSatuanBesar', () => {
  it('harga per roll → per Dus', () => {
    expect(hargaPerSatuanBesar(11554, 760, 36480)).toBeCloseTo(554592, 6)
  })
  it('tanpa satuan kecil memakai faktor 1', () => {
    expect(hargaPerSatuanBesar(220000, 1, null)).toBe(220000)
  })
  it('isi atau harga tak valid → null', () => {
    expect(hargaPerSatuanBesar(1000, 0, 10)).toBeNull()
    expect(hargaPerSatuanBesar(Number.NaN, 1, 10)).toBeNull()
  })
})
```

```ts
// apps/admin-dashboard/src/lib/masterBahan/riwayat.test.ts
import { describe, it, expect } from 'vitest'
import { rupiah } from '@/lib/format'
import { ringkasRiwayat, type BarisRiwayat } from './riwayat'

const dasar: BarisRiwayat = {
  bahan_baku_id: 'b1', changed_at: '2026-09-24T01:00:00Z', changed_by: null, jenis: 'data',
  tabel: 'bahan_baku', aksi: 'UPDATE', perubahan: null, alasan: null,
  harga_lama: null, harga_baru: null, supplier_id: null,
}

describe('ringkasRiwayat', () => {
  it('UPDATE data: satu kalimat per kolom, label manusiawi', () => {
    const r = ringkasRiwayat({ ...dasar, perubahan: { nama: { lama: 'A', baru: 'B' }, is_opname: { lama: true, baru: false } } })
    expect(r).toEqual(['Nama: A → B', 'Ikut opname: ya → tidak'])
  })
  it('INSERT & DELETE', () => {
    expect(ringkasRiwayat({ ...dasar, aksi: 'INSERT', perubahan: { nama: 'X' } })).toEqual(['Dibuat'])
    expect(ringkasRiwayat({ ...dasar, aksi: 'DELETE', perubahan: { nama: 'X' } })).toEqual(['Dihapus'])
  })
  it('SKU diberi awalan tabel', () => {
    expect(ringkasRiwayat({ ...dasar, tabel: 'bahan_baku_sku', aksi: 'INSERT', perubahan: {} })).toEqual(['SKU dibuat'])
    expect(ringkasRiwayat({ ...dasar, tabel: 'bahan_baku_sku', perubahan: { qty_isi: { lama: 1, baru: 2 } } }))
      .toEqual(['SKU Isi kemasan: 1 → 2'])
  })
  it('harga master & harga vendor', () => {
    expect(ringkasRiwayat({ ...dasar, jenis: 'harga_master', tabel: 'bahan_baku_harga', harga_lama: 1000, harga_baru: 1200 }))
      .toEqual([`Harga master: ${rupiah(1000)} → ${rupiah(1200)}`])
    expect(ringkasRiwayat({ ...dasar, jenis: 'harga_vendor', tabel: 'bahan_baku_supplier', harga_lama: null, harga_baru: 500,
      perubahan: { satuan_beli: 'roll', isi_satuan_kecil: 760, sumber: 'manual' } }))
      .toEqual([`Harga vendor: — → ${rupiah(500)}`, 'Per roll (isi 760), sumber manual'])
  })
  it('nilai kosong jadi —', () => {
    expect(ringkasRiwayat({ ...dasar, perubahan: { merek: { lama: null, baru: 'Z' } } })).toEqual(['Merek: — → Z'])
  })
})
```

Sebelum menulis `riwayat.ts`, periksa bentuk kolom `perubahan` di view live untuk UPDATE vs INSERT dan untuk `jenis='harga_vendor'`: `SELECT jenis, tabel, aksi, perubahan FROM riwayat_master_bahan ORDER BY changed_at DESC LIMIT 20;`. Bila bentuk UPDATE bukan `{kolom: {lama, baru}}` atau bentuk harga vendor tidak memuat `satuan_beli`/`isi_satuan_kecil`/`sumber`, sesuaikan fixture uji ke bentuk asli (dan implementasinya) — laporkan di DONE_WITH_CONCERNS.

```ts
// apps/admin-dashboard/src/lib/masterBahan/supplier.test.ts
import { describe, it, expect } from 'vitest'
import { saringDataSupplier } from './supplier'

describe('saringDataSupplier', () => {
  it('hanya kunci yang diizinkan simpan_supplier', () => {
    expect(saringDataSupplier({
      nama: 'A', kontak: '1', alamat: null, kategori: 'lainnya', catatan: '', termin_hari: 15,
      bahan_baku_ids: ['x'], is_active: true, id: 'zz', created_at: 'now',
    })).toEqual({ nama: 'A', kontak: '1', alamat: null, kategori: 'lainnya', catatan: '', termin_hari: 15, bahan_baku_ids: ['x'] })
  })
  it('tidak menambah kunci yang tak dikirim', () => {
    expect(saringDataSupplier({ termin_hari: 30 })).toEqual({ termin_hari: 30 })
  })
})
```

- [ ] **Step 3: Jalankan, pastikan GAGAL**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/masterBahan`
Harapan: gagal karena modul belum ada.

- [ ] **Step 4: Tulis implementasi**

```ts
// apps/admin-dashboard/src/lib/masterBahan/akses.ts
/**
 * Hak ubah master bahan baku di LAYAR. WAJIB sama dengan _peran_master() di DB
 * (Tahap 1): lingkup 'data' = admin/owner, 'harga' = admin/owner/purchasing.
 * Layar hanya menyembunyikan tombol; penjaga sesungguhnya ada di RPC.
 * Role datang dari useRole() — selalu huruf besar.
 */
export function bolehUbahData(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER'
}

export function bolehUbahHarga(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OWNER' || role === 'PURCHASING'
}
```

```ts
// apps/admin-dashboard/src/lib/masterBahan/galatRpc.ts
export type GalatRpc = { pesan: string; kode: string | null; bisaDipaksa: boolean }

/**
 * Terjemahkan galat dari supabase.rpc (PostgrestError: {code, message}).
 * `bisaDipaksa` = galat yang boleh dilewati dengan p_paksa di simpan_harga_vendor:
 * dugaan salah satuan & satuan beli tak dikenali. Isi kemasan berbeda TIDAK bisa dipaksa.
 */
export function bacaGalatRpc(e: unknown): GalatRpc {
  const obj = e !== null && typeof e === 'object' ? (e as { message?: unknown; code?: unknown }) : null
  const pesanAsli =
    typeof obj?.message === 'string' && obj.message.trim() !== '' ? obj.message : 'Terjadi kesalahan'
  const kode = typeof obj?.code === 'string' ? obj.code : null
  if (kode === '42501') {
    return { pesan: `Anda tidak berhak melakukan perubahan ini. (${pesanAsli})`, kode, bisaDipaksa: false }
  }
  return { pesan: pesanAsli, kode, bisaDipaksa: /salah satuan|tidak dikenali/i.test(pesanAsli) }
}
```

```ts
// apps/admin-dashboard/src/lib/masterBahan/satuanBeli.ts
export type TingkatSatuan = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
}

export type PilihanSatuanBeli = { label: string; isi: number }

const kanon = (s: string | null | undefined) => {
  const x = (s ?? '').trim().toLowerCase()
  return x === 'bks' ? 'bungkus' : x
}
const positif = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/**
 * Satuan beli yang dikenali sebuah bahan beserta isi satuan kecilnya.
 * Cermin hitung_faktor_po() (besar/tengah/kecil) + aturan kg→gram = 1000
 * di simpan_harga_vendor. Label lain harus disimpan dengan paksa.
 */
export function pilihanSatuanBeli(b: TingkatSatuan): PilihanSatuanBeli[] {
  const hasil: PilihanSatuanBeli[] = []
  const punyaKecil = kanon(b.satuan_kecil) !== ''
  if (!punyaKecil) hasil.push({ label: b.satuan, isi: 1 })
  else if (positif(b.faktor_tampilan)) hasil.push({ label: b.satuan, isi: b.faktor_tampilan })
  if (b.satuan_tengah && positif(b.faktor_tengah) && positif(b.faktor_tampilan)) {
    hasil.push({ label: b.satuan_tengah, isi: b.faktor_tampilan / b.faktor_tengah })
  }
  if (punyaKecil) hasil.push({ label: b.satuan_kecil as string, isi: 1 })
  if (kanon(b.satuan_kecil) === 'gram' && !hasil.some((p) => kanon(p.label) === 'kg')) {
    hasil.push({ label: 'kg', isi: 1000 })
  }
  const terlihat = new Set<string>()
  return hasil.filter((p) => {
    const k = kanon(p.label)
    if (terlihat.has(k)) return false
    terlihat.add(k)
    return true
  })
}

/** Harga per satuan beli → per satuan besar master (rumus turunan harga master di DB). */
export function hargaPerSatuanBesar(harga: number, isi: number, faktorTampilan: number | null): number | null {
  if (!positif(harga) || !positif(isi)) return null
  return (harga / isi) * (positif(faktorTampilan) ? faktorTampilan : 1)
}
```

```ts
// apps/admin-dashboard/src/lib/masterBahan/riwayat.ts
import { rupiah } from '@/lib/format'

/** Satu baris view riwayat_master_bahan (Tahap 1). */
export type BarisRiwayat = {
  bahan_baku_id: string | null
  changed_at: string
  changed_by: string | null
  jenis: 'data' | 'harga_master' | 'harga_vendor'
  tabel: string
  aksi: string
  perubahan: Record<string, unknown> | null
  alasan: string | null
  harga_lama: number | null
  harga_baru: number | null
  supplier_id: string | null
}

const LABEL: Record<string, string> = {
  nama: 'Nama', merek: 'Merek', kategori: 'Kategori', peruntukan: 'Peruntukan', is_opname: 'Ikut opname',
  default_reorder_point: 'Batas minimum', satuan: 'Satuan besar', satuan_tengah: 'Satuan tengah',
  faktor_tengah: 'Isi tengah per besar', satuan_kecil: 'Satuan kecil', faktor_tampilan: 'Isi kecil per besar',
  faktor_konversi: 'Isi kecil per tengah', satuan_po: 'Satuan PO', satuan_distribusi: 'Satuan distribusi',
  is_active: 'Aktif', image_url: 'Foto besar', image_url_tengah: 'Foto tengah', image_url_kecil: 'Foto kecil',
  image_urls: 'Galeri foto', nama_kemasan: 'Nama kemasan', qty_isi: 'Isi kemasan', harga_beli: 'Harga SKU',
  is_default: 'SKU default', kontak: 'Kontak', alamat: 'Alamat', catatan: 'Catatan', termin_hari: 'Termin (hari)',
  vendor_induk_id: 'Vendor induk', bahan_baku_ids: 'Bahan yang dipasok',
}

const AWALAN: Record<string, string> = { bahan_baku: '', bahan_baku_sku: 'SKU', supplier: 'Supplier' }

function nilai(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak'
  if (Array.isArray(v)) return `${v.length} item`
  return String(v)
}

function harga(v: number | null): string {
  return v === null || v === undefined ? '—' : rupiah(Number(v))
}

export function ringkasRiwayat(r: BarisRiwayat): string[] {
  if (r.jenis === 'harga_master') return [`Harga master: ${harga(r.harga_lama)} → ${harga(r.harga_baru)}`]
  if (r.jenis === 'harga_vendor') {
    const p = r.perubahan ?? {}
    const baris = [`Harga vendor: ${harga(r.harga_lama)} → ${harga(r.harga_baru)}`]
    if (p.satuan_beli) baris.push(`Per ${nilai(p.satuan_beli)} (isi ${nilai(p.isi_satuan_kecil)}), sumber ${nilai(p.sumber)}`)
    return baris
  }
  const awalan = AWALAN[r.tabel] ?? ''
  if (r.aksi === 'INSERT') return [awalan ? `${awalan} dibuat` : 'Dibuat']
  if (r.aksi === 'DELETE') return [awalan ? `${awalan} dihapus` : 'Dihapus']
  const p = (r.perubahan ?? {}) as Record<string, { lama?: unknown; baru?: unknown }>
  return Object.entries(p).map(
    ([k, d]) => `${awalan ? `${awalan} ` : ''}${LABEL[k] ?? k}: ${nilai(d?.lama)} → ${nilai(d?.baru)}`,
  )
}
```

```ts
// apps/admin-dashboard/src/lib/masterBahan/supplier.ts
/** Kunci yang diterima RPC simpan_supplier (migration 20260924100000). */
export const KUNCI_DATA_SUPPLIER = [
  'nama', 'kontak', 'alamat', 'kategori', 'catatan', 'termin_hari', 'vendor_induk_id', 'bahan_baku_ids',
] as const

/** RPC menolak kunci lain dengan 22023 — saring sebelum dikirim. */
export function saringDataSupplier(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of KUNCI_DATA_SUPPLIER) if (k in p) out[k] = p[k]
  return out
}
```

Pastikan `rupiah` memang diekspor dari `apps/admin-dashboard/src/lib/format.ts` (`grep -n "export function rupiah\|export const rupiah" apps/admin-dashboard/src/lib/format.ts`). Bila namanya lain, pakai fungsi format rupiah yang ada di sana (jangan buat baru) dan sesuaikan kedua berkas.

- [ ] **Step 5: Jalankan, pastikan LULUS**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/masterBahan`
Harapan: semua lulus.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/lib/masterBahan
git commit -m "feat(admin): logika murni master bahan — akses, galat RPC, satuan beli, riwayat, supplier"
```

---

### Task 3: Hook data & mutasi RPC; supplier & katalog pindah ke RPC

**Files:**
- Modify: `apps/admin-dashboard/src/lib/bahanBaku.ts`
- Create: `apps/admin-dashboard/src/hooks/masterBahan/useDaftarBahan.ts`, `useMutasiMasterBahan.ts`, `useStatusHarga.ts`, `useRiwayatMasterBahan.ts`, `useJumlahBatasOutlet.ts`
- Modify: `apps/admin-dashboard/src/hooks/usePurchaseOrder.ts` (fungsi `useCreateSupplier`, `useUpdateSupplier`, `useDeleteSupplier`, ~L241–289)
- Modify: `apps/admin-dashboard/src/hooks/useKatalogVendor.ts` (hapus `useKatalogVendorMutations`)
- Modify: `apps/admin-dashboard/src/components/katalog-vendor/KatalogVendorBoard.tsx` (sementara: lihat Step 6)

**Interfaces:**
- Consumes: Task 2 (`saringDataSupplier`, `bacaGalatRpc`), Task 1 view `bahan_baku_harga_asal`.
- Produces:
  - `BahanBakuWithHarga` diperluas dengan `is_active: boolean`, `default_reorder_point: number`, `peruntukan: 'outlet'|'gudang'|'keduanya'`, `is_opname: boolean`, `satuan_po: string | null`, `satuan_distribusi: string | null`.
  - `useDaftarBahan(): UseQueryResult<BahanBakuWithHarga[]>` — kunci `['master_bahan','daftar']`, aktif & nonaktif.
  - `useMutasiMasterBahan()` → `{ simpanBahan, nonaktifkan, aktifkan, hapus, simpanSku, setDefaultSku, hapusSku, unggahFoto, simpanHargaVendor, nonaktifkanHargaVendor }` (React Query mutations; tanda tangan di kode).
  - `type DataBahan`, `type DataSku`, `type LevelFoto = 'besar'|'tengah'|'kecil'`.
  - `useStatusHarga(): UseQueryResult<StatusHarga[]>`, `type StatusHarga`.
  - `useRiwayatMasterBahan(filter: FilterRiwayat)` → `{ rows: BarisRiwayat[]; namaPelaku: Map<string,string>; loading: boolean; error: unknown }`, `type FilterRiwayat = { bahanId: string | null; jenis: 'semua' | 'data' | 'harga_master' | 'harga_vendor' }`.
  - `useJumlahBatasOutlet(): { jumlah: Map<string, number>; tersedia: boolean }`.

- [ ] **Step 1: Perluas `lib/bahanBaku.ts`**

Tambah ke `BahanBakuRaw` (setelah `threshold_persentase?`):
```ts
  is_active?: boolean | null
  default_reorder_point?: number | null
  peruntukan?: 'outlet' | 'gudang' | 'keduanya' | null
  is_opname?: boolean | null
  satuan_po?: string | null
  satuan_distribusi?: string | null
```
Tambah ke `BahanBakuWithHarga` (setelah `threshold_persentase?`):
```ts
  is_active: boolean
  default_reorder_point: number
  peruntukan: 'outlet' | 'gudang' | 'keduanya'
  is_opname: boolean
  satuan_po: string | null
  satuan_distribusi: string | null
```
Di `normalizeBahanBaku`, sebelum `harga,` tambahkan:
```ts
    is_active: raw.is_active ?? true,
    default_reorder_point: Number(raw.default_reorder_point ?? 0),
    peruntukan: raw.peruntukan ?? 'outlet',
    is_opname: raw.is_opname ?? true,
    satuan_po: raw.satuan_po ?? null,
    satuan_distribusi: raw.satuan_distribusi ?? null,
```
Bila type-check menunjukkan pemanggil lain membangun `BahanBakuWithHarga` secara literal (bukan lewat `normalizeBahanBaku`), jadikan enam field baru opsional di `BahanBakuWithHarga` saja dan laporkan.

- [ ] **Step 2: Buat hook baca**

```ts
// apps/admin-dashboard/src/hooks/masterBahan/useDaftarBahan.ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { normalizeBahanBaku, type BahanBakuRaw, type BahanBakuWithHarga } from '@/lib/bahanBaku'

export const KUNCI_DAFTAR_BAHAN = ['master_bahan', 'daftar'] as const

const KOLOM =
  'id, nama, merek, image_url, image_url_tengah, image_url_kecil, image_urls, satuan, satuan_tengah, faktor_tengah, ' +
  'satuan_kecil, faktor_tampilan, kategori, is_active, default_reorder_point, peruntukan, is_opname, satuan_po, ' +
  'satuan_distribusi, bahan_baku_harga(harga_beli, harga_updated_at), ' +
  'bahan_baku_sku(id, bahan_baku_id, nama_kemasan, qty_isi, harga_beli, is_default, is_active, tingkatan_satuan, image_url, created_at)'

/** Semua bahan (aktif & nonaktif); layar yang menyaring. */
export function useDaftarBahan() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<BahanBakuWithHarga[]>({
    queryKey: KUNCI_DAFTAR_BAHAN,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('bahan_baku').select(KOLOM).order('nama')
      if (error) throw error
      return ((data ?? []) as unknown as BahanBakuRaw[]).map(normalizeBahanBaku)
    },
  })
}
```
Sebelum memakai `KOLOM`, bandingkan dengan select di `src/hooks/useBahanBakuHarga.ts` (hook lama): embed `bahan_baku_harga(...)` dan `bahan_baku_sku(...)` harus memakai nama kolom yang SAMA dengan yang dibaca `normalizeBahanBaku`. Bila berbeda, salin bentuk embed dari hook lama.

```ts
// apps/admin-dashboard/src/hooks/masterBahan/useStatusHarga.ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export type StatusHarga = {
  bahan_baku_id: string
  nama: string
  harga_master: number | null
  harga_master_updated_at: string | null
  status: 'terkonfirmasi' | 'belum_dikonfirmasi'
  vendor_terbaru_id: string | null
  harga_vendor_per_besar: number | null
  asal_catatan: string | null
  asal_waktu: string | null
}

type BarisStatus = Omit<StatusHarga, 'asal_catatan' | 'asal_waktu'>
type BarisAsal = { bahan_baku_id: string; catatan: string | null; changed_at: string }

/** View bahan_baku_status_harga (Tahap 1) + asal harga terbaru (bahan_baku_harga_asal). */
export function useStatusHarga() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<StatusHarga[]>({
    queryKey: ['master_bahan', 'status_harga'],
    staleTime: 60_000,
    queryFn: async () => {
      const [s, a] = await Promise.all([
        supabase.from('bahan_baku_status_harga').select('*').order('nama'),
        supabase.from('bahan_baku_harga_asal').select('bahan_baku_id, catatan, changed_at'),
      ])
      if (s.error) throw s.error
      if (a.error) throw a.error
      const asal = new Map(((a.data ?? []) as BarisAsal[]).map((x) => [x.bahan_baku_id, x]))
      return ((s.data ?? []) as BarisStatus[]).map((r) => ({
        ...r,
        harga_master: r.harga_master === null ? null : Number(r.harga_master),
        harga_vendor_per_besar: r.harga_vendor_per_besar === null ? null : Number(r.harga_vendor_per_besar),
        asal_catatan: asal.get(r.bahan_baku_id)?.catatan ?? null,
        asal_waktu: asal.get(r.bahan_baku_id)?.changed_at ?? null,
      }))
    },
  })
}
```

```ts
// apps/admin-dashboard/src/hooks/masterBahan/useRiwayatMasterBahan.ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BarisRiwayat } from '@/lib/masterBahan/riwayat'

export type FilterRiwayat = { bahanId: string | null; jenis: 'semua' | BarisRiwayat['jenis'] }

export function useRiwayatMasterBahan(filter: FilterRiwayat) {
  const supabase = useMemo(() => createClient(), [])
  const q = useQuery({
    queryKey: ['master_bahan', 'riwayat', filter.bahanId, filter.jenis],
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase.from('riwayat_master_bahan').select('*').order('changed_at', { ascending: false }).limit(200)
      if (filter.bahanId) query = query.eq('bahan_baku_id', filter.bahanId)
      if (filter.jenis !== 'semua') query = query.eq('jenis', filter.jenis)
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as BarisRiwayat[]
      const ids = Array.from(new Set(rows.map((r) => r.changed_by).filter((x): x is string => !!x)))
      const namaPelaku = new Map<string, string>()
      if (ids.length > 0) {
        const staf = await supabase.from('outlet_staff').select('id, name').in('id', ids)
        // Nama pelaku hanya pelengkap: gagal baca (RLS) cukup tampil tanpa nama.
        for (const s of (staf.data ?? []) as { id: string; name: string | null }[]) {
          if (s.name) namaPelaku.set(s.id, s.name)
        }
      }
      return { rows, namaPelaku }
    },
  })
  return {
    rows: q.data?.rows ?? [],
    namaPelaku: q.data?.namaPelaku ?? new Map<string, string>(),
    loading: q.isLoading,
    error: q.error,
  }
}
```
Periksa nama kolom nama staf: `SELECT column_name FROM information_schema.columns WHERE table_name='outlet_staff' AND column_name IN ('name','nama');`. Pakai yang ada.

```ts
// apps/admin-dashboard/src/hooks/masterBahan/useJumlahBatasOutlet.ts
'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

/**
 * Jumlah outlet yang punya batas minimum khusus (outlet_reorder_point) per bahan.
 * Hanya informasi (K8): penimpa per outlet tetap diatur di app Stok. Bila RLS
 * menolak baca, `tersedia` = false dan layar tidak menampilkan angka.
 */
export function useJumlahBatasOutlet() {
  const supabase = useMemo(() => createClient(), [])
  const q = useQuery({
    queryKey: ['master_bahan', 'batas_outlet'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('outlet_reorder_point').select('bahan_baku_id')
      if (error) return { jumlah: new Map<string, number>(), tersedia: false }
      const jumlah = new Map<string, number>()
      for (const r of (data ?? []) as { bahan_baku_id: string }[]) {
        jumlah.set(r.bahan_baku_id, (jumlah.get(r.bahan_baku_id) ?? 0) + 1)
      }
      return { jumlah, tersedia: true }
    },
  })
  return q.data ?? { jumlah: new Map<string, number>(), tersedia: false }
}
```

- [ ] **Step 3: Buat hook mutasi RPC**

```ts
// apps/admin-dashboard/src/hooks/masterBahan/useMutasiMasterBahan.ts
'use client'
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export type DataBahan = Partial<{
  nama: string
  merek: string | null
  kategori: string
  peruntukan: 'outlet' | 'gudang' | 'keduanya'
  is_opname: boolean
  default_reorder_point: number
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  isi_kecil_per_tengah: number | null
  satuan_po: string | null
  satuan_distribusi: string | null
  image_url: string | null
  image_url_tengah: string | null
  image_url_kecil: string | null
  image_urls: string[]
}>

export type DataSku = Partial<{ nama_kemasan: string; qty_isi: number; harga_beli: number; is_active: boolean }>

export type LevelFoto = 'besar' | 'tengah' | 'kecil'

const KOLOM_FOTO: Record<LevelFoto, 'image_url' | 'image_url_tengah' | 'image_url_kecil'> = {
  besar: 'image_url', tengah: 'image_url_tengah', kecil: 'image_url_kecil',
}

/** Kunci yang disegarkan setelah tulis master apa pun. */
const KUNCI_SEGAR: readonly (readonly string[])[] = [
  ['master_bahan'], ['katalog_vendor'], ['suppliers'], ['po-price-alerts'], ['harga-history'],
]

/**
 * Satu-satunya jalur tulis master bahan dari admin-dashboard (spec K10).
 * Galat RPC dilempar apa adanya (PostgrestError) supaya bacaGalatRpc membaca kodenya.
 */
export function useMutasiMasterBahan() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  const segarkan = () => {
    for (const k of KUNCI_SEGAR) qc.invalidateQueries({ queryKey: [...k] })
  }

  async function rpc<T>(nama: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(nama, args)
    if (error) throw error
    return data as T
  }

  const simpanBahan = useMutation({
    mutationFn: (v: { id: string | null; data: DataBahan; alasan?: string | null }) =>
      rpc<string>('simpan_bahan_baku', { p_id: v.id, p_data: v.data, p_alasan: v.alasan ?? null }),
    onSuccess: segarkan,
  })

  const nonaktifkan = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('nonaktifkan_bahan_baku', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  const aktifkan = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('aktifkan_bahan_baku', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  const hapus = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('hapus_bahan_baku', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  const simpanSku = useMutation({
    mutationFn: (v: { id: string | null; bahanId: string; data: DataSku }) =>
      rpc<string>('simpan_sku', { p_id: v.id, p_bahan_baku_id: v.bahanId, p_data: v.data }),
    onSuccess: segarkan,
  })

  const setDefaultSku = useMutation({
    mutationFn: (skuId: string) => rpc<null>('set_default_sku', { p_id: skuId }),
    onSuccess: segarkan,
  })

  const hapusSku = useMutation({
    mutationFn: (skuId: string) => rpc<null>('hapus_sku', { p_id: skuId }),
    onSuccess: segarkan,
  })

  const unggahFoto = useMutation({
    mutationFn: async (v: { bahanId: string; file: File; level: LevelFoto }) => {
      const ext = v.file.name.split('.').pop()
      const path = `${v.bahanId}_${v.level}_${Date.now()}.${ext}`
      const { error: galatUnggah } = await supabase.storage.from('bahan-baku').upload(path, v.file)
      if (galatUnggah) throw galatUnggah
      const { data: { publicUrl } } = supabase.storage.from('bahan-baku').getPublicUrl(path)
      return rpc<string>('simpan_bahan_baku', {
        p_id: v.bahanId,
        p_data: { [KOLOM_FOTO[v.level]]: publicUrl },
        p_alasan: `Foto ${v.level} diganti`,
      })
    },
    onSuccess: segarkan,
  })

  const simpanHargaVendor = useMutation({
    mutationFn: (v: {
      bahanId: string; supplierId: string; harga: number; satuanBeli: string; isi: number; alasan: string; paksa?: boolean
    }) =>
      rpc<string>('simpan_harga_vendor', {
        p_bahan: v.bahanId, p_supplier: v.supplierId, p_harga: v.harga, p_satuan_beli: v.satuanBeli,
        p_isi_satuan_kecil: v.isi, p_alasan: v.alasan, p_paksa: v.paksa ?? false,
      }),
    onSuccess: segarkan,
  })

  const nonaktifkanHargaVendor = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('nonaktifkan_harga_vendor', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  return {
    simpanBahan, nonaktifkan, aktifkan, hapus, simpanSku, setDefaultSku, hapusSku, unggahFoto,
    simpanHargaVendor, nonaktifkanHargaVendor,
  }
}
```
Nama parameter RPC (`p_id`, `p_bahan_baku_id`, `p_bahan`, `p_supplier`, …) WAJIB sama dengan tanda tangan live — PostgREST memanggil berdasarkan nama. Cek sekali: `SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname IN ('simpan_bahan_baku','nonaktifkan_bahan_baku','aktifkan_bahan_baku','hapus_bahan_baku','simpan_sku','set_default_sku','hapus_sku','simpan_harga_vendor','nonaktifkan_harga_vendor','simpan_supplier','nonaktifkan_supplier');` dan sesuaikan kode bila berbeda.

- [ ] **Step 4: Hook supplier admin → RPC**

Di `apps/admin-dashboard/src/hooks/usePurchaseOrder.ts`, tambah import `import { saringDataSupplier } from '@/lib/masterBahan/supplier'`, lalu ganti ketiga `mutationFn`:
```ts
// useCreateSupplier
    mutationFn: async (payload: Omit<Supplier, 'id' | 'created_at' | 'is_active'> & { is_active?: boolean }) => {
      const { data, error } = await supabase.rpc('simpan_supplier', {
        p_id: null,
        p_data: saringDataSupplier(payload as Record<string, unknown>),
        p_alasan: 'Dibuat dari halaman Master Supplier',
      })
      if (error) throw error
      return { id: data as string }
    },

// useUpdateSupplier
    mutationFn: async ({ id, ...payload }: Partial<Supplier> & { id: string }) => {
      const { error } = await supabase.rpc('simpan_supplier', {
        p_id: id,
        p_data: saringDataSupplier(payload as Record<string, unknown>),
        p_alasan: 'Diubah dari halaman Master Supplier',
      })
      if (error) throw error
    },

// useDeleteSupplier
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('nonaktifkan_supplier', {
        p_id: id,
        p_alasan: 'Dinonaktifkan dari halaman Master Supplier',
      })
      if (error) throw error
    },
```
Pertahankan tanda tangan parameter aslinya bila berbeda dari contoh di atas (salin tipe dari kode yang ada); yang diganti hanya isi fungsinya. `onSuccess`/`onError` tetap. Periksa `apps/admin-dashboard/src/app/dashboard/pembelian/supplier/page.tsx`: bila halaman itu memakai nilai balik `createSupplier` selain `id`, atau menampilkan `error.message` (pesan RPC kini dalam bahasa Indonesia — itu diharapkan), laporkan di DONE_WITH_CONCERNS.

- [ ] **Step 5: Hapus mutasi katalog tabel-langsung**

Di `apps/admin-dashboard/src/hooks/useKatalogVendor.ts` hapus seluruh fungsi `useKatalogVendorMutations` (mulai ~L90 sampai akhir fungsinya) beserta import yang jadi tak terpakai. `useKatalogVendor` tetap. `grep -rn "useKatalogVendorMutations" apps/admin-dashboard/src` harus hanya menyisakan `KatalogVendorBoard.tsx` (ditangani Step 6).

- [ ] **Step 6: Sambungkan sementara `KatalogVendorBoard` ke RPC (dialog alasan datang di Task 6)**

Di `KatalogVendorBoard.tsx`: ganti import `useKatalogVendorMutations` dengan `import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'` + `import { bacaGalatRpc } from '@/lib/masterBahan/galatRpc'`; ganti `const { simpanBaris } = useKatalogVendorMutations()` dengan `const { simpanHargaVendor } = useMutasiMasterBahan()`; ganti fungsi `simpan` dengan:
```ts
  async function simpan(input: { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }) {
    const baris = rows.find((r) => r.id === input.id)
    if (!baris) throw new Error('Baris katalog tidak ditemukan')
    try {
      await simpanHargaVendor.mutateAsync({
        bahanId: baris.bahan_baku_id, supplierId: baris.supplier_id, harga: input.harga,
        satuanBeli: input.satuan_beli.trim(), isi: input.isi_satuan_kecil, alasan: 'Diubah dari Katalog Vendor',
      })
      toast.success('Harga vendor tersimpan')
    } catch (e) {
      toast.error(bacaGalatRpc(e).pesan)
      throw e
    }
  }
```
(`rows` = variabel data katalog yang sudah ada di komponen itu; pakai namanya yang sebenarnya.)

- [ ] **Step 7: Type-check**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS"`
Harapan: jumlah galat ≤ baseline Task 2; tidak ada galat di berkas yang disentuh task ini.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-dashboard/src/lib/bahanBaku.ts apps/admin-dashboard/src/hooks/masterBahan apps/admin-dashboard/src/hooks/usePurchaseOrder.ts apps/admin-dashboard/src/hooks/useKatalogVendor.ts apps/admin-dashboard/src/components/katalog-vendor/KatalogVendorBoard.tsx
git commit -m "feat(admin): hook master bahan via RPC; supplier & katalog vendor tulis lewat RPC"
```

---

### Task 4: Komponen bersama — dialog alasan, isian satuan, form harga vendor

**Files:**
- Create: `apps/admin-dashboard/src/components/master-bahan/DialogAlasan.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/IsianSatuanFields.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/FormHargaVendor.tsx`

**Interfaces:**
- Consumes: `bacaGalatRpc`, `pilihanSatuanBeli`, `hargaPerSatuanBesar`, `turunkanFaktorSatuan` (`@/lib/satuanBahan` — sudah ada, dipakai Tahap 0), `useMutasiMasterBahan().simpanHargaVendor`, `useSuppliers` (`@/hooks/usePurchaseOrder`).
- Produces:
  - `DialogAlasan` props: `{ judul: string; keterangan?: string; wajib: boolean; galat: GalatRpc | null; memproses: boolean; labelKirim?: string; onBatal(): void; onKirim(v: { alasan: string; paksa: boolean }): void }`. Kotak "Simpan paksa" hanya tampil bila `galat?.bisaDipaksa`.
  - `type NilaiSatuan = { satuan: string; satuan_tengah: string; faktor_tengah: string; satuan_kecil: string; isi_kecil_per_tengah: string }`, `nilaiSatuanDari(b: TingkatSatuan): NilaiSatuan`, `keDataSatuan(v: NilaiSatuan)`, `IsianSatuanFields` props `{ nilai: NilaiSatuan; onUbah(v: NilaiSatuan): void; nonaktif?: boolean }`.
  - `FormHargaVendor` props: `{ bahan: TingkatSatuan & { id: string; nama: string }; supplierAwalId?: string | null; onSelesai(): void; onBatal(): void }`.

Periksa dulu tanda tangan `turunkanFaktorSatuan` di `apps/admin-dashboard/src/lib/satuanBahan.ts` (nama field masukan & keluaran). Kode di Step 2 mengasumsikan masukan `{ satuan, satuan_tengah, faktor_tengah, satuan_kecil, isiKecilPerTengah }` dan keluaran memuat `satuan`, `satuan_kecil`, `faktor_tampilan`; bila berbeda, sesuaikan pemanggilannya saja.

- [ ] **Step 1: DialogAlasan**

```tsx
// apps/admin-dashboard/src/components/master-bahan/DialogAlasan.tsx
'use client'
import { useState } from 'react'
import type { GalatRpc } from '@/lib/masterBahan/galatRpc'

export function DialogAlasan({
  judul, keterangan, wajib, galat, memproses, labelKirim = 'Simpan', onBatal, onKirim,
}: {
  judul: string
  keterangan?: string
  wajib: boolean
  galat: GalatRpc | null
  memproses: boolean
  labelKirim?: string
  onBatal: () => void
  onKirim: (v: { alasan: string; paksa: boolean }) => void
}) {
  const [alasan, setAlasan] = useState('')
  const [paksa, setPaksa] = useState(false)
  const kosong = alasan.trim() === ''
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-suka-brown">{judul}</h3>
        {keterangan && <p className="text-sm text-gray-600">{keterangan}</p>}
        <label className="block text-sm font-semibold text-gray-700">
          Alasan{wajib ? '' : ' (opsional)'}
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder="Mis. koreksi salah ketik, harga baru dari vendor…"
          />
        </label>
        {galat && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{galat.pesan}</div>
        )}
        {galat?.bisaDipaksa && (
          <label className="flex items-start gap-2 text-sm text-amber-800">
            <input type="checkbox" checked={paksa} onChange={(e) => setPaksa(e.target.checked)} className="mt-1" />
            Saya sudah memeriksa satuan dan harganya; simpan paksa.
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onBatal} disabled={memproses} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Batal
          </button>
          <button
            onClick={() => onKirim({ alasan: alasan.trim(), paksa })}
            disabled={memproses || (wajib && kosong)}
            className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {memproses ? 'Menyimpan…' : labelKirim}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: IsianSatuanFields**

```tsx
// apps/admin-dashboard/src/components/master-bahan/IsianSatuanFields.tsx
'use client'
import { turunkanFaktorSatuan } from '@/lib/satuanBahan'
import type { TingkatSatuan } from '@/lib/masterBahan/satuanBeli'
import type { DataBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'

export type NilaiSatuan = {
  satuan: string
  satuan_tengah: string
  faktor_tengah: string
  satuan_kecil: string
  isi_kecil_per_tengah: string
}

/** Isian form dari data master: isi kecil per TENGAH (atau per besar bila tanpa tengah). */
export function nilaiSatuanDari(b: TingkatSatuan): NilaiSatuan {
  const isi =
    b.satuan_tengah && b.faktor_tengah && b.faktor_tampilan ? b.faktor_tampilan / b.faktor_tengah : b.faktor_tampilan
  return {
    satuan: b.satuan ?? '',
    satuan_tengah: b.satuan_tengah ?? '',
    faktor_tengah: b.faktor_tengah ? String(b.faktor_tengah) : '',
    satuan_kecil: b.satuan_kecil ?? '',
    isi_kecil_per_tengah: isi ? String(isi) : '',
  }
}

const angkaAtauNull = (s: string): number | null => {
  const n = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

type DataSatuan = Pick<DataBahan, 'satuan' | 'satuan_tengah' | 'faktor_tengah' | 'satuan_kecil' | 'isi_kecil_per_tengah'>

/** Kunci satuan untuk simpan_bahan_baku — dikirim sebagai satu set. */
export function keDataSatuan(v: NilaiSatuan): DataSatuan {
  return {
    satuan: v.satuan.trim(),
    satuan_tengah: v.satuan_tengah.trim() || null,
    faktor_tengah: angkaAtauNull(v.faktor_tengah),
    satuan_kecil: v.satuan_kecil.trim() || null,
    isi_kecil_per_tengah: angkaAtauNull(v.isi_kecil_per_tengah) ?? 1,
  }
}

/** Faktor tampilan hasil turunan (dipakai pratinjau & pilihan satuan beli di form bahan baru). */
export function faktorTampilanDari(d: DataSatuan): number | null {
  if (!d.satuan_kecil) return null
  const perTengah = d.isi_kecil_per_tengah ?? 1
  return d.satuan_tengah && d.faktor_tengah ? d.faktor_tengah * perTengah : perTengah
}

export function IsianSatuanFields({
  nilai, onUbah, nonaktif = false,
}: { nilai: NilaiSatuan; onUbah: (v: NilaiSatuan) => void; nonaktif?: boolean }) {
  const set = (k: keyof NilaiSatuan) => (e: React.ChangeEvent<HTMLInputElement>) => onUbah({ ...nilai, [k]: e.target.value })
  const d = keDataSatuan(nilai)
  const pratinjau = turunkanFaktorSatuan({
    satuan: d.satuan ?? '', satuan_tengah: d.satuan_tengah ?? null, faktor_tengah: d.faktor_tengah ?? null,
    satuan_kecil: d.satuan_kecil ?? null, isiKecilPerTengah: d.isi_kecil_per_tengah ?? null,
  })
  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-gray-600">Satuan besar
          <input value={nilai.satuan} onChange={set('satuan')} disabled={nonaktif} className={kelas} placeholder="Dus" />
        </label>
        <label className="text-xs font-semibold text-gray-600">Satuan kecil (kosongkan bila satu tingkat)
          <input value={nilai.satuan_kecil} onChange={set('satuan_kecil')} disabled={nonaktif} className={kelas} placeholder="gram" />
        </label>
        <label className="text-xs font-semibold text-gray-600">Satuan tengah (opsional)
          <input value={nilai.satuan_tengah} onChange={set('satuan_tengah')} disabled={nonaktif} className={kelas} placeholder="Roll" />
        </label>
        <label className="text-xs font-semibold text-gray-600">1 besar = … tengah
          <input value={nilai.faktor_tengah} onChange={set('faktor_tengah')} disabled={nonaktif || !nilai.satuan_tengah.trim()} className={kelas} inputMode="decimal" />
        </label>
        <label className="col-span-2 text-xs font-semibold text-gray-600">
          1 {nilai.satuan_tengah.trim() || nilai.satuan.trim() || 'satuan'} = … {nilai.satuan_kecil.trim() || 'satuan kecil'}
          <input value={nilai.isi_kecil_per_tengah} onChange={set('isi_kecil_per_tengah')} disabled={nonaktif || !nilai.satuan_kecil.trim()} className={kelas} inputMode="decimal" />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        {pratinjau.satuan_kecil
          ? pratinjau.faktor_tampilan
            ? `Hasil: 1 ${pratinjau.satuan} = ${Number(pratinjau.faktor_tampilan).toLocaleString('id-ID')} ${pratinjau.satuan_kecil}`
            : 'Isi belum lengkap.'
          : `Hasil: satu tingkat (${pratinjau.satuan || '—'}).`}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: FormHargaVendor**

```tsx
// apps/admin-dashboard/src/components/master-bahan/FormHargaVendor.tsx
'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSuppliers } from '@/hooks/usePurchaseOrder'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { pilihanSatuanBeli, hargaPerSatuanBesar, type TingkatSatuan } from '@/lib/masterBahan/satuanBeli'
import { rupiah } from '@/lib/format'

const LAINNYA = '__lainnya__'

export function FormHargaVendor({
  bahan, supplierAwalId = null, onSelesai, onBatal,
}: {
  bahan: TingkatSatuan & { id: string; nama: string }
  supplierAwalId?: string | null
  onSelesai: () => void
  onBatal: () => void
}) {
  const { data: suppliers = [] } = useSuppliers()
  const aktif = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers])
  const pilihan = useMemo(() => pilihanSatuanBeli(bahan), [bahan])
  const { simpanHargaVendor } = useMutasiMasterBahan()

  const [supplierId, setSupplierId] = useState<string>(supplierAwalId ?? '')
  const [labelPilihan, setLabelPilihan] = useState<string>(pilihan[0]?.label ?? LAINNYA)
  const [labelLain, setLabelLain] = useState('')
  const [isiLain, setIsiLain] = useState('')
  const [harga, setHarga] = useState('')
  const [alasan, setAlasan] = useState('')
  const [paksa, setPaksa] = useState(false)
  const [galat, setGalat] = useState<GalatRpc | null>(null)

  const lainnya = labelPilihan === LAINNYA
  const satuanBeli = lainnya ? labelLain.trim() : labelPilihan
  const isi = lainnya ? Number(isiLain.replace(',', '.')) : pilihan.find((p) => p.label === labelPilihan)?.isi ?? 0
  const nilaiHarga = Number(harga.replace(/[^\d.,]/g, '').replace(',', '.'))
  const perBesar = hargaPerSatuanBesar(nilaiHarga, isi, bahan.faktor_tampilan)
  const lengkap = supplierId !== '' && satuanBeli !== '' && isi > 0 && nilaiHarga > 0 && alasan.trim() !== ''

  async function simpan() {
    setGalat(null)
    try {
      await simpanHargaVendor.mutateAsync({
        bahanId: bahan.id, supplierId, harga: nilaiHarga, satuanBeli, isi, alasan: alasan.trim(), paksa,
      })
      toast.success('Harga vendor tersimpan; harga master menyesuaikan otomatis')
      onSelesai()
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <h3 className="text-base font-extrabold text-suka-brown">Harga vendor — {bahan.nama}</h3>
          <p className="text-xs text-gray-500">Harga master dihitung otomatis dari harga vendor terbaru.</p>
        </div>
        <label className="block text-xs font-semibold text-gray-600">Vendor
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={kelas}>
            <option value="">— pilih vendor —</option>
            {aktif.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-gray-600">Dibeli per
            <select value={labelPilihan} onChange={(e) => setLabelPilihan(e.target.value)} className={kelas}>
              {pilihan.map((p) => <option key={p.label} value={p.label}>{p.label} (isi {p.isi.toLocaleString('id-ID')})</option>)}
              <option value={LAINNYA}>Satuan lain…</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600">Harga per {satuanBeli || 'satuan'}
            <input value={harga} onChange={(e) => setHarga(e.target.value)} className={kelas} inputMode="decimal" placeholder="0" />
          </label>
          {lainnya && (
            <>
              <label className="text-xs font-semibold text-gray-600">Nama satuan
                <input value={labelLain} onChange={(e) => setLabelLain(e.target.value)} className={kelas} />
              </label>
              <label className="text-xs font-semibold text-gray-600">Isi {bahan.satuan_kecil ?? bahan.satuan} per satuan ini
                <input value={isiLain} onChange={(e) => setIsiLain(e.target.value)} className={kelas} inputMode="decimal" />
              </label>
            </>
          )}
        </div>
        <p className="text-xs text-gray-600">
          {perBesar !== null ? `Setara ${rupiah(Math.round(perBesar))} per ${bahan.satuan}.` : 'Isi harga dan satuan untuk melihat setara per satuan besar.'}
        </p>
        <label className="block text-xs font-semibold text-gray-600">Alasan
          <input value={alasan} onChange={(e) => setAlasan(e.target.value)} className={kelas} placeholder="Mis. harga baru dari nota 24 Sep" />
        </label>
        {galat && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{galat.pesan}</div>}
        {galat?.bisaDipaksa && (
          <label className="flex items-start gap-2 text-sm text-amber-800">
            <input type="checkbox" checked={paksa} onChange={(e) => setPaksa(e.target.checked)} className="mt-1" />
            Saya sudah memeriksa satuan dan harganya; simpan paksa.
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onBatal} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Batal</button>
          <button onClick={simpan} disabled={!lengkap || simpanHargaVendor.isPending}
            className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {simpanHargaVendor.isPending ? 'Menyimpan…' : 'Simpan harga'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check (≤ baseline, nol galat di tiga berkas baru)**

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/master-bahan/DialogAlasan.tsx apps/admin-dashboard/src/components/master-bahan/IsianSatuanFields.tsx apps/admin-dashboard/src/components/master-bahan/FormHargaVendor.tsx
git commit -m "feat(admin): komponen bersama master bahan — dialog alasan, isian satuan, form harga vendor"
```

---

### Task 5: Halaman bertab + Tab Data Bahan

**Files:**
- Create: `apps/admin-dashboard/src/components/master-bahan/MasterBahanPage.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/TabDataBahan.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/FormBahanBaru.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/PanelBahan.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/SeksiIdentitas.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/SeksiSatuan.tsx`
- Create: `apps/admin-dashboard/src/components/master-bahan/SeksiFotoSku.tsx`
- Create (stub, diganti Task 6): `TabHarga.tsx`, `TabVendor.tsx`, `TabRiwayat.tsx`
- Modify: `apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx` (ganti isi seluruhnya)
- Delete: `apps/admin-dashboard/src/components/BahanBakuTable.tsx`, `BahanBakuDetailModal.tsx`, `BahanBakuAddModal.tsx`, `src/hooks/useBahanBakuHarga.ts`, `src/hooks/useBahanBakuHargaMutations.ts`, `src/app/actions/bahanBakuActions.ts`

**Interfaces:**
- Consumes: Task 2–4. `BahanBakuFilters` (`@/components/BahanBakuFilters`, props `{search, onSearch, sortBy, onSortBy}`), `filterAndSortBahanBaku`, `SortOption` (`@/lib/bahanBaku`), `useRole` (`@/components/layout/RoleContext`).
- Produces: `MasterBahanPage` (default tab `data`; tab via `?tab=data|harga|vendor|riwayat`). Task 6 mengganti isi `TabHarga`, `TabVendor`, `TabRiwayat` (ekspor bernama, tanpa props).

- [ ] **Step 1: Stub tiga tab**

```tsx
// apps/admin-dashboard/src/components/master-bahan/TabHarga.tsx  (stub — diganti Task 6)
export function TabHarga() { return <p className="p-6 text-sm text-gray-500">Segera.</p> }
```
```tsx
// apps/admin-dashboard/src/components/master-bahan/TabVendor.tsx  (stub — diganti Task 6)
export function TabVendor() { return <p className="p-6 text-sm text-gray-500">Segera.</p> }
```
```tsx
// apps/admin-dashboard/src/components/master-bahan/TabRiwayat.tsx  (stub — diganti Task 6)
export function TabRiwayat() { return <p className="p-6 text-sm text-gray-500">Segera.</p> }
```

- [ ] **Step 2: MasterBahanPage + page.tsx**

```tsx
// apps/admin-dashboard/src/components/master-bahan/MasterBahanPage.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { TabDataBahan } from './TabDataBahan'
import { TabHarga } from './TabHarga'
import { TabVendor } from './TabVendor'
import { TabRiwayat } from './TabRiwayat'

const TAB = [
  { id: 'data', label: 'Data Bahan' },
  { id: 'harga', label: 'Harga' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'riwayat', label: 'Riwayat' },
] as const
type IdTab = (typeof TAB)[number]['id']

export function MasterBahanPage() {
  const router = useRouter()
  const params = useSearchParams()
  const diminta = params.get('tab')
  const aktif: IdTab = TAB.some((t) => t.id === diminta) ? (diminta as IdTab) : 'data'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-suka-brown">Master Bahan Baku</h1>
        <p className="text-sm text-gray-500">Satu tempat untuk data bahan, harga, vendor, dan riwayat perubahannya.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TAB.map((t) => (
          <button
            key={t.id}
            onClick={() => router.replace(`/dashboard/bahan-baku?tab=${t.id}`)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-bold transition-colors ${
              aktif === t.id ? 'border-b-2 border-suka-orange text-suka-orange' : 'text-gray-500 hover:text-suka-brown'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {aktif === 'data' && <TabDataBahan />}
      {aktif === 'harga' && <TabHarga />}
      {aktif === 'vendor' && <TabVendor />}
      {aktif === 'riwayat' && <TabRiwayat />}
    </div>
  )
}
```

```tsx
// apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx
import { Suspense } from 'react'
import { Spinner } from '@suka/design-system'
import { MasterBahanPage } from '@/components/master-bahan/MasterBahanPage'

// useSearchParams di MasterBahanPage wajib dibungkus Suspense agar build produksi lolos.
export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner /></div>}>
      <MasterBahanPage />
    </Suspense>
  )
}
```

- [ ] **Step 3: TabDataBahan**

```tsx
// apps/admin-dashboard/src/components/master-bahan/TabDataBahan.tsx
'use client'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useJumlahBatasOutlet } from '@/hooks/masterBahan/useJumlahBatasOutlet'
import { filterAndSortBahanBaku, type SortOption } from '@/lib/bahanBaku'
import { bolehUbahData } from '@/lib/masterBahan/akses'
import { BahanBakuFilters } from '@/components/BahanBakuFilters'
import { rupiah } from '@/lib/format'
import { FormBahanBaru } from './FormBahanBaru'
import { PanelBahan } from './PanelBahan'

const LABEL_PERUNTUKAN = { outlet: 'Outlet', gudang: 'Gudang', keduanya: 'Gudang & Outlet' } as const

export function TabDataBahan() {
  const { role } = useRole()
  const bolehData = bolehUbahData(role)
  const { data: rows = [], isLoading, error } = useDaftarBahan()
  const batas = useJumlahBatasOutlet()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('nama-asc')
  const [tampilNonaktif, setTampilNonaktif] = useState(false)
  const [dipilihId, setDipilihId] = useState<string | null>(null)
  const [tambahBuka, setTambahBuka] = useState(false)

  const tampil = useMemo(
    () => filterAndSortBahanBaku(rows.filter((r) => tampilNonaktif || r.is_active), search, sortBy),
    [rows, tampilNonaktif, search, sortBy],
  )
  const kategori = useMemo(() => Array.from(new Set(rows.map((r) => r.kategori))).sort(), [rows])
  const dipilih = rows.find((r) => r.id === dipilihId) ?? null

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error) return <p className="p-6 text-sm text-red-600">Gagal memuat bahan baku: {String((error as Error).message ?? error)}</p>

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BahanBakuFilters search={search} onSearch={setSearch} sortBy={sortBy} onSortBy={setSortBy} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={tampilNonaktif} onChange={(e) => setTampilNonaktif(e.target.checked)} />
            Tampilkan nonaktif
          </label>
          {bolehData && (
            <button onClick={() => setTambahBuka(true)}
              className="flex items-center gap-2 rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white">
              <Plus size={16} /> Tambah Bahan
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2">Bahan</th><th>Kategori</th><th>Satuan</th><th>Peruntukan</th><th className="text-right">Harga master</th><th />
            </tr>
          </thead>
          <tbody>
            {tampil.map((r) => (
              <tr key={r.id} className={`border-b last:border-0 ${r.is_active ? '' : 'opacity-50'}`}>
                <td className="py-2 font-semibold text-suka-brown">
                  {r.nama}{r.merek ? <span className="ml-1 text-xs font-normal text-gray-500">({r.merek})</span> : null}
                  {!r.is_active && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">nonaktif</span>}
                  {!r.is_opname && <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">tanpa opname</span>}
                </td>
                <td>{r.kategori}</td>
                <td className="text-gray-600">
                  {r.satuan}{r.satuan_kecil && r.faktor_tampilan ? ` = ${Number(r.faktor_tampilan).toLocaleString('id-ID')} ${r.satuan_kecil}` : ''}
                </td>
                <td>{LABEL_PERUNTUKAN[r.peruntukan]}</td>
                <td className="text-right">{r.harga?.harga_beli ? rupiah(r.harga.harga_beli) : '—'}</td>
                <td className="text-right">
                  <button onClick={() => setDipilihId(r.id)} className="text-sm font-bold text-suka-orange hover:underline">Detail</button>
                </td>
              </tr>
            ))}
            {tampil.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">Tidak ada bahan yang cocok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {tambahBuka && (
        <FormBahanBaru kategoriAda={kategori} onBatal={() => setTambahBuka(false)}
          onSelesai={(id) => { setTambahBuka(false); setDipilihId(id) }} />
      )}
      {dipilih && (
        <PanelBahan key={dipilih.id} bahan={dipilih} bolehData={bolehData}
          jumlahBatasOutlet={batas.tersedia ? batas.jumlah.get(dipilih.id) ?? 0 : null}
          onTutup={() => setDipilihId(null)} />
      )}
    </div>
  )
}
```
Cek sekali bentuk `r.harga` pada `BahanBakuWithHarga` (`lib/bahanBaku.ts`) dan nilai `SortOption` default yang sah (mis. `'nama-asc'`); pakai nilai yang ada di tipe.

- [ ] **Step 4: FormBahanBaru**

```tsx
// apps/admin-dashboard/src/components/master-bahan/FormBahanBaru.tsx
'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSuppliers } from '@/hooks/usePurchaseOrder'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc } from '@/lib/masterBahan/galatRpc'
import { pilihanSatuanBeli } from '@/lib/masterBahan/satuanBeli'
import { IsianSatuanFields, faktorTampilanDari, keDataSatuan, type NilaiSatuan } from './IsianSatuanFields'

const BELI_TUNAI = 'Beli Tunai / Tanpa Vendor'

export function FormBahanBaru({
  kategoriAda, onBatal, onSelesai,
}: { kategoriAda: string[]; onBatal: () => void; onSelesai: (id: string) => void }) {
  const { simpanBahan, simpanHargaVendor } = useMutasiMasterBahan()
  const { data: suppliers = [] } = useSuppliers()
  const aktif = useMemo(() => suppliers.filter((s) => s.is_active), [suppliers])

  const [nama, setNama] = useState('')
  const [kategori, setKategori] = useState('')
  const [peruntukan, setPeruntukan] = useState<'outlet' | 'gudang' | 'keduanya'>('outlet')
  const [isOpname, setIsOpname] = useState(true)
  const [batas, setBatas] = useState('0')
  const [satuan, setSatuan] = useState<NilaiSatuan>({ satuan: '', satuan_tengah: '', faktor_tengah: '', satuan_kecil: '', isi_kecil_per_tengah: '' })
  const [supplierId, setSupplierId] = useState('')
  const [labelBeli, setLabelBeli] = useState('')
  const [harga, setHarga] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  const dataSatuan = keDataSatuan(satuan)
  const pilihan = pilihanSatuanBeli({
    satuan: dataSatuan.satuan ?? '',
    satuan_tengah: dataSatuan.satuan_tengah ?? null,
    faktor_tengah: dataSatuan.faktor_tengah ?? null,
    satuan_kecil: dataSatuan.satuan_kecil ?? null,
    faktor_tampilan: faktorTampilanDari(dataSatuan),
  })
  const vendorAwal = supplierId || aktif.find((s) => s.nama === BELI_TUNAI)?.id || ''
  const nilaiHarga = Number(harga.replace(/[^\d.,]/g, '').replace(',', '.'))
  const pilihanBeli = pilihan.find((p) => p.label === labelBeli) ?? pilihan[0]
  const memproses = simpanBahan.isPending || simpanHargaVendor.isPending
  const lengkap = nama.trim() !== '' && kategori.trim() !== '' && satuan.satuan.trim() !== ''

  async function simpan() {
    setGalat(null)
    let id: string
    try {
      id = await simpanBahan.mutateAsync({
        id: null,
        data: {
          nama: nama.trim(), kategori: kategori.trim(), peruntukan, is_opname: isOpname,
          default_reorder_point: Number(batas) || 0, ...dataSatuan,
        },
        alasan: 'Bahan baru',
      })
    } catch (e) {
      setGalat(bacaGalatRpc(e).pesan)
      return
    }
    if (nilaiHarga > 0 && vendorAwal && pilihanBeli) {
      try {
        await simpanHargaVendor.mutateAsync({
          bahanId: id, supplierId: vendorAwal, harga: nilaiHarga, satuanBeli: pilihanBeli.label,
          isi: pilihanBeli.isi, alasan: 'Harga awal saat bahan dibuat',
        })
      } catch (e) {
        toast.error(`Bahan tersimpan, tetapi harga awal gagal: ${bacaGalatRpc(e).pesan}`)
        onSelesai(id)
        return
      }
    }
    toast.success('Bahan baku ditambahkan')
    onSelesai(id)
  }

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-extrabold text-suka-brown">Tambah bahan baku</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-semibold text-gray-600">Nama
            <input value={nama} onChange={(e) => setNama(e.target.value)} className={kelas} />
          </label>
          <label className="text-xs font-semibold text-gray-600">Kategori
            <input value={kategori} onChange={(e) => setKategori(e.target.value)} list="daftar-kategori" className={kelas} />
            <datalist id="daftar-kategori">{kategoriAda.map((k) => <option key={k} value={k} />)}</datalist>
          </label>
          <label className="text-xs font-semibold text-gray-600">Peruntukan
            <select value={peruntukan} onChange={(e) => setPeruntukan(e.target.value as typeof peruntukan)} className={kelas}>
              <option value="outlet">Outlet</option><option value="gudang">Gudang</option><option value="keduanya">Gudang & Outlet</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isOpname} onChange={(e) => setIsOpname(e.target.checked)} /> Ikut opname
          </label>
          <label className="text-xs font-semibold text-gray-600">Batas minimum bawaan (dalam satuan besar)
            <input value={batas} onChange={(e) => setBatas(e.target.value)} className={kelas} inputMode="decimal" />
          </label>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-suka-brown">Satuan</h3>
          <IsianSatuanFields nilai={satuan} onUbah={setSatuan} />
        </div>
        <div className="space-y-2 rounded-xl bg-gray-50 p-3">
          <h3 className="text-sm font-bold text-suka-brown">Harga awal (opsional)</h3>
          <p className="text-xs text-gray-500">Dicatat sebagai harga vendor. Tanpa vendor tetap, pilih “{BELI_TUNAI}”.</p>
          <div className="grid grid-cols-3 gap-2">
            <select value={vendorAwal} onChange={(e) => setSupplierId(e.target.value)} className={kelas}>
              <option value="">— vendor —</option>
              {aktif.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
            <select value={pilihanBeli?.label ?? ''} onChange={(e) => setLabelBeli(e.target.value)} className={kelas}>
              {pilihan.map((p) => <option key={p.label} value={p.label}>per {p.label}</option>)}
            </select>
            <input value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="Harga" className={kelas} inputMode="decimal" />
          </div>
        </div>
        {galat && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{galat}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onBatal} disabled={memproses} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Batal</button>
          <button onClick={simpan} disabled={!lengkap || memproses} className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {memproses ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: PanelBahan + tiga seksi**

```tsx
// apps/admin-dashboard/src/components/master-bahan/PanelBahan.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { rupiah } from '@/lib/format'
import { DialogAlasan } from './DialogAlasan'
import { SeksiIdentitas } from './SeksiIdentitas'
import { SeksiSatuan } from './SeksiSatuan'
import { SeksiFotoSku } from './SeksiFotoSku'

type Aksi = 'nonaktifkan' | 'aktifkan' | 'hapus'

const JUDUL: Record<Aksi, string> = { nonaktifkan: 'Nonaktifkan', aktifkan: 'Aktifkan', hapus: 'Hapus' }

export function PanelBahan({
  bahan, bolehData, jumlahBatasOutlet, onTutup,
}: { bahan: BahanBakuWithHarga; bolehData: boolean; jumlahBatasOutlet: number | null; onTutup: () => void }) {
  const mut = useMutasiMasterBahan()
  const [aksi, setAksi] = useState<Aksi | null>(null)
  const [galat, setGalat] = useState<GalatRpc | null>(null)

  async function jalankan({ alasan }: { alasan: string; paksa: boolean }) {
    if (!aksi) return
    setGalat(null)
    try {
      await mut[aksi].mutateAsync({ id: bahan.id, alasan })
      toast.success(aksi === 'hapus' ? 'Bahan dihapus' : aksi === 'aktifkan' ? 'Bahan diaktifkan' : 'Bahan dinonaktifkan')
      const tutup = aksi === 'hapus'
      setAksi(null)
      if (tutup) onTutup()
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-2xl space-y-6 overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-suka-brown">{bahan.nama}</h2>
            <p className="text-xs text-gray-500">{bahan.is_active ? 'Aktif' : 'Nonaktif'} · {bahan.kategori}</p>
          </div>
          <button onClick={onTutup} aria-label="Tutup" className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 text-sm">
          <p className="font-semibold text-gray-700">
            Harga master: {bahan.harga?.harga_beli ? `${rupiah(bahan.harga.harga_beli)} per ${bahan.satuan}` : 'belum ada'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Dihitung otomatis dari harga vendor terbaru.{' '}
            <Link href="/dashboard/bahan-baku?tab=harga" className="font-bold text-suka-orange hover:underline">Kelola di tab Harga</Link>
          </p>
        </div>

        <SeksiIdentitas bahan={bahan} bolehData={bolehData} jumlahBatasOutlet={jumlahBatasOutlet} />
        <SeksiSatuan bahan={bahan} bolehData={bolehData} />
        <SeksiFotoSku bahan={bahan} bolehData={bolehData} />

        {bolehData && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {bahan.is_active ? (
              <button onClick={() => setAksi('nonaktifkan')} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-700">Nonaktifkan</button>
            ) : (
              <button onClick={() => setAksi('aktifkan')} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-700">Aktifkan lagi</button>
            )}
            <button onClick={() => setAksi('hapus')} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Hapus</button>
            <p className="w-full text-xs text-gray-500">
              Hapus hanya bisa untuk bahan yang belum pernah dipakai. Bahan yang sudah punya riwayat dinonaktifkan saja.
            </p>
          </div>
        )}
      </div>

      {aksi && (
        <DialogAlasan
          judul={`${JUDUL[aksi]} ${bahan.nama}?`}
          keterangan={aksi === 'nonaktifkan' ? 'Ditolak bila masih dipakai resep aktif, dokumen berjalan, substitusi, atau stoknya belum nol.' : undefined}
          wajib galat={galat} memproses={mut[aksi].isPending} labelKirim={JUDUL[aksi]}
          onBatal={() => { setAksi(null); setGalat(null) }} onKirim={jalankan}
        />
      )}
    </div>
  )
}
```

```tsx
// apps/admin-dashboard/src/components/master-bahan/SeksiIdentitas.tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan, type DataBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { DialogAlasan } from './DialogAlasan'

export function SeksiIdentitas({
  bahan, bolehData, jumlahBatasOutlet,
}: { bahan: BahanBakuWithHarga; bolehData: boolean; jumlahBatasOutlet: number | null }) {
  const { simpanBahan } = useMutasiMasterBahan()
  const [nama, setNama] = useState(bahan.nama)
  const [merek, setMerek] = useState(bahan.merek ?? '')
  const [kategori, setKategori] = useState(bahan.kategori)
  const [peruntukan, setPeruntukan] = useState(bahan.peruntukan)
  const [isOpname, setIsOpname] = useState(bahan.is_opname)
  const [batas, setBatas] = useState(String(bahan.default_reorder_point))
  const [minta, setMinta] = useState(false)
  const [galat, setGalat] = useState<GalatRpc | null>(null)

  // Hanya kolom yang berubah yang dikirim — riwayat perubahan tetap bersih.
  const ubahan: DataBahan = {}
  if (nama.trim() !== bahan.nama) ubahan.nama = nama.trim()
  if ((merek.trim() || null) !== (bahan.merek ?? null)) ubahan.merek = merek.trim() || null
  if (kategori.trim() !== bahan.kategori) ubahan.kategori = kategori.trim()
  if (peruntukan !== bahan.peruntukan) ubahan.peruntukan = peruntukan
  if (isOpname !== bahan.is_opname) ubahan.is_opname = isOpname
  if ((Number(batas) || 0) !== bahan.default_reorder_point) ubahan.default_reorder_point = Number(batas) || 0
  const adaUbahan = Object.keys(ubahan).length > 0

  async function simpan({ alasan }: { alasan: string; paksa: boolean }) {
    setGalat(null)
    try {
      await simpanBahan.mutateAsync({ id: bahan.id, data: ubahan, alasan: alasan || null })
      toast.success('Data bahan disimpan')
      setMinta(false)
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50'
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-suka-brown">Identitas & operasional</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs font-semibold text-gray-600">Nama
          <input value={nama} onChange={(e) => setNama(e.target.value)} disabled={!bolehData} className={kelas} />
        </label>
        <label className="text-xs font-semibold text-gray-600">Merek
          <input value={merek} onChange={(e) => setMerek(e.target.value)} disabled={!bolehData} className={kelas} />
        </label>
        <label className="text-xs font-semibold text-gray-600">Kategori
          <input value={kategori} onChange={(e) => setKategori(e.target.value)} disabled={!bolehData} className={kelas} />
        </label>
        <label className="text-xs font-semibold text-gray-600">Peruntukan
          <select value={peruntukan} onChange={(e) => setPeruntukan(e.target.value as typeof peruntukan)} disabled={!bolehData} className={kelas}>
            <option value="outlet">Outlet</option><option value="gudang">Gudang</option><option value="keduanya">Gudang & Outlet</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">Batas minimum bawaan (per {bahan.satuan})
          <input value={batas} onChange={(e) => setBatas(e.target.value)} disabled={!bolehData} className={kelas} inputMode="decimal" />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isOpname} onChange={(e) => setIsOpname(e.target.checked)} disabled={!bolehData} /> Ikut opname
        </label>
      </div>
      {jumlahBatasOutlet !== null && jumlahBatasOutlet > 0 && (
        <p className="text-xs text-gray-500">{jumlahBatasOutlet} outlet punya batas khusus untuk bahan ini — diatur di app Stok.</p>
      )}
      {bolehData && (
        <button onClick={() => setMinta(true)} disabled={!adaUbahan}
          className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Simpan perubahan</button>
      )}
      {minta && (
        <DialogAlasan judul="Simpan perubahan data bahan" wajib={false} galat={galat} memproses={simpanBahan.isPending}
          onBatal={() => { setMinta(false); setGalat(null) }} onKirim={simpan} />
      )}
    </section>
  )
}
```

```tsx
// apps/admin-dashboard/src/components/master-bahan/SeksiSatuan.tsx
'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan, type DataBahan } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'
import { pilihanSatuanBeli } from '@/lib/masterBahan/satuanBeli'
import { DialogAlasan } from './DialogAlasan'
import { IsianSatuanFields, keDataSatuan, nilaiSatuanDari, type NilaiSatuan } from './IsianSatuanFields'

export function SeksiSatuan({ bahan, bolehData }: { bahan: BahanBakuWithHarga; bolehData: boolean }) {
  const { simpanBahan } = useMutasiMasterBahan()
  const awal = useMemo(() => nilaiSatuanDari(bahan), [bahan])
  const [nilai, setNilai] = useState<NilaiSatuan>(awal)
  const [satuanPo, setSatuanPo] = useState(bahan.satuan_po ?? '')
  const [satuanDist, setSatuanDist] = useState(bahan.satuan_distribusi ?? '')
  const [minta, setMinta] = useState(false)
  const [galat, setGalat] = useState<GalatRpc | null>(null)
  const pilihan = pilihanSatuanBeli(bahan).map((p) => p.label)
  // Label 'kg' tambahan (aturan kg→gram) hanya sah untuk DISTRIBUSI; trigger Tahap 1
  // menolaknya sebagai satuan PO kecuali Kg memang salah satu tingkat.
  const pilihanPo = pilihan.filter(
    (l) => l.toLowerCase() !== 'kg' || [bahan.satuan, bahan.satuan_tengah, bahan.satuan_kecil].some((t) => t?.toLowerCase() === 'kg'),
  )

  // Kunci satuan hanya dikirim bila isiannya berubah: menghitung ulang isi per tengah
  // dari faktor master bisa berbeda pecahan dan membuat RPC mengira satuan diubah.
  const satuanBerubah = (Object.keys(awal) as (keyof NilaiSatuan)[]).some((k) => nilai[k].trim() !== awal[k].trim())
  const ubahan: DataBahan = satuanBerubah ? { ...keDataSatuan(nilai) } : {}
  if ((satuanPo || null) !== (bahan.satuan_po ?? null)) ubahan.satuan_po = satuanPo || null
  if ((satuanDist || null) !== (bahan.satuan_distribusi ?? null)) ubahan.satuan_distribusi = satuanDist || null
  const adaUbahan = Object.keys(ubahan).length > 0

  async function simpan({ alasan }: { alasan: string; paksa: boolean }) {
    setGalat(null)
    try {
      await simpanBahan.mutateAsync({ id: bahan.id, data: ubahan, alasan: alasan || null })
      toast.success('Satuan disimpan')
      setMinta(false)
    } catch (e) {
      setGalat(bacaGalatRpc(e))
    }
  }

  const kelas = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50'
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-suka-brown">Satuan</h3>
      <IsianSatuanFields nilai={nilai} onUbah={setNilai} nonaktif={!bolehData} />
      <p className="text-xs text-amber-700">
        Bahan yang sudah punya riwayat stok belum bisa berganti isi satuan dari sini (fitur Ganti Satuan menyusul); sistem akan menolak.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-gray-600">Satuan PO
          <select value={satuanPo} onChange={(e) => setSatuanPo(e.target.value)} disabled={!bolehData} className={kelas}>
            <option value="">—</option>
            {pilihanPo.map((l) => <option key={l} value={l}>{l}</option>)}
            {satuanPo && !pilihanPo.includes(satuanPo) && <option value={satuanPo}>{satuanPo} (lama)</option>}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-600">Satuan distribusi
          <select value={satuanDist} onChange={(e) => setSatuanDist(e.target.value)} disabled={!bolehData} className={kelas}>
            <option value="">—</option>
            {pilihan.map((l) => <option key={l} value={l}>{l}</option>)}
            {satuanDist && !pilihan.includes(satuanDist) && <option value={satuanDist}>{satuanDist} (lama)</option>}
          </select>
        </label>
      </div>
      {bolehData && (
        <button onClick={() => setMinta(true)} disabled={!adaUbahan}
          className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Simpan satuan</button>
      )}
      {minta && (
        <DialogAlasan judul="Simpan perubahan satuan" wajib={false} galat={galat} memproses={simpanBahan.isPending}
          onBatal={() => { setMinta(false); setGalat(null) }} onKirim={simpan} />
      )}
    </section>
  )
}
```

```tsx
// apps/admin-dashboard/src/components/master-bahan/SeksiFotoSku.tsx
'use client'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { BahanBakuWithHarga } from '@/lib/bahanBaku'
import { useMutasiMasterBahan, type LevelFoto } from '@/hooks/masterBahan/useMutasiMasterBahan'
import { bacaGalatRpc } from '@/lib/masterBahan/galatRpc'
import { rupiah } from '@/lib/format'

const FOTO: { level: LevelFoto; label: string; kolom: 'image_url' | 'image_url_tengah' | 'image_url_kecil' }[] = [
  { level: 'besar', label: 'Besar', kolom: 'image_url' },
  { level: 'tengah', label: 'Tengah', kolom: 'image_url_tengah' },
  { level: 'kecil', label: 'Kecil', kolom: 'image_url_kecil' },
]

export function SeksiFotoSku({ bahan, bolehData }: { bahan: BahanBakuWithHarga; bolehData: boolean }) {
  const mut = useMutasiMasterBahan()
  const inputRef = useRef<HTMLInputElement>(null)
  const [levelAktif, setLevelAktif] = useState<LevelFoto>('besar')
  const [kemasan, setKemasan] = useState('')
  const [isi, setIsi] = useState('')
  const [hargaSku, setHargaSku] = useState('')

  async function beritahu(p: Promise<unknown>, sukses: string): Promise<boolean> {
    try {
      await p
      toast.success(sukses)
      return true
    } catch (e) {
      toast.error(bacaGalatRpc(e).pesan)
      return false
    }
  }

  function pilihFoto(level: LevelFoto) {
    setLevelAktif(level)
    inputRef.current?.click()
  }

  function unggah(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void beritahu(mut.unggahFoto.mutateAsync({ bahanId: bahan.id, file, level: levelAktif }), 'Foto diunggah')
    e.target.value = ''
  }

  async function tambahSku() {
    const qty = Number(isi.replace(',', '.'))
    const h = Number(hargaSku.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    const ok = await beritahu(
      mut.simpanSku.mutateAsync({ id: null, bahanId: bahan.id, data: { nama_kemasan: kemasan.trim(), qty_isi: qty, harga_beli: h } }),
      'SKU ditambahkan',
    )
    if (ok) { setKemasan(''); setIsi(''); setHargaSku('') }
  }

  const kelas = 'rounded-xl border border-gray-200 px-3 py-2 text-sm'
  const skus = bahan.skus ?? []
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold text-suka-brown">Foto & kemasan (SKU)</h3>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={unggah} />
      <div className="grid grid-cols-3 gap-3">
        {FOTO.map((f) => (
          <div key={f.level} className="space-y-1 text-center">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-50">
              {bahan[f.kolom]
                ? <img src={bahan[f.kolom] as string} alt={`Foto ${f.label.toLowerCase()} ${bahan.nama}`} className="h-full w-full object-cover" />
                : <span className="text-xs text-gray-400">Belum ada</span>}
            </div>
            {bolehData && (
              <button onClick={() => pilihFoto(f.level)} disabled={mut.unggahFoto.isPending} className="text-xs font-bold text-suka-orange hover:underline">
                Ganti foto {f.label.toLowerCase()}
              </button>
            )}
          </div>
        ))}
      </div>
      <ul className="divide-y rounded-xl border">
        {skus.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              {s.nama_kemasan} · isi {Number(s.qty_isi).toLocaleString('id-ID')} · {rupiah(Number(s.harga_beli ?? 0))}
              {s.is_default && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">default</span>}
            </span>
            {bolehData && (
              <span className="flex gap-3">
                {!s.is_default && (
                  <button onClick={() => void beritahu(mut.setDefaultSku.mutateAsync(s.id), 'SKU default diubah')} className="text-xs font-bold text-suka-orange">Jadikan default</button>
                )}
                <button onClick={() => void beritahu(mut.hapusSku.mutateAsync(s.id), 'SKU dihapus')} className="text-xs font-bold text-red-600">Hapus</button>
              </span>
            )}
          </li>
        ))}
        {skus.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Belum ada SKU.</li>}
      </ul>
      {bolehData && (
        <div className="flex flex-wrap gap-2">
          <input value={kemasan} onChange={(e) => setKemasan(e.target.value)} placeholder="Nama kemasan" className={kelas} />
          <input value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Isi" className={`${kelas} w-24`} inputMode="decimal" />
          <input value={hargaSku} onChange={(e) => setHargaSku(e.target.value)} placeholder="Harga" className={`${kelas} w-32`} inputMode="decimal" />
          <button onClick={() => void tambahSku()} disabled={kemasan.trim() === '' || !(Number(isi.replace(',', '.')) > 0) || mut.simpanSku.isPending}
            className="rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Tambah SKU</button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Hapus komponen lama**

```bash
git rm apps/admin-dashboard/src/components/BahanBakuTable.tsx apps/admin-dashboard/src/components/BahanBakuDetailModal.tsx apps/admin-dashboard/src/components/BahanBakuAddModal.tsx apps/admin-dashboard/src/hooks/useBahanBakuHarga.ts apps/admin-dashboard/src/hooks/useBahanBakuHargaMutations.ts apps/admin-dashboard/src/app/actions/bahanBakuActions.ts
```
Pastikan tak ada importir tersisa:
`grep -rn "BahanBakuTable\|BahanBakuDetailModal\|BahanBakuAddModal\|useBahanBakuHarga\|bahanBakuActions" apps/admin-dashboard/src` → kosong. Bila ada importir lain di luar halaman bahan-baku, BERHENTI dan lapor (jangan hapus berkas yang masih dipakai).

- [ ] **Step 7: Type-check + build**

Type-check (≤ baseline, nol galat di `components/master-bahan/**`), lalu `cd apps/admin-dashboard && ../../node_modules/.bin/next build --webpack` → sukses, rute `/dashboard/bahan-baku` ada di keluaran.

- [ ] **Step 8: Commit**

```bash
git add -A apps/admin-dashboard/src/components/master-bahan apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx
git commit -m "feat(admin): halaman Master Bahan Baku bertab + tab Data Bahan lewat RPC; buang modal & mutasi lama"
```

---

### Task 6: Tab Harga, Tab Vendor, Tab Riwayat

**Files:**
- Modify (ganti stub): `apps/admin-dashboard/src/components/master-bahan/TabHarga.tsx`, `TabVendor.tsx`, `TabRiwayat.tsx`
- Modify: `apps/admin-dashboard/src/components/katalog-vendor/KatalogVendorBoard.tsx` (alasan & paksa lewat `DialogAlasan`)
- Possibly modify: `apps/admin-dashboard/src/components/katalog-vendor/BarisVendor.tsx` (tangkap penolakan promise — lihat Step 3)

**Interfaces:**
- Consumes: `useStatusHarga`, `useDaftarBahan`, `useRiwayatMasterBahan`, `useSuppliers`, `FormHargaVendor`, `DialogAlasan`, `ringkasRiwayat`, `bolehUbahHarga`, `useMutasiMasterBahan`.

- [ ] **Step 1: TabHarga**

```tsx
// apps/admin-dashboard/src/components/master-bahan/TabHarga.tsx
'use client'
import { useMemo, useState } from 'react'
import { Spinner } from '@suka/design-system'
import { useRole } from '@/components/layout/RoleContext'
import { useStatusHarga } from '@/hooks/masterBahan/useStatusHarga'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { bolehUbahHarga } from '@/lib/masterBahan/akses'
import { rupiah } from '@/lib/format'
import { FormHargaVendor } from './FormHargaVendor'

export function TabHarga() {
  const { role } = useRole()
  const bolehHarga = bolehUbahHarga(role)
  const { data: status = [], isLoading, error } = useStatusHarga()
  const { data: bahan = [] } = useDaftarBahan()
  const belum = status.filter((s) => s.status === 'belum_dikonfirmasi').length
  const [hanyaBelum, setHanyaBelum] = useState(true)
  const [cari, setCari] = useState('')
  const [isiId, setIsiId] = useState<string | null>(null)

  const tampil = useMemo(() => {
    const k = cari.trim().toLowerCase()
    return status.filter((s) => (!hanyaBelum || s.status === 'belum_dikonfirmasi') && (!k || s.nama.toLowerCase().includes(k)))
  }, [status, hanyaBelum, cari])
  const target = bahan.find((b) => b.id === isiId) ?? null

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error) return <p className="p-6 text-sm text-red-600">Gagal memuat status harga: {String((error as Error).message ?? error)}</p>

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-bold">{belum} bahan belum punya harga vendor terpercaya.</p>
        <p className="text-xs">Harga master mereka dibekukan di nilai terakhir sampai harga vendor diisi di sini atau lewat PO/nota.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari bahan…" className="min-w-[200px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={hanyaBelum} onChange={(e) => setHanyaBelum(e.target.checked)} /> Hanya yang belum dikonfirmasi
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2">Bahan</th><th className="text-right">Harga master</th><th>Asal harga</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {tampil.map((s) => (
              <tr key={s.bahan_baku_id} className="border-b last:border-0">
                <td className="py-2 font-semibold text-suka-brown">{s.nama}</td>
                <td className="text-right">{s.harga_master ? rupiah(s.harga_master) : '—'}</td>
                <td className="max-w-xs text-xs text-gray-600">
                  {s.asal_catatan ?? '—'}
                  {s.asal_waktu && <span className="block text-gray-400">{new Date(s.asal_waktu).toLocaleString('id-ID')}</span>}
                </td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.status === 'terkonfirmasi' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {s.status === 'terkonfirmasi' ? 'terkonfirmasi' : 'belum dikonfirmasi'}
                  </span>
                </td>
                <td className="text-right">
                  {bolehHarga && (
                    <button onClick={() => setIsiId(s.bahan_baku_id)} className="text-sm font-bold text-suka-orange hover:underline">Isi harga vendor</button>
                  )}
                </td>
              </tr>
            ))}
            {tampil.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Tidak ada bahan.</td></tr>}
          </tbody>
        </table>
      </div>
      {target && <FormHargaVendor bahan={target} onBatal={() => setIsiId(null)} onSelesai={() => setIsiId(null)} />}
    </div>
  )
}
```

- [ ] **Step 2: TabVendor**

```tsx
// apps/admin-dashboard/src/components/master-bahan/TabVendor.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { bolehUbahHarga } from '@/lib/masterBahan/akses'
import { KatalogVendorBoard } from '@/components/katalog-vendor/KatalogVendorBoard'
import { FormHargaVendor } from './FormHargaVendor'

export function TabVendor() {
  const { role } = useRole()
  const bolehHarga = bolehUbahHarga(role)
  const { data: bahan = [] } = useDaftarBahan()
  const aktif = bahan.filter((b) => b.is_active)
  const [pilihBahan, setPilihBahan] = useState('')
  const [buka, setBuka] = useState(false)
  const target = aktif.find((b) => b.id === pilihBahan) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {bolehHarga ? (
          <div className="flex flex-wrap items-center gap-2">
            <select value={pilihBahan} onChange={(e) => setPilihBahan(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">— pilih bahan —</option>
              {aktif.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
            <button onClick={() => setBuka(true)} disabled={!target}
              className="flex items-center gap-2 rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              <Plus size={16} /> Tambah harga vendor
            </button>
          </div>
        ) : <span className="text-sm text-gray-500">Hanya admin, owner, dan purchasing yang bisa mengubah harga vendor.</span>}
        <Link href="/dashboard/pembelian/supplier" className="flex items-center gap-2 text-sm font-bold text-suka-orange hover:underline">
          <Truck size={16} /> Kelola daftar supplier
        </Link>
      </div>
      <KatalogVendorBoard />
      {buka && target && <FormHargaVendor bahan={target} onBatal={() => setBuka(false)} onSelesai={() => setBuka(false)} />}
    </div>
  )
}
```
Periksa `KatalogVendorBoard` diekspor bernama atau default (`grep -n "export" apps/admin-dashboard/src/components/katalog-vendor/KatalogVendorBoard.tsx`) dan apakah ia menerima props wajib; sesuaikan import/pemakaian. Bila board merender judul halamannya sendiri, biarkan (tidak perlu disentuh).

- [ ] **Step 3: KatalogVendorBoard — alasan & paksa**

Di `KatalogVendorBoard.tsx`, tambah import `import { DialogAlasan } from '@/components/master-bahan/DialogAlasan'` dan ubah import galat jadi `import { bacaGalatRpc, type GalatRpc } from '@/lib/masterBahan/galatRpc'` (+ `useState` bila belum). Ganti fungsi `simpan` dari Task 3 dengan versi yang menunda sampai alasan diisi:
```tsx
  type InputSimpan = { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }
  const [tertunda, setTertunda] = useState<{ input: InputSimpan; selesai: (ok: boolean) => void } | null>(null)
  const [galatDialog, setGalatDialog] = useState<GalatRpc | null>(null)

  function simpan(input: InputSimpan): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      setGalatDialog(null)
      setTertunda({ input, selesai: (ok) => (ok ? resolve() : reject(new Error('Dibatalkan'))) })
    })
  }

  async function kirim({ alasan, paksa }: { alasan: string; paksa: boolean }) {
    if (!tertunda) return
    const baris = rows.find((r) => r.id === tertunda.input.id)
    if (!baris) { setGalatDialog({ pesan: 'Baris katalog tidak ditemukan', kode: null, bisaDipaksa: false }); return }
    try {
      await simpanHargaVendor.mutateAsync({
        bahanId: baris.bahan_baku_id, supplierId: baris.supplier_id, harga: tertunda.input.harga,
        satuanBeli: tertunda.input.satuan_beli.trim(), isi: tertunda.input.isi_satuan_kecil, alasan, paksa,
      })
      toast.success('Harga vendor tersimpan')
      tertunda.selesai(true)
      setTertunda(null)
    } catch (e) {
      setGalatDialog(bacaGalatRpc(e))
    }
  }
```
Render tepat sebelum penutup elemen terluar komponen:
```tsx
      {tertunda && (
        <DialogAlasan judul="Simpan harga vendor" wajib galat={galatDialog} memproses={simpanHargaVendor.isPending}
          onBatal={() => { tertunda.selesai(false); setTertunda(null) }} onKirim={kirim} />
      )}
```
Lalu baca `BarisVendor.tsx`: bila pemanggilan `onSimpan(...)` tidak dibungkus `try/catch`, promise yang ditolak saat Batal jadi unhandled rejection. Bungkus pemanggilannya: `try { await onSimpan(...) } catch { /* dibatalkan, atau galat sudah tampil di dialog */ }` — pertahankan logika lain di baris itu apa adanya (mis. keluar mode edit hanya setelah sukses).

- [ ] **Step 4: TabRiwayat**

```tsx
// apps/admin-dashboard/src/components/master-bahan/TabRiwayat.tsx
'use client'
import { useMemo, useState } from 'react'
import { Spinner } from '@suka/design-system'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { useRiwayatMasterBahan, type FilterRiwayat } from '@/hooks/masterBahan/useRiwayatMasterBahan'
import { useSuppliers } from '@/hooks/usePurchaseOrder'
import { ringkasRiwayat } from '@/lib/masterBahan/riwayat'

const JENIS: { id: FilterRiwayat['jenis']; label: string }[] = [
  { id: 'semua', label: 'Semua' }, { id: 'data', label: 'Data' },
  { id: 'harga_master', label: 'Harga master' }, { id: 'harga_vendor', label: 'Harga vendor' },
]

export function TabRiwayat() {
  const { data: bahan = [] } = useDaftarBahan()
  const { data: suppliers = [] } = useSuppliers()
  const [bahanId, setBahanId] = useState<string | null>(null)
  const [jenis, setJenis] = useState<FilterRiwayat['jenis']>('semua')
  const { rows, namaPelaku, loading, error } = useRiwayatMasterBahan({ bahanId, jenis })
  const namaBahan = useMemo(() => new Map(bahan.map((b) => [b.id, b.nama])), [bahan])
  const namaSupplier = useMemo(() => new Map(suppliers.map((s) => [s.id, s.nama])), [suppliers])

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <select value={bahanId ?? ''} onChange={(e) => setBahanId(e.target.value || null)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="">Semua bahan</option>
          {bahan.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
        </select>
        {JENIS.map((j) => (
          <button key={j.id} onClick={() => setJenis(j.id)}
            className={`rounded-full px-3 py-1 text-sm ${jenis === j.id ? 'bg-suka-orange text-white' : 'bg-gray-100 text-gray-600'}`}>{j.label}</button>
        ))}
      </div>
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error != null && <p className="text-sm text-red-600">Gagal memuat riwayat: {String((error as Error).message ?? error)}</p>}
      <ol className="divide-y">
        {rows.map((r, i) => (
          <li key={`${r.changed_at}-${i}`} className="py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500">
              <span className="font-bold text-suka-brown">
                {r.bahan_baku_id ? namaBahan.get(r.bahan_baku_id) ?? '(bahan terhapus)' : '—'}
                {r.supplier_id ? ` · ${namaSupplier.get(r.supplier_id) ?? 'vendor'}` : ''}
              </span>
              <span>
                {new Date(r.changed_at).toLocaleString('id-ID')} · {r.changed_by ? namaPelaku.get(r.changed_by) ?? 'pengguna' : 'sistem'}
              </span>
            </div>
            <ul className="mt-1 list-disc pl-5 text-gray-700">
              {ringkasRiwayat(r).map((t, j) => <li key={j}>{t}</li>)}
            </ul>
            {r.alasan && <p className="mt-1 text-xs italic text-gray-500">Alasan: {r.alasan}</p>}
          </li>
        ))}
        {!loading && rows.length === 0 && <li className="py-8 text-center text-gray-500">Belum ada riwayat.</li>}
      </ol>
      {rows.length === 200 && <p className="text-xs text-gray-500">Menampilkan 200 perubahan terbaru. Saring per bahan untuk melihat lebih jauh.</p>}
    </div>
  )
}
```

- [ ] **Step 5: Type-check + build (seperti Task 5 Step 7)**

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/master-bahan apps/admin-dashboard/src/components/katalog-vendor
git commit -m "feat(admin): tab Harga (daftar kerja), Vendor (katalog + harga vendor), Riwayat master bahan"
```

---

### Task 7: Navigasi, akses PURCHASING, redirect, bersih kode mati

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` (grup "Laporan Internal" ~L62–90, entri `/dashboard/bahan-baku` ~L113, grup "Pembelian" ~L119–131)
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.test.ts` (`BASELINE_ROUTES`)
- Modify: `apps/admin-dashboard/src/components/layout/RoleContext.tsx` (~L97)
- Modify: `apps/admin-dashboard/src/app/dashboard/pembelian/katalog-vendor/page.tsx`
- Delete: `apps/admin-dashboard/src/hooks/useOutletThresholds.ts`, `apps/admin-dashboard/src/app/dashboard/kitchen/threshold/` (seluruh folder)

- [ ] **Step 1: Ubah uji nav dulu (harus gagal)**

Di `navConfig.test.ts` `BASELINE_ROUTES`:
- `ADMIN`: hapus `'/dashboard/pembelian/katalog-vendor'`.
- `OWNER`: tambah `'/dashboard/bahan-baku'` (ikuti urutan daftar yang ada).
- `PURCHASING`: hapus `'/dashboard/pembelian/katalog-vendor'`, tambah `'/dashboard/bahan-baku'`.
`EXPECTED_GROUP_COUNT` tidak berubah (tidak ada grup baru).

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/components/layout/navConfig.test.ts` → GAGAL pada tiga role itu.

- [ ] **Step 2: Ubah navConfig**

- Grup "Laporan Internal": tambahkan sebagai entri terakhir grup (sebelum `]`):
  ```ts
      { href: '/dashboard/bahan-baku', label: 'Master Bahan Baku', shortLabel: 'Bahan Baku', icon: Tags, roles: ['OWNER'] },
  ```
- Grup "Pembelian": ganti entri `'/dashboard/pembelian/katalog-vendor'` dengan:
  ```ts
      { href: '/dashboard/bahan-baku', label: 'Master Bahan Baku', shortLabel: 'Bahan Baku', icon: Tags, roles: ['PURCHASING'] },
  ```
- Entri `'/dashboard/bahan-baku'` di grup "Produk & Stok" (`roles: ['ADMIN']`) tetap; ubah label-nya jadi `'Master Bahan Baku'` bila masih berlabel lain.
Pastikan `Tags` sudah diimpor. Salin bentuk properti (mis. ada/tidaknya `shortLabel`) dari entri tetangga — jangan menambah properti yang tidak dikenal tipe `NavItem`.

- [ ] **Step 3: RoleContext — PURCHASING boleh membuka halaman master**

Baris allowlist PURCHASING menjadi:
```ts
    const allowed = ['/dashboard/pembelian', '/dashboard/reports/pembelian', '/dashboard/bahan-baku']
```

- [ ] **Step 4: Redirect halaman katalog lama**

```tsx
// apps/admin-dashboard/src/app/dashboard/pembelian/katalog-vendor/page.tsx
import { redirect } from 'next/navigation'

// Katalog vendor kini tab "Vendor" di Master Bahan Baku (spec 2026-09-23 K2).
export default function Page() {
  redirect('/dashboard/bahan-baku?tab=vendor')
}
```
Uji nav "setiap href punya page.tsx" tetap lolos karena berkas ini tetap ada.

- [ ] **Step 5: Hapus kode mati (K8)**

```bash
git rm apps/admin-dashboard/src/hooks/useOutletThresholds.ts
git rm -r apps/admin-dashboard/src/app/dashboard/kitchen/threshold
```
`grep -rn "useOutletThresholds\|kitchen/threshold\|ThresholdTable" apps/admin-dashboard/src` → kosong. Bila `grep -rn "usePOPriceAlerts" apps/admin-dashboard/src` kini hanya menyisakan definisi hook-nya sendiri, hapus juga berkas hook itu (banner peringatan harga PO lama sudah tidak dipakai; peringatan harga kini ditangani penjaga di `verifikasi_terima_po`).

- [ ] **Step 6: Uji nav LULUS, type-check, build**

- [ ] **Step 7: Commit**

```bash
git add -A apps/admin-dashboard/src
git commit -m "feat(admin): menu Master Bahan Baku untuk OWNER & PURCHASING; katalog vendor jadi tab; buang kode mati threshold"
```

---

### Task 8: Stok hanya-baca & halaman supplier finance dicabut

**Files (stok):**
- Modify: `apps/stok/src/components/harga-bahan/HargaBahanBoard.tsx`
- Modify: `apps/stok/src/hooks/useFluktuasiHarga.ts`
- Modify: `apps/stok/src/app/actions/hargaBahan.ts` (hapus `syncMasterPriceAction` dan pembantunya yang jadi tak terpakai)
- Delete: `apps/stok/src/components/harga-bahan/HargaBahanAddModal.tsx`, `SyncMasterModal.tsx`, `BatchActionBar.tsx`, `apps/stok/src/hooks/useBahanBakuMutations.ts`, `apps/stok/src/app/actions/bahanBakuActions.ts`, `apps/stok/src/lib/stok/satuanBahan.ts`, `apps/stok/src/lib/stok/satuanBahan.test.ts`

**Files (finance):**
- Modify: `apps/finance/src/components/CashLayout.tsx` (entri nav `/pembelian/supplier`)
- Modify: `apps/finance/src/hooks/usePurchaseOrder.ts` (hapus `useCreateSupplier`, `useUpdateSupplier`, `useDeleteSupplier`)
- Modify: `apps/finance/src/app/pembelian/supplier/page.tsx` (ganti seluruhnya)

- [ ] **Step 1: Catat baseline stok & finance**

Untuk `apps/stok` dan `apps/finance`: jumlah `error TS` dari type-check dan jumlah uji gagal dari `vitest run`, SEBELUM perubahan. Catat di laporan.

- [ ] **Step 2: Stok — HargaBahanBoard jadi hanya-baca**

Hapus dari `HargaBahanBoard.tsx`: import `useBahanBakuMutations`, `HargaBahanAddModal`, dan import yang jadi tak terpakai (`Plus`, `useAuth`, `toast`, …); state modal tambah; variabel role/`canAddBahanBaku`; `addBahanBaku`; blok tombol tambah; blok `<HargaBahanAddModal … />`. Ganti teks deskripsi header menjadi:
```tsx
              Pantau pergerakan harga beli bahan baku. Data master diubah di Admin Dashboard › Master Bahan Baku.
```
Bila board juga memakai `SyncMasterModal`/`BatchActionBar` (pilih-baris lalu sinkron), hapus pemakaian itu beserta state pilihannya.

- [ ] **Step 3: Stok — cabut jalur sinkron harga**

`useFluktuasiHarga.ts` menjadi:
```ts
import { useQuery } from '@tanstack/react-query'
import { getFluktuasiHargaAction, type FluktuasiHargaItem } from '@/app/actions/hargaBahan'

export type { FluktuasiHargaItem }

export function useFluktuasiHarga(daysFilter: number | null = 30) {
  const query = useQuery<FluktuasiHargaItem[]>({
    queryKey: ['fluktuasi-harga-bahan-baku', daysFilter],
    staleTime: 30_000,
    queryFn: async () => await getFluktuasiHargaAction(daysFilter),
  })
  return { ...query, items: query.data ?? [] }
}
```
Sebelum menimpa, bandingkan dengan isi lama: pertahankan `queryKey`, `staleTime`, tipe ekspor, dan bentuk nilai balik yang dipakai pemanggil (`grep -rn "useFluktuasiHarga" apps/stok/src`); yang dibuang hanya bagian mutasi sinkron. Di `hargaBahan.ts` hapus `syncMasterPriceAction` dan tipe/pembantu yang hanya dipakai olehnya; `getFluktuasiHargaAction` + pembantu baca tetap. Lalu:
```bash
git rm apps/stok/src/components/harga-bahan/HargaBahanAddModal.tsx apps/stok/src/components/harga-bahan/SyncMasterModal.tsx apps/stok/src/components/harga-bahan/BatchActionBar.tsx apps/stok/src/hooks/useBahanBakuMutations.ts apps/stok/src/app/actions/bahanBakuActions.ts apps/stok/src/lib/stok/satuanBahan.ts apps/stok/src/lib/stok/satuanBahan.test.ts
```
`grep -rn "syncMasterPrice\|bahanBakuActions\|useBahanBakuMutations\|HargaBahanAddModal\|SyncMasterModal\|BatchActionBar\|stok/satuanBahan" apps/stok/src` → kosong. Bila ada importir lain yang tak disebut plan, BERHENTI dan lapor.

- [ ] **Step 4: Finance — halaman supplier dicabut (K3)**

`apps/finance/src/app/pembelian/supplier/page.tsx` menjadi:
```tsx
export default function Page() {
  return (
    <div className="mx-auto max-w-xl space-y-3 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
      <h1 className="text-lg font-extrabold text-suka-brown">Database Supplier dipindahkan</h1>
      <p>
        Data supplier dan harga vendor kini dikelola di satu tempat di Admin Dashboard: menu Master Bahan Baku
        (tab Vendor) dan halaman Supplier di grup Pembelian.
      </p>
      <p className="text-gray-500">Hubungi admin atau purchasing untuk perubahan data supplier.</p>
    </div>
  )
}
```
Bila kelas `text-suka-brown` tidak tersedia di tema finance (cek `grep -rn "suka-brown" apps/finance/src | head -3`), pakai kelas judul yang dipakai halaman finance lain.

Hapus entri nav `{ href: '/pembelian/supplier', label: 'Database Supplier', icon: Truck }` di `CashLayout.tsx` (hapus juga import `Truck` bila tak dipakai lagi). Hapus `useCreateSupplier`, `useUpdateSupplier`, `useDeleteSupplier` dari `apps/finance/src/hooks/usePurchaseOrder.ts`; `grep -rn "useCreateSupplier\|useUpdateSupplier\|useDeleteSupplier" apps/finance/src` → kosong.

- [ ] **Step 5: Type-check + test + build stok & finance**

Untuk `apps/stok` dan `apps/finance`: type-check (≤ baseline Step 1), `vitest run` (gagal ≤ baseline; `satuanBahan.test.ts` yang dihapus mengurangi jumlah uji, itu diharapkan), `next build --webpack` sukses.

- [ ] **Step 6: Commit**

```bash
git add -A apps/stok/src apps/finance/src
git commit -m "feat(stok,finance): harga bahan stok hanya-baca; database supplier finance dipindah ke admin"
```

---

### Task 9: Cabut tulis langsung (migration ditulis, di-apply SETELAH deploy), penyisiran, dokumentasi

**Files:**
- Create: `supabase/migrations/20260924200000_cabut_tulis_langsung_master_bahan.sql`
- Create: `supabase/verifikasi/master_bahan/t10_cabut_tulis_langsung.sql`
- Modify: `CLAUDE.md` (entri sesi, sebelum baris `**Last updated:**`), `docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md` (baris Status)

- [ ] **Step 1: Sisir tulis langsung yang tersisa di semua app**

```bash
grep -rnE "from\(['\"](bahan_baku|bahan_baku_sku|bahan_baku_harga|bahan_baku_supplier|supplier)['\"]\)" apps --include=*.ts --include=*.tsx -A4 | grep -E "\.(insert|update|upsert|delete)\(" | grep -v node_modules | grep -v "/.claude/worktrees/"
```
Harapan: **kosong**. Skrip `.mjs/.cjs/.js` one-off yang memakai service key tidak terdampak (service_role tak dicabut) — cukup dicatat. Bila ada sisa di kode app (`.ts/.tsx`), BERHENTI dan lapor daftarnya.

- [ ] **Step 2: Sisir fungsi DB INVOKER yang menulis tabel master**

```sql
SELECT p.proname, p.prosecdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND NOT p.prosecdef
   AND p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?(bahan_baku|bahan_baku_sku|bahan_baku_harga|bahan_baku_supplier|supplier)\b';
```
Untuk tiap baris: baca badannya. Trigger BEFORE yang hanya memodifikasi `NEW` pada tabel yang sama aman (tidak menulis tabel lain). Fungsi INVOKER yang MENULIS tabel master lain dan bisa terpicu dari sesi `authenticated` (trigger di tabel yang ditulis pengguna, atau RPC ber-EXECUTE authenticated) akan patah setelah pencabutan — bila ada, BERHENTI dan lapor daftarnya (fungsi itu harus dijadikan `SECURITY DEFINER SET search_path = public` di migration terpisah sebelum pencabutan).

- [ ] **Step 3: Tulis uji (akan GAGAL sampai migration di-apply)**

```sql
-- supabase/verifikasi/master_bahan/t10_cabut_tulis_langsung.sql — harapan (SETELAH apply): tanpa error
BEGIN;
DO $$
DECLARE v_admin uuid; v_b uuid; v_ok boolean; t text;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role='admin' AND status='active' LIMIT 1;
  SELECT id INTO v_b FROM bahan_baku WHERE nama='SAPI';
  IF v_admin IS NULL OR v_b IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture'; END IF;
  FOREACH t IN ARRAY ARRAY['bahan_baku','bahan_baku_sku','bahan_baku_harga','bahan_baku_supplier','supplier'] LOOP
    IF has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE')
       OR has_table_privilege('anon', 'public.' || t, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || t, 'INSERT')
       OR has_table_privilege('anon', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'GAGAL: % masih bisa ditulis langsung', t;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'GAGAL: SELECT % ikut dicabut', t;
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- admin: tulis langsung ditolak …
  v_ok := false;
  BEGIN
    UPDATE bahan_baku SET merek = merek WHERE id = v_b;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'GAGAL: admin masih bisa UPDATE bahan_baku langsung'; END IF;
  -- … tetapi RPC tetap jalan (merek diisi nilai yang sama → tidak mengubah data)
  PERFORM public.simpan_bahan_baku(v_b, jsonb_build_object('merek', (SELECT merek FROM bahan_baku WHERE id = v_b)), 'uji t10');
  RAISE NOTICE 'HASIL T10: LULUS';
END $$;
ROLLBACK;
```
Jalankan sekarang → harus GAGAL `masih bisa ditulis langsung` (bukti uji bisa gagal). Catat pesan galatnya di laporan.

- [ ] **Step 4: Tulis migration (JANGAN di-apply di task ini)**

```sql
-- supabase/migrations/20260924200000_cabut_tulis_langsung_master_bahan.sql
--
-- Spec 2026-09-23 K10.2: setelah semua layar memakai RPC (Tahap 2), cabut hak tulis
-- langsung ke tabel master. Penulis sah yang tersisa: fungsi SECURITY DEFINER (RPC
-- master, verifikasi_terima_po, katalog_tulis_dari_po, sahkan_nota_vendor, trigger
-- turunan harga) dan service_role — keduanya tak terpengaruh.
--
-- ⚠️ URUTAN WAJIB: apply HANYA setelah admin-dashboard, stok, dan finance versi Tahap 2
-- ter-deploy dan diperiksa. Diterapkan lebih awal = layar lama yang masih live gagal
-- menyimpan (permission denied).
--
-- SELECT tidak disentuh (katalog pelanggan & layar baca tetap jalan).
-- Policy tulis lama dibiarkan: tanpa grant, policy tak berarti; mencabutnya terpisah
-- tidak menambah keamanan.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.bahan_baku,
  public.bahan_baku_sku,
  public.bahan_baku_harga,
  public.bahan_baku_supplier,
  public.supplier
FROM anon, authenticated;
```

- [ ] **Step 5: Dokumentasi**

Spec: baris Status menjadi
`**Status:** Disetujui owner (sesi grilling 2026-09-23). Tahap 0 LIVE (8729fbe2). Tahap 1 (fondasi DB) LIVE. Tahap 2 (halaman satu tempat) selesai di kode — lihat plan 2026-09-24-master-bahan-baku-tahap2-halaman-satu-tempat.md; migration cabut tulis langsung (20260924200000) menunggu deploy.`

CLAUDE.md: tambahkan entri `## Session 2026-09-24: Master Bahan Baku — Tahap 2 (Halaman Satu Tempat)` sebelum baris `**Last updated:**` (dan perbarui tanggal baris itu), gaya ringkas seperti entri lain, memuat:
- Halaman bertab `/dashboard/bahan-baku` (Data Bahan · Harga · Vendor · Riwayat), menu OWNER/ADMIN/PURCHASING, allowlist PURCHASING; katalog vendor lama → redirect ke tab Vendor.
- Jalur tulis lama yang dicabut: modal detail/tambah & mutasi tabel langsung admin, server action tambah bahan admin & stok, sinkron harga stok, halaman supplier finance; kode mati threshold dihapus.
- Satu-satunya jalur tulis dari layar = RPC Tahap 1 (lewat `useMutasiMasterBahan`); harga master tidak bisa diketik.
- Migration `20260924100000` (applied); migration `20260924200000` **belum di-apply — urutan: deploy admin-dashboard/stok/finance → smoke test → apply → jalankan t10**.
- ⚠️ Kerja WIP belum di-commit di checkout `main` pada berkas admin/stok bahan baku (peruntukan/is_opname di modal lama) kini tergantikan — owner membuangnya (`git checkout -- <berkas>`) sebelum `git pull`, kalau tidak pull akan konflik.
- Belum: tombol Ganti Satuan, stok membaca `peruntukan`/`is_opname` (Tahap 3).

- [ ] **Step 6: Verifikasi akhir tiga app**

admin-dashboard, stok, finance: type-check (≤ baseline masing-masing), `vitest run` (gagal ≤ baseline; semua uji `src/lib/masterBahan` & `navConfig` lulus), `next build --webpack` sukses.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260924200000_cabut_tulis_langsung_master_bahan.sql supabase/verifikasi/master_bahan/t10_cabut_tulis_langsung.sql CLAUDE.md docs/superpowers/specs/2026-09-23-master-bahan-baku-satu-tempat-design.md
git commit -m "chore(db,docs): migration cabut tulis langsung master bahan (apply setelah deploy) + catatan sesi Tahap 2"
```

---

## Setelah merge (runbook, bukan task subagent)

1. Push `main` → GitHub Actions men-deploy admin-dashboard, stok, finance. Pastikan ketiganya sukses.
2. Smoke test sebagai **ADMIN**: buka `/dashboard/bahan-baku`; tambah bahan uji (dengan harga awal "Beli Tunai"); ubah merek; nonaktifkan; lihat tab Riwayat; tab Harga → isi harga vendor salah satuan (mis. harga per Dus diisi sebagai per Roll) → muncul opsi paksa; hapus bahan uji.
3. Smoke test sebagai **PURCHASING**: menu Master Bahan Baku muncul; tab Data hanya-baca; bisa isi harga vendor.
4. Smoke test sebagai **OWNER**: menu muncul di Laporan Internal.
5. Apply `20260924200000` (verifikasi `has_table_privilege` false untuk tulis), stempel, jalankan `t10` → LULUS, lalu ulang satu simpan di layar untuk memastikan tetap jalan.

## Di luar plan ini (sengaja)

- Tombol **Ganti Satuan** (memakai `app.ganti_satuan`, sisir dokumen berjalan, sesuaikan harga) — Tahap 3.
- App stok membaca `peruntukan`/`is_opname` menggantikan tebakan nama (`opnameScope`) — Tahap 3.
- Halaman Master Supplier admin (1.482 baris) tidak ditulis ulang — hanya jalur tulisnya dipindah ke RPC.
- Cakupan bahan per outlet (GAS 12 KG hanya Kitchen & BNR) — butuh keputusan owner.
- 5 bahan nonaktif ber-`kemasan_qty` basi — keputusan owner.
