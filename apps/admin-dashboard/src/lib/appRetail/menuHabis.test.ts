import { describe, it, expect } from 'vitest'
import { gabungDaftarHabis } from './menuHabis'

describe('gabungDaftarHabis', () => {
  it('mempertahankan id non-aplikasi (milik POS) yang sudah ada', () => {
    const hasil = JSON.parse(gabungDaftarHabis('["pos-only","app-1"]', ['app-1', 'app-2'], ['app-2']))
    expect(hasil.sort()).toEqual(['app-2', 'pos-only'])
  })
  it('nilai lama null/rusak dianggap kosong', () => {
    expect(JSON.parse(gabungDaftarHabis(null, ['a'], ['a']))).toEqual(['a'])
    expect(JSON.parse(gabungDaftarHabis('rusak', ['a'], []))).toEqual([])
  })
  it('tanpa duplikat', () => {
    expect(JSON.parse(gabungDaftarHabis('["a"]', ['a'], ['a']))).toEqual(['a'])
  })
})
