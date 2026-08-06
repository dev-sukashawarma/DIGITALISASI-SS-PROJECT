# Marketplace Sales sebagai "Outlet Virtual" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah dropdown "SS Online" di Rangkuman Penjualan (`apps/admin-dashboard`) yang menampilkan TikTok Shop & Shopee sebagai "outlet virtual" berdiri sendiri — kosong sampai di-import nanti — tanpa mengganggu dropdown cabang fisik yang sudah ada.

**Architecture:** 2 baris baru di tabel `outlets` (ditandai `type='marketplace'`) memakai skema `orders`/`order_items` yang sama persis dengan outlet fisik, sehingga seluruh KPI/tabel yang sudah ada di Rangkuman Penjualan otomatis berfungsi tanpa perubahan logic. UI menambah 1 dropdown baru (`MarketplaceFilter.tsx`) yang menulis ke state `selectedOutlet` yang sama dengan dropdown cabang, saling reset via nilai turunan yang dihitung di `ReportsView.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres, Vitest (unit test lib murni saja — komponen React di app ini tidak diuji otomatis, lihat konvensi `*.test.tsx.skip` di `src/components/`).

## Global Constraints

- Spec sumber: `docs/superpowers/specs/2026-08-05-marketplace-sales-outlet-design.md`.
- Scope: HANYA `apps/admin-dashboard` + 1 migration DB. Audit lintas-app (stok/absensi/distribusi) **secara sadar TIDAK termasuk** plan ini — lihat catatan di Task 6.
- **Deviasi dari spec (ditemukan saat riset teknis, didokumentasikan di sini):** spec menyebut nilai `sales_source = 'shopee'`, tapi `apps/admin-dashboard/src/lib/channels.ts` `getChannel()` sudah punya alias `'shopee' → shopeefood` (channel food delivery yang sudah ada). Memakai `'shopee'` akan membuat order marketplace baru salah resolve jadi label "ShopeeFood". Plan ini memakai **`'shopee_shop'`** sebagai nilai `sales_source` untuk menghindari tabrakan. `'tiktok_shop'` aman dipakai apa adanya (tidak ada di alias manapun).
- Tidak ada perubahan pada `BranchFilter.tsx` — hanya prop yang dikirim ke situ yang berubah, komponennya sendiri tidak disentuh.
- **Deviasi lain dari spec:** spec §4 menyebut `lib/order-source.ts` perlu ditambah 2 entri channel. Setelah ditelusuri, `resolveOrderSource()` di file itu murni delegasi ke `getChannel()` (`lib/channels.ts`) tanpa logic tambahan spesifik untuk id channel baru — jadi cukup menambah entri di `channels.ts` (Task 3), `order-source.ts` sendiri **tidak perlu diubah**.
- Halaman import (`/dashboard/marketplace-import`) dan parser per-platform TIDAK termasuk plan ini (lihat spec §7 — menunggu sesi terpisah).

---

## Task 1: Migration — outlet virtual + perluas constraint `sales_source`

**Files:**
- Create: `supabase/migrations/20260805100000_marketplace_virtual_outlets.sql`

**Interfaces:**
- Produces: 2 baris baru `outlets` dengan `type='marketplace'`, `slug` `'tiktok-shop'` dan `'shopee'`. CHECK constraint `orders_sales_source_check` diperluas menerima `'tiktok_shop'` dan `'shopee_shop'`.

- [ ] **Step 1: Verifikasi constraint name yang akan diubah**

Jalankan (via Supabase SQL editor atau `supabase db query "..." --linked` sesuai kebiasaan project ini):
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass AND conname LIKE '%sales_source%';
```
Expected: satu baris, `conname = orders_sales_source_check`, definisi `CHECK (sales_source = ANY (ARRAY['pos'::text,'online'::text,'gofood'::text,'grabfood'::text,'shopeefood'::text,'tiktok'::text]))`. Ini konfirmasi nama constraint sebelum di-drop (mencegah insiden "drop constraint yang salah" seperti yang berulang kali dicatat di CLAUDE.md project ini untuk fungsi lain).

- [ ] **Step 2: Tulis file migration**

```sql
-- 20260805100000_marketplace_virtual_outlets.sql
-- Outlet virtual untuk platform marketplace nasional (TikTok Shop, Shopee) yang TIDAK
-- terikat ke outlet fisik manapun. Ditampilkan HANYA lewat dropdown "SS Online" baru di
-- Rangkuman Penjualan (apps/admin-dashboard) -- lihat
-- docs/superpowers/specs/2026-08-05-marketplace-sales-outlet-design.md.
--
-- type='marketplace' membedakan baris ini dari outlet fisik. App lain (stok/absensi/
-- distribusi) yang menampilkan daftar outlet untuk keperluan operasional fisik WAJIB
-- menyaring `type != 'marketplace'` di query-nya -- lihat spec §5 (belum diaudit di
-- plan ini, scope sengaja dibatasi ke admin-dashboard).

INSERT INTO public.outlets (id, slug, name, lat, lng, type, is_active)
VALUES
  (gen_random_uuid(), 'tiktok-shop', 'TikTok Shop', 0, 0, 'marketplace', true),
  (gen_random_uuid(), 'shopee', 'Shopee', 0, 0, 'marketplace', true)
ON CONFLICT (slug) DO NOTHING;

-- Perluas CHECK constraint orders.sales_source (didefinisikan di
-- 20260619100000_orders_sales_source.sql sebagai orders_sales_source_check).
-- 'shopee_shop' dipakai (bukan 'shopee') karena 'shopee' sudah dialiaskan ke channel
-- ShopeeFood (delivery) di apps/admin-dashboard/src/lib/channels.ts getChannel().
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_sales_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_sales_source_check
  CHECK (sales_source IN ('pos','online','gofood','grabfood','shopeefood','tiktok','tiktok_shop','shopee_shop'));
```

- [ ] **Step 3: Cek drift sebelum push**

Jalankan:
```bash
supabase migration list
```
Expected: tidak ada migration remote-only yang belum dikenal di antara migration lokal terbaru. Kalau ada (drift dari developer lain, sering terjadi di project ini per catatan CLAUDE.md), JANGAN jalankan `migration repair` sepihak — laporkan ke user dulu.

- [ ] **Step 4: Konfirmasi ke user sebelum push ke DB shared**

Migration ini bersifat aditif (INSERT + ALTER CONSTRAINT, tidak menghapus/mengubah data existing), tapi tetap menyentuh database produksi bersama. **Tampilkan isi file migration ke user dan minta konfirmasi eksplisit sebelum menjalankan `supabase db push`.**

- [ ] **Step 5: Push migration (setelah dikonfirmasi user)**

```bash
supabase db push
```
Expected: migration `20260805100000_marketplace_virtual_outlets.sql` berhasil applied.

- [ ] **Step 6: Verifikasi ground-truth di DB live**

```sql
SELECT id, slug, name, type FROM public.outlets WHERE type = 'marketplace';
```
Expected: 2 baris, "TikTok Shop" dan "Shopee".

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260805100000_marketplace_virtual_outlets.sql
git commit -m "feat(db): add TikTok Shop & Shopee virtual outlets for marketplace sales"
```

---

## Task 2: Perluas type `SalesSource` + perbaiki Record yang jadi tidak-exhaustive

**Files:**
- Modify: `apps/admin-dashboard/src/lib/types.ts:132`
- Modify: `apps/admin-dashboard/src/lib/channelGroups.ts`
- Modify: `apps/admin-dashboard/src/components/SourceBreakdown.tsx`

**Interfaces:**
- Consumes: tidak ada (tipe murni).
- Produces: `SalesSource` sekarang mencakup `'tiktok_shop'` dan `'shopee_shop'`. Setiap `Record<SalesSource, ...>` di codebase HARUS mencakup kedua key ini atau TypeScript akan gagal compile (`yarn type-check` akan menangkap ini kalau ada yang terlewat — jangan asumsikan daftar 2 file di atas sudah final tanpa menjalankan type-check).

- [ ] **Step 1: Perluas union type**

Di `apps/admin-dashboard/src/lib/types.ts:132`, ubah:
```ts
export type SalesSource = 'pos' | 'online' | 'gofood' | 'grabfood' | 'shopeefood' | 'tiktok'
```
menjadi:
```ts
export type SalesSource = 'pos' | 'online' | 'gofood' | 'grabfood' | 'shopeefood' | 'tiktok' | 'tiktok_shop' | 'shopee_shop'
```

- [ ] **Step 2: Jalankan type-check untuk menemukan semua Record yang jadi tidak-exhaustive**

```bash
cd apps/admin-dashboard && yarn type-check
```
Expected: error di `src/lib/channelGroups.ts` dan `src/components/SourceBreakdown.tsx` (Property 'tiktok_shop'/'shopee_shop' is missing). Kalau ada file LAIN yang muncul di error selain 2 ini, tambahkan sebagai step baru di sini sebelum lanjut (spec/plan tidak bisa memprediksi 100% tanpa menjalankan compiler).

- [ ] **Step 3: Perbaiki `channelGroups.ts`**

Di `apps/admin-dashboard/src/lib/channelGroups.ts`, ubah:
```ts
const MAP: Record<SalesSource, ChannelGroup> = {
  pos: 'offline',
  online: 'online',
  gofood: 'foodapps',
  shopeefood: 'foodapps',
  grabfood: 'foodapps',
  tiktok: 'tiktok',
}
```
menjadi:
```ts
const MAP: Record<SalesSource, ChannelGroup> = {
  pos: 'offline',
  online: 'online',
  gofood: 'foodapps',
  shopeefood: 'foodapps',
  grabfood: 'foodapps',
  tiktok: 'tiktok',
  tiktok_shop: 'tiktok',
  shopee_shop: 'online',
}
```

- [ ] **Step 4: Perbaiki `SourceBreakdown.tsx`**

Di `apps/admin-dashboard/src/components/SourceBreakdown.tsx`, tambahkan key baru ke ketiga Record (posisi setelah `tiktok:` di masing-masing):

`LABELS` (setelah baris `tiktok: 'TikTok Shop / Social',`):
```ts
  tiktok_shop: 'TikTok Shop (Marketplace)',
  shopee_shop: 'Shopee (Marketplace)',
```

`BRAND_COLORS` (setelah baris `tiktok: '#000000',      // TikTok Black`):
```ts
  tiktok_shop: '#000000',  // TikTok Black
  shopee_shop: '#ee4d2d',  // Shopee Red-Orange
```

`ICONS` (setelah blok `tiktok: ({ className, style }: any) => { ... },`):
```ts
  tiktok_shop: ({ className, style }: any) => {
    const ch = getChannel('tiktok_shop')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
  shopee_shop: ({ className, style }: any) => {
    const ch = getChannel('shopee_shop')
    return ch?.logoPath ? (
      <svg viewBox="0 0 24 24" className={className} style={{ fill: style?.color || ch.bg }}>
        <path d={ch.logoPath} />
      </svg>
    ) : <Globe className={className} style={style} />
  },
```

Catatan: `getChannel('tiktok_shop')`/`getChannel('shopee_shop')` akan mengembalikan `null` sampai Task 3 selesai (fallback ke ikon `Globe`) — ini tidak menyebabkan error, cuma ikon belum final sampai Task 3 landing. Kedua task ada dalam plan yang sama jadi akan landing bersamaan.

- [ ] **Step 5: Jalankan type-check lagi, pastikan bersih**

```bash
cd apps/admin-dashboard && yarn type-check
```
Expected: 0 error baru terkait `SalesSource` (error pre-existing yang tidak berhubungan dengan perubahan ini boleh diabaikan, tapi verifikasi dulu bahwa itu benar pre-existing dengan `git stash` lalu jalankan type-check lagi untuk membandingkan).

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/lib/types.ts apps/admin-dashboard/src/lib/channelGroups.ts apps/admin-dashboard/src/components/SourceBreakdown.tsx
git commit -m "feat(admin-dashboard): extend SalesSource with tiktok_shop and shopee_shop"
```

---

## Task 3: Tambah definisi channel TikTok Shop & Shopee (marketplace)

**Files:**
- Modify: `apps/admin-dashboard/src/lib/channels.ts`
- Test: `apps/admin-dashboard/src/lib/channels.test.ts` (baru)

**Interfaces:**
- Consumes: tidak ada.
- Produces: `getChannel('tiktok_shop')` dan `getChannel('shopee_shop')` mengembalikan `ChannelConfig` baru. `getChannel('tiktok')`/`getChannel('shopee')` (alias lama) TETAP mengembalikan channel lama (`tiktokgo`/`shopeefood`) — regresi ini yang paling penting dicegah, makanya diuji eksplisit.

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/admin-dashboard/src/lib/channels.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getChannel } from './channels'

describe('getChannel — marketplace platforms', () => {
  it('resolves tiktok_shop to its own channel config', () => {
    const ch = getChannel('tiktok_shop')
    expect(ch?.id).toBe('tiktok_shop')
    expect(ch?.label).toBe('TikTok Shop')
  })

  it('resolves shopee_shop to its own channel config', () => {
    const ch = getChannel('shopee_shop')
    expect(ch?.id).toBe('shopee_shop')
    expect(ch?.label).toBe('Shopee')
  })

  it('does NOT let shopee_shop collide with the existing shopeefood alias', () => {
    const shopeeShop = getChannel('shopee_shop')
    const shopeeFoodAlias = getChannel('shopee')
    expect(shopeeShop?.id).not.toBe(shopeeFoodAlias?.id)
  })

  it('keeps the existing tiktok alias pointing at TikTok Go (unchanged)', () => {
    const ch = getChannel('tiktok')
    expect(ch?.id).toBe('tiktokgo')
    expect(ch?.label).toBe('TikTok Go')
  })

  it('keeps the existing shopee alias pointing at ShopeeFood (unchanged)', () => {
    const ch = getChannel('shopee')
    expect(ch?.id).toBe('shopeefood')
    expect(ch?.label).toBe('ShopeeFood')
  })
})
```

- [ ] **Step 2: Jalankan test, verifikasi gagal**

```bash
cd apps/admin-dashboard && yarn test src/lib/channels.test.ts
```
Expected: FAIL pada 2 test pertama (`getChannel('tiktok_shop')`/`getChannel('shopee_shop')` return `null` karena belum ada entrinya).

- [ ] **Step 3: Tambah entri channel**

Di `apps/admin-dashboard/src/lib/channels.ts`, tambahkan ke array `CHANNELS` (setelah baris `tiktokgo`, sebelum penutup `]`):
```ts
  { id: 'tiktok_shop', label: 'TikTok Shop', bg: '#000000', fg: '#FFFFFF', mark: 'TS' },
  { id: 'shopee_shop', label: 'Shopee', bg: '#EE4D2D', fg: '#FFFFFF', mark: 'Sp' },
```
Tidak ada perubahan pada fungsi `getChannel()` itu sendiri — kedua id baru ini tidak ada di alias manapun, jadi otomatis match lewat baris terakhir `return CHANNELS.find((c) => c.id === norm) ?? null`.

- [ ] **Step 4: Jalankan test lagi, verifikasi semua pass**

```bash
cd apps/admin-dashboard && yarn test src/lib/channels.test.ts
```
Expected: PASS, 5/5 test.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/channels.ts apps/admin-dashboard/src/lib/channels.test.ts
git commit -m "feat(admin-dashboard): add TikTok Shop and Shopee marketplace channel configs"
```

---

## Task 4: Helper murni untuk memisahkan outlet fisik vs marketplace

**Files:**
- Create: `apps/admin-dashboard/src/lib/marketplaceOutlets.ts`
- Test: `apps/admin-dashboard/src/lib/marketplaceOutlets.test.ts`

**Interfaces:**
- Consumes: `Outlet` type dari `@/pos-types` (field `type?: string`).
- Produces:
  - `isMarketplaceOutlet(outlet: { type?: string }): boolean`
  - `splitOutletsByType<T extends { type?: string }>(outlets: T[]): { physical: T[]; marketplace: T[] }`
  - Dipakai oleh Task 6 (`ReportsView.tsx`).

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/admin-dashboard/src/lib/marketplaceOutlets.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isMarketplaceOutlet, splitOutletsByType } from './marketplaceOutlets'

describe('isMarketplaceOutlet', () => {
  it('returns true when type is marketplace', () => {
    expect(isMarketplaceOutlet({ type: 'marketplace' })).toBe(true)
  })

  it('returns false for a physical outlet type', () => {
    expect(isMarketplaceOutlet({ type: 'outlet' })).toBe(false)
  })

  it('returns false when type is undefined', () => {
    expect(isMarketplaceOutlet({ type: undefined })).toBe(false)
  })
})

describe('splitOutletsByType', () => {
  const outlets = [
    { id: '1', name: 'Cibubur', type: 'outlet' },
    { id: '2', name: 'TikTok Shop', type: 'marketplace' },
    { id: '3', name: 'Empang', type: undefined },
    { id: '4', name: 'Shopee', type: 'marketplace' },
  ]

  it('separates physical outlets from marketplace outlets, preserving order', () => {
    const { physical, marketplace } = splitOutletsByType(outlets)
    expect(physical.map(o => o.id)).toEqual(['1', '3'])
    expect(marketplace.map(o => o.id)).toEqual(['2', '4'])
  })

  it('returns an empty marketplace array when none are present', () => {
    const { physical, marketplace } = splitOutletsByType([outlets[0]])
    expect(physical).toHaveLength(1)
    expect(marketplace).toHaveLength(0)
  })

  it('returns an empty physical array when all are marketplace', () => {
    const { physical, marketplace } = splitOutletsByType([outlets[1], outlets[3]])
    expect(physical).toHaveLength(0)
    expect(marketplace).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Jalankan test, verifikasi gagal**

```bash
cd apps/admin-dashboard && yarn test src/lib/marketplaceOutlets.test.ts
```
Expected: FAIL dengan "Cannot find module './marketplaceOutlets'".

- [ ] **Step 3: Implementasi**

Buat `apps/admin-dashboard/src/lib/marketplaceOutlets.ts`:
```ts
export function isMarketplaceOutlet(outlet: { type?: string }): boolean {
  return outlet.type === 'marketplace'
}

export function splitOutletsByType<T extends { type?: string }>(
  outlets: T[]
): { physical: T[]; marketplace: T[] } {
  const physical: T[] = []
  const marketplace: T[] = []
  for (const outlet of outlets) {
    if (isMarketplaceOutlet(outlet)) {
      marketplace.push(outlet)
    } else {
      physical.push(outlet)
    }
  }
  return { physical, marketplace }
}
```

- [ ] **Step 4: Jalankan test lagi, verifikasi semua pass**

```bash
cd apps/admin-dashboard && yarn test src/lib/marketplaceOutlets.test.ts
```
Expected: PASS, 6/6 test.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/marketplaceOutlets.ts apps/admin-dashboard/src/lib/marketplaceOutlets.test.ts
git commit -m "feat(admin-dashboard): add pure helper to split physical vs marketplace outlets"
```

---

## Task 5: Komponen `MarketplaceFilter.tsx`

**Files:**
- Create: `apps/admin-dashboard/src/components/MarketplaceFilter.tsx`

**Interfaces:**
- Consumes: `Outlet` type dari `@/pos-types`.
- Produces: komponen `MarketplaceFilter({ platforms, selectedOutlet, onChange, className? })` — dipakai oleh Task 6. Sengaja TANPA file test (konvensi codebase: komponen dropdown presentasional seperti `BranchFilter.tsx` tidak diuji otomatis di app ini — lihat `src/components/*.test.tsx.skip`).

- [ ] **Step 1: Buat komponen**

Buat `apps/admin-dashboard/src/components/MarketplaceFilter.tsx`:
```tsx
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, ShoppingBag } from 'lucide-react'
import type { Outlet } from '@/pos-types'

interface MarketplaceFilterProps {
  platforms: Outlet[]
  selectedOutlet: string
  onChange: (id: string) => void
  className?: string
}

export default function MarketplaceFilter({
  platforms,
  selectedOutlet,
  onChange,
  className = "w-full sm:w-56",
}: MarketplaceFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedName = selectedOutlet === 'all'
    ? 'Semua Platform Online'
    : platforms.find(p => p.id === selectedOutlet)?.name || 'Semua Platform Online'

  return (
    <div className={`relative z-50 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-gray-200 hover:border-amber-400 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 transition-all shadow-sm outline-none focus:ring-2 focus:ring-amber-500/20"
      >
        <div className="flex items-center gap-2 truncate">
          <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">{selectedName}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full sm:w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
          <div className="max-h-60 overflow-y-auto p-2">
            <button
              onClick={() => { onChange('all'); setIsOpen(false) }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedOutlet === 'all'
                  ? 'bg-amber-50 text-amber-700 font-bold'
                  : 'text-gray-700 font-medium hover:bg-gray-50'
              }`}
            >
              Semua Platform Online
              {selectedOutlet === 'all' && <Check className="w-4 h-4 text-amber-500" />}
            </button>

            {platforms.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400 font-medium">
                Belum ada platform terdaftar
              </div>
            ) : (
              platforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onChange(p.id); setIsOpen(false) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors mt-1 ${
                    selectedOutlet === p.id
                      ? 'bg-amber-50 text-amber-700 font-bold'
                      : 'text-gray-700 font-medium hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate pr-2">{p.name}</span>
                  {selectedOutlet === p.id && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/admin-dashboard && yarn type-check
```
Expected: 0 error baru dari file ini (komponen belum dipakai di mana pun sampai Task 6, jadi tidak akan flag "unused" karena ini named default export dari modulnya sendiri).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/MarketplaceFilter.tsx
git commit -m "feat(admin-dashboard): add MarketplaceFilter dropdown component"
```

---

## Task 6: Wire ke `ReportsView.tsx`

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx:159` (state `outlets`), `:941-945` (JSX `BranchFilter`)

**Interfaces:**
- Consumes: `splitOutletsByType` dari Task 4, `MarketplaceFilter` dari Task 5.
- Produces: n/a (halaman akhir).

- [ ] **Step 1: Tambah import**

Di bagian atas `apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx` (dekat import `BranchFilter` yang sudah ada di baris 19), tambahkan:
```ts
import MarketplaceFilter from '@/components/MarketplaceFilter'
import { splitOutletsByType } from '@/lib/marketplaceOutlets'
```

- [ ] **Step 2: Hitung outlet fisik vs marketplace + nilai dropdown turunan**

Cari baris berikut (sekitar baris 160, tepat setelah `const [outlets] = useState<Outlet[]>(initialOutlets)`):
```ts
  const [outlets] = useState<Outlet[]>(initialOutlets)
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all')
```
Tambahkan tepat setelah blok itu (setelah `selectedOutlet`/`setSelectedOutlet` dideklarasikan, boleh beberapa baris di bawahnya, sebelum baris `const [selectedChannel, ...`):
```ts
  const { physical: physicalOutlets, marketplace: marketplaceOutlets } = useMemo(
    () => splitOutletsByType(outlets),
    [outlets]
  )
  const marketplaceOutletIds = useMemo(
    () => new Set(marketplaceOutlets.map(o => o.id)),
    [marketplaceOutlets]
  )
  // selectedOutlet menunjuk salah satu dari dua sumber ini (outlet fisik ATAU platform
  // marketplace) -- tiap dropdown menampilkan default-nya sendiri saat state sedang
  // menunjuk ke sumber yang lain, sehingga keduanya tampak "saling reset".
  const branchFilterValue = marketplaceOutletIds.has(selectedOutlet) ? 'all' : selectedOutlet
  const marketplaceFilterValue = marketplaceOutletIds.has(selectedOutlet) ? selectedOutlet : 'all'
```

- [ ] **Step 3: Ubah JSX `BranchFilter` + tambah `MarketplaceFilter`**

Cari blok (sekitar baris 941-945):
```tsx
            <BranchFilter 
              outlets={outlets} 
              selectedOutlet={selectedOutlet} 
              onChange={setSelectedOutlet} 
            />
```
Ganti menjadi:
```tsx
            <BranchFilter 
              outlets={physicalOutlets} 
              selectedOutlet={branchFilterValue} 
              onChange={setSelectedOutlet} 
            />

            <MarketplaceFilter
              platforms={marketplaceOutlets}
              selectedOutlet={marketplaceFilterValue}
              onChange={setSelectedOutlet}
            />
```

- [ ] **Step 4: Type-check + build**

```bash
cd apps/admin-dashboard && yarn type-check && yarn build
```
Expected: keduanya sukses (catatan: file ini punya `// @ts-nocheck` di baris 1, jadi `type-check` tidak akan menangkap salah ketik di dalam file ini sendiri — andalkan `yarn build` untuk validasi runtime/JSX-nya, dan baca ulang diff Step 2-3 dengan teliti).

- [ ] **Step 5: Smoke test manual di browser**

Jalankan `yarn dev` dari `apps/admin-dashboard`, buka `/dashboard/reports/pos`, lalu verifikasi:
1. Dropdown baru "Semua Platform Online" muncul di antara "Semua Cabang" dan "Semua Channel".
2. Klik dropdown baru → muncul "TikTok Shop" dan "Shopee" (hasil migration Task 1 — pastikan migration sudah di-push, kalau belum dropdown akan kosong dengan pesan "Belum ada platform terdaftar", itu perilaku yang benar untuk state belum ter-migrate).
3. Pilih "TikTok Shop" → tombol "Semua Cabang" kembali menampilkan label default "Semua Cabang" (bukan nama outlet lain), KPI menampilkan Rp0 di semua card (belum ada data import), judul halaman menampilkan "Menampilkan data untuk: TikTok Shop".
4. Pilih sebuah cabang fisik dari "Semua Cabang" → dropdown "Semua Platform Online" kembali ke default.
5. Pilih "Semua Cabang" (opsi default) → kedua dropdown kembali default, data kembali menampilkan agregat semua outlet fisik seperti sebelum perubahan ini (regresi check).

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/reports/pos/ReportsView.tsx
git commit -m "feat(admin-dashboard): wire SS Online marketplace filter into Rangkuman Penjualan"
```

---

## Task 7: Verifikasi akhir & catatan follow-up

**Files:** tidak ada file baru — task ini murni verifikasi + dokumentasi status.

- [ ] **Step 1: Jalankan full test suite & type-check admin-dashboard**

```bash
cd apps/admin-dashboard && yarn test && yarn type-check && yarn build
```
Expected: semua test baru (Task 3, 4) pass; tidak ada regresi baru pada test suite existing (bandingkan jumlah gagal dengan baseline sebelum perubahan — project ini punya beberapa test pre-existing yang gagal karena drift tak terkait, dicatat di `CLAUDE.md`; pastikan jumlahnya tidak bertambah).

- [ ] **Step 2: Catat follow-up yang sengaja di luar scope plan ini**

Tambahkan baris baru di `CLAUDE.md` bagian akhir (ikuti format sesi-sesi sebelumnya) yang mencatat:
- Fitur "SS Online" selesai untuk TikTok Shop & Shopee di Rangkuman Penjualan.
- Audit lintas-app (`type != 'marketplace'` di stok/absensi/distribusi) BELUM dikerjakan — resiko: 2 outlet virtual ini berpotensi muncul di dropdown outlet app lain kalau ada yang query `outlets` tanpa filter type.
- Halaman import (`/dashboard/marketplace-import`) belum dibuat — menunggu contoh file laporan asli dari Seller Center TikTok Shop & Shopee.
- Perlu redeploy `admin-dashboard` agar perubahan ini live.

- [ ] **Step 3: Commit catatan**

```bash
git add CLAUDE.md
git commit -m "docs: log SS Online marketplace filter session in CLAUDE.md"
```
