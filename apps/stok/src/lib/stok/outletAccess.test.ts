import { describe, it, expect, vi } from 'vitest'
import {
  parseAccessibleOutletIds,
  assertStaffCanAccessOutlet,
  getStaffAccessibleOutletIds,
} from './outletAccess'

describe('parseAccessibleOutletIds', () => {
  it('handles array of string IDs', () => {
    const res = parseAccessibleOutletIds(['out-1', 'out-2'])
    expect(res.has('out-1')).toBe(true)
    expect(res.has('out-2')).toBe(true)
    expect(res.size).toBe(2)
  })

  it('handles array of objects with accessible_outlet_ids property', () => {
    const res = parseAccessibleOutletIds([
      { accessible_outlet_ids: 'out-1' },
      { accessible_outlet_ids: 'out-2' },
    ])
    expect(res.has('out-1')).toBe(true)
    expect(res.has('out-2')).toBe(true)
    expect(res.size).toBe(2)
  })

  it('handles empty or non-array input', () => {
    expect(parseAccessibleOutletIds(null).size).toBe(0)
    expect(parseAccessibleOutletIds(undefined).size).toBe(0)
    expect(parseAccessibleOutletIds([]).size).toBe(0)
  })
})

describe('assertStaffCanAccessOutlet', () => {
  it('allows privileged roles to access any outlet', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'staff-1', role: 'kitchen', outlet_id: 'out-1', status: 'active' },
          error: null,
        }),
      }),
    }

    await expect(
      assertStaffCanAccessOutlet(mockClient, 'staff-1', 'any-outlet')
    ).resolves.toBeUndefined()
  })

  it('allows crew to access their assigned primary outlet', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'staff-crew', role: 'crew', outlet_id: 'out-empang', status: 'active' },
          error: null,
        }),
      }),
    }

    await expect(
      assertStaffCanAccessOutlet(mockClient, 'staff-crew', 'out-empang')
    ).resolves.toBeUndefined()
  })

  it('forbids crew from accessing other outlets', async () => {
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              data: { id: 'staff-crew', role: 'crew', outlet_id: 'out-empang', status: 'active' },
              error: null,
            })
          }
          return Promise.resolve({ data: null, error: null })
        }),
      }),
    }

    await expect(
      assertStaffCanAccessOutlet(mockClient, 'staff-crew', 'out-other')
    ).rejects.toThrow('Forbidden: outlet di luar scope akses Anda')
  })

  it('throws when staff is inactive or not found', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'staff-inactive', role: 'crew', outlet_id: 'out-empang', status: 'inactive' },
          error: null,
        }),
      }),
    }

    await expect(
      assertStaffCanAccessOutlet(mockClient, 'staff-inactive', 'out-empang')
    ).rejects.toThrow('Staff tidak aktif atau tidak ditemukan')
  })
})

describe('getStaffAccessibleOutletIds', () => {
  it('returns all active outlets for privileged roles', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'outlet_staff') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'staff-admin', role: 'admin', outlet_id: null, status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'outlets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'out-1' }, { id: 'out-2' }],
              error: null,
            }),
          }
        }
        return {}
      }),
    }

    const ids = await getStaffAccessibleOutletIds(mockClient, 'staff-admin')
    expect(ids.has('out-1')).toBe(true)
    expect(ids.has('out-2')).toBe(true)
    expect(ids.size).toBe(2)
  })

  it('returns assigned outlets for non-privileged staff', async () => {
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'outlet_staff') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'staff-leader', role: 'leader', outlet_id: 'out-main', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'staff_outlets') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ outlet_id: 'out-branch-1' }, { outlet_id: 'out-branch-2' }],
              error: null,
            }),
          }
        }
        return {}
      }),
    }

    const ids = await getStaffAccessibleOutletIds(mockClient, 'staff-leader')
    expect(ids.has('out-main')).toBe(true)
    expect(ids.has('out-branch-1')).toBe(true)
    expect(ids.has('out-branch-2')).toBe(true)
    expect(ids.size).toBe(3)
  })
})
