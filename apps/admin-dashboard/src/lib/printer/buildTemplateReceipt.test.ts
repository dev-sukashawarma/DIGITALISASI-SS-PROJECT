import { describe, it, expect } from 'vitest'
import { DEFAULT_PRINT_LAYOUT } from './printLayout'
import { buildTemplateReceipt } from './buildTemplateReceipt'

describe('buildTemplateReceipt', () => {
  it('menghasilkan bytes non-kosong untuk tiap template', () => {
    for (const t of ['struk_customer', 'struk_dapur', 'qr_surat_jalan'] as const) {
      const bytes = buildTemplateReceipt(t, DEFAULT_PRINT_LAYOUT)
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBeGreaterThan(0)
    }
  })
  it('paperWidth 80 beda output dari 58 (customer)', () => {
    const l58 = DEFAULT_PRINT_LAYOUT
    const l80 = { ...l58, struk_customer: { ...l58.struk_customer, paperWidth: 80 as const } }
    expect(buildTemplateReceipt('struk_customer', l80).length)
      .not.toBe(buildTemplateReceipt('struk_customer', l58).length)
  })
})
