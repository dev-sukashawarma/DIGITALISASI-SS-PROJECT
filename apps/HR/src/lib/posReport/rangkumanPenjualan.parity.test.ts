import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Halaman Rangkuman Penjualan HR adalah SALINAN dari admin-dashboard
// (/dashboard/reports/pos); finance (/laporan/penjualan) punya tes kembar —
// ketiganya wajib identik. Kalau rumus/tampilan admin diubah tanpa HR,
// angka di dua dashboard tak lagi sama — tes ini gagal supaya keduanya
// diubah bersamaan. Perbedaan yang disengaja dinormalkan di bawah.
const HR = resolve(__dirname, '../..')
const ADMIN = resolve(__dirname, '../../../../admin-dashboard/src')

const norm = (s: string) =>
  s
    .replace(/\r\n/g, '\n')
    // HR punya lib/outletFilters sendiri (dari @suka/hr-rumus); salinan admin diberi nama lain.
    .replace(/'@\/lib\/outletFiltersPenjualan'/g, "'@/lib/outletFilters'")

const FILES: Array<[hr: string, admin: string]> = [
  ['lib/outletFiltersPenjualan.ts', 'lib/outletFilters.ts'],
  ['app/actions/posReport.ts', 'app/actions/posReport.ts'],
  ['app/penjualan/CategoryPieChart.tsx', 'app/dashboard/reports/pos/CategoryPieChart.tsx'],
  ['app/penjualan/ReceiptReprintBadge.tsx', 'app/dashboard/reports/pos/ReceiptReprintBadge.tsx'],
  ...[
    'components/BranchFilter.tsx',
    'components/MultiSelectDropdown.tsx',
    'components/OrderSourceBadge.tsx',
    'components/OutletCombobox.tsx',
    'components/ScheduledPromoBadge.tsx',
    'components/profit/AdminFeeBreakdownTooltip.tsx',
    'lib/channels.ts',
    'lib/fetchAllPages.ts',
    'lib/hpp/kanalSsOnline.ts',
    'lib/hpp/riwayatHpp.ts',
    'lib/marketplaceOutlets.ts',
    'lib/order-item-name.ts',
    'lib/order-source.ts',
    'lib/ownerDashboardCache.ts',
    'lib/posReport/compute.ts',
    'lib/posReport/dayCodec.ts',
    'lib/posReport/ekspor.ts',
    'lib/posReport/eksporExcel.ts',
    'lib/posReport/eksporPdf.ts',
    'lib/posReport/eksporUi.ts',
    'lib/posReport/laporan.ts',
    'lib/posReport/load.ts',
    'lib/posReport/prepared.ts',
    'lib/posReport/receiptReprint.ts',
    'lib/posReportKpi.ts',
    'lib/server/callerScope.ts',
    'lib/server/dayGenerations.ts',
    'lib/validations.ts',
    'pos-types.ts',
  ].map((f) => [f, f] as [string, string]),
]

describe('Rangkuman Penjualan HR = salinan admin-dashboard', () => {
  it.each(FILES)('%s identik dengan admin %s', (hr, admin) => {
    expect(norm(readFileSync(resolve(HR, hr), 'utf8'))).toBe(norm(readFileSync(resolve(ADMIN, admin), 'utf8')))
  })

  it('ReportsView hanya berbeda pada tautan Upload Settlement', () => {
    const hr = norm(readFileSync(resolve(HR, 'app/penjualan/ReportsView.tsx'), 'utf8'))
    const admin = norm(readFileSync(resolve(ADMIN, 'app/dashboard/reports/pos/ReportsView.tsx'), 'utf8'))
    const balikkan = hr
      .replace(/\/\/ Halaman upload settlement hanya ada di admin-dashboard\.\nconst ADMIN_URL = [^\n]+\n\n/, '')
      .replace(
        /<a\n(\s+)href=\{`\$\{ADMIN_URL\}\/dashboard\/platform-settlement`\}\n\s+target="_blank"\n\s+rel="noopener noreferrer"/,
        '<Link\n$1href="/dashboard/platform-settlement"',
      )
      .replace(/Upload Settlement ↗\n(\s+)<\/a>/, 'Upload Settlement ↗\n$1</Link>')
    expect(balikkan.replace("import Link from 'next/link'\n", '')).toBe(admin.replace("import Link from 'next/link'\n", ''))
  })
})
