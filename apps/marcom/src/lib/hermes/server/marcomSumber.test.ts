import { describe, it, expect, vi } from 'vitest'
import { buatKonteksMarcomPrisma, filterOutletBukanTes } from './marcomSumber'

describe('marcomSumber (Prisma loader)', () => {
  it('mengecualikan outlet tes pada query filter', () => {
    expect(filterOutletBukanTes.NOT.OR).toEqual([
      { posType: { in: ['test', 'system'] } },
      { name: { contains: 'tes', mode: 'insensitive' } },
    ])
  })

  it('memetakan data endorsement dari prisma dengan benar', async () => {
    const mockPrisma = {
      endorsement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 101n,
            kol: { name: 'Jessica Foodie' },
            outlet: { name: 'SS Karanganyar' },
            scheduleDate: new Date('2026-10-08T00:00:00Z'),
            visitStatus: 'VISITED',
            draftStatus: 'PENDING',
            postStatus: 'DRAFT',
            paymentStatus: 'UNPAID',
            rateCard: '1500000',
            type: 'VISIT',
            postUrl: null,
            posts: [],
            finalViews: null,
            initialViews: null,
            likes: 0,
          },
        ]),
      },
      internalContent: { findMany: vi.fn().mockResolvedValue([]) },
      outlet: { findMany: vi.fn().mockResolvedValue([]) },
      ad: { findMany: vi.fn().mockResolvedValue([]) },
      promoEvent: { findMany: vi.fn().mockResolvedValue([]) },
    } as any

    const konteks = buatKonteksMarcomPrisma(
      mockPrisma,
      new Date('2026-10-08T10:00:00+07:00')
    )
    const list = await konteks.daftarEndorsement()

    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: '101',
      kol_nama: 'Jessica Foodie',
      outlet_nama: 'SS Karanganyar',
      rate_card: 1500000,
      visit_status: 'VISITED',
      draft_status: 'PENDING',
    })
  })
})
