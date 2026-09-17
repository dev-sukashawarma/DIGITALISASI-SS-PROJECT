'use client'

import { useState, useTransition } from 'react'
import {
  Plus,
  Search,
  Store,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Database,
  MapPin,
  Building2,
  Phone,
  Power,
  ExternalLink,
} from 'lucide-react'
import {
  createOutlet,
  updateOutlet,
  deleteOutlet,
  toggleOutletActive,
  syncOutletsFromPosSupabase,
} from '@/app/actions/outlets'
import type { PosOutlet } from '@/lib/supabase-pos'

export interface SerializedOutlet {
  id: string
  name: string
  type: string
  posOutletId: string | null
  posName: string | null
  posType: string | null
  region: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  _count: {
    endorsements: number
    ads: number
  }
}

interface OutletListProps {
  initialOutlets: SerializedOutlet[]
  posOutlets?: PosOutlet[]
  userRole: string
}

export default function OutletList({ initialOutlets, posOutlets = [], userRole }: OutletListProps) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'INTERNAL' | 'MITRA' | 'ONLINE' | 'INACTIVE'>('ALL')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingOutlet, setEditingOutlet] = useState<SerializedOutlet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedOutlet | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSyncing, startSyncTransition] = useTransition()

  // Selected POS outlet when creating from unlinked Supabase list
  const [selectedPosId, setSelectedPosId] = useState('')

  // Calculate statistics
  const totalOutlets = initialOutlets.length
  const connectedPosCount = initialOutlets.filter((o) => !!o.posOutletId).length
  const internalCount = initialOutlets.filter((o) => o.type === 'INTERNAL' && o.posType !== 'gudang' && o.posType !== 'marketplace').length
  const mitraCount = initialOutlets.filter((o) => o.type === 'MITRA').length
  const onlineGudangCount = initialOutlets.filter((o) => o.posType === 'gudang' || o.posType === 'marketplace' || o.name.toLowerCase().includes('online') || o.name.toLowerCase().includes('gudang')).length
  const inactiveCount = initialOutlets.filter((o) => !o.isActive).length

  // Find Supabase outlets not yet linked to MARCOM
  const linkedPosIds = new Set(initialOutlets.map((o) => o.posOutletId).filter(Boolean))
  const unlinkedPosOutlets = posOutlets.filter((sb) => !linkedPosIds.has(sb.id) && sb.type !== 'system')

  // Filter outlets by search and tab
  const filteredOutlets = initialOutlets.filter((outlet) => {
    const query = search.toLowerCase()
    const matchesSearch =
      outlet.name.toLowerCase().includes(query) ||
      (outlet.posName && outlet.posName.toLowerCase().includes(query)) ||
      (outlet.region && outlet.region.toLowerCase().includes(query)) ||
      (outlet.posOutletId && outlet.posOutletId.toLowerCase().includes(query))

    if (!matchesSearch) return false

    if (activeTab === 'INTERNAL') return outlet.type === 'INTERNAL' && outlet.posType !== 'gudang' && outlet.posType !== 'marketplace' && outlet.isActive
    if (activeTab === 'MITRA') return outlet.type === 'MITRA' && outlet.isActive
    if (activeTab === 'ONLINE') return (outlet.posType === 'gudang' || outlet.posType === 'marketplace' || outlet.name.toLowerCase().includes('online') || outlet.name.toLowerCase().includes('gudang')) && outlet.isActive
    if (activeTab === 'INACTIVE') return !outlet.isActive
    return true
  })

  // Handle Sync from Supabase POS
  const handleSyncPos = () => {
    setSyncBanner(null)
    setErrorMessage('')
    startSyncTransition(async () => {
      const res = await syncOutletsFromPosSupabase()
      if (res?.error) {
        setSyncBanner({ type: 'error', message: res.error })
      } else if (res?.success && res.data) {
        setSyncBanner({
          type: 'success',
          message: `Sinkronisasi Supabase POS berhasil! ${res.data.updated} cabang diperbarui, ${res.data.created} cabang baru ditambahkan (Total: ${res.data.total} di POS).`,
        })
      }
    })
  }

  // Handle Create Outlet
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createOutlet({}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsCreateOpen(false)
        setSelectedPosId('')
      }
    })
  }

  // Handle Update Outlet
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingOutlet) return
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateOutlet(editingOutlet.id, {}, formData)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setEditingOutlet(null)
      }
    })
  }

  // Handle Toggle Active Status
  const handleToggleActive = (outlet: SerializedOutlet) => {
    startTransition(async () => {
      const res = await toggleOutletActive(outlet.id, outlet.isActive)
      if (res?.error) {
        setErrorMessage(res.error)
      }
    })
  }

  // Handle Delete Outlet
  const handleDelete = async () => {
    if (!deleteTarget) return
    setErrorMessage('')

    startTransition(async () => {
      const res = await deleteOutlet(deleteTarget.id)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setDeleteTarget(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#EFE8DE]">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D9480F] uppercase tracking-wider">
            <Store className="w-3.5 h-3.5" />
            <span>Master Data Cabang & POS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight mt-1">
            Direktori Outlet Suka Shawarma
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Terhubung langsung dengan database Supabase POS untuk visit endorsement, alokasi menu, dan kampanye ads mitra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncPos}
            disabled={isSyncing}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100/80 text-[#D9480F] border border-[#D9480F]/30 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all duration-150 cursor-pointer disabled:opacity-50"
            title="Tarik data cabang terbaru dari master tabel outlets Supabase POS"
          >
            <RefreshCw className={`w-4 h-4 text-[#D9480F] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan POS...' : 'Sinkronisasi dari Supabase POS'}</span>
          </button>

          <button
            onClick={() => {
              setErrorMessage('')
              setSelectedPosId('')
              setIsCreateOpen(true)
            }}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Outlet Baru</span>
          </button>
        </div>
      </div>

      {/* Sync Banner Notification */}
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
            className="text-stone-400 hover:text-stone-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && !isCreateOpen && !editingOutlet && !deleteTarget && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#FFF4ED] text-[#D9480F] flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Total Outlet</div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-[#1A1715]">{totalOutlets}</div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Koneksi POS</div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-700">
              {connectedPosCount} <span className="text-xs text-stone-500 font-normal">/ {totalOutlets}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Internal vs Mitra</div>
            <div className="text-sm sm:text-base font-extrabold text-stone-800">
              <span className="text-blue-700">{internalCount} Int</span> •{' '}
              <span className="text-purple-700">{mitraCount} Mitra</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#EFE8DE] shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Online & Gudang</div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-blue-800">
              {onlineGudangCount} <span className="text-xs text-stone-500 font-normal">titik</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-[#EFE8DE] shadow-2xs">
        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-[#D9480F] text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
            }`}
          >
            Semua ({totalOutlets})
          </button>
          <button
            onClick={() => setActiveTab('INTERNAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'INTERNAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
            }`}
          >
            Internal ({internalCount})
          </button>
          <button
            onClick={() => setActiveTab('MITRA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'MITRA'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
            }`}
          >
            Mitra ({mitraCount})
          </button>
          <button
            onClick={() => setActiveTab('ONLINE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'ONLINE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
            }`}
          >
            Online/Gudang ({onlineGudangCount})
          </button>
          {inactiveCount > 0 && (
            <button
              onClick={() => setActiveTab('INACTIVE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'INACTIVE'
                  ? 'bg-stone-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              Nonaktif ({inactiveCount})
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, ID POS, atau region..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-[#EFE8DE] bg-[#FAF8F5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F] transition-colors"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-[#EFE8DE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs sm:text-sm text-stone-600">
            <thead className="bg-[#FAF8F5] border-b border-[#EFE8DE] text-[11px] font-bold text-stone-500 uppercase tracking-wider sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">No</th>
                <th className="px-6 py-4 whitespace-nowrap">Nama Cabang / Outlet</th>
                <th className="px-6 py-4 whitespace-nowrap">Integrasi POS Supabase</th>
                <th className="px-6 py-4 whitespace-nowrap">Tipe Cabang</th>
                <th className="px-6 py-4 whitespace-nowrap">Region</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Status Operasional</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Total Konten & Ads</th>
                <th className="px-6 py-4 text-right whitespace-nowrap sticky right-0 z-20 bg-[#FAF8F5] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE8DE]">
              {filteredOutlets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-stone-400">
                    <Store className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="font-semibold text-stone-700">Tidak ada outlet yang cocok dengan filter.</p>
                    <p className="text-xs mt-1">Coba kata kunci lain atau lakukan sinkronisasi dari Supabase POS.</p>
                  </td>
                </tr>
              ) : (
                filteredOutlets.map((outlet, index) => (
                  <tr key={outlet.id} className="group hover:bg-amber-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-stone-400">
                      {index + 1}
                    </td>

                    {/* Nama Cabang */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#1A1715] text-sm flex items-center gap-2">
                        <span>{outlet.name}</span>
                        {!outlet.isActive && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>ID #{outlet.id}</span>
                        {outlet.address && (
                          <span className="truncate max-w-[220px] text-stone-400" title={outlet.address}>
                            • {outlet.address}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Integrasi POS Supabase */}
                    <td className="px-6 py-4">
                      {outlet.posOutletId ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{outlet.posName || 'POS Linked'}</span>
                          </span>
                          <div className="text-[10px] font-mono text-stone-400 tracking-tight" title={outlet.posOutletId}>
                            UUID: {outlet.posOutletId.slice(0, 8)}...{outlet.posOutletId.slice(-4)}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-500 border border-stone-200">
                          <span>Internal MARCOM Saja</span>
                        </span>
                      )}
                    </td>

                    {/* Tipe Cabang */}
                    <td className="px-6 py-4">
                      {outlet.posType === 'gudang' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          GUDANG
                        </span>
                      ) : outlet.posType === 'marketplace' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          MARKETPLACE
                        </span>
                      ) : outlet.type === 'MITRA' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          MITRA
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          INTERNAL
                        </span>
                      )}
                    </td>

                    {/* Region */}
                    <td className="px-6 py-4">
                      {outlet.region ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                          {outlet.region}
                        </span>
                      ) : (
                        <span className="text-stone-300 text-xs">-</span>
                      )}
                    </td>

                    {/* Status Operasional (Toggle) */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(outlet)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          outlet.isActive
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-500 border border-stone-200'
                        }`}
                        title={outlet.isActive ? 'Klik untuk nonaktifkan outlet' : 'Klik untuk aktifkan outlet'}
                      >
                        <Power className={`w-3 h-3 ${outlet.isActive ? 'text-emerald-600' : 'text-stone-400'}`} />
                        <span>{outlet.isActive ? 'Aktif' : 'Nonaktif'}</span>
                      </button>
                    </td>

                    {/* Total Konten & Ads */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FFF4ED] text-[#D9480F] border border-[#D9480F]/20">
                          {outlet._count.endorsements} visit
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                          {outlet._count.ads} ads
                        </span>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap sticky right-0 z-10 bg-white group-hover:bg-amber-50/30 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                      <button
                        onClick={() => {
                          setErrorMessage('')
                          setEditingOutlet(outlet)
                        }}
                        className="inline-flex items-center p-2 text-stone-400 hover:text-[#D9480F] hover:bg-[#FFF4ED] rounded-lg transition-colors cursor-pointer"
                        title="Edit detail outlet"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => {
                            setErrorMessage('')
                            setDeleteTarget(outlet)
                          }}
                          className="inline-flex items-center p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus outlet"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Outlet Baru */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-[#D9480F]" />
                Tambah Cabang / Outlet Baru
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

              {/* Quick Select from unlinked Supabase Outlets if available */}
              {unlinkedPosOutlets.length > 0 && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                    💡 Pilih dari Outlet Supabase POS yang Belum Terhubung:
                  </label>
                  <select
                    value={selectedPosId}
                    onChange={(e) => {
                      const id = e.target.value
                      setSelectedPosId(id)
                      const found = unlinkedPosOutlets.find((o) => o.id === id)
                      if (found) {
                        const form = e.currentTarget.form
                        if (form) {
                          const nameInput = form.elements.namedItem('name') as HTMLInputElement
                          const typeSelect = form.elements.namedItem('type') as HTMLSelectElement
                          const regionSelect = form.elements.namedItem('region') as HTMLSelectElement
                          const addressInput = form.elements.namedItem('address') as HTMLInputElement
                          if (nameInput) nameInput.value = found.name
                          if (typeSelect) typeSelect.value = found.type === 'mitra' ? 'MITRA' : 'INTERNAL'
                          if (regionSelect && found.region) regionSelect.value = found.region
                          if (addressInput && found.address) addressInput.value = found.address
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-amber-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 font-semibold"
                  >
                    <option value="">-- Pilih Cabang POS Supabase --</option>
                    {unlinkedPosOutlets.map((sb) => (
                      <option key={sb.id} value={sb.id}>
                        {sb.name} ({sb.type.toUpperCase()}) {sb.region ? `• ${sb.region}` : ''}
                      </option>
                    ))}
                  </select>
                  <input type="hidden" name="posOutletId" value={selectedPosId} />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Nama Outlet / Lokasi Cabang *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Contoh: BNR, SS Beji, Cibinong..."
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tipe Cabang *
                  </label>
                  <select
                    name="type"
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    <option value="INTERNAL">INTERNAL (Cabang Resmi)</option>
                    <option value="MITRA">MITRA (Franchise / Kemitraan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Region / Wilayah
                  </label>
                  <select
                    name="region"
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    <option value="">-- Tanpa Region --</option>
                    <option value="BOGOR">BOGOR</option>
                    <option value="DEPOK">DEPOK</option>
                    <option value="JAKARTA">JAKARTA</option>
                    <option value="BEKASI">BEKASI</option>
                    <option value="TANGERANG">TANGERANG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Alamat Lengkap (Opsional)
                </label>
                <input
                  name="address"
                  type="text"
                  placeholder="Jl. Raya..."
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Nomor Telepon / WhatsApp Outlet
                </label>
                <input
                  name="phone"
                  type="text"
                  placeholder="0812..."
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
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
                  {isPending ? 'Menyimpan...' : 'Simpan Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Outlet */}
      {editingOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-[#EFE8DE] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#EFE8DE]">
              <h3 className="font-extrabold text-[#1A1715] text-base flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#D9480F]" />
                Edit Detail Outlet
              </h3>
              <button
                onClick={() => setEditingOutlet(null)}
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
                  Nama Outlet / Cabang *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingOutlet.name}
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Integrasi Hubungan ke POS Supabase
                </label>
                <select
                  name="posOutletId"
                  defaultValue={editingOutlet.posOutletId || ''}
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                >
                  <option value="">-- Tidak Terhubung ke POS Supabase --</option>
                  {posOutlets.map((sb) => (
                    <option key={sb.id} value={sb.id}>
                      {sb.name} ({sb.type}) {sb.region ? `• ${sb.region}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-400 mt-1">
                  Menghubungkan outlet MARCOM ke POS Supabase memastikan kunjungan KOL dapat diklaim kasir.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Tipe Cabang *
                  </label>
                  <select
                    name="type"
                    defaultValue={editingOutlet.type}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="MITRA">MITRA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Region / Wilayah
                  </label>
                  <select
                    name="region"
                    defaultValue={editingOutlet.region || ''}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    <option value="">-- Tanpa Region --</option>
                    <option value="BOGOR">BOGOR</option>
                    <option value="DEPOK">DEPOK</option>
                    <option value="JAKARTA">JAKARTA</option>
                    <option value="BEKASI">BEKASI</option>
                    <option value="TANGERANG">TANGERANG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Alamat Outlet
                </label>
                <input
                  name="address"
                  type="text"
                  defaultValue={editingOutlet.address || ''}
                  className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    No Telepon / WhatsApp
                  </label>
                  <input
                    name="phone"
                    type="text"
                    defaultValue={editingOutlet.phone || ''}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Status Operasional
                  </label>
                  <select
                    name="isActive"
                    defaultValue={editingOutlet.isActive ? 'true' : 'false'}
                    className="w-full px-4 py-2.5 text-sm border border-[#EFE8DE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D9480F]/20 focus:border-[#D9480F]"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#EFE8DE]">
                <button
                  type="button"
                  onClick={() => setEditingOutlet(null)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-[#D9480F] hover:bg-[#B83808] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Menyimpan...' : 'Perbarui'}
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
              <h3 className="font-extrabold text-[#1A1715] text-lg">Hapus Outlet?</h3>
              <p className="text-xs text-stone-500 mt-1.5">
                Apakah Anda yakin ingin menghapus outlet{' '}
                <span className="font-bold text-[#1A1715]">&quot;{deleteTarget.name}&quot;</span>?
                Tindakan ini tidak dapat dibatalkan jika outlet tidak memiliki data relasi.
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

