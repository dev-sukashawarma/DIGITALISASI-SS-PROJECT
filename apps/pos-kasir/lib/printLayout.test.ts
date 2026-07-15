import { describe, it, expect } from 'vitest'
import { DEFAULT_PRINT_LAYOUT, mergePrintLayout, fetchPrintLayout } from './printLayout'

describe('pos-kasir printLayout', () => {
  it('partial merge jatuh ke default', () => {
    const m = mergePrintLayout({ struk_customer: { showItemNotes: false } })
    expect(m.struk_customer.showItemNotes).toBe(false)
    expect(m.struk_customer.paperWidth).toBe(58)
    expect(m.struk_dapur).toEqual(DEFAULT_PRINT_LAYOUT.struk_dapur)
  })
  it('fetch error → default', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error('x')) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
})
