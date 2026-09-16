'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  Video,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Eye,
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  BarChart3,
  Award,
  Zap,
  Filter,
  Flame,
  CheckCircle2,
  RefreshCw,
  CreditCard,
  Utensils,
  FileSpreadsheet,
  Truck,
} from 'lucide-react'
import {
  createEndorsement,
  updateEndorsement,
  updateEndorsementStatus,
  deleteEndorsement,
  updateVideoMetrics,
} from '@/app/actions/endorsements'
import {
  autoFetchVideoMetrics,
  syncSingleEndorsementVideo,
  syncAllActiveVideos,
} from '@/app/actions/sync'
import EndorsementFinanceView from './EndorsementFinanceView'
import ImportExcelModal from '@/components/dashboard/ImportExcelModal'

export interface SerializedEndorsementPost {
  id: string
  endorsementId: string
  platform: string
  customPlatformName?: string | null
  postUrl: string
  status: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  postedAt: string | null
}

export interface SerializedEndorsement {
  id: string
  kolId: string
  outletId: string
  scheduleDate: string
  rateCard: number
  menuGiven?: string | null
  hppMenu?: number
  shippingCost?: number
  totalCost?: number
  type?: string
  shippingAddress?: string | null
  recipientName?: string | null
  courierResi?: string | null
  isShipped?: boolean
  shippingDate?: string | null
  postUrl: string | null
  initialViews: number | null
  finalViews: number | null
  likes: number
  comments: number
  shares: number
  saves: number
  visitStatus: string
  postStatus: string
  draftStatus?: string
  paymentStatus?: string
  paymentDate?: string | null
  paymentNotes?: string | null
  bankAccountCustom?: string | null
  createdAt: string
  posts?: SerializedEndorsementPost[]
  kol: {
    id: string
    name: string
    tiktokUrl: string | null
    instagramUrl: string | null
    phoneNumber: string | null
    bankAccount?: string | null
  }
  outlet: {
    id: string
    name: string
    type?: string
  }
}

interface EndorsementListProps {
  initialEndorsements: SerializedEndorsement[]
  outlets: Array<{ id: string; name: string }>
  kols: Array<{ id: string; name: string }>
  userRole: string
}

const VISIT_STATUSES = ['PENDING', 'VISITED', 'CANCELED']
const POST_STATUSES = ['OFF', 'ON', 'TAKE_DOWN']

export default function EndorsementList({
  initialEndorsements,
  outlets,
  kols,
  userRole,
}: EndorsementListProps) {
  // Tab Switcher state
  const [activeTab, setActiveTab] = useState<'operations' | 'finance' | 'analytics'>('operations')

  // Common filters
  const [search, setSearch] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [visitFilter, setVisitFilter] = useState('')
  const [postFilter, setPostFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VISIT' | 'DELIVERY'>('ALL')

  // Analytics specific filters
  const [performanceFilter, setPerformanceFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'views' | 'er' | 'cpv' | 'engagement'>('views')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingEndorsement, setEditingEndorsement] = useState<SerializedEndorsement | null>(null)
  const [videoMetricsTarget, setVideoMetricsTarget] = useState<SerializedEndorsement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedEndorsement | null>(null)

  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Menu & HPP preset states for modals
  const [createType, setCreateType] = useState<'VISIT' | 'DELIVERY'>('VISIT')
  const [createShippingCost, setCreateShippingCost] = useState<string>('0')
  const [createMenuName, setCreateMenuName] = useState('Ayam jumbo dan Sapi sedang')
  const [createHpp, setCreateHpp] = useState(38000)
  const [createRateCard, setCreateRateCard] = useState<string>('0')

  const [editType, setEditType] = useState<'VISIT' | 'DELIVERY'>('VISIT')
  const [editShippingCost, setEditShippingCost] = useState<string>('0')
  const [editMenuName, setEditMenuName] = useState('')
  const [editHpp, setEditHpp] = useState(0)
  const [editRateCard, setEditRateCard] = useState<string>('0')

  // Live calculation state inside the Video Metrics Modal
  const [metricViews, setMetricViews] = useState<number>(0)
  const [metricLikes, setMetricLikes] = useState<number>(0)
  const [metricComments, setMetricComments] = useState<number>(0)
  const [metricShares, setMetricShares] = useState<number>(0)
  const [metricSaves, setMetricSaves] = useState<number>(0)

  // Sync state
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Auto-fetch state inside modal
  const [endorsementUrl, setEndorsementUrl] = useState('')
  const [isFetchingEndorsementMetric, setIsFetchingEndorsementMetric] = useState(false)
  const [fetchEndorsementNotice, setFetchEndorsementNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filter endorsements for operations tab
  const filteredOperations = initialEndorsements.filter((item) => {
    const matchesSearch =
      item.kol.name.toLowerCase().includes(search.toLowerCase()) ||
      item.outlet.name.toLowerCase().includes(search.toLowerCase())

    const matchesOutlet = outletFilter ? item.outletId === outletFilter : true
    const matchesVisit = visitFilter ? item.visitStatus === visitFilter : true
    const matchesPost = postFilter ? item.postStatus === postFilter : true
    const matchesType = typeFilter === 'ALL' ? true : (item.type || 'VISIT') === typeFilter

    return matchesSearch && matchesOutlet && matchesVisit && matchesPost && matchesType
  })

  // Calculations for analytics tab
  const processedAnalytics = useMemo(() => {
    return initialEndorsements.map((item) => {
      const finalViews = item.finalViews ?? item.initialViews ?? 0
      const likes = item.likes ?? 0
      const comments = item.comments ?? 0
      const shares = item.shares ?? 0
      const saves = item.saves ?? 0
      const totalEngagement = likes + comments + shares + saves
      const er = finalViews > 0 ? (totalEngagement / finalViews) * 100 : 0
      const cpv = finalViews > 0 ? item.rateCard / finalViews : 0
      const cpe = totalEngagement > 0 ? item.rateCard / totalEngagement : 0

      let category: 'VIRAL' | 'EFFICIENT' | 'UNDERPERFORMING' | 'PENDING' = 'PENDING'
      if (item.postStatus !== 'ON' || finalViews === 0) {
        category = 'PENDING'
      } else if (cpv > 0 && (cpv < 60 || er >= 7.0 || finalViews >= 50000)) {
        category = 'VIRAL'
      } else if (cpv <= 150 || er >= 3.0) {
        category = 'EFFICIENT'
      } else {
        category = 'UNDERPERFORMING'
      }

      return {
        ...item,
        effectiveViews: finalViews,
        totalEngagement,
        engagementRate: er,
        cpv,
        cpe,
        category,
      }
    })
  }, [initialEndorsements])

  // Filter & sort for analytics tab
  const filteredAnalytics = useMemo(() => {
    return processedAnalytics
      .filter((item) => {
        const matchesSearch =
          item.kol.name.toLowerCase().includes(search.toLowerCase()) ||
          item.outlet.name.toLowerCase().includes(search.toLowerCase())

        const matchesOutlet = outletFilter ? item.outletId === outletFilter : true
        const matchesCategory =
          performanceFilter === 'ALL' ? true : item.category === performanceFilter

        return matchesSearch && matchesOutlet && matchesCategory
      })
      .sort((a, b) => {
        if (sortBy === 'views') return b.effectiveViews - a.effectiveViews
        if (sortBy === 'er') return b.engagementRate - a.engagementRate
        if (sortBy === 'cpv') {
          // Put zero views / pending at the bottom
          if (a.cpv === 0) return 1
          if (b.cpv === 0) return -1
          return a.cpv - b.cpv
        }
        if (sortBy === 'engagement') return b.totalEngagement - a.totalEngagement
        return 0
      })
  }, [processedAnalytics, search, outletFilter, performanceFilter, sortBy])

  // Aggregate metrics for Analytics Overview
  const activeVideos = processedAnalytics.filter((i) => i.effectiveViews > 0 && i.postStatus === 'ON')
  const totalSpendActive = activeVideos.reduce((acc, curr) => acc + curr.rateCard, 0)
  const totalViewsActive = activeVideos.reduce((acc, curr) => acc + curr.effectiveViews, 0)
  const totalEngagementActive = activeVideos.reduce((acc, curr) => acc + curr.totalEngagement, 0)

  const avgCPV = totalViewsActive > 0 ? totalSpendActive / totalViewsActive : 0
  const avgER = totalViewsActive > 0 ? (totalEngagementActive / totalViewsActive) * 100 : 0
  const topPerformer = [...activeVideos].sort((a, b) => b.effectiveViews - a.effectiveViews)[0]

  // Operations summary
  const totalBudget = filteredOperations.reduce((acc, curr) => acc + (curr.rateCard || 0), 0)
  const totalViewsOps = filteredOperations.reduce(
    (acc, curr) => acc + (curr.finalViews || curr.initialViews || 0),
    0
  )
  const activeCountOps = filteredOperations.filter((i) => i.postStatus === 'ON').length

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createEndorsement({}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsCreateOpen(false)
      }
    })
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingEndorsement) return
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateEndorsement(editingEndorsement.id, {}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setEditingEndorsement(null)
      }
    })
  }

  const handleQuickStatus = async (
    id: string,
    newVisit: string,
    newPost: string
  ) => {
    startTransition(async () => {
      const res = await updateEndorsementStatus(id, newVisit, newPost)
      if (res?.error) {
        setErrorMessage(res.error)
      }
    })
  }

  const handleUpdateVideoMetrics = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!videoMetricsTarget) return
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateVideoMetrics(videoMetricsTarget.id, {}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setVideoMetricsTarget(null)
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setErrorMessage('')

    startTransition(async () => {
      const res = await deleteEndorsement(deleteTarget.id)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setDeleteTarget(null)
      }
    })
  }

  const openVideoMetricsModal = (item: SerializedEndorsement) => {
    setVideoMetricsTarget(item)
    setEndorsementUrl(item.postUrl || '')
    setMetricViews(item.finalViews ?? item.initialViews ?? 0)
    setMetricLikes(item.likes ?? 0)
    setMetricComments(item.comments ?? 0)
    setMetricShares(item.shares ?? 0)
    setMetricSaves(item.saves ?? 0)
    setFetchEndorsementNotice(null)
    setErrorMessage('')
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    setSyncBanner(null)
    setErrorMessage('')
    try {
      const res = await syncAllActiveVideos()
      if (res.success) {
        setSyncBanner({
          type: 'success',
          message: res.message || `${res.updatedCount} video endorsement berhasil disinkronkan.`,
        })
      } else {
        setSyncBanner({
          type: 'error',
          message: res.message || 'Gagal menyinkronkan video endorsement.',
        })
      }
    } catch (err: any) {
      setSyncBanner({
        type: 'error',
        message: err?.message || 'Terjadi kesalahan sistem saat sync.',
      })
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleSyncSingleEndorsement = async (id: string) => {
    setSyncingId(id)
    setSyncBanner(null)
    try {
      const res = await syncSingleEndorsementVideo(id)
      if (res.success) {
        setSyncBanner({
          type: 'success',
          message: `Metrik video endorsement berhasil diupdate (${(res.metrics?.views || 0).toLocaleString('id-ID')} views)!`,
        })
      } else {
        setSyncBanner({
          type: 'error',
          message: res.error || 'Gagal sync video endorsement ini.',
        })
      }
    } catch (err: any) {
      setSyncBanner({
        type: 'error',
        message: err?.message || 'Terjadi kesalahan saat sync endorsement.',
      })
    } finally {
      setSyncingId(null)
    }
  }

  const handleAutoFetchEndorsement = async () => {
    if (!endorsementUrl.trim()) {
      setFetchEndorsementNotice({
        type: 'error',
        message: 'Masukkan URL video konten terlebih dahulu',
      })
      return
    }
    setIsFetchingEndorsementMetric(true)
    setFetchEndorsementNotice(null)
    try {
      const res = await autoFetchVideoMetrics(endorsementUrl)
      if (res.success && res.data) {
        if (res.data.views !== undefined && res.data.views > 0) setMetricViews(res.data.views)
        if (res.data.likes !== undefined && res.data.likes > 0) setMetricLikes(res.data.likes)
        if (res.data.comments !== undefined && res.data.comments > 0) setMetricComments(res.data.comments)
        if (res.data.shares !== undefined && res.data.shares > 0) setMetricShares(res.data.shares)
        if (res.data.saves !== undefined && res.data.saves > 0) setMetricSaves(res.data.saves)
        setFetchEndorsementNotice({
          type: 'success',
          message: `✅ Metrik ditarik: ${(res.data.views || 0).toLocaleString('id-ID')} views, ${(res.data.likes || 0).toLocaleString('id-ID')} likes!`,
        })
      } else {
        setFetchEndorsementNotice({
          type: 'error',
          message: res.error || 'Tidak dapat membaca data dari link video ini. Silakan input manual.',
        })
      }
    } catch (err: any) {
      setFetchEndorsementNotice({
        type: 'error',
        message: err?.message || 'Gagal menghubungi server.',
      })
    } finally {
      setIsFetchingEndorsementMetric(false)
    }
  }

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <Video className="w-3.5 h-3.5" />
            <span>KOL Marketing Operations & Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Endorsement & Video Analytics
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Manajemen jadwal visit KOL, status postingan, serta analisis mendalam performa video (Views, ER%, CPV, dan Interaksi).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white hover:bg-[#FAF8F5] text-stone-700 border border-[#EFE8DE] rounded-xl text-xs sm:text-sm font-bold shadow-2xs hover:border-[#D9480F]/40 transition-all cursor-pointer disabled:opacity-50"
            title="Update metrik seluruh video endorsement secara otomatis dari URL"
          >
            <RefreshCw className={`w-4 h-4 text-[#D9480F] ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>{isSyncingAll ? 'Menyinkronkan...' : 'Sync Semua Video'}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer"
            title="Import Excel spreadsheet Marcom (Budget, Endorsement, Payment, Ads)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => {
              setErrorMessage('')
              setIsCreateOpen(true)
            }}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Jadwalkan Endorsement</span>
          </button>
        </div>
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

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#EFE8DE]/60 rounded-2xl w-fit border border-[#EFE8DE]">
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'operations'
              ? 'bg-white text-[#1A1715] shadow-xs'
              : 'text-stone-600 hover:text-[#1A1715]'
          }`}
        >
          <Calendar className="w-4 h-4 text-[#D9480F]" />
          <span>Jadwal & Operasional</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
            {initialEndorsements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'finance'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-stone-600 hover:text-[#1A1715]'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>Pembayaran & Finance</span>
          {initialEndorsements.filter((i) => (i.paymentStatus === 'UNPAID' || i.paymentStatus === 'DOWN_PAYMENT') && i.rateCard > 0).length > 0 && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                activeTab === 'finance'
                  ? 'bg-white/25 text-white'
                  : 'bg-amber-100 text-amber-800 font-mono'
              }`}
            >
              {initialEndorsements.filter((i) => (i.paymentStatus === 'UNPAID' || i.paymentStatus === 'DOWN_PAYMENT') && i.rateCard > 0).length} Belum Bayar
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[#D9480F] text-white shadow-xs'
              : 'text-stone-600 hover:text-[#1A1715]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Video Analytics & ROI</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              activeTab === 'analytics'
                ? 'bg-white/25 text-white'
                : 'bg-[#D9480F]/10 text-[#D9480F]'
            }`}
          >
            Pro
          </span>
        </button>
      </div>

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingEndorsement && !deleteTarget && !videoMetricsTarget && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: JADWAL & OPERASIONAL */}
      {activeTab === 'operations' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Summary KPI Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Total Alokasi Budget
                </div>
                <div className="text-xl font-extrabold font-mono text-[#1A1715]">
                  {formatRupiah(totalBudget)}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Total Views Terkumpul
                </div>
                <div className="text-xl font-extrabold font-mono text-[#1A1715]">
                  {totalViewsOps.toLocaleString('id-ID')}{' '}
                  <span className="text-xs text-stone-500 font-sans">views</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Konten Tayang (ON)
                </div>
                <div className="text-xl font-extrabold text-emerald-800">
                  {activeCountOps} <span className="text-xs text-stone-500 font-normal">konten aktif</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari KOL atau Cabang..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                />
              </div>

              {/* Filter Tipe Endorsement */}
              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                >
                  <option value="ALL">Semua Tipe Endorse</option>
                  <option value="VISIT">Visit Outlet Fisik</option>
                  <option value="DELIVERY">SS Online (Ekspedisi)</option>
                </select>
              </div>

              {/* Filter Outlet */}
              <div>
                <select
                  value={outletFilter}
                  onChange={(e) => setOutletFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                >
                  <option value="">Semua Cabang</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Visit Status */}
              <div>
                <select
                  value={visitFilter}
                  onChange={(e) => setVisitFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                >
                  <option value="">Status Kehadiran</option>
                  <option value="PENDING">Visit: PENDING</option>
                  <option value="VISITED">Visit: VISITED</option>
                  <option value="CANCELED">Visit: CANCELED</option>
                </select>
              </div>

              {/* Filter Post Status */}
              <div>
                <select
                  value={postFilter}
                  onChange={(e) => setPostFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                >
                  <option value="">Status Tayang</option>
                  <option value="ON">Tayang: ON</option>
                  <option value="OFF">Tayang: OFF</option>
                  <option value="TAKE_DOWN">Tayang: TAKE_DOWN</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500 font-medium pt-2 border-t border-[#EFE8DE]">
              <span>
                Ditemukan <span className="font-bold text-[#1A1715]">{filteredOperations.length}</span> data endorsement
              </span>
              {(search || outletFilter || visitFilter || postFilter) && (
                <button
                  onClick={() => {
                    setSearch('')
                    setOutletFilter('')
                    setVisitFilter('')
                    setPostFilter('')
                  }}
                  className="text-[#D9480F] hover:underline font-bold cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-stone-600">
                <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE]">
                  <tr>
                    <th className="py-4 px-4 sm:px-6">KOL / Influencer</th>
                    <th className="py-4 px-4">Cabang</th>
                    <th className="py-4 px-4">Jadwal Visit</th>
                    <th className="py-4 px-4">Rate Card</th>
                    <th className="py-4 px-4">Status Visit</th>
                    <th className="py-4 px-4">Status Tayang</th>
                    <th className="py-4 px-4 text-center">Metrik Video</th>
                    <th className="py-4 px-4 sm:px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE8DE]">
                  {filteredOperations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-400">
                        <Video className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                        <p className="font-semibold text-stone-600">Tidak ada data endorsement yang cocok.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOperations.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {item.kol.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[#1A1715]">{item.kol.name}</div>
                              <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                                {item.kol.tiktokUrl && (
                                  <a
                                    href={item.kol.tiktokUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-[#D9480F] inline-flex items-center gap-0.5"
                                  >
                                    <span>TikTok</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                                {item.kol.instagramUrl && (
                                  <a
                                    href={item.kol.instagramUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-[#D9480F] inline-flex items-center gap-0.5"
                                  >
                                    <span>IG</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 font-semibold text-[#1A1715]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{item.outlet.name}</span>
                            {item.type === 'DELIVERY' && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                <Truck className="w-2.5 h-2.5" />
                                SS Online
                              </span>
                            )}
                          </div>
                          {item.type === 'DELIVERY' && item.courierResi && (
                            <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                              Resi: {item.courierResi}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 text-xs">
                          <div className="font-medium text-stone-700">
                            {new Date(item.scheduleDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>

                        <td className="py-4 px-4 font-mono font-bold text-stone-900">
                          {formatRupiah(item.rateCard)}
                        </td>

                        <td className="py-4 px-4">
                          <select
                            value={item.visitStatus}
                            onChange={(e) =>
                              handleQuickStatus(item.id, e.target.value, item.postStatus)
                            }
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                              item.visitStatus === 'VISITED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.visitStatus === 'CANCELED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="VISITED">VISITED</option>
                            <option value="CANCELED">CANCELED</option>
                          </select>
                        </td>

                        <td className="py-4 px-4">
                          <select
                            value={item.postStatus}
                            onChange={(e) =>
                              handleQuickStatus(item.id, item.visitStatus, e.target.value)
                            }
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                              item.postStatus === 'ON'
                                ? 'bg-[#D9480F]/10 text-[#D9480F] border-[#D9480F]/20'
                                : item.postStatus === 'TAKE_DOWN'
                                ? 'bg-stone-200 text-stone-700 border-stone-300'
                                : 'bg-stone-100 text-stone-600 border-stone-200'
                            }`}
                          >
                            <option value="OFF">OFF</option>
                            <option value="ON">ON</option>
                            <option value="TAKE_DOWN">TAKE_DOWN</option>
                          </select>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            {item.postUrl && (
                              <button
                                onClick={() => handleSyncSingleEndorsement(item.id)}
                                disabled={syncingId === item.id}
                                className="p-1 text-stone-400 hover:text-[#D9480F] hover:bg-[#FFF4ED] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Sync metrik langsung dari link video"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    syncingId === item.id ? 'animate-spin text-[#D9480F]' : ''
                                  }`}
                                />
                              </button>
                            )}
                            <button
                              onClick={() => openVideoMetricsModal(item)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-[#FFF4ED] hover:text-[#D9480F] text-stone-700 font-bold text-xs transition-colors border border-stone-200 hover:border-[#D9480F]/40 cursor-pointer"
                              title="Update Metrik Views & Engagement Video"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>
                                {(item.finalViews || item.initialViews) ? (
                                  `${(item.finalViews || item.initialViews)?.toLocaleString('id-ID')} views`
                                ) : (
                                  '+ Metrik'
                                )}
                              </span>
                            </button>
                          </div>
                        </td>

                        <td className="py-4 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => {
                                setErrorMessage('')
                                setEditingEndorsement(item)
                              }}
                              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Data Endorsement"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {userRole === 'ADMIN' && (
                              <button
                                onClick={() => {
                                  setErrorMessage('')
                                  setDeleteTarget(item)
                                }}
                                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Endorsement"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VIDEO ANALYTICS & ROI */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Executive Analytics Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPV Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Rata-rata CPV (Biaya / View)
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-mono text-[#1A1715]">
                  {formatRupiah(avgCPV)} <span className="text-xs text-stone-500 font-sans">/ view</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  {avgCPV < 100 ? '🔥 Efisiensi Sangat Baik (< Rp 100)' : 'Standar industri kuliner (Rp 100-200)'}
                </p>
              </div>
            </div>

            {/* Engagement Rate Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Rata-rata Engagement Rate
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-mono text-amber-700">
                  {avgER.toFixed(2)}%
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  {avgER >= 5.0 ? '🚀 Sangat Tinggi (Audiens antusias)' : 'Benchmark F&B: 3% - 6%'}
                </p>
              </div>
            </div>

            {/* Total Interactions Card */}
            <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                  Total Interaksi Audiens
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Heart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-mono text-emerald-800">
                  {totalEngagementActive.toLocaleString('id-ID')}
                </div>
                <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-2">
                  <span>Likes, komentar, share & simpan</span>
                </div>
              </div>
            </div>

            {/* Top Performer Card */}
            <div className="bg-gradient-to-br from-[#1C1917] to-[#292524] p-5 rounded-3xl text-white shadow-xs flex flex-col justify-between border border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-300 font-bold uppercase tracking-wider">
                  Video Paling Viral
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="font-bold text-sm text-white truncate">
                  {topPerformer ? topPerformer.kol.name : 'Belum Ada'}
                </div>
                <div className="text-xs text-amber-200 mt-0.5">
                  {topPerformer ? (
                    `${topPerformer.effectiveViews.toLocaleString('id-ID')} views • @${topPerformer.outlet.name}`
                  ) : (
                    'Input metrik video untuk melihat ranking'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Filters & Sorting Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari video influencer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                />
              </div>

              {/* Outlet Filter */}
              <div>
                <select
                  value={outletFilter}
                  onChange={(e) => setOutletFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                >
                  <option value="">Semua Cabang / Outlet</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Performance Category Filter */}
              <div>
                <select
                  value={performanceFilter}
                  onChange={(e) => setPerformanceFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                >
                  <option value="ALL">Semua Kategori Kinerja</option>
                  <option value="VIRAL">🚀 Viral / Top Performer</option>
                  <option value="EFFICIENT">⭐ Efisien & Standar</option>
                  <option value="UNDERPERFORMING">⚠️ Perlu Evaluasi</option>
                  <option value="PENDING">⏳ Menunggu Data / Belum Tayang</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
                >
                  <option value="views">Urutkan: Views Terbanyak</option>
                  <option value="er">Urutkan: Engagement Rate (ER%)</option>
                  <option value="cpv">Urutkan: Biaya per View (CPV Termurah)</option>
                  <option value="engagement">Urutkan: Total Interaksi Tertinggi</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500 font-medium pt-2 border-t border-[#EFE8DE]">
              <span>
                Menampilkan <span className="font-bold text-[#1A1715]">{filteredAnalytics.length}</span> video dianalisis
              </span>
              {(search || outletFilter || performanceFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearch('')
                    setOutletFilter('')
                    setPerformanceFilter('ALL')
                  }}
                  className="text-[#D9480F] hover:underline font-bold cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Analytics Table */}
          <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-stone-600">
                <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE]">
                  <tr>
                    <th className="py-4 px-4 sm:px-6">Video & Influencer</th>
                    <th className="py-4 px-4">Cabang</th>
                    <th className="py-4 px-4">Views Video</th>
                    <th className="py-4 px-4">Rincian Interaksi (Like/Komen/Share)</th>
                    <th className="py-4 px-4">Engagement Rate</th>
                    <th className="py-4 px-4">Efisiensi Biaya (CPV)</th>
                    <th className="py-4 px-4">Status Kinerja</th>
                    <th className="py-4 px-4 sm:px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE8DE]">
                  {filteredAnalytics.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-400">
                        <BarChart3 className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                        <p className="font-semibold text-stone-600">Tidak ada data video yang sesuai kriteria filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAnalytics.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        {/* Video & Influencer */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] font-black text-xs flex items-center justify-center flex-shrink-0">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-[#1A1715] flex items-center gap-1.5">
                                <span>{item.kol.name}</span>
                                {item.postUrl && (
                                  <a
                                    href={item.postUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#D9480F] hover:text-[#B83808]"
                                    title="Tonton Video Konten"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              <div className="text-[11px] text-stone-400 mt-0.5">
                                Rate: {formatRupiah(item.rateCard)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Outlet */}
                        <td className="py-4 px-4 font-semibold text-stone-800">
                          {item.outlet.name}
                        </td>

                        {/* Views */}
                        <td className="py-4 px-4">
                          <div className="font-extrabold font-mono text-stone-900 text-sm">
                            {item.effectiveViews.toLocaleString('id-ID')}
                          </div>
                          {item.initialViews && item.finalViews && (
                            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                              <span>+{Math.max(0, item.finalViews - item.initialViews).toLocaleString('id-ID')} views</span>
                            </div>
                          )}
                        </td>

                        {/* Engagement breakdown */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold" title="Likes">
                              <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                              <span>{item.likes.toLocaleString('id-ID')}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold" title="Comments">
                              <MessageSquare className="w-3 h-3 text-blue-500" />
                              <span>{item.comments.toLocaleString('id-ID')}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold" title="Shares">
                              <Share2 className="w-3 h-3 text-emerald-500" />
                              <span>{item.shares.toLocaleString('id-ID')}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold" title="Saves">
                              <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span>{item.saves.toLocaleString('id-ID')}</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400 font-medium mt-1">
                            Total: <strong className="text-stone-700">{item.totalEngagement.toLocaleString('id-ID')}</strong> interaksi
                          </div>
                        </td>

                        {/* Engagement Rate */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="font-extrabold font-mono text-stone-900 text-sm">
                              {item.engagementRate.toFixed(2)}%
                            </div>
                            <div className="w-12 bg-stone-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  item.engagementRate >= 7.0
                                    ? 'bg-emerald-500'
                                    : item.engagementRate >= 3.0
                                    ? 'bg-amber-500'
                                    : 'bg-stone-300'
                                }`}
                                style={{ width: `${Math.min(100, item.engagementRate * 10)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-stone-400">
                            {item.engagementRate >= 7.0
                              ? 'Sangat Tinggi'
                              : item.engagementRate >= 3.0
                              ? 'Normal'
                              : 'Rendah'}
                          </span>
                        </td>

                        {/* Cost Per View */}
                        <td className="py-4 px-4">
                          {item.effectiveViews > 0 ? (
                            <div>
                              <div className="font-extrabold font-mono text-stone-900">
                                {formatRupiah(item.cpv)}
                                <span className="text-[10px] text-stone-400 font-normal"> / view</span>
                              </div>
                              <div className="text-[10px] text-stone-400 font-mono">
                                CPE: {formatRupiah(item.cpe)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </td>

                        {/* Performance Category Badge */}
                        <td className="py-4 px-4">
                          {item.category === 'VIRAL' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Flame className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                              <span>Viral / Top</span>
                            </span>
                          )}
                          {item.category === 'EFFICIENT' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                              <CheckCircle2 className="w-3 h-3 text-amber-600" />
                              <span>Efisien</span>
                            </span>
                          )}
                          {item.category === 'UNDERPERFORMING' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              <span>Evaluasi</span>
                            </span>
                          )}
                          {item.category === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-stone-100 text-stone-500 border border-stone-200">
                              <span>Menunggu Data</span>
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {item.postUrl && (
                              <button
                                onClick={() => handleSyncSingleEndorsement(item.id)}
                                disabled={syncingId === item.id}
                                className="p-1.5 text-stone-400 hover:text-[#D9480F] hover:bg-[#FFF4ED] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Sync metrik langsung dari link video"
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    syncingId === item.id ? 'animate-spin text-[#D9480F]' : ''
                                  }`}
                                />
                              </button>
                            )}
                            <button
                              onClick={() => openVideoMetricsModal(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D9480F] hover:bg-[#B83808] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>Update</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PEMBAYARAN & FINANCE */}
      {activeTab === 'finance' && (
        <EndorsementFinanceView
          endorsements={initialEndorsements}
          outlets={outlets}
          userRole={userRole}
          onEdit={(item) => {
            setEditingEndorsement(item)
          }}
        />
      )}

      {/* MODAL: UPDATE METRIK VIDEO & ENGAGEMENT */}
      {videoMetricsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1715] text-base sm:text-lg">
                    Update Metrik Video Endorsement
                  </h3>
                  <p className="text-xs text-stone-500">
                    KOL: <strong className="text-[#1A1715]">{videoMetricsTarget.kol.name}</strong> •{' '}
                    Cabang: <strong className="text-[#1A1715]">{videoMetricsTarget.outlet.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVideoMetricsTarget(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateVideoMetrics} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* URL Video Konten */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Link URL Video Konten
                  </label>
                  <span className="text-[10px] text-stone-400">TikTok, Reels, Shorts</span>
                </div>
                <div className="flex gap-2">
                  <input
                    name="postUrl"
                    type="url"
                    value={endorsementUrl}
                    onChange={(e) => setEndorsementUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@... atau https://instagram.com/reel/..."
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                  <button
                    type="button"
                    onClick={handleAutoFetchEndorsement}
                    disabled={isFetchingEndorsementMetric || !endorsementUrl.trim()}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-[#FFF4ED] hover:bg-[#FFE8D9] text-[#D9480F] border border-[#D9480F]/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Tarik views & engagement terkini dari URL"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isFetchingEndorsementMetric ? 'animate-spin' : ''}`} />
                    <span>{isFetchingEndorsementMetric ? 'Menarik...' : 'Tarik Metrik'}</span>
                  </button>
                </div>
                {fetchEndorsementNotice && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                      fetchEndorsementNotice.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {fetchEndorsementNotice.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    )}
                    <span>{fetchEndorsementNotice.message}</span>
                  </div>
                )}
              </div>

              {/* Views Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Views Awal (24 Jam Pertama)
                  </label>
                  <input
                    name="initialViews"
                    type="number"
                    min="0"
                    defaultValue={videoMetricsTarget.initialViews ?? ''}
                    placeholder="Contoh: 15000"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Views Terkini / Akhir
                  </label>
                  <input
                    name="finalViews"
                    type="number"
                    min="0"
                    value={metricViews}
                    onChange={(e) => setMetricViews(parseInt(e.target.value, 10) || 0)}
                    placeholder="Contoh: 65000"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              {/* Engagement Inputs */}
              <div>
                <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Metrik Interaksi Audiens
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <Heart className="w-3 h-3 text-rose-500" />
                      <span>Likes</span>
                    </label>
                    <input
                      name="likes"
                      type="number"
                      min="0"
                      value={metricLikes}
                      onChange={(e) => setMetricLikes(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3 h-3 text-blue-500" />
                      <span>Comments</span>
                    </label>
                    <input
                      name="comments"
                      type="number"
                      min="0"
                      value={metricComments}
                      onChange={(e) => setMetricComments(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <Share2 className="w-3 h-3 text-emerald-500" />
                      <span>Shares</span>
                    </label>
                    <input
                      name="shares"
                      type="number"
                      min="0"
                      value={metricShares}
                      onChange={(e) => setMetricShares(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <Bookmark className="w-3 h-3 text-amber-500" />
                      <span>Saves</span>
                    </label>
                    <input
                      name="saves"
                      type="number"
                      min="0"
                      value={metricSaves}
                      onChange={(e) => setMetricSaves(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              {(() => {
                const totalEng = metricLikes + metricComments + metricShares + metricSaves
                const er = metricViews > 0 ? (totalEng / metricViews) * 100 : 0
                const cpv = metricViews > 0 ? videoMetricsTarget.rateCard / metricViews : 0
                const cpe = totalEng > 0 ? videoMetricsTarget.rateCard / totalEng : 0

                return (
                  <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#D9480F] uppercase tracking-wider">
                      <span>Kalkulasi Otomatis Sistem</span>
                      <span>Rate Card: {formatRupiah(videoMetricsTarget.rateCard)}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">Total Engagement</span>
                        <span className="text-sm font-extrabold text-[#1A1715]">
                          {totalEng.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">Engagement Rate</span>
                        <span className="text-sm font-extrabold text-amber-700">
                          {er.toFixed(2)}%
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">Cost Per View (CPV)</span>
                        <span className="text-sm font-extrabold text-emerald-700 font-mono">
                          {formatRupiah(cpv)}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">Cost Per Eng. (CPE)</span>
                        <span className="text-sm font-extrabold text-stone-800 font-mono">
                          {formatRupiah(cpe)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setVideoMetricsTarget(null)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Metrik Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH ENDORSEMENT BARU */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1715] text-base sm:text-lg">
                    Jadwalkan Endorsement
                  </h3>
                  <p className="text-xs text-stone-500">
                    Input jadwal visit influencer ke cabang outlet Suka Shawarma.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 sm:p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Pilih KOL / Influencer *
                </label>
                <select
                  name="kolId"
                  required
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                >
                  <option value="">-- Pilih Profil KOL --</option>
                  {kols.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tipe Endorsement *
                  </label>
                  <select
                    name="type"
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as any)}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] font-semibold"
                  >
                    <option value="VISIT">Visit Outlet Fisik</option>
                    <option value="DELIVERY">SS Online (Paket Ekspedisi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    {createType === 'DELIVERY' ? 'Outlet Pengirim / Dapur *' : 'Pilih Cabang Outlet *'}
                  </label>
                  <select
                    name="outletId"
                    required
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional SS Online Delivery Fields */}
              {createType === 'DELIVERY' && (
                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Rincian Pengiriman SS Online</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Nama Penerima Paket
                      </label>
                      <input
                        name="recipientName"
                        type="text"
                        placeholder="Nama kontak / manajer KOL"
                        className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        No Resi Ekspedisi
                      </label>
                      <input
                        name="courierResi"
                        type="text"
                        placeholder="Contoh: JNE / Paxel / J&T"
                        className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      Alamat Lengkap Pengiriman
                    </label>
                    <textarea
                      name="shippingAddress"
                      rows={2}
                      placeholder="Alamat rumah / kantor influencer..."
                      className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Ongkos Kirim / Ekspedisi (Rp)
                      </label>
                      <input
                        name="shippingCost"
                        type="number"
                        min="0"
                        step="1000"
                        value={createShippingCost}
                        onChange={(e) => setCreateShippingCost(e.target.value)}
                        placeholder="Contoh: 25000"
                        className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none font-mono"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-blue-950 cursor-pointer">
                        <input
                          name="isShipped"
                          type="checkbox"
                          value="true"
                          className="rounded border-blue-300 text-blue-600 focus:ring-0"
                        />
                        <span>Paket Sudah Dikirimkan</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal Visit *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Rate Card (Cash) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setCreateRateCard('0')}
                      className="text-[10px] text-blue-700 hover:underline font-bold"
                    >
                      Set Barter (Rp 0)
                    </button>
                  </div>
                  <input
                    name="rateCard"
                    type="number"
                    min="0"
                    step="1000"
                    value={createRateCard}
                    onChange={(e) => setCreateRateCard(e.target.value)}
                    placeholder="0 jika barter"
                    required
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] font-mono"
                  />
                </div>
              </div>

              {/* Menu & HPP Preset Block */}
              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFE8DE] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-[#D9480F]" />
                    <span>Menu Complimentary & HPP</span>
                  </label>
                  <span className="text-[10px] text-stone-500">Biaya Makanan</span>
                </div>

                <div>
                  <select
                    onChange={(e) => {
                      if (e.target.value === 'ayam_sapi_38') {
                        setCreateMenuName('Ayam jumbo dan Sapi sedang')
                        setCreateHpp(38000)
                      } else if (e.target.value === 'pekayon_418') {
                        setCreateMenuName('Ayam jumbo dan Sapi sedang')
                        setCreateHpp(41800)
                      } else if (e.target.value === 'barter_50') {
                        setCreateMenuName('Paket Shawarma Jumbo Mix + Drink')
                        setCreateHpp(50000)
                      } else if (e.target.value === 'custom') {
                        setCreateMenuName('')
                        setCreateHpp(0)
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none"
                  >
                    <option value="ayam_sapi_38">Preset: Ayam Jumbo + Sapi Sedang (HPP Rp 38.000)</option>
                    <option value="pekayon_418">Preset: Pekayon / Pamulang (HPP Rp 41.800)</option>
                    <option value="barter_50">Preset: Barter Spesial (HPP Rp 50.000)</option>
                    <option value="custom">Custom / Input Sendiri</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Nama Menu
                    </label>
                    <input
                      name="menuGiven"
                      value={createMenuName}
                      onChange={(e) => setCreateMenuName(e.target.value)}
                      placeholder="e.g. Ayam jumbo dan Sapi sedang"
                      className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Nominal HPP SS (Rp)
                    </label>
                    <input
                      name="hppMenu"
                      type="number"
                      min="0"
                      value={createHpp}
                      onChange={(e) => setCreateHpp(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Dual Post Links (TikTok & IG) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Link Post TikTok
                  </label>
                  <input
                    name="postUrl"
                    type="url"
                    placeholder="https://vt.tiktok.com/..."
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Link Post IG Reel
                  </label>
                  <input
                    name="postUrlIg"
                    type="url"
                    placeholder="https://instagram.com/reel/..."
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                  />
                </div>
              </div>

              {/* Draft & Payment Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Status Draft Konten
                  </label>
                  <select
                    name="draftStatus"
                    defaultValue="PENDING"
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-medium"
                  >
                    <option value="PENDING">Pending (Menunggu Draft)</option>
                    <option value="APPROVED">Approved (Disetujui)</option>
                    <option value="REVISION">Perlu Revisi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Status Pembayaran
                  </label>
                  <select
                    name="paymentStatus"
                    defaultValue={createRateCard === '0' ? 'BARTER' : 'UNPAID'}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-medium"
                  >
                    <option value="UNPAID">Belum Bayar (Pending)</option>
                    <option value="PAID">Lunas (Done)</option>
                    <option value="BARTER">Barter Produk</option>
                    <option value="DOWN_PAYMENT">DP Sebagian</option>
                  </select>
                </div>
              </div>

              {/* Payment Notes & Bank Override */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Rekening Transfer (Kustom)
                  </label>
                  <input
                    name="bankAccountCustom"
                    placeholder="e.g. BCA 123456 a.n ..."
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Catatan Pembayaran
                  </label>
                  <input
                    name="paymentNotes"
                    placeholder="e.g. Baru transfer DP 100rb"
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ENDORSEMENT DATA */}
      {editingEndorsement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1715] text-base sm:text-lg">
                    Edit Data Endorsement
                  </h3>
                  <p className="text-xs text-stone-500">Perbarui rujukan cabang, jadwal, atau biaya.</p>
                </div>
              </div>
              <button
                onClick={() => setEditingEndorsement(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-5 sm:p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  KOL / Influencer *
                </label>
                <select
                  name="kolId"
                  defaultValue={editingEndorsement.kolId}
                  required
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                >
                  {kols.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tipe Endorsement *
                  </label>
                  <select
                    name="type"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] font-semibold"
                  >
                    <option value="VISIT">Visit Outlet Fisik</option>
                    <option value="DELIVERY">SS Online (Paket Ekspedisi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    {editType === 'DELIVERY' ? 'Outlet Pengirim / Dapur *' : 'Cabang Outlet *'}
                  </label>
                  <select
                    name="outletId"
                    defaultValue={editingEndorsement.outletId}
                    required
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional SS Online Delivery Fields */}
              {editType === 'DELIVERY' && (
                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Rincian Pengiriman SS Online</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Nama Penerima Paket
                      </label>
                      <input
                        name="recipientName"
                        type="text"
                        defaultValue={editingEndorsement.recipientName || ''}
                        placeholder="Nama kontak / manajer KOL"
                        className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        No Resi Ekspedisi
                      </label>
                      <input
                        name="courierResi"
                        type="text"
                        defaultValue={editingEndorsement.courierResi || ''}
                        placeholder="Contoh: JNE / Paxel / J&T"
                        className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      Alamat Lengkap Pengiriman
                    </label>
                    <textarea
                      name="shippingAddress"
                      rows={2}
                      defaultValue={editingEndorsement.shippingAddress || ''}
                      placeholder="Alamat rumah / kantor influencer..."
                      className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Ongkos Kirim / Ekspedisi (Rp)
                      </label>
                      <input
                        name="shippingCost"
                        type="number"
                        min="0"
                        step="1000"
                        value={editShippingCost}
                        onChange={(e) => setEditShippingCost(e.target.value)}
                        placeholder="Contoh: 25000"
                        className="w-full px-3 py-2 text-xs border border-blue-200 bg-white rounded-xl focus:outline-none font-mono"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-blue-950 cursor-pointer">
                        <input
                          name="isShipped"
                          type="checkbox"
                          value="true"
                          defaultChecked={editingEndorsement.isShipped}
                          className="rounded border-blue-300 text-blue-600 focus:ring-0"
                        />
                        <span>Paket Sudah Dikirimkan</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={editingEndorsement.scheduleDate}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Rate Card (Cash) *
                  </label>
                  <input
                    name="rateCard"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={editingEndorsement.rateCard}
                    required
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] font-mono"
                  />
                </div>
              </div>

              {/* Menu & HPP Preset Block */}
              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFE8DE] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-[#D9480F]" />
                    <span>Menu Complimentary & HPP</span>
                  </label>
                  <span className="text-[10px] text-stone-500">Biaya Makanan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Nama Menu
                    </label>
                    <input
                      name="menuGiven"
                      defaultValue={editingEndorsement.menuGiven || 'Ayam jumbo dan Sapi sedang'}
                      placeholder="e.g. Ayam jumbo dan Sapi sedang"
                      className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Nominal HPP SS (Rp)
                    </label>
                    <input
                      name="hppMenu"
                      type="number"
                      min="0"
                      defaultValue={editingEndorsement.hppMenu || 38000}
                      className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Status Visit
                  </label>
                  <select
                    name="visitStatus"
                    defaultValue={editingEndorsement.visitStatus}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    {VISIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Status Tayang (Post)
                  </label>
                  <select
                    name="postStatus"
                    defaultValue={editingEndorsement.postStatus}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    {POST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Link URL Konten
                </label>
                <input
                  name="postUrl"
                  type="url"
                  defaultValue={editingEndorsement.postUrl || ''}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              {/* Draft & Payment Status in Edit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Status Draft Konten
                  </label>
                  <select
                    name="draftStatus"
                    defaultValue={editingEndorsement.draftStatus || 'PENDING'}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-medium"
                  >
                    <option value="PENDING">Pending (Menunggu Draft)</option>
                    <option value="APPROVED">Approved (Disetujui)</option>
                    <option value="REVISION">Perlu Revisi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Status Pembayaran
                  </label>
                  <select
                    name="paymentStatus"
                    defaultValue={editingEndorsement.paymentStatus || 'UNPAID'}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-medium"
                  >
                    <option value="UNPAID">Belum Bayar (Pending)</option>
                    <option value="PAID">Lunas (Done)</option>
                    <option value="BARTER">Barter Produk</option>
                    <option value="DOWN_PAYMENT">DP Sebagian</option>
                  </select>
                </div>
              </div>

              {/* Bank & Payment Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Rekening Transfer (Kustom)
                  </label>
                  <input
                    name="bankAccountCustom"
                    defaultValue={editingEndorsement.bankAccountCustom || editingEndorsement.kol.bankAccount || ''}
                    placeholder="e.g. BCA 123456 a.n ..."
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Catatan Pembayaran
                  </label>
                  <input
                    name="paymentNotes"
                    defaultValue={editingEndorsement.paymentNotes || ''}
                    placeholder="e.g. Lunas via Mandiri / DP 100"
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setEditingEndorsement(null)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Endorsement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-[#1A1715] text-lg">Hapus Endorsement?</h3>
              <p className="text-xs text-stone-500 mt-1.5">
                Apakah Anda yakin ingin menghapus data endorsement untuk{' '}
                <span className="font-bold text-[#1A1715]">&quot;{deleteTarget.kol.name}&quot;</span> di{' '}
                <span className="font-bold text-[#1A1715]">&quot;{deleteTarget.outlet.name}&quot;</span>?
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  )
}
