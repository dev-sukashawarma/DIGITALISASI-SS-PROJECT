import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import { gofoodParser, parseAnyDate } from './gofood';

describe('parseAnyDate', () => {
  it('parses Excel serial date numbers', () => {
    // 46231 corresponds to around 2026-07-27
    const dateStr = parseAnyDate(46231);
    expect(dateStr).toMatch(/^2026-\d{2}-\d{2}$/);
  });

  it('parses ISO format', () => {
    expect(parseAnyDate('2026-10-01T14:30:00+07:00')).toBe('2026-10-01');
    expect(parseAnyDate('2026-09-15')).toBe('2026-09-15');
  });

  it('parses DD-MM-YYYY format', () => {
    expect(parseAnyDate('15-09-2026')).toBe('2026-09-15');
    expect(parseAnyDate('01-10-2026 10:20:00')).toBe('2026-10-01');
  });

  it('parses text format (Grab/GoBiz style)', () => {
    expect(parseAnyDate('28 Jul 2026 8:07 PM')).toBe('2026-07-28');
  });
});

describe('gofoodParser', () => {
  it('parses standard GoFood Midtrans Payments worksheet', () => {
    const data = [
      ['Merchant ID', 'Waktu transaksi', 'Penjualan', 'Total Biaya', 'Promo yang ditanggung Mitra Usaha'],
      ['G973507430', '2026-09-15', 50000, 15000, 5000],
      ['G973507430', '2026-09-15', 75000, 20000, 8000],
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Midtrans Payments');
    const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = gofoodParser.parse(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      storeId: 'G973507430',
      storeName: 'G973507430',
      date: '2026-09-15',
      omzetKotor: 50000,
      promoMerchant: 5000,
      commission: 10000, // 15000 totalBiaya - 5000 promoMerchant
    });
    expect(rows[1]).toEqual({
      storeId: 'G973507430',
      storeName: 'G973507430',
      date: '2026-09-15',
      omzetKotor: 75000,
      promoMerchant: 8000,
      commission: 12000,
    });
  });

  it('handles metadata rows before header (header at row 2)', () => {
    const data = [
      ['Laporan Settlement GoBiz', '', '', '', ''],
      ['Periode: September 2026', '', '', '', ''],
      ['ID Merchant', 'Waktu Transaksi', 'Gross Amount', 'Total Fee', 'Promo Merchant'],
      ['G123456789', '2026-09-20', 60000, 18000, 6000],
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Transactions');
    const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = gofoodParser.parse(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      storeId: 'G123456789',
      storeName: 'G123456789',
      date: '2026-09-20',
      omzetKotor: 60000,
      promoMerchant: 6000,
      commission: 12000,
    });
  });

  it('captures storeName when outlet name column is available', () => {
    const data = [
      ['Merchant ID', 'Nama Outlet', 'Waktu transaksi', 'Penjualan', 'Total Biaya', 'Promo Merchant'],
      ['G973507430', 'Suka Shawarma Cibubur', '2026-09-25', 100000, 25000, 10000],
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = gofoodParser.parse(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].storeName).toBe('Suka Shawarma Cibubur');
  });

  it('parses actual GoBiz export with Amount, Net Amount, and Merchant Promo Contribution', () => {
    const data = [
      ['Outlet name', 'Merchant ID', 'Feature', 'Nomor pesanan', 'Transaction ID', 'Amount', 'Net Amount', 'Waktu transaksi', 'Payment Type', 'Gopay promo', 'Promo Type', 'Promo Name', 'Merchant Promo Contribution', 'Voucher Description', 'GoFood discount', 'Biaya pemberian voucher'],
      ['SUKA SHAWARMA, PAJAJARAN', 'G661846537', 'goresto_online', 'F-123', 'tx-1', 51000, 38396, 46295.91, 'GO-PAY', 0, '', '', 0, '', '1755.0', '0.0'],
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Midtrans Payments');
    const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = gofoodParser.parse(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      storeId: 'G661846537',
      storeName: 'SUKA SHAWARMA, PAJAJARAN',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      omzetKotor: 51000,
      promoMerchant: 0,
      commission: 12604, // 51000 - 38396
    });
  });

  it('throws descriptive error if required columns are missing', () => {
    const data = [
      ['Kolom 1', 'Kolom 2'],
      ['ABC', 'DEF'],
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

    expect(() => gofoodParser.parse(buf)).toThrowError(/Merchant ID/i);
  });
});
