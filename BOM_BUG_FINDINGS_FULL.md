# BOM SYSTEM — DOKUMEN PENEMUAN BUG LENGKAP
**Tanggal Investigasi:** 15 Agustus 2026  
**Investigator:** Antigravity AI (Bug Hunter Deep Dive)  
**Tujuan Dokumen:** Panduan eksekusi fix untuk agent lain  
**Project:** Supabase `khpkoreaaucvyqfhynfq` | App: `apps/stok`

---

## RINGKASAN EKSEKUTIF

Sistem BOM (Bill of Materials) yang seharusnya memotong stok bahan baku otomatis setiap ada penjualan **tidak berfungsi dengan benar** untuk sebagian besar menu item. Dari investigasi deep dive ditemukan **4 bug berlapis** yang menyebabkan BOM skip atau salah hitung. Satu bug sudah difix (Bug #1), tiga bug lainnya belum.

| # | Bug | Severity | Status | Baris Dampak |
|---|---|---|---|---|
| 1 | Unit conversion salah di trigger | 🔴 Critical | ✅ FIXED (15 Aug) | Semua outlet gram-scale |
| 2 | Best Seller 2 & Mix Jumbo tidak punya resep | 🔴 Critical | ❌ BELUM DIFIX | ~420 porsi/minggu |
| 3 | Paket/Combo BOM selalu skip | 🔴 Critical | ❌ BELUM DIFIX | Semua transaksi combo |
| 4 | 5 Resep aktif tanpa `menu_item_ref` | 🟡 Medium | ❌ BELUM DIFIX | Stok online tidak terpotong |

---

## BUG #1 — SUDAH FIXED ✅

### Unit Conversion Error di `trg_process_bom_stok`

**Status:** Fixed via migration `20300108000002_fix_bom_trg_use_waterfall.sql` (deployed 15 Aug 2026)

**Was:** `qty = -(qty_per_porsi * quantity / faktor_konversi)` → hasil 0.155 (Kg) untuk outlet yang simpan dalam gram (harusnya 155 gram)

**Now:** Menggunakan `PERFORM process_waterfall_deduction(...)` yang scale-aware

**Verifikasi:** `{"message":"WATERFALL_FOUND"}` ✅

**Tindakan lanjutan diperlukan:** Opname ulang di semua outlet BOM-aktif untuk reset saldo ke fisik aktual (saldo saat ini terlalu besar karena bug ini sudah berlangsung lama).

---

## BUG #2 — BELUM DIFIX ❌

### "Best Seller 2" dan "Best Seller (Mix Jumbo)" Tidak Punya Resep

#### Bukti
```
Simulasi BOM trigger — Order terbaru:
  "Best Seller (Mix Jumbo)" [ITEM] → ❌ NO RESEP → BOM SKIP!
  "Best Seller 2"           [ITEM] → ❌ NO RESEP → BOM SKIP!
  "Best Seller 2 (Sapi Jumbo)" [PAKET] → komponen ada resep tapi...
```

#### Data Menu Items Terlibat

| Nama di Order | menu_item_id | is_package | Status Resep |
|---|---|---|---|
| `Best Seller 2 (Sapi Jumbo)` | `96b31206-68f9-47a8-8c29-413598f679db` | `true` | ❌ Tidak ada resep langsung |
| `Best Seller (Mix Jumbo)` | `c698603b-7f43-415c-986c-b883445e783c` | `false` | ❌ Tidak ada resep |
| `Best Seller 2` | `8657f72e-d1a2-4829-a5cf-33535f7b293c` | `false` | ❌ Tidak ada resep |

#### Komponen Paket `Best Seller 2 (Sapi Jumbo)` — `menu_packages`

| `menu_package.id` | Komponen (`menu_item_id`) | Nama Item | Punya Resep? |
|---|---|---|---|
| _(row 1)_ | `df2d06dc-1326-4139-aa95-5bc66a0a332b` | `Original Sapi Jumbo` | ✅ Resep: "Shawarma Sapi Jumbo" |
| _(row 2)_ | `08a57f8f-f212-4205-a3eb-fb88066ae1b8` | `Ice Tea` | ✅ Resep: "Suka Drink Ice Tea" |
| _(row 2 OR)_ | `c543b78e-3341-44e0-b3ef-53349e71e3d3` | `Orange Juice` | ✅ Resep: "Suka Drink Orange Jus" |

> ⚠️ **Perhatian:** `Best Seller 2 (Sapi Jumbo)` sebenarnya adalah PAKET dengan komponen yang **semua sudah punya resep**. Bug ini mungkin diselesaikan oleh fix Bug #3 (jika paket combo sudah bisa dideduct).

#### Resep yang Harus Dibuat (untuk item yang bukan paket)

Untuk `Best Seller (Mix Jumbo)` (`c698603b`) — item biasa tanpa resep:
- Kemungkinan mengandung: AYAM + SAPI mix, mirip "Original Mix Jumbo"
- **Perlu dikonfirmasi ke tim:** berapa gram AYAM dan SAPI untuk porsi Mix Jumbo?
- Referensi: Resep "Shawarma Mix Jumbo" → `menu_item_ref: 82751882-7f37-4b47-9f85-c2b3fca4f939`

#### Fix yang Direkomendasikan

**Opsi A (untuk Best Seller Mix Jumbo — bukan paket):**
```sql
-- Update menu_item_ref di resep "Shawarma Mix Jumbo" agar menunjuk ke Best Seller (Mix Jumbo)
UPDATE public.resep
SET menu_item_ref = 'c698603b-7f43-415c-986c-b883445e783c'
WHERE nama = 'Shawarma Mix Jumbo'
  AND is_active = true;
```
> ⚠️ **KONFIRMASI DULU:** "Best Seller (Mix Jumbo)" = "Original Mix Jumbo"? Jika ya, fix ini valid.

**Opsi B (jika resepnya berbeda — harus dibuat baru):**
```sql
-- Buat resep baru untuk Best Seller Mix Jumbo
INSERT INTO public.resep (nama, menu_item_ref, scope, is_active)
VALUES ('Best Seller Mix Jumbo', 'c698603b-7f43-415c-986c-b883445e783c', 'global', true);
-- Kemudian tambahkan resep_item sesuai komposisi
```

---

## BUG #3 — BELUM DIFIX ❌ (PALING KRITIKAL)

### Paket/Combo BOM Selalu Skip — Komponen Tidak Terpotong

#### Bukti (dari simulasi BOM trigger)

```
Order #50 (outlet: MITRA CIBUBUR):
  "SHAWARMA DUO COMBO"  [PAKET] → ❌ NO RESEP → BOM SKIP!
    Komponen: "Original Ayam Sedang" → ✅ ada resep
    Komponen: "Original Sapi Sedang" → ✅ ada resep
  
  "TRIPLE COMBO"        [PAKET] → ❌ NO RESEP → BOM SKIP!
    Komponen: "Original Ayam Sedang" → ✅ ada resep
    Komponen: "Original Sapi Sedang" → ✅ ada resep
    Komponen: "Original Mix Besar"   → ✅ ada resep
  
  "SUKA DUO FAVORITE"  [PAKET] → ❌ NO RESEP → BOM SKIP!
    Komponen: "Suka Beef"    → ✅ ada resep
    Komponen: "Suka Chicken" → ✅ ada resep
```

#### Volume Transaksi yang Terlewat (7 hari terakhir)

| Menu Item | Porsi | Transaksi | `menu_item_id` |
|---|---|---|---|
| SHAWARMA DUO COMBO | 269 | 269 | `424ddbec-0a35-48bc-bf93-cd45e6b78c58` |
| SUKA DUO FAVORIT | 54 | 54 | `0b77dc6e-6d5d-4302-89d7-d2535ba56821` |
| SHAWARMA TRIPLE COMBO | 43 | 43 | `0fca2a16-74da-43a7-bd06-455693dce3cb` |
| SUKA TRIPLE FAVORIT | 14 | 14 | `efff8232-dfc9-4f7d-bd58-8d9630f424f8` |
| MIX CHEESE COMBO | 8 | 8 | `e8e71d06-f8e0-48df-898d-22bf652335e9` |
| SHAWARMIE DUO VARIAN | 6 | 6 | `10c415f9-4fe7-42b7-8f5f-7c22c930bc11` |
| MEGABITE COMBO | 2 | 2 | `07a7b8c2-e818-4094-8971-80d25a8be40c` |
| **TOTAL** | **~396 porsi** | | |

#### Root Cause

Buka file migration `trg_process_bom_stok` yang sudah difix:

```sql
-- Di dalam bagian PAKET:
SELECT is_package INTO v_is_package FROM public.menu_items WHERE id = rec.menu_item_id;

IF v_is_package THEN
  FOR p_item IN SELECT id, menu_item_id, or_menu_item_id, quantity
                FROM public.menu_packages WHERE package_id = rec.menu_item_id LOOP
    ...
    SELECT id INTO v_resep_id
    FROM public.resep
    WHERE menu_item_ref = v_selected_item_id::text  -- ← INI YANG DICEK
    ...
```

Masalahnya: `v_selected_item_id` adalah `menu_item_id` dari komponen paket. Tapi dari simulasi, komponen SUDAH punya resep. Kenapa masih skip?

**Hipotesis:** Trigger melewati branch `IF v_is_package THEN` karena lookup `SELECT is_package INTO v_is_package` **gagal** (tidak return nilai) karena `menu_items` tidak punya baris untuk semua ID, atau ada masalah RLS.

> Perlu cek: apakah `menu_items` accessible dari dalam trigger dengan `SECURITY DEFINER`?

#### Fix yang Direkomendasikan

**Langkah 1:** Verifikasi apakah `is_package` bisa dibaca dari dalam trigger:

```sql
-- Jalankan di Supabase SQL Editor:
SELECT id, name, is_package 
FROM menu_items 
WHERE id IN (
  '424ddbec-0a35-48bc-bf93-cd45e6b78c58',  -- SHAWARMA DUO COMBO
  '0b77dc6e-6d5d-4302-89d7-d2535ba56821',  -- SUKA DUO FAVORIT
  '0fca2a16-74da-43a7-bd06-455693dce3cb'   -- SHAWARMA TRIPLE COMBO
);
```

**Expected result:** Ketiga row harus ada dengan `is_package = true`.

**Langkah 2:** Tambahkan logging ke trigger (debug mode):

```sql
-- Test langsung di SQL editor — simulasikan logika BOM untuk order #50
DO $$
DECLARE
  v_is_package BOOLEAN;
  v_resep_id UUID;
  v_selected_item_id UUID;
  p_item RECORD;
  pkg_id UUID := '424ddbec-0a35-48bc-bf93-cd45e6b78c58'; -- SHAWARMA DUO COMBO
  outlet_id UUID := '3f38c41d-11e3-49ce-a189-d7303e45f9ad'; -- MITRA CIBUBUR
BEGIN
  SELECT is_package INTO v_is_package FROM menu_items WHERE id = pkg_id;
  RAISE NOTICE 'is_package: %', v_is_package;
  
  IF v_is_package THEN
    FOR p_item IN SELECT id, menu_item_id, quantity FROM menu_packages WHERE package_id = pkg_id LOOP
      v_selected_item_id := p_item.menu_item_id;
      RAISE NOTICE 'Komponen: % (menu_item_id)', v_selected_item_id;
      
      SELECT id INTO v_resep_id
      FROM resep
      WHERE menu_item_ref = v_selected_item_id::text
        AND is_active = true
        AND ((scope = 'outlet' AND outlet_id = outlet_id) OR scope = 'global')
      ORDER BY CASE WHEN scope = 'outlet' THEN 1 ELSE 2 END
      LIMIT 1;
      
      RAISE NOTICE 'Resep ditemukan: %', v_resep_id;
    END LOOP;
  END IF;
END $$;
```

**Langkah 3:** Jika masalah ada di scope query, kemungkinan `outlet_id` variable clash dengan column name. Fix:

```sql
-- Di dalam trigger, ganti:
AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
-- Menjadi lebih eksplisit:
AND ( (r.scope = 'outlet' AND r.outlet_id = NEW.outlet_id) OR (r.scope = 'global') )
```

#### File yang Perlu Diubah

**Migration baru:** `supabase/migrations/20300108000003_fix_package_bom_scope_alias.sql`

```sql
CREATE OR REPLACE FUNCTION public.trg_process_bom_stok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- (Salin seluruh body dari 20300108000002, kemudian di bagian resep lookup untuk package items:)
-- GANTI:
--   AND ( (scope = 'outlet' AND outlet_id = NEW.outlet_id) OR (scope = 'global') )
-- DENGAN:
--   AND ( (r.scope = 'outlet' AND r.outlet_id = NEW.outlet_id) OR (r.scope = 'global') )
-- (tambahkan alias "r" ke FROM public.resep r)
$function$;
```

---

## BUG #4 — BELUM DIFIX ❌

### 5 Resep Aktif Tanpa `menu_item_ref` (Orphan Recipes)

#### Data

| Nama Resep | `resep.id` | `menu_item_ref` | Kandungan SAPI |
|---|---|---|---|
| Shawarma Subsidi | _(cek DB)_ | `null` | 65g |
| Ayam Sedang Subsidi | _(cek DB)_ | `null` | 0g |
| Shawarma Online Reguler | _(cek DB)_ | `null` | 0g |
| Shawarma Online Reguler Mix | _(cek DB)_ | `null` | 30g |
| Shawarma Online Reguler Sapi | _(cek DB)_ | `null` | 70g |

#### Konteks

Resep-resep ini kemungkinan digunakan untuk menu online (GoPay, Tokopedia, dll) atau produk subsidi yang dijual secara terpisah. Karena `menu_item_ref = null`, BOM trigger tidak pernah bisa menemukannya.

#### Query untuk Dapatkan ID Resep

```sql
-- Jalankan di Supabase SQL Editor:
SELECT id, nama, menu_item_ref, scope, is_active
FROM resep
WHERE menu_item_ref IS NULL OR menu_item_ref = ''
ORDER BY nama;
```

#### Fix yang Direkomendasikan

**Langkah 1:** Identifikasi menu item mana yang sesuai untuk setiap resep orphan:

```sql
-- Cari menu items dengan nama mirip "subsidi" atau "online":
SELECT id, name, is_package 
FROM menu_items 
WHERE name ILIKE '%subsidi%' OR name ILIKE '%online%' OR name ILIKE '%reguler%';
```

**Langkah 2:** Update `menu_item_ref`:

```sql
-- Contoh (ganti UUID sesuai hasil query langkah 1):
UPDATE public.resep
SET menu_item_ref = '<uuid_menu_item_subsidi>'
WHERE nama = 'Shawarma Subsidi' AND is_active = true;

UPDATE public.resep
SET menu_item_ref = '<uuid_menu_item_online_sapi>'
WHERE nama = 'Shawarma Online Reguler Sapi' AND is_active = true;
-- dst.
```

**Langkah 3:** Jika menu item untuk kategori ini belum ada, buat dulu di tabel `menu_items`, lalu hubungkan.

---

## ADDITIONAL FINDINGS

### Saldo Negatif — 20 Outlet

Berikut outlet + bahan dengan saldo negatif (semua akan ter-fix oleh opname ulang):

| Outlet | Bahan | Saldo | Unit |
|---|---|---|---|
| SUKA SHAWARMA BNR | FOIL | -892.67 | satuan_besar |
| SUKA SHAWARMA BNR | LETTUCE | -43.945 | satuan_besar |
| SUKA SHAWARMA BNR | MINYAK | -13.98 | satuan_besar |
| SUKA SHAWARMA BNR | KULIT 32 | -14.95 | satuan_besar |
| SUKA SHAWARMA BNR | MAYONAISE | -28.35 | satuan_besar |
| SUKA SHAWARMA BNR | SAOS TOMAT POUCH | -14.415 | satuan_besar |
| SUKA SHAWARMA BNR | KEJU | -7.65 | satuan_besar |
| SUKA SHAWARMA CIRENDEU | MAYONES | -0.10 | satuan_besar |
| MITRA PALEDANG | FOIL | -161.67 | gram |
| MITRA PALEDANG | ES BATU | -0.016 | gram |
| MITRA PALEDANG | STIKER | -0.05 | gram |
| MITRA PALEDANG | MIE | -0.025 | gram |
| SUKA SHAWARMA DRAMAGA | FOIL | -478.46 | gram |
| SUKA SHAWARMA DRAMAGA | STIKER | -0.25 | gram |
| SUKA SHAWARMA CIMANGGU | FOIL | -425.83 | gram |
| MITRA KALISARI | SAOS TOMAT | -0.066 | satuan_besar |
| MITRA KALISARI | MIE | -0.025 | gram |
| SUKA SHAWARMA JAGAKARSA | SAPI | -0.36 | gram |
| SUKA SHAWARMA JAGAKARSA | MINYAK | -0.32 | gram |
| SUKA SHAWARMA EMPANG | ES BATU | -0.016 | gram |

**Tindakan:** Opname fisik akan auto-reset semua saldo ini.

---

## URUTAN EKSEKUSI YANG DIREKOMENDASIKAN

```
1. [SEKARANG] Buka Supabase SQL Editor
   → Jalankan debug script Bug #3 (DO $$ ... $$) untuk konfirmasi root cause

2. [SETELAH KONFIRMASI] Deploy migration Bug #3
   → Buat: supabase/migrations/20300108000003_fix_package_bom_scope_alias.sql
   → Apply ke production

3. [SETELAH BUG #3 FIXED] Fix Bug #4 — Orphan resep
   → Query menu items matching "subsidi" / "online"
   → Update menu_item_ref

4. [KONFIRMASI BISNIS] Fix Bug #2 — Best Seller 2 & Mix Jumbo
   → Tanyakan ke tim: apakah BS Mix Jumbo = Original Mix Jumbo?
   → Jika ya: update menu_item_ref di resep Mix Jumbo
   → Jika beda: buat resep baru

5. [TERAKHIR] Instruksikan semua outlet untuk OPNAME ULANG
   → Ini akan reset saldo ke kondisi aktual
   → Setelah opname, BOM akan berjalan benar untuk semua order berikutnya
```

---

## INFORMASI TEKNIS UNTUK AGENT

### Koneksi Database
```
SUPABASE_URL: https://khpkoreaaucvyqfhynfq.supabase.co
PROJECT_REF: khpkoreaaucvyqfhynfq
SERVICE_ROLE_KEY: [REDACTED_UNTIL_ROTATED]
```

### Cara Apply SQL ke Production
```javascript
// Gunakan RPC exec_sql via HTTP:
const resp = await fetch(
  `https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/rpc/exec_sql`,
  {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql: '<your SQL here>' })
  }
);
// Status 204 = success
```

### Migration Files Relevant
```
supabase/migrations/
  20300105000009_restore_package_bom_after_pawoon_guard.sql  ← versi lama (JANGAN edit)
  20300105000017_scale_aware_ledger_writers.sql              ← berisi to_ledger_scale()
  20300108000002_fix_bom_trg_use_waterfall.sql               ← fix Bug #1 (sudah deploy)
  20300108000003_fix_package_bom_scope_alias.sql             ← PERLU DIBUAT (Bug #3)
```

### Tabel Kunci
```sql
menu_items       -- id, name, is_package, is_available (TIDAK ada is_active!)
menu_packages    -- package_id, menu_item_id, or_menu_item_id, quantity
resep            -- id, nama, menu_item_ref (= menu_items.id as text), scope, is_active
resep_item       -- resep_id, bahan_baku_id, qty_per_porsi (dalam gram)
bahan_baku       -- id, nama, satuan, faktor_konversi (gram per satuan_besar)
ledger_stok      -- outlet_id, bahan_baku_id, tipe, qty, ref_order_id
stok_balance     -- outlet_id, bahan_baku_id, saldo, saldo_is_gram
orders           -- id, outlet_id, status, order_number, external_order_id
order_items      -- order_id, menu_item_id, menu_item_name, quantity, package_choices
global_settings  -- key='bom_automation_allowed_outlets', value='uuid1,uuid2,...'
```

### Catatan Penting: Scope Variable Clash (Hipotesis Bug #3)
Di dalam `trg_process_bom_stok`, saat query resep untuk komponen paket, variabel lokal `outlet_id` bisa clash dengan nama kolom tabel `resep.outlet_id`. PostgreSQL akan menginterpretasikan `outlet_id = NEW.outlet_id` sebagai `resep.outlet_id = resep.outlet_id` (selalu true), bukan sebagai kondisi filter yang benar. Ini menyebabkan resep scope='outlet' selalu match tapi resep scope='global' tidak pernah ditemukan jika kondisi OR tidak dievaluasi dengan benar. **Solusi:** gunakan alias tabel eksplisit (`FROM resep r WHERE r.scope = ...`).
