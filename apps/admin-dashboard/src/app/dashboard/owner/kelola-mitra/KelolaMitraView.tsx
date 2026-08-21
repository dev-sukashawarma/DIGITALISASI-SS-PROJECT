'use client'

import React, { useState, useMemo } from 'react'
import { MitraFormDialog } from './MitraFormDialog'
import { TransferUploadDialog } from './TransferUploadDialog'
import { SaranInbox } from './SaranInbox'
import { TransferListView } from './TransferListView'
import { 
  Users, 
  UploadCloud, 
  MessageSquare, 
  FileCheck, 
  Store, 
  Search, 
  X, 
  Plus, 
  UserCheck, 
  TrendingUp, 
  Building2, 
  Edit3, 
  ShieldCheck, 
  ArrowUpRight,
  Sparkles,
  AlertCircle
} from 'lucide-react'

function formatRupiah(num: number) {
  return 'Rp ' + Math.round(num || 0).toLocaleString('id-ID')
}

// Generate consistent avatar colors from string
function getAvatarGradient(name: string) {
  const gradients = [
    'from-amber-400 to-orange-500',
    'from-orange-500 to-red-500',
    'from-emerald-400 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-500',
    'from-rose-400 to-pink-600',
    'from-cyan-400 to-blue-500',
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % gradients.length
  return gradients[index]
}

function getInitials(name: string) {
  if (!name) return 'M'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function KelolaMitraView({ 
  mitraProfiles = [], 
  suggestions = [], 
  allUsers = [], 
  allOutlets = [], 
  transfers = [] 
}: any) {
  const [activeTab, setActiveTab] = useState<'daftar' | 'transfer' | 'saran'>('daftar')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMitraFormOpen, setIsMitraFormOpen] = useState(false)
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false)
  const [editMitraData, setEditMitraData] = useState<any>(null)

  // Calculations for summary stats
  const totalMitra = mitraProfiles.length
  const uniqueOutletsCovered = useMemo(() => {
    const set = new Set<string>()
    mitraProfiles.forEach((m: any) => {
      (m.outlet_ids || []).forEach((oid: string) => set.add(oid))
    })
    return set.size
  }, [mitraProfiles])

  const totalTransferNominal = useMemo(() => {
    return transfers.reduce((acc: number, t: any) => acc + (Number(t.nominal) || 0), 0)
  }, [transfers])

  const pendingSuggestions = useMemo(() => {
    return suggestions.filter((s: any) => s.status === 'baru').length
  }, [suggestions])

  // Filtered Mitra Cards
  const filteredMitra = useMemo(() => {
    if (!searchQuery.trim()) return mitraProfiles
    const q = searchQuery.toLowerCase().trim()
    return mitraProfiles.filter((m: any) => {
      const nameMatch = (m.nama_mitra || '').toLowerCase().includes(q)
      const staffUser = allUsers.find((u: any) => u.id === m.user_id)
      const userMatch = staffUser && (
        (staffUser.name || '').toLowerCase().includes(q) ||
        (staffUser.username || '').toLowerCase().includes(q)
      )
      const outletMatch = (m.outlet_ids || []).some((oid: string) => {
        const outlet = allOutlets.find((o: any) => o.id === oid)
        return outlet && outlet.name.toLowerCase().includes(q)
      })
      return nameMatch || userMatch || outletMatch
    })
  }, [mitraProfiles, searchQuery, allUsers, allOutlets])

  const handleEdit = (mitra: any) => {
    setEditMitraData(mitra)
    setIsMitraFormOpen(true)
  }

  const handleAdd = () => {
    setEditMitraData(null)
    setIsMitraFormOpen(true)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-suka-brown tracking-tight">Kelola Kemitraan</h1>
            <span className="bg-amber-100/80 text-amber-900 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200 shadow-sm">
              Hub Mitra
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manajemen hak akses akun mitra outlet, monitoring investasi, dan riwayat bagi hasil bulanan.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsTransferFormOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-200 text-amber-900 hover:bg-amber-50 rounded-2xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <UploadCloud className="w-4 h-4 text-amber-600" />
            Upload Transfer
          </button>
          <button 
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Tambah Mitra
          </button>
        </div>
      </div>

      {/* KPI / Summary Metric Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Mitra */}
        <div className="bg-white/80 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Mitra</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">{totalMitra}</div>
            <div className="text-[11px] font-semibold text-gray-400 mt-0.5">Mitra aktif terdaftar</div>
          </div>
        </div>

        {/* Card 2: Outlet Terkelola */}
        <div className="bg-white/80 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Outlet Mitra</span>
            <div className="w-9 h-9 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200/60">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">{uniqueOutletsCovered} <span className="text-sm font-semibold text-gray-400">/ {allOutlets.length}</span></div>
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Akses outlet terpasang
            </div>
          </div>
        </div>

        {/* Card 3: Total Transfer */}
        <div className="bg-white/80 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Transfer</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">{formatRupiah(totalTransferNominal)}</div>
            <div className="text-[11px] font-semibold text-gray-400 mt-0.5">{transfers.length} bukti terunggah</div>
          </div>
        </div>

        {/* Card 4: Kotak Saran */}
        <div className="bg-white/80 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kotak Saran</span>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">{suggestions.length}</div>
            <div className="text-[11px] font-bold mt-0.5">
              {pendingSuggestions > 0 ? (
                <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  {pendingSuggestions} saran perlu dibalas
                </span>
              ) : (
                <span className="text-gray-400">Semua telah ditanggapi</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pill Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2 bg-white/70 backdrop-blur-xl p-1.5 rounded-2xl w-fit shadow-sm border border-amber-100/80">
          <button
            onClick={() => setActiveTab('daftar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-300 ${
              activeTab === 'daftar'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Mitra</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'daftar' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {mitraProfiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-300 ${
              activeTab === 'transfer'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Riwayat Transfer</span>
            {transfers.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'transfer' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {transfers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('saran')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-300 ${
              activeTab === 'saran'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Kotak Saran</span>
            {pendingSuggestions > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                {pendingSuggestions}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content: Daftar Mitra */}
      {activeTab === 'daftar' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="bg-white/70 backdrop-blur-xl p-3.5 border border-amber-100/80 rounded-2xl shadow-sm flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </span>
              <input
                type="text"
                placeholder="Cari nama mitra, username @akun, atau outlet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder-gray-400 bg-white"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-xs font-bold text-gray-500 hidden sm:block">
              Menampilkan: <span className="text-gray-900">{filteredMitra.length} Mitra</span>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMitra.map((mitra: any) => {
              const staffUser = allUsers.find((u: any) => u.id === mitra.user_id)
              const outletCount = mitra.outlet_ids?.length || 0
              const avatarGrad = getAvatarGradient(mitra.nama_mitra)
              const initials = getInitials(mitra.nama_mitra)

              return (
                <div 
                  key={mitra.id || mitra.user_id} 
                  className="group bg-white/90 backdrop-blur-xl border border-amber-100/80 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Top row: Avatar & Profile */}
                    <div className="flex items-start gap-3.5 pb-4 border-b border-gray-100">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarGrad} text-white font-black text-base flex items-center justify-center shrink-0 shadow-md shadow-amber-500/10`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-gray-900 text-base leading-snug truncate group-hover:text-amber-600 transition-colors">
                          {mitra.nama_mitra}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                          <UserCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {staffUser ? `@${staffUser.username}` : `ID: ${mitra.user_id?.substring(0, 8)}...`}
                          </span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        outletCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {outletCount > 0 ? 'Aktif' : 'Non-Outlet'}
                      </span>
                    </div>

                    {/* Middle row: Assigned Outlets */}
                    <div className="py-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-amber-600" />
                          Akses Outlet
                        </span>
                        <span className="text-gray-400 font-semibold">{outletCount} Outlet</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 min-h-[42px]">
                        {mitra.outlet_ids?.map((oid: string) => {
                          const outlet = allOutlets.find((o: any) => o.id === oid)
                          return (
                            <span 
                              key={oid} 
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50/70 text-amber-900 border border-amber-200/70 text-xs font-bold rounded-xl"
                            >
                              <Store className="w-3 h-3 text-amber-600" />
                              {outlet?.name || 'Unknown Outlet'}
                            </span>
                          )
                        })}
                        {outletCount === 0 && (
                          <div className="text-xs text-gray-400 italic py-1">
                            Belum ada outlet terhubung
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-3 border-t border-gray-100">
                    <button 
                      onClick={() => handleEdit(mitra)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-gray-50 hover:bg-amber-500 hover:text-white text-gray-700 border border-gray-200 hover:border-amber-500 font-bold rounded-xl transition-all duration-200 text-xs sm:text-sm group/btn shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-gray-500 group-hover/btn:text-white transition-colors" />
                      Edit Akses & Info
                    </button>
                  </div>
                </div>
              )
            })}

            {filteredMitra.length === 0 && (
              <div className="col-span-full bg-white/80 backdrop-blur-xl rounded-3xl border border-dashed border-gray-300 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-gray-800 text-base">Tidak ada data mitra yang sesuai</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {searchQuery ? `Tidak ditemukan mitra dengan kata kunci "${searchQuery}".` : 'Belum ada profil mitra yang ditambahkan.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-bold text-amber-600 hover:underline pt-1"
                  >
                    Reset Pencarian
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Riwayat Transfer */}
      {activeTab === 'transfer' && (
        <TransferListView transfers={transfers} outlets={allOutlets} />
      )}

      {/* Tab Content: Kotak Saran */}
      {activeTab === 'saran' && (
        <SaranInbox suggestions={suggestions} />
      )}

      {/* Dialog Modals */}
      <MitraFormDialog 
        isOpen={isMitraFormOpen} 
        onClose={() => setIsMitraFormOpen(false)} 
        users={allUsers}
        outlets={allOutlets}
        initialData={editMitraData}
      />
      
      <TransferUploadDialog 
        isOpen={isTransferFormOpen} 
        onClose={() => setIsTransferFormOpen(false)}
        outlets={allOutlets}
      />
    </div>
  )
}


