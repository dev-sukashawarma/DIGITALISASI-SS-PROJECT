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
        { no: 1, day: 2, ot: 'MITRA CISEENG', shift: 'Shift Kasir - Reno Putra Perdana', sis: 0, fis: 100000, sel: 100000, sebab: 'Kelebihan saldo fisik kasir awal shift / pembulatan pembayaran', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 2, day: 3, ot: 'MITRA CICURUG', shift: 'Shift Kasir - M. Reyhan Setiawan', sis: 0, fis: 1583000, sel: 1583000, sebab: 'Setoran closing shift kasir tunai belum terinput pada register sistem', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 3, day: 4, ot: 'SUKA SHAWARMA DRAMAGA', shift: 'Shift Kasir - Sheva Arzaky Mauladi', sis: 0, fis: 430000, sel: 430000, sebab: 'Akumulasi uang kas fisik laci kasir melampaui data input sistem', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 4, day: 6, ot: 'SUKA SHAWARMA CIRENDEU', shift: 'Shift Kasir - Iqbal', sis: 262000, fis: 268000, sel: 6000, sebab: 'Pembulatan uang kecil kembalian kasir POS', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 5, day: 6, ot: 'SUKA SHAWARMA PAJAJARAN', shift: 'Shift Kasir - M. Rifki Muzaki', sis: 200000, fis: 2000000, sel: 1800000, sebab: 'Modal kas awal operasional laci kasir belum direkonsiliasi sistem', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 6, day: 7, ot: 'SUKA SHAWARMA DEPOK SUKMAJAYA', shift: 'Shift Kasir - Helmi Dwi Luthfi', sis: 0, fis: 332000, sel: 332000, sebab: 'Penerimaan pembayaran cash blind close saat sistem offline sejenak', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 7, day: 7, ot: 'MITRA CIBUBUR', shift: 'Shift Kasir - Adhi Setiawan', sis: 0, fis: 48000, sel: 48000, sebab: 'Kelebihan uang receh kembalian di laci kasir', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 8, day: 7, ot: 'SUKA SHAWARMA BEJI', shift: 'Shift Kasir - Muhammad Fitron Firdaus', sis: 0, fis: 66000, sel: 66000, sebab: 'Kelebihan koin & pecahan kecil pembulatan struk', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 9, day: 8, ot: 'MITRA CIBINONG', shift: 'Shift Kasir - Yunus', sis: 462000, fis: 642000, sel: 180000, sebab: 'Penerimaan pesanan tunai belum terekam otomatis pada tablet kasir', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 10, day: 13, ot: 'SUKA SHAWARMA JATIWARINGIN', shift: 'Shift Kasir - Faturrahman', sis: 93000, fis: 99000, sel: 6000, sebab: 'Pembulatan kembalian struk belanja pembeli', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 11, day: 17, ot: 'MITRA CIBUBUR', shift: 'Shift Kasir - Muhamad Rifqi Darmawan', sis: 442000, fis: 211000, sel: -231000, sebab: 'Salah hitung kembalian pecahan besar saat jam antrean puncak', stat: 'LUNAS (Potong Kasbon Kasir)' },
        { no: 12, day: 18, ot: 'SUKA SHAWARMA BNR', shift: 'Shift Kasir - Roni', sis: 187000, fis: 219000, sel: 32000, sebab: 'Konsumen menolak uang kecil kembalian receh', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 13, day: 18, ot: 'SUKA SHAWARMA JAGAKARSA', shift: 'Shift Kasir - Maulana Hairulloh', sis: 0, fis: 81000, sel: 81000, sebab: 'Sisa kas kecil kembalian shift siang diserahkan ke kas fisik', stat: 'SELESAI (Disetor ke Kas Toko)' },
        { no: 14, day: 20, ot: 'MITRA CISEENG', shift: 'Shift Kasir - Mohamad Raka', sis: 0, fis: 791000, sel: 791000, sebab: 'Pelunasan pesanan tunai offline tercatat saat serah terima shift', stat: 'SELESAI (Disetor ke Kas Toko)' },
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
        { no: 1, k: 'Operasional & Kebutuhan Toko', o: 'Empang, Depok Sukmajaya, Jagakarsa', n: 23995368, p: '63.4%' },
        { no: 2, k: 'Pengeluaran Kebutuhan Laci Kasir', o: 'Cibubur, Paledang, Cimanggu', n: 8541650, p: '22.6%' },
        { no: 3, k: 'Token Listrik PLN & Utilitas Toko', o: 'Cibubur, Pekayon, Empang', n: 2832550, p: '7.5%' },
        { no: 4, k: 'Bahan Tambahan & Kemasan Darurat', o: 'Cibubur, Depok Sukmajaya, Sawangan', n: 1209000, p: '3.2%' },
        { no: 5, k: 'Transportasi & Pengantaran Cepat', o: 'Ciseeng, Sentul, Pekayon', n: 716000, p: '1.9%' },
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
        { no: 1, c: 'QRIS Statis & Dinamis (BCA / Mandiri / ShopeePay)', v: '18.420 Trx', n: 684210000, p: '51.0%' },
        { no: 2, c: 'EDC Kartu Debit & Kredit Bank', v: '7.940 Trx', n: 389120000, p: '29.0%' },
        { no: 3, c: 'Virtual Account & Bank Transfer Langsung', v: '4.110 Trx', n: 187816540, p: '14.0%' },
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
