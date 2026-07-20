import { describe, it, expect } from 'vitest'
import { buildBusinessReportRows } from './businessReport'

const OUTLETS = [{ id: 'o1', name: 'Outlet 1' }]

describe('buildBusinessReportRows', () => {
  it('channel tanpa transaksi menghasilkan 0, bukan NaN/undefined', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [{ outlet_id: 'o1', sales_source: 'pos', omzet: 100_000 }],
      [{ outlet_id: 'o1', sales_source: 'pos', hpp: 40_000 }],
      [{ outlet_id: 'o1', sales_source: 'pos', pcs: 10 }],
      [],
    )
    expect(rows[0].offline).toEqual({ revenue: 100_000, gp: 60_000, pcs: 10 })
    expect(rows[0].online).toEqual({ revenue: 0, gp: 0, pcs: 0 })
    expect(rows[0].foodapps).toEqual({ revenue: 0, gp: 0, pcs: 0 })
    expect(rows[0].tiktok).toEqual({ revenue: 0, gp: 0, pcs: 0 })
  })

  it('Total Gross Profit bisa negatif kalau Opex melebihi Total Performance GP', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [{ outlet_id: 'o1', sales_source: 'pos', omzet: 50_000 }],
      [{ outlet_id: 'o1', sales_source: 'pos', hpp: 20_000 }],
      [],
      [{ outlet_id: 'o1', category: 'sewa_outlet', scope: 'outlet', amount: 100_000 }],
    )
    // GP = 50_000 - 20_000 = 30_000; Opex = 100_000; Total GP = 30_000 - 100_000 = -70_000
    expect(rows[0].totalPerformance.gp).toBe(30_000)
    expect(rows[0].opexTotal).toBe(100_000)
    expect(rows[0].totalGrossProfit).toBe(-70_000)
  })

  it('kategori gaji_crew_outlet masuk opexSalary, kategori lain masuk opexOutlet', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [],
      [],
      [],
      [
        { outlet_id: 'o1', category: 'gaji_crew_outlet', scope: 'outlet', amount: 5_000 },
        { outlet_id: 'o1', category: 'pln', scope: 'outlet', amount: 2_000 },
      ],
    )
    expect(rows[0].opexSalary).toBe(5_000)
    expect(rows[0].opexOutlet).toBe(2_000)
    expect(rows[0].opexTotal).toBe(7_000)
  })

  it('expense scope pusat (outlet_id null) tidak dibebankan ke outlet manapun', () => {
    const { rows } = buildBusinessReportRows(
      OUTLETS,
      [],
      [],
      [],
      [{ outlet_id: null, category: 'gaji_staff_kantor', scope: 'pusat', amount: 99_999 }],
    )
    expect(rows[0].opexOutlet).toBe(0)
    expect(rows[0].opexSalary).toBe(0)
  })

  it('baris TOTAL menjumlahkan seluruh outlet per kolom', () => {
    const outlets = [{ id: 'o1', name: 'Outlet 1' }, { id: 'o2', name: 'Outlet 2' }]
    const { rows, total } = buildBusinessReportRows(
      outlets,
      [
        { outlet_id: 'o1', sales_source: 'pos', omzet: 100_000 },
        { outlet_id: 'o2', sales_source: 'online', omzet: 50_000 },
      ],
      [
        { outlet_id: 'o1', sales_source: 'pos', hpp: 40_000 },
        { outlet_id: 'o2', sales_source: 'online', hpp: 10_000 },
      ],
      [],
      [],
    )
    expect(total.offline.revenue).toBe(100_000)
    expect(total.online.revenue).toBe(50_000)
    expect(total.totalGrossProfit).toBe(rows[0].totalGrossProfit + rows[1].totalGrossProfit)
  })
})
