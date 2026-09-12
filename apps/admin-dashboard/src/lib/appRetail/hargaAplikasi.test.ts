import { describe, it, expect } from 'vitest'
import { gabungHargaChannel, SLUG_APLIKASI } from './hargaAplikasi'

describe('gabungHargaChannel', () => {
  it('menambahkan harga aplikasi tanpa menyentuh kanal lain', () => {
    const hasil = gabungHargaChannel({ gofood: '15000', grabfood: '16000' }, '9000')
    expect(hasil).toEqual({ gofood: '15000', grabfood: '16000', aplikasi: '9000' })
  })

  it('menimpa harga aplikasi yang sudah ada, bukan menggandakan', () => {
    const hasil = gabungHargaChannel({ aplikasi: '8000', gofood: '15000' }, '9500')
    expect(hasil).toEqual({ gofood: '15000', aplikasi: '9500' })
  })

  // Mengosongkan kolom = "ikut harga kasir". Kuncinya DIHAPUS, bukan diisi '0' --
  // gateway memperlakukan 0 sebagai tidak-diisi, tapi menyimpan '0' membuat
  // niat admin tak terbaca oleh manusia yang membuka barisnya.
  it('menghapus kunci aplikasi bila harga dikosongkan', () => {
    expect(gabungHargaChannel({ aplikasi: '8000', gofood: '15000' }, '')).toEqual({ gofood: '15000' })
    expect(gabungHargaChannel({ aplikasi: '8000' }, null)).toEqual({})
    expect(gabungHargaChannel({ aplikasi: '8000' }, undefined)).toEqual({})
  })

  it('menghapus kunci aplikasi untuk nol dan nilai tak masuk akal', () => {
    expect(gabungHargaChannel({ aplikasi: '8000' }, '0')).toEqual({})
    expect(gabungHargaChannel({ aplikasi: '8000' }, '-500')).toEqual({})
    expect(gabungHargaChannel({ aplikasi: '8000' }, 'gratis')).toEqual({})
  })

  // Proyek ini punya riwayat kolom TEXT yang menyimpan JSON berlapis
  // (global_settings.value). Menebak salah arah di sini menghapus harga kanal lain.
  it('menerima channel_prices berbentuk string JSON', () => {
    expect(gabungHargaChannel('{"gofood":"15000"}', '9000')).toEqual({ gofood: '15000', aplikasi: '9000' })
  })

  it('tidak melempar untuk null, undefined, atau isi rusak', () => {
    expect(gabungHargaChannel(null, '9000')).toEqual({ aplikasi: '9000' })
    expect(gabungHargaChannel(undefined, '9000')).toEqual({ aplikasi: '9000' })
    expect(gabungHargaChannel('bukan json', '9000')).toEqual({ aplikasi: '9000' })
    expect(gabungHargaChannel(42, '9000')).toEqual({ aplikasi: '9000' })
  })

  it('menormalkan angka jadi string, sesuai bentuk simpanan formulir', () => {
    expect(gabungHargaChannel({}, 9000)).toEqual({ aplikasi: '9000' })
  })

  it('mengekspor slug yang sama dengan yang dibaca gateway', () => {
    expect(SLUG_APLIKASI).toBe('aplikasi')
  })
})
