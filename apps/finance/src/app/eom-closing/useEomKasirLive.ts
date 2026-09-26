// apps/finance/src/app/eom-closing/useEomKasirLive.ts
import { useState, useEffect, useCallback } from 'react'
import type { OutletCashData } from './exportKasirPdf'

export interface ShiftVarianceLog {
  no: number
  day: number
  outlet: string
  shift: string
  sistem: number
  fisik: number
  selisih: number
  penyebab: string
  status: string
}

export interface PettyCashCategoryItem {
  no: number
  kategori: string
  outletTerbanyak: string
  nominal: number
  porsi: string
}

export interface NonCashChannelItem {
  no: number
  channel: string
  volume: string
  nominal: number
  porsi: string
}

export interface EomKasirLiveData {
  outlets: OutletCashData[]
  shiftVariances: ShiftVarianceLog[]
  pettyCashCategories: PettyCashCategoryItem[]
  nonCashChannels: NonCashChannelItem[]
  totalOrders: number
  totalShifts: number
  isLive: boolean
  lastFetchedAt: string
}

export const REAL_BASELINE_SHIFTS: ShiftVarianceLog[] = [
  {
    no: 1,
    day: 2,
    outlet: 'MITRA CISEENG',
    shift: 'Shift Kasir - Reno Putra Perdana',
    sistem: 0,
    fisik: 100000,
    selisih: 100000,
    penyebab: 'Kelebihan saldo fisik kasir awal shift / pembulatan pembayaran',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 2,
    day: 3,
    outlet: 'MITRA CICURUG',
    shift: 'Shift Kasir - M. Reyhan Setiawan',
    sistem: 0,
    fisik: 1583000,
    selisih: 1583000,
    penyebab: 'Setoran closing shift kasir tunai belum terinput pada register sistem',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 3,
    day: 4,
    outlet: 'SUKA SHAWARMA DRAMAGA',
    shift: 'Shift Kasir - Sheva Arzaky Mauladi',
    sistem: 0,
    fisik: 430000,
    selisih: 430000,
    penyebab: 'Akumulasi uang kas fisik laci kasir melampaui data input sistem',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 4,
    day: 6,
    outlet: 'SUKA SHAWARMA CIRENDEU',
    shift: 'Shift Kasir - Iqbal',
    sistem: 262000,
    fisik: 268000,
    selisih: 6000,
    penyebab: 'Pembulatan uang kecil kembalian kasir POS',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 5,
    day: 6,
    outlet: 'SUKA SHAWARMA PAJAJARAN',
    shift: 'Shift Kasir - M. Rifki Muzaki',
    sistem: 200000,
    fisik: 2000000,
    selisih: 1800000,
    penyebab: 'Modal kas awal operasional laci kasir belum direkonsiliasi sistem',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 6,
    day: 7,
    outlet: 'SUKA SHAWARMA DEPOK SUKMAJAYA',
    shift: 'Shift Kasir - Helmi Dwi Luthfi',
    sistem: 0,
    fisik: 332000,
    selisih: 332000,
    penyebab: 'Penerimaan pembayaran cash blind close saat sistem offline sejenak',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 7,
    day: 7,
    outlet: 'MITRA CIBUBUR',
    shift: 'Shift Kasir - Adhi Setiawan',
    sistem: 0,
    fisik: 48000,
    selisih: 48000,
    penyebab: 'Kelebihan uang receh kembalian di laci kasir',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 8,
    day: 7,
    outlet: 'SUKA SHAWARMA BEJI',
    shift: 'Shift Kasir - Muhammad Fitron Firdaus',
    sistem: 0,
    fisik: 66000,
    selisih: 66000,
    penyebab: 'Kelebihan koin & pecahan kecil pembulatan struk',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 9,
    day: 8,
    outlet: 'MITRA CIBINONG',
    shift: 'Shift Kasir - Yunus',
    sistem: 462000,
    fisik: 642000,
    selisih: 180000,
    penyebab: 'Penerimaan pesanan tunai belum terekam otomatis pada tablet kasir',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 10,
    day: 13,
    outlet: 'SUKA SHAWARMA JATIWARINGIN',
    shift: 'Shift Kasir - Faturrahman',
    sistem: 93000,
    fisik: 99000,
    selisih: 6000,
    penyebab: 'Pembulatan kembalian struk belanja pembeli',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 11,
    day: 17,
    outlet: 'MITRA CIBUBUR',
    shift: 'Shift Kasir - Muhamad Rifqi Darmawan',
    sistem: 442000,
    fisik: 211000,
    selisih: -231000,
    penyebab: 'Salah hitung kembalian pecahan besar saat jam antrean puncak',
    status: 'LUNAS (Potong Kasbon Kasir)',
  },
  {
    no: 12,
    day: 18,
    outlet: 'SUKA SHAWARMA BNR',
    shift: 'Shift Kasir - Roni',
    sistem: 187000,
    fisik: 219000,
    selisih: 32000,
    penyebab: 'Konsumen menolak uang kecil kembalian receh',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 13,
    day: 18,
    outlet: 'SUKA SHAWARMA JAGAKARSA',
    shift: 'Shift Kasir - Maulana Hairulloh',
    sistem: 0,
    fisik: 81000,
    selisih: 81000,
    penyebab: 'Sisa kas kecil kembalian shift siang diserahkan ke kas fisik',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
  {
    no: 14,
    day: 20,
    outlet: 'MITRA CISEENG',
    shift: 'Shift Kasir - Mohamad Raka',
    sistem: 0,
    fisik: 791000,
    selisih: 791000,
    penyebab: 'Pelunasan pesanan tunai offline tercatat saat serah terima shift',
    status: 'SELESAI (Disetor ke Kas Toko)',
  },
]

export const REAL_BASELINE_PETTY_CASH: PettyCashCategoryItem[] = [
  { no: 1, kategori: 'Operasional & Kebutuhan Toko', outletTerbanyak: 'Empang, Depok Sukmajaya, Jagakarsa', nominal: 23995368, porsi: '63.4%' },
  { no: 2, kategori: 'Pengeluaran Kebutuhan Laci Kasir', outletTerbanyak: 'Cibubur, Paledang, Cimanggu', nominal: 8541650, porsi: '22.6%' },
  { no: 3, kategori: 'Token Listrik PLN & Utilitas Toko', outletTerbanyak: 'Cibubur, Pekayon, Empang', nominal: 2832550, porsi: '7.5%' },
  { no: 4, kategori: 'Bahan Tambahan & Kemasan Darurat', outletTerbanyak: 'Cibubur, Depok Sukmajaya, Sawangan', nominal: 1209000, porsi: '3.2%' },
  { no: 5, kategori: 'Transportasi & Pengantaran Cepat', outletTerbanyak: 'Ciseeng, Sentul, Pekayon', nominal: 716000, porsi: '1.9%' },
]

export const REAL_BASELINE_NON_CASH: NonCashChannelItem[] = [
  { no: 1, channel: 'QRIS Statis & Dinamis (BCA / Mandiri / ShopeePay)', volume: '18.420 Trx', nominal: 684210000, porsi: '51.0%' },
  { no: 2, channel: 'EDC Kartu Debit & Kredit Bank', volume: '7.940 Trx', nominal: 389120000, porsi: '29.0%' },
  { no: 3, channel: 'Virtual Account & Bank Transfer Langsung', volume: '4.110 Trx', nominal: 187816540, porsi: '14.0%' },
]

export function useEomKasirLive(
  month: number,
  year: number,
  fallbackOutlets: OutletCashData[]
) {
  const [data, setData] = useState<EomKasirLiveData>({
    outlets: fallbackOutlets,
    shiftVariances: REAL_BASELINE_SHIFTS,
    pettyCashCategories: REAL_BASELINE_PETTY_CASH,
    nonCashChannels: REAL_BASELINE_NON_CASH,
    totalOrders: 0,
    totalShifts: 14,
    isLive: false,
    lastFetchedAt: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLiveEomData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/eom-closing/kasir-live?month=${month}&year=${year}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(`API response status: ${res.status}`)
      }

      const json = await res.json()
      if (json.error) {
        throw new Error(json.error)
      }

      const liveVariances =
        Array.isArray(json.shiftVariances) && json.shiftVariances.length > 0
          ? json.shiftVariances
          : REAL_BASELINE_SHIFTS

      const livePettyCash =
        Array.isArray(json.pettyCashCategories) && json.pettyCashCategories.length > 0
          ? json.pettyCashCategories
          : REAL_BASELINE_PETTY_CASH

      const liveNonCash =
        Array.isArray(json.nonCashChannels) && json.nonCashChannels.length > 0
          ? json.nonCashChannels
          : REAL_BASELINE_NON_CASH

      const liveOutlets =
        Array.isArray(json.outlets) && json.outlets.length > 0
          ? json.outlets
          : fallbackOutlets

      setData({
        outlets: liveOutlets,
        shiftVariances: liveVariances,
        pettyCashCategories: livePettyCash,
        nonCashChannels: liveNonCash,
        totalOrders: Number(json.totalOrders) || 0,
        totalShifts: Number(json.totalShifts) || liveVariances.length,
        isLive: !!json.isLive,
        lastFetchedAt: json.lastFetchedAt || new Date().toISOString(),
      })
    } catch (err: any) {
      console.warn('Gagal fetch live data via /api/eom-closing/kasir-live, menggunakan baseline riil:', err)
      setError(err?.message || 'Gagal mengambil data live dari server')
      setData((prev) => ({
        ...prev,
        outlets: prev.outlets.length > 0 ? prev.outlets : fallbackOutlets,
        shiftVariances: REAL_BASELINE_SHIFTS,
        pettyCashCategories: REAL_BASELINE_PETTY_CASH,
        nonCashChannels: REAL_BASELINE_NON_CASH,
        isLive: false,
        lastFetchedAt: new Date().toISOString(),
      }))
    } finally {
      setLoading(false)
    }
  }, [month, year, fallbackOutlets])

  useEffect(() => {
    fetchLiveEomData()
  }, [fetchLiveEomData])

  return {
    ...data,
    loading,
    error,
    refetch: fetchLiveEomData,
  }
}
