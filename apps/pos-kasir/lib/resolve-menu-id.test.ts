import { describe, it, expect } from 'vitest'
import { buildMenuNameIndex, resolveMenuItemId } from './resolve-menu-id'

const MENU = [
  { id: 'id-sapi-besar', name: 'Original Sapi Besar' },
  { id: 'id-ayam-sedang', name: 'Original Ayam Sedang' },
  { id: 'id-keju', name: 'Extra Keju' },
  { id: 'id-null', name: null },
]

describe('resolveMenuItemId', () => {
  const index = buildMenuNameIndex(MENU)

  it('mencocokkan nama polos', () => {
    expect(resolveMenuItemId(index, 'Original Sapi Besar')).toBe('id-sapi-besar')
  })

  it('mengabaikan catatan |NOTE| yang ditempel saat ingest', () => {
    // Bentuk nyata dari pull-online: `${item_name}|NOTE|${note}`
    expect(resolveMenuItemId(index, 'Original Sapi Besar|NOTE|Pedas semuanya')).toBe('id-sapi-besar')
    expect(resolveMenuItemId(index, 'Original Ayam Sedang|NOTE|Tidak pedas')).toBe('id-ayam-sedang')
  })

  it('mengabaikan metadata |ID| dan |PARENT| dari checkout', () => {
    expect(resolveMenuItemId(index, 'Original Sapi Besar|ID|b12g1mf')).toBe('id-sapi-besar')
    expect(resolveMenuItemId(index, 'Extra Keju|PARENT|abc|NOTE|x')).toBe('id-keju')
  })

  it('tahan beda kapital dan spasi berlebih', () => {
    expect(resolveMenuItemId(index, '  original SAPI besar  ')).toBe('id-sapi-besar')
  })

  it('mengembalikan null untuk nama tak dikenal -- ingest tidak boleh gagal', () => {
    expect(resolveMenuItemId(index, 'Menu Yang Tidak Ada')).toBeNull()
    expect(resolveMenuItemId(index, '')).toBeNull()
    expect(resolveMenuItemId(index, null)).toBeNull()
    expect(resolveMenuItemId(index, undefined)).toBeNull()
  })

  it('melewati baris menu tanpa nama', () => {
    expect(index.has('')).toBe(false)
    expect([...index.values()]).not.toContain('id-null')
  })

  it('deterministik saat ada nama kembar: baris pertama menang', () => {
    const dup = buildMenuNameIndex([
      { id: 'pertama', name: 'Sama' },
      { id: 'kedua', name: 'Sama' },
    ])
    expect(resolveMenuItemId(dup, 'Sama')).toBe('pertama')
  })
})
