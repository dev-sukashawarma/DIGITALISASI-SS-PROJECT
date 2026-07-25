import { describe, it, expect } from 'vitest'
import { canComposePO, canVerifyReceipt, canApprovePOFinance } from './predicates'

describe('purchase role predicates', () => {
  it('compose: admin, kitchen, purchase', () => {
    expect(['admin','kitchen','purchase'].every(canComposePO)).toBe(true)
    expect(canComposePO('spv')).toBe(false)
  })
  it('verify receipt TOLAK purchase', () => {
    expect(canVerifyReceipt('purchase')).toBe(false)
    expect(['kitchen','admin','owner'].every(canVerifyReceipt)).toBe(true)
  })
  it('approve finance: admin_finance, owner, admin — TOLAK purchase', () => {
    expect(canApprovePOFinance('purchase')).toBe(false)
    expect(['admin_finance','owner','admin'].every(canApprovePOFinance)).toBe(true)
  })
})
