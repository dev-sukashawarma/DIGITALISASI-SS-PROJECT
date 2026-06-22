# Leader Multi-Outlet Switcher — apps/stok

**Status:** Approved (brainstorm) — ready for implementation plan
**Date:** 2026-06-22
**Scope:** `apps/stok` only

## Background

Role `kepala_outlet` sudah di-rename ke `leader` di seluruh stack (migration `20260620000000_rename_role_kepala_outlet_to_leader.sql`): DB constraint, RLS policies, `accessible_outlet_ids()`, `auth_is_supervisor()`, dan semua app TypeScript (`packages/auth`, admin-dashboard, absensi, distribusi, pos-kasir, stok). Leader memiliki kemampuan membawahi **beberapa outlet** via tabel many-to-many `staff_outlets` (migration `20260613000400`).

**Gap yang ditemukan:** RLS/backend sudah benar mengizinkan leader membaca semua outlet binaannya, tapi UI `apps/stok` belum punya cara untuk *memilih* outlet binaan mana yang sedang dilihat. Semua hook data (ledger, opname, permintaan) masih query langsung dari `outlet_staff.outlet_id` (single value), bukan dari `staff_outlets`. Tidak ada outlet-switcher UI di mana pun di stok app.

## Tujuan

Leader bisa switch outlet binaan dari halaman stok (global, di header), dan semua halaman data (ledger, opname, permintaan, monitoring) ikut menampilkan data outlet yang sedang dipilih.

## Arsitektur & Data Flow

```
AuthProvider (existing, @suka/auth)
  → outletStaff { id, role, outlet_id, ... }

OutletScopeProvider (NEW — apps/stok/src/app/Providers.tsx, di dalam AuthProvider)
  state: { boundOutlets: Outlet[], selectedOutletId: string, isMultiOutlet: boolean }

  - role !== 'leader':
      boundOutlets = [outletStaff.outlet_id]
      selectedOutletId = outlet_id (fixed)
      isMultiOutlet = false

  - role === 'leader':
      fetch staff_outlets (join outlets) untuk staff_id = outletStaff.id
      boundOutlets = hasil fetch (array Outlet)
      selectedOutletId = localStorage('stok:selectedOutletId:<staffId>')
                          ?? boundOutlets[0]?.id
                          ?? outletStaff.outlet_id (fallback "home")
      isMultiOutlet = boundOutlets.length > 1

  setSelectedOutletId(id):
      - validasi id ada di boundOutlets (defense-in-depth; RLS tetap jadi pagar akhir)
      - update state + localStorage

useOutletScope() → { selectedOutletId, boundOutlets, setSelectedOutletId, isMultiOutlet }
```

localStorage key disertakan `staffId` agar tidak bocor antar akun di device yang sama (mis. shared kiosk browser).

## Komponen UI Baru

- **`OutletSwitcher.tsx`** (`src/components/common/OutletSwitcher.tsx`) — dropdown di header/nav stok. Render hanya jika `isMultiOutlet === true`. Tampilkan nama outlet aktif; pilih dari dropdown → `setSelectedOutletId(id)`.
- Disisipkan di header/nav layout stok (lokasi exact ditentukan saat implementasi — cari komponen nav existing di `src/app/stok/layout.tsx` atau header component terkait).

React Query `queryKey` di hook-hook existing sudah include `outletId` sebagai bagian key → ganti `selectedOutletId` otomatis trigger refetch tanpa perlu manual invalidate.

## Perubahan File (mapping awal — detail final di plan implementasi)

| File | Perubahan |
|---|---|
| `src/app/Providers.tsx` | Tambah `OutletScopeProvider`, wrap di dalam `AuthProvider` |
| `src/hooks/useOutletScope.ts` (baru) | Context + hook, fetch `staff_outlets` untuk role leader |
| `src/components/common/OutletSwitcher.tsx` (baru) | Dropdown UI |
| `src/hooks/useLedger.ts`, `useOpname.ts` | Param outletId dari caller (page.tsx), bukan langsung `outletStaff?.outlet_id` |
| `src/app/stok/ledger/page.tsx`, `src/app/stok/opname/page.tsx` | Ganti sumber outletId ke `useOutletScope().selectedOutletId` |
| `src/app/stok/permintaan/page.tsx` | Leader ikut switcher; `KITCHEN_OUTLET_ID` hardcoded tetap independen (bukan bagian outlet binaan biasa) |
| `src/lib/queries/monitoring.ts`, `src/components/monitoring/MonitoringPage.tsx` | Role leader: reuse pola `SPVDashboard` (grid + selectedOutletId state untuk drill-down), tapi outlet list dibatasi ke `boundOutlets` leader (bukan ke-19 outlet seperti SPV/admin) |

## Monitoring untuk Leader

Leader melihat **agregat outlet binaannya saja** (bukan ke-19 outlet seperti SPV) — reuse komponen grid `SPVDashboard` tapi outlet list source-nya `boundOutlets`, dengan drill-down per outlet tetap tersedia via outlet card click (route `/stok/monitoring-live/[outlet-id]` sudah ada).

## Keamanan

RLS (`accessible_outlet_ids()`) sudah menjadi pagar akhir — switcher hanya UX convenience. Validasi `setSelectedOutletId` terhadap `boundOutlets` adalah defense-in-depth, bukan satu-satunya kontrol. Jika ada bug di switcher yang mengirim outlet_id di luar binaan leader, query tetap akan gagal/kosong karena RLS menolak.

## Testing

- Unit: `useOutletScope` — role leader dengan 1 outlet (isMultiOutlet=false, switcher hidden), role leader dengan >1 outlet, role non-leader (selalu fixed ke outlet_id sendiri), localStorage persist & restore, fallback saat localStorage berisi outlet_id yang sudah tidak ada di boundOutlets (mis. leader dipindah outlet binaannya).
- Integration: ledger/opname/permintaan refetch saat switch outlet (mock 2 outlet, assert query key berubah).
- Manual smoke: login sebagai leader (`chairulrizky@test.com` — punya multi outlet binaan berdasar [[leaders-outlet-mapping]]), switch outlet di tiap halaman, verifikasi data berubah.

## Out of Scope (backlog terpisah)

Audit ditemukan pola serupa (leader diperlakukan binary "pusat" flag atau disamakan dengan spv tanpa scoping outlet binaan) di:
- **apps/distribusi** — `isPusat = role === 'leader'` (page.tsx:14, BottomNav.tsx:17) tidak scoped ke outlet binaan tertentu.
- **apps/absensi** — leader disamakan dengan spv untuk akses dashboard; recap/checklist belum dicek apakah filter ke outlet binaan leader atau ke semua outlet.
- **apps/pos-kasir** — middleware cek role leader, data-scoping detail belum diaudit.

Direkomendasikan jadi spec/plan terpisah per-app setelah pola di stok ini terbukti jalan, agar tidak melebar di plan ini.
