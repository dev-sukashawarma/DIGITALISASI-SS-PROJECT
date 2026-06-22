import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { OutletLeaderboard } from './OutletLeaderboard'
import type { LeaderboardEntry } from '@/lib/leaderboard'

const entries: LeaderboardEntry[] = [
  { outlet_id: 'b', outlet_name: 'B', omzet: 200000, orders: 2, aov: 100000, deltaPct: -50 },
  { outlet_id: 'a', outlet_name: 'A', omzet: 150000, orders: 3, aov: 50000, deltaPct: 50 },
]

describe('OutletLeaderboard', () => {
  it('render baris terurut dengan omzet & delta', () => {
    render(<OutletLeaderboard entries={entries} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Rp 200.000')).toBeInTheDocument()
    expect(screen.getByText('▼ 50%')).toBeInTheDocument()
    expect(screen.getByText('▲ 50%')).toBeInTheDocument()
  })
})
