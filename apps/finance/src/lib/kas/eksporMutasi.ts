import { rupiah, tanggalWaktu } from '@/lib/format'
import { JENIS_LABEL, catatanTambahan, totalBaris, type BarisMutasi, type RingkasanMutasi } from './mutasiRekening'

export interface InfoEkspor {
  rekening: string
  dari: string
  sampai: string
  /** Label jenis bila tabel sedang disaring; saldo berjalan tidak diekspor saat disaring. */
  jenis?: string | null
}

function namaBerkas(info: InfoEkspor, ext: string) {
  const aman = (s: string) => s.replace(/[^\w\d]+/g, '_').replace(/^_|_$/g, '')
  const jenis = info.jenis ? `_${aman(info.jenis)}` : ''
  return `Mutasi_${aman(info.rekening)}${jenis}_${info.dari}_${info.sampai}.${ext}`
}

function keteranganLengkap(b: BarisMutasi): string {
  const catatan = catatanTambahan(b)
  const dasar = catatan ? `${b.keterangan} — ${catatan}` : b.keterangan
  return b.dihitung ? dasar : `${dasar} (dibatalkan)`
}

export async function eksporMutasiExcel(info: InfoEkspor, baris: BarisMutasi[], r: RingkasanMutasi) {
  const ExcelJS = (await import('exceljs')).default
  const { saveAs } = await import('file-saver')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Mutasi')
  const pakaiSaldo = !info.jenis

  ws.addRow([`Mutasi ${info.rekening}`]).font = { bold: true, size: 14 }
  ws.addRow([`Periode ${info.dari} s/d ${info.sampai}${info.jenis ? ` · Jenis: ${info.jenis}` : ''}`])
  ws.addRow([])
  const t = totalBaris(baris)
  const ringkas: [string, number][] = pakaiSaldo
    ? [['Saldo awal', r.saldoAwal], ['Total masuk', r.totalMasuk], ['Total keluar', r.totalKeluar], ['Saldo akhir', r.saldoAkhir]]
    : [['Total masuk', t.masuk], ['Total keluar', t.keluar]]
  for (const [label, n] of ringkas) {
    const row = ws.addRow([label, n])
    row.getCell(2).numFmt = '#,##0.00'
  }
  ws.addRow([])

  const kolom = ['Tanggal', 'Jenis', 'Outlet / Pihak', 'Keterangan', 'Dicatat oleh', 'Bukti', 'Masuk', 'Keluar']
  if (pakaiSaldo) kolom.push('Saldo')
  ws.addRow(kolom).font = { bold: true }
  for (const b of baris) {
    const row = ws.addRow([
      tanggalWaktu(b.occurred_at),
      JENIS_LABEL[b.jenis],
      b.pihak,
      keteranganLengkap(b),
      b.dicatat_oleh ?? '-',
      b.proof_url ? 'Buka' : '-',
      b.masuk || null,
      b.keluar || null,
      ...(pakaiSaldo ? [b.dihitung ? b.saldo : null] : []),
    ])
    if (b.proof_url) {
      row.getCell(6).value = { text: 'Buka', hyperlink: b.proof_url }
      row.getCell(6).font = { color: { argb: 'FF0563C1' }, underline: true }
    }
  }
  const lebar = [20, 14, 26, 55, 18, 8, 15, 15, 15]
  lebar.slice(0, kolom.length).forEach((w, i) => { ws.getColumn(i + 1).width = w })
  for (const c of pakaiSaldo ? [7, 8, 9] : [7, 8]) ws.getColumn(c).numFmt = '#,##0.00'

  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), namaBerkas(info, 'xlsx'))
}

export async function eksporMutasiPdf(info: InfoEkspor, baris: BarisMutasi[], r: RingkasanMutasi) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pakaiSaldo = !info.jenis
  const t = totalBaris(baris)

  doc.setFontSize(14)
  doc.text(`Mutasi ${info.rekening}`, 14, 15)
  doc.setFontSize(10)
  doc.text(`Periode ${info.dari} s/d ${info.sampai}${info.jenis ? ` · Jenis: ${info.jenis}` : ''}`, 14, 21)
  doc.text(
    pakaiSaldo
      ? `Saldo awal ${rupiah(r.saldoAwal)}   ·   Masuk ${rupiah(r.totalMasuk)}   ·   Keluar ${rupiah(r.totalKeluar)}   ·   Saldo akhir ${rupiah(r.saldoAkhir)}`
      : `Masuk ${rupiah(t.masuk)}   ·   Keluar ${rupiah(t.keluar)}`,
    14,
    27,
  )

  const head = ['Tanggal', 'Jenis', 'Outlet / Pihak', 'Keterangan', 'Dicatat oleh', 'Bukti', 'Masuk', 'Keluar']
  if (pakaiSaldo) head.push('Saldo')
  autoTable(doc, {
    startY: 32,
    head: [head],
    body: baris.map(b => [
      tanggalWaktu(b.occurred_at),
      JENIS_LABEL[b.jenis],
      b.pihak,
      keteranganLengkap(b),
      b.dicatat_oleh ?? '-',
      b.proof_url ? 'Ada' : '-',
      b.masuk ? rupiah(b.masuk) : '',
      b.keluar ? rupiah(b.keluar) : '',
      ...(pakaiSaldo ? [b.dihitung ? rupiah(b.saldo) : ''] : []),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [112, 22, 4] },
    columnStyles: {
      0: { cellWidth: 26 },
      3: { cellWidth: 80 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  })
  doc.save(namaBerkas(info, 'pdf'))
}
