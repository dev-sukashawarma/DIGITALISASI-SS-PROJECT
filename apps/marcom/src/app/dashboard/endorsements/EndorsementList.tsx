'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  UserPlus,
  ArrowLeft,
  Clock,
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
import VideoPreviewModal from './VideoPreviewModal'
import {
  PlatformIcon,
  TikTokIcon,
  InstagramIcon,
  YouTubeIcon,
  FacebookIcon,
  ThreadsIcon,
} from '@/components/icons/SocialIcons'
import EndorsementMenuSelector, { SelectedMenuItem } from '@/components/dashboard/EndorsementMenuSelector'
import type { PosMenuItem } from '@/lib/supabase-pos'
import { formatLastUpdate, formatFullDateTime } from '@/lib/format-date'

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

export interface PostMetricState {
  id: string
  platform: string
  customPlatformName?: string | null
  postUrl: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
}

export interface SerializedEndorsement {
  id: string
  kolId: string
  outletId: string
  scheduleDate: string
  rateCard: number
  menuGiven?: string | null
  menuItems?: SelectedMenuItem[] | null
  hppMenu?: number
  shippingCost?: number
  totalCost?: number
  posOrderId?: string | null
  posOrderNumber?: number | null
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
    tiktokUrl?: string | null
    instagramUrl?: string | null
    youtubeUrl?: string | null
    facebookUrl?: string | null
    threadsUrl?: string | null
    phoneNumber?: string | null
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
  outlets: Array<{
    id: string
    name: string
    type?: string
    posOutletId?: string | null
    posName?: string | null
    posType?: string | null
    region?: string | null
    isActive?: boolean
  }>
  kols: Array<{ id: string; name: string; phoneNumber?: string | null; bankAccount?: string | null }>
  userRole: string
  posMenuItems?: PosMenuItem[]
  initialLastSyncedAt?: string | null
}

export type SocialPlatform = 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE' | 'FACEBOOK' | 'THREADS'

export interface KolSocialEntry {
  id: string
  platform: SocialPlatform
  handle: string
}

export interface VideoPostEntry {
  id: string
  platform: string
  postUrl: string
  customPlatformName?: string
}

export const VIDEO_PLATFORM_OPTIONS = [
  { value: 'TIKTOK', label: 'TikTok Video', icon: '🎵', placeholder: 'https://www.tiktok.com/@username/video/...' },
  { value: 'IG_REEL', label: 'Instagram Reel', icon: '📸', placeholder: 'https://www.instagram.com/reel/...' },
  { value: 'IG_STORY', label: 'Instagram Story', icon: '⚡', placeholder: 'https://www.instagram.com/stories/...' },
  { value: 'YOUTUBE_SHORTS', label: 'YouTube Shorts', icon: '▶️', placeholder: 'https://youtube.com/shorts/...' },
  { value: 'FACEBOOK', label: 'Facebook Video', icon: '👍', placeholder: 'https://www.facebook.com/.../videos/...' },
  { value: 'THREADS', label: 'Threads', icon: '🧵', placeholder: 'https://www.threads.net/@.../post/...' },
  { value: 'CUSTOM', label: 'Platform Kustom (Lainnya)', icon: '🌐', placeholder: 'https://...' },
] as const

export function detectPlatformFromUrl(url: string): string {
  const u = url.toLowerCase().trim()
  if (u.includes('tiktok.com')) return 'TIKTOK'
  if (u.includes('instagram.com') || u.includes('instagr.am')) {
    if (u.includes('/stories/')) return 'IG_STORY'
    return 'IG_REEL'
  }
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YOUTUBE_SHORTS'
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'FACEBOOK'
  if (u.includes('threads.net')) return 'THREADS'
  return 'TIKTOK'
}

export function getLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getPlatformBadgeConfig(platform: string, customName?: string | null) {
  switch (platform) {
    case 'TIKTOK':
      return { label: 'TikTok', shortLabel: 'TT Video', badgeClass: 'bg-stone-900 text-white border border-stone-800' }
    case 'IG_REEL':
      return { label: 'Instagram Reel', shortLabel: 'IG Reel', badgeClass: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border border-purple-500' }
    case 'IG_STORY':
      return { label: 'Instagram Story', shortLabel: 'IG Story', badgeClass: 'bg-purple-600 text-white border border-purple-500' }
    case 'YOUTUBE_SHORTS':
      return { label: 'YouTube Shorts', shortLabel: 'YT Shorts', badgeClass: 'bg-red-600 text-white border border-red-500' }
    case 'FACEBOOK':
      return { label: 'Facebook', shortLabel: 'FB Video', badgeClass: 'bg-blue-600 text-white border border-blue-500' }
    case 'THREADS':
      return { label: 'Threads', shortLabel: 'Threads', badgeClass: 'bg-stone-800 text-white border border-stone-700' }
    case 'CUSTOM':
    default:
      return {
        label: customName || 'Video',
        shortLabel: customName ? customName.slice(0, 10) : 'Video',
        badgeClass: 'bg-amber-600 text-white border border-amber-500',
      }
  }
}

function VideoPlatformLinksEditor({
  videoLinks,
  onAdd,
  onRemove,
  onPlatformChange,
  onUrlChange,
  onCustomNameChange,
  title = 'Link Video & Konten Multi-Platform',
  description = 'Pilih platform terlebih dahulu, lalu masukkan link URL postingan video.',
}: {
  videoLinks: VideoPostEntry[]
  onAdd: () => void
  onRemove: (id: string) => void
  onPlatformChange: (id: string, platform: string) => void
  onUrlChange: (id: string, url: string) => void
  onCustomNameChange: (id: string, name: string) => void
  title?: string
  description?: string
}) {
  return (
    <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFE8DE] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-[#D9480F]" />
            <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
              {title}
            </label>
            {videoLinks.filter((v) => v.postUrl.trim()).length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#D9480F] border border-[#D9480F]/20">
                {videoLinks.filter((v) => v.postUrl.trim()).length} link
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#D9480F] bg-white hover:bg-[#FFF4ED] border border-[#D9480F]/30 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Video</span>
        </button>
      </div>

      {videoLinks.length === 0 ? (
        <div className="py-4 px-3 bg-white border border-dashed border-stone-300 rounded-xl text-center">
          <p className="text-xs text-stone-500 mb-2">Belum ada link video konten.</p>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#D9480F] bg-[#FFF4ED] border border-[#D9480F]/30 rounded-xl hover:bg-[#FFE8D9] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Pilih Platform & Tambah Link Video</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {videoLinks.map((item) => {
            const platformConfig =
              VIDEO_PLATFORM_OPTIONS.find((p) => p.value === item.platform) ||
              VIDEO_PLATFORM_OPTIONS[0]
            return (
              <div
                key={item.id}
                className="p-2.5 bg-white border border-stone-200 rounded-xl space-y-2 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                    <PlatformIcon platform={item.platform} className="w-4 h-4 text-stone-700" />
                  </div>
                  <div className="w-36 sm:w-44 shrink-0">
                    <select
                      value={item.platform}
                      onChange={(e) => onPlatformChange(item.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold border border-stone-200 rounded-lg bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D9480F] cursor-pointer"
                    >
                      {VIDEO_PLATFORM_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.icon} {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 relative flex items-center min-w-0">
                    <input
                      type="url"
                      value={item.postUrl}
                      onChange={(e) => onUrlChange(item.id, e.target.value)}
                      placeholder={platformConfig.placeholder}
                      className="w-full pl-2.5 pr-7 py-1.5 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#D9480F] font-mono"
                    />
                    {item.postUrl.trim() && (
                      <a
                        href={item.postUrl.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-2 text-stone-400 hover:text-[#D9480F] transition-colors"
                        title="Buka link video di tab baru"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Hapus platform video ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {item.platform === 'CUSTOM' && (
                  <div className="flex items-center gap-2 pl-1 pt-0.5">
                    <span className="text-[10px] font-semibold text-stone-500 whitespace-nowrap">
                      Nama Platform:
                    </span>
                    <input
                      type="text"
                      value={item.customPlatformName || ''}
                      onChange={(e) => onCustomNameChange(item.id, e.target.value)}
                      placeholder="e.g. SnackVideo, Lemon8, X"
                      className="px-2 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 focus:bg-white focus:outline-none w-48"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const VISIT_STATUSES = ['PENDING', 'VISITED', 'CANCELED']
const POST_STATUSES = ['OFF', 'ON', 'TAKE_DOWN']

export default function EndorsementList({
  initialEndorsements,
  outlets,
  kols,
  userRole,
  posMenuItems = [],
  initialLastSyncedAt,
}: EndorsementListProps) {
  const router = useRouter()
  // Tab Switcher state
  const [activeTab, setActiveTab] = useState<'operations' | 'finance' | 'analytics'>('operations')

  // Common filters
  const [search, setSearch] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [visitFilter, setVisitFilter] = useState('')
  const [postFilter, setPostFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VISIT' | 'DELIVERY'>('ALL')

  // Date filter states for operations tab
  const [datePreset, setDatePreset] = useState<
    'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'THIS_MONTH' | 'NEXT_MONTH' | 'UPCOMING' | 'PAST' | 'CUSTOM'
  >('ALL')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')

  // Analytics specific filters
  const [performanceFilter, setPerformanceFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'views' | 'er' | 'cpv' | 'engagement'>('views')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingEndorsement, setEditingEndorsement] = useState<SerializedEndorsement | null>(null)
  const [videoMetricsTarget, setVideoMetricsTarget] = useState<SerializedEndorsement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedEndorsement | null>(null)
  const [videoPreviewTarget, setVideoPreviewTarget] = useState<{
    endorsement: SerializedEndorsement
    initialPostId?: string | null
  } | null>(null)

  const openVideoPreview = (endorsement: SerializedEndorsement, postId?: string | null) => {
    setVideoPreviewTarget({ endorsement, initialPostId: postId })
  }

  const navigateToAnalytics = (kolName: string) => {
    setSearch(kolName)
    setPerformanceFilter('ALL')
    setActiveTab('analytics')
  }

  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Menu & HPP preset states for modals
  const [createType, setCreateType] = useState<'VISIT' | 'DELIVERY'>('VISIT')
  const [createShippingCost, setCreateShippingCost] = useState<string>('0')
  const [createMenuName, setCreateMenuName] = useState('Ayam jumbo dan Sapi sedang')
  const [createHpp, setCreateHpp] = useState(38000)
  const [createRateCard, setCreateRateCard] = useState<string>('0')
  const [createMenuItems, setCreateMenuItems] = useState<SelectedMenuItem[]>([])
  const [isNewKol, setIsNewKol] = useState(false)
  const [selectedKolId, setSelectedKolId] = useState('')
  const [newKolName, setNewKolName] = useState('')
  const [newKolPhone, setNewKolPhone] = useState('')
  const [newKolSocials, setNewKolSocials] = useState<KolSocialEntry[]>([
    { id: '1', platform: 'INSTAGRAM', handle: '' },
  ])

  const addKolSocial = () => {
    const used = new Set(newKolSocials.map((s) => s.platform))
    const available: SocialPlatform[] = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'THREADS']
    const nextPlatform = available.find((p) => !used.has(p)) || 'TIKTOK'
    setNewKolSocials((prev) => [
      ...prev,
      { id: Date.now().toString(), platform: nextPlatform, handle: '' },
    ])
  }

  const removeKolSocial = (id: string) => {
    setNewKolSocials((prev) => {
      const filtered = prev.filter((s) => s.id !== id)
      return filtered.length > 0
        ? filtered
        : [{ id: Date.now().toString(), platform: 'INSTAGRAM', handle: '' }]
    })
  }

  const updateKolSocial = (id: string, field: 'platform' | 'handle', value: string) => {
    setNewKolSocials((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  const [editType, setEditType] = useState<'VISIT' | 'DELIVERY'>('VISIT')
  const [editShippingCost, setEditShippingCost] = useState<string>('0')
  const [editMenuName, setEditMenuName] = useState('')
  const [editHpp, setEditHpp] = useState(0)
  const [editRateCard, setEditRateCard] = useState<string>('0')
  const [editMenuItems, setEditMenuItems] = useState<SelectedMenuItem[]>([])

  // Multi-platform video links states
  const [createVideoLinks, setCreateVideoLinks] = useState<VideoPostEntry[]>([])
  const [editVideoLinks, setEditVideoLinks] = useState<VideoPostEntry[]>([])

  const addCreateVideoLink = () => {
    setCreateVideoLinks((prev) => [
      ...prev,
      { id: Date.now().toString(), platform: 'TIKTOK', postUrl: '', customPlatformName: '' },
    ])
  }

  const removeCreateVideoLink = (id: string) => {
    setCreateVideoLinks((prev) => prev.filter((v) => v.id !== id))
  }

  const updateCreateVideoPlatform = (id: string, platform: string) => {
    setCreateVideoLinks((prev) =>
      prev.map((v) => (v.id === id ? { ...v, platform } : v))
    )
  }

  const updateCreateVideoUrl = (id: string, url: string) => {
    setCreateVideoLinks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const detected = detectPlatformFromUrl(url)
        const trimmed = url.toLowerCase().trim()
        let updatedPlatform = item.platform
        if (
          item.platform !== 'CUSTOM' &&
          (trimmed.includes('tiktok.com') ||
            trimmed.includes('instagram.com') ||
            trimmed.includes('instagr.am') ||
            trimmed.includes('youtube.com') ||
            trimmed.includes('youtu.be') ||
            trimmed.includes('facebook.com') ||
            trimmed.includes('fb.watch') ||
            trimmed.includes('threads.net'))
        ) {
          updatedPlatform = detected
        }
        return { ...item, postUrl: url, platform: updatedPlatform }
      })
    )
  }

  const updateCreateCustomPlatformName = (id: string, customPlatformName: string) => {
    setCreateVideoLinks((prev) =>
      prev.map((v) => (v.id === id ? { ...v, customPlatformName } : v))
    )
  }

  const addEditVideoLink = () => {
    setEditVideoLinks((prev) => [
      ...prev,
      { id: Date.now().toString(), platform: 'TIKTOK', postUrl: '', customPlatformName: '' },
    ])
  }

  const removeEditVideoLink = (id: string) => {
    setEditVideoLinks((prev) => prev.filter((v) => v.id !== id))
  }

  const updateEditVideoPlatform = (id: string, platform: string) => {
    setEditVideoLinks((prev) =>
      prev.map((v) => (v.id === id ? { ...v, platform } : v))
    )
  }

  const updateEditVideoUrl = (id: string, url: string) => {
    setEditVideoLinks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const detected = detectPlatformFromUrl(url)
        const trimmed = url.toLowerCase().trim()
        let updatedPlatform = item.platform
        if (
          item.platform !== 'CUSTOM' &&
          (trimmed.includes('tiktok.com') ||
            trimmed.includes('instagram.com') ||
            trimmed.includes('instagr.am') ||
            trimmed.includes('youtube.com') ||
            trimmed.includes('youtu.be') ||
            trimmed.includes('facebook.com') ||
            trimmed.includes('fb.watch') ||
            trimmed.includes('threads.net'))
        ) {
          updatedPlatform = detected
        }
        return { ...item, postUrl: url, platform: updatedPlatform }
      })
    )
  }

  const updateEditCustomPlatformName = (id: string, customPlatformName: string) => {
    setEditVideoLinks((prev) =>
      prev.map((v) => (v.id === id ? { ...v, customPlatformName } : v))
    )
  }

  const openEditEndorsement = (item: SerializedEndorsement) => {
    setErrorMessage('')
    setEditingEndorsement(item)
    setEditType((item.type as any) || 'VISIT')
    setEditShippingCost(item.shippingCost?.toString() || '0')
    setEditMenuName(item.menuGiven || '')
    setEditHpp(item.hppMenu || 0)
    setEditRateCard(item.rateCard.toString())
    setEditMenuItems(item.menuItems ? (item.menuItems as any) : [])

    if (item.posts && item.posts.length > 0) {
      setEditVideoLinks(
        item.posts.map((p, idx) => ({
          id: p.id || `post-${idx}`,
          platform: p.platform || 'TIKTOK',
          postUrl: p.postUrl || '',
          customPlatformName: p.customPlatformName || '',
        }))
      )
    } else if (item.postUrl) {
      setEditVideoLinks([
        {
          id: '1',
          platform: detectPlatformFromUrl(item.postUrl),
          postUrl: item.postUrl,
          customPlatformName: '',
        },
      ])
    } else {
      setEditVideoLinks([])
    }
  }

  // Live calculation state inside the Video Metrics Modal
  const [targetPostMetrics, setTargetPostMetrics] = useState<PostMetricState[]>([])
  const [activeMetricTabPostId, setActiveMetricTabPostId] = useState<string>('')
  const [metricViews, setMetricViews] = useState<number>(0)
  const [metricLikes, setMetricLikes] = useState<number>(0)
  const [metricComments, setMetricComments] = useState<number>(0)
  const [metricShares, setMetricShares] = useState<number>(0)
  const [metricSaves, setMetricSaves] = useState<number>(0)

  // Sync state
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(initialLastSyncedAt || null)
  const [, setTick] = useState(0)

  // Per-endorsement row sync times
  const [rowSyncTimes, setRowSyncTimes] = useState<Record<string, string>>({})

  // Hydrate from localStorage if initialLastSyncedAt was not available
  useEffect(() => {
    if (!lastSyncTime && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('marcom_last_video_sync')
        if (saved) setLastSyncTime(saved)
      } catch {}
    }
  }, [lastSyncTime])

  // Hydrate row sync times from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('marcom_endorsement_row_sync_map')
        if (saved) setRowSyncTimes(JSON.parse(saved))
      } catch {}
    }
  }, [])

  // Periodic tick to re-evaluate relative time label (e.g. "Baru saja" -> "1 menit lalu")
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  // Auto-fetch state inside modal
  const [endorsementUrl, setEndorsementUrl] = useState('')
  const [isFetchingEndorsementMetric, setIsFetchingEndorsementMetric] = useState(false)
  const [fetchEndorsementNotice, setFetchEndorsementNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Keyboard UX: Dismiss open modal on Escape key press (Nielsen H3: User Control & Freedom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null)
        else if (videoMetricsTarget) setVideoMetricsTarget(null)
        else if (editingEndorsement) setEditingEndorsement(null)
        else if (isCreateOpen) setIsCreateOpen(false)
        else if (isImportModalOpen) setIsImportModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteTarget, videoMetricsTarget, editingEndorsement, isCreateOpen, isImportModalOpen])

  // Filter endorsements for operations tab
  const filteredOperations = useMemo(() => {
    const today = new Date()
    const todayStr = getLocalDateString(today)

    // Tomorrow
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const tomorrowStr = getLocalDateString(tomorrow)

    // This Week (Monday to Sunday)
    const currentDay = today.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMonday = (currentDay + 6) % 7 // Monday = 0, Sunday = 6
    const monday = new Date(today)
    monday.setDate(today.getDate() - diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const mondayStr = getLocalDateString(monday)
    const sundayStr = getLocalDateString(sunday)

    // This Month
    const firstDayMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const lastDayMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const lastDayMonthStr = getLocalDateString(lastDayMonth)

    // Next Month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const firstDayNextMonthStr = getLocalDateString(nextMonth)
    const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    const lastDayNextMonthStr = getLocalDateString(lastDayNextMonth)

    return initialEndorsements.filter((item) => {
      const matchesSearch =
        item.kol.name.toLowerCase().includes(search.toLowerCase()) ||
        item.outlet.name.toLowerCase().includes(search.toLowerCase())

      const matchesOutlet = outletFilter ? item.outletId === outletFilter : true
      const matchesVisit = visitFilter ? item.visitStatus === visitFilter : true
      const matchesPost = postFilter ? item.postStatus === postFilter : true
      const matchesType = typeFilter === 'ALL' ? true : (item.type || 'VISIT') === typeFilter

      // Date filtering
      let matchesDate = true
      const sched = item.scheduleDate // format YYYY-MM-DD
      if (datePreset === 'TODAY') {
        matchesDate = sched === todayStr
      } else if (datePreset === 'TOMORROW') {
        matchesDate = sched === tomorrowStr
      } else if (datePreset === 'THIS_WEEK') {
        matchesDate = sched >= mondayStr && sched <= sundayStr
      } else if (datePreset === 'THIS_MONTH') {
        matchesDate = sched >= firstDayMonthStr && sched <= lastDayMonthStr
      } else if (datePreset === 'NEXT_MONTH') {
        matchesDate = sched >= firstDayNextMonthStr && sched <= lastDayNextMonthStr
      } else if (datePreset === 'UPCOMING') {
        matchesDate = sched >= todayStr
      } else if (datePreset === 'PAST') {
        matchesDate = sched < todayStr
      } else if (datePreset === 'CUSTOM') {
        if (customDateFrom && customDateTo) {
          matchesDate = sched >= customDateFrom && sched <= customDateTo
        } else if (customDateFrom) {
          matchesDate = sched >= customDateFrom
        } else if (customDateTo) {
          matchesDate = sched <= customDateTo
        }
      }

      return matchesSearch && matchesOutlet && matchesVisit && matchesPost && matchesType && matchesDate
    })
  }, [
    initialEndorsements,
    search,
    outletFilter,
    visitFilter,
    postFilter,
    typeFilter,
    datePreset,
    customDateFrom,
    customDateTo,
  ])

  const dateFilterLabel = useMemo(() => {
    switch (datePreset) {
      case 'TODAY':
        return 'Hari Ini'
      case 'TOMORROW':
        return 'Besok'
      case 'THIS_WEEK':
        return 'Minggu Ini'
      case 'THIS_MONTH':
        return 'Bulan Ini'
      case 'NEXT_MONTH':
        return 'Bulan Depan'
      case 'UPCOMING':
        return 'Jadwal Mendatang'
      case 'PAST':
        return 'Sudah Terlewat'
      case 'CUSTOM':
        if (customDateFrom && customDateTo) return `${customDateFrom} s/d ${customDateTo}`
        if (customDateFrom) return `Mulai ${customDateFrom}`
        if (customDateTo) return `Sampai ${customDateTo}`
        return 'Rentang Kustom'
      default:
        return ''
    }
  }, [datePreset, customDateFrom, customDateTo])

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
        const nowIso = new Date().toISOString()
        setLastSyncTime(nowIso)
        setRowSyncTimes((prev) => {
          const next = { ...prev, [videoMetricsTarget.id]: nowIso }
          try {
            localStorage.setItem('marcom_endorsement_row_sync_map', JSON.stringify(next))
          } catch {}
          return next
        })
        setVideoMetricsTarget(null)
        router.refresh()
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
    const initialPosts: PostMetricState[] =
      item.posts && item.posts.length > 0
        ? item.posts.map((p) => ({
            id: p.id,
            platform: p.platform,
            customPlatformName: p.customPlatformName,
            postUrl: p.postUrl || '',
            views: p.views || 0,
            likes: p.likes || 0,
            comments: p.comments || 0,
            shares: p.shares || 0,
            saves: p.saves || 0,
          }))
        : [
            {
              id: 'legacy',
              platform: item.postUrl ? detectPlatformFromUrl(item.postUrl) : 'TIKTOK',
              customPlatformName: '',
              postUrl: item.postUrl || '',
              views: item.finalViews ?? item.initialViews ?? 0,
              likes: item.likes ?? 0,
              comments: item.comments ?? 0,
              shares: item.shares ?? 0,
              saves: item.saves ?? 0,
            },
          ]

    setTargetPostMetrics(initialPosts)
    const firstPost = initialPosts[0]
    setActiveMetricTabPostId(firstPost.id)
    setEndorsementUrl(firstPost.postUrl)
    setMetricViews(firstPost.views)
    setMetricLikes(firstPost.likes)
    setMetricComments(firstPost.comments)
    setMetricShares(firstPost.shares)
    setMetricSaves(firstPost.saves)
    setFetchEndorsementNotice(null)
    setErrorMessage('')
  }

  const updateMetricField = (
    field: 'views' | 'likes' | 'comments' | 'shares' | 'saves',
    val: number
  ) => {
    if (field === 'views') setMetricViews(val)
    else if (field === 'likes') setMetricLikes(val)
    else if (field === 'comments') setMetricComments(val)
    else if (field === 'shares') setMetricShares(val)
    else if (field === 'saves') setMetricSaves(val)

    if (activeMetricTabPostId) {
      setTargetPostMetrics((prev) =>
        prev.map((p) => (p.id === activeMetricTabPostId ? { ...p, [field]: val } : p))
      )
    }
  }

  const handleUrlChangeInMetricsModal = (newUrl: string) => {
    setEndorsementUrl(newUrl)
    if (activeMetricTabPostId) {
      setTargetPostMetrics((prev) =>
        prev.map((p) => (p.id === activeMetricTabPostId ? { ...p, postUrl: newUrl } : p))
      )
    }
  }

  const handleSwitchMetricTab = (targetPostId: string) => {
    const target = targetPostMetrics.find((p) => p.id === targetPostId)
    if (!target) return
    setActiveMetricTabPostId(targetPostId)
    setEndorsementUrl(target.postUrl)
    setMetricViews(target.views)
    setMetricLikes(target.likes)
    setMetricComments(target.comments)
    setMetricShares(target.shares)
    setMetricSaves(target.saves)
    setFetchEndorsementNotice(null)
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    setSyncBanner(null)
    setErrorMessage('')
    startTransition(async () => {
      try {
        const res = await syncAllActiveVideos()
        if (res.success) {
          const nowIso = res.lastSyncedAt || new Date().toISOString()
          setLastSyncTime(nowIso)
          setRowSyncTimes((prev) => {
            const next = { ...prev }
            initialEndorsements.forEach((e) => {
              if (e.postUrl || (e.posts && e.posts.length > 0)) {
                next[e.id] = nowIso
              }
            })
            try {
              localStorage.setItem('marcom_endorsement_row_sync_map', JSON.stringify(next))
            } catch {}
            return next
          })
          try {
            localStorage.setItem('marcom_last_video_sync', nowIso)
          } catch {}
          router.refresh()
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
    })
  }

  const handleSyncSingleEndorsement = async (id: string) => {
    setSyncingId(id)
    setSyncBanner(null)
    startTransition(async () => {
      try {
        const res = await syncSingleEndorsementVideo(id)
        if (res.success) {
          const nowIso = new Date().toISOString()
          setLastSyncTime(nowIso)
          setRowSyncTimes((prev) => {
            const next = { ...prev, [id]: nowIso }
            try {
              localStorage.setItem('marcom_endorsement_row_sync_map', JSON.stringify(next))
            } catch {}
            return next
          })
          try {
            localStorage.setItem('marcom_last_video_sync', nowIso)
          } catch {}
          router.refresh()
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
    })
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
        const v = res.data.views !== undefined && res.data.views > 0 ? res.data.views : 0
        const l = res.data.likes !== undefined && res.data.likes > 0 ? res.data.likes : 0
        const c = res.data.comments !== undefined && res.data.comments > 0 ? res.data.comments : 0
        const sh = res.data.shares !== undefined && res.data.shares > 0 ? res.data.shares : 0
        const sa = res.data.saves !== undefined && res.data.saves > 0 ? res.data.saves : 0

        if (v > 0) setMetricViews(v)
        if (l > 0) setMetricLikes(l)
        if (c > 0) setMetricComments(c)
        if (sh > 0) setMetricShares(sh)
        if (sa > 0) setMetricSaves(sa)

        if (activeMetricTabPostId) {
          setTargetPostMetrics((prev) =>
            prev.map((p) => {
              if (p.id !== activeMetricTabPostId) return p
              return {
                ...p,
                views: v > 0 ? v : p.views,
                likes: l > 0 ? l : p.likes,
                comments: c > 0 ? c : p.comments,
                shares: sh > 0 ? sh : p.shares,
                saves: sa > 0 ? sa : p.saves,
              }
            })
          )
        }

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

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex flex-col items-start sm:items-end">
            <button
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="inline-flex items-center justify-center space-x-2 px-3.5 py-2 bg-white hover:bg-[#FAF8F5] text-stone-700 border border-[#EFE8DE] rounded-xl text-xs sm:text-sm font-bold shadow-2xs hover:border-[#D9480F]/40 transition-all cursor-pointer disabled:opacity-50 w-full sm:w-auto"
              title="Update metrik seluruh video endorsement secara otomatis dari URL"
            >
              <RefreshCw className={`w-4 h-4 text-[#D9480F] ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>{isSyncingAll ? 'Menyinkronkan...' : 'Sync Semua Video'}</span>
            </button>
            <div
              className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-500 font-medium select-none"
              title={formatFullDateTime(lastSyncTime)}
            >
              <Clock className="w-3 h-3 text-stone-400 shrink-0" />
              <span>Terakhir diupdate:</span>
              <span className="font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200/60">
                {formatLastUpdate(lastSyncTime)}
              </span>
            </div>
          </div>

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
              setIsNewKol(false)
              setSelectedKolId('')
              setNewKolName('')
              setNewKolPhone('')
              setNewKolSocials([{ id: '1', platform: 'INSTAGRAM', handle: '' }])
              setCreateVideoLinks([])
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
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-3.5">
            {/* Quick Date Presets Bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap pb-1 border-b border-[#EFE8DE]/70">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-[#D9480F]" />
                  <span>Filter Tanggal:</span>
                </span>
                {[
                  { id: 'ALL', label: 'Semua Tanggal' },
                  { id: 'TODAY', label: 'Hari Ini' },
                  { id: 'TOMORROW', label: 'Besok' },
                  { id: 'THIS_WEEK', label: 'Minggu Ini' },
                  { id: 'THIS_MONTH', label: 'Bulan Ini' },
                  { id: 'NEXT_MONTH', label: 'Bulan Depan' },
                  { id: 'UPCOMING', label: 'Jadwal Mendatang' },
                  { id: 'PAST', label: 'Terlewat' },
                  { id: 'CUSTOM', label: 'Kustom Rentang...' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDatePreset(p.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      datePreset === p.id
                        ? 'bg-[#1A1715] text-white shadow-xs'
                        : 'bg-[#FAF8F5] text-stone-600 hover:text-[#1A1715] hover:bg-stone-200/60 border border-[#EFE8DE]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {datePreset === 'CUSTOM' && (
                <div className="flex items-center gap-2 flex-wrap bg-[#FAF8F5] p-1.5 px-2.5 rounded-xl border border-[#EFE8DE] animate-in fade-in duration-150">
                  <span className="text-xs font-bold text-stone-600">Dari:</span>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#EFE8DE] bg-white focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                  />
                  <span className="text-xs text-stone-400 font-bold">s/d</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#EFE8DE] bg-white focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                  />
                  {(customDateFrom || customDateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDateFrom('')
                        setCustomDateTo('')
                      }}
                      className="text-stone-400 hover:text-stone-700 p-0.5"
                      title="Hapus rentang tanggal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  Ditemukan <span className="font-bold text-[#1A1715]">{filteredOperations.length}</span> data endorsement
                </span>
                {datePreset !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF4ED] text-[#D9480F] text-[11px] font-bold border border-[#D9480F]/20">
                    <Calendar className="w-3 h-3" />
                    <span>Jadwal: {dateFilterLabel}</span>
                  </span>
                )}
              </div>
              {(search || outletFilter || visitFilter || postFilter || typeFilter !== 'ALL' || datePreset !== 'ALL' || customDateFrom || customDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setOutletFilter('')
                    setVisitFilter('')
                    setPostFilter('')
                    setTypeFilter('ALL')
                    setDatePreset('ALL')
                    setCustomDateFrom('')
                    setCustomDateTo('')
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
              <table className="w-full table-fixed min-w-[1080px] text-left text-xs sm:text-sm text-stone-600">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE] sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-3.5 px-4">KOL / Influencer</th>
                    <th className="py-3.5 px-3">Cabang</th>
                    <th className="py-3.5 px-3 whitespace-nowrap">Jadwal Visit</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap">Rate Card</th>
                    <th className="py-3.5 px-3 text-center whitespace-nowrap">Status Visit</th>
                    <th className="py-3.5 px-3 text-center whitespace-nowrap">Status Tayang</th>
                    <th className="py-3.5 px-3 text-center whitespace-nowrap">Metrik Video</th>
                    <th className="py-3.5 px-3 text-center whitespace-nowrap sticky right-0 z-20 bg-[#FAF8F5] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE8DE]">
                  {filteredOperations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-stone-400">
                        <Video className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                        <p className="font-semibold text-stone-600">Tidak ada data endorsement yang cocok.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOperations.map((item) => (
                      <tr key={item.id} className="group hover:bg-amber-50/30 transition-colors">
                        {/* KOL / Influencer */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFF4ED] to-[#FFE8D9] border border-[#D9480F]/20 text-[#D9480F] font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {item.kol.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[#1A1715] truncate" title={item.kol.name}>
                                {item.kol.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {item.kol.instagramUrl && (
                                  <a
                                    href={item.kol.instagramUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 hover:text-rose-800 transition-colors"
                                    title="Instagram"
                                  >
                                    <InstagramIcon className="w-3 h-3 text-rose-600" />
                                    <span>IG</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </a>
                                )}
                                {item.kol.tiktokUrl && (
                                  <a
                                    href={item.kol.tiktokUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200 hover:bg-stone-200 hover:text-stone-950 transition-colors"
                                    title="TikTok"
                                  >
                                    <TikTokIcon className="w-3 h-3 text-black" />
                                    <span>TT</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </a>
                                )}
                                {item.kol.youtubeUrl && (
                                  <a
                                    href={item.kol.youtubeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200/80 hover:bg-red-100 transition-colors"
                                    title="YouTube"
                                  >
                                    <YouTubeIcon className="w-3 h-3 text-red-600" />
                                    <span>YT</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </a>
                                )}
                                {item.kol.facebookUrl && (
                                  <a
                                    href={item.kol.facebookUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 transition-colors"
                                    title="Facebook"
                                  >
                                    <FacebookIcon className="w-3 h-3 text-[#1877F2]" />
                                    <span>FB</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </a>
                                )}
                                {item.kol.threadsUrl && (
                                  <a
                                    href={item.kol.threadsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 hover:text-stone-950 transition-colors"
                                    title="Threads"
                                  >
                                    <ThreadsIcon className="w-3 h-3 text-stone-900" />
                                    <span>TH</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </a>
                                )}
                                {!item.kol.instagramUrl && !item.kol.tiktokUrl && !item.kol.youtubeUrl && !item.kol.facebookUrl && !item.kol.threadsUrl && (
                                  <span className="text-[10px] text-stone-400 italic">Belum ada sosmed</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Cabang & Tipe */}
                        <td className="py-3.5 px-3 align-middle font-semibold text-[#1A1715]">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="truncate max-w-[130px]" title={item.outlet.name}>{item.outlet.name}</span>
                              {item.type === 'DELIVERY' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0">
                                  <Truck className="w-2.5 h-2.5 text-amber-700" />
                                  SS Online
                                </span>
                              )}
                            </div>
                            {item.type === 'DELIVERY' && item.courierResi && (
                              <div className="text-[11px] text-stone-500 font-mono flex items-center gap-1 truncate" title={item.courierResi}>
                                <span className="text-stone-400">Resi:</span>
                                <span className="font-semibold text-stone-700">{item.courierResi}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Jadwal Visit */}
                        <td className="py-3.5 px-3 align-middle whitespace-nowrap text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#1A1715]">
                              {new Date(item.scheduleDate).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[11px] text-stone-400">
                              {new Date(item.scheduleDate).toLocaleDateString('id-ID', { weekday: 'long' })}
                            </span>
                          </div>
                        </td>

                        {/* Rate Card & Status Bayar */}
                        <td className="py-3.5 px-3 align-middle text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono font-bold text-sm text-stone-900">
                              {formatRupiah(item.rateCard)}
                            </span>
                            {item.rateCard > 0 && (
                              <div>
                                {item.paymentStatus === 'PAID' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Lunas{item.paymentDate ? ` • TF: ${new Date(item.paymentDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
                                  </span>
                                ) : item.paymentStatus === 'DOWN_PAYMENT' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                    DP{item.paymentDate ? ` • TF: ${new Date(item.paymentDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
                                  </span>
                                ) : item.paymentStatus === 'BARTER' ? (
                                  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    Barter
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                                    Belum Bayar
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status Visit & POS */}
                        <td className="py-3.5 px-3 align-middle text-center whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <select
                              value={item.visitStatus}
                              onChange={(e) =>
                                handleQuickStatus(item.id, e.target.value, item.postStatus)
                              }
                              aria-label={`Status visit ${item.kol.name}`}
                              className={`w-28 text-center text-xs font-bold px-2.5 py-1.5 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9480F] focus-visible:ring-offset-1 transition-colors cursor-pointer ${
                                item.visitStatus === 'VISITED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
                                  : item.visitStatus === 'CANCELED'
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/60'
                                  : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200/60'
                              }`}
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="VISITED">VISITED</option>
                              <option value="CANCELED">CANCELED</option>
                            </select>
                            {item.posOrderNumber ? (
                              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>POS #{item.posOrderNumber}</span>
                              </div>
                            ) : item.menuItems && item.menuItems.length > 0 ? (
                              <div className="text-[11px] text-stone-500 font-medium">
                                {item.menuItems.length} menu POS siap
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* Status Tayang */}
                        <td className="py-3.5 px-3 align-middle text-center whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <select
                              value={item.postStatus}
                              onChange={(e) =>
                                handleQuickStatus(item.id, item.visitStatus, e.target.value)
                              }
                              aria-label={`Status tayang ${item.kol.name}`}
                              className={`w-24 text-center text-xs font-bold px-2.5 py-1.5 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9480F] focus-visible:ring-offset-1 transition-colors cursor-pointer ${
                                item.postStatus === 'ON'
                                  ? 'bg-[#FFF4ED] text-[#D9480F] border-[#D9480F]/30 hover:bg-[#FFE8D9]'
                                  : item.postStatus === 'TAKE_DOWN'
                                  ? 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300'
                                  : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                              }`}
                            >
                              <option value="OFF">OFF</option>
                              <option value="ON">ON</option>
                              <option value="TAKE_DOWN">TAKE_DOWN</option>
                            </select>

                            {/* Video Post Links / Badges */}
                            {item.posts && item.posts.length > 0 ? (
                              <div className="flex items-center justify-center gap-1 flex-wrap max-w-[130px]">
                                {item.posts.map((p) => {
                                  const pConfig = getPlatformBadgeConfig(p.platform, p.customPlatformName)
                                  return (
                                    <div key={p.id} className="inline-flex items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => openVideoPreview(item, p.id)}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${pConfig.badgeClass} hover:opacity-90 transition-opacity cursor-pointer`}
                                        title={`Preview Video ${pConfig.label}`}
                                      >
                                        <PlatformIcon platform={p.platform} className="w-2.5 h-2.5 shrink-0" />
                                        <span>{pConfig.shortLabel}</span>
                                      </button>
                                      {p.postUrl && (
                                        <a
                                          href={p.postUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-stone-400 hover:text-stone-700 transition-colors p-0.5"
                                          title={`Buka ${pConfig.label} di tab baru`}
                                        >
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : item.postUrl ? (
                              <div className="inline-flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => openVideoPreview(item)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200 hover:bg-stone-200 transition-colors cursor-pointer"
                                  title="Preview Video Konten"
                                >
                                  <Video className="w-2.5 h-2.5 shrink-0" />
                                  <span>Video</span>
                                </button>
                                <a
                                  href={item.postUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-stone-400 hover:text-stone-700 transition-colors p-0.5"
                                  title="Buka link video di tab baru"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* Metrik Video */}
                        <td className="py-3.5 px-3 align-middle text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => navigateToAnalytics(item.kol.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-[#FFF4ED] text-stone-700 hover:text-[#D9480F] border border-stone-200/80 hover:border-[#D9480F]/30 text-xs font-bold transition-all cursor-pointer group shadow-2xs"
                            title={`Lihat metrik analitik video ${item.kol.name} di Tab Video Analytics`}
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#D9480F] transition-colors" />
                            <span>Metrik Video</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-3 align-middle text-center whitespace-nowrap sticky right-0 z-10 bg-white group-hover:bg-amber-50/40 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditEndorsement(item)}
                              className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9480F]"
                              title="Edit Data Endorsement"
                              aria-label={`Edit data endorsement ${item.kol.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setErrorMessage('')
                                setDeleteTarget(item)
                              }}
                              className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              title="Hapus Endorsement"
                              aria-label={`Hapus endorsement ${item.kol.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* TAB 2: VIDEO ANALYTICS & ROI */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Executive Analytics Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* CPV Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                  Rata-rata CPV (Biaya / View)
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-mono text-[#1A1715]">
                  {formatRupiah(avgCPV)} <span className="text-xs text-stone-500 font-sans font-normal">/ view</span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  {avgCPV < 100 ? 'Efisiensi Sangat Baik (< Rp 100)' : 'Standar industri kuliner (Rp 100-200)'}
                </p>
              </div>
            </div>

            {/* Engagement Rate Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                  Rata-rata Engagement Rate
                </span>
                <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-mono text-[#1A1715]">
                  {avgER.toFixed(2)}%
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  {avgER >= 5.0 ? 'Tingkat Respons Audiens Tinggi' : 'Benchmark F&B: 3% - 6%'}
                </p>
              </div>
            </div>

            {/* Total Interactions Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                  Total Interaksi Audiens
                </span>
                <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
                  <Heart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-mono text-[#1A1715]">
                  {totalEngagementActive.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-stone-500 mt-1 flex items-center gap-2">
                  <span>Likes, komentar, share & simpan</span>
                </div>
              </div>
            </div>

            {/* Top Performer Card */}
            <div className="bg-gradient-to-br from-[#1C1917] to-[#292524] p-5 rounded-2xl text-white shadow-xs flex flex-col justify-between border border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-300 font-bold uppercase tracking-wider">
                  Video Paling Viral
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="font-bold text-sm text-white truncate">
                  {topPerformer ? topPerformer.kol.name : 'Belum Ada'}
                </div>
                <div className="text-xs text-stone-300 mt-0.5">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3">
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
                  aria-label="Filter kategori kinerja"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9480F] focus:border-[#D9480F] transition-colors"
                >
                  <option value="ALL">Semua Kategori Kinerja</option>
                  <option value="VIRAL">Viral / Top Performer</option>
                  <option value="EFFICIENT">Efisien & Standar</option>
                  <option value="UNDERPERFORMING">Perlu Evaluasi</option>
                  <option value="PENDING">Menunggu Data / Belum Tayang</option>
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

            <div className="flex items-center justify-between text-xs text-stone-500 font-medium pt-2 border-t border-[#EFE8DE] flex-wrap gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span>
                  Menampilkan <span className="font-bold text-[#1A1715]">{filteredAnalytics.length}</span> video dianalisis
                </span>
                <span className="text-stone-300 select-none">•</span>
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] text-stone-500 font-medium select-none"
                  title={formatFullDateTime(lastSyncTime)}
                >
                  <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                  <span>Last sync:</span>
                  <span className="font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200/60">
                    {formatLastUpdate(lastSyncTime)}
                  </span>
                </div>
              </div>
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
              <table className="w-full min-w-[900px] text-left text-xs sm:text-sm text-stone-600">
                <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE]">
                  <tr>
                    <th className="py-4 px-4 sm:px-6">Influencer</th>
                    <th className="py-4 px-4">Cabang</th>
                    <th className="py-4 px-4">Performa & Interaksi Video</th>
                    <th className="py-4 px-4">Engagement Rate</th>
                    <th className="py-4 px-4">Efisiensi Biaya (CPV)</th>
                    <th className="py-4 px-4">Status Kinerja</th>
                    <th className="py-4 px-4 sm:px-6 text-right sticky right-0 z-20 bg-[#FAF8F5] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE8DE]">
                  {filteredAnalytics.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400">
                        <BarChart3 className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                        <p className="font-semibold text-stone-600">Tidak ada data video yang sesuai kriteria filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAnalytics.map((item, idx) => (
                      <tr key={item.id} className="group hover:bg-[#FAF8F5]/80 transition-colors">
                        {/* Influencer */}
                        <td className="py-3.5 px-4 sm:px-6 align-top">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              #{idx + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#1A1715] text-sm truncate" title={item.kol.name}>
                                {item.kol.name}
                              </div>
                              <div className="text-[11px] text-stone-400 mt-0.5">
                                Rate: {formatRupiah(item.rateCard)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Outlet */}
                        <td className="py-3.5 px-4 align-top font-semibold text-stone-800">
                          <div className="py-0.5">{item.outlet.name}</div>
                        </td>

                        {/* Performa & Interaksi Video */}
                        <td className="py-3.5 px-4 align-top min-w-[320px]">
                          <div className="flex items-center gap-2 h-6 flex-wrap">
                            <span className="font-extrabold font-mono text-stone-900 text-sm">
                              {item.effectiveViews.toLocaleString('id-ID')}
                              <span className="text-stone-400 text-xs font-normal ml-1">views</span>
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="text-xs font-bold text-stone-600 font-mono">
                              {item.totalEngagement.toLocaleString('id-ID')}
                              <span className="text-stone-400 font-normal ml-1">interaksi</span>
                            </span>
                          </div>

                          {item.posts && item.posts.length > 0 ? (
                            <div className="mt-1.5 space-y-1.5">
                              {item.posts.map((p) => {
                                const pConfig = getPlatformBadgeConfig(p.platform, p.customPlatformName)
                                const postEng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0)
                                return (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-2 border-t border-stone-100/90 pt-1.5 flex-wrap"
                                  >
                                    {/* Platform Badge & Preview */}
                                    <div className="inline-flex items-center gap-0.5 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openVideoPreview(item, p.id)}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${pConfig.badgeClass} hover:opacity-90 transition-opacity cursor-pointer`}
                                        title={`Tonton / Preview ${pConfig.label}`}
                                      >
                                        <PlatformIcon platform={p.platform} className="w-2.5 h-2.5 shrink-0" />
                                        <span>{pConfig.shortLabel}</span>
                                      </button>
                                      {p.postUrl && (
                                        <a
                                          href={p.postUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-stone-400 hover:text-stone-700 transition-colors p-0.5"
                                          title={`Buka ${pConfig.label} di tab baru`}
                                        >
                                          <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>

                                    {/* Views per platform */}
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-100 text-stone-800 font-mono text-[11px] font-bold shrink-0"
                                      title="Views di platform ini"
                                    >
                                      <Eye className="w-2.5 h-2.5 text-stone-500" />
                                      <span>{(p.views || 0).toLocaleString('id-ID')}</span>
                                    </span>

                                    {/* Reaction pills */}
                                    {postEng === 0 ? (
                                      <span className="text-[10px] text-stone-400 italic">
                                        Belum ada interaksi
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1.5 flex-nowrap text-[11px]">
                                        {(p.likes || 0) > 0 && (
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold"
                                            title="Likes"
                                          >
                                            <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                                            <span>{p.likes.toLocaleString('id-ID')}</span>
                                          </span>
                                        )}
                                        {(p.comments || 0) > 0 && (
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold"
                                            title="Comments"
                                          >
                                            <MessageSquare className="w-2.5 h-2.5 text-blue-500" />
                                            <span>{p.comments.toLocaleString('id-ID')}</span>
                                          </span>
                                        )}
                                        {(p.shares || 0) > 0 && (
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold"
                                            title="Shares"
                                          >
                                            <Share2 className="w-2.5 h-2.5 text-emerald-500" />
                                            <span>{p.shares.toLocaleString('id-ID')}</span>
                                          </span>
                                        )}
                                        {(p.saves || 0) > 0 && (
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold"
                                            title="Saves"
                                          >
                                            <Bookmark className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                            <span>{p.saves.toLocaleString('id-ID')}</span>
                                          </span>
                                        )}
                                        <span className="text-[10px] text-stone-400 font-mono">
                                          ({postEng.toLocaleString('id-ID')})
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                              {item.postUrl && (() => {
                                const detectedPlatform = detectPlatformFromUrl(item.postUrl)
                                const pConfig = getPlatformBadgeConfig(detectedPlatform)
                                return (
                                  <div className="inline-flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openVideoPreview(item, null)}
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${pConfig.badgeClass} hover:opacity-90 transition-opacity cursor-pointer`}
                                      title={`Tonton / Preview ${pConfig.label}`}
                                    >
                                      <PlatformIcon platform={detectedPlatform} className="w-2.5 h-2.5 shrink-0" />
                                      <span>{pConfig.shortLabel}</span>
                                    </button>
                                    <a
                                      href={item.postUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-stone-400 hover:text-stone-700 transition-colors p-0.5"
                                      title={`Buka di tab baru (${pConfig.label})`}
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </div>
                                )
                              })()}

                              {item.initialViews && item.finalViews && (
                                <span className="text-[10px] text-emerald-600 font-semibold">
                                  +{Math.max(0, item.finalViews - item.initialViews).toLocaleString('id-ID')} views
                                </span>
                              )}

                              {item.totalEngagement === 0 ? (
                                <span className="text-[11px] text-stone-400 italic">Belum ada data interaksi</span>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                  {item.likes > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold" title="Likes">
                                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                                      <span>{item.likes.toLocaleString('id-ID')}</span>
                                    </span>
                                  )}
                                  {item.comments > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold" title="Comments">
                                      <MessageSquare className="w-3 h-3 text-blue-500" />
                                      <span>{item.comments.toLocaleString('id-ID')}</span>
                                    </span>
                                  )}
                                  {item.shares > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold" title="Shares">
                                      <Share2 className="w-3 h-3 text-emerald-500" />
                                      <span>{item.shares.toLocaleString('id-ID')}</span>
                                    </span>
                                  )}
                                  {item.saves > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold" title="Saves">
                                      <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" />
                                      <span>{item.saves.toLocaleString('id-ID')}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Engagement Rate */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="py-0.5">
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
                          </div>
                        </td>

                        {/* Cost Per View */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="py-0.5">
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
                          </div>
                        </td>

                        {/* Performance Category Badge */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="py-0.5">
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
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 sm:px-6 align-top text-right sticky right-0 z-10 bg-white group-hover:bg-[#FAF8F5]/80 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center justify-end space-x-1.5 py-0.5">
                              <button
                                onClick={() => handleSyncSingleEndorsement(item.id)}
                                disabled={syncingId === item.id || (!item.postUrl && (!item.posts || item.posts.length === 0))}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D9480F] hover:bg-[#B83808] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={
                                  !item.postUrl && (!item.posts || item.posts.length === 0)
                                    ? 'Belum ada link video untuk di-sync'
                                    : 'Tarik data views & interaksi terbaru secara otomatis'
                                }
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    syncingId === item.id ? 'animate-spin' : ''
                                  }`}
                                />
                                <span>{syncingId === item.id ? 'Syncing...' : 'Sync Metrik'}</span>
                              </button>

                              <button
                                onClick={() => openVideoMetricsModal(item)}
                                className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-stone-200"
                                title="Koreksi / Input Metrik Manual"
                                aria-label={`Edit manual metrik ${item.kol.name}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Keterangan Last Sync */}
                            <div
                              className="inline-flex items-center gap-1 text-[10px] text-stone-400 font-medium select-none"
                              title={formatFullDateTime(
                                rowSyncTimes[item.id] ||
                                  (item.finalViews || item.totalEngagement > 0
                                    ? lastSyncTime
                                    : null)
                              )}
                            >
                              <Clock className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                              <span>
                                Last sync:{' '}
                                <strong className="font-semibold text-stone-600">
                                  {formatLastUpdate(
                                    rowSyncTimes[item.id] ||
                                      (item.finalViews || item.totalEngagement > 0
                                        ? lastSyncTime
                                        : null)
                                  )}
                                </strong>
                              </span>
                            </div>
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
            openEditEndorsement(item)
          }}
        />
      )}

      {/* MODAL: UPDATE METRIK VIDEO & ENGAGEMENT */}
      {videoMetricsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVideoMetricsTarget(null)
          }}
        >
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-3xl lg:max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] my-auto">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-[#1A1715] text-base sm:text-lg">
                      Koreksi / Input Metrik Manual
                    </h3>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200/60 select-none"
                      title={formatFullDateTime(lastSyncTime)}
                    >
                      <Clock className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                      <span>Last sync: {formatLastUpdate(lastSyncTime)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    KOL: <strong className="text-[#1A1715]">{videoMetricsTarget.kol.name}</strong> •{' '}
                    Cabang: <strong className="text-[#1A1715]">{videoMetricsTarget.outlet.name}</strong> •{' '}
                    <span className="text-amber-700 font-medium">Input manual jika auto-scraping gagal atau untuk data Story</span>
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

            <form onSubmit={handleUpdateVideoMetrics} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Multi-Platform Switcher Tab */}
              {targetPostMetrics.length > 1 && (
                <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#EFE8DE] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                      Pilih Platform Video Untuk Diinput:
                    </span>
                    <span className="text-[10px] text-[#D9480F] font-bold bg-[#FFF4ED] px-2 py-0.5 rounded-full border border-[#D9480F]/20">
                      {targetPostMetrics.length} Platform Terdaftar
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {targetPostMetrics.map((p) => {
                      const pConfig = getPlatformBadgeConfig(p.platform, p.customPlatformName)
                      const isSelected = activeMetricTabPostId === p.id
                      const postViews = p.views || 0
                      const postEng = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSwitchMetricTab(p.id)}
                          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-white border-[#D9480F] ring-2 ring-[#D9480F]/20 shadow-xs'
                              : 'bg-white/60 border-stone-200 hover:border-stone-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${pConfig.badgeClass}`}>
                              {pConfig.shortLabel}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-extrabold text-[#D9480F] uppercase tracking-wider">
                                Sedang Diedit
                              </span>
                            )}
                          </div>
                          <div className="text-xs">
                            <div className="font-extrabold font-mono text-stone-900">
                              {postViews.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-stone-400">views</span>
                            </div>
                            <div className="text-[10px] text-stone-500">
                              {postEng.toLocaleString('id-ID')} interaksi
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* URL Video Konten */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Link URL Video Konten {targetPostMetrics.length > 1 ? `(${getPlatformBadgeConfig(targetPostMetrics.find((p) => p.id === activeMetricTabPostId)?.platform || '', targetPostMetrics.find((p) => p.id === activeMetricTabPostId)?.customPlatformName).label})` : ''}
                  </label>
                  <span className="text-[10px] text-stone-500 font-semibold">Tiktok, IG, YT, FB, Threads</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={endorsementUrl}
                    onChange={(e) => handleUrlChangeInMetricsModal(e.target.value)}
                    placeholder="https://... (TikTok, IG Reel/Post, YT Shorts, Facebook Reel/Video, Threads)"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                  <button
                    type="button"
                    onClick={handleAutoFetchEndorsement}
                    disabled={isFetchingEndorsementMetric || !endorsementUrl.trim()}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-[#FFF4ED] hover:bg-[#FFE8D9] text-[#D9480F] border border-[#D9480F]/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    title="Tarik views & engagement terkini dari URL platform ini"
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
                {targetPostMetrics.length <= 1 && (
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
                )}

                <div className={targetPostMetrics.length > 1 ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Views Video {targetPostMetrics.length > 1 ? `(${getPlatformBadgeConfig(targetPostMetrics.find((p) => p.id === activeMetricTabPostId)?.platform || '', targetPostMetrics.find((p) => p.id === activeMetricTabPostId)?.customPlatformName).label})` : 'Terkini / Akhir'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={metricViews}
                    onChange={(e) => updateMetricField('views', parseInt(e.target.value, 10) || 0)}
                    placeholder="Contoh: 65000"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              {/* Engagement Inputs */}
              <div>
                <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Metrik Interaksi Audiens {targetPostMetrics.length > 1 ? `(${getPlatformBadgeConfig(targetPostMetrics.find((p) => p.id === activeMetricTabPostId)?.platform || '', targetPostMetrics.find((p) => p.id === activeMetricTabPostId)?.customPlatformName).label})` : ''}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <Heart className="w-3 h-3 text-rose-500" />
                      <span>Likes</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={metricLikes}
                      onChange={(e) => updateMetricField('likes', parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3 h-3 text-blue-500" />
                      <span>Comments</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={metricComments}
                      onChange={(e) => updateMetricField('comments', parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <Share2 className="w-3 h-3 text-emerald-500" />
                      <span>Shares</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={metricShares}
                      onChange={(e) => updateMetricField('shares', parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-500 flex items-center gap-1 mb-1">
                      <Bookmark className="w-3 h-3 text-amber-500" />
                      <span>Saves</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={metricSaves}
                      onChange={(e) => updateMetricField('saves', parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>
                </div>
              </div>

              {/* Hidden inputs to pass data to server action */}
              <input type="hidden" name="postUrl" value={endorsementUrl} />
              <input type="hidden" name="postsMetrics" value={JSON.stringify(targetPostMetrics)} />
              <input
                type="hidden"
                name="finalViews"
                value={targetPostMetrics.length > 1 ? targetPostMetrics.reduce((sum, p) => sum + (p.views || 0), 0) : metricViews}
              />
              <input
                type="hidden"
                name="likes"
                value={targetPostMetrics.length > 1 ? targetPostMetrics.reduce((sum, p) => sum + (p.likes || 0), 0) : metricLikes}
              />
              <input
                type="hidden"
                name="comments"
                value={targetPostMetrics.length > 1 ? targetPostMetrics.reduce((sum, p) => sum + (p.comments || 0), 0) : metricComments}
              />
              <input
                type="hidden"
                name="shares"
                value={targetPostMetrics.length > 1 ? targetPostMetrics.reduce((sum, p) => sum + (p.shares || 0), 0) : metricShares}
              />
              <input
                type="hidden"
                name="saves"
                value={targetPostMetrics.length > 1 ? targetPostMetrics.reduce((sum, p) => sum + (p.saves || 0), 0) : metricSaves}
              />

              {/* Live Preview Box */}
              {(() => {
                const totalViewsCombined =
                  targetPostMetrics.length > 1
                    ? targetPostMetrics.reduce((sum, p) => sum + (p.views || 0), 0)
                    : metricViews
                const totalLikesCombined =
                  targetPostMetrics.length > 1
                    ? targetPostMetrics.reduce((sum, p) => sum + (p.likes || 0), 0)
                    : metricLikes
                const totalCommentsCombined =
                  targetPostMetrics.length > 1
                    ? targetPostMetrics.reduce((sum, p) => sum + (p.comments || 0), 0)
                    : metricComments
                const totalSharesCombined =
                  targetPostMetrics.length > 1
                    ? targetPostMetrics.reduce((sum, p) => sum + (p.shares || 0), 0)
                    : metricShares
                const totalSavesCombined =
                  targetPostMetrics.length > 1
                    ? targetPostMetrics.reduce((sum, p) => sum + (p.saves || 0), 0)
                    : metricSaves
                const totalEng = totalLikesCombined + totalCommentsCombined + totalSharesCombined + totalSavesCombined
                const er = totalViewsCombined > 0 ? (totalEng / totalViewsCombined) * 100 : 0
                const cpv = totalViewsCombined > 0 ? videoMetricsTarget.rateCard / totalViewsCombined : 0
                const cpe = totalEng > 0 ? videoMetricsTarget.rateCard / totalEng : 0

                return (
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#D9480F] uppercase tracking-wider">
                      <span>Kalkulasi Otomatis Sistem</span>
                      <span>Rate Card: {formatRupiah(videoMetricsTarget.rateCard)}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">
                          {targetPostMetrics.length > 1 ? 'Total Views Gabungan' : 'Total Views'}
                        </span>
                        <span className="text-sm font-extrabold text-[#1A1715] font-mono">
                          {totalViewsCombined.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">
                          {targetPostMetrics.length > 1 ? 'Total Interaksi' : 'Total Engagement'}
                        </span>
                        <span className="text-sm font-extrabold text-[#1A1715] font-mono">
                          {totalEng.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">Engagement Rate</span>
                        <span className="text-sm font-extrabold text-amber-700 font-mono">
                          {er.toFixed(2)}%
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-[#EFE8DE]">
                        <span className="text-[10px] text-stone-400 block font-bold uppercase">Cost Per View (CPV)</span>
                        <span className="text-sm font-extrabold text-emerald-700 font-mono">
                          {formatRupiah(cpv)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#EFE8DE] sticky bottom-0 bg-white/95 backdrop-blur-xs -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-3.5 z-10">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateOpen(false)
          }}
        >
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-4xl xl:max-w-5xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] my-auto">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5] flex-shrink-0">
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

            <form onSubmit={handleCreate} className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
                {/* Kolom Kiri: Detail KOL, Jadwal, Tipe & Biaya, Pembayaran */}
                <div className="lg:col-span-7 space-y-4">
                  {/* KOL Selection or New KOL Registration */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                        {isNewKol ? 'Daftarkan KOL Baru *' : 'Pilih KOL / Influencer *'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewKol(!isNewKol)
                          setNewKolName('')
                          setNewKolPhone('')
                          setNewKolSocials([{ id: '1', platform: 'INSTAGRAM', handle: '' }])
                          setSelectedKolId('')
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#D9480F] hover:text-[#B83808] hover:underline cursor-pointer"
                      >
                        {isNewKol ? (
                          <>
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Pilih dari Daftar KOL</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ KOL Baru</span>
                          </>
                        )}
                      </button>
                    </div>

                    <input type="hidden" name="isNewKol" value={isNewKol ? 'true' : 'false'} />

                    {!isNewKol ? (
                      <select
                        name="kolId"
                        value={selectedKolId}
                        onChange={(e) => {
                          if (e.target.value === '__NEW__') {
                            setIsNewKol(true)
                            setSelectedKolId('')
                          } else {
                            setSelectedKolId(e.target.value)
                          }
                        }}
                        required={!isNewKol}
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] bg-white"
                      >
                        <option value="">-- Pilih Profil KOL --</option>
                        <option value="__NEW__" className="font-bold text-[#D9480F] bg-[#FFF4ED]">
                          ✨ + Daftarkan Profil KOL Baru...
                        </option>
                        {kols.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} {k.phoneNumber ? `(${k.phoneNumber})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3.5 sm:p-4 bg-[#FFF4ED]/60 border border-[#D9480F]/30 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-[#D9480F]">
                            <UserPlus className="w-4 h-4" />
                            <span>Profil Influencer / KOL Baru</span>
                          </div>
                          <span className="text-[10px] font-semibold text-stone-500 bg-white px-2 py-0.5 rounded-md border border-[#EFE8DE]">
                            Otomatis masuk database KOL
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">
                            Nama Lengkap / Panggilan KOL *
                          </label>
                          <input
                            name="newKolName"
                            type="text"
                            value={newKolName}
                            onChange={(e) => setNewKolName(e.target.value)}
                            required={isNewKol}
                            placeholder="Contoh: Sarah Kuliner / @makanbareng"
                            className="w-full px-3 py-2 text-xs sm:text-sm border border-[#EFE8DE] bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                          />
                        </div>

                        {/* No. WhatsApp / Telepon */}
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">
                            No. WhatsApp / Telepon (Opsional)
                          </label>
                          <input
                            name="newKolPhone"
                            type="tel"
                            value={newKolPhone}
                            onChange={(e) => setNewKolPhone(e.target.value)}
                            placeholder="e.g. 08123456789 (untuk koordinasi visit outlet)"
                            className="w-full px-3 py-2 text-xs border border-[#EFE8DE] bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                          />
                        </div>

                        {/* Akun Media Sosial Multi-Platform (IG, TikTok, Shorts, Threads) */}
                        <div className="pt-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-bold text-stone-700">
                              Akun Media Sosial <span className="text-stone-400 font-normal">(Bisa Lebih dari 1 Platform)</span>
                            </label>
                            <button
                              type="button"
                              onClick={addKolSocial}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D9480F] hover:text-[#B83808] hover:underline cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Tambah Sosmed</span>
                            </button>
                          </div>

                          {/* Serialized JSON passed to createEndorsement */}
                          <input
                            type="hidden"
                            name="newKolSocials"
                            value={JSON.stringify(newKolSocials.filter((s) => s.handle.trim()))}
                          />
                          {/* Backward compatibility fallback */}
                          <input
                            type="hidden"
                            name="newKolSocial"
                            value={newKolSocials.find((s) => s.handle.trim())?.handle || ''}
                          />

                          <div className="space-y-2">
                            {newKolSocials.map((entry) => (
                              <div key={entry.id} className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                                  <PlatformIcon platform={entry.platform} className="w-4 h-4 text-stone-700" />
                                </div>
                                {/* Dropdown Platform */}
                                <div className="relative w-36 sm:w-44 flex-shrink-0">
                                  <select
                                    value={entry.platform}
                                    onChange={(e) =>
                                      updateKolSocial(entry.id, 'platform', e.target.value as SocialPlatform)
                                    }
                                    className="w-full px-2.5 py-2 text-xs font-bold border border-[#EFE8DE] bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D9480F] text-stone-800 cursor-pointer shadow-2xs"
                                  >
                                    <option value="INSTAGRAM">Instagram (IG)</option>
                                    <option value="TIKTOK">TikTok</option>
                                    <option value="YOUTUBE">YouTube Shorts</option>
                                    <option value="FACEBOOK">Facebook</option>
                                    <option value="THREADS">Threads</option>
                                  </select>
                                </div>

                                {/* Input Handle / Link */}
                                <div className="flex-1 relative">
                                  <input
                                    type="text"
                                    value={entry.handle}
                                    onChange={(e) => updateKolSocial(entry.id, 'handle', e.target.value)}
                                    placeholder={
                                      entry.platform === 'INSTAGRAM'
                                        ? 'e.g. @sarah_foodie atau link IG'
                                        : entry.platform === 'TIKTOK'
                                        ? 'e.g. @sarah.kuliner atau link TikTok'
                                        : entry.platform === 'YOUTUBE'
                                        ? 'e.g. @SarahShorts atau link channel'
                                        : entry.platform === 'FACEBOOK'
                                        ? 'e.g. facebook.com/sarah atau fanspage'
                                        : 'e.g. @sarah.threads'
                                    }
                                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                                  />
                                </div>

                                {/* Delete Row Button */}
                                {newKolSocials.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeKolSocial(entry.id)}
                                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                                    title="Hapus baris sosmed ini"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        {outlets
                          .filter((o) => (createType === 'DELIVERY' ? true : o.isActive !== false))
                          .sort((a, b) => {
                            if (createType === 'DELIVERY') {
                              const aGudang = a.posType === 'gudang' || a.name.toLowerCase().includes('online') || a.name.toLowerCase().includes('gudang')
                              const bGudang = b.posType === 'gudang' || b.name.toLowerCase().includes('online') || b.name.toLowerCase().includes('gudang')
                              if (aGudang && !bGudang) return -1
                              if (!aGudang && bGudang) return 1
                            }
                            return a.name.localeCompare(b.name)
                          })
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} {o.region ? `(${o.region})` : ''} {o.type === 'MITRA' ? '• Mitra' : ''} {!o.posOutletId ? '⚠️ (Non-POS)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Conditional SS Online Delivery Fields */}
                  {createType === 'DELIVERY' && (
                    <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2.5">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <span>Rincian Pengiriman SS Online</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {/* Status & Tanggal Pembayaran / Transfer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFE8DE]">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Status Pembayaran
                      </label>
                      <select
                        name="paymentStatus"
                        defaultValue="UNPAID"
                        className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-medium"
                      >
                        <option value="UNPAID">Belum Bayar (Pending)</option>
                        <option value="PAID">Lunas (Done)</option>
                        <option value="BARTER">Barter Produk</option>
                        <option value="DOWN_PAYMENT">DP Sebagian</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Tanggal Transfer (TF)
                      </label>
                      <input
                        name="paymentDate"
                        type="date"
                        className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none"
                      />
                      <span className="text-[10px] text-stone-400 mt-0.5 block">Diisi jika sudah transfer (lunas/DP)</span>
                    </div>
                  </div>

                  {/* Catatan Kunjungan / Briefing untuk Kasir & Tim */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Catatan Kunjungan / Briefing (Opsional)
                    </label>
                    <textarea
                      name="paymentNotes"
                      rows={2}
                      placeholder="Contoh: Datang jam 14:00, brief konten fokus menu burger & shawarma spicy, bawa kru 1 orang..."
                      className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#D9480F]"
                    />
                    <p className="text-[10px] text-stone-500 mt-1">
                      💡 Catatan ini otomatis terbaca oleh kasir POS saat influencer datang ke cabang outlet. Link video TikTok/IG dan metrik konten dapat diisi setelah visit selesai.
                    </p>
                  </div>

                  {/* Multi-Platform Video Links in Create */}
                  <input
                    type="hidden"
                    name="videoPosts"
                    value={JSON.stringify(createVideoLinks.filter((v) => v.postUrl.trim()))}
                  />
                  <input
                    type="hidden"
                    name="postUrl"
                    value={createVideoLinks.find((v) => v.postUrl.trim())?.postUrl.trim() || ''}
                  />
                  <VideoPlatformLinksEditor
                    videoLinks={createVideoLinks}
                    onAdd={addCreateVideoLink}
                    onRemove={removeCreateVideoLink}
                    onPlatformChange={updateCreateVideoPlatform}
                    onUrlChange={updateCreateVideoUrl}
                    onCustomNameChange={updateCreateCustomPlatformName}
                    title="Link Video Konten (Opsional)"
                    description="Pilih platform terlebih dahulu jika link video konten sudah tersedia."
                  />
                </div>

                {/* Kolom Kanan: Menu Jatah POS & Ringkasan HPP */}
                <div className="lg:col-span-5 space-y-3.5">
                  {/* Menu POS Integration Selector */}
                  <EndorsementMenuSelector
                    posMenuItems={posMenuItems}
                    selectedItems={createMenuItems}
                    onChange={setCreateMenuItems}
                    onSummaryCalculated={(summary, hpp) => {
                      setCreateMenuName(summary)
                      setCreateHpp(hpp)
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white rounded-2xl border border-[#EFE8DE]">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Ringkasan Menu (Laporan)
                      </label>
                      <input
                        name="menuGiven"
                        value={createMenuName}
                        onChange={(e) => setCreateMenuName(e.target.value)}
                        placeholder="e.g. 1x Combo #2, 2x Aqua"
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
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 mt-4 border-t border-[#EFE8DE] sticky bottom-0 bg-white/95 backdrop-blur-xs -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-3.5 z-10">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingEndorsement(null)
          }}
        >
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-4xl xl:max-w-5xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] my-auto">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5] flex-shrink-0">
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

            <form onSubmit={handleUpdate} className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
                {/* KOLOM KIRI: Informasi KOL, Jadwal, Status & Pembayaran */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      KOL / Influencer *
                    </label>
                    <select
                      name="kolId"
                      defaultValue={editingEndorsement.kolId}
                      required
                      className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] bg-white"
                    >
                      {kols.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        {outlets
                          .filter((o) => (editType === 'DELIVERY' ? true : o.isActive !== false || o.id === editingEndorsement.outletId))
                          .sort((a, b) => {
                            if (editType === 'DELIVERY') {
                              const aGudang = a.posType === 'gudang' || a.name.toLowerCase().includes('online') || a.name.toLowerCase().includes('gudang')
                              const bGudang = b.posType === 'gudang' || b.name.toLowerCase().includes('online') || b.name.toLowerCase().includes('gudang')
                              if (aGudang && !bGudang) return -1
                              if (!aGudang && bGudang) return 1
                            }
                            return a.name.localeCompare(b.name)
                          })
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} {o.region ? `(${o.region})` : ''} {o.type === 'MITRA' ? '• Mitra' : ''} {!o.posOutletId ? '⚠️ (Non-POS)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Conditional SS Online Delivery Fields */}
                  {editType === 'DELIVERY' && (
                    <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2.5">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <span>Rincian Pengiriman SS Online</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {/* Multi-Platform Video Links in Edit */}
                  <input
                    type="hidden"
                    name="videoPosts"
                    value={JSON.stringify(editVideoLinks.filter((v) => v.postUrl.trim()))}
                  />
                  <input
                    type="hidden"
                    name="postUrl"
                    value={editVideoLinks.find((v) => v.postUrl.trim())?.postUrl.trim() || ''}
                  />
                  <VideoPlatformLinksEditor
                    videoLinks={editVideoLinks}
                    onAdd={addEditVideoLink}
                    onRemove={removeEditVideoLink}
                    onPlatformChange={updateEditVideoPlatform}
                    onUrlChange={updateEditVideoUrl}
                    onCustomNameChange={updateEditCustomPlatformName}
                    title="Link Video & Konten Multi-Platform"
                    description="Pilih platform terlebih dahulu, lalu masukkan link URL postingan video."
                  />

                  {/* Draft & Payment Status in Edit */}
                  <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFE8DE] space-y-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-stone-600">
                      Administrasi & Pembayaran
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
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
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
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

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Tanggal Transfer (TF)
                        </label>
                        <input
                          name="paymentDate"
                          type="date"
                          defaultValue={
                            editingEndorsement.paymentDate
                              ? new Date(editingEndorsement.paymentDate).toISOString().split('T')[0]
                              : ''
                          }
                          className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Bank & Payment Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Rekening Transfer (Kustom)
                        </label>
                        <input
                          name="bankAccountCustom"
                          defaultValue={editingEndorsement.bankAccountCustom || editingEndorsement.kol.bankAccount || ''}
                          placeholder="e.g. BCA 123456 a.n ..."
                          className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Catatan Pembayaran
                        </label>
                        <input
                          name="paymentNotes"
                          defaultValue={editingEndorsement.paymentNotes || ''}
                          placeholder="e.g. Lunas via Mandiri / DP 100"
                          className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* KOLOM KANAN: Menu POS & HPP */}
                <div className="lg:col-span-5 space-y-3.5">
                  {editingEndorsement.posOrderNumber && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Pesanan telah diklaim di POS dengan <strong>Order #{editingEndorsement.posOrderNumber}</strong>
                      </span>
                    </div>
                  )}

                  {/* Menu POS Integration Selector */}
                  <EndorsementMenuSelector
                    posMenuItems={posMenuItems}
                    selectedItems={editMenuItems}
                    onChange={setEditMenuItems}
                    onSummaryCalculated={(summary, hpp) => {
                      setEditMenuName(summary)
                      setEditHpp(hpp)
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white rounded-2xl border border-[#EFE8DE]">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Ringkasan Menu (Laporan)
                      </label>
                      <input
                        name="menuGiven"
                        value={editMenuName}
                        onChange={(e) => setEditMenuName(e.target.value)}
                        placeholder="e.g. 1x Combo #2, 2x Aqua"
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
                        value={editHpp}
                        onChange={(e) => setEditHpp(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl bg-white focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 mt-4 border-t border-[#EFE8DE] sticky bottom-0 bg-white/95 backdrop-blur-xs -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-3.5 z-10">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null)
          }}
        >
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
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

      {/* Video Preview Modal (Option 1) */}
      <VideoPreviewModal
        isOpen={!!videoPreviewTarget}
        onClose={() => setVideoPreviewTarget(null)}
        endorsement={videoPreviewTarget?.endorsement || null}
        initialPostId={videoPreviewTarget?.initialPostId}
      />
    </div>
  )
}
