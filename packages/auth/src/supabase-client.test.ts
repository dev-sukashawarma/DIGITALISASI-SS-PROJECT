import { describe, it, expect, beforeAll } from 'vitest'
import { createSupabaseBrowserClient } from './supabase-client'

describe('createSupabaseBrowserClient', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key'
  })

  it('returns the same singleton instance across calls (no per-render churn)', () => {
    const a = createSupabaseBrowserClient()
    const b = createSupabaseBrowserClient()
    expect(a).toBe(b)
  })
})
