import { describe, it, expect } from 'vitest'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { getMitraRealtimeBepBreakdown } from '@/app/actions/mitraRoi'

describe('Verify Mitra Cibinong BEP Breakdown Synced with Tab Laba Rugi', () => {
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

    // Pastikan September net profit adalah ~Rp 6 jutaan, BUKAN Rp 31,4 juta!
    const sept = cibinong.monthlyBreakdown.find(m => m.monthKey === '2026-09')
    expect(sept).toBeDefined()
    expect(sept!.netProfit).toBeLessThan(10000000)
    expect(sept!.netProfit).toBeGreaterThan(5000000)
    expect(sept!.netProfit).toBe(6437276)
  }, 30000)
})
