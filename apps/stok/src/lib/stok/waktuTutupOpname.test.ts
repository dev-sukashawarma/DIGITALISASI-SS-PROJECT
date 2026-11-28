import { describe, it, expect } from 'vitest'
import { pilihOpnameSebelumValid, pilihWaktuTutupOpname } from './waktuTutupOpname'

const op = { created_at: '2026-10-21T10:34:06Z', updated_at: '2026-10-21T15:13:26Z', status: 'finalized' }

describe('pilihWaktuTutupOpname', () => {
  it('memakai waktu baris opname_selisih, bukan saat draf dibuat', () => {
    expect(pilihWaktuTutupOpname(op, '2026-10-21T15:13:26.2Z')).toBe('2026-10-21T15:13:26.2Z')
  })

  it('opname finalized tanpa baris ledger memakai finalized_at lalu updated_at', () => {
    expect(
      pilihWaktuTutupOpname(
        { ...op, finalized_at: '2026-10-21T15:10:00Z', updated_at: '2026-10-25T10:00:00Z' },
        null
      )
    ).toBe('2026-10-21T15:10:00Z')
    expect(pilihWaktuTutupOpname(op, null)).toBe(op.updated_at)
  })

  it('belum finalized dan tanpa ledger: jatuh ke created_at', () => {
    expect(pilihWaktuTutupOpname({ ...op, status: 'pending_approval' }, null)).toBe(op.created_at)
  })
})

describe('pilihOpnameSebelumValid', () => {
  it('melewati opname telat finalisasi (waktuTutup >= endIso) dan mundur ke opname valid sebelumnya', async () => {
    const ledgerByOp: Record<string, string> = {
      'op-nov1': '2026-11-05T14:20:40Z', // 05 Nov 21:20 WIB (telat 4 hari)
      'op-oct31': '2026-10-31T16:30:26Z', // 31 Okt 23:30 WIB (valid)
    }
    const mockSb = {
      from() {
        let opId = ''
        const q: any = {
          select: () => q,
          eq: (_c: string, v: string) => {
            opId = v
            return q
          },
          order: () => q,
          limit: () => q,
          maybeSingle: () =>
            Promise.resolve({ data: ledgerByOp[opId] ? { created_at: ledgerByOp[opId] } : null }),
        }
        return q
      },
    }

    const res = await pilihOpnameSebelumValid(
      mockSb,
      [
        {
          id: 'op-nov1',
          created_at: '2026-11-01T15:39:22Z',
          updated_at: '2026-11-05T14:20:40Z',
          status: 'finalized',
        },
        {
          id: 'op-oct31',
          created_at: '2026-10-31T15:27:34Z',
          updated_at: '2026-10-31T16:30:26Z',
          status: 'finalized',
        },
      ],
      '2026-11-02T15:42:08Z' // 02 Nov 22:42 WIB
    )

    expect(res?.opname.id).toBe('op-oct31')
    expect(res?.waktuTutup).toBe('2026-10-31T16:30:26Z')
  })
})
