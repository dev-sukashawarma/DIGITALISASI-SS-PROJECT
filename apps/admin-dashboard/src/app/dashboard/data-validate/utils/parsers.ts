import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ParsedMenuData = {
  name: string
  qty: number
}

// ─────────────────────────────────────────────────────────────
// MAPPING: Nama file export → Nama di database
// ─────────────────────────────────────────────────────────────

/** TikTok GO: nama di file export → nama di menu_items DB */
const TIKTOK_GO_NAME_MAP: Record<string, string> = {
  'best seller':           'best seller (mix jumbo)',
  'best seller 2':         'best seller 2',
  'shawarma triple combo': 'triple combo',
}

/** TikTok Seller: nama panjang di file export → nama di menu_items DB */
const TIKTOK_SELLER_NAME_MAP: Record<string, string> = {
  'suka shawarma original ayam reguler - porsi santai': 'original ayam sedang',
  'suka shawarma original mix reguler - porsi pas':     'original mix besar',
  'suka shawarma original sapi reguler - porsi single': 'original sapi sedang',
  'suka shawarma original ayam sedang - medium':        'original ayam besar',
  'suka shawarma original sapi sedang - porsi mantap':  'original sapi besar',
  'suka shawarma original sapi besar - porsi lapar':    'original sapi jumbo',
  'suka shawarma original shawarma mix besar':          'original mix jumbo',
  'suka shawarma original ayam besar - large':          'original ayam jumbo',
  'suka shawarma original shawarma sapi jumbo':         'original sapi jumbo',
  'suka shawarma original mix jumbo - king size':       'original mix jumbo',
  'suka shawarma original ayam jumbo - barbar':         'original ayam jumbo',
}

// ─────────────────────────────────────────────────────────────
// WHITELIST: Nama DB yang valid per channel
// Dipakai untuk memfilter hasil parse file — buang item yang
// bukan menu channel ini (misal data dari sheet lain)
// ─────────────────────────────────────────────────────────────
const CHANNEL_VALID_NAMES: Record<string, Set<string>> = {
  tiktok_go: new Set([
    'best seller (mix jumbo)',
    'best seller 2',
    'best seller 2 (sapi jumbo)',
    'shawarma duo combo',
    'triple combo',
    'shawarmie duo varian',
    'suka duo favorite',
    'suka premium crispy',
    'suka premius crispy',
    'suka triple favorit',
    'triple seru',
    'spesial suka lovers',
    'mix cheese combo',
    'paket nikmat',
    'paket couple',
    'paket mood',
    'double suka',
    'megabite combo',
    'paket nongki 1',
    'paket nongki 2',
  ]),
  tiktok_seller: new Set([
    'original ayam sedang',
    'original mix besar',
    'original sapi sedang',
    'original ayam besar',
    'original sapi besar',
    'original sapi jumbo',
    'original mix jumbo',
    'original ayam jumbo',
  ]),
}

// ─────────────────────────────────────────────────────────────
// HELPER: Cari sheet Excel yang punya kolom nama item
// Iterasi semua sheet, pilih yang mengandung kolom relevan
// ─────────────────────────────────────────────────────────────
const ITEM_NAME_COLS = ['Item name', 'item name', 'Item Name', 'ITEM NAME', 'Product Name', 'Menu Name', 'SKU Name', 'Nama Produk', 'Nama Item', 'Nama Menu', 'Produk', 'Item']

function findBestSheet(workbook: XLSX.WorkBook, channel: string): any[] {
  const validNames = CHANNEL_VALID_NAMES[channel]
  let bestSheet: any[] = []
  let bestMatchCount = 0

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const json  = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as any[]
    if (json.length === 0) continue

    const firstRow = json[0]
    const nameCol  = ITEM_NAME_COLS.find(col => col in firstRow)
    if (!nameCol) continue

    // Hitung berapa item di sheet ini yang cocok dengan whitelist channel
    let matchCount = 0
    for (const row of json.slice(0, 20)) { // cek 20 baris pertama
      const rawName  = String(row[nameCol] || '').split('|')[0].trim().toLowerCase()
      if (validNames?.has(rawName)) matchCount++
      // Cek juga setelah mapping
      const mapped = channel === 'tiktok_go'
        ? (TIKTOK_GO_NAME_MAP[rawName] ?? rawName)
        : (TIKTOK_SELLER_NAME_MAP[rawName] ?? rawName)
      if (validNames?.has(mapped)) matchCount++
    }

    console.log(`[Sheet "${sheetName}"] nameCol="${nameCol}" | match=${matchCount}`)

    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount
      bestSheet = json
    }
  }

  // Fallback ke sheet pertama jika tidak ada yang cocok
  if (bestSheet.length === 0 && workbook.SheetNames.length > 0) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    bestSheet   = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as any[]
  }

  return bestSheet
}

// ─────────────────────────────────────────────────────────────
// PARSER FUNCTIONS
// ─────────────────────────────────────────────────────────────

function parseRows(
  data: any[],
  nameMap: Record<string, string>,
  channelLabel: string,
  channel: string,
  preferProductName: boolean = false
): ParsedMenuData[] {
  const agg        = new Map<string, ParsedMenuData>()
  const validNames = CHANNEL_VALID_NAMES[channel] ?? null

  if (data.length === 0) return []

  const possibleNameCols = preferProductName
    ? ['Product Name', 'Nama Produk', 'Item name', 'item name', 'Item Name', 'ITEM NAME', 'Nama Item', 'Menu Name', 'Nama Menu', 'SKU Name']
    : ['Item name', 'item name', 'Item Name', 'ITEM NAME', 'Nama Item', 'Product Name', 'Nama Produk', 'Menu Name', 'Nama Menu', 'SKU Name']
  const possibleQtyCols  = ['Quantity', 'quantity', 'QTY', 'qty', 'Item Quantity', 'Count', 'Kuantitas', 'Jumlah', 'Jml', 'Qty']

  const firstRow = data[0]
  const nameCol  = possibleNameCols.find(col => col in firstRow) ?? null
  const qtyCol   = possibleQtyCols.find(col => col in firstRow)  ?? null

  console.log(`[${channelLabel} Parser] Name col: "${nameCol}" | Qty col: "${qtyCol}"`)

  for (const row of data) {
    const rawName = nameCol ? row[nameCol] : undefined
    if (!rawName || String(rawName).trim() === '') continue

    const rawClean  = String(rawName).split('|')[0].trim().toLowerCase()
    const cleanName = nameMap[rawClean] ?? rawClean

    // Buang item yang bukan menu channel ini
    if (validNames && !validNames.has(cleanName)) {
      console.log(`[TikTok GO Parser] ❌ SKIPPED: rawName="${rawName}" => cleanName="${cleanName}"`)
      continue
    }

    const cur = agg.get(cleanName) ?? { name: cleanName, qty: 0 }
    cur.qty += (qtyCol && row[qtyCol]) ? (Number(row[qtyCol]) || 1) : 1
    agg.set(cleanName, cur)
  }

  return Array.from(agg.values())
}

function parseByChannel(data: any[], channel: string): ParsedMenuData[] {
  switch (channel) {
    case 'tiktok_go':
      return parseRows(data, TIKTOK_GO_NAME_MAP, 'TikTok GO', channel, true)
    case 'tiktok_seller':
      return parseRows(data, TIKTOK_SELLER_NAME_MAP, 'TikTok Seller', channel, false)
    default:
      throw new Error(`Channel "${channel}" belum didukung untuk parsing file.`)
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export function parseFile(file: File, channel: string): Promise<ParsedMenuData[]> {
  return new Promise((resolve, reject) => {
    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv'

    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            resolve(parseByChannel(results.data, channel))
          } catch (err) {
            reject(err)
          }
        },
        error: (error) => reject(error)
      })
    } else {
      // Handle Excel (.xlsx, .xls)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data     = e.target?.result
          const workbook = XLSX.read(data, { type: 'array' })

          // Cari sheet yang paling banyak mengandung item channel ini
          const json = findBestSheet(workbook, channel)
          resolve(parseByChannel(json, channel))
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = (error) => reject(error)
      reader.readAsArrayBuffer(file)
    }
  })
}
