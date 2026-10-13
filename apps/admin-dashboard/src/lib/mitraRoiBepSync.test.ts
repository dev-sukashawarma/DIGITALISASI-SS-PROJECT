import { describe, it, expect, vi } from 'vitest'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
// Tes ini tidak punya sesi login; penjaga outlet diganti dengan hak owner (semua outlet).
vi.mock('@/lib/authz', () => ({ batasiOutletMitra: async (ids: string[]) => ids }))
import { getMitraRealtimeBepBreakdown } from '@/app/actions/mitraRoi'

// Tes integrasi: membaca database sungguhan lewat service role. Hanya jalan bila
// kuncinya tersedia (lokal, dari .env.local). Di CI kunci itu sengaja tidak ada,
// jadi tes ini dilewati — bukan digagalkan.
const adaKunciDb = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

describe.skipIf(!adaKunciDb)('Verify Mitra Cibinong BEP Breakdown Synced with Tab Laba Rugi', () => {
  it('should return synced net profit and mitra share for Cibinong', async () => {
    const cibinongId = '550e8400-e29b-41d4-a716-446655440014'
    const result = await getMitraRealtimeBepBreakdown([cibinongId])
    const cibinong = result[cibinongId]

    expect(cibinong).toBeDefined()
    console.log('CIBINONG SUMMARY:', {
      modalInvestasi: cibinong.modalInvestasi,
      omzetHistoris: cibinong.omzetHistoris,
      danaSudahKembali: cibinong.danaSudahKembali,
      akrualBelumDitransfer: cibinong.akrualBelumDitransfer,
      totalDanaKembali: cibinong.totalDanaKembali,
      bepPercentage: cibinong.bepPercentage,
      isBep: cibinong.isBep
    })

    console.log('MONTHLY BREAKDOWN:')
    for (const mb of cibinong.monthlyBreakdown) {
      console.log(`- ${mb.monthLabel} (${mb.monthKey}): Net Profit = Rp ${mb.netProfit.toLocaleString('id-ID')}, Mitra Share (${mb.profitSharingPct}%) = Rp ${mb.mitraShare.toLocaleString('id-ID')}, Transferred = ${mb.isTransferred}, Closed = ${mb.isClosed}`)
    }

    // September 2026 memakai angka closing resmi (mitraPnlClosingData.ts), bukan
    // hitungan live. Sebelum closing ditetapkan nilainya Rp 7.230.300.
    const sept = cibinong.monthlyBreakdown.find(m => m.monthKey === '2026-09')
    expect(sept).toBeDefined()
    expect(sept!.netProfit).toBe(19009571)
    expect(sept!.mitraShare).toBe(9504786)
  }, 30000)

  it('should process all mitra outlets simultaneously without error and return isolated stats per outlet', async () => {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = createServiceClient()

    // 1. Ambil semua outlet mitra dari DB
    const { data: outlets } = await supabase.from('outlets').select('id, name').eq('type', 'mitra')
    const { data: invs } = await supabase.from('mitra_investments').select('outlet_id')
    const allMitraIds = Array.from(new Set([
      ...(outlets || []).map(o => o.id),
      ...(invs || []).map(i => i.outlet_id).filter(Boolean)
    ]))

    console.log(`Found ${allMitraIds.length} mitra outlet IDs:`, allMitraIds)

    const result = await getMitraRealtimeBepBreakdown(allMitraIds)
    expect(Object.keys(result).length).toBe(allMitraIds.length)

    for (const oid of allMitraIds) {
      const item = result[oid]
      expect(item).toBeDefined()
      expect(item.outletId).toBe(oid)
      expect(typeof item.totalDanaKembali).toBe('number')
      expect(typeof item.bepPercentage).toBe('number')
      expect(Array.isArray(item.monthlyBreakdown)).toBe(true)

      const outletName = outlets?.find(o => o.id === oid)?.name || oid
      console.log(`OUTLET [${outletName}]:`, {
        modal: item.modalInvestasi,
        totalDanaKembali: item.totalDanaKembali,
        bepPercentage: item.bepPercentage,
        isBep: item.isBep,
        monthsCount: item.monthlyBreakdown.length,
        months: item.monthlyBreakdown.map(m => `${m.monthKey}: net=${m.netProfit}, share=${m.mitraShare}`)
      })
    }
  }, 60000)
})
