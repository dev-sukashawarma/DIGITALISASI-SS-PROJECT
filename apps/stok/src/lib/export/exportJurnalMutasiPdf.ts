import { ReconciliationSnapshotResponse } from '@/app/actions/jurnalMutasi'
import { formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit'

function formatRp(val: number): string {
  return `Rp ${Math.round(val).toLocaleString('id-ID')}`
}

function formatQty(qty: number, item: any): string {
  if (qty === 0) return '0'
  return formatTriUnitSaldoFromGram(
    qty,
    item.satuan,
    item.satuan_tengah,
    item.faktor_tengah,
    item.satuan_kecil,
    item.faktor_tampilan,
    false
  )
}

/**
 * Ekspor Laporan Rekonsiliasi & Jurnal Mutasi Bahan Baku ke PDF
 * Halaman 1: Tabel Utama Mutasi (Saldo Awal, Masuk, Pakai, Waste, Sistem, Fisik, Selisih) + Tanda Tangan
 * Halaman 2+: Lampiran Rincian Pemakaian Bahan Baku per Menu POS yang terjual
 */
export async function exportReconciliationToPdf(data: ReconciliationSnapshotResponse) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  let currentY = 14

  // ── Header / Kop Resmi Suka Shawarma ──
  doc.setFillColor(242, 102, 34) // Suka Orange
  doc.rect(margin, currentY, 4, 16, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 41, 59)
  doc.text('SUKA SHAWARMA', margin + 8, currentY + 5)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(242, 102, 34)
  doc.text('LAPORAN REKONSILIASI & MUTASI BAHAN BAKU', margin + 8, currentY + 11)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Audit Alur Persediaan: Awal + Masuk - Pemakaian POS - Waste = Sistem vs Hasil Fisik', margin + 8, currentY + 16)

  // Right Metadata
  const rightX = pageWidth - margin
  doc.setFontSize(8)
  doc.setTextColor(51, 65, 85)
  doc.text(`Cabang: ${data.outlet.name}`, rightX, currentY + 4, { align: 'right' })

  let periodeLabel = `${data.period.start_date.slice(0, 10)} s/d ${data.period.end_date.slice(0, 10)}`
  if (data.period.mode === 'opname_session' && data.period.opname_terpilih) {
    periodeLabel = `Sesi Opname: ${data.period.opname_terpilih.tanggal} (${data.period.opname_terpilih.tipe})`
  } else if (data.period.opname_terpilih) {
    periodeLabel = `${data.period.start_date.slice(0, 10)} s/d ${data.period.end_date.slice(0, 10)} (Opname: ${data.period.opname_terpilih.tanggal})`
  }
  doc.text(periodeLabel, rightX, currentY + 9, { align: 'right' })

  const printDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.text(`Dicetak: ${printDate}`, rightX, currentY + 14, { align: 'right' })

  currentY += 22

  // ── 1. Tabel Utama Rekonsiliasi Mutasi ──
  const tableHeaders = [
    'No',
    'Bahan Baku',
    'Satuan',
    'Saldo Awal',
    'Masuk',
    'Pemakaian',
    'Waste',
    'Stok Sistem',
    'Stok Fisik',
    'Selisih (Qty)',
    'Selisih (Rp)',
  ]

  const tableBody = data.items.map((item, idx) => {
    const selisihQtyStr =
      item.selisih_qty === 0
        ? '0'
        : item.selisih_qty > 0
        ? `+${formatQty(item.selisih_qty, item)}`
        : `-${formatQty(Math.abs(item.selisih_qty), item)}`

    const selisihRpStr =
      item.selisih_rp === 0
        ? 'Rp 0'
        : `${item.selisih_rp > 0 ? '+' : ''}${formatRp(item.selisih_rp)}`

    return [
      idx + 1,
      item.nama,
      item.satuan,
      formatQty(item.saldo_awal_qty, item),
      formatQty(item.masuk_qty, item),
      formatQty(item.pakai_qty, item),
      formatQty(item.waste_qty, item),
      formatQty(item.stok_sistem_qty, item),
      item.stok_fisik_qty !== null ? formatQty(item.stok_fisik_qty, item) : '-',
      selisihQtyStr,
      selisihRpStr,
    ]
  })

  // Tambahkan baris total
  const totalSelisihStr = `${data.totals.total_selisih_rp > 0 ? '+' : ''}${formatRp(data.totals.total_selisih_rp)}`

  autoTable(doc, {
    head: [tableHeaders],
    body: tableBody,
    foot: [
      [
        '',
        'TOTAL NOMINAL',
        '',
        formatRp(data.totals.total_awal_rp),
        formatRp(data.totals.total_masuk_rp_master),
        formatRp(data.totals.total_pakai_rp),
        formatRp(data.totals.total_waste_rp),
        formatRp(data.totals.total_sistem_rp),
        formatRp(data.totals.total_fisik_rp),
        `${data.totals.bahan_berselisih_count} Bahan`,
        totalSelisihStr,
      ],
    ],
    startY: currentY,
    tableWidth: 'auto',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [112, 22, 4], // Suka Brown Maroon
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 26 },
      8: { halign: 'right', cellWidth: 26 },
      9: { halign: 'right', cellWidth: 26 },
      10: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
    },
    didParseCell: (hookData) => {
      // Pewarnaan selisih pada baris data dan foot
      if (hookData.section === 'body' && hookData.column.index === 10) {
        const item = data.items[hookData.row.index]
        if (item && item.selisih_rp < 0) {
          hookData.cell.styles.textColor = [185, 28, 28] // Merah
        } else if (item && item.selisih_rp > 0) {
          hookData.cell.styles.textColor = [16, 149, 106] // Hijau
        }
      }
      if (hookData.section === 'foot' && hookData.column.index === 10) {
        if (data.totals.total_selisih_rp < 0) {
          hookData.cell.styles.textColor = [185, 28, 28]
        } else if (data.totals.total_selisih_rp > 0) {
          hookData.cell.styles.textColor = [16, 149, 106]
        }
      }
    },
  })

  // ── Kolom Tanda Tangan Audit ──
  let finalY = (doc as any).lastAutoTable.finalY + 8

  // Jika ruang di bawah tabel kurang dari 35mm, tambahkan halaman baru untuk tanda tangan
  if (finalY + 32 > pageHeight) {
    doc.addPage()
    finalY = 16
  }

  const signBoxWidth = 55
  const signY = finalY
  const col1X = margin + 10
  const col2X = (pageWidth - signBoxWidth) / 2
  const col3X = pageWidth - margin - signBoxWidth - 10

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)

  // 1. Dibuat Oleh
  doc.text('Dibuat Oleh (Kitchen / Crew):', col1X, signY)
  doc.line(col1X, signY + 20, col1X + signBoxWidth, signY + 20)
  doc.text('Nama: .......................................', col1X, signY + 24)

  // 2. Diperiksa Oleh
  doc.text('Diperiksa (SPV / Leader):', col2X, signY)
  doc.line(col2X, signY + 20, col2X + signBoxWidth, signY + 20)
  doc.text('Nama: .......................................', col2X, signY + 24)

  // 3. Mengetahui
  doc.text('Mengetahui (Owner / Management):', col3X, signY)
  doc.line(col3X, signY + 20, col3X + signBoxWidth, signY + 20)
  doc.text('Nama: .......................................', col3X, signY + 24)

  // ── 2. Halaman Lampiran: Breakdown Menu Terjual & Perhitungan BOM ──
  const menuBreakdown =
    data.menu_breakdown && data.menu_breakdown.length > 0
      ? data.menu_breakdown
      : (() => {
          // Fallback dari itemsWithUsage jika payload menu_breakdown belum terisi
          const fallbackMap = new Map<string, any>()
          for (const it of itemsWithUsage) {
            for (const u of it.menu_usages) {
              let m = fallbackMap.get(u.menu_item_name)
              if (!m) {
                m = {
                  menu_item_id: u.menu_item_name,
                  menu_item_name: u.menu_item_name,
                  total_porsi: u.porsi_terjual,
                  has_recipe: true,
                  ingredients: [],
                }
                fallbackMap.set(u.menu_item_name, m)
              }
              m.ingredients.push({
                bahan_baku_id: it.id,
                nama_bahan: it.nama,
                qty_per_porsi: u.qty_per_porsi,
                satuan: u.satuan,
                total_kebutuhan: u.total_pemakaian,
              })
            }
          }
          return Array.from(fallbackMap.values())
        })()

  if (menuBreakdown.length > 0) {
    doc.addPage()
    let lampiranY = 14

    // Header Lampiran
    doc.setFillColor(242, 102, 34) // Suka Orange
    doc.rect(margin, lampiranY, 4, 14, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 41, 59)
    doc.text('LAMPIRAN: BREAKDOWN PENJUALAN MENU & PERHITUNGAN BOM (BILL OF MATERIALS)', margin + 8, lampiranY + 5)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Rincian menu POS terjual dan konsumsi standar resep (BOM) x Qty Porsi untuk outlet ${data.outlet.name}.`,
      margin + 8,
      lampiranY + 11
    )

    lampiranY += 18

    // BAGIAN 1: Rincian per Menu Terjual
    for (let mIdx = 0; mIdx < menuBreakdown.length; mIdx++) {
      const menu = menuBreakdown[mIdx]

      // Cek apakah sisa halaman cukup untuk judul menu + minimal 2 baris tabel (~30mm)
      if (lampiranY + 28 > pageHeight - margin) {
        doc.addPage()
        lampiranY = 14
      }

      // Title Bar Menu Item
      doc.setFillColor(254, 243, 199) // Soft amber / cream
      doc.roundedRect(margin, lampiranY, pageWidth - margin * 2, 7, 1.5, 1.5, 'F')
      doc.setDrawColor(245, 158, 11)
      doc.roundedRect(margin, lampiranY, pageWidth - margin * 2, 7, 1.5, 1.5, 'S')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(146, 64, 14) // Amber 800
      doc.text(
        `${mIdx + 1}. ${menu.menu_item_name.toUpperCase()}`,
        margin + 4,
        lampiranY + 4.8
      )

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(180, 83, 9)
      const porsiBadgeText = `Total Terjual: ${menu.total_porsi.toLocaleString('id-ID')} Porsi`
      doc.text(
        porsiBadgeText,
        pageWidth - margin - 4,
        lampiranY + 4.8,
        { align: 'right' }
      )

      lampiranY += 9

      if (!menu.has_recipe || menu.ingredients.length === 0) {
        // Warning jika menu belum ada resepnya
        doc.setFillColor(254, 242, 242) // Rose 50
        doc.roundedRect(margin, lampiranY, pageWidth - margin * 2, 6.5, 1, 1, 'F')
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7.5)
        doc.setTextColor(185, 28, 28) // Rose 700
        doc.text(
          `* Resep (BOM) belum dikonfigurasi di sistem untuk menu ini (terjual ${menu.total_porsi} porsi). Konsumsi bahan baku belum dapat dihitung otomatis.`,
          margin + 4,
          lampiranY + 4.2
        )
        lampiranY += 9
      } else {
        const subHeaders = [
          'No',
          'Nama Bahan Baku',
          'Standar BOM / Porsi',
          'Rumus Perhitungan (BOM x Qty Terjual)',
          'Total Kebutuhan Bahan',
        ]

        const subBody = menu.ingredients.map((ing: any, ingIdx: number) => {
          const rumus = `${ing.qty_per_porsi.toLocaleString('id-ID')} ${ing.satuan} x ${menu.total_porsi.toLocaleString('id-ID')} porsi`
          const totalStr = `${ing.total_kebutuhan.toLocaleString('id-ID')} ${ing.satuan}`
          return [
            ingIdx + 1,
            ing.nama_bahan,
            `${ing.qty_per_porsi.toLocaleString('id-ID')} ${ing.satuan}`,
            rumus,
            totalStr,
          ]
        })

        autoTable(doc, {
          head: [subHeaders],
          body: subBody,
          startY: lampiranY,
          margin: { left: margin, right: margin },
          theme: 'grid',
          styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            textColor: [30, 41, 59],
          },
          headStyles: {
            fillColor: [112, 22, 4], // Suka Maroon
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { fontStyle: 'bold', cellWidth: 55 },
            2: { halign: 'right', cellWidth: 40 },
            3: { halign: 'center' },
            4: { halign: 'right', fontStyle: 'bold', cellWidth: 45 },
          },

          alternateRowStyles: {
            fillColor: [255, 250, 245],
          },
        })

        lampiranY = (doc as any).lastAutoTable.finalY + 5
      }
    }

    // ── BAGIAN 2: Ringkasan Akumulasi Kebutuhan Bahan (Validasi Opname) ──
    if (lampiranY + 40 > pageHeight - margin) {
      doc.addPage()
      lampiranY = 14
    } else {
      lampiranY += 4
    }

    doc.setFillColor(16, 149, 106) // Emerald 600
    doc.rect(margin, lampiranY, 4, 12, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59)
    doc.text('RINGKASAN AKUMULASI KEBUTUHAN BAHAN BAKU (ACUAN VALIDASI OPNAME)', margin + 8, lampiranY + 5)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(
      'Total kebutuhan teoritis resep POS dari seluruh menu terjual. Angka ini menjadi acuan validasi kolom Pemakaian POS di Halaman 1.',
      margin + 8,
      lampiranY + 10
    )

    lampiranY += 15

    // Hitung akumulasi per bahan baku dari ingredients
    const summaryMap = new Map<string, { nama: string; satuan: string; total: number }>()
    for (const menu of menuBreakdown) {
      for (const ing of menu.ingredients) {
        const existing = summaryMap.get(ing.bahan_baku_id)
        if (existing) {
          existing.total += ing.total_kebutuhan
        } else {
          summaryMap.set(ing.bahan_baku_id, {
            nama: ing.nama_bahan,
            satuan: ing.satuan,
            total: ing.total_kebutuhan,
          })
        }
      }
    }

    const summaryList = Array.from(summaryMap.values()).sort((a, b) => a.nama.localeCompare(b.nama))

    const summaryHeaders = [
      'No',
      'Nama Bahan Baku',
      'Satuan',
      'Total Kebutuhan Teoritis (BOM POS)',
      'Acuan Status di Laporan Rekonsiliasi (Halaman 1)',
    ]

    const summaryBody = summaryList.map((s, idx) => [
      idx + 1,
      s.nama,
      s.satuan,
      `${s.total.toLocaleString('id-ID')} ${s.satuan}`,
      'Sesuai dengan kolom Pemakaian POS',
    ])

    autoTable(doc, {
      head: [summaryHeaders],
      body: summaryBody,
      startY: lampiranY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [16, 149, 106], // Emerald 600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold', cellWidth: 60 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 55 },
        4: { halign: 'left', fontStyle: 'italic', textColor: [71, 85, 105] },
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244], // Emerald 50
      },
    })
  }

  // Simpan / Unduh Dokumen PDF
  const sanitizedOutlet = data.outlet.name.replace(/[^a-zA-Z0-9]/g, '_')
  const dateStamp = data.period.end_date.slice(0, 10)
  const filename = `Laporan_Rekonsiliasi_Mutasi_${sanitizedOutlet}_${dateStamp}.pdf`

  doc.save(filename)
}

