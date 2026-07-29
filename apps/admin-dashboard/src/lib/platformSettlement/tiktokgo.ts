import * as xlsx from 'xlsx';
import { PlatformParser, SettlementRow, parsePlainNumber } from './types';

// Laporan TikTok Go (.xlsx, sheet "order detail"). Modelnya berbeda dari tiga platform
// lain: TikTok memakai skema VOUCHER — pelanggan membeli voucher di aplikasi lalu
// menukarkannya di outlet. Karena itu:
//
//  - Baris data adalah level ITEM (satu voucher), bukan level order.
//  - Header sebenarnya ada di BARIS KE-4; tiga baris pertama berisi ringkasan
//    (Total / Item order number / Order fulfillment amount / Total settlement amount).
//  - Tanggal yang relevan adalah "Redemption time" (saat ditukarkan di outlet),
//    bukan saat voucher dibeli.
//  - Tidak ada ID toko numerik — pemetaan outlet mengandalkan "Redemption location".
//
// Alur uang: Original price -> (potong voucher) -> Payment amount -> (potong komisi)
// -> Settlement amount. Sebagian potongan voucher disubsidi TikTok lewat kolom
// "Platform incentive"; sisanya ditanggung merchant.
//
// PENTING — baris belum settled: transaksi yang baru ditukarkan belum punya
// "Settlement amount" (pada file contoh: 110 dari 563 baris). Komisinya belum bisa
// diketahui, jadi dicatat 0. Konsekuensinya komisi beberapa hari terakhir akan
// tampak lebih kecil dari kenyataan sampai laporan periode berikutnya diunggah —
// upload ulang akan memperbaiki angkanya karena penyimpanan bersifat upsert.

const SHEET = 'order detail';
const HEADER_ROW = 3;
const STATUS_OK = 'fulfilled';

export const tiktokgoParser: PlatformParser = {
  id: 'tiktokgo',
  label: 'TikTok Go',
  accept: '.xlsx,.xls',

  parse(buffer: ArrayBuffer): SettlementRow[] {
    const wb = xlsx.read(buffer, { type: 'buffer' });
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

    const cLocation = col('Redemption location');
    const cTime = col('Redemption time');
    const cStatus = col('Item order status');
    const cOriginal = col('Original price');
    const cPayment = col('Payment amount');
    const cPlatformInc = col('Platform incentive');
    const cSettlement = col('Settlement amount');
    const cOrderId = col('Store order ID');

    const out: SettlementRow[] = [];
    for (let i = HEADER_ROW + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r) continue;
      if (String(r[cStatus] ?? '').trim().toLowerCase() !== STATUS_OK) continue;

      const omzetKotor = parsePlainNumber(r[cOriginal]);
      if (omzetKotor <= 0) continue;

      const date = String(r[cTime] ?? '').trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const payment = parsePlainNumber(r[cPayment]);
      const platformIncentive = parsePlainNumber(r[cPlatformInc]);
      const settlement = parsePlainNumber(r[cSettlement]);

      // Yang dikreditkan ke merchant sebelum komisi = uang pelanggan + subsidi TikTok.
      // Ini penting: pada sebagian baris Settlement > Payment justru karena subsidi
      // ikut masuk, sehingga "Payment - Settlement" saja akan menghitung komisi negatif.
      const baseMerchant = payment + platformIncentive;
      // Potongan voucher yang benar-benar ditanggung merchant.
      const promoMerchant = Math.max(0, omzetKotor - baseMerchant);
      // Belum settled -> komisi belum diketahui (0), lihat catatan di atas.
      const commission = settlement > 0 ? Math.max(0, baseMerchant - settlement) : 0;

      const location = String(r[cLocation] ?? '').trim();
      const orderId = String(r[cOrderId] ?? '').trim();

      out.push({
        storeId: location, // laporan TikTok tidak memuat ID toko numerik
        storeName: location,
        date,
        omzetKotor,
        promoMerchant,
        commission,
        orderId,
      });
    }

    if (out.length === 0) {
      throw new Error('Tidak ada transaksi berstatus "Fulfilled" di file TikTok Go ini.');
    }
    return out;
  },
};
