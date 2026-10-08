import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import { tiktokgoParser } from './tiktokgo';

describe('tiktokgoParser', () => {
  it('parses TikTok Go Earnings Reports with voucher redemption dates', () => {
    const data = [
      [
        'Store ID',
        'Store name',
        'Voucher redemption date',
        'Commission base',
        'Payment amount',
        'Platform incentive',
        'Total commission',
        'Total settlement amount',
      ],
      // Row 1: August 28 (late August cycle)
      ['TT_STORE_01', 'SS Margonda', '2026-08-28 14:00:00', 50000, 45000, 5000, 2000, 48000],
      // Row 2: September 15 (in September period)
      ['TT_STORE_01', 'SS Margonda', '2026-09-15 12:30:00', 60000, 50000, 10000, 2400, 57600],
      // Row 3: September 30 (in September period)
      ['TT_STORE_02', 'SS Kisamaun', '2026-09-30 19:20:00', 70000, 60000, 10000, 2800, 67200],
      // Row 4: October 03 (early October payout)
      ['TT_STORE_01', 'SS Margonda', '2026-10-03 11:15:00', 40000, 35000, 5000, 1600, 38400],
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Earnings');
    const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = tiktokgoParser.parse(buf);
    expect(rows).toHaveLength(4);

    // Verify all 4 rows are extracted with correct dates
    expect(rows[0].date).toBe('2026-08-28');
    expect(rows[1].date).toBe('2026-09-15');
    expect(rows[2].date).toBe('2026-09-30');
    expect(rows[3].date).toBe('2026-10-03');

    // Filter simulation: only September rows (2026-09-01 s/d 2026-09-30)
    const septemberRows = rows.filter((r) => r.date >= '2026-09-01' && r.date <= '2026-09-30');
    expect(septemberRows).toHaveLength(2);
    expect(septemberRows.map((r) => r.date)).toEqual(['2026-09-15', '2026-09-30']);
  });
});
