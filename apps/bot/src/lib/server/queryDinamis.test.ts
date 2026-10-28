import { describe, it, expect, vi } from 'vitest'
import {
  deteksiTopik,
  deteksiPermintaanTanggal,
  ambilDataDinamisRentang,
  type PermintaanTanggalDinamis,
} from './queryDinamis'

describe('queryDinamis', () => {
  const refDate = new Date('2026-10-28T03:00:00.000Z') // 10:00 WIB 28 Oktober 2026

  describe('deteksiTopik', () => {
    it('mendeteksi topik waste dari kata kunci', () => {
      expect(deteksiTopik('waste tertinggi 7 hari kebelakang')).toBe('waste')
      expect(deteksiTopik('cek seminggu semua waste')).toBe('waste')
      expect(deteksiTopik('ada bahan reject atau basi?')).toBe('waste')
    })

    it('mendeteksi topik penjualan dari kata kunci', () => {
      expect(deteksiTopik('omzet tanggal 15 Oktober')).toBe('penjualan')
      expect(deteksiTopik('penjualan 10 hari terakhir')).toBe('penjualan')
      expect(deteksiTopik('cek transaksi dan struk')).toBe('penjualan')
    })

    it('mendeteksi topik opex dari kata kunci', () => {
      expect(deteksiTopik('pengeluaran 10 hari terakhir')).toBe('opex')
      expect(deteksiTopik('total opex cabang')).toBe('opex')
    })

    it('mengambil topik dari riwayat jika pesan singkat tanpa kata kunci topik', () => {
      const riwayat = [
        { role: 'user', content: 'waste tertinggi 7 hari kebelakang' },
        { role: 'assistant', content: 'Berikut data waste...' },
      ]
      expect(deteksiTopik('10 hari kebelakang gimana?', riwayat)).toBe('waste')
    })

    it('mengembalikan "semua" jika tidak ada kata kunci spesifik dan tanpa riwayat', () => {
      expect(deteksiTopik('10 hari kebelakang gimana?')).toBe('semua')
    })
  })

  describe('deteksiPermintaanTanggal', () => {
    it('mengembalikan null untuk pertanyaan hari ini atau kemarin standar', () => {
      expect(deteksiPermintaanTanggal('gimana hari ini?')).toBeNull()
      expect(deteksiPermintaanTanggal('kemarin omzet berapa?')).toBeNull()
    })

    it('mendeteksi rentang X hari kebelakang', () => {
      const res = deteksiPermintaanTanggal('waste tertinggi 7 hari kebelakang', undefined, refDate)
      expect(res).not.toBeNull()
      expect(res?.jenis).toBe('rentang_hari')
      expect(res?.jumlahHari).toBe(7)
      expect(res?.topik).toBe('waste')
      expect(res?.tglAkhirStr).toBe('2026-10-28')
      expect(res?.tglAwalStr).toBe('2026-10-22')
    })

    it('mendeteksi frasa "10 hari kebelakang gimana?"', () => {
      const res = deteksiPermintaanTanggal('10 hari kebelakang gimana?', undefined, refDate)
      expect(res).not.toBeNull()
      expect(res?.jenis).toBe('rentang_hari')
      expect(res?.jumlahHari).toBe(10)
      expect(res?.tglAkhirStr).toBe('2026-10-28')
      expect(res?.tglAwalStr).toBe('2026-10-19')
    })

    it('mendeteksi kata "seminggu"', () => {
      const res = deteksiPermintaanTanggal('cek seminggu semua waste', undefined, refDate)
      expect(res).not.toBeNull()
      expect(res?.jenis).toBe('rentang_hari')
      expect(res?.jumlahHari).toBe(7)
      expect(res?.topik).toBe('waste')
    })

    it('mendeteksi tanggal spesifik dengan nama bulan (tanggal 15 Oktober)', () => {
      const res = deteksiPermintaanTanggal('omzet tanggal 15 Oktober', undefined, refDate)
      expect(res).not.toBeNull()
      expect(res?.jenis).toBe('tanggal_spesifik')
      expect(res?.tglAwalStr).toBe('2026-10-15')
      expect(res?.tglAkhirStr).toBe('2026-10-15')
      expect(res?.topik).toBe('penjualan')
      expect(res?.labelPeriode).toContain('15 Oktober 2026')
    })

    it('mendeteksi rentang dua tanggal (dari tanggal 10 sampai 15 oktober)', () => {
      const res = deteksiPermintaanTanggal('dari tanggal 10 sampai 15 oktober', undefined, refDate)
      expect(res).not.toBeNull()
      expect(res?.jenis).toBe('rentang_tanggal')
      expect(res?.tglAwalStr).toBe('2026-10-10')
      expect(res?.tglAkhirStr).toBe('2026-10-15')
    })

    it('mendeteksi tanggal format slash (20/10/2026)', () => {
      const res = deteksiPermintaanTanggal('data penjualan 20/10/2026', undefined, refDate)
      expect(res).not.toBeNull()
      expect(res?.jenis).toBe('tanggal_spesifik')
      expect(res?.tglAwalStr).toBe('2026-10-20')
      expect(res?.tglAkhirStr).toBe('2026-10-20')
    })

    it('mendeteksi kemarin lusa (H-2)', () => {
      const res = deteksiPermintaanTanggal('waste kemarin lusa', undefined, refDate)
      expect(res).not.toBeNull()
      expect(res?.jenis).toBe('tanggal_spesifik')
      expect(res?.tglAwalStr).toBe('2026-10-26')
    })
  })

  describe('ambilDataDinamisRentang', () => {
    it('membuat string markdown terstruktur dari hasil query', async () => {
      const mockSb = {
        from: vi.fn((table: string) => {
          if (table === 'stok_waste_reports') {
            return {
              select: vi.fn().mockReturnThis(),
              neq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lte: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'w1',
                    qty: 5,
                    reason: 'Basi / Expired',
                    status: 'APPROVED',
                    created_at: '2026-10-24T10:00:00+07:00',
                    outlet_id: 'o1',
                    bahan_baku_id: 'b1',
                    outlets: { name: 'SUKA SHAWARMA JAGAKARSA', type: 'internal' },
                    bahan_baku: { nama: 'Sayur (lettuce)', satuan: 'kg' },
                  },
                ],
                error: null,
              }),
            } as any
          }
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as any
        }),
      }

      const req: PermintaanTanggalDinamis = {
        jenis: 'rentang_hari',
        topik: 'waste',
        startDateIso: '2026-10-18T00:00:00+07:00',
        endDateIso: '2026-10-28T23:59:59+07:00',
        tglAwalStr: '2026-10-18',
        tglAkhirStr: '2026-10-28',
        labelPeriode: '10 Hari Terakhir',
        jumlahHari: 10,
      }

      const hasil = await ambilDataDinamisRentang(req, mockSb, { b1: 10000 })
      expect(hasil).toContain('DATA HASIL QUERY DINAMIS')
      expect(hasil).toContain('10 Hari Terakhir')
      expect(hasil).toContain('DATA KERUGIAN & WASTE BAHAN BAKU')
      expect(hasil).toContain('SUKA SHAWARMA JAGAKARSA')
      expect(hasil).toContain('Sayur (lettuce)')
      expect(hasil).toContain('50.000') // 5 kg * Rp 10.000
    })
  })
})
