import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHealthCard } from './AppHealthCard'
import type { SystemHealthLogRow } from '@/lib/types'

const make = (p: Partial<SystemHealthLogRow>): SystemHealthLogRow => ({
  id: 1, target_type: 'app', target_name: 'stok', status: 'up', db_status: 'ok',
  last_activity_at: null, response_time_ms: 50, detail: null, checked_at: '2026-06-20T10:00:00Z',
  ...p,
})

describe('AppHealthCard', () => {
  it('shows up status with db ok', () => {
    render(<AppHealthCard row={make({ target_name: 'stok', status: 'up', db_status: 'ok' })} />)
    expect(screen.getByText('stok')).toBeInTheDocument()
    expect(screen.getByText(/up/i)).toBeInTheDocument()
    expect(screen.getByText(/db: ok/i)).toBeInTheDocument()
  })

  it('shows degraded status with db error', () => {
    render(<AppHealthCard row={make({ target_name: 'pos-kasir', status: 'degraded', db_status: 'error' })} />)
    expect(screen.getByText(/degraded/i)).toBeInTheDocument()
    expect(screen.getByText(/db: error/i)).toBeInTheDocument()
  })

  it('shows "n/a" for last activity when null', () => {
    render(<AppHealthCard row={make({ last_activity_at: null })} />)
    expect(screen.getByText(/n\/a/i)).toBeInTheDocument()
  })
})
