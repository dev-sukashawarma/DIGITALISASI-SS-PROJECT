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
