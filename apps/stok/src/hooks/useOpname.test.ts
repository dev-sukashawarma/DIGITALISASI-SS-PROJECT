import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getEffectiveTodayWIB } from './useOpname'

describe('getEffectiveTodayWIB', () => {
  const JATIWARINGIN_ID = '550e8400-e29b-41d4-a716-446655440010'

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 2026-08-29 for Jatiwaringin on 2026-08-30 when Aug 29 opname is not finalized yet', async () => {
    // Set current time to 2026-08-30 in WIB (UTC+7)
    vi.setSystemTime(new Date('2026-08-30T04:00:00.000Z')) // 11:00 WIB

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          // Returns count 0
          then: (resolve: any) => resolve({ count: 0, error: null }),
        }),
      }),
    }

    const effectiveDate = await getEffectiveTodayWIB(JATIWARINGIN_ID, mockSupabase)
    expect(effectiveDate).toBe('2026-08-29')
  })

  it('returns 2026-08-30 for Jatiwaringin on 2026-08-30 when Aug 29 opname is already finalized', async () => {
    vi.setSystemTime(new Date('2026-08-30T04:00:00.000Z')) // 11:00 WIB

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          // Returns count 1
          then: (resolve: any) => resolve({ count: 1, error: null }),
        }),
      }),
    }

    const effectiveDate = await getEffectiveTodayWIB(JATIWARINGIN_ID, mockSupabase)
    expect(effectiveDate).toBe('2026-08-30')
  })

  it('returns today for normal outlet on 2026-08-30', async () => {
    vi.setSystemTime(new Date('2026-08-30T04:00:00.000Z'))

    const mockSupabase = {
      from: vi.fn(),
    }

    const otherOutletId = 'some-other-outlet-id'
    const effectiveDate = await getEffectiveTodayWIB(otherOutletId, mockSupabase)
    expect(effectiveDate).toBe('2026-08-30')
  })
})
