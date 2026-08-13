import { toast } from 'sonner'
import type { PettyCashTopup } from '@/lib/types'
import { tanggalWaktu } from '@/lib/format'

function parseFinanceNote(description?: string | null) {
  if (!description) return { mainReason: '', financeNote: null }

  const splitMarker = '📌 ['
  if (description.includes(splitMarker)) {
    const parts = description.split(splitMarker)
    const mainReason = parts[0].trim()
    const financeNote = parts[1].replace(/\]$/, '').trim()
    return { mainReason, financeNote }
  }

  if (description.includes('(Catatan Finance:')) {
    const parts = description.split('(Catatan Finance:')
    const mainReason = parts[0].trim()
    const financeNote = 'Catatan Finance:' + parts[1].replace(/\)$/, '').trim()
    return { mainReason, financeNote }
  }

  return { mainReason: description, financeNote: null }
}

export function exportPettyCashCSV(data: PettyCashTopup[], filename = 'Riwayat_Petty_Cash.csv') {
  try {
    if (!data || data.length === 0) {
      toast.error('Tidak ada data untuk diunduh')
      return
    }

    const headers = ['No', 'Tanggal', 'Outlet', 'Bank', 'Nomor Rekening', 'Atas Nama', 'Nominal (Rp)', 'Alasan / Keperluan', 'Status']
    const rows = data.map((req, idx) => {
      const { mainReason } = parseFinanceNote(req.reason || req.description)
      return [
        idx + 1,
        `"${tanggalWaktu(req.created_at)}"`,
        `"${req.outlet?.name || '-'}"`,
        `"${req.bank_name || '-'}"`,
        `"${req.bank_account_number || '-'}"`,
        `"${req.bank_account_name || '-'}"`,
        req.amount,
        `"${mainReason.replace(/"/g, '""')}"`,
        `"${req.status}"`
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('File CSV berhasil diunduh!')
  } catch (err: any) {
    console.error('Export CSV error:', err)
    toast.error('Gagal mengunduh CSV: ' + err.message)
  }
}

export async function exportPettyCashPDF(data: PettyCashTopup[], filename = 'Riwayat_Petty_Cash.pdf') {
  try {
    if (!data || data.length === 0) {
      toast.error('Tidak ada data untuk diunduh')
      return
    }

    toast.info('Menyiapkan file PDF...')

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Header
    doc.setFontSize(16)
    doc.setTextColor(44, 24, 16) // suka-brown
    doc.text('LAPORAN RIWAYAT PENCAIRAN PETTY CASH', 14, 15)
    
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} | Total Rekaman: ${data.length} transaksi`, 14, 21)

    // Table
    const tableHeaders = [['No', 'Tanggal', 'Outlet', 'Rekening Tujuan', 'Nominal (Rp)', 'Alasan / Keperluan', 'Status']]
    const tableData = data.map((req, idx) => {
      const { mainReason } = parseFinanceNote(req.reason || req.description)
      const bankInfo = req.bank_name 
        ? `${req.bank_name} - ${req.bank_account_number}\na.n ${req.bank_account_name || '-'}`
        : '-'
      return [
        idx + 1,
        tanggalWaktu(req.created_at),
        req.outlet?.name || '-',
        bankInfo,
        `Rp ${req.amount.toLocaleString('id-ID')}`,
        mainReason,
        req.status
      ]
    })

    autoTable(doc, {
      startY: 26,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [242, 151, 68], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 248, 243] },
    })

    doc.save(filename)
    toast.success('File PDF berhasil diunduh!')
  } catch (err: any) {
    console.error('Export PDF error:', err)
    toast.error('Gagal mengunduh PDF: ' + err.message)
  }
}
