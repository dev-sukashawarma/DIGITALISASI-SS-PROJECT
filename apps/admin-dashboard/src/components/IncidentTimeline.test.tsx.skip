import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IncidentTimeline } from './IncidentTimeline'
import type { HealthTransition } from '@/lib/healthStatus'

describe('IncidentTimeline', () => {
  it('renders one row per transition with target, from->to, and time', () => {
    const events: HealthTransition[] = [
      { target_name: 'pos-kasir', from: 'up', to: 'degraded', checked_at: '2026-06-20T14:32:00Z' },
    ]
    render(<IncidentTimeline events={events} />)
    expect(screen.getByText(/pos-kasir/)).toBeInTheDocument()
    expect(screen.getByText(/up/)).toBeInTheDocument()
    expect(screen.getByText(/degraded/)).toBeInTheDocument()
  })

  it('shows empty state when there are no transitions', () => {
    render(<IncidentTimeline events={[]} />)
    expect(screen.getByText(/tidak ada insiden/i)).toBeInTheDocument()
  })
})
