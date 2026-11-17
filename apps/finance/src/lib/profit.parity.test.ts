import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const FINANCE_APP = resolve(__dirname, '../..')
const FINANCE_SRC = resolve(__dirname, '..')
const ADMIN_APP = resolve(__dirname, '../../../admin-dashboard')
const ADMIN_SRC = resolve(ADMIN_APP, 'src')

const norm = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()
const readNorm = (p: string) => norm(readFileSync(p, 'utf8'))

/**
 * Kontrak wajib paritas Laba Rugi:
 * Setiap perubahan pada Laba Rugi di apps/admin-dashboard HARUS langsung
 * tercermin di apps/finance (dan sebaliknya). Bila salah satu diubah sendirian,
 * tes ini menggagalkan CI sebelum sempat di-deploy.
 */
const IDENTICAL_SRC_FILES = [
  'lib/outletTutup.ts',
  'lib/outletsOperasional.ts',
  'lib/period.ts',
  'lib/queryPaging.ts',
  'lib/ownerDashboardAlign.ts',
  'lib/gajiKantorPusat.ts',
  'lib/profit.ts',
  'lib/profitWaterfall.ts',
  'lib/hpp/fetchHpp.ts',
  'lib/closing/labaKotorInternalClosingSeptember2026.ts',
  'lib/closing/pendapatanMitraClosingSeptember2026.ts',
  'lib/closing/closingOktober2026.ts',
  'lib/closing/closingBulanan.ts',
  'lib/export/profitExportService.ts',
  'lib/export/profitExportFetcher.ts',
  'hooks/useOutlets.ts',
  'hooks/useSalesDaily.ts',
  'hooks/useProratedOpex.ts',
  'hooks/useHpp.ts',
  'hooks/useWaste.ts',
  'hooks/useTikTokSettlement.ts',
  'hooks/usePendapatanLain.ts',
  'components/OutletCombobox.tsx',
  'components/NetProfitBreakdownModal.tsx',
  'components/profit/ChannelLogo.tsx',
  'components/profit/GrossSalesBreakdownModal.tsx',
  'components/profit/DownloadProfitDataModal.tsx',
] as const

const IDENTICAL_LOGO_FILES = [
  'public/logos/gofood.svg',
  'public/logos/grabfood.svg',
  'public/logos/shopeefood.svg',
  'public/logos/tiktokgo.svg',
] as const

describe('Paritas lintas-app Laba Rugi (admin-dashboard <-> finance)', () => {
  describe('Berkas inti Laba Rugi finance identik 100% dengan admin-dashboard', () => {
    it.each(IDENTICAL_SRC_FILES)('%s', (rel) => {
      const financePath = resolve(FINANCE_SRC, rel)
      const adminPath = resolve(ADMIN_SRC, rel)
      expect(existsSync(financePath), `berkas tidak ada di finance: ${rel}`).toBe(true)
      expect(existsSync(adminPath), `berkas tidak ada di admin-dashboard: ${rel}`).toBe(true)
      expect(readNorm(financePath)).toBe(readNorm(adminPath))
    })
  })

  describe('Aset logo channel Laba Rugi identik 100% dengan admin-dashboard', () => {
    it.each(IDENTICAL_LOGO_FILES)('%s', (rel) => {
      const financePath = resolve(FINANCE_APP, rel)
      const adminPath = resolve(ADMIN_APP, rel)
      expect(existsSync(financePath), `aset tidak ada di finance: ${rel}`).toBe(true)
      expect(existsSync(adminPath), `aset tidak ada di admin-dashboard: ${rel}`).toBe(true)
      expect(readNorm(financePath)).toBe(readNorm(adminPath))
    })
  })

  it('ProfitView.tsx identik dengan admin-dashboard (kecuali tautan wasteDetailHref per-app)', () => {
    const adminView = readNorm(resolve(ADMIN_SRC, 'app/dashboard/owner/profit/ProfitView.tsx')).replace(
      'wasteDetailHref="/dashboard/owner/waste"',
      'wasteDetailHref="/laporan/waste"',
    )
    const financeView = readNorm(resolve(FINANCE_SRC, 'app/laporan/laba-rugi/ProfitView.tsx'))
    expect(financeView).toBe(adminView)
  })

  it('CogsWasteBreakdownModal.tsx identik kecuali default wasteDetailHref', () => {
    const adminModal = readNorm(resolve(ADMIN_SRC, 'components/profit/CogsWasteBreakdownModal.tsx')).replace(
      "wasteDetailHref = '/dashboard/owner/waste'",
      "wasteDetailHref = '/laporan/waste'",
    )
    const financeModal = readNorm(resolve(FINANCE_SRC, 'components/profit/CogsWasteBreakdownModal.tsx'))
    expect(financeModal).toBe(adminModal)
  })

  it('OpexBreakdownModal.tsx identik kecuali default detailHref per-app', () => {
    const adminModal = readNorm(resolve(ADMIN_SRC, 'components/profit/OpexBreakdownModal.tsx'))
      .replace("monthly: '/dashboard/reports/input-pengeluaran'", "monthly: '/laporan/buku-kas'")
      .replace("pettyCash: '/dashboard/owner/petty-cash'", "pettyCash: '/petty-cash'")
    const financeModal = readNorm(resolve(FINANCE_SRC, 'components/profit/OpexBreakdownModal.tsx'))
    expect(financeModal).toBe(adminModal)
  })

  it('PeriodFilter.tsx identik kecuali DEFAULT_PRESETS per-app', () => {
    const adminFilter = readNorm(resolve(ADMIN_SRC, 'components/PeriodFilter.tsx')).replace(
      "const DEFAULT_PRESETS: Preset[] = ['yesterday', 'today', 'last_month', 'this_month']",
      "const DEFAULT_PRESETS: Preset[] = ['yesterday', 'today', '7d', '30d', 'this_month']",
    )
    const financeFilter = readNorm(resolve(FINANCE_SRC, 'components/PeriodFilter.tsx'))
    expect(financeFilter).toBe(adminFilter)
  })

  it('prorataAuxiliary.ts identik kecuali helper service client per-app', () => {
    const adminAux = readNorm(resolve(ADMIN_SRC, 'app/actions/prorataAuxiliary.ts'))
      .replace("import { createServiceClient } from '@/lib/supabase/server'", "import { getServiceSupabase } from '@/lib/supabase-service'")
      .replace('const supabase = createServiceClient()', 'const supabase = getServiceSupabase()')
    const financeAux = readNorm(resolve(FINANCE_SRC, 'app/actions/prorataAuxiliary.ts'))
    expect(financeAux).toBe(adminAux)
  })

  it('useExpenses.ts identik kecuali nama channel realtime & urutan import', () => {
    const normalize = (s: string) =>
      s
        .replace(/'(admin|finance)-expenses-realtime-sub'/, "'__CHANNEL__'")
        .replace(
          "import { susunBarisPengeluaran } from '@/lib/pengeluaran/susunBaris'\nimport { getExpensesAction } from '@/app/actions/expenses'\nimport { createClient } from '@/lib/supabase'",
          "import { getExpensesAction } from '@/app/actions/expenses'\nimport { createClient } from '@/lib/supabase'\nimport { susunBarisPengeluaran } from '@/lib/pengeluaran/susunBaris'",
        )
    expect(normalize(readNorm(resolve(FINANCE_SRC, 'hooks/useExpenses.ts')))).toBe(
      normalize(readNorm(resolve(ADMIN_SRC, 'hooks/useExpenses.ts'))),
    )
  })

  it('getAllPlatformSettlementSummaries & getTikTokSettlementSummaries selaras dengan admin-dashboard', () => {
    const adminSrc = readNorm(resolve(ADMIN_SRC, 'app/actions/platformSettlement.ts'))
    const financeSrc = readNorm(resolve(FINANCE_SRC, 'app/actions/platformSettlement.ts'))

    const extractTail = (src: string, marker: string) => {
      const idx = src.indexOf(marker)
      expect(idx, `marker ${marker} tidak ditemukan`).toBeGreaterThan(-1)
      return src.slice(idx)
    }

    const normalizeSettlement = (src: string) =>
      src
        .replace(/;\s*$/gm, '')
        .replace(/^\s*const supabase = getSupabase\(\)\s*$/gm, '')
        .replace(/^\s*try\s*\{\s*\n\s*await requireRole\([^\n]+\)\s*\n\s*\}\s*catch\s*\([^)]+\)\s*\{\s*\n[^\n]+\n\s*\}\s*$/gm, '')
        .replace(/^\s*await requireRole\(PERAN_KEUANGAN\)\s*\n\s*const supabase = getServiceSupabase\(\)\s*$/gm, '')
        .replace(/\((omzet - promo - comm)\)/g, 'omzet - promo - comm')
        .replace(/\n{2,}/g, '\n')
        .trim()

    const adminTail = normalizeSettlement(extractTail(adminSrc, 'export interface PlatformSettlementAggregate'))
    const financeTail = normalizeSettlement(extractTail(financeSrc, 'export interface PlatformSettlementAggregate'))
    expect(financeTail).toBe(adminTail)
  })

  it('Ketiga rute Laba Rugi (Global, Internal, Mitra) tersedia di finance', () => {
    expect(readNorm(resolve(FINANCE_SRC, 'app/laporan/laba-rugi/page.tsx'))).toContain('<ProfitView scope="all" />')
    expect(readNorm(resolve(FINANCE_SRC, 'app/laporan/laba-rugi/internal/page.tsx'))).toContain('<ProfitView scope="internal" />')
    expect(readNorm(resolve(FINANCE_SRC, 'app/laporan/laba-rugi/mitra/page.tsx'))).toContain('<ProfitView scope="mitra" />')
  })
})
