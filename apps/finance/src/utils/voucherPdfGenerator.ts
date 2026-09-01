import type { OfficeVoucher } from '@/lib/officeVoucher'
import { LOGO_BASE64 } from '@/utils/logoBase64'

function angkaTerbilang(angka: number): string {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ]
  const n = Math.floor(Math.abs(angka))
  if (n === 0) return 'Nol Rupiah'
  if (n < 12) return bilangan[n] + ' Rupiah'
  if (n < 20) return bilangan[n - 10] + ' Belas Rupiah'
  if (n < 100) return bilangan[Math.floor(n / 10)] + ' Puluh ' + bilangan[n % 10] + ' Rupiah'
  if (n < 200) return 'Seratus ' + angkaTerbilang(n - 100)
  if (n < 1000) return bilangan[Math.floor(n / 100)] + ' Ratus ' + angkaTerbilang(n % 100)
  if (n < 2000) return 'Seribu ' + angkaTerbilang(n - 1000)
  if (n < 1000000) return angkaTerbilang(Math.floor(n / 1000)).replace(' Rupiah', '') + ' Ribu ' + angkaTerbilang(n % 1000)
  if (n < 1000000000) return angkaTerbilang(Math.floor(n / 1000000)).replace(' Rupiah', '') + ' Juta ' + angkaTerbilang(n % 1000000)
  return 'Rp ' + angka.toLocaleString('id-ID')
}

export async function generateVoucherPDF(voucher: OfficeVoucher): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Colors
  const primaryColor = [112, 22, 4]     // Suka Maroon #701604
  const accentColor = [249, 115, 22]    // Suka Orange #F97316
  const darkInk = [30, 41, 59]          // Slate 800
  const lightGray = [248, 250, 252]     // Slate 50
  const borderGray = [226, 232, 240]    // Slate 200

  // 1. Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 210, 28, 'F')

  // Logo Brand
  try {
    doc.addImage(LOGO_BASE64, 'PNG', 14, 4, 20, 20)
  } catch (e) {
    console.error('Failed to add logo to voucher PDF:', e)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('SUKASHAWARMA INDONESIA', 38, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text('KANTOR PUSAT & HEAD OFFICE - DIVISI KEUANGAN & OPEX', 38, 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('FORMULIR PENGAJUAN DANA KAS', 196, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('CASH ADVANCE & EXPENSE VOUCHER', 196, 18, { align: 'right' })

  // 2. Voucher Number Highlight Box
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.roundedRect(14, 34, 182, 20, 2, 2, 'FD')

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(voucher.voucherNumber, 20, 44)

  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('NOMOR VOUCHER RESMI', 20, 50)

  doc.setTextColor(darkInk[0], darkInk[1], darkInk[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Tanggal: ${voucher.date}`, 190, 43, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Status: ${voucher.status.toUpperCase()}`, 190, 49, { align: 'right' })

  // 3. Informational Table (Divisi, Pemohon, Kategori)
  autoTable(doc, {
    startY: 58,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [['INFORMASI PENGAJUAN', 'RINCIAN DETAIL']],
    body: [
      ['Divisi / Departemen', voucher.division],
      ['Nama Pemohon / Penerima Dana', voucher.recipientName],
      ['Kategori Pengeluaran OPEX', voucher.categoryLabel],
      ['Sumber Dana Pembayaran', 'Kas Operasional Kantor Pusat (Petty Cash/Transfer)'],
    ],
    headStyles: {
      fillColor: primaryColor as [number, number, number],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      textColor: darkInk as [number, number, number],
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 122 }
    }
  })

  // 4. Amount Box
  const amountY = (doc as any).lastAutoTable.finalY + 6
  doc.setFillColor(255, 247, 237) // Amber 50
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2])
  doc.roundedRect(14, amountY, 182, 26, 2, 2, 'FD')

  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('JUMLAH UANG MUKA / DANA YANG DISERAHKAN (ESTIMASI):', 20, amountY + 7)

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`Rp ${voucher.advanceAmount.toLocaleString('id-ID')}`, 20, amountY + 16)

  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.text(`Terbilang: ${angkaTerbilang(voucher.advanceAmount)}`, 20, amountY + 22)

  // 5. Purpose / Uraian Belanja
  const reasonY = amountY + 31
  autoTable(doc, {
    startY: reasonY,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    head: [['KEPERLUAN / URAIAN PENGGUNAAN DANA']],
    body: [[voucher.reason || '-']],
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      textColor: darkInk as [number, number, number],
      fontSize: 9,
      cellPadding: 4,
      minCellHeight: 14
    }
  })

  // 6. Lembar Realisasi / Settlement Box (Untuk Diisi Setelah Belanja)
  const settleY = (doc as any).lastAutoTable.finalY + 6
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2])
  doc.roundedRect(14, settleY, 182, 38, 2, 2, 'FD')

  doc.setTextColor(darkInk[0], darkInk[1], darkInk[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('LEMBAR REALISASI NOTA & SETTLEMENT (DIISI SETELAH BELANJA):', 20, settleY + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const realVal = voucher.realizedAmount !== undefined ? `Rp ${voucher.realizedAmount.toLocaleString('id-ID')}` : 'Rp ________________________'
  const refundVal = voucher.refundAmount !== undefined ? `Rp ${voucher.refundAmount.toLocaleString('id-ID')}` : 'Rp ________________________'

  doc.text(`1. Total Riil Sesuai Struk / Invoice  : ${realVal}`, 20, settleY + 15)
  doc.text(`2. Sisa Pengembalian / (Kurang Bayar) : ${refundVal}`, 20, settleY + 22)
  doc.text('3. Tanggal Penyerahan Struk Fisik     : ___ / ___ / 2026', 20, settleY + 29)
  doc.text('4. Kelengkapan Nota                    : [  ] Ada Struk Asli   [  ] Lampiran Lengkap', 20, settleY + 35)

  // 7. Signatures / Tanda Tangan (3 Kolom)
  const signY = settleY + 44
  autoTable(doc, {
    startY: signY,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    head: [['PEMOHON / PENERIMA DANA', 'DISERAHKAN OLEH (ADMIN/KASIR)', 'MENGETAHUI / DISETUJUI (FINANCE)']],
    body: [
      ['\n\n\n\n__________________________', '\n\n\n\n__________________________', '\n\n\n\n__________________________'],
      [
        `Nama: ${voucher.recipientName}`,
        'Nama: Hesti (Admin Kasir)',
        'Nama: Nadya (Finance & Accounting)'
      ]
    ],
    headStyles: {
      textColor: darkInk as [number, number, number],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center'
    },
    bodyStyles: {
      textColor: [71, 85, 105],
      fontSize: 8,
      halign: 'center',
      cellPadding: 1
    }
  })

  // 8. Footer Note
  const finalY = (doc as any).lastAutoTable.finalY + 4
  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.text(
    '* Catatan: Struk/invoice asli wajib diserahkan kepada Admin Finance maksimal 1x24 jam setelah pembelian untuk diverifikasi ke dalam OPEX Kantor.',
    14,
    Math.min(finalY, 285)
  )

  // Save / Download
  doc.save(`Voucher_Kas_${voucher.voucherNumber}_${voucher.recipientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
}
