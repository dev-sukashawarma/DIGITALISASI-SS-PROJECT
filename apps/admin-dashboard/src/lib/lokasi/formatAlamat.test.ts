import { describe, it, expect } from 'vitest'
import { formatAlamat } from './formatAlamat'

describe('formatAlamat', () => {
  it('menyusun alamat lengkap berurutan dengan format nomor rumah dan provinsi-kodepos', () => {
    const alamat = formatAlamat({
      road: 'Jalan Pajajaran',
      house_number: '12',
      suburb: 'Sukasari',
      city_district: 'Bogor Timur',
      city: 'Kota Bogor',
      state: 'Jawa Barat',
      postcode: '16142',
    })
    expect(alamat).toBe('Jalan Pajajaran No. 12, Sukasari, Bogor Timur, Kota Bogor, Jawa Barat 16142')
  })

  it('menyusun alamat tanpa house_number jika tidak tersedia', () => {
    const alamat = formatAlamat({
      road: 'Jalan Pajajaran',
      suburb: 'Sukasari',
      city: 'Kota Bogor',
      state: 'Jawa Barat',
    })
    expect(alamat).toBe('Jalan Pajajaran, Sukasari, Kota Bogor, Jawa Barat')
  })

  it('menggunakan fallback pedestrian, footway, atau residential jika road tidak ada', () => {
    const alamatPedestrian = formatAlamat({
      pedestrian: 'Gang Kelinci',
      city: 'Jakarta Pusat',
    })
    expect(alamatPedestrian).toBe('Gang Kelinci, Jakarta Pusat')

    const alamatResidential = formatAlamat({
      residential: 'Komplek Baranangsiang Indah',
      house_number: 'B2',
      city: 'Kota Bogor',
    })
    expect(alamatResidential).toBe('Komplek Baranangsiang Indah No. B2, Kota Bogor')
  })

  it('menghilangkan duplikasi bagian alamat yang berulang (misal village = suburb)', () => {
    const alamat = formatAlamat({
      road: 'Jl. Merdeka',
      village: 'Sukasari',
      suburb: 'Sukasari',
      city: 'Kota Bogor',
    })
    expect(alamat).toBe('Jl. Merdeka, Sukasari, Kota Bogor')

    // Uji case-insensitive
    const alamatCase = formatAlamat({
      road: 'Jl. Merdeka',
      village: 'sukasari',
      suburb: 'Sukasari',
      city: 'Kota Bogor',
    })
    expect(alamatCase).toBe('Jl. Merdeka, sukasari, Kota Bogor')
  })

  it('mendukung fallback wilayah administratif kota (town, municipality, regency, county)', () => {
    const alamatKabupaten = formatAlamat({
      road: 'Jl. Raya Puncak',
      regency: 'Kabupaten Bogor',
      state: 'Jawa Barat',
    })
    expect(alamatKabupaten).toBe('Jl. Raya Puncak, Kabupaten Bogor, Jawa Barat')
  })

  it('mengembalikan null jika objek kosong, null, undefined, atau hanya spasi', () => {
    expect(formatAlamat(null)).toBeNull()
    expect(formatAlamat(undefined)).toBeNull()
    expect(formatAlamat({})).toBeNull()
    expect(formatAlamat({ road: '   ', city: '' })).toBeNull()
  })
})
