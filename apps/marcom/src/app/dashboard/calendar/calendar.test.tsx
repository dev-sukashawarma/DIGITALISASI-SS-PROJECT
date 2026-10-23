import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import CalendarPage from './page'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

describe('CalendarPage Component', () => {
  it('renders the complete CalendarPage server component with real database', async () => {
    const pageJsx = await CalendarPage()
    expect(pageJsx).toBeDefined()
    const html = renderToString(pageJsx)
    expect(html).toContain('Kalender Marcom Suka Shawarma')
    expect(html).toContain('Marketing &amp; Campaign Schedule')
  })
})
