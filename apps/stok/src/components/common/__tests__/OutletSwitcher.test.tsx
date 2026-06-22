import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OutletSwitcher } from '../OutletSwitcher'

const mockUseOutletScope = vi.fn()
vi.mock('@/hooks/useOutletScope', () => ({
  useOutletScope: () => mockUseOutletScope(),
}))

describe('OutletSwitcher', () => {
  it('renders nothing when isMultiOutlet is false', () => {
    mockUseOutletScope.mockReturnValue({
      boundOutlets: [{ id: 'outlet-a', name: 'Outlet A' }],
      selectedOutletId: 'outlet-a',
      setSelectedOutletId: vi.fn(),
      isMultiOutlet: false,
    })
    const { container } = render(<OutletSwitcher />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a select with bound outlets and calls setSelectedOutletId on change', () => {
    const setSelectedOutletId = vi.fn()
    mockUseOutletScope.mockReturnValue({
      boundOutlets: [
        { id: 'outlet-a', name: 'Outlet A' },
        { id: 'outlet-b', name: 'Outlet B' },
      ],
      selectedOutletId: 'outlet-a',
      setSelectedOutletId,
      isMultiOutlet: true,
    })
    render(<OutletSwitcher />)
    const select = screen.getByRole('combobox', { name: /outlet binaan/i })
    expect(select).toHaveValue('outlet-a')
    fireEvent.change(select, { target: { value: 'outlet-b' } })
    expect(setSelectedOutletId).toHaveBeenCalledWith('outlet-b')
  })
})
