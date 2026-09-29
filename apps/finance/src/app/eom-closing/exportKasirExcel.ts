// apps/finance/src/app/eom-closing/exportKasirExcel.ts
import type { KasirResponse } from './types'
import { itemFlags } from '@/lib/eom/kasir'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const dayBefore = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() - 1)
  return x.toISOString().slice(0, 10)
}

const tglPendek = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`
}

export interface ExportKasirExcelOptions {
  d: KasirResponse
  dicetakOleh: string
}

/**
 * Menghasilkan Workbook Excel resmi untuk Berita Acara Rekapitulasi Kasir,
 * Kas Toko, Omzet, Potongan, dan HPP Terbaru (EOM Closing).
 */
export async function generateKasirExcel(d: KasirResponse, dicetakOleh: string = 'Finance Staff') {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))

  const workbook = new (ExcelJS as any).Workbook()
  workbook.creator = 'PT Suka Kuliner Nusantara'
  workbook.created = new Date()

  const { month, year, from, to } = d.period
  const curLabel = `${MONTHS[month - 1]} ${year}`
  const cut = d.hppCutoff

  // ---------------------------------------------------------------------------
  // SHEET 1: RINGKASAN & CHANNEL
  // ---------------------------------------------------------------------------
  const sheet1 = workbook.addWorksheet('Ringkasan & Channel', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  })

  // Title Block
  sheet1.mergeCells('A1:J1')
  sheet1.getCell('A1').value = 'SUKA SHAWARMA INDONESIA — PT SUKA KULINER NUSANTARA'
  sheet1.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet1.mergeCells('A2:J2')
  sheet1.getCell('A2').value = `BERITA ACARA REKAPITULASI PENJUALAN KASIR & HPP — PERIODE ${curLabel.toUpperCase()}`
  sheet1.getCell('A2').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF64748B' } }

  sheet1.mergeCells('A3:J3')
  sheet1.getCell('A3').value = `No. Dokumen: BA/SS/KSR/${year}/${String(month).padStart(2, '0')}/001 | Dicetak oleh: ${dicetakOleh} | Ditarik: ${new Date(d.fetchedAt).toLocaleString('id-ID')}`
  sheet1.getCell('A3').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF166534' } }

  sheet1.mergeCells('A4:J4')
  sheet1.getCell('A4').value = cut
    ? `Catatan HPP: HPP mengikuti tanggal order; ada pergantian HPP mulai ${tglPendek(cut)}, sehingga dipecah ${tglPendek(from)} s/d ${tglPendek(dayBefore(cut))} dan ${tglPendek(cut)} s/d ${tglPendek(to)}.`
    : `Catatan HPP: HPP seragam satu bulan penuh mengikuti tanggal order menggunakan master riwayat HPP terbaru (${tglPendek(from)} s/d ${tglPendek(to)}).`
  sheet1.getCell('A4').font = { name: 'Arial', size: 8.5, color: { argb: 'FF475569' } }

  sheet1.addRow([])

  // KPI Block
  const kpiHeader = sheet1.addRow(['METRIK KONSOLIDASI (SEMUA CABANG & CHANNEL)', 'NILAI', 'FORMULA & CATATAN'])
  kpiHeader.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
  })

  const foodCostRatio = d.kpi.grossRevenue > 0 ? (d.kpi.totalHPP / d.kpi.grossRevenue) : 0
  const kpiRowsData = [
    ['Gross Revenue (Omzet Kotor)', d.kpi.grossRevenue, 'Total harga jual seluruh pesanan selesai (POS & SS Online)', true],
    ['Total Potongan (Diskon & Promo)', d.kpi.totalDeductions, 'Diskon kasir dan subsidi promo platform', false],
    ['Net Revenue (Omzet Bersih)', d.kpi.netRevenue, 'Gross Revenue dikurangi Total Potongan', false],
    ['Total HPP (Food Cost)', d.kpi.totalHPP, 'HPP bahan baku menu berdasarkan master HPP terbaru', true],
    ['Laba Kotor (Gross Profit)', d.kpi.grossProfit, 'Net Revenue dikurangi Total HPP', true],
    ['Food Cost (%)', foodCostRatio, 'Rasio Total HPP terhadap Gross Revenue', true, true],
    ['Total Pesanan Selesai', d.kpi.totalOrders, 'Jumlah transaksi berhasil diselesaikan', false, false, '#,##0'],
    ['Total Selisih Kasir (Variance)', d.kpi.totalCashVariance, 'Selisih uang fisik laci kasir vs expected sistem', false],
  ]

  kpiRowsData.forEach(([label, val, note, highlight, isPct, customFmt]) => {
    const r = sheet1.addRow([label, val, note])
    r.getCell(1).font = { name: 'Arial', size: 9, bold: !!highlight, color: { argb: 'FF1E293B' } }
    r.getCell(2).font = { name: 'Arial', size: 9.5, bold: !!highlight, color: { argb: highlight ? 'FF78350F' : 'FF1E293B' } }
    r.getCell(3).font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF64748B' } }
    if (isPct) {
      r.getCell(2).numFmt = '0.0%'
    } else if (customFmt) {
      r.getCell(2).numFmt = customFmt
    } else {
      r.getCell(2).numFmt = '#,##0'
    }
    if (highlight) {
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
    }
  })

  sheet1.addRow([])

  // Tabel Rekapitulasi per Channel
  const labelA = cut ? `HPP P1 (${tglPendek(from).slice(0, -5)}–${tglPendek(dayBefore(cut)).slice(0, -5)})` : 'Total HPP (Rp)'
  const labelB = cut ? `HPP P2 (${tglPendek(cut).slice(0, -5)}–${tglPendek(to).slice(0, -5)})` : null

  const chHeaderCols = [
    'No',
    'Channel Penjualan',
    'Omzet Kotor (Rp)',
    'Potongan (Rp)',
    labelA,
    ...(labelB ? [labelB, 'Total HPP (Rp)'] : []),
    'Laba Kotor (Rp)',
    'Food Cost (%)',
    'Porsi Terjual (Qty)',
    'Menu Flagged',
  ]

  const chHeaderRow = sheet1.addRow(chHeaderCols)
  chHeaderRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  let chSum = { rev: 0, pot: 0, a: 0, b: 0, laba: 0, qty: 0 }
  d.channels.forEach((c, idx) => {
    chSum.rev += c.revenue
    chSum.pot += c.potongan
    chSum.a += c.hppA
    chSum.b += c.hppB
    chSum.laba += c.labaKotor
    chSum.qty += c.qty

    const flagged = c.items.filter((i) => itemFlags(i, !!cut).length > 0).length
    const totalHpp = c.hppA + c.hppB
    const fc = c.revenue > 0 ? totalHpp / c.revenue : 0

    const rowValues = [
      idx + 1,
      c.label,
      c.revenue,
      c.potongan,
      cut ? c.hppA : totalHpp,
      ...(labelB ? [c.hppB, totalHpp] : []),
      c.labaKotor,
      fc,
      c.qty,
      flagged > 0 ? `${flagged} menu perlu cek` : 'Lengkap',
    ]

    const r = sheet1.addRow(rowValues)
    r.getCell(1).alignment = { horizontal: 'center' }
    r.getCell(3).numFmt = '#,##0'
    r.getCell(4).numFmt = '#,##0'
    r.getCell(5).numFmt = '#,##0'
    if (labelB) {
      r.getCell(6).numFmt = '#,##0'
      r.getCell(7).numFmt = '#,##0'
      r.getCell(8).numFmt = '#,##0'
      r.getCell(9).numFmt = '0.0%'
      r.getCell(10).numFmt = '#,##0'
      r.getCell(11).alignment = { horizontal: 'center' }
    } else {
      r.getCell(6).numFmt = '#,##0'
      r.getCell(7).numFmt = '0.0%'
      r.getCell(8).numFmt = '#,##0'
      r.getCell(9).alignment = { horizontal: 'center' }
    }
  })

  // Total Channel Row
  const totalChHpp = chSum.a + chSum.b
  const totalChFc = chSum.rev > 0 ? totalChHpp / chSum.rev : 0
  const chTotalRow = sheet1.addRow([
    '',
    'TOTAL KONSOLIDASI CHANNEL',
    chSum.rev,
    chSum.pot,
    cut ? chSum.a : totalChHpp,
    ...(labelB ? [chSum.b, totalChHpp] : []),
    chSum.laba,
    totalChFc,
    chSum.qty,
    '',
  ])

  chTotalRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } }
  })
  chTotalRow.getCell(3).numFmt = '#,##0'
  chTotalRow.getCell(4).numFmt = '#,##0'
  chTotalRow.getCell(5).numFmt = '#,##0'
  if (labelB) {
    chTotalRow.getCell(6).numFmt = '#,##0'
    chTotalRow.getCell(7).numFmt = '#,##0'
    chTotalRow.getCell(8).numFmt = '#,##0'
    chTotalRow.getCell(9).numFmt = '0.0%'
    chTotalRow.getCell(10).numFmt = '#,##0'
  } else {
    chTotalRow.getCell(6).numFmt = '#,##0'
    chTotalRow.getCell(7).numFmt = '0.0%'
    chTotalRow.getCell(8).numFmt = '#,##0'
  }

  sheet1.columns = [
    { width: 6 },
    { width: 28 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    ...(labelB ? [{ width: 18 }, { width: 18 }] : []),
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 20 },
  ]

  // ---------------------------------------------------------------------------
  // SHEET 2: REKAPITULASI OUTLET
  // ---------------------------------------------------------------------------
  const sheet2 = workbook.addWorksheet('Rekapitulasi Outlet', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  })

  sheet2.mergeCells('A1:N1')
  sheet2.getCell('A1').value = `REKAPITULASI OMZET, HPP, LABA KOTOR & KAS PER CABANG OUTLET — ${curLabel.toUpperCase()}`
  sheet2.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet2.mergeCells('A2:N2')
  sheet2.getCell('A2').value = 'HPP Outlet Mitra sudah mencakup penyesuaian +10% sesuai kesepakatan kerjasama. Kolom Kas & Setoran berasal dari audit tutup shift kasir POS.'
  sheet2.getCell('A2').font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } }

  sheet2.addRow([])

  const otHeaderCols = [
    'No',
    'Nama Cabang Outlet',
    'Tipe',
    'Gross Revenue (Rp)',
    'Potongan (Rp)',
    labelA,
    ...(labelB ? [labelB, 'Total HPP (Rp)'] : []),
    'Laba Kotor (Rp)',
    'Food Cost (%)',
    'Omzet Tunai POS (Rp)',
    'Uang Laci Fisik (Rp)',
    'Selisih Kasir (Rp)',
    'Sudah Disetor (Rp)',
    'Status Setoran',
  ]

  const otHeaderRow = sheet2.addRow(otHeaderCols)
  otHeaderRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  const cashMap = new Map(d.cash.map((c) => [c.outletId, c]))
  const outlets = d.outletDetails ?? []

  const groups = [
    { type: 'outlet', label: 'OUTLET INTERNAL' },
    { type: 'mitra', label: 'OUTLET MITRA (+10% HPP)' },
    { type: 'online', label: 'SS ONLINE (MARKETPLACE)' },
  ]

  let grandRev = 0, grandPot = 0, grandHppA = 0, grandHppB = 0, grandLaba = 0
  let grandTunai = 0, grandFisik = 0, grandSelisih = 0, grandSetor = 0
  let runningNo = 1

  groups.forEach((g) => {
    const groupOutlets = outlets.filter((o) => (o.outletType === 'mitra' ? 'mitra' : o.outletType === 'online' ? 'online' : 'outlet') === g.type)
    if (groupOutlets.length === 0) return

    let subRev = 0, subPot = 0, subHppA = 0, subHppB = 0, subLaba = 0
    let subTunai = 0, subFisik = 0, subSelisih = 0, subSetor = 0

    groupOutlets.forEach((o) => {
      const c = cashMap.get(o.outletId)
      const hppTotal = o.hppA + o.hppB
      const fc = o.revenue > 0 ? hppTotal / o.revenue : 0
      const omzetTunai = c?.omzetTunai ?? 0
      const fisik = c?.shiftFisik ?? 0
      const selisih = c?.selisihKasir ?? 0
      const setor = c?.setoranDiterima ?? 0

      subRev += o.revenue
      subPot += o.potongan
      subHppA += o.hppA
      subHppB += o.hppB
      subLaba += o.labaKotor
      subTunai += omzetTunai
      subFisik += fisik
      subSelisih += selisih
      subSetor += setor

      let statusSetor = '-'
      if (c) {
        if (Math.abs(fisik - setor) < 1) {
          statusSetor = 'LUNAS'
        } else if (fisik > setor) {
          statusSetor = `Kurang Rp ${(fisik - setor).toLocaleString('id-ID')}`
        } else {
          statusSetor = `Lebih Rp ${(setor - fisik).toLocaleString('id-ID')}`
        }
      }

      const r = sheet2.addRow([
        runningNo++,
        o.outletName.replace('SUKA SHAWARMA ', ''),
        g.type === 'mitra' ? 'Mitra' : g.type === 'online' ? 'Online' : 'Internal',
        o.revenue,
        o.potongan,
        cut ? o.hppA : hppTotal,
        ...(labelB ? [o.hppB, hppTotal] : []),
        o.labaKotor,
        fc,
        omzetTunai,
        fisik,
        selisih,
        setor,
        statusSetor,
      ])

      r.getCell(1).alignment = { horizontal: 'center' }
      r.getCell(3).alignment = { horizontal: 'center' }
      r.getCell(4).numFmt = '#,##0'
      r.getCell(5).numFmt = '#,##0'
      r.getCell(6).numFmt = '#,##0'
      if (labelB) {
        r.getCell(7).numFmt = '#,##0'
        r.getCell(8).numFmt = '#,##0'
        r.getCell(9).numFmt = '#,##0'
        r.getCell(10).numFmt = '0.0%'
        r.getCell(11).numFmt = '#,##0'
        r.getCell(12).numFmt = '#,##0'
        r.getCell(13).numFmt = '#,##0'
        r.getCell(14).numFmt = '#,##0'
        r.getCell(15).alignment = { horizontal: 'center' }
      } else {
        r.getCell(7).numFmt = '#,##0'
        r.getCell(8).numFmt = '0.0%'
        r.getCell(9).numFmt = '#,##0'
        r.getCell(10).numFmt = '#,##0'
        r.getCell(11).numFmt = '#,##0'
        r.getCell(12).numFmt = '#,##0'
        r.getCell(13).alignment = { horizontal: 'center' }
      }
    })

    // Subtotal Group
    grandRev += subRev
    grandPot += subPot
    grandHppA += subHppA
    grandHppB += subHppB
    grandLaba += subLaba
    grandTunai += subTunai
    grandFisik += subFisik
    grandSelisih += subSelisih
    grandSetor += subSetor

    const subHppTot = subHppA + subHppB
    const subFc = subRev > 0 ? subHppTot / subRev : 0
    const subRow = sheet2.addRow([
      '',
      `SUBTOTAL ${g.label}`,
      '',
      subRev,
      subPot,
      cut ? subHppA : subHppTot,
      ...(labelB ? [subHppB, subHppTot] : []),
      subLaba,
      subFc,
      subTunai,
      subFisik,
      subSelisih,
      subSetor,
      '',
    ])

    subRow.eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF334155' } }
    })
    subRow.getCell(4).numFmt = '#,##0'
    subRow.getCell(5).numFmt = '#,##0'
    subRow.getCell(6).numFmt = '#,##0'
    if (labelB) {
      subRow.getCell(7).numFmt = '#,##0'
      subRow.getCell(8).numFmt = '#,##0'
      subRow.getCell(9).numFmt = '#,##0'
      subRow.getCell(10).numFmt = '0.0%'
      subRow.getCell(11).numFmt = '#,##0'
      subRow.getCell(12).numFmt = '#,##0'
      subRow.getCell(13).numFmt = '#,##0'
      subRow.getCell(14).numFmt = '#,##0'
    } else {
      subRow.getCell(7).numFmt = '#,##0'
      subRow.getCell(8).numFmt = '0.0%'
      subRow.getCell(9).numFmt = '#,##0'
      subRow.getCell(10).numFmt = '#,##0'
      subRow.getCell(11).numFmt = '#,##0'
      subRow.getCell(12).numFmt = '#,##0'
    }
  })

  // Grand Total Row
  const grandHppTot = grandHppA + grandHppB
  const grandFc = grandRev > 0 ? grandHppTot / grandRev : 0
  const grandTotalRow = sheet2.addRow([
    '',
    'TOTAL KONSOLIDASI SELURUH OUTLET',
    '',
    grandRev,
    grandPot,
    cut ? grandHppA : grandHppTot,
    ...(labelB ? [grandHppB, grandHppTot] : []),
    grandLaba,
    grandFc,
    grandTunai,
    grandFisik,
    grandSelisih,
    grandSetor,
    '',
  ])

  grandTotalRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } }
  })
  grandTotalRow.getCell(4).numFmt = '#,##0'
  grandTotalRow.getCell(5).numFmt = '#,##0'
  grandTotalRow.getCell(6).numFmt = '#,##0'
  if (labelB) {
    grandTotalRow.getCell(7).numFmt = '#,##0'
    grandTotalRow.getCell(8).numFmt = '#,##0'
    grandTotalRow.getCell(9).numFmt = '#,##0'
    grandTotalRow.getCell(10).numFmt = '0.0%'
    grandTotalRow.getCell(11).numFmt = '#,##0'
    grandTotalRow.getCell(12).numFmt = '#,##0'
    grandTotalRow.getCell(13).numFmt = '#,##0'
    grandTotalRow.getCell(14).numFmt = '#,##0'
  } else {
    grandTotalRow.getCell(7).numFmt = '#,##0'
    grandTotalRow.getCell(8).numFmt = '0.0%'
    grandTotalRow.getCell(9).numFmt = '#,##0'
    grandTotalRow.getCell(10).numFmt = '#,##0'
    grandTotalRow.getCell(11).numFmt = '#,##0'
    grandTotalRow.getCell(12).numFmt = '#,##0'
  }

  sheet2.columns = [
    { width: 6 },
    { width: 30 },
    { width: 12 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    ...(labelB ? [{ width: 18 }, { width: 18 }] : []),
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 22 },
  ]

  // ---------------------------------------------------------------------------
  // SHEET 3: RINCIAN MENU PER OUTLET
  // ---------------------------------------------------------------------------
  const sheet3 = workbook.addWorksheet('Rincian Menu per Outlet', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  })

  sheet3.mergeCells('A1:N1')
  sheet3.getCell('A1').value = `RINCIAN PENJUALAN & HPP MENU PER CABANG OUTLET — ${curLabel.toUpperCase()}`
  sheet3.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet3.addRow([])

  const menuHeaderCols = [
    'No',
    'Cabang Outlet',
    'Tipe Outlet',
    'Channel',
    'Nama Menu',
    'Qty',
    'Harga Jual Rata-rata (Rp)',
    'Omzet (Rp)',
    'Potongan (Rp)',
    cut ? `HPP/Porsi P1` : 'HPP/Porsi (Rp)',
    ...(labelB ? [`HPP/Porsi P2`, 'Total HPP (Rp)'] : ['Total HPP (Rp)']),
    'Laba Kotor (Rp)',
    'Food Cost (%)',
    'Catatan / Tanda',
  ]

  const menuHeaderRow = sheet3.addRow(menuHeaderCols)
  menuHeaderRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  let itemCounter = 1
  outlets.forEach((o) => {
    o.channels.forEach((c) => {
      c.items.forEach((it) => {
        const qty = it.qtyA + it.qtyB
        const hargaJual = qty > 0 ? it.revenue / qty : 0
        const hppTotal = it.hppA + it.hppB
        const fc = it.revenue > 0 ? hppTotal / it.revenue : 0
        const flags = itemFlags(it, !!cut)
        const unitA = it.qtyA > 0 ? it.hppA / it.qtyA : 0
        const unitB = it.qtyB > 0 ? it.hppB / it.qtyB : 0
        const unitSingle = qty > 0 ? hppTotal / qty : 0

        const rowValues = [
          itemCounter++,
          o.outletName.replace('SUKA SHAWARMA ', ''),
          o.outletType === 'mitra' ? 'Mitra (+10%)' : o.outletType === 'online' ? 'Online' : 'Internal',
          c.label,
          it.name,
          qty,
          hargaJual,
          it.revenue,
          it.potongan,
          cut ? unitA : unitSingle,
          ...(labelB ? [unitB, hppTotal] : [hppTotal]),
          it.labaKotor,
          fc,
          flags.join(', ') || 'Normal',
        ]

        const r = sheet3.addRow(rowValues)
        r.getCell(1).alignment = { horizontal: 'center' }
        r.getCell(3).alignment = { horizontal: 'center' }
        r.getCell(4).alignment = { horizontal: 'center' }
        r.getCell(6).numFmt = '#,##0'
        r.getCell(7).numFmt = '#,##0'
        r.getCell(8).numFmt = '#,##0'
        r.getCell(9).numFmt = '#,##0'
        r.getCell(10).numFmt = '#,##0'
        if (labelB) {
          r.getCell(11).numFmt = '#,##0'
          r.getCell(12).numFmt = '#,##0'
          r.getCell(13).numFmt = '#,##0'
          r.getCell(14).numFmt = '0.0%'
          r.getCell(15).alignment = { horizontal: 'center' }
        } else {
          r.getCell(11).numFmt = '#,##0'
          r.getCell(12).numFmt = '#,##0'
          r.getCell(13).numFmt = '0.0%'
          r.getCell(14).alignment = { horizontal: 'center' }
        }
      })
    })
  })

  // Enable Autofilter on sheet3
  sheet3.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: labelB ? 15 : 14 },
  }

  sheet3.columns = [
    { width: 6 },
    { width: 26 },
    { width: 14 },
    { width: 18 },
    { width: 34 },
    { width: 10 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
    ...(labelB ? [{ width: 16 }, { width: 18 }] : [{ width: 18 }]),
    { width: 18 },
    { width: 12 },
    { width: 20 },
  ]

  // ---------------------------------------------------------------------------
  // SHEET 4: AUDIT SHIFT & KAS TOKO
  // ---------------------------------------------------------------------------
  const sheet4 = workbook.addWorksheet('Audit Shift & Kas', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  })

  sheet4.mergeCells('A1:I1')
  sheet4.getCell('A1').value = `AUDIT SHIFT KASIR & SELISIH UANG LACI — ${curLabel.toUpperCase()}`
  sheet4.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet4.mergeCells('A2:I2')
  sheet4.getCell('A2').value = `Daftar shift dengan selisih kasir (variance) atau status belum ditutup (${d.shiftDetails.length} shift tercatat).`
  sheet4.getCell('A2').font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } }

  sheet4.addRow([])

  const s4HeaderRow = sheet4.addRow([
    'No',
    'Tanggal Shift (WIB)',
    'Cabang Outlet',
    'Kasir (Staff)',
    'Omzet Tunai Expected (Rp)',
    'Uang Laci Fisik (Rp)',
    'Selisih Kasir (Rp)',
    'Status Shift',
    'Catatan Kasir',
  ])

  s4HeaderRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B1D0D' } }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  let totSelisihShift = 0
  if (d.shiftDetails.length === 0) {
    const emptyRow = sheet4.addRow(['', 'Tidak ada shift berselisih atau belum ditutup pada bulan ini.', '', '', '', '', '', '', ''])
    sheet4.mergeCells(`B${emptyRow.number}:I${emptyRow.number}`)
    emptyRow.getCell(2).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF166534' } }
  } else {
    d.shiftDetails.forEach((s, idx) => {
      totSelisihShift += s.selisih
      const r = sheet4.addRow([
        idx + 1,
        s.tanggal,
        s.outlet.replace('SUKA SHAWARMA ', ''),
        s.kasir,
        s.expected,
        s.fisik,
        s.selisih,
        s.status === 'closed' ? 'Ditutup' : 'BELUM DITUTUP',
        s.catatan || '-',
      ])

      r.getCell(1).alignment = { horizontal: 'center' }
      r.getCell(2).alignment = { horizontal: 'center' }
      r.getCell(5).numFmt = '#,##0'
      r.getCell(6).numFmt = '#,##0'
      r.getCell(7).numFmt = '#,##0'
      r.getCell(8).alignment = { horizontal: 'center' }

      if (s.status !== 'closed') {
        r.getCell(8).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB91C1C' } }
        r.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
      }
      if (Math.abs(s.selisih) > 0) {
        r.getCell(7).font = { name: 'Arial', size: 9, bold: true, color: { argb: s.selisih < 0 ? 'FFB91C1C' : 'FFD97706' } }
      }
    })

    const totShiftRow = sheet4.addRow([
      '',
      'TOTAL SELISIH KASIR TERCATAT',
      '',
      '',
      '',
      '',
      totSelisihShift,
      '',
      '',
    ])
    totShiftRow.eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } }
    })
    totShiftRow.getCell(7).numFmt = '#,##0'
  }

  sheet4.columns = [
    { width: 6 },
    { width: 18 },
    { width: 28 },
    { width: 22 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 36 },
  ]

  // ---------------------------------------------------------------------------
  // SHEET 5: VERIFIKASI & LEMBAR PENGESAHAN
  // ---------------------------------------------------------------------------
  const sheet5 = workbook.addWorksheet('Lembar Pengesahan')
  sheet5.mergeCells('A1:G1')
  sheet5.getCell('A1').value = 'LEMBAR PENGESAHAN BERITA ACARA EOM CLOSING KASIR & KAS TOKO'
  sheet5.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet5.mergeCells('A2:G2')
  sheet5.getCell('A2').value = `PT SUKA KULINER NUSANTARA — PERIODE ${curLabel.toUpperCase()}`
  sheet5.getCell('A2').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } }

  sheet5.addRow([])
  sheet5.addRow(['Klausul Verifikasi:', 'Rekapitulasi penjualan POS kasir, perhitungan HPP berdasarkan master riwayat terbaru, dan setoran bank 22 outlet telah diperiksa dan tervalidasi.'])
  sheet5.addRow(['Status Closing HUB:', 'VERIFIED & LOCKED'])
  sheet5.addRow(['Waktu Penarikan Data:', new Date(d.fetchedAt).toLocaleString('id-ID') + ' WIB'])

  sheet5.addRow([])
  sheet5.addRow([])

  const signHead = sheet5.addRow(['Disiapkan oleh:', '', 'Diperiksa oleh:', '', 'Disetujui oleh:'])
  signHead.eachCell((cell: any) => {
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3B1D0D' } }
  })

  sheet5.addRow([])
  sheet5.addRow([])
  sheet5.addRow([])

  const signNames = sheet5.addRow([
    `( ${dicetakOleh} )`, '',
    '( Finance Controller )', '',
    '( Owner / Direktur Keuangan )',
  ])
  signNames.eachCell((cell: any) => {
    cell.font = { name: 'Arial', size: 9, bold: true }
  })

  const signRoles = sheet5.addRow([
    'Divisi Finance & Kasir', '',
    'Finance & Accounting SPV', '',
    'PT Suka Kuliner Nusantara',
  ])
  signRoles.eachCell((cell: any) => {
    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } }
  })

  sheet5.columns = [
    { width: 28 },
    { width: 6 },
    { width: 28 },
    { width: 6 },
    { width: 32 },
  ]

  // Unduh buffer workbook
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const filename = `BA_Kasir_KasToko_${MONTHS[month - 1]}_${year}.xlsx`
  if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return { workbook, filename }
}

/**
 * Backward compatibility adapter for legacy call in page.tsx
 */
export async function generatePosKasirExcel(options: any) {
  // If invoked with legacy options, check if d is passed
  if (options?.d) {
    return generateKasirExcel(options.d, options.dicetakOleh)
  }
  // Otherwise fetch the report and generate
  const res = await fetch(`/api/eom-closing/kasir?month=${options.month}&year=${options.year}&detail=outlet`, { cache: 'no-store' })
  const d = await res.json()
  return generateKasirExcel(d, options.picNote ? 'Finance Staff' : 'Finance')
}
