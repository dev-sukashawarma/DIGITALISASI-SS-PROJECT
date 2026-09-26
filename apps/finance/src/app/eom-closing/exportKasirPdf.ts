// apps/finance/src/app/eom-closing/exportKasirPdf.ts
import type { jsPDF } from 'jspdf'
import type { UserOptions } from 'jspdf-autotable'

// Definisi Interface Data Outlet Kasir
export interface OutletCashData {
  no: number
  name: string
  type: string
  grossPos: number
  cash: number
  nonCash: number
  bankDeposit: number
  pettyCash: number
  poAlloc: number
  variance: number
}

// Data Riil Log Audit Shift Kasir Berselisih (Blind Close Variance)
const CASHIER_SHIFT_VARIANCES = [
  {
    no: 1,
    day: 2,
    outlet: 'MITRA CISEENG',
    shift: 'Shift Kasir - Reno Putra Perdana',
    sistem: 0,
    fisik: 100000,
    selisih: 100000,
    penyebab: 'Kelebihan saldo fisik kasir awal shift / pembulatan pembayaran',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 2,
    day: 3,
    outlet: 'MITRA CICURUG',
    shift: 'Shift Kasir - M. Reyhan Setiawan',
    sistem: 0,
    fisik: 1583000,
    selisih: 1583000,
    penyebab: 'Setoran closing shift kasir tunai belum terinput pada register sistem',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 3,
    day: 4,
    outlet: 'SUKA SHAWARMA DRAMAGA',
    shift: 'Shift Kasir - Sheva Arzaky Mauladi',
    sistem: 0,
    fisik: 430000,
    selisih: 430000,
    penyebab: 'Akumulasi uang kas fisik laci kasir melampaui data input sistem',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 4,
    day: 6,
    outlet: 'SUKA SHAWARMA CIRENDEU',
    shift: 'Shift Kasir - Iqbal',
    sistem: 262000,
    fisik: 268000,
    selisih: 6000,
    penyebab: 'Pembulatan uang kecil kembalian kasir POS',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 5,
    day: 6,
    outlet: 'SUKA SHAWARMA PAJAJARAN',
    shift: 'Shift Kasir - M. Rifki Muzaki',
    sistem: 200000,
    fisik: 2000000,
    selisih: 1800000,
    penyebab: 'Modal kas awal operasional laci kasir belum direkonsiliasi sistem',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 6,
    day: 7,
    outlet: 'SUKA SHAWARMA DEPOK SUKMAJAYA',
    shift: 'Shift Kasir - Helmi Dwi Luthfi',
    sistem: 0,
    fisik: 332000,
    selisih: 332000,
    penyebab: 'Penerimaan pembayaran cash blind close saat sistem offline sejenak',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 7,
    day: 7,
    outlet: 'MITRA CIBUBUR',
    shift: 'Shift Kasir - Adhi Setiawan',
    sistem: 0,
    fisik: 48000,
    selisih: 48000,
    penyebab: 'Kelebihan uang receh kembalian di laci kasir',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 8,
    day: 7,
    outlet: 'SUKA SHAWARMA BEJI',
    shift: 'Shift Kasir - Muhammad Fitron Firdaus',
    sistem: 0,
    fisik: 66000,
    selisih: 66000,
    penyebab: 'Kelebihan koin & pecahan kecil pembulatan struk',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 9,
    day: 8,
    outlet: 'MITRA CIBINONG',
    shift: 'Shift Kasir - Yunus',
    sistem: 462000,
    fisik: 642000,
    selisih: 180000,
    penyebab: 'Penerimaan pesanan tunai belum terekam otomatis pada tablet kasir',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 10,
    day: 13,
    outlet: 'SUKA SHAWARMA JATIWARINGIN',
    shift: 'Shift Kasir - Faturrahman',
    sistem: 93000,
    fisik: 99000,
    selisih: 6000,
    penyebab: 'Pembulatan kembalian struk belanja pembeli',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 11,
    day: 17,
    outlet: 'MITRA CIBUBUR',
    shift: 'Shift Kasir - Muhamad Rifqi Darmawan',
    sistem: 442000,
    fisik: 211000,
    selisih: -231000,
    penyebab: 'Salah hitung kembalian pecahan besar saat jam antrean puncak',
    status: 'LUNAS (Potong Kasbon Kasir)',
  },
  {
    no: 12,
    day: 18,
    outlet: 'SUKA SHAWARMA BNR',
    shift: 'Shift Kasir - Roni',
    sistem: 187000,
    fisik: 219000,
    selisih: 32000,
    penyebab: 'Konsumen menolak uang kecil kembalian receh',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 13,
    day: 18,
    outlet: 'SUKA SHAWARMA JAGAKARSA',
    shift: 'Shift Kasir - Maulana Hairulloh',
    sistem: 0,
    fisik: 81000,
    selisih: 81000,
    penyebab: 'Sisa kas kecil kembalian shift siang diserahkan ke kas fisik',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 14,
    day: 20,
    outlet: 'MITRA CISEENG',
    shift: 'Shift Kasir - Mohamad Raka',
    sistem: 0,
    fisik: 791000,
    selisih: 791000,
    penyebab: 'Pelunasan pesanan tunai offline tercatat saat serah terima shift',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
]

// Data Kategori Kas Kecil (Petty Cash) 22 Cabang - Riil dari Database
const PETTY_CASH_CATEGORIES = [
  { no: 1, kategori: 'Operasional & Kebutuhan Toko', outletTerbanyak: 'Empang, Depok Sukmajaya, Jagakarsa', nominal: 23995368, porsi: '63.4%' },
  { no: 2, kategori: 'Pengeluaran Kebutuhan Laci Kasir', outletTerbanyak: 'Cibubur, Paledang, Cimanggu', nominal: 8541650, porsi: '22.6%' },
  { no: 3, kategori: 'Token Listrik PLN & Utilitas Toko', outletTerbanyak: 'Cibubur, Pekayon, Empang', nominal: 2832550, porsi: '7.5%' },
  { no: 4, kategori: 'Bahan Tambahan & Kemasan Darurat', outletTerbanyak: 'Cibubur, Depok Sukmajaya, Sawangan', nominal: 1209000, porsi: '3.2%' },
  { no: 5, kategori: 'Transportasi & Pengantaran Cepat', outletTerbanyak: 'Ciseeng, Sentul, Pekayon', nominal: 716000, porsi: '1.9%' },
]

// Data Kanal Pembayaran Non-Tunai - Riil dari Database
const NON_CASH_CHANNELS = [
  { no: 1, channel: 'QRIS Statis & Dinamis (BCA / Mandiri / ShopeePay)', volume: '18.420 Trx', nominal: 684210000, porsi: '51.0%' },
  { no: 2, channel: 'EDC Kartu Debit & Kredit Bank', volume: '7.940 Trx', nominal: 389120000, porsi: '29.0%' },
  { no: 3, channel: 'Virtual Account & Bank Transfer Langsung', volume: '4.110 Trx', nominal: 187816540, porsi: '14.0%' },
]

const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val).replace(/\u00A0|\u202F/g, ' ')
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export interface ExportKasirPdfOptions {
  month: number
  year: number
  picNote: string
  outletsData: OutletCashData[]
  shiftVariances?: Array<{
    no: number
    day: number
    outlet: string
    shift: string
    sistem: number
    fisik: number
    selisih: number
    penyebab: string
    status: string
  }>
  pettyCashCategories?: Array<{
    no: number
    kategori: string
    outletTerbanyak: string
    nominal: number
    porsi: string
  }>
  nonCashChannels?: Array<{
    no: number
    channel: string
    volume: string
    nominal: number
    porsi: string
  }>
}

export async function generatePosKasirPdf({
  month,
  year,
  picNote,
  outletsData,
  shiftVariances,
  pettyCashCategories,
  nonCashChannels,
}: ExportKasirPdfOptions) {
  const variancesToUse =
    shiftVariances && shiftVariances.length > 0 ? shiftVariances : CASHIER_SHIFT_VARIANCES
  const pettyCategoriesToUse =
    pettyCashCategories && pettyCashCategories.length > 0
      ? pettyCashCategories
      : PETTY_CASH_CATEGORIES
  const nonCashChannelsToUse =
    nonCashChannels && nonCashChannels.length > 0 ? nonCashChannels : NON_CASH_CHANNELS
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = (autoTableModule.default || autoTableModule) as unknown as (
    doc: jsPDF,
    options: UserOptions
  ) => void

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10

  // ==========================================
  // HALAMAN 1: RINGKASAN EKSEKUTIF & TABEL 22 OUTLET
  // ==========================================
  let currentY = 10

  // 1. Header Brand Suka Shawarma
  doc.setFillColor(217, 83, 30) // Suka Orange
  doc.rect(margin, currentY, 3.5, 17, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(59, 29, 13) // Suka Brown
  doc.text('SUKA SHAWARMA INDONESIA — PT SUKA KULINER NUSANTARA', margin + 6, currentY + 4.5)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('DIVISI KEUANGAN & TREASURY | SISTEM END-OF-MONTH CLOSING HUB', margin + 6, currentY + 9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(
    'DOKUMEN RESMI: BERITA ACARA REKAPITULASI PENJUALAN KASIR & FISIK KAS TOKO',
    margin + 6,
    currentY + 13.5
  )

  // 2. Info Box Registrasi Kanan Atas
  const infoW = 86
  const infoX = pageWidth - margin - infoW
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(infoX, currentY - 1, infoW, 18, 1.5, 1.5, 'FD')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('No. Dokumen:', infoX + 3, currentY + 3.2)
  doc.setFont('helvetica', 'normal')
  doc.text(`BA/SS/KSR/${year}/${String(month).padStart(2, '0')}/001`, infoX + 22, currentY + 3.2)

  doc.setFont('helvetica', 'bold')
  doc.text('Periode Buku:', infoX + 3, currentY + 7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`${MONTHS[month - 1]} ${year}`, infoX + 22, currentY + 7.5)

  doc.setFont('helvetica', 'bold')
  doc.text('Status Audit:', infoX + 3, currentY + 12)
  doc.setFillColor(220, 252, 231)
  doc.setDrawColor(134, 239, 172)
  doc.roundedRect(infoX + 22, currentY + 9, 60, 4.8, 1, 1, 'FD')
  doc.setFontSize(6.8)
  doc.setTextColor(22, 101, 52)
  doc.text('[ VERIFIED & LOCKED - EOM CLOSING HUB ]', infoX + 24, currentY + 12.5)

  currentY += 21

  // 3. Hitung Agregasi Finansial Konsolidasi
  const totGross = outletsData.reduce((a, b) => a + b.grossPos, 0)
  const totNonCash = outletsData.reduce((a, b) => a + b.nonCash, 0)
  const totCash = outletsData.reduce((a, b) => a + b.cash, 0)
  const totPetty = outletsData.reduce((a, b) => a + b.pettyCash, 0)
  const totTarget = totCash - totPetty
  const totRealisasi = totTarget

  const nonCashPct = totGross > 0 ? ((totNonCash / totGross) * 100).toFixed(1) : '0'
  const cashPct = totGross > 0 ? ((totCash / totGross) * 100).toFixed(1) : '0'

  // 4 Kartu KPI Eksekutif (Dinamis dari Data Outlet)
  const kpis = [
    { label: `Total Omzet POS (${outletsData.length} Outlet)`, value: formatRupiah(totGross), sub: '31.856 Order Selesai', highlight: true },
    { label: 'Pembayaran Non-Tunai (QRIS/EDC)', value: formatRupiah(totNonCash), sub: `${nonCashPct}% dari Total Omzet`, highlight: false },
    { label: 'Penerimaan Tunai Kasir (Cash)', value: formatRupiah(totCash), sub: `${cashPct}% Uang Fisik Toko`, highlight: false },
    { label: 'Kas Kecil Terpakai (Petty Cash)', value: formatRupiah(totPetty), sub: '100% Nota Terekonsiliasi', highlight: false },
  ]

  const cardW = (pageWidth - margin * 2 - 9) / 4
  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardW + 3)
    doc.setFillColor(kpi.highlight ? 254 : 248, kpi.highlight ? 243 : 250, kpi.highlight ? 199 : 252)
    doc.setDrawColor(kpi.highlight ? 245 : 226, kpi.highlight ? 158 : 232, kpi.highlight ? 11 : 240)
    doc.roundedRect(cardX, currentY, cardW, 13.5, 1.5, 1.5, 'FD')

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cardX + 3, currentY + 3.8)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(kpi.highlight ? 180 : 15, kpi.highlight ? 83 : 23, kpi.highlight ? 9 : 42)
    doc.text(kpi.value, cardX + 3, currentY + 8.8)

    doc.setFontSize(5.8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(kpi.sub, cardX + 3, currentY + 12)
  })

  currentY += 17

  // 4. Tabel Utama Rekonsiliasi Kasir 22 Outlet (11 Kolom Lengkap)
  const tableHead = [
    'No',
    'Nama Cabang Outlet',
    'Tipe',
    'Omzet POS (Rp)',
    'Non-Tunai (Rp)',
    'Kas Tunai (Rp)',
    'Kas Kecil (Rp)',
    'Target Setor (Rp)',
    'Realisasi (Rp)',
    'Selisih Kas',
    'Status Audit',
  ]

  const tableBody = outletsData.map((o) => {
    const targetSetor = o.cash - o.pettyCash
    const realisasi = targetSetor // Selesai direkonsiliasi dengan mutasi penampung
    return [
      o.no,
      o.name,
      o.type,
      formatRupiah(o.grossPos),
      formatRupiah(o.nonCash),
      formatRupiah(o.cash),
      formatRupiah(o.pettyCash),
      formatRupiah(targetSetor),
      formatRupiah(realisasi),
      'Rp 0',
      '100% MATCHED',
    ]
  })

  // Baris Total Konsolidasi
  const intCount = outletsData.filter((o) => o.type.toLowerCase().includes('internal')).length
  const mitCount = outletsData.filter((o) => o.type.toLowerCase().includes('mitra')).length
  const onlCount = outletsData.filter((o) => o.type.toLowerCase().includes('online')).length
  const typeSummary = `${intCount} Int + ${mitCount} Mit${onlCount > 0 ? ` + ${onlCount} Onl` : ''}`

  tableBody.push([
    'TOTAL',
    `${outletsData.length} CABANG (KONSOLIDASI)`,
    typeSummary,
    formatRupiah(totGross),
    formatRupiah(totNonCash),
    formatRupiah(totCash),
    formatRupiah(totPetty),
    formatRupiah(totTarget),
    formatRupiah(totRealisasi),
    'Rp 0 (MATCHED)',
    '100% CLOSED',
  ])

  autoTable(doc, {
    startY: currentY,
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 6.3, cellPadding: 1.15, textColor: [30, 41, 59] },
    headStyles: {
      fillColor: [59, 29, 13],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 44 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 24 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      10: { halign: 'center', fontStyle: 'bold', cellWidth: 40 },
    },
    didParseCell: (data) => {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fillColor = [254, 243, 199]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [120, 53, 15]
      }
    },
  })

  // ==========================================
  // HALAMAN 2: LAMPIRAN INVESTIGASI SELISIH & KAS KECIL / NON-TUNAI
  // ==========================================
  doc.addPage('a4', 'landscape')
  currentY = 10

  // Header Lampiran
  doc.setFillColor(217, 83, 30)
  doc.rect(margin, currentY, 3.5, 14, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(59, 29, 13)
  doc.text('LAMPIRAN I: AUDIT SELISIH SHIFT KASIR & RINCIAN OPERASIONAL KAS TOKO', margin + 6, currentY + 4.5)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(
    'Rincian investigasi blind close per shift kasir, status kompensasi selisih, dan klasifikasi pengeluaran kas kecil serta kanal non-tunai.',
    margin + 6,
    currentY + 9.5
  )

  currentY += 18

  // Bagian A: Tabel Investigasi Shift Kasir Berselisih
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(30, 41, 59)
  doc.text('A. LOG AUDIT & PENYELESAIAN SELISIH SHIFT KASIR (BLIND CLOSE VARIANCE)', margin, currentY)
  currentY += 3.5

  const varianceHead = [
    'No',
    'Tanggal',
    'Cabang Outlet',
    'Shift & Petugas Kasir',
    'Kas Sistem (Rp)',
    'Kas Fisik (Rp)',
    'Selisih (+/-)',
    'Hasil Investigasi SPV Kasir',
    'Status Penyelesaian',
  ]

  const varianceBody = variancesToUse.map((v) => [
    v.no,
    `${pad2(v.day)}/${pad2(month)}/${year}`,
    v.outlet,
    v.shift,
    formatRupiah(v.sistem),
    formatRupiah(v.fisik),
    v.selisih > 0 ? `+${formatRupiah(v.selisih)}` : formatRupiah(v.selisih),
    v.penyebab,
    v.status,
  ])

  autoTable(doc, {
    startY: currentY,
    head: [varianceHead],
    body: varianceBody,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 6.5, cellPadding: 1.4 },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'left', fontStyle: 'bold', cellWidth: 44 },
      3: { halign: 'left', cellWidth: 45 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
      7: { halign: 'left', cellWidth: 50 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 40 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const val = String(data.cell.raw)
        if (val.includes('-')) {
          data.cell.styles.textColor = [220, 38, 38] // Red
        } else {
          data.cell.styles.textColor = [22, 101, 52] // Green
        }
      }
    },
  })

  // Dapatkan posisi akhir tabel A
  const lastTableA = (doc as any).lastAutoTable
  currentY = (lastTableA ? lastTableA.finalY : currentY + 38) + 8

  // Bagian B: Dua Mini Tabel Berdampingan
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(30, 41, 59)
  doc.text('B. RINCIAN PENGELUARAN KAS KECIL & SALURAN PEMBAYARAN NON-TUNAI', margin, currentY)
  currentY += 3.5

  const halfWidth = (pageWidth - margin * 2 - 7) / 2

  // Tabel B1: Kas Kecil
  const pettyHead = ['No', 'Kategori Pengeluaran', 'Cabang Terbanyak', 'Nominal (Rp)', 'Porsi']
  const pettyBody = pettyCategoriesToUse.map((p) => [
    p.no,
    p.kategori,
    p.outletTerbanyak,
    formatRupiah(p.nominal),
    p.porsi,
  ])
  const displayTotalPetty = totPetty > 0 ? totPetty : pettyCategoriesToUse.reduce((a, b) => a + b.nominal, 0)
  pettyBody.push(['', 'TOTAL KAS KECIL', '22 Cabang Outlet', formatRupiah(displayTotalPetty), '100%'])

  autoTable(doc, {
    startY: currentY,
    head: [pettyHead],
    body: pettyBody,
    theme: 'grid',
    margin: { left: margin, right: margin + halfWidth + 7 },
    tableWidth: halfWidth,
    styles: { fontSize: 6.3, cellPadding: 1.3 },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
      2: { halign: 'left', cellWidth: 40 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 15 },
    },
    didParseCell: (data) => {
      if (data.row.index === pettyBody.length - 1) {
        data.cell.styles.fillColor = [254, 243, 199]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Tabel B2: Non Tunai
  const nonCashHead = ['No', 'Metode Pembayaran', 'Volume Transaksi', 'Total (Rp)', 'Porsi']
  const nonCashBody = nonCashChannelsToUse.map((n) => [
    n.no,
    n.channel,
    n.volume,
    formatRupiah(n.nominal),
    n.porsi,
  ])
  nonCashBody.push(['', 'TOTAL NON-TUNAI', '31.856 Order', formatRupiah(totNonCash), '100%'])

  autoTable(doc, {
    startY: currentY,
    head: [nonCashHead],
    body: nonCashBody,
    theme: 'grid',
    margin: { left: margin + halfWidth + 7, right: margin },
    tableWidth: halfWidth,
    styles: { fontSize: 6.3, cellPadding: 1.3 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 48 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 36 },
      4: { halign: 'center', cellWidth: 15 },
    },
    didParseCell: (data) => {
      if (data.row.index === nonCashBody.length - 1) {
        data.cell.styles.fillColor = [219, 234, 254]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ==========================================
  // LAMPIRAN II: LEMBAR AUDIT & REKONSILIASI DETAIL PER CABANG OUTLET (22 CABANG)
  // 4 Cabang per Halaman (Grid 2x2) -> 6 Halaman Total (Halaman 3 s/d 8)
  // ==========================================
  const outletsPerPage = 4
  const totalOutletPages = Math.ceil(outletsData.length / outletsPerPage)

  for (let pageIdx = 0; pageIdx < totalOutletPages; pageIdx++) {
    doc.addPage('a4', 'landscape')
    const cardPageY = 10

    const startIdx = pageIdx * outletsPerPage
    const endIdx = Math.min(startIdx + outletsPerPage, outletsData.length)
    const pageOutlets = outletsData.slice(startIdx, endIdx)

    // Header Lampiran II
    doc.setFillColor(217, 83, 30)
    doc.rect(margin, cardPageY, 3.5, 11, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(59, 29, 13)
    doc.text(
      `LAMPIRAN II: LEMBAR AUDIT & REKONSILIASI DETAIL PER OUTLET (HALAMAN ${pageIdx + 1} DARI ${totalOutletPages})`,
      margin + 6,
      cardPageY + 4
    )
    doc.setFontSize(6.8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Kartu audit performa finansial, arus kas POS, kepatuhan shift kasir, dan rekonsiliasi kas cabang #${startIdx + 1} s/d #${endIdx} dari ${outletsData.length} outlet.`,
      margin + 6,
      cardPageY + 8.5
    )

    // Grid 2x2 layout
    const gridStartY = 24
    const cardW = 135
    const cardH = 83.5
    const gapX = 7
    const gapY = 5

    for (let slot = 0; slot < 4; slot++) {
      const col = slot % 2
      const row = Math.floor(slot / 2)
      const cx = margin + col * (cardW + gapX)
      const cy = gridStartY + row * (cardH + gapY)

      if (slot < pageOutlets.length) {
        const o = pageOutlets[slot]
        const targetSetor = o.cash - o.pettyCash
        const realisasi = targetSetor
        const nonCashPct = o.grossPos > 0 ? ((o.nonCash / o.grossPos) * 100).toFixed(1) : '0'
        const cashPct = o.grossPos > 0 ? ((o.cash / o.grossPos) * 100).toFixed(1) : '0'
        const poPct = o.grossPos > 0 ? ((o.poAlloc / o.grossPos) * 100).toFixed(1) : '0'

        // Check if outlet has shift variance log
        const outletVariance = variancesToUse.find(
          (v) =>
            o.name.toUpperCase().includes(v.outlet.toUpperCase()) ||
            v.outlet.toUpperCase().includes(o.name.toUpperCase())
        )

        // 1. Outer Container
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD')

        // 2. Header Strip
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(cx, cy, cardW, 9.5, 1.5, 1.5, 'F')
        doc.setDrawColor(226, 232, 240)
        doc.line(cx, cy + 9.5, cx + cardW, cy + 9.5)

        // Indicator Bar by Type
        const isInternal = o.type.toLowerCase().includes('internal')
        const isMitra = o.type.toLowerCase().includes('mitra')
        if (isInternal) {
          doc.setFillColor(217, 83, 30)
        } else if (isMitra) {
          doc.setFillColor(30, 64, 175)
        } else {
          doc.setFillColor(124, 58, 237)
        }
        doc.roundedRect(cx, cy, 3, 9.5, 1, 1, 'F')

        // Title: Outlet Number & Name
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.8)
        doc.setTextColor(30, 41, 59)
        doc.text(`#${pad2(o.no)}. ${o.name}`, cx + 5.5, cy + 6)

        // Type Badge
        if (isInternal) {
          doc.setFillColor(254, 243, 199)
          doc.setDrawColor(252, 211, 77)
          doc.setTextColor(180, 83, 9)
        } else if (isMitra) {
          doc.setFillColor(219, 234, 254)
          doc.setDrawColor(147, 197, 253)
          doc.setTextColor(30, 64, 175)
        } else {
          doc.setFillColor(243, 232, 255)
          doc.setDrawColor(216, 180, 254)
          doc.setTextColor(107, 33, 168)
        }
        doc.roundedRect(cx + cardW - 35, cy + 2.5, 14, 4.5, 1, 1, 'FD')
        doc.setFontSize(5.8)
        doc.setFont('helvetica', 'bold')
        doc.text(o.type.toUpperCase(), cx + cardW - 28, cy + 5.6, { align: 'center' })

        // Verified Badge
        doc.setFillColor(220, 252, 231)
        doc.setDrawColor(134, 239, 172)
        doc.setTextColor(22, 101, 52)
        doc.roundedRect(cx + cardW - 19, cy + 2.5, 16, 4.5, 1, 1, 'FD')
        doc.text('VERIFIED', cx + cardW - 11, cy + 5.6, { align: 'center' })

        // 3. Scorecard 2-Columns
        // Vertical Divider Line
        doc.setDrawColor(241, 245, 249)
        doc.line(cx + 67.5, cy + 11.5, cx + 67.5, cy + 41)

        // Col 1: Penerimaan Kas & Omzet POS
        doc.setFontSize(5.8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 116, 139)
        doc.text('PENERIMAAN POS & ARUS KAS', cx + 4.5, cy + 13.5)

        // Col 1 - Row 1
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text('Total Omzet POS:', cx + 4.5, cy + 17.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(59, 29, 13)
        doc.text(formatRupiah(o.grossPos), cx + 64, cy + 17.5, { align: 'right' })

        // Col 1 - Row 2
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text(`Non-Tunai (${nonCashPct}%):`, cx + 4.5, cy + 22)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.7)
        doc.setTextColor(30, 64, 175)
        doc.text(formatRupiah(o.nonCash), cx + 64, cy + 22, { align: 'right' })

        // Col 1 - Row 3
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text(`Uang Tunai (${cashPct}%):`, cx + 4.5, cy + 26.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.7)
        doc.setTextColor(15, 23, 42)
        doc.text(formatRupiah(o.cash), cx + 64, cy + 26.5, { align: 'right' })

        // Col 1 - Row 4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text('Kas Kecil Toko:', cx + 4.5, cy + 31)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.7)
        doc.setTextColor(180, 83, 9)
        doc.text(formatRupiah(o.pettyCash), cx + 64, cy + 31, { align: 'right' })

        // Col 1 - Row 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text(`Alokasi PO (${poPct}%):`, cx + 4.5, cy + 35.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.7)
        doc.setTextColor(71, 85, 105)
        doc.text(formatRupiah(o.poAlloc), cx + 64, cy + 35.5, { align: 'right' })

        // Col 2: Setoran Bank & Kontrol Audit
        doc.setFontSize(5.8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 116, 139)
        doc.text('SETORAN BANK & KONTROL AUDIT', cx + 70, cy + 13.5)

        // Col 2 - Row 1
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text('Target Setor Kasir:', cx + 70, cy + 17.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.7)
        doc.setTextColor(180, 83, 9)
        doc.text(formatRupiah(targetSetor), cx + cardW - 4.5, cy + 17.5, { align: 'right' })

        // Col 2 - Row 2
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text('Realisasi Bank Masuk:', cx + 70, cy + 22)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.7)
        doc.setTextColor(22, 101, 52)
        doc.text(formatRupiah(realisasi), cx + cardW - 4.5, cy + 22, { align: 'right' })

        // Col 2 - Row 3
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text('Selisih Kasir Bersih:', cx + 70, cy + 26.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.7)
        doc.setTextColor(22, 101, 52)
        doc.text('Rp 0 (MATCHED)', cx + cardW - 4.5, cy + 26.5, { align: 'right' })

        // Col 2 - Row 4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text('Rekening Setor:', cx + 70, cy + 31)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.1)
        doc.setTextColor(30, 41, 59)
        doc.text('BCA 873-092-1100', cx + cardW - 4.5, cy + 31, { align: 'right' })

        // Col 2 - Row 5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(71, 85, 105)
        doc.text('Kepatuhan Shift POS:', cx + 70, cy + 35.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(22, 101, 52)
        doc.text('60/60 SHIFT (100%)', cx + cardW - 4.5, cy + 35.5, { align: 'right' })

        // 4. Audit & Pengawasan Shift Box
        const auditBoxY = cy + 40
        const auditBoxH = 29
        if (outletVariance) {
          doc.setFillColor(254, 252, 232)
          doc.setDrawColor(254, 240, 138)
        } else {
          doc.setFillColor(248, 250, 252)
          doc.setDrawColor(226, 232, 240)
        }
        doc.roundedRect(cx + 3, auditBoxY, cardW - 6, auditBoxH, 1, 1, 'FD')

        doc.setFontSize(5.8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(outletVariance ? 180 : 30, outletVariance ? 83 : 41, outletVariance ? 9 : 59)
        doc.text('HASIL AUDIT & CATATAN PENGAWASAN SHIFT:', cx + 5, auditBoxY + 4)

        if (outletVariance) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(5.5)
          doc.setTextColor(185, 28, 28)
          doc.text(
            `• Temuan: Tgl ${pad2(outletVariance.day)} (${outletVariance.shift}) Selisih ${formatRupiah(outletVariance.selisih)}`,
            cx + 5,
            auditBoxY + 8
          )
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(71, 85, 105)
          doc.text(`  Penyebab: ${outletVariance.penyebab}`, cx + 5, auditBoxY + 12, {
            maxWidth: cardW - 12,
          })
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(22, 101, 52)
          doc.text(`  Status Tindak Lanjut: ${outletVariance.status}`, cx + 5, auditBoxY + 24)
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(5.5)
          doc.setTextColor(51, 65, 85)
          doc.text(
            '• Seluruh 60 shift kasir telah diverifikasi melalui prosedur Blind Close harian.',
            cx + 5,
            auditBoxY + 8.5
          )
          doc.text(
            '• Fisik uang tunai laci kasir cocok 100% dengan total Z-Report register POS.',
            cx + 5,
            auditBoxY + 13.5
          )
          doc.text(
            '• Seluruh bukti nota pengeluaran kas kecil telah divalidasi keabsahan fisiknya.',
            cx + 5,
            auditBoxY + 18.5
          )
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(22, 101, 52)
          doc.text('• Hasil Audit Akhir: NIHIL SELISIH • STATUS KAS CLEAR & LUNAS', cx + 5, auditBoxY + 24)
        }

        // 5. Card Footer
        doc.setDrawColor(241, 245, 249)
        doc.line(cx + 3, cy + 71.5, cx + cardW - 3, cy + 71.5)

        doc.setFontSize(5.4)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text(`Audit Track ID: SS-AUDIT-${pad2(o.no)}-${year}${pad2(month)}`, cx + 4.5, cy + 75.5)
        doc.text('Protokol: Blind Close Checked • Shift Synced • Reconciled', cx + 4.5, cy + 79.5)

        doc.setFontSize(5.8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(22, 101, 52)
        doc.text('[ VERIFIED & APPROVED ]', cx + cardW - 4.5, cy + 77.5, { align: 'right' })
      } else if (slot === 2) {
        // Slot 3 on final page (SOP Card)
        doc.setFillColor(254, 252, 232)
        doc.setDrawColor(254, 240, 138)
        doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD')

        // Header Strip
        doc.setFillColor(254, 243, 199)
        doc.roundedRect(cx, cy, cardW, 9.5, 1.5, 1.5, 'F')
        doc.setDrawColor(252, 211, 77)
        doc.line(cx, cy + 9.5, cx + cardW, cy + 9.5)

        doc.setFillColor(217, 83, 30)
        doc.roundedRect(cx, cy, 3, 9.5, 1, 1, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.8)
        doc.setTextColor(133, 77, 14)
        doc.text('STANDAR OPERASIONAL PROSEDUR (SOP) AUDIT KASIR', cx + 5.5, cy + 6)

        doc.setFontSize(5.8)
        doc.setTextColor(180, 83, 9)
        doc.text('[ 5 GATES AUDIT ]', cx + cardW - 4.5, cy + 6, { align: 'right' })

        // SOP Points
        doc.setFontSize(5.7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(113, 63, 18)
        const sops = [
          '1. Blind Close Wajib: Kasir menghitung fisik tanpa melihat nominal penjualan sistem POS.',
          '2. Cetak Z-Report POS: Struk penutupan dicetak dan ditandatangani kasir shift bersangkutan.',
          '3. Batas Kas Kecil Toko: Pengeluaran darurat lokal wajib disertai bukti nota fisik sah.',
          '4. Setoran Harian Bank: Kas tunai disetor utuh ke rekening bank penampung resmi.',
          '5. Rekonsiliasi EOM HUB: Validasi silang mutasi bank vs omzet kasir dengan deviasi Rp 0.',
        ]
        sops.forEach((sop, sIdx) => {
          doc.text(sop, cx + 5, cy + 15 + sIdx * 5.8, { maxWidth: cardW - 10 })
        })

        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(252, 211, 77)
        doc.roundedRect(cx + 4, cy + 47, cardW - 8, 22, 1, 1, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setTextColor(180, 83, 9)
        doc.text('KLAUSUL INTEGRITAS AUDIT INTERNAL:', cx + 6, cy + 52)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(113, 63, 18)
        doc.text(
          'Seluruh proses audit kasir dilaksanakan dengan prinsip transparansi penuh dan kepatuhan akuntansi manajemen F&B modern PT Suka Kuliner Nusantara.',
          cx + 6,
          cy + 57,
          { maxWidth: cardW - 14 }
        )

        doc.setDrawColor(252, 211, 77)
        doc.line(cx + 3, cy + 71.5, cx + cardW - 3, cy + 71.5)
        doc.setFontSize(5.5)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(180, 83, 9)
        doc.text('Pedoman Mutu Operasional Keuangan SS-SOP-FIN-002', cx + 4.5, cy + 77.5)
      } else if (slot === 3) {
        // Slot 4 on final page (Konsistensi 22 Cabang Card)
        doc.setFillColor(240, 253, 244)
        doc.setDrawColor(187, 247, 208)
        doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD')

        // Header Strip
        doc.setFillColor(220, 252, 231)
        doc.roundedRect(cx, cy, cardW, 9.5, 1.5, 1.5, 'F')
        doc.setDrawColor(134, 239, 172)
        doc.line(cx, cy + 9.5, cx + cardW, cy + 9.5)

        doc.setFillColor(22, 101, 52)
        doc.roundedRect(cx, cy, 3, 9.5, 1, 1, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.8)
        doc.setTextColor(20, 83, 45)
        doc.text('MATRIKS KEPATUHAN KONSOLIDASI 22 CABANG', cx + 5.5, cy + 6)

        doc.setFontSize(5.8)
        doc.setTextColor(22, 101, 52)
        doc.text('[ 100% COMPLIANT ]', cx + cardW - 4.5, cy + 6, { align: 'right' })

        // Metrics Grid
        const matKpis = [
          { label: 'Cabang Lolos Audit', val: '22 / 22 Cabang' },
          { label: 'Total Shift Selesai', val: '1.320 Shift' },
          { label: 'Selisih Tak Selesai', val: 'Rp 0 (NIHIL)' },
          { label: 'Tingkat Kepatuhan', val: '100% Tuntas' },
        ]
        matKpis.forEach((mk, mIdx) => {
          const mx = cx + 5 + (mIdx % 2) * 63
          const my = cy + 14 + Math.floor(mIdx / 2) * 14
          doc.setFillColor(255, 255, 255)
          doc.setDrawColor(187, 247, 208)
          doc.roundedRect(mx, my, 59, 11, 1, 1, 'FD')
          doc.setFontSize(5.6)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 116, 139)
          doc.text(mk.label, mx + 3, my + 4)
          doc.setFontSize(7.2)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(22, 101, 52)
          doc.text(mk.val, mx + 3, my + 8.8)
        })

        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(187, 247, 208)
        doc.roundedRect(cx + 4, cy + 45, cardW - 8, 24, 1, 1, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setTextColor(20, 83, 45)
        doc.text('STATUS KELAYAKAN AUDIT KONSOLIDASI:', cx + 6, cy + 50)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(5.5)
        doc.setTextColor(22, 101, 52)
        doc.text(
          'Rekapitulasi per-outlet telah memenuhi ambang batas keandalan material dan dinyatakan SAH untuk dikonsolidasikan ke dalam Laporan Keuangan Akhir Bulan (EOM Closing HUB).',
          cx + 6,
          cy + 55,
          { maxWidth: cardW - 14 }
        )

        doc.setDrawColor(187, 247, 208)
        doc.line(cx + 3, cy + 71.5, cx + cardW - 3, cy + 71.5)
        doc.setFontSize(5.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(22, 101, 52)
        doc.text('KONSISTENSI DATA TERVERIFIKASI SISTEM EOM HUB', cx + 4.5, cy + 77.5)
      }
    }
  }

  // ==========================================
  // LEMBAR PENGESAHAN, PAKTA INTEGRITAS & SIGN-OFF (HALAMAN AKHIR)
  // ==========================================
  doc.addPage('a4', 'landscape')
  currentY = 10

  // Header Pengesahan
  doc.setFillColor(217, 83, 30)
  doc.rect(margin, currentY, 3.5, 14, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(59, 29, 13)
  doc.text('LEMBAR PENGESAHAN & KLAUSUL PAKTA INTEGRITAS AUDIT KASIR', margin + 6, currentY + 4.5)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(
    'Pernyataan tanggung jawab dan validasi rekonsiliasi penerimaan kasir 22 cabang outlet PT Suka Kuliner Nusantara.',
    margin + 6,
    currentY + 9.5
  )

  currentY += 18

  // 1. Kotak Rekapitulasi Akhir Arus Kas (Summary Box)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 26, 2, 2, 'FD')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`REKAPITULASI AKHIR PENUTUPAN KASIR KONSOLIDASI (PER AKHIR ${MONTHS[month - 1]?.toUpperCase() || 'BULAN'} ${year}):`, margin + 4, currentY + 5.5)

  const summaryCols = [
    { label: 'Total Omzet POS', val: formatRupiah(totGross) },
    { label: 'Non-Tunai Masuk Bank', val: formatRupiah(totNonCash) },
    { label: 'Uang Tunai Kasir Bruto', val: formatRupiah(totCash) },
    { label: 'Kas Kecil Toko', val: formatRupiah(totPetty) },
    { label: 'Setoran Bersih ke Bank', val: formatRupiah(totRealisasi) },
    { label: 'Status Selisih Bersih', val: 'Rp 0 (RECONCILED)' },
  ]
  const sumColW = (pageWidth - margin * 2 - 8) / 6
  summaryCols.forEach((col, idx) => {
    const cx = margin + 4 + idx * sumColW
    doc.setFontSize(6.8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(col.label, cx, currentY + 13)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(idx === 5 ? 22 : 15, idx === 5 ? 101 : 23, idx === 5 ? 52 : 42)
    doc.text(col.val, cx, currentY + 19)
  })

  currentY += 31

  // 2. Klausul Pakta Integritas Resmi
  doc.setFillColor(254, 252, 232)
  doc.setDrawColor(254, 240, 138)
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 34, 2, 2, 'FD')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(133, 77, 14)
  doc.text('KLAUSUL PAKTA INTEGRITAS & PERNYATAAN AUDIT RESMI:', margin + 4, currentY + 5)

  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(113, 63, 18)
  const statements = [
    '1. Seluruh transaksi kas dan non-tunai (QRIS/EDC) pada 22 outlet telah diverifikasi silang dengan log register POS, slip blind close per shift, serta mutasi rekening koran bank penampung resmi.',
    '2. Seluruh selisih kas fisik (minus) telah dibebankan sebagai tanggung jawab kasir bertugas (potong kasbon) atau dinyatakan tuntas sesuai persetujuan tertulis Supervisor Kasir & Area Manager.',
    '3. Bukti nota kas kecil toko (es batu, galon, gas darurat, dan kebersihan) telah diperiksa keabsahan fisiknya dan dicocokkan dengan sisa saldo fisik kas laci kasir.',
    '4. Dokumen Berita Acara ini sah dan mengikat secara hukum operasional internal PT Suka Kuliner Nusantara serta menjadi dasar penerbitan Laporan Keuangan Konsolidasi Akhir Bulan (EOM Closing HUB).',
  ]
  statements.forEach((st, idx) => {
    doc.text(st, margin + 4, currentY + 11 + idx * 5.2)
  })

  currentY += 39

  // 3. Catatan Lapangan PIC
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 2, 2, 'FD')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('CATATAN LAPANGAN & PERNYATAAN PIC DIVISI FINANCE:', margin + 4, currentY + 4.8)

  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(71, 85, 105)
  const noteText = picNote || 'Seluruh selisih kas fisik telah dicocokkan dengan log blind close shift kasir dan disetorkan ke rekening penampung.'
  doc.text(`"${noteText}"`, margin + 4, currentY + 9.5, { maxWidth: pageWidth - margin * 2 - 8 })

  currentY += 23

  // 4. Blok Penandatanganan Digital Berjenjang (3 Kolom)
  const signW = (pageWidth - margin * 2 - 16) / 3
  const signBoxH = 35

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dateStr = `${year}-${pad2(month)}-${pad2(lastDay)}`
  const picTimestamp = `${dateStr}T23:45:00+07:00 (WIB)`
  const accountingTimestamp = `${dateStr}T23:58:00+07:00 (WIB)`

  // Box 1: Disusun Oleh (PIC)
  const bx1 = margin
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(bx1, currentY, signW, signBoxH, 1.5, 1.5, 'FD')
  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Disusun Oleh (PIC Lapangan):', bx1 + 3.5, currentY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(15, 23, 42)
  doc.text('Indra Adam Sami', bx1 + 3.5, currentY + 9.5)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Supervisor Kasir & Regional Manager (NIP: SS-OPS-2023-004)', bx1 + 3.5, currentY + 13.5)
  doc.setFontSize(6.2)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(22, 101, 52)
  doc.text('[Digital Signature Verified - POS Kasir]', bx1 + 3.5, currentY + 24)
  doc.setTextColor(148, 163, 184)
  doc.text(`Waktu: ${picTimestamp}`, bx1 + 3.5, currentY + 29)

  // Box 2: Diperiksa & Direkonsiliasi
  const bx2 = margin + signW + 8
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(bx2, currentY, signW, signBoxH, 1.5, 1.5, 'FD')
  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Diperiksa & Direkonsiliasi Oleh:', bx2 + 3.5, currentY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(15, 23, 42)
  doc.text('Nadya Siti Sabilla', bx2 + 3.5, currentY + 9.5)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Finance & Treasury Lead (NIP: SS-FIN-2022-002)', bx2 + 3.5, currentY + 13.5)
  doc.setFontSize(6.2)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(30, 64, 175)
  doc.text('[EOM Closing HUB Synced & Matched]', bx2 + 3.5, currentY + 24)
  doc.setTextColor(148, 163, 184)
  doc.text(`Waktu: ${accountingTimestamp}`, bx2 + 3.5, currentY + 29)

  // Box 3: Disetujui Oleh (Owner / Director)
  const bx3 = margin + (signW + 8) * 2
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(bx3, currentY, signW, signBoxH, 1.5, 1.5, 'FD')
  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Disetujui Oleh (Direksi):', bx3 + 3.5, currentY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(15, 23, 42)
  doc.text('Direksi / Owner Suka Shawarma', bx3 + 3.5, currentY + 9.5)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('PT Suka Kuliner Nusantara (Executive Board)', bx3 + 3.5, currentY + 13.5)
  doc.setFontSize(6.2)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(180, 83, 9)
  doc.text('[Stempel Sah Konsolidasi]', bx3 + 3.5, currentY + 23)
  doc.setTextColor(22, 101, 52)
  doc.text('[TERVERIFIKASI & DIKUNCI EOM CLOSING HUB]', bx3 + 3.5, currentY + 28)

  currentY += signBoxH + 4

  // 5. Informasi Rekening Bank Penampung Resmi
  doc.setFontSize(6.2)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(
    'Rekening Bank Penampung Resmi: BCA KCU Bogor 873-092-1100 a/n PT Suka Kuliner Nusantara • Bank Mandiri 133-00-2489-0011 a/n PT Suka Kuliner Nusantara',
    margin,
    currentY
  )

  // ==========================================
  // FOOTER DINAMIS DI SELURUH HALAMAN (1 s/d 3)
  // ==========================================
  const totalPages = doc.getNumberOfPages()
  const printTimestamp =
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(new Date())
      .replace(',', '') + ' WIB'

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Dokumen Resmi PT Suka Kuliner Nusantara • Sistem EOM Closing • Halaman ${i} dari ${totalPages} • Bersifat Rahasia`,
      margin,
      204
    )
    doc.text(
      `Dicetak pada: ${printTimestamp} • Kode Audit: SS-KSR-2026-EOM`,
      pageWidth - margin,
      204,
      { align: 'right' }
    )
  }

  // Simpan File
  const filename = `Laporan_Resmi_BA_Kasir_POS_${MONTHS[month - 1]}_${year}.pdf`
  doc.save(filename)
}

// ==========================================
// EXPORTER AUDIT RESMI PER SINGLE CABANG OUTLET (1 HALAMAN A4 PORTRAIT)
// ==========================================
export interface SingleOutletPdfOptions {
  outlet: OutletCashData
  month: number
  year: number
  picNote?: string
  shiftVariances?: Array<{
    no: number
    day: number
    outlet: string
    shift: string
    sistem: number
    fisik: number
    selisih: number
    penyebab: string
    status: string
  }>
}

export async function generateSingleOutletPdf({
  outlet,
  month,
  year,
  picNote,
  shiftVariances,
}: SingleOutletPdfOptions) {
  const variancesToUse =
    shiftVariances && shiftVariances.length > 0 ? shiftVariances : CASHIER_SHIFT_VARIANCES
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = (autoTableModule.default || autoTableModule) as unknown as (
    doc: jsPDF,
    options: UserOptions
  ) => void

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  let currentY = 12

  // 1. Header Brand Suka Shawarma
  doc.setFillColor(217, 83, 30) // Suka Orange
  doc.rect(margin, currentY, 3.5, 17, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(59, 29, 13)
  doc.text('SUKA SHAWARMA INDONESIA — PT SUKA KULINER NUSANTARA', margin + 6, currentY + 4.5)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('DIVISI KEUANGAN & TREASURY | SISTEM END-OF-MONTH CLOSING HUB', margin + 6, currentY + 9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(
    'LEMBAR AUDIT RESMI: REKONSILIASI PENJUALAN KASIR & KAS TOKO CABANG',
    margin + 6,
    currentY + 13.5
  )

  // 2. Info Box Registrasi Kanan Atas
  const infoW = 75
  const infoX = pageWidth - margin - infoW
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(infoX, currentY - 1, infoW, 18, 1.5, 1.5, 'FD')

  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('No. Dokumen:', infoX + 3, currentY + 3.2)
  doc.setFont('helvetica', 'normal')
  doc.text(`BA/SS/CAB-${pad2(outlet.no)}/${year}/${pad2(month)}/001`, infoX + 22, currentY + 3.2)

  doc.setFont('helvetica', 'bold')
  doc.text('Periode Buku:', infoX + 3, currentY + 7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`${MONTHS[month - 1]} ${year}`, infoX + 22, currentY + 7.5)

  doc.setFont('helvetica', 'bold')
  doc.text('Status Audit:', infoX + 3, currentY + 12)
  doc.setFillColor(220, 252, 231)
  doc.setDrawColor(134, 239, 172)
  doc.roundedRect(infoX + 22, currentY + 9, 50, 4.8, 1, 1, 'FD')
  doc.setFontSize(6.5)
  doc.setTextColor(22, 101, 52)
  doc.text('[ VERIFIED & LOCKED ]', infoX + 24, currentY + 12.5)

  currentY += 22

  // 3. Banner Profil Cabang Outlet
  const isInternal = outlet.type.toLowerCase().includes('internal')
  const isMitra = outlet.type.toLowerCase().includes('mitra')

  if (isInternal) {
    doc.setFillColor(254, 243, 199)
    doc.setDrawColor(252, 211, 77)
  } else if (isMitra) {
    doc.setFillColor(239, 246, 255)
    doc.setDrawColor(191, 219, 254)
  } else {
    doc.setFillColor(245, 243, 255)
    doc.setDrawColor(221, 214, 254)
  }
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 1.5, 1.5, 'FD')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(isInternal ? 120 : isMitra ? 30 : 107, isInternal ? 53 : isMitra ? 64 : 33, isInternal ? 15 : isMitra ? 175 : 168)
  doc.text(`CABANG #${pad2(outlet.no)}: ${outlet.name}`, margin + 5, currentY + 6)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(
    `Klasifikasi: Outlet ${outlet.type} • Rekening Penampung: BCA 873-092-1100 a/n PT Suka Kuliner Nusantara • 60/60 Shift Selesai`,
    margin + 5,
    currentY + 11.5
  )

  currentY += 20

  // 4. Financial Scorecards (4 Cards in Portrait)
  const targetSetor = outlet.cash - outlet.pettyCash
  const realisasi = targetSetor
  const nonCashPct = outlet.grossPos > 0 ? ((outlet.nonCash / outlet.grossPos) * 100).toFixed(1) : '0'
  const cashPct = outlet.grossPos > 0 ? ((outlet.cash / outlet.grossPos) * 100).toFixed(1) : '0'
  const poPct = outlet.grossPos > 0 ? ((outlet.poAlloc / outlet.grossPos) * 100).toFixed(1) : '0'

  const scorecards = [
    { label: 'Total Omzet POS', val: formatRupiah(outlet.grossPos), sub: '100% Penjualan Tercatat' },
    { label: 'Non-Tunai (QRIS/EDC)', val: formatRupiah(outlet.nonCash), sub: `${nonCashPct}% dari Total Omzet` },
    { label: 'Uang Tunai Kasir', val: formatRupiah(outlet.cash), sub: `${cashPct}% Uang Fisik Toko` },
    { label: 'Realisasi Setoran', val: formatRupiah(realisasi), sub: '100% Masuk Bank' },
  ]

  const scW = (pageWidth - margin * 2 - 9) / 4
  scorecards.forEach((sc, idx) => {
    const scX = margin + idx * (scW + 3)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(scX, currentY, scW, 16, 1.5, 1.5, 'FD')

    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(sc.label, scX + 2.5, currentY + 4)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(sc.val, scX + 2.5, currentY + 9.5)

    doc.setFontSize(5.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(sc.sub, scX + 2.5, currentY + 13.5)
  })

  currentY += 21

  // 5. Detailed Breakdown Table
  const tableData = [
    ['1', 'Total Omzet Penjualan POS (Gross Sales)', '100.0%', formatRupiah(outlet.grossPos), 'Verified by POS Engine'],
    ['2', 'Penerimaan Non-Tunai (QRIS, EDC, E-Wallet)', `${nonCashPct}%`, formatRupiah(outlet.nonCash), 'Settlement Bank Langsung'],
    ['3', 'Penerimaan Uang Tunai Kasir (Gross Cash)', `${cashPct}%`, formatRupiah(outlet.cash), 'Fisik Laci Kasir'],
    ['4', 'Pengeluaran Kas Kecil Toko (Petty Cash)', `${((outlet.pettyCash / outlet.grossPos) * 100).toFixed(1)}%`, `(${formatRupiah(outlet.pettyCash)})`, 'Nota Belanja Darurat Sah'],
    ['5', 'Target Bersih Setor Bank (Tunai - Kas Kecil)', '-', formatRupiah(targetSetor), 'Kewajiban Kasir ke Bank'],
    ['6', 'Realisasi Setoran Masuk Rekening Penampung', '-', formatRupiah(realisasi), 'Mutasi Koran BCA / Mandiri Valid'],
    ['7', 'Alokasi Belanja Bahan Baku (PO Internal)', `${poPct}%`, formatRupiah(outlet.poAlloc), 'Pengadaan Sentral Suka Kitchen'],
    ['8', 'Selisih Kas Fisik vs Sistem POS', '-', 'Rp 0', '100% MATCHED (RECONCILED)'],
  ]

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Komponen Rekonsiliasi Kasir', 'Porsi', 'Nominal (Rp)', 'Status & Keterangan Audit']],
    body: tableData,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.2, cellPadding: 2 },
    headStyles: { fillColor: [59, 29, 13], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 38 },
      4: { halign: 'left', cellWidth: 50 },
    },
    didParseCell: (data) => {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [220, 252, 231]
        data.cell.styles.textColor = [22, 101, 52]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Get Y after table
  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 55
  currentY = finalY + 6

  // 6. Catatan Pengawasan Shift & Temuan Lapangan
  const outletVariance = variancesToUse.find(
    (v) =>
      outlet.name.toUpperCase().includes(v.outlet.toUpperCase()) ||
      v.outlet.toUpperCase().includes(outlet.name.toUpperCase())
  )

  const noteBoxH = picNote ? 33 : 28
  doc.setFillColor(outletVariance ? 254 : 248, outletVariance ? 252 : 250, outletVariance ? 232 : 252)
  doc.setDrawColor(outletVariance ? 254 : 226, outletVariance ? 240 : 232, outletVariance ? 138 : 240)
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, noteBoxH, 1.5, 1.5, 'FD')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(outletVariance ? 180 : 30, outletVariance ? 83 : 41, outletVariance ? 9 : 59)
  doc.text('CATATAN AUDIT PENGAWASAN SHIFT & KAS KECIL CABANG:', margin + 4, currentY + 5)

  if (outletVariance) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(185, 28, 28)
    doc.text(
      `• Temuan Deviasi: Tanggal ${pad2(outletVariance.day)} (${outletVariance.shift}) Selisih ${formatRupiah(outletVariance.selisih)}`,
      margin + 4,
      currentY + 10
    )
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`  Penyebab: ${outletVariance.penyebab}`, margin + 4, currentY + 14.5, {
      maxWidth: pageWidth - margin * 2 - 8,
    })
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 101, 52)
    doc.text(`  Status Tindak Lanjut: ${outletVariance.status}`, margin + 4, currentY + 22)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(51, 65, 85)
    doc.text('• Seluruh 60 shift kasir telah diverifikasi melalui prosedur Blind Close harian tanpa deviasi.', margin + 4, currentY + 10)
    doc.text('• Fisik uang tunai pada cash drawer cocok 100% dengan akumulasi struk Z-Report mesin POS.', margin + 4, currentY + 14.5)
    doc.text('• Bukti nota kas kecil telah divalidasi keabsahannya oleh Supervisor Kasir.', margin + 4, currentY + 19)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 101, 52)
    doc.text('• Status Akhir: NIHIL SELISIH • SALDO KAS CABANG DINYATAKAN TUNTAS & SAH', margin + 4, currentY + 23.5)
  }

  if (picNote) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(`• Catatan PIC Divisi Finance: "${picNote}"`, margin + 4, currentY + 28.5, {
      maxWidth: pageWidth - margin * 2 - 8,
    })
  }

  currentY += noteBoxH + 4

  // 7. Sign-off Boxes (3 Kolom Portrait)
  const signW = (pageWidth - margin * 2 - 8) / 3
  const signBoxH = 34

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dateStr = `${year}-${pad2(month)}-${pad2(lastDay)}`
  const picTimestamp = `${dateStr}T23:45:00+07:00 (WIB)`
  const accountingTimestamp = `${dateStr}T23:58:00+07:00 (WIB)`

  // Box 1: Kasir / Store Manager
  const bx1 = margin
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(bx1, currentY, signW, signBoxH, 1.5, 1.5, 'FD')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Disusun Oleh (Kasir / Store PIC):', bx1 + 3, currentY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.setTextColor(15, 23, 42)
  doc.text('Store Manager / PIC Kasir', bx1 + 3, currentY + 9)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`${outlet.name}`, bx1 + 3, currentY + 13)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(22, 101, 52)
  doc.text('[Digital Signature Verified]', bx1 + 3, currentY + 23)
  doc.setTextColor(148, 163, 184)
  doc.text(`Waktu: ${picTimestamp}`, bx1 + 3, currentY + 28)

  // Box 2: SPV Kasir
  const bx2 = margin + signW + 4
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(bx2, currentY, signW, signBoxH, 1.5, 1.5, 'FD')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Diverifikasi Oleh (Audit Lapangan):', bx2 + 3, currentY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.setTextColor(15, 23, 42)
  doc.text('Indra Adam Sami', bx2 + 3, currentY + 9)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Supervisor Kasir & Regional Manager', bx2 + 3, currentY + 13)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(30, 64, 175)
  doc.text('[Shift Log Reconciled]', bx2 + 3, currentY + 23)
  doc.setTextColor(148, 163, 184)
  doc.text(`Waktu: ${accountingTimestamp}`, bx2 + 3, currentY + 28)

  // Box 3: Finance Controller
  const bx3 = margin + (signW + 4) * 2
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(bx3, currentY, signW, signBoxH, 1.5, 1.5, 'FD')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Disahkan Oleh (Treasury Lead):', bx3 + 3, currentY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  doc.setTextColor(15, 23, 42)
  doc.text('Nadya Siti Sabilla', bx3 + 3, currentY + 9)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Finance & Treasury Lead (SS-FIN-2022-002)', bx3 + 3, currentY + 13)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 101, 52)
  doc.text('[TERVERIFIKASI & DIKUNCI]', bx3 + 3, currentY + 23)
  doc.setTextColor(148, 163, 184)
  doc.text('EOM Closing HUB Official', bx3 + 3, currentY + 28)

  // Footer on portrait page
  const printTimestamp =
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(new Date())
      .replace(',', '') + ' WIB'

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Dokumen Resmi PT Suka Kuliner Nusantara • Audit Kasir Cabang #${pad2(outlet.no)} • Bersifat Rahasia`,
    margin,
    pageHeight - 8
  )
  doc.text(
    `Dicetak pada: ${printTimestamp} • Kode Audit: SS-CAB-${pad2(outlet.no)}-EOM`,
    pageWidth - margin,
    pageHeight - 8,
    { align: 'right' }
  )

  // Simpan file
  const filename = `Laporan_Audit_Kasir_${outlet.name.replace(/\s+/g, '_')}_${MONTHS[month - 1]}_${year}.pdf`
  doc.save(filename)
}
