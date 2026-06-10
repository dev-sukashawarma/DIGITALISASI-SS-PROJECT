# apps/distribusi — M3: Distribusi & Verifikasi Supply Chain

**Track:** Dev B · **Module:** M3 Distribusi · Spec: [`docs/PRD.md`](../../docs/PRD.md) §M3

## Overview

Supply chain management module for Sukashawarma outlet network. Enables Kitchen Bogor (SPV) to create and send Surat Jalan (delivery manifests) with digital signatures, and allows outlet crews to verify received items and auto-generate ledger entries.

**Core features:**
- ✅ SPV creates Surat Jalan with formatted document numbers (SJ/KITCHEN/YYYYMMDD/SEQUENCE)
- ✅ 2-signature approval (Kitchen SPV + Supir/Driver) with PNG signature capture
- ✅ Outlet receives and verifies items (qty_terima, kondisi)
- ✅ Auto-create ledger entries (M2 stok) on verification
- ✅ PDF export with date filtering (daily/7-day/30-day)
- ✅ RLS-protected (outlet staff only, role-based access)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Kitchen Bogor SPV                                       │
│  • Create Surat Jalan                                    │
│  • Add items from bahan_baku                             │
│  • Collect 2 digital signatures (PNG)                    │
│  • Send to outlet                                        │
└─────────────────────────────────────────────────────────┘
                         ↓
            Surat Jalan (dikirim status)
        (stored in Supabase with signatures JSONB)
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Outlet Crew (diterima/diterima_sebagian)               │
│  • View incoming Surat Jalan                             │
│  • Verify each item (qty_terima, kondisi)               │
│  • Submit verification                                  │
└─────────────────────────────────────────────────────────┘
                         ↓
         RPC: finalize_surat_jalan_and_ledger()
    (creates ledger_stok entries with tipe='terima_kiriman')
                         ↓
┌─────────────────────────────────────────────────────────┐
│  M2 Stok Module                                          │
│  • Auto-created ledger entries                           │
│  • Balance updates per outlet                            │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

- **Frontend:** Next.js 16 (ES modules), React 19 RC, TypeScript strict
- **Styling:** Tailwind CSS v3
- **Database:** Supabase (PostgreSQL + RLS + Edge Functions)
- **Auth:** Supabase RLS (outlet_id + role-based)
- **Signatures:** Canvas → PNG data URIs (lossless, max 50KB per signature)
- **PDF:** HTML-based (downloadable as `.html`, print to PDF via browser)

## Pages & Components

### Pages
| Path | Component | Purpose |
|------|-----------|---------|
| `/distribusi/surat-jalan` | `SuratJalanList` | List all Surat Jalan with date filters + PDF download |
| `/distribusi/surat-jalan/new` | `SuratJalanForm` | Create new Surat Jalan, add items, collect signatures |
| `/distribusi/surat-jalan/[id]` | `SuratJalanDetail` | View Surat Jalan details, manage signatures, download PDF |
| `/distribusi/terima` | `TerimaList` | List incoming shipments (dikirim/diterima_sebagian) |
| `/distribusi/terima/[id]` | `VerifikasiForm` | Item-by-item verification with qty_terima + kondisi |

### Components
| Component | Purpose |
|-----------|---------|
| `SuratJalanForm.tsx` | Create form with outlet/barang selection, RPC integration |
| `SuratJalanList.tsx` | List with date filters (Semua/Hari Ini/7 Hari/1 Bulan) + PDF |
| `SuratJalanDetail.tsx` | Detail view with document number, items table, signature flow |
| `SignatureFlow.tsx` | 2-signature approval UI with role selector + size validation |
| `SignatureCanvas.tsx` | Canvas drawing (300x100px) → PNG with empty validation |
| `TerimaList.tsx` | Incoming shipments list |
| `VerifikasiForm.tsx` | Item verification with Promise.all() parallelization |

## Database Schema

### Key Tables
- `surat_jalan` - Delivery manifests
  - `id` (UUID)
  - `outlet_id` (FK outlets)
  - `document_number` (formatted: SJ/KITCHEN/20260610/0001)
  - `status` (draft/dikirim/diterima/diterima_sebagian)
  - `signatures` (JSONB array, each: {signed_by, role, signed_at, signature_image})
  - `created_by`, `created_at`, `updated_at`

- `surat_jalan_item` - Line items per Surat Jalan
  - `id`, `surat_jalan_id`, `bahan_baku_id`
  - `qty_dikirim`, `qty_terima`, `kondisi`, `catatan`
  - `qty_fisik` (for verification)

- `ledger_stok` (M2 integration)
  - Auto-created with `tipe='terima_kiriman'` on verification
  - Links to `surat_jalan` via `referensi_id`

### RPC Functions
| Function | Purpose |
|----------|---------|
| `create_surat_jalan_with_number(outlet_id)` | Create SJ + generate formatted doc number |
| `generate_surat_jalan_number(outlet_id)` | Generate SJ/KITCHEN/YYYYMMDD/SEQUENCE |
| `sign_surat_jalan(sj_id, name, role, signature_image)` | Add signature to JSONB array |
| `send_surat_jalan_signed(sj_id)` | Mark as dikirim (requires 2 signatures) |
| `verify_surat_jalan_item(item_id, qty_terima, kondisi)` | Record verification |
| `finalize_surat_jalan_and_ledger(sj_id)` | Mark diterima + create ledger entries |

## Key Implementation Details

### Signature Capture
- Canvas: 300x100px at screen DPI (96 DPI)
- Format: PNG (lossless, ~30-50KB per signature)
- Validation: Max 50KB per signature (RPC parameter limit)
- Empty check: Ensures signature is not blank before saving
- Stroke: lineWidth=2, round caps/joins for print quality
- Storage: Base64-encoded data URI in `signatures` JSONB

### PDF Generation
- HTML-based (not true PDF) — user prints via browser print dialog
- Styling constants for signature cell heights + image sizing
- Fallback signature line when `signature_image` is null
- Data integrity warning logged in HTML comment if missing images

### Signature Size Management
**Problem:** PNG format 5-10x larger than JPEG (0.3 quality)
- **Solution:** Max 50KB validation in `SignatureFlow.handleSign()`
- **User feedback:** Alert if signature exceeds limit
- **Logging:** Console shows size in KB for diagnostics

### RLS Policies
- `surat_jalan`: Authenticated users only, role-based (SPV/crew read/write)
- `bahan_baku`, `outlets`: Anon read (reference data for forms)
- `surat_jalan_item`: Inherits parent SJ access
- `ledger_stok`: M2 module handles (M3 creates via RPC)

## Known Constraints

1. **PDF is HTML-based:** Not a true PDF file. Users must print via browser print dialog (Ctrl+P) to save as PDF. This avoids library dependencies but requires user action.

2. **Signature storage in JSONB:** Base64-encoded data URIs in `signatures` column inflate row size (~100-160KB for 2 signatures). Long-term fix: store in Supabase Storage with signed URLs.

3. **Canvas DPI mismatch:** Drawn at screen DPI (96 DPI), printed at 300+ DPI. May cause slight scaling artifacts in final PDF. Improvement: capture at higher DPI.

4. **Two signatures required:** Workflow enforces Kitchen SPV + Supir. Cannot modify roles without schema/RPC changes.

5. **Verification is final:** Once marked diterima (via finalize RPC), cannot edit item quantities. Ledger entries are created atomically.

## Testing Checklist

- [ ] Create Surat Jalan with items
- [ ] Add Kitchen SPV signature (test empty canvas rejection)
- [ ] Add Supir signature (test size validation with large stroke)
- [ ] Verify signatures appear in detail view
- [ ] Download PDF and verify signatures render (not black blocks)
- [ ] Verify at outlet (test qty_terima + kondisi)
- [ ] Check ledger entries created after finalization
- [ ] Test date filters (Semua/Hari Ini/7 Hari/1 Bulan)
- [ ] Test PDF with missing signature image (fallback line)
- [ ] Test RLS (crew cannot see other outlets' SJ)

## Recent Fixes (Code Review)

**Commit c17c696** - Code review findings implemented:
- ✅ Size validation (max 50KB per signature)
- ✅ CSS conflict fix (vertical-align removed)
- ✅ Styling constants (DRY principle)
- ✅ Empty signature validation
- ✅ Canvas stroke improvements
- ✅ Data integrity warnings

## Future Enhancements

1. **True PDF library:** Use pdfkit or similar to generate server-side PDFs instead of HTML
2. **External image storage:** Move signatures to Supabase Storage, reference by URL in JSONB (reduces row size)
3. **Offline queue:** Queue Surat Jalan creation when offline, sync on reconnect
4. **Mobile app:** React Native version with offline signature capture
5. **Audit trail:** Log signature captures, verifications, and ledger creation with user IP/timestamp
6. **Batch verification:** Process multiple items in parallel with optimistic UI updates

## Development Notes

- Use `Promise.all()` for parallel queries (not sequential awaits)
- RLS handles authorization (no manual role checks needed in component)
- Batch related data with `.select('*, related_table(*)')` to avoid N+1 queries
- Always validate on client before RPC to give instant user feedback
