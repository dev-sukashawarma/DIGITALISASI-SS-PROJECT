import { describe, it, expect } from 'vitest'
import { parseItemName, cleanItemName, isExtraItem } from '@/lib/order-item-name'

describe('order-item-name', () => {
  it('mengembalikan nama apa adanya bila tanpa metadata', () => {
    expect(cleanItemName('Shawarmie Sapi')).toBe('Shawarmie Sapi')
  })

  it('membuang |ID|', () => {
    expect(cleanItemName('Suka Fried Chicken|ID|4077b4dc-9abc')).toBe('Suka Fried Chicken')
  })

  it('membuang seluruh metadata gabungan (ID + PARENT + NOTE)', () => {
    const raw = 'Keju|ID|01ee|PARENT|abcd|NOTE|tambah banyak'
    const parsed = parseItemName(raw)
    expect(parsed.name).toBe('Keju')
    expect(parsed.cartItemId).toBe('01ee')
    expect(parsed.parentId).toBe('abcd')
    expect(parsed.note).toBe('tambah banyak')
  })

  it('mengurai catatan tanpa ID', () => {
    expect(cleanItemName('Kentang|NOTE|pedas')).toBe('Kentang')
  })

  it('mendeteksi item extra (punya parent)', () => {
    expect(isExtraItem('Keju|ID|x|PARENT|y')).toBe(true)
    expect(isExtraItem('Shawarmie Sapi|ID|x')).toBe(false)
  })

  it('aman terhadap string kosong', () => {
    expect(cleanItemName('')).toBe('')
  })
})
