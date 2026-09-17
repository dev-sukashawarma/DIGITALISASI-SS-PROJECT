'use client'

import { useState, useTransition, useMemo } from 'react'
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
  Zap,
  Building,
  Store,
  CheckCircle2,
  Percent,
} from 'lucide-react'
import { createAd, updateAd, updateAdStatus, deleteAd } from '@/app/actions/ads'

export interface SerializedAd {
  id: string
  outletId: string | null
  category: string
  platform: string
  accountName: string | null
  scheduleDate: string
  budget: number
  spent: number
  adUrl: string | null
  initialViews: number | null
  finalViews: number | null
  status: string
  createdAt: string
  outlet: {
    id: string
    name: string
  } | null
}

interface AdsListProps {
  initialAds: SerializedAd[]
  outlets: Array<{ id: string; name: string; type?: string }>
  userRole: string
}

const AD_STATUSES = ['OFF', 'ON', 'PAUSED']

export default function AdsList({ initialAds, outlets, userRole }: AdsListProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'INTERNAL' | 'MITRA'>('ALL')
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [outletFilter, setOutletFilter] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingAd, setEditingAd] = useState<SerializedAd | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedAd | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  // Filter ads
  const filtered = useMemo(() => {
    return initialAds.filter((item) => {
      const q = search.toLowerCase().trim()
      const account = (item.accountName || item.outlet?.name || '').toLowerCase()
      const matchesSearch = !q || account.includes(q) || (item.adUrl && item.adUrl.toLowerCase().includes(q))

      const matchesTab = activeTab === 'ALL' || item.category === activeTab
      const matchesPlatform = platformFilter === 'ALL' || item.platform === platformFilter
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchesOutlet = !outletFilter || item.outletId === outletFilter

      return matchesSearch && matchesTab && matchesPlatform && matchesStatus && matchesOutlet
    })
  }, [initialAds, search, activeTab, platformFilter, statusFilter, outletFilter])

  // Summary statistics
  const totalBudget = filtered.reduce((acc, curr) => acc + (curr.budget || 0), 0)
  const totalSpent = filtered.reduce((acc, curr) => acc + (curr.spent || 0), 0)
  const remainingBudget = totalBudget - totalSpent
  const totalViews = filtered.reduce(
    (acc, curr) => acc + (curr.finalViews || curr.initialViews || 0),
    0
  )
  const avgCpv = totalViews > 0 && totalSpent > 0 ? totalSpent / totalViews : 0
  const activeAdsCount = filtered.filter((i) => i.status === 'ON').length

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val)
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Paid Traffic & Video Booster</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Ads & Paid Traffic (Internal & Mitra)
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Monitoring pengeluaran iklan TikTok Ads & Instagram Ads untuk akun official pusat dan cabang kemitraan.
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
          <span>Tambah Kampanye Ads</span>
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#EFE8DE]/60 rounded-2xl w-fit border border-[#EFE8DE]">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-white text-[#1A1715] shadow-xs'
              : 'text-stone-600 hover:text-[#1A1715]'
          }`}
        >
          <span>Semua Akun & Cabang</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
            {initialAds.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('INTERNAL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'INTERNAL'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'text-stone-600 hover:text-[#1A1715]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Ads Internal / Official</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono">
            {initialAds.filter((i) => i.category === 'INTERNAL').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MITRA')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'MITRA'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-stone-600 hover:text-[#1A1715]'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Ads Mitra</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono">
            {initialAds.filter((i) => i.category === 'MITRA').length}
          </span>
        </button>
      </div>

      {/* KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Spent */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Realisasi Spent
            </div>
            <div className="text-xl font-extrabold font-mono text-[#D9480F]">
              {formatRupiah(totalSpent)}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              Target Budget: {formatRupiah(totalBudget)}
            </div>
          </div>
        </div>

        {/* Total Views */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Total Views Didapat
            </div>
            <div className="text-xl font-extrabold font-mono text-[#1A1715]">
              {totalViews.toLocaleString('id-ID')}{' '}
              <span className="text-xs text-stone-400 font-sans">views</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              {activeAdsCount} iklan aktif
            </div>
          </div>
        </div>

        {/* Cost Per View (CPV) */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-stone-400 font-bold uppercase tracking-wider">
              Efisiensi Rata-rata CPV
            </div>
            <div className="text-xl font-extrabold font-mono text-[#1A1715]">
              {avgCpv > 0 ? `${formatRupiah(avgCpv)} / view` : 'Belum ada'}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              {avgCpv > 0 && avgCpv < 50 ? 'Efisiensi Sangat Baik (< Rp 50)' : 'Biaya per view video iklan'}
            </div>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              remainingBudget >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              Sisa Budget Alokasi
            </div>
            <div
              className={`text-xl font-extrabold font-mono ${
                remainingBudget >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatRupiah(remainingBudget)}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              {remainingBudget >= 0 ? 'Tersedia untuk boosting' : 'Melebihi budget'}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#EFE8DE] shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari akun, outlet, URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none"
            />
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none font-medium text-stone-700"
          >
            <option value="ALL">Semua Platform</option>
            <option value="TIKTOK">TikTok Ads</option>
            <option value="INSTAGRAM">Instagram Ads</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none font-medium text-stone-700"
          >
            <option value="ALL">Semua Status</option>
            <option value="ON">Iklan Aktif (ON)</option>
            <option value="OFF">Iklan Mati (OFF)</option>
          </select>

          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#EFE8DE] rounded-xl focus:outline-none font-medium text-stone-700"
          >
            <option value="">Semua Outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ads Table */}
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs sm:text-sm text-stone-600">
            <thead className="bg-[#FAF8F5] text-stone-500 font-bold uppercase tracking-wider text-[11px] border-b border-[#EFE8DE] sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-4 px-4 sm:px-6 whitespace-nowrap">Akun & Kategori</th>
                <th className="py-4 px-4 whitespace-nowrap">Platform</th>
                <th className="py-4 px-4 whitespace-nowrap">Tanggal Kampanye</th>
                <th className="py-4 px-4 text-right whitespace-nowrap">Ad Spend (Spent)</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">Link Video Iklan</th>
                <th className="py-4 px-4 text-right whitespace-nowrap">Views Awal</th>
                <th className="py-4 px-4 text-right whitespace-nowrap">Views Akhir</th>
                <th className="py-4 px-4 text-right whitespace-nowrap">Net Views Gain</th>
                <th className="py-4 px-4 text-right whitespace-nowrap">CPV (Biaya/View)</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">Status</th>
                <th className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-400">
                    Tidak ada data iklan yang sesuai kriteria filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const netGain = Math.max(0, (item.finalViews || 0) - (item.initialViews || 0))
                  const cpv = netGain > 0 && item.spent > 0 ? item.spent / netGain : 0

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* Account & Category */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-extrabold text-[#1A1715]">
                          {item.accountName || item.outlet?.name || 'Akun Official'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-md font-bold uppercase ${
                              item.category === 'INTERNAL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {item.category === 'INTERNAL' ? 'Internal Pusat' : 'Mitra'}
                          </span>
                          {item.outlet && item.accountName && item.accountName !== item.outlet.name && (
                            <span className="text-[11px] text-stone-400">({item.outlet.name})</span>
                          )}
                        </div>
                      </td>

                      {/* Platform */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            item.platform === 'TIKTOK'
                              ? 'bg-black text-white'
                              : 'bg-gradient-to-r from-purple-600 to-pink-500 text-white'
                          }`}
                        >
                          {item.platform === 'TIKTOK' ? 'TikTok' : 'Instagram'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 whitespace-nowrap font-medium text-stone-800">
                        {item.scheduleDate}
                      </td>

                      {/* Spent */}
                      <td className="py-4 px-4 text-right font-mono font-black text-[#D9480F] whitespace-nowrap">
                        {formatRupiah(item.spent)}
                      </td>

                      {/* Video Link */}
                      <td className="py-4 px-4 text-center">
                        {item.adUrl ? (
                          <a
                            href={item.adUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-[#FFF4ED] hover:text-[#D9480F] text-stone-700 font-bold text-xs transition-colors"
                          >
                            <span>Buka Video</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-stone-300 text-xs italic">Belum ada URL</span>
                        )}
                      </td>

                      {/* Initial Views */}
                      <td className="py-4 px-4 text-right font-mono text-stone-500">
                        {item.initialViews ? item.initialViews.toLocaleString('id-ID') : '-'}
                      </td>

                      {/* Final Views */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-stone-900">
                        {item.finalViews ? item.finalViews.toLocaleString('id-ID') : '-'}
                      </td>

                      {/* Net Gain */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-700">
                        {netGain > 0 ? `+${netGain.toLocaleString('id-ID')}` : '-'}
                      </td>

                      {/* CPV */}
                      <td className="py-4 px-4 text-right font-mono text-stone-700">
                        {cpv > 0 ? `${formatRupiah(cpv)}` : '-'}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <select
                          value={item.status}
                          onChange={(e) => handleQuickStatus(item.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                            item.status === 'ON'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}
                        >
                          <option value="ON">ON</option>
                          <option value="OFF">OFF</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => {
                              setErrorMessage('')
                              setEditingAd(item)
                            }}
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Iklan"
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
                              title="Hapus Iklan"
                            >
                              <Trash2 className="w-4 h-4" />
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
      </div>

      {/* MODAL: TAMBAH ADS */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1715] text-base sm:text-lg">
                    Tambah Kampanye Ads
                  </h3>
                  <p className="text-xs text-stone-500">Catat kampanye iklan berbayar TikTok / Instagram.</p>
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
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Kategori Akun *
                  </label>
                  <select
                    name="category"
                    defaultValue="INTERNAL"
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  >
                    <option value="INTERNAL">Internal / Official</option>
                    <option value="MITRA">Cabang Mitra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Platform Iklan *
                  </label>
                  <select
                    name="platform"
                    defaultValue="TIKTOK"
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  >
                    <option value="TIKTOK">TikTok Ads</option>
                    <option value="INSTAGRAM">Instagram Ads</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nama Akun / Kampanye *
                </label>
                <input
                  name="accountName"
                  placeholder="e.g. OFC TIKTOK / CABANG PEKAYON"
                  required
                  className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Rujukan Cabang Outlet (Opsional)
                </label>
                <select
                  name="outletId"
                  className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                >
                  <option value="">-- Akun Official / Tanpa Cabang Khusus --</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Tanggal Iklan *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Ad Spend Aktual (Spent Rp) *
                  </label>
                  <input
                    name="spent"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="e.g. 277500"
                    required
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Link Video Konten yang Diiklankan
                </label>
                <input
                  name="adUrl"
                  type="url"
                  placeholder="https://vt.tiktok.com/..."
                  className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Rate Video Awal (Views Mulai)
                  </label>
                  <input
                    name="initialViews"
                    type="number"
                    min="0"
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Rate Video Akhir (Views Selesai)
                  </label>
                  <input
                    name="finalViews"
                    type="number"
                    min="0"
                    placeholder="e.g. 92500"
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Kampanye'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ADS */}
      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 border-b border-[#EFE8DE] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1A1715] text-base sm:text-lg">Edit Kampanye Ads</h3>
                  <p className="text-xs text-stone-500">Perbarui biaya, views, atau status tayang.</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAd(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-5 sm:p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Kategori Akun *
                  </label>
                  <select
                    name="category"
                    defaultValue={editingAd.category}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  >
                    <option value="INTERNAL">Internal / Official</option>
                    <option value="MITRA">Cabang Mitra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Platform Iklan *
                  </label>
                  <select
                    name="platform"
                    defaultValue={editingAd.platform}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  >
                    <option value="TIKTOK">TikTok Ads</option>
                    <option value="INSTAGRAM">Instagram Ads</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nama Akun / Kampanye *
                </label>
                <input
                  name="accountName"
                  defaultValue={editingAd.accountName || ''}
                  required
                  className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Rujukan Cabang Outlet (Opsional)
                </label>
                <select
                  name="outletId"
                  defaultValue={editingAd.outletId || ''}
                  className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                >
                  <option value="">-- Akun Official / Tanpa Cabang Khusus --</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Tanggal Iklan *
                  </label>
                  <input
                    name="scheduleDate"
                    type="date"
                    required
                    defaultValue={editingAd.scheduleDate}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Ad Spend Aktual (Spent Rp) *
                  </label>
                  <input
                    name="spent"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={editingAd.spent}
                    required
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Link Video Konten
                </label>
                <input
                  name="adUrl"
                  type="url"
                  defaultValue={editingAd.adUrl || ''}
                  placeholder="https://vt.tiktok.com/..."
                  className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Views Awal
                  </label>
                  <input
                    name="initialViews"
                    type="number"
                    min="0"
                    defaultValue={editingAd.initialViews ?? ''}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Views Akhir
                  </label>
                  <input
                    name="finalViews"
                    type="number"
                    min="0"
                    defaultValue={editingAd.finalViews ?? ''}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Status Iklan
                  </label>
                  <select
                    name="status"
                    defaultValue={editingAd.status}
                    className="w-full px-3 py-2 text-xs border border-[#EFE8DE] rounded-xl focus:outline-none"
                  >
                    <option value="ON">ON</option>
                    <option value="OFF">OFF</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setEditingAd(null)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui Kampanye'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-sm w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-[#1A1715] text-lg">Hapus Kampanye Ads?</h3>
              <p className="text-xs text-stone-500 mt-1.5">
                Apakah Anda yakin ingin menghapus data iklan untuk{' '}
                <span className="font-bold text-[#1A1715]">
                  &quot;{deleteTarget.accountName || deleteTarget.outlet?.name}&quot;
                </span>
                ?
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
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
