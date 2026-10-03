'use client'

import { useState } from 'react'
import { Eye, Edit2 } from 'lucide-react'
import type { PayrollRecord } from '@/lib/types'
import { formatRupiah } from '@/lib/format'
import { SalarySlipModal } from './SalarySlipModal'
import { getPayrollBreakdown } from '@/lib/payrollBreakdown'
import { isRendyOrDeveloperStaff } from '@/lib/staffFilters'

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

export function PayrollTable({
  rows,
  onEdit,
}: {
  rows: PayrollRecord[]
  onEdit: (slip: PayrollRecord) => void
}) {
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null)

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1180px]">
            <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 whitespace-nowrap min-w-[190px]">Nama &amp; Jabatan</th>
                <th className="px-4 py-3.5 whitespace-nowrap min-w-[170px]">Outlet</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right min-w-[125px]">Gaji Pokok</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right min-w-[115px]">Tunjangan</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right min-w-[165px]">Bonus / OT</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right min-w-[175px]">Potongan</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right min-w-[145px]">Total Bersih (THP)</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-center min-w-[95px]">Status</th>
                <th className="px-4 py-3.5 whitespace-nowrap text-right min-w-[115px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {rows.map((r) => {
                const b = getPayrollBreakdown(r)
                const totalTunjangan =
                  b.mealAllowance + b.transportAllowance + b.communicationAllowance + b.positionAllowance
                const totalBonus = b.overtime + b.salesBonus
                const cleanBonus = getCleanBonusNote(r, b)
                const cleanDeduction = getCleanDeductionNote(b)

                return (
                  <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 align-middle">
                      <div className="font-bold text-suka-ink text-sm leading-tight">
                        {r.outlet_staff?.name || 'Staff'}
                      </div>
                      <div className="text-[11px] text-suka-brown font-semibold uppercase mt-0.5">
                        {r.outlet_staff?.role?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs font-semibold text-gray-700">
                      {isRendyOrDeveloperStaff(r.outlet_staff as any)
                        ? 'Kantor Pusat'
                        : r.outlet_staff?.outlets?.name || 'Pusat'}
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

              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-suka-gray-500 font-medium">
                    Belum ada data slip gaji untuk periode atau outlet yang dipilih.
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
