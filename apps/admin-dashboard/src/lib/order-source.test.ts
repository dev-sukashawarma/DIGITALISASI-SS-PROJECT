import { describe, it, expect } from 'vitest'
import { resolveOrderSource } from './order-source'
import { isChannelSelected } from './posReport/compute'

describe('resolveOrderSource', () => {
  it('mengelompokkan website / online ke online (Website Online)', () => {
    expect(resolveOrderSource('website', 'pos', 'vony').key).toBe('online')
    expect(resolveOrderSource('online', 'pos', 'Customer').key).toBe('online')
    expect(resolveOrderSource('web', 'pos').key).toBe('online')
    expect(resolveOrderSource('website ss', 'pos').key).toBe('online')
    expect(resolveOrderSource(null, 'online').key).toBe('online')
    expect(resolveOrderSource(null, 'website').key).toBe('online')
  })

  it('mengelompokkan endorse ke endors', () => {
    expect(resolveOrderSource('endorse', 'pos', 'Influencer').key).toBe('endors')
    expect(resolveOrderSource('endors', 'pos').key).toBe('endors')
    expect(resolveOrderSource(null, 'pos', 'Delva', true).key).toBe('endors')
  })

  it('mengelompokkan pos kasir', () => {
    expect(resolveOrderSource(null, 'pos', 'Customer').key).toBe('pos_kasir')
    expect(resolveOrderSource('pos_kasir', 'pos').key).toBe('pos_kasir')
    expect(resolveOrderSource(null, 'pos_kasir').key).toBe('pos_kasir')
  })

  it('mengelompokkan food apps', () => {
    expect(resolveOrderSource('gofood', 'pos').key).toBe('gofood')
    expect(resolveOrderSource('grabfood', 'pos').key).toBe('grabfood')
    expect(resolveOrderSource('shopeefood', 'pos').key).toBe('shopeefood')
    expect(resolveOrderSource('tiktokgo', 'pos').key).toBe('tiktokgo')
  })
})

describe('isChannelSelected', () => {
  it('pos_kasir menyaring transaksi pos_kasir dan endors (outlet POS)', () => {
    expect(isChannelSelected('pos_kasir', {}, 'pos_kasir')).toBe(true)
    expect(isChannelSelected('pos_kasir', {}, 'endors')).toBe(true)
    expect(isChannelSelected('pos_kasir', {}, 'online')).toBe(false)
    expect(isChannelSelected('pos_kasir', {}, 'gofood')).toBe(false)
  })

  it('online menyaring transaksi online dan website', () => {
    expect(isChannelSelected('online', {}, 'online')).toBe(true)
    expect(isChannelSelected('website', {}, 'online')).toBe(true)
    expect(isChannelSelected('online', {}, 'pos_kasir')).toBe(false)
  })
})
