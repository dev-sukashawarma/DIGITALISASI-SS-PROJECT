'use client'

import { useState } from 'react'
import { Eye, Edit2 } from 'lucide-react'
import type { PayrollRecord } from '@/lib/types'
import { formatRupiah } from '@/lib/format'
import { SalarySlipModal } from './modules/SalarySlipModal'
import { getPayrollBreakdown } from '@/lib/payrollBreakdown'

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
      <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-suka-gray-200 bg-[#FDF9F3] text-suka-brown font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Nama &amp; Jabatan</th>
                <th className="px-4 py-3.5">Outlet</th>
                <th className="px-4 py-3.5 text-right">Gaji Pokok</th>
                <th className="px-4 py-3.5 text-right">Tunjangan</th>
                <th className="px-4 py-3.5 text-right">Potongan</th>
                <th className="px-4 py-3.5 text-right bg-amber-100/50 text-suka-orange font-black">THP Rutin</th>
                <th className="px-4 py-3.5 text-right text-emerald-700">Bonus / OT</th>
                <th className="px-4 py-3.5 text-right font-black">Total Ditransfer</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100">
              {rows.map((r) => {
                const b = getPayrollBreakdown(r)

                return (
                  <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-suka-ink text-sm">{r.outlet_staff?.name || 'Staff'}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-xs text-suka-brown font-semibold uppercase">
                          {r.outlet_staff?.role?.replace('_', ' ')}
                        </span>
                        {((r.outlet_staff?.contract_type === 'daily' || r.outlet_staff?.sub_role === 'crew_backup')) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-300 shadow-2xs">
                            Backup
                          </span>
                        )}
                        {((r.outlet_staff?.contract_type === 'probation' || r.outlet_staff?.sub_role === 'crew_trainee')) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                            Trainee
                          </span>
                        )}
                        {((r.outlet_staff?.contract_type === 'intern' || r.outlet_staff?.onboarding_stage === 'ojt')) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300 shadow-2xs">
                            OJT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                      {r.outlet_staff?.outlets?.name || 'Pusat'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-medium text-gray-700">
                      {formatRupiah(b.basicSalary)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-medium text-gray-700">
                      {formatRupiah(b.totalAllowances)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-medium text-red-600">
                      {b.totalDeductions > 0 ? (
                        <div>
                          <div>-{formatRupiah(b.totalDeductions)}</div>
                          {r.deduction_note && (
                            <div className="text-[10px] text-gray-400 font-sans truncate max-w-[140px] text-right" title={r.deduction_note}>
                              {r.deduction_note}
                            </div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-bold text-suka-brown bg-amber-50/30">
                      {formatRupiah(b.routineThp)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-medium text-emerald-700">
                      {b.totalBonus > 0 ? (
                        <div>
                          <div>+{formatRupiah(b.totalBonus)}</div>
                          {r.bonus_note && (
                            <div className="text-[10px] text-gray-400 font-sans truncate max-w-[120px] text-right" title={r.bonus_note}>
                              {r.bonus_note}
                            </div>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-black text-suka-ink">
                      {formatRupiah(b.takeHomePay)}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'finalized' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          Finalized
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-600 border border-stone-200">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
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
                    Belum ada data slip gaji untuk periode ini. Klik &ldquo;Generate Slip&rdquo; untuk membuat draft slip baru.
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
