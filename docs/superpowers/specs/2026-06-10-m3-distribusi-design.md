# M3 Distribusi — Supply Chain Design

> **Date:** 2026-06-10  
> **Status:** Design locked, ready for implementation plan  
> **Dev:** Dev A (Distribusi lead) + Dev B (M2 integration)

---

## Overview

M3 **Supply Chain** (Distribusi) manages the flow of ingredients from Central Warehouse → Outlet. Two main actors:

- **SPV Stok Barang (Pusat):** Create & approve Surat Jalan (shipping orders)
- **Crew Outlet:** Verify received goods, log discrepancies, finalize

**Key principle:** Qty terverifikasi di outlet → otomatis masuk M2 Ledger Stok. No manual entry needed; fully integrated.

---

## Data Schema

### Table: `surat_jalan`

Master shipment order. One per physical shipment from warehouse.

```sql
CREATE TABLE surat_jalan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'dikirim', 'dikirim_lengkap', 'diterima_sebagian', 'diterima_lengkap', 'selesai')),
  created_by UUID REFERENCES outlet_staff(id),  -- SPV who created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  -- 3 signatures from warehouse (JSON array of {user_id, timestamp, ...})
  signatures JSONB DEFAULT '[]'::jsonb,
  
  INDEX idx_surat_jalan_outlet ON outlet_id,
  INDEX idx_surat_jalan_status ON status,
  INDEX idx_surat_jalan_created ON created_at DESC
);
```

### Table: `surat_jalan_item`

Line items: what was sent, what was received, discrepancies.

```sql
CREATE TABLE surat_jalan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_jalan_id UUID NOT NULL REFERENCES surat_jalan(id) ON DELETE CASCADE,
  bahan_baku_id UUID NOT NULL REFERENCES bahan_baku(id) ON DELETE RESTRICT,
  
  -- Sent vs received
  qty_dikirim NUMERIC NOT NULL CHECK (qty_dikirim > 0),
  qty_terima NUMERIC,  -- NULL until crew verifies
  
  -- Verification by crew
  kondisi TEXT CHECK (kondisi IN ('baik','rusak','hilang_qty')),  -- NULL until verified
  selisih NUMERIC GENERATED ALWAYS AS (COALESCE(qty_terima,0) - qty_dikirim) STORED,
  flagged BOOLEAN NOT NULL DEFAULT false,  -- |selisih| > 0 OR kondisi != 'baik'
  
  -- Photo & metadata
  foto_path TEXT,  -- Storage path, required if flagged=true
  catatan TEXT,    -- reason for discrepancy
  verified_by UUID REFERENCES outlet_staff(id),  -- crew who verified
  verified_at TIMESTAMPTZ,
  
  UNIQUE(surat_jalan_id, bahan_baku_id),
  INDEX idx_sj_item_sj ON surat_jalan_id,
  INDEX idx_sj_item_bahan ON bahan_baku_id
);
```

### Ledger Auto-Entry (M2 Integration)

When crew finalizes Surat Jalan, a trigger/RPC creates ledger entries for all verified items:

```sql
-- Pseudo-code (actual trigger in migration)
FOR EACH surat_jalan_item WHERE surat_jalan_id = p_id AND qty_terima IS NOT NULL:
  INSERT INTO ledger_stok (
    outlet_id, bahan_baku_id, tipe='terima_kiriman',
    qty=qty_terima, ref_surat_jalan_id=surat_jalan_id,
    created_by=crew_user_id, catatan='Auto dari verifikasi kiriman'
  )
```

The ledger triggers then update `stok_balance` automatically (M2 domain).

---

## RPC Functions

All `SECURITY DEFINER SET search_path = public` to enforce RLS despite trigger chain.

### 1. `create_surat_jalan(outlet_id UUID, items JSONB[])`

**Actor:** SPV at warehouse (created_by must have SPV role in auth)

**Input:**
```json
{
  "outlet_id": "uuid",
  "items": [
    {"bahan_baku_id": "uuid", "qty_dikirim": 50},
    {"bahan_baku_id": "uuid", "qty_dikirim": 100}
  ]
}
```

**Output:** `surat_jalan` record (status='draft')

**Logic:**
1. Validate outlet_id exists
2. Insert surat_jalan row
3. For each item, insert surat_jalan_item (qty_dikirim only; others NULL)
4. Return created SJ record

**RLS:** `created_by = auth.uid()` must be SPV role

---

### 2. `send_surat_jalan(surat_jalan_id UUID, signatures JSONB[])`

**Actor:** SPV finalizes send (3 warehouse signatures)

**Input:**
```json
{
  "surat_jalan_id": "uuid",
  "signatures": [
    {"user_id": "uuid", "timestamp": "2026-06-10T10:00:00Z", "signed_at_warehouse": true},
    {"user_id": "uuid", ...},
    {"user_id": "uuid", ...}
  ]
}
```

**Logic:**
1. Load surat_jalan; must be status='draft'
2. Validate 3 signatures (structure, user_id exists, approver role check)
3. Update: status → 'dikirim', signatures → input, updated_at → now
4. Return updated SJ

**RLS:** created_by = auth.uid() AND status='draft'

---

### 3. `verify_surat_jalan_item(surat_jalan_id UUID, item_id UUID, qty_terima NUMERIC, kondisi TEXT, foto_file_id UUID?)`

**Actor:** Crew at outlet (one call per item)

**Input:**
```json
{
  "surat_jalan_id": "uuid",
  "item_id": "uuid",
  "qty_terima": 48,
  "kondisi": "baik",
  "foto_file_id": null  // optional, File object from Supabase Storage
}
```

**Logic:**
1. Load surat_jalan_item; must belong to outlet of auth.uid()
2. Validate surat_jalan status = 'dikirim'
3. Calculate: `selisih = qty_terima - qty_dikirim`, `flagged = (selisih != 0) OR (kondisi != 'baik')`
4. If flagged & no foto → raise error (foto wajib)
5. If foto_file_id provided, save to Storage at `/surat-jalan/{surat_jalan_id}/{item_id}/`
6. Update item: qty_terima, kondisi, flagged, foto_path, verified_by=auth.uid(), verified_at=now()
7. Return updated item

**RLS:** auth.uid() must be crew in outlet of surat_jalan.outlet_id

---

### 4. `finalize_surat_jalan(surat_jalan_id UUID)`

**Actor:** Crew confirms all items verified, triggers ledger creation

**Logic:**
1. Load surat_jalan; status must be 'dikirim'
2. Check: all items have qty_terima NOT NULL (else error: "Masih ada barang belum dicek")
3. Determine final status:
   - If any item has `flagged=true` → status='diterima_sebagian'
   - Else → status='diterima_lengkap'
4. **Atomic transaction:**
   - Update surat_jalan: status, updated_at
   - For each surat_jalan_item (qty_terima NOT NULL): INSERT into ledger_stok
     - `tipe='terima_kiriman'`
     - `qty=qty_terima`
     - `ref_surat_jalan_id=surat_jalan_id`
     - Ledger triggers auto-update stok_balance
5. Return updated surat_jalan

**RLS:** auth.uid() crew in outlet, status='dikirim'

**Error handling:** If ledger insert fails, entire transaction rolls back; surat_jalan stays 'dikirim'. User can retry.

---

## UI Layer

### Pusat Side (SPV): `/apps/distribusi/src/app/distribusi/surat-jalan/`

Pages:

1. **`/distribusi/surat-jalan`** — List view
   - Filter / Tabs: "Semua", "Hari Ini", "7 Hari", "1 Bulan", "Belum Verif" (status `diterima_lengkap` / `diterima_sebagian` waiting for Pusat verification), "Telah Diverif" (status `selesai`)
   - Cards: outlet name, item count, status badge (Title Case without underscore: Draft, Dikirim, Selesai, Diterima Lengkap, Diterima Sebagian), created date
   - Actions:
     - Click card to open details.
     - For items awaiting verification (`diterima_*`), an orange button **"Cek dan Verifikasi"** is displayed. Clicking this button redirects the user to the details page first instead of triggering verification directly.
     - For sent or completed items, a red button **"Download Surat Jalan"** is displayed to print the PDF.
     - New button → `/new` to create a new travel document.

2. **`/distribusi/surat-jalan/new`** — Create form
   - Outlet select (dropdown)
   - Item picker: search bahan_baku, add qty_dikirim per item
   - Create button → POST create_surat_jalan RPC
   - Redirect to detail page

3. **`/distribusi/surat-jalan/[id]`** — Detail + approve + verify
   - Header: outlet, status (Title Case without underscore), created date, PDF download shortcut (only for sent/completed documents)
   - Item cards layout: displays name, qty_dikirim, qty_terima (with discrepancy highlighted in red if different), item condition (e.g. `rusak` status badge), and optional notes
   - Signature block:
     - If status=draft: 3 warehouse signature inputs (user dropdown + timestamp) → send button
     - If status!=draft: renders physical signatures block (Sender Signatures and Receiver Signatures side-by-side)
   - Pusat Verification action:
     - Shown only for SPV Pusat (`kepala_outlet`) when the document status is received (`diterima_*`).
     - Displays a confirmation guidelines block and a prominent button **"Verifikasi & Tutup Surat Jalan"** to update status to `selesai`.

### Outlet Side (Crew): `/apps/distribusi/src/app/distribusi/terima/`

Pages:

1. **`/distribusi/terima`** — Incoming Surat Jalan list
   - Filter: status (dikirim, done)
   - Cards per SJ: outlet, item count, status, action button "Verifikasi" → redirects directly to the `/distribusi/terima/[id]` verification page.

2. **`/distribusi/terima/[id]`** — Verification form
   - Header: SJ date, outlet, item count
   - Per-item card:
     - Bahan nama, qty_dikirim
     - Input: qty_terima (number field)
     - Dropdown: kondisi (baik | rusak | hilang_qty)
     - Foto upload: conditional (only if `(qty_terima != qty_dikirim) OR kondisi != 'baik'`)
     - Computed: selisih display, flagged indicator
     - Optional textarea: catatan
   - Finalize button: submit all items + trigger finalize_surat_jalan RPC
   - On success: redirect to list, show toast "Kiriman terverifikasi & stok diperbarui"

---

## Error Handling & Edge Cases

| Case | Handling |
|------|----------|
| qty_terima = 0 | Allowed; flagged=true, foto wajib |
| Foto upload timeout | UI: retry button; allow finalize without foto if not flagged (nice-to-have) |
| Network error saat finalize | Safe: RPC atomic → either all ledger entries created or none. UI can retry. |
| Crew forgets foto for flagged item | Form validation blocks submit until foto provided |
| SPV try to send SJ 2x | RPC checks status='draft'; second attempt fails gracefully |
| Item already counted in outlet's ledger (qty in stok_balance) | Ledger entry is a delta; stok_balance trigger adds it. No de-duplication needed (each SJ = unique shipment). |

---

## Integration with M2 (Stok Domain)

- **When:** Crew finalize → ledger entries created automatically
- **What:** Each item with qty_terima > 0 → one ledger row (tipe='terima_kiriman')
- **Result:** M2 stok_balance updated via ledger triggers (M2 owns balance logic)
- **Audit:** ref_surat_jalan_id links ledger back to shipment for traceability

---

## Future Improvements (Noted)

- **QR Code validation:** Print barcode on each item/box at warehouse; scan at outlet to validate qty before manual input (phase 2)
- **Event-driven audit log:** Immutable event table instead of direct updates (compliance phase)
- **Signature flow:** Digital signature (hand-drawn or e-sign) instead of JSON metadata (UX enhancement)

---

## Success Criteria (M3)

✅ SPV can create & send Surat Jalan with 3 warehouse signatures  
✅ Crew can verify items one-by-one, flag discrepancies, attach photos  
✅ Finalize triggers atomic ledger creation → M2 balance updates  
✅ RLS: SPV sees all; crew sees own outlet only  
✅ Qty terverifikasi in M2 ledger matches what was received (source of truth)
✅ SPV Pusat can perform two-way verification (redirects from "Cek dan Verifikasi" on list to detail view first, then verifies received items & signatures, transitioning status to 'selesai')
