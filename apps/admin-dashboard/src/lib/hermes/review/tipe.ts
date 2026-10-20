export interface OutletRatingBaris {
  id: string
  nama: string
  slug: string
  kota: string | null
  ratingRataRata: number
  totalUlasan: number
  statusOperasional: 'good' | 'watch' | 'attention' | 'critical'
  isActive: boolean
}

export interface ReviewBaris {
  id: string
  googleReviewId: string
  outletId: string
  outletNama: string
  reviewer: string
  rating: number
  komentar: string | null
  sentimen: 'positive' | 'neutral' | 'negative' | null
  ringkasanAi: string | null
  urgensi: 'low' | 'medium' | 'high' | null
  kategori: string[]
  googleCreatedAt: string
}

export interface AlertReviewBaris {
  id: string
  outletId: string
  outletNama: string
  tipe: 'LOW_RATING_REVIEW' | 'RATING_DROP' | 'NEGATIVE_SPIKE' | 'LOW_OUTLET_RATING' | string
  severity: 'low' | 'medium' | 'high' | 'critical'
  judul: string
  pesan: string
  status: 'active' | 'resolved'
  createdAt: string
  resolvedAt: string | null
}

export interface FilterReview {
  outletId?: string
  minRating?: number
  maxRating?: number
  sentimen?: 'positive' | 'neutral' | 'negative'
  limit?: number
}

export interface FilterAlertReview {
  status?: 'active' | 'resolved'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  outletId?: string
  limit?: number
}

export interface KonteksReview {
  hariIni: string
  outlets(): Promise<OutletRatingBaris[]>
  reviews(filter?: FilterReview): Promise<ReviewBaris[]>
  alerts(filter?: FilterAlertReview): Promise<AlertReviewBaris[]>
}
