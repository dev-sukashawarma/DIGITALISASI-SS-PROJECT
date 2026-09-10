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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Tracking Ads Mitra Cabang</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Manajemen Iklan Digital & CPV
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Pantau alokasi budget iklan digital per outlet, performa views, serta efisiensi biaya (Cost Per View).
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
          <span>Input Ads Baru</span>
        </button>
      </div>

      {/* Summary KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Budget Ads
            </div>
            <div className="text-lg font-extrabold font-mono text-[#1A1715]">
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
              Total Views Ads
            </div>
            <div className="text-lg font-extrabold font-mono text-[#1A1715]">
              {totalViews.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Ads Aktif (ON)
            </div>
            <div className="text-lg font-extrabold text-emerald-800">
              {activeAdsCount} <span className="text-xs text-stone-500 font-normal">iklan</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center flex-shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Rata-rata CPV
            </div>
            <div className="text-lg font-extrabold font-mono text-[#1A1715]">
              {avgCpv > 0 ? `Rp ${avgCpv.toFixed(1)}` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingAd && !deleteTarget && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Cabang atau URL Iklan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
            />
          </div>

          {/* Filter Outlet */}
          <div>
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
            >
              <option value="">Semua Cabang Outlet</option>
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
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
            >
              <option value="">Semua Status Ads</option>
              <option value="ON">Status: ON (Berjalan)</option>
              <option value="OFF">Status: OFF (Selesai)</option>
              <option value="PAUSED">Status: PAUSED (Jeda)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-stone-500 font-medium pt-2 border-t border-[#EFE8DE]">
          <span>
            Ditemukan <span className="font-bold text-[#1A1715]">{filtered.length}</span> campaign ads
          </span>
          {(search || outletFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearch('')
                setOutletFilter('')
                setStatusFilter('')
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
                <th className="px-5 py-4">Cabang Outlet</th>
                <th className="px-5 py-4">Budget Iklan</th>
                <th className="px-5 py-4 text-center">Status Ads</th>
                <th className="px-5 py-4">Tautan Iklan</th>
                <th className="px-5 py-4">Views (Awal → Akhir)</th>
                <th className="px-5 py-4">Biaya / View (CPV)</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-stone-400">
                    <Megaphone className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-700">Belum ada campaign ads mitra yang cocok.</p>
                    <p className="text-xs mt-1">Klik &apos;Input Ads Baru&apos; untuk mulai mencatat alokasi iklan.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const viewsAchieved = item.finalViews || item.initialViews || 0
                  const cpv = viewsAchieved > 0 ? item.budget / viewsAchieved : null

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

                      {/* Outlet */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 text-stone-800 border border-stone-200">
                          {item.outlet.name}
                        </span>
                      </td>

                      {/* Budget */}
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-bold text-[#1A1715]">
                        {formatRupiah(item.budget)}
                      </td>

                      {/* Status Ads */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <select
                          value={item.status}
                          onChange={(e) => handleQuickStatus(item.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none transition-colors ${
                            item.status === 'ON'
                              ? 'bg-[#FFF4ED] text-[#D9480F] border-[#D9480F]/30'
                              : item.status === 'PAUSED'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-stone-100 text-stone-600 border-stone-300'
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
                            className="inline-flex items-center gap-1 text-[#D9480F] font-semibold hover:underline truncate"
                          >
                            <span className="truncate">{item.adUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-stone-400 italic">Belum ada link</span>
                        )}
                      </td>

                      {/* Views */}
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {item.initialViews !== null || item.finalViews !== null ? (
                          <div className="font-mono text-stone-800">
                            <span className="text-stone-400">{item.initialViews?.toLocaleString('id-ID') || 0}</span>
                            {' → '}
                            <span className="font-bold text-[#1A1715]">{item.finalViews?.toLocaleString('id-ID') || '-'}</span>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">-</span>
                        )}
                      </td>

                      {/* CPV */}
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs">
                        {cpv !== null ? (
                          <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                            Rp {cpv.toFixed(1)} <span className="text-[10px] text-stone-500 font-normal">/view</span>
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setErrorMessage('')
                            setEditingAd(item)
                          }}
                          className="inline-flex items-center p-2 text-stone-400 hover:text-[#D9480F] hover:bg-[#FFF4ED] rounded-lg transition-colors cursor-pointer"
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
                            className="inline-flex items-center p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#D9480F]" />
                Input Data Ads Mitra Baru
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
                    Tanggal Jadwal Ads *
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
                  defaultValue="OFF"
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                >
                  {AD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Link / URL Iklan
                </label>
                <input
                  name="adUrl"
                  type="url"
                  placeholder="https://..."
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
                    placeholder="Contoh: 0"
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
                    placeholder="Contoh: 50000"
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
                  {isPending ? 'Menyimpan...' : 'Simpan Ads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Ad */}
      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#D9480F]" />
                Edit Data Ads
              </h3>
              <button
                onClick={() => setEditingAd(null)}
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

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Cabang Outlet *
                </label>
                <select
                  name="outletId"
                  required
                  defaultValue={editingAd.outletId}
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
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
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tanggal Jadwal Ads *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={editingAd.scheduleDate}
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
                    defaultValue={editingAd.budget}
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
                  defaultValue={editingAd.status}
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                >
                  {AD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Link / URL Iklan
                </label>
                <input
                  name="adUrl"
                  type="url"
                  defaultValue={editingAd.adUrl || ''}
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
                    defaultValue={editingAd.initialViews ?? ''}
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
                    defaultValue={editingAd.finalViews ?? ''}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setEditingAd(null)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-[#1A1715] text-lg">Hapus Data Ads?</h3>
              <p className="text-xs text-stone-500 mt-1.5">
                Apakah Anda yakin ingin menghapus campaign ads untuk cabang{' '}
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
