# Katalog Harga Vendor — Tahap 2 (Layar Isi & Pembanding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memberi satu halaman untuk **mengisi harga vendor** per (bahan, vendor), dengan kolom pembanding yang menyala sendiri begitu sebuah bahan punya dua harga.

**Architecture:** Tabel `bahan_baku_supplier` sudah terisi 56 baris tapi **hanya 14 yang punya harga**. Karena itu titik berat halaman ini adalah **penyuntingan**, bukan visualisasi. Satu query membaca katalog + bahan + supplier; fungsi murni mengelompokkannya per bahan dan menyetarakan harga antar vendor; komponen menyunting satu baris pada satu waktu lewat `UPDATE` biasa (RLS `bbs_write` yang menjaga).

**Tech Stack:** Next.js App Router, React Query, Supabase JS, Vitest, TailwindCSS.

**Spec:** `docs/superpowers/specs/2026-09-08-katalog-harga-vendor-design.md` (Tahap 2 di §7; alur langkah ④ di §6)

**Lingkup:** Tahap 2 saja. Tahap 3 (prefill form PO) dan Tahap 4 (tulis-balik dari `verifikasi_terima_po`) mendapat plan sendiri — keduanya baru berguna setelah katalognya berisi.

## Global Constraints

- **Jangan menyentuh DB.** Tidak ada migration di plan ini. Tabel, RLS, dan trigger sudah ada dari Tahap 1.
- **Harga master ditampilkan sebagai pembanding, tapi TIDAK PERNAH ditulis dari sini.** Policy hidup `bbh_read` (diverifikasi di `pg_policies`, 9 Sep) mengizinkan `admin, owner, kitchen, purchasing, admin_finance` — jadi kedua role halaman ini (ADMIN & PURCHASING) boleh membacanya. Migration aslinya `20260630120000` memang admin-only, tapi sudah dilebarkan sesudahnya; **jangan percaya file migration lama, cek `pg_policies`.** Sebaliknya `bbh_write` tetap **admin saja** — halaman ini tidak boleh menyunting harga master.
- **Harga master dibandingkan per satuan kecil**, sama seperti harga vendor: `harga_beli / kemasan_qty`. Membandingkan harga vendor per Roll dengan harga master per Dus adalah kekeliruan yang sudah dua kali melahirkan angka salah 48× di proyek ini.
- **`harga = 0` bukan harga.** Jangan pernah merendernya sebagai rupiah di kolom pembanding — ia akan tampil sebagai yang termurah. Baris seperti itu berlabel "belum ada harga".
- **Perbandingan antar vendor SELALU per satuan kecil** (`harga / isi_satuan_kecil`). Vendor boleh menota dalam kemasan berbeda.
- **Jangan asumsikan `satuan_beli` = `satuan_po`.** 13 dari 56 baris berbeda; seed memakai satuan besar bahan karena `harga_terima` PO tersimpan begitu.
- Suite `apps/admin-dashboard` punya kegagalan pre-existing. **Baseline: 42 file gagal / 10 tes gagal / 576 tes lulus.** Bandingkan ke angka ini; jangan pernah menulis "0 error".
- `npx` rusak di repo ini — pakai `./node_modules/.bin/<tool>` dari dalam `apps/admin-dashboard`.
- Jangan menjalankan `yarn install` di root.

---

## Preflight

- [ ] **P1: Rekam baseline**

```bash
cd "apps/admin-dashboard" && yarn test 2>&1 | grep -E "Test Files|Tests " | tail -3
```

Expected: `42 failed | 71 passed (113)` dan `10 failed | 576 passed (586)`. Kalau berbeda, catat angka sebenarnya dan pakai itu sebagai baseline.

- [ ] **P2: Pastikan fungsi murni Tahap 1 masih ada**

```bash
ls apps/admin-dashboard/src/lib/katalogVendor.ts apps/admin-dashboard/src/lib/satuanPo.ts
```

Expected: keduanya ada. Task 1 mengimpor dari `katalogVendor.ts`.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps/admin-dashboard/src/lib/katalogGroup.ts` (baru) | Fungsi murni: kelompokkan baris katalog per bahan, ringkas jumlahnya, validasi input sebelum simpan |
| `apps/admin-dashboard/src/lib/katalogGroup.test.ts` (baru) | Tes untuk di atas |
| `apps/admin-dashboard/src/hooks/useKatalogVendor.ts` (baru) | Baca katalog (satu query, tiga tabel) + mutasi simpan satu baris |
| `apps/admin-dashboard/src/components/katalog-vendor/KatalogVendorBoard.tsx` (baru) | Papan: ringkasan, penyaring, daftar kelompok per bahan |
| `apps/admin-dashboard/src/components/katalog-vendor/BarisVendor.tsx` (baru) | Satu baris vendor: tampilan + mode sunting |
| `apps/admin-dashboard/src/app/dashboard/pembelian/katalog-vendor/page.tsx` (baru) | Composition root tipis |
| `apps/admin-dashboard/src/components/layout/navConfig.ts` (ubah) | Entri menu baru di grup Pembelian |
| `apps/admin-dashboard/src/components/layout/navConfig.test.ts` (ubah) | Snapshot route ADMIN & PURCHASING |

---

## Task 1: Fungsi murni pengelompokan & validasi

**Files:**
- Create: `apps/admin-dashboard/src/lib/katalogGroup.ts`
- Test: `apps/admin-dashboard/src/lib/katalogGroup.test.ts`

**Interfaces:**
- Consumes: `setarakanHargaAntarVendor`, `bolehPrefill`, `type BarisKatalog`, `type BarisSetara` dari `./katalogVendor` (Tahap 1).
- Produces: `type BarisKatalogVendor`, `type VendorSetara`, `type KelompokBahan`, `type RingkasanKatalog`, `kelompokkanKatalog(rows): KelompokBahan[]`, `ringkasKatalog(kelompok): RingkasanKatalog`, `validasiBarisKatalog(input): string | null`. Task 2 memakai tipe barisnya; Task 3 memakai ketiga fungsinya.

**Kenapa tidak mengubah `setarakanHargaAntarVendor`.** Fungsi itu sudah teruji (13 tes) dan bertipe `BarisKatalog[] → BarisSetara[]`, jadi kolom tambahan (nama bahan, sumber, termin) hilang di tingkat tipe. Alih-alih menggenerikkannya — yang berarti menyunting kode yang sudah lolos review — hasilnya **digabung ulang lewat `supplier_id`**. Urutan dari fungsi asli tetap terjaga.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `apps/admin-dashboard/src/lib/katalogGroup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  kelompokkanKatalog,
  ringkasKatalog,
  validasiBarisKatalog,
  type BarisKatalogVendor,
} from './katalogGroup'

const baris = (o: Partial<BarisKatalogVendor>): BarisKatalogVendor => ({
  id: 'row-1',
  bahan_baku_id: 'b1',
  bahan: 'FOIL',
  satuan: 'Dus',
  satuan_po: 'roll',
  faktor_po: 760,
  supplier_id: 's1',
  supplier_nama: 'Vendor A',
  termin_hari: null,
  satuan_beli: 'Dus',
  isi_satuan_kecil: 36480,
  harga: 0,
  is_active: true,
  perlu_ditinjau: true,
  sumber: 'po',
  harga_updated_at: null,
  harga_master_per_kecil: null,
  ...o,
})

describe('kelompokkanKatalog', () => {
  it('daftar kosong -> kelompok kosong', () => {
    expect(kelompokkanKatalog([])).toEqual([])
  })

  it('mengelompokkan per bahan dan mengurutkan menurut nama bahan', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', bahan_baku_id: 'b2', bahan: 'SAPI', supplier_id: 's1' }),
      baris({ id: 'r2', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's1' }),
      baris({ id: 'r3', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's2' }),
    ])

    expect(hasil.map((k) => k.bahan)).toEqual(['FOIL', 'SAPI'])
    expect(hasil[0].vendors).toHaveLength(2)
    expect(hasil[1].vendors).toHaveLength(1)
  })

  it('mempertahankan kolom yang tidak dikenal setarakanHargaAntarVendor', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r9', supplier_id: 's7', supplier_nama: 'Ekadharma', termin_hari: 21, sumber: 'manual' }),
    ])

    const v = hasil[0].vendors[0]
    expect(v.id).toBe('r9')
    expect(v.supplier_nama).toBe('Ekadharma')
    expect(v.termin_hari).toBe(21)
    expect(v.sumber).toBe('manual')
  })

  it('dua vendor berharga -> bisaDibandingkan true dan selisih terhitung', () => {
    // Ekadharma per Roll (760 cm) vs Altindo per Dus (36.480 cm), harga setara
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', supplier_id: 'eka', supplier_nama: 'Ekadharma',
              satuan_beli: 'Roll', isi_satuan_kecil: 760, harga: 8791.2, perlu_ditinjau: false }),
      baris({ id: 'r2', supplier_id: 'alt', supplier_nama: 'Altindo',
              satuan_beli: 'Dus', isi_satuan_kecil: 36480, harga: 421977.6, perlu_ditinjau: false }),
    ])

    expect(hasil[0].jumlahVendor).toBe(2)
    expect(hasil[0].jumlahBerharga).toBe(2)
    expect(hasil[0].bisaDibandingkan).toBe(true)
    for (const v of hasil[0].vendors) {
      expect(v.hargaPerSatuanKecil).toBeCloseTo(11.5674, 4)
      expect(v.selisihPersen).toBeCloseTo(0, 6)
    }
  })

  it('satu berharga satu kosong -> bisaDibandingkan false', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', bahan: 'KENTANG', supplier_id: 'agro',
              isi_satuan_kecil: 10000, harga: 250000, perlu_ditinjau: false }),
      baris({ id: 'r2', bahan: 'KENTANG', supplier_id: 'indoboga',
              isi_satuan_kecil: 10000, harga: 0 }),
    ])

    expect(hasil[0].jumlahVendor).toBe(2)
    expect(hasil[0].jumlahBerharga).toBe(1)
    expect(hasil[0].bisaDibandingkan).toBe(false)
  })

  it('membawa harga master per satuan kecil ke tingkat kelompok', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', supplier_id: 's1', harga_master_per_kecil: 11.5674 }),
      baris({ id: 'r2', supplier_id: 's2', harga_master_per_kecil: 11.5674 }),
    ])

    expect(hasil[0].hargaMasterPerKecil).toBeCloseTo(11.5674, 4)
  })

  it('harga master belum diisi -> null, bukan 0', () => {
    const hasil = kelompokkanKatalog([baris({ harga_master_per_kecil: null })])
    expect(hasil[0].hargaMasterPerKecil).toBeNull()
  })

  it('baris perlu_ditinjau tidak dihitung sebagai berharga meski harganya terisi', () => {
    const hasil = kelompokkanKatalog([
      baris({ id: 'r1', supplier_id: 's1', harga: 999, perlu_ditinjau: true }),
      baris({ id: 'r2', supplier_id: 's2', harga: 111, perlu_ditinjau: false, isi_satuan_kecil: 10 }),
    ])

    expect(hasil[0].jumlahBerharga).toBe(1)
    expect(hasil[0].bisaDibandingkan).toBe(false)
  })
})

describe('ringkasKatalog', () => {
  it('menghitung baris, yang perlu diisi, dan bahan yang bisa dibandingkan', () => {
    const kelompok = kelompokkanKatalog([
      baris({ id: 'r1', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's1', harga: 100, isi_satuan_kecil: 10, perlu_ditinjau: false }),
      baris({ id: 'r2', bahan_baku_id: 'b1', bahan: 'FOIL', supplier_id: 's2', harga: 120, isi_satuan_kecil: 10, perlu_ditinjau: false }),
      baris({ id: 'r3', bahan_baku_id: 'b2', bahan: 'SAPI', supplier_id: 's3', harga: 0 }),
    ])

    expect(ringkasKatalog(kelompok)).toEqual({
      totalBaris: 3,
      terpercaya: 2,
      perluDiisi: 1,
      bahanMultivendor: 1,
      bisaDibandingkan: 1,
    })
  })

  it('kelompok kosong -> semua nol', () => {
    expect(ringkasKatalog([])).toEqual({
      totalBaris: 0,
      terpercaya: 0,
      perluDiisi: 0,
      bahanMultivendor: 0,
      bisaDibandingkan: 0,
    })
  })
})

describe('validasiBarisKatalog', () => {
  it('input sehat -> null', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: 20, satuan_beli: 'Pack' })).toBeNull()
  })

  it('satuan beli kosong ditolak', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: 20, satuan_beli: '  ' }))
      .toBe('Satuan beli wajib diisi.')
  })

  it('isi satuan kecil harus lebih dari nol', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: 0, satuan_beli: 'Pack' }))
      .toBe('Isi satuan kecil harus lebih dari 0.')
  })

  it('isi satuan kecil NaN ditolak -- Postgres meloloskannya lewat CHECK', () => {
    expect(validasiBarisKatalog({ harga: 1000, isi_satuan_kecil: NaN, satuan_beli: 'Pack' }))
      .toBe('Isi satuan kecil harus lebih dari 0.')
  })

  it('harga negatif ditolak', () => {
    expect(validasiBarisKatalog({ harga: -1, isi_satuan_kecil: 20, satuan_beli: 'Pack' }))
      .toBe('Harga tidak boleh negatif.')
  })

  it('harga nol diperbolehkan -- artinya belum diisi', () => {
    expect(validasiBarisKatalog({ harga: 0, isi_satuan_kecil: 20, satuan_beli: 'Pack' })).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan tes, pastikan GAGAL**

```bash
cd "apps/admin-dashboard" && ./node_modules/.bin/vitest run src/lib/katalogGroup.test.ts
```

Expected: FAIL — `Failed to resolve import "./katalogGroup"`.

- [ ] **Step 3: Tulis implementasi**

Buat `apps/admin-dashboard/src/lib/katalogGroup.ts`:

```ts
import {
  setarakanHargaAntarVendor,
  bolehPrefill,
  type BarisKatalog,
  type BarisSetara,
} from './katalogVendor'

/** Satu baris katalog beserta konteks bahan & vendornya, seperti dibaca hook. */
export type BarisKatalogVendor = BarisKatalog & {
  id: string
  bahan_baku_id: string
  bahan: string
  satuan: string | null
  satuan_po: string | null
  faktor_po: number | null
  termin_hari: number | null
  sumber: string
  /** Kapan harga ini terakhir disentuh. Spec §6 ④ meminta ini tampil. */
  harga_updated_at: string | null
  /**
   * Harga master bahan ini, DISETARAKAN ke satuan kecil (`harga_beli / kemasan_qty`).
   * Sama untuk semua vendor bahan yang sama; dibawa per baris karena hook
   * meratakan hasil embed. null bila harga master belum diisi.
   */
  harga_master_per_kecil: number | null
}

export type VendorSetara = BarisKatalogVendor & Pick<BarisSetara, 'hargaPerSatuanKecil' | 'selisihPersen'>

export type KelompokBahan = {
  bahan_baku_id: string
  bahan: string
  satuan: string | null
  satuan_po: string | null
  faktor_po: number | null
  /** Harga master per satuan kecil, untuk dibandingkan dengan harga vendor. */
  hargaMasterPerKecil: number | null
  vendors: VendorSetara[]
  jumlahVendor: number
  /** Vendor yang harganya layak dipakai: aktif, tidak perlu ditinjau, harga > 0. */
  jumlahBerharga: number
  /** Pembanding baru bermakna kalau ada dua harga yang layak. */
  bisaDibandingkan: boolean
}

export type RingkasanKatalog = {
  totalBaris: number
  terpercaya: number
  perluDiisi: number
  bahanMultivendor: number
  bisaDibandingkan: number
}

export function kelompokkanKatalog(rows: BarisKatalogVendor[]): KelompokBahan[] {
  const per = new Map<string, BarisKatalogVendor[]>()
  for (const r of rows) {
    const daftar = per.get(r.bahan_baku_id)
    if (daftar) daftar.push(r)
    else per.set(r.bahan_baku_id, [r])
  }

  const kelompok: KelompokBahan[] = []
  for (const daftar of per.values()) {
    // setarakanHargaAntarVendor bertipe BarisKatalog -> BarisSetara, jadi kolom
    // tambahan (id, bahan, termin) tak terbawa di tingkat tipe. Digabung ulang
    // lewat supplier_id; urutan hasil aslinya dipertahankan.
    const asal = new Map(daftar.map((r) => [r.supplier_id, r]))
    const vendors: VendorSetara[] = setarakanHargaAntarVendor(daftar).map((s) => ({
      ...(asal.get(s.supplier_id) as BarisKatalogVendor),
      hargaPerSatuanKecil: s.hargaPerSatuanKecil,
      selisihPersen: s.selisihPersen,
    }))

    const jumlahBerharga = daftar.filter(bolehPrefill).length
    const pertama = daftar[0]

    kelompok.push({
      bahan_baku_id: pertama.bahan_baku_id,
      bahan: pertama.bahan,
      satuan: pertama.satuan,
      satuan_po: pertama.satuan_po,
      faktor_po: pertama.faktor_po,
      hargaMasterPerKecil: pertama.harga_master_per_kecil,
      vendors,
      jumlahVendor: daftar.length,
      jumlahBerharga,
      bisaDibandingkan: jumlahBerharga > 1,
    })
  }

  return kelompok.sort((a, z) => a.bahan.localeCompare(z.bahan, 'id'))
}

export function ringkasKatalog(kelompok: KelompokBahan[]): RingkasanKatalog {
  let totalBaris = 0
  let terpercaya = 0
  let bahanMultivendor = 0
  let bisaDibandingkan = 0

  for (const k of kelompok) {
    totalBaris += k.jumlahVendor
    terpercaya += k.jumlahBerharga
    if (k.jumlahVendor > 1) bahanMultivendor += 1
    if (k.bisaDibandingkan) bisaDibandingkan += 1
  }

  return {
    totalBaris,
    terpercaya,
    perluDiisi: totalBaris - terpercaya,
    bahanMultivendor,
    bisaDibandingkan,
  }
}

/**
 * Cermin constraint DB, supaya operator melihat pesan alih-alih galat 400.
 * NaN diperiksa terpisah: di Postgres `'NaN'::numeric > 0` bernilai true,
 * jadi CHECK di tabel TIDAK menahannya.
 */
export function validasiBarisKatalog(input: {
  harga: number
  isi_satuan_kecil: number
  satuan_beli: string
}): string | null {
  if (!input.satuan_beli.trim()) return 'Satuan beli wajib diisi.'
  if (!Number.isFinite(input.isi_satuan_kecil) || input.isi_satuan_kecil <= 0) {
    return 'Isi satuan kecil harus lebih dari 0.'
  }
  if (!Number.isFinite(input.harga) || input.harga < 0) return 'Harga tidak boleh negatif.'
  return null
}
```

- [ ] **Step 4: Jalankan tes, pastikan LULUS**

```bash
cd "apps/admin-dashboard" && ./node_modules/.bin/vitest run src/lib/katalogGroup.test.ts
```

Expected: PASS, 16 tes.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/katalogGroup.ts apps/admin-dashboard/src/lib/katalogGroup.test.ts
git commit -m "feat(admin-dashboard): pengelompokan & validasi katalog vendor

Fungsi murni untuk layar katalog: kelompokkan per bahan, ringkas, dan
validasi input sebelum simpan. Validasi menahan NaN yang CHECK Postgres
justru meloloskan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Hook baca & simpan

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useKatalogVendor.ts`

**Interfaces:**
- Consumes: `type BarisKatalogVendor` dari `@/lib/katalogGroup` (Task 1).
- Produces: `useKatalogVendor(): { rows, loading, error, refresh }` dan `useKatalogVendorMutations(): { simpanBaris }` dengan `simpanBaris.mutateAsync({ id, harga, satuan_beli, isi_satuan_kecil })`. Task 3 memakai keduanya.

**Kenapa satu query, bukan tiga.** Baris katalog tak berguna tanpa nama bahan dan nama vendornya, dan ketiganya punya satu FK masing-masing sehingga embed PostgREST tidak ambigu (beda dengan kasus `outlets` di `monitoring_view_crew` yang punya dua FK dan melahirkan PGRST201).

- [ ] **Step 1: Tulis hook**

Buat `apps/admin-dashboard/src/hooks/useKatalogVendor.ts`:

```ts
'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BarisKatalogVendor } from '@/lib/katalogGroup'

const KEY = ['katalog_vendor'] as const

/** Bentuk mentah dari PostgREST: relasi ikut sebagai objek bersarang. */
type BarisMentah = {
  id: string
  bahan_baku_id: string
  supplier_id: string
  satuan_beli: string
  isi_satuan_kecil: number
  harga: number
  is_active: boolean
  perlu_ditinjau: boolean
  sumber: string
  harga_updated_at: string | null
  bahan_baku: {
    nama: string
    satuan: string | null
    satuan_po: string | null
    faktor_po: number | null
    /**
     * Embed bersarang. `bahan_baku_harga.bahan_baku_id` adalah PK sekaligus FK,
     * jadi PostgREST semestinya mengenalinya satu-ke-satu dan mengembalikan
     * objek — tapi deteksi itu tidak dijamin, jadi bentuk array ikut ditangani.
     */
    bahan_baku_harga: HargaMaster | HargaMaster[] | null
  } | null
  supplier: { nama: string; termin_hari: number | null } | null
}

type HargaMaster = { harga_beli: number | null; kemasan_qty: number | null }

/** harga_beli per satuan besar dibagi isi kemasannya -> harga per satuan kecil. */
function masterPerKecil(h: HargaMaster | HargaMaster[] | null | undefined): number | null {
  const satu = Array.isArray(h) ? h[0] : h
  const harga = Number(satu?.harga_beli ?? 0)
  const kemasan = Number(satu?.kemasan_qty ?? 0)
  if (!Number.isFinite(harga) || harga <= 0) return null
  if (!Number.isFinite(kemasan) || kemasan <= 0) return null
  return harga / kemasan
}

function ratakan(r: BarisMentah): BarisKatalogVendor {
  return {
    id: r.id,
    bahan_baku_id: r.bahan_baku_id,
    bahan: r.bahan_baku?.nama ?? '(bahan terhapus)',
    satuan: r.bahan_baku?.satuan ?? null,
    satuan_po: r.bahan_baku?.satuan_po ?? null,
    faktor_po: r.bahan_baku?.faktor_po ?? null,
    supplier_id: r.supplier_id,
    supplier_nama: r.supplier?.nama ?? '(vendor terhapus)',
    termin_hari: r.supplier?.termin_hari ?? null,
    satuan_beli: r.satuan_beli,
    isi_satuan_kecil: Number(r.isi_satuan_kecil),
    harga: Number(r.harga),
    is_active: r.is_active,
    perlu_ditinjau: r.perlu_ditinjau,
    sumber: r.sumber,
    harga_updated_at: r.harga_updated_at,
    harga_master_per_kecil: masterPerKecil(r.bahan_baku?.bahan_baku_harga),
  }
}

export function useKatalogVendor() {
  const supabase = useMemo(() => createClient(), [])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_baku_supplier')
        .select(
          'id, bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, is_active, perlu_ditinjau, sumber, harga_updated_at, bahan_baku!inner(nama, satuan, satuan_po, faktor_po, bahan_baku_harga(harga_beli, kemasan_qty)), supplier!inner(nama, termin_hari)',
        )
      if (error) throw error
      return ((data ?? []) as unknown as BarisMentah[]).map(ratakan)
    },
    staleTime: 60000,
    gcTime: 300000,
  })

  return { rows: data ?? [], loading: isLoading, error, refresh: refetch }
}

export function useKatalogVendorMutations() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()

  /**
   * Menyimpan satu baris. `perlu_ditinjau` dilepas dan `sumber` jadi 'manual'
   * karena angkanya kini berasal dari orang, bukan dari tebakan seed.
   * Baris riwayat ditulis trigger `bbs_tulis_riwayat`, bukan di sini.
   */
  const simpanBaris = useMutation({
    mutationFn: async (v: {
      id: string
      harga: number
      satuan_beli: string
      isi_satuan_kecil: number
    }) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('bahan_baku_supplier')
        .update({
          harga: v.harga,
          satuan_beli: v.satuan_beli.trim(),
          isi_satuan_kecil: v.isi_satuan_kecil,
          perlu_ditinjau: false,
          sumber: 'manual',
          harga_updated_at: new Date().toISOString(),
          updated_by: auth.user?.id ?? null,
        })
        .eq('id', v.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })

  return { simpanBaris }
}
```

- [ ] **Step 2: Type-check**

```bash
cd "apps/admin-dashboard" && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -i "katalogVendor\|katalogGroup" ; echo "exit=$?"
```

Expected: nol baris yang menyebut kedua file itu (`exit=1` dari `grep` karena tak ada kecocokan — itu yang diinginkan).

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useKatalogVendor.ts
git commit -m "feat(admin-dashboard): hook baca & simpan katalog harga vendor

Satu query embed (katalog + bahan_baku + supplier). Menyimpan satu baris
melepas perlu_ditinjau dan menandai sumber 'manual'; riwayat ditulis
trigger DB.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Komponen & halaman

**Files:**
- Create: `apps/admin-dashboard/src/components/katalog-vendor/BarisVendor.tsx`
- Create: `apps/admin-dashboard/src/components/katalog-vendor/KatalogVendorBoard.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/pembelian/katalog-vendor/page.tsx`

**Interfaces:**
- Consumes: `kelompokkanKatalog`, `ringkasKatalog`, `validasiBarisKatalog`, `type KelompokBahan`, `type VendorSetara` (Task 1); `useKatalogVendor`, `useKatalogVendorMutations` (Task 2).
- Produces: route `/dashboard/pembelian/katalog-vendor`. Task 4 menautkannya ke nav.

- [ ] **Step 1: Komponen baris**

Buat `apps/admin-dashboard/src/components/katalog-vendor/BarisVendor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { validasiBarisKatalog, type VendorSetara } from '@/lib/katalogGroup'

const rupiah = (n: number) =>
  'Rp ' + Math.round(n).toLocaleString('id-ID')

export function BarisVendor({
  v,
  satuanKecil,
  menyimpan,
  onSimpan,
}: {
  v: VendorSetara
  satuanKecil: string
  menyimpan: boolean
  onSimpan: (input: { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }) => Promise<void>
}) {
  const [sunting, setSunting] = useState(false)
  const [harga, setHarga] = useState(String(v.harga))
  const [satuanBeli, setSatuanBeli] = useState(v.satuan_beli)
  const [isi, setIsi] = useState(String(v.isi_satuan_kecil))
  const [galat, setGalat] = useState<string | null>(null)

  const belumAdaHarga = v.harga <= 0

  async function simpan() {
    const input = {
      harga: Number(harga),
      satuan_beli: satuanBeli,
      isi_satuan_kecil: Number(isi),
    }
    const pesan = validasiBarisKatalog(input)
    if (pesan) {
      setGalat(pesan)
      return
    }
    setGalat(null)
    await onSimpan({ id: v.id, ...input })
    setSunting(false)
  }

  function batal() {
    setHarga(String(v.harga))
    setSatuanBeli(v.satuan_beli)
    setIsi(String(v.isi_satuan_kecil))
    setGalat(null)
    setSunting(false)
  }

  if (sunting) {
    return (
      <tr className="border-t border-stone-100 bg-amber-50/40">
        <td className="py-2 px-3 font-medium text-stone-700">{v.supplier_nama}</td>
        <td className="py-2 px-3">
          <input
            value={satuanBeli}
            onChange={(e) => setSatuanBeli(e.target.value)}
            className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-sm"
            aria-label="Satuan beli"
          />
        </td>
        <td className="py-2 px-3">
          <input
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
            inputMode="decimal"
            className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-sm text-right"
            aria-label={`Isi dalam ${satuanKecil}`}
          />
        </td>
        <td className="py-2 px-3">
          <input
            value={harga}
            onChange={(e) => setHarga(e.target.value)}
            inputMode="decimal"
            className="w-32 rounded-lg border border-stone-300 px-2 py-1 text-sm text-right"
            aria-label="Harga per satuan beli"
          />
        </td>
        <td className="py-2 px-3 text-right text-stone-400">—</td>
        <td className="py-2 px-3 text-right text-stone-400">—</td>
        <td className="py-2 px-3">
          {galat && <span className="text-xs text-red-600">{galat}</span>}
        </td>
        <td className="py-2 px-3 text-right whitespace-nowrap">
          <button
            onClick={simpan}
            disabled={menyimpan}
            className="mr-1 rounded-lg bg-emerald-600 px-2 py-1 text-white disabled:opacity-50"
            aria-label="Simpan"
          >
            <Check size={14} />
          </button>
          <button onClick={batal} className="rounded-lg bg-stone-200 px-2 py-1" aria-label="Batal">
            <X size={14} />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-stone-100">
      <td className="py-2 px-3 font-medium text-stone-700">
        {v.supplier_nama}
        {v.termin_hari ? <span className="ml-2 text-xs text-stone-400">tempo {v.termin_hari} hr</span> : null}
      </td>
      <td className="py-2 px-3 text-stone-600">{v.satuan_beli}</td>
      <td className="py-2 px-3 text-right text-stone-600">
        {v.isi_satuan_kecil.toLocaleString('id-ID')} {satuanKecil}
      </td>
      <td className="py-2 px-3 text-right">
        {belumAdaHarga ? (
          <span className="text-xs italic text-stone-400">belum ada harga</span>
        ) : (
          <span className="font-semibold text-stone-800">{rupiah(v.harga)}</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {belumAdaHarga || v.hargaPerSatuanKecil === null ? (
          <span className="text-stone-300">—</span>
        ) : (
          <span className="text-stone-600">
            {v.hargaPerSatuanKecil.toLocaleString('id-ID', { maximumFractionDigits: 4 })}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right text-xs text-stone-400">
        {v.harga_updated_at
          ? new Date(v.harga_updated_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '—'}
      </td>
      <td className="py-2 px-3 text-right">
        {v.perlu_ditinjau ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            perlu ditinjau
          </span>
        ) : v.selisihPersen === null ? (
          <span className="text-stone-300">—</span>
        ) : v.selisihPersen === 0 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            termurah
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-stone-500">
            +{v.selisihPersen.toFixed(1)}%
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        <button
          onClick={() => setSunting(true)}
          className="rounded-lg border border-stone-200 px-2 py-1 text-stone-500 hover:bg-stone-50"
          aria-label={`Sunting ${v.supplier_nama}`}
        >
          <Pencil size={14} />
        </button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Komponen papan**

Buat `apps/admin-dashboard/src/components/katalog-vendor/KatalogVendorBoard.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { kelompokkanKatalog, ringkasKatalog } from '@/lib/katalogGroup'
import { useKatalogVendor, useKatalogVendorMutations } from '@/hooks/useKatalogVendor'
import { BarisVendor } from './BarisVendor'

export function KatalogVendorBoard() {
  const { rows, loading, error } = useKatalogVendor()
  const { simpanBaris } = useKatalogVendorMutations()
  const [hanyaPerluDiisi, setHanyaPerluDiisi] = useState(false)
  const [cari, setCari] = useState('')

  const kelompok = useMemo(() => kelompokkanKatalog(rows), [rows])
  const ringkas = useMemo(() => ringkasKatalog(kelompok), [kelompok])

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase()
    return kelompok.filter((k) => {
      if (hanyaPerluDiisi && k.jumlahBerharga === k.jumlahVendor) return false
      if (!kata) return true
      if (k.bahan.toLowerCase().includes(kata)) return true
      return k.vendors.some((v) => v.supplier_nama.toLowerCase().includes(kata))
    })
  }, [kelompok, hanyaPerluDiisi, cari])

  async function simpan(input: { id: string; harga: number; satuan_beli: string; isi_satuan_kecil: number }) {
    try {
      await simpanBaris.mutateAsync(input)
      toast.success('Harga vendor tersimpan')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    }
  }

  if (loading) return <p className="p-6 text-stone-500">Memuat katalog…</p>
  if (error) return <p className="p-6 text-red-600">Gagal memuat katalog: {String(error)}</p>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kartu label="Baris katalog" nilai={ringkas.totalBaris} />
        <Kartu label="Sudah berharga" nilai={ringkas.terpercaya} nada="emerald" />
        <Kartu label="Perlu diisi" nilai={ringkas.perluDiisi} nada="amber" />
        <Kartu
          label="Bisa dibandingkan"
          nilai={`${ringkas.bisaDibandingkan} / ${ringkas.bahanMultivendor}`}
          catatan="bahan dengan ≥2 harga"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari bahan atau vendor…"
          className="flex-1 min-w-[200px] rounded-xl border border-stone-200 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={hanyaPerluDiisi}
            onChange={(e) => setHanyaPerluDiisi(e.target.checked)}
          />
          Hanya yang perlu diisi
        </label>
      </div>

      {tampil.length === 0 ? (
        <p className="rounded-xl border border-stone-200 p-6 text-center text-stone-500">
          Tidak ada baris yang cocok.
        </p>
      ) : (
        tampil.map((k) => {
          const satuanKecil = k.satuan_po ?? k.satuan ?? 'satuan'
          return (
            <section key={k.bahan_baku_id} className="rounded-2xl border border-stone-200 bg-white">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 px-4 py-3">
                <h2 className="font-bold text-stone-800">{k.bahan}</h2>
                <p className="text-xs text-stone-500">
                  satuan besar <b>{k.satuan ?? '—'}</b> · satuan PO <b>{k.satuan_po ?? '—'}</b>
                  {k.faktor_po ? <> · 1 {k.satuan_po} = <b>{k.faktor_po.toLocaleString('id-ID')}</b> satuan kecil</> : null}
                  {' · harga master '}
                  {k.hargaMasterPerKecil === null ? (
                    <b className="text-stone-400">belum diisi</b>
                  ) : (
                    <b>
                      {k.hargaMasterPerKecil.toLocaleString('id-ID', { maximumFractionDigits: 4 })}
                      /satuan kecil
                    </b>
                  )}
                  {' · '}
                  {k.bisaDibandingkan
                    ? `${k.jumlahBerharga} harga bisa dibandingkan`
                    : `${k.jumlahBerharga} dari ${k.jumlahVendor} vendor berharga`}
                </p>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-stone-400">
                    <tr>
                      <th className="py-2 px-3">Vendor</th>
                      <th className="py-2 px-3">Satuan beli</th>
                      <th className="py-2 px-3 text-right">Isi</th>
                      <th className="py-2 px-3 text-right">Harga</th>
                      <th className="py-2 px-3 text-right">Per satuan kecil</th>
                      <th className="py-2 px-3 text-right">Terakhir</th>
                      <th className="py-2 px-3 text-right">Status</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {k.vendors.map((v) => (
                      <BarisVendor
                        key={v.id}
                        v={v}
                        satuanKecil={satuanKecil}
                        menyimpan={simpanBaris.isPending}
                        onSimpan={simpan}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

function Kartu({
  label,
  nilai,
  nada,
  catatan,
}: {
  label: string
  nilai: number | string
  nada?: 'emerald' | 'amber'
  catatan?: string
}) {
  const warna =
    nada === 'emerald' ? 'text-emerald-700' : nada === 'amber' ? 'text-amber-700' : 'text-stone-800'
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warna}`}>{nilai}</p>
      {catatan && <p className="text-[11px] text-stone-400">{catatan}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Halaman**

Buat `apps/admin-dashboard/src/app/dashboard/pembelian/katalog-vendor/page.tsx`:

```tsx
'use client'

import { PageHeader } from '@/components/ui'
import { KatalogVendorBoard } from '@/components/katalog-vendor/KatalogVendorBoard'

export default function KatalogVendorPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Katalog Harga Vendor"
        description="Harga per vendor untuk tiap bahan. Perbandingan antar vendor selalu dihitung per satuan kecil, karena vendor bisa menota dalam kemasan berbeda."
      />
      <KatalogVendorBoard />
    </div>
  )
}
```

`PageHeader` menerima `title`, `description`, `children`, `icon` (diverifikasi di
`src/components/ui/PageHeader.tsx:7`). Jangan menambah prop baru ke komponen itu.

- [ ] **Step 4: Build**

```bash
cd "apps/admin-dashboard" && yarn build 2>&1 | grep -E "katalog-vendor|Failed|error" | head -10
```

Expected: route `/dashboard/pembelian/katalog-vendor` muncul di daftar, tanpa baris `Failed`.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/katalog-vendor apps/admin-dashboard/src/app/dashboard/pembelian/katalog-vendor
git commit -m "feat(admin-dashboard): halaman katalog harga vendor

Daftar per bahan dengan penyuntingan harga di tempat. Harga 0 dirender
'belum ada harga', bukan Rp 0 -- kalau tidak, ia jadi angka terkecil di
kolom pembanding.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Entri navigasi

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts:126`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`

**Interfaces:**
- Consumes: route dari Task 3.
- Produces: menu "Katalog Vendor" di grup Pembelian untuk ADMIN & PURCHASING.

**Kenapa tesnya wajib ikut diubah.** `navConfig.test.ts:226` menegakkan `expect(hrefs).toEqual(BASELINE_ROUTES[role])` — kesamaan **persis**, bukan superset. Menambah route tanpa memperbarui baseline membuat dua tes merah. Ada juga tes yang memastikan tiap `href` punya `page.tsx`, jadi Task 3 harus sudah selesai.

- [ ] **Step 1: Tambah entri nav**

Di `apps/admin-dashboard/src/components/layout/navConfig.ts`, tepat **sesudah** baris `Harga & Bahan Baku`, sisipkan:

```ts
      { href: '/dashboard/pembelian/katalog-vendor', label: 'Katalog Harga Vendor', shortLabel: 'Katalog Vendor', icon: Truck, roles: ['ADMIN', 'PURCHASING'] },
```

`Truck` sudah diimpor di file itu (dipakai entri Master Supplier), jadi tidak perlu impor baru.

- [ ] **Step 2: Jalankan tes nav, pastikan GAGAL**

```bash
cd "apps/admin-dashboard" && ./node_modules/.bin/vitest run src/components/layout/navConfig.test.ts
```

Expected: FAIL pada `ADMIN: himpunan route tidak berubah dari baseline` dan `PURCHASING: …` — keduanya karena route baru belum ada di baseline.

- [ ] **Step 3: Perbarui baseline**

Di `navConfig.test.ts`, tambahkan `'/dashboard/pembelian/katalog-vendor',` ke dalam array `BASELINE_ROUTES.ADMIN` **dan** `BASELINE_ROUTES.PURCHASING`. Karena baseline dibandingkan setelah `.sort()`, sisipkan berurutan: **sesudah** `'/dashboard/pembelian/harga'` dan **sebelum** `'/dashboard/pembelian/perlu-dibeli'`.

- [ ] **Step 4: Jalankan tes nav, pastikan LULUS**

```bash
cd "apps/admin-dashboard" && ./node_modules/.bin/vitest run src/components/layout/navConfig.test.ts
```

Expected: PASS, 44 tes.

- [ ] **Step 5: Bandingkan suite penuh ke baseline**

```bash
cd "apps/admin-dashboard" && yarn test 2>&1 | grep -E "Test Files|Tests " | tail -3
```

Expected: **42 file gagal** dan **10 tes gagal** — sama persis dengan baseline P1. Tes lulus naik 576 → **592** (+16 dari Task 1). Kalau jumlah gagal naik, itu regresi: jangan commit, laporkan tes mana yang baru merah.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin-dashboard): menu Katalog Harga Vendor di grup Pembelian

Baseline route ADMIN & PURCHASING ikut diperbarui -- tesnya menuntut
kesamaan persis, bukan superset.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Setelah semua task selesai

- [ ] **Smoke test browser** — masuk sebagai ADMIN, buka `/dashboard/pembelian/katalog-vendor`. Yang harus terlihat: 40 kelompok bahan, ringkasan `56 baris · 14 berharga · 42 perlu diisi · 0/15 bisa dibandingkan`. Isi satu harga (mis. FOIL/Ekadharma) → tersimpan, label "perlu ditinjau" hilang. Isi harga vendor kedua bahan yang sama → kolom Status berubah jadi `termurah` / `+x%` dan penghitung "bisa dibandingkan" naik jadi 1.
- [ ] **Verifikasi riwayat ikut tertulis:**
  ```bash
  supabase db query "select count(*) from bahan_baku_supplier_history;" --linked
  ```
  Angkanya harus bertambah satu tiap penyimpanan.
- [ ] **⚠️ Perlu redeploy `admin-dashboard`.**
- [ ] Laporkan ke owner: berapa baris yang berhasil diisi, dan bahan mana yang akhirnya punya pembanding nyata.

## Sengaja di luar lingkup

- **Tombol vendor utama (`is_preferred`).** Index unik parsialnya non-deferrable, jadi menukar vendor utama dalam satu statement bisa gagal `duplicate key` tergantung urutan baris — perlu RPC tersendiri. Tidak dibutuhkan untuk mengisi harga.
- **Menambah/menghapus pasangan (bahan, vendor).** Halaman ini menyunting yang sudah ada; pasangan baru lahir dari seed atau dari PO (Tahap 4).
- **Harga master (`bahan_baku_harga`).** RLS admin-only; menariknya merusak halaman untuk PURCHASING.
- **Tahap 3 & 4.** Plan tersendiri.
