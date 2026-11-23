/* ── Ekspor Excel (.xlsx) Rangkuman Penjualan (SheetJS / xlsx) ─────────────────
 *
 * Menggunakan paket `xlsx` yang sudah terpasang di apps/marcom (tanpa menambah
 * dependensi baru) untuk menghasilkan 5 sheet identik dengan admin-dashboard:
 * Ringkasan, Per Outlet, Outlet x Channel, Detail Item, dan Menu Terlaris.
 */

import type { PosExportReport } from '@/lib/penjualan/posReport/ekspor'
import {
  type KonteksEkspor,
  labelCabang,
  labelPeriode,
  namaBerkas,
  persen,
  rasio,
  unduhBlob,
  waktuCetak,
} from '@/lib/penjualan/posReport/eksporUi'

function setColumnWidths(ws: any, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }))
}

export async function buatExcelLaporan(data: PosExportReport, ctx: KonteksEkspor): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const t = data.total
  const sub = `Periode: ${labelPeriode(data)} | Cabang: ${labelCabang(data, ctx)} | Channel: ${ctx.channel} | Dicetak: ${waktuCetak()}`

  // 1. Sheet Ringkasan
  const ringkasanRows: any[][] = [
    ['LAPORAN RANGKUMAN PENJUALAN'],
    [sub],
    [],
    ['RINGKASAN UTAMA', 'NILAI'],
    ['Gross Revenue', Math.round(t.gross)],
    ['Potongan Merchant', Math.round(t.potongan)],
    ['Net Sales', Math.round(t.gross - t.potongan)],
    ['Total COGS (HPP)', Math.round(t.cogs)],
    ['Gross Profit', Math.round(t.gp)],
    ['Margin GP', persen(t.gp, t.gross)],
    ['Transaksi Selesai', t.trx],
    ['Transaksi Dibatalkan', t.batal],
    ['Total Item Terjual', t.qty],
    [],
    ['RINGKASAN PER CHANNEL'],
    ['Channel', 'Grup', 'Transaksi', 'Item', 'Gross Revenue', 'Potongan Merchant', 'Total COGS', 'Gross Profit', 'Margin GP', 'Kontribusi'],
    ...data.channels.map((c) => [
      c.nama,
      c.grup,
      c.trx,
      c.qty,
      Math.round(c.gross),
      Math.round(c.potongan),
      Math.round(c.cogs),
      Math.round(c.gp),
      persen(c.gp, c.gross),
      persen(c.gross, t.gross),
    ]),
    [
      'TOTAL',
      '',
      t.trx,
      t.qty,
      Math.round(t.gross),
      Math.round(t.potongan),
      Math.round(t.cogs),
      Math.round(t.gp),
      persen(t.gp, t.gross),
      '100.0%',
    ],
    [],
    ['METODE PEMBAYARAN'],
    ['Metode', 'Transaksi', 'Nominal Dibayar', 'Porsi'],
  ]

  const totalBayar = data.pembayaran.reduce((s, p) => s + p.nominal, 0)
  for (const p of data.pembayaran) {
    ringkasanRows.push([p.metode, p.trx, Math.round(p.nominal), persen(p.nominal, totalBayar)])
  }
  ringkasanRows.push([
    'TOTAL',
    data.pembayaran.reduce((s, p) => s + p.trx, 0),
    Math.round(totalBayar),
    '100.0%',
  ])

  const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanRows)
  setColumnWidths(wsRingkasan, [28, 16, 14, 14, 18, 18, 18, 18, 12, 12])
  XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan')

  // 2. Sheet Per Outlet
  const outletRows: any[][] = [
    ['RINGKASAN PER OUTLET'],
    [sub],
    [],
    [
      'No', 'Outlet', 'Tipe', 'Transaksi', 'Dibatalkan', 'Item Terjual',
      'Gross Revenue', 'Potongan Merchant', 'Net Sales', 'Total COGS', 'Gross Profit',
      'Margin GP', 'Kontribusi', 'Rata-rata / Transaksi',
    ],
    ...data.outlets.map((o, i) => [
      i + 1,
      o.nama,
      o.tipe,
      o.trx,
      o.batal,
      o.qty,
      Math.round(o.gross),
      Math.round(o.potongan),
      Math.round(o.gross - o.potongan),
      Math.round(o.cogs),
      Math.round(o.gp),
      persen(o.gp, o.gross),
      persen(o.gross, t.gross),
      Math.round(rasio(o.gross, o.trx)),
    ]),
  ]
  const wsOutlet = XLSX.utils.aoa_to_sheet(outletRows)
  setColumnWidths(wsOutlet, [6, 32, 12, 12, 12, 13, 18, 18, 18, 18, 18, 12, 12, 18])
  XLSX.utils.book_append_sheet(wb, wsOutlet, 'Per Outlet')

  // 3. Sheet Outlet x Channel
  const ocRows: any[][] = [
    ['PENJUALAN PER OUTLET x CHANNEL'],
    [sub],
    [],
    [
      'No', 'Outlet', 'Channel', 'Grup Channel', 'Transaksi', 'Item Terjual',
      'Gross Revenue', 'Potongan Merchant', 'Net Sales', 'Total COGS', 'Gross Profit',
      'Margin GP', 'Kontribusi',
    ],
    ...data.outletChannels.map((o, i) => [
      i + 1,
      o.outlet,
      o.channel,
      o.grup,
      o.trx,
      o.qty,
      Math.round(o.gross),
      Math.round(o.potongan),
      Math.round(o.gross - o.potongan),
      Math.round(o.cogs),
      Math.round(o.gp),
      persen(o.gp, o.gross),
      persen(o.gross, t.gross),
    ]),
  ]
  const wsOc = XLSX.utils.aoa_to_sheet(ocRows)
  setColumnWidths(wsOc, [6, 30, 20, 14, 12, 13, 18, 18, 18, 18, 18, 12, 12])
  XLSX.utils.book_append_sheet(wb, wsOc, 'Outlet x Channel')

  // 4. Sheet Detail Item
  const itemRows: any[][] = [
    ['DETAIL ITEM TERJUAL PER OUTLET & CHANNEL'],
    [sub],
    [],
    [
      'No', 'Outlet', 'Channel', 'Tipe Outlet', 'Grup Channel', 'Nama Menu / Item',
      'Qty', 'Harga Rata2', 'HPP / Unit', 'Gross Revenue', 'Potongan Merchant',
      'Net Sales', 'Total COGS', 'Gross Profit', 'Margin GP', 'Kontribusi',
    ],
    ...data.items.map((it, i) => [
      i + 1,
      it.outlet,
      it.channel,
      it.tipe,
      it.grup,
      it.menu,
      it.qty,
      Math.round(rasio(it.gross, it.qty)),
      Math.round(rasio(it.cogs, it.qty)),
      Math.round(it.gross),
      Math.round(it.potongan),
      Math.round(it.gross - it.potongan),
      Math.round(it.cogs),
      Math.round(it.gp),
      persen(it.gp, it.gross),
      persen(it.gross, t.gross),
    ]),
  ]
  const wsItems = XLSX.utils.aoa_to_sheet(itemRows)
  setColumnWidths(wsItems, [6, 28, 18, 12, 14, 34, 9, 14, 14, 18, 18, 18, 18, 18, 12, 12])
  XLSX.utils.book_append_sheet(wb, wsItems, 'Detail Item')

  // 5. Sheet Menu Terlaris
  const menuRows: any[][] = [
    ['MENU TERLARIS (SEMUA OUTLET)'],
    [sub],
    [],
    [
      'Peringkat', 'Nama Menu / Item', 'Dijual di (Outlet)', 'Qty Terjual', 'Harga Rata2',
      'Gross Revenue', 'Potongan Merchant', 'Total COGS', 'Gross Profit', 'Margin GP', 'Kontribusi',
    ],
    ...data.menu.map((m, i) => [
      i + 1,
      m.menu,
      m.outletCount,
      m.qty,
      Math.round(rasio(m.gross, m.qty)),
      Math.round(m.gross),
      Math.round(m.potongan),
      Math.round(m.cogs),
      Math.round(m.gp),
      persen(m.gp, m.gross),
      persen(m.gross, t.gross),
    ]),
  ]
  const wsMenu = XLSX.utils.aoa_to_sheet(menuRows)
  setColumnWidths(wsMenu, [10, 36, 16, 13, 14, 18, 18, 18, 18, 12, 12])
  XLSX.utils.book_append_sheet(wb, wsMenu, 'Menu Terlaris')

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  unduhBlob(
    new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    namaBerkas(data, ctx, 'xlsx'),
  )
}
