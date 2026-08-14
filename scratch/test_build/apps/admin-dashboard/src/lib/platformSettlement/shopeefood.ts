import * as xlsx from 'xlsx';
import { PlatformParser, SettlementRow, parseIdNumber, parseSlashDate } from './types';

// Laporan settlement ShopeeFood (.xlsx). Sheet yang dipakai: "Order_Payment_Details"
// (level transaksi, lengkap dengan Commission). Sheet lain sengaja diabaikan:
//   - "Overall"    : ringkasan wallet, angkanya duplikat dari sheet ini
//   - "Adjustment" : potongan komplain customer (di luar cakupan modul ini)
//   - "Ads_Deduction": biaya iklan (di luar cakupan modul ini)
//
// Angka ditulis gaya Indonesia ("39.000" = tiga puluh sembilan ribu), tanggal MM/DD/YYYY.

const SHEET = 'Order_Payment_Details';

export const shopeefoodParser: PlatformParser = {
  id: 'shopeefood',
  label: 'ShopeeFood',
  accept: '.xlsx,.xls',

  parse(buffer: ArrayBuffer): SettlementRow[] {
    const wb = xlsx.read(buffer, { type: 'buffer' });
    if (!wb.SheetNames.includes(SHEET)) {
      throw new Error(
        `Sheet "${SHEET}" tidak ditemukan. Pastikan ini file settlement ShopeeFood ` +
        `(sheet yang ada: ${wb.SheetNames.join(', ')}).`
      );
    }

    const rows = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[SHEET], { header: 1 });
    if (rows.length < 2) throw new Error(`Sheet "${SHEET}" kosong.`);

    const header = (rows[0] as string[]).map((h) => String(h ?? '').trim());
    const col = (name: string) => {
      const i = header.indexOf(name);
      if (i === -1) throw new Error(`Kolom "${name}" tidak ada di file ShopeeFood.`);
      return i;
    };

    const cStoreId = col('Store ID');
    const cStoreName = col('Store Name');
    const cCreate = col('Order Create Time');
    const cAmount = col('Order Amount');
    const cTotal = col('Total');
    const cCommission = col('Commission');

    const out: SettlementRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[cStoreId]) continue;

      const omzetKotor = parseIdNumber(r[cAmount]);
      if (omzetKotor <= 0) continue;

      const date = parseSlashDate(r[cCreate]);
      if (!date) continue;

      // Promo dihitung dari selisih Order Amount vs Total, bukan menjumlah kolom subsidi
      // satu per satu. Alasannya: Total adalah dasar perhitungan Commission, jadi selisih
      // ini pasti konsisten dengan aritmatika file — dan tetap benar kalau suatu saat
      // ShopeeFood menambah jenis subsidi baru yang belum kita kenal kolomnya.
      const total = parseIdNumber(r[cTotal]);
      const promoMerchant = Math.max(0, omzetKotor - total);

      out.push({
        storeId: String(r[cStoreId]).trim(),
        storeName: String(r[cStoreName] ?? '').trim(),
        date,
        omzetKotor,
        promoMerchant,
        commission: Math.abs(parseIdNumber(r[cCommission])),
      });
    }

    if (out.length === 0) {
      throw new Error('Tidak ada baris transaksi yang bisa dibaca dari file ShopeeFood ini.');
    }
    return out;
  },
};
