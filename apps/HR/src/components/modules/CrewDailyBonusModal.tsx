'use client'

import React, { useState, useMemo } from 'react'
import { X, Calendar, Store, Users, AlertCircle, Search } from 'lucide-react'
import { useCrewDailyBonusDetail } from '@/hooks/useCrewBonus'
import { formatRupiah } from '@/lib/format'

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

interface CrewDailyBonusModalProps {
  isOpen: boolean
  onClose: () => void
  crewId: string | null
  crewName: string
  month: number
  year: number
  role: string
  subRole?: string
}

export function CrewDailyBonusModal({
  isOpen,
  onClose,
  crewId,
  crewName,
  month,
  year,
  role,
  subRole,
}: CrewDailyBonusModalProps) {
  const [dateSearch, setDateSearch] = useState('')

  const { data: dailyRows = [], isLoading, isError, error } = useCrewDailyBonusDetail({
    month,
    year,
    crewId: isOpen ? crewId : null,
  })

  const filteredRows = useMemo(() => {
    const q = dateSearch.trim().toLowerCase()
    if (!q) return dailyRows
    return dailyRows.filter(
      (r) =>
        r.bonus_date.toLowerCase().includes(q) ||
        r.day_name.toLowerCase().includes(q) ||
        r.outlet_name.toLowerCase().includes(q)
    )
  }, [dailyRows, dateSearch])

  if (!isOpen) return null

  const monthLabel = MONTH_NAMES[month - 1] || ''
  const totalBonus = dailyRows.reduce((acc, r) => acc + r.bonus_earned, 0)
  const totalDays = dailyRows.length
  const filteredBonus = filteredRows.reduce((acc, r) => acc + r.bonus_earned, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white border border-suka-gray-200 shadow-2xl animate-in zoom-in-95 duration-200 text-suka-ink">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-suka-gray-100 px-5 py-4 bg-suka-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-suka-orange flex items-center justify-center font-bold border border-orange-200 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-suka-brown">
                  Rincian Bonus Harian: {crewName}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                    role === 'leader'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-suka-gray-100 text-suka-gray-600 border-suka-gray-200'
                  }`}
                >
                  {role}
                </span>
                {subRole === 'crew_backup' && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                    Mobile Backup
                  </span>
                )}
              </div>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                Periode {monthLabel} {year} • Perhitungan Pool Harian (Pcs × Rp 100 ÷ Jumlah Kru Hadir)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-suka-gray-400 hover:bg-stone-100 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlight Stats Bar */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 gap-2 px-5 py-3 bg-stone-50/80 border-b border-suka-gray-100 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-suka-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-400 block">
              Total Kehadiran
            </span>
            <span className="font-mono font-black text-sm text-suka-brown">
              {totalDays} <span className="text-xs font-normal text-suka-gray-500">Hari Bertugas</span>
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-suka-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-400 block">
              Total Bonus Terkumpul
            </span>
            <span className="font-mono font-black text-sm text-emerald-700">
              {formatRupiah(totalBonus)}
            </span>
          </div>

          <div className="hidden sm:block bg-white p-2.5 rounded-xl border border-suka-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-suka-gray-400 block">
              Rata-rata Bonus/Hari
            </span>
            <span className="font-mono font-bold text-xs text-suka-ink">
              {totalDays > 0 ? formatRupiah(Math.round(totalBonus / totalDays)) : 'Rp 0'}
            </span>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-suka-gray-500 font-bold text-xs">
              <div className="w-7 h-7 border-3 border-suka-orange border-t-transparent rounded-full animate-spin mb-3" />
              Memuat riwayat kehadiran harian &amp; pembagian bonus...
            </div>
          ) : isError ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Gagal memuat rincian harian</p>
                <p className="text-[11px] text-red-600">{(error as any)?.message}</p>
              </div>
            </div>
          ) : dailyRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-suka-gray-400">
              Tidak ada catatan kehadiran bertugas pada periode ini.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari tanggal, hari, outlet..."
                    value={dateSearch}
                    onChange={(e) => setDateSearch(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 text-xs bg-suka-gray-50 border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:bg-white transition-all text-suka-ink"
                  />
                  {dateSearch && (
                    <button
                      type="button"
                      onClick={() => setDateSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-suka-gray-400 hover:text-suka-ink cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {dateSearch && (
                  <span className="text-[11px] text-suka-gray-500 font-medium">
                    Menampilkan {filteredRows.length} dari {dailyRows.length} hari
                  </span>
                )}
              </div>

              {filteredRows.length === 0 ? (
                <div className="py-8 text-center text-xs text-suka-gray-400">
                  Tidak ditemukan data yang cocok dengan &quot;{dateSearch}&quot;.
                </div>
              ) : (
                <div className="overflow-x-auto border border-suka-gray-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-suka-gray-50 border-b border-suka-gray-200 text-suka-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5">Tanggal</th>
                        <th className="px-4 py-2.5">Outlet Bertugas</th>
                        <th className="px-4 py-2.5 text-right">Penjualan (Pcs)</th>
                        <th className="px-4 py-2.5 text-right">Pool Cabang</th>
                        <th className="px-4 py-2.5 text-center">Kru Hadir</th>
                        <th className="px-4 py-2.5 text-right font-black text-emerald-800">Bonus Diterima</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-suka-gray-100">
                      {filteredRows.map((row, idx) => {
                        const cleanOutlet = (row.outlet_name || '')
                          .replace('SUKA SHAWARMA ', '')
                          .replace('MITRA SUKA ', 'MITRA ')

                        return (
                          <tr key={`${row.bonus_date}_${row.outlet_id}_${idx}`} className="hover:bg-suka-cream/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                              <div className="font-bold text-suka-brown">{row.bonus_date}</div>
                              <div className="text-[10px] text-suka-gray-400">{row.day_name}</div>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 font-bold text-suka-brown">
                                <Store className="w-3.5 h-3.5 text-suka-gray-400 shrink-0" />
                                {cleanOutlet}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-suka-ink">
                              {row.daily_pcs} pcs
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums text-suka-gray-600">
                              {formatRupiah(row.pool_amount)}
                            </td>
                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-bold border border-stone-200">
                                <Users className="w-3 h-3 text-stone-500" />
                                {row.crew_count_today} orang
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-black tabular-nums text-emerald-700 text-xs">
                              {formatRupiah(row.bonus_earned)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-suka-gray-50 border-t-2 border-suka-gray-200 font-bold">
                      <tr>
                        <td colSpan={2} className="px-4 py-2.5 text-xs text-suka-brown">
                          Total ({filteredRows.length} hari {dateSearch ? 'terfilter' : 'kerja'})
                        </td>
                        <td colSpan={3} className="px-4 py-2.5 text-right text-xs text-suka-gray-500">
                          Total Bonus Terakumulasi:
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-black tabular-nums text-emerald-800 text-sm">
                          {formatRupiah(filteredBonus)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-suka-gray-100 px-5 py-3 bg-suka-gray-50">
          <span className="text-[11px] text-suka-gray-400">
            * Data tersinkronisasi otomatis dengan clock-in presensi dan POS orders.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-suka-gray-700 bg-white border border-suka-gray-300 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
