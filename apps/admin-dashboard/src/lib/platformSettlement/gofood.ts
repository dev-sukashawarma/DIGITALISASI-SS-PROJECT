import * as xlsx from 'xlsx';
import { PlatformParser, SettlementRow, parsePlainNumber, parseSlashDate, parseTextDate } from './types';

// Laporan settlement GoFood (.xlsx / .csv, sheet "Midtrans Payments" atau sheet transaksi GoBiz).
// Karakteristik yang ditangani secara tangguh:
//  1. ALAMAT SEL TERBALIK: Menerima "A1" (standar) maupun "1A" (baris-kolom terbalik).
//  2. TANGGAL: Mendukung serial Excel (46231.85), ISO (YYYY-MM-DD), maupun teks tanggal Indonesia/Inggris.
//  3. POSISI HEADER: Otomatis mendeteksi baris header (baik di baris 0 maupun baris metadata 1-10).
//  4. ALIAS KOLOM: Mendukung variasi penamaan kolom bahasa Indonesia & Inggris.
//  5. STORE / MERCHANT: Menerima "Merchant ID", serta nama outlet jika tersedia.

const PREFERRED_SHEET_NAMES = ['midtrans payments', 'transactions', 'laporan transaksi', 'settlement', 'transaksi'];

function colToNum(letters: string): number {
  let c = 0;
  for (const ch of letters) c = c * 26 + (ch.charCodeAt(0) - 64);
  return c - 1;
}

/** Bangun grid baris×kolom dari worksheet, menerima pola "A1" maupun "1A". */
function readGrid(ws: xlsx.WorkSheet): any[][] {
  const cells: { r: number; c: number; v: any }[] = [];
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue;
    let m = key.match(/^([A-Z]+)(\d+)$/); // standar: A1
    if (m) {
      cells.push({ r: parseInt(m[2]) - 1, c: colToNum(m[1]), v: (ws[key] as any).v });
      continue;
    }
    m = key.match(/^(\d+)([A-Z]+)$/); // terbalik: 1A
    if (m) cells.push({ r: parseInt(m[1]) - 1, c: colToNum(m[2]), v: (ws[key] as any).v });
  }

  if (cells.length === 0) {
    const aoa = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true });
    if (aoa && aoa.length > 0) return aoa;
    return [];
  }

  const maxR = Math.max(...cells.map((x) => x.r));
  const maxC = Math.max(...cells.map((x) => x.c));
  const grid: any[][] = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(''));
  for (const { r, c, v } of cells) grid[r][c] = v;
  return grid;
}

/** Serial Excel atau String -> "YYYY-MM-DD". */
export function parseAnyDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  // Numeric serial number (Excel date)
  if (typeof value === 'number' || (!isNaN(Number(value)) && !String(value).includes('-') && !String(value).includes('/'))) {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (isFinite(n) && n > 0) {
      const d = (xlsx as any).SSF?.parse_date_code?.(n);
      if (d && d.y) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    }
  }

  const s = String(value).trim();
  // Format ISO: 2026-09-15...
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Format DD-MM-YYYY: 15-09-2026...
  const idMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (idMatch) return `${idMatch[3]}-${idMatch[2].padStart(2, '0')}-${idMatch[1].padStart(2, '0')}`;

  // Slash format MM/DD/YYYY atau DD/MM/YYYY
  const slash = parseSlashDate(s);
  if (slash) return slash;

  // Text month format: 28 Jul 2026
  const textDate = parseTextDate(s);
  if (textDate) return textDate;

  return null;
}

const MERCHANT_ALIASES = ['merchant id', 'merchant_id', 'id merchant', 'outlet id', 'store id', 'merchant', 'store_id'];
const STORE_NAME_ALIASES = ['outlet name', 'nama merchant', 'merchant name', 'nama toko', 'nama outlet', 'store name', 'outlet'];
const WAKTU_ALIASES = ['waktu transaksi', 'transaction time', 'tanggal transaksi', 'waktu', 'tanggal', 'created at', 'date', 'transaction date', 'waktu pesanan'];
const PENJUALAN_ALIASES = ['amount', 'penjualan', 'gross amount', 'total penjualan', 'harga sebelum diskon', 'omzet kotor', 'gross sales', 'subtotal', 'total order amount'];
const NET_AMOUNT_ALIASES = ['net amount', 'pendapatan bersih', 'netto', 'total pencairan'];
const BIAYA_ALIASES = ['total biaya', 'total fee', 'komisi', 'biaya layanan', 'potongan', 'commission', 'service fee', 'biaya transaksi'];
const PROMO_ALIASES = [
  'merchant promo contribution',
  'promo yang ditanggung mitra usaha',
  'promo ditanggung mitra usaha',
  'promo merchant',
  'diskon mitra',
  'promo mitra',
  'diskon toko',
  'promo toko',
  'subsidi mitra',
  'merchant promo',
  'promo yang ditanggung merchant',
  'promo diskon toko'
];

function findColumnIndex(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = header.indexOf(alias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const idx = header.findIndex((h) => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

export const gofoodParser: PlatformParser = {
  id: 'gofood',
  label: 'GoFood',
  accept: '.xlsx,.xls,.csv',

  parse(buffer: ArrayBuffer): SettlementRow[] {
    const wb = xlsx.read(buffer, { type: 'buffer' });

    // Pilih sheet terbaik
    let chosenSheet = wb.SheetNames[0];
    for (const name of wb.SheetNames) {
      if (PREFERRED_SHEET_NAMES.some((p) => name.toLowerCase().includes(p))) {
        chosenSheet = name;
        break;
      }
    }

    const grid = readGrid(wb.Sheets[chosenSheet]);
    if (grid.length < 2) {
      throw new Error(`Tidak ada data terbaca dari file GoFood (sheet: ${wb.SheetNames.join(', ')}).`);
    }

    // Temukan baris header secara dinamis (maksimal baris ke-15)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(15, grid.length); r++) {
      const rowStrings = (grid[r] || []).map((c) => String(c ?? '').trim().toLowerCase());
      const hasMerchant = MERCHANT_ALIASES.some((a) => rowStrings.some((cell) => cell.includes(a)));
      const hasPenjualan = PENJUALAN_ALIASES.some((a) => rowStrings.some((cell) => cell.includes(a)));
      const hasWaktu = WAKTU_ALIASES.some((a) => rowStrings.some((cell) => cell.includes(a)));

      if ((hasMerchant && hasPenjualan) || (hasMerchant && hasWaktu) || (hasPenjualan && hasWaktu)) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0; // fallback ke baris pertama
    }

    const header = (grid[headerRowIdx] || []).map((h) => String(h ?? '').trim().toLowerCase());

    const cMerchant = findColumnIndex(header, MERCHANT_ALIASES);
    const cWaktu = findColumnIndex(header, WAKTU_ALIASES);
    const cPenjualan = findColumnIndex(header, PENJUALAN_ALIASES);
    const cNet = findColumnIndex(header, NET_AMOUNT_ALIASES);
    const cTotalBiaya = findColumnIndex(header, BIAYA_ALIASES);
    const cPromo = findColumnIndex(header, PROMO_ALIASES);
    const cStoreName = findColumnIndex(header, STORE_NAME_ALIASES);

    if (cMerchant === -1) throw new Error('Kolom "Merchant ID" tidak ditemukan di file GoFood.');
    if (cWaktu === -1) throw new Error('Kolom "Waktu transaksi" tidak ditemukan di file GoFood.');
    if (cPenjualan === -1) throw new Error('Kolom "Penjualan" / "Amount" tidak ditemukan di file GoFood.');

    const out: SettlementRow[] = [];
    for (let i = headerRowIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r) continue;

      const omzetKotor = parsePlainNumber(r[cPenjualan]);
      if (omzetKotor <= 0) continue;

      const date = parseAnyDate(r[cWaktu]);
      if (!date) continue;

      const promoMerchant = cPromo !== -1 ? Math.abs(parsePlainNumber(r[cPromo])) : 0;
      let totalBiaya = 0;
      if (cTotalBiaya !== -1) {
        totalBiaya = Math.abs(parsePlainNumber(r[cTotalBiaya]));
      } else if (cNet !== -1) {
        const netAmount = parsePlainNumber(r[cNet]);
        totalBiaya = Math.max(0, omzetKotor - netAmount);
      }
      const commission = Math.max(0, totalBiaya - promoMerchant);

      const merchantId = String(r[cMerchant] ?? '').trim();
      const rawStoreName = cStoreName !== -1 ? String(r[cStoreName] ?? '').trim() : '';
      const storeName = rawStoreName || merchantId;

      out.push({
        storeId: merchantId,
        storeName,
        date,
        omzetKotor,
        promoMerchant,
        commission,
      });
    }

    if (out.length === 0) {
      throw new Error('Tidak ada baris transaksi yang valid terbaca dari file GoFood ini.');
    }

    return out;
  },
};
