type SuratJalanItem = {
  nama?: string
  satuan?: string
  qty_dikirim?: number
  bahan_baku?: {
    nama?: string
    satuan?: string
    satuan_distribusi?: string
    satuan_tengah?: string
    satuan_kecil?: string
    faktor_tengah?: number
    faktor_tampilan?: number
  }
}

export type SuratJalanExcelData = {
  documentNumber: string
  outletName: string
  createdAt: string
  verificationCode?: string
  items: SuratJalanItem[]
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const encoder = new TextEncoder()
// Ukuran continuous form yang dipakai gudang: 9,5 × 5,5 inci, landscape.
// Ukuran ditulis eksplisit karena WPS Spreadsheets membaca ukuran custom dari
// paperWidth/paperHeight, bukan hanya dari kode paperSize.
const CONTINUOUS_FORM_WIDTH = '9.5in'
const CONTINUOUS_FORM_HEIGHT = '5.5in'

function xml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(value: number) {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, value, true)
  return bytes
}

function u32(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}

function join(parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

/** Minimal ZIP writer for browser-generated XLSX files; files are intentionally stored uncompressed. */
function zip(files: Array<{ name: string; content: Uint8Array }>) {
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const crc = crc32(file.content)
    const header = join([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(file.content.length), u32(file.content.length), u16(name.length), u16(0), name, file.content])
    local.push(header)
    central.push(join([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(file.content.length), u32(file.content.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]))
    offset += header.length
  }

  const centralBytes = join(central)
  return join([...local, centralBytes, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralBytes.length), u32(offset), u16(0)])
}

function cell(reference: string, value: string | number, style: number, numeric = false) {
  if (numeric) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

const FORM_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

type FormCell = { value: string | number; style: number; numeric?: boolean }

// OOXML mensyaratkan sel di dalam satu baris ditulis dalam urutan kolom.
// Excel cukup toleran terhadap urutan acak, tetapi WPS mengabaikan sebagian
// sel yang datang setelah referensi kolom yang lebih besar.
function formCells(row: number, defaultStyle: number, content: Record<string, FormCell> = {}) {
  return FORM_COLUMNS.map(column => {
    const entry = content[column]
    return cell(`${column}${row}`, entry?.value ?? '', entry?.style ?? defaultStyle, entry?.numeric)
  }).join('')
}

function displayItem(item: SuratJalanItem) {
  const bahan = item.bahan_baku
  const satuan = bahan?.satuan_distribusi || item.satuan || bahan?.satuan || ''
  let factor = 1
  if (bahan?.satuan_distribusi && bahan.satuan_distribusi !== bahan.satuan) {
    const distributionUnit = bahan.satuan_distribusi.toLowerCase()
    if (distributionUnit === bahan.satuan_tengah?.toLowerCase() && bahan.faktor_tengah) factor = bahan.faktor_tengah
    else if (distributionUnit === bahan.satuan_kecil?.toLowerCase() && bahan.faktor_tampilan) factor = bahan.faktor_tampilan
    else if (distributionUnit === 'kg' && bahan.satuan_kecil?.toLowerCase() === 'gram' && bahan.faktor_tampilan) factor = bahan.faktor_tampilan / 1000
  }
  return { name: item.nama || bahan?.nama || '-', unit: satuan, quantity: Math.round((item.qty_dikirim || 0) * factor) }
}

function fileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-') || 'Surat-Jalan'
}

export function buildSuratJalanExcel(data: SuratJalanExcelData) {
  const date = new Date(data.createdAt)
  const formattedDate = Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const renderedItems = data.items.map(displayItem)
  const itemRows = Math.max(renderedItems.length, 8)
  // Mengikuti template cetak yang dijadikan acuan: header di baris 2–4,
  // metadata di 7–8, tabel di 10–18, catatan besar, lalu tanda tangan.
  const tableStart = 11
  const tableEnd = tableStart + itemRows - 1
  const noteStart = tableEnd + 2
  // Sisakan area tulis tangan seperti form fisik: catatan dan tanda tangan
  // tidak boleh terdorong ke halaman kedua saat dibuka/di-print dari WPS.
  const noteEnd = noteStart + 5
  const signatureStart = noteEnd + 2
  const signatureEnd = signatureStart + 5
  const signatureBottom = signatureEnd + 1
  const printEnd = signatureBottom
  const rows: string[] = []
  rows.push(`<row r="1" ht="14.25">${formCells(1, 0)}</row>`)
  rows.push(`<row r="2" ht="23.25">${cell('A2', 'PT SUKA PROFIT BERKAH', 2)}${cell('H2', 'SURAT JALAN', 2)}</row>`)
  rows.push(`<row r="3" ht="23.25">${cell('A3', 'SUKA SHAWARMA KITCHEN', 15)}</row>`)
  rows.push(`<row r="4" ht="23.25">${cell('A4', 'Jl. Bukit Nirwana Raya No. 3, Mulyaharja, Kec Bogor Selatan, Kota Bogor, Jawa Barat', 15)}</row>`)
  rows.push(`<row r="5" ht="21">${formCells(5, 14)}</row>`)
  rows.push(`<row r="6" ht="14.25">${formCells(6, 0)}</row>`)
  rows.push(`<row r="7" ht="21.75">${cell('A7', 'Nama Outlet', 5)}${cell('C7', ':', 5)}${cell('D7', data.outletName, 6)}${cell('E7', 'Nomor Surat Jalan', 5)}${cell('G7', ':', 5)}${cell('H7', data.documentNumber, 16)}</row>`)
  rows.push(`<row r="8" ht="14.25">${cell('A8', 'Kode Verifikasi', 5)}${cell('C8', ':', 5)}${cell('D8', data.verificationCode || '-', 6)}${cell('E8', 'Tanggal Surat Jalan', 5)}${cell('G8', ':', 5)}${cell('H8', formattedDate, 1)}</row>`)
  rows.push(`<row r="9" ht="14.25">${formCells(9, 0)}</row>`)
  rows.push(`<row r="10" ht="25.5">${formCells(10, 7, {
    A: { value: 'No', style: 7 },
    B: { value: 'Nama Barang', style: 7 },
    E: { value: 'Satuan', style: 7 },
    F: { value: 'Jumlah', style: 7 },
    H: { value: 'Check List', style: 7 },
  })}</row>`)
  for (let index = 0; index < itemRows; index++) {
    const row = tableStart + index
    const item = renderedItems[index]
    rows.push(`<row r="${row}" ht="20.25">${formCells(row, 8, {
      A: { value: item ? index + 1 : '', style: 8, numeric: Boolean(item) },
      B: { value: item?.name || '', style: 9 },
      E: { value: item?.unit || '', style: 8 },
      F: { value: item?.quantity || '', style: 10, numeric: Boolean(item) },
      H: { value: '', style: 8 },
    })}</row>`)
  }
  rows.push(`<row r="${tableEnd + 1}" ht="14.25">${formCells(tableEnd + 1, 0)}</row>`)
  rows.push(`<row r="${noteStart}" ht="19.5">${formCells(noteStart, 11, { A: { value: 'CATATAN', style: 11 } })}</row>`)
  for (let row = noteStart + 1; row <= noteEnd; row++) rows.push(`<row r="${row}" ht="14.25">${formCells(row, 12)}</row>`)
  rows.push(`<row r="${noteEnd + 1}" ht="14.25">${formCells(noteEnd + 1, 0)}</row>`)
  rows.push(`<row r="${signatureStart}" ht="19.5">${formCells(signatureStart, 13, {
    A: { value: 'Admin Gudang', style: 13 },
    D: { value: 'Pengirim', style: 13 },
    F: { value: 'Penerima', style: 13 },
  })}</row>`)
  for (let row = signatureStart + 1; row <= signatureEnd; row++) rows.push(`<row r="${row}" ht="14.25">${formCells(row, 12)}</row>`)
  rows.push(`<row r="${signatureBottom}" ht="23.25">${formCells(signatureBottom, 12)}</row>`)

  const merges = ['A2:G2', 'A3:G3', 'A4:G4', 'H2:K2', 'H7:K7', 'H8:K8', 'B10:D10', 'F10:G10', 'H10:K10']
  for (let index = 0; index < itemRows; index++) merges.push(`B${tableStart + index}:D${tableStart + index}`, `F${tableStart + index}:G${tableStart + index}`, `H${tableStart + index}:K${tableStart + index}`)
  merges.push(`A${noteStart}:K${noteStart}`, `A${noteStart + 1}:K${noteEnd}`, `A${signatureStart}:C${signatureStart}`, `D${signatureStart}:E${signatureStart}`, `F${signatureStart}:K${signatureStart}`, `A${signatureStart + 1}:C${signatureEnd}`, `D${signatureStart + 1}:E${signatureEnd}`, `F${signatureStart + 1}:K${signatureEnd}`, `A${signatureBottom}:C${signatureBottom}`, `D${signatureBottom}:E${signatureBottom}`, `F${signatureBottom}:K${signatureBottom}`)

  const sheet = `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr><dimension ref="A1:K${printEnd}"/><sheetViews><sheetView workbookViewId="0" view="pageBreakPreview" showGridLines="0" zoomScale="100" zoomScaleNormal="100"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="9.287037037" customWidth="1"/><col min="2" max="2" width="14.138888889" customWidth="1"/><col min="3" max="3" width="26.287037037" customWidth="1"/><col min="4" max="4" width="39.712962963" customWidth="1"/><col min="5" max="5" width="12.287037037" customWidth="1"/><col min="6" max="6" width="17.574074074" customWidth="1"/><col min="7" max="7" width="9.425925926" customWidth="1"/><col min="8" max="8" width="4.425925926" customWidth="1"/><col min="9" max="9" width="10.712962963" customWidth="1" hidden="1"/><col min="10" max="10" width="5.425925926" customWidth="1"/><col min="11" max="11" width="13" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(range => `<mergeCell ref="${range}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1" gridLines="0"/><pageMargins left="0.13" right="0.13" top="0.17" bottom="0.17" header="0" footer="0"/><pageSetup paperSize="256" paperWidth="${CONTINUOUS_FORM_WIDTH}" paperHeight="${CONTINUOUS_FORM_HEIGHT}" paperUnits="in" orientation="landscape" blackAndWhite="1" fitToWidth="1" fitToHeight="1" horizontalDpi="300" verticalDpi="300" usePrinterDefaults="0"/></worksheet>`

  const styles = `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="9"><font><color rgb="FF000000"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF000000"/><sz val="16"/><name val="Cambria"/></font><font><color rgb="FF000000"/><sz val="16"/><name val="Cambria"/></font><font><b/><color rgb="FF000000"/><sz val="16"/><name val="Calibri"/></font><font><color rgb="FF000000"/><sz val="16"/><name val="Calibri"/></font><font><b/><color rgb="FF000000"/><sz val="16"/><name val="Arial"/></font><font><color rgb="FF000000"/><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FF000000"/><sz val="13"/><name val="Calibri"/></font><font><color rgb="FF000000"/><sz val="9"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="3"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border><border><left/><right/><top/><bottom style="double"><color rgb="FF000000"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="17"><xf xfId="0" fontId="0" fillId="0" borderId="0"/><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf xfId="0" fontId="2" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf xfId="0" fontId="3" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf xfId="0" fontId="4" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf xfId="0" fontId="5" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="6" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="6" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="6" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf xfId="0" fontId="7" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="2"/><xf xfId="0" fontId="2" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="8" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf></cellXfs></styleSheet>`

  const files = [
    { name: '[Content_Types].xml', content: encoder.encode(`${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: '_rels/.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', content: encoder.encode(`${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Surat Jalan" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'Surat Jalan'!$A$1:$K$${printEnd}</definedName></definedNames></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: 'xl/worksheets/sheet1.xml', content: encoder.encode(sheet) },
    { name: 'xl/styles.xml', content: encoder.encode(styles) },
  ]

  return zip(files)
}

export async function downloadSuratJalanExcel(data: SuratJalanExcelData) {
  const workbook = buildSuratJalanExcel(data)
  const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Surat-Jalan-${fileName(data.documentNumber)}.xlsx`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
