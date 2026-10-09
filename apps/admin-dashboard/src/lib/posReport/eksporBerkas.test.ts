// @vitest-environment node
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { buildPenerapHpp } from '@/lib/posReport/compute'
import { computeExportReport } from '@/lib/posReport/ekspor'
import { susunWorkbookLaporan } from '@/lib/posReport/eksporExcel'
import { susunPdfLaporan } from '@/lib/posReport/eksporPdf'

// Data sintetis berukuran mirip produksi: 21 outlet × 30 hari × beberapa channel.
const MENU = [
  ['Original Ayam Jumbo', 32000, 15000], ['Original Sapi Jumbo', 36000, 17000], ['Original Ayam Reguler', 22000, 10300],
  ['Original Sapi Reguler', 25000, 10600], ['Best Seller Mix Jumbo', 38000, 20600], ['Extra Keju', 7000, 3850],
  ['Extra Kentang', 9000, 3850], ['Ice Tea', 8000, 4800], ['Shawarma Rice Bowl Ayam', 30000, 14000], ['PAKET NONGKI 1', 55000, 0],
] as const
const menus = MENU.map(([name, , hpp], i) => ({ id: `m${i}`, name, hpp_override: hpp || null, channel_hpp: {}, is_package: !hpp, package_items: hpp ? [] : [{ quantity: 2, component: { id: 'm2', hpp_override: 10300 } }] }))
const OUTLET = ['EMPANG', 'PAJAJARAN', 'JAGAKARSA', 'PALEDANG', 'BEJI', 'DEPOK SUKMAJAYA', 'CIMANGGU', 'DRAMAGA', 'KALISARI', 'JATIASIH', 'BNR',
  'MITRA CIBINONG', 'MITRA CIBUBUR', 'MITRA CICURUG', 'MITRA SENTUL', 'MITRA CILEUNGSI', 'MITRA PAMULANG', 'MITRA CIRENDEU', 'MITRA KALIMULYA', 'MITRA BOJONG', 'JATIWARINGIN']
const outlets = OUTLET.map((n, i) => ({ id: `o${i}`, name: n.startsWith('MITRA') ? n : `SUKA SHAWARMA ${n}`, type: n.startsWith('MITRA') ? 'mitra' : 'internal' }))
const CHANNEL: [string | null, string, string][] = [[null, 'pos_kasir', 'qris'], [null, 'pos_kasir', 'cash'], ['gofood', 'gofood', 'gofood'], ['grabfood', 'grabfood', 'grabfood'], ['shopeefood', 'shopeefood', 'shopeefood'], ['tiktokgo', 'tiktokgo', 'qris'], [null, 'online', 'qris']]

function buatOrders() {
  let seq = 0
  let acak = 7
  const rnd = () => (acak = (acak * 16807) % 2147483647) / 2147483647
  const orders: any[] = []
  for (let d = 1; d <= 30; d++) {
    for (const o of outlets) {
      const n = 8 + Math.floor(rnd() * 14)
      for (let k = 0; k < n; k++) {
        seq++
        const [channel, source, pay] = CHANNEL[Math.floor(rnd() * CHANNEL.length)]
        const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, j) => {
          const mi = Math.floor(rnd() * MENU.length)
          const qty = 1 + Math.floor(rnd() * 2)
          return { id: `i${seq}-${j}`, menu_item_id: `m${mi}`, menu_item_name: MENU[mi][0], quantity: qty, unit_price: MENU[mi][1], subtotal: qty * MENU[mi][1], package_choices: null }
        })
        const sub = items.reduce((s, i) => s + i.subtotal, 0)
        const isFa = ['gofood', 'grabfood', 'shopeefood'].includes(source)
        const promo = isFa && rnd() < 0.3 ? Math.round(sub * 0.2) : 0
        const disc = !isFa && rnd() < 0.1 ? 5000 : 0
        orders.push({
          id: `ord${seq}`, order_number: seq, status: rnd() < 0.006 ? 'cancelled' : 'completed', payment_method: pay,
          total_amount: isFa ? sub : sub - disc, discount_amount: disc, promo_subsidy: promo,
          created_at: `2026-09-${String(d).padStart(2, '0')}T0${Math.floor(rnd() * 9)}:00:00Z`, outlet_id: o.id,
          channel, sales_source: source, customer_name: 'Pelanggan', cashier_name: null, external_order_id: null, is_endorse: false, order_items: items,
        })
      }
    }
  }
  return orders
}

const ordersUji = buatOrders()
const mulai = performance.now()
const data = computeExportReport({
  orders: ordersUji, selectedChannels: ['all'], outlets, penerapHpp: buildPenerapHpp(menus, []), isSSOnlineSelected: false,
  periode: { from: '2026-09-01', to: '2026-09-30' },
})
const msHitung = performance.now() - mulai
const ctx = { cabang: 'Semua Cabang', channel: 'Semua Channel' }
const keluar = process.env.EKSPOR_OUT

describe('berkas ekspor', () => {
  it('payload server tetap kecil', () => {
    const kb = JSON.stringify(data).length / 1024
    if (keluar) console.log(`hitung ${msHitung.toFixed(0)} ms untuk ${ordersUji.length} pesanan · payload ekspor: ${kb.toFixed(0)} KB, ${data.items.length} baris item, ${data.harian.length} hari`)
    expect(kb).toBeLessThan(800)
  })

  it('PDF tersusun: halaman ringkasan + satu bagian per outlet', () => {
    const doc = susunPdfLaporan(jsPDF, autoTable, data, ctx)
    expect(doc.internal.getNumberOfPages()).toBeGreaterThan(outlets.length)
    if (keluar) writeFileSync(join(keluar, 'laporan.pdf'), Buffer.from(doc.output('arraybuffer')))
  })

  it('Excel tersusun: 6 sheet, TOTAL memakai SUBTOTAL agar ikut filter', async () => {
    const wb = susunWorkbookLaporan(ExcelJS, data, ctx)
    expect(wb.worksheets.map((w: any) => w.name)).toEqual(['Ringkasan', 'Per Outlet', 'Outlet x Channel', 'Detail Item', 'Menu Terlaris'])
    const detail = wb.getWorksheet('Detail Item')
    const gross = detail.getRow(4).getCell(10).value as any
    expect(gross.formula).toMatch(/^SUBTOTAL\(109,J6:J\d+\)$/)
    expect(gross.result).toBeCloseTo(data.total.gross, 0)
    expect(detail.autoFilter).toBe(`A5:P${5 + data.items.length}`)
    if (keluar) writeFileSync(join(keluar, 'laporan.xlsx'), Buffer.from(await wb.xlsx.writeBuffer()))
  })
})
