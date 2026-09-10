'use client'

import { useState, useTransition } from 'react'
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
} from 'lucide-react'
import {
  createEndorsement,
  updateEndorsement,
  updateEndorsementStatus,
  deleteEndorsement,
} from '@/app/actions/endorsements'

export interface SerializedEndorsement {
  id: string
  kolId: string
  outletId: string
  scheduleDate: string
  rateCard: number
  postUrl: string | null
  initialViews: number | null
  finalViews: number | null
  visitStatus: string
  postStatus: string
  createdAt: string
  kol: {
    id: string
    name: string
    tiktokUrl: string | null
    instagramUrl: string | null
    phoneNumber: string | null
  }
  outlet: {
    id: string
    name: string
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
  const [search, setSearch] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [visitFilter, setVisitFilter] = useState('')
  const [postFilter, setPostFilter] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingEndorsement, setEditingEndorsement] = useState<SerializedEndorsement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedEndorsement | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Filter endorsements
  const filtered = initialEndorsements.filter((item) => {
    const matchesSearch =
      item.kol.name.toLowerCase().includes(search.toLowerCase()) ||
      item.outlet.name.toLowerCase().includes(search.toLowerCase())

    const matchesOutlet = outletFilter ? item.outletId === outletFilter : true
    const matchesVisit = visitFilter ? item.visitStatus === visitFilter : true
    const matchesPost = postFilter ? item.postStatus === postFilter : true

    return matchesSearch && matchesOutlet && matchesVisit && matchesPost
  })

  // Summary calculations
  const totalBudget = filtered.reduce((acc, curr) => acc + (curr.rateCard || 0), 0)
  const totalViews = filtered.reduce(
    (acc, curr) => acc + (curr.finalViews || curr.initialViews || 0),
    0
  )
  const activeCount = filtered.filter((i) => i.postStatus === 'ON').length

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
            <span>Tracking & Monitoring</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Tracking Endorsement KOL
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Pantau jadwal visit influencer, status posting konten, rate card, dan pertumbuhan views per outlet.
          </p>
        </div>

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

      {/* Summary KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Pengeluaran
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
              {totalViews.toLocaleString('id-ID')} <span className="text-xs text-stone-500 font-sans">views</span>
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
              {activeCount} <span className="text-xs text-stone-500 font-normal">konten aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingEndorsement && !deleteTarget && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

          {/* Filter Outlet */}
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

          {/* Filter Visit Status */}
          <div>
            <select
              value={visitFilter}
              onChange={(e) => setVisitFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
            >
              <option value="">Semua Status Visit</option>
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
              <option value="">Semua Status Tayang</option>
              <option value="ON">Tayang: ON</option>
              <option value="OFF">Tayang: OFF</option>
              <option value="TAKE_DOWN">Tayang: TAKE_DOWN</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-stone-500 font-medium pt-2 border-t border-[#EFE8DE]">
          <span>
            Ditemukan <span className="font-bold text-[#1A1715]">{filtered.length}</span> data endorsement
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
            <thead className="bg-[#FAF8F5] border-b border-[#EFE8DE] text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4">KOL / Akun</th>
                <th className="px-5 py-4">Cabang Outlet</th>
                <th className="px-5 py-4">Rate Card</th>
                <th className="px-5 py-4 text-center">Status Visit</th>
                <th className="px-5 py-4 text-center">Status Post</th>
                <th className="px-5 py-4">Link Konten</th>
                <th className="px-5 py-4">Views (Awal → Akhir)</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center text-stone-400">
                    <Video className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-700">Tidak ada jadwal endorsement yang cocok.</p>
                    <p className="text-xs mt-1">Klik &apos;Jadwalkan Endorsement&apos; untuk input baru.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const viewsDiff =
                    item.finalViews !== null && item.initialViews !== null
                      ? item.finalViews - item.initialViews
                      : null

                  return (
                    <tr key={item.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      {/* Tanggal */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-stone-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>
                            {new Date(item.scheduleDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* KOL */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#1A1715]">{item.kol.name}</div>
                        {item.kol.phoneNumber && (
                          <div className="text-[11px] text-stone-400 font-mono">{item.kol.phoneNumber}</div>
                        )}
                      </td>

                      {/* Outlet */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200">
                          {item.outlet.name}
                        </span>
                      </td>

                      {/* Rate Card */}
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-bold text-[#1A1715]">
                        {formatRupiah(item.rateCard)}
                      </td>

                      {/* Visit Status */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <select
                          value={item.visitStatus}
                          onChange={(e) =>
                            handleQuickStatus(item.id, e.target.value, item.postStatus)
                          }
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none transition-colors ${
                            item.visitStatus === 'VISITED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : item.visitStatus === 'CANCELED'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="VISITED">VISITED</option>
                          <option value="CANCELED">CANCELED</option>
                        </select>
                      </td>

                      {/* Post Status */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <select
                          value={item.postStatus}
                          onChange={(e) =>
                            handleQuickStatus(item.id, item.visitStatus, e.target.value)
                          }
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none transition-colors ${
                            item.postStatus === 'ON'
                              ? 'bg-[#FFF4ED] text-[#D9480F] border-[#D9480F]/30'
                              : item.postStatus === 'TAKE_DOWN'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-stone-100 text-stone-600 border-stone-300'
                          }`}
                        >
                          <option value="OFF">OFF</option>
                          <option value="ON">ON</option>
                          <option value="TAKE_DOWN">TAKE_DOWN</option>
                        </select>
                      </td>

                      {/* Post Link */}
                      <td className="px-5 py-4 max-w-[150px] truncate text-xs">
                        {item.postUrl ? (
                          <a
                            href={item.postUrl.startsWith('http') ? item.postUrl : `https://${item.postUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#D9480F] font-semibold hover:underline truncate"
                          >
                            <span className="truncate">{item.postUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-stone-400 italic">Belum ada link</span>
                        )}
                      </td>

                      {/* Views */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {item.initialViews !== null || item.finalViews !== null ? (
                          <div>
                            <div className="font-mono text-stone-800">
                              <span className="text-stone-400">{item.initialViews?.toLocaleString('id-ID') || 0}</span>
                              {' → '}
                              <span className="font-bold text-[#1A1715]">{item.finalViews?.toLocaleString('id-ID') || '-'}</span>
                            </div>
                            {viewsDiff !== null && (
                              <div
                                className={`text-[10px] font-bold mt-0.5 ${
                                  viewsDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {viewsDiff >= 0 ? `+${viewsDiff.toLocaleString('id-ID')}` : viewsDiff.toLocaleString('id-ID')} views
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setErrorMessage('')
                            setEditingEndorsement(item)
                          }}
                          className="inline-flex items-center p-2 text-stone-400 hover:text-[#D9480F] hover:bg-[#FFF4ED] rounded-lg transition-colors cursor-pointer"
                          title="Edit Endorsement"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {userRole === 'ADMIN' && (
                          <button
                            onClick={() => {
                              setErrorMessage('')
                              setDeleteTarget(item)
                            }}
                            className="inline-flex items-center p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Endorsement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Endorsement */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Video className="w-5 h-5 text-[#D9480F]" />
                Jadwalkan Endorsement Baru
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

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
                    Cabang Outlet Dituju *
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Status Visit
                  </label>
                  <select
                    name="visitStatus"
                    defaultValue="PENDING"
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
                    defaultValue="OFF"
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
                  Link URL Konten (TikTok / Reels)
                </label>
                <input
                  name="postUrl"
                  type="url"
                  placeholder="https://vt.tiktok.com/... atau https://instagram.com/reel/..."
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Initial Views
                  </label>
                  <input
                    name="initialViews"
                    type="number"
                    min="0"
                    placeholder="Contoh: 1500"
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Final Views
                  </label>
                  <input
                    name="finalViews"
                    type="number"
                    min="0"
                    placeholder="Contoh: 25000"
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
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
                  {isPending ? 'Menyimpan...' : 'Simpan Endorsement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Endorsement */}
      {editingEndorsement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#D9480F]" />
                Edit Data Endorsement
              </h3>
              <button
                onClick={() => setEditingEndorsement(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Pilih KOL / Influencer *
                  </label>
                  <select
                    name="kolId"
                    required
                    defaultValue={editingEndorsement.kolId}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    {kols.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Cabang Outlet Dituju *
                  </label>
                  <select
                    name="outletId"
                    required
                    defaultValue={editingEndorsement.outletId}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal Visit *
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
                    Rate Card (Rp)
                  </label>
                  <input
                    name="rateCard"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={editingEndorsement.rateCard}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
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
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Initial Views
                  </label>
                  <input
                    name="initialViews"
                    type="number"
                    min="0"
                    defaultValue={editingEndorsement.initialViews ?? ''}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Final Views
                  </label>
                  <input
                    name="finalViews"
                    type="number"
                    min="0"
                    defaultValue={editingEndorsement.finalViews ?? ''}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
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

      {/* Modal Konfirmasi Hapus */}
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
    </div>
  )
}
