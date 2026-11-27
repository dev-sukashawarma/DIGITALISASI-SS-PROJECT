import * as XLSX from 'xlsx'
import type { ReconciliationSnapshotResponse } from '@/app/actions/jurnalMutasi'

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '""'
  const str = String(value).replace(/"/g, '""')
  return `"${str}"`
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function sanitizeOutletFilename(outletName: string): string {
  return outletName.replace(/[^a-zA-Z0-9]/g, '_')
}

function formatReportMetaRows(data: ReconciliationSnapshotResponse): Array<[string, string]> {
  const { outlet, period, audit_note } = data
  const rows: Array<[string, string]> = [
    ['Outlet', outlet.name],
    ['Mode Periode', period.mode === 'opname_session' ? 'Sesi Opname' : 'Rentang Tanggal'],
    [
      'Rentang Tanggal Cut-Off',
      `${new Date(period.start_date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} s/d ${new Date(period.end_date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    ],
  ]
  if (period.opname_terpilih) {
    rows.push(['Sesi Opname Terpilih', `${period.opname_terpilih.tanggal} (${period.opname_terpilih.tipe})`])
  }
  rows.push(['Waktu Unduh', new Date().toLocaleString('id-ID')])
  if (audit_note) {
    rows.push(['Catatan Audit Manajemen', audit_note])
  }
  return rows
}

export interface SummaryCardExportRow {
  kartu: string
  nilai_rp: number
  keterangan: string
}

/**
 * Menyusun daftar nilai kartu ringkasan sesuai tampilan dashboard Jurnal & Rekonsiliasi
 * (4 kartu untuk konsolidasi Semua Outlet, 8 kartu untuk outlet spesifik).
 */
export function buildSummaryCardsRows(data: ReconciliationSnapshotResponse): SummaryCardExportRow[] {
  const { outlet, totals, items } = data
  const isAll = outlet.id === 'ALL'

  const omzetNoteParts = [`${totals.order_count.toLocaleString('id-ID')} order selesai`]
  if (totals.potongan_rp > 0) {
    omzetNoteParts.push(`diskon Rp ${totals.potongan_rp.toLocaleString('id-ID')}`)
  }

  const pakaiNoteParts = ['Serapan Resep BOM · harga master']
  if (totals.total_pakai_rp_riil !== undefined && totals.total_pakai_rp_riil !== totals.total_pakai_rp) {
    pakaiNoteParts.push(`Riil (harga SJ): -Rp ${totals.total_pakai_rp_riil.toLocaleString('id-ID')}`)
  }

  const rows: SummaryCardExportRow[] = [
    {
      kartu: 'Omzet Penjualan',
      nilai_rp: totals.omzet_rp,
      keterangan: omzetNoteParts.join(' · '),
    },
  ]

  if (!isAll) {
    rows.push({
      kartu: '1. Saldo Awal',
      nilai_rp: totals.total_awal_rp,
      keterangan: 'Stok awal periode',
    })
  }

  rows.push(
    {
      kartu: isAll ? 'Masuk (Inbound)' : '2. Masuk (Inbound)',
      nilai_rp: totals.total_masuk_rp_master,
      keterangan: 'Kiriman & Pembelian',
    },
    {
      kartu: isAll ? 'Pemakaian POS' : '3. Pemakaian Menu',
      nilai_rp: totals.total_pakai_rp,
      keterangan: pakaiNoteParts.join(' · '),
    },
    {
      kartu: isAll ? 'Waste' : '4. Waste / Rusak',
      nilai_rp: totals.total_waste_rp,
      keterangan: 'Laporan kerusakan',
    }
  )

  if (!isAll) {
    const takDihitung = items.filter((i) => !i.has_opname)
    const takDihitungRp = takDihitung.reduce((acc, i) => acc + (i.stok_sistem_rp || 0), 0)
    const surplus = totals.total_selisih_rp >= 0

    const sistemNotes = ['Menurut catatan: 1 + 2 − 3 − 4']
    if (totals.total_mutasi_lain_rp && Math.abs(totals.total_mutasi_lain_rp) >= 1) {
      const sign = totals.total_mutasi_lain_rp > 0 ? '+' : '-'
      sistemNotes.push(`termasuk mutasi lain ${sign}Rp ${Math.abs(totals.total_mutasi_lain_rp).toLocaleString('id-ID')}`)
    }

    const fisikNotes = ['Jadi saldo awal sesi berikutnya']
    if (takDihitung.length > 0) {
      fisikNotes.push(`+ ${takDihitung.length} bahan tak dihitung (Rp ${takDihitungRp.toLocaleString('id-ID')} menurut catatan)`)
    }

    const selisihNotes = [`Hasil hitung − seharusnya · ${surplus ? 'lebih dari catatan' : 'kurang dari catatan'}`]
    if (takDihitung.length > 0) {
      selisihNotes.push('hanya bahan yang dihitung')
    }

    rows.push(
      {
        kartu: '5. Seharusnya Ada',
        nilai_rp: totals.total_sistem_rp,
        keterangan: sistemNotes.join(' · '),
      },
      {
        kartu: '6. Hasil Hitung Opname',
        nilai_rp: totals.total_fisik_rp,
        keterangan: fisikNotes.join(' · '),
      },
      {
        kartu: '7. Selisih',
        nilai_rp: totals.total_selisih_rp,
        keterangan: selisihNotes.join(' · '),
      }
    )
  }

  return rows
}

/**
 * Ekspor nilai kartu ringkasan Rekonsiliasi & Jurnal Bahan Baku ke file CSV.
 */
export function exportSummaryCardsToCsv(data: ReconciliationSnapshotResponse) {
  const lines: string[] = []
  lines.push('RINGKASAN KARTU REKONSILIASI & JURNAL BAHAN BAKU')
  for (const [label, value] of formatReportMetaRows(data)) {
    lines.push(`${label};${escapeCsv(value)}`)
  }
  lines.push('')
  lines.push(['Kartu Ringkasan', 'Nilai (Rp)', 'Keterangan'].map(escapeCsv).join(';'))

  for (const row of buildSummaryCardsRows(data)) {
    lines.push([row.kartu, row.nilai_rp, row.keterangan].map(escapeCsv).join(';'))
  }

  const csvContent = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const cleanOutlet = sanitizeOutletFilename(data.outlet.name)
  const dateStamp = new Date().toISOString().slice(0, 10)
  triggerBlobDownload(blob, `Ringkasan_Kartu_Rekonsiliasi_${cleanOutlet}_${dateStamp}.csv`)
}

/**
 * Ekspor nilai kartu ringkasan Rekonsiliasi & Jurnal Bahan Baku ke file Excel (.xls).
 */
export function exportSummaryCardsToXls(data: ReconciliationSnapshotResponse) {
  const aoa: Array<Array<string | number>> = [
    ['RINGKASAN KARTU REKONSILIASI & JURNAL BAHAN BAKU'],
    ...formatReportMetaRows(data),
    [],
    ['Kartu Ringkasan', 'Nilai (Rp)', 'Keterangan'],
    ...buildSummaryCardsRows(data).map((row) => [row.kartu, row.nilai_rp, row.keterangan]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 52 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Kartu')

  const buffer = XLSX.write(wb, { bookType: 'biff8', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.ms-excel' })
  const cleanOutlet = sanitizeOutletFilename(data.outlet.name)
  const dateStamp = new Date().toISOString().slice(0, 10)
  triggerBlobDownload(blob, `Ringkasan_Kartu_Rekonsiliasi_${cleanOutlet}_${dateStamp}.xls`)
}

export function exportReconciliationToCsv(data: ReconciliationSnapshotResponse) {
  const { outlet, period, totals, items, audit_note } = data
  const isAll = outlet.id === 'ALL'

  const lines: string[] = []

  // Header Laporan
  lines.push('LAPORAN JURNAL & REKONSILIASI PERGERAKAN BAHAN BAKU (AUDIT OPNAME)')
  lines.push(`Outlet;${escapeCsv(outlet.name)}`)
  lines.push(`Mode Periode;${period.mode === 'opname_session' ? 'Sesi Opname' : 'Rentang Tanggal'}`)
  lines.push(
    `Rentang Tanggal Cut-Off;${new Date(period.start_date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} s/d ${new Date(period.end_date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
  )
  if (period.opname_terpilih) {
    lines.push(`Sesi Opname Terpilih;${period.opname_terpilih.tanggal} (${period.opname_terpilih.tipe})`)
  }
  lines.push(`Waktu Unduh;${new Date().toLocaleString('id-ID')}`)
  if (audit_note) {
    lines.push(`Catatan Audit Manajemen;${escapeCsv(audit_note)}`)
  }
  lines.push('') // Baris kosong

  // Header Ringkasan Eksekutif
  lines.push('RINGKASAN VALUASI PERSEDIAAN (RUPIAH)')
  if (isAll) {
    lines.push(
      ['Total Masuk (Master)', 'Total Masuk (Riil)', 'Total Pemakaian POS', 'Total Waste']
        .map(escapeCsv)
        .join(';')
    )
    lines.push(
      [
        totals.total_masuk_rp_master,
        totals.total_masuk_rp_riil,
        totals.total_pakai_rp,
        totals.total_waste_rp,
      ]
        .map(escapeCsv)
        .join(';')
    )
  } else {
    lines.push(
      [
        'Total Nilai Awal',
        'Total Masuk (Master)',
        'Total Masuk (Riil)',
        'Total Pemakaian Jual',
        'Total Waste',
        'Total Sistem',
        'Total Fisik',
        'Total Selisih (Varian)',
        'Bahan Berselisih',
        'Anomali Skala/Satuan',
        'Kerugian Ekstrem (>=Rp50rb)',
      ]
        .map(escapeCsv)
        .join(';')
    )

    lines.push(
      [
        totals.total_awal_rp,
        totals.total_masuk_rp_master,
        totals.total_masuk_rp_riil,
        totals.total_pakai_rp,
        totals.total_waste_rp,
        totals.total_sistem_rp,
        totals.total_fisik_rp,
        totals.total_selisih_rp,
        totals.bahan_berselisih_count,
        totals.anomali_skala_count,
        totals.ekstrem_count,
      ]
        .map(escapeCsv)
        .join(';')
    )
  }

  lines.push('') // Baris kosong

  // Header Tabel Rincian Bahan
  const tableHeaders = isAll
    ? [
        'No',
        'Nama Bahan',
        'Kategori',
        'Satuan Dasar',
        'Kemasan / Satuan Kecil',
        'Harga Master (Rp)',
        'Masuk (Qty)',
        'Masuk Rp (Master)',
        'Masuk Rp (Riil)',
        'Pemakaian POS (Qty)',
        'Pemakaian POS (Rp)',
        'Waste (Qty)',
        'Waste (Rp)',
      ]
    : [
        'No',
        'Nama Bahan',
        'Kategori',
        'Satuan Dasar',
        'Kemasan / Satuan Kecil',
        'Harga Master (Rp)',
        'Saldo Awal (Qty)',
        'Saldo Awal (Rp)',
        'Masuk (Qty)',
        'Masuk Rp (Master)',
        'Masuk Rp (Riil)',
        'Pemakaian POS (Qty)',
        'Pemakaian POS (Rp)',
        'Waste (Qty)',
        'Waste (Rp)',
        'Mutasi Lain (Qty)',
        'Mutasi Lain (Rp)',
        'Stok Sistem (Qty)',
        'Stok Sistem (Rp)',
        'Stok Fisik Opname (Qty)',
        'Stok Fisik Opname (Rp)',
        'Selisih (Qty)',
        'Selisih (Rp)',
        'Diagnostik / Anomali',
      ]
  lines.push(tableHeaders.map(escapeCsv).join(';'))

  // Baris Data
  items.forEach((item, idx) => {
    const kemasanDesc = item.faktor_tampilan && item.satuan_kecil
      ? `1 ${item.satuan} = ${item.faktor_tampilan} ${item.satuan_kecil}`
      : '-'

    if (isAll) {
      const row = [
        idx + 1,
        item.nama,
        item.kategori,
        item.satuan,
        kemasanDesc,
        item.harga_beli_master,
        item.masuk_qty,
        item.masuk_rp_master,
        item.masuk_rp_riil ?? item.masuk_rp_master,
        item.pakai_qty,
        item.pakai_rp,
        item.waste_qty,
        item.waste_rp,
      ]
      lines.push(row.map(escapeCsv).join(';'))
      return
    }

    const diagMsg = item.diagnostics.map((d) => `[${d.type}] ${d.message}`).join(' | ')

    const row = [
      idx + 1,
      item.nama,
      item.kategori,
      item.satuan,
      kemasanDesc,
      item.harga_beli_master,
      item.saldo_awal_qty,
      item.saldo_awal_rp,
      item.masuk_qty,
      item.masuk_rp_master,
      item.masuk_rp_riil ?? item.masuk_rp_master,
      item.pakai_qty,
      item.pakai_rp,
      item.waste_qty,
      item.waste_rp,
      item.mutasi_lain_qty,
      item.mutasi_lain_rp,
      item.stok_sistem_qty,
      item.stok_sistem_rp,
      item.stok_fisik_qty !== null ? item.stok_fisik_qty : 'Belum diisi',
      item.stok_fisik_rp !== null ? item.stok_fisik_rp : 'Belum diisi',
      item.selisih_qty,
      item.selisih_rp,
      diagMsg || 'Normal',
    ]

    lines.push(row.map(escapeCsv).join(';'))
  })

  // Section Rincian Pemakaian Menu POS (BOM)
  if (data.menu_breakdown && data.menu_breakdown.length > 0) {
    lines.push('')
    lines.push('RINCIAN PEMAKAIAN BAHAN BAKU SETIAP MENU POS (BOM)')
    const menuHeaders = [
      'No',
      'Menu POS Terjual',
      'Porsi Terjual',
      'Status Resep BOM',
      'Nama Bahan Baku',
      'Kebutuhan Resep / Porsi',
      'Satuan Resep',
      'Total Kebutuhan Bahan',
      'Satuan Total',
    ]
    lines.push(menuHeaders.map(escapeCsv).join(';'))

    let rowNum = 1
    data.menu_breakdown.forEach((menu) => {
      if (!menu.has_recipe || menu.ingredients.length === 0) {
        lines.push(
          [
            rowNum++,
            menu.menu_item_name,
            menu.total_porsi,
            'Belum dipetakan ke resep BOM',
            '-',
            '-',
            '-',
            '-',
            '-',
          ]
            .map(escapeCsv)
            .join(';')
        )
      } else {
        menu.ingredients.forEach((ing) => {
          lines.push(
            [
              rowNum++,
              menu.menu_item_name,
              menu.total_porsi,
              'Resep Aktif Terpasang',
              ing.nama_bahan,
              ing.qty_per_porsi,
              ing.satuan,
              ing.total_kebutuhan,
              ing.satuan,
            ]
              .map(escapeCsv)
              .join(';')
          )
        })
      }
    })
  }

  const csvContent = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  const cleanOutlet = outlet.name.replace(/[^a-zA-Z0-9]/g, '_')
  link.setAttribute('download', `Rekonsiliasi_Mutasi_Stok_${cleanOutlet}_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
