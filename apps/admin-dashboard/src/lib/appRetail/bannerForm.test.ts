import { describe, it, expect } from 'vitest'
import { periksaBanner, type InputBanner } from './bannerForm'

function input(ubah: Partial<InputBanner> = {}): InputBanner {
  return {
    slot: 'carousel', urutan: 0, badge: '', judul: 'Judul',
    subjudul: '', teksTombol: '', gambarUrl: '',
    aksi: 'tidak_ada', targetMenuItemId: null, ...ubah,
  }
}

describe('periksaBanner', () => {
  it('menerima banner minimal', () => {
    expect(periksaBanner(input())).toBeNull()
  })

  it('menolak judul kosong', () => {
    expect(periksaBanner(input({ judul: '   ' }))).toMatch(/Judul/)
  })

  it('menolak menu_item tanpa target', () => {
    expect(periksaBanner(input({ aksi: 'menu_item' }))).toMatch(/menu tujuan/i)
  })

  it('menolak target terisi saat aksi bukan menu_item', () => {
    expect(periksaBanner(input({ aksi: 'menu', targetMenuItemId: 'm1' }))).toMatch(/menu tujuan/i)
  })

  it('menerima menu_item dengan target', () => {
    expect(periksaBanner(input({ aksi: 'menu_item', targetMenuItemId: 'm1' }))).toBeNull()
  })
})
