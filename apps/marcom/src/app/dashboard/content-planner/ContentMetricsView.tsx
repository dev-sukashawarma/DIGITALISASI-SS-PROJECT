'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Clapperboard,
  Plus,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit2,
  Trash2,
  TrendingUp,
  Flame,
  Award,
  Calendar,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Sparkles,
  AlertCircle,
  Video,
  Layers,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  X,
  Target,
  FileSpreadsheet,
  Zap,
  CalendarDays,
  Megaphone,
  Lightbulb,
  MapPin,
} from 'lucide-react'
import {
  createInternalContent,
  updateInternalContent,
  updateContentMetrics,
  toggleContentAdsStatus,
  deleteInternalContent,
} from '@/app/actions/content'
import {
  autoFetchVideoMetrics,
  syncSingleContentVideo,
  syncAllActiveVideos,
} from '@/app/actions/sync'

export interface SerializedInternalContent {
  id: string
  title: string
  platform: string
  pillar: string
  contentType: string | null
  format: string
  goal: string | null
  status: string
  isAds: boolean
  creator: string | null
  outletId: string | null
  outletName: string
  postUrl: string | null
  postDate: string
  postTime: string | null
  reach: number
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  followersBaseline: number | null
  createdAt: string
}

interface ContentMetricsViewProps {
  initialContents: SerializedInternalContent[]
  outlets: Array<{ id: string; name: string }>
  userRole: string
}

export const PILLARS: Record<string, { label: string; color: string; badgeBg: string; text: string; border: string }> = {
  Promo: {
    label: 'Promo & Diskon',
    color: '#D9480F',
    badgeBg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  Branding: {
    label: 'Branding & Awareness',
    color: '#2563EB',
    badgeBg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'Event SUKA Shawarma': {
    label: 'Event SUKA Shawarma',
    color: '#7C3AED',
    badgeBg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  'Footage Aesthetic': {
    label: 'Footage Aesthetic Menu',
    color: '#E11D48',
    badgeBg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  'Join Trend': {
    label: 'Join Trend & Komedi',
    color: '#059669',
    badgeBg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  Recap: {
    label: 'Recap Kegiatan',
    color: '#0D9488',
    badgeBg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  POV: {
    label: 'POV & Storytelling',
    color: '#D97706',
    badgeBg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  REVIEW_RASA: {
    label: 'Review Rasa',
    color: '#D9480F',
    badgeBg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  BEHIND_THE_SCENE: {
    label: 'Behind The Scene',
    color: '#2563EB',
    badgeBg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  EDUKASI_MENU: {
    label: 'Edukasi Menu',
    color: '#059669',
    badgeBg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  ASMR_FOODPORN: {
    label: 'ASMR & Foodporn',
    color: '#E11D48',
    badgeBg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  KOMEDI_TREND: {
    label: 'Komedi & Trend',
    color: '#7C3AED',
    badgeBg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  STORYTELLING: {
    label: 'Storytelling Brand',
    color: '#D97706',
    badgeBg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
}

export const CONTENT_TYPES = [
  'Sidak Outlet',
  'Info promo',
  'Asthetic menu',
  'Info event',
  'UGC',
  'POV',
  'Recap',
  'Info menu',
  'Interview',
]

export const FORMATS: Record<string, { label: string; badge: string }> = {
  VIDEO: { label: 'Video (Reels/TT)', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  FEED: { label: 'Feed (Carousel/Single)', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export const GOALS = [
  'Sales & Traffic',
  'Engagement & Consideration',
  'Growth & Reach',
]

export const PLATFORMS: Record<string, { label: string; badge: string }> = {
  TIKTOK: { label: 'TikTok', badge: 'bg-[#1C1917] text-white' },
  IG_REELS: { label: 'Instagram Reels', badge: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' },
  INSTAGRAM: { label: 'Instagram', badge: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' },
  YOUTUBE_SHORTS: { label: 'YouTube Shorts', badge: 'bg-red-600 text-white' },
}

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  itemName?: string
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemName = 'konten',
  className = '',
}: PaginationProps) {
  if (totalItems === 0) return null

  const startIndex = Math.min((currentPage - 1) * pageSize + 1, totalItems)
  const endIndex = Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      let start = Math.max(2, currentPage - 1)
      let end = Math.min(totalPages - 1, currentPage + 1)

      if (currentPage <= 3) {
        start = 2
        end = 4
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3
        end = totalPages - 1
      }

      if (start > 2) {
        pages.push('ellipsis-start')
      }

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (end < totalPages - 1) {
        pages.push('ellipsis-end')
      }

      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div
      className={`px-4 sm:px-6 py-3.5 bg-[#FAF8F5]/80 border-t border-[#EFE8DE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 ${className}`}
    >
      {/* Left side: Information & Page Size selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full sm:w-auto">
        <div className="font-medium text-stone-600">
          Menampilkan{' '}
          <span className="font-bold text-[#1A1715] font-mono">
            {startIndex} - {endIndex}
          </span>{' '}
          dari{' '}
          <span className="font-bold text-[#1A1715] font-mono">
            {totalItems}
          </span>{' '}
          {itemName}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-0 sm:pl-3 sm:border-l border-[#EFE8DE]">
            <span className="text-stone-400 text-[11px]">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-[#EFE8DE] rounded-lg text-xs font-bold text-stone-700 focus:outline-none focus:border-[#D9480F] cursor-pointer shadow-2xs transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / hal
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page navigation buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Pertama"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 mx-0.5">
          {pageNumbers.map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-stone-400 font-bold tracking-widest text-[11px] select-none"
                >
                  ...
                </span>
              )
            }

            const isActive = p === currentPage
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#D9480F] text-white shadow-xs'
                    : 'bg-white border border-[#EFE8DE] text-stone-700 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 shadow-2xs'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Selanjutnya"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          title="Halaman Terakhir"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function ContentMetricsView({
  initialContents,
  outlets,
  userRole,
}: ContentMetricsViewProps) {
  // Filters state
  const [search, setSearch] = useState('')
  const [adsFilter, setAdsFilter] = useState<'ALL' | 'ADS' | 'ORGANIC'>('ALL')
  const [formatFilter, setFormatFilter] = useState('ALL')
  const [goalFilter, setGoalFilter] = useState('ALL')
  const [contentTypeFilter, setContentTypeFilter] = useState('ALL')
  const [pillarFilter, setPillarFilter] = useState('ALL')
  const [platformFilter, setPlatformFilter] = useState('ALL')
  const [outletFilter, setOutletFilter] = useState('')
  const [sortBy, setSortBy] = useState<'views' | 'reach' | 'ebr' | 'er' | 'engagement' | 'date'>('views')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Reset to page 1 whenever filters or sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, adsFilter, formatFilter, goalFilter, contentTypeFilter, pillarFilter, platformFilter, outletFilter, sortBy])

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingContent, setEditingContent] = useState<SerializedInternalContent | null>(null)
  const [metricTarget, setMetricTarget] = useState<SerializedInternalContent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedInternalContent | null>(null)

  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Live calculator states for metric update modal
  const [metricReach, setMetricReach] = useState(0)
  const [metricViews, setMetricViews] = useState(0)
  const [metricLikes, setMetricLikes] = useState(0)
  const [metricComments, setMetricComments] = useState(0)
  const [metricShares, setMetricShares] = useState(0)
  const [metricSaves, setMetricSaves] = useState(0)

  // Sync state
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Create modal state
  const [createUrl, setCreateUrl] = useState('')
  const [createTitle, setCreateTitle] = useState('')
  const [createPlatform, setCreatePlatform] = useState('TIKTOK')
  const [createFormat, setCreateFormat] = useState('VIDEO')
  const [createContentType, setCreateContentType] = useState('Sidak Outlet')
  const [createGoal, setCreateGoal] = useState('Sales & Traffic')
  const [createPillar, setCreatePillar] = useState('Promo')
  const [createPostTime, setCreatePostTime] = useState('11:00')
  const [createIsAds, setCreateIsAds] = useState(false)
  const [createReach, setCreateReach] = useState(0)
  const [createViews, setCreateViews] = useState(0)
  const [createLikes, setCreateLikes] = useState(0)
  const [createComments, setCreateComments] = useState(0)
  const [createShares, setCreateShares] = useState(0)
  const [createSaves, setCreateSaves] = useState(0)
  const [isFetchingCreate, setIsFetchingCreate] = useState(false)
  const [fetchCreateNotice, setFetchCreateNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Metric modal auto-fetch state
  const [metricUrl, setMetricUrl] = useState('')
  const [isFetchingMetric, setIsFetchingMetric] = useState(false)
  const [fetchMetricNotice, setFetchMetricNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Handlers for toggling ads status
  const handleToggleAds = async (id: string, currentIsAds: boolean) => {
    startTransition(async () => {
      const res = await toggleContentAdsStatus(id, !currentIsAds)
      if (res?.error) {
        setErrorMessage(res.error)
      }
    })
  }

  // Processed contents with EBR% and ER%
  const processedContents = useMemo(() => {
    return initialContents.map((c) => {
      const totalEngagement = c.likes + c.comments + c.shares + c.saves
      // Engagement by Reach (North Star): totalEngagement / reach * 100
      const effectiveReach = c.reach > 0 ? c.reach : c.views
      const ebr = effectiveReach > 0 ? (totalEngagement / effectiveReach) * 100 : 0
      // Traditional ER by views: totalEngagement / views * 100
      const er = c.views > 0 ? (totalEngagement / c.views) * 100 : 0
      // Engagement by Followers (EBF)
      const ebf = (c.followersBaseline && c.followersBaseline > 0)
        ? (totalEngagement / c.followersBaseline) * 100
        : 0

      return {
        ...c,
        totalEngagement,
        effectiveReach,
        ebr,
        er,
        ebf,
      }
    })
  }, [initialContents])

  // Filtered and sorted data
  const filtered = useMemo(() => {
    return processedContents
      .filter((item) => {
        const matchesSearch =
          search === '' ||
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.pillar.toLowerCase().includes(search.toLowerCase()) ||
          (item.contentType && item.contentType.toLowerCase().includes(search.toLowerCase())) ||
          (item.creator && item.creator.toLowerCase().includes(search.toLowerCase())) ||
          item.outletName.toLowerCase().includes(search.toLowerCase())

        const matchesAds =
          adsFilter === 'ALL' ||
          (adsFilter === 'ADS' && item.isAds) ||
          (adsFilter === 'ORGANIC' && !item.isAds)

        const matchesFormat = formatFilter === 'ALL' || item.format === formatFilter
        const matchesGoal = goalFilter === 'ALL' || item.goal === goalFilter
        const matchesContentType = contentTypeFilter === 'ALL' || item.contentType === contentTypeFilter
        const matchesPillar = pillarFilter === 'ALL' || item.pillar === pillarFilter
        
        const matchesPlatform =
          platformFilter === 'ALL' ||
          (platformFilter === 'INSTAGRAM'
            ? item.platform === 'INSTAGRAM' || item.platform === 'IG_REELS'
            : item.platform === platformFilter)

        const matchesOutlet =
          outletFilter === '' ||
          (outletFilter === 'ALL' && !item.outletId) ||
          item.outletId === outletFilter

        return matchesSearch && matchesAds && matchesFormat && matchesGoal && matchesContentType && matchesPillar && matchesPlatform && matchesOutlet
      })
      .sort((a, b) => {
        if (sortBy === 'views') return b.views - a.views
        if (sortBy === 'reach') return b.effectiveReach - a.effectiveReach
        if (sortBy === 'ebr') return b.ebr - a.ebr
        if (sortBy === 'er') return b.er - a.er
        if (sortBy === 'engagement') return b.totalEngagement - a.totalEngagement
        if (sortBy === 'date') return new Date(b.postDate).getTime() - new Date(a.postDate).getTime()
        return 0
      })
  }, [processedContents, search, adsFilter, formatFilter, goalFilter, contentTypeFilter, pillarFilter, platformFilter, outletFilter, sortBy])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filtered.length)

  const paginatedContents = useMemo(() => {
    return filtered.slice(startIndex, endIndex)
  }, [filtered, startIndex, endIndex])

  // Aggregate stats
  const totalContents = processedContents.length
  const totalVideos = processedContents.filter(i => i.format === 'VIDEO').length
  const totalFeeds = processedContents.filter(i => i.format === 'FEED').length
  const totalAds = processedContents.filter(i => i.isAds).length
  const totalOrganic = processedContents.filter(i => !i.isAds).length
  const totalViews = processedContents.reduce((acc, curr) => acc + curr.views, 0)
  const totalReach = processedContents.reduce((acc, curr) => acc + curr.reach, 0)
  const totalEngagement = processedContents.reduce((acc, curr) => acc + curr.totalEngagement, 0)
  
  const avgER = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0
  const avgEBR = totalReach > 0 ? (totalEngagement / totalReach) * 100 : avgER

  // Pillar breakdown
  const pillarStats = useMemo(() => {
    const stats: Record<string, { count: number; views: number; reach: number; engagement: number }> = {}
    processedContents.forEach((item) => {
      const p = item.pillar || 'Promo'
      if (!stats[p]) stats[p] = { count: 0, views: 0, reach: 0, engagement: 0 }
      stats[p].count += 1
      stats[p].views += item.views
      stats[p].reach += item.reach
      stats[p].engagement += item.totalEngagement
    })

    return Object.entries(stats)
      .map(([key, val]) => {
        const er = val.views > 0 ? (val.engagement / val.views) * 100 : 0
        const ebr = val.reach > 0 ? (val.engagement / val.reach) * 100 : er
        return {
          key,
          name: PILLARS[key]?.label || key,
          count: val.count,
          views: val.views,
          reach: val.reach,
          engagement: val.engagement,
          er,
          ebr,
        }
      })
      .sort((a, b) => b.views - a.views)
  }, [processedContents])

  // Content Type breakdown
  const contentTypeStats = useMemo(() => {
    const stats: Record<string, { count: number; views: number; reach: number; engagement: number }> = {}
    processedContents.forEach((item) => {
      const ct = item.contentType || 'Lainnya'
      if (!stats[ct]) stats[ct] = { count: 0, views: 0, reach: 0, engagement: 0 }
      stats[ct].count += 1
      stats[ct].views += item.views
      stats[ct].reach += item.reach
      stats[ct].engagement += item.totalEngagement
    })
    return Object.entries(stats).map(([name, val]) => ({
      name,
      ...val,
      ebr: val.reach > 0 ? (val.engagement / val.reach) * 100 : 0,
      er: val.views > 0 ? (val.engagement / val.views) * 100 : 0,
    })).sort((a, b) => b.views - a.views)
  }, [processedContents])

  // Platform breakdown
  const platformStats = useMemo(() => {
    const stats: Record<string, { count: number; views: number; reach: number }> = {
      TIKTOK: { count: 0, views: 0, reach: 0 },
      INSTAGRAM: { count: 0, views: 0, reach: 0 },
      YOUTUBE_SHORTS: { count: 0, views: 0, reach: 0 },
    }

    processedContents.forEach((item) => {
      const p = item.platform === 'IG_REELS' || item.platform === 'INSTAGRAM' ? 'INSTAGRAM' : item.platform
      if (stats[p]) {
        stats[p].count += 1
        stats[p].views += item.views
        stats[p].reach += item.reach
      }
    })

    return stats
  }, [processedContents])

  const topPillar = pillarStats[0]

  // Handlers
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createInternalContent({}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsCreateOpen(false)
      }
    })
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingContent) return
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateInternalContent(editingContent.id, {}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setEditingContent(null)
      }
    })
  }

  const handleUpdateMetrics = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!metricTarget) return
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateContentMetrics(metricTarget.id, {}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setMetricTarget(null)
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setErrorMessage('')

    startTransition(async () => {
      const res = await deleteInternalContent(deleteTarget.id)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setDeleteTarget(null)
      }
    })
  }

  const openCreateModal = () => {
    setCreateUrl('')
    setCreateTitle('')
    setCreatePlatform('TIKTOK')
    setCreateFormat('VIDEO')
    setCreateContentType('Sidak Outlet')
    setCreateGoal('Sales & Traffic')
    setCreatePillar('Promo')
    setCreatePostTime('11:00')
    setCreateReach(0)
    setCreateViews(0)
    setCreateLikes(0)
    setCreateComments(0)
    setCreateShares(0)
    setCreateSaves(0)
    setFetchCreateNotice(null)
    setErrorMessage('')
    setIsCreateOpen(true)
  }

  const openMetricModal = (item: SerializedInternalContent) => {
    setMetricTarget(item)
    setMetricUrl(item.postUrl || '')
    setMetricReach(item.reach || 0)
    setMetricViews(item.views || 0)
    setMetricLikes(item.likes || 0)
    setMetricComments(item.comments || 0)
    setMetricShares(item.shares || 0)
    setMetricSaves(item.saves || 0)
    setFetchMetricNotice(null)
    setErrorMessage('')
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    setSyncBanner(null)
    try {
      const res = await syncAllActiveVideos()
      if (res.success) {
        setSyncBanner({
          type: 'success',
          message: res.message || `Berhasil menyinkronkan ${res.updatedCount} video!`,
        })
      } else {
        setSyncBanner({
          type: 'error',
          message: res.message || 'Gagal menyinkronkan video secara otomatis.',
        })
      }
    } catch (err: any) {
      setSyncBanner({
        type: 'error',
        message: err?.message || 'Terjadi kesalahan sistem saat proses sync.',
      })
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleSyncSingle = async (id: string) => {
    setSyncingId(id)
    setSyncBanner(null)
    try {
      const res = await syncSingleContentVideo(id)
      if (res.success) {
        setSyncBanner({
          type: 'success',
          message: `Metrik video berhasil diupdate otomatis (${(res.metrics?.views || 0).toLocaleString('id-ID')} views)!`,
        })
      } else {
        setSyncBanner({
          type: 'error',
          message: res.error || 'Gagal sync video ini.',
        })
      }
    } catch (err: any) {
      setSyncBanner({
        type: 'error',
        message: err?.message || 'Terjadi kesalahan saat sync video.',
      })
    } finally {
      setSyncingId(null)
    }
  }

  const handleAutoFetchCreate = async () => {
    if (!createUrl.trim()) {
      setFetchCreateNotice({
        type: 'error',
        message: 'Masukkan URL video terlebih dahulu',
      })
      return
    }
    setIsFetchingCreate(true)
    setFetchCreateNotice(null)
    try {
      const res = await autoFetchVideoMetrics(createUrl)
      if (res.success && res.data) {
        setCreateViews(res.data.views || 0)
        setCreateLikes(res.data.likes || 0)
        setCreateComments(res.data.comments || 0)
        setCreateShares(res.data.shares || 0)
        setCreateSaves(res.data.saves || 0)
        if (res.data.title && !createTitle) {
          setCreateTitle(res.data.title)
        }
        if (res.data.platform && res.data.platform !== 'UNKNOWN') {
          setCreatePlatform(res.data.platform)
        }
        setFetchCreateNotice({
          type: 'success',
          message: `✅ Berhasil! Ditemukan ${(res.data.views || 0).toLocaleString('id-ID')} views, ${(res.data.likes || 0).toLocaleString('id-ID')} likes!`,
        })
      } else {
        setFetchCreateNotice({
          type: 'error',
          message: res.error || 'Tidak dapat membaca metrik dari URL ini. Silakan input manual.',
        })
      }
    } catch (err: any) {
      setFetchCreateNotice({
        type: 'error',
        message: err?.message || 'Gagal menghubungi server.',
      })
    } finally {
      setIsFetchingCreate(false)
    }
  }

  const handleAutoFetchMetric = async () => {
    if (!metricUrl.trim()) {
      setFetchMetricNotice({
        type: 'error',
        message: 'Masukkan URL video terlebih dahulu',
      })
      return
    }
    setIsFetchingMetric(true)
    setFetchMetricNotice(null)
    try {
      const res = await autoFetchVideoMetrics(metricUrl)
      if (res.success && res.data) {
        if (res.data.views !== undefined && res.data.views > 0) setMetricViews(res.data.views)
        if (res.data.likes !== undefined && res.data.likes > 0) setMetricLikes(res.data.likes)
        if (res.data.comments !== undefined && res.data.comments > 0) setMetricComments(res.data.comments)
        if (res.data.shares !== undefined && res.data.shares > 0) setMetricShares(res.data.shares)
        if (res.data.saves !== undefined && res.data.saves > 0) setMetricSaves(res.data.saves)
        setFetchMetricNotice({
          type: 'success',
          message: `✅ Metrik ditarik: ${(res.data.views || 0).toLocaleString('id-ID')} views, ${(res.data.likes || 0).toLocaleString('id-ID')} likes!`,
        })
      } else {
        setFetchMetricNotice({
          type: 'error',
          message: res.error || 'Tidak dapat menarik metrik dari URL ini.',
        })
      }
    } catch (err: any) {
      setFetchMetricNotice({
        type: 'error',
        message: err?.message || 'Gagal menghubungi server.',
      })
    } finally {
      setIsFetchingMetric(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Konten Planner • Child Module</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Metrik Data & Analisis Performa Konten
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Pelacakan hasil jangkauan riil (Reach & Views), benchmarking North Star EBR% (Engagement by Reach), dan analisis performa per pilar tim kreatif Suka Shawarma.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white hover:bg-[#FAF8F5] text-stone-700 border border-[#EFE8DE] rounded-xl text-xs sm:text-sm font-bold shadow-2xs hover:border-[#D9480F]/40 transition-all cursor-pointer disabled:opacity-50"
            title="Update metrik seluruh video TikTok, IG Reels, dan YouTube Shorts secara otomatis"
          >
            <RefreshCw className={`w-4 h-4 text-[#D9480F] ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>{isSyncingAll ? 'Menyinkronkan...' : 'Sync Semua Video'}</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Video Internal</span>
          </button>
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF8F5] border border-[#EFE8DE] rounded-2xl w-fit flex-wrap">
        <Link
          href="/dashboard/content-planner"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <CalendarDays className="w-4 h-4 text-stone-400" />
          <span>Rencana Konten</span>
        </Link>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-[#D9480F] text-white shadow-xs">
          <BarChart3 className="w-4 h-4" />
          <span>Metrik Data</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/25 text-white font-mono">
            {totalContents}
          </span>
        </div>

        <Link
          href="/dashboard/content-planner/referensi-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60"
        >
          <TrendingUp className="w-4 h-4 text-stone-400" />
          <span>Referensi Data</span>
        </Link>
      </div>

      {/* Sync Status Banner */}
      {syncBanner && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
            syncBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{syncBanner.message}</span>
          </div>
          <button
            onClick={() => setSyncBanner(null)}
            className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer text-stone-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingContent && !metricTarget && !deleteTarget && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Executive 4 Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Konten */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Konten Terbit
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
              <Clapperboard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-[#1A1715]">
              {totalContents} <span className="text-xs text-stone-500 font-sans">konten</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                {totalVideos} Video
              </span>
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                {totalFeeds} Feed
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                <Megaphone className="w-2.5 h-2.5 fill-purple-600 text-purple-600" />
                {totalAds} Ads
              </span>
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                {totalOrganic} Organik
              </span>
            </div>
          </div>
        </div>

        {/* Total Reach & Views */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Jangkauan (Reach) & Views
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-[#1A1715]">
              {totalReach > 0 ? totalReach.toLocaleString('id-ID') : totalViews.toLocaleString('id-ID')}{' '}
              <span className="text-xs text-stone-500 font-sans">{totalReach > 0 ? 'reach' : 'views'}</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              {totalViews.toLocaleString('id-ID')} akumulasi total tayangan views
            </p>
          </div>
        </div>

        {/* Rata-rata EBR & ER */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Rata-rata EBR% (Eng / Reach)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-800">
              {avgEBR.toFixed(2)}%
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              ER Views {avgER.toFixed(2)}% • {totalEngagement.toLocaleString('id-ID')} interaksi
            </p>
          </div>
        </div>

        {/* Pilar & Tipe Juara */}
        <div className="bg-gradient-to-br from-[#1C1917] to-[#292524] p-5 rounded-3xl text-white shadow-xs flex flex-col justify-between border border-stone-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-300 font-bold uppercase tracking-wider">
              Pilar & Tipe Paling Dominan
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-bold text-sm text-amber-300 truncate">
              {topPillar?.name || 'Promo'}
            </div>
            <div className="text-xs text-stone-300 mt-0.5">
              Tipe: <strong className="text-white">{contentTypeStats[0]?.name || 'Sidak Outlet'}</strong> ({contentTypeStats[0]?.count || 0} post)
            </div>
          </div>
        </div>
      </div>

      {/* Visual Intelligence Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Pilar Effectiveness Chart / Bars */}
        <div className="xl:col-span-8 bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE8DE]">
            <div>
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#D9480F]" />
                <span>Efektivitas Pilar Konten</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Perbandingan perolehan views dan tingkat interaksi penonton per kategori video
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {pillarStats.map((pillar) => {
              const maxViews = Math.max(1, pillarStats[0]?.views || 1)
              const barWidth = Math.max(4, Math.round((pillar.views / maxViews) * 100))

              return (
                <div key={pillar.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1A1715]">{pillar.name}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-md bg-stone-100 text-stone-600 font-semibold">
                        {pillar.count} video
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-stone-900">
                        {pillar.views.toLocaleString('id-ID')} views
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        EBR: {pillar.ebr.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-[#D9480F]"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Platform Share */}
        <div className="xl:col-span-4 bg-white p-6 rounded-3xl border border-[#EFE8DE] shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Video className="w-4 h-4 text-[#D9480F]" />
                <span>Distribusi Platform</span>
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Porsi tayangan video internal di media sosial
            </p>

            <div className="mt-4 space-y-3">
              {/* TikTok */}
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1C1917] text-white flex items-center justify-center font-bold text-xs">
                    TT
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#1A1715]">TikTok</div>
                    <div className="text-[11px] text-stone-500">{platformStats.TIKTOK.count} video diunggah</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs font-mono text-[#1A1715]">
                    {platformStats.TIKTOK.views.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] text-stone-400">views</div>
                </div>
              </div>

              {/* Instagram */}
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    IG
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#1A1715]">Instagram (Reels & Feed)</div>
                    <div className="text-[11px] text-stone-500">{platformStats.INSTAGRAM.count} konten diunggah</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs font-mono text-[#1A1715]">
                    {platformStats.INSTAGRAM.views.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] text-stone-400">views ({platformStats.INSTAGRAM.reach.toLocaleString('id-ID')} reach)</div>
                </div>
              </div>

              {/* YouTube Shorts */}
              <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs">
                    YT
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#1A1715]">YouTube Shorts</div>
                    <div className="text-[11px] text-stone-500">{platformStats.YOUTUBE_SHORTS.count} video diunggah</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs font-mono text-[#1A1715]">
                    {platformStats.YOUTUBE_SHORTS.views.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] text-stone-400">views</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-900 mt-2">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Rekomendasi Kreatif:</span>
            </div>
            <span>
              Fokuskan produksi pada pilar <strong>{topPillar?.name || 'Promo'}</strong> karena menghasilkan engagement paling responsif.
            </span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar (Persis Screenshot) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul konten, tipe, creator, atau cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9480F] focus:border-[#D9480F] transition-colors"
            />
          </div>

          {/* Traffic / Ads Filter */}
          <div>
            <select
              value={adsFilter}
              onChange={(e) => setAdsFilter(e.target.value as any)}
              aria-label="Filter traffic ads"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9480F] focus:border-[#D9480F] transition-colors font-medium text-stone-800"
            >
              <option value="ALL">Semua Traffic (Ads & Organik)</option>
              <option value="ADS">Diiklanin (Paid Boost)</option>
              <option value="ORGANIC">Organik Murni</option>
            </select>
          </div>

          {/* Format Filter */}
          <div>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="ALL">Semua Format (Video & Feed)</option>
              <option value="VIDEO">Video (Reels / TikTok)</option>
              <option value="FEED">Feed (Carousel / Single)</option>
            </select>
          </div>

          {/* Content Type Filter */}
          <div>
            <select
              value={contentTypeFilter}
              onChange={(e) => setContentTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="ALL">Semua Tipe Konten</option>
              {CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>

          {/* Goals Filter */}
          <div>
            <select
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="ALL">Semua Goals</option>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Pillar Filter */}
          <div>
            <select
              value={pillarFilter}
              onChange={(e) => setPillarFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="ALL">Semua Pilar Konten</option>
              {Object.entries(PILLARS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Filter */}
          <div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="ALL">Semua Platform</option>
              <option value="TIKTOK">TikTok</option>
              <option value="INSTAGRAM">Instagram (Reels & Feed)</option>
              <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
            </select>
          </div>

          {/* Outlet Filter */}
          <div>
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="">Semua Cabang Outlet</option>
              <option value="ALL">Semua Cabang (Nasional)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-semibold"
            >
              <option value="views">Urut: Views Terbanyak</option>
              <option value="reach">Urut: Reach Terbanyak</option>
              <option value="ebr">Urut: EBR% (Eng/Reach) Tertinggi</option>
              <option value="er">Urut: ER (Eng/Views)% Tertinggi</option>
              <option value="engagement">Urut: Total Interaksi</option>
              <option value="date">Urut: Tanggal Terbaru</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-stone-500 font-medium pt-2.5 border-t border-[#EFE8DE]">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Menampilkan <span className="font-bold text-[#1A1715] font-mono">{filtered.length === 0 ? 0 : `${startIndex + 1} - ${endIndex}`}</span> dari <span className="font-bold text-[#1A1715] font-mono">{filtered.length}</span> konten internal
              {filtered.length !== totalContents && ` (total: ${totalContents})`}
            </span>
            {(search || adsFilter !== 'ALL' || formatFilter !== 'ALL' || goalFilter !== 'ALL' || contentTypeFilter !== 'ALL' || pillarFilter !== 'ALL' || platformFilter !== 'ALL' || outletFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setAdsFilter('ALL')
                  setFormatFilter('ALL')
                  setGoalFilter('ALL')
                  setContentTypeFilter('ALL')
                  setPillarFilter('ALL')
                  setPlatformFilter('ALL')
                  setOutletFilter('')
                }}
                className="text-[#D9480F] hover:underline font-bold cursor-pointer text-xs ml-1"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Quick Pagination bar on top */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-stone-400 text-[11px]">Tampilkan:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-2 py-0.5 bg-[#FAF8F5] border border-[#EFE8DE] rounded-lg text-xs font-bold text-stone-700 focus:outline-none focus:border-[#D9480F] cursor-pointer shadow-2xs"
                >
                  {[10, 20, 50, 100].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} / hal
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 pl-2 border-l border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1 rounded-md border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-stone-700 px-1">
                  Hal. <strong className="text-[#D9480F]">{safeCurrentPage}</strong> / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1 rounded-md border border-[#EFE8DE] bg-white text-stone-600 hover:bg-[#FAF8F5] hover:border-[#D9480F]/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Metrik Table (Persis Screenshot) */}
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs sm:text-sm text-stone-600">
            <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE] sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-4 px-4 sm:px-6 whitespace-nowrap">Konten & Platform</th>
                <th className="py-4 px-4 whitespace-nowrap">Tipe & Pilar</th>
                <th className="py-4 px-4 whitespace-nowrap">Jadwal Tayang</th>
                <th className="py-4 px-4 whitespace-nowrap">Jangkauan (Reach & Views)</th>
                <th className="py-4 px-4 whitespace-nowrap">Interaksi (L/C/S/B)</th>
                <th className="py-4 px-4 whitespace-nowrap">Performa (EBR & ER)</th>
                <th className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    <Clapperboard className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-600">Tidak ada konten yang sesuai dengan filter.</p>
                    <p className="text-xs mt-1">Coba ubah kata kunci pencarian atau reset filter di atas.</p>
                  </td>
                </tr>
              ) : (
                paginatedContents.map((item, idx) => {
                  const pillarConfig = PILLARS[item.pillar] || PILLARS.Promo
                  const platformConfig = PLATFORMS[item.platform] || PLATFORMS.TIKTOK
                  const formatConfig = FORMATS[item.format] || FORMATS.VIDEO

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* Title, Platform & Format */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            #{startIndex + idx + 1}
                          </div>
                          <div className="min-w-0 sm:max-w-md lg:max-w-xl">
                            <div className="font-bold text-[#1A1715] flex items-center gap-1.5">
                              <span className="truncate" title={item.title}>{item.title}</span>
                              {item.postUrl && (
                                <a
                                  href={item.postUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#D9480F] hover:text-[#B83808] flex-shrink-0"
                                  title="Buka URL Konten"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${platformConfig.badge}`}>
                                {platformConfig.label}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${formatConfig.badge}`}>
                                {item.format}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleAds(item.id, item.isAds)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                  item.isAds
                                    ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                    : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                                }`}
                                title="Klik untuk ubah status: Diiklanin (Paid Boost) / Organik"
                              >
                                <Megaphone className={`w-2.5 h-2.5 ${item.isAds ? 'fill-purple-600 text-purple-600' : 'text-stone-400'}`} />
                                <span>{item.isAds ? 'Diiklanin' : 'Organik'}</span>
                              </button>
                              {item.outletName && item.outletName !== 'Semua Cabang (Nasional)' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                                  <MapPin className="w-3 h-3 text-stone-400" />
                                  <span>{item.outletName}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tipe & Pilar */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {item.contentType && (
                            <div className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-800">
                              {item.contentType}
                            </div>
                          )}
                          <div>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${pillarConfig.badgeBg} ${pillarConfig.text} ${pillarConfig.border}`}>
                              {pillarConfig.label}
                            </span>
                          </div>
                          {item.goal && (
                            <div className="text-[10px] text-stone-400 flex items-center gap-1">
                              <Target className="w-2.5 h-2.5 text-stone-400" />
                              <span>{item.goal}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Jadwal Tayang */}
                      <td className="py-4 px-4">
                        <div className="font-medium text-[#1A1715]">
                          {new Date(item.postDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {item.postTime && (
                          <div className="text-[11px] text-[#D9480F] font-bold flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{item.postTime}</span>
                          </div>
                        )}
                      </td>

                      {/* Jangkauan (Reach & Views) */}
                      <td className="py-4 px-4">
                        <div className="font-mono font-bold text-stone-900">
                          {item.views.toLocaleString('id-ID')}{' '}
                          <span className="text-[10px] text-stone-400 font-sans font-normal">views</span>
                        </div>
                        <div className="font-mono text-xs text-stone-500 mt-0.5">
                          {item.reach.toLocaleString('id-ID')}{' '}
                          <span className="text-[10px] text-stone-400 font-sans font-normal">reach</span>
                        </div>
                      </td>

                      {/* Interaksi (L/C/S/B) */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-rose-500 flex items-center gap-1">
                              <Heart className="w-3 h-3 fill-rose-500" />
                              <span className="font-mono">{item.likes.toLocaleString('id-ID')}</span>
                            </span>
                            <span className="text-blue-500 flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              <span className="font-mono">{item.comments.toLocaleString('id-ID')}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-600 flex items-center gap-1">
                              <Share2 className="w-3 h-3" />
                              <span className="font-mono">{item.shares.toLocaleString('id-ID')}</span>
                            </span>
                            <span className="text-amber-600 flex items-center gap-1">
                              <Bookmark className="w-3 h-3 fill-amber-500" />
                              <span className="font-mono">{item.saves.toLocaleString('id-ID')}</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400 pt-0.5 font-medium">
                            Total: <strong className="text-stone-700 font-mono">{item.totalEngagement.toLocaleString('id-ID')}</strong> interaksi
                          </div>
                        </div>
                      </td>

                      {/* Performa (EBR & ER) */}
                      <td className="py-4 px-4">
                        <div>
                          <span
                            className={`inline-block text-[11px] font-black px-2 py-0.5 rounded-md ${
                              item.ebr >= 1.5
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.ebr >= 0.5
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            EBR {item.ebr.toFixed(2)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500 mt-1">
                          ER Views: <strong className="font-mono">{item.er.toFixed(2)}%</strong>
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Metrik Button */}
                          <button
                            onClick={() => openMetricModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                            title="Update Metrik Views & Interaksi"
                          >
                            <TrendingUp className="w-3 h-3 text-[#D9480F]" />
                            <span>Metrik</span>
                          </button>

                          {/* Quick Sync Button if URL exists */}
                          {item.postUrl && (
                            <button
                              onClick={() => handleSyncSingle(item.id)}
                              disabled={syncingId === item.id}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-[#D9480F] hover:bg-[#FFF4ED] transition-colors cursor-pointer disabled:opacity-50"
                              title="Tarik Metrik Otomatis dari Link URL"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingId === item.id ? 'animate-spin text-[#D9480F]' : ''}`} />
                            </button>
                          )}

                          {/* Edit Content */}
                          <button
                            onClick={() => {
                              setEditingContent(item)
                              setErrorMessage('')
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Edit Data Konten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          {userRole === 'ADMIN' && (
                            <button
                              onClick={() => {
                                setDeleteTarget(item)
                                setErrorMessage('')
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Hapus Konten"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filtered.length > 0 && (
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            itemName="konten"
          />
        )}
      </div>

      {/* QUICK METRICS UPDATE MODAL WITH LIVE CALCULATOR */}
      {metricTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-[#EFE8DE] shadow-xl overflow-hidden">
            <div className="p-6 border-b border-[#EFE8DE] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#D9480F] uppercase tracking-wider">
                  Update Metrik Cepat & EBR Calculator
                </span>
                <h2 className="text-lg font-extrabold text-[#1A1715] truncate max-w-sm mt-0.5">
                  {metricTarget.title}
                </h2>
              </div>
              <button
                onClick={() => setMetricTarget(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateMetrics} className="p-6 space-y-4">
              {/* URL Sync Box */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                <label className="block text-xs font-bold text-[#1A1715]">
                  Link URL Postingan Video
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    name="postUrl"
                    value={metricUrl}
                    onChange={(e) => setMetricUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@... atau https://www.instagram.com/reel/..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                  <button
                    type="button"
                    onClick={handleAutoFetchMetric}
                    disabled={isFetchingMetric}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingMetric ? 'animate-spin' : ''}`} />
                    <span>{isFetchingMetric ? 'Menarik...' : 'Tarik Otomatis'}</span>
                  </button>
                </div>
                {fetchMetricNotice && (
                  <div
                    className={`text-xs p-2 rounded-lg ${
                      fetchMetricNotice.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {fetchMetricNotice.message}
                  </div>
                )}
              </div>

              {/* Reach & Views */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">
                    Jangkauan (Reach)
                  </label>
                  <input
                    type="number"
                    name="reach"
                    value={metricReach}
                    onChange={(e) => setMetricReach(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">
                    Total Tayangan (Views)
                  </label>
                  <input
                    type="number"
                    name="views"
                    value={metricViews}
                    onChange={(e) => setMetricViews(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              {/* Interactions Breakdown */}
              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-rose-600 mb-1">
                    Likes
                  </label>
                  <input
                    type="number"
                    name="likes"
                    value={metricLikes}
                    onChange={(e) => setMetricLikes(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-blue-600 mb-1">
                    Comments
                  </label>
                  <input
                    type="number"
                    name="comments"
                    value={metricComments}
                    onChange={(e) => setMetricComments(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-600 mb-1">
                    Shares
                  </label>
                  <input
                    type="number"
                    name="shares"
                    value={metricShares}
                    onChange={(e) => setMetricShares(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-600 mb-1">
                    Saves
                  </label>
                  <input
                    type="number"
                    name="saves"
                    value={metricSaves}
                    onChange={(e) => setMetricSaves(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              {(() => {
                const totalEng = metricLikes + metricComments + metricShares + metricSaves
                const calcReach = metricReach > 0 ? metricReach : metricViews
                const liveEBR = calcReach > 0 ? (totalEng / calcReach) * 100 : 0
                const liveER = metricViews > 0 ? (totalEng / metricViews) * 100 : 0

                return (
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-stone-500 font-bold uppercase">Total Interaksi</div>
                      <div className="text-base font-black font-mono text-[#1A1715]">{totalEng.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-800 font-bold uppercase">EBR% (Reach)</div>
                      <div className="text-base font-black font-mono text-emerald-700">{liveEBR.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-500 font-bold uppercase">ER% Views</div>
                      <div className="text-base font-black font-mono text-stone-800">{liveER.toFixed(2)}%</div>
                    </div>
                  </div>
                )
              })()}

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setMetricTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Metrik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-[#EFE8DE] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-[#EFE8DE] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#D9480F] uppercase tracking-wider">
                  Input Konten Internal Baru
                </span>
                <h2 className="text-lg font-extrabold text-[#1A1715] mt-0.5">
                  Tambah Video Internal
                </h2>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">
                  Judul Konten <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Contoh: SIDAK CABANG GANCIT"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              {/* URL Auto-Fetch - Wajib diisi setelah Judul */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1A1715]">
                    Link URL Video (TikTok / IG Reels / YT Shorts) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-[#D9480F] font-bold">Wajib diisi</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    name="postUrl"
                    required
                    value={createUrl}
                    onChange={(e) => setCreateUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@.../video/... atau https://www.instagram.com/reel/..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                  <button
                    type="button"
                    onClick={handleAutoFetchCreate}
                    disabled={isFetchingCreate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isFetchingCreate ? 'Membaca...' : 'Tarik Data'}</span>
                  </button>
                </div>
                {fetchCreateNotice && (
                  <div
                    className={`text-xs p-2 rounded-lg ${
                      fetchCreateNotice.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {fetchCreateNotice.message}
                  </div>
                )}
              </div>

              {/* Platform & Format */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Platform</label>
                  <select
                    name="platform"
                    value={createPlatform}
                    onChange={(e) => setCreatePlatform(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    <option value="TIKTOK">TikTok</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Format Konten</label>
                  <select
                    name="format"
                    value={createFormat}
                    onChange={(e) => setCreateFormat(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    <option value="VIDEO">Video (Reels / TikTok)</option>
                    <option value="FEED">Feed (Carousel / Single)</option>
                  </select>
                </div>
              </div>

              {/* Tipe Konten & Goal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Tipe Konten</label>
                  <select
                    name="contentType"
                    value={createContentType}
                    onChange={(e) => setCreateContentType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    {CONTENT_TYPES.map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Marketing Goal</label>
                  <select
                    name="goal"
                    value={createGoal}
                    onChange={(e) => setCreateGoal(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    {GOALS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pilar & Cabang */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Pilar Konten</label>
                  <select
                    name="pillar"
                    value={createPillar}
                    onChange={(e) => setCreatePillar(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    {Object.entries(PILLARS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Cabang Outlet</label>
                  <select
                    name="outletId"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    <option value="ALL">Semua Cabang (Nasional)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tanggal & Jam Tayang */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Tanggal Upload / Tayang *</label>
                  <input
                    type="date"
                    name="postDate"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Jam Tayang</label>
                  <input
                    type="text"
                    name="postTime"
                    value={createPostTime}
                    onChange={(e) => setCreatePostTime(e.target.value)}
                    placeholder="11:00 / 17:00 / 19:00"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
              </div>

              {/* Flag Diiklanin / Ads */}
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                <input
                  type="checkbox"
                  id="createMetricsIsAds"
                  name="isAds"
                  value="true"
                  checked={createIsAds}
                  onChange={(e) => setCreateIsAds(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-[#EFE8DE] focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="createMetricsIsAds" className="text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 select-none">
                  <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                  <span>Konten Diiklanin / Boosted Ads (Berbayar)</span>
                </label>
              </div>

              {/* Metrik awal (dimulai dari 0, diperbarui via tombol Metrik atau Sync otomatis setelah konten tayang) */}
              <input type="hidden" name="reach" value={createReach} />
              <input type="hidden" name="views" value={createViews} />
              <input type="hidden" name="likes" value={createLikes} />
              <input type="hidden" name="comments" value={createComments} />
              <input type="hidden" name="shares" value={createShares} />
              <input type="hidden" name="saves" value={createSaves} />

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Konten'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-[#EFE8DE] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-[#EFE8DE] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#D9480F] uppercase tracking-wider">
                  Edit Data Konten
                </span>
                <h2 className="text-lg font-extrabold text-[#1A1715] mt-0.5 truncate max-w-sm">
                  {editingContent.title}
                </h2>
              </div>
              <button
                onClick={() => setEditingContent(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">Judul Konten *</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingContent.title}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">
                  Link URL Video <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="postUrl"
                  required
                  defaultValue={editingContent.postUrl || ''}
                  placeholder="https://www.tiktok.com/@.../video/... atau https://www.instagram.com/reel/..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Platform</label>
                  <select
                    name="platform"
                    defaultValue={editingContent.platform}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    <option value="TIKTOK">TikTok</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Format Konten</label>
                  <select
                    name="format"
                    defaultValue={editingContent.format || 'VIDEO'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    <option value="VIDEO">Video (Reels / TikTok)</option>
                    <option value="FEED">Feed (Carousel / Single)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Tipe Konten</label>
                  <select
                    name="contentType"
                    defaultValue={editingContent.contentType || 'Sidak Outlet'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    {CONTENT_TYPES.map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Marketing Goal</label>
                  <select
                    name="goal"
                    defaultValue={editingContent.goal || 'Sales & Traffic'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    {GOALS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Pilar Konten</label>
                  <select
                    name="pillar"
                    defaultValue={editingContent.pillar}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    {Object.entries(PILLARS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Cabang Outlet</label>
                  <select
                    name="outletId"
                    defaultValue={editingContent.outletId || 'ALL'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    <option value="ALL">Semua Cabang (Nasional)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Tanggal Upload *</label>
                  <input
                    type="date"
                    name="postDate"
                    required
                    defaultValue={editingContent.postDate}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Jam Tayang</label>
                  <input
                    type="text"
                    name="postTime"
                    defaultValue={editingContent.postTime || '11:00'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  />
                </div>
              </div>



              {/* Flag Diiklanin / Ads */}
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                <input
                  type="checkbox"
                  id="editMetricsIsAds"
                  name="isAds"
                  value="true"
                  defaultChecked={editingContent.isAds}
                  className="w-4 h-4 text-purple-600 rounded border-[#EFE8DE] focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="editMetricsIsAds" className="text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 select-none">
                  <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                  <span>Konten Diiklanin / Boosted Ads (Berbayar)</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setEditingContent(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Konten'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-3xl border border-[#EFE8DE] shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#1A1715] text-base">Hapus Konten Video?</h3>
              <p className="text-xs text-stone-500 mt-1">
                Konten <strong>&quot;{deleteTarget.title}&quot;</strong> akan dihapus permanen dari sistem.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
