import { pecahTeks } from './teks'

describe('pecahTeks', () => {
  it('memecah baris dan **tebal**', () => {
    expect(pecahTeks('Omzet: **Rp 1**\n- a')).toEqual([
      [{ tebal: false, teks: 'Omzet: ' }, { tebal: true, teks: 'Rp 1' }],
      [{ tebal: false, teks: '- a' }],
    ])
  })
  it('tanpa penanda → satu segmen; HTML tetap teks biasa', () => {
    expect(pecahTeks('<b>x</b>')).toEqual([[{ tebal: false, teks: '<b>x</b>' }]])
  })
  it('baris kosong tetap ada', () => {
    expect(pecahTeks('a\n\nb')).toEqual([[{ tebal: false, teks: 'a' }], [], [{ tebal: false, teks: 'b' }]])
  })
})
