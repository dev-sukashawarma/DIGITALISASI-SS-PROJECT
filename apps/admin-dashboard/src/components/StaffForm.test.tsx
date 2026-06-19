import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StaffForm } from './StaffForm'
import type { Outlet } from '@/lib/types'

const outlets: Outlet[] = [
  { id: 'o1', name: 'Empang' },
  { id: 'o2', name: 'Sudirman' },
]

describe('StaffForm', () => {
  it('shows OutletMultiSelect only when role is kepala_outlet', () => {
    render(<StaffForm outlets={outlets} onSubmit={vi.fn()} submitting={false} />)
    // default role crew → no multi-select label
    expect(screen.queryByText('Outlet Binaan')).toBeNull()
    // switch to kepala_outlet
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'kepala_outlet' } })
    expect(screen.getByText('Outlet Binaan')).toBeInTheDocument()
  })
})
