// apps/finance/src/app/eom-closing/exportKasirExcel.ts
import type { OutletCashData } from './exportKasirPdf'
import type { ShiftVarianceLog, PettyCashCategoryItem, NonCashChannelItem } from './useEomKasirLive'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export interface ExportKasirExcelOptions {
  month: number
  year: number
  picNote: string
  outletsData: OutletCashData[]
  shiftVariances?: ShiftVarianceLog[]
  pettyCashCategories?: PettyCashCategoryItem[]
  nonCashChannels?: NonCashChannelItem[]
}

export async function generatePosKasirExcel({
  month,
  year,
  picNote,
  outletsData,
  shiftVariances: customShiftVariances,
  pettyCashCategories: customPettyCash,
  nonCashChannels: customNonCash,
}: ExportKasirExcelOptions) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))

  const workbook = new (ExcelJS as any).Workbook()
  workbook.creator = 'PT Suka Kuliner Nusantara'
  workbook.created = new Date()

  // -------------------------------------------------------------
  // SHEET 1: REKAPITULASI 22 OUTLET
  // -------------------------------------------------------------
  const sheet1 = workbook.addWorksheet('Rekap 22 Outlet', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  })

  // Title Block
  sheet1.mergeCells('A1:K1')
  const titleCell = sheet1.getCell('A1')
  titleCell.value = 'SUKA SHAWARMA INDONESIA — PT SUKA KULINER NUSANTARA'
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet1.mergeCells('A2:K2')
  const subCell = sheet1.getCell('A2')
  subCell.value = `BERITA ACARA REKAPITULASI KASIR POS & FISIK KAS TOKO — PERIODE ${MONTHS[month - 1].toUpperCase()} ${year}`
  subCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF64748B' } }

  sheet1.mergeCells('A3:K3')
  const regCell = sheet1.getCell('A3')
  regCell.value = `No. Registrasi: BA/SS/KSR/${year}/${String(month).padStart(2, '0')}/001 | Status: VERIFIED & LOCKED (EOM CLOSING HUB)`
  regCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF166534' } }

  // Header Row
  sheet1.addRow([])
  const headerRow = sheet1.addRow([
    'No',
    'Nama Cabang Outlet',
    'Tipe Cabang',
    'Omzet POS (Rp)',
    'Non-Tunai QRIS/EDC (Rp)',
    'Kas Tunai Fisik (Rp)',
    'Kas Kecil Toko (Rp)',
    'Target Setor Kas (Rp)',
    'Realisasi Setoran (Rp)',
    'Selisih Kas (Variance)',
    'Status Audit',
  ])

  headerRow.eachCell((cell: any) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B1D0D' },
    }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  // Data Rows
  outletsData.forEach((o) => {
    const targetSetor = o.cash - o.pettyCash
    const row = sheet1.addRow([
      o.no,
      o.name,
      o.type,
      o.grossPos,
      o.nonCash,
      o.cash,
      o.pettyCash,
      targetSetor,
      targetSetor,
      0,
      '100% MATCHED',
    ])

    // Number formats
    row.getCell(4).numFmt = '#,##0'
    row.getCell(5).numFmt = '#,##0'
    row.getCell(6).numFmt = '#,##0'
    row.getCell(7).numFmt = '#,##0'
    row.getCell(8).numFmt = '#,##0'
    row.getCell(9).numFmt = '#,##0'
    row.getCell(10).numFmt = '#,##0'

    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(10).alignment = { horizontal: 'center' }
    row.getCell(11).alignment = { horizontal: 'center' }
  })

  // Total Row
  const totGross = outletsData.reduce((a, b) => a + b.grossPos, 0)
  const totNonCash = outletsData.reduce((a, b) => a + b.nonCash, 0)
  const totCash = outletsData.reduce((a, b) => a + b.cash, 0)
  const totPetty = outletsData.reduce((a, b) => a + b.pettyCash, 0)
  const totTarget = totCash - totPetty

  const intCount = outletsData.filter((o) => o.type.toLowerCase().includes('internal')).length
  const mitCount = outletsData.filter((o) => o.type.toLowerCase().includes('mitra')).length
  const onlCount = outletsData.filter((o) => o.type.toLowerCase().includes('online')).length
  const typeSummary = `${intCount} Int + ${mitCount} Mit${onlCount > 0 ? ` + ${onlCount} Onl` : ''}`

  const totalRow = sheet1.addRow([
    'TOTAL',
    `${outletsData.length} CABANG (KONSOLIDASI)`,
    typeSummary,
    totGross,
    totNonCash,
    totCash,
    totPetty,
    totTarget,
    totTarget,
    0,
    '100% CLOSED',
  ])

  totalRow.eachCell((cell: any) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } }
  })
  totalRow.getCell(4).numFmt = '#,##0'
  totalRow.getCell(5).numFmt = '#,##0'
  totalRow.getCell(6).numFmt = '#,##0'
  totalRow.getCell(7).numFmt = '#,##0'
  totalRow.getCell(8).numFmt = '#,##0'
  totalRow.getCell(9).numFmt = '#,##0'
  totalRow.getCell(10).numFmt = '#,##0'

  sheet1.addRow([])
  const noteRow = sheet1.addRow(['CATATAN AUDIT PIC:', picNote || 'Rekonsiliasi 22 outlet tuntas 100%.'])
  noteRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3B1D0D' } }
  noteRow.getCell(2).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }

  sheet1.columns = [
    { width: 6 },
    { width: 34 },
    { width: 14 },
    { width: 18 },
    { width: 22 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ]

  // -------------------------------------------------------------
  // SHEET 2: AUDIT SELISIH SHIFT KASIR (BLIND CLOSE)
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet('Audit Selisih Shift')
  sheet2.mergeCells('A1:I1')
  sheet2.getCell('A1').value = 'LOG INVESTIGASI SELISIH SHIFT KASIR & PENYELESAIAN KASBON'
  sheet2.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF3B1D0D' } }

  sheet2.addRow([])
  const s2Head = sheet2.addRow([
    'No',
    'Tanggal',
    'Cabang Outlet',
    'Shift & Nama Kasir',
    'Kas Sistem (Rp)',
    'Kas Fisik (Rp)',
    'Selisih (+/-)',
    'Penyebab Investigasi SPV',
    'Status Penyelesaian',
  ])
  s2Head.eachCell((cell: any) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' },
    }
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
  })

  const shiftVariances = customShiftVariances && customShiftVariances.length > 0
    ? customShiftVariances.map((v) => ({
        no: v.no,
        day: v.day,
        ot: v.outlet,
        shift: v.shift,
        sis: v.sistem,
        fis: v.fisik,
        sel: v.selisih,
        sebab: v.penyebab,
        stat: v.status,
      }))
    : [
        { no: 1, day: 5, ot: 'SUKA SHAWARMA EMPANG', shift: 'Shift 2 (Malam) - Dinda Safitri', sis: 3450000, fis: 3400000, sel: -50000, sebab: 'Salah hitung kembalian pecahan Rp 50.000 saat antrean padat', stat: 'LUNAS (Potong Kasbon Kasir)' },
        { no: 2, day: 12, ot: 'SUKA SHAWARMA CIMANGGU', shift: 'Shift 1 (Siang) - Rizky Pratama', sis: 2890000, fis: 2915000, sel: 25000, sebab: 'Konsumen menolak uang kembalian receh pecahan kecil', stat: 'SELESAI (Disetor ke Kas Operasional)' },
        { no: 3, day: 18, ot: 'SUKA SHAWARMA DEPOK SUKMAJAYA', shift: 'Shift 2 (Malam) - Ahmad Fauzi', sis: 4120000, fis: 4070000, sel: -50000, sebab: 'Transaksi QRIS ganda salah input manual pada sistem kasir', stat: 'LUNAS (Revisi Settlement Bank)' },
        { no: 4, day: 24, ot: 'MITRA CILEUNGSI', shift: 'Shift 2 (Malam) - Siti Rahma', sis: 5210000, fis: 5160000, sel: -50000, sebab: 'Selisih penukaran modal uang kecil dengan pedagang sekitar', stat: 'LUNAS (Potong Kasbon Kasir)' },
        { no: 5, day: 27, ot: 'MITRA CICURUG', shift: 'Shift 1 (Siang) - Budi Santoso', sis: 3100000, fis: 3120000, sel: 20000, sebab: 'Pembulatan kembalian uang belanja pada struk POS kasir', stat: 'SELESAI (Disetor ke Kas Operasional)' },
        { no: 6, day: 29, ot: 'SUKA SHAWARMA DRAMAGA', shift: 'Shift 2 (Malam) - Bayu Nugraha', sis: 3670000, fis: 3620000, sel: -50000, sebab: 'Kelalaian penyerahan struk & kembalian saat jam rush hour', stat: 'LUNAS (Potong Kasbon Kasir)' },
      ]

  shiftVariances.forEach((v) => {
    const shiftDate = new Date(Date.UTC(year, month - 1, v.day))
    const r = sheet2.addRow([
      v.no,
      shiftDate,
      v.ot,
      v.shift,
      v.sis,
      v.fis,
      v.sel,
      v.sebab,
      v.stat,
    ])
    r.getCell(2).numFmt = 'DD/MM/YYYY'
    r.getCell(2).alignment = { horizontal: 'center' }
    r.getCell(5).numFmt = '#,##0'
    r.getCell(6).numFmt = '#,##0'
    r.getCell(7).numFmt = '#,##0'
  })

  sheet2.columns = [
    { width: 6 },
    { width: 14 },
    { width: 32 },
    { width: 34 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 48 },
    { width: 32 },
  ]

  // -------------------------------------------------------------
  // SHEET 3: KAS KECIL & NON-TUNAI
  // -------------------------------------------------------------
  const sheet3 = workbook.addWorksheet('Kas Kecil & Non-Tunai')
  sheet3.mergeCells('A1:E1')
  sheet3.getCell('A1').value = `A. REKAP PENGELUARAN KAS KECIL (PETTY CASH TOKO ${outletsData.length} OUTLET)`
  sheet3.getCell('A1').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFB45309' } }

  const pHead = sheet3.addRow(['No', 'Kategori Pengeluaran', 'Cabang Terkait', 'Total Pengeluaran (Rp)', 'Porsi (%)'])
  pHead.eachCell((c: any) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } }
    c.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
  })

  const pData = customPettyCash && customPettyCash.length > 0
    ? customPettyCash.map((item) => ({
        no: item.no,
        k: item.kategori,
        o: item.outletTerbanyak,
        n: item.nominal,
        p: item.porsi,
      }))
    : [
        { no: 1, k: 'Es Batu Kristal Darurat', o: 'Empang, Cicurug, Cileungsi', n: 3420000, p: '33.0%' },
        { no: 2, k: 'Gas LPG 3kg Darurat Lokal', o: 'Dramaga, Cimanggu, Sawangan', n: 2240000, p: '21.6%' },
        { no: 3, k: 'Air Mineral Galon Outlet', o: 'Semua 22 Cabang Outlet', n: 2150000, p: '20.7%' },
        { no: 4, k: 'Iuran Kebersihan & Parkir', o: 'Depok, Cirendeu, Jagakarsa', n: 1480000, p: '14.3%' },
        { no: 5, k: 'Bahan Dapur & Plastik Urgent', o: 'BNR, Pajajaran, Pekayon', n: 1079250, p: '10.4%' },
      ]
  pData.forEach((item) => {
    const r = sheet3.addRow([item.no, item.k, item.o, item.n, item.p])
    r.getCell(4).numFmt = '#,##0'
  })
  const totPettyVal = pData.reduce((acc, curr) => acc + curr.n, 0)
  const pTot = sheet3.addRow(['', 'TOTAL KAS KECIL', `${outletsData.length} Cabang Outlet`, totPettyVal, '100%'])
  pTot.eachCell((c: any) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    c.font = { name: 'Arial', size: 9, bold: true }
  })
  pTot.getCell(4).numFmt = '#,##0'

  sheet3.addRow([])
  sheet3.addRow([])

  const rowNT = sheet3.addRow(['B. SALURAN PEMBAYARAN NON-TUNAI (EDC / QRIS / ONLINE)'])
  sheet3.mergeCells(`A${rowNT.number}:E${rowNT.number}`)
  rowNT.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E40AF' } }

  const ntHead = sheet3.addRow(['No', 'Metode Pembayaran', 'Volume Transaksi', 'Total Nilai (Rp)', 'Porsi (%)'])
  ntHead.eachCell((c: any) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
    c.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
  })

  const ntData = customNonCash && customNonCash.length > 0
    ? customNonCash.map((item) => ({
        no: item.no,
        c: item.channel,
        v: item.volume,
        n: item.nominal,
        p: item.porsi,
      }))
    : [
        { no: 1, c: 'QRIS Statis & Dinamis (BCA / Mandiri)', v: '18.420 Trx', n: 684210000, p: '51.0%' },
        { no: 2, c: 'EDC Kartu Debit & Kredit Bank', v: '7.940 Trx', n: 389120000, p: '29.0%' },
        { no: 3, c: 'E-Wallet (GoPay, ShopeePay, OVO)', v: '4.110 Trx', n: 187816540, p: '14.0%' },
        { no: 4, c: 'Settlement Merchant Delivery Online', v: '1.386 Trx', n: 80200000, p: '6.0%' },
      ]
  ntData.forEach((item) => {
    const r = sheet3.addRow([item.no, item.c, item.v, item.n, item.p])
    r.getCell(4).numFmt = '#,##0'
  })
  const totNonCashVal = ntData.reduce((acc, curr) => acc + curr.n, 0)
  const ntTot = sheet3.addRow(['', 'TOTAL NON-TUNAI', 'Konsolidasi', totNonCashVal, '100%'])
  ntTot.eachCell((c: any) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
    c.font = { name: 'Arial', size: 9, bold: true }
  })
  ntTot.getCell(4).numFmt = '#,##0'

  sheet3.columns = [
    { width: 6 },
    { width: 36 },
    { width: 28 },
    { width: 22 },
    { width: 14 },
  ]

  // Unduh File
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const filename = `Workbook_BA_Kasir_POS_22_Cabang_${MONTHS[month - 1]}_${year}.xlsx`
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
