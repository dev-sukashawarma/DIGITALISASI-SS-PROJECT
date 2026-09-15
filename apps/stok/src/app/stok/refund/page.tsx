'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@suka/auth'
import {
  RotateCcw,
  Plus,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Loader2,
  PackageX,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserAvatarDropdown } from '@/components/common/UserAvatarDropdown'
import { useDaftarRetur } from '@/hooks/useRetur'
import { CardReturItem } from '@/components/refund/CardReturItem'

type TabType = 'aktif' | 'riwayat' | 'manager' | 'kitchen'

export default function ReturRefundPage() {
  const { outletStaff } = useAuth()
  const role = outletStaff?.role
  const outletId = outletStaff?.outlet_id ?? null

  const isManager = ['area_manager', 'regional_manager', 'spv', 'admin', 'owner', 'developer'].includes(
    role ?? ''
  )
  const isKitchen = ['kitchen', 'admin', 'owner', 'purchasing', 'developer'].includes(role ?? '')

  // Default tab based on role
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (isManager) return 'manager'
    if (isKitchen) return 'kitchen'
    return 'aktif'
  })

  // Sync tab from URL query params (e.g. ?tab=manager or ?tab=approval)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam === 'manager' || tabParam === 'approval') {
        setActiveTab('manager')
      } else if (tabParam === 'kitchen') {
        setActiveTab('kitchen')
      } else if (tabParam === 'aktif') {
        setActiveTab('aktif')
      } else if (tabParam === 'riwayat') {
        setActiveTab('riwayat')
      }
    }
  }, [])

  // Fetch all accessible returns
  const { returs, loading } = useDaftarRetur({
    outletId: isManager || isKitchen ? null : outletId,
  })

  // Filter items per tab
  const listAktif = returs.filter((r) => r.status !== 'selesai' && r.status !== 'ditolak')
  const listRiwayat = returs.filter((r) => r.status === 'selesai' || r.status === 'ditolak')
  const listManager = returs.filter((r) => r.status === 'diajukan')
  const listKitchen = returs.filter(
    (r) => r.status === 'dalam_pengiriman' || r.status === 'diterima_kitchen'
  )

  const displayedList =
    activeTab === 'aktif'
      ? listAktif
      : activeTab === 'riwayat'
      ? listRiwayat
      : activeTab === 'manager'
      ? listManager
      : listKitchen

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-24">
        {/* Sticky Header */}
        <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800 text-white flex items-center justify-center shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight">
                Retur & Refund Bahan
              </h1>
              <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider mt-0.5">
                Kompensasi Ganti Fisik 100% · Sapi, Ayam & Kulit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/stok/refund/new"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ajukan Retur</span>
            </Link>
            <UserAvatarDropdown />
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-6 space-y-5">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-[#d9c2b2]/40 shadow-2xs overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('aktif')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'aktif'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Klaim Berjalan</span>
              {listAktif.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeTab === 'aktif' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {listAktif.length}
                </span>
              )}
            </button>

            {isManager && (
              <button
                type="button"
                onClick={() => setActiveTab('manager')}
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'manager'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Persetujuan AM/RM</span>
                {listManager.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeTab === 'manager'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 text-red-700 font-black'
                    }`}
                  >
                    {listManager.length}
                  </span>
                )}
              </button>
            )}

            {isKitchen && (
              <button
                type="button"
                onClick={() => setActiveTab('kitchen')}
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'kitchen'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Antrean Kitchen</span>
                {listKitchen.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeTab === 'kitchen'
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-100 text-purple-700 font-black'
                    }`}
                  >
                    {listKitchen.length}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('riwayat')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'riwayat'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Riwayat Selesai</span>
              {listRiwayat.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeTab === 'riwayat' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {listRiwayat.length}
                </span>
              )}
            </button>
          </div>

          {/* List of Cards */}
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-800 mx-auto" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Memuat data retur...
              </p>
            </div>
          ) : displayedList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#d9c2b2]/40 p-12 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
                <PackageX className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-[#1e1b15]">Belum Ada Data Retur</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto font-medium">
                {activeTab === 'manager'
                  ? 'Tidak ada pengajuan retur yang menunggu persetujuan Area Manager saat ini.'
                  : activeTab === 'kitchen'
                  ? 'Tidak ada kiriman retur yang sedang menuju Central Kitchen.'
                  : activeTab === 'riwayat'
                  ? 'Belum ada arsip retur yang selesai atau ditolak.'
                  : 'Saat ini tidak ada tiket pengembalian bahan yang sedang berjalan.'}
              </p>
              {activeTab === 'aktif' && (
                <Link
                  href="/stok/refund/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 transition-colors shadow-2xs mt-2"
                >
                  <Plus className="w-4 h-4" /> Buat Pengajuan Retur
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayedList.map((item) => (
                <CardReturItem
                  key={item.id}
                  retur={item}
                  userRole={role}
                  userOutletId={outletId}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  )
}
