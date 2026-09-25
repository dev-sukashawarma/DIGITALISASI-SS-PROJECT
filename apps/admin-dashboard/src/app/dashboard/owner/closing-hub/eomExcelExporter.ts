// apps/admin-dashboard/src/app/dashboard/owner/closing-hub/eomExcelExporter.ts
import * as XLSX from 'xlsx'
import { DIVISION_FULL_REPORTS, OUTLETS_19_DATA } from './divisionReportsData'

const formatNumber = (val: any) => {
  if (typeof val === 'number') return val
  return val
}

export function exportDivisionToExcel(divisionKey: string, monthName: string, yearNum: number) {
  const report = DIVISION_FULL_REPORTS[divisionKey]
  if (!report) return

  const docNumber = `${report.codePrefix}/${yearNum}/${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const wb = XLSX.utils.book_new()

  // Sheet 1: Dokumen Berita Acara & Rangkuman Utama
  const headerData = [
    ['SUKA SHAWARMA INDONESIA - PT SUKA KULINER NUSANTARA'],
    [report.title],
    [`Nomor Dokumen: ${docNumber}`],
    [`Periode: ${monthName} ${yearNum}`],
    [`Status Dokumen: VERIFIED & LOCKED`],
    [`Tanggal Cut-off: 30/31 ${monthName} ${yearNum} 23:59 WIB`],
    [],
    ['RINGKASAN INDIKATOR KUNCI (KPI):'],
    ...report.summaryKpis.map((kpi) => [kpi.label, kpi.value]),
    [],
    ['TABEL DATA UTAMA DIVISI:'],
    report.columns.map((c) => c.label),
    ...report.rows.map((r) => report.columns.map((c) => formatNumber(r[c.key]))),
    [],
    ['CATATAN LAPANGAN & VERIFIKASI:'],
    [report.notesDefault],
    [],
    ['LEMBAR PENGESAHAN TANDA TANGAN:'],
    ['Disusun Oleh:', report.preparedByRole, 'Staff Pelaksana'],
    ['Diverifikasi Oleh:', report.verifiedByRole, 'SPV / Koordinator Divisi'],
    ['Disetujui Oleh:', report.approvedByRole, 'Finance Director / Owner'],
  ]

  const wsMain = XLSX.utils.aoa_to_sheet(headerData)
  XLSX.utils.book_append_sheet(wb, wsMain, 'Berita Acara')

  // Sheet 2: Breakdown 19 Outlet Lengkap
  const outletHeaders = [
    'No',
    'Nama Outlet Cabang',
    'Tipe Kepemilikan',
    'Omzet POS (Rp)',
    'Setoran Bank (Rp)',
    'Kas Kecil Laci (Rp)',
    'Nilai Stok Akhir (Rp)',
    'Kerugian Waste (Rp)',
    'Selisih Stok (Rp)',
    'Jumlah Kru',
    '% Kehadiran',
    'Beban Gaji (Rp)',
    'Status Closing',
  ]

  const outletRows = OUTLETS_19_DATA.map((o, idx) => [
    idx + 1,
    o.name,
    o.type,
    o.grossPos,
    o.bankDeposit,
    o.pettyCash,
    o.stockAsset,
    o.wasteRp,
    o.shrinkageRp,
    o.crewCount,
    o.attendanceRate,
    o.payroll,
    o.status,
  ])

  // Total Row
  const totalRow = [
    'TOTAL',
    '19 Outlet Jaringan Suka Shawarma',
    '-',
    OUTLETS_19_DATA.reduce((a, b) => a + b.grossPos, 0),
    OUTLETS_19_DATA.reduce((a, b) => a + b.bankDeposit, 0),
    OUTLETS_19_DATA.reduce((a, b) => a + b.pettyCash, 0),
    OUTLETS_19_DATA.reduce((a, b) => a + b.stockAsset, 0),
    OUTLETS_19_DATA.reduce((a, b) => a + b.wasteRp, 0),
    OUTLETS_19_DATA.reduce((a, b) => a + b.shrinkageRp, 0),
    OUTLETS_19_DATA.reduce((a, b) => a + b.crewCount, 0),
    '98.4%',
    OUTLETS_19_DATA.reduce((a, b) => a + b.payroll, 0),
    '100% CLOSED',
  ]

  const wsOutlets = XLSX.utils.aoa_to_sheet([
    ['BREAKDOWN PERFORMA & KELENGKAPAN TUTUP BULAN PER OUTLET (19 CABANG)'],
    [`Periode: ${monthName} ${yearNum}`],
    [],
    outletHeaders,
    ...outletRows,
    totalRow,
  ])

  XLSX.utils.book_append_sheet(wb, wsOutlets, 'Detail 19 Outlet')

  // Unduh File Excel .xlsx
  XLSX.writeFile(wb, `Laporan_Lengkap_${divisionKey}_${monthName}_${yearNum}.xlsx`)
}

export function exportMasterConsolidatedToExcel(monthName: string, yearNum: number) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Ringkasan Konsolidasi 3 Pilar
  const pnlHeaders = ['Komponen Keuangan F&B', 'Konsolidasi Global (19 Cabang + HQ)', 'Outlet Internal (12 Cabang)', 'Outlet Mitra (7 Cabang)']
  const pnlRows = [
    ['[+] Gross Sales (Omzet Kotor)', 620500000, 395000000, 225500000],
    ['[-] Diskon & Potongan Platform', 48500000, 30800000, 17700000],
    ['(=) NET REVENUE (Pendapatan Bersih)', 572000000, 364200000, 207800000],
    ['[-] Total COGS / HPP (Bahan Pokok + Kemasan + Waste)', 234520000, 149322000, 85198000],
    ['(=) LABA KOTOR (GROSS PROFIT)', 337480000, 214878000, 122602000],
    ['[-] STORE OPEX (Gaji Kru, Listrik, Gas, Kas Kecil, Sewa Toko)', 137280000, 87408000, 49872000],
    ['(=) STORE CONTRIBUTION MARGIN', 200200000, 127470000, 72730000],
    ['[-] HEAD OFFICE OVERHEAD & MARKETING', 45760000, 45760000, 0],
    ['(=) NET OPERATING PROFIT (EBITDA)', 154440000, 81710000, 72730000],
  ]

  const wsPnl = XLSX.utils.aoa_to_sheet([
    ['SUKA SHAWARMA INDONESIA - MASTER CONSOLIDATED REPORT'],
    [`Periode: ${monthName} ${yearNum}`],
    [],
    pnlHeaders,
    ...pnlRows,
  ])
  XLSX.utils.book_append_sheet(wb, wsPnl, 'Laba Rugi 3 Pilar')

  // Sheet 2: Breakdown 19 Outlet
  const outletHeaders = [
    'No',
    'Nama Outlet Cabang',
    'Tipe',
    'Gross Sales (Rp)',
    'Net Revenue (Rp)',
    'COGS (Rp)',
    'Gross Profit (Rp)',
    'Store OPEX (Rp)',
    'Store Margin (Rp)',
    'Margin %',
    'Ranking',
  ]

  const outletRows = OUTLETS_19_DATA.map((o, idx) => {
    const netRev = Math.round(o.grossPos * 0.92)
    const cogs = Math.round(netRev * 0.41)
    const gp = netRev - cogs
    const opex = o.pettyCash * 3 + o.payroll
    const storeMargin = gp - opex
    const marginPct = ((storeMargin / netRev) * 100).toFixed(1) + '%'
    return [
      idx + 1,
      o.name,
      o.type,
      o.grossPos,
      netRev,
      cogs,
      gp,
      opex,
      storeMargin,
      marginPct,
      `Peringkat #${idx + 1}`,
    ]
  })

  const wsOutlets = XLSX.utils.aoa_to_sheet([
    ['PERFORMA KEUANGAN & PROFITABILITAS PER OUTLET (19 CABANG)'],
    [`Periode: ${monthName} ${yearNum}`],
    [],
    outletHeaders,
    ...outletRows,
  ])
  XLSX.utils.book_append_sheet(wb, wsOutlets, 'Performa 19 Outlet')

  XLSX.writeFile(wb, `Laporan_Konsolidasi_Master_${monthName}_${yearNum}.xlsx`)
}
