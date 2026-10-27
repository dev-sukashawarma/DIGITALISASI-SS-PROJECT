import { readFileSync } from 'fs'
import { resolve } from 'path'
import { OUTLET_CATEGORIES, CATEGORY_META } from '@/lib/expenseCategories'

const FINANCE_SRC = resolve(__dirname, '../..')
const ADMIN_SRC = resolve(__dirname, '../../../../admin-dashboard/src')
const MANAGER_SRC = resolve(__dirname, '../../../../manager/src')
const POS_APP = resolve(__dirname, '../../../../pos-kasir/app')

const norm = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()
const readNorm = (p: string) => norm(readFileSync(p, 'utf8'))

/**
 * Kontrak wajib: setiap perubahan pada Buku Kas (OPEX) di admin-dashboard
 * HARUS langsung tercermin identik di apps/finance, apps/manager, dan apps/pos-kasir.
 * Bila salah satu diubah sendirian, tes ini gagal di CI sebelum sempat di-deploy.
 */
const IDENTICAL_FILES = [
  'lib/expenseCategories.ts',
  'lib/expenseRow.ts',
  'lib/kasKecilTeraudit.ts',
  'lib/outletOwnership.ts',
  'lib/opexDariHr.ts',
  'lib/opexProrata.ts',
  'lib/opexDateRangeProrata.ts',
  'lib/pengeluaran/ambilPengeluaran.ts',
  'lib/pengeluaran/susunBaris.ts',
  'lib/pengeluaran/jointExpense.ts',
  'lib/server/ringkasanPayrollHr.ts',
  'app/actions/expenses.ts',
  'app/actions/hrPayroll.ts',
  'components/OpexCardDetailModals.tsx',
  'components/ExpenseFormModal.tsx',
  'components/TargetCombobox.tsx',
  'utils/opexPdfGenerator.ts',
] as const

function extractPettyCashAllowlist(source: string, fileLabel: string): string[] {
  const m = source.match(/from\('petty_cash_expenses'\)[\s\S]*?\.in\('category',\s*\[([\s\S]*?)\]\)/)
  if (!m) {
    throw new Error(`Tidak menemukan blok .in('category', [...]) untuk petty_cash_expenses di ${fileLabel}`)
  }
  const items = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
  return [...new Set(items)].sort()
}

describe('Paritas lintas-app Buku Kas (OPEX)', () => {
  describe('File inti OPEX finance identik 100% dengan admin-dashboard', () => {
    it.each(IDENTICAL_FILES)('%s', (rel) => {
      const financeContent = readNorm(resolve(FINANCE_SRC, rel))
      const adminContent = readNorm(resolve(ADMIN_SRC, rel))
      expect(financeContent).toBe(adminContent)
    })
  })

  it('Halaman Buku Kas (OPEX) finance identik dengan admin-dashboard (kecuali hook role 4 baris)', () => {
    const adminPage = readNorm(resolve(ADMIN_SRC, 'app/dashboard/reports/input-pengeluaran/page.tsx'))
      .replace(
        "import { useRole } from '@/components/layout/RoleContext'",
        "import { useFinanceRole } from '@/hooks/useFinanceRole'"
      )
      .replace(
        "export default function InputPengeluaranPage() {\n  const { role, outletId: userOutletId } = useRole()\n  const isAdmin = role === 'ADMIN' || role === 'OWNER'",
        "export default function BukuKasPage() {\n  const { role, isChecker } = useFinanceRole()\n  const isAdmin = isChecker"
      )
    const financePage = readNorm(resolve(FINANCE_SRC, 'app/laporan/buku-kas/page.tsx'))
    expect(financePage).toBe(adminPage)
  })

  it('lib/bukuKasLink.ts identik kecuali konstanta path per-app', () => {
    const normalizePaths = (s: string) =>
      s
        .replace(/export const BUKU_KAS_PATH = '[^']+'/, "export const BUKU_KAS_PATH = '__PATH__'")
        .replace(/export const PETTY_CASH_PATH = '[^']+'/, "export const PETTY_CASH_PATH = '__PETTY_PATH__'")

    const financeLink = normalizePaths(readNorm(resolve(FINANCE_SRC, 'lib/bukuKasLink.ts')))
    const adminLink = normalizePaths(readNorm(resolve(ADMIN_SRC, 'lib/bukuKasLink.ts')))
    expect(financeLink).toBe(adminLink)
  })

  it('Allowlist kategori petty_cash_expenses sinkron di admin-dashboard, finance, profitExport, dan manager', () => {
    const adminAllowlist = extractPettyCashAllowlist(
      readNorm(resolve(ADMIN_SRC, 'lib/pengeluaran/ambilPengeluaran.ts')),
      'admin-dashboard ambilPengeluaran.ts'
    )
    const financeAllowlist = extractPettyCashAllowlist(
      readNorm(resolve(FINANCE_SRC, 'lib/pengeluaran/ambilPengeluaran.ts')),
      'finance ambilPengeluaran.ts'
    )
    const profitExportAllowlist = extractPettyCashAllowlist(
      readNorm(resolve(ADMIN_SRC, 'app/actions/profitExport.ts')),
      'admin-dashboard profitExport.ts'
    )
    const managerAllowlist = extractPettyCashAllowlist(
      readNorm(resolve(MANAGER_SRC, 'app/actions/expenses.ts')),
      'manager actions/expenses.ts'
    )

    expect(financeAllowlist).toEqual(adminAllowlist)
    expect(profitExportAllowlist).toEqual(adminAllowlist)
    expect(managerAllowlist).toEqual(adminAllowlist)
  })

  it('Kategori outlet & label di apps/manager selaras dengan sumber kebenaran OPEX', () => {
    const managerCatSrc = readNorm(resolve(MANAGER_SRC, 'lib/expenseCategories.ts'))
    const blockMatch = managerCatSrc.match(/export const OUTLET_CATEGORIES = \[([\s\S]*?)\] as const/)
    expect(blockMatch).not.toBeNull()
    const managerOutletCats = [...blockMatch![1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort()

    const sensitiveInManager = new Set([
      'salary',
      'gaji_crew_outlet',
      'bonus_leader',
      'bonus_area_manager',
      'bonus_crew',
      'bonus_regional_manager',
    ])
    const expectedNonSensitive = OUTLET_CATEGORIES.filter(c => !sensitiveInManager.has(c)).sort()
    expect(managerOutletCats).toEqual(expectedNonSensitive)

    for (const cat of expectedNonSensitive) {
      const expectedLabel = CATEGORY_META[cat].label
      const labelRegex = new RegExp(`\\b${cat}:\\s*\\{\\s*label:\\s*'([^']+)'`)
      const m = managerCatSrc.match(labelRegex)
      expect(m?.[1]).toBe(expectedLabel)
    }
  })

  it('Pilihan kategori petty cash di apps/pos-kasir semuanya terdaftar di allowlist Buku Kas (termasuk gas)', () => {
    const posShiftSrc = readNorm(resolve(POS_APP, 'kasir/shift/page.tsx'))
    const optionValues = [...posShiftSrc.matchAll(/<option value="([^"]+)">/g)].map(m => m[1])
    expect(optionValues).toContain('gas')

    const allowlist = new Set(
      extractPettyCashAllowlist(
        readNorm(resolve(FINANCE_SRC, 'lib/pengeluaran/ambilPengeluaran.ts')),
        'finance ambilPengeluaran.ts'
      )
    )
    for (const v of optionValues) {
      expect(allowlist.has(v)).toBe(true)
    }
  })
})
