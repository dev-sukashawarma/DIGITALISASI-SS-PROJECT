'use client'
import { useState, useMemo } from 'react'
import { usePermintaanList } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { convertToDistribusiUnit } from '@/lib/format/compositeUnit'
import type { PermintaanStatus } from '@/types/permintaan'
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Search,
  Package,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react'

const STATUS_CONFIG: Record<
  PermintaanStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  menunggu: {
    label: 'Menunggu',
    badge: 'bg-amber-50 text-amber-800 border-amber-200/80',
    icon: Clock,
  },
  disetujui: {
    label: 'Disetujui',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    icon: CheckCircle2,
  },
  ditolak: {
    label: 'Ditolak',
    badge: 'bg-red-50 text-red-800 border-red-200/80',
    icon: XCircle,
  },
  dibatalkan: {
    label: 'Dibatalkan',
    badge: 'bg-stone-100 text-stone-600 border-stone-200',
    icon: Ban,
  },
}

export function PermintaanList({ outletId }: { outletId: string }) {
  const { permintaan, loading, error } = usePermintaanList(outletId)
  const { bahanBaku } = useBahanBaku()
  const [statusFilter, setStatusFilter] = useState<'all' | PermintaanStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredList = useMemo(() => {
    return permintaan.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const reqCode = `#REQ-${p.id.slice(0, 4).toUpperCase()}`.toLowerCase()
        const staff = (p.staff_name || '').toLowerCase()
        const hasItem = p.items.some(it => (it.nama || '').toLowerCase().includes(q))
        if (!reqCode.includes(q) && !staff.includes(q) && !hasItem) return false
      }

      return true
    })
  }, [permintaan, statusFilter, searchQuery])

  if (loading) {
    return (
      <div className="bg-white border border-suka-brown/10 rounded-3xl p-12 text-center shadow-2xs space-y-2">
        <div className="w-8 h-8 border-3 border-suka-orange border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-suka-brown/60 font-bold">Memuat riwayat permintaan bahan...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center text-xs font-bold text-red-700">
        {error}
      </div>
    )
  }

  if (permintaan.length === 0) {
    return (
      <div className="bg-white border border-suka-brown/10 rounded-3xl p-12 text-center shadow-2xs space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-suka-cream/60 text-suka-brown/40 flex items-center justify-center mx-auto">
          <Package className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-suka-brown text-sm">Belum Ada Riwayat Permintaan</h3>
        <p className="text-xs text-suka-brown/50">Permintaan bahan baku yang Anda buat akan tercatat dan ditampilkan di sini.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-2xl border border-suka-brown/10 shadow-2xs space-y-2.5">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-suka-brown/40">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Cari kode (#REQ-...), nama pemohon, atau nama bahan..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-suka-cream/20 border border-suka-brown/10 text-suka-brown placeholder:text-suka-brown/40 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:ring-1 focus:ring-suka-orange focus:bg-white transition-all"
          />
        </div>

        {/* Status Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-suka-brown text-white shadow-2xs'
                : 'bg-suka-cream/30 text-suka-brown/70 hover:bg-suka-cream/60'
            }`}
          >
            Semua ({permintaan.length})
          </button>
          {(['menunggu', 'disetujui', 'ditolak', 'dibatalkan'] as PermintaanStatus[]).map(st => {
            const count = permintaan.filter(p => p.status === st).length
            const active = statusFilter === st
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-suka-orange text-white shadow-2xs'
                    : 'bg-suka-cream/30 text-suka-brown/70 hover:bg-suka-cream/60'
                }`}
              >
                {STATUS_CONFIG[st].label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Cards List */}
      {filteredList.length === 0 ? (
        <div className="bg-white border border-suka-brown/10 rounded-2xl p-8 text-center shadow-2xs text-xs text-suka-brown/60">
          Tidak ada riwayat permintaan yang cocok dengan filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map(p => {
            const reqCode = `#REQ-${p.id.slice(0, 4).toUpperCase()}`
            const totalQty = p.items.reduce((acc, it) => {
              const b = bahanBaku.find(x => x.id === it.bahan_baku_id)
              const qty = b ? Math.ceil(convertToDistribusiUnit(it.qty_diminta || 0, b)) : it.qty_diminta || 0
              return acc + qty
            }, 0)

            const StatusIcon = STATUS_CONFIG[p.status].icon

            return (
              <div
                key={p.id}
                className="bg-white border border-suka-brown/10 rounded-3xl p-5 shadow-2xs hover:border-suka-brown/20 transition-all space-y-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border inline-flex items-center gap-1 ${
                          STATUS_CONFIG[p.status].badge
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_CONFIG[p.status].label}
                      </span>
                      <span className="text-xs font-extrabold text-suka-brown">{reqCode}</span>
                    </div>

                    {p.staff_name && (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-suka-brown/60">
                        <User className="w-3 h-3" />
                        <span>Dibuat oleh: <strong className="text-suka-brown font-bold">{p.staff_name}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-medium text-suka-brown/50 bg-suka-cream/30 px-2.5 py-1 rounded-xl shrink-0">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(p.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-suka-brown">
                      {p.items.length} Item Bahan Baku
                    </span>
                    <span className="text-[11px] font-bold text-suka-brown/60">
                      Total: {totalQty} Unit Pesan
                    </span>
                  </div>

                  <ul className="text-xs space-y-1.5 bg-suka-cream/30 rounded-2xl p-3.5 border border-suka-brown/5">
                    {p.items.map(it => {
                      const b = bahanBaku.find(x => x.id === it.bahan_baku_id)
                      const distUnit = b?.satuan_distribusi || b?.satuan || ''
                      const qtyDiminta = b
                        ? Math.ceil(convertToDistribusiUnit(it.qty_diminta || 0, b))
                        : it.qty_diminta || 0
                      const qtyDisetujui =
                        b && it.qty_disetujui != null
                          ? Math.ceil(convertToDistribusiUnit(it.qty_disetujui, b))
                          : it.qty_disetujui

                      return (
                        <li key={it.id} className="flex justify-between items-center py-0.5">
                          <span className="font-semibold text-suka-brown">{it.nama ?? it.bahan_baku_id}</span>
                          <span className="font-extrabold text-suka-brown flex items-center gap-1">
                            <span>{qtyDiminta} {distUnit}</span>
                            {qtyDisetujui != null && qtyDisetujui !== qtyDiminta && (
                              <span className="text-suka-orange flex items-center gap-0.5 font-black">
                                <ArrowRight className="w-3 h-3" />
                                <span>{qtyDisetujui} {distUnit}</span>
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {p.status === 'ditolak' && p.catatan_kitchen && (
                  <div className="text-xs text-red-800 bg-red-50 border border-red-200/80 p-3 rounded-2xl flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block">Alasan Penolakan:</strong>
                      <span className="text-[11px]">{p.catatan_kitchen}</span>
                    </div>
                  </div>
                )}

                {p.status === 'dibatalkan' && p.catatan_kitchen && (
                  <div className="text-xs text-stone-700 bg-stone-50 border border-stone-200 p-3 rounded-2xl flex items-start gap-2">
                    <Ban className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block">Catatan Pembatalan:</strong>
                      <span className="text-[11px]">{p.catatan_kitchen}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

