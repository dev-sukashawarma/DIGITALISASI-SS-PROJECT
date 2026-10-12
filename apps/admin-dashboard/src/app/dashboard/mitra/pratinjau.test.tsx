import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MitraOutletProvider } from './MitraOutletContext'
import { MitraPratinjauBar } from './MitraPratinjauBar'
import { MitraDashboardView } from './MitraDashboardView'
import SaranPage from './saran/page'
import { MITRA_CLOSING_DATA_SEPTEMBER_2026 } from '@/app/actions/mitraPnlClosingData'

const CISEENG = '550e8400-e29b-41d4-a716-446655440017'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/mitra',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/hooks/useOwnerDashboardRealtime', () => ({ useOwnerDashboardRealtime: () => {} }))
vi.mock('@/app/actions/mitraPratinjau', () => ({ pilihMitraPratinjau: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/app/actions/mitraRoi', () => ({
  getMitraRoiStats: vi.fn(async () => ({
    roi: 28.7, bepPercentage: 28.7, totalProfitKumulatif: 57466426, systemProfitMitra: 4243082, historisProfitMitra: 53223344, nilaiInvestasi: 200000000,
  })),
}))
vi.mock('@/app/actions/mitraPnl', () => ({
  getMitraComprehensivePnl: vi.fn(async () => {
    const c = MITRA_CLOSING_DATA_SEPTEMBER_2026['550e8400-e29b-41d4-a716-446655440017']
    const kanal = (k: { revenue: number; cogs: number; deductions: number }) => ({ ...k, grossProfit: k.revenue - k.deductions - k.cogs, orderCount: 1 })
    return {
      period: { from: '2026-09-01', to: '2026-09-30' },
      outletName: c.name,
      profitSharingPct: 100,
      summary: { ...c.totals, profitMarginPct: 4.1, policyStatus: 'Closing September 2026', isBep: false, profitSharingActive: true },
      channels: { pos: kanal(c.pos), foodApps: { ...kanal(c.foodApps), grab: 0, gofood: 0, shopeefood: 0 }, tiktok: kanal(c.tiktok) },
      opex: {
        categories: (c.opexLines ?? []).map(l => ({ category: l.label, amount: l.amount, items: [{ description: l.label, amount: l.amount, date: '2026-09-30', source: l.source }] })),
        totalPettyCash: 1858000, totalMonthly: 9403845, grandTotal: c.totals.totalOpex,
      },
      investment: { totalModal: 200000000, totalProfitDistributed: 53223344, bepPercentage: 26.6, roi: 26.6 },
      bulanClosing: ['September 2026'],
    }
  }),
}))
vi.mock('@/lib/supabase', () => {
  const rantai: any = new Proxy({}, { get: (_t, k) => (k === 'then' ? (ok: any) => ok({ data: [], error: null }) : () => rantai) })
  return { createClient: () => ({ from: () => rantai }) }
})

const profil = { id: 'profil-ciseeng', user_id: 'user-ciseeng', nama_mitra: 'Mitra Ciseeng', outlet_ids: [CISEENG], bank_name: 'BCA', bank_account_number: '123', bank_account_holder: 'Mitra', status: 'aktif' }
const outlets = [{ id: CISEENG, name: 'MITRA CISEENG' }]
const propsView = {
  mitra: profil, outlets, investasiMap: { [CISEENG]: 200000000 }, curKpiRows: [], prevKpiRows: [], trendKpiRows: [],
  trendFilter: { from: '2026-09-01', to: '2026-09-30', outletId: 'all', source: 'all' }, hourlyRows: [],
  currentFilter: { from: '2026-09-01', to: '2026-09-30', outletId: 'all', source: 'all' },
  topMenus: [], recentOrders: [], initialTransfers: [], initialStaff: [], initialSuggestions: [],
  initialRoiStats: { roi: 28.7, bepPercentage: 28.7, totalProfitKumulatif: 57466426, systemProfitMitra: 4243082, historisProfitMitra: 53223344 },
  lastUpdated: '2026-10-12T00:00:00Z', isCached: false,
}
const daftarMitra = [{ id: 'profil-pamulang', nama: 'Bpk. Abdullah', jumlahOutlet: 1 }, { id: 'profil-ciseeng', nama: 'Mitra Ciseeng', jumlahOutlet: 1 }]

describe('mode pratinjau dashboard mitra', () => {
  it('tanpa MitraOutletProvider halaman langsung error — inilah yang terjadi sebelum perbaikan', () => {
    const diam = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<MitraDashboardView {...propsView} />)).toThrow(/MitraOutletProvider/)
    diam.mockRestore()
  })

  it('dengan provider pratinjau: dashboard tampil, bilah pratinjau ada, tanpa kata "disesuaikan"', async () => {
    const { container } = render(
      <MitraOutletProvider profile={profil} outlets={outlets} modePratinjau>
        <MitraPratinjauBar daftarMitra={daftarMitra} terpilihId="profil-ciseeng" />
        <MitraDashboardView {...propsView} />
      </MitraOutletProvider>
    )
    expect(screen.getByText(/Mode Pratinjau/)).toBeInTheDocument()
    expect((screen.getByRole('combobox', { name: /Lihat sebagai/ }) as HTMLSelectElement).value).toBe('profil-ciseeng')
    await waitFor(() => expect(screen.getByText(/Laba Rugi Operasional \(MITRA CISEENG\)/)).toBeInTheDocument())
    // Yang dilihat admin di mode pratinjau harus sama dengan yang dilihat mitra.
    expect(container.textContent?.toLowerCase()).not.toContain('disesuaikan')
    expect(container.textContent).toContain('2.010.408')
  })

  it('akun mitra sendiri (bukan pratinjau): tidak ada bilah pratinjau', async () => {
    const { container } = render(
      <MitraOutletProvider profile={profil} outlets={outlets}>
        <MitraDashboardView {...propsView} />
      </MitraOutletProvider>
    )
    await waitFor(() => expect(screen.getByText(/Laba Rugi Operasional \(MITRA CISEENG\)/)).toBeInTheDocument())
    expect(container.textContent).not.toContain('Mode Pratinjau')
    expect(container.textContent?.toLowerCase()).not.toContain('disesuaikan')
  })

  it('halaman Saran: tombol kirim mati di mode pratinjau, hidup untuk mitra', () => {
    const pratinjau = render(
      <MitraOutletProvider profile={profil} outlets={outlets} modePratinjau>
        <SaranPage />
      </MitraOutletProvider>
    )
    expect(pratinjau.getByText(/pengiriman saran dinonaktifkan/)).toBeInTheDocument()
    expect(pratinjau.getByRole('button', { name: /Kirim Saran/ })).toBeDisabled()
    pratinjau.unmount()

    const mitra = render(
      <MitraOutletProvider profile={profil} outlets={outlets}>
        <SaranPage />
      </MitraOutletProvider>
    )
    expect(mitra.queryByText(/pengiriman saran dinonaktifkan/)).toBeNull()
  })
})
