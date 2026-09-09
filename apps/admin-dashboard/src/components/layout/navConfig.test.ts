import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  NAV_GROUPS,
  accessibleGroups,
  accessibleItems,
  labelForPath,
  primaryItems,
  type NavItem,
  type Role,
} from './navConfig'

/** Semua item nav, induk maupun sub-menu, tanpa memandang role. */
const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((i) => [i, ...(i.children ?? [])]),
)

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
    '/dashboard/app-retail',
    '/dashboard/app-retail/menu',
    '/dashboard/app-retail/outlet',
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
    '/dashboard/owner/profit/internal',
    '/dashboard/owner/profit/mitra',
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
    '/dashboard/reports/target-harian',
    '/dashboard/resep',
    '/dashboard/system-health',
  ],
  OWNER: [
    '/dashboard/app-retail',
    '/dashboard/app-retail/menu',
    '/dashboard/app-retail/outlet',
    '/dashboard/budget-outlet',
    '/dashboard/data-validate',
    '/dashboard/monitoring',
    '/dashboard/owner',
    '/dashboard/owner/expenses',
    '/dashboard/owner/kelola-mitra',
    '/dashboard/owner/petty-cash',
    '/dashboard/owner/profit',
    '/dashboard/owner/profit/internal',
    '/dashboard/owner/profit/mitra',
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
  ADMIN: 8,
  OWNER: 6,
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
    const hrefs = [...new Set(ALL_ITEMS.map((i) => i.href))]
    const missing = hrefs.filter(
      (href) => !existsSync(join(process.cwd(), 'src/app', href, 'page.tsx')),
    )
    expect(missing).toEqual([])
  })

  it('sub-menu hanya satu tingkat — anak tidak boleh punya anak lagi', () => {
    const grandchildren = NAV_GROUPS.flatMap((g) =>
      g.items.flatMap((i) => (i.children ?? []).filter((c) => c.children?.length)),
    )
    expect(grandchildren).toEqual([])
  })

  it('role anak selalu himpunan bagian dari role induknya', () => {
    const bocor = NAV_GROUPS.flatMap((g) =>
      g.items.flatMap((i) =>
        (i.children ?? [])
          .filter((c) => c.roles.some((r) => !i.roles.includes(r)))
          .map((c) => `${i.href} → ${c.href}`),
      ),
    )
    expect(bocor).toEqual([])
  })

  it('klaster beban berurutan sepintu: catat → analisis → dalami waste', () => {
    const door = NAV_GROUPS.find((g) =>
      g.items.some((i) => i.href === '/dashboard/reports/input-pengeluaran'),
    )
    const hrefs = door?.items.map((i) => i.href) ?? []
    const start = hrefs.indexOf('/dashboard/reports/input-pengeluaran')
    expect(start).toBeGreaterThanOrEqual(0)
    expect(hrefs.slice(start, start + 3)).toEqual([
      '/dashboard/reports/input-pengeluaran',
      '/dashboard/owner/expenses',
      '/dashboard/owner/waste',
    ])
  })

  it('Selisih Stok sengaja tak ada di nav, tapi halamannya tetap ada', () => {
    // Dilepas dari nav atas permintaan owner, BUKAN dihapus. Test ini menjaga
    // dua-duanya: tak muncul di nav, dan file halamannya tidak ikut terhapus
    // supaya bisa dikembalikan kapan saja.
    expect(ALL_ITEMS.some((i) => i.href === '/dashboard/reports/shrinkage')).toBe(false)
    expect(existsSync(join(process.cwd(), 'src/app/dashboard/reports/shrinkage/page.tsx'))).toBe(true)
  })

  it('Laba Rugi punya sub-menu Internal & Mitra', () => {
    const labaRugi = ALL_ITEMS.find((i) => i.href === '/dashboard/owner/profit')
    expect(labaRugi?.label).toBe('Laba Rugi')
    expect(labaRugi?.children?.map((c) => c.href)).toEqual([
      '/dashboard/owner/profit/internal',
      '/dashboard/owner/profit/mitra',
    ])
  })

  it.each(ROLES)('%s: himpunan route tidak berubah dari baseline', (role) => {
    const hrefs = [...new Set(accessibleItems(role).map((i) => i.href))].sort()
    expect(hrefs).toEqual(BASELINE_ROUTES[role])
  })

  it.each(ROLES)('%s melihat jumlah pintu yang diharapkan', (role) => {
    expect(accessibleGroups(role)).toHaveLength(EXPECTED_GROUP_COUNT[role])
  })

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
})

describe('labelForPath — judul header', () => {
  it('mengenali sub-menu, bukan cuma induknya', () => {
    expect(labelForPath('/dashboard/owner/profit')).toBe('Laba Rugi')
    expect(labelForPath('/dashboard/owner/profit/internal')).toBe('Laba Rugi Internal')
    expect(labelForPath('/dashboard/owner/profit/mitra')).toBe('Laba Rugi Mitra')
  })
})

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
