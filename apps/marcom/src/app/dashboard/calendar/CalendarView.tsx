'use client'

import { useState, useTransition } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Calendar as CalendarIcon,
  Video,
  Megaphone,
  Sparkles,
  Store,
  Users,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Eye,
  DollarSign,
  Tag,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { createEndorsement, deleteEndorsement } from '@/app/actions/endorsements'
import { createAd, deleteAd } from '@/app/actions/ads'
import { createPromoEvent, deletePromoEvent } from '@/app/actions/events'

export interface CalendarEndorsement {
  id: string
  kolId: string
  outletId: string
  scheduleDate: string // YYYY-MM-DD
  rateCard: number
  postUrl: string | null
  initialViews: number | null
  finalViews: number | null
  visitStatus: string
  postStatus: string
  kolName: string
  outletName: string
}

export interface CalendarAd {
  id: string
  outletId: string
  scheduleDate: string // YYYY-MM-DD
  budget: number
  adUrl: string | null
  initialViews: number | null
  finalViews: number | null
  status: string
  outletName: string
}

export interface CalendarPromoEvent {
  id: string
  title: string
  description: string | null
  outletId: string | null
  outletName: string // 'Semua Cabang (Nasional)' or specific outlet
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  type: string
}

interface CalendarViewProps {
  initialEndorsements: CalendarEndorsement[]
  initialAds: CalendarAd[]
  initialPromoEvents: CalendarPromoEvent[]
  outlets: Array<{ id: string; name: string }>
  kols: Array<{ id: string; name: string }>
  userRole: string
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function CalendarView({
  initialEndorsements,
  initialAds,
  initialPromoEvents,
  outlets,
  kols,
  userRole,
}: CalendarViewProps) {
  // Calendar month state
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()) // 0 - 11

  // Filter states
  const [selectedOutlet, setSelectedOutlet] = useState<string>('')
  const [showEndorsements, setShowEndorsements] = useState(true)
  const [showAds, setShowAds] = useState(true)
  const [showPromos, setShowPromos] = useState(true)

  // Interaction modals
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addCategory, setAddCategory] = useState<'endorsement' | 'ad' | 'promo'>('endorsement')
  const [addDate, setAddDate] = useState<string>(today.toISOString().split('T')[0])

  const [detailItem, setDetailItem] = useState<{
    type: 'endorsement' | 'ad' | 'promo'
    data: any
  } | null>(null)

  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const handleToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

  // Monthly Grid Generation
  // Day 0 in JS is Sunday, Day 1 is Monday. We map to Monday = 0, Sunday = 6.
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1
  if (startingDayOfWeek === -1) startingDayOfWeek = 6 // Sunday becomes index 6

  // Total grid slots (leading blanks + month days)
  const calendarCells: Array<{ dayNumber: number | null; dateStr: string }> = []
  
  // Previous month trailing days
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarCells.push({ dayNumber: null, dateStr: '' })
  }

  // Active month days
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(currentMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const dateStr = `${currentYear}-${mm}-${dd}`
    calendarCells.push({ dayNumber: day, dateStr })
  }

  // Format currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Filter Items
  const filteredEndorsements = initialEndorsements.filter((e) => {
    if (!showEndorsements) return false
    if (selectedOutlet && e.outletId !== selectedOutlet) return false
    return true
  })

  const filteredAds = initialAds.filter((a) => {
    if (!showAds) return false
    if (selectedOutlet && a.outletId !== selectedOutlet) return false
    return true
  })

  const filteredPromos = initialPromoEvents.filter((p) => {
    if (!showPromos) return false
    if (selectedOutlet && p.outletId && p.outletId !== selectedOutlet) return false
    return true
  })

  // Handlers for Add Form
  const handleCreateAgenda = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      let res: any
      if (addCategory === 'endorsement') {
        res = await createEndorsement({}, formData)
      } else if (addCategory === 'ad') {
        res = await createAd({}, formData)
      } else {
        res = await createPromoEvent({}, formData)
      }

      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsAddOpen(false)
      }
    })
  }

  const handleDeleteItem = async () => {
    if (!detailItem) return
    setErrorMessage('')

    startTransition(async () => {
      let res: any
      if (detailItem.type === 'endorsement') {
        res = await deleteEndorsement(detailItem.data.id)
      } else if (detailItem.type === 'ad') {
        res = await deleteAd(detailItem.data.id)
      } else {
        res = await deletePromoEvent(detailItem.data.id)
      }

      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setDetailItem(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Marketing & Campaign Schedule</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Kalender Marcom Suka Shawarma
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Visibilitas terpusat untuk jadwal visit KOL, periode kampanye ads mitra, serta event & promo di seluruh cabang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setErrorMessage('')
              setAddDate(new Date().toISOString().split('T')[0])
              setIsAddOpen(true)
            }}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Agenda Baru</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Month Switcher & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Month Selector Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handlePrevMonth}
            aria-label="Bulan Sebelumnya"
            className="p-2 rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] text-stone-700 hover:bg-white hover:border-[#D9480F] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h2 className="text-base sm:text-lg font-extrabold text-[#1A1715] min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>

          <button
            onClick={handleNextMonth}
            aria-label="Bulan Berikutnya"
            className="p-2 rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] text-stone-700 hover:bg-white hover:border-[#D9480F] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] hover:bg-white text-xs font-bold text-stone-700 transition-colors cursor-pointer"
          >
            Hari Ini
          </button>
        </div>

        {/* Filters: Category Toggles & Outlet Picker */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Outlet Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-400" />
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
            >
              <option value="">Semua Cabang Outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Chips Checkboxes */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {/* Endorsement Toggle */}
            <button
              onClick={() => setShowEndorsements(!showEndorsements)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                showEndorsements
                  ? 'bg-[#FFF4ED] text-[#D9480F] border-[#D9480F]/30 font-bold'
                  : 'bg-stone-50 text-stone-400 border-stone-200 line-through opacity-60'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>KOL ({filteredEndorsements.length})</span>
            </button>

            {/* Ads Toggle */}
            <button
              onClick={() => setShowAds(!showAds)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                showAds
                  ? 'bg-stone-100 text-stone-800 border-stone-300 font-bold'
                  : 'bg-stone-50 text-stone-400 border-stone-200 line-through opacity-60'
              }`}
            >
              <Megaphone className="w-3 h-3" />
              <span>Ads ({filteredAds.length})</span>
            </button>

            {/* Promo Toggle */}
            <button
              onClick={() => setShowPromos(!showPromos)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                showPromos
                  ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                  : 'bg-stone-50 text-stone-400 border-stone-200 line-through opacity-60'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Promo/Event ({filteredPromos.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Banner if any */}
      {errorMessage && !isAddOpen && !detailItem && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Monthly Calendar Grid */}
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        {/* Day Header Row */}
        <div className="grid grid-cols-7 border-b border-[#EFE8DE] bg-[#FAF8F5] text-center text-xs font-bold text-stone-600 py-3 uppercase tracking-wider">
          {DAY_LABELS.map((dayLabel, idx) => (
            <div key={dayLabel} className={idx >= 5 ? 'text-[#D9480F]' : ''}>
              {dayLabel}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[#EFE8DE]">
          {calendarCells.map((cell, idx) => {
            if (!cell.dayNumber) {
              return (
                <div
                  key={`blank-${idx}`}
                  className="min-h-[110px] sm:min-h-[135px] bg-[#FAF8F5]/40 p-2 text-stone-300"
                />
              )
            }

            const isToday =
              today.getFullYear() === currentYear &&
              today.getMonth() === currentMonth &&
              today.getDate() === cell.dayNumber

            // Collect items for this specific date
            const dayEndorsements = filteredEndorsements.filter(
              (e) => e.scheduleDate === cell.dateStr
            )
            const dayAds = filteredAds.filter((a) => a.scheduleDate === cell.dateStr)
            const dayPromos = filteredPromos.filter(
              (p) => cell.dateStr >= p.startDate && cell.dateStr <= p.endDate
            )

            const totalAgendaToday =
              dayEndorsements.length + dayAds.length + dayPromos.length

            return (
              <div
                key={cell.dateStr}
                onClick={(e) => {
                  // Only open create modal if clicking on the cell itself, not on an item badge
                  if ((e.target as HTMLElement).closest('.agenda-badge')) return
                  setErrorMessage('')
                  setAddDate(cell.dateStr)
                  setIsAddOpen(true)
                }}
                className={`min-h-[110px] sm:min-h-[135px] p-2 sm:p-2.5 transition-colors cursor-pointer group flex flex-col justify-between ${
                  isToday ? 'bg-amber-50/30' : 'hover:bg-[#FAF8F5]/80'
                }`}
              >
                {/* Date Header */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isToday
                        ? 'bg-[#D9480F] text-white shadow-xs'
                        : 'text-stone-800 group-hover:text-[#D9480F]'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {/* Quick Add icon on hover */}
                  <span className="opacity-0 group-hover:opacity-100 text-[#D9480F] text-[10px] font-bold transition-opacity">
                    + Tambah
                  </span>
                </div>

                {/* Agenda Items List */}
                <div className="space-y-1 overflow-hidden flex-1">
                  {/* Promo Events (Spanning) */}
                  {dayPromos.map((promo) => (
                    <div
                      key={`promo-${promo.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailItem({ type: 'promo', data: promo })
                      }}
                      className="agenda-badge px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 flex items-center gap-1 truncate shadow-2xs cursor-pointer transition-colors"
                      title={`${promo.title} (${promo.outletName})`}
                    >
                      <Sparkles className="w-2.5 h-2.5 flex-shrink-0 text-amber-700" />
                      <span className="truncate">{promo.title}</span>
                    </div>
                  ))}

                  {/* KOL Endorsements */}
                  {dayEndorsements.map((endorse) => (
                    <div
                      key={`endorse-${endorse.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailItem({ type: 'endorsement', data: endorse })
                      }}
                      className="agenda-badge px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-[#FFF4ED] text-[#D9480F] border border-[#D9480F]/30 hover:bg-[#FFE8DA] flex items-center gap-1 truncate shadow-2xs cursor-pointer transition-colors"
                      title={`KOL: ${endorse.kolName} @ ${endorse.outletName}`}
                    >
                      <Video className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">
                        {endorse.kolName} ({endorse.outletName})
                      </span>
                    </div>
                  ))}

                  {/* Ads Mitra */}
                  {dayAds.map((ad) => (
                    <div
                      key={`ad-${ad.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailItem({ type: 'ad', data: ad })
                      }}
                      className="agenda-badge px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 flex items-center gap-1 truncate shadow-2xs cursor-pointer transition-colors"
                      title={`Ads: ${ad.outletName} (${formatRupiah(ad.budget)})`}
                    >
                      <Megaphone className="w-2.5 h-2.5 flex-shrink-0 text-stone-600" />
                      <span className="truncate">
                        Ads: {ad.outletName}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Date Footer Indicator */}
                {totalAgendaToday > 0 && (
                  <div className="pt-1 text-[9px] font-semibold text-stone-400">
                    {totalAgendaToday} agenda
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal: Tambah Agenda Baru (Tabbed) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <div>
                <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-[#D9480F]" />
                  <span>Tambah Agenda Marcom</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Tanggal dipilih: <span className="font-bold text-[#1A1715]">{addDate}</span>
                </p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Selector Tabs */}
            <div className="grid grid-cols-3 p-2 bg-[#FAF8F5] border-b border-[#EFE8DE] text-xs font-bold text-center gap-1">
              <button
                type="button"
                onClick={() => setAddCategory('endorsement')}
                className={`py-2 rounded-xl transition-all cursor-pointer ${
                  addCategory === 'endorsement'
                    ? 'bg-[#D9480F] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Endorsement KOL
              </button>
              <button
                type="button"
                onClick={() => setAddCategory('ad')}
                className={`py-2 rounded-xl transition-all cursor-pointer ${
                  addCategory === 'ad'
                    ? 'bg-[#1A1715] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Ads Mitra
              </button>
              <button
                type="button"
                onClick={() => setAddCategory('promo')}
                className={`py-2 rounded-xl transition-all cursor-pointer ${
                  addCategory === 'promo'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Promo / Event
              </button>
            </div>

            {/* Dynamic Form based on Category */}
            <form onSubmit={handleCreateAgenda} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* TAB 1: ENDORSEMENT FORM */}
              {addCategory === 'endorsement' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Pilih KOL / Influencer *
                      </label>
                      <select
                        name="kolId"
                        required
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      >
                        <option value="">-- Pilih KOL --</option>
                        {kols.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Cabang Outlet *
                      </label>
                      <select
                        name="outletId"
                        required
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      >
                        <option value="">-- Pilih Outlet --</option>
                        {outlets.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Tanggal Visit *
                      </label>
                      <input
                        name="scheduleDate"
                        type="date"
                        required
                        defaultValue={addDate}
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Rate Card (Rp)
                      </label>
                      <input
                        name="rateCard"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="Contoh: 500000"
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Link URL Konten (TikTok / Reels)
                    </label>
                    <input
                      name="postUrl"
                      type="url"
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>
                </>
              )}

              {/* TAB 2: ADS MITRA FORM */}
              {addCategory === 'ad' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Cabang Outlet *
                    </label>
                    <select
                      name="outletId"
                      required
                      className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    >
                      <option value="">-- Pilih Outlet --</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Tanggal Mulai Ads *
                      </label>
                      <input
                        name="scheduleDate"
                        type="date"
                        required
                        defaultValue={addDate}
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Budget Iklan (Rp) *
                      </label>
                      <input
                        name="budget"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="Contoh: 1500000"
                        required
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Status Ads
                    </label>
                    <select
                      name="status"
                      defaultValue="ON"
                      className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    >
                      <option value="ON">ON (Aktif Berjalan)</option>
                      <option value="OFF">OFF (Selesai)</option>
                      <option value="PAUSED">PAUSED (Jeda)</option>
                    </select>
                  </div>
                </>
              )}

              {/* TAB 3: PROMO / EVENT FORM */}
              {addCategory === 'promo' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Nama Event / Promo *
                    </label>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="Contoh: Promo Gajian Payday Diskon 20%"
                      className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Tanggal Mulai *
                      </label>
                      <input
                        name="startDate"
                        type="date"
                        required
                        defaultValue={addDate}
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Tanggal Selesai *
                      </label>
                      <input
                        name="endDate"
                        type="date"
                        required
                        defaultValue={addDate}
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Jangkauan Cabang
                      </label>
                      <select
                        name="outletId"
                        defaultValue="ALL"
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      >
                        <option value="ALL">Semua Cabang (Nasional)</option>
                        {outlets.map((o) => (
                          <option key={o.id} value={o.id}>
                            Khusus Cabang: {o.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Kategori Event
                      </label>
                      <select
                        name="type"
                        defaultValue="PROMO"
                        className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                      >
                        <option value="PROMO">Promo Diskon / Bundling</option>
                        <option value="GRAND_OPENING">Grand Opening Cabang</option>
                        <option value="EVENT">Event / Festival Kuliner</option>
                        <option value="BAZAAR">Bazaar / Booth Luar</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Catatan / Keterangan Tambahan
                    </label>
                    <textarea
                      name="description"
                      rows={2}
                      placeholder="Syarat ketentuan atau instruksi khusus tim..."
                      className="w-full px-4 py-2 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pop-up Detail Agenda */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-md w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header with Type Icon */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                    detailItem.type === 'endorsement'
                      ? 'bg-[#FFF4ED] text-[#D9480F]'
                      : detailItem.type === 'ad'
                      ? 'bg-stone-100 text-stone-800'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {detailItem.type === 'endorsement' ? (
                    <Video className="w-5 h-5" />
                  ) : detailItem.type === 'ad' ? (
                    <Megaphone className="w-5 h-5" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    {detailItem.type === 'endorsement'
                      ? 'Endorsement KOL'
                      : detailItem.type === 'ad'
                      ? 'Ads Mitra'
                      : 'Promo / Event'}
                  </span>
                  <h3 className="font-extrabold text-[#1A1715] text-base leading-tight">
                    {detailItem.type === 'endorsement'
                      ? detailItem.data.kolName
                      : detailItem.type === 'ad'
                      ? `Ads: ${detailItem.data.outletName}`
                      : detailItem.data.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setDetailItem(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="space-y-2.5 text-xs text-stone-600 bg-[#FAF8F5] p-4 rounded-2xl border border-[#EFE8DE]">
              {/* Outlet */}
              <div className="flex justify-between items-center">
                <span className="text-stone-400 font-medium">Cabang Outlet:</span>
                <span className="font-bold text-[#1A1715]">
                  {detailItem.data.outletName}
                </span>
              </div>

              {/* Tanggal */}
              <div className="flex justify-between items-center">
                <span className="text-stone-400 font-medium">Jadwal Tanggal:</span>
                <span className="font-mono font-semibold text-stone-800">
                  {detailItem.type === 'promo'
                    ? `${detailItem.data.startDate} s/d ${detailItem.data.endDate}`
                    : detailItem.data.scheduleDate}
                </span>
              </div>

              {/* Endorsement Specifics */}
              {detailItem.type === 'endorsement' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400 font-medium">Rate Card:</span>
                    <span className="font-mono font-bold text-[#1A1715]">
                      {formatRupiah(detailItem.data.rateCard)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400 font-medium">Status Visit:</span>
                    <span className="font-bold px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {detailItem.data.visitStatus}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400 font-medium">Status Tayang:</span>
                    <span className="font-bold px-2 py-0.5 rounded-md text-[10px] bg-[#FFF4ED] text-[#D9480F] border border-[#D9480F]/30">
                      Post: {detailItem.data.postStatus}
                    </span>
                  </div>
                  {detailItem.data.postUrl && (
                    <div className="flex justify-between items-center pt-1 border-t border-[#EFE8DE]">
                      <span className="text-stone-400 font-medium">Link Konten:</span>
                      <a
                        href={detailItem.data.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D9480F] font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <span>Buka Video</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </>
              )}

              {/* Ads Specifics */}
              {detailItem.type === 'ad' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400 font-medium">Budget Iklan:</span>
                    <span className="font-mono font-bold text-[#1A1715]">
                      {formatRupiah(detailItem.data.budget)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400 font-medium">Status Iklan:</span>
                    <span className="font-bold px-2 py-0.5 rounded-md text-[10px] bg-stone-100 text-stone-800 border border-stone-300">
                      {detailItem.data.status}
                    </span>
                  </div>
                </>
              )}

              {/* Promo Specifics */}
              {detailItem.type === 'promo' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400 font-medium">Tipe Promo:</span>
                    <span className="font-bold px-2 py-0.5 rounded-md text-[10px] bg-amber-100 text-amber-900 border border-amber-300">
                      {detailItem.data.type}
                    </span>
                  </div>
                  {detailItem.data.description && (
                    <div className="pt-2 border-t border-[#EFE8DE]">
                      <span className="text-stone-400 font-medium block mb-1">Keterangan:</span>
                      <p className="text-stone-700 italic">{detailItem.data.description}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              {userRole === 'ADMIN' ? (
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isPending ? 'Menghapus...' : 'Hapus Agenda'}</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
