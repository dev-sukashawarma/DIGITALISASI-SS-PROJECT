import { describe, it, expect } from 'vitest'
import { DEFAULT_PRINT_LAYOUT, mergePrintLayout, fetchPrintLayout } from './printLayout'

describe('distribusi printLayout', () => {
  it('override qrSizeMm', () => {
    expect(mergePrintLayout({ qr_surat_jalan: { qrSizeMm: 60 } }).qr_surat_jalan.qrSizeMm).toBe(60)
  })
  it('partial merge jatuh ke default', () => {
    const m = mergePrintLayout({ qr_surat_jalan: { title: 'CEK' } })
    expect(m.qr_surat_jalan.title).toBe('CEK')
    expect(m.qr_surat_jalan.qrSizeMm).toBe(45)
    expect(m.qr_surat_jalan.paperWidth).toBe(58)
  })
  it('fetch error → default', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error('x')) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
  it('baris tidak ada → default', async () => {
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }
    expect(await fetchPrintLayout(supabase as any)).toEqual(DEFAULT_PRINT_LAYOUT)
  })
})
