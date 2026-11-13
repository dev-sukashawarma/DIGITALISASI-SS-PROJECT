import { describe, expect, it } from 'vitest'
import { pisahkanHasil } from './pisahkanHasil'

describe('pisahkanHasil', () => {
  it('hasil yang gagal tidak mengosongkan daftar; namanya dilaporkan', () => {
    const hasil: PromiseSettledResult<number>[] = [
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: new Error('x') },
      { status: 'fulfilled', value: 3 },
    ]
    expect(pisahkanHasil(hasil, ['A', 'B', 'C'])).toEqual({ ok: [1, 3], gagal: ['B'] })
  })
})
