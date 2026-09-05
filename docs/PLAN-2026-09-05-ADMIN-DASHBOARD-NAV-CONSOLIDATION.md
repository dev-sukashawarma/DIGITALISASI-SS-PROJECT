# Konsolidasi Navigasi ADMIN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memangkas navigasi role ADMIN di `apps/admin-dashboard` dari 10 pintu / 51 entri menjadi 7 pintu / 48 entri tanpa menghilangkan satu route pun, dan menjadikan isi bottom-nav mobile sebuah keputusan eksplisit alih-alih efek samping urutan array.

**Architecture:** Seluruh perubahan struktur terjadi di satu file konfigurasi, `navConfig.ts`. Grup nav dipakai bersama beberapa role, jadi item tidak dipindahkan antar grup — yang diubah adalah field `roles` per item, sehingga ADMIN melihat susunan baru sementara OWNER/PURCHASING melihat himpunan route yang persis sama seperti hari ini. Bottom-nav mendapat field opsional `primary?: Role[]` dan helper `primaryItems()` yang jatuh kembali ke perilaku `slice(0, 4)` untuk role tanpa penandaan.

**Tech Stack:** TypeScript, Next.js App Router, vitest 2.1 (`yarn test` = `vitest run`), lucide-react untuk ikon.

**Spec:** `docs/SPEC-2026-09-05-ADMIN-DASHBOARD-NAV-CONSOLIDATION.md`

## Global Constraints

- **Scope hanya role `ADMIN`.** Enam role lain (OWNER, ADMIN_HR, PURCHASING, LEADER, AREA_MANAGER, MITRA) harus berakhir dengan himpunan route dan jumlah grup yang identik. Satu-satunya perubahan yang boleh terlihat oleh role lain adalah judul grup `Pembelian & PO` → `Pembelian` (terlihat oleh PURCHASING).
- **Nol route hilang.** Himpunan 48 route unik ADMIN sebelum = sesudah. Bukan jumlahnya saja — himpunannya.
- **Tidak ada `href` yang berubah.** Tidak ada halaman yang dibuat, dihapus, dipindah, atau di-rename. Bookmark pengguna harus tetap hidup.
- **`Sidebar.tsx` tidak disentuh.** Begitu pula `isItemActive()` dan `labelForPath()`.
- Direktori kerja untuk semua perintah: `apps/admin-dashboard`.
- Test runner: `yarn test` (vitest run). Type check: `yarn type-check`. Build: `yarn build`.
- Repo ini punya error type-check dan test yang gagal sejak sebelum pekerjaan ini (baseline). Yang dinilai adalah tidak adanya kegagalan **baru** di file yang disentuh.

---

### Task 1: Test invarian nav + restrukturisasi grup ADMIN

Tugas ini menulis test invarian lebih dulu — salah satunya sengaja merah pada kode hari ini karena mendeteksi tiga entri kembar — lalu merestrukturisasi `NAV_GROUPS` sampai semuanya hijau.

**Files:**
- Create: `src/components/layout/navConfig.test.ts`
- Modify: `src/components/layout/navConfig.ts` (`NAV_GROUPS`, seluruh array)

**Interfaces:**
- Consumes: `NAV_GROUPS`, `accessibleItems(role)`, `accessibleGroups(role)`, `Role` — semuanya sudah ada di `navConfig.ts`.
- Produces: `NAV_GROUPS` dengan susunan ADMIN 7 grup. Task 2 menambahkan `primary` ke sebagian item di array yang sama.

- [ ] **Step 1: Tulis file test invarian**

Buat `src/components/layout/navConfig.test.ts` dengan isi berikut. Snapshot route di dalamnya diambil dari kode **sebelum** perubahan — itulah gunanya: membuktikan tidak ada yang hilang.

```ts
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  NAV_GROUPS,
  accessibleGroups,
  accessibleItems,
  type Role,
} from './navConfig'

const ROLES: Role[] = [
  'ADMIN',
  'OWNER',
  'ADMIN_HR',
  'PURCHASING',
  'LEADER',
  'AREA_MANAGER',
  'MITRA',
]

/**
 * Himpunan route per role, diukur dari navConfig.ts sebelum konsolidasi.
 * Ini adalah kontrak "nol item hilang" — kalau sebuah route lenyap dari nav,
 * test ini merah, bukan sekadar jumlahnya yang bergeser.
 */
const BASELINE_ROUTES: Record<Role, string[]> = {
  ADMIN: [
    '/dashboard/bahan-baku',
    '/dashboard/budget-outlet',
    '/dashboard/bukti-qris',
    '/dashboard/data-validate',
    '/dashboard/hr',
    '/dashboard/hr/attendance',
    '/dashboard/hr/leave',
    '/dashboard/hr/payroll',
    '/dashboard/hr/staff',
    '/dashboard/monitoring',
    '/dashboard/opname',
    '/dashboard/outlets',
    '/dashboard/owner',
    '/dashboard/owner/expenses',
    '/dashboard/owner/kelola-mitra',
    '/dashboard/owner/petty-cash',
    '/dashboard/owner/profit',
    '/dashboard/owner/rekap-absensi',
    '/dashboard/owner/rekap-bulanan',
    '/dashboard/owner/targets',
    '/dashboard/owner/waste',
    '/dashboard/panduan',
    '/dashboard/pawoon-import',
    '/dashboard/pawoon-import/mapping',
    '/dashboard/pawoon-import/synced',
    '/dashboard/pembelian',
    '/dashboard/pembelian/harga',
    '/dashboard/pembelian/perlu-dibeli',
    '/dashboard/pembelian/permintaan',
    '/dashboard/pembelian/supplier',
    '/dashboard/petty-cash-balance',
    '/dashboard/platform-settlement',
    '/dashboard/pos-admin',
    '/dashboard/pos-admin/categories',
    '/dashboard/pos-admin/menu',
    '/dashboard/pos-admin/promo',
    '/dashboard/pos-admin/settings',
    '/dashboard/pos-admin/users',
    '/dashboard/printer',
    '/dashboard/push-center',
    '/dashboard/reports/crew-bonus',
    '/dashboard/reports/input-pengeluaran',
    '/dashboard/reports/pembelian',
    '/dashboard/reports/pos',
    '/dashboard/reports/shrinkage',
    '/dashboard/reports/target-harian',
    '/dashboard/resep',
    '/dashboard/system-health',
  ],
  OWNER: [
    '/dashboard/budget-outlet',
    '/dashboard/data-validate',
    '/dashboard/monitoring',
    '/dashboard/owner',
    '/dashboard/owner/expenses',
    '/dashboard/owner/kelola-mitra',
    '/dashboard/owner/petty-cash',
    '/dashboard/owner/profit',
    '/dashboard/owner/rekap-absensi',
    '/dashboard/owner/rekap-bulanan',
    '/dashboard/owner/targets',
    '/dashboard/owner/waste',
    '/dashboard/panduan',
    '/dashboard/pawoon-import',
    '/dashboard/pawoon-import/mapping',
    '/dashboard/pawoon-import/synced',
    '/dashboard/platform-settlement',
    '/dashboard/reports/crew-bonus',
    '/dashboard/reports/input-pengeluaran',
    '/dashboard/reports/pos',
    '/dashboard/reports/shrinkage',
    '/dashboard/reports/target-harian',
  ],
  ADMIN_HR: [
    '/dashboard/hr',
    '/dashboard/hr/attendance',
    '/dashboard/hr/leave',
    '/dashboard/hr/payroll',
    '/dashboard/hr/staff',
  ],
  PURCHASING: [
    '/dashboard/pembelian',
    '/dashboard/pembelian/harga',
    '/dashboard/pembelian/perlu-dibeli',
    '/dashboard/pembelian/permintaan',
    '/dashboard/pembelian/supplier',
    '/dashboard/reports/pembelian',
  ],
  LEADER: [
    '/dashboard/leader',
    '/dashboard/leader/petty-cash',
    '/dashboard/leader/sales',
    '/dashboard/leader/stock',
  ],
  AREA_MANAGER: ['/dashboard/area-manager/petty-cash'],
  MITRA: [
    '/dashboard/mitra',
    '/dashboard/mitra/orderan',
    '/dashboard/mitra/saran',
    '/dashboard/mitra/tim',
    '/dashboard/mitra/transfer',
  ],
}

/** Jumlah pintu per role setelah konsolidasi. Hanya ADMIN yang berubah (10 → 7). */
const EXPECTED_GROUP_COUNT: Record<Role, number> = {
  ADMIN: 7,
  OWNER: 5,
  ADMIN_HR: 1,
  PURCHASING: 1,
  LEADER: 1,
  AREA_MANAGER: 1,
  MITRA: 1,
}

describe('navConfig — invarian', () => {
  it.each(ROLES)('%s tidak melihat href kembar', (role) => {
    const hrefs = accessibleItems(role).map((i) => i.href)
    expect(hrefs).toHaveLength(new Set(hrefs).size)
  })

  it.each(ROLES)('%s punya minimal satu pintu, dan tak ada pintu kosong', (role) => {
    const groups = accessibleGroups(role)
    expect(groups.length).toBeGreaterThan(0)
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0)
    }
  })

  it('setiap href di nav punya page.tsx yang benar-benar ada', () => {
    const hrefs = [...new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)))]
    const missing = hrefs.filter(
      (href) => !existsSync(join(process.cwd(), 'src/app', href, 'page.tsx')),
    )
    expect(missing).toEqual([])
  })

  it.each(ROLES)('%s: himpunan route tidak berubah dari baseline', (role) => {
    const hrefs = [...new Set(accessibleItems(role).map((i) => i.href))].sort()
    expect(hrefs).toEqual(BASELINE_ROUTES[role])
  })

  it.each(ROLES)('%s melihat jumlah pintu yang diharapkan', (role) => {
    expect(accessibleGroups(role)).toHaveLength(EXPECTED_GROUP_COUNT[role])
  })

  it('ADMIN melihat tujuh pintu dengan urutan yang ditentukan', () => {
    expect(accessibleGroups('ADMIN').map((g) => g.title)).toEqual([
      'Bisnis',
      'Pusat Laporan',
      'Produk & Stok',
      'Pembelian',
      'POS',
      'Karyawan',
      'Sistem',
    ])
  })
})
```

- [ ] **Step 2: Jalankan test — harus merah**

Run: `yarn test src/components/layout/navConfig.test.ts`

Expected: FAIL. Tiga kegagalan spesifik, dan ketiganya memang yang mau kita perbaiki:
1. `ADMIN tidak melihat href kembar` — 51 entri vs 48 unik.
2. `ADMIN melihat jumlah pintu yang diharapkan` — dapat 10, diharapkan 7.
3. `ADMIN melihat tujuh pintu dengan urutan yang ditentukan` — masih ada `Pengadaan`, `Kemitraan`, `Migrasi Data`.

Kalau ada kegagalan **selain** ketiganya (misalnya `setiap href di nav punya page.tsx`), berhenti dan laporkan — artinya ada asumsi di plan ini yang salah.

- [ ] **Step 3: Persempit `roles` di grup Bisnis dan tambahkan Kemitraan**

Di `src/components/layout/navConfig.ts`, ganti seluruh grup `Bisnis` dengan:

```ts
  {
    title: 'Bisnis',
    icon: Wallet,
    roles: ['OWNER', 'ADMIN'],
    items: [
      { href: '/dashboard/owner', label: 'Ringkasan Bisnis', shortLabel: 'Ringkasan', icon: PieChart, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/petty-cash', label: 'Petty Cash (Khusus)', shortLabel: 'Petty Cash', icon: Banknote, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/rekap-absensi', label: 'Rekap Absensi (Stealth)', shortLabel: 'Absensi Stealth', icon: Camera, roles: ['OWNER'] },
      { href: '/dashboard/owner/profit', label: 'Untung Rugi', shortLabel: 'Untung Rugi', icon: DollarSign, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/expenses', label: 'Pengeluaran', shortLabel: 'Biaya', icon: TrendingDown, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/targets', label: 'Target & Pesan', shortLabel: 'Target', icon: Target, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/budget-outlet', label: 'Budget Outlet', shortLabel: 'Budget', icon: Wallet, roles: ['OWNER', 'ADMIN'] },
      { href: '/dashboard/owner/kelola-mitra', label: 'Dashboard Kemitraan', shortLabel: 'Kemitraan', icon: HeartHandshake, roles: ['ADMIN'] },
    ],
  },
```

Dua perubahan: `rekap-absensi` kini `['OWNER']` saja (ADMIN akan melihatnya di pintu Karyawan pada Step 7), dan `kelola-mitra` ditambahkan di akhir untuk ADMIN. Urutan tujuh item pertama tidak diubah, supaya empat item pertama OWNER — yang menentukan bottom-nav OWNER — tetap sama.

- [ ] **Step 4: Buang entri Pembelian yang kembar dari Pusat Laporan**

Di grup `Pusat Laporan`, hapus baris terakhir ini seluruhnya:

```ts
      { href: '/dashboard/reports/pembelian', label: 'Pembelian', shortLabel: 'Pembelian', icon: ShoppingCart, roles: ['ADMIN'] },
```

Route yang sama tetap dijangkau ADMIN lewat "Laporan Pembelian" di grup Pembelian. Judul grup `Pusat Laporan` **tidak** diubah — grup ini dipakai bersama OWNER.

- [ ] **Step 5: Hapus grup Pengadaan seluruhnya**

Hapus blok ini dari `NAV_GROUPS`:

```ts
  {
    title: 'Pengadaan',
    icon: ShoppingCart,
    roles: ['ADMIN'],
    items: [
      { href: '/dashboard/pembelian', label: 'Purchase Order', shortLabel: 'PO', icon: ShoppingCart, roles: ['ADMIN'] },
      { href: '/dashboard/pembelian/supplier', label: 'Master Supplier', shortLabel: 'Supplier', icon: Truck, roles: ['ADMIN'] },
    ],
  },
```

Kedua route-nya sudah ada di grup `Pembelian & PO` dengan `roles` yang memuat ADMIN.

- [ ] **Step 6: Ganti judul dua grup ADMIN-only dan grup Pembelian**

Tiga perubahan judul, masing-masing satu baris:

```ts
    title: 'Pembelian & PO',   →   title: 'Pembelian',
    title: 'Manajemen POS',    →   title: 'POS',
```

`Pembelian` juga terlihat oleh PURCHASING; itu disengaja dan sudah disetujui di spec. `POS` hanya milik ADMIN. Jangan menyentuh judul `Pusat Laporan` atau `Sistem` — keduanya dipakai bersama OWNER.

- [ ] **Step 7: Pindahkan Rekap Absensi ke grup Karyawan untuk ADMIN**

Di grup `Karyawan`, tambahkan satu item di akhir daftar (setelah Payroll & Kasbon):

```ts
      { href: '/dashboard/owner/rekap-absensi', label: 'Rekap Absensi (Stealth)', shortLabel: 'Absensi Stealth', icon: Camera, roles: ['ADMIN'] },
```

Perhatikan `roles: ['ADMIN']` — ADMIN_HR sengaja tidak diberi akses baru; ia tidak memilikinya hari ini.

- [ ] **Step 8: Lebur item Migrasi Data ke grup Sistem untuk ADMIN**

Di grup `Sistem`, tambahkan lima item di akhir daftar (setelah Pengaturan Printer):

```ts
      { href: '/dashboard/pawoon-import', label: 'Migrasi Pawoon', shortLabel: 'Pawoon', icon: UploadCloud, roles: ['ADMIN'] },
      { href: '/dashboard/pawoon-import/synced', label: 'Data Tersinkron', shortLabel: 'Tersinkron', icon: Activity, roles: ['ADMIN'] },
      { href: '/dashboard/pawoon-import/mapping', label: 'Mapping Menu Pawoon', shortLabel: 'Mapping', icon: ArrowRightLeft, roles: ['ADMIN'] },
      { href: '/dashboard/platform-settlement', label: 'Settlement Food Apps', shortLabel: 'Food Apps', icon: Percent, roles: ['ADMIN'] },
      { href: '/dashboard/data-validate', label: 'Data Validate', shortLabel: 'Data Validate', icon: ClipboardList, roles: ['ADMIN'] },
```

Judul grup tetap `Sistem`.

- [ ] **Step 9: Persempit grup Kemitraan dan Migrasi Data ke OWNER**

Ganti seluruh grup `Kemitraan` dengan:

```ts
  {
    title: 'Kemitraan',
    icon: HeartHandshake,
    roles: ['OWNER'],
    items: [
      { href: '/dashboard/owner/kelola-mitra', label: 'Dashboard Kemitraan', shortLabel: 'Kemitraan', icon: HeartHandshake, roles: ['OWNER'] },
    ],
  },
```

Dan ganti seluruh grup `Migrasi Data` dengan:

```ts
  {
    title: 'Migrasi Data',
    icon: UploadCloud,
    roles: ['OWNER'],
    items: [
      { href: '/dashboard/pawoon-import', label: 'Migrasi Pawoon', shortLabel: 'Pawoon', icon: UploadCloud, roles: ['OWNER'] },
      { href: '/dashboard/pawoon-import/synced', label: 'Data Tersinkron', shortLabel: 'Tersinkron', icon: Activity, roles: ['OWNER'] },
      { href: '/dashboard/pawoon-import/mapping', label: 'Mapping Menu Pawoon', shortLabel: 'Mapping', icon: ArrowRightLeft, roles: ['OWNER'] },
      { href: '/dashboard/platform-settlement', label: 'Settlement Food Apps', shortLabel: 'Food Apps', icon: Percent, roles: ['OWNER'] },
      { href: '/dashboard/data-validate', label: 'Data Validate', shortLabel: 'Data Validate', icon: ClipboardList, roles: ['OWNER'] },
    ],
  },
```

Kedua grup ini sekarang OWNER-only; ADMIN mendapat isinya lewat `Bisnis` dan `Sistem`.

- [ ] **Step 10: Jalankan test — harus hijau**

Run: `yarn test src/components/layout/navConfig.test.ts`

Expected: PASS, seluruh test. Yang paling penting untuk dibaca: `ADMIN: himpunan route tidak berubah dari baseline` dan keenam varian non-ADMIN-nya. Kalau salah satu role non-ADMIN merah, sebuah `roles` dipersempit terlalu jauh — periksa Step 3 dan Step 9.

- [ ] **Step 11: Commit**

```bash
git add src/components/layout/navConfig.ts src/components/layout/navConfig.test.ts
git commit -m "refactor(nav): konsolidasi pintu ADMIN dari 10 jadi 7

Buang grup Pengadaan (duplikat persis Pembelian & PO) dan entri
reports/pembelian yang kembar. Kemitraan dan Migrasi Data jadi OWNER-only;
ADMIN mendapat isinya lewat Bisnis dan Sistem. Rekap Absensi (Stealth)
pindah ke pintu Karyawan untuk ADMIN.

Route yang dijangkau tiap role tidak berubah — dijaga test snapshot per role.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Bottom-nav mobile eksplisit

**Files:**
- Modify: `src/components/layout/navConfig.ts` (tipe `NavItem`, empat item di `NAV_GROUPS`, fungsi baru `primaryItems`)
- Modify: `src/components/layout/BottomNav.tsx:22`
- Modify: `src/components/layout/navConfig.test.ts` (tambah blok describe baru)

**Interfaces:**
- Consumes: `NAV_GROUPS` hasil Task 1, `accessibleItems(role)`, tipe `Role`.
- Produces: `export function primaryItems(role: Role): NavItem[]` — mengembalikan tepat ≤4 item, semuanya anggota `accessibleItems(role)`. Item bertanda `primary` untuk role tersebut didahulukan, sisanya diisi menurut urutan `accessibleItems`.

- [ ] **Step 1: Tulis test untuk `primaryItems`**

Tambahkan di akhir `src/components/layout/navConfig.test.ts`, dan tambahkan `primaryItems` ke daftar import di baris atas file:

```ts
describe('primaryItems — bottom nav', () => {
  it.each(ROLES)('%s: maksimal 4 item, semuanya bisa diakses role itu', (role) => {
    const primary = primaryItems(role)
    const all = accessibleItems(role)
    expect(primary.length).toBeLessThanOrEqual(4)
    for (const item of primary) {
      expect(all).toContain(item)
    }
  })

  it('ADMIN mendapat empat tab yang dipilih sengaja', () => {
    expect(primaryItems('ADMIN').map((i) => i.href)).toEqual([
      '/dashboard/owner',
      '/dashboard/reports/pos',
      '/dashboard/pembelian',
      '/dashboard/hr',
    ])
  })

  it.each(['OWNER', 'ADMIN_HR', 'PURCHASING', 'LEADER', 'AREA_MANAGER', 'MITRA'] as Role[])(
    '%s tanpa penandaan tetap dapat empat item pertama seperti sebelumnya',
    (role) => {
      expect(primaryItems(role)).toEqual(accessibleItems(role).slice(0, 4))
    },
  )
})
```

Test terakhir itu yang menjaga janji "role lain tidak berubah": ia menyatakan perilaku lama `slice(0, 4)` secara eksplisit.

- [ ] **Step 2: Jalankan test — harus merah**

Run: `yarn test src/components/layout/navConfig.test.ts`

Expected: FAIL saat impor — `primaryItems` belum diekspor dari `navConfig.ts`.

- [ ] **Step 3: Tambahkan field `primary` ke tipe `NavItem`**

Ganti deklarasi tipe di `src/components/layout/navConfig.ts`:

```ts
export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  roles: Role[]
  /** Role yang menampilkan item ini di tab bar mobile. Maksimal 4 item per role. */
  primary?: Role[]
}
```

`Role[]` dan bukan `boolean`: satu item dipakai beberapa role, dan belum tentu jadi tab utama untuk semuanya.

- [ ] **Step 4: Tandai empat item ADMIN**

Tambahkan `primary: ['ADMIN']` pada empat item ini (masing-masing di grupnya sendiri — `Bisnis`, `Pusat Laporan`, `Pembelian`, `Karyawan`):

```ts
      { href: '/dashboard/owner', label: 'Ringkasan Bisnis', shortLabel: 'Ringkasan', icon: PieChart, roles: ['OWNER', 'ADMIN'], primary: ['ADMIN'] },
      { href: '/dashboard/reports/pos', label: 'Rangkuman Penjualan', shortLabel: 'Penjualan', icon: PieChart, roles: ['OWNER', 'ADMIN'], primary: ['ADMIN'] },
      { href: '/dashboard/pembelian', label: 'Purchase Order', shortLabel: 'PO', icon: ShoppingCart, roles: ['ADMIN', 'PURCHASING'], primary: ['ADMIN'] },
      { href: '/dashboard/hr', label: 'Ringkasan HR', shortLabel: 'HR', icon: LayoutDashboard, roles: ['ADMIN_HR', 'ADMIN'], primary: ['ADMIN'] },
```

Perhatikan item `/dashboard/pembelian` dan `/dashboard/hr` juga dipakai PURCHASING dan ADMIN_HR — karena `primary` hanya memuat `'ADMIN'`, bottom-nav mereka tidak terpengaruh.

- [ ] **Step 5: Tulis `primaryItems`**

Tambahkan tepat di bawah fungsi `accessibleItems` di `navConfig.ts`:

```ts
/**
 * Empat item untuk tab bar mobile. Item bertanda `primary` untuk role tsb
 * didahulukan; sisanya diisi menurut urutan `accessibleItems(role)`, sehingga
 * role tanpa penandaan berperilaku persis seperti `slice(0, 4)` sebelumnya.
 */
export function primaryItems(role: Role): NavItem[] {
  const items = accessibleItems(role)
  const marked = items.filter((i) => i.primary?.includes(role))
  const rest = items.filter((i) => !i.primary?.includes(role))
  return [...marked, ...rest].slice(0, 4)
}
```

- [ ] **Step 6: Jalankan test — harus hijau**

Run: `yarn test src/components/layout/navConfig.test.ts`

Expected: PASS, seluruh test termasuk blok `primaryItems` dan seluruh invarian Task 1.

- [ ] **Step 7: Sambungkan BottomNav**

Di `src/components/layout/BottomNav.tsx`, ubah impor pada baris 9 agar memuat `primaryItems`:

```ts
import { NAV_GROUPS, accessibleItems, isItemActive, primaryItems, resolvePortalUrl } from './navConfig'
```

Lalu ganti baris 21–22:

```ts
  // Show up to 4 primary items inline; the rest live in the "Menu" sheet.
  const inline = items.slice(0, 4)
```

menjadi:

```ts
  // Empat tab utama ditentukan lewat penanda `primary` di navConfig, bukan
  // kebetulan urutan array; sisanya tetap hidup di sheet "Menu".
  const inline = primaryItems(role)
```

Biarkan `const items = accessibleItems(role)` di baris 20 — `items` masih dipakai di bagian lain komponen. Kalau `yarn type-check` melaporkan `items` tak terpakai, barulah hapus baris itu.

- [ ] **Step 8: Verifikasi type-check bersih**

Run: `yarn type-check`

Expected: tidak ada error baru yang menyebut `navConfig.ts` atau `BottomNav.tsx`. Repo ini punya error pre-existing di file lain; abaikan yang tidak menyebut kedua file itu.

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/navConfig.ts src/components/layout/navConfig.test.ts src/components/layout/BottomNav.tsx
git commit -m "feat(nav): tentukan tab bottom-nav secara eksplisit

BottomNav dulu memakai accessibleItems(role).slice(0, 4), sehingga isi tab
bar mobile adalah efek samping urutan array — untuk ADMIN hasilnya Petty
Cash (Khusus) dan Rekap Absensi (Stealth) jadi dua dari empat tab.

Tambah penanda opsional primary?: Role[] dan helper primaryItems(). Role
tanpa penandaan berperilaku persis seperti sebelumnya, dijaga test.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Verifikasi build dan catat di CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (root repo — tambah entri Session)

**Interfaces:**
- Consumes: hasil Task 1 dan Task 2. Tidak memproduksi kode.

- [ ] **Step 1: Jalankan seluruh test suite**

Run: `yarn test`

Expected: file `navConfig.test.ts` seluruhnya hijau. Repo ini punya test yang gagal sejak sebelum pekerjaan ini — catat jumlahnya, dan pastikan tidak ada kegagalan baru di luar file yang disentuh. Kalau ragu apakah suatu kegagalan baru atau lama, jalankan `git stash && yarn test` untuk mengukur baseline, lalu `git stash pop`.

- [ ] **Step 2: Jalankan build produksi**

Run: `yarn build`

Expected: build sukses. Nav bukan route, jadi daftar route di output harus identik dengan sebelumnya — kalau ada route yang hilang dari output, sesuatu di luar rencana ini ikut berubah.

- [ ] **Step 3: Smoke test manual di browser**

Jalankan `yarn dev`, login sebagai ADMIN, lalu periksa empat hal:

1. Sidebar menampilkan tepat tujuh pintu: Bisnis, Pusat Laporan, Produk & Stok, Pembelian, POS, Karyawan, Sistem.
2. Buka `/dashboard/pawoon-import` — accordion harus otomatis membuka pintu `Sistem` (perilaku `activeGroupTitle` di `Sidebar.tsx`), dan judul header halaman harus tetap "Migrasi Pawoon".
3. Buka `/dashboard/owner/rekap-absensi` — accordion membuka pintu `Karyawan`.
4. Perkecil jendela sampai di bawah `lg` — tab bar bawah berisi Ringkasan · Penjualan · PO · HR.

Kalau tersedia akun OWNER, buka juga sebagai OWNER dan pastikan masih lima pintu dengan `Kemitraan` dan `Migrasi Data` utuh.

- [ ] **Step 4: Catat di CLAUDE.md**

Tambahkan section baru tepat sebelum baris `**Last updated:**` di akhir `CLAUDE.md`, dan perbarui tanggal `Last updated` menjadi `2026-09-05`:

```markdown
## Session 2026-09-05: Konsolidasi Navigasi ADMIN (apps/admin-dashboard)

**Status:** ✅ Kode selesai. ⚠️ Perlu **redeploy `admin-dashboard`**.

Nav role ADMIN dipangkas dari 10 pintu / 51 entri jadi 7 pintu / 48 entri, nol
route hilang. Grup `Pengadaan` dibuang (duplikat persis `Pembelian & PO`), entri
`reports/pembelian` yang kembar dihapus satu, `Kemitraan` dan `Migrasi Data`
jadi OWNER-only dengan ADMIN mendapat isinya lewat `Bisnis` dan `Sistem`, dan
"Rekap Absensi (Stealth)" pindah ke pintu `Karyawan`.

**Gotcha:** grup nav dipakai bersama antar role. Memindahkan item antar grup
akan diam-diam mengubah nav OWNER — mekanismenya harus penyempitan `roles` per
item, bukan pemindahan. Karena alasan yang sama, rename `Pusat Laporan` dan
`Sistem` dibatalkan (keduanya milik OWNER juga).

**Bottom-nav:** `BottomNav.tsx` dulu memakai `slice(0, 4)`, jadi tab mobile ADMIN
berisi "Petty Cash (Khusus)" dan "Rekap Absensi (Stealth)" karena kebetulan
urutan array. Sekarang lewat penanda `primary?: Role[]` + `primaryItems()`;
role tanpa penandaan berperilaku persis seperti sebelumnya.

**Test:** `src/components/layout/navConfig.test.ts` (baru) — snapshot himpunan
route per role, larangan href kembar, dan cek setiap href punya `page.tsx`.

**Spec/plan:** `docs/SPEC-2026-09-05-ADMIN-DASHBOARD-NAV-CONSOLIDATION.md`,
`docs/PLAN-2026-09-05-ADMIN-DASHBOARD-NAV-CONSOLIDATION.md`

**📝 Next:** redeploy `admin-dashboard`; putuskan nasib 11 route yatim yang
didaftar di §8 spec.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: catat sesi konsolidasi navigasi ADMIN

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
