import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonitoringPage } from '../MonitoringPage'

const mockUseAuth = vi.fn()
vi.mock('@suka/auth', () => ({ useAuth: () => mockUseAuth() }))

const mockUseOutletScope = vi.fn()
vi.mock('@/hooks/useOutletScope', () => ({ useOutletScope: () => mockUseOutletScope() }))

vi.mock('../SPVDashboard', () => ({
  SPVDashboard: ({ allowedOutletIds }: { allowedOutletIds?: string[] }) => (
    <div data-testid="spv-dashboard">{JSON.stringify(allowedOutletIds ?? null)}</div>
  ),
}))
vi.mock('../CrewDashboard', () => ({
  CrewDashboard: () => <div data-testid="crew-dashboard" />,
}))

describe('MonitoringPage', () => {
  it('renders CrewDashboard for crew role', () => {
    mockUseAuth.mockReturnValue({ outletStaff: { role: 'crew' }, loading: false })
    mockUseOutletScope.mockReturnValue({ boundOutlets: [], isMultiOutlet: false })
    render(<MonitoringPage />)
    expect(screen.getByTestId('crew-dashboard')).toBeInTheDocument()
  })

  it('renders SPVDashboard with no allowedOutletIds restriction for spv role', () => {
    mockUseAuth.mockReturnValue({ outletStaff: { role: 'spv' }, loading: false })
    mockUseOutletScope.mockReturnValue({ boundOutlets: [], isMultiOutlet: false })
    render(<MonitoringPage />)
    expect(screen.getByTestId('spv-dashboard')).toHaveTextContent('null')
  })

  it('renders SPVDashboard scoped to boundOutlets for leader role', () => {
    mockUseAuth.mockReturnValue({ outletStaff: { role: 'leader' }, loading: false })
    mockUseOutletScope.mockReturnValue({
      boundOutlets: [{ id: 'outlet-a', name: 'Outlet A' }, { id: 'outlet-b', name: 'Outlet B' }],
      isMultiOutlet: true,
    })
    render(<MonitoringPage />)
    expect(screen.getByTestId('spv-dashboard')).toHaveTextContent('["outlet-a","outlet-b"]')
  })

  it('renders SPVDashboard scoped to a single bound outlet for leader with only one outlet', () => {
    mockUseAuth.mockReturnValue({ outletStaff: { role: 'leader' }, loading: false })
    mockUseOutletScope.mockReturnValue({
      boundOutlets: [{ id: 'outlet-a', name: 'Outlet A' }],
      isMultiOutlet: false,
    })
    render(<MonitoringPage />)
    expect(screen.getByTestId('spv-dashboard')).toHaveTextContent('["outlet-a"]')
  })
})
