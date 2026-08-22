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
  items: SuratJalanItem[]
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const encoder = new TextEncoder()

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

export function buildSuratJalanExcel(data: SuratJalanExcelData, logo: Uint8Array | null = null) {
  const date = new Date(data.createdAt)
  const formattedDate = Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const renderedItems = data.items.map(displayItem)
  const itemRows = Math.max(renderedItems.length, 8)
  const tableStart = 9
  const tableEnd = tableStart + itemRows - 1
  const noteStart = tableEnd + 2
  const noteEnd = noteStart + 1
  const signatureStart = noteEnd + 2
  const signatureEnd = signatureStart + 3
  const printEnd = signatureEnd

  const rows: string[] = []
  rows.push(`<row r="1" ht="17">${cell('C1', 'PT SUKA PROFIT BERKAH', 2)}${cell('G1', 'SURAT JALAN', 3)}</row>`)
  rows.push(`<row r="2" ht="15">${cell('C2', 'SUKA SHAWARMA KITCHEN', 2)}</row>`)
  rows.push(`<row r="3" ht="13">${cell('C3', 'Jl. Bukit Rivwenda Raya No. 3, Mulyaharja, Kota Bogor, Jawa Barat', 4)}</row>`)
  rows.push(`<row r="4" ht="4">${cell('A4', '', 13)}</row>`)
  rows.push(`<row r="5" ht="15">${cell('A5', 'Nama Outlet', 5)}${cell('C5', `: ${data.outletName}`, 7)}${cell('F5', 'Nomor Surat Jalan', 5)}${cell('H5', `: ${data.documentNumber}`, 7)}</row>`)
  rows.push(`<row r="6" ht="15">${cell('A6', 'Nomor PO', 5)}${cell('C6', ': -', 7)}${cell('F6', 'Tanggal Surat Jalan', 5)}${cell('H6', `: ${formattedDate}`, 7)}</row>`)
  rows.push(`<row r="7" ht="4">${cell('A7', '', 13)}</row>`)
  rows.push(`<row r="8" ht="18">${cell('A8', 'No', 8)}${cell('B8', 'Nama Barang', 8)}${cell('E8', 'Satuan', 8)}${cell('F8', 'Jumlah', 8)}${cell('G8', 'Check List', 8)}</row>`)
  for (let index = 0; index < itemRows; index++) {
    const row = tableStart + index
    const item = renderedItems[index]
    rows.push(`<row r="${row}" ht="17">${cell(`A${row}`, item ? index + 1 : '', 9, Boolean(item))}${cell(`B${row}`, item?.name || '', 10)}${cell(`E${row}`, item?.unit || '', 9)}${cell(`F${row}`, item?.quantity || '', 11, Boolean(item))}${cell(`G${row}`, '', 9)}</row>`)
  }
  rows.push(`<row r="${tableEnd + 1}" ht="4">${cell(`A${tableEnd + 1}`, '', 13)}</row>`)
  rows.push(`<row r="${noteStart}" ht="13">${cell(`A${noteStart}`, 'CATATAN', 8)}</row>`)
  rows.push(`<row r="${noteEnd}" ht="18">${cell(`A${noteEnd}`, '', 12)}</row>`)
  rows.push(`<row r="${noteEnd + 1}" ht="4">${cell(`A${noteEnd + 1}`, '', 13)}</row>`)
  rows.push(`<row r="${signatureStart}" ht="14">${cell(`A${signatureStart}`, 'Admin Gudang', 8)}${cell(`D${signatureStart}`, 'Pengirim', 8)}${cell(`G${signatureStart}`, 'Penerima', 8)}</row>`)
  for (let row = signatureStart + 1; row <= signatureEnd; row++) rows.push(`<row r="${row}" ht="18">${cell(`A${row}`, '', 13)}${cell(`D${row}`, '', 13)}${cell(`G${row}`, '', 13)}</row>`)

  const merges = ['C1:F1', 'C2:F2', 'C3:F3', 'G1:I3', 'A4:I4', 'A5:B5', 'C5:E5', 'F5:G5', 'H5:I5', 'A6:B6', 'C6:E6', 'F6:G6', 'H6:I6', 'A7:I7', 'B8:D8', 'G8:I8']
  for (let index = 0; index < itemRows; index++) merges.push(`B${tableStart + index}:D${tableStart + index}`, `G${tableStart + index}:I${tableStart + index}`)
  merges.push(`A${noteStart}:I${noteStart}`, `A${noteEnd}:I${noteEnd}`, `A${signatureStart}:C${signatureStart}`, `D${signatureStart}:F${signatureStart}`, `G${signatureStart}:I${signatureStart}`)
  for (let row = signatureStart + 1; row <= signatureEnd; row++) merges.push(`A${row}:C${row}`, `D${row}:F${row}`, `G${row}:I${row}`)

  const sheet = `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:I${printEnd}"/><sheetViews><sheetView workbookViewId="0" view="pageLayout" showGridLines="0" zoomScale="100" zoomScaleNormal="100"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="5.5" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="4" width="14" customWidth="1"/><col min="5" max="6" width="11.5" customWidth="1"/><col min="7" max="7" width="9" customWidth="1"/><col min="8" max="9" width="13.5" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(range => `<mergeCell ref="${range}"/>`).join('')}</mergeCells>${logo ? '<drawing r:id="rId1"/>' : ''}<printOptions horizontalCentered="1" verticalCentered="1" gridLines="0"/><pageMargins left="0.12" right="0.12" top="0.12" bottom="0.12" header="0" footer="0"/><pageSetup paperSize="256" paperWidth="9.5in" paperHeight="5.5in" paperUnits="in" orientation="landscape" blackAndWhite="1" fitToWidth="1" fitToHeight="1" horizontalDpi="300" verticalDpi="300" usePrinterDefaults="0"/><headerFooter><oddFooter>&amp;CPage &amp;P of &amp;N</oddFooter></headerFooter></worksheet>`

  const styles = `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><color rgb="FF000000"/><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FF000000"/><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FF000000"/><sz val="15"/><name val="Arial"/></font><font><b/><color rgb="FF000000"/><sz val="12"/><name val="Arial"/></font><font><i/><color rgb="FF000000"/><sz val="9"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="3"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top/><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="14"><xf xfId="0" fontId="0" fillId="0" borderId="0"/><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="2" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="0"/><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="2" applyAlignment="1"><alignment vertical="bottom"/></xf></cellXfs></styleSheet>`

  const files = [
    { name: '[Content_Types].xml', content: encoder.encode(`${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${logo ? '<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: '_rels/.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', content: encoder.encode(`${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Surat Jalan" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'Surat Jalan'!$A$1:$I$${printEnd}</definedName></definedNames></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: 'xl/worksheets/sheet1.xml', content: encoder.encode(sheet) },
    { name: 'xl/styles.xml', content: encoder.encode(styles) },
  ]

  if (logo) {
    files.push(
      { name: 'xl/media/logo.png', content: new Uint8Array(logo) },
      { name: 'xl/worksheets/_rels/sheet1.xml.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`) },
      { name: 'xl/drawings/_rels/drawing1.xml.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>`) },
      { name: 'xl/drawings/drawing1.xml', content: encoder.encode(`${XML_HEADER}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>500000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>40000</xdr:rowOff></xdr:from><xdr:ext cx="600000" cy="720000"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logo Suka Shawarma"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="600000" cy="720000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`) },
    )
  }

  return zip(files)
}

export async function downloadSuratJalanExcel(data: SuratJalanExcelData) {
  let logo: Uint8Array | null = null
  try {
    const response = await fetch('/logo.png')
    if (response.ok) logo = new Uint8Array(await response.arrayBuffer())
  } catch {
    // The document remains usable when the logo is unavailable (for example, offline).
  }

  const workbook = buildSuratJalanExcel(data, logo)
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
