import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OutletScopeProvider, useOutletScope } from '../useOutletScope'

const mockUseAuth = vi.fn()
vi.mock('@suka/auth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockEq = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => mockEq(...args),
      }),
    }),
  }),
}))

function Probe() {
  const { boundOutlets, selectedOutletId, isMultiOutlet, setSelectedOutletId } = useOutletScope()
  return (
    <div>
      <span data-testid="count">{boundOutlets.length}</span>
      <span data-testid="selected">{selectedOutletId ?? 'none'}</span>
      <span data-testid="multi">{String(isMultiOutlet)}</span>
      <button onClick={() => setSelectedOutletId('outlet-b')}>pick-b</button>
      <button onClick={() => setSelectedOutletId('not-bound')}>pick-invalid</button>
    </div>
  )
}

function renderProbe() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <OutletScopeProvider>
        <Probe />
      </OutletScopeProvider>
    </QueryClientProvider>
  )
}

describe('useOutletScope', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockEq.mockReset()
  })

  it('fixes single-outlet role (kasir) to outlet_staff.outlet_id, switcher hidden', async () => {
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-1', role: 'crew', outlet_id: 'outlet-home', outlets: { name: 'Outlet Home' } },
    })
    renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('outlet-home')
    })
    expect(screen.getByTestId('multi')).toHaveTextContent('false')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('fetches staff_outlets and defaults to first bound outlet for leader', async () => {
    mockEq.mockResolvedValue({
      data: [
        { outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } },
        { outlet_id: 'outlet-b', outlets: { id: 'outlet-b', name: 'Outlet B' } },
      ],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('outlet-a')
    })
    expect(screen.getByTestId('multi')).toHaveTextContent('true')
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })

  it('restores previously selected outlet from localStorage if still bound', async () => {
    window.localStorage.setItem('stok:selectedOutletId:staff-leader', 'outlet-b')
    mockEq.mockResolvedValue({
      data: [
        { outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } },
        { outlet_id: 'outlet-b', outlets: { id: 'outlet-b', name: 'Outlet B' } },
      ],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('outlet-b')
    })
  })

  it('falls back to first bound outlet if stored selection is no longer bound', async () => {
    window.localStorage.setItem('stok:selectedOutletId:staff-leader', 'outlet-stale')
    mockEq.mockResolvedValue({
      data: [{ outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } }],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('outlet-a')
    })
  })

  it('setSelectedOutletId rejects ids outside boundOutlets and persists valid ones', async () => {
    mockEq.mockResolvedValue({
      data: [
        { outlet_id: 'outlet-a', outlets: { id: 'outlet-a', name: 'Outlet A' } },
        { outlet_id: 'outlet-b', outlets: { id: 'outlet-b', name: 'Outlet B' } },
      ],
      error: null,
    })
    mockUseAuth.mockReturnValue({
      outletStaff: { id: 'staff-leader', role: 'leader', outlet_id: null, outlets: null },
    })
    renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent('outlet-a')
    })

    act(() => screen.getByText('pick-invalid').click())
    expect(screen.getByTestId('selected')).toHaveTextContent('outlet-a')

    act(() => screen.getByText('pick-b').click())
    expect(screen.getByTestId('selected')).toHaveTextContent('outlet-b')
    expect(window.localStorage.getItem('stok:selectedOutletId:staff-leader')).toBe('outlet-b')
  })
})
