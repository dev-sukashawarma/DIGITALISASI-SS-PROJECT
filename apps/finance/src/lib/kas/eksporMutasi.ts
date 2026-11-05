import { rupiah, tanggalWaktu } from '@/lib/format'
import type { BarisMutasi, RingkasanMutasi } from './mutasiRekening'

export interface InfoEkspor {
  rekening: string
  dari: string
  sampai: string
}

function namaBerkas(info: InfoEkspor, ext: string) {
  const aman = info.rekening.replace(/[^\w\d]+/g, '_').replace(/^_|_$/g, '')
  return `Mutasi_${aman}_${info.dari}_${info.sampai}.${ext}`
}

export async function eksporMutasiExcel(info: InfoEkspor, baris: BarisMutasi[], r: RingkasanMutasi) {
  const ExcelJS = (await import('exceljs')).default
  const { saveAs } = await import('file-saver')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Mutasi')

  ws.addRow([`Mutasi ${info.rekening}`]).font = { bold: true, size: 14 }
  ws.addRow([`Periode ${info.dari} s/d ${info.sampai}`])
  ws.addRow([])
  ws.addRow(['Saldo awal', r.saldoAwal])
  ws.addRow(['Total masuk', r.totalMasuk])
  ws.addRow(['Total keluar', r.totalKeluar])
  ws.addRow(['Saldo akhir', r.saldoAkhir])
  ws.addRow([])
  const header = ws.addRow(['Tanggal', 'Keterangan', 'Masuk', 'Keluar', 'Saldo', 'Status'])
  header.font = { bold: true }
  for (const b of baris) {
    ws.addRow([
      tanggalWaktu(b.occurred_at),
      b.keterangan,
      b.masuk || null,
      b.keluar || null,
      b.dihitung ? b.saldo : null,
      b.dihitung ? '' : 'Dibatalkan',
    ])
  }
  ws.getColumn(1).width = 22
  ws.getColumn(2).width = 55
  for (const c of [3, 4, 5]) ws.getColumn(c).numFmt = '#,##0.00'
  ;[4, 5, 6, 7].forEach(i => { ws.getCell(`B${i}`).numFmt = '#,##0.00' })
  ws.getColumn(3).width = ws.getColumn(4).width = ws.getColumn(5).width = 16

  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), namaBerkas(info, 'xlsx'))
}

export async function eksporMutasiPdf(info: InfoEkspor, baris: BarisMutasi[], r: RingkasanMutasi) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFontSize(14)
  doc.text(`Mutasi ${info.rekening}`, 14, 15)
  doc.setFontSize(10)
  doc.text(`Periode ${info.dari} s/d ${info.sampai}`, 14, 21)
  doc.text(
    `Saldo awal ${rupiah(r.saldoAwal)}   ·   Masuk ${rupiah(r.totalMasuk)}   ·   Keluar ${rupiah(r.totalKeluar)}   ·   Saldo akhir ${rupiah(r.saldoAkhir)}`,
    14,
    27,
  )

  autoTable(doc, {
    startY: 32,
    head: [['Tanggal', 'Keterangan', 'Masuk', 'Keluar', 'Saldo']],
    body: baris.map(b => [
      tanggalWaktu(b.occurred_at),
      b.dihitung ? b.keterangan : `${b.keterangan} (dibatalkan)`,
      b.masuk ? rupiah(b.masuk) : '',
      b.keluar ? rupiah(b.keluar) : '',
      b.dihitung ? rupiah(b.saldo) : '',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [112, 22, 4] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })
  doc.save(namaBerkas(info, 'pdf'))
}
