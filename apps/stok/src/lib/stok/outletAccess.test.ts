import { describe, it, expect } from 'vitest'
import { parseAccessibleOutletIds, assertOutletAccessible } from './outletAccess'

describe('parseAccessibleOutletIds', () => {
  it('handles array of plain string values', () => {
    const result = parseAccessibleOutletIds(['outlet-a', 'outlet-b'])
    expect(result).toEqual(new Set(['outlet-a', 'outlet-b']))
  })

  it('handles array of single-key objects (older PostgREST shape)', () => {
    const result = parseAccessibleOutletIds([
      { accessible_outlet_ids: 'outlet-a' },
      { accessible_outlet_ids: 'outlet-b' },
    ])
    expect(result).toEqual(new Set(['outlet-a', 'outlet-b']))
  })

  it('returns empty set for null/undefined/non-array input', () => {
    expect(parseAccessibleOutletIds(null)).toEqual(new Set())
    expect(parseAccessibleOutletIds(undefined)).toEqual(new Set())
    expect(parseAccessibleOutletIds('not-an-array')).toEqual(new Set())
  })

  it('drops falsy entries instead of crashing', () => {
    const result = parseAccessibleOutletIds([{ accessible_outlet_ids: undefined }, null, 'outlet-a'])
    expect(result).toEqual(new Set(['outlet-a']))
  })
})

describe('assertOutletAccessible', () => {
  it('resolves silently when outlet is in the accessible set', async () => {
    const supabase = { rpc: async () => ({ data: ['outlet-a', 'outlet-b'], error: null }) }
    await expect(assertOutletAccessible(supabase, 'outlet-b')).resolves.toBeUndefined()
  })

  it('throws Forbidden when outlet is not in the accessible set (e.g. leader outside staff_outlets)', async () => {
    const supabase = { rpc: async () => ({ data: ['outlet-a'], error: null }) }
    await expect(assertOutletAccessible(supabase, 'outlet-b')).rejects.toThrow('Forbidden')
  })

  it('propagates RPC errors instead of silently allowing access', async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: 'db down' } }) }
    await expect(assertOutletAccessible(supabase, 'outlet-a')).rejects.toThrow('db down')
  })
})
