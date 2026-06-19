import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@suka/auth', () => ({
  useAuth: () => ({ session: { access_token: 'tok' } }),
}))
const createStaff = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/lib/adminApi', () => ({ adminApi: { createStaff: (...a: unknown[]) => createStaff(...a) } }))

import { useStaffMutations } from './useStaffMutations'

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useStaffMutations', () => {
  beforeEach(() => createStaff.mockClear())

  it('invalidates ["staff"] after a successful create', async () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useStaffMutations(), { wrapper: wrapper(client) })

    await result.current.create.mutateAsync({
      name: 'A', username: 'a', password: 'secret', role: 'crew', outlet_id: 'o1', outlet_ids: [],
    })

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['staff'] }))
    expect(createStaff).toHaveBeenCalledWith('tok', expect.objectContaining({ name: 'A' }))
  })
})
