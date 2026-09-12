# App Retail Tahap 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memberi SukaShawarma APP satu tab pengaturan sendiri di admin-dashboard — menu apa yang tayang, bagaimana tampilannya, dan outlet mana yang melayaninya — tanpa menyentuh satu baris pun milik POS.

**Architecture:** Tiga rute baru di bawah `/dashboard/app-retail`, satu grup nav baru, server action sendiri di folder rutenya. Dua fungsi murni ber-test menjaga bagian yang bisa salah tanpa kelihatan: penggabungan `channel_prices` dan pembacaan kesiapan outlet. Nol migration; semua kolom yang dipakai sudah ada.

**Tech Stack:** Next.js 15 App Router (RSC + Server Actions), TypeScript, Tailwind, Supabase JS (`@suka/auth`), Vitest, `@suka/design-system` (`CurrencyInput`, `compressImageToWebP`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-09-app-retail-tahap1-design.md`

## Global Constraints

Berlaku untuk SEMUA task. Melanggar salah satunya = task ditolak, bukan diperbaiki belakangan.

- **Nol berkas berubah di `apps/pos-kasir/`, `mobile/`, dan `apps/admin-dashboard/src/app/dashboard/pos-admin/`.** Diperiksa dengan `git diff --name-only` sebelum tiap commit.
- **Nol migration, nol perubahan skema.** Tidak ada berkas baru di `supabase/migrations/`.
- **Tidak menambah baris ke tabel `sales_channels`.** Mode "Satu Harga Semua" di layar POS menyapu seluruh baris tabel itu; baris "Aplikasi" akan membuat harga aplikasi ikut tertimpa.
- **Kolom yang boleh ditulis hanya empat:** `menu_items.tampil_di_app`, `menu_items.foto_app`, `menu_items.deskripsi_app`, dan kunci `aplikasi` di dalam `menu_items.channel_prices`. Plus `outlets.app_enabled` di halaman outlet. Tidak ada yang lain.
- **Penulisan `channel_prices` menggabung, tidak menimpa.** Wajib lewat `gabungHargaChannel` dari Task 1.
- **Harga aplikasi kosong berarti "ikut harga kasir", bukan "gratis".** Kalimat di UI harus mengatakan itu.
- **Jangan `git add -A` atau `git add .`.** Pohon kerja repo ini memuat pekerjaan orang lain yang belum di-commit. Selalu sebut berkasnya satu per satu.
- Bahasa UI dan komentar: Indonesia. Nama fungsi/variabel baru: Indonesia, mengikuti `retail-gateway`.
- Perintah test: `../../node_modules/.bin/vitest` dari `apps/admin-dashboard` — **`npx` rusak di repo ini** (jalur `node_modules` ganda).
- Selalu batasi test ke `--dir src`. Tanpa itu vitest ikut memindai salinan di `.claude/worktrees/**` dan selalu merah; itu bukan ukuran.

**Baseline yang harus tetap sama di akhir:**
- `yarn type-check` di `apps/admin-dashboard`: **3 error** (`src/lib/mitraPolicy.test.ts` TS6133, `vitest.config.ts` ×2)
- `../../node_modules/.bin/vitest run --dir src`: **hijau** (240 test per 9 September; angka naik seiring test baru)

---

### Task 1: Fungsi murni `gabungHargaChannel`

Kolom `channel_prices` adalah satu objek JSON berisi harga SEMUA kanal. Menulis `{ aplikasi: '9000' }` polos menghapus harga GoFood, GrabFood, dan ShopeeFood dalam satu klik. Fungsi ini satu-satunya jalan menulis harga aplikasi.

**Files:**
- Create: `apps/admin-dashboard/src/lib/appRetail/hargaAplikasi.ts`
- Test: `apps/admin-dashboard/src/lib/appRetail/hargaAplikasi.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces:
  - `export const SLUG_APLIKASI = 'aplikasi'`
  - `export function gabungHargaChannel(lama: unknown, harga: string | number | null | undefined): Record<string, string>`

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/admin-dashboard/src/lib/appRetail/hargaAplikasi.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gabungHargaChannel, SLUG_APLIKASI } from './hargaAplikasi'

describe('gabungHargaChannel', () => {
  it('menambahkan harga aplikasi tanpa menyentuh kanal lain', () => {
    const hasil = gabungHargaChannel({ gofood: '15000', grabfood: '16000' }, '9000')
    expect(hasil).toEqual({ gofood: '15000', grabfood: '16000', aplikasi: '9000' })
  })

  it('menimpa harga aplikasi yang sudah ada, bukan menggandakan', () => {
    const hasil = gabungHargaChannel({ aplikasi: '8000', gofood: '15000' }, '9500')
    expect(hasil).toEqual({ gofood: '15000', aplikasi: '9500' })
  })

  // Mengosongkan kolom = "ikut harga kasir". Kuncinya DIHAPUS, bukan diisi '0' --
  // gateway memperlakukan 0 sebagai tidak-diisi, tapi menyimpan '0' membuat
  // niat admin tak terbaca oleh manusia yang membuka barisnya.
  it('menghapus kunci aplikasi bila harga dikosongkan', () => {
    expect(gabungHargaChannel({ aplikasi: '8000', gofood: '15000' }, '')).toEqual({ gofood: '15000' })
    expect(gabungHargaChannel({ aplikasi: '8000' }, null)).toEqual({})
    expect(gabungHargaChannel({ aplikasi: '8000' }, undefined)).toEqual({})
  })

  it('menghapus kunci aplikasi untuk nol dan nilai tak masuk akal', () => {
    expect(gabungHargaChannel({ aplikasi: '8000' }, '0')).toEqual({})
    expect(gabungHargaChannel({ aplikasi: '8000' }, '-500')).toEqual({})
    expect(gabungHargaChannel({ aplikasi: '8000' }, 'gratis')).toEqual({})
  })

  // Proyek ini punya riwayat kolom TEXT yang menyimpan JSON berlapis
  // (global_settings.value). Menebak salah arah di sini menghapus harga kanal lain.
  it('menerima channel_prices berbentuk string JSON', () => {
    expect(gabungHargaChannel('{"gofood":"15000"}', '9000')).toEqual({ gofood: '15000', aplikasi: '9000' })
  })

  it('tidak melempar untuk null, undefined, atau isi rusak', () => {
    expect(gabungHargaChannel(null, '9000')).toEqual({ aplikasi: '9000' })
    expect(gabungHargaChannel(undefined, '9000')).toEqual({ aplikasi: '9000' })
    expect(gabungHargaChannel('bukan json', '9000')).toEqual({ aplikasi: '9000' })
    expect(gabungHargaChannel(42, '9000')).toEqual({ aplikasi: '9000' })
  })

  it('menormalkan angka jadi string, sesuai bentuk simpanan formulir', () => {
    expect(gabungHargaChannel({}, 9000)).toEqual({ aplikasi: '9000' })
  })

  it('mengekspor slug yang sama dengan yang dibaca gateway', () => {
    expect(SLUG_APLIKASI).toBe('aplikasi')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Dari `apps/admin-dashboard`:
```bash
../../node_modules/.bin/vitest run --dir src src/lib/appRetail/hargaAplikasi.test.ts
```
Diharapkan: FAIL — `Failed to resolve import "./hargaAplikasi"`.

- [ ] **Step 3: Tulis implementasi minimal**

Buat `apps/admin-dashboard/src/lib/appRetail/hargaAplikasi.ts`:

```ts
/**
 * Kunci harga aplikasi di `menu_items.channel_prices`.
 *
 * Nilainya HARUS sama dengan yang dibaca gateway di
 * `apps/retail-gateway/src/lib/catalog.ts` (`SLUG_HARGA_APLIKASI`). Kalau
 * keduanya bergeser, admin mengisi harga yang tidak pernah dipakai siapa pun.
 *
 * Slug ini sengaja TIDAK punya baris di tabel `sales_channels`: mode
 * "Satu Harga Semua" di layar menu POS menyapu seluruh baris tabel itu dan
 * akan ikut menimpa harga aplikasi setiap kali harga food apps diatur.
 */
export const SLUG_APLIKASI = 'aplikasi'

/**
 * Menyisipkan harga aplikasi ke `channel_prices` tanpa merusak kanal lain.
 *
 * `channel_prices` satu objek untuk SEMUA kanal. Menulisnya utuh dengan
 * `{ aplikasi: ... }` menghapus harga GoFood, GrabFood, dan ShopeeFood dalam
 * satu klik — itulah sebabnya penulisan harga aplikasi hanya boleh lewat sini.
 *
 * Harga kosong/nol/tak masuk akal berarti "ikut harga kasir": kuncinya dihapus,
 * bukan disimpan sebagai '0'. Gateway memang memperlakukan 0 sebagai
 * tidak-diisi, tapi menyimpan '0' membuat niat admin tak terbaca oleh manusia
 * yang kelak membuka baris itu.
 */
export function gabungHargaChannel(
  lama: unknown,
  harga: string | number | null | undefined,
): Record<string, string> {
  let obj: unknown = lama
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) } catch { obj = {} }
  }

  const hasil: Record<string, string> = {}
  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === SLUG_APLIKASI) continue
      hasil[k] = String(v)
    }
  }

  if (harga === null || harga === undefined || harga === '') return hasil

  const angka = Number(harga)
  if (!Number.isFinite(angka) || angka <= 0) return hasil

  hasil[SLUG_APLIKASI] = String(angka)
  return hasil
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

```bash
../../node_modules/.bin/vitest run --dir src src/lib/appRetail/hargaAplikasi.test.ts
```
Diharapkan: PASS, 8 test.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/appRetail/hargaAplikasi.ts apps/admin-dashboard/src/lib/appRetail/hargaAplikasi.test.ts
git commit -m "feat(app-retail): gabungHargaChannel - sisipkan harga aplikasi tanpa merusak kanal lain"
```

---

### Task 2: Fungsi murni `periksaKesiapanOutlet`

Dua keadaan bisa membuat aplikasi tampak rusak padahal datanya yang belum siap. Keduanya tidak kelihatan tanpa dihitung, jadi dihitung di satu tempat ber-test.

**Files:**
- Create: `apps/admin-dashboard/src/lib/appRetail/kesiapanOutlet.ts`
- Test: `apps/admin-dashboard/src/lib/appRetail/kesiapanOutlet.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces:
  - `export type OutletApp = { id: string; name: string; type: string | null; is_active: boolean; app_enabled: boolean }`
  - `export type Kesiapan = { melayani: boolean; peringatan: string[] }`
  - `export function periksaKesiapanOutlet(outlet: OutletApp, jumlahMenuTayang: number): Kesiapan`

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/admin-dashboard/src/lib/appRetail/kesiapanOutlet.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { periksaKesiapanOutlet, type OutletApp } from './kesiapanOutlet'

const dasar: OutletApp = {
  id: 'o1', name: 'Empang', type: 'outlet', is_active: true, app_enabled: true,
}

describe('periksaKesiapanOutlet', () => {
  it('outlet sehat: melayani, tanpa peringatan', () => {
    expect(periksaKesiapanOutlet(dasar, 12)).toEqual({ melayani: true, peringatan: [] })
  })

  it('outlet mati untuk aplikasi tidak melayani dan tidak diperingatkan', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, app_enabled: false }, 0)
    expect(hasil.melayani).toBe(false)
    expect(hasil.peringatan).toEqual([])
  })

  // GET /api/v1/outlets menyaring app_enabled TANPA menyaring is_active.
  // Outlet yang sudah dinonaktifkan tetap ditawarkan ke pelanggan.
  it('menyala tapi outlet nonaktif: diperingatkan', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, is_active: false }, 12)
    expect(hasil.melayani).toBe(true)
    expect(hasil.peringatan).toContain('Outlet nonaktif tapi masih melayani aplikasi')
  })

  // Kegagalan nyata pada uji coba 8 September: katalog kosong, aplikasi tampak
  // rusak, padahal belum ada menu yang diterbitkan.
  it('menyala tapi nol menu tayang: diperingatkan', () => {
    const hasil = periksaKesiapanOutlet(dasar, 0)
    expect(hasil.peringatan).toContain('Nol menu tayang — katalog akan kosong')
  })

  it('dua masalah sekaligus menghasilkan dua peringatan', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, is_active: false }, 0)
    expect(hasil.peringatan).toHaveLength(2)
  })

  it('outlet mati tidak diperingatkan meski nol menu', () => {
    const hasil = periksaKesiapanOutlet({ ...dasar, app_enabled: false, is_active: false }, 0)
    expect(hasil.peringatan).toEqual([])
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

```bash
../../node_modules/.bin/vitest run --dir src src/lib/appRetail/kesiapanOutlet.test.ts
```
Diharapkan: FAIL — modul belum ada.

- [ ] **Step 3: Tulis implementasi minimal**

Buat `apps/admin-dashboard/src/lib/appRetail/kesiapanOutlet.ts`:

```ts
export type OutletApp = {
  id: string
  name: string
  type: string | null
  is_active: boolean
  app_enabled: boolean
}

export type Kesiapan = {
  /** Pelanggan bisa memilih outlet ini di aplikasi. */
  melayani: boolean
  /** Keadaan yang perlu dilihat manusia. Kosong berarti sehat. */
  peringatan: string[]
}

/**
 * Membaca kesiapan satu outlet untuk aplikasi.
 *
 * Peringatan hanya muncul untuk outlet yang MELAYANI. Outlet yang memang
 * dimatikan tidak punya masalah untuk dilaporkan — memberinya peringatan
 * membuat daftar penuh bunyi yang tidak menuntut tindakan apa pun.
 */
export function periksaKesiapanOutlet(outlet: OutletApp, jumlahMenuTayang: number): Kesiapan {
  const melayani = outlet.app_enabled
  const peringatan: string[] = []

  if (melayani) {
    // GET /api/v1/outlets menyaring app_enabled tanpa menyaring is_active,
    // jadi outlet nonaktif tetap ditawarkan ke pelanggan. Endpoint sengaja
    // TIDAK diubah di tahap ini; keadaannya ditandai supaya terlihat.
    if (!outlet.is_active) peringatan.push('Outlet nonaktif tapi masih melayani aplikasi')
    if (jumlahMenuTayang <= 0) peringatan.push('Nol menu tayang — katalog akan kosong')
  }

  return { melayani, peringatan }
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

```bash
../../node_modules/.bin/vitest run --dir src src/lib/appRetail/kesiapanOutlet.test.ts
```
Diharapkan: PASS, 6 test.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/appRetail/kesiapanOutlet.ts apps/admin-dashboard/src/lib/appRetail/kesiapanOutlet.test.ts
git commit -m "feat(app-retail): periksaKesiapanOutlet - tandai outlet menyala tanpa menu atau tanpa is_active"
```

---

### Task 3: Grup nav "App Retail" + tiga rute

`navConfig.test.ts` memeriksa bahwa setiap `href` punya `page.tsx` yang benar-benar ada, jadi grup nav dan ketiga halaman lahir bersama dalam satu task. Halaman menu dan outlet masih rangka; isinya di Task 6–8.

**Files:**
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.test.ts`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/menu/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/page.tsx`

**Interfaces:**
- Consumes: tidak ada
- Produces: tiga rute `/dashboard/app-retail`, `/dashboard/app-retail/menu`, `/dashboard/app-retail/outlet`

- [ ] **Step 1: Perbarui test lebih dulu (test ini yang mendikte bentuknya)**

Di `navConfig.test.ts`, tiga tempat berubah.

(a) `BASELINE_ROUTES.ADMIN` — daftar ini **terurut**; ketiga rute masuk paling depan karena `app-retail` < `bahan-baku`:

```ts
  ADMIN: [
    '/dashboard/app-retail',
    '/dashboard/app-retail/menu',
    '/dashboard/app-retail/outlet',
    '/dashboard/bahan-baku',
```

(b) `BASELINE_ROUTES.OWNER` — sama, di depan `/dashboard/budget-outlet`:

```ts
  OWNER: [
    '/dashboard/app-retail',
    '/dashboard/app-retail/menu',
    '/dashboard/app-retail/outlet',
    '/dashboard/budget-outlet',
```

(c) `EXPECTED_GROUP_COUNT` — ADMIN 7 → 8, OWNER 5 → 6:

```ts
const EXPECTED_GROUP_COUNT: Record<Role, number> = {
  ADMIN: 8,
  OWNER: 6,
```

(d) Test urutan pintu ADMIN — judulnya ikut berubah karena jumlahnya berubah:

```ts
  it('ADMIN melihat delapan pintu dengan urutan yang ditentukan', () => {
    expect(accessibleGroups('ADMIN').map((g) => g.title)).toEqual([
      'Laporan Internal',
      'Penjualan & Kinerja',
      'Produk & Stok',
      'Pembelian',
      'POS',
      'App Retail',
      'Karyawan',
      'Sistem',
    ])
  })
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

```bash
../../node_modules/.bin/vitest run --dir src src/components/layout/navConfig.test.ts
```
Diharapkan: FAIL — rute belum ada di nav, jumlah pintu belum cocok.

- [ ] **Step 3: Tambahkan grup nav**

Di `navConfig.ts`, tambahkan `Smartphone` ke impor `lucide-react`, lalu sisipkan grup baru **tepat setelah grup `'POS'` dan sebelum `'Karyawan'`** (urutan array menentukan urutan pintu, dan test di Step 1 mengunci posisinya):

```ts
  {
    title: 'App Retail',
    icon: Smartphone,
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/app-retail', label: 'Ringkasan App Retail', shortLabel: 'Ringkasan', icon: LayoutDashboard, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/app-retail/menu', label: 'Pengaturan Menu Aplikasi', shortLabel: 'Menu App', icon: Tags, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/app-retail/outlet', label: 'Outlet Aplikasi', shortLabel: 'Outlet App', icon: Store, roles: ['OWNER', 'ADMIN'] },
    ],
  },
```

Tanpa `primary` — bottom nav ADMIN sudah punya empat tab yang dipilih sengaja, dan test mengunci keempatnya.

- [ ] **Step 4: Buat tiga halaman rangka**

`apps/admin-dashboard/src/app/dashboard/app-retail/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

export default function AppRetailPage() {
  return <div className="p-6">Ringkasan App Retail</div>
}
```

`apps/admin-dashboard/src/app/dashboard/app-retail/menu/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

export default function AppRetailMenuPage() {
  return <div className="p-6">Pengaturan Menu Aplikasi</div>
}
```

`apps/admin-dashboard/src/app/dashboard/app-retail/outlet/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

export default function AppRetailOutletPage() {
  return <div className="p-6">Outlet Aplikasi</div>
}
```

- [ ] **Step 5: Jalankan test, pastikan LULUS**

```bash
../../node_modules/.bin/vitest run --dir src src/components/layout/navConfig.test.ts
```
Diharapkan: PASS, termasuk "setiap href di nav punya page.tsx yang benar-benar ada".

- [ ] **Step 6: Periksa isolasi lalu commit**

```bash
git diff --name-only | grep -E "apps/pos-kasir|^mobile/|pos-admin/" || echo "ISOLASI OK"
git add apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts apps/admin-dashboard/src/app/dashboard/app-retail
git commit -m "feat(app-retail): grup nav App Retail + tiga rute"
```

---

### Task 4: Halaman Ringkasan

Tiga angka yang hari ini tidak bisa dilihat di mana pun. Bukan dasbor analitik — pertanyaannya cuma satu: apakah kanal ini hidup dan waras?

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/app-retail/page.tsx`

**Interfaces:**
- Consumes: tidak ada
- Produces: tidak ada (halaman daun)

- [ ] **Step 1: Tulis halamannya**

Ganti seluruh isi `apps/admin-dashboard/src/app/dashboard/app-retail/page.tsx`:

```tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { Smartphone, Store, ShoppingCart } from 'lucide-react'

export const dynamic = 'force-dynamic'

/** Awal hari ini dalam WIB, dikembalikan sebagai ISO UTC untuk dibandingkan dengan created_at. */
function awalHariWib(): string {
  const sekarang = new Date()
  const wib = new Date(sekarang.getTime() + 7 * 60 * 60 * 1000)
  wib.setUTCHours(0, 0, 0, 0)
  return new Date(wib.getTime() - 7 * 60 * 60 * 1000).toISOString()
}

export default async function AppRetailPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [menuRes, outletRes, orderRes] = await Promise.all([
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('tampil_di_app', true),
    supabase.from('outlets').select('id', { count: 'exact', head: true }).eq('app_enabled', true),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('source', 'app').gte('created_at', awalHariWib()),
  ])

  const kartu = [
    { label: 'Menu tayang di aplikasi', nilai: menuRes.count ?? 0, ikon: Smartphone, href: '/dashboard/app-retail/menu' },
    { label: 'Outlet melayani aplikasi', nilai: outletRes.count ?? 0, ikon: Store, href: '/dashboard/app-retail/outlet' },
    { label: 'Pesanan aplikasi hari ini', nilai: orderRes.count ?? 0, ikon: ShoppingCart, href: null },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">App Retail</h1>
        <p className="text-sm text-slate-500">Pengaturan kanal SukaShawarma APP.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kartu.map((k) => {
          const isi = (
            <div className="p-4 rounded-xl border border-slate-200 bg-white h-full">
              <div className="flex items-center gap-2 text-slate-500">
                <k.ikon className="w-4 h-4" />
                <span className="text-xs font-semibold">{k.label}</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">{k.nilai}</p>
            </div>
          )
          return k.href
            ? <Link key={k.label} href={k.href} className="block hover:opacity-90 transition-opacity">{isi}</Link>
            : <div key={k.label}>{isi}</div>
        })}
      </div>

      {/*
        Draft `menunggu_bayar` SENGAJA tidak ditampilkan. `retail.order_drafts`
        di-GRANT hanya untuk service_role; membacanya dari sini berarti menambah
        jalur service-role baru di admin-dashboard — pola yang di repo ini pernah
        menjadi lubang otorisasi (CLAUDE.md, Session 2026-07-20). Kalau angka itu
        dibutuhkan, lewat endpoint gateway yang sudah punya haknya.
      */}
    </div>
  )
}
```

- [ ] **Step 2: Pastikan build lolos**

Dari `apps/admin-dashboard`:
```bash
NEXT_TURBOPACK=0 yarn build
```
Diharapkan: sukses, dan `/dashboard/app-retail` muncul di daftar rute.

- [ ] **Step 3: Pastikan type-check tetap di baseline**

```bash
yarn type-check
```
Diharapkan: tetap **3 error** (`mitraPolicy.test.ts`, `vitest.config.ts` ×2). Error baru = bug, bukan baseline.

- [ ] **Step 4: Periksa isolasi lalu commit**

```bash
git diff --name-only | grep -E "apps/pos-kasir|^mobile/|pos-admin/" || echo "ISOLASI OK"
git add apps/admin-dashboard/src/app/dashboard/app-retail/page.tsx
git commit -m "feat(app-retail): halaman Ringkasan - menu tayang, outlet melayani, pesanan hari ini"
```

---

### Task 5: Server action App Retail

Satu berkas untuk semua tulisan tab ini. Tidak mengimpor apa pun dari `pos-admin/` — mengimpornya berarti `revalidatePath` menunjuk halaman yang salah, dan mengikat rute baru ke folder yang tidak boleh disentuh.

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts`

**Interfaces:**
- Consumes: `gabungHargaChannel`, `SLUG_APLIKASI` (Task 1)
- Produces:
  - `export async function toggleTayangDiApp(id: string, sedangTayang: boolean): Promise<void>`
  - `export async function simpanDetailMenuApp(input: { id: string; deskripsiApp: string | null; fotoApp: string | null; hargaAplikasi: string }): Promise<void>`
  - `export async function toggleOutletApp(id: string, sedangMenyala: boolean): Promise<void>`

- [ ] **Step 1: Tulis berkas action**

Buat `apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import { gabungHargaChannel } from '@/lib/appRetail/hargaAplikasi'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

function segarkan() {
  revalidatePath('/dashboard/app-retail')
  revalidatePath('/dashboard/app-retail/menu')
  revalidatePath('/dashboard/app-retail/outlet')
}

/**
 * Menyalakan/mematikan menu di aplikasi.
 *
 * Menegasikan `sedangTayang` DI SINI. Pemanggil mengirim keadaan sekarang,
 * bukan keadaan yang diinginkan — kalau kedua sisi sama-sama tidak menegasikan,
 * tombolnya tidak pernah membalik apa pun dan kegagalannya senyap. Pola itu
 * sudah ada di repo ini (`toggleMenuPublished`), jangan ditiru.
 */
export async function toggleTayangDiApp(id: string, sedangTayang: boolean) {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('menu_items')
    .update({ tampil_di_app: !sedangTayang })
    .eq('id', id)
  if (error) throw new Error(error.message)
  segarkan()
}

/**
 * Menyimpan tampilan menu di aplikasi.
 *
 * Membaca `channel_prices` lebih dulu lalu menggabungnya: kolom itu memuat
 * harga SEMUA kanal, dan menulisnya utuh akan menghapus harga GoFood dkk.
 * Kolom lain (`price`, `sort_order`, `is_available`, `available_online_channels`)
 * tidak boleh ikut — itu milik POS.
 */
export async function simpanDetailMenuApp(input: {
  id: string
  deskripsiApp: string | null
  fotoApp: string | null
  hargaAplikasi: string
}) {
  const supabase = await getSupabase()

  const { data: baris, error: bacaError } = await supabase
    .from('menu_items')
    .select('channel_prices')
    .eq('id', input.id)
    .maybeSingle()
  if (bacaError) throw new Error(bacaError.message)
  if (!baris) throw new Error('Menu tidak ditemukan')

  const { error } = await supabase
    .from('menu_items')
    .update({
      deskripsi_app: input.deskripsiApp || null,
      foto_app: input.fotoApp || null,
      channel_prices: gabungHargaChannel(baris.channel_prices, input.hargaAplikasi),
    })
    .eq('id', input.id)
  if (error) throw new Error(error.message)
  segarkan()
}

/**
 * Menyalakan/mematikan outlet untuk aplikasi.
 *
 * `outlets.app_enabled` adalah satu-satunya gerbang antara outlet dan
 * pelanggan: `GET /api/v1/outlets` menyaring persis kolom ini. Menyalakan
 * outlet sungguhan membuatnya langsung bisa dipesan.
 */
export async function toggleOutletApp(id: string, sedangMenyala: boolean) {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('outlets')
    .update({ app_enabled: !sedangMenyala })
    .eq('id', id)
  if (error) throw new Error(error.message)
  segarkan()
}
```

- [ ] **Step 2: Pastikan type-check tetap di baseline**

```bash
yarn type-check
```
Diharapkan: tetap 3 error baseline.

- [ ] **Step 3: Periksa isolasi lalu commit**

```bash
git diff --name-only | grep -E "apps/pos-kasir|^mobile/|pos-admin/" || echo "ISOLASI OK"
git add apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts
git commit -m "feat(app-retail): server action - toggle tayang, simpan detail menu, toggle outlet"
```

---

### Task 6: Halaman Pengaturan Menu — tabel & penyaring

Baca dulu, tulis di Task 7. Memisahkannya berarti kalau tabelnya salah, itu ketahuan sebelum ada tombol yang bisa merusak data.

**Files:**
- Create: `apps/admin-dashboard/src/lib/appRetail/tampilanMenu.ts`
- Test: `apps/admin-dashboard/src/lib/appRetail/tampilanMenu.test.ts`
- Modify: `apps/admin-dashboard/src/app/dashboard/app-retail/menu/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/menu/MenuAppView.tsx`

Tipe dan dua fungsi murninya tinggal di `lib/`, bukan di dalam berkas komponen.
Kalau ikut di komponen, unit test-nya harus mengimpor React, `next/image`, dan
lucide hanya untuk memeriksa dua fungsi yang tidak menyentuh DOM sama sekali.

**Interfaces:**
- Consumes: `SLUG_APLIKASI` (Task 1)
- Produces:
  - `export type MenuApp = { id: string; name: string; price: number; channel_prices: unknown; image_url: string | null; foto_app: string | null; deskripsi_app: string | null; tampil_di_app: boolean; categories: { name: string } | { name: string }[] | null }`
  - `export function namaKategori(mentah: MenuApp['categories']): string`
  - `export function hargaAplikasiTampil(channelPrices: unknown): number | null`
  - komponen `MenuAppView` dengan props `{ items: MenuApp[]; outletMelayani: string[] }`

- [ ] **Step 1: Tulis halaman server**

Ganti seluruh isi `apps/admin-dashboard/src/app/dashboard/app-retail/menu/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import MenuAppView from './MenuAppView'
import type { MenuApp } from '@/lib/appRetail/tampilanMenu'

export const dynamic = 'force-dynamic'

export default async function AppRetailMenuPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [itemsRes, outletRes] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id, name, price, channel_prices, image_url, foto_app, deskripsi_app, tampil_di_app, categories(name)')
      .order('name'),
    supabase.from('outlets').select('name').eq('app_enabled', true).order('name'),
  ])

  return (
    <MenuAppView
      items={(itemsRes.data ?? []) as MenuApp[]}
      outletMelayani={(outletRes.data ?? []).map((o) => o.name as string)}
    />
  )
}
```

- [ ] **Step 2: Tulis modul tipe & fungsi murni**

Buat `apps/admin-dashboard/src/lib/appRetail/tampilanMenu.ts`:

```ts
import { SLUG_APLIKASI } from './hargaAplikasi'

export type MenuApp = {
  id: string
  name: string
  price: number
  channel_prices: unknown
  image_url: string | null
  foto_app: string | null
  deskripsi_app: string | null
  tampil_di_app: boolean
  categories: { name: string } | { name: string }[] | null
}

/** PostgREST mengembalikan objek untuk many-to-one, tapi array saat kardinalitasnya tak pasti. */
export function namaKategori(mentah: MenuApp['categories']): string {
  const obj = Array.isArray(mentah) ? mentah[0] : mentah
  return obj?.name ?? '—'
}

/**
 * Harga aplikasi untuk ditampilkan; `null` berarti ikut harga kasir.
 *
 * Aturannya harus sama dengan `hargaAplikasi` di
 * `apps/retail-gateway/src/lib/catalog.ts`: nol dan kosong berarti tidak diisi,
 * bukan gratis. Kalau dua sisi berbeda, admin melihat angka yang bukan yang
 * ditagih ke pelanggan.
 */
export function hargaAplikasiTampil(channelPrices: unknown): number | null {
  let obj: unknown = channelPrices
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) } catch { return null }
  }
  if (typeof obj !== 'object' || obj === null) return null
  const nilai = (obj as Record<string, unknown>)[SLUG_APLIKASI]
  const angka = Number(nilai)
  return Number.isFinite(angka) && angka > 0 ? angka : null
}
```

- [ ] **Step 3: Tulis komponen tabel**

Buat `apps/admin-dashboard/src/app/dashboard/app-retail/menu/MenuAppView.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, Smartphone, AlertTriangle } from 'lucide-react'
import { namaKategori, hargaAplikasiTampil, type MenuApp } from '@/lib/appRetail/tampilanMenu'

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`

type Saring = 'tayang' | 'belum' | 'semua'

export default function MenuAppView({
  items,
  outletMelayani,
}: {
  items: MenuApp[]
  outletMelayani: string[]
}) {
  const [saring, setSaring] = useState<Saring>('tayang')
  const [cari, setCari] = useState('')
  const [bukaOutlet, setBukaOutlet] = useState(false)

  const terlihat = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return items.filter((it) => {
      if (saring === 'tayang' && !it.tampil_di_app) return false
      if (saring === 'belum' && it.tampil_di_app) return false
      return !q || it.name.toLowerCase().includes(q)
    })
  }, [items, saring, cari])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pengaturan Menu Aplikasi</h1>
        <p className="text-sm text-slate-500">
          Menu dibuat dan dihapus di POS. Di sini hanya ditentukan yang tayang di aplikasi dan tampilannya.
        </p>
      </div>

      {/* Cakupan perubahan — hari ini tidak ada tempat lain yang memberi tahu ini. */}
      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-900 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            Perubahan berlaku <strong>serentak di {outletMelayani.length} outlet</strong> yang melayani aplikasi.
            {outletMelayani.length > 0 && (
              <button
                type="button"
                onClick={() => setBukaOutlet((v) => !v)}
                className="ml-1 underline font-semibold cursor-pointer"
              >
                {bukaOutlet ? 'sembunyikan' : 'lihat daftarnya'}
              </button>
            )}
            {bukaOutlet && <p className="mt-1 font-medium">{outletMelayani.join(' · ')}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          {([['tayang', 'Tayang'], ['belum', 'Belum tayang'], ['semua', 'Semua']] as [Saring, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSaring(key)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  saring === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama menu"
            className="input w-full pl-9 py-2 text-sm bg-white border border-slate-200 rounded-xl"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left py-3 px-4 font-semibold text-slate-500 w-16">Foto</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500">Nama</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500 hidden sm:table-cell">Kategori</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-500">Harga kasir</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-500">Harga aplikasi</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {terlihat.map((it) => {
              const hargaApp = hargaAplikasiTampil(it.channel_prices)
              const foto = it.foto_app ?? it.image_url
              return (
                <tr key={it.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-4">
                    {foto ? (
                      <Image src={foto} alt="" width={40} height={40} className="w-10 h-10 rounded-lg object-cover" unoptimized />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100" />
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{it.name}</td>
                  <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{namaKategori(it.categories)}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{rupiah(it.price)}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {hargaApp === null ? <span className="text-slate-400 font-medium">ikut kasir</span> : rupiah(hargaApp)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        it.tampil_di_app ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {it.tampil_di_app ? 'Tayang' : 'Tidak tayang'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {terlihat.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  <Smartphone className="w-6 h-6 mx-auto mb-2" />
                  Tidak ada menu yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tulis test untuk kedua fungsi murni**

Buat `apps/admin-dashboard/src/lib/appRetail/tampilanMenu.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { namaKategori, hargaAplikasiTampil } from './tampilanMenu'

describe('namaKategori', () => {
  it('membaca bentuk objek', () => {
    expect(namaKategori({ name: 'Minuman' })).toBe('Minuman')
  })
  it('membaca bentuk array yang dikembalikan PostgREST saat kardinalitas tak pasti', () => {
    expect(namaKategori([{ name: 'Minuman' }])).toBe('Minuman')
  })
  it('menjadi tanda pisah bila kategori kosong', () => {
    expect(namaKategori(null)).toBe('—')
    expect(namaKategori([])).toBe('—')
  })
})

describe('hargaAplikasiTampil', () => {
  it('mengembalikan harga aplikasi bila diisi', () => {
    expect(hargaAplikasiTampil({ aplikasi: '9000' })).toBe(9000)
  })
  it('null berarti ikut harga kasir', () => {
    expect(hargaAplikasiTampil({ gofood: '15000' })).toBeNull()
    expect(hargaAplikasiTampil({ aplikasi: '0' })).toBeNull()
    expect(hargaAplikasiTampil(null)).toBeNull()
    expect(hargaAplikasiTampil('bukan json')).toBeNull()
  })
  it('menerima bentuk string JSON', () => {
    expect(hargaAplikasiTampil('{"aplikasi":"9500"}')).toBe(9500)
  })
})
```

- [ ] **Step 5: Jalankan test & build**

```bash
../../node_modules/.bin/vitest run --dir src src/lib/appRetail/tampilanMenu.test.ts
NEXT_TURBOPACK=0 yarn build
```
Diharapkan: test PASS (6 test), build sukses.

- [ ] **Step 6: Periksa isolasi lalu commit**

```bash
git diff --name-only | grep -E "apps/pos-kasir|^mobile/|pos-admin/" || echo "ISOLASI OK"
git add apps/admin-dashboard/src/lib/appRetail/tampilanMenu.ts apps/admin-dashboard/src/lib/appRetail/tampilanMenu.test.ts apps/admin-dashboard/src/app/dashboard/app-retail/menu
git commit -m "feat(app-retail): tabel menu aplikasi dengan penyaring tayang & peringatan cakupan"
```

---

### Task 7: Panel edit menu

Empat kolom, tidak lebih. Tidak ada tombol buat dan tidak ada tombol hapus — menu tetap milik POS.

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/app-retail/menu/MenuAppView.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/menu/PanelEditMenuApp.tsx`

**Interfaces:**
- Consumes: `toggleTayangDiApp`, `simpanDetailMenuApp` (Task 5); `MenuApp`, `hargaAplikasiTampil` dari `@/lib/appRetail/tampilanMenu` (Task 6)
- Produces: komponen `PanelEditMenuApp` dengan props `{ item: MenuApp; onTutup: () => void }`

- [ ] **Step 1: Tulis panel edit**

Buat `apps/admin-dashboard/src/app/dashboard/app-retail/menu/PanelEditMenuApp.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { X, Loader2, Smartphone } from 'lucide-react'
import { CurrencyInput, compressImageToWebP } from '@suka/design-system'
import { createClient } from '@/lib/supabase'
import { toggleTayangDiApp, simpanDetailMenuApp } from '../actions'
import { hargaAplikasiTampil, type MenuApp } from '@/lib/appRetail/tampilanMenu'

/** Bucket yang sudah dipakai POS. Bucket baru berarti kebijakan akses baru untuk untung nol. */
const BUCKET = 'menu_images'

export default function PanelEditMenuApp({ item, onTutup }: { item: MenuApp; onTutup: () => void }) {
  const hargaAwal = hargaAplikasiTampil(item.channel_prices)
  const [deskripsi, setDeskripsi] = useState(item.deskripsi_app ?? '')
  const [foto, setFoto] = useState(item.foto_app ?? '')
  const [harga, setHarga] = useState(hargaAwal === null ? '' : String(hargaAwal))
  const [galat, setGalat] = useState('')
  const [mengunggah, setMengunggah] = useState(false)
  const [menyimpan, mulaiSimpan] = useTransition()

  async function unggahFoto(file: File) {
    setMengunggah(true)
    setGalat('')
    try {
      const supabase = createClient()
      const kecil = await compressImageToWebP(file, 800, 800, 0.8)
      const nama = `app-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`
      const { error } = await supabase.storage.from(BUCKET).upload(nama, kecil, { contentType: 'image/webp' })
      if (error) { setGalat(`Unggah gagal: ${error.message}`); return }
      setFoto(supabase.storage.from(BUCKET).getPublicUrl(nama).data.publicUrl)
    } finally {
      setMengunggah(false)
    }
  }

  function simpan() {
    setGalat('')
    mulaiSimpan(async () => {
      try {
        await simpanDetailMenuApp({
          id: item.id,
          deskripsiApp: deskripsi.trim() || null,
          fotoApp: foto.trim() || null,
          hargaAplikasi: harga,
        })
        onTutup()
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal menyimpan')
      }
    })
  }

  function ubahTayang() {
    setGalat('')
    mulaiSimpan(async () => {
      try {
        await toggleTayangDiApp(item.id, item.tampil_di_app)
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal mengubah status tayang')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{item.name}</p>
            <p className="text-xs text-slate-500">Tampilan di SukaShawarma APP</p>
          </div>
          <button type="button" onClick={onTutup} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div
            onClick={ubahTayang}
            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none ${
              item.tampil_di_app ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/60'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Smartphone className={`w-4 h-4 ${item.tampil_di_app ? 'text-amber-600' : 'text-slate-400'}`} />
              {item.tampil_di_app ? 'Tayang di aplikasi' : 'Tidak tayang di aplikasi'}
            </span>
            <div className={`w-11 h-6 rounded-full relative ${item.tampil_di_app ? 'bg-amber-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full ${item.tampil_di_app ? 'left-6' : 'left-1'}`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Harga di aplikasi</label>
            <CurrencyInput
              value={harga}
              onChange={(v) => setHarga(String(v))}
              placeholder={String(item.price)}
              className="input w-full bg-white font-bold text-slate-900 text-sm py-2 border border-slate-200 rounded-xl"
            />
            <p className="text-[11px] text-slate-500">
              Kosongkan untuk memakai harga kasir ({item.price.toLocaleString('id-ID')}). Kosong berarti ikut harga
              kasir, <strong>bukan gratis</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Deskripsi di aplikasi</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={3}
              placeholder="Kosongkan untuk memakai deskripsi kasir"
              className="input w-full text-sm py-2 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Foto di aplikasi</label>
            {foto && <Image src={foto} alt="" width={96} height={96} className="w-24 h-24 rounded-xl object-cover" unoptimized />}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) unggahFoto(f) }}
              className="block w-full text-xs"
            />
            {mengunggah && <p className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Mengunggah…</p>}
            {foto && (
              <button type="button" onClick={() => setFoto('')} className="text-xs text-red-600 underline cursor-pointer">
                Hapus foto aplikasi (kembali memakai foto kasir)
              </button>
            )}
          </div>

          {galat && <p className="text-sm text-red-600">{galat}</p>}
        </div>

        <div className="p-4 border-t border-slate-200 sticky bottom-0 bg-white flex gap-2">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={menyimpan || mengunggah}
            className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm disabled:opacity-60 cursor-pointer"
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Sambungkan ke tabel**

Di `MenuAppView.tsx`: tambahkan impor dan state, jadikan setiap baris bisa diklik, dan render panelnya.

Impor:
```tsx
import PanelEditMenuApp from './PanelEditMenuApp'
```

State, di sebelah `bukaOutlet`:
```tsx
  const [dipilih, setDipilih] = useState<MenuApp | null>(null)
```

Baris tabel — tambahkan penanganan klik pada `<tr>`:
```tsx
                <tr
                  key={it.id}
                  onClick={() => setDipilih(it)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 cursor-pointer"
                >
```

Tepat sebelum `</div>` terluar:
```tsx
      {dipilih && <PanelEditMenuApp item={dipilih} onTutup={() => setDipilih(null)} />}
```

- [ ] **Step 3: Jalankan test & build**

```bash
../../node_modules/.bin/vitest run --dir src src/app/dashboard/app-retail
NEXT_TURBOPACK=0 yarn build
yarn type-check
```
Diharapkan: test PASS, build sukses, type-check tetap 3 error baseline.

- [ ] **Step 4: Periksa isolasi lalu commit**

```bash
git diff --name-only | grep -E "apps/pos-kasir|^mobile/|pos-admin/" || echo "ISOLASI OK"
git add apps/admin-dashboard/src/app/dashboard/app-retail/menu
git commit -m "feat(app-retail): panel edit menu - tayang, harga aplikasi, deskripsi, foto"
```

---

### Task 8: Halaman Outlet Aplikasi

`outlets.app_enabled` satu-satunya gerbang antara outlet dan pelanggan. Menyalakannya adalah tindakan menghadap publik.

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/OutletAppView.tsx`

**Interfaces:**
- Consumes: `periksaKesiapanOutlet`, `OutletApp` (Task 2); `toggleOutletApp` (Task 5)
- Produces: tidak ada

- [ ] **Step 1: Tulis halaman server**

Ganti seluruh isi `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import OutletAppView from './OutletAppView'
import type { OutletApp } from '@/lib/appRetail/kesiapanOutlet'

export const dynamic = 'force-dynamic'

export default async function AppRetailOutletPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Outlet tes SENGAJA tidak disaring. Aturan "outlet tes jangan masuk
  // perhitungan" berlaku untuk laporan, bukan layar ini: retail-gateway juga
  // tidak menyaringnya, dan outlet tes satu-satunya baris app_enabled = true
  // hari ini. Menyaringnya akan menyembunyikan satu-satunya outlet yang
  // sedang melayani aplikasi. Marketplace dibuang karena gateway pun membuangnya.
  const [outletRes, menuRes] = await Promise.all([
    supabase
      .from('outlets')
      .select('id, name, type, is_active, app_enabled')
      .neq('type', 'marketplace')
      .order('name'),
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('tampil_di_app', true),
  ])

  return (
    <OutletAppView
      outlets={(outletRes.data ?? []) as OutletApp[]}
      jumlahMenuTayang={menuRes.count ?? 0}
    />
  )
}
```

Catatan: `jumlahMenuTayang` satu angka untuk semua outlet karena Tahap 1 memakai daftar menu global (spec §2 keputusan 3). Saat menu per-outlet dibangun, angka ini menjadi per-baris.

- [ ] **Step 2: Tulis komponennya**

Buat `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/OutletAppView.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Store } from 'lucide-react'
import { periksaKesiapanOutlet, type OutletApp } from '@/lib/appRetail/kesiapanOutlet'
import { toggleOutletApp } from '../actions'

export default function OutletAppView({
  outlets,
  jumlahMenuTayang,
}: {
  outlets: OutletApp[]
  jumlahMenuTayang: number
}) {
  const [galat, setGalat] = useState('')
  const [konfirmasi, setKonfirmasi] = useState<OutletApp | null>(null)
  const [bekerja, mulai] = useTransition()

  function ubah(outlet: OutletApp) {
    // Menyalakan outlet membuatnya langsung bisa dipesan pelanggan — minta
    // konfirmasi yang menyebut namanya. Mematikan hanya menutup pintu:
    // pesanan berjalan tidak terpengaruh karena draft dan orders sudah
    // menyimpan outlet_id masing-masing.
    if (!outlet.app_enabled) { setKonfirmasi(outlet); return }
    jalankan(outlet)
  }

  function jalankan(outlet: OutletApp) {
    setGalat('')
    setKonfirmasi(null)
    mulai(async () => {
      try {
        await toggleOutletApp(outlet.id, outlet.app_enabled)
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Gagal mengubah outlet')
      }
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Outlet Aplikasi</h1>
        <p className="text-sm text-slate-500">
          Menyalakan outlet membuat pelanggan bisa langsung memesan ke sana.
        </p>
      </div>

      {galat && <p className="text-sm text-red-600">{galat}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="text-left py-3 px-4 font-semibold text-slate-500">Outlet</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-500 hidden sm:table-cell">Jenis</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Aktif</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-500">Menu terbit</th>
              <th className="text-center py-3 px-4 font-semibold text-slate-500">Melayani aplikasi</th>
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => {
              const kesiapan = periksaKesiapanOutlet(o, jumlahMenuTayang)
              return (
                <tr key={o.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{o.name}</p>
                    {kesiapan.peringatan.map((p) => (
                      <p key={p} className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {p}
                      </p>
                    ))}
                  </td>
                  <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{o.type ?? '—'}</td>
                  <td className="py-3 px-4 text-center text-slate-500">{o.is_active ? 'Ya' : 'Tidak'}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{kesiapan.melayani ? jumlahMenuTayang : '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      disabled={bekerja}
                      onClick={() => ubah(o)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full disabled:opacity-60 cursor-pointer ${
                        o.app_enabled ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {o.app_enabled ? 'Melayani' : 'Mati'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {konfirmasi && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <p className="font-bold text-slate-900">Nyalakan {konfirmasi.name}?</p>
            </div>
            <p className="text-sm text-slate-600">
              Pelanggan akan langsung bisa memesan ke outlet ini dari aplikasi.
              {jumlahMenuTayang === 0 && ' Saat ini nol menu tayang, jadi katalognya akan kosong.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setKonfirmasi(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => jalankan(konfirmasi)}
                className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer"
              >
                Nyalakan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Jalankan test & build**

```bash
../../node_modules/.bin/vitest run --dir src
NEXT_TURBOPACK=0 yarn build
yarn type-check
```
Diharapkan: test hijau, build sukses dengan tiga rute `app-retail`, type-check tetap 3 error baseline.

- [ ] **Step 4: Periksa isolasi lalu commit**

```bash
git diff --name-only | grep -E "apps/pos-kasir|^mobile/|pos-admin/" || echo "ISOLASI OK"
git add apps/admin-dashboard/src/app/dashboard/app-retail/outlet
git commit -m "feat(app-retail): halaman Outlet Aplikasi dengan konfirmasi menyalakan & tanda kesiapan"
```

---

### Task 9: Verifikasi isolasi menyeluruh & catatan sesi

Pagar terakhir. Task ini yang membuktikan syarat keras owner dipenuhi, bukan sekadar diniatkan.

**Files:**
- Modify: `CLAUDE.md` (tambah entri sesi)

**Interfaces:**
- Consumes: seluruh task sebelumnya
- Produces: tidak ada

- [ ] **Step 1: Buktikan nol sentuhan ke POS di SELURUH cabang**

```bash
git diff --name-only origin/main...HEAD | grep -E "apps/pos-kasir|^mobile/|pos-admin/|^supabase/migrations/"
```
Diharapkan: **keluaran kosong**. Kalau ada satu baris pun, cabang ini melanggar syarat dan harus diperbaiki sebelum lanjut.

- [ ] **Step 2: Buktikan tidak ada baris sales_channels yang ditambahkan**

```bash
git diff origin/main...HEAD | grep -i "sales_channels"
```
Diharapkan: **keluaran kosong**.

- [ ] **Step 3: Buktikan kolom yang ditulis hanya yang diizinkan**

```bash
git diff origin/main...HEAD -- apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts | grep -E "^\+.*\.update\(" -A 6
```
Periksa dengan mata: hanya `tampil_di_app`, `deskripsi_app`, `foto_app`, `channel_prices`, dan `app_enabled` yang muncul. Tidak ada `price`, `sort_order`, `is_available`, `available_online_channels`, atau `is_published_order_online`.

- [ ] **Step 4: Jalankan seluruh pagar**

Dari `apps/admin-dashboard`:
```bash
yarn type-check
../../node_modules/.bin/vitest run --dir src
NEXT_TURBOPACK=0 yarn build
```
Diharapkan: 3 error baseline · test hijau · build sukses dengan `/dashboard/app-retail`, `/dashboard/app-retail/menu`, `/dashboard/app-retail/outlet`.

- [ ] **Step 5: Catat sesi di CLAUDE.md**

Tambahkan entri di bawah entri sesi terakhir, sebelum baris `**Last updated:**`:

```markdown
## Session 2026-09-09: Tab App Retail Tahap 1 (apps/admin-dashboard)

**Status:** ✅ Kode selesai. ⚠️ Perlu **redeploy `admin-dashboard`**.

Grup nav baru **App Retail** (OWNER/ADMIN) dengan tiga halaman: Ringkasan,
Pengaturan Menu Aplikasi, Outlet Aplikasi. Menutup dua lubang yang sebelumnya
hanya bisa diisi lewat SQL langsung ke tabel produksi — `menu_items.tampil_di_app`
beserta `foto_app`/`deskripsi_app`/harga aplikasi, dan `outlets.app_enabled`
yang bahkan tidak punya UI sama sekali padahal ia satu-satunya gerbang antara
outlet dan pelanggan (`GET /api/v1/outlets` menyaring persis kolom itu).

**Syarat keras owner: nol gangguan ke POS, web maupun native.** Ditegakkan
sebagai pemeriksaan, bukan niat: `git diff --name-only origin/main...HEAD`
harus nol baris di `apps/pos-kasir`, `mobile/`, `pos-admin/`, dan
`supabase/migrations/`. **Tahap 1 nol migration.**

### ⚠️ Gotcha: jangan tambahkan baris "Aplikasi" ke `sales_channels`
Mode "Satu Harga Semua" di `MenuView.tsx` menyapu SELURUH baris `sales_channels`
dan menulis satu harga ke tiap slug-nya. Baris "Aplikasi" di tabel itu membuat
harga aplikasi ikut tertimpa setiap kali admin mengatur harga food apps. Slug
`aplikasi` sengaja hidup hanya sebagai kunci di `menu_items.channel_prices`.

### ⚠️ Gotcha: `channel_prices` wajib digabung, bukan ditimpa
Satu kolom JSON memuat harga semua kanal. Menulis `{ aplikasi: ... }` polos
menghapus harga GoFood, GrabFood, dan ShopeeFood sekaligus. Semua penulisan
lewat `gabungHargaChannel` (`src/lib/appRetail/hargaAplikasi.ts`, ber-test).

### Diketahui, sengaja dibiarkan
Toggle & harga aplikasi masih ada juga di layar menu POS (pekerjaan pagi
9 Sep). Mencabutnya berarti menyentuh POS — melanggar syarat di atas — jadi
dibiarkan berdampingan. Dua tempat, satu kolom; membingungkan tapi tak bisa
menghasilkan data yang bertengkar.

**Spec/plan:** `docs/superpowers/specs/2026-09-09-app-retail-tahap1-design.md`,
`docs/superpowers/plans/2026-09-09-app-retail-tahap1.md`

**📝 Next:** redeploy `admin-dashboard`; smoke test sebagai ADMIN (nyalakan satu
menu, cek `GET /api/v1/catalog` ikut berubah); banner & voucher tahap berikutnya.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: catat sesi App Retail Tahap 1"
```

---

## Catatan untuk pelaksana

**Yang TIDAK dikerjakan di plan ini**, dan bukan kelalaian: banner · voucher ·
`urutan_app` (butuh kolom baru; `sort_order` dipakai bersama POS dan tidak boleh
ditulis) · menu per-outlet · membuat/menghapus menu · menyaring `is_active` di
`GET /api/v1/outlets` · memindahkan pengaturan aplikasi keluar dari layar POS.

**Kalau ada langkah yang memaksa menyentuh `pos-admin/`, `apps/pos-kasir`, atau
`mobile/`: berhenti dan laporkan.** Itu tanda rancangannya yang salah, bukan
izin untuk melanggar syaratnya.
