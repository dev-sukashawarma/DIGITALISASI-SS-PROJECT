import * as xlsx from 'xlsx';
import { PlatformParser, SettlementRow, parsePlainNumber } from './types';

// Laporan settlement GoFood (.xlsx, sheet "Midtrans Payments" — disalurkan lewat
// payment gateway Midtrans). Tiga keanehan yang harus ditangani:
//
//  1. ALAMAT SEL TERBALIK. File ini menulis kunci sel sebagai "1A", "2B"
//     (baris-kolom) alih-alih standar "A1", "B2". Akibatnya `!ref` ikut rusak
//     ("1:A114") dan xlsx.utils.sheet_to_json melempar "invalid column -1".
//     Karena itu grid dibangun manual dari kunci sel, mendukung kedua pola.
//  2. Tanggal berupa serial Excel (46231.85), bukan teks.
//  3. TIDAK ADA nama toko — hanya "Merchant ID". Pemetaan ke outlet karena itu
//     mengandalkan Merchant ID, dan nama toko diisi dengan Merchant ID juga
//     supaya pesan "toko belum dipetakan" tetap informatif.

const SHEET = 'Midtrans Payments';

function colToNum(letters: string): number {
  let c = 0;
  for (const ch of letters) c = c * 26 + (ch.charCodeAt(0) - 64);
  return c - 1;
}

/** Bangun grid baris×kolom dari kunci sel, menerima pola "A1" maupun "1A". */
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
  if (cells.length === 0) return [];

  const maxR = Math.max(...cells.map((x) => x.r));
  const maxC = Math.max(...cells.map((x) => x.c));
  const grid: any[][] = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(''));
  for (const { r, c, v } of cells) grid[r][c] = v;
  return grid;
}

/** Serial Excel -> "YYYY-MM-DD". */
function excelSerialToDate(value: unknown): string | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!isFinite(n) || n <= 0) return null;
  const d = (xlsx as any).SSF?.parse_date_code?.(n);
  if (!d || !d.y) return null;
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

export const gofoodParser: PlatformParser = {
  id: 'gofood',
  label: 'GoFood',
  accept: '.xlsx,.xls',

  parse(buffer: ArrayBuffer): SettlementRow[] {
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.includes(SHEET) ? SHEET : wb.SheetNames[0];
    const grid = readGrid(wb.Sheets[sheetName]);
    if (grid.length < 2) {
      throw new Error(
        `Tidak ada data terbaca dari file GoFood (sheet: ${wb.SheetNames.join(', ')}).`
      );
    }

    const header = grid[0].map((h) => String(h ?? '').trim());
    const col = (name: string) => {
      const i = header.indexOf(name);
      if (i === -1) throw new Error(`Kolom "${name}" tidak ada di file GoFood.`);
      return i;
    };

    const cMerchant = col('Merchant ID');
    const cWaktu = col('Waktu transaksi');
    const cPenjualan = col('Penjualan');
    const cTotalBiaya = col('Total Biaya');
    const cPromo = col('Promo yang ditanggung Mitra Usaha');

    const out: SettlementRow[] = [];
    for (let i = 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r) continue;

      const omzetKotor = parsePlainNumber(r[cPenjualan]);
      if (omzetKotor <= 0) continue;

      const date = excelSerialToDate(r[cWaktu]);
      if (!date) continue;

      // "Total Biaya" = seluruh potongan GoFood untuk transaksi itu (terverifikasi:
      // Penjualan - Total Biaya = Pendapatan Bersih, persis). Promo yang ditanggung
      // mitra dipisahkan darinya agar tidak terhitung dua kali sebagai komisi.
      // CATATAN: pada file contoh kolom promo selalu kosong, jadi asumsi "promo
      // termasuk di dalam Total Biaya" belum teruji dengan data yang promonya terisi.
      const totalBiaya = Math.abs(parsePlainNumber(r[cTotalBiaya]));
      const promoMerchant = Math.abs(parsePlainNumber(r[cPromo]));
      const commission = Math.max(0, totalBiaya - promoMerchant);

      const merchantId = String(r[cMerchant] ?? '').trim();
      out.push({
        storeId: merchantId,
        storeName: merchantId, // laporan GoFood tidak memuat nama toko
        date,
        omzetKotor,
        promoMerchant,
        commission,
      });
    }

    if (out.length === 0) throw new Error('Tidak ada baris transaksi terbaca dari file GoFood ini.');
    return out;
  },
};
