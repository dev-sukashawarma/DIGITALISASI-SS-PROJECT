'use client'

import { useState, useTransition } from 'react'
import {
  Video,
  Plus,
  Search,
  Filter,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Eye,
  TrendingUp,
  DollarSign,
  Calendar,
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
  scheduleDate: string // YYYY-MM-DD
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Video className="w-7 h-7 text-orange-500" />
            Tracking Endorsement KOL
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitoring jadwal visit influencer, status posting konten, rate card, dan pertumbuhan views.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage('')
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Jadwalkan Endorsement</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Total Pengeluaran</div>
            <div className="text-lg font-bold text-slate-900">{formatRupiah(totalBudget)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Total Views Terkumpul</div>
            <div className="text-lg font-bold text-slate-900">{totalViews.toLocaleString('id-ID')} views</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Konten Tayang (ON)</div>
            <div className="text-lg font-bold text-emerald-700">{activeCount} Konten</div>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingEndorsement && !deleteTarget && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari KOL atau Cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Filter Outlet */}
          <div>
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            >
              <option value="">Semua Status Tayang (Post)</option>
              <option value="ON">Tayang: ON</option>
              <option value="OFF">Tayang: OFF</option>
              <option value="TAKE_DOWN">Tayang: TAKE_DOWN</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1 border-t border-slate-100">
          <span>
            Ditemukan <span className="font-bold text-slate-800">{filtered.length}</span> data endorsement
          </span>
          {(search || outletFilter || visitFilter || postFilter) && (
            <button
              onClick={() => {
                setSearch('')
                setOutletFilter('')
                setVisitFilter('')
                setPostFilter('')
              }}
              className="text-orange-600 hover:underline font-semibold"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">KOL / Akun</th>
                <th className="px-5 py-3.5">Outlet Cabang</th>
                <th className="px-5 py-3.5">Rate Card</th>
                <th className="px-5 py-3.5 text-center">Status Visit</th>
                <th className="px-5 py-3.5 text-center">Status Post</th>
                <th className="px-5 py-3.5">Link Konten</th>
                <th className="px-5 py-3.5">Views (Awal / Akhir)</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <Video className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">Belum ada endorsement yang cocok dengan kriteria.</p>
                    <p className="text-xs mt-1">Klik &apos;Jadwalkan Endorsement&apos; untuk mulai mencatat.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const viewsDiff =
                    item.finalViews !== null && item.initialViews !== null
                      ? item.finalViews - item.initialViews
                      : null

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Tanggal */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
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
                        <div className="font-semibold text-slate-900">{item.kol.name}</div>
                        {item.kol.phoneNumber && (
                          <div className="text-[11px] text-slate-400">{item.kol.phoneNumber}</div>
                        )}
                      </td>

                      {/* Outlet */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {item.outlet.name}
                        </span>
                      </td>

                      {/* Rate Card */}
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-900">
                        {formatRupiah(item.rateCard)}
                      </td>

                      {/* Visit Status */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <select
                          value={item.visitStatus}
                          onChange={(e) =>
                            handleQuickStatus(item.id, e.target.value, item.postStatus)
                          }
                          className={`text-xs font-bold px-2 py-1 rounded-md border cursor-pointer focus:outline-none ${
                            item.visitStatus === 'VISITED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.visitStatus === 'CANCELED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
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
                          className={`text-xs font-bold px-2 py-1 rounded-md border cursor-pointer focus:outline-none ${
                            item.postStatus === 'ON'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.postStatus === 'TAKE_DOWN'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
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
                            className="inline-flex items-center gap-1 text-orange-600 hover:underline truncate"
                          >
                            <span className="truncate">{item.postUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Belum ada</span>
                        )}
                      </td>

                      {/* Views */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {item.initialViews !== null || item.finalViews !== null ? (
                          <div>
                            <div className="font-mono text-slate-800">
                              <span className="text-slate-400">{item.initialViews?.toLocaleString('id-ID') || 0}</span>
                              {' → '}
                              <span className="font-bold">{item.finalViews?.toLocaleString('id-ID') || '-'}</span>
                            </div>
                            {viewsDiff !== null && (
                              <div
                                className={`text-[10px] font-semibold mt-0.5 ${
                                  viewsDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {viewsDiff >= 0 ? `+${viewsDiff.toLocaleString('id-ID')}` : viewsDiff.toLocaleString('id-ID')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setErrorMessage('')
                            setEditingEndorsement(item)
                          }}
                          className="inline-flex items-center p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
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
                            className="inline-flex items-center p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Video className="w-5 h-5 text-orange-500" />
                Catat Jadwal Endorsement Baru
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* KOL Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pilih KOL / Influencer *
                  </label>
                  <select
                    name="kolId"
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="">-- Pilih KOL --</option>
                    {kols.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Outlet Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cabang Outlet Dituju *
                  </label>
                  <select
                    name="outletId"
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                {/* Schedule Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal Visit *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                {/* Rate Card */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rate Card / Biaya (Rp)
                  </label>
                  <input
                    name="rateCard"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Contoh: 500000"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Status Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status Visit
                  </label>
                  <select
                    name="visitStatus"
                    defaultValue="PENDING"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {VISIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status Tayang (Post)
                  </label>
                  <select
                    name="postStatus"
                    defaultValue="OFF"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {POST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Post URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Link URL Konten (TikTok / Reels IG)
                </label>
                <input
                  name="postUrl"
                  type="url"
                  placeholder="https://vt.tiktok.com/... atau https://www.instagram.com/reel/..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* Views Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Initial Views (Views Awal)
                  </label>
                  <input
                    name="initialViews"
                    type="number"
                    min="0"
                    placeholder="Contoh: 1500"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Final Views (Views Akhir)
                  </label>
                  <input
                    name="finalViews"
                    type="number"
                    min="0"
                    placeholder="Contoh: 25000"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-orange-500" />
                Edit Endorsement
              </h3>
              <button
                onClick={() => setEditingEndorsement(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pilih KOL / Influencer *
                  </label>
                  <select
                    name="kolId"
                    required
                    defaultValue={editingEndorsement.kolId}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {kols.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cabang Outlet Dituju *
                  </label>
                  <select
                    name="outletId"
                    required
                    defaultValue={editingEndorsement.outletId}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal Visit *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={editingEndorsement.scheduleDate}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rate Card / Biaya (Rp)
                  </label>
                  <input
                    name="rateCard"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={editingEndorsement.rateCard}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status Visit
                  </label>
                  <select
                    name="visitStatus"
                    defaultValue={editingEndorsement.visitStatus}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {VISIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status Tayang (Post)
                  </label>
                  <select
                    name="postStatus"
                    defaultValue={editingEndorsement.postStatus}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Link URL Konten
                </label>
                <input
                  name="postUrl"
                  type="url"
                  defaultValue={editingEndorsement.postUrl || ''}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Initial Views
                  </label>
                  <input
                    name="initialViews"
                    type="number"
                    min="0"
                    defaultValue={editingEndorsement.initialViews ?? ''}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Final Views
                  </label>
                  <input
                    name="finalViews"
                    type="number"
                    min="0"
                    defaultValue={editingEndorsement.finalViews ?? ''}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEndorsement(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-lg">Hapus Endorsement?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus data endorsement untuk{' '}
                <span className="font-bold text-slate-800">&quot;{deleteTarget.kol.name}&quot;</span> di{' '}
                <span className="font-bold text-slate-800">&quot;{deleteTarget.outlet.name}&quot;</span>?
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
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
