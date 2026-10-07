import { describe, expect, it } from 'vitest'
import { uraiInline, uraiMarkdown, uraiPesan } from './uraiPesan'

const tabel = '{"jenis":"tabel","kolom":["A","B"],"baris":[["x",1]]}'
const fence = (j: string) => '```suka-ui\n' + j + '\n```'

describe('uraiPesan', () => {
  it('teks biasa', () => {
    expect(uraiPesan('halo dunia')).toEqual([{ jenis: 'teks', isi: 'halo dunia' }])
  })
  it('satu blok tabel di antara teks', () => {
    const r = uraiPesan('sebelum\n' + fence(tabel) + '\nsesudah')
    expect(r.map((b) => b.jenis)).toEqual(['teks', 'ui', 'teks'])
    expect(r[1]).toMatchObject({ jenis: 'ui', blok: { jenis: 'tabel', kolom: ['A', 'B'] } })
  })
  it('beberapa blok', () => {
    const k = '{"jenis":"kartu","item":[{"label":"L","nilai":3}]}'
    const g = '{"jenis":"grafik_batang","data":[{"label":"a","nilai":2}]}'
    const r = uraiPesan([fence(tabel), fence(k), fence(g)].join('\n'))
    expect(r.map((b) => (b.jenis === 'ui' ? b.blok.jenis : b.jenis))).toEqual(['tabel', 'kartu', 'grafik_batang'])
  })
  it('JSON rusak -> ui_rusak', () => {
    const r = uraiPesan(fence('{bukan json'))
    expect(r).toEqual([{ jenis: 'ui_rusak', mentah: '{bukan json' }])
  })
  it('skema melanggar -> ui_rusak', () => {
    const r = uraiPesan(fence('{"jenis":"tabel","kolom":["A"],"baris":[[{"x":1}]]}'))
    expect(r[0].jenis).toBe('ui_rusak')
    expect(uraiPesan(fence('{"jenis":"asing"}'))[0].jenis).toBe('ui_rusak')
  })
  it('pagar tak tertutup diperlakukan teks', () => {
    const t = 'a\n```suka-ui\n' + tabel
    expect(uraiPesan(t)).toEqual([{ jenis: 'teks', isi: t }])
  })
})

describe('uraiMarkdown', () => {
  it('heading, paragraf, daftar', () => {
    const r = uraiMarkdown('## Judul\nbaris1\nbaris2\n\n- a\n* b\n\n1. satu\n2. dua')
    expect(r).toEqual([
      { t: 'h', level: 2, isi: 'Judul' },
      { t: 'p', baris: ['baris1', 'baris2'] },
      { t: 'ul', items: ['a', 'b'] },
      { t: 'ol', items: ['satu', 'dua'] },
    ])
  })
  it('tabel GFM dengan baris alignment', () => {
    const r = uraiMarkdown('| Nama | Jumlah |\n|:---|---:|\n| Andi | 5 |\n| Budi | 7 |\nteks')
    expect(r[0]).toEqual({
      t: 'tabel',
      kolom: ['Nama', 'Jumlah'],
      baris: [
        ['Andi', '5'],
        ['Budi', '7'],
      ],
    })
    expect(r[1]).toEqual({ t: 'p', baris: ['teks'] })
  })
  it('pipa tanpa separator bukan tabel', () => {
    expect(uraiMarkdown('a | b')[0].t).toBe('p')
  })
})

describe('uraiInline', () => {
  it('bold, italic, code', () => {
    expect(uraiInline('a **b** *c* `d`')).toEqual([
      { t: 'teks', isi: 'a ' },
      { t: 'b', isi: 'b' },
      { t: 'teks', isi: ' ' },
      { t: 'i', isi: 'c' },
      { t: 'teks', isi: ' ' },
      { t: 'code', isi: 'd' },
    ])
  })
  it('bold tidak menyeberang baris', () => {
    expect(uraiInline('**a\nb**')).toEqual([{ t: 'teks', isi: '**a\nb**' }])
  })
})
