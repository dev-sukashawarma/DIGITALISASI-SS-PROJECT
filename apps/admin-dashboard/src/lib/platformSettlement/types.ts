// Kontrak bersama untuk parser laporan settlement food apps.
// Tiap platform (ShopeeFood/GrabFood/GoFood) punya format file yang sangat berbeda —
// nama kolom, struktur sheet, format angka & tanggal semuanya beda. Parser per platform
// menormalkan semuanya ke bentuk SettlementRow di bawah, sehingga sisa alur (pemetaan
// outlet, agregasi, preview, sync) tidak perlu tahu asal datanya dari platform mana.

export type PlatformId = 'shopeefood' | 'grabfood' | 'gofood' | 'tiktokgo';

/** Satu baris hasil normalisasi = satu transaksi di laporan platform. */
export interface SettlementRow {
  /** ID toko di platform. Kunci utama pemetaan ke outlet (stabil walau nama toko diubah). */
  storeId: string;
  /** Nama toko apa adanya dari laporan — untuk pesan error & pemetaan cadangan. */
  storeName: string;
  /** Tanggal transaksi dibuat (WIB), format YYYY-MM-DD. */
  date: string;
  /** Harga menu penuh sebelum promo dipotong. */
  omzetKotor: number;
  /** Diskon/promo yang ditanggung merchant (bukan yang ditanggung platform). */
  promoMerchant: number;
  /** Komisi platform. SELALU disimpan positif walau di file aslinya negatif. */
  commission: number;
  /** Opsional: ID pesanan unik. Jika ada, dipakai untuk menghitung trxCount agar baris item dari pesanan yang sama tidak dihitung dobel. */
  orderId?: string;
}

/** Agregat per outlet per tanggal — bentuk yang benar-benar disimpan ke DB. */
export interface SettlementDaily {
  storeId: string;
  storeName: string;
  outletName: string | null;
  outletId: string | null;
  date: string;
  omzetKotor: number;
  promoMerchant: number;
  commission: number;
  trxCount: number;
}

export interface PlatformParser {
  id: PlatformId;
  label: string;
  /** Ekstensi yang diterima input file, mis. '.xlsx' atau '.csv'. */
  accept: string;
  parse(buffer: ArrayBuffer): SettlementRow[];
}

/** Buang pemisah ribuan gaya Indonesia ("39.000" -> 39000) lalu jadikan angka. */
export function parseIdNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const cleaned = String(value).trim().replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Angka gaya internasional ("31200", "-772.97") — titik = desimal, bukan ribuan. */
export function parsePlainNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const n = parseFloat(String(value).trim());
  return isNaN(n) ? 0 : n;
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** "07/28/2026 21:11:17" (MM/DD/YYYY, ShopeeFood) -> "2026-07-28". */
export function parseSlashDate(value: unknown): string | null {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** "28 Jul 2026 8:07 PM" (GrabFood) -> "2026-07-28". */
export function parseTextDate(value: unknown): string | null {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}

/** Pembaca CSV yang menghormati tanda kutip (laporan Grab punya kolom berisi koma). */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
