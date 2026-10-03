'use client'

import { useState, useMemo } from 'react'
import { Eye, Edit2, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import type { PayrollRecord } from '@/lib/types'
import { formatRupiah } from '@/lib/format'
import { SalarySlipModal } from './SalarySlipModal'
import { getPayrollBreakdown } from '@/lib/payrollBreakdown'
import { isRendyOrDeveloperStaff } from '@/lib/staffFilters'

type SortField =
  | 'name'
  | 'outlet'
  | 'basicSalary'
  | 'allowances'
  | 'bonus'
  | 'deductions'
  | 'takeHomePay'
  | 'status'

type SortDirection = 'asc' | 'desc'

function getCleanBonusNote(slip: PayrollRecord, b: ReturnType<typeof getPayrollBreakdown>): string | null {
  if (b.overtime === 0 && b.salesBonus === 0) return null

  const parts: string[] = []
  if (b.overtime > 0) parts.push(`Lembur: ${formatRupiah(b.overtime)}`)
  if (b.salesBonus > 0) {
    const isRewardAbsensi = slip.bonus_note?.toLowerCase().includes('reward absensi')
    parts.push(isRewardAbsensi ? `Reward: ${formatRupiah(b.salesBonus)}` : `Bonus: ${formatRupiah(b.salesBonus)}`)
  }
  return parts.join(' • ') || null
}

function getCleanDeductionNote(b: ReturnType<typeof getPayrollBreakdown>): string | null {
  if (b.totalDeductions === 0) return null

  const parts: string[] = []
  if (b.cashAdvanceDeduction > 0) parts.push(`Kasbon: ${formatRupiah(b.cashAdvanceDeduction)}`)
  if (b.lateDeduction > 0) {
    parts.push(`Telat ${b.lateMinutes > 0 ? `(${b.lateMinutes}m): ` : ': '}${formatRupiah(b.lateDeduction)}`)
  }
  if (b.bpjsDeduction > 0) parts.push(`BPJS: ${formatRupiah(b.bpjsDeduction)}`)
  if (b.otherDeduction > 0) parts.push(`Lainnya: ${formatRupiah(b.otherDeduction)}`)

  return parts.join(' • ') || null
}

function SortHeader({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string
  field: SortField
  currentField: SortField | null
  currentDirection: SortDirection
  onSort: (field: SortField) => void
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  const isActive = currentField === field

  return (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-3.5 select-none cursor-pointer hover:bg-amber-100/60 transition-colors group ${className}`}
      title={`Klik untuk mengurutkan berdasarkan ${label}`}
    >
      <div
        className={`flex items-center gap-1.5 ${
          align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
        }`}
      >
        <span className={isActive ? 'text-suka-orange font-black' : ''}>{label}</span>
        <span
          className={`transition-colors ${
            isActive ? 'text-suka-orange' : 'text-stone-300 group-hover:text-stone-500'
          }`}
        >
          {isActive ? (
            currentDirection === 'asc' ? (
              <ArrowUp size={13} className="stroke-[2.5]" />
            ) : (
              <ArrowDown size={13} className="stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown size={12} />
          )}
        </span>
      </div>
    </th>
  )
}

export function PayrollTable({
  rows,
  onEdit,
}: {
  rows: PayrollRecord[]
  onEdit: (slip: PayrollRecord) => void
}) {
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Pre-calculate breakdown & searchable values
  const processedRows = useMemo(() => {
    return rows.map((r) => {
      const b = getPayrollBreakdown(r)
      const totalTunjangan =
        b.mealAllowance + b.transportAllowance + b.communicationAllowance + b.positionAllowance
      const totalBonus = b.overtime + b.salesBonus
      const outletName = isRendyOrDeveloperStaff(r.outlet_staff as any)
        ? 'Kantor Pusat'
        : r.outlet_staff?.outlets?.name || 'Pusat'
      const staffName = r.outlet_staff?.name || 'Staff'
      const roleName = r.outlet_staff?.role?.replace('_', ' ') || ''

      return {
        record: r,
        b,
        totalTunjangan,
        totalBonus,
        outletName,
        staffName,
        roleName,
      }
    })
  }, [rows])

  // Filter & Sort
  const filteredAndSortedRows = useMemo(() => {
    let list = processedRows

    // 1. Filter Nama / Jabatan / Outlet
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (item) =>
          item.staffName.toLowerCase().includes(q) ||
          item.roleName.toLowerCase().includes(q) ||
          item.outletName.toLowerCase().includes(q)
      )
    }

    // 2. Sort
    if (sortField) {
      list = [...list].sort((a, b) => {
        let valA: string | number = 0
        let valB: string | number = 0

        switch (sortField) {
          case 'name':
            valA = a.staffName.toLowerCase()
            valB = b.staffName.toLowerCase()
            break
          case 'outlet':
            valA = a.outletName.toLowerCase()
            valB = b.outletName.toLowerCase()
            break
          case 'basicSalary':
            valA = a.b.basicSalary
            valB = b.b.basicSalary
            break
          case 'allowances':
            valA = a.totalTunjangan
            valB = b.totalTunjangan
            break
          case 'bonus':
            valA = a.totalBonus
            valB = b.totalBonus
            break
          case 'deductions':
            valA = a.b.totalDeductions
            valB = b.b.totalDeductions
            break
          case 'takeHomePay':
            valA = a.b.takeHomePay
            valB = b.b.takeHomePay
            break
          case 'status':
            valA = a.record.status
            valB = b.record.status
            break
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          const cmp = valA.localeCompare(valB)
          return sortDirection === 'asc' ? cmp : -cmp
        } else {
          const numA = Number(valA) || 0
          const numB = Number(valB) || 0
          return sortDirection === 'asc' ? numA - numB : numB - numA
        }
      })
    }

    return list
  }, [processedRows, searchQuery, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortField(null)
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      // Numeric values default to desc (highest first), text defaults to asc (A-Z)
      if (['basicSalary', 'allowances', 'bonus', 'deductions', 'takeHomePay'].includes(field)) {
        setSortDirection('desc')
      } else {
        setSortDirection('asc')
      }
    }
  }

  return (
    <>
      {/* ── Search & Filter Controls Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-suka-gray-200 shadow-2xs mb-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama staf, jabatan, atau outlet..."
            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-suka-gray-200 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20 outline-none text-suka-ink transition-all placeholder:text-suka-gray-400 font-medium bg-stone-50/50 focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded-full transition-colors cursor-pointer"
              title="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Counter & Reset Sorting */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {sortField && (
            <button
              type="button"
              onClick={() => {
                setSortField(null)
                setSortDirection('asc')
              }}
              className="text-xs font-semibold text-stone-500 hover:text-suka-brown px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Reset Urutan
            </button>
          )}
          <span className="text-xs font-semibold text-stone-600 px-3.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200">
            Menampilkan <strong className="text-suka-brown font-mono font-bold">{filteredAndSortedRows.length}</strong>{' '}
            dari <strong className="text-stone-700 font-mono font-bold">{rows.length}</strong> Staf
          </span>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1180px]">
            <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
              <tr>
                <SortHeader
                  label="Nama & Jabatan"
                  field="name"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="whitespace-nowrap min-w-[190px]"
                />
                <SortHeader
                  label="Outlet"
                  field="outlet"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="whitespace-nowrap min-w-[170px]"
                />
                <SortHeader
                  label="Gaji Pokok"
                  field="basicSalary"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                  className="whitespace-nowrap min-w-[125px]"
                />
                <SortHeader
                  label="Tunjangan"
                  field="allowances"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                  className="whitespace-nowrap min-w-[115px]"
                />
                <SortHeader
                  label="Bonus / OT"
                  field="bonus"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                  className="whitespace-nowrap min-w-[165px]"
                />
                <SortHeader
                  label="Potongan"
                  field="deductions"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                  className="whitespace-nowrap min-w-[175px]"
                />
                <SortHeader
                  label="Total Bersih (THP)"
                  field="takeHomePay"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                  className="whitespace-nowrap min-w-[145px]"
                />
                <SortHeader
                  label="Status"
                  field="status"
                  currentField={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  align="center"
                  className="whitespace-nowrap min-w-[95px]"
                />
                <th className="px-4 py-3.5 whitespace-nowrap text-right min-w-[115px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {filteredAndSortedRows.map(({ record: r, b, totalTunjangan, totalBonus, outletName, staffName, roleName }) => {
                const cleanBonus = getCleanBonusNote(r, b)
                const cleanDeduction = getCleanDeductionNote(b)

                return (
                  <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 align-middle">
                      <div className="font-bold text-suka-ink text-sm leading-tight">{staffName}</div>
                      <div className="text-[11px] text-suka-brown font-semibold uppercase mt-0.5">
                        {roleName}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs font-semibold text-gray-700">
                      {outletName}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-xs font-mono font-medium text-gray-800 tabular-nums whitespace-nowrap">
                      {formatRupiah(b.basicSalary)}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-xs font-mono font-medium text-gray-800 tabular-nums whitespace-nowrap">
                      {totalTunjangan > 0 ? (
                        formatRupiah(totalTunjangan)
                      ) : (
                        <span className="text-stone-400 font-sans">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-xs font-mono font-medium text-emerald-700 tabular-nums">
                      {totalBonus > 0 ? (
                        <div>
                          <div className="font-bold whitespace-nowrap">+{formatRupiah(totalBonus)}</div>
                          {cleanBonus && (
                            <div
                              className="text-[10px] text-stone-500 font-sans font-normal leading-tight mt-0.5"
                              title={cleanBonus}
                            >
                              {cleanBonus}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-400 font-sans">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-xs font-mono font-medium text-red-600 tabular-nums">
                      {b.totalDeductions > 0 ? (
                        <div>
                          <div className="font-bold whitespace-nowrap">-{formatRupiah(b.totalDeductions)}</div>
                          {cleanDeduction && (
                            <div
                              className="text-[10px] text-stone-500 font-sans font-normal leading-tight mt-0.5"
                              title={cleanDeduction}
                            >
                              {cleanDeduction}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-400 font-sans">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-xs font-mono font-black text-suka-brown tabular-nums whitespace-nowrap">
                      {formatRupiah(b.takeHomePay)}
                    </td>
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      {r.status === 'finalized' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          Finalized
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-bold text-stone-600 border border-stone-200">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSlip(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition-all cursor-pointer"
                          title="Cetak PDF / Kirim WhatsApp"
                        >
                          <Eye size={13} />
                          <span>Slip</span>
                        </button>
                        {r.status !== 'finalized' && (
                          <button
                            onClick={() => onEdit(r)}
                            className="inline-flex items-center gap-1 rounded-lg border border-suka-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-suka-ink shadow-2xs hover:bg-stone-50 transition-all cursor-pointer"
                            title="Edit Komponen Gaji"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredAndSortedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                    {searchQuery ? (
                      <div className="space-y-2">
                        <p>
                          Tidak ada staf yang cocok dengan pencarian{' '}
                          <strong className="text-suka-brown font-semibold">"{searchQuery}"</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-xs text-suka-orange underline hover:text-suka-brown cursor-pointer"
                        >
                          Hapus filter pencarian
                        </button>
                      </div>
                    ) : (
                      'Belum ada data slip gaji untuk periode atau outlet yang dipilih.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSlip && (
        <SalarySlipModal slip={selectedSlip} onClose={() => setSelectedSlip(null)} />
      )}
    </>
  )
}
