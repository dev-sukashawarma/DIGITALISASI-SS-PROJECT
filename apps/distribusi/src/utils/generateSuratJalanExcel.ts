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

export async function downloadSuratJalanExcel(data: SuratJalanExcelData) {
  let logo: Uint8Array | null = null
  try {
    const response = await fetch('/logo.png')
    if (response.ok) logo = new Uint8Array(await response.arrayBuffer())
  } catch {
    // The document remains usable when the logo is unavailable (for example, offline).
  }
  const date = new Date(data.createdAt)
  const formattedDate = Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  const renderedItems = data.items.map(displayItem)
  const itemRows = Math.max(renderedItems.length, 6)
  const tableStart = 10
  const tableEnd = tableStart + itemRows
  const noteStart = tableEnd + 2
  const signatureStart = noteStart + 4

  const rows: string[] = []
  rows.push(`<row r="1" ht="21">${cell('B1', 'PT SUKA PROFIT BERKAH', 2)}${cell('E1', 'SURAT JALAN', 3)}</row>`)
  rows.push(`<row r="2" ht="18">${cell('B2', 'SUKA SHAWARMA KITCHEN', 2)}</row>`)
  rows.push(`<row r="3" ht="18">${cell('B3', 'Jl. Bukit Rivwenda Raya No. 3, Mulyaharja, Kota Bogor, Jawa Barat', 4)}</row>`)
  rows.push(`<row r="4" ht="8"/>`)
  rows.push(`<row r="5" ht="18">${cell('A5', 'Nama Outlet', 5)}${cell('C5', ':', 6)}${cell('D5', data.outletName, 7)}${cell('E5', 'Nomor Surat Jalan', 5)}${cell('F5', `: ${data.documentNumber}`, 7)}</row>`)
  rows.push(`<row r="6" ht="18">${cell('A6', 'Nomor PO', 5)}${cell('C6', ':', 6)}${cell('D6', '-', 7)}${cell('E6', 'Tanggal Surat Jalan', 5)}${cell('F6', `: ${formattedDate}`, 7)}</row>`)
  rows.push(`<row r="7" ht="8"/>`)
  rows.push(`<row r="8" ht="26">${cell('A8', 'No', 8)}${cell('B8', 'Nama Barang', 8)}${cell('C8', 'Satuan', 8)}${cell('D8', 'Jumlah', 8)}${cell('E8', 'Check List', 8)}</row>`)
  for (let index = 0; index < itemRows; index++) {
    const row = tableStart + index
    const item = renderedItems[index]
    rows.push(`<row r="${row}" ht="22">${cell(`A${row}`, item ? index + 1 : '', 9, Boolean(item))}${cell(`B${row}`, item?.name || '', 10)}${cell(`C${row}`, item?.unit || '', 9)}${cell(`D${row}`, item?.quantity || '', 11, Boolean(item))}${cell(`E${row}`, '', 9)}</row>`)
  }
  rows.push(`<row r="${noteStart}" ht="20">${cell(`A${noteStart}`, 'CATATAN', 8)}</row>`)
  for (let row = noteStart + 1; row <= noteStart + 3; row++) rows.push(`<row r="${row}" ht="20">${cell(`A${row}`, '', 12)}</row>`)
  rows.push(`<row r="${signatureStart}" ht="21">${cell(`A${signatureStart}`, 'Admin Gudang', 8)}${cell(`C${signatureStart}`, 'Pengirim', 8)}${cell(`E${signatureStart}`, 'Penerima', 8)}</row>`)
  for (let row = signatureStart + 1; row <= signatureStart + 4; row++) rows.push(`<row r="${row}" ht="21">${cell(`A${row}`, '', 13)}${cell(`C${row}`, '', 13)}${cell(`E${row}`, '', 13)}</row>`)

  const merges = ['B1:D1', 'B2:D2', 'B3:D3', 'E1:F3', 'A5:B5', 'D5:D5', 'E5:E5', 'A6:B6', 'D6:D6', 'E6:E6', 'E8:F8']
  for (let index = 0; index < itemRows; index++) merges.push(`E${tableStart + index}:F${tableStart + index}`)
  merges.push(`A${noteStart}:F${noteStart}`, `A${noteStart + 1}:F${noteStart + 3}`, `A${signatureStart}:B${signatureStart}`, `C${signatureStart}:D${signatureStart}`, `E${signatureStart}:F${signatureStart}`)
  for (let row = signatureStart + 1; row <= signatureStart + 4; row++) merges.push(`A${row}:B${row}`, `C${row}:D${row}`, `E${row}:F${row}`)

  const sheet = `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="13" customWidth="1"/><col min="5" max="5" width="14" customWidth="1"/><col min="6" max="6" width="4" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(range => `<mergeCell ref="${range}"/>`).join('')}</mergeCells>${logo ? '<drawing r:id="rId1"/>' : ''}<printOptions horizontalCentered="1" verticalCentered="0"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/><headerFooter><oddFooter>&amp;CPage &amp;P of &amp;N</oddFooter></headerFooter></worksheet>`

  const styles = `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="15"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><i/><sz val="9"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5E6D3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color rgb="FF544437"/></left><right style="thin"><color rgb="FF544437"/></right><top style="thin"><color rgb="FF544437"/></top><bottom style="thin"><color rgb="FF544437"/></bottom></border><border><left style="thin"><color rgb="FF544437"/></left><right style="thin"><color rgb="FF544437"/></right><top/><bottom style="thin"><color rgb="FF544437"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="14"><xf xfId="0" fontId="0" fillId="0" borderId="0"/><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="2" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="1" fillId="0" borderId="0"/><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf xfId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf xfId="0" fontId="0" fillId="0" borderId="2" applyAlignment="1"><alignment vertical="bottom"/></xf></cellXfs></styleSheet>`

  const files = [
    { name: '[Content_Types].xml', content: encoder.encode(`${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${logo ? '<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`) },
    { name: '_rels/.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', content: encoder.encode(`${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Surat Jalan" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: 'xl/worksheets/sheet1.xml', content: encoder.encode(sheet) },
    { name: 'xl/styles.xml', content: encoder.encode(styles) },
  ]

  if (logo) {
    files.push(
      { name: 'xl/media/logo.png', content: new Uint8Array(logo) },
      { name: 'xl/worksheets/_rels/sheet1.xml.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`) },
      { name: 'xl/drawings/_rels/drawing1.xml.rels', content: encoder.encode(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>`) },
      { name: 'xl/drawings/drawing1.xml', content: encoder.encode(`${XML_HEADER}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>1</xdr:col><xdr:colOff>300000</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logo Suka Shawarma"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1100000" cy="600000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`) },
    )
  }

  const workbook = zip(files)
  const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Surat-Jalan-${fileName(data.documentNumber)}.xlsx`
  anchor.click()
  URL.revokeObjectURL(url)
}
