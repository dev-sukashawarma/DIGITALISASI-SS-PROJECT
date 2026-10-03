import { describe, it, expect } from 'vitest'
import { legacyRewardMenuId, resolveRewardMenuForOutlet, type RewardMenuCandidate } from './promoReward'

const menus: RewardMenuCandidate[] = [
  { id: 'ayam', name: 'Original Ayam Reguler', outlet_id: null },
  { id: 'sapi', name: 'Original Sapi Reguler', outlet_id: null },
  { id: 'paket', name: 'PAKET COUPLE', outlet_id: null, is_package: true },
  { id: 'lokal-a', name: 'Menu Lokal', outlet_id: 'A' },
  { id: 'lokal-b', name: 'Menu Lokal', outlet_id: 'B' },
]

describe('resolveRewardMenuForOutlet', () => {
  it('memakai menu yang dipilih admin', () => {
    expect(resolveRewardMenuForOutlet(menus, 'A', 'sapi')?.id).toBe('sapi')
  })

  it('promo lama tanpa pilihan tetap Original Ayam Reguler', () => {
    expect(resolveRewardMenuForOutlet(menus, 'A', null)?.id).toBe('ayam')
  })

  it('menu khusus outlet lain diganti menu bernama sama milik outlet tujuan', () => {
    expect(resolveRewardMenuForOutlet(menus, 'B', 'lokal-a')?.id).toBe('lokal-b')
  })

  it('outlet tanpa menu bernama sama tidak mendapat hadiah', () => {
    expect(resolveRewardMenuForOutlet(menus, 'C', 'lokal-a')).toBeNull()
  })

  it('menu yang tidak tersedia/terhapus ditolak, bukan diganti menu lain', () => {
    expect(resolveRewardMenuForOutlet(menus, 'A', 'tidak-ada')).toBeNull()
  })

  it('paket tidak boleh jadi hadiah', () => {
    expect(resolveRewardMenuForOutlet(menus, 'A', 'paket')).toBeNull()
  })
})

describe('legacyRewardMenuId', () => {
  it('mengembalikan id Original Ayam Reguler global', () => {
    expect(legacyRewardMenuId(menus)).toBe('ayam')
  })
})
