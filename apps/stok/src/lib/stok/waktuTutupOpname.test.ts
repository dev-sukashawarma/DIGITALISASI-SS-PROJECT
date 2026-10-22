import { describe, it, expect } from 'vitest'
import { pilihWaktuTutupOpname } from './waktuTutupOpname'

const op = { created_at: '2026-10-21T10:34:06Z', updated_at: '2026-10-21T15:13:26Z', status: 'finalized' }

describe('pilihWaktuTutupOpname', () => {
  it('memakai waktu baris opname_selisih, bukan saat draf dibuat', () => {
    expect(pilihWaktuTutupOpname(op, '2026-10-21T15:13:26.2Z')).toBe('2026-10-21T15:13:26.2Z')
  })

  it('opname finalized tanpa baris ledger memakai updated_at', () => {
    expect(pilihWaktuTutupOpname(op, null)).toBe(op.updated_at)
  })

  it('belum finalized dan tanpa ledger: jatuh ke created_at', () => {
    expect(pilihWaktuTutupOpname({ ...op, status: 'pending_approval' }, null)).toBe(op.created_at)
  })
})
