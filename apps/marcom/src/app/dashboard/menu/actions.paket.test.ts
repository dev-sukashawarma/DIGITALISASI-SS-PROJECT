import { describe, it, expect, vi, beforeEach } from 'vitest'

const diubah: Record<string, unknown>[] = []
const ditambah: Record<string, unknown>[] = []

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase-pos', () => ({
  getPosSupabase: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        diubah.push(payload)
        return { eq: () => ({ select: async () => ({ data: [{ id: 'm1' }], error: null }) }) }
      },
      insert: (payload: Record<string, unknown>) => {
        ditambah.push(payload)
        return { select: async () => ({ data: [{ id: 'm2' }], error: null }) }
      },
    }),
  }),
}))

import { saveMenuItem } from './actions'

const dasar = { name: 'Combo #1', price: 37000, is_available: true }

// Form katalog marcom tidak mengelola isi paket maupun urutan menu. Menimpa
// kolom itu dengan nilai bawaan membuat combo kehilangan status paketnya:
// POS berhenti menampilkan pilihan minuman, dan BOM berhenti memotong stok isinya.
describe('saveMenuItem — kolom yang tidak dikelola form marcom', () => {
  beforeEach(() => {
    diubah.length = 0
    ditambah.length = 0
  })

  it('edit tanpa is_package/sort_order tidak menyentuh kedua kolom itu', async () => {
    await saveMenuItem({ ...dasar, id: 'm1' })
    expect(diubah[0]).not.toHaveProperty('is_package')
    expect(diubah[0]).not.toHaveProperty('sort_order')
  })

  it('edit yang mengirim nilainya tetap menyimpannya', async () => {
    await saveMenuItem({ ...dasar, id: 'm1', is_package: true, sort_order: 4 })
    expect(diubah[0]).toMatchObject({ is_package: true, sort_order: 4 })
  })

  it('menu baru tetap mendapat nilai bawaan', async () => {
    await saveMenuItem({ ...dasar })
    expect(ditambah[0]).toMatchObject({ is_package: false, sort_order: 0 })
  })
})
