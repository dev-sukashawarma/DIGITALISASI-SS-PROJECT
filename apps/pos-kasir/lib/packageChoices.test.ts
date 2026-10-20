import { describe, it, expect } from 'vitest'
import { missingPackageChoices, packageChoiceGroups } from './packageChoices'

const drinkGroup = { id: 'pk-drink', menu_item_id: 'ice-tea', or_menu_item_id: 'orange-juice', quantity: 1 }
const combo = {
  is_package: true,
  package_items: [{ id: 'pk-sapi', menu_item_id: 'sapi', or_menu_item_id: null, quantity: 1 }, drinkGroup],
}

describe('pilihan isi paket', () => {
  it('hanya isi "A atau B" pada menu paket yang jadi kelompok pilihan', () => {
    expect(packageChoiceGroups(combo)).toEqual([drinkGroup])
    expect(packageChoiceGroups({ ...combo, is_package: false })).toEqual([])
    expect(packageChoiceGroups({ is_package: true })).toEqual([])
  })

  it('tanpa pilihan bawaan: kelompok belum dipilih dianggap kurang', () => {
    expect(missingPackageChoices(combo, {})).toEqual([drinkGroup])
  })

  it('memilih salah satu opsi — utama maupun pengganti — melengkapi pilihan', () => {
    expect(missingPackageChoices(combo, { 'pk-drink': 'orange-juice' })).toEqual([])
    expect(missingPackageChoices(combo, { 'pk-drink': 'ice-tea' })).toEqual([])
  })

  it('id yang bukan opsi kelompok itu tidak dihitung sebagai pilihan', () => {
    expect(missingPackageChoices(combo, { 'pk-drink': 'sapi' })).toEqual([drinkGroup])
  })
})
