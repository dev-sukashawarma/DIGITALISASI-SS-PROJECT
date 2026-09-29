import { describe, it, expect } from 'vitest'
import { generateKasirExcel } from './exportKasirExcel'
import type { KasirResponse } from './types'

describe('generateKasirExcel', () => {
  const mockResponse: KasirResponse = {
    period: { month: 9, year: 2026, from: '2026-09-01', to: '2026-09-30' },
    hppCutoff: null,
    hppPerubahan: [],
    kpi: {
      grossRevenue: 100_000_000,
      netRevenue: 95_000_000,
      totalDeductions: 5_000_000,
      totalHPP: 45_000_000,
      grossProfit: 50_000_000,
      totalOrders: 3500,
      totalCashVariance: -25000,
    },
    channels: [
      {
        key: 'pos_kasir',
        label: 'POS KASIR (Internal)',
        revenue: 60_000_000,
        potongan: 1_000_000,
        hppA: 25_000_000,
        hppB: 0,
        labaKotor: 34_000_000,
        qty: 2000,
        items: [
          {
            name: 'Original Ayam Jumbo',
            qtyA: 1000,
            hppA: 15_000_000,
            qtyB: 0,
            hppB: 0,
            revenue: 30_000_000,
            potongan: 500_000,
            labaKotor: 14_500_000,
          },
        ],
      },
    ],
    cash: [
      {
        outletId: 'o1',
        outletName: 'SUKA SHAWARMA EMPANG',
        outletType: 'outlet',
        omzetTunai: 15_000_000,
        shiftCount: 60,
        shiftBelumTutup: 0,
        shiftBerjalan: 0,
        shiftExpected: 15_000_000,
        shiftFisik: 14_975_000,
        selisihKasir: -25_000,
        setoranTerkonfirmasi: 14_000_000,
        setoranSistem: 975_000,
        setoranDiterima: 14_975_000,
        setoranCount: 2,
      },
    ],
    shiftDetails: [
      {
        tanggal: '2026-09-15',
        outlet: 'SUKA SHAWARMA EMPANG',
        kasir: 'Ahmad Kasir',
        expected: 500_000,
        fisik: 475_000,
        selisih: -25_000,
        status: 'closed',
        catatan: 'Selisih kembalian',
      },
    ],
    konfirmasiSetoran: null,
    outletDetails: [
      {
        outletId: 'o1',
        outletName: 'SUKA SHAWARMA EMPANG',
        outletType: 'outlet',
        revenue: 60_000_000,
        potongan: 1_000_000,
        hppA: 25_000_000,
        hppB: 0,
        labaKotor: 34_000_000,
        qty: 2000,
        channels: [
          {
            key: 'pos_kasir',
            label: 'POS KASIR (Internal)',
            revenue: 60_000_000,
            potongan: 1_000_000,
            hppA: 25_000_000,
            hppB: 0,
            labaKotor: 34_000_000,
            qty: 2000,
            items: [
              {
                name: 'Original Ayam Jumbo',
                qtyA: 1000,
                hppA: 15_000_000,
                qtyB: 0,
                hppB: 0,
                revenue: 30_000_000,
                potongan: 500_000,
                labaKotor: 14_500_000,
              },
            ],
          },
        ],
      },
    ],
    fetchedAt: '2026-09-29T08:00:00.000Z',
  }

  it('menghasilkan 5 worksheet lengkap dengan data KPI, channel, outlet, menu, dan audit', async () => {
    const { workbook, filename } = await generateKasirExcel(mockResponse, 'Admin Finance Test')
    expect(filename).toBe('BA_Kasir_KasToko_September_2026.xlsx')
    expect(workbook.worksheets.map((w: any) => w.name)).toEqual([
      'Ringkasan & Channel',
      'Rekapitulasi Outlet',
      'Rincian Menu per Outlet',
      'Audit Shift & Kas',
      'Lembar Pengesahan',
    ])

    const s1 = workbook.getWorksheet('Ringkasan & Channel')
    expect(s1.getCell('A1').value).toContain('SUKA SHAWARMA INDONESIA')

    const s2 = workbook.getWorksheet('Rekapitulasi Outlet')
    expect(s2.rowCount).toBeGreaterThan(5)

    const s3 = workbook.getWorksheet('Rincian Menu per Outlet')
    expect(s3.rowCount).toBeGreaterThan(3)

    const s4 = workbook.getWorksheet('Audit Shift & Kas')
    expect(s4.rowCount).toBeGreaterThan(3)
  })

  it('menangani cutoff bertanggal jika ada pergantian HPP di tengah bulan', async () => {
    const withCutoff: KasirResponse = {
      ...mockResponse,
      hppCutoff: '2026-09-19',
      channels: [
        {
          ...mockResponse.channels[0],
          hppA: 15_000_000,
          hppB: 10_000_000,
        },
      ],
    }

    const { workbook } = await generateKasirExcel(withCutoff, 'Admin Finance Test')
    const s1 = workbook.getWorksheet('Ringkasan & Channel')
    expect(s1.getCell('A4').value).toContain('ada pergantian HPP mulai 19 Sep 2026')
  })

  it('buildKasirEomPdf dapat men-generate dokumen PDF tanpa error baik dengan maupun tanpa cutoff', async () => {
    const { buildKasirEomPdf } = await import('./exportEomPdf')
    const resNoCutoff = await buildKasirEomPdf(mockResponse, 'Admin Finance')
    expect(resNoCutoff.filename).toBe('BA_Kasir_KasToko_September_2026.pdf')
    expect(resNoCutoff.doc).toBeDefined()

    const withCutoff: KasirResponse = {
      ...mockResponse,
      hppCutoff: '2026-09-19',
    }
    const resCutoff = await buildKasirEomPdf(withCutoff, 'Admin Finance')
    expect(resCutoff.filename).toBe('BA_Kasir_KasToko_September_2026.pdf')
    expect(resCutoff.doc).toBeDefined()
  })
})
