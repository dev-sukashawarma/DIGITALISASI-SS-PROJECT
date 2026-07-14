'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/components/layout/RoleContext'
import { useOutlets } from '@/hooks/useOutlets'
import { useCrewBonus } from '@/hooks/useCrewBonus'
import { PageHeader } from '@/components/ui'
import { Select } from '@/components/ui/Select'
import { Store, FileText, AlertCircle } from 'lucide-react'

const MONTH_OPTIONS = [
  { label: 'Januari', value: '1' },
  { label: 'Februari', value: '2' },
  { label: 'Maret', value: '3' },
  { label: 'April', value: '4' },
  { label: 'Mei', value: '5' },
  { label: 'Juni', value: '6' },
  { label: 'Juli', value: '7' },
  { label: 'Agustus', value: '8' },
  { label: 'September', value: '9' },
  { label: 'Oktober', value: '10' },
  { label: 'November', value: '11' },
  { label: 'Desember', value: '12' },
]

const YEAR_OPTIONS = [
  { label: '2024', value: '2024' },
  { label: '2025', value: '2025' },
  { label: '2026', value: '2026' },
  { label: '2027', value: '2027' },
  { label: '2028', value: '2028' },
]

function cleanOutletName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}

export default function CrewBonusPage() {
  const { outletId: userOutletId, isReadOnly } = useRole()
  const { data: outlets = [], isLoading: loadingOutlets } = useOutlets()

  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [year, setYear] = useState<number>(() => new Date().getFullYear())
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')

  // Lock outlet filter to user's profile outletId if isReadOnly (MITRA)
  useEffect(() => {
    if (isReadOnly && userOutletId) {
      setSelectedOutletId(userOutletId)
    } else if (!isReadOnly && outlets.length > 0 && !selectedOutletId) {
      // Otherwise, default OWNER/ADMIN to the first outlet in the list
      setSelectedOutletId(outlets[0].id)
    }
  }, [isReadOnly, userOutletId, outlets, selectedOutletId])

  const { data: crewBonuses = [], isLoading: loadingBonus, isError, error } = useCrewBonus({
    month,
    year,
    outletId: selectedOutletId || null,
  })

  const outletOptions = useMemo(() => {
    return outlets.map((o) => ({
      label: cleanOutletName(o.name),
      value: o.id,
      icon: <Store className="w-4 h-4 text-suka-gray-400" />
    }))
  }, [outlets])

  const selectedMonthLabel = MONTH_OPTIONS.find((m) => m.value === month.toString())?.label || ''

  const isLoading = loadingOutlets || (!!selectedOutletId && loadingBonus)

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <PageHeader
        title="Laporan Bonus Crew"
        description="Rekapitulasi bulanan pencapaian target harian dan pembagian bonus crew."
      >
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
          {/* Month Picker */}
          <Select
            options={MONTH_OPTIONS}
            value={month.toString()}
            onChange={(val) => setMonth(Number(val))}
            className="w-full sm:w-[150px]"
            placeholder="Pilih Bulan..."
          />

          {/* Year Picker */}
          <Select
            options={YEAR_OPTIONS}
            value={year.toString()}
            onChange={(val) => setYear(Number(val))}
            className="w-full sm:w-[120px]"
            placeholder="Pilih Tahun..."
          />

          {/* Outlet Picker */}
          {isReadOnly ? (
            <div className="w-full sm:w-auto flex items-center gap-2 pl-3 pr-4 py-2 bg-suka-cream/30 border border-suka-gray-200 rounded-xl text-xs font-bold text-suka-brown relative sm:min-w-[180px]">
              <Store className="w-4 h-4 text-suka-brown/50 shrink-0" />
              <span className="truncate text-left flex-1">
                {cleanOutletName(outlets.find((o) => o.id === selectedOutletId)?.name ?? 'Outlet Saya')}
              </span>
            </div>
          ) : (
            <Select
              options={outletOptions}
              value={selectedOutletId}
              onChange={setSelectedOutletId}
              className="w-full sm:w-[200px]"
              placeholder="Pilih Outlet..."
            />
          )}
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-suka-brown font-bold text-sm bg-white rounded-3xl border border-suka-brown/10 shadow-sm">
          <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin mb-4"></div>
          Memuat data laporan bonus...
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 bg-red-50 rounded-3xl border border-red-200 shadow-sm border-dashed text-red-600">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4 text-red-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-1">Gagal Memuat Data</h3>
          <p className="text-sm text-center max-w-sm">
            Terjadi kesalahan saat mengambil laporan bonus crew: {error?.message}
          </p>
        </div>
      ) : crewBonuses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-suka-brown/10 shadow-sm border-dashed">
          <div className="w-16 h-16 bg-suka-cream/50 rounded-2xl flex items-center justify-center mb-4 text-suka-brown/30">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-suka-brown mb-1">Belum Ada Data Laporan</h3>
          <p className="text-sm text-suka-brown/50 text-center max-w-sm">
            Data laporan bonus crew untuk bulan {selectedMonthLabel} {year} belum tersedia atau belum ada target harian tercapai.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-suka-brown/10 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-suka-cream/20 border-b border-suka-brown/10 text-suka-brown font-bold">
                <tr>
                  <th className="px-6 py-4">Nama Crew</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Outlet</th>
                  <th className="px-6 py-4 text-center">Hari Target Tercapai</th>
                  <th className="px-6 py-4 text-right">Total Bonus Diterima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100 text-suka-ink">
                {crewBonuses.map((row, idx) => (
                  <tr key={idx} className="hover:bg-suka-cream/5 transition-colors">
                    <td className="px-6 py-4 font-semibold">{row.crew_name}</td>
                    <td className="px-6 py-4 capitalize text-suka-gray-500 font-medium">{row.role}</td>
                    <td className="px-6 py-4 text-suka-gray-600">{row.outlet_name}</td>
                    <td className="px-6 py-4 text-center font-bold text-suka-orange">{row.days_target_reached} Hari</td>
                    <td className="px-6 py-4 text-right font-extrabold text-emerald-600">
                      {formatRupiah(row.total_bonus_received)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
