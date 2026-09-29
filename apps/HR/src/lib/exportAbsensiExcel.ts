import type { AttendanceLog } from '@/lib/types'

/**
 * Export rekap absensi ke Excel (.xlsx) yang rapi & berwarna.
 * CSV tidak bisa menyimpan warna/format, jadi dipakai .xlsx.
 * `exceljs` dimuat dinamis → tidak menambah ukuran halaman sampai tombol diklik.
 */

export interface ExportAbsensiMeta {
  dateFrom: string
  dateTo: string
  outletLabel: string
  statusLabel: string
  search: string
}

type StatusKey = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'cuti' | 'alfa'

// Warna ARGB (tanpa '#')
const STATUS_STYLE: Record<StatusKey, { label: string; row?: string; cell: string; font: string }> = {
  hadir: { label: 'Hadir', cell: 'FFD1FAE5', font: 'FF065F46' },
  terlambat: { label: 'Terlambat', row: 'FFFFF8DB', cell: 'FFFDE68A', font: 'FF92400E' },
  izin: { label: 'Izin', row: 'FFEFF6FF', cell: 'FFBFDBFE', font: 'FF1E40AF' },
  sakit: { label: 'Sakit', row: 'FFF5F3FF', cell: 'FFDDD6FE', font: 'FF5B21B6' },
  cuti: { label: 'Cuti', row: 'FFECFEFF', cell: 'FFA5F3FC', font: 'FF155E75' },
  alfa: { label: 'Alfa (Tidak Hadir)', row: 'FFFEE2E2', cell: 'FFFCA5A5', font: 'FF991B1B' },
}

const BRAND = 'FF701604' // suka-brown
const BRAND_SOFT = 'FFFDF3E7'
const BORDER = { style: 'thin' as const, color: { argb: 'FFE7DDD3' } }

function statusKey(s: string): StatusKey {
  return (s in STATUS_STYLE ? s : 'hadir') as StatusKey
}

function jam(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

function tanggalPanjang(iso: string): string {
  return new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

function jabatan(role?: string | null): string {
  if (!role) return '-'
  return role
    .split('_')
    .map((w) => (w === 'hr' ? 'HR' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

export async function exportAbsensiExcel(rows: AttendanceLog[], meta: ExportAbsensiMeta): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SukaHR'
  wb.created = new Date()

  const periode = `${tanggalPanjang(meta.dateFrom)} – ${tanggalPanjang(meta.dateTo)}`
  const diekspor = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  })

  // ── Sheet 1: Rekap per hari ──────────────────────────────────────────────
  const ws = wb.addWorksheet('Rekap Absensi', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  })
  ws.columns = [
    { key: 'no', width: 6 },
    { key: 'tanggal', width: 17 },
    { key: 'nama', width: 28 },
    { key: 'jabatan', width: 16 },
    { key: 'outlet', width: 26 },
    { key: 'status', width: 19 },
    { key: 'masuk', width: 11 },
    { key: 'pulang', width: 11 },
    { key: 'telat', width: 11 },
    { key: 'keterangan', width: 34 },
    { key: 'selfie', width: 9 },
    { key: 'lokasi', width: 13 },
  ]

  ws.mergeCells('A1:L1')
  ws.getCell('A1').value = 'REKAP ABSENSI KARYAWAN — SUKA SHAWARMA'
  ws.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
  ws.getCell('A1').alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 28

  ws.mergeCells('A2:L2')
  ws.getCell('A2').value =
    `Periode: ${periode}   •   Outlet: ${meta.outletLabel}   •   Status: ${meta.statusLabel}` +
    (meta.search.trim() ? `   •   Pencarian: "${meta.search.trim()}"` : '')
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF44403C' } }
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
  ws.getCell('A2').alignment = { indent: 1 }

  // Ringkasan status di baris 3
  const hitung: Record<StatusKey, number> = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, alfa: 0 }
  for (const r of rows) hitung[statusKey(r.status)]++
  ws.mergeCells('A3:L3')
  ws.getCell('A3').value = {
    richText: [
      { text: `Total ${rows.length} catatan   `, font: { bold: true, size: 10 } },
      ...(Object.keys(STATUS_STYLE) as StatusKey[]).map((k) => ({
        text: `  ${STATUS_STYLE[k].label.replace(' (Tidak Hadir)', '')}: ${hitung[k]}  `,
        font: { bold: true, size: 10, color: { argb: STATUS_STYLE[k].font } },
      })),
      { text: `   •   Diekspor ${diekspor} WIB`, font: { size: 9, italic: true, color: { argb: 'FF78716C' } } },
    ],
  }
  ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_SOFT } }
  ws.getCell('A3').alignment = { indent: 1 }
  ws.getRow(4).height = 6

  const header = ws.getRow(5)
  header.values = [
    'No',
    'Tanggal',
    'Nama Karyawan',
    'Jabatan',
    'Outlet',
    'Status',
    'Jam Masuk',
    'Jam Pulang',
    'Telat (mnt)',
    'Keterangan',
    'Selfie',
    'Lokasi',
  ]
  header.height = 22
  header.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
  })

  rows.forEach((r, i) => {
    const k = statusKey(r.status)
    const st = STATUS_STYLE[k]
    const row = ws.addRow({
      no: i + 1,
      tanggal: tanggalPanjang(r.date),
      nama: r.outlet_staff?.name ?? '-',
      jabatan: jabatan(r.outlet_staff?.role),
      outlet: r.outlets?.name ?? '-',
      status: st.label,
      masuk: jam(r.clock_in),
      pulang: jam(r.clock_out),
      telat: k === 'terlambat' ? r.late_minutes : '',
      keterangan: r.notes ?? '',
      selfie: r.photo_url ? 'Ada' : '-',
      lokasi:
        r.lat && r.lng
          ? { text: 'Buka Maps', hyperlink: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}` }
          : '-',
    })
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
      c.font = { size: 10 }
      c.alignment = { vertical: 'middle', wrapText: col === 10 }
      if (st.row) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.row } }
      else if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF9' } }
    })
    for (const col of [1, 7, 8, 9, 11, 12]) row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' }
    const sc = row.getCell(6)
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.cell } }
    sc.font = { bold: true, size: 10, color: { argb: st.font } }
    sc.alignment = { horizontal: 'center', vertical: 'middle' }
    const lok = row.getCell(12)
    if (r.lat && r.lng) lok.font = { size: 10, underline: true, color: { argb: 'FF1D4ED8' } }
  })

  if (rows.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: 12 } }

  // ── Sheet 2: Ringkasan per karyawan ──────────────────────────────────────
  const ringkas = wb.addWorksheet('Ringkasan per Karyawan', { views: [{ state: 'frozen', ySplit: 3 }] })
  ringkas.columns = [
    { key: 'no', width: 6 },
    { key: 'nama', width: 28 },
    { key: 'jabatan', width: 16 },
    { key: 'outlet', width: 26 },
    { key: 'hadir', width: 10 },
    { key: 'terlambat', width: 11 },
    { key: 'menit', width: 13 },
    { key: 'izin', width: 8 },
    { key: 'sakit', width: 8 },
    { key: 'cuti', width: 8 },
    { key: 'alfa', width: 8 },
    { key: 'persen', width: 14 },
  ]
  ringkas.mergeCells('A1:L1')
  ringkas.getCell('A1').value = `RINGKASAN KEHADIRAN PER KARYAWAN — ${periode}`
  ringkas.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  ringkas.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
  ringkas.getCell('A1').alignment = { vertical: 'middle', indent: 1 }
  ringkas.getRow(1).height = 26
  ringkas.getRow(2).height = 6

  const per = new Map<
    string,
    { nama: string; jabatan: string; outlet: string; c: Record<StatusKey, number>; menit: number }
  >()
  for (const r of rows) {
    const key = r.staff_id
    if (!per.has(key)) {
      per.set(key, {
        nama: r.outlet_staff?.name ?? '-',
        jabatan: jabatan(r.outlet_staff?.role),
        outlet: r.outlets?.name ?? '-',
        c: { hadir: 0, terlambat: 0, izin: 0, sakit: 0, cuti: 0, alfa: 0 },
        menit: 0,
      })
    }
    const p = per.get(key)!
    const k = statusKey(r.status)
    p.c[k]++
    if (k === 'terlambat') p.menit += r.late_minutes || 0
  }

  const h2 = ringkas.getRow(3)
  h2.values = [
    'No',
    'Nama Karyawan',
    'Jabatan',
    'Outlet',
    'Hadir',
    'Terlambat',
    'Total Telat (mnt)',
    'Izin',
    'Sakit',
    'Cuti',
    'Alfa',
    'Kehadiran (%)',
  ]
  h2.height = 22
  h2.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
  })

  const daftar = Array.from(per.values()).sort(
    (a, b) => b.c.alfa - a.c.alfa || b.c.terlambat - a.c.terlambat || a.nama.localeCompare(b.nama)
  )
  daftar.forEach((p, i) => {
    const masuk = p.c.hadir + p.c.terlambat
    // Kehadiran = hari masuk ÷ hari yang wajib masuk (izin/sakit/cuti sah tidak mengurangi)
    const wajib = masuk + p.c.alfa
    const row = ringkas.addRow({
      no: i + 1,
      nama: p.nama,
      jabatan: p.jabatan,
      outlet: p.outlet,
      hadir: p.c.hadir,
      terlambat: p.c.terlambat,
      menit: p.menit,
      izin: p.c.izin,
      sakit: p.c.sakit,
      cuti: p.c.cuti,
      alfa: p.c.alfa,
      persen: wajib > 0 ? masuk / wajib : null,
    })
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
      c.font = { size: 10 }
      c.alignment = { vertical: 'middle', horizontal: col >= 5 || col === 1 ? 'center' : 'left' }
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF9' } }
    })
    row.getCell(12).numFmt = '0%'
    const tint = (col: number, k: StatusKey) => {
      if (Number(row.getCell(col).value) > 0) {
        row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_STYLE[k].cell } }
        row.getCell(col).font = { bold: true, size: 10, color: { argb: STATUS_STYLE[k].font } }
      }
    }
    tint(6, 'terlambat')
    tint(7, 'terlambat')
    tint(8, 'izin')
    tint(9, 'sakit')
    tint(10, 'cuti')
    tint(11, 'alfa')
    const pct = wajib > 0 ? masuk / wajib : 1
    row.getCell(12).font = {
      bold: true,
      size: 10,
      color: { argb: pct >= 0.9 ? 'FF065F46' : pct >= 0.75 ? 'FF92400E' : 'FF991B1B' },
    }
  })
  if (daftar.length)
    ringkas.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + daftar.length, column: 12 } }

  // Legenda
  const lg = ringkas.addRow([])
  lg.height = 8
  const judul = ringkas.addRow(['', 'Keterangan warna'])
  judul.getCell(2).font = { bold: true, size: 10 }
  for (const k of Object.keys(STATUS_STYLE) as StatusKey[]) {
    const r = ringkas.addRow(['', STATUS_STYLE[k].label])
    r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_STYLE[k].cell } }
    r.getCell(2).font = { bold: true, size: 10, color: { argb: STATUS_STYLE[k].font } }
  }
  const catatan = ringkas.addRow([
    '',
    'Alfa = hari kerja (bukan Minggu/tanggal merah) tanpa absen & tanpa izin/sakit/cuti yang disetujui.',
  ])
  catatan.getCell(2).font = { italic: true, size: 9, color: { argb: 'FF78716C' } }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Rekap_Absensi_SukaHR_${meta.dateFrom}_sd_${meta.dateTo}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
