/* ── PDF rincian EOM Closing (Kasir & Kas Toko, OPEX) ───────────────────────
 * Halaman EOM hanya menampilkan ringkasan; seluruh rincian ada di PDF ini.
 * Semua angka diambil apa adanya dari data yang sama dengan halaman — PDF
 * tidak menghitung ulang apa pun selain menjumlahkan baris untuk total.
 */
import type { jsPDF } from 'jspdf'
import type { UserOptions } from 'jspdf-autotable'
import { itemFlags } from '@/lib/eom/kasir'
import type { OpexSummary, OpexGroup } from '@/lib/eom/opex'
import { CATEGORY_META } from '@/lib/expenseCategories'
import { type KasirResponse, SETORAN_WAJIB_MULAI, AMBANG_MERAH } from './types'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const BROWN: [number, number, number] = [59, 29, 13]
const ORANGE: [number, number, number] = [217, 83, 30]
const MARGIN = 10

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
const rpSigned = (n: number) => (Math.round(n) === 0 ? '0' : `${n > 0 ? '+' : '-'}${rp(Math.abs(n))}`)
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '-')
const shortName = (n: string) => n.replace('SUKA SHAWARMA ', '')
const tglPendek = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return `${day} ${MONTHS[m - 1].slice(0, 3)} ${y}`
}
const dayBefore = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() - 1)
  return x.toISOString().slice(0, 10)
}
const catLabel = (c: string) => (CATEGORY_META as Record<string, { label: string }>)[c]?.label ?? c

type AutoTable = (doc: jsPDF, options: UserOptions) => void

async function setup() {
  const { jsPDF } = await import('jspdf')
  const mod = await import('jspdf-autotable')
  const autoTable = (mod.default || mod) as unknown as AutoTable
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  return { doc, autoTable }
}

function lastY(doc: jsPDF) {
  return ((doc as any).lastAutoTable?.finalY as number) ?? 30
}

function ensureSpace(doc: jsPDF, y: number, need: number) {
  const h = doc.internal.pageSize.getHeight()
  if (y + need > h - 14) {
    doc.addPage()
    return 14
  }
  return y
}

function header(doc: jsPDF, opts: { judul: string; noDok: string; month: number; year: number; dicetakOleh: string }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const y = 10
  doc.setFillColor(...ORANGE)
  doc.rect(MARGIN, y, 3.5, 17, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...BROWN)
  doc.text('SUKA SHAWARMA — PT SUKA KULINER NUSANTARA', MARGIN + 6, y + 4.5)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('DIVISI FINANCE | END-OF-MONTH CLOSING', MARGIN + 6, y + 9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(`BERITA ACARA: ${opts.judul}`, MARGIN + 6, y + 13.5)

  const infoW = 86
  const infoX = pageWidth - MARGIN - infoW
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(infoX, y - 1, infoW, 18, 1.5, 1.5, 'FD')
  doc.setFontSize(7)
  const rows: [string, string][] = [
    ['No. Dokumen', opts.noDok],
    ['Periode', `${MONTHS[opts.month - 1]} ${opts.year}`],
    ['Dicetak', `${new Date().toLocaleString('id-ID')} oleh ${opts.dicetakOleh}`],
  ]
  rows.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${k}:`, infoX + 3, y + 3.2 + i * 4.3)
    doc.setFont('helvetica', 'normal')
    doc.text(v, infoX + 22, y + 3.2 + i * 4.3, { maxWidth: infoW - 24 })
  })
  return y + 22
}

function sectionTitle(doc: jsPDF, y: number, title: string, sub?: string) {
  // Judul + minimal beberapa baris tabel harus satu halaman.
  y = ensureSpace(doc, y, 45)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BROWN)
  doc.text(title, MARGIN, y)
  if (sub) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    const lines = doc.splitTextToSize(sub, doc.internal.pageSize.getWidth() - MARGIN * 2)
    doc.text(lines, MARGIN, y + 4.5)
    return y + 4.5 + lines.length * 3.4
  }
  return y + 3
}

function kpiBoxes(doc: jsPDF, y: number, items: { label: string; value: string }[]) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const gap = 4
  const w = (pageWidth - MARGIN * 2 - gap * (items.length - 1)) / items.length
  items.forEach((it, i) => {
    const x = MARGIN + i * (w + gap)
    doc.setFillColor(255, 247, 237)
    doc.setDrawColor(253, 186, 116)
    doc.roundedRect(x, y, w, 14, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(it.label.toUpperCase(), x + 3, y + 4.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BROWN)
    doc.text(it.value, x + 3, y + 11)
  })
  return y + 19
}

const TABLE_BASE: Partial<UserOptions> = {
  theme: 'grid',
  styles: { fontSize: 7, cellPadding: 1.4, lineColor: [226, 232, 240], lineWidth: 0.1, textColor: [30, 41, 59] },
  headStyles: { fillColor: [59, 29, 13], textColor: 255, fontStyle: 'bold', fontSize: 7 },
  footStyles: { fillColor: [254, 243, 199], textColor: [69, 26, 3], fontStyle: 'bold' },
  margin: { left: MARGIN, right: MARGIN },
}

function signatures(doc: jsPDF, y: number, dicetakOleh: string) {
  y = ensureSpace(doc, y + 6, 32)
  const pageWidth = doc.internal.pageSize.getWidth()
  const cols = [
    { title: 'Disiapkan oleh', name: dicetakOleh, role: 'Finance' },
    { title: 'Diperiksa oleh', name: '', role: 'Finance Controller' },
    { title: 'Disetujui oleh', name: '', role: 'Owner' },
  ]
  const w = (pageWidth - MARGIN * 2) / cols.length
  cols.forEach((c, i) => {
    const x = MARGIN + i * w
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text(c.title, x, y)
    doc.line(x, y + 18, x + w - 12, y + 18)
    doc.setFont('helvetica', 'bold')
    doc.text(c.name || '(.................................)', x, y + 22)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(c.role, x, y + 26)
  })
}

function footerPages(doc: jsPDF, label: string) {
  const n = doc.getNumberOfPages()
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(148, 163, 184)
    doc.text(label, MARGIN, h - 6)
    doc.text(`Halaman ${i} / ${n}`, w - MARGIN, h - 6, { align: 'right' })
  }
}

// ── PDF 1: Kasir & Kas Toko ──────────────────────────────────────────────────
export async function buildKasirEomPdf(d: KasirResponse, dicetakOleh: string) {
  const { doc, autoTable } = await setup()
  const { month, year, from, to } = d.period
  const noDok = `BA/SS/KSR/${year}/${String(month).padStart(2, '0')}`
  let y = header(doc, { judul: 'REKAP PENJUALAN KASIR & KAS TOKO', noDok, month, year, dicetakOleh })

  y = kpiBoxes(doc, y, [
    { label: 'Omzet kotor', value: rp(d.kpi.grossRevenue) },
    { label: 'Potongan (promo/diskon)', value: rp(d.kpi.totalDeductions) },
    { label: 'Total HPP', value: rp(d.kpi.totalHPP) },
    { label: 'Laba kotor', value: rp(d.kpi.grossProfit) },
  ])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  const cut = d.hppCutoff
  const notes = [
    `Sumber: data POS & SS Online ${tglPendek(from)} - ${tglPendek(to)} (${d.kpi.totalOrders.toLocaleString('id-ID')} order selesai), rumus sama dengan Rangkuman Penjualan (Semua Cabang, Semua Channel). Data ditarik ${new Date(d.fetchedAt).toLocaleString('id-ID')}.`,
    cut ? `HPP mengikuti tanggal order; ada pergantian HPP mulai ${tglPendek(cut)}, sehingga HPP dipecah ${tglPendek(from)} - ${tglPendek(dayBefore(cut))} dan ${tglPendek(cut)} - ${tglPendek(to)}.` : 'HPP mengikuti tanggal order; tidak ada pergantian HPP di bulan ini.',
  ]
  notes.forEach((n) => {
    const lines = doc.splitTextToSize(n, doc.internal.pageSize.getWidth() - MARGIN * 2)
    doc.text(lines, MARGIN, y)
    y += lines.length * 3.4
  })
  y += 3

  // I. Setoran per outlet
  const setoranDinilai = from >= SETORAN_WAJIB_MULAI
  y = sectionTitle(doc, y, 'I. Setoran Omzet Tunai per Outlet',
    `Omzet tunai POS -> uang laci saat tutup shift -> setoran diterima kantor. Petty cash tidak ikut disetor.${setoranDinilai ? '' : ' Bulan ini dinilai dari tutup shift; kolom setoran kantor hanya informasi (pencatatan dimulai 28 Sep 2026).'}`)
  const tot = { tunai: 0, fisik: 0, selisih: 0, luar: 0, setor: 0, belum: 0 }
  const cashBody = d.cash.map((r, i) => {
    const luar = r.omzetTunai - r.shiftExpected
    tot.tunai += r.omzetTunai; tot.fisik += r.shiftFisik; tot.selisih += r.selisihKasir
    tot.luar += luar; tot.setor += r.setoranDiterima; tot.belum += r.shiftBelumTutup
    return [
      String(i + 1),
      `${shortName(r.outletName)}${r.outletType === 'mitra' ? ' (Mitra)' : ''}`,
      rp(r.omzetTunai), rp(r.shiftFisik), rpSigned(r.selisihKasir), rpSigned(luar),
      `${r.shiftCount}${r.shiftBelumTutup ? ` (${r.shiftBelumTutup} blm tutup)` : ''}${r.shiftBerjalan ? ` (${r.shiftBerjalan} berjalan)` : ''}`,
      r.setoranCount ? `${rp(r.setoranDiterima)} (${r.setoranCount}x)` : '-',
      setoranDinilai ? rpSigned(r.shiftFisik - r.setoranDiterima) : '-',
    ]
  })
  const merahIdx = new Set(d.cash.map((r, i) =>
    Math.abs(r.selisihKasir) > AMBANG_MERAH || r.shiftBelumTutup > 0 ||
    (setoranDinilai && Math.abs(r.shiftFisik - r.setoranDiterima) > AMBANG_MERAH) ? i : -1))
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head: [['No', 'Outlet', 'Omzet tunai POS', 'Uang laci (tutup shift)', 'Selisih kasir', 'Tunai di luar shift', 'Shift', 'Setoran diterima', 'Belum disetor']],
    body: cashBody,
    foot: [['', 'TOTAL', rp(tot.tunai), rp(tot.fisik), rpSigned(tot.selisih), rpSigned(tot.luar), tot.belum ? `${tot.belum} blm tutup` : '', rp(tot.setor), setoranDinilai ? rpSigned(tot.fisik - tot.setor) : '-']],
    columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
    didParseCell: (h) => {
      if (h.section === 'body' && merahIdx.has(h.row.index)) h.cell.styles.fillColor = [254, 226, 226]
    },
  })
  y = lastY(doc) + 3
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Baris merah: selisih kasir > ${rp(AMBANG_MERAH)}, ada shift hari sebelumnya belum ditutup${setoranDinilai ? ', atau setoran tidak sama dengan uang laci' : ''}. Shift hari ini yang masih berjalan tidak dihitung. "Tunai di luar shift" = order tunai POS yang tidak tercakup shift yang sudah ditutup.`, MARGIN, y)
  y += 7

  // II. Shift berselisih / belum ditutup
  y = sectionTitle(doc, y, 'II. Shift Berselisih atau Belum Ditutup', `${d.shiftDetails.length} shift. Selisih = uang laci - omzet tunai shift (dicatat kasir saat tutup shift).`)
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head: [['Tanggal', 'Outlet', 'Kasir', 'Omzet tunai shift', 'Uang laci', 'Selisih', 'Status', 'Catatan kasir']],
    body: d.shiftDetails.length
      ? d.shiftDetails.map((s) => [
          tglPendek(s.tanggal), shortName(s.outlet), s.kasir, rp(s.expected), rp(s.fisik), rpSigned(s.selisih),
          s.status === 'closed' ? 'Ditutup' : 'BELUM DITUTUP', s.catatan || '-',
        ])
      : [[{ content: 'Tidak ada shift berselisih atau belum ditutup.', colSpan: 8, styles: { halign: 'center' } }]],
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 7: { cellWidth: 70 } },
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 6 && String(h.cell.raw) === 'BELUM DITUTUP') h.cell.styles.textColor = [185, 28, 28]
    },
  })
  y = lastY(doc) + 8

  // III. Ringkasan per channel
  const labelA = cut ? `HPP ${tglPendek(from).slice(0, -5)}-${tglPendek(dayBefore(cut)).slice(0, -5)}` : 'HPP'
  const labelB = cut ? `HPP ${tglPendek(cut).slice(0, -5)}-${tglPendek(to).slice(0, -5)}` : null
  y = sectionTitle(doc, y, 'III. Omzet, Potongan & HPP per Channel', 'Jumlah seluruh channel sama dengan kartu Rangkuman Penjualan di atas. Kolom Hermes (rekonsiliasi platform) menyusul setelah Hermes mengirim data.')
  const ct = { rev: 0, pot: 0, a: 0, b: 0, laba: 0 }
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head: [['Channel', 'Omzet kotor', 'Potongan', labelA, ...(labelB ? [labelB] : []), 'Total HPP', 'Laba kotor', 'Food cost', 'Menu bertanda']],
    body: d.channels.map((c) => {
      ct.rev += c.revenue; ct.pot += c.potongan; ct.a += c.hppA; ct.b += c.hppB; ct.laba += c.labaKotor
      const flagged = c.items.filter((i) => itemFlags(i, !!cut).length > 0).length
      return [c.label, rp(c.revenue), rp(c.potongan), rp(c.hppA), ...(labelB ? [rp(c.hppB)] : []), rp(c.hppA + c.hppB), rp(c.labaKotor), pct(c.hppA + c.hppB, c.revenue), flagged ? String(flagged) : '-']
    }),
    foot: [['TOTAL', rp(ct.rev), rp(ct.pot), rp(ct.a), ...(labelB ? [rp(ct.b)] : []), rp(ct.a + ct.b), rp(ct.laba), pct(ct.a + ct.b, ct.rev), '']],
    columnStyles: Object.fromEntries(Array.from({ length: labelB ? 9 : 8 }, (_, i) => [i, { halign: i === 0 ? 'left' : 'right' }])) as any,
  })
  y = lastY(doc) + 8

  // IV. Rincian menu per channel
  y = sectionTitle(doc, y, 'IV. Rincian Menu per Channel',
    'HPP/porsi = total HPP dibagi qty pada periodenya. Menu outlet mitra dipisah barisnya (HPP mitra = HPP x 1,1). Baris kuning = perlu dicek: HPP kosong, atau HPP/porsi tidak berubah padahal ada pergantian HPP.')
  for (const c of d.channels) {
    y = ensureSpace(doc, y, 24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...ORANGE)
    doc.text(`${c.label} — omzet ${rp(c.revenue)} · HPP ${rp(c.hppA + c.hppB)} · ${c.items.length} menu`, MARGIN, y)
    const unit = (hpp: number, qty: number) => (qty > 0 ? rp(hpp / qty) : '-')
    const flaggedRows = new Set<number>()
    const body = c.items.map((i, idx) => {
      const flags = itemFlags(i, !!cut)
      if (flags.length) flaggedRows.add(idx)
      return [
        i.name,
        i.qtyA.toLocaleString('id-ID'), unit(i.hppA, i.qtyA),
        ...(labelB ? [i.qtyB.toLocaleString('id-ID'), unit(i.hppB, i.qtyB)] : []),
        rp(i.hppA + i.hppB), rp(i.revenue), rp(i.potongan), rp(i.labaKotor), pct(i.hppA + i.hppB, i.revenue),
        flags.join(', ') || '',
      ]
    })
    const qa = labelB ? `Qty ${labelA.replace('HPP ', '')}` : 'Qty'
    autoTable(doc, {
      ...TABLE_BASE,
      startY: y + 2,
      head: [['Menu', qa, 'HPP/porsi', ...(labelB ? [`Qty ${labelB.replace('HPP ', '')}`, 'HPP/porsi'] : []), 'Total HPP', 'Omzet', 'Potongan', 'Laba kotor', 'Food cost', 'Tanda']],
      body,
      styles: { ...TABLE_BASE.styles, fontSize: 6.5 },
      columnStyles: Object.fromEntries(Array.from({ length: labelB ? 11 : 9 }, (_, i) => [i, { halign: i === 0 || i === (labelB ? 10 : 8) ? 'left' : 'right' }])) as any,
      didParseCell: (h) => {
        if (h.section === 'body' && flaggedRows.has(h.row.index)) h.cell.styles.fillColor = [254, 249, 195]
      },
    })
    y = lastY(doc) + 7
  }

  signatures(doc, y, dicetakOleh)
  footerPages(doc, `${noDok} · Berita Acara Kasir & Kas Toko ${MONTHS[month - 1]} ${year}`)
  return { doc, filename: `BA_Kasir_KasToko_${MONTHS[month - 1]}_${year}.pdf` }
}

export async function generateKasirEomPdf(d: KasirResponse, dicetakOleh: string) {
  const { doc, filename } = await buildKasirEomPdf(d, dicetakOleh)
  doc.save(filename)
}

// ── PDF 2: OPEX ──────────────────────────────────────────────────────────────
const GROUP_LABEL: Record<OpexGroup, string> = { global: 'Global (Pusat)', internal: 'Internal', mitra: 'Mitra' }

type OpexMeta = { month: number; year: number; prevLabel: string; dicetakOleh: string }

export async function buildOpexEomPdf(s: OpexSummary, meta: OpexMeta) {
  const { doc, autoTable } = await setup()
  const { month, year, prevLabel, dicetakOleh } = meta
  const noDok = `BA/SS/OPX/${year}/${String(month).padStart(2, '0')}`
  let y = header(doc, { judul: 'REKAP BIAYA OPERASIONAL (OPEX)', noDok, month, year, dicetakOleh })

  const groups: OpexGroup[] = ['global', 'internal', 'mitra']
  y = kpiBoxes(doc, y, [
    ...groups.map((g) => ({ label: `OPEX ${GROUP_LABEL[g]}`, value: rp(s.totals[g].total) })),
    { label: 'Total OPEX', value: rp(groups.reduce((a, g) => a + s.totals[g].total, 0)) },
  ])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  const missing = groups.reduce((a, g) => a + s.totals[g].missingCount, 0)
  doc.text(`Sumber: data Pengeluaran (sama dengan halaman Pengeluaran & Rekap Bulanan). Pembanding kelengkapan: ${prevLabel}. ${missing === 0 ? 'Semua kategori bulan lalu sudah terisi.' : `${missing} kategori bulan lalu belum diisi bulan ini.`}`, MARGIN, y, { maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2 })
  y += 8

  // I. Ringkasan per kelompok
  y = sectionTitle(doc, y, 'I. Ringkasan per Kelompok')
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y + 1,
    head: [['Kelompok', 'Jumlah unit', 'Bulan ini', prevLabel, 'Selisih', 'Kategori belum diisi']],
    body: groups.map((g) => {
      const t = s.totals[g]
      return [GROUP_LABEL[g], String(t.unitCount), rp(t.total), rp(t.totalPrev), rpSigned(t.total - t.totalPrev), String(t.missingCount)]
    }),
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' } },
  })
  y = lastY(doc) + 8

  // II. Kelengkapan per outlet
  y = sectionTitle(doc, y, 'II. Kelengkapan per Outlet', 'Kategori "belum diisi" = terisi bulan lalu tetapi belum ada bulan ini.')
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head: [['Kelompok', 'Outlet / Unit', 'Bulan ini', prevLabel, 'Selisih', 'Belum diisi', 'Kategori baru']],
    body: groups.flatMap((g) => s.units.filter((u) => u.group === g).map((u) => [
      GROUP_LABEL[g], shortName(u.unitName), rp(u.total), rp(u.totalPrev), rpSigned(u.total - u.totalPrev),
      u.missing.map(catLabel).join(', ') || 'Lengkap', u.added.map(catLabel).join(', ') || '-',
    ])),
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { cellWidth: 60 }, 6: { cellWidth: 45 } },
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 5 && String(h.cell.raw) !== 'Lengkap') h.cell.styles.fillColor = [254, 249, 195]
    },
  })
  y = lastY(doc) + 8

  // III. Rincian kategori per unit
  y = sectionTitle(doc, y, 'III. Rincian Kategori per Outlet / Unit')
  for (const g of groups) {
    for (const u of s.units.filter((x) => x.group === g)) {
      const cats = Array.from(new Set([...Object.keys(u.byCategory), ...Object.keys(u.byCategoryPrev)]))
        .sort((a, b) => (u.byCategory[b] ?? 0) - (u.byCategory[a] ?? 0))
      y = ensureSpace(doc, y, 22)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...ORANGE)
      doc.text(`${shortName(u.unitName)} (${GROUP_LABEL[g]}) — ${rp(u.total)}`, MARGIN, y)
      autoTable(doc, {
        ...TABLE_BASE,
        startY: y + 2,
        head: [['Kategori', 'Bulan ini', prevLabel, 'Selisih', 'Keterangan']],
        body: cats.map((c) => {
          const now = u.byCategory[c] ?? 0
          const prev = u.byCategoryPrev[c] ?? 0
          const ket = u.missing.includes(c) ? 'BELUM DIISI' : u.added.includes(c) ? 'Kategori baru' : ''
          return [catLabel(c), now ? rp(now) : '-', prev ? rp(prev) : '-', rpSigned(now - prev), ket]
        }),
        foot: [['TOTAL', rp(u.total), rp(u.totalPrev), rpSigned(u.total - u.totalPrev), '']],
        styles: { ...TABLE_BASE.styles, fontSize: 6.5 },
        tableWidth: 180,
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        didParseCell: (h) => {
          if (h.section === 'body' && String((h.row.raw as any[])[4]) === 'BELUM DIISI') h.cell.styles.fillColor = [254, 249, 195]
        },
      })
      y = lastY(doc) + 6
    }
  }

  signatures(doc, y, dicetakOleh)
  footerPages(doc, `${noDok} · Berita Acara OPEX ${MONTHS[month - 1]} ${year}`)
  return { doc, filename: `BA_OPEX_${MONTHS[month - 1]}_${year}.pdf` }
}

export async function generateOpexEomPdf(s: OpexSummary, meta: OpexMeta) {
  const { doc, filename } = await buildOpexEomPdf(s, meta)
  doc.save(filename)
}
