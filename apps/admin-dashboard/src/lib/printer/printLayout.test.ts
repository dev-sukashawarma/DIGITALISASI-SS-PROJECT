import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_PRINT_LAYOUT, mergePrintLayout, fetchPrintLayout } from './printLayout'

describe('mergePrintLayout', () => {
  it('null/undefined → full default', () => {
    expect(mergePrintLayout(undefined)).toEqual(DEFAULT_PRINT_LAYOUT)
    expect(mergePrintLayout(null)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
  it('partial per-field jatuh ke default', () => {
    const merged = mergePrintLayout({ struk_customer: { paperWidth: 80 } })
    expect(merged.struk_customer.paperWidth).toBe(80)
    expect(merged.struk_customer.showCashier).toBe(true) // default
    expect(merged.struk_dapur).toEqual(DEFAULT_PRINT_LAYOUT.struk_dapur)
  })
  it('override penuh dipertahankan', () => {
    const custom = { qr_surat_jalan: { ...DEFAULT_PRINT_LAYOUT.qr_surat_jalan, qrSizeMm: 60 } }
    expect(mergePrintLayout(custom).qr_surat_jalan.qrSizeMm).toBe(60)
  })
})

describe('fetchPrintLayout', () => {
  it('baris ada → merge value', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
      Promise.resolve({ data: { value: { struk_customer: { paperWidth: 80 } } }, error: null }) }) }) }) }
    const layout = await fetchPrintLayout(supabase as any)
    expect(layout.struk_customer.paperWidth).toBe(80)
    expect(layout.struk_customer.showLogo).toBe(true) // default
  })
  it('baris tidak ada → default', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
      Promise.resolve({ data: null, error: null }) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
  it('error/throw → default (tak melempar)', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () =>
      Promise.reject(new Error('boom')) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
})
