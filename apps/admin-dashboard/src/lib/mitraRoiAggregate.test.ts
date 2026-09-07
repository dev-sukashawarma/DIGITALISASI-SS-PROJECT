import { describe, it, expect } from 'vitest'
import { aggregateMitraRoiStats } from './mitraRoiAggregate'
import type { MitraRealtimeBepItem } from '@/app/actions/mitraRoi'

function makeItem(overrides: Partial<MitraRealtimeBepItem> = {}): MitraRealtimeBepItem {
  return {
    outletId: 'outlet-1',
    modalInvestasi: 0,
    omzetHistoris: 0,
    transferHistoris: 0,
    revenue: 0,
    cogs: 0,
    opex: 0,
    managementFee: 0,
    netProfit: 0,
    mitraShare: 0,
    totalDanaKembali: 0,
    sisaModal: 0,
    roiPct: 0,
    bepPercentage: 0,
    isBep: false,
    sudahDiterima: 0,
    roiDiterimaPct: 0,
    ...overrides
  }
}

describe('aggregateMitraRoiStats', () => {
  it('roiDiterima harus mencakup omzet & transfer historis, bukan cuma sudah_diterima', () => {
    // Kasus penentu dari review: modal 100, omzet historis 40, transfer historis 10,
    // sudah diterima 10. Basis yang benar = (40+10+10)/100 = 60%, BUKAN 10/100 = 10%.
    const bepMap: Record<string, MitraRealtimeBepItem> = {
      'outlet-1': makeItem({
        modalInvestasi: 100,
        omzetHistoris: 40,
        transferHistoris: 10,
        sudahDiterima: 10
      })
    }

    const stats = aggregateMitraRoiStats(bepMap, ['outlet-1'])

    expect(stats.roiDiterima).toBe(60)
  })

  it('roiDiterima tidak boleh membagi dengan nol jika modal investasi 0', () => {
    const bepMap: Record<string, MitraRealtimeBepItem> = {
      'outlet-1': makeItem({
        modalInvestasi: 0,
        omzetHistoris: 40,
        transferHistoris: 10,
        sudahDiterima: 10
      })
    }

    const stats = aggregateMitraRoiStats(bepMap, ['outlet-1'])

    expect(stats.roiDiterima).toBe(0)
    expect(Number.isFinite(stats.roiDiterima)).toBe(true)
  })

  it('map kosong menghasilkan semua statistik nol tanpa error', () => {
    const stats = aggregateMitraRoiStats({}, [])

    expect(stats).toEqual({
      systemProfitMitra: 0,
      historisProfitMitra: 0,
      nilaiInvestasi: 0,
      totalProfitKumulatif: 0,
      roi: 0,
      bepPercentage: 0,
      sudahDiterima: 0,
      roiDiterima: 0
    })
  })

  it('menjumlahkan beberapa outlet dengan benar', () => {
    const bepMap: Record<string, MitraRealtimeBepItem> = {
      'outlet-1': makeItem({
        modalInvestasi: 100,
        omzetHistoris: 40,
        transferHistoris: 10,
        sudahDiterima: 10,
        mitraShare: 5,
        totalDanaKembali: 60
      }),
      'outlet-2': makeItem({
        outletId: 'outlet-2',
        modalInvestasi: 200,
        omzetHistoris: 0,
        transferHistoris: 0,
        sudahDiterima: 20,
        mitraShare: 20,
        totalDanaKembali: 20
      })
    }

    const stats = aggregateMitraRoiStats(bepMap, ['outlet-1', 'outlet-2'])

    expect(stats.nilaiInvestasi).toBe(300)
    expect(stats.historisProfitMitra).toBe(50)
    expect(stats.sudahDiterima).toBe(30)
    // roiDiterima = (historisProfitMitra + sudahDiterima) / nilaiInvestasi
    // = (50 + 30) / 300 * 100 = 26.7 (dibulatkan 1 desimal)
    expect(stats.roiDiterima).toBe(26.7)
  })

  it('mengabaikan outlet id yang tidak ada di map', () => {
    const bepMap: Record<string, MitraRealtimeBepItem> = {
      'outlet-1': makeItem({ modalInvestasi: 100, sudahDiterima: 10 })
    }

    const stats = aggregateMitraRoiStats(bepMap, ['outlet-1', 'outlet-tidak-ada'])

    expect(stats.nilaiInvestasi).toBe(100)
  })
})
