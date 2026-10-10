'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Users,
  Store,
  ArrowUpRight,
  Wallet,
  Building2,
  PieChart,
  CheckCircle2,
  HelpCircle,
  Sparkles
} from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { HRPayrollSummary } from '@/app/actions/hrPayroll'
import type { ProrataInfo } from '@/lib/opexProrata'

export type OpexModalType = 'salary' | 'operational' | 'total' | null

export interface OperationalCategoryBreakdown {
  category: string
  label: string
  count: number
  totalAmount: number
  color?: string
  icon?: any
}

export interface OperationalOutletBreakdown {
  outletName: string
  count: number
  totalAmount: number
}

interface OpexCardDetailModalsProps {
  type: OpexModalType
  onClose: () => void
  salaryData: {
    displaySalary: number
    hasHrPayroll: boolean
    hrPayroll?: HRPayrollSummary
    cashSalary: number
    isProrated?: boolean
    prorataInfo?: ProrataInfo
  }
  operationalData: {
    totalNonSalary: number
    totalCount: number
    categories: OperationalCategoryBreakdown[]
    outlets: OperationalOutletBreakdown[]
  }
  totalOpexData: {
    totalCombined: number
    displaySalary: number
    totalNonSalary: number
    isProrated?: boolean
    prorataInfo?: ProrataInfo
  }
}

export function OpexCardDetailModals({
  type,
  onClose,
  salaryData,
  operationalData,
  totalOpexData
}: OpexCardDetailModalsProps) {
  const [operationalTab, setOperationalTab] = useState<'category' | 'outlet'>('category')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (type) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [type, onClose])

  if (!type) return null

  const { displaySalary, hasHrPayroll, hrPayroll, cashSalary, isProrated, prorataInfo } = salaryData
  const ratio = isProrated && prorataInfo?.ratio ? prorataInfo.ratio : 1
  const { totalNonSalary, totalCount: opCount, categories, outlets } = operationalData
  const { totalCombined } = totalOpexData

  const salaryShare = totalCombined > 0 ? (displaySalary / totalCombined) * 100 : 0
  const opShare = totalCombined > 0 ? (totalNonSalary / totalCombined) * 100 : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================== MODAL 1: SALARY DETAIL ==================== */}
        {type === 'salary' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                    <span>Rincian Gaji & Payroll</span>
                    {isProrated && prorataInfo && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                        <Sparkles size={11} className="text-amber-600" />
                        Prorata {prorataInfo.overlapDays} Hari
                      </span>
                    )}
                    {hrPayroll?.status === 'draft' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Draft HR
                      </span>
                    )}
                    {hrPayroll?.status === 'finalized' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Final
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isProrated && prorataInfo
                      ? `Beban gaji proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari bulan ini`
                      : 'Rincian beban gaji seluruh staf & crew serta status verifikasi'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
              {/* Stat Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100">
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                    {isProrated ? 'Beban Gaji Outlet (Prorata)' : 'Total Beban Gaji Outlet'}
                  </span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">
                    {rupiah(displaySalary)}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">
                    {hrPayroll && (hrPayroll.managerAllocation ?? 0) > 0
                      ? `Kru ${rupiah(Math.round((hrPayroll.crewSalary ?? (hrPayroll.totalSalary - (hrPayroll.managerAllocation ?? 0))) * ratio))} + AM/RM ${rupiah(Math.round((hrPayroll.managerAllocation ?? 0) * ratio))}`
                      : isProrated && prorataInfo
                      ? `Alokasi ${prorataInfo.overlapDays}/${prorataInfo.totalDays} hari (${(prorataInfo.ratio * 100).toFixed(1)}%)`
                      : hasHrPayroll ? 'Berdasarkan Modul HR' : 'Pencatatan Buku Kas'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Jumlah Kru Store
                  </span>
                  <span className="text-lg font-black text-slate-800 mt-1 block">
                    {hrPayroll?.crewCount ?? hrPayroll?.totalStaff ?? 0} Kru Store
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">
                    {hrPayroll?.managerDetails && hrPayroll.managerDetails.length > 0
                      ? `+${hrPayroll.managerDetails.length} Manajer (AM/RM)`
                      : `${hrPayroll?.finalizedCount ?? 0} Final · ${hrPayroll?.draftCount ?? 0} Draft`}
                  </span>
                </div>

                <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                    Status Dokumen
                  </span>
                  <span className="text-sm font-black text-amber-900 mt-1 block capitalize">
                    {hrPayroll?.status === 'finalized'
                      ? 'Sudah Difinalisasi'
                      : hrPayroll?.status === 'draft'
                      ? 'Draft HR Payroll'
                      : hrPayroll?.status === 'partial'
                      ? 'Sebagian Final'
                      : 'Belum Ada Payroll'}
                  </span>
                  <span className="text-[10px] text-amber-600 font-medium">
                    {hrPayroll?.draftCount ? `${hrPayroll.draftCount} staf menunggu finalisasi` : 'Semua staf terverifikasi'}
                  </span>
                </div>
              </div>

              {/* Prorata Info Alert */}
              {isProrated && prorataInfo && hasHrPayroll && hrPayroll && (
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed shadow-2xs">
                  <Sparkles size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Mode Prorata Harian Aktif:</span> Beban gaji dialokasikan sebesar{' '}
                    <strong>{prorataInfo.overlapDays} hari</strong> dari total{' '}
                    <strong>{prorataInfo.totalDays} hari</strong> ({((prorataInfo.ratio || 0) * 100).toFixed(1)}%)
                    mengikuti filter rentang tanggal yang dipilih. Baseline THP 1 bulan penuh adalah{' '}
                    <strong>{rupiah(hrPayroll.totalSalary)}</strong>.
                  </div>
                </div>
              )}

              {/* Breakdown Komponen: Gaji Pokok, Tunjangan, Bonus, Potongan (Murni Kru Store) */}
              {hasHrPayroll && hrPayroll && (
                <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet size={14} className="text-indigo-600" />
                      Komposisi Komponen Gaji HR (Kru Store) {isProrated ? '(Prorata)' : ''}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                      Subtotal Kru: {rupiah(Math.round((hrPayroll.crewSalary ?? hrPayroll.totalSalary) * ratio))}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] text-gray-500 font-semibold block uppercase">1. Gaji Pokok</span>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block mt-0.5">
                        {rupiah(Math.round((hrPayroll.crewBasicSalary ?? hrPayroll.basicSalary) * ratio))}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {isProrated ? `1 bln: ${rupiah(hrPayroll.crewBasicSalary ?? hrPayroll.basicSalary)}` : 'Gapok kru murni'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] text-emerald-600 font-semibold block uppercase">2. Tunjangan</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-700 block mt-0.5">
                        +{rupiah(Math.round((hrPayroll.crewAllowances ?? hrPayroll.allowances) * ratio))}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {isProrated ? `1 bln: +${rupiah(hrPayroll.crewAllowances ?? hrPayroll.allowances)}` : 'Makan, pulsa, transport'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] text-amber-600 font-semibold block uppercase">3. Bonus & Lembur</span>
                      <span className="text-xs sm:text-sm font-black text-amber-700 block mt-0.5">
                        +{rupiah(Math.round((hrPayroll.crewBonus ?? hrPayroll.bonus) * ratio))}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {isProrated ? `1 bln: +${rupiah(hrPayroll.crewBonus ?? hrPayroll.bonus)}` : 'Bonus omset & lembur'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] text-rose-600 font-semibold block uppercase">4. Potongan</span>
                      <span className="text-xs sm:text-sm font-black text-rose-700 block mt-0.5">
                        -{rupiah(Math.round((hrPayroll.crewDeductions ?? hrPayroll.deductions) * ratio))}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {isProrated ? `1 bln: -${rupiah(hrPayroll.crewDeductions ?? hrPayroll.deductions)}` : 'Kasbon, BPJS, denda'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-indigo-900 bg-white/80 p-2.5 rounded-lg border border-indigo-100/70 leading-relaxed shadow-2xs">
                    💡 <strong>Penjelasan Angka:</strong> Angka <strong>{rupiah(Math.round((hrPayroll.crewSalary ?? hrPayroll.totalSalary) * ratio))}</strong> adalah <em>Total Take Home Pay (THP)</em> murni milik <strong>{hrPayroll.crewCount ?? hrPayroll.totalStaff} staf kru store</strong>. Komponen di atas merupakan rincian gaji riil kru toko. Alokasi beban manajer regional (AM/RM) dialokasikan secara proporsional pada kotak di bawah.
                  </div>
                </div>
              )}

              {/* Manager Allocation Breakdown (AM & RM) */}
              {hasHrPayroll && hrPayroll?.managerDetails && hrPayroll.managerDetails.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white rounded-xl p-4 border border-indigo-100/90 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-600" />
                      Alokasi Beban Area Manager & Regional Manager
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-white/90 px-2 py-0.5 rounded-md border border-indigo-200/70 shadow-2xs">
                      Total: +{rupiah(isProrated ? Math.round((hrPayroll.managerAllocation || 0) * (prorataInfo?.ratio || 1)) : (hrPayroll.managerAllocation || 0))}
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-600 leading-relaxed">
                    Sesuai ketentuan operasional, beban gaji <strong>Area Manager (AM)</strong> dan <strong>Regional Manager (RM)</strong> dibebankan secara proporsional ke outlet binaan masing-masing:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    {hrPayroll.managerDetails.map((mgr) => {
                      const mgrAlloc = isProrated && prorataInfo ? Math.round(mgr.allocatedAmount * prorataInfo.ratio) : mgr.allocatedAmount
                      return (
                        <div key={mgr.staffId} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-black text-gray-900 text-xs truncate">{mgr.staffName}</span>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase shrink-0">
                              {mgr.role === 'regional_manager' ? 'Regional Mgr' : 'Area Mgr'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span className="text-gray-500 text-[11px]">Beban ke outlet ini:</span>
                            <span className="font-black text-indigo-700">+{rupiah(mgrAlloc)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center justify-between pt-0.5 border-t border-gray-100/80">
                            <span>Alokasi 1/{mgr.coachedOutletsCount} cabang</span>
                            <span>Gaji: {rupiah(mgr.totalSalary)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Source Comparison Info */}
              <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-200/70 text-xs space-y-2">
                <div className="font-bold text-gray-700 flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-indigo-600" />
                  <span>Komparasi Sumber Data Angka:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <div className="text-[11px] text-gray-400 font-semibold">1. Modul Payroll HR (THP):</div>
                    <div className="text-sm font-extrabold text-indigo-700">
                      {rupiah(hrPayroll?.totalSalary ?? 0)}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Dihitung otomatis per staf & outlet di modul HR
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                    <div className="text-[11px] text-gray-400 font-semibold">2. Kas Keluar Lembur / Gaji Langsung:</div>
                    <div className="text-sm font-extrabold text-gray-800">
                      {rupiah(cashSalary)}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {cashSalary > 0
                        ? 'Biaya lemburan/gaji tunai staf yang dibayarkan langsung via kas operasional'
                        : 'Tidak ada pengeluaran gaji langsung via buku kas'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Breakdown per Outlet */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Rincian Gaji per Outlet / Cabang</span>
                  <span className="text-gray-400 font-normal normal-case">
                    {hrPayroll?.outlets?.length || 0} unit cabang
                  </span>
                </h4>

                {(!hrPayroll?.outlets || hrPayroll.outlets.length === 0) ? (
                  <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-gray-200/60 text-xs">
                    <Users size={28} className="mx-auto mb-2 opacity-30 text-indigo-600" />
                    <p className="font-semibold text-gray-600">Tidak ada rincian data staf cabang</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Data payroll belum terisi atau filter outlet tidak memiliki staf.
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                          <tr>
                            <th className="px-3.5 py-2.5">Unit / Cabang</th>
                            <th className="px-3 py-2.5 text-center">Staf</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                            <th className="px-3.5 py-2.5 text-right">
                              {isProrated ? 'THP Prorata' : 'Subtotal THP'}
                            </th>
                            <th className="px-3 py-2.5 text-right">Porsi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {hrPayroll.outlets.map((item) => {
                            const ratio = isProrated && prorataInfo ? prorataInfo.ratio : 1
                            const outletSalary = Math.round(item.totalSalary * ratio)
                            const pct = displaySalary > 0 ? (outletSalary / displaySalary) * 100 : 0
                            return (
                              <tr key={item.outletId} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                  <div>{item.outletName}</div>
                                  {(item.managerAllocation ?? 0) > 0 && (
                                    <div className="text-[10px] text-indigo-600 font-medium mt-0.5">
                                      Kru: {rupiah(Math.round((item.crewSalary ?? (item.totalSalary - (item.managerAllocation ?? 0))) * ratio))} · AM/RM: +{rupiah(Math.round((item.managerAllocation ?? 0) * ratio))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold text-gray-600">
                                  {item.staffCount}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {item.status === 'finalized' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Final
                                    </span>
                                  ) : item.status === 'draft' ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      Draft
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {item.finalizedCount}F / {item.draftCount}D
                                    </span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-extrabold text-indigo-900 whitespace-nowrap">
                                  <div>{rupiah(outletSalary)}</div>
                                  {isProrated ? (
                                    <div className="text-[10px] font-normal text-gray-400">
                                      Baseline bln: {rupiah(item.totalSalary)}
                                    </div>
                                  ) : item.basicSalary && item.basicSalary !== item.totalSalary && (
                                    <div className="text-[10px] font-normal text-gray-400">
                                      Gapok: {rupiah(item.basicSalary)}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 whitespace-nowrap">
                                  {pct.toFixed(1)}%
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-bold">
                          <tr>
                            <td className="px-3.5 py-2.5 text-gray-700">Total Keseluruhan:</td>
                            <td className="px-3 py-2.5 text-center text-gray-700">{hrPayroll.totalStaff}</td>
                            <td className="px-3 py-2.5"></td>
                            <td className="px-3.5 py-2.5 text-right text-indigo-900 font-black">
                              <div>{rupiah(displaySalary)}</div>
                              {isProrated ? (
                                <div className="text-[10px] font-normal text-gray-500">
                                  Baseline 1 bln: {rupiah(hrPayroll.totalSalary)}
                                </div>
                              ) : hrPayroll.basicSalary > 0 && (
                                <div className="text-[10px] font-normal text-gray-500">
                                  Total Gapok: {rupiah(hrPayroll.basicSalary)}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-500">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Tutup
              </button>
            </div>
          </>
        )}

        {/* ==================== MODAL 2: OPERATIONAL DETAIL ==================== */}
        {type === 'operational' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                    Rincian Operasional Outlet & Pusat
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pengeluaran rutin cabang dan pusat di luar beban gaji (Listrik, Sewa, Wifi, dll.)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Controls */}
            <div className="px-4 sm:px-6 pt-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOperationalTab('category')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    operationalTab === 'category'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <PieChart size={13} />
                  <span>Per Kategori ({categories.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOperationalTab('outlet')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    operationalTab === 'outlet'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <Building2 size={13} />
                  <span>Per Cabang ({outlets.length})</span>
                </button>
              </div>

              <div className="text-xs font-extrabold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                Total: {rupiah(totalNonSalary)} ({opCount} trx)
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              {operationalTab === 'category' ? (
                /* Tab 1: Category Breakdown */
                <div className="space-y-3">
                  {categories.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-gray-200/60 text-xs">
                      <Store size={32} className="mx-auto mb-2 opacity-30 text-amber-600" />
                      <p className="font-semibold text-gray-600">Belum ada transaksi operasional</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Tidak ada pengeluaran operasional non-gaji pada filter ini.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto max-h-[360px] scrollbar-thin">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                            <tr>
                              <th className="px-3.5 py-2.5">Kategori Pengeluaran</th>
                              <th className="px-3 py-2.5 text-center">Trx</th>
                              <th className="px-3.5 py-2.5 text-right">Nominal</th>
                              <th className="px-3.5 py-2.5 w-32 text-right">Porsi (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {categories.map((cat) => {
                              const pct = totalNonSalary > 0 ? (cat.totalAmount / totalNonSalary) * 100 : 0
                              const IconComponent = cat.icon || Wallet
                              return (
                                <tr key={cat.category} className="hover:bg-amber-50/30 transition-colors">
                                  <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${cat.color || '#f59e0b'}15`, color: cat.color || '#d97706' }}
                                      >
                                        <IconComponent size={13} />
                                      </div>
                                      <span className="truncate">{cat.label}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-semibold text-gray-600">
                                    {cat.count}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-extrabold text-amber-900 whitespace-nowrap">
                                    {rupiah(cat.totalAmount)}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                        <div
                                          className="h-full bg-amber-500 rounded-full"
                                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                                        />
                                      </div>
                                      <span className="font-semibold text-gray-600 whitespace-nowrap min-w-[36px]">
                                        {pct.toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-bold">
                            <tr>
                              <td className="px-3.5 py-2.5 text-gray-700">Total Pengeluaran:</td>
                              <td className="px-3 py-2.5 text-center text-gray-700">{opCount}</td>
                              <td className="px-3.5 py-2.5 text-right text-amber-900 font-black">
                                {rupiah(totalNonSalary)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right text-gray-500">100%</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Tab 2: Outlet Breakdown */
                <div className="space-y-3">
                  {outlets.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-gray-200/60 text-xs">
                      <Building2 size={32} className="mx-auto mb-2 opacity-30 text-amber-600" />
                      <p className="font-semibold text-gray-600">Belum ada data cabang</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto max-h-[360px] scrollbar-thin">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                            <tr>
                              <th className="px-3.5 py-2.5">Unit / Cabang</th>
                              <th className="px-3 py-2.5 text-center">Trx</th>
                              <th className="px-3.5 py-2.5 text-right">Nominal</th>
                              <th className="px-3.5 py-2.5 w-32 text-right">Porsi (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {outlets.map((item) => {
                              const pct = totalNonSalary > 0 ? (item.totalAmount / totalNonSalary) * 100 : 0
                              return (
                                <tr key={item.outletName} className="hover:bg-amber-50/30 transition-colors">
                                  <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                    {item.outletName}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-semibold text-gray-600">
                                    {item.count}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-extrabold text-amber-900 whitespace-nowrap">
                                    {rupiah(item.totalAmount)}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                        <div
                                          className="h-full bg-amber-500 rounded-full"
                                          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                                        />
                                      </div>
                                      <span className="font-semibold text-gray-600 whitespace-nowrap min-w-[36px]">
                                        {pct.toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-bold">
                            <tr>
                              <td className="px-3.5 py-2.5 text-gray-700">Total Keseluruhan:</td>
                              <td className="px-3 py-2.5 text-center text-gray-700">{opCount}</td>
                              <td className="px-3.5 py-2.5 text-right text-amber-900 font-black">
                                {rupiah(totalNonSalary)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right text-gray-500">100%</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Tutup
              </button>
            </div>
          </>
        )}

        {/* ==================== MODAL 3: TOTAL OPEX DETAIL ==================== */}
        {type === 'total' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                    Rincian Akumulasi Total OPEX
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Penjumlahan transparan dari Beban Gaji & Payroll + Operasional Outlet & Pusat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
              {/* Grand Total Highlight */}
              <div className="bg-rose-50 p-4 sm:p-5 rounded-2xl border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">
                    Total Beban OPEX (Gabungan)
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-rose-900 mt-1 block tracking-tight">
                    {rupiah(totalCombined)}
                  </span>
                  <p className="text-xs text-rose-700 mt-1">
                    Akumulasi beban gaji staf/crew ditambah seluruh biaya operasional berjalan.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-rose-200/70 text-rose-800 border border-rose-300/60">
                    Gaji + Operasional
                  </span>
                </div>
              </div>

              {/* Composition Stacked Bar */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/70 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-700">Komposisi Beban OPEX</span>
                  <span className="text-gray-400">100% Beban</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3.5 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${salaryShare}%` }}
                    title={`Gaji & Payroll: ${salaryShare.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${opShare}%` }}
                    title={`Operasional: ${opShare.toFixed(1)}%`}
                  />
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                    <span className="font-semibold text-gray-700">
                      Gaji & Payroll: <strong className="text-indigo-700">{salaryShare.toFixed(1)}%</strong> ({rupiah(displaySalary)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                    <span className="font-semibold text-gray-700">
                      Operasional: <strong className="text-amber-700">{opShare.toFixed(1)}%</strong> ({rupiah(totalNonSalary)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Step by Step Breakdown Formula */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                  Rumus & Rincian Perhitungan
                </h4>

                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  {/* Item 1: Salary */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Users size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                          <span>1. Gaji & Payroll Staf</span>
                          {totalOpexData.isProrated && totalOpexData.prorataInfo && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Prorata {totalOpexData.prorataInfo.overlapDays} Hari
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {totalOpexData.isProrated && totalOpexData.prorataInfo
                            ? `Alokasi ${totalOpexData.prorataInfo.overlapDays}/${totalOpexData.prorataInfo.totalDays} hari (${((totalOpexData.prorataInfo.ratio || 0) * 100).toFixed(1)}%) dari baseline HR 1 bulan penuh`
                            : hasHrPayroll
                            ? `Beban gaji dari HR (${hrPayroll?.totalStaff} staf: ${hrPayroll?.finalizedCount} final, ${hrPayroll?.draftCount} draft)`
                            : 'Beban gaji tercatat di transaksi kas operasional'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-indigo-700 text-sm sm:text-base">
                        +{rupiah(displaySalary)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold">
                        {salaryShare.toFixed(1)}% dari total
                      </div>
                    </div>
                  </div>

                  {/* Item 2: Operational */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Store size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-xs sm:text-sm">
                          2. Operasional Outlet & Pusat
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Biaya rutin ({opCount} transaksi kas: listrik, sewa cabang, wifi, operasional toko)
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-amber-700 text-sm sm:text-base">
                        +{rupiah(totalNonSalary)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold">
                        {opShare.toFixed(1)}% dari total
                      </div>
                    </div>
                  </div>

                  {/* Summary Result */}
                  <div className="p-3.5 sm:p-4 bg-gray-50 flex items-center justify-between gap-3 font-bold">
                    <div className="text-xs sm:text-sm text-gray-800 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>Total OPEX Bersih (1 + 2):</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-rose-700 text-base sm:text-lg">
                        {rupiah(totalCombined)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
                <strong>Catatan Transparansi:</strong> Total OPEX ini menggabungkan beban payroll HR dan seluruh pengeluaran kas operasional cabang maupun pusat untuk memberikan gambaran beban usaha riil periode terpilih. Tabel transaksi di bawah tetap fokus memuat data kas pengeluaran riil yang tercatat di sistem.
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Tutup
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
