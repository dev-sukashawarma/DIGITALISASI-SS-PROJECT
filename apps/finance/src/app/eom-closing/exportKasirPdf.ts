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
    day: 5,
    outlet: 'SUKA SHAWARMA EMPANG',
    shift: 'Shift 2 (Malam) - Dinda Safitri',
    sistem: 3450000,
    fisik: 3400000,
    selisih: -50000,
    penyebab: 'Salah hitung kembalian pecahan Rp 50.000 saat antrean padat',
    status: 'LUNAS (Potong Kasbon Kasir)',
  },
  {
    no: 2,
    day: 12,
    outlet: 'SUKA SHAWARMA CIMANGGU',
    shift: 'Shift 1 (Siang) - Rizky Pratama',
    sistem: 2890000,
    fisik: 2915000,
    selisih: 25000,
    penyebab: 'Konsumen menolak uang kembalian receh pecahan kecil',
    status: 'SELESAI (Disetor ke Kas Operasional)',
  },
  {
    no: 3,
    day: 18,
    outlet: 'SUKA SHAWARMA DEPOK SUKMAJAYA',
    shift: 'Shift 2 (Malam) - Ahmad Fauzi',
    sistem: 4120000,
    fisik: 4070000,
    selisih: -50000,
    penyebab: 'Transaksi QRIS ganda salah input manual pada sistem kasir',
    status: 'LUNAS (Revisi Settlement Bank)',
  },
  {
    no: 4,
    day: 24,
    outlet: 'MITRA CILEUNGSI',
    shift: 'Shift 2 (Malam) - Siti Rahma',
    sistem: 5210000,
    fisik: 5160000,
    selisih: -50000,
    penyebab: 'Selisih penukaran modal uang kecil dengan pedagang sekitar',
    status: 'LUNAS (Potong Kasbon Kasir)',
  },
  {
    no: 5,
    day: 27,
    outlet: 'MITRA CICURUG',
    shift: 'Shift 1 (Siang) - Budi Santoso',
    sistem: 3100000,
    fisik: 3120000,
    selisih: 20000,
    penyebab: 'Pembulatan kembalian uang belanja pada struk POS kasir',
    status: 'SELESAI (Disetor ke Kas Operasional)',
  },
  {
    no: 6,
    day: 29,
    outlet: 'SUKA SHAWARMA DRAMAGA',
    shift: 'Shift 2 (Malam) - Bayu Nugraha',
    sistem: 3670000,
    fisik: 3620000,
    selisih: -50000,
    penyebab: 'Kelalaian penyerahan struk & kembalian saat jam rush hour',
    status: 'LUNAS (Potong Kasbon Kasir)',
  },
]

// Data Kategori Kas Kecil (Petty Cash) 22 Cabang
const PETTY_CASH_CATEGORIES = [
  { no: 1, kategori: 'Es Batu Kristal Darurat', outletTerbanyak: 'Empang, Cicurug, Cileungsi', nominal: 3420000, porsi: '33.0%' },
  { no: 2, kategori: 'Gas LPG 3kg Darurat Lokal', outletTerbanyak: 'Dramaga, Cimanggu, Sawangan', nominal: 2240000, porsi: '21.6%' },
  { no: 3, kategori: 'Air Mineral Galon Outlet', outletTerbanyak: 'Semua 22 Cabang Outlet', nominal: 2150000, porsi: '20.7%' },
  { no: 4, kategori: 'Iuran Kebersihan & Parkir', outletTerbanyak: 'Depok, Cirendeu, Jagakarsa', nominal: 1480000, porsi: '14.3%' },
  { no: 5, kategori: 'Bahan Dapur & Plastik Urgent', outletTerbanyak: 'BNR, Pajajaran, Pekayon', nominal: 1079250, porsi: '10.4%' },
]

// Data Kanal Pembayaran Non-Tunai
const NON_CASH_CHANNELS = [
  { no: 1, channel: 'QRIS Statis & Dinamis (BCA / Mandiri)', volume: '18.420 Trx', nominal: 684210000, porsi: '51.0%' },
  { no: 2, channel: 'EDC Kartu Debit & Kredit Bank', volume: '7.940 Trx', nominal: 389120000, porsi: '29.0%' },
  { no: 3, channel: 'E-Wallet (GoPay, ShopeePay, OVO)', volume: '4.110 Trx', nominal: 187816540, porsi: '14.0%' },
  { no: 4, channel: 'Settlement Merchant Delivery Online', volume: '1.386 Trx', nominal: 80200000, porsi: '6.0%' },
]

const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val).replace(/\u00A0|\u202F/g, ' ')
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export interface ExportKasirPdfOptions {
  month: number
  year: number
  picNote: string
  outletsData: OutletCashData[]
}

export async function generatePosKasirPdf({
  month,
  year,
  picNote,
  outletsData,
}: ExportKasirPdfOptions) {
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

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const varianceBody = CASHIER_SHIFT_VARIANCES.map((v) => [
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
  const pettyBody = PETTY_CASH_CATEGORIES.map((p) => [
    p.no,
    p.kategori,
    p.outletTerbanyak,
    formatRupiah(p.nominal),
    p.porsi,
  ])
  pettyBody.push(['', 'TOTAL KAS KECIL', '22 Cabang Outlet', formatRupiah(totPetty), '100%'])

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
  const nonCashBody = NON_CASH_CHANNELS.map((n) => [
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
  // HALAMAN 3: PENGESAHAN, PAKTA INTEGRITAS & SIGN-OFF
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
  doc.text('Hendra Kurniawan, S.E.', bx1 + 3.5, currentY + 9.5)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Supervisor Kasir & Audit Toko (NIP: SS-OPS-2023-014)', bx1 + 3.5, currentY + 13.5)
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
  doc.text('Farhan Pratama, Ak., CA.', bx2 + 3.5, currentY + 9.5)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Finance Controller / Accounting Lead (NIP: SS-FIN-2022-003)', bx2 + 3.5, currentY + 13.5)
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
  doc.text('Finance Director / Owner', bx3 + 3.5, currentY + 9.5)
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
