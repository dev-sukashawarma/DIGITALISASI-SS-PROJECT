import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { LOGO_BASE64 } from '@/utils/logoBase64'
import { rupiah, tanggal, tanggalWaktu } from '@/lib/format'
import {
  ETOLL_CATEGORY_LABELS,
  ETOLL_ISSUER_LABELS,
  type EtollCard,
  type EtollTransaction,
} from '@/lib/etoll/types'
import { formatCardNumber } from '@/lib/etoll/reconcile'

export interface EtollExportOptions {
  from: string
  to: string
  cards: EtollCard[]
  transactions: EtollTransaction[]
  filterSummary?: string
}

export async function exportEtollExcel(opts: EtollExportOptions): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Suka Shawarma Finance'
  wb.created = new Date()

  // Sheet 1: Ringkasan Per Kartu
  const wsCards = wb.addWorksheet('Rekap Per Kartu')
  wsCards.columns = [
    { header: 'Label Kartu', key: 'label', width: 24 },
    { header: 'Bank', key: 'issuer', width: 18 },
    { header: 'Nomor Kartu', key: 'card_number', width: 22 },
    { header: 'Pemegang Aktif', key: 'holder', width: 22 },
    { header: 'Plat Kendaraan', key: 'plate', width: 15 },
    { header: 'Saldo Terakhir', key: 'last_balance', width: 16 },
    { header: 'Total Debit (Periode)', key: 'debit', width: 20 },
    { header: 'Total Top-Up (Periode)', key: 'topup', width: 20 },
    { header: 'Selisih Tak Terlacak', key: 'gap', width: 20 },
    { header: 'Jml Transaksi', key: 'tx_count', width: 14 },
  ]
  wsCards.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  wsCards.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF701604' },
  }

  for (const card of opts.cards) {
    const cardTxs = opts.transactions.filter((t) => t.card_id === card.id)
    const debit = cardTxs
      .filter((t) => t.tx_type === 'debit')
      .reduce((s, t) => s + Number(t.amount || 0), 0)
    const topup = cardTxs
      .filter((t) => t.tx_type === 'topup')
      .reduce((s, t) => s + Number(t.amount || 0), 0)
    const gap = cardTxs
      .filter((t) => t.tx_type === 'debit' && t.source === 'untracked_gap')
      .reduce((s, t) => s + Number(t.amount || 0), 0)

    wsCards.addRow({
      label: card.label,
      issuer: ETOLL_ISSUER_LABELS[card.issuer] ?? card.issuer,
      card_number: formatCardNumber(card.card_number),
      holder: card.holder?.name ?? '-',
      plate: card.vehicle_plate ?? '-',
      last_balance: Number(card.last_balance || 0),
      debit,
      topup,
      gap,
      tx_count: cardTxs.length,
    })
  }
  ;['last_balance', 'debit', 'topup', 'gap'].forEach((col) => {
    wsCards.getColumn(col).numFmt = '#,##0'
  })

  // Sheet 2: Ringkasan Per Kategori (Debit)
  const wsCat = wb.addWorksheet('Rekap Per Kategori')
  wsCat.columns = [
    { header: 'Kategori', key: 'category', width: 26 },
    { header: 'Jumlah Transaksi', key: 'count', width: 18 },
    { header: 'Total Nominal', key: 'total', width: 20 },
  ]
  wsCat.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  wsCat.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF904D00' },
  }

  const catMap = new Map<string, { count: number; total: number }>()
  for (const tx of opts.transactions) {
    if (tx.tx_type !== 'debit') continue
    const key = tx.category
    const cur = catMap.get(key) ?? { count: 0, total: 0 }
    cur.count += 1
    cur.total += Number(tx.amount || 0)
    catMap.set(key, cur)
  }
  for (const [cat, stats] of catMap.entries()) {
    wsCat.addRow({
      category: ETOLL_CATEGORY_LABELS[cat as keyof typeof ETOLL_CATEGORY_LABELS] ?? cat,
      count: stats.count,
      total: stats.total,
    })
  }
  wsCat.getColumn('total').numFmt = '#,##0'

  // Sheet 3: Detail Transaksi
  const wsTx = wb.addWorksheet('Detail Transaksi')
  wsTx.columns = [
    { header: 'Waktu (WIB)', key: 'occurred_at', width: 20 },
    { header: 'Kartu', key: 'card_label', width: 22 },
    { header: 'Bank', key: 'issuer', width: 16 },
    { header: 'Pemegang', key: 'holder', width: 20 },
    { header: 'Tipe', key: 'tx_type', width: 10 },
    { header: 'Sumber', key: 'source', width: 14 },
    { header: 'Kategori', key: 'category', width: 20 },
    { header: 'Lokasi / Merchant', key: 'merchant', width: 26 },
    { header: 'Kode Terminal', key: 'terminal', width: 16 },
    { header: 'Nominal', key: 'amount', width: 16 },
    { header: 'Saldo Setelah', key: 'balance_after', width: 16 },
    { header: 'Catatan', key: 'note', width: 32 },
  ]
  wsTx.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  wsTx.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2C1810' },
  }

  for (const tx of opts.transactions) {
    wsTx.addRow({
      occurred_at: tanggalWaktu(tx.occurred_at),
      card_label: tx.card?.label ?? '-',
      issuer: tx.card?.issuer ? ETOLL_ISSUER_LABELS[tx.card.issuer] : '-',
      holder: tx.holder?.name ?? '-',
      tx_type: tx.tx_type === 'debit' ? 'Debit' : 'Top-Up',
      source:
        tx.source === 'chip'
          ? 'Chip NFC'
          : tx.source === 'untracked_gap'
          ? 'Selisih Saldo'
          : 'Manual',
      category: ETOLL_CATEGORY_LABELS[tx.category] ?? tx.category,
      merchant: tx.merchant_label ?? '-',
      terminal: tx.terminal_code ?? '-',
      amount: Number(tx.amount || 0),
      balance_after: tx.balance_after != null ? Number(tx.balance_after) : '',
      note: tx.note ?? '',
    })
  }
  wsTx.getColumn('amount').numFmt = '#,##0'
  wsTx.getColumn('balance_after').numFmt = '#,##0'

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, `Laporan_eToll_${opts.from}_sd_${opts.to}.xlsx`)
}

export async function exportEtollPdf(opts: EtollExportOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  try {
    doc.addImage(LOGO_BASE64, 'PNG', 14, 10, 22, 22)
  } catch {
    // Abaikan jika logo gagal dimuat
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(44, 24, 16)
  doc.text('LAPORAN PEMAKAIAN & AUDIT KARTU E-TOLL', 40, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 70, 60)
  doc.text(
    `Periode: ${tanggal(opts.from)} s/d ${tanggal(opts.to)}${opts.filterSummary ? `  |  ${opts.filterSummary}` : ''}`,
    40,
    25,
  )
  doc.text(`Dicetak: ${tanggalWaktu(new Date().toISOString())}`, 40, 31)

  const totalDebit = opts.transactions
    .filter((t) => t.tx_type === 'debit')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalTopup = opts.transactions
    .filter((t) => t.tx_type === 'topup')
    .reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalGap = opts.transactions
    .filter((t) => t.tx_type === 'debit' && t.source === 'untracked_gap')
    .reduce((s, t) => s + Number(t.amount || 0), 0)

  autoTable(doc, {
    startY: 38,
    head: [['Total Pemakaian (Debit)', 'Total Top-Up Terdeteksi', 'Selisih Tak Terlacak', 'Jumlah Transaksi']],
    body: [[rupiah(totalDebit), rupiah(totalTopup), rupiah(totalGap), `${opts.transactions.length} transaksi`]],
    theme: 'grid',
    headStyles: { fillColor: [112, 22, 4], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 10, fontStyle: 'bold' },
  })

  const afterKpiY = ((doc as any).lastAutoTable?.finalY ?? 55) + 6

  autoTable(doc, {
    startY: afterKpiY,
    head: [[
      'Waktu (WIB)',
      'Kartu',
      'Pemegang',
      'Tipe',
      'Kategori',
      'Lokasi / Terminal',
      'Nominal',
      'Saldo Akhir',
      'Catatan',
    ]],
    body: opts.transactions.map((tx) => [
      tanggalWaktu(tx.occurred_at),
      tx.card?.label ?? '-',
      tx.holder?.name ?? '-',
      tx.tx_type === 'debit' ? 'Debit' : 'Top-Up',
      ETOLL_CATEGORY_LABELS[tx.category] ?? tx.category,
      tx.merchant_label || tx.terminal_code || '-',
      rupiah(Number(tx.amount || 0)),
      tx.balance_after != null ? rupiah(Number(tx.balance_after)) : '-',
      (tx.note ?? '').slice(0, 60),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [144, 77, 0], textColor: 255 },
    alternateRowStyles: { fillColor: [255, 248, 241] },
  })

  doc.save(`Laporan_eToll_${opts.from}_sd_${opts.to}.pdf`)
}
