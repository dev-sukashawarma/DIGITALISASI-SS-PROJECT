# Satuan Majemuk di Dashboard Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Papan monitoring-live (TV board), dashboard crew/SPV, dan tabelnya menampilkan qty stok dalam format satuan majemuk ("2 kompan + 8 liter") untuk bahan yang punya `satuan_kecil`, bukan cuma di halaman ledger/detail modal yang sudah dikerjakan sebelumnya.

**Architecture:** Satu helper query bersama (`attachSatuanKecil`) di-reuse di 5 fetcher monitoring (SPV, leader, crew, recent ledger, stockout forecast) untuk batch-join `bahan_baku(satuan_kecil, faktor_tampilan)` — pola yang sama seperti `fetchItemDetail` sebelumnya, tapi diekstrak jadi fungsi bersama supaya tidak diduplikasi 5x. Tipe `MonitoringItem`/`LedgerFeedEntry`/`StockoutForecastItem` diperluas dengan 2 field baru. Lalu 8 titik tampilan diganti pakai `formatCompositeSaldo`/`formatCompositeDelta`.

**Tech Stack:** Next.js (apps/stok), React Query, Vitest.

**Prasyarat:** `apps/stok/src/lib/format/compositeUnit.ts` (formatter) sudah ada dan teruji dari plan sebelumnya (`2026-07-04-ledger-composite-unit-display.md`).

**Scope (dikonfirmasi user):** Papan monitoring-live (`LiveMonitoringPage.tsx`) + dashboard Crew & SPV + tabelnya (`CrewDashboard.tsx`, `CrewList.tsx`, `SPVDashboard.tsx`, `SPVTable.tsx`). **TIDAK termasuk** `DetailOutletMonitoring.tsx`, `TransferModal.tsx`, `TransferSuggestionPanel.tsx` (di luar scope sesi ini).

**Konvensi yang dipertahankan** (dari plan sebelumnya): hanya qty stok aktual yang diformat majemuk; angka threshold/config tetap tampil apa adanya.

---

### Task 1: Helper `attachSatuanKecil` + extend types + wire ke 5 fetcher

**Files:**
- Modify: `apps/stok/src/lib/types/monitoring.ts`
- Modify: `apps/stok/src/lib/queries/monitoring.ts`

- [ ] **Step 1: Extend types**

Di `apps/stok/src/lib/types/monitoring.ts`, tambah 2 field ke `MonitoringItem` (setelah `satuan: string;`):
```typescript
export interface MonitoringItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string;
  satuan_kecil: string | null;
  faktor_tampilan: number | null;
  kategori: string;
  current_qty: number;
  threshold: number;
  status: StockStatus;
  is_flagged: boolean;
  last_updated: string;
  last_opname_date: string | null;
}
```

- [ ] **Step 2: Tambah helper `attachSatuanKecil` di `monitoring.ts`**

Tambah setelah fungsi `assertOutletAccessible` (sebelum `fetchSPVMonitoringData`):
```typescript
/**
 * Batch-join satuan_kecil/faktor_tampilan dari bahan_baku ke sekumpulan item
 * monitoring (1 query per outletnya-outlet, bukan per-item -- hindari N+1).
 * Dipakai di semua fetcher monitoring supaya UI bisa pakai formatCompositeSaldo/
 * Delta tanpa perlu query terpisah per komponen.
 */
async function attachSatuanKecil<T extends { bahan_baku_id: string }>(
  supabase: SupabaseBrowserClient,
  items: T[]
): Promise<(T & { satuan_kecil: string | null; faktor_tampilan: number | null })[]> {
  const ids = [...new Set(items.map((i) => i.bahan_baku_id))];
  if (ids.length === 0) return items as (T & { satuan_kecil: string | null; faktor_tampilan: number | null })[];

  const { data } = await supabase
    .from('bahan_baku')
    .select('id, satuan_kecil, faktor_tampilan')
    .in('id', ids);

  const map = new Map((data ?? []).map((b) => [b.id, b]));
  return items.map((item) => ({
    ...item,
    satuan_kecil: map.get(item.bahan_baku_id)?.satuan_kecil ?? null,
    faktor_tampilan: map.get(item.bahan_baku_id)?.faktor_tampilan ?? null,
  }));
}
```

- [ ] **Step 3: Wire ke `fetchSPVMonitoringData`**

Ganti `return` di akhir fungsi (baris ~60-63):
```typescript
  const enrichedItems = await attachSatuanKecil(supabase, dedupedItems);

  return {
    items: enrichedItems,
    lastFetched: new Date().toISOString(),
  };
```

- [ ] **Step 4: Wire ke `fetchLeaderMonitoringData`**

Sama persis, ganti `return` di akhir fungsi (baris ~92-95):
```typescript
  const enrichedItems = await attachSatuanKecil(supabase, dedupedItems);

  return {
    items: enrichedItems,
    lastFetched: new Date().toISOString(),
  };
```

- [ ] **Step 5: Wire ke `fetchCrewMonitoringData`**

Fungsi ini punya `summary` dihitung dari `dedupedData` SEBELUM enrichment — panggil `attachSatuanKecil` setelah `dedupedData` didapat, sebelum `summary` dihitung (urutan tidak masalah karena `summary` cuma baca `status`/`is_flagged`, bukan field baru), lalu pakai hasil enriched di `items`:
```typescript
  const dedupedData = (data || []).filter((item) => {
    const key = `${item.outlet_id}-${item.bahan_baku_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const enrichedData = await attachSatuanKecil(supabase, dedupedData);

  // Calculate summary
  // Note: "below_threshold" counts only items strictly below threshold (status === 'below').
  // "warning" items (80-100% of threshold) are tracked separately and not included in this count.
  const summary = {
    below_threshold: dedupedData.filter((item) => item.status === 'below').length,
    flagged: dedupedData.filter((item) => item.is_flagged).length,
    ok: dedupedData.filter((item) => item.status === 'ok').length,
    total: dedupedData.length,
  };

  return {
    outlet_id: staffData.outlet_id,
    outlet_name: outletName,
    items: enrichedData,
    summary,
    lastFetched: new Date().toISOString(),
  };
```

- [ ] **Step 6: Extend `LedgerFeedEntry` type & wire ke `fetchRecentLedger`**

Di `apps/stok/src/lib/queries/monitoring.ts`, tambah 2 field ke interface `LedgerFeedEntry` (setelah `satuan: string | null;`):
```typescript
export interface LedgerFeedEntry {
  id: string;
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string | null;
  satuan_kecil: string | null;
  faktor_tampilan: number | null;
  tipe: LedgerFeedTipe;
  qty: number;
  catatan: string | null;
  saldo_sesudah: number;
  created_at: string;
}
```

Ganti isi `fetchRecentLedger`:
```typescript
export async function fetchRecentLedger(limit = 50): Promise<LedgerFeedEntry[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('ledger_feed_spv')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return await attachSatuanKecil(supabase, (data || []) as LedgerFeedEntry[]);
}
```

- [ ] **Step 7: Extend `StockoutForecastItem` type & wire ke `fetchStockoutForecast`**

Tambah 2 field ke interface `StockoutForecastItem` (setelah `satuan: string | null;`):
```typescript
export interface StockoutForecastItem {
  outlet_id: string;
  outlet_name: string;
  bahan_baku_id: string;
  item_name: string;
  satuan: string | null;
  satuan_kecil: string | null;
  faktor_tampilan: number | null;
  current_qty: number;
  threshold: number;
  daily_rate: number;
  days_left: number;
}
```

Ganti isi `fetchStockoutForecast`:
```typescript
export async function fetchStockoutForecast(maxDays = 1, limit = 6): Promise<StockoutForecastItem[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('stockout_forecast_spv')
    .select('*')
    .lte('days_left', maxDays)
    .order('days_left', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return await attachSatuanKecil(supabase, (data || []) as StockoutForecastItem[]);
}
```

- [ ] **Step 8: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru (error `OpnameForm.tsx` TS6133 pra-eksisting, sudah dikonfirmasi tidak terkait di sesi sebelumnya, boleh tetap ada).

- [ ] **Step 9: Jalankan test yang ada, perbaiki mock kalau perlu**

Run: `cd apps/stok && yarn vitest run src/hooks/__tests__/useMonitoringData.test.tsx`
Kalau ada test yang mock `supabase.from()` dan gagal karena `attachSatuanKecil` sekarang query tambahan ke `bahan_baku`, tambah case `bahan_baku` di mock (kembalikan array kosong/data null cukup) — sama seperti pola fix yang sudah dilakukan di `monitoring-detail-access.test.ts` pada sesi sebelumnya.

- [ ] **Step 10: Commit**

```bash
git add apps/stok/src/lib/types/monitoring.ts apps/stok/src/lib/queries/monitoring.ts apps/stok/src/hooks/__tests__/useMonitoringData.test.tsx
git commit -m "feat(stok): batch-join satuan_kecil/faktor_tampilan into monitoring fetchers"
```
(Sertakan file test hanya kalau memang diubah di Step 9.)

---

### Task 2: Wire formatter ke `LiveMonitoringPage.tsx`

**Files:**
- Modify: `apps/stok/src/components/monitoring/LiveMonitoringPage.tsx`

- [ ] **Step 1: Tambah import**

Tambah setelah import `fetchOutletsList`:
```typescript
import { formatCompositeSaldo } from '@/lib/format/compositeUnit';
```

- [ ] **Step 2: Ganti tampilan qty di outlet card (low-item row)**

Cari blok ini (sekitar baris 297-300):
```typescript
                  <p className="text-xs font-black font-mono text-[#ba1a1a] leading-none flex-shrink-0">
                    {item.current_qty}<span className="text-[10px] font-medium text-suka-brown/50 font-sans">/{item.threshold}</span>
                  </p>
```
Ganti jadi:
```typescript
                  <p className="text-xs font-black font-mono text-[#ba1a1a] leading-none flex-shrink-0">
                    {formatCompositeSaldo(item.current_qty, '', item.satuan_kecil, item.faktor_tampilan).replace(/\s*$/, '')}<span className="text-[10px] font-medium text-suka-brown/50 font-sans">/{item.threshold}</span>
                  </p>
```
Catatan: `satuan` sengaja dikosongkan (`''`) di panggilan ini karena tampilan aslinya memang tidak menyertakan satuan di sini (cuma angka current_qty/threshold) — kalau `item.satuan_kecil` null, formatter fallback ke `"{qty} "` (ada spasi trailing kosong), makanya di-`.replace(/\s*$/, '')` untuk buang spasi sisa supaya tampilan tidak berubah untuk bahan tanpa satuan_kecil.

- [ ] **Step 3: Ganti tampilan qty di Top-3 Kritis panel**

Cari blok ini (sekitar baris 460-462):
```typescript
                      <p className="text-xs font-black font-mono text-[#ba1a1a] mt-0.5 leading-none">
                        {it.current_qty}/{it.threshold} <span className="text-[8px] font-bold">{it.satuan}</span>
                      </p>
```
Ganti jadi:
```typescript
                      <p className="text-xs font-black font-mono text-[#ba1a1a] mt-0.5 leading-none">
                        {formatCompositeSaldo(it.current_qty, it.satuan, it.satuan_kecil, it.faktor_tampilan)}/{it.threshold}
                      </p>
```
Catatan: di sini `satuan` sudah ikut ditampilkan oleh formatter (baik fallback plain `"{qty} {satuan}"` maupun majemuk `"N {satuan} + M {satuan_kecil}"`), jadi `<span>{it.satuan}</span>` yang lama DIHAPUS (sudah termasuk dalam output formatter).

- [ ] **Step 4: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/monitoring/LiveMonitoringPage.tsx
git commit -m "feat(stok): show composite unit format in monitoring-live board"
```

---

### Task 3: Wire formatter ke `CrewDashboard.tsx` + `CrewList.tsx`

**Files:**
- Modify: `apps/stok/src/components/monitoring/CrewDashboard.tsx`
- Modify: `apps/stok/src/components/monitoring/CrewList.tsx`

- [ ] **Step 1: `CrewDashboard.tsx` — tambah import**

Tambah setelah `import { BottomNav } ...`:
```typescript
import { formatCompositeSaldo } from '@/lib/format/compositeUnit';
```

- [ ] **Step 2: Ganti blok "Peringatan Kritis" (sekitar baris 213-215)**

Dari:
```typescript
                        <span className="text-xs text-gray-600">
                          {item.current_qty} {item.satuan} / <span className="font-bold text-[#a43c26]">Reorder {item.threshold} {item.satuan}</span>
                        </span>
```
Jadi:
```typescript
                        <span className="text-xs text-gray-600">
                          {formatCompositeSaldo(item.current_qty, item.satuan, item.satuan_kecil, item.faktor_tampilan)} / <span className="font-bold text-[#a43c26]">Reorder {item.threshold} {item.satuan}</span>
                        </span>
```

- [ ] **Step 3: `CrewList.tsx` — tambah import**

Tambah setelah `import { Skeleton } ...`:
```typescript
import { formatCompositeSaldo } from '@/lib/format/compositeUnit';
```

- [ ] **Step 4: Ganti blok qty (sekitar baris 236-238)**

Dari:
```typescript
                  <span className="font-bold text-gray-900 text-sm">
                    {item.current_qty} {item.satuan} / {item.threshold} {item.satuan} {item.threshold === 0 ? ' (no threshold)' : ''}
                  </span>
```
Jadi:
```typescript
                  <span className="font-bold text-gray-900 text-sm">
                    {formatCompositeSaldo(item.current_qty, item.satuan, item.satuan_kecil, item.faktor_tampilan)} / {item.threshold} {item.satuan} {item.threshold === 0 ? ' (no threshold)' : ''}
                  </span>
```

- [ ] **Step 5: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru.

- [ ] **Step 6: Jalankan test terkait**

Run: `cd apps/stok && yarn vitest run src/components/monitoring/__tests__/CrewDashboard.test.tsx`
Catatan: file ini punya kegagalan pra-eksisting yang TIDAK terkait perubahan ini (dikonfirmasi di sesi sebelumnya — masalah environment/mock, bukan kode). Kalau ada kegagalan BARU yang jelas disebabkan perubahan qty formatting, perbaiki; kalau kegagalan sama seperti sebelumnya, itu bukan tanggung jawab task ini.

- [ ] **Step 7: Commit**

```bash
git add apps/stok/src/components/monitoring/CrewDashboard.tsx apps/stok/src/components/monitoring/CrewList.tsx
git commit -m "feat(stok): show composite unit format in crew dashboard"
```

---

### Task 4: Wire formatter ke `SPVDashboard.tsx` + `SPVTable.tsx`

**Files:**
- Modify: `apps/stok/src/components/monitoring/SPVDashboard.tsx`
- Modify: `apps/stok/src/components/monitoring/SPVTable.tsx`

- [ ] **Step 1: `SPVDashboard.tsx` — tambah import**

Tambah di antara import lain (setelah `import { useSPVMonitoringData, ... } from '@/hooks/useMonitoringData';` atau baris import sejenis):
```typescript
import { formatCompositeSaldo, formatCompositeDelta } from '@/lib/format/compositeUnit';
```

- [ ] **Step 2: Ganti blok Critical Stock Alerts (sekitar baris 320)**

Dari:
```typescript
                        <p className="text-[10px] text-red-800 font-medium">
                          Stok kritis di {alert.outlet_name.replace('SUKA SHAWARMA ', '')} ({alert.current_qty} {alert.satuan})
                        </p>
```
Jadi:
```typescript
                        <p className="text-[10px] text-red-800 font-medium">
                          Stok kritis di {alert.outlet_name.replace('SUKA SHAWARMA ', '')} ({formatCompositeSaldo(alert.current_qty, alert.satuan, alert.satuan_kecil, alert.faktor_tampilan)})
                        </p>
```

- [ ] **Step 3: Ganti blok Prediksi Habis (sekitar baris 798)**

Dari:
```typescript
                            <p className="text-[10px] text-red-800 font-medium">Sisa {f.days_left * 24} jam ({f.current_qty} {f.satuan})</p>
```
Jadi:
```typescript
                            <p className="text-[10px] text-red-800 font-medium">Sisa {f.days_left * 24} jam ({formatCompositeSaldo(f.current_qty, f.satuan ?? '', f.satuan_kecil, f.faktor_tampilan)})</p>
```

- [ ] **Step 4: Ganti blok Live Activity feed qty (sekitar baris 837)**

Dari:
```typescript
                                {isAdd ? '+' : ''}{l.qty}
```
Jadi:
```typescript
                                {formatCompositeDelta(l.qty, l.satuan ?? '', l.satuan_kecil, l.faktor_tampilan)}
```
Catatan: `formatCompositeDelta` sudah menyertakan tanda `+`/`-` sendiri, jadi `{isAdd ? '+' : ''}` yang lama dihapus (tidak dobel tanda plus).

- [ ] **Step 5: `SPVTable.tsx` — tambah import**

Tambah setelah `import { Skeleton } ...`:
```typescript
import { formatCompositeSaldo } from '@/lib/format/compositeUnit';
```

- [ ] **Step 6: Ganti blok qty kolom tabel (sekitar baris 334-337)**

Dari:
```typescript
                      {item.current_qty}{' '}
                      <span className="text-xs font-normal text-suka-brown/50">
                        {item.satuan || 'kg'}
                      </span>
```
Jadi:
```typescript
                      {formatCompositeSaldo(item.current_qty, item.satuan || 'kg', item.satuan_kecil, item.faktor_tampilan)}
```
Catatan: kolom threshold di baris ~366 (`{item.threshold}`, editable cell) **tidak diubah** — itu angka konfigurasi, bukan qty stok aktual.

- [ ] **Step 7: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru.

- [ ] **Step 8: Commit**

```bash
git add apps/stok/src/components/monitoring/SPVDashboard.tsx apps/stok/src/components/monitoring/SPVTable.tsx
git commit -m "feat(stok): show composite unit format in SPV dashboard and table"
```

---

### Task 5: Full verification

- [ ] **Step 1: Jalankan semua test**

Run: `cd apps/stok && yarn vitest run`
Expected: hasil sama seperti baseline sesi sebelumnya (108 lolos, 3 gagal pra-eksisting tidak terkait: `SPVDashboard.test.tsx`, `CrewDashboard.test.tsx`, `PermintaanForm.test.tsx`) — tidak ada kegagalan BARU.

- [ ] **Step 2: Type-check seluruh app**

Run: `cd apps/stok && yarn type-check`
Expected: hanya error pra-eksisting `OpnameForm.tsx` TS6133.

- [ ] **Step 3: Manual smoke test (browser)** — catat sebagai pending untuk manusia (tidak ada dev server/DB live selama implementasi).

Checklist untuk manusia:
- [ ] Papan monitoring-live: outlet card & Top-3 Kritis tampilkan format majemuk untuk 8 bahan yang sudah dikonfigurasi (MINYAK SAYUR, FOIL, KULIT 25/28/32, KEJU, SAPI, GAS 3Kg), bahan lain tampil seperti biasa
- [ ] Dashboard Crew: Peringatan Kritis widget format majemuk
- [ ] Dashboard SPV: Critical Alerts, Prediksi Habis, Live Activity feed format majemuk
- [ ] Tabel SPV & CrewList: kolom qty format majemuk, kolom threshold tidak berubah

- [ ] **Step 4: Final commit (kalau ada perbaikan dari smoke test)**

```bash
git add -A
git commit -m "fix(stok): address issues found during monitoring dashboard composite unit smoke test"
```
(Skip kalau tidak ada perubahan.)

## Non-goals (sesi ini)
- `DetailOutletMonitoring.tsx`, `TransferModal.tsx`, `TransferSuggestionPanel.tsx` — di luar scope, bisa menyusul sesi lain pakai pola yang sama.
