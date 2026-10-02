import * as xlsx from 'xlsx';
import { PlatformParser, SettlementRow, parsePlainNumber } from './types';

// Laporan TikTok Go (.xlsx). Modelnya berbeda dari tiga platform Food Apps
// lain: TikTok memakai skema VOUCHER — pelanggan membeli voucher di aplikasi lalu
// menukarkannya di kasir outlet SS. Karena itu:
//
//  1. Baris data adalah level ITEM (satu voucher), bukan level pesanan delivery.
//  2. Hak Omzet Kotor Resto = Base Merchant (Payment Amount + Subsidi TikTok).
//     Harga menu voucher di POS Kasir grup SS (apps/pos-kasir) diset mengikuti
//     nilai Base Merchant ini, bukan Original Price (harga coret aplikasi).
//  3. Diskon Beban Toko = Kolom "Merchant incentive". Potongan "Platform incentive"
//     disubsidi 100% oleh TikTok dan diganti penuh ke rekening merchant.
//  4. Parser mendukung dua format file resmi TikTok Shop:
//     - Laporan Penjualan Harian ("Orders...xlsx", sheet "order detail", header baris 4)
//     - Laporan Keuangan ("EarningsReports-OrderDetails...xlsx", header baris 1)

const SHEET = 'order detail';
const HEADER_ROW = 3;
const STATUS_OK = 'fulfilled';

function normalizeDate(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Format YYYY-MM-DD (e.g. 2026-09-30)
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
  // Format MM/DD/YYYY (e.g. 09/26/2026)
  const mUs = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mUs) {
    const month = mUs[1].padStart(2, '0');
    const day = mUs[2].padStart(2, '0');
    return `${mUs[3]}-${month}-${day}`;
  }
  return null;
}

export const tiktokgoParser: PlatformParser = {
  id: 'tiktokgo',
  label: 'TikTok Go',
  accept: '.xlsx,.xls',

  parse(buffer: ArrayBuffer): SettlementRow[] {
    const wb = xlsx.read(buffer, { type: 'buffer' });

    // Format B: Laporan Keuangan Earnings Report (OrderDetails)
    const firstSheetName = wb.SheetNames[0];
    const firstGrid = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[firstSheetName], {
      header: 1,
      defval: '',
      raw: true,
    });

    const row0 = (firstGrid[0] as any[])?.map((h) => String(h ?? '').trim()) ?? [];
    const isEarningsDetails =
      row0.includes('Voucher redemption date') && row0.includes('Total settlement amount');

    if (isEarningsDetails) {
      const col = (name: string) => row0.indexOf(name);
      const cStoreId = col('Store ID');
      const cStoreName = col('Store name');
      const cRedempDate = col('Voucher redemption date');
      const cBase = col('Commission base');
      const cComm = col('Total commission');
      const cPay = col('Payment amount');
      const cPlat = col('Platform incentive');

      const out: SettlementRow[] = [];
      for (let i = 1; i < firstGrid.length; i++) {
        const r = firstGrid[i];
        if (!r || !r[cStoreId]) continue;

        const date = normalizeDate(r[cRedempDate]);
        if (!date) continue;

        const base = parsePlainNumber(r[cBase]);
        const payment = parsePlainNumber(r[cPay]);
        const platformInc = parsePlainNumber(r[cPlat]);
        const omzetKotor = base > 0 ? base : payment + platformInc;
        if (omzetKotor <= 0) continue;

        const commission = cComm >= 0 ? parsePlainNumber(r[cComm]) : 0;
        const promoMerchant = 0;

        const storeId = String(r[cStoreId] ?? '').trim();
        const storeName = cStoreName >= 0 ? String(r[cStoreName] ?? '').trim() : storeId;

        out.push({
          storeId,
          storeName,
          date,
          omzetKotor,
          promoMerchant,
          commission,
        });
      }

      if (out.length === 0) {
        throw new Error('Tidak ada data voucher valid di file Earnings Report TikTok Go ini.');
      }
      return out;
    }

    // Format A: Laporan Orders Harian (.xlsx, sheet "order detail", header baris 4)
    const sheetName = wb.SheetNames.includes(SHEET) ? SHEET : wb.SheetNames[0];
    const grid = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: '',
      raw: true,
    });
    if (grid.length <= HEADER_ROW + 1) {
      throw new Error(`Tidak ada data terbaca dari file TikTok Go (sheet: ${sheetName}).`);
    }

    const header = (grid[HEADER_ROW] as any[]).map((h) => String(h ?? '').trim());
    const col = (name: string) => {
      const i = header.indexOf(name);
      if (i === -1) throw new Error(`Kolom "${name}" tidak ada di file TikTok Go.`);
      return i;
    };
    const colOpt = (name: string) => header.indexOf(name);

    const cLocation = col('Redemption location');
    const cTime = col('Redemption time');
    const cStatus = col('Item order status');
    const cPayment = col('Payment amount');
    const cPlatformInc = col('Platform incentive');
    const cMerchantInc = colOpt('Merchant incentive');
    const cSettlement = col('Settlement amount');

    const out: SettlementRow[] = [];
    for (let i = HEADER_ROW + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r) continue;
      if (String(r[cStatus] ?? '').trim().toLowerCase() !== STATUS_OK) continue;

      const date = normalizeDate(r[cTime]);
      if (!date) continue;

      const payment = parsePlainNumber(r[cPayment]);
      const platformIncentive = parsePlainNumber(r[cPlatformInc]);
      const settlement = parsePlainNumber(r[cSettlement]);

      // Omzet Kotor Hak Merchant = Uang Pelanggan + Subsidi TikTok (Base Merchant).
      // Angka inilah yang persis sama dengan harga menu voucher di POS Kasir SS.
      const baseMerchant = payment + platformIncentive;
      if (baseMerchant <= 0) continue;

      // Diskon Merchant Murni = Kolom V ("Merchant incentive").
      // Subsidi TikTok ("Platform incentive") adalah hak resto 100%, BUKAN potongan toko.
      const promoMerchant = cMerchantInc >= 0 ? parsePlainNumber(r[cMerchantInc]) : 0;

      // Komisi platform dihitung jika voucher sudah berstatus settled di sistem TikTok.
      const commission = settlement > 0 ? Math.max(0, baseMerchant - settlement) : 0;

      const location = String(r[cLocation] ?? '').trim();
      out.push({
        storeId: location,
        storeName: location,
        date,
        omzetKotor: baseMerchant,
        promoMerchant,
        commission,
      });
    }

    if (out.length === 0) {
      throw new Error('Tidak ada transaksi berstatus "Fulfilled" di file TikTok Go ini.');
    }
    return out;
  },
};
