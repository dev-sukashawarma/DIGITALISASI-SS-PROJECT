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
import type { EomOutlet } from '@/lib/eom/kasir'
import { prepareBadgeImages, drawBadge } from './pdfChannelBadge'

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
  showFoot: 'lastPage',
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
  const badges = await prepareBadgeImages([
    ...d.channels.map((c) => c.key),
    ...(d.outletDetails ?? []).flatMap((o) => o.channels.map((c) => c.key)),
  ])
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
  const konfirmasi = d.konfirmasiSetoran
  const setoranDinilai = from >= SETORAN_WAJIB_MULAI || !!konfirmasi
  y = sectionTitle(doc, y, 'I. Setoran Omzet Tunai per Outlet',
    `Omzet tunai POS -> uang laci saat tutup shift -> setoran diterima kantor. Petty cash tidak ikut disetor.${
      konfirmasi ? ` Setoran ${konfirmasi.label} telah DIKONFIRMASI VALID oleh Admin Finance dan dihitung sudah disetor; setoran penjualan sesudahnya diambil dari catatan tab Setoran.` : ''
    }${setoranDinilai ? '' : ' Selisih bulan ini dinilai dari tutup shift.'}`)
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
      r.setoranDiterima > 0
        ? `${rp(r.setoranDiterima)}${r.setoranTerkonfirmasi > 0 && r.setoranSistem > 0 ? ` (konf. ${rp(r.setoranTerkonfirmasi)} + sistem ${rp(r.setoranSistem)})` : r.setoranTerkonfirmasi > 0 ? ' (dikonfirmasi)' : ''}`
        : '-',
      !setoranDinilai ? '-' : Math.abs(r.shiftFisik - r.setoranDiterima) < 1 ? 'LUNAS' : rpSigned(r.shiftFisik - r.setoranDiterima),
    ]
  })
  const merahIdx = new Set(d.cash.map((r, i) =>
    Math.abs(r.selisihKasir) > AMBANG_MERAH || r.shiftBelumTutup > 0 ||
    (setoranDinilai && Math.abs(r.shiftFisik - r.setoranDiterima) > AMBANG_MERAH) ? i : -1))
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head: [['No', 'Outlet', 'Omzet tunai POS', 'Uang laci (tutup shift)', 'Selisih kasir', 'Tunai di luar shift', 'Shift', 'Sudah disetor', 'Belum disetor']],
    body: cashBody,
    foot: [['', 'TOTAL', rp(tot.tunai), rp(tot.fisik), rpSigned(tot.selisih), rpSigned(tot.luar), tot.belum ? `${tot.belum} blm tutup` : '', rp(tot.setor), setoranDinilai ? rpSigned(tot.fisik - tot.setor) : '-']],
    columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
    didParseCell: (h) => {
      if (h.section === 'body' && merahIdx.has(h.row.index)) h.cell.styles.fillColor = [254, 226, 226]
      if (h.section === 'body' && h.column.index === 8 && String(h.cell.raw) === 'LUNAS') {
        h.cell.styles.textColor = [4, 120, 87]
        h.cell.styles.fontStyle = 'bold'
      }
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
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 0) {
        h.cell.styles.cellPadding = { top: 1.6, bottom: 1.6, left: 8, right: 1.4 }
        h.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawCell: (h) => {
      if (h.section === 'body' && h.column.index === 0) {
        const size = 4.2
        drawBadge(doc, d.channels[h.row.index].key, h.cell.x + 1.8, h.cell.y + (h.cell.height - size) / 2, size, badges)
      }
    },
  })
  y = lastY(doc) + 8

  // IV. Laporan per outlet (Internal, lalu Mitra, lalu SS Online)
  if (d.outletDetails && d.outletDetails.length > 0) {
    y = outletSection(doc, autoTable, d, labelA, labelB, badges)
  }

  signatures(doc, y, dicetakOleh)
  footerPages(doc, `${noDok} · Berita Acara Kasir & Kas Toko ${MONTHS[month - 1]} ${year}`)
  return { doc, filename: `BA_Kasir_KasToko_${MONTHS[month - 1]}_${year}.pdf` }
}

export async function generateKasirEomPdf(d: KasirResponse, dicetakOleh: string) {
  const { doc, filename } = await buildKasirEomPdf(d, dicetakOleh)
  doc.save(filename)
}

// ── Bagian IV: laporan per outlet ────────────────────────────────────────────
const OUTLET_GROUPS: { type: string; judul: string; hppNote: string }[] = [
  { type: 'outlet', judul: 'Outlet Internal', hppNote: '' },
  { type: 'mitra', judul: 'Outlet Mitra', hppNote: ' (+10%)' },
  { type: 'online', judul: 'SS Online', hppNote: '' },
]
const groupOf = (o: EomOutlet) => (o.outletType === 'mitra' ? 'mitra' : o.outletType === 'online' ? 'online' : 'outlet')

function outletSection(doc: jsPDF, autoTable: AutoTable, d: KasirResponse, labelA: string, labelB: string | null, badges: Map<string, string>) {
  const outlets = d.outletDetails ?? []
  const cut = d.hppCutoff
  doc.addPage()
  let y = sectionTitle(doc, 14, 'IV. Laporan per Outlet',
    'Gross revenue, item terjual, harga jual, dan HPP per channel untuk tiap outlet. Harga jual = omzet kotor dibagi qty (rata-rata). Outlet mitra: HPP sudah termasuk tambahan 10% sesuai aturan HPP mitra.')

  // Ringkasan per kelompok
  for (const g of OUTLET_GROUPS) {
    const rows = outlets.filter((o) => groupOf(o) === g.type)
    if (rows.length === 0) continue
    const t = { rev: 0, pot: 0, a: 0, b: 0, laba: 0 }
    rows.forEach((o) => { t.rev += o.revenue; t.pot += o.potongan; t.a += o.hppA; t.b += o.hppB; t.laba += o.labaKotor })
    y = ensureSpace(doc, y, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...ORANGE)
    doc.text(`${g.judul} (${rows.length})`, MARGIN, y + 2)
    autoTable(doc, {
      ...TABLE_BASE,
      startY: y + 4,
      head: [['Outlet', 'Gross revenue', 'Potongan', `${labelA}${g.hppNote}`, ...(labelB ? [`${labelB}${g.hppNote}`] : []), `Total HPP${g.hppNote}`, 'Laba kotor', 'Food cost']],
      body: rows.map((o) => [shortName(o.outletName), rp(o.revenue), rp(o.potongan), rp(o.hppA), ...(labelB ? [rp(o.hppB)] : []), rp(o.hppA + o.hppB), rp(o.labaKotor), pct(o.hppA + o.hppB, o.revenue)]),
      foot: [[`SUBTOTAL ${g.judul.toUpperCase()}`, rp(t.rev), rp(t.pot), rp(t.a), ...(labelB ? [rp(t.b)] : []), rp(t.a + t.b), rp(t.laba), pct(t.a + t.b, t.rev)]],
      columnStyles: Object.fromEntries(Array.from({ length: labelB ? 8 : 7 }, (_, i) => [i, { halign: i === 0 ? 'left' : 'right' }])) as any,
    })
    y = lastY(doc) + 7
  }

  // Satu halaman per outlet
  const unit = (hpp: number, qty: number) => (qty > 0 ? rp(hpp / qty) : '-')
  for (const g of OUTLET_GROUPS) {
    for (const o of outlets.filter((x) => groupOf(x) === g.type)) {
      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...BROWN)
      doc.text(o.outletName, MARGIN, 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`${g.judul}${g.type === 'mitra' ? ' — HPP termasuk +10%' : ''}`, MARGIN, 18.5)
      const py = kpiBoxes(doc, 22, [
        { label: 'Gross revenue', value: rp(o.revenue) },
        { label: 'Potongan', value: rp(o.potongan) },
        { label: `Total HPP${g.hppNote}`, value: rp(o.hppA + o.hppB) },
        { label: 'Laba kotor', value: rp(o.labaKotor) },
        { label: 'Food cost', value: pct(o.hppA + o.hppB, o.revenue) },
      ])

      const cols = labelB ? 10 : 9
      const body: any[] = []
      const flagged = new Set<number>()
      const channelRows = new Set<number>()
      const subtotalRows = new Set<number>()
      const spacerRows = new Set<number>()
      const channelKeyAt = new Map<number, string>()
      o.channels.forEach((c, ci) => {
        if (ci > 0) {
          spacerRows.add(body.length)
          body.push([{ content: '', colSpan: cols }])
        }
        channelRows.add(body.length)
        channelKeyAt.set(body.length, c.key)
        body.push([{ content: `${c.label}  —  ${c.qty.toLocaleString('id-ID')} porsi  ·  omzet ${rp(c.revenue)}  ·  HPP ${rp(c.hppA + c.hppB)}  ·  food cost ${pct(c.hppA + c.hppB, c.revenue)}`, colSpan: cols }])
        for (const i of c.items) {
          const qty = i.qtyA + i.qtyB
          const flags = (itemFlags(i, !!cut) ?? [])
          if (flags.length) flagged.add(body.length)
          body.push([
            i.name,
            qty.toLocaleString('id-ID'),
            qty > 0 ? rp(i.revenue / qty) : '-',
            rp(i.revenue),
            unit(i.hppA, i.qtyA),
            ...(labelB ? [unit(i.hppB, i.qtyB)] : []),
            rp(i.hppA + i.hppB),
            rp(i.labaKotor),
            pct(i.hppA + i.hppB, i.revenue),
            flags.join(', '),
          ])
        }
        subtotalRows.add(body.length)
        body.push([`Subtotal ${c.label}`, c.qty.toLocaleString('id-ID'), '', rp(c.revenue), '', ...(labelB ? [''] : []), rp(c.hppA + c.hppB), rp(c.labaKotor), pct(c.hppA + c.hppB, c.revenue), ''])
      })
      const hA = labelB ? `HPP/porsi ${labelA.replace('HPP ', '')}${g.hppNote}` : `HPP/porsi${g.hppNote}`
      autoTable(doc, {
        ...TABLE_BASE,
        startY: py,
        head: [['Menu', 'Qty', 'Harga jual', 'Omzet', hA, ...(labelB ? [`HPP/porsi ${labelB.replace('HPP ', '')}${g.hppNote}`] : []), `Total HPP${g.hppNote}`, 'Laba kotor', 'Food cost', 'Tanda']],
        body,
        foot: [['TOTAL OUTLET', o.qty.toLocaleString('id-ID'), '', rp(o.revenue), '', ...(labelB ? [''] : []), rp(o.hppA + o.hppB), rp(o.labaKotor), pct(o.hppA + o.hppB, o.revenue), '']],
        styles: { ...TABLE_BASE.styles, fontSize: 6.5 },
        margin: { left: MARGIN, right: MARGIN, top: 20 },
        columnStyles: Object.fromEntries(Array.from({ length: cols }, (_, i) => [i, { halign: i === 0 || i === cols - 1 ? 'left' : 'right' }])) as any,
        didDrawCell: (h) => {
          if (h.section !== 'body' || !channelRows.has(h.row.index) || h.column.index !== 0) return
          // divider tebal di atas tiap channel + logo channel
          doc.setDrawColor(...ORANGE)
          doc.setLineWidth(0.6)
          doc.line(h.cell.x, h.cell.y, h.cell.x + h.cell.width, h.cell.y)
          doc.setLineWidth(0.1)
          const size = 5
          drawBadge(doc, channelKeyAt.get(h.row.index)!, h.cell.x + 2, h.cell.y + (h.cell.height - size) / 2, size, badges)
        },
        didDrawPage: (h) => {
          if (h.pageNumber > 1) {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(...BROWN)
            doc.text(`${o.outletName} (lanjutan)`, MARGIN, 14)
          }
        },
        didParseCell: (h) => {
          if (h.section !== 'body') return
          if (spacerRows.has(h.row.index)) {
            h.cell.styles.fillColor = [255, 255, 255]
            h.cell.styles.lineWidth = 0
            h.cell.styles.minCellHeight = 3.5
            h.cell.styles.cellPadding = 0
          } else if (channelRows.has(h.row.index)) {
            h.cell.styles.fillColor = [255, 237, 213]
            h.cell.styles.fontStyle = 'bold'
            h.cell.styles.fontSize = 7.5
            h.cell.styles.textColor = [124, 45, 18]
            h.cell.styles.halign = 'left'
            h.cell.styles.minCellHeight = 7
            h.cell.styles.valign = 'middle'
            h.cell.styles.cellPadding = { top: 1.5, bottom: 1.5, left: 9, right: 1.4 }
          } else if (subtotalRows.has(h.row.index)) {
            h.cell.styles.fontStyle = 'bold'
            h.cell.styles.fillColor = [248, 250, 252]
          } else if (flagged.has(h.row.index)) {
            h.cell.styles.fillColor = [254, 249, 195]
          }
        },
      })
    }
  }
  return lastY(doc) + 8
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
  const totalOpexMurni = groups.reduce((a, g) => a + s.totals[g].total, 0)
  const totalBahanBaku = groups.reduce((a, g) => a + s.totals[g].nonOpexTotal, 0)

  y = kpiBoxes(doc, y, [
    ...groups.map((g) => ({ label: `OPEX ${GROUP_LABEL[g]}`, value: rp(s.totals[g].total) })),
    { label: 'Total OPEX Murni', value: rp(totalOpexMurni) },
  ])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  const missing = groups.reduce((a, g) => a + s.totals[g].missingCount, 0)
  const exempted = groups.reduce((a, g) => a + s.totals[g].exemptedCount, 0)
  
  const statusNote = missing === 0
    ? `Semua kategori bulan lalu sudah terisi / diverifikasi nihil (${exempted} nihil).`
    : `${missing} kategori bulan lalu belum diisi bulan ini (${exempted} telah diverifikasi nihil).`
  const nonOpexNote = totalBahanBaku > 0 ? ` Belanja bahan baku darurat kas toko (${rp(totalBahanBaku)}) dicatat terpisah (Non-OPEX).` : ''

  doc.text(`Sumber: data Pengeluaran. Pembanding kelengkapan: ${prevLabel}. ${statusNote}${nonOpexNote}`, MARGIN, y, { maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2 })
  y += 8

  // I. Ringkasan per kelompok
  y = sectionTitle(doc, y, 'I. Ringkasan per Kelompok')
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y + 1,
    head: [['Kelompok', 'Jumlah unit', 'OPEX Murni', prevLabel, 'Selisih', 'Bahan Baku', 'Belum Diisi', 'Nihil']],
    body: groups.map((g) => {
      const t = s.totals[g]
      return [
        GROUP_LABEL[g],
        String(t.unitCount),
        rp(t.total),
        rp(t.totalPrev),
        rpSigned(t.total - t.totalPrev),
        t.nonOpexTotal > 0 ? rp(t.nonOpexTotal) : '-',
        String(t.missingCount),
        String(t.exemptedCount),
      ]
    }),
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'center' },
      7: { halign: 'center' },
    },
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 6 && Number(h.cell.raw) > 0) {
        h.cell.styles.fillColor = [254, 249, 195]
        h.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = lastY(doc) + 8

  // II. Kelengkapan per outlet
  y = sectionTitle(doc, y, 'II. Kelengkapan per Outlet', 'Kategori "belum diisi" = terisi bulan lalu tetapi belum ada bulan ini & belum diverifikasi nihil.')
  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head: [['Kelompok', 'Outlet / Unit', 'OPEX Murni', prevLabel, 'Selisih', 'Bahan Baku', 'Belum Diisi', 'Nihil']],
    body: groups.flatMap((g) => s.units.filter((u) => u.group === g).map((u) => [
      GROUP_LABEL[g],
      shortName(u.unitName),
      rp(u.total),
      rp(u.totalPrev),
      rpSigned(u.total - u.totalPrev),
      u.nonOpexTotal > 0 ? rp(u.nonOpexTotal) : '-',
      u.missing.map(catLabel).join(', ') || 'Lengkap',
      u.exempted.map(catLabel).join(', ') || '-',
    ])),
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { cellWidth: 50 },
      7: { cellWidth: 40 },
    },
    didParseCell: (h) => {
      if (h.section === 'body' && h.column.index === 6 && String(h.cell.raw) !== 'Lengkap') {
        h.cell.styles.fillColor = [254, 249, 195]
      }
      if (h.section === 'body' && h.column.index === 7 && String(h.cell.raw) !== '-') {
        h.cell.styles.fillColor = [240, 253, 244]
      }
    },
  })
  y = lastY(doc) + 8

  // III. Rincian kategori per unit (Dikelompokkan per Kluster Beban)
  y = sectionTitle(doc, y, 'III. Rincian Kategori per Outlet / Unit (Berdasarkan Kluster Beban)')
  for (const g of groups) {
    for (const u of s.units.filter((x) => x.group === g)) {
      y = ensureSpace(doc, y, 25)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...ORANGE)
      const subTitle = u.nonOpexTotal > 0
        ? `${shortName(u.unitName)} (${GROUP_LABEL[g]}) — OPEX Murni: ${rp(u.total)} | Bahan Baku: ${rp(u.nonOpexTotal)}`
        : `${shortName(u.unitName)} (${GROUP_LABEL[g]}) — OPEX Murni: ${rp(u.total)}`
      doc.text(subTitle, MARGIN, y)

      const bodyRows: (string | number)[][] = []
      const clusterHeaderRows = new Set<number>()
      const subtotalRows = new Set<number>()
      const flaggedRows = new Set<number>()
      const nihilRows = new Set<number>()

      u.clusters.forEach((cl) => {
        // Baris Header Kluster
        const headerIdx = bodyRows.length
        clusterHeaderRows.add(headerIdx)
        bodyRows.push([`KLUSTER: ${cl.label.toUpperCase()}`, '', '', '', ''])

        // Baris-baris Kategori di dalam Kluster
        cl.categories.forEach((cat) => {
          const rowIdx = bodyRows.length
          let ket = ''
          if (cat.status === 'nihil') {
            ket = `NIHIL (${cat.exemption?.quickReason || 'Diverifikasi'})`
            nihilRows.add(rowIdx)
          } else if (cat.status === 'missing') {
            ket = 'BELUM DIISI'
            flaggedRows.add(rowIdx)
          } else if (cat.status === 'added') {
            ket = 'Kategori Baru'
          }

          bodyRows.push([
            `  ${cat.label}`,
            cat.current ? rp(cat.current) : '-',
            cat.previous ? rp(cat.previous) : '-',
            rpSigned(cat.diff),
            ket,
          ])
        })

        // Baris Subtotal Kluster
        const subIdx = bodyRows.length
        subtotalRows.add(subIdx)
        bodyRows.push([
          `Subtotal ${cl.label}`,
          rp(cl.total),
          rp(cl.totalPrev),
          rpSigned(cl.diff),
          cl.isNonOpex ? '(Non-OPEX)' : '',
        ])
      })

      autoTable(doc, {
        ...TABLE_BASE,
        startY: y + 2,
        head: [['Kategori & Kluster Beban', 'Bulan ini', prevLabel, 'Selisih', 'Keterangan']],
        body: bodyRows,
        foot: [
          ['TOTAL OPEX MURNI', rp(u.total), rp(u.totalPrev), rpSigned(u.total - u.totalPrev), ''],
          ...(u.nonOpexTotal > 0 ? [['TOTAL BAHAN BAKU (NON-OPEX)', rp(u.nonOpexTotal), rp(u.nonOpexTotalPrev), rpSigned(u.nonOpexTotal - u.nonOpexTotalPrev), '']] : []),
        ],
        styles: { ...TABLE_BASE.styles, fontSize: 6.5 },
        tableWidth: 180,
        columnStyles: {
          0: { cellWidth: 70 },
          1: { halign: 'right', cellWidth: 28 },
          2: { halign: 'right', cellWidth: 28 },
          3: { halign: 'right', cellWidth: 24 },
          4: { cellWidth: 30 },
        },
        didParseCell: (h) => {
          if (h.section !== 'body') return
          if (clusterHeaderRows.has(h.row.index)) {
            h.cell.styles.fillColor = [255, 237, 213]
            h.cell.styles.fontStyle = 'bold'
            h.cell.styles.textColor = [124, 45, 18]
          } else if (subtotalRows.has(h.row.index)) {
            h.cell.styles.fillColor = [248, 250, 252]
            h.cell.styles.fontStyle = 'bold'
          } else if (flaggedRows.has(h.row.index)) {
            h.cell.styles.fillColor = [254, 249, 195]
          } else if (nihilRows.has(h.row.index)) {
            h.cell.styles.fillColor = [240, 253, 244]
          }
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
