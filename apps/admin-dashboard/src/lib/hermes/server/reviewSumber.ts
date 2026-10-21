// Loader data Google Reviews (SukaReview) untuk Hermes Agent.
// Terhubung ke Supabase SukaReview (jika SUKAREVIEW_SUPABASE_URL disetel) atau Supabase pusat (svc).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import type {
  AlertReviewBaris,
  FilterAlertReview,
  FilterReview,
  KonteksReview,
  OutletRatingBaris,
  ReviewBaris,
} from '../review/tipe'

const DEFAULT_SUKAREVIEW_URL = 'https://ajvzmicqtwgrcknovubf.supabase.co'
const DEFAULT_SUKAREVIEW_KEY = 'sb_publishable_6WuTWf-ucDNha96WITsBwA_YLqfMNd4'

function dapatkanClientSukaReview(svcDefault: SupabaseClient): SupabaseClient {
  const url = process.env.SUKAREVIEW_SUPABASE_URL || DEFAULT_SUKAREVIEW_URL
  const key = process.env.SUKAREVIEW_SERVICE_ROLE_KEY || process.env.SUKAREVIEW_SUPABASE_ANON_KEY || DEFAULT_SUKAREVIEW_KEY
  if (url && key) {
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return svcDefault
}

export function buatKonteksReview(svc: SupabaseClient, sekarang: Date): KonteksReview {
  const hariIni = jakartaDate(sekarang)
  const client = dapatkanClientSukaReview(svc)

  let cacheOutlets: Promise<OutletRatingBaris[]> | null = null

  return {
    hariIni,

    outlets: () =>
      (cacheOutlets ??= (async () => {
        try {
          const { data, error } = await client
            .from('outlets')
            .select('id, name, slug, city, current_rating, total_reviews, status, is_active')
            .order('name', { ascending: true })

          if (error) {
            console.warn('[hermes-review] outlets query warn:', error.message)
            return []
          }

          return ((data ?? []) as any[]).map((r): OutletRatingBaris => {
            const totalUlasan = Number(r.total_reviews) || 0
            // Jika total_reviews 0, rating riil adalah 0 (belum ada ulasan), bukan default 5.0 di DB
            const ratingRataRata = totalUlasan > 0 ? (Number(r.current_rating) || 0) : 0
            return {
              id: r.id,
              nama: r.name ?? 'Cabang',
              slug: r.slug ?? '',
              kota: r.city ?? null,
              ratingRataRata,
              totalUlasan,
              statusOperasional: r.status ?? 'good',
              isActive: Boolean(r.is_active ?? true),
            }
          })
        } catch (e) {
          console.warn('[hermes-review] gagal ambil outlets:', e)
          return []
        }
      })()),

    reviews: async (filter?: FilterReview): Promise<ReviewBaris[]> => {
      try {
        let q = client
          .from('reviews')
          .select('id, google_review_id, outlet_id, reviewer_name, rating, comment, sentiment, ai_summary, urgency, google_created_at, outlets(name), review_categories(category)')
          .order('google_created_at', { ascending: false })

        if (filter?.outletId) q = q.eq('outlet_id', filter.outletId)
        if (filter?.minRating !== undefined) q = q.gte('rating', filter.minRating)
        if (filter?.maxRating !== undefined) q = q.lte('rating', filter.maxRating)
        if (filter?.sentimen) q = q.eq('sentiment', filter.sentimen)

        const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 100)
        q = q.limit(limit)

        const { data, error } = await q
        if (error) {
          console.warn('[hermes-review] reviews query warn:', error.message)
          return []
        }

        return ((data ?? []) as any[]).map((r): ReviewBaris => {
          const kategoriArr: string[] = Array.isArray(r.review_categories)
            ? r.review_categories.map((c: any) => c.category).filter(Boolean)
            : []

          return {
            id: r.id,
            googleReviewId: r.google_review_id,
            outletId: r.outlet_id,
            outletNama: r.outlets?.name ?? 'Cabang Suka Shawarma',
            reviewer: r.reviewer_name ?? 'Google User',
            rating: Number(r.rating) || 0,
            komentar: r.comment ?? null,
            sentimen: r.sentiment ?? null,
            ringkasanAi: r.ai_summary ?? null,
            urgensi: r.urgency ?? null,
            kategori: kategoriArr,
            googleCreatedAt: r.google_created_at,
          }
        })
      } catch (e) {
        console.warn('[hermes-review] gagal ambil reviews:', e)
        return []
      }
    },

    alerts: async (filter?: FilterAlertReview): Promise<AlertReviewBaris[]> => {
      try {
        let q = client
          .from('alerts')
          .select('id, outlet_id, type, severity, title, message, status, created_at, resolved_at, outlets(name)')
          .order('created_at', { ascending: false })

        if (filter?.status) q = q.eq('status', filter.status)
        if (filter?.severity) q = q.eq('severity', filter.severity)
        if (filter?.outletId) q = q.eq('outlet_id', filter.outletId)

        const limit = Math.min(Math.max(filter?.limit ?? 20, 1), 50)
        q = q.limit(limit)

        const { data, error } = await q
        if (error) {
          console.warn('[hermes-review] alerts query warn:', error.message)
          return []
        }

        return ((data ?? []) as any[]).map((r): AlertReviewBaris => ({
          id: r.id,
          outletId: r.outlet_id,
          outletNama: r.outlets?.name ?? 'Cabang Suka Shawarma',
          tipe: r.type,
          severity: r.severity,
          judul: r.title,
          pesan: r.message,
          status: r.status,
          createdAt: r.created_at,
          resolvedAt: r.resolved_at ?? null,
        }))
      } catch (e) {
        console.warn('[hermes-review] gagal ambil alerts:', e)
        return []
      }
    },
  }
}
