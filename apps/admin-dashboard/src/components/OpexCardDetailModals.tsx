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
  Sparkles,
  Award,
  Briefcase
} from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { HRPayrollSummary } from '@/app/actions/hrPayroll'
import type { ProrataInfo } from '@/lib/opexProrata'

export type OpexModalType = 'salary' | 'bonus' | 'bonus_kru' | 'bonus_manager' | 'operational' | 'total' | null

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
    displayRoutineSalary?: number
    displayBonus?: number
    displayCrewBonus?: number
    displayManagerBonus?: number
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
    displayRoutineSalary?: number
    displayBonus?: number
    displayCrewBonus?: number
    displayManagerBonus?: number
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
  const [salaryTab, setSalaryTab] = useState<'personnel' | 'outlet'>('personnel')

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

  const { displaySalary, displayRoutineSalary, displayBonus, displayCrewBonus, displayManagerBonus, hasHrPayroll, hrPayroll, isProrated, prorataInfo } = salaryData
  const ratio = isProrated && prorataInfo?.ratio ? prorataInfo.ratio : 1
  const bonusAmount = displayBonus ?? (hrPayroll ? Math.round(hrPayroll.bonus * ratio) : 0)
  const crewBonusAmount = displayCrewBonus ?? (hrPayroll ? Math.round((hrPayroll.crewBonus ?? 0) * ratio) : 0)
  const managerBonusAmount = displayManagerBonus ?? (hrPayroll ? Math.round((hrPayroll.managerBonusAllocation ?? 0) * ratio) : 0)
  const routineSalary = displayRoutineSalary ?? Math.max(0, displaySalary - bonusAmount)
  const { totalNonSalary, totalCount: opCount, categories, outlets } = operationalData
  const { totalCombined } = totalOpexData

  const routineSalaryShare = totalCombined > 0 ? (routineSalary / totalCombined) * 100 : 0
  const crewBonusShare = totalCombined > 0 ? (crewBonusAmount / totalCombined) * 100 : 0
  const managerBonusShare = totalCombined > 0 ? (managerBonusAmount / totalCombined) * 100 : 0
  const opShare = totalCombined > 0 ? (totalNonSalary / totalCombined) * 100 : 0

  const crewBonusList = (hrPayroll?.crewBonusDetails && hrPayroll.crewBonusDetails.length > 0)
    ? hrPayroll.crewBonusDetails
    : (hrPayroll?.bonusDetails
      ? hrPayroll.bonusDetails.filter(b => {
          const role = (b.role || '').toLowerCase()
          return !role.includes('manager') && !role.includes('controller')
        })
      : [])

  const managerBonusList = (hrPayroll?.managerBonusDetails && hrPayroll.managerBonusDetails.length > 0)
    ? hrPayroll.managerBonusDetails
    : (hrPayroll?.bonusDetails
      ? hrPayroll.bonusDetails.filter(b => {
          const role = (b.role || '').toLowerCase()
          return role.includes('manager') || role.includes('controller')
        })
      : [])

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
                    <span>Rincian Gaji & Payroll (Rutin)</span>
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
                      ? `Beban gaji rutin proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari bulan ini`
                      : 'Rincian beban gaji pokok, tunjangan, dan alokasi manajer (bonus omset dipisahkan)'}
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
                    {isProrated ? 'Beban Gaji Rutin (Prorata)' : 'Beban Gaji & Payroll (Rutin)'}
                  </span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">
                    {rupiah(routineSalary)}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">
                    {hrPayroll && (hrPayroll.managerAllocation ?? 0) > 0
                      ? `Kru ${rupiah(Math.round(((hrPayroll.crewSalary ?? (hrPayroll.totalSalary - (hrPayroll.managerAllocation ?? 0))) - (hrPayroll.crewBonus ?? hrPayroll.bonus)) * ratio))} + AM/RM/SC ${rupiah(Math.round((hrPayroll.managerAllocation ?? 0) * ratio))}`
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
                      ? `+${hrPayroll.managerDetails.length} Manajer/Pusat`
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

              {/* Breakdown Komponen: Gaji Pokok, Tunjangan, Potongan (Murni Kru Store) */}
              {hasHrPayroll && hrPayroll && (
                <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet size={14} className="text-indigo-600" />
                      Komposisi Komponen Gaji HR (Kru Store - Gaji Rutin) {isProrated ? '(Prorata)' : ''}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                      Subtotal Kru Rutin: {rupiah(Math.round(((hrPayroll.crewSalary ?? hrPayroll.totalSalary) - (hrPayroll.crewBonus ?? hrPayroll.bonus)) * ratio))}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
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
                      <span className="text-[10px] text-rose-600 font-semibold block uppercase">3. Potongan</span>
                      <span className="text-xs sm:text-sm font-black text-rose-700 block mt-0.5">
                        -{rupiah(Math.round((hrPayroll.crewDeductions ?? hrPayroll.deductions) * ratio))}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {isProrated ? `1 bln: -${rupiah(hrPayroll.crewDeductions ?? hrPayroll.deductions)}` : 'Kasbon, BPJS, denda'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-indigo-900 bg-white/80 p-2.5 rounded-lg border border-indigo-100/70 leading-relaxed shadow-2xs">
                    💡 <strong>Penjelasan Angka:</strong> Angka <strong>{rupiah(Math.round(((hrPayroll.crewSalary ?? hrPayroll.totalSalary) - (hrPayroll.crewBonus ?? hrPayroll.bonus)) * ratio))}</strong> adalah <em>Gaji Pokok & Tunjangan</em> rutin {hrPayroll.crewCount ?? hrPayroll.totalStaff} kru toko (tanpa bonus). Ditambah alokasi beban rutin AM/RM/SC sebesar <strong>+{rupiah(isProrated ? Math.round((hrPayroll.managerAllocation || 0) * (prorataInfo?.ratio || 1)) : (hrPayroll.managerAllocation || 0))}</strong>, Total Beban Gaji Rutin Outlet (Card 1) adalah <strong>{rupiah(routineSalary)}</strong>. Bonus omset penjualan (Kru & AM/RM) sebesar <strong>+{rupiah(bonusAmount)}</strong> dipisahkan ke <em>Card 2 (Bonus & Insentif)</em>.
                  </div>
                </div>
              )}

              {/* Manager & Central Staff Allocation Breakdown (AM, RM, Stock Controller) */}
              {hasHrPayroll && hrPayroll?.managerDetails && hrPayroll.managerDetails.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white rounded-xl p-4 border border-indigo-100/90 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-600" />
                      Alokasi Beban Rutin AM, RM, & Stock Controller
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-white/90 px-2 py-0.5 rounded-md border border-indigo-200/70 shadow-2xs">
                      Total Rutin: +{rupiah(isProrated ? Math.round((hrPayroll.managerAllocation || 0) * (prorataInfo?.ratio || 1)) : (hrPayroll.managerAllocation || 0))}
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-600 leading-relaxed">
                    Sesuai ketentuan operasional, beban gaji rutin <strong>Area Manager (AM)</strong>, <strong>Regional Manager (RM)</strong>, dan <strong>Stock Controller</strong> dibebankan secara proporsional ke outlet binaan masing-masing (bonus omset dipisahkan ke Card Bonus):
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    {hrPayroll.managerDetails.map((mgr) => {
                      const mgrRoutine = mgr.routineAmount ?? (mgr.allocatedAmount - (mgr.bonusAmount || 0))
                      const mgrAlloc = isProrated && prorataInfo ? Math.round(mgrRoutine * prorataInfo.ratio) : mgrRoutine
                      return (
                        <div key={mgr.staffId} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-black text-gray-900 text-xs truncate">{mgr.staffName}</span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                              mgr.role === 'stock_controller'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : mgr.role === 'regional_manager'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}>
                              {mgr.role === 'stock_controller'
                                ? 'Stock Controller'
                                : mgr.role === 'regional_manager'
                                ? 'Regional Mgr'
                                : 'Area Mgr'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span className="text-gray-500 text-[11px]">Beban rutin ke outlet ini:</span>
                            <span className="font-black text-indigo-700">+{rupiah(mgrAlloc)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center justify-between pt-0.5 border-t border-gray-100/80">
                            <span>Alokasi 1/{mgr.coachedOutletsCount} cabang</span>
                            {mgr.bonusAmount && mgr.bonusAmount > 0 ? (
                              <span className="text-amber-700 font-semibold" title={`Bonus omset alokasi Rp ${rupiah(mgr.bonusAmount)} dipisahkan ke Card Bonus`}>
                                Bonus: +{rupiah(mgr.bonusAmount)}
                              </span>
                            ) : (
                              <span>Gaji: {rupiah(mgr.totalSalary)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Table Breakdown per Personel & Outlet */}
              {(() => {
                const allStaff = hrPayroll?.staffDetails || []
                const crewList = allStaff.filter(s => !s.isManagerAllocation)
                const managerList = allStaff.filter(s => s.isManagerAllocation)

                const crewGapokTotal = crewList.reduce((sum, s) => sum + s.basicSalary, 0) * ratio
                const crewTunjTotal = crewList.reduce((sum, s) => sum + s.allowances, 0) * ratio
                const crewRoutineTotal = crewList.reduce((sum, s) => sum + s.routineSalary, 0) * ratio
                const crewBonusTotal = crewList.reduce((sum, s) => sum + s.bonus, 0) * ratio
                const crewThpTotal = crewList.reduce((sum, s) => sum + s.totalSalary, 0) * ratio

                const mgrRoutineTotal = managerList.reduce((sum, m) => sum + (m.allocatedAmount ?? m.routineSalary), 0) * ratio

                const grandRoutine = crewRoutineTotal + mgrRoutineTotal
                const grandBonus = crewBonusTotal
                const grandTotal = grandRoutine + grandBonus

                return (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Users size={15} className="text-indigo-600" />
                          <span>Rincian Beban Gaji per Personel (Kru Store & Alokasi AM/RM/SC)</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Rincian per nama kru toko ditambah beban alokasi manajer operasional & pengendali stok
                        </p>
                      </div>

                      {hrPayroll?.outlets && hrPayroll.outlets.length > 1 && (
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => setSalaryTab('personnel')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              salaryTab === 'personnel'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Per Personel ({allStaff.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setSalaryTab('outlet')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              salaryTab === 'outlet'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Per Cabang ({hrPayroll.outlets.length})
                          </button>
                        </div>
                      )}
                    </div>

                    {salaryTab === 'personnel' ? (
                      <div>
                        {allStaff.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-gray-200/60 text-xs">
                            <Users size={28} className="mx-auto mb-2 opacity-30 text-indigo-600" />
                            <p className="font-semibold text-gray-600">Tidak ada rincian data staf</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Data payroll staf belum terisi atau filter tidak memiliki staf aktif.
                            </p>
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                            <div className="overflow-x-auto max-h-[380px] scrollbar-thin">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                                  <tr>
                                    <th className="px-3.5 py-2.5">Nama Personel & Posisi</th>
                                    <th className="px-2.5 py-2.5 text-center">Status</th>
                                    <th className="px-3 py-2.5 text-right">Gaji Pokok</th>
                                    <th className="px-3 py-2.5 text-right">Tunjangan</th>
                                    <th className="px-3.5 py-2.5 text-right bg-indigo-50/60 text-indigo-900">
                                      Gaji Rutin
                                    </th>
                                    <th className="px-3 py-2.5 text-right bg-amber-50/60 text-amber-800">
                                      Sales Bonus
                                    </th>
                                    <th className="px-3.5 py-2.5 text-right">
                                      Total Beban (THP)
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {/* 1. SEKSI KRU TOKO */}
                                  {crewList.length > 0 && (
                                    <tr className="bg-indigo-50/70 border-y border-indigo-100/80 font-extrabold text-indigo-950 text-[11px]">
                                      <td colSpan={7} className="px-3.5 py-2">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <span className="flex items-center gap-1.5 uppercase tracking-wider text-xs">
                                            <Users size={13} className="text-indigo-600" />
                                            1. Kru Toko Cabang ({crewList.length} orang)
                                          </span>
                                          <span className="text-[10px] font-bold text-indigo-800 bg-white/90 px-2 py-0.5 rounded border border-indigo-200 shadow-2xs">
                                            Subtotal THP Kru: {rupiah(Math.round(crewThpTotal))} (Rutin: {rupiah(Math.round(crewRoutineTotal))} + Bonus: +{rupiah(Math.round(crewBonusTotal))})
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  {crewList.map((s) => (
                                    <tr key={s.staffId} className="hover:bg-indigo-50/30 transition-colors">
                                      <td className="px-3.5 py-2.5">
                                        <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5 flex-wrap">
                                          <span>{s.staffName}</span>
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                            {s.role.replace(/_/g, ' ')}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                          {s.outletName || 'Kru Cabang'}
                                        </div>
                                      </td>
                                      <td className="px-2.5 py-2.5 text-center">
                                        {s.status === 'finalized' ? (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            Final
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                            Draft
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-medium text-gray-700 whitespace-nowrap">
                                        {rupiah(Math.round(s.basicSalary * ratio))}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-medium text-emerald-700 whitespace-nowrap">
                                        {s.allowances > 0 ? `+${rupiah(Math.round(s.allowances * ratio))}` : 'Rp 0'}
                                      </td>
                                      <td className="px-3.5 py-2.5 text-right font-extrabold text-indigo-900 bg-indigo-50/30 whitespace-nowrap">
                                        {rupiah(Math.round(s.routineSalary * ratio))}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-bold text-amber-700 bg-amber-50/30 whitespace-nowrap">
                                        {s.bonus > 0 ? `+${rupiah(Math.round(s.bonus * ratio))}` : <span className="text-gray-300">-</span>}
                                      </td>
                                      <td className="px-3.5 py-2.5 text-right font-black text-gray-900 whitespace-nowrap">
                                        {rupiah(Math.round(s.totalSalary * ratio))}
                                      </td>
                                    </tr>
                                  ))}

                                  {/* 2. SEKSI ALOKASI MANAJEMEN & SC */}
                                  {managerList.length > 0 && (
                                    <tr className="bg-purple-50/70 border-y border-purple-100/80 font-extrabold text-purple-950 text-[11px]">
                                      <td colSpan={7} className="px-3.5 py-2">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <span className="flex items-center gap-1.5 uppercase tracking-wider text-xs">
                                            <Building2 size={13} className="text-purple-600" />
                                            2. Alokasi Beban AM, RM, & Stock Controller ({managerList.length} orang)
                                          </span>
                                          <span className="text-[10px] font-bold text-purple-800 bg-white/90 px-2 py-0.5 rounded border border-purple-200 shadow-2xs">
                                            Subtotal Alokasi: +{rupiah(Math.round(mgrRoutineTotal))}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  {managerList.map((m) => (
                                    <tr key={m.staffId} className="hover:bg-purple-50/30 transition-colors bg-purple-50/15">
                                      <td className="px-3.5 py-2.5">
                                        <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5 flex-wrap">
                                          <span>{m.staffName}</span>
                                          <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border uppercase shrink-0 ${
                                            m.role === 'stock_controller'
                                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                                              : m.role === 'regional_manager'
                                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                                              : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                          }`}>
                                            {m.role === 'stock_controller'
                                              ? 'Stock Controller'
                                              : m.role === 'regional_manager'
                                              ? 'Regional Mgr'
                                              : 'Area Mgr'}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-indigo-600 font-medium mt-0.5">
                                          {m.allocationNote || 'Beban Operasional Pusat'}
                                        </div>
                                      </td>
                                      <td className="px-2.5 py-2.5 text-center">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          Final
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-normal text-gray-400 whitespace-nowrap text-[11px]">
                                        -
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-normal text-gray-400 whitespace-nowrap text-[11px]">
                                        -
                                      </td>
                                      <td className="px-3.5 py-2.5 text-right font-extrabold text-indigo-900 bg-indigo-50/30 whitespace-nowrap">
                                        +{rupiah(Math.round((m.allocatedAmount ?? m.routineSalary) * ratio))}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-normal text-gray-400 bg-amber-50/30 whitespace-nowrap text-[11px]">
                                        -
                                      </td>
                                      <td className="px-3.5 py-2.5 text-right font-black text-indigo-950 whitespace-nowrap">
                                        +{rupiah(Math.round((m.allocatedAmount ?? m.totalSalary) * ratio))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-300 text-xs font-bold">
                                  <tr>
                                    <td colSpan={2} className="px-3.5 py-2.5 text-gray-800 font-black">
                                      Total Keseluruhan ({allStaff.length} Personel):
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">
                                      {rupiah(Math.round(crewGapokTotal))}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-emerald-700 whitespace-nowrap">
                                      +{rupiah(Math.round(crewTunjTotal))}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right text-indigo-900 font-black bg-indigo-50/80 whitespace-nowrap">
                                      {rupiah(Math.round(grandRoutine))}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right text-amber-700 font-black bg-amber-50/80 whitespace-nowrap">
                                      +{rupiah(Math.round(grandBonus))}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right text-rose-700 font-black text-sm whitespace-nowrap">
                                      {rupiah(Math.round(grandTotal))}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Outlet Summary Table (when per cabang view is selected) */
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
                              {(hrPayroll?.outlets || []).map((item) => {
                                const outletSalary = Math.round(item.totalSalary * ratio)
                                const pct = displaySalary > 0 ? (outletSalary / displaySalary) * 100 : 0
                                return (
                                  <tr key={item.outletId} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                      <div>{item.outletName}</div>
                                      {(item.managerAllocation ?? 0) > 0 && (
                                        <div className="text-[10px] text-indigo-600 font-medium mt-0.5">
                                          Kru: {rupiah(Math.round((item.crewSalary ?? (item.totalSalary - (item.managerAllocation ?? 0))) * ratio))} · AM/RM/SC: +{rupiah(Math.round((item.managerAllocation ?? 0) * ratio))}
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
                                <td className="px-3 py-2.5 text-center text-gray-700">{hrPayroll?.totalStaff ?? 0}</td>
                                <td className="px-3 py-2.5"></td>
                                <td className="px-3.5 py-2.5 text-right text-indigo-900 font-black">
                                  <div>{rupiah(displaySalary)}</div>
                                  {isProrated ? (
                                    <div className="text-[10px] font-normal text-gray-500">
                                      Baseline 1 bln: {rupiah(hrPayroll?.totalSalary ?? 0)}
                                    </div>
                                  ) : hrPayroll && hrPayroll.basicSalary > 0 && (
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
                )
              })()}
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

        {/* ==================== MODAL 4A: BONUS & INSENTIF KRU TOKO ==================== */}
        {(type === 'bonus_kru' || type === 'bonus') && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-amber-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                    <span>Rincian Bonus & Insentif Kru Toko</span>
                    {isProrated && prorataInfo && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                        <Sparkles size={11} className="text-amber-600" />
                        Prorata {prorataInfo.overlapDays} Hari
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Bonus Kru
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isProrated && prorataInfo
                      ? `Bonus omset proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari periode`
                      : 'Rincian perolehan bonus omset bulanan dan insentif khusus kru toko'}
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
                <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                    {isProrated ? 'Bonus Kru (Prorata)' : 'Total Bonus Kru Toko'}
                  </span>
                  <span className="text-lg font-black text-amber-900 mt-1 block">
                    +{rupiah(crewBonusAmount)}
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold">
                    {isProrated && prorataInfo
                      ? `Baseline sebulan: +${rupiah(hrPayroll?.crewBonus ?? 0)}`
                      : 'Murni insentif target penjualan toko'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Kru Penerima Bonus
                  </span>
                  <span className="text-lg font-black text-slate-800 mt-1 block">
                    {crewBonusList.length} Orang
                  </span>
                  <span className="text-[10px] text-gray-500 font-semibold">
                    Kru operasional outlet
                  </span>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Porsi Dari Total OPEX
                  </span>
                  <span className="text-lg font-black text-emerald-900 mt-1 block">
                    {crewBonusShare.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    Beban variabel berbasis target toko
                  </span>
                </div>
              </div>

              {/* Explanatory Policy Alert */}
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed shadow-2xs">
                <Sparkles size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Ketentuan Bonus Kru Toko:</span> Bonus ini adalah bonus penjualan (omset) bulanan yang dibagikan langsung kepada kru outlet berdasarkan pencapaian target penjualan outlet, dipisahkan dari gaji pokok & tunjangan rutin agar struktur biaya tetap (*fixed cost*) dan variabel (*variable cost*) dapat dipantau terpisah.
                </div>
              </div>

              {/* Table Breakdown per Staf Penerima */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Daftar Kru Penerima Bonus</span>
                  <span className="text-gray-400 font-normal normal-case">
                    {crewBonusList.length} orang
                  </span>
                </h4>

                {crewBonusList.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-gray-200/60 text-xs">
                    <Award size={28} className="mx-auto mb-2 opacity-30 text-amber-600" />
                    <p className="font-semibold text-gray-600">Tidak ada data bonus kru pada periode ini</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Belum ada bonus omset penjualan kru yang tercatat di payroll.
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-[280px] scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                          <tr>
                            <th className="px-3.5 py-2.5">Nama Kru</th>
                            <th className="px-3 py-2.5 text-center">Peran</th>
                            {crewBonusList.some(b => b.outletName) && (
                              <th className="px-3.5 py-2.5">Unit / Cabang</th>
                            )}
                            <th className="px-3 py-2.5 text-center">Status</th>
                            <th className="px-3.5 py-2.5 text-right">
                              {isProrated ? 'Bonus Prorata' : 'Bonus Omset'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {crewBonusList.map((staff) => {
                            const staffBonus = isProrated && prorataInfo ? Math.round(staff.bonus * prorataInfo.ratio) : staff.bonus
                            return (
                              <tr key={staff.staffId} className="hover:bg-amber-50/30 transition-colors">
                                <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                  {staff.staffName}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                                    {staff.role || 'crew'}
                                  </span>
                                </td>
                                {crewBonusList.some(b => b.outletName) && (
                                  <td className="px-3.5 py-2.5 text-gray-600 font-medium">
                                    {staff.outletName || '-'}
                                  </td>
                                )}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    staff.status === 'finalized'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {staff.status === 'finalized' ? 'Final' : 'Draft'}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-black text-amber-700">
                                  +{rupiah(staffBonus)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-amber-50/70 border-t border-amber-200 font-bold text-xs text-amber-950">
                          <tr>
                            <td colSpan={crewBonusList.some(b => b.outletName) ? 4 : 3} className="px-3.5 py-2.5 text-right font-extrabold uppercase">
                              Total Bonus Kru Toko:
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-black text-amber-800">
                              +{rupiah(crewBonusAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500 font-semibold">
                Total Beban Bonus Kru: <strong className="text-amber-700">+{rupiah(crewBonusAmount)}</strong>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Tutup
              </button>
            </div>
          </>
        )}

        {/* ==================== MODAL 4B: BONUS SALES AM & RM ==================== */}
        {type === 'bonus_manager' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-purple-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 shadow-2xs">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                    <span>Rincian Bonus Sales AM & RM</span>
                    {isProrated && prorataInfo && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1 shadow-2xs">
                        <Sparkles size={11} className="text-purple-600" />
                        Prorata {prorataInfo.overlapDays} Hari
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      Alokasi Pengawas
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isProrated && prorataInfo
                      ? `Bonus omset manajerial proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari periode`
                      : 'Rincian alokasi bonus omset penjualan Area Manager dan Regional Manager'}
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
                <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200/80">
                  <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">
                    {isProrated ? 'Bonus AM & RM (Prorata)' : 'Total Alokasi Bonus AM & RM'}
                  </span>
                  <span className="text-lg font-black text-purple-900 mt-1 block">
                    +{rupiah(managerBonusAmount)}
                  </span>
                  <span className="text-[10px] text-purple-700 font-semibold">
                    {isProrated && prorataInfo
                      ? `Baseline sebulan: +${rupiah(hrPayroll?.managerBonusAllocation ?? 0)}`
                      : 'Proporsi alokasi ke cabang'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Pengawas Penerima
                  </span>
                  <span className="text-lg font-black text-slate-800 mt-1 block">
                    {managerBonusList.length} Orang
                  </span>
                  <span className="text-[10px] text-gray-500 font-semibold">
                    Area & Regional Manager
                  </span>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Porsi Dari Total OPEX
                  </span>
                  <span className="text-lg font-black text-emerald-900 mt-1 block">
                    {managerBonusShare.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    Beban insentif kepengawasan
                  </span>
                </div>
              </div>

              {/* Explanatory Policy Alert */}
              <div className="bg-purple-50/80 border border-purple-200/90 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-purple-900 leading-relaxed shadow-2xs">
                <Sparkles size={16} className="text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Ketentuan Bonus Sales AM & RM:</span> Bonus ini adalah alokasi proporsional bonus omset penjualan bulanan untuk pengawas operasional lapangan:
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li><strong>Area Manager (AM):</strong> Dibagi rata ke cabang binaan aktif (contoh: 1/5 cabang).</li>
                    <li><strong>Regional Manager (RM):</strong> Dibagi rata ke seluruh cabang wilayah binaan (contoh: 1/21 cabang).</li>
                  </ul>
                  Alokasi ini dipisahkan dari gaji rutin dan bonus kru toko agar transparansi performa dan akuntabilitas manajerial tercatat jelas.
                </div>
              </div>

              {/* Table Breakdown per Manager Penerima */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Daftar Pengawas Penerima Bonus</span>
                  <span className="text-gray-400 font-normal normal-case">
                    {managerBonusList.length} orang
                  </span>
                </h4>

                {managerBonusList.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-gray-200/60 text-xs">
                    <Briefcase size={28} className="mx-auto mb-2 opacity-30 text-purple-600" />
                    <p className="font-semibold text-gray-600">Tidak ada alokasi bonus AM & RM pada periode ini</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Belum ada bonus omset pengawas yang dialokasikan ke cabang ini.
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-[280px] scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                          <tr>
                            <th className="px-3.5 py-2.5">Nama Pengawas</th>
                            <th className="px-3 py-2.5 text-center">Peran / Posisi</th>
                            <th className="px-3.5 py-2.5">Skema Alokasi Cabang</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                            <th className="px-3.5 py-2.5 text-right">
                              {isProrated ? 'Alokasi Prorata' : 'Alokasi Bonus'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {managerBonusList.map((mgr) => {
                            const staffBonus = isProrated && prorataInfo ? Math.round(mgr.bonus * prorataInfo.ratio) : mgr.bonus
                            return (
                              <tr key={mgr.staffId} className="hover:bg-purple-50/30 transition-colors">
                                <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                  {mgr.staffName}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                                    {mgr.role === 'regional_manager' ? 'Regional Manager' : mgr.role === 'area_manager' ? 'Area Manager' : (mgr.role || 'manager')}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-gray-600 font-medium">
                                  {mgr.outletName || '-'}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    mgr.status === 'finalized'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {mgr.status === 'finalized' ? 'Final' : 'Draft'}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-black text-purple-700">
                                  +{rupiah(staffBonus)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-purple-50/70 border-t border-purple-200 font-bold text-xs text-purple-950">
                          <tr>
                            <td colSpan={4} className="px-3.5 py-2.5 text-right font-extrabold uppercase">
                              Total Alokasi Bonus AM & RM:
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-black text-purple-800">
                              +{rupiah(managerBonusAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500 font-semibold">
                Total Alokasi Bonus AM & RM: <strong className="text-purple-700">+{rupiah(managerBonusAmount)}</strong>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
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
                    style={{ width: `${routineSalaryShare}%` }}
                    title={`Gaji Rutin: ${routineSalaryShare.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${crewBonusShare}%` }}
                    title={`Bonus Kru Toko: ${crewBonusShare.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${managerBonusShare}%` }}
                    title={`Bonus Sales AM & RM: ${managerBonusShare.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${opShare}%` }}
                    title={`Operasional: ${opShare.toFixed(1)}%`}
                  />
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                    <span className="font-semibold text-gray-700">
                      Gaji Rutin: <strong className="text-indigo-700">{routineSalaryShare.toFixed(1)}%</strong> ({rupiah(routineSalary)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                    <span className="font-semibold text-gray-700">
                      Bonus Kru: <strong className="text-amber-700">{crewBonusShare.toFixed(1)}%</strong> ({rupiah(crewBonusAmount)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" />
                    <span className="font-semibold text-gray-700">
                      Bonus AM/RM: <strong className="text-purple-700">{managerBonusShare.toFixed(1)}%</strong> ({rupiah(managerBonusAmount)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    <span className="font-semibold text-gray-700">
                      Operasional: <strong className="text-emerald-700">{opShare.toFixed(1)}%</strong> ({rupiah(totalNonSalary)})
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
                          <span>1. Gaji & Payroll (Rutin)</span>
                          {totalOpexData.isProrated && totalOpexData.prorataInfo && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Prorata {totalOpexData.prorataInfo.overlapDays} Hari
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Gaji pokok, tunjangan rutin kru, dan alokasi rutin manajer di luar bonus omset
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-indigo-700 text-sm sm:text-base">
                        +{rupiah(routineSalary)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold">
                        {routineSalaryShare.toFixed(1)}% dari total
                      </div>
                    </div>
                  </div>

                  {/* Item 2: Bonus Kru Toko */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Award size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-xs sm:text-sm">
                          2. Bonus & Insentif Kru Toko
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Bonus omset penjualan bulanan & lembur yang dicapai kru toko
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-amber-700 text-sm sm:text-base">
                        +{rupiah(crewBonusAmount)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold">
                        {crewBonusShare.toFixed(1)}% dari total
                      </div>
                    </div>
                  </div>

                  {/* Item 3: Bonus Sales AM & RM */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-xs sm:text-sm">
                          3. Bonus Sales AM & RM
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Alokasi proporsional bonus omset Area Manager (1/5) dan Regional Manager (1/21)
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-purple-700 text-sm sm:text-base">
                        +{rupiah(managerBonusAmount)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold">
                        {managerBonusShare.toFixed(1)}% dari total
                      </div>
                    </div>
                  </div>

                  {/* Item 4: Operational */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Store size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-xs sm:text-sm">
                          4. Operasional Outlet & Pusat
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Biaya rutin ({opCount} transaksi kas: listrik, sewa cabang, wifi, operasional toko)
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-emerald-700 text-sm sm:text-base">
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
                      <span>Total OPEX Bersih (1 + 2 + 3 + 4):</span>
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
