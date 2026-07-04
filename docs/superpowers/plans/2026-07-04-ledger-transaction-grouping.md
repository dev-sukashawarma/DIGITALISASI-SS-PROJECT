# Grouping Ledger per Transaksi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman ledger (`apps/stok`) menampilkan 1 card per transaksi (order/opname/kiriman/transfer) — bukan 1 card per baris bahan — dengan expand inline untuk lihat detail bahan yang terpengaruh + sisa stok.

**Architecture:** View database baru mengagregasi `ledger_stok` per kunci transaksi (`COALESCE(ref_order_id, ref_opname_id, ref_shipment_id, ref_transfer_id, id)`). List page query view ini (paginasi per transaksi). Klik card → expand inline, fetch detail lazy via hook terpisah (react-query cache per key).

**Tech Stack:** Next.js (apps/stok), Supabase Postgres (view), React Query, Vitest.

**Prasyarat:** Plan `2026-07-04-ledger-composite-unit-display.md` sudah dieksekusi (pakai `formatCompositeSaldo`/`formatCompositeDelta` dari `@/lib/format/compositeUnit`).

Spec: `docs/superpowers/specs/2026-07-04-ledger-transaction-grouping-design.md`

---

### Task 1: Migration — view `ledger_transaksi_ringkas`

**Files:**
- Create: `supabase/migrations/20260704220000_ledger_transaksi_ringkas_view.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- 20260704220000_ledger_transaksi_ringkas_view.sql
-- View agregasi ledger_stok per transaksi (bukan per baris bahan), untuk halaman
-- ledger list. Kunci grup: ref_order_id/ref_opname_id/ref_shipment_id/ref_transfer_id
-- (baris-baris dari 1 event, mis. 1 order selesai, berbagi ref yang sama). Baris
-- tanpa ref sama sekali (adjustment/waste manual) jadi grup 1-anggota (fallback ke id).
--
-- View biasa (BUKAN security definer) -- tunduk RLS ledger_read yang sudah ada
-- di ledger_stok, tidak ada perubahan akses.
--
-- Kolom single_* hanya valid dipakai saat jumlah_bahan = 1 (grup manual):
-- MAX() atas 1 baris = nilai baris itu sendiri, dipakai UI supaya card manual
-- tidak perlu extra query terpisah.

CREATE VIEW ledger_transaksi_ringkas AS
SELECT
  COALESCE(ref_order_id::text, ref_opname_id::text, ref_shipment_id::text, ref_transfer_id::text, id::text) AS transaksi_key,
  outlet_id,
  MIN(created_at) AS created_at,
  COUNT(*) AS jumlah_bahan,
  MAX(ref_order_id) AS ref_order_id,
  MAX(ref_opname_id) AS ref_opname_id,
  MAX(ref_shipment_id) AS ref_shipment_id,
  MAX(ref_transfer_id) AS ref_transfer_id,
  MAX(bahan_baku_id) AS single_bahan_baku_id,
  MAX(tipe) AS single_tipe,
  MAX(qty) AS single_qty,
  MAX(catatan) AS single_catatan,
  MAX(saldo_sesudah) AS single_saldo_sesudah
FROM ledger_stok
GROUP BY 1, outlet_id;

COMMENT ON VIEW ledger_transaksi_ringkas IS
  'Agregasi ledger_stok per transaksi (order/opname/kiriman/transfer/manual) untuk halaman ledger list. single_* hanya valid saat jumlah_bahan=1.';
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: applied tanpa error.

- [ ] **Step 3: Verifikasi manual**

Run (SQL editor):
```sql
SELECT transaksi_key, jumlah_bahan, ref_order_id, ref_opname_id
FROM ledger_transaksi_ringkas
ORDER BY created_at DESC LIMIT 5;
```
Expected: baris dengan `ref_order_id` terisi punya `jumlah_bahan > 1` kalau order tsb punya resep multi-bahan; baris manual punya `jumlah_bahan = 1` dan semua `ref_*` NULL.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260704220000_ledger_transaksi_ringkas_view.sql
git commit -m "feat(db): add ledger_transaksi_ringkas view for transaction grouping"
```

---

### Task 2: Types untuk transaksi ringkas & detail

**Files:**
- Modify: `apps/stok/src/types/stok.ts`

- [ ] **Step 1: Tambah 2 interface baru di akhir file**

```typescript
export interface LedgerTransaksiSummary {
  transaksi_key: string
  outlet_id: string
  created_at: string
  jumlah_bahan: number
  ref_order_id: string | null
  ref_opname_id: string | null
  ref_shipment_id: string | null
  ref_transfer_id: string | null
  single_bahan_baku_id: string | null
  single_tipe: LedgerTipe | null
  single_qty: number | null
  single_catatan: string | null
  single_saldo_sesudah: number | null
  order_number?: number | null
  opname_tanggal?: string | null
  opname_tipe?: OpnameTipe | null
}

export interface LedgerTransaksiDetailRow {
  id: string
  tipe: LedgerTipe
  qty: number
  catatan: string | null
  saldo_sebelum: number
  saldo_sesudah: number
  created_at: string
  bahan_baku: { nama: string; satuan: Satuan; satuan_kecil: SatuanKecil | null; faktor_tampilan: number | null } | null
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/types/stok.ts
git commit -m "feat(stok): add types for ledger transaction grouping"
```

---

### Task 3: Hook `useLedgerTransaksiList` & `useLedgerTransaksiDetail`

**Files:**
- Modify: `apps/stok/src/hooks/useLedger.ts`

- [ ] **Step 1: Ganti isi file**

Hapus `useLedgerList` (tidak dipakai lagi setelah Task 4), ganti dengan implementasi baru. Isi lengkap file baru:

```typescript
'use client'
import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { LedgerStok, LedgerTipe, LedgerTransaksiSummary, LedgerTransaksiDetailRow } from '@/types/stok'

const PAGE_SIZE = 50

export function useLedgerTransaksiList(outletId: string | null | undefined, page = 0) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger-transaksi', outletId, page],
    queryFn: async () => {
      const supabase = createClient()
      const { data: rows, error: err } = await supabase
        .from('ledger_transaksi_ringkas')
        .select('*')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (err) throw err

      const summaries = (rows as LedgerTransaksiSummary[]) ?? []

      const orderIds = [...new Set(summaries.map((s) => s.ref_order_id).filter((v): v is string => !!v))]
      const opnameIds = [...new Set(summaries.map((s) => s.ref_opname_id).filter((v): v is string => !!v))]

      const [ordersRes, opnameRes] = await Promise.all([
        orderIds.length
          ? supabase.from('orders').select('id, order_number').in('id', orderIds)
          : Promise.resolve({ data: [] as { id: string; order_number: number }[] }),
        opnameIds.length
          ? supabase.from('opname').select('id, tanggal, tipe').in('id', opnameIds)
          : Promise.resolve({ data: [] as { id: string; tanggal: string; tipe: string }[] }),
      ])

      const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o.order_number]))
      const opnameMap = new Map((opnameRes.data ?? []).map((o) => [o.id, o]))

      return summaries.map((s) => ({
        ...s,
        order_number: s.ref_order_id ? orderMap.get(s.ref_order_id) ?? null : null,
        opname_tanggal: s.ref_opname_id ? opnameMap.get(s.ref_opname_id)?.tanggal ?? null : null,
        opname_tipe: s.ref_opname_id ? (opnameMap.get(s.ref_opname_id)?.tipe as LedgerTransaksiSummary['opname_tipe']) ?? null : null,
      }))
    },
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })
  return { transaksi: data ?? [], loading: isLoading, error: error ? (error as Error).message : null }
}

export function useLedgerTransaksiDetail(outletId: string | null | undefined, transaksiKey: string | null, enabled: boolean) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger-transaksi-detail', outletId, transaksiKey],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('ledger_stok')
        .select('id, tipe, qty, catatan, saldo_sebelum, saldo_sesudah, created_at, bahan_baku(nama, satuan, satuan_kecil, faktor_tampilan)')
        .eq('outlet_id', outletId)
        .or(`ref_order_id.eq.${transaksiKey},ref_opname_id.eq.${transaksiKey},ref_shipment_id.eq.${transaksiKey},ref_transfer_id.eq.${transaksiKey},id.eq.${transaksiKey}`)
        .order('created_at', { ascending: true })
      if (err) throw err
      return (data as unknown as LedgerTransaksiDetailRow[]) ?? []
    },
    enabled: enabled && !!outletId && !!transaksiKey,
    staleTime: 60000,
    gcTime: 5 * 60000,
  })
  return { rows: data ?? [], loading: isLoading, error: error ? (error as Error).message : null }
}

export interface ManualEntryInput {
  outletId: string; bahanBakuId: string; tipe: Extract<LedgerTipe,'waste'|'adjustment'|'transfer_keluar'>
  qtyAbs: number; catatan: string; createdBy: string
}

export function useLedgerActions() {
  const supabase = createClient()
  const addManual = useCallback(async (input: ManualEntryInput, signedOverride?: number) => {
    const qty = signedOverride ?? (input.tipe === 'adjustment' ? input.qtyAbs : -Math.abs(input.qtyAbs))
    const { error } = await supabase.from('ledger_stok').insert({
      outlet_id: input.outletId, bahan_baku_id: input.bahanBakuId,
      tipe: input.tipe, qty, catatan: input.catatan, created_by: input.createdBy,
    })
    if (error) throw new Error(error.message)
  }, [])
  return { addManual }
}
```

Catatan: `LedgerStok` import dipertahankan meski tidak dipakai langsung di file ini setelah perubahan — cek dengan type-check di Step 2, hapus dari import kalau muncul warning unused.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error. Kalau `LedgerStok` unused, hapus dari baris import.

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/hooks/useLedger.ts
git commit -m "feat(stok): add useLedgerTransaksiList/Detail hooks for grouped ledger"
```

---

### Task 4: Rombak `LedgerList.tsx` jadi accordion per transaksi

**Files:**
- Modify: `apps/stok/src/components/stok/LedgerList.tsx` (rombak total)
- Modify: `apps/stok/src/app/stok/ledger/page.tsx:7,16,69,86`

- [ ] **Step 1: Ganti isi `LedgerList.tsx` seluruhnya**

```typescript
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LedgerTransaksiSummary } from '@/types/stok';
import { useBahanBaku } from '@/hooks/useBahanBaku';
import { useLedgerTransaksiDetail } from '@/hooks/useLedger';
import { useOutletScope } from '@/hooks/useOutletScope';
import { formatCompositeSaldo, formatCompositeDelta } from '@/lib/format/compositeUnit';

const LABEL: Record<string, string> = {
  terima_kiriman: 'Terima Kiriman',
  pemakaian: 'Pemakaian',
  waste: 'Waste',
  adjustment: 'Penyesuaian',
  opname_selisih: 'Selisih Opname',
  transfer_keluar: 'Transfer Keluar',
  transfer_masuk: 'Transfer Masuk',
};

const FILTER_LABELS: Record<string, string> = {
  all: 'Semua',
  inbound: 'Masuk 📥',
  outbound: 'Keluar / Waste 🗑️',
  adjustment: 'Penyesuaian ⚖️',
};

export function transaksiLabel(t: LedgerTransaksiSummary): { title: string; subtitle: string | null } {
  if (t.ref_order_id) {
    return { title: 'Order Selesai', subtitle: t.order_number ? `Order #${t.order_number}` : null };
  }
  if (t.ref_opname_id) {
    const tanggal = t.opname_tanggal
      ? new Date(t.opname_tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    return { title: 'Opname', subtitle: tanggal ? `${t.opname_tipe ?? ''} — ${tanggal}` : null };
  }
  if (t.ref_shipment_id) {
    return { title: 'Terima Kiriman', subtitle: null };
  }
  if (t.ref_transfer_id) {
    return { title: 'Transfer Stok', subtitle: null };
  }
  return { title: LABEL[t.single_tipe ?? ''] ?? (t.single_tipe ?? 'Manual'), subtitle: null };
}

function getRelativeTimeString(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins <= 0 ? 1 : diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TransaksiExpandedDetail({ outletId, transaksiKey }: { outletId: string; transaksiKey: string }) {
  const { rows, loading, error } = useLedgerTransaksiDetail(outletId, transaksiKey, true);

  if (loading) return <p className="text-[10px] font-bold text-[#544437]/50 py-2 animate-pulse">Memuat detail...</p>;
  if (error) return <p className="text-[10px] font-bold text-[#ba1a1a] py-2">Gagal memuat: {error}</p>;

  return (
    <div className="mt-3 pt-3 border-t border-[#d9c2b2]/25 space-y-2">
      {rows.map((r) => {
        const bahan = r.bahan_baku;
        const satuan = bahan?.satuan ?? '';
        return (
          <div key={r.id} className="flex justify-between items-center text-[10px]">
            <span className="font-bold text-[#1e1b15] uppercase truncate pr-2">{bahan?.nama ?? 'Bahan'}</span>
            <span className="text-right flex-shrink-0">
              <span className={r.qty > 0 ? 'text-[#0a7d2c] font-bold' : 'text-[#ba1a1a] font-bold'}>
                {formatCompositeDelta(r.qty, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)}
              </span>
              <span className="text-[#544437]/50 font-medium">
                {' '}→ sisa {formatCompositeSaldo(r.saldo_sesudah, satuan, bahan?.satuan_kecil ?? null, bahan?.faktor_tampilan ?? null)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LedgerList({ items }: { items: LedgerTransaksiSummary[] }) {
  const { bahanBaku } = useBahanBaku();
  const { selectedOutletId } = useOutletScope();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const bahanMap = useMemo(() => {
    const map: Record<string, { nama: string; satuan: string; satuanKecil: string | null; faktorTampilan: number | null }> = {};
    for (const b of bahanBaku) {
      map[b.id] = { nama: b.nama, satuan: b.satuan, satuanKecil: b.satuan_kecil, faktorTampilan: b.faktor_tampilan };
    }
    return map;
  }, [bahanBaku]);

  const filteredItems = useMemo(() => {
    return items.filter((t) => {
      const { title, subtitle } = transaksiLabel(t);
      const singleBahan = t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id] : undefined;
      const nameMatch = singleBahan ? singleBahan.nama.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const refMatch = `${title} ${subtitle ?? ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = searchTerm === '' || nameMatch || refMatch;

      let matchesFilter = false;
      const tipe = t.jumlah_bahan === 1 ? t.single_tipe : null;
      if (activeFilter === 'all') {
        matchesFilter = true;
      } else if (activeFilter === 'inbound') {
        matchesFilter = !!t.ref_order_id === false && (tipe ? ['terima_kiriman', 'transfer_masuk'].includes(tipe) : !!t.ref_shipment_id);
      } else if (activeFilter === 'outbound') {
        matchesFilter = !!t.ref_order_id || (tipe ? ['pemakaian', 'waste', 'transfer_keluar'].includes(tipe) : false);
      } else if (activeFilter === 'adjustment') {
        matchesFilter = !!t.ref_opname_id || (tipe ? ['adjustment', 'opname_selisih'].includes(tipe) : false);
      }

      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, activeFilter, bahanMap]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-2.5 pl-9 rounded-xl border border-[#d9c2b2]/40 bg-white focus:outline-none focus:ring-1 focus:ring-[#f29744] focus:border-[#f29744] text-xs text-[#1e1b15] placeholder-[#544437]/45 font-medium transition-all shadow-sm"
            placeholder="Cari nama bahan baku atau nomor order/opname..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#544437]/40 text-xs">🔍</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {Object.entries(FILTER_LABELS).map(([key, label]) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer shadow-sm ${
                  isActive
                    ? 'bg-[#701604] border-[#701604] text-white shadow-sm'
                    : 'bg-white border-[#d9c2b2]/40 text-[#544437]/80 hover:bg-[#fff8f1]/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {filteredItems.map((t) => {
          const { title, subtitle } = transaksiLabel(t);
          const isManual = t.jumlah_bahan === 1 && !t.ref_order_id && !t.ref_opname_id && !t.ref_shipment_id && !t.ref_transfer_id;
          const relativeTime = getRelativeTimeString(t.created_at);
          const isExpanded = expandedKey === t.transaksi_key;

          let icon = '⚖️';
          let bgClass = 'bg-[#faf2e9] text-[#701604] border-[#d9c2b2]/40';
          if (t.ref_order_id) {
            icon = '🧾';
            bgClass = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10';
          } else if (t.ref_opname_id) {
            icon = '📋';
          } else if (t.ref_shipment_id) {
            icon = '📥';
            bgClass = 'bg-[#93f997]/15 text-[#006e24] border-[#93f997]/25';
          } else if (t.ref_transfer_id) {
            icon = '📤';
            bgClass = 'bg-[#ffdcc2] text-[#904d00] border-[#ffdcc2]/10';
          } else if (t.single_tipe === 'terima_kiriman' || t.single_tipe === 'transfer_masuk') {
            icon = '📥';
            bgClass = 'bg-[#93f997]/15 text-[#006e24] border-[#93f997]/25';
          } else if (t.single_tipe === 'waste' || t.single_tipe === 'pemakaian') {
            icon = '🗑️';
            bgClass = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10';
          } else if (t.single_tipe === 'transfer_keluar') {
            icon = '📤';
            bgClass = 'bg-[#ffdcc2] text-[#904d00] border-[#ffdcc2]/10';
          }

          const cardBody = (
            <div className="bg-white rounded-2xl border border-[#d9c2b2]/45 p-4 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/45 hover:shadow-md transition-all duration-200 mb-2.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg flex-shrink-0 ${bgClass}`}>
                    {icon}
                  </span>
                  <div className="truncate space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2 py-0.5 rounded border border-[#d9c2b2]/30">
                        {title}
                      </span>
                      <span className="text-[10px] text-[#544437]/50 font-medium">{relativeTime}</span>
                    </div>
                    <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide truncate">
                      {isManual
                        ? (t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id]?.nama ?? 'Bahan Baku' : 'Bahan Baku')
                        : subtitle ?? `${t.jumlah_bahan} bahan`}
                    </h4>
                    {isManual && t.single_catatan && (
                      <p className="text-[9px] text-[#544437]/60 font-medium truncate mt-0.5">📝 {t.single_catatan}</p>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 space-y-0.5 pl-4">
                  {isManual ? (
                    <>
                      <p className={`font-bold text-sm ${(t.single_qty ?? 0) > 0 ? 'text-[#0a7d2c]' : 'text-[#ba1a1a]'}`}>
                        {(() => {
                          const bahan = t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id] : undefined;
                          const satuan = bahan?.satuan ?? '';
                          return formatCompositeDelta(t.single_qty ?? 0, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null);
                        })()}
                      </p>
                      <p className="text-[9px] text-[#544437]/60 font-bold bg-[#faf2e9]/50 px-2 py-0.5 rounded border border-[#d9c2b2]/20 inline-block mt-1">
                        Saldo: {(() => {
                          const bahan = t.single_bahan_baku_id ? bahanMap[t.single_bahan_baku_id] : undefined;
                          const satuan = bahan?.satuan ?? '';
                          return formatCompositeSaldo(t.single_saldo_sesudah ?? 0, satuan, bahan?.satuanKecil ?? null, bahan?.faktorTampilan ?? null);
                        })()}
                      </p>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold text-[#701604]/70">
                      {isExpanded ? '▲ Tutup' : '▼ Lihat Detail'}
                    </span>
                  )}
                </div>
              </div>

              {!isManual && isExpanded && selectedOutletId && (
                <TransaksiExpandedDetail outletId={selectedOutletId} transaksiKey={t.transaksi_key} />
              )}
            </div>
          );

          if (isManual) {
            return (
              <Link key={t.transaksi_key} href={`/stok/ledger/${t.transaksi_key}`}>
                <div className="cursor-pointer active:scale-[0.98] transition-all">{cardBody}</div>
              </Link>
            );
          }

          return (
            <button
              key={t.transaksi_key}
              type="button"
              className="w-full text-left cursor-pointer active:scale-[0.99] transition-all"
              onClick={() => setExpandedKey(isExpanded ? null : t.transaksi_key)}
            >
              {cardBody}
            </button>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#d9c2b2]/40 p-8 shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
            <span className="text-3xl">📭</span>
            <p className="font-bold text-sm text-[#701604]/80 mt-2">Belum Ada Catatan Pergerakan</p>
            <p className="text-xs text-gray-500 mt-1">Tidak ada transaksi yang cocok dengan pencarian atau filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `apps/stok/src/app/stok/ledger/page.tsx`**

Baris 7:
```typescript
import { useLedgerTransaksiList } from '@/hooks/useLedger';
```

Baris 16:
```typescript
  const { transaksi, loading, error } = useLedgerTransaksiList(selectedOutletId, page);
```

Baris 69:
```typescript
          <LedgerList items={transaksi || []} />
```

Baris 86 (tombol halaman berikutnya, ganti referensi `ledger` → `transaksi`):
```typescript
              disabled={(transaksi || []).length < 50}
```

Baris 73 (kondisi render pagination, ganti `ledger` → `transaksi`):
```typescript
        {!loading && (transaksi || []).length > 0 && (
```

- [ ] **Step 3: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 4: Manual smoke test**

Buka `/stok/ledger`:
- Order dengan >1 bahan → 1 card, badge "Order Selesai", label "N bahan", klik → expand tampilkan daftar bahan + sisa stok
- Opname → 1 card "Opname", subtitle tanggal
- Entri manual (waste/adjustment) → 1 card seperti sebelumnya, klik → navigasi ke halaman detail lama
- Search & filter pill tetap berfungsi
- Paginasi jalan (halaman berikutnya aktif kalau ada ≥50 transaksi)

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/stok/LedgerList.tsx apps/stok/src/app/stok/ledger/page.tsx
git commit -m "feat(stok): group ledger cards by transaction with inline expand"
```

---

### Task 5: Unit test label transaksi

**Files:**
- Create: `apps/stok/src/components/stok/__tests__/LedgerList.test.tsx`

- [ ] **Step 1: Tulis test untuk fungsi `transaksiLabel`**

`transaksiLabel` sudah diexport dari `LedgerList.tsx` (Task 4 Step 1), jadi bisa diimport langsung di test.

```typescript
// apps/stok/src/components/stok/__tests__/LedgerList.test.tsx
import { describe, it, expect } from 'vitest'
import { transaksiLabel } from '../LedgerList'
import type { LedgerTransaksiSummary } from '@/types/stok'

function makeSummary(overrides: Partial<LedgerTransaksiSummary>): LedgerTransaksiSummary {
  return {
    transaksi_key: 'x', outlet_id: 'o1', created_at: '2026-07-04T10:00:00Z',
    jumlah_bahan: 1, ref_order_id: null, ref_opname_id: null,
    ref_shipment_id: null, ref_transfer_id: null,
    single_bahan_baku_id: null, single_tipe: null, single_qty: null,
    single_catatan: null, single_saldo_sesudah: null,
    ...overrides,
  }
}

describe('transaksiLabel', () => {
  it('order -> label Order Selesai + nomor order', () => {
    const t = makeSummary({ ref_order_id: 'ord-1', order_number: 123, jumlah_bahan: 12 })
    expect(transaksiLabel(t)).toEqual({ title: 'Order Selesai', subtitle: 'Order #123' })
  })

  it('opname -> label Opname + tanggal', () => {
    const t = makeSummary({ ref_opname_id: 'op-1', opname_tanggal: '2026-07-04', opname_tipe: 'harian', jumlah_bahan: 5 })
    expect(transaksiLabel(t).title).toBe('Opname')
    expect(transaksiLabel(t).subtitle).toContain('harian')
  })

  it('manual (tanpa ref) -> label dari single_tipe', () => {
    const t = makeSummary({ single_tipe: 'waste' })
    expect(transaksiLabel(t)).toEqual({ title: 'Waste', subtitle: null })
  })

  it('shipment -> label Terima Kiriman tanpa subtitle', () => {
    const t = makeSummary({ ref_shipment_id: 'sh-1', jumlah_bahan: 3 })
    expect(transaksiLabel(t)).toEqual({ title: 'Terima Kiriman', subtitle: null })
  })
})
```

- [ ] **Step 2: Jalankan test**

Run: `cd apps/stok && yarn vitest run src/components/stok/__tests__/LedgerList.test.tsx`
Expected: PASS — 4 test lolos.

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/components/stok/LedgerList.tsx apps/stok/src/components/stok/__tests__/LedgerList.test.tsx
git commit -m "test(stok): add unit test for ledger transaction label logic"
```

---

### Task 6: Full verification

- [ ] **Step 1: Jalankan semua test**

Run: `cd apps/stok && yarn vitest run`
Expected: semua PASS.

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Manual smoke test (browser)**

Checklist:
- [ ] List ledger: order dengan 12 bahan tampil sebagai **1 card**, bukan 12
- [ ] Expand order → semua bahan muncul dgn qty + sisa stok (format majemuk untuk MINYAK SAYUR/FOIL kalau ada di resep tsb)
- [ ] Void/cancel order (kalau ada data test) → card yang sama menampilkan baris pemakaian + adjustment reversal saat expand
- [ ] Card manual (waste/adjustment) → tampilan sama seperti sebelumnya, klik navigasi ke halaman detail lama
- [ ] Paginasi berbasis transaksi (bukan baris) — cek jumlah card per halaman masuk akal

- [ ] **Step 4: Final commit (kalau ada perbaikan dari smoke test)**

```bash
git add -A
git commit -m "fix(stok): address issues found during ledger grouping smoke test"
```
(Skip kalau tidak ada perubahan.)
