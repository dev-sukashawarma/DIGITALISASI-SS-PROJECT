'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  Clock3,
  FileEdit,
  Sparkles,
  AlertCircle,
  Video,
  Layers,
  BarChart3,
  X,
  Target,
  ArrowRight,
  TrendingUp,
  Megaphone,
  MapPin,
  Zap,
  Settings2,
  Link2,
} from 'lucide-react'
import {
  createInternalContent,
  updateInternalContent,
  updateContentStatus,
  deleteInternalContent,
  toggleContentAdsStatus,
} from '@/app/actions/content'
import {
  PILLARS,
  CONTENT_TYPES,
  FORMATS,
  GOALS,
  PLATFORMS,
  SerializedInternalContent,
  Pagination,
} from './ContentMetricsView'

export type { SerializedInternalContent }

interface ContentPlannerViewProps {
  initialContents: SerializedInternalContent[]
  outlets: Array<{ id: string; name: string }>
  userRole: string
  initialContentTypes?: string[]
}

export default function ContentPlannerView({
  initialContents,
  outlets,
  userRole,
  initialContentTypes,
}: ContentPlannerViewProps) {
  const contentTypesList = useMemo(() => {
    return initialContentTypes && initialContentTypes.length > 0 ? initialContentTypes : CONTENT_TYPES
  }, [initialContentTypes])

  // Filters state
  const [search, setSearch] = useState('')
  const [adsFilter, setAdsFilter] = useState<'ALL' | 'ADS' | 'ORGANIC'>('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [formatFilter, setFormatFilter] = useState('ALL')
  const [goalFilter, setGoalFilter] = useState('ALL')
  const [contentTypeFilter, setContentTypeFilter] = useState('ALL')
  const [pillarFilter, setPillarFilter] = useState('ALL')
  const [platformFilter, setPlatformFilter] = useState('ALL')
  const [outletFilter, setOutletFilter] = useState('')

  // Table view pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, adsFilter, statusFilter, formatFilter, goalFilter, contentTypeFilter, pillarFilter, platformFilter, outletFilter])

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingContent, setEditingContent] = useState<SerializedInternalContent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedInternalContent | null>(null)

  // View mode & Calendar state
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'TABLE'>('CALENDAR')
  const [calendarDate, setCalendarDate] = useState(() => {
    if (initialContents.length > 0) {
      const sortedDates = [...initialContents].map((c) => c.postDate).filter(Boolean).sort().reverse()
      if (sortedDates[0]) {
        const parts = sortedDates[0].split('-')
        if (parts.length >= 2) {
          const y = parseInt(parts[0], 10)
          const m = parseInt(parts[1], 10) - 1
          if (!isNaN(y) && !isNaN(m)) {
            return new Date(y, m, 1)
          }
        }
      }
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDateDetails, setSelectedDateDetails] = useState<{
    dateStr: string
    items: SerializedInternalContent[]
  } | null>(null)

  const [errorMessage, setErrorMessage] = useState('')
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Create form state - Multi-platform support
  const [createPlatforms, setCreatePlatforms] = useState<string[]>(['TIKTOK'])
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>({
    TIKTOK: '',
    INSTAGRAM: '',
    YOUTUBE_SHORTS: '',
  })
  const [createTitle, setCreateTitle] = useState('')
  const [createPlatform, setCreatePlatform] = useState('TIKTOK')
  const [createFormat, setCreateFormat] = useState('VIDEO')
  const [createContentType, setCreateContentType] = useState('Sidak Outlet')
  const [createGoal, setCreateGoal] = useState('Sales & Traffic')
  const [createPillar, setCreatePillar] = useState('Promo')
  const [createStatus, setCreateStatus] = useState('Planned')
  const [createPostDate, setCreatePostDate] = useState(new Date().toISOString().split('T')[0])
  const [createPostTime, setCreatePostTime] = useState('11:00')
  const [createOutletId, setCreateOutletId] = useState('ALL')
  const [createTakeLocation, setCreateTakeLocation] = useState('')
  const [createCreator, setCreateCreator] = useState('MARCOM')
  const [createPostUrl, setCreatePostUrl] = useState('')
  const [createIsAds, setCreateIsAds] = useState(false)

  // Toggle ads handler
  const handleToggleAds = async (id: string, currentIsAds: boolean) => {
    startTransition(async () => {
      const res = await toggleContentAdsStatus(id, !currentIsAds)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setStatusNotice(`Status diubah menjadi "${!currentIsAds ? 'Diiklanin' : 'Organik'}"!`)
        setTimeout(() => setStatusNotice(null), 3000)
      }
    })
  }

  // Filtered data
  const filtered = useMemo(() => {
    return initialContents
      .filter((item) => {
        const matchesSearch =
          search === '' ||
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.pillar.toLowerCase().includes(search.toLowerCase()) ||
          (item.contentType && item.contentType.toLowerCase().includes(search.toLowerCase())) ||
          (item.creator && item.creator.toLowerCase().includes(search.toLowerCase())) ||
          item.outletName.toLowerCase().includes(search.toLowerCase()) ||
          (item.takeLocation && item.takeLocation.toLowerCase().includes(search.toLowerCase()))

        const matchesAds =
          adsFilter === 'ALL' ||
          (adsFilter === 'ADS' && item.isAds) ||
          (adsFilter === 'ORGANIC' && !item.isAds)

        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'Sudah Posting' && (item.status === 'Sudah Posting' || item.status === 'POSTED')) ||
          item.status === statusFilter

        const matchesFormat = formatFilter === 'ALL' || item.format === formatFilter
        const matchesGoal = goalFilter === 'ALL' || item.goal === goalFilter
        const matchesContentType = contentTypeFilter === 'ALL' || item.contentType === contentTypeFilter
        const matchesPillar = pillarFilter === 'ALL' || item.pillar === pillarFilter

        const matchesPlatform =
          platformFilter === 'ALL' ||
          (platformFilter === 'INSTAGRAM'
            ? item.platform === 'INSTAGRAM' || item.platform === 'IG_REELS'
            : item.platform === platformFilter)

        // Outlet Filter
        const matchesOutlet =
          outletFilter === '' ||
          (outletFilter === 'ALL' && !item.outletId) ||
          item.outletId === outletFilter

        return (
          matchesSearch &&
          matchesAds &&
          matchesStatus &&
          matchesFormat &&
          matchesGoal &&
          matchesContentType &&
          matchesPillar &&
          matchesPlatform &&
          matchesOutlet
        )
      })
      .sort((a, b) => new Date(b.postDate).getTime() - new Date(a.postDate).getTime())
  }, [initialContents, search, adsFilter, statusFilter, formatFilter, goalFilter, contentTypeFilter, pillarFilter, platformFilter, outletFilter])

  // Table pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filtered.length)

  const paginatedContents = useMemo(() => {
    return filtered.slice(startIndex, endIndex)
  }, [filtered, startIndex, endIndex])

  // Selected outlet name helper
  const selectedOutletName = useMemo(() => {
    if (outletFilter === 'ALL') return 'Official'
    if (!outletFilter) return 'Semua'
    const found = outlets.find((o) => o.id === outletFilter)
    return found ? found.name : 'Outlet'
  }, [outletFilter, outlets])

  // Contents for metrics (responsive to active outlet filter)
  const metricContents = useMemo(() => {
    return initialContents.filter((item) => {
      if (outletFilter === 'ALL' && item.outletId) return false
      if (outletFilter !== '' && outletFilter !== 'ALL' && item.outletId !== outletFilter) return false
      return true
    })
  }, [initialContents, outletFilter])

  // Aggregate stats based on active outlet filter
  const totalContents = metricContents.length
  const totalPosted = metricContents.filter(i => i.status === 'Sudah Posting' || i.status === 'POSTED').length
  const totalPlanned = metricContents.filter(i => i.status === 'Planned').length
  const totalDraft = metricContents.filter(i => i.status === 'Draft').length
  const totalAds = metricContents.filter(i => i.isAds).length
  const totalOrganic = metricContents.filter(i => !i.isAds).length

  // Calculate busiest time slot
  const timeSlotCounts: Record<string, number> = {}
  metricContents.forEach((c) => {
    if (c.postTime) {
      timeSlotCounts[c.postTime] = (timeSlotCounts[c.postTime] || 0) + 1
    }
  })
  const topTimeSlot = Object.entries(timeSlotCounts).sort((a, b) => b[1] - a[1])[0]

  // Calendar Navigation & Helpers
  const handlePrevMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }
  const handleNextMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }
  const handleToday = () => {
    const today = new Date()
    setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const monthYearTitle = calendarDate.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  // Group filtered contents by date YYYY-MM-DD
  const contentsByDate = useMemo(() => {
    const map = new Map<string, SerializedInternalContent[]>()
    filtered.forEach((item) => {
      const key = item.postDate.split('T')[0]
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(item)
    })
    return map
  }, [filtered])

  const currentMonthPrefix = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`

  const monthScheduledCount = useMemo(() => {
    return filtered.filter((item) => item.postDate.startsWith(currentMonthPrefix)).length
  }, [filtered, currentMonthPrefix])

  // Generate 7-column calendar grid (Senin to Minggu)
  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()

    const firstDay = new Date(year, month, 1)
    // 0: Sunday, 1: Monday ... 6: Saturday
    // In Indonesia Monday-first: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const startDayOfWeek = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const cells: Array<{
      dateStr: string
      dayNum: number
      isCurrentMonth: boolean
      isToday: boolean
      items: SerializedInternalContent[]
    }> = []

    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: false,
        items: contentsByDate.get(dateStr) || [],
      })
    }

    // Current month days
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        items: contentsByDate.get(dateStr) || [],
      })
    }

    // Next month padding to fill complete weeks (rows of 7)
    const remainder = (7 - (cells.length % 7)) % 7
    for (let d = 1; d <= remainder; d++) {
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: false,
        items: contentsByDate.get(dateStr) || [],
      })
    }

    return cells
  }, [calendarDate, contentsByDate])

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
        setStatusNotice('Rencana konten baru berhasil ditambahkan!')
        setTimeout(() => setStatusNotice(null), 4000)
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
        setStatusNotice('Rencana konten berhasil diperbarui!')
        setTimeout(() => setStatusNotice(null), 4000)
      }
    })
  }

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    startTransition(async () => {
      const res = await updateContentStatus(id, newStatus)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setStatusNotice(`Status konten berhasil diubah menjadi "${newStatus}"!`)
        setTimeout(() => setStatusNotice(null), 3000)
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
        setStatusNotice('Konten berhasil dihapus.')
        setTimeout(() => setStatusNotice(null), 3000)
      }
    })
  }

  const openCreateModal = () => {
    setCreatePlatforms(['TIKTOK'])
    setPlatformUrls({ TIKTOK: '', INSTAGRAM: '', YOUTUBE_SHORTS: '' })
    setCreateTitle('')
    setCreatePlatform('TIKTOK')
    setCreateFormat('VIDEO')
    setCreateContentType(contentTypesList[0] || 'Sidak Outlet')
    setCreateGoal('Sales & Traffic')
    setCreatePillar('Promo')
    setCreateStatus('Planned')
    setCreatePostDate(new Date().toISOString().split('T')[0])
    setCreatePostTime('11:00')
    setCreateOutletId(outletFilter && outletFilter !== 'ALL' ? outletFilter : 'ALL')
    setCreateTakeLocation('')
    setCreateCreator('MARCOM')
    setCreatePostUrl('')
    setCreateIsAds(false)
    setErrorMessage('')
    setIsCreateOpen(true)
  }

  const openCreateForDate = (dateStr: string) => {
    openCreateModal()
    setCreatePostDate(dateStr)
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Konten Planner • Editorial & Produksi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Rencana Konten & Editorial Calendar
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Jadwal perencanaan ide konten, jam posting, format, dan pelacakan status produksi video organik tim kreatif Suka Shawarma.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/content-planner/metrik-data"
            className="inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white hover:bg-[#FAF8F5] text-stone-700 border border-[#EFE8DE] rounded-xl text-xs sm:text-sm font-bold shadow-2xs hover:border-[#D9480F]/40 transition-all cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-[#D9480F]" />
            <span>Lihat Metrik Data</span>
          </Link>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Rencana Konten</span>
          </button>
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FAF8F5] border border-[#EFE8DE] rounded-2xl w-fit flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-[#D9480F] text-white shadow-xs">
          <CalendarDays className="w-4 h-4" />
          <span>Rencana Konten</span>
        </div>

        <Link
          href="/dashboard/content-planner/metrik-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60 cursor-pointer"
        >
          <BarChart3 className="w-4 h-4 text-stone-400" />
          <span>Metrik Data</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-mono">
            {initialContents.length}
          </span>
        </Link>

        <Link
          href="/dashboard/content-planner/referensi-data"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60 cursor-pointer"
        >
          <TrendingUp className="w-4 h-4 text-stone-400" />
          <span>Referensi Data</span>
        </Link>

        <Link
          href="/dashboard/content-planner/pengaturan"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-stone-600 hover:text-[#1A1715] hover:bg-white/60 cursor-pointer"
        >
          <Settings2 className="w-4 h-4 text-stone-400" />
          <span>Pengaturan Konten</span>
        </Link>
      </div>

      {/* Status Notice Banner */}
      {statusNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{statusNotice}</span>
          </div>
          <button
            onClick={() => setStatusNotice(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-stone-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingContent && !deleteTarget && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Executive 4 Bento Cards for Planning */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Rencana */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                Total Konten
              </span>
              {outletFilter && outletFilter !== '' && (
                <span className="text-[10px] font-bold text-[#D9480F] bg-[#FFF4ED] px-1.5 py-0.5 rounded-md border border-[#D9480F]/20">
                  {selectedOutletName}
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-[#1A1715]">
              {totalContents} <span className="text-xs text-stone-500 font-sans">jadwal</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
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

        {/* Sudah Posting */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Sudah Posting
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-700">
              {totalPosted} <span className="text-xs text-stone-500 font-sans">konten</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Telah dipublikasikan dan terlacak metriknya
            </p>
          </div>
        </div>

        {/* Planned / Antrean */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Rencana / Draft
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Clock3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-blue-700">
              {totalPlanned + totalDraft}{' '}
              <span className="text-xs text-stone-500 font-sans">dalam proses</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              {totalPlanned} Planned • {totalDraft} Draft naskah
            </p>
          </div>
        </div>

        {/* Slot Jam Posting Utama */}
        <div className="bg-gradient-to-br from-[#1C1917] to-[#292524] p-5 rounded-3xl text-white shadow-xs flex flex-col justify-between border border-stone-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-300 font-bold uppercase tracking-wider">
              Prime Time Posting
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-bold text-xl font-mono text-amber-300">
              {topTimeSlot ? topTimeSlot[0] : '11:00'} WIB
            </div>
            <div className="text-xs text-stone-300 mt-0.5">
              Slot waktu terpadat ({topTimeSlot ? topTimeSlot[1] : 0} konten terjadwal)
            </div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari rencana konten, tipe, creator, atau cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="ALL">Semua Status</option>
              <option value="Sudah Posting">Sudah Posting (Live)</option>
              <option value="Planned">Planned (Terjadwal)</option>
              <option value="Draft">Draft (Konsep)</option>
            </select>
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
              <option value="ALL">Semua Format</option>
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
              {contentTypesList.map((ct) => (
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

          {/* Platform Filter */}
          <div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors font-medium"
            >
              <option value="ALL">Semua Platform</option>
              <option value="TIKTOK">TikTok</option>
              <option value="INSTAGRAM">Instagram</option>
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
              <option value="ALL">Official</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-stone-500 font-medium pt-2 border-t border-[#EFE8DE]">
          <span>
            Menampilkan <span className="font-bold text-[#1A1715]">{filtered.length}</span> dari {totalContents} rencana konten
          </span>
          {(search || adsFilter !== 'ALL' || statusFilter !== 'ALL' || formatFilter !== 'ALL' || goalFilter !== 'ALL' || contentTypeFilter !== 'ALL' || pillarFilter !== 'ALL' || platformFilter !== 'ALL' || outletFilter) && (
            <button
              onClick={() => {
                setSearch('')
                setAdsFilter('ALL')
                setStatusFilter('ALL')
                setFormatFilter('ALL')
                setGoalFilter('ALL')
                setContentTypeFilter('ALL')
                setPillarFilter('ALL')
                setPlatformFilter('ALL')
                setOutletFilter('')
              }}
              className="text-[#D9480F] hover:underline font-bold cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* View Switcher & Month Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-3xl border border-[#EFE8DE] shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-[#FAF8F5] border border-[#EFE8DE] rounded-2xl">
          <button
            type="button"
            onClick={() => setViewMode('CALENDAR')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'CALENDAR'
                ? 'bg-[#1A1715] text-white shadow-xs'
                : 'text-stone-600 hover:text-[#1A1715] hover:bg-stone-200/50'
            }`}
          >
            <Calendar className="w-4 h-4 text-[#D9480F]" />
            <span>Kalender Editorial</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                viewMode === 'CALENDAR' ? 'bg-[#D9480F] text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {monthScheduledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('TABLE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'TABLE'
                ? 'bg-[#1A1715] text-white shadow-xs'
                : 'text-stone-600 hover:text-[#1A1715] hover:bg-stone-200/50'
            }`}
          >
            <List className="w-4 h-4 text-[#D9480F]" />
            <span>Daftar Tabel</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                viewMode === 'TABLE' ? 'bg-[#D9480F] text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {filtered.length}
            </span>
          </button>
        </div>

        {viewMode === 'CALENDAR' && (
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] hover:bg-white text-stone-700 hover:border-stone-400 transition-all cursor-pointer"
            >
              Bulan Ini
            </button>
            <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl p-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-stone-600 hover:text-[#1A1715] hover:bg-white transition-colors cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs sm:text-sm font-extrabold text-[#1A1715] capitalize min-w-[130px] text-center font-sans">
                {monthYearTitle}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-stone-600 hover:text-[#1A1715] hover:bg-white transition-colors cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main View Container */}
      {viewMode === 'CALENDAR' ? (
        <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b border-[#EFE8DE] bg-[#FAF8F5] text-center text-[11px] font-bold uppercase tracking-wider text-stone-500">
            {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((day) => (
              <div key={day} className="py-3 px-1 border-r last:border-r-0 border-[#EFE8DE]">
                {day}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-[#EFE8DE] bg-stone-100">
            {calendarGrid.map((cell, idx) => {
              const hasItems = cell.items.length > 0
              const visibleItems = cell.items.slice(0, 3)
              const hiddenCount = cell.items.length - 3

              return (
                <div
                  key={cell.dateStr + '-' + idx}
                  className={`min-h-[140px] sm:min-h-[160px] p-2 sm:p-2.5 flex flex-col justify-between transition-colors relative group ${
                    cell.isCurrentMonth
                      ? cell.isToday
                        ? 'bg-[#FFF9F5]'
                        : 'bg-white hover:bg-[#FAF8F5]/60'
                      : 'bg-[#FAF8F5]/40 opacity-50'
                  }`}
                >
                  {/* Cell Top: Day number & Quick Add */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs sm:text-sm font-bold font-mono ${
                            cell.isToday
                              ? 'w-6 h-6 rounded-full bg-[#D9480F] text-white flex items-center justify-center'
                              : cell.isCurrentMonth
                              ? 'text-[#1A1715]'
                              : 'text-stone-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        {cell.isToday && (
                          <span className="hidden sm:inline-block text-[9px] font-bold text-[#D9480F] uppercase tracking-wider">
                            Hari Ini
                          </span>
                        )}
                      </div>

                      {cell.isCurrentMonth && (
                        <button
                          type="button"
                          onClick={() => openCreateForDate(cell.dateStr)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-[#FFF4ED] text-[#D9480F] hover:bg-[#D9480F] hover:text-white cursor-pointer"
                          title={`Tambah konten untuk ${cell.dateStr}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Content Items Stack */}
                    <div className="space-y-1.5">
                      {visibleItems.map((item) => {
                        const isPosted = item.status === 'Sudah Posting' || item.status === 'POSTED'
                        const isPlanned = item.status === 'Planned'
                        const isTiktok = item.platform === 'TIKTOK'
                        const isInstagram = item.platform === 'INSTAGRAM' || item.platform === 'IG_REELS'

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setEditingContent(item)
                              setErrorMessage('')
                            }}
                            className={`p-1.5 rounded-xl border text-left cursor-pointer transition-all hover:shadow-xs hover:scale-[1.01] ${
                              isPosted
                                ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-400'
                                : isPlanned
                                ? 'bg-blue-50/60 border-blue-200 hover:border-blue-400'
                                : 'bg-amber-50/60 border-amber-200 hover:border-amber-400'
                            }`}
                            title={`${item.title} (${item.status}) - Klik untuk edit`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`text-[9px] font-extrabold px-1 py-0.2 rounded font-mono ${
                                    isTiktok
                                      ? 'bg-stone-900 text-white'
                                      : isInstagram
                                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                      : 'bg-red-600 text-white'
                                  }`}
                                >
                                  {isTiktok ? 'TT' : isInstagram ? 'IG' : 'YT'}
                                </span>
                                {item.groupId && (
                                  <span className="text-[9px] text-indigo-600 font-bold" title="Cross-post terhubung">
                                    <Link2 className="w-2.5 h-2.5 inline" />
                                  </span>
                                )}
                                {item.postTime && (
                                  <span className="text-[9px] font-mono text-stone-500">
                                    {item.postTime}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-0.5">
                                {item.isAds && (
                                  <span
                                    className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold"
                                    title="Diiklanin (Ads)"
                                  >
                                    Ads
                                  </span>
                                )}
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isPosted
                                      ? 'bg-emerald-500'
                                      : isPlanned
                                      ? 'bg-blue-500'
                                      : 'bg-amber-500'
                                  }`}
                                />
                              </div>
                            </div>

                            <p className="text-[11px] font-semibold text-[#1A1715] truncate leading-tight">
                              {item.title}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Cell Bottom: Hidden Count or Empty Placeholder */}
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDateDetails({
                          dateStr: cell.dateStr,
                          items: cell.items,
                        })
                      }
                      className="mt-1 text-[10px] font-bold text-[#D9480F] hover:underline text-left cursor-pointer"
                    >
                      +{hiddenCount} konten lainnya...
                    </button>
                  ) : !hasItems && cell.isCurrentMonth ? (
                    <div
                      onClick={() => openCreateForDate(cell.dateStr)}
                      className="mt-1 text-[10px] text-stone-300 group-hover:text-[#D9480F] cursor-pointer transition-colors"
                    >
                      + Jadwal
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Editorial Calendar & Schedule Table */
        <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs sm:text-sm text-stone-600">
            <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE] sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-4 px-4 sm:px-6 whitespace-nowrap">Jadwal & Jam</th>
                <th className="py-4 px-4 whitespace-nowrap">Konten & Konsep</th>
                <th className="py-4 px-4 whitespace-nowrap">Tipe & Pilar</th>
                <th className="py-4 px-4 whitespace-nowrap">Target Goal</th>
                <th className="py-4 px-4 whitespace-nowrap">Status Produksi</th>
                <th className="py-4 px-4 sm:px-6 text-right whitespace-nowrap sticky right-0 z-20 bg-[#FAF8F5] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <CalendarDays className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-600">Belum ada rencana konten yang cocok.</p>
                    <p className="text-xs mt-1">Coba sesuaikan filter atau tambahkan rencana konten baru.</p>
                  </td>
                </tr>
              ) : (
                paginatedContents.map((item) => {
                  const pillarConfig = PILLARS[item.pillar] || PILLARS.Promo
                  const platformConfig = PLATFORMS[item.platform] || PLATFORMS.TIKTOK
                  const formatConfig = FORMATS[item.format] || FORMATS.VIDEO
                  const isPosted = item.status === 'Sudah Posting' || item.status === 'POSTED'

                  return (
                    <tr key={item.id} className="group hover:bg-amber-50/30 transition-colors">
                      {/* Jadwal & Jam */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <div className="font-bold text-[#1A1715]">
                          {new Date(item.postDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-[#D9480F] font-bold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{item.postTime || '11:00'} WIB</span>
                        </div>
                      </td>

                      {/* Konten & Konsep */}
                      <td className="py-4 px-4">
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
                            {item.groupId && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200" title="Cross-platform bundle">
                                <Link2 className="w-2.5 h-2.5" />
                                Cross-post
                              </span>
                            )}
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
                            {item.outletId ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                                <MapPin className="w-3 h-3 text-stone-400" />
                                <span>{item.outletName}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>Official</span>
                              </span>
                            )}
                            {item.takeLocation && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-md"
                                title={`Lokasi Take Konten: ${item.takeLocation}`}
                              >
                                <Video className="w-3 h-3 text-teal-600" />
                                <span>Take: {item.takeLocation}</span>
                              </span>
                            )}
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
                        </div>
                      </td>

                      {/* Target Goal */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1 text-xs font-semibold text-stone-700">
                          <Target className="w-3 h-3 text-[#D9480F]" />
                          <span>{item.goal || 'Sales & Traffic'}</span>
                        </div>
                      </td>

                      {/* Status Produksi (Interactive Switcher) */}
                      <td className="py-4 px-4">
                        <select
                          value={isPosted ? 'Sudah Posting' : item.status}
                          onChange={(e) => handleQuickStatusChange(item.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                            isPosted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : item.status === 'Planned'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Planned">Planned</option>
                          <option value="Sudah Posting">Sudah Posting</option>
                        </select>
                      </td>

                      {/* Aksi */}
                      <td className="py-4 px-4 sm:px-6 text-right sticky right-0 z-10 bg-white group-hover:bg-amber-50/30 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Metrik Data Link */}
                          <Link
                            href="/dashboard/content-planner/metrik-data"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-[#FFF4ED] hover:text-[#D9480F] text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                            title="Buka Halaman Metrik Data"
                          >
                            <TrendingUp className="w-3 h-3 text-[#D9480F]" />
                            <span>Metrik</span>
                          </Link>

                          {/* Edit Content */}
                          <button
                            onClick={() => {
                              setEditingContent(item)
                              setErrorMessage('')
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Edit Rencana Konten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              setDeleteTarget(item)
                              setErrorMessage('')
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Hapus Rencana"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
            itemName="rencana konten"
          />
        )}
      </div>
      )}

      {/* DAY DETAILS MODAL (FOR CALENDAR OVERFLOW) */}
      {selectedDateDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-[#EFE8DE] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#EFE8DE] bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1A1715]">
                    Jadwal Konten
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    {new Date(selectedDateDetails.dateStr).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateDetails(null)}
                className="p-1.5 rounded-xl hover:bg-stone-200/60 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  {selectedDateDetails.items.length} Konten Terjadwal
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const d = selectedDateDetails.dateStr
                    setSelectedDateDetails(null)
                    openCreateForDate(d)
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#D9480F] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah di Tanggal Ini</span>
                </button>
              </div>

              {selectedDateDetails.items.map((item) => {
                const isPosted = item.status === 'Sudah Posting' || item.status === 'POSTED'
                const isPlanned = item.status === 'Planned'
                const isTiktok = item.platform === 'TIKTOK'
                const isInstagram = item.platform === 'INSTAGRAM' || item.platform === 'IG_REELS'

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-[#EFE8DE] bg-[#FAF8F5] flex items-center justify-between gap-3 hover:border-[#D9480F]/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                            isTiktok
                              ? 'bg-stone-900 text-white'
                              : isInstagram
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {isTiktok ? 'TIKTOK' : isInstagram ? 'INSTAGRAM' : 'SHORTS'}
                        </span>
                        {item.postTime && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-stone-600 font-bold bg-white px-2 py-0.5 rounded-md border border-[#EFE8DE]">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>{item.postTime}</span>
                          </span>
                        )}
                        {item.isAds && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                            <Zap className="w-3 h-3 text-purple-600" />
                            <span>Ads</span>
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isPosted
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPlanned
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1A1715] truncate">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {item.contentType || 'Konten'} • {item.pillar} • {item.outletName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDateDetails(null)
                        setEditingContent(item)
                        setErrorMessage('')
                      }}
                      className="p-2 rounded-xl bg-white border border-[#EFE8DE] text-stone-600 hover:text-[#D9480F] hover:border-[#D9480F]/40 transition-colors shrink-0 cursor-pointer"
                      title="Edit Konten"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-[#EFE8DE] bg-[#FAF8F5] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDateDetails(null)}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-stone-700 bg-white border border-[#EFE8DE] hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
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
                  Editorial Planner
                </span>
                <h2 className="text-lg font-extrabold text-[#1A1715] mt-0.5">
                  Tambah Rencana Konten Baru
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
              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">
                  Judul / Ide Konten <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Contoh: BIKIN SHAWARMA EXTRA SAUCE RASA SPICY"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              {/* Platform Selector Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1.5">
                  Platform Tayang <span className="text-red-500">*</span>
                  <span className="text-[11px] font-normal text-stone-500 ml-1.5">
                    (Bisa pilih lebih dari 1 untuk auto cross-post)
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'TIKTOK', label: 'TikTok' },
                    { id: 'INSTAGRAM', label: 'Instagram' },
                    { id: 'YOUTUBE_SHORTS', label: 'YouTube Shorts' },
                  ].map((plat) => {
                    const isChecked = createPlatforms.includes(plat.id)
                    return (
                      <label
                        key={plat.id}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#FFF4ED] border-[#D9480F] text-[#D9480F] shadow-2xs'
                            : 'bg-[#FAF8F5] border-[#EFE8DE] text-stone-600 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="platforms"
                          value={plat.id}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreatePlatforms([...createPlatforms, plat.id])
                            } else {
                              if (createPlatforms.length > 1) {
                                setCreatePlatforms(createPlatforms.filter((p) => p !== plat.id))
                              }
                            }
                          }}
                          className="w-3.5 h-3.5 accent-[#D9480F] rounded"
                        />
                        <span>{plat.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Dynamic URL Inputs per Selected Platform */}
              <div className="space-y-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Link URL Postingan
                  </span>
                  {createPlatforms.length > 1 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D9480F] bg-[#FFF4ED] px-2 py-0.5 rounded-md border border-[#D9480F]/20">
                      <Sparkles className="w-3 h-3" />
                      Auto Cross-Post ({createPlatforms.length} Platform)
                    </span>
                  )}
                </div>

                {createPlatforms.map((plat) => {
                  const platLabel = plat === 'TIKTOK' ? 'TikTok' : plat === 'INSTAGRAM' ? 'Instagram' : 'YouTube Shorts'
                  const platPlaceholder =
                    plat === 'TIKTOK'
                      ? 'https://www.tiktok.com/@.../video/...'
                      : plat === 'INSTAGRAM'
                      ? 'https://www.instagram.com/reel/...'
                      : 'https://youtube.com/shorts/...'

                  return (
                    <div key={plat}>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">
                        Link URL {platLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        name={`postUrl_${plat}`}
                        required
                        value={platformUrls[plat] || ''}
                        onChange={(e) =>
                          setPlatformUrls({ ...platformUrls, [plat]: e.target.value })
                        }
                        placeholder={platPlaceholder}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Format & Tipe Konten */}
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Tipe Konten</label>
                  <select
                    name="contentType"
                    value={createContentType}
                    onChange={(e) => setCreateContentType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    {contentTypesList.map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Marketing Goal & Pilar Konten */}
              <div className="grid grid-cols-2 gap-3">
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
              </div>

              {/* Status Awal */}
              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">Status Awal</label>
                <select
                  name="status"
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                >
                  <option value="Planned">Planned (Terjadwal)</option>
                  <option value="Draft">Draft (Konsep)</option>
                  <option value="Sudah Posting">Sudah Posting</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Tanggal Rencana Tayang *</label>
                  <input
                    type="date"
                    name="postDate"
                    required
                    value={createPostDate}
                    onChange={(e) => setCreatePostDate(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Cabang Outlet</label>
                  <select
                    name="outletId"
                    value={createOutletId}
                    onChange={(e) => setCreateOutletId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-800"
                  >
                    <option value="ALL">Official</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Lokasi Take Konten (Outlet)</label>
                  <select
                    name="takeLocation"
                    value={createTakeLocation}
                    onChange={(e) => setCreateTakeLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-800"
                  >
                    <option value="">-- Pilih Lokasi Outlet --</option>
                    <option value="Studio / Kantor Pusat">Studio / Kantor Pusat</option>
                    <option value="Luar Outlet / Event">Luar Outlet / Event</option>
                    <optgroup label="Cabang Outlet">
                      {outlets.map((o) => (
                        <option key={o.id} value={o.name}>{o.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">PIC Creator / Tim</label>
                <input
                  type="text"
                  name="creator"
                  value={createCreator}
                  onChange={(e) => setCreateCreator(e.target.value)}
                  placeholder="MARCOM / Nama Talent"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-800"
                />
              </div>



              {/* Flag Diiklanin / Ads */}
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                <input
                  type="checkbox"
                  id="createPlannerIsAds"
                  name="isAds"
                  value="true"
                  checked={createIsAds}
                  onChange={(e) => setCreateIsAds(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-[#EFE8DE] focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="createPlannerIsAds" className="text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 select-none">
                  <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                  <span>Konten Diiklanin / Boosted Ads (Berbayar)</span>
                </label>
              </div>

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
                  {isPending ? 'Menyimpan...' : 'Simpan Rencana'}
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
                  Edit Rencana Konten
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
                <label className="block text-xs font-bold text-[#1A1715] mb-1">Judul / Ide Konten *</label>
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
                  Link URL Postingan <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="postUrl"
                  required
                  defaultValue={editingContent.postUrl || ''}
                  placeholder="https://www.tiktok.com/@... atau https://www.instagram.com/reel/..."
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
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Status Produksi</label>
                  <select
                    name="status"
                    defaultValue={editingContent.status}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white"
                  >
                    <option value="Planned">Planned</option>
                    <option value="Draft">Draft</option>
                    <option value="Sudah Posting">Sudah Posting</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Tanggal Rencana Tayang *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Cabang Outlet</label>
                  <select
                    name="outletId"
                    defaultValue={editingContent.outletId || 'ALL'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-800"
                  >
                    <option value="ALL">Official</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1A1715] mb-1">Lokasi Take Konten (Outlet)</label>
                  <select
                    name="takeLocation"
                    defaultValue={editingContent.takeLocation || ''}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-800"
                  >
                    <option value="">-- Pilih Lokasi Outlet --</option>
                    <option value="Studio / Kantor Pusat">Studio / Kantor Pusat</option>
                    <option value="Luar Outlet / Event">Luar Outlet / Event</option>
                    {editingContent.takeLocation &&
                      editingContent.takeLocation !== 'Studio / Kantor Pusat' &&
                      editingContent.takeLocation !== 'Luar Outlet / Event' &&
                      !outlets.some((o) => o.name === editingContent.takeLocation) && (
                        <option value={editingContent.takeLocation}>{editingContent.takeLocation}</option>
                    )}
                    <optgroup label="Cabang Outlet">
                      {outlets.map((o) => (
                        <option key={o.id} value={o.name}>{o.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1715] mb-1">PIC Creator</label>
                <input
                  type="text"
                  name="creator"
                  defaultValue={editingContent.creator || 'MARCOM'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white text-stone-800"
                />
              </div>



              {/* Flag Diiklanin / Ads */}
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8DE]">
                <input
                  type="checkbox"
                  id="editPlannerIsAds"
                  name="isAds"
                  value="true"
                  defaultChecked={editingContent.isAds}
                  className="w-4 h-4 text-purple-600 rounded border-[#EFE8DE] focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="editPlannerIsAds" className="text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 select-none">
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
                  {isPending ? 'Menyimpan...' : 'Perbarui Rencana'}
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
              <h3 className="font-extrabold text-[#1A1715] text-base">Hapus Rencana Konten?</h3>
              <p className="text-xs text-stone-500 mt-1">
                Rencana <strong>&quot;{deleteTarget.title}&quot;</strong> akan dihapus permanen.
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
