import { describe, expect, it } from 'vitest'
import { aksiTersedia, sisaBisaDiretur, totalRetur, LABEL_ALASAN, ALASAN_RETUR } from './aturan'

describe('sisaBisaDiretur', () => {
  it('mengurangi retur aktif dari qty diterima', () => {
    expect(sisaBisaDiretur(10, 4)).toBe(6)
  })
  it('tidak pernah minus', () => {
    expect(sisaBisaDiretur(3, 5)).toBe(0)
  })
})

describe('totalRetur', () => {
  it('menjumlah qty × harga', () => {
    expect(totalRetur([{ qty: 2, harga: 51000 }, { qty: 0.5, harga: 20000 }])).toBe(112000)
  })
})

describe('LABEL_ALASAN', () => {
  it('punya label untuk setiap alasan', () => {
    for (const a of ALASAN_RETUR) expect(LABEL_ALASAN[a]).toBeTruthy()
    expect(LABEL_ALASAN.kualitas_tidak_sesuai).toBe('Kualitas tidak sesuai')
  })
})

describe('aksiTersedia', () => {
  it('pengaju tidak bisa memutuskan, tapi bisa membatalkan', () => {
    const a = aksiTersedia('diajukan', null, 'admin_finance', true)
    expect(a).not.toContain('setujui')
    expect(a).not.toContain('tolak')
    expect(a).toContain('batal')
  })
  it('finance bukan pengaju bisa setujui & tolak', () => {
    const a = aksiTersedia('diajukan', null, 'admin_finance', false)
    expect(a).toContain('setujui')
    expect(a).toContain('tolak')
  })
  it('uang kembali: purchasing boleh tutup sisa, tidak boleh konfirmasi uang', () => {
    const a = aksiTersedia('diserahkan', 'uang_kembali', 'purchasing', false)
    expect(a).toContain('tutup_sisa')
    expect(a).not.toContain('konfirmasi_uang')
  })
  it('ganti barang: purchasing bisa terima pengganti', () => {
    expect(aksiTersedia('diserahkan', 'ganti_barang', 'purchasing', false)).toContain('terima_pengganti')
  })
  it('selesai: tidak ada aksi', () => {
    expect(aksiTersedia('selesai', 'potong_tagihan', 'admin', false)).toEqual([])
  })
  it('diserahkan tanpa cara: catat penyelesaian & tutup sisa', () => {
    const a = aksiTersedia('diserahkan', null, 'purchasing', false)
    expect(a).toContain('catat_penyelesaian')
    expect(a).toContain('tutup_sisa')
  })
  it('disetujui: purchasing bisa serahkan, crew tidak apa-apa', () => {
    expect(aksiTersedia('disetujui', null, 'purchasing', false)).toContain('serahkan')
    expect(aksiTersedia('disetujui', null, 'crew', false)).toEqual([])
  })
})

describe('kreditBawaan', () => {
  it('memakai kredit sebanyak mungkin tanpa melebihi tagihan', async () => {
    const { kreditBawaan } = await import('./aturan')
    expect(kreditBawaan(300000, 500000)).toBe(300000)
    expect(kreditBawaan(800000, 500000)).toBe(500000)
    expect(kreditBawaan(0, 500000)).toBe(0)
    expect(kreditBawaan(-5, 500000)).toBe(0)
  })
})
