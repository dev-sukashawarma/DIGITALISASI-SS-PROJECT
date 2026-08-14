import { PlatformParser, SettlementRow, parsePlainNumber, parseTextDate, parseCsvText } from './types';

// Laporan settlement GrabFood (.csv, ~68 kolom). Bedanya dengan ShopeeFood:
//   - format CSV, angka polos ("39000", "-772.97") — titik = desimal, BUKAN ribuan
//   - tanggal gaya "28 Jul 2026 8:07 PM"
//   - komisi bernilai NEGATIF dan tersebar di banyak kolom (Order commission, Grab Fee,
//     Delivery Commission, dll). Kolom mana yang terisi berbeda-beda per jenis transaksi,
//     jadi komisi diturunkan dari selisih Net Sales vs Total, bukan menjumlah kolom komisi
//     satu per satu — lebih tahan banting kalau Grab memakai kolom komisi lain di kemudian hari.
//
// Baris berstatus selain "Transferred" (mis. "Cancelled") tidak punya nilai uang sama sekali
// dan sengaja dilewati.

const STATUS_SETTLED = 'transferred';

export const grabfoodParser: PlatformParser = {
  id: 'grabfood',
  label: 'GrabFood',
  accept: '.csv',

  parse(buffer: ArrayBuffer): SettlementRow[] {
    const text = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
    const rows = parseCsvText(text);
    if (rows.length < 2) throw new Error('File GrabFood kosong atau tidak terbaca.');

    const header = rows[0].map((h) => h.trim());
    const col = (name: string) => {
      const i = header.indexOf(name);
      if (i === -1) throw new Error(`Kolom "${name}" tidak ada di file GrabFood.`);
      return i;
    };

    const cStoreId = col('Store ID');
    const cStoreName = col('Store Name');
    const cCreated = col('Created On');
    const cStatus = col('Status');
    const cAmount = col('Amount');
    const cNetSales = col('Net Sales');
    const cTotal = col('Total');

    const out: SettlementRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < header.length / 2) continue;
      if ((r[cStatus] ?? '').trim().toLowerCase() !== STATUS_SETTLED) continue;

      const omzetKotor = parsePlainNumber(r[cAmount]);
      if (omzetKotor <= 0) continue;

      const date = parseTextDate(r[cCreated]);
      if (!date) continue;

      // Amount -> (potong diskon merchant) -> Net Sales -> (potong komisi) -> Total
      const netSales = parsePlainNumber(r[cNetSales]);
      const total = parsePlainNumber(r[cTotal]);
      const promoMerchant = Math.max(0, omzetKotor - netSales);
      const commission = Math.max(0, netSales - total);

      out.push({
        storeId: String(r[cStoreId] ?? '').trim(),
        storeName: String(r[cStoreName] ?? '').trim(),
        date,
        omzetKotor,
        promoMerchant,
        commission,
      });
    }

    if (out.length === 0) {
      throw new Error('Tidak ada transaksi berstatus "Transferred" di file GrabFood ini.');
    }
    return out;
  },
};
