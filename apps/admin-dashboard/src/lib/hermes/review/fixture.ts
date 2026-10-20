import type { AlertReviewBaris, KonteksReview, OutletRatingBaris, ReviewBaris } from './tipe'

export const OUTLETS_PALSU: OutletRatingBaris[] = [
  {
    id: 'out-empang',
    nama: 'SUKA SHAWARMA EMPANG',
    slug: 'empang',
    kota: 'Bogor',
    ratingRataRata: 4.8,
    totalUlasan: 340,
    statusOperasional: 'good',
    isActive: true,
  },
  {
    id: 'out-cibinong',
    nama: 'MITRA CIBINONG',
    slug: 'cibinong',
    kota: 'Bogor',
    ratingRataRata: 4.2,
    totalUlasan: 180,
    statusOperasional: 'watch',
    isActive: true,
  },
  {
    id: 'out-kalisari',
    nama: 'MITRA KALISARI',
    slug: 'kalisari',
    kota: 'Jakarta Timur',
    ratingRataRata: 3.9,
    totalUlasan: 95,
    statusOperasional: 'attention',
    isActive: true,
  },
  {
    id: 'out-tes',
    nama: 'Outlet Tes Internal',
    slug: 'tes',
    kota: 'Bogor',
    ratingRataRata: 5.0,
    totalUlasan: 1,
    statusOperasional: 'good',
    isActive: false,
  },
]

export const REVIEWS_PALSU: ReviewBaris[] = [
  {
    id: 'rev-1',
    googleReviewId: 'g-rev-101',
    outletId: 'out-empang',
    outletNama: 'SUKA SHAWARMA EMPANG',
    reviewer: 'Ahmad Fauzi',
    rating: 5,
    komentar: 'Shawarma sapi jumbo terbaik di Bogor, dagingnya empuk dan saus garlic mantap!',
    sentimen: 'positive',
    ringkasanAi: 'Puas dengan rasa daging dan saus garlic.',
    urgensi: 'low',
    kategori: ['RASA', 'PORSI'],
    googleCreatedAt: '2026-10-07T12:00:00Z',
  },
  {
    id: 'rev-2',
    googleReviewId: 'g-rev-102',
    outletId: 'out-cibinong',
    outletNama: 'MITRA CIBINONG',
    reviewer: 'Dewi Lestari',
    rating: 2,
    komentar: 'Antreannya cukup panjang sekitar 30 menit dan pesanan kentang agak dingin.',
    sentimen: 'negative',
    ringkasanAi: 'Keluhan waktu tunggu lama dan makanan dingin.',
    urgensi: 'medium',
    kategori: ['KECEPATAN', 'KUALITAS_PRODUK'],
    googleCreatedAt: '2026-10-07T11:30:00Z',
  },
  {
    id: 'rev-3',
    googleReviewId: 'g-rev-103',
    outletId: 'out-kalisari',
    outletNama: 'MITRA KALISARI',
    reviewer: 'Rian Pratama',
    rating: 1,
    komentar: 'Pesan menu ayam dikasih sapi, dan sausnya asam seperti basi. Kecewa sekali.',
    sentimen: 'negative',
    ringkasanAi: 'Pesanan salah dan saus diduga basi.',
    urgensi: 'high',
    kategori: ['PESANAN_SALAH', 'RASA'],
    googleCreatedAt: '2026-10-07T10:15:00Z',
  },
  {
    id: 'rev-4',
    googleReviewId: 'g-rev-104',
    outletId: 'out-empang',
    outletNama: 'SUKA SHAWARMA EMPANG',
    reviewer: 'Siti Rahma',
    rating: 4,
    komentar: 'Enak tapi tempat duduknya terbatas saat jam makan siang.',
    sentimen: 'neutral',
    ringkasanAi: 'Makanan enak, masukan perluasan tempat duduk.',
    urgensi: 'low',
    kategori: ['TEMPAT'],
    googleCreatedAt: '2026-10-06T18:00:00Z',
  },
]

export const ALERTS_PALSU: AlertReviewBaris[] = [
  {
    id: 'alt-1',
    outletId: 'out-kalisari',
    outletNama: 'MITRA KALISARI',
    tipe: 'LOW_RATING_REVIEW',
    severity: 'high',
    judul: 'Ulasan Bintang 1 di MITRA KALISARI',
    pesan: 'Rian Pratama memberikan ulasan bintang 1: Pesan menu ayam dikasih sapi, dan sausnya asam seperti basi.',
    status: 'active',
    createdAt: '2026-10-07T10:16:00Z',
    resolvedAt: null,
  },
  {
    id: 'alt-2',
    outletId: 'out-cibinong',
    outletNama: 'MITRA CIBINONG',
    tipe: 'NEGATIVE_SPIKE',
    severity: 'medium',
    judul: 'Lonjakan Ulasan Negatif',
    pesan: 'Terdeteksi 3 ulasan negatif dalam 24 jam terakhir di MITRA CIBINONG.',
    status: 'active',
    createdAt: '2026-10-07T09:00:00Z',
    resolvedAt: null,
  },
  {
    id: 'alt-3',
    outletId: 'out-empang',
    outletNama: 'SUKA SHAWARMA EMPANG',
    tipe: 'LOW_RATING_REVIEW',
    severity: 'medium',
    judul: 'Ulasan Bintang 2 Terselesaikan',
    pesan: 'Sudah ditindaklanjuti dengan penggantian voucher.',
    status: 'resolved',
    createdAt: '2026-10-05T14:00:00Z',
    resolvedAt: '2026-10-05T16:00:00Z',
  },
]

export const reviewPalsu: KonteksReview = {
  hariIni: '2026-10-07',
  outlets: async () => OUTLETS_PALSU,
  reviews: async (f) => {
    let r = [...REVIEWS_PALSU]
    if (f?.outletId) r = r.filter((x) => x.outletId === f.outletId)
    if (f?.minRating !== undefined) r = r.filter((x) => x.rating >= f.minRating!)
    if (f?.maxRating !== undefined) r = r.filter((x) => x.rating <= f.maxRating!)
    if (f?.sentimen) r = r.filter((x) => x.sentimen === f.sentimen)
    if (f?.limit) r = r.slice(0, f.limit)
    return r
  },
  alerts: async (f) => {
    let a = [...ALERTS_PALSU]
    if (f?.status) a = a.filter((x) => x.status === f.status)
    if (f?.severity) a = a.filter((x) => x.severity === f.severity)
    if (f?.outletId) a = a.filter((x) => x.outletId === f.outletId)
    if (f?.limit) a = a.slice(0, f.limit)
    return a
  },
}
