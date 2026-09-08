'use client'

import { useState, useTransition } from 'react'
import {
  Megaphone,
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
  Percent,
} from 'lucide-react'
import { createAd, updateAd, updateAdStatus, deleteAd } from '@/app/actions/ads'

export interface SerializedAd {
  id: string
  outletId: string
  scheduleDate: string
  budget: number
  adUrl: string | null
  initialViews: number | null
  finalViews: number | null
  status: string
  createdAt: string
  outlet: {
    id: string
    name: string
  }
}

interface AdsListProps {
  initialAds: SerializedAd[]
  outlets: Array<{ id: string; name: string }>
  userRole: string
}

const AD_STATUSES = ['OFF', 'ON', 'PAUSED']

export default function AdsList({ initialAds, outlets, userRole }: AdsListProps) {
  const [search, setSearch] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingAd, setEditingAd] = useState<SerializedAd | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedAd | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Filter ads
  const filtered = initialAds.filter((item) => {
    const matchesSearch =
      item.outlet.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.adUrl && item.adUrl.toLowerCase().includes(search.toLowerCase()))

    const matchesOutlet = outletFilter ? item.outletId === outletFilter : true
    const matchesStatus = statusFilter ? item.status === statusFilter : true

    return matchesSearch && matchesOutlet && matchesStatus
  })

  // Summary statistics
  const totalBudget = filtered.reduce((acc, curr) => acc + (curr.budget || 0), 0)
  const totalViews = filtered.reduce(
    (acc, curr) => acc + (curr.finalViews || curr.initialViews || 0),
    0
  )
  const avgCpv = totalViews > 0 ? totalBudget / totalViews : 0
  const activeAdsCount = filtered.filter((i) => i.status === 'ON').length

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createAd({}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsCreateOpen(false)
      }
    })
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingAd) return
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateAd(editingAd.id, {}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setEditingAd(null)
      }
    })
  }

  const handleQuickStatus = async (id: string, newStatus: string) => {
    startTransition(async () => {
      const res = await updateAdStatus(id, newStatus)
      if (res?.error) {
        setErrorMessage(res.error)
      }
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setErrorMessage('')

    startTransition(async () => {
      const res = await deleteAd(deleteTarget.id)
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
            <Megaphone className="w-7 h-7 text-orange-500" />
            Tracking Ads Mitra Cabang
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau alokasi budget iklan digital per outlet, performa views, serta efisiensi biaya (CPV).
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
          <span>Input Ads Baru</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Total Budget Ads</div>
            <div className="text-lg font-bold text-slate-900">{formatRupiah(totalBudget)}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Total Views Ads</div>
            <div className="text-lg font-bold text-slate-900">{totalViews.toLocaleString('id-ID')} views</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Ads Aktif (ON)</div>
            <div className="text-lg font-bold text-emerald-700">{activeAdsCount} Campaign</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Rata-rata CPV</div>
            <div className="text-lg font-bold text-slate-900">
              {avgCpv > 0 ? `Rp ${avgCpv.toFixed(1)} /view` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingAd && !deleteTarget && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Cabang atau Link Ads..."
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

          {/* Filter Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            >
              <option value="">Semua Status Ads</option>
              <option value="ON">Status: ON (Berjalan)</option>
              <option value="OFF">Status: OFF (Selesai/Mati)</option>
              <option value="PAUSED">Status: PAUSED (Jeda)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1 border-t border-slate-100">
          <span>
            Ditemukan <span className="font-bold text-slate-800">{filtered.length}</span> campaign ads
          </span>
          {(search || outletFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearch('')
                setOutletFilter('')
                setStatusFilter('')
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
                <th className="px-5 py-3.5">Outlet Cabang</th>
                <th className="px-5 py-3.5">Budget Ads</th>
                <th className="px-5 py-3.5 text-center">Status Ads</th>
                <th className="px-5 py-3.5">Link Iklan / Kampanye</th>
                <th className="px-5 py-3.5">Views (Awal / Akhir)</th>
                <th className="px-5 py-3.5">Biaya / View (CPV)</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Megaphone className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">Belum ada data Ads Mitra yang tercatat.</p>
                    <p className="text-xs mt-1">Klik &apos;Input Ads Baru&apos; untuk mulai mencatat pengeluaran iklan.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const viewsAchieved = item.finalViews || item.initialViews || 0
                  const cpv = viewsAchieved > 0 ? item.budget / viewsAchieved : null

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

                      {/* Outlet */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                          {item.outlet.name}
                        </span>
                      </td>

                      {/* Budget */}
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-900">
                        {formatRupiah(item.budget)}
                      </td>

                      {/* Status Ads */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <select
                          value={item.status}
                          onChange={(e) => handleQuickStatus(item.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-md border cursor-pointer focus:outline-none ${
                            item.status === 'ON'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.status === 'PAUSED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <option value="OFF">OFF</option>
                          <option value="ON">ON</option>
                          <option value="PAUSED">PAUSED</option>
                        </select>
                      </td>

                      {/* Link Ad */}
                      <td className="px-5 py-4 max-w-[160px] truncate text-xs">
                        {item.adUrl ? (
                          <a
                            href={item.adUrl.startsWith('http') ? item.adUrl : `https://${item.adUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-purple-600 hover:underline truncate"
                          >
                            <span className="truncate">{item.adUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Belum ada link</span>
                        )}
                      </td>

                      {/* Views */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {item.initialViews !== null || item.finalViews !== null ? (
                          <div className="font-mono text-slate-800">
                            <span className="text-slate-400">{item.initialViews?.toLocaleString('id-ID') || 0}</span>
                            {' → '}
                            <span className="font-bold">{item.finalViews?.toLocaleString('id-ID') || '-'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* CPV */}
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs">
                        {cpv !== null ? (
                          <span className="font-semibold text-slate-800">
                            Rp {cpv.toFixed(1)} <span className="text-[10px] text-slate-400">/view</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setErrorMessage('')
                            setEditingAd(item)
                          }}
                          className="inline-flex items-center p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                          title="Edit Ads"
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
                            title="Hapus Ads"
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

      {/* Modal Tambah Ad */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-500" />
                Input Data Ads Mitra Baru
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cabang Outlet *
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal Ads *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Budget Iklan (Rp) *
                  </label>
                  <input
                    name="budget"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Contoh: 1500000"
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Ads
                </label>
                <select
                  name="status"
                  defaultValue="OFF"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  {AD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Link / URL Iklan
                </label>
                <input
                  name="adUrl"
                  type="url"
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
                    placeholder="Contoh: 0"
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
                    placeholder="Contoh: 50000"
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
                  {isPending ? 'Menyimpan...' : 'Simpan Ads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Ad */}
      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-orange-500" />
                Edit Data Ads
              </h3>
              <button
                onClick={() => setEditingAd(null)}
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cabang Outlet *
                </label>
                <select
                  name="outletId"
                  required
                  defaultValue={editingAd.outletId}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal Ads *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={editingAd.scheduleDate}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Budget Iklan (Rp) *
                  </label>
                  <input
                    name="budget"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={editingAd.budget}
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Ads
                </label>
                <select
                  name="status"
                  defaultValue={editingAd.status}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  {AD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Link / URL Iklan
                </label>
                <input
                  name="adUrl"
                  type="url"
                  defaultValue={editingAd.adUrl || ''}
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
                    defaultValue={editingAd.initialViews ?? ''}
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
                    defaultValue={editingAd.finalViews ?? ''}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAd(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Ads'}
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
              <h3 className="font-bold text-slate-900 text-lg">Hapus Data Ads?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus campaign ads untuk cabang{' '}
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
