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
  Briefcase,
  Clock,
  Info,
  Calendar,
  Calculator
} from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { HRPayrollSummary } from '@/lib/server/ringkasanPayrollHr'
import type { ProrataInfo } from '@/lib/opexProrata'

function formatBackupDates(dates: string[]): string {
  if (!dates || dates.length === 0) return ''
  const sorted = Array.from(new Set(dates)).sort()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const byMonth = new Map<string, number[]>()
  sorted.forEach(d => {
    const parts = d.split('-').map(Number)
    if (parts.length >= 3) {
      const [, m, day] = parts
      const key = `${months[m - 1]}`
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(day)
    }
  })
  const res: string[] = []
  byMonth.forEach((days, m) => {
    res.push(`${days.join(', ')} ${m}`)
  })
  return res.join('; ')
}

export type OpexModalType = 'salary' | 'bonus' | 'bonus_kru' | 'bonus_manager' | 'lembur' | 'operational' | 'total' | null

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

export interface LemburItem {
  id: string
  date: string
  outletName: string
  outletId?: string | null
  description: string
  amount: number
  recipientName?: string
  receiptUrl?: string | null
}

export interface LemburOutletSummary {
  outletName: string
  outletId?: string | null
  count: number
  totalAmount: number
}

export interface LemburData {
  totalLembur: number
  totalCount: number
  items: LemburItem[]
  outlets: LemburOutletSummary[]
}

interface OpexCardDetailModalsProps {
  type: OpexModalType
  onClose: () => void
  isPusat?: boolean
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
    baselineRoutine?: number
    baselineCrewBonus?: number
    baselineManagerBonus?: number
  }
  lemburData?: LemburData
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
    displayLembur?: number
    totalNonSalary: number
    isProrated?: boolean
    prorataInfo?: ProrataInfo
  }
}

export function OpexCardDetailModals({
  type,
  onClose,
  isPusat = false,
  salaryData,
  lemburData,
  operationalData,
  totalOpexData
}: OpexCardDetailModalsProps) {
  const [operationalTab, setOperationalTab] = useState<'category' | 'outlet'>('category')
  const [lemburTab, setLemburTab] = useState<'outlet' | 'transactions'>('outlet')
  // Urutan daftar kru di rincian gaji: default nilai gaji tertinggi dulu.
  const [crewSort, setCrewSort] = useState<{ key: 'nilai' | 'nama'; dir: 'asc' | 'desc' }>({ key: 'nilai', dir: 'desc' })
  const urutkanKru = <T extends { staffName?: string; routineSalary?: number }>(daftar: T[]): T[] => {
    const arah = crewSort.dir === 'asc' ? 1 : -1
    const nama = (a: T, b: T) => (a.staffName || '').localeCompare(b.staffName || '', 'id')
    return [...daftar].sort((a, b) => {
      if (crewSort.key === 'nama') return arah * nama(a, b)
      const selisih = (a.routineSalary || 0) - (b.routineSalary || 0)
      return selisih !== 0 ? arah * selisih : nama(a, b)
    })
  }
  const crewSortBar = (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="font-semibold text-gray-500">Urutkan:</span>
      {([['nilai', 'Nilai Gaji'], ['nama', 'Nama']] as const).map(([key, label]) => {
        const aktif = crewSort.key === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => setCrewSort(prev => prev.key === key
              ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
              : { key, dir: key === 'nama' ? 'asc' : 'desc' })}
            className={`px-2 py-0.5 rounded-md border font-bold transition-colors ${aktif ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {label}{aktif ? (crewSort.dir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
          </button>
        )
      })}
    </div>
  )

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
  const baselineRoutineMonthly = salaryData.baselineRoutine && salaryData.baselineRoutine > 0
    ? salaryData.baselineRoutine
    : (hasHrPayroll && hrPayroll
      ? Math.max(0, hrPayroll.totalSalary - (hrPayroll.bonus || 0))
      : (isProrated && ratio > 0 ? Math.round(routineSalary / ratio) : routineSalary))
  const { totalNonSalary, totalCount: opCount, categories, outlets } = operationalData
  const { totalCombined } = totalOpexData

  const routineSalaryShare = totalCombined > 0 ? (routineSalary / totalCombined) * 100 : 0
  const crewBonusShare = totalCombined > 0 ? (crewBonusAmount / totalCombined) * 100 : 0
  const managerBonusShare = totalCombined > 0 ? (managerBonusAmount / totalCombined) * 100 : 0
  const lemburAmount = totalOpexData.displayLembur ?? lemburData?.totalLembur ?? 0
  const lemburShare = totalCombined > 0 ? (lemburAmount / totalCombined) * 100 : 0
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
    : (hrPayroll?.managerDetails && hrPayroll.managerDetails.length > 0)
      ? hrPayroll.managerDetails
          .filter(mgr => mgr.role === 'area_manager' || mgr.role === 'regional_manager')
          .map(mgr => ({
            staffId: mgr.staffId,
            staffName: mgr.staffName,
            role: mgr.role,
            outletName: mgr.role === 'area_manager'
              ? 'Rp 50 / pcs (Cabang Binaan)'
              : mgr.role === 'regional_manager'
              ? 'Rp 50 / pcs (Wilayah Regional)'
              : 'Rp 50 / pcs',
            bonus: mgr.bonusAmount || 0,
            totalPcs: mgr.totalPcs || Math.round((mgr.bonusAmount || 0) / 50),
            status: mgr.status
          }))
      : (hrPayroll?.bonusDetails
        ? hrPayroll.bonusDetails.filter(b => {
            const role = (b.role || '').toLowerCase()
            return role.includes('manager') || role.includes('controller')
          })
        : [])

  // Baseline sum of all crew bonuses in the list
  const totalBaseCrewBonus = crewBonusList.reduce((sum, s) => sum + (Number(s.bonus) || 0), 0)

  // Calculate row-level bonus and pcs sold strictly aligned with the active date filter
  const calculatedCrewRows = (() => {
    if (crewBonusList.length === 0) return []

    // If crewBonusAmount matches totalBaseCrewBonus (e.g. from exact date-filtered HR payroll),
    // we use the exact staff.bonus and staff.totalPcs without any prorata distortion!
    const isExactMatch = totalBaseCrewBonus > 0 && Math.abs(totalBaseCrewBonus - crewBonusAmount) <= 1

    const rows = crewBonusList.map((staff) => {
      let staffBonus = staff.bonus

      if (!isExactMatch && isProrated && prorataInfo) {
        if (crewBonusAmount > 0 && totalBaseCrewBonus > 0) {
          // Proporsionalitas murni: setiap kru mendapatkan porsi persis dari total target bonus filter
          staffBonus = Math.round((staff.bonus / totalBaseCrewBonus) * crewBonusAmount)
        } else if (prorataInfo.ratio > 0) {
          staffBonus = Math.round(staff.bonus * prorataInfo.ratio)
        }
      } else {
        staffBonus = staff.bonus
      }

      // Hitung jumlah pcs terjual yang berkaitan dengan filter tanggal
      // Di sistem Suka Shawarma, pool bonus kru adalah Rp 100 per pcs produk terjual.
      let staffPcs = 0
      if (staff.totalPcs && staff.totalPcs > 0 && (isExactMatch || !isProrated)) {
        staffPcs = staff.totalPcs
      } else if (staff.totalPcs && staff.totalPcs > 0 && totalBaseCrewBonus > 0 && isProrated) {
        staffPcs = Math.round((staff.bonus / totalBaseCrewBonus) * Math.round(crewBonusAmount / 100))
      } else {
        staffPcs = Math.round(staffBonus / 100)
      }

      const staffInfoInPayroll = hrPayroll?.staffDetails?.find(s => s.staffId === staff.staffId)
      const subRole = (staff as any).subRole || staffInfoInPayroll?.subRole || null
      const contractType = (staff as any).contractType || staffInfoInPayroll?.contractType || null
      const isBackup = Boolean((staff as any).isBackup || subRole === 'crew_backup' || contractType === 'daily')
      const backupDates: string[] = (staff as any).backupDates || []
      const backupDatesFormatted: string = (staff as any).backupDatesFormatted || (backupDates.length > 0 ? formatBackupDates(backupDates) : '')
      const backupNote: string = (staff as any).backupNote || (backupDatesFormatted ? `Tanggal backup: ${backupDatesFormatted} (${backupDates.length} hari)` : '')

      return {
        ...staff,
        subRole,
        contractType,
        isBackup,
        backupDates,
        backupDatesFormatted,
        backupNote,
        staffBonus,
        staffPcs,
      }
    })

    // Zero-discrepancy adjustment: memastikan jumlah baris sama persis dengan total kartu & footer
    if (!isExactMatch && isProrated && crewBonusAmount > 0 && totalBaseCrewBonus > 0 && rows.length > 0) {
      const sumRows = rows.reduce((s, r) => s + r.staffBonus, 0)
      const diff = crewBonusAmount - sumRows
      if (diff !== 0) {
        rows[0].staffBonus += diff
        rows[0].staffPcs = Math.round(rows[0].staffBonus / 100)
      }
    }

    return rows
  })()

  const totalCrewPcs = calculatedCrewRows.reduce((sum, r) => sum + r.staffPcs, 0)

  // Calculate row-level manager bonus and pcs sold strictly aligned with the active date filter
  const calculatedManagerRows = (() => {
    if (managerBonusList.length === 0) return []

    // Bila jumlah bonus per manajer dari HR sudah sama dengan total kartu, pakai angka
    // per orang apa adanya (RM = pcs seluruh cabang x Rp 50, AM = pcs cabang binaan x Rp 50).
    // Pembagian 50/50 di bawah hanya cadangan (mis. angka closing yang dipatok), karena
    // baru benar jika total pcs AM sama dengan total pcs RM.
    const totalBaseManagerBonus = managerBonusList.reduce((s, m) => s + (Number(m.bonus) || 0), 0)
    if (totalBaseManagerBonus > 0 && Math.abs(totalBaseManagerBonus - managerBonusAmount) <= 1) {
      const rankExact = (role: string = '') => {
        const r = role.toLowerCase()
        if (r === 'regional_manager' || r === 'rm') return 1
        if (r === 'area_manager' || r === 'am') return 2
        if (r === 'stock_controller' || r === 'sc') return 3
        return 4
      }
      return managerBonusList
        .map((mgr) => ({
          ...mgr,
          staffBonus: Number(mgr.bonus) || 0,
          staffPcs: mgr.totalPcs || (mgr.bonus > 0 ? Math.round(mgr.bonus / 50) : 0),
        }))
        .sort((a, b) => rankExact(a.role) - rankExact(b.role) || b.staffBonus - a.staffBonus)
    }

    const rmList = managerBonusList.filter(m => m.role === 'regional_manager')
    const amList = managerBonusList.filter(m => m.role !== 'regional_manager')

    // In Suka Shawarma, AM & RM bonus pool is Rp 100/pcs per outlet (Rp 50 AM + Rp 50 RM)
    const outletTotalPcs = Math.round(managerBonusAmount / 100)

    // Separate distribution pools: 50% for Regional Manager, 50% for Area Manager(s)
    const rmPool = Math.round(managerBonusAmount * 0.5)
    const amPool = managerBonusAmount - rmPool

    // For AMs, calculate total baseline pcs to distribute amPool and outletTotalPcs proportionally
    const totalAmBasePcs = amList.reduce((s, m) => s + (m.totalPcs || (m.bonus > 0 ? Math.round(m.bonus / 50) : 0)), 0)

    const rows = managerBonusList.map((mgr) => {
      let staffBonus = 0
      let staffPcs = 0

      if (mgr.role === 'regional_manager') {
        // Regional Manager oversees all operational branches
        staffBonus = Math.round(rmPool / Math.max(1, rmList.length))
        staffPcs = outletTotalPcs > 0 ? outletTotalPcs : Math.round(staffBonus / 50)
      } else {
        // Area Manager only oversees their specific coached branches
        if (amList.length <= 1) {
          // Single-outlet mode: 1 AM covers that single outlet
          staffBonus = amPool
          staffPcs = outletTotalPcs > 0 ? outletTotalPcs : Math.round(staffBonus / 50)
        } else if (totalAmBasePcs > 0) {
          // All-outlets mode: proportional to their coached branches' sales
          const amBase = mgr.totalPcs || (mgr.bonus > 0 ? Math.round(mgr.bonus / 50) : 0)
          const ratio = amBase / totalAmBasePcs
          staffPcs = Math.round(ratio * outletTotalPcs)
          staffBonus = Math.round(ratio * amPool)
        } else {
          // Fallback if no sales data: equal split among AMs
          staffBonus = Math.round(amPool / Math.max(1, amList.length))
          staffPcs = Math.round(outletTotalPcs / Math.max(1, amList.length))
        }
      }

      return {
        ...mgr,
        staffBonus,
        staffPcs,
      }
    })

    // Zero-discrepancy adjustment for AMs: ensures sum of AM staffBonus exactly equals amPool
    // and sum of AM staffPcs exactly equals outletTotalPcs
    const amRows = rows.filter(r => r.role !== 'regional_manager')
    if (amRows.length > 0) {
      const sumAmBonus = amRows.reduce((s, r) => s + r.staffBonus, 0)
      const diffBonus = amPool - sumAmBonus
      if (diffBonus !== 0) {
        amRows[0].staffBonus += diffBonus
      }

      if (amRows.length > 1) {
        const sumAmPcs = amRows.reduce((s, r) => s + r.staffPcs, 0)
        const diffPcs = outletTotalPcs - sumAmPcs
        if (diffPcs !== 0) {
          amRows[0].staffPcs += diffPcs
        }
      }
    }

    // Zero-discrepancy adjustment for RM
    const rmRows = rows.filter(r => r.role === 'regional_manager')
    if (rmRows.length > 0) {
      const sumRmBonus = rmRows.reduce((s, r) => s + r.staffBonus, 0)
      const diffRmBonus = rmPool - sumRmBonus
      if (diffRmBonus !== 0) {
        rmRows[0].staffBonus += diffRmBonus
      }
    }

    return rows.sort((a, b) => {
      const getRank = (role: string = '') => {
        const r = role.toLowerCase()
        if (r === 'regional_manager' || r === 'rm') return 1
        if (r === 'area_manager' || r === 'am') return 2
        if (r === 'stock_controller' || r === 'sc') return 3
        return 4
      }
      const rankDiff = getRank(a.role) - getRank(b.role)
      if (rankDiff !== 0) return rankDiff
      return b.staffBonus - a.staffBonus
    })
  })()

  const totalManagerPcs = calculatedManagerRows.length > 0
    ? (managerBonusAmount > 0 ? Math.round(managerBonusAmount / 100) : 0)
    : 0

  // Crew categorization helper (Reguler, Backup, Trainee, OJT)
  const allStaff = hrPayroll?.staffDetails || []
  const crewStaffList = allStaff.filter(s => !s.isManagerAllocation)
  const totalCrewCount = crewStaffList.length > 0 ? crewStaffList.length : (hrPayroll?.crewCount ?? hrPayroll?.totalStaff ?? 0)

  const crewComposition = (() => {
    let regular = hrPayroll?.crewRegularCount ?? 0
    let backup = hrPayroll?.crewBackupCount ?? 0
    let trainee = hrPayroll?.crewTraineeCount ?? 0
    let ojt = hrPayroll?.crewOjtCount ?? 0

    if (
      hrPayroll?.crewRegularCount === undefined &&
      hrPayroll?.crewBackupCount === undefined &&
      hrPayroll?.crewTraineeCount === undefined &&
      hrPayroll?.crewOjtCount === undefined &&
      crewStaffList.length > 0
    ) {
      regular = 0
      backup = 0
      trainee = 0
      ojt = 0
      crewStaffList.forEach(s => {
        const isBackup = s.contractType === 'daily' || s.subRole === 'crew_backup'
        const isTrainee = s.contractType === 'probation' || s.subRole === 'crew_trainee'
        const isOjt = s.contractType === 'intern' || s.onboardingStage === 'ojt'
        if (isBackup) backup++
        else if (isTrainee) trainee++
        else if (isOjt) ojt++
        else regular++
      })
    }

    return { regular, backup, trainee, ojt, total: regular + backup + trainee + ojt }
  })()

  const modalWidthClass = type === 'total'
    ? 'max-w-3xl lg:max-w-4xl'
    : 'max-w-4xl lg:max-w-5xl xl:max-w-6xl'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto ${modalWidthClass}`}
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
                    <span>{isPusat ? 'Rincian Gaji & Payroll Staf Kantor Pusat' : 'Rincian Gaji & Payroll (Rutin)'}</span>
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
                      ? (isPusat
                          ? `Beban gaji rutin staf kantor proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari bulan ini`
                          : `Beban gaji rutin proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari bulan ini`)
                      : (isPusat
                          ? 'Rincian beban gaji pokok dan tunjangan staf kantor pusat (tanpa beban alokasi pengawas toko)'
                          : 'Rincian beban gaji pokok, tunjangan, dan alokasi manajer (bonus omset dipisahkan)')}
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
              {/* Stat Highlight Cards (Executive Layout: Gaji Rutin Hero + Status Operasional) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Hero Metric: Gaji Rutin (Bulan Penuh vs Prorata) */}
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/80 via-blue-50/40 to-white p-4 rounded-xl border border-indigo-100/90 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet size={14} className="text-indigo-600" />
                      {isProrated ? 'Ringkasan Beban Gaji Rutin' : 'Beban Gaji & Payroll (Rutin)'}
                    </span>
                    {isProrated && prorataInfo && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1 shadow-2xs">
                        <Sparkles size={11} className="text-indigo-600" />
                        Prorata {prorataInfo.overlapDays} dari {prorataInfo.totalDays} Hari ({((prorataInfo.ratio || 0) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>

                  {isProrated ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-indigo-100/60">
                      <div>
                        <div className="text-[11px] font-bold text-indigo-800 flex items-center gap-1">
                          <span>Beban Diakui (Prorata)</span>
                        </div>
                        <span className="text-2xl font-black text-indigo-950 block mt-0.5">
                          {rupiah(routineSalary)}
                        </span>
                        <span className="text-[11px] text-indigo-600 font-medium block mt-0.5">
                          Beban kas aktif {prorataInfo?.overlapDays} hari berjalan
                        </span>
                      </div>

                      <div className="sm:border-l sm:border-indigo-100/80 sm:pl-3">
                        <div className="text-[11px] font-bold text-blue-800 flex items-center gap-1">
                          <span>Baseline 1 Bulan Penuh</span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                            Penuh
                          </span>
                        </div>
                        <span className="text-2xl font-black text-blue-950 block mt-0.5">
                          {rupiah(baselineRoutineMonthly)}
                        </span>
                        <span className="text-[11px] text-blue-700/80 font-medium block mt-0.5">
                          {isPusat ? 'Gaji Pokok & Tunjangan Staf Kantor Pusat' : 'Kru Store + Alokasi Manajer (AM/RM/SC)'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-2xl font-black text-indigo-950 block mt-0.5">
                        {rupiah(routineSalary)}
                      </span>
                      <span className="text-[11px] text-indigo-600 font-medium block mt-0.5">
                        {hasHrPayroll
                          ? (isPusat ? 'Total beban gaji rutin sebulan penuh staf kantor pusat' : 'Total beban gaji rutin sebulan penuh (Kru + Alokasi AM/RM/SC)')
                          : 'Pencatatan Buku Kas'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Operational & Document Status */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                      {isPusat ? 'Jumlah Staf Kantor & Status HR' : 'Jumlah Kru & Status HR'}
                    </span>
                    <div className="flex items-baseline justify-between gap-1 mt-1">
                      <span className="text-xl font-black text-slate-800">
                        {isPusat ? `${allStaff.length || hrPayroll?.totalStaff || 23} Staf Kantor` : `${totalCrewCount} Kru Store`}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        hrPayroll?.status === 'finalized'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : hrPayroll?.status === 'draft'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {hrPayroll?.status === 'finalized'
                          ? 'Final'
                          : hrPayroll?.status === 'draft'
                          ? 'Draft'
                          : hrPayroll?.status === 'partial'
                          ? 'Sebagian Final'
                          : 'Manual'}
                      </span>
                    </div>

                    {/* Rincian Komposisi Kru (Reguler, Backup, Trainee, OJT) */}
                    {!isPusat && (crewComposition.total > 0 || totalCrewCount > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {crewComposition.regular > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {crewComposition.regular} Crew Reguler
                          </span>
                        )}
                        {crewComposition.backup > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                            {crewComposition.backup} Crew Backup
                          </span>
                        )}
                        {crewComposition.trainee > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            {crewComposition.trainee} Trainee
                          </span>
                        )}
                        {crewComposition.ojt > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-2xs inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                            {crewComposition.ojt} OJT
                          </span>
                        )}
                      </div>
                    )}

                    <span className="text-[11px] text-slate-500 font-medium block mt-2">
                      {isPusat
                        ? `${hrPayroll?.finalizedCount ?? 0} Final · ${hrPayroll?.draftCount ?? 0} Draft`
                        : (hrPayroll?.managerDetails && hrPayroll.managerDetails.length > 0
                            ? `+${hrPayroll.managerDetails.length} Manajer Binaan (AM/RM/SC)`
                            : `${hrPayroll?.finalizedCount ?? 0} Final · ${hrPayroll?.draftCount ?? 0} Draft`)}
                    </span>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Total THP (+Bonus):</span>
                    <strong className="text-gray-900 font-black">
                      {rupiah(isProrated && prorataInfo ? Math.round((hrPayroll?.totalSalary ?? routineSalary) * ratio) : (hrPayroll?.totalSalary ?? routineSalary))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Rincian Beban Gaji Rutin: Card 1 (Fix Bulanan) & Card 2 (Prorata Periode Ini) */}
              {hasHrPayroll && hrPayroll && (() => {
                    // 1. Angka Baseline 1 Bulan Penuh (Fix)
                    const crewGapok1Bln = Math.round(hrPayroll.crewBasicSalary ?? hrPayroll.basicSalary)
                    const crewTunj1Bln = Math.round(hrPayroll.crewAllowances ?? hrPayroll.allowances)
                    const crewPot1Bln = Math.round(hrPayroll.crewDeductions ?? hrPayroll.deductions)
                    const crewRoutine1Bln = Math.max(0, crewGapok1Bln + crewTunj1Bln - crewPot1Bln)
                    const mgrAlloc1Bln = Math.round(hrPayroll.managerAllocation || 0)
                    const totalFix1Bln = crewRoutine1Bln + mgrAlloc1Bln

                    // 2. Angka Prorata Sesuai Filter
                    const crewGapokProrata = Math.round(crewGapok1Bln * ratio)
                    const crewTunjProrata = Math.round(crewTunj1Bln * ratio)
                    const crewPotProrata = Math.round(crewPot1Bln * ratio)
                    const crewRoutineProrata = Math.max(0, crewGapokProrata + crewTunjProrata - crewPotProrata)
                    const mgrAllocProrata = Math.round(mgrAlloc1Bln * ratio)
                    const totalProrata = crewRoutineProrata + mgrAllocProrata

                    const allStaff = hrPayroll?.staffDetails || []
                    const crewList = urutkanKru(allStaff.filter(s => !s.isManagerAllocation))
                    const crewCount = crewList.length > 0 ? crewList.length : (hrPayroll?.crewCount ?? hrPayroll?.totalStaff ?? 0)
                    const rawManagerList = (hrPayroll?.managerDetails && hrPayroll.managerDetails.length > 0)
                      ? hrPayroll.managerDetails
                      : (allStaff.filter(s => s.isManagerAllocation) as any[])

                    const getManagerHierarchyRank = (role: string = '') => {
                      const r = role.toLowerCase()
                      if (r === 'regional_manager' || r === 'rm') return 1
                      if (r === 'area_manager' || r === 'am') return 2
                      if (r === 'stock_controller' || r === 'sc') return 3
                      return 4
                    }

                    const managerList = [...rawManagerList].sort((a, b) => {
                      const rankDiff = getManagerHierarchyRank(a.role) - getManagerHierarchyRank(b.role)
                      if (rankDiff !== 0) return rankDiff
                      return (a.staffName || '').localeCompare(b.staffName || '')
                    })

                    const mgrGapok1Bln = Math.round(
                      hrPayroll.managerBasicSalaryAllocation ??
                      managerList.reduce((sum, m) => sum + (m.allocatedBasicSalary ?? (m.basicSalary ? Math.round(m.basicSalary / (m.coachedOutletsCount || 21)) : 0)), 0)
                    )
                    const mgrTunj1Bln = Math.round(
                      hrPayroll.managerAllowancesAllocation ??
                      managerList.reduce((sum, m) => sum + (m.allocatedAllowances ?? Math.max(0, (m.routineAmount ?? m.allocatedAmount) - (m.allocatedBasicSalary ?? 0))), 0)
                    )
                    const mgrFullGapokSum = Math.round(managerList.reduce((sum, m) => sum + (m.basicSalary || 0), 0))
                    const mgrFullTunjSum = Math.round(managerList.reduce((sum, m) => sum + (m.allowances || 0), 0))
                    const mgrFullPotSum = Math.round(managerList.reduce((sum, m) => sum + (m.deductions || 0), 0))
                    const mgrFullRoutineSum = Math.max(0, mgrFullGapokSum + mgrFullTunjSum - mgrFullPotSum)

                    return (
                      <div className="space-y-4">
                        {/* ========================================================================= */}
                        {/* CARD 1 (ATAS): INFORMASI GAJI FIX SETIAP BULANNYA (BASELINE 1 BULAN)     */}
                        {/* ========================================================================= */}
                        <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/70 via-indigo-50/20 to-white p-4 sm:p-5 shadow-xs space-y-3.5">
                          {/* Header Card 1 */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-100">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 inline-flex items-center gap-1 shadow-2xs">
                                  <Building2 size={12} className="text-indigo-600" />
                                  Komitmen Rutin Tetap
                                </span>
                                <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                                  1. Gaji Rutin Fix Bulanan (Baseline 1 Bulan Penuh)
                                </span>
                              </div>
                              <p className="text-[11px] text-indigo-800/80 font-medium mt-1">
                                Informasi pengeluaran gaji tetap yang wajib keluar setiap bulannya dari outlet ini.
                              </p>
                            </div>
                            <div className="text-left sm:text-right bg-white sm:bg-transparent p-2 sm:p-0 rounded-xl border border-indigo-100 sm:border-0 shadow-2xs sm:shadow-none shrink-0">
                              <span className="text-[10px] uppercase font-bold text-indigo-600 block">Total Beban Rutin Fix:</span>
                              <div className="flex items-baseline sm:justify-end gap-1">
                                <span className="text-lg sm:text-xl font-black text-indigo-950 font-mono">
                                  {rupiah(totalFix1Bln)}
                                </span>
                                <span className="text-[11px] font-bold text-indigo-500">/ bln</span>
                              </div>
                            </div>
                          </div>

                          {/* 2 Kolom: Kru Toko vs Alokasi Manajer */}
                          <div className={`grid grid-cols-1 ${isPusat ? '' : 'lg:grid-cols-2'} gap-3.5`}>
                            {/* Kolom Kiri: Kru Toko Cabang / Staf Kantor Pusat */}
                            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col justify-between space-y-3">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                      <Users size={13} className="text-indigo-600" />
                                      <span>{isPusat ? `Staf Kantor Pusat (${crewCount} Orang)` : `Kru Toko Cabang (${crewCount} Orang)`}</span>
                                    </span>
                                    {!isPusat && (crewComposition.total > 0 || crewCount > 0) && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {crewComposition.regular > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                            {crewComposition.regular} Reguler
                                          </span>
                                        )}
                                        {crewComposition.backup > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                            {crewComposition.backup} Backup
                                          </span>
                                        )}
                                        {crewComposition.trainee > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                            {crewComposition.trainee} Trainee
                                          </span>
                                        )}
                                        {crewComposition.ojt > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                                            {crewComposition.ojt} OJT
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs font-black text-indigo-900 font-mono bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                    {rupiah(crewRoutine1Bln)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                                    <span className="text-[9px] uppercase font-bold text-gray-500 block">1. Gapok Fix</span>
                                    <span className="text-xs font-bold text-gray-900 mt-0.5 block font-mono">
                                      {rupiah(crewGapok1Bln)}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                                    <span className="text-[9px] uppercase font-bold text-emerald-700 block">2. Tunjangan Fix</span>
                                    <span className="text-xs font-bold text-emerald-700 mt-0.5 block font-mono">
                                      +{rupiah(crewTunj1Bln)}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                                    <span className="text-[9px] uppercase font-bold text-rose-700 block">3. Potongan Fix</span>
                                    <span className="text-xs font-bold text-rose-700 mt-0.5 block font-mono">
                                      -{rupiah(crewPot1Bln)}
                                    </span>
                                  </div>
                                </div>

                                {crewSortBar}
                                {/* Daftar Personel Kru Fix 1 Bulan */}
                                <div className="space-y-1.5 max-h-[260px] overflow-y-auto scrollbar-thin pr-0.5">
                                  {crewList.length > 0 ? (
                                    crewList.map((s) => {
                                      const isBackupSplit = Boolean(s.isBackupAllocation && (s.backupOutletsCount ?? 1) > 1)
                                      return (
                                        <div key={s.staffId} className="flex items-center justify-between bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-200 text-xs gap-2">
                                          <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-gray-900 truncate">{s.staffName}</span>
                                              {isBackupSplit && (
                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-300 shrink-0">
                                                  1/{s.backupOutletsCount} Cbg
                                                </span>
                                              )}
                                              {hrPayroll?.outlets && hrPayroll.outlets.length > 1 && s.outletName && (
                                                <span className="text-[9px] text-gray-400 truncate">
                                                  ({s.outletName})
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase shrink-0">
                                                {s.role.replace(/_/g, ' ')}
                                              </span>
                                              {((s.contractType === 'daily' || s.subRole === 'crew_backup')) && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-300 shrink-0 shadow-2xs">
                                                  Backup
                                                </span>
                                              )}
                                              {((s.contractType === 'probation' || s.subRole === 'crew_trainee')) && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300 shrink-0 shadow-2xs">
                                                  Trainee
                                                </span>
                                              )}
                                              {((s.contractType === 'intern' || s.onboardingStage === 'ojt')) && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-300 shrink-0 shadow-2xs">
                                                  OJT
                                                </span>
                                              )}
                                              {s.status === 'finalized' ? (
                                                <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                  Final
                                                </span>
                                              ) : (
                                                <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                  Draft
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="font-bold text-indigo-950 font-mono">
                                              {rupiah(s.routineSalary)}
                                            </span>
                                            {isBackupSplit && s.fullRoutineSalary ? (
                                              <span className="text-[9px] text-purple-700 block font-medium">
                                                (dari {rupiah(s.fullRoutineSalary)})
                                              </span>
                                            ) : (s.allowances > 0 || s.deductions > 0) ? (
                                              <span className="text-[9px] text-gray-400 block font-normal">
                                                Gapok {rupiah(s.basicSalary)}{s.allowances > 0 ? ` + Tunj ${rupiah(s.allowances)}` : ''}{s.deductions > 0 ? ` - Pot ${rupiah(s.deductions)}` : ''}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      )
                                    })
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">Tidak ada kru toko tercatat</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-400 block italic pt-1 border-t border-slate-100">
                                * Nilai kontrak bulanan tetap (belum termasuk bonus omset POS)
                              </span>
                            </div>

                            {/* Kolom Kanan: Alokasi Manajer (AM, RM, SC) */}
                            {!isPusat && (
                              <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col justify-between space-y-3">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <div>
                                      <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <Users size={13} className="text-purple-600" />
                                        <span>Manajer Supervisi ({managerList.length} Orang)</span>
                                      </span>
                                      <span className="text-[10px] text-gray-400 block font-normal mt-0.5">
                                        Total Gaji Utuh: {rupiah(mgrFullRoutineSum)}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs font-black text-purple-900 font-mono bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 block">
                                        Beban Cbg: +{rupiah(mgrAlloc1Bln)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Summary Boxes Gapok vs Tunjangan Manajer Fix */}
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center flex flex-col justify-between">
                                      <div>
                                        <span className="text-[9px] uppercase font-bold text-gray-500 block">1. Gapok Utuh 100%</span>
                                        <span className="text-xs sm:text-sm font-extrabold text-gray-900 mt-0.5 block font-mono">
                                          {rupiah(mgrFullGapokSum)}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/80">
                                        <span className="text-[9px] text-indigo-700 font-semibold block bg-indigo-50/70 py-0.5 px-1.5 rounded border border-indigo-100">
                                          Beban Cbg: <strong>+{rupiah(mgrGapok1Bln)}</strong>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center flex flex-col justify-between">
                                      <div>
                                        <span className="text-[9px] uppercase font-bold text-purple-700 block">2. Tunjangan Utuh 100%</span>
                                        <span className="text-xs sm:text-sm font-extrabold text-purple-700 mt-0.5 block font-mono">
                                          +{rupiah(mgrFullTunjSum)}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/80">
                                        <span className="text-[9px] text-purple-700 font-semibold block bg-purple-50/70 py-0.5 px-1.5 rounded border border-purple-100">
                                          Beban Cbg: <strong>+{rupiah(mgrTunj1Bln)}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin pr-0.5">
                                    {managerList.length > 0 ? (
                                      managerList.map((mgr) => {
                                        const mgrAllocRoutine = mgr.routineAmount ?? (mgr.allocatedAmount - (mgr.bonusAmount || 0))
                                        const mgrFullGapok = mgr.basicSalary ?? 0
                                        const mgrFullTunj = mgr.allowances ?? 0
                                        const mgrFullPot = mgr.deductions ?? 0
                                        const mgrFullRoutine = Math.max(0, mgrFullGapok + mgrFullTunj - mgrFullPot)
                                        return (
                                          <div key={mgr.staffId} className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1.5 hover:bg-slate-50 transition-colors">
                                            {/* Baris Atas: Profil Manajer & Gaji Master Utuh 100% */}
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-gray-900 truncate">{mgr.staffName}</span>
                                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase shrink-0 ${
                                                    mgr.role === 'stock_controller'
                                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                      : mgr.role === 'regional_manager'
                                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                      : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                  }`}>
                                                    {mgr.role === 'stock_controller' ? 'SC' : mgr.role === 'regional_manager' ? 'RM' : 'AM'}
                                                  </span>
                                                  {mgr.status === 'finalized' ? (
                                                    <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                      Final
                                                    </span>
                                                  ) : (
                                                    <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                      Draft
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <div className="flex items-baseline justify-end gap-1">
                                                  <span className="text-[10px] text-gray-400 font-medium">Gaji Utuh:</span>
                                                  <span className="font-bold text-indigo-950 font-mono text-xs">
                                                    {rupiah(mgrFullRoutine)}
                                                  </span>
                                                </div>
                                                <span className="text-[9px] text-gray-400 block font-normal">
                                                  Gapok {rupiah(mgrFullGapok)}{mgrFullTunj > 0 ? ` + Tunj ${rupiah(mgrFullTunj)}` : ''}{mgrFullPot > 0 ? ` - Pot ${rupiah(mgrFullPot)}` : ''}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Baris Bawah (Dipisah): Strip Khusus Keterangan Beban Cabang */}
                                            <div className="bg-purple-50/90 px-2.5 py-1 rounded-lg border border-purple-100/90 flex items-center justify-between text-[11px]">
                                              <span className="text-purple-900 font-medium flex items-center gap-1.5">
                                                <Building2 size={11} className="text-purple-600 shrink-0" />
                                                {(hrPayroll?.outlets?.length ?? 0) > 1 ? (<span>Total Beban Semua Cabang <span className="text-[10px] text-purple-700 font-normal">({mgr.coachedOutletsCount || 0} Cbg)</span>:</span>) : (<span>Beban Cabang Ini <span className="text-[10px] text-purple-700 font-normal">({1}/{mgr.coachedOutletsCount || 21} Cbg)</span>:</span>)}
                                              </span>
                                              <span className="font-black text-purple-800 font-mono">
                                                +{rupiah(mgrAllocRoutine)} <span className="text-[9px] text-purple-600 font-medium">/ bln</span>
                                              </span>
                                            </div>

                                            {(hrPayroll?.outlets?.length ?? 0) > 1 && hrPayroll?.managerDetailsByOutlet && (() => {
                                              const namaOutlet = new Map((hrPayroll.outlets ?? []).map(o => [o.outletId, o.outletName]))
                                              const perCabang = Object.entries(hrPayroll.managerDetailsByOutlet ?? {})
                                                .flatMap(([oid, daftar]) => {
                                                  const d = daftar.find(x => x.staffId === mgr.staffId)
                                                  return d
                                                    ? [{ oid, nama: namaOutlet.get(oid) || 'Outlet', jumlah: d.routineAmount ?? (d.allocatedAmount - (d.bonusAmount || 0)) }]
                                                    : []
                                                })
                                                .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'))
                                              if (perCabang.length === 0) return null
                                              const totalPerCabang = perCabang.reduce((s, b) => s + b.jumlah, 0)
                                              return (
                                                <details className="rounded-lg border border-purple-100 bg-white/70 px-2.5 py-1 text-[11px]">
                                                  <summary className="cursor-pointer select-none font-semibold text-purple-800">
                                                    Sumbangan tiap cabang untuk gaji {mgr.staffName.split(' ')[0]} ({perCabang.length} Cbg)
                                                  </summary>
                                                  <div className="mt-1.5 space-y-0.5 max-h-[160px] overflow-y-auto scrollbar-thin pr-0.5">
                                                    {perCabang.map(b => (
                                                      <div key={b.oid} className="flex items-center justify-between gap-2 text-gray-700">
                                                        <span className="truncate">{b.nama}</span>
                                                        <span className="font-mono font-bold text-purple-800 shrink-0">{rupiah(b.jumlah)}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                  <div className="mt-1 pt-1 border-t border-purple-100 flex items-center justify-between font-black text-purple-900">
                                                    <span>Total</span>
                                                    <span className="font-mono">{rupiah(totalPerCabang)}</span>
                                                  </div>
                                                </details>
                                              )
                                            })()}
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <span className="text-xs text-gray-400 italic">Tidak ada alokasi manajer</span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-400 block italic pt-1 border-t border-slate-100">
                                  * Gaji utuh bulanan 100% manajer & porsi beban alokasi per cabang
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* CARD 2 (BAWAH): BEBAN GAJI DIAKUI PERIODE INI (PRORATA SESUAI FILTER)     */}
                        {/* ========================================================================= */}
                        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50/70 via-amber-50/20 to-white p-4 sm:p-5 shadow-xs space-y-3.5">
                          {/* Header Card 2 */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-200">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 inline-flex items-center gap-1 shadow-2xs">
                                  <Sparkles size={12} className="text-amber-600" />
                                  {isProrated && prorataInfo
                                    ? `Prorata ${prorataInfo.overlapDays} dari ${prorataInfo.totalDays} Hari (${((prorataInfo.ratio || 0) * 100).toFixed(1)}%)`
                                    : `Prorata 100% (${prorataInfo?.totalDays || 31} dari ${prorataInfo?.totalDays || 31} Hari)`}
                                </span>
                                <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                                  2. Beban Diakui Periode Ini (Prorata Filter)
                                </span>
                              </div>
                              <p className="text-[11px] text-amber-900/80 font-medium mt-1">
                                Beban operasional riil yang dibebankan ke laporan laba rugi sesuai rentang tanggal yang dipilih.
                              </p>
                            </div>
                            <div className="text-left sm:text-right bg-white sm:bg-transparent p-2 sm:p-0 rounded-xl border border-amber-200 sm:border-0 shadow-2xs sm:shadow-none shrink-0">
                              <span className="text-[10px] uppercase font-bold text-amber-800 block">Total Beban Diakui:</span>
                              <div className="flex items-baseline sm:justify-end gap-1">
                                <span className="text-lg sm:text-xl font-black text-amber-950 font-mono">
                                  {rupiah(totalProrata)}
                                </span>
                                <span className="text-[11px] font-bold text-amber-700">diakui</span>
                              </div>
                            </div>
                          </div>

                          {/* 2 Kolom: Kru Toko Prorata vs Alokasi Manajer Prorata */}
                          <div className={`grid grid-cols-1 ${isPusat ? '' : 'lg:grid-cols-2'} gap-3.5`}>
                            {/* Kolom Kiri: Kru Toko Prorata / Staf Kantor Prorata */}
                            <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between space-y-3">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                      <Users size={13} className="text-amber-600" />
                                      <span>{isPusat ? `Staf Kantor Prorata (${crewCount} Orang)` : `Kru Toko Prorata (${crewCount} Orang)`}</span>
                                    </span>
                                    {!isPusat && (crewComposition.total > 0 || crewCount > 0) && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {crewComposition.regular > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                            {crewComposition.regular} Reguler
                                          </span>
                                        )}
                                        {crewComposition.backup > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                            {crewComposition.backup} Backup
                                          </span>
                                        )}
                                        {crewComposition.trainee > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                            {crewComposition.trainee} Trainee
                                          </span>
                                        )}
                                        {crewComposition.ojt > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                                            {crewComposition.ojt} OJT
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs font-black text-amber-900 font-mono bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                                    {rupiah(crewRoutineProrata)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="bg-amber-50/40 p-2 rounded-lg border border-amber-200/80 text-center">
                                    <span className="text-[9px] uppercase font-bold text-gray-600 block">1. Gapok Prorata</span>
                                    <span className="text-xs font-bold text-gray-900 mt-0.5 block font-mono">
                                      {rupiah(crewGapokProrata)}
                                    </span>
                                  </div>
                                  <div className="bg-amber-50/40 p-2 rounded-lg border border-amber-200/80 text-center">
                                    <span className="text-[9px] uppercase font-bold text-emerald-800 block">2. Tunjangan Prorata</span>
                                    <span className="text-xs font-bold text-emerald-700 mt-0.5 block font-mono">
                                      +{rupiah(crewTunjProrata)}
                                    </span>
                                  </div>
                                  <div className="bg-amber-50/40 p-2 rounded-lg border border-rose-200/80 text-center">
                                    <span className="text-[9px] uppercase font-bold text-rose-800 block">3. Potongan Prorata</span>
                                    <span className="text-xs font-bold text-rose-700 mt-0.5 block font-mono">
                                      -{rupiah(crewPotProrata)}
                                    </span>
                                  </div>
                                </div>

                                {crewSortBar}
                                {/* Daftar Personel Kru Prorata */}
                                <div className="space-y-1.5 max-h-[260px] overflow-y-auto scrollbar-thin pr-0.5">
                                  {crewList.length > 0 ? (
                                    crewList.map((s) => {
                                      const isBackupSplit = Boolean(s.isBackupAllocation && (s.backupOutletsCount ?? 1) > 1)
                                      const sRoutineProrata = Math.round(s.routineSalary * ratio)
                                      const sGapokProrata = Math.round(s.basicSalary * ratio)
                                      return (
                                        <div key={s.staffId} className="flex items-center justify-between bg-amber-50/40 px-2.5 py-2 rounded-lg border border-amber-200/80 text-xs gap-2">
                                          <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-gray-900 truncate">{s.staffName}</span>
                                              {isBackupSplit && (
                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 border border-purple-300 shrink-0">
                                                  1/{s.backupOutletsCount} Cbg
                                                </span>
                                              )}
                                              {hrPayroll?.outlets && hrPayroll.outlets.length > 1 && s.outletName && (
                                                <span className="text-[9px] text-gray-400 truncate">
                                                  ({s.outletName})
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100/70 text-amber-900 border border-amber-200 uppercase shrink-0">
                                                {s.role.replace(/_/g, ' ')}
                                              </span>
                                              {((s.contractType === 'daily' || s.subRole === 'crew_backup')) && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-300 shrink-0 shadow-2xs">
                                                  Backup
                                                </span>
                                              )}
                                              {((s.contractType === 'probation' || s.subRole === 'crew_trainee')) && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0 shadow-2xs">
                                                  Trainee
                                                </span>
                                              )}
                                              {((s.contractType === 'intern' || s.onboardingStage === 'ojt')) && (
                                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-300 shrink-0 shadow-2xs">
                                                  OJT
                                                </span>
                                              )}
                                              {s.status === 'finalized' ? (
                                                <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                  Final
                                                </span>
                                              ) : (
                                                <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                  Draft
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="font-bold text-amber-950 font-mono">
                                              {rupiah(sRoutineProrata)}
                                            </span>
                                            <span className="text-[9px] text-gray-500 block font-normal">
                                              {isProrated
                                                ? (isBackupSplit && s.fullRoutineSalary ? `(1 bln: ${rupiah(s.routineSalary)} · dari ${rupiah(s.fullRoutineSalary)})` : `(1 bln: ${rupiah(s.routineSalary)})`)
                                                : (isBackupSplit && s.fullRoutineSalary ? `(dari ${rupiah(s.fullRoutineSalary)})` : `Gapok ${rupiah(sGapokProrata)}`)}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">Tidak ada kru toko tercatat</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-amber-800/70 block italic pt-1 border-t border-amber-100">
                                * Beban proporsional kru toko untuk {isProrated && prorataInfo ? `${prorataInfo.overlapDays} hari berjalan` : 'sebulan penuh'}
                              </span>
                            </div>

                            {/* Kolom Kanan: Alokasi Manajer Prorata */}
                            {!isPusat && (
                              <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between space-y-3">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                      <Users size={13} className="text-purple-600" />
                                      <span>Alokasi Manajer Prorata ({managerList.length} Orang)</span>
                                    </span>
                                    <span className="text-xs font-black text-purple-900 font-mono bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                      +{rupiah(mgrAllocProrata)}
                                    </span>
                                  </div>

                                  {/* Summary Boxes Gapok vs Tunjangan Manajer Prorata */}
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-amber-50/40 p-2 rounded-lg border border-amber-200/80 text-center">
                                      <span className="text-[9px] uppercase font-bold text-gray-600 block">1. Gapok Prorata</span>
                                      <span className="text-xs font-bold text-gray-900 mt-0.5 block font-mono">
                                        +{rupiah(Math.round(mgrGapok1Bln * ratio))}
                                      </span>
                                    </div>
                                    <div className="bg-amber-50/40 p-2 rounded-lg border border-purple-200/80 text-center">
                                      <span className="text-[9px] uppercase font-bold text-purple-800 block">2. Tunjangan Prorata</span>
                                      <span className="text-xs font-bold text-purple-700 mt-0.5 block font-mono">
                                        +{rupiah(Math.round(mgrTunj1Bln * ratio))}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto scrollbar-thin pr-0.5">
                                    {managerList.length > 0 ? (
                                      managerList.map((mgr) => {
                                        const mgrRoutine = mgr.routineAmount ?? (mgr.allocatedAmount - (mgr.bonusAmount || 0))
                                        const mgrAlloc = Math.round(mgrRoutine * ratio)
                                        const mgrAllocGapok = mgr.allocatedBasicSalary ?? (mgr.basicSalary ? Math.round(mgr.basicSalary / (mgr.coachedOutletsCount || 21)) : 0)
                                        const mgrAllocTunj = mgr.allocatedAllowances ?? Math.max(0, mgrRoutine - mgrAllocGapok)
                                        return (
                                          <div key={mgr.staffId} className="flex items-center justify-between bg-amber-50/40 px-2.5 py-2 rounded-lg border border-amber-200/80 text-xs gap-2">
                                            <div className="flex flex-col min-w-0">
                                              <span className="font-bold text-gray-900 truncate">{mgr.staffName}</span>
                                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase shrink-0 ${
                                                  mgr.role === 'stock_controller'
                                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                    : mgr.role === 'regional_manager'
                                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                    : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                                }`}>
                                                  {mgr.role === 'stock_controller' ? 'SC' : mgr.role === 'regional_manager' ? 'RM' : 'AM'}
                                                </span>
                                                {mgr.status === 'finalized' ? (
                                                  <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                    Final
                                                  </span>
                                                ) : (
                                                  <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                    Draft
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <span className="font-bold text-amber-950 font-mono">
                                                +{rupiah(mgrAlloc)}
                                              </span>
                                              <span className="text-[9px] text-gray-500 block font-normal">
                                                {isProrated ? (
                                                  <>
                                                    Gapok {rupiah(Math.round(mgrAllocGapok * ratio))}{mgrAllocTunj > 0 ? ` + Tunj ${rupiah(Math.round(mgrAllocTunj * ratio))}` : ''}
                                                    <span className="text-gray-400 ml-1">(1 bln: +{rupiah(mgrRoutine)})</span>
                                                  </>
                                                ) : (
                                                  <>Gapok {rupiah(mgrAllocGapok)}{mgrAllocTunj > 0 ? ` + Tunj ${rupiah(mgrAllocTunj)}` : ''} · 1/{mgr.coachedOutletsCount || 21} Cbg</>
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <span className="text-xs text-gray-400 italic">Tidak ada alokasi manajer</span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[10px] text-amber-800/70 block italic pt-1 border-t border-amber-100">
                                  * Beban manajer yang dibebankan untuk {isProrated && prorataInfo ? `${prorataInfo.overlapDays} hari berjalan` : 'sebulan penuh'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Keterangan Rumus & Metodologi Perhitungan Prorata Card 2 */}
                          <div className="bg-amber-100/70 rounded-xl border border-amber-300/80 p-3 sm:p-3.5 text-xs text-amber-950 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 font-black text-amber-900">
                                <Calculator size={14} className="text-amber-700 shrink-0" />
                                <span className="uppercase tracking-wider text-[11px]">Rumus & Logika Perhitungan Prorata Beban Periode Ini:</span>
                              </div>
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">
                                {isProrated && prorataInfo ? `${prorataInfo.overlapDays} / ${prorataInfo.totalDays} Hari (${((prorataInfo.ratio || 0) * 100).toFixed(1)}%)` : '1 Bulan Penuh (100%)'}
                              </span>
                            </div>

                            <div className={`grid grid-cols-1 ${isPusat ? '' : 'md:grid-cols-3'} gap-2 text-[11px] leading-relaxed`}>
                              {/* Box 1: Rumus Utama */}
                              <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/90 shadow-2xs space-y-1">
                                <span className="font-extrabold text-amber-950 block">1. Rumus Akrual Harian</span>
                                <div className="bg-amber-50/80 p-1.5 rounded font-mono text-[10px] font-semibold text-amber-900 border border-amber-200/60">
                                  Beban Diakui = Beban 1 Bln × (Hari Filter ÷ Total Hari Bln)
                                </div>
                                <p className="text-gray-600 text-[10px] mt-1">
                                  {isProrated && prorataInfo
                                    ? `Beban rutin 1 bulan dikalikan rasio (${prorataInfo.overlapDays} ÷ ${prorataInfo.totalDays} hari = ${(prorataInfo.ratio * 100).toFixed(1)}%).`
                                    : 'Rentang filter 1 bulan penuh, beban diakui 100% utuh.'}
                                </p>
                              </div>

                              {!isPusat && (
                                <>
                                  {/* Box 2: Kru Reguler vs Backup */}
                                  <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/90 shadow-2xs space-y-1">
                                    <span className="font-extrabold text-amber-950 block">2. Kru Reguler vs Backup</span>
                                    <p className="text-gray-700 text-[10.5px]">
                                      • <strong>Kru Reguler</strong>: 100% beban rutin bulanan dibebankan ke cabang ini.<br />
                                      • <strong>Kru Backup</strong>: Gaji rutin dibagi rata ke cabang penugasan (<span className="font-bold text-purple-800 font-mono">1/N Cbg</span>) sebelum dikalikan faktor hari prorata.
                                    </p>
                                  </div>

                                  {/* Box 3: Manajer Supervisi */}
                                  <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/90 shadow-2xs space-y-1">
                                    <span className="font-extrabold text-amber-950 block">3. Alokasi Manajer (RM, AM, SC)</span>
                                    <p className="text-gray-700 text-[10.5px]">
                                      Gaji bulanan dibagi rata ke outlet binaannya (<span className="font-bold text-purple-800 font-mono">1/N Cbg</span>), kemudian diakui proporsional sesuai rasio hari filter berjalan.
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footnote */}
                        <div className="text-[11px] text-gray-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-start gap-2 shadow-2xs">
                          <Info size={14} className="text-indigo-600 mt-0.5 shrink-0" />
                          <span>
                            Bonus omset penjualan (Kru & AM/RM) sebesar <strong>+{rupiah(bonusAmount)}</strong> telah dipisahkan ke <em>Card 2 (Bonus & Insentif)</em> agar beban rutin tidak terdistorsi fluktuasi omset penjualan.
                          </span>
                        </div>
                      </div>
                    )
                  })()}

              {/* Rincian Beban Gaji per Cabang (Khusus Jika Konsolidasi Multi-Cabang / Semua Cabang) */}
              {hrPayroll?.outlets && hrPayroll.outlets.length > 1 && (
                <div className="space-y-3 pt-1">
                  <div>
                    <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 size={15} className="text-indigo-600" />
                      <span>Rincian Beban Gaji per Cabang ({hrPayroll.outlets.length} Cabang)</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Distribusi alokasi beban operasional gaji rutin per cabang operasional
                    </p>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                    <div className="overflow-x-auto max-h-[480px] scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-2xs">
                          <tr>
                            <th className="px-3.5 py-2.5">Unit / Cabang</th>
                            <th className="px-3 py-2.5 text-center">Staf</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                            {isProrated && (
                              <th className="px-3.5 py-2.5 text-right bg-blue-50/80 text-blue-900 border-x border-blue-200">
                                Rutin 1 Bulan
                              </th>
                            )}
                            <th className="px-3.5 py-2.5 text-right">
                              {isProrated ? 'Rutin Prorata' : 'Gaji Rutin'}
                            </th>
                            <th className="px-3 py-2.5 text-right">Porsi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(hrPayroll?.outlets || []).map((item) => {
                            const outletRoutine1Bln = Math.max(0, item.totalSalary - (item.bonus || 0))
                            const outletRoutineProrata = Math.round(outletRoutine1Bln * ratio)
                            const pct = routineSalary > 0 ? (outletRoutineProrata / routineSalary) * 100 : 0
                            return (
                              <tr key={item.outletId} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                  <div>{item.outletName}</div>
                                  {(item.managerAllocation ?? 0) > 0 && (
                                    <div className="text-[10px] text-indigo-600 font-medium mt-0.5">
                                      Kru: {rupiah(Math.round(((item.crewSalary ?? (item.totalSalary - (item.managerAllocation ?? 0))) - (item.bonus ?? 0)) * ratio))} · AM/RM/SC: +{rupiah(Math.round((item.managerRoutineAllocation ?? item.managerAllocation ?? 0) * ratio))}
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
                                {isProrated && (
                                  <td className="px-3.5 py-2.5 text-right font-black text-blue-950 bg-blue-50/40 whitespace-nowrap border-x border-blue-100">
                                    {rupiah(outletRoutine1Bln)}
                                  </td>
                                )}
                                <td className="px-3.5 py-2.5 text-right font-extrabold text-indigo-900 whitespace-nowrap">
                                  <div>{rupiah(outletRoutineProrata)}</div>
                                  {!isProrated && item.basicSalary && item.basicSalary !== outletRoutine1Bln && (
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
                            {isProrated && (
                              <td className="px-3.5 py-2.5 text-right text-blue-950 font-black bg-blue-100/70 whitespace-nowrap border-x border-blue-200">
                                {rupiah(baselineRoutineMonthly)}
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-right text-indigo-900 font-black">
                              <div>{rupiah(routineSalary)}</div>
                              {!isProrated && hrPayroll && hrPayroll.basicSalary > 0 && (
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100/80 text-amber-800 border border-amber-300">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                      </span>
                      Realtime Penjualan
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isProrated && prorataInfo
                      ? `Bonus omset proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari periode (dihitung riil dari transaksi penjualan)`
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
                    {rupiah(crewBonusAmount)}
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold">
                    {salaryData.baselineCrewBonus
                      ? `Estimasi sebulan: ${rupiah(salaryData.baselineCrewBonus)} (berbasis penjualan MTD)`
                      : isProrated && prorataInfo
                      ? `Baseline sebulan: ${rupiah(hrPayroll?.crewBonus ?? 0)}`
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
                  <span className="font-bold">Ketentuan Bonus Kru Toko:</span> Bonus ini adalah bonus penjualan (omset) bulanan yang dibagikan langsung kepada kru outlet berdasarkan pencapaian target penjualan outlet (Rp 100/pcs pool), dipisahkan dari gaji pokok & tunjangan rutin agar struktur biaya tetap (*fixed cost*) dan variabel (*variable cost*) dapat dipantau terpisah.
                </div>
              </div>

              {/* Table Breakdown per Staf Penerima */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Daftar Kru Penerima Bonus</span>
                  <span className="text-gray-400 font-normal normal-case">
                    {crewBonusList.length} orang {totalCrewPcs > 0 ? `• Total ${totalCrewPcs.toLocaleString('id-ID')} Pcs Terjual` : ''}
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
                            <th className="px-3.5 py-2.5 text-center">Jumlah Pcs Terjual</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                            <th className="px-3.5 py-2.5 text-right">
                              {isProrated ? 'Bonus Prorata' : 'Bonus Omset'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {calculatedCrewRows.map((staff) => {
                            return (
                              <tr key={staff.staffId} className="hover:bg-amber-50/30 transition-colors">
                                <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{staff.staffName}</span>
                                    {staff.isBackup && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                                        Mobile Backup
                                      </span>
                                    )}
                                  </div>
                                  {staff.isBackup && (
                                    <div className="text-[11px] font-medium text-purple-700 mt-1 flex items-center gap-1">
                                      <Calendar size={12} className="text-purple-500 shrink-0" />
                                      <span>
                                        {staff.backupNote || (
                                          staff.backupDates && staff.backupDates.length > 0
                                            ? `Tanggal backup di outlet ini: ${staff.backupDatesFormatted || formatBackupDates(staff.backupDates)} (${staff.backupDates.length} hari)`
                                            : 'Jadwal backup fleksibel'
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {staff.isBackup ? (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                      Backup
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                                      {staff.role || 'crew'}
                                    </span>
                                  )}
                                </td>
                                {crewBonusList.some(b => b.outletName) && (
                                  <td className="px-3.5 py-2.5 text-gray-600 font-medium">
                                    {staff.outletName || '-'}
                                  </td>
                                )}
                                <td className="px-3.5 py-2.5 text-center">
                                  <span className="font-mono font-bold text-gray-800 text-xs">
                                    {staff.staffPcs.toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-medium ml-1">pcs</span>
                                </td>
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
                                  {rupiah(staff.staffBonus)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-amber-50/70 border-t border-amber-200 font-bold text-xs text-amber-950">
                          <tr>
                            <td colSpan={crewBonusList.some(b => b.outletName) ? 3 : 2} className="px-3.5 py-2.5 text-right font-extrabold uppercase">
                              Total:
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-black text-amber-900">
                              <span className="font-mono">{totalCrewPcs.toLocaleString('id-ID')}</span>
                              <span className="text-[10px] text-amber-800 font-medium ml-1">pcs</span>
                            </td>
                            <td className="px-3 py-2.5"></td>
                            <td className="px-3.5 py-2.5 text-right font-black text-amber-800">
                              {rupiah(crewBonusAmount)}
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
                Total Beban Bonus Kru: <strong className="text-amber-700">{rupiah(crewBonusAmount)}</strong>
                {totalCrewPcs > 0 && (
                  <span className="ml-2 text-gray-500 font-normal">
                    • <strong className="text-gray-800 font-bold">{totalCrewPcs.toLocaleString('id-ID')} pcs</strong> terjual
                  </span>
                )}
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100/80 text-purple-800 border border-purple-300">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
                      </span>
                      Realtime Penjualan
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isProrated && prorataInfo
                      ? `Bonus insentif penjualan pengawas proporsional ${prorataInfo.overlapDays} hari dari total ${prorataInfo.totalDays} hari periode (dihitung riil Rp 50/pcs AM + Rp 50/pcs RM dari transaksi penjualan)`
                      : 'Rincian insentif penjualan Area Manager dan Regional Manager (skema Rp 50 per pcs terjual)'}
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
                    {rupiah(managerBonusAmount)}
                  </span>
                  <span className="text-[10px] text-purple-700 font-semibold">
                    {salaryData.baselineManagerBonus
                      ? `Estimasi sebulan: ${rupiah(salaryData.baselineManagerBonus)} (berbasis penjualan MTD)`
                      : isProrated && prorataInfo
                      ? `Baseline sebulan: ${rupiah(hrPayroll?.managerBonusAllocation ?? 0)}`
                      : 'Skema insentif Rp 100/pcs per cabang (Rp 50 AM + Rp 50 RM)'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Pengawas Penerima
                  </span>
                  <span className="text-lg font-black text-slate-800 mt-1 block">
                    {calculatedManagerRows.length} Orang
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
                  <span className="font-bold">Ketentuan Bonus Sales AM & RM:</span> Bonus penjualan (insentif performa) pengawas operasional lapangan dihitung langsung dari volume produk terjual (<em>per pcs</em>):
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    <li><strong>Area Manager (AM):</strong> Mendapatkan insentif <strong>Rp 50 per pcs</strong> dari total produk terjual pada cabang binaannya (<code>Total Pcs Cabang × Rp 50</code>).</li>
                    <li><strong>Regional Manager (RM):</strong> Mendapatkan insentif <strong>Rp 50 per pcs</strong> dari total produk terjual pada seluruh cabang wilayah binaannya (<code>Total Pcs Cabang × Rp 50</code>).</li>
                  </ul>
                  Total beban bonus pengawas di cabang ini adalah <strong>Rp 100 per pcs</strong> terjual (Rp 50 AM + Rp 50 RM), dipisahkan dari beban gaji rutin (gaji pokok & tunjangan) agar performa dan efisiensi biaya operasional variabel per cabang dapat dievaluasi secara akurat.
                </div>
              </div>

              {/* Table Breakdown per Manager Penerima */}
              <div>
                <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Daftar Pengawas Penerima Bonus</span>
                  <span className="text-gray-400 font-normal normal-case">
                    {calculatedManagerRows.length} orang
                  </span>
                </h4>

                {calculatedManagerRows.length === 0 ? (
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
                            <th className="px-3.5 py-2.5">Tarif Insentif / Skema</th>
                            <th className="px-3.5 py-2.5 text-center">Jumlah Pcs Terjual</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                            <th className="px-3.5 py-2.5 text-right">
                              {isProrated ? 'Alokasi Prorata' : 'Alokasi Bonus'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {calculatedManagerRows.map((mgr) => {
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
                                <td className="px-3.5 py-2.5 text-gray-700 font-medium">
                                  <span className="font-semibold text-purple-900 bg-purple-100/70 px-2 py-0.5 rounded text-[11px] border border-purple-200">
                                    Rp 50 / pcs
                                  </span>
                                  <span className="text-[10px] text-gray-500 ml-1.5 font-normal">
                                    {mgr.role === 'regional_manager' ? 'Wilayah Regional' : 'Cabang Binaan'}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-center">
                                  <span className="font-mono font-bold text-gray-800 text-xs">
                                    {mgr.staffPcs.toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-medium ml-1">pcs</span>
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
                                  {rupiah(mgr.staffBonus)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-purple-50/70 border-t border-purple-200 font-bold text-xs text-purple-950">
                          <tr>
                            <td colSpan={3} className="px-3.5 py-2.5 text-right font-extrabold uppercase">
                              Total:
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-black text-purple-900">
                              <span className="font-mono">{totalManagerPcs.toLocaleString('id-ID')}</span>
                              <span className="text-[10px] text-purple-800 font-medium ml-1">pcs</span>
                            </td>
                            <td className="px-3 py-2.5"></td>
                            <td className="px-3.5 py-2.5 text-right font-black text-purple-800">
                              {rupiah(managerBonusAmount)}
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
                Total Alokasi Bonus AM & RM: <strong className="text-purple-700">{rupiah(managerBonusAmount)}</strong>
                {totalManagerPcs > 0 && (
                  <span className="ml-2 text-gray-500 font-normal">
                    • <strong className="text-gray-800 font-bold">{totalManagerPcs.toLocaleString('id-ID')} pcs</strong> terjual
                  </span>
                )}
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

        {/* ==================== MODAL 4C: LEMBUR KAS OUTLET (PETTY CASH) ==================== */}
        {type === 'lembur' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-orange-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                    Rincian Lembur Kasir & Kru Toko (Petty Cash)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upah lembur harian kru cabang yang dicairkan langsung via kas kecil toko (dipisahkan mandiri dari pengeluaran outlet)
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
                  onClick={() => setLemburTab('outlet')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    lemburTab === 'outlet'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Store size={13} />
                  <span>Per Cabang ({lemburData?.outlets.length ?? 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLemburTab('transactions')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    lemburTab === 'transactions'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Clock size={13} />
                  <span>Daftar Transaksi ({lemburData?.totalCount ?? 0})</span>
                </button>
              </div>
              <div className="text-xs font-semibold text-gray-500">
                Total Lembur: <strong className="text-orange-700">{rupiah(lemburData?.totalLembur ?? 0)}</strong>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 min-h-0">
              {/* Highlight Card */}
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block">
                    Total Lembur Kas Outlet
                  </span>
                  <span className="text-2xl font-black text-orange-900 mt-0.5 block tracking-tight">
                    {rupiah(lemburData?.totalLembur ?? 0)}
                  </span>
                  <p className="text-xs text-orange-800 mt-1">
                    {lemburData?.totalCount ?? 0} transaksi pengeluaran lembur kas di {lemburData?.outlets.length ?? 0} cabang.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                    Petty Cash Toko
                  </span>
                </div>
              </div>

              {/* Info Alert */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900">
                💡 <strong>Informasi:</strong> Biaya lembur kru yang dicairkan langsung dari kas kecil toko kini telah dipisahkan secara mandiri ke kartu ini. Biaya tersebut <strong>tidak lagi digabungkan ke pos Pengeluaran Outlet</strong>, sehingga pos Pengeluaran Outlet murni hanya berisi kebutuhan fisik toko (perlengkapan, perbaikan, sabun, galon, dll).
              </div>

              {/* Tab 1: Rekap per Cabang */}
              {lemburTab === 'outlet' && (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-3.5 py-2.5">Unit / Cabang</th>
                          <th className="px-3 py-2.5 text-center">Jumlah Transaksi</th>
                          <th className="px-3.5 py-2.5 text-right">Subtotal Lembur</th>
                          <th className="px-3 py-2.5 text-right">Porsi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(lemburData?.outlets || []).map((o) => {
                          const pct = (lemburData?.totalLembur ?? 0) > 0
                            ? (o.totalAmount / (lemburData?.totalLembur ?? 1)) * 100
                            : 0
                          return (
                            <tr key={o.outletName} className="hover:bg-orange-50/30 transition-colors">
                              <td className="px-3.5 py-2.5 font-bold text-gray-800">
                                {o.outletName}
                              </td>
                              <td className="px-3 py-2.5 text-center font-semibold text-gray-600">
                                {o.count} nota
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-extrabold text-orange-700 whitespace-nowrap">
                                {rupiah(o.totalAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 whitespace-nowrap">
                                {pct.toFixed(1)}%
                              </td>
                            </tr>
                          )
                        })}
                        {(!lemburData?.outlets || lemburData.outlets.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-400 font-medium">
                              Tidak ada pengeluaran lembur kas pada periode ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {Boolean(lemburData?.outlets && lemburData.outlets.length > 0) && (
                        <tfoot className="bg-orange-50/70 border-t border-orange-200 font-bold text-xs text-orange-950">
                          <tr>
                            <td className="px-3.5 py-2.5 font-extrabold">Total:</td>
                            <td className="px-3 py-2.5 text-center font-bold">{lemburData?.totalCount ?? 0} nota</td>
                            <td className="px-3.5 py-2.5 text-right font-black text-orange-800">
                              {rupiah(lemburData?.totalLembur ?? 0)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-600">100%</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Daftar Transaksi Lengkap */}
              {lemburTab === 'transactions' && (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5">Tanggal</th>
                          <th className="px-3 py-2.5">Cabang</th>
                          <th className="px-3.5 py-2.5">Keterangan / Keperluan</th>
                          <th className="px-3 py-2.5 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(lemburData?.items || []).map((it) => (
                          <tr key={it.id} className="hover:bg-orange-50/30 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-gray-600 whitespace-nowrap">
                              {it.date}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-gray-800 whitespace-nowrap">
                              {it.outletName}
                            </td>
                            <td className="px-3.5 py-2.5 text-gray-700">
                              <div>{it.description}</div>
                              {it.recipientName && it.recipientName !== '-' && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  Penerima: {it.recipientName}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-extrabold text-orange-700 whitespace-nowrap">
                              {rupiah(it.amount)}
                            </td>
                          </tr>
                        ))}
                        {(!lemburData?.items || lemburData.items.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-400 font-medium">
                              Tidak ada transaksi lembur kas pada periode ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {Boolean(lemburData?.items && lemburData.items.length > 0) && (
                        <tfoot className="bg-orange-50/70 border-t border-orange-200 font-bold text-xs text-orange-950">
                          <tr>
                            <td colSpan={3} className="px-3.5 py-2.5 text-right font-extrabold uppercase">
                              Total Pengeluaran Lembur Kas:
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-black text-orange-800 whitespace-nowrap">
                              {rupiah(lemburData?.totalLembur ?? 0)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500 font-semibold">
                Total Lembur Kas: <strong className="text-orange-700">{rupiah(lemburData?.totalLembur ?? 0)}</strong>
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
                  {(!isPusat || crewBonusAmount > 0) && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${crewBonusShare}%` }}
                      title={`${isPusat ? 'Bonus Staf Kantor' : 'Bonus Kru Toko'}: ${crewBonusShare.toFixed(1)}%`}
                    />
                  )}
                  {!isPusat && managerBonusAmount > 0 && (
                    <div
                      className="h-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${managerBonusShare}%` }}
                      title={`Bonus Sales AM & RM: ${managerBonusShare.toFixed(1)}%`}
                    />
                  )}
                  {lemburAmount > 0 && (
                    <div
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${lemburShare}%` }}
                      title={`Lembur Kas: ${lemburShare.toFixed(1)}%`}
                    />
                  )}
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
                  {(!isPusat || crewBonusAmount > 0) && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      <span className="font-semibold text-gray-700">
                        {isPusat ? 'Bonus Kantor:' : 'Bonus Kru:'} <strong className="text-amber-700">{crewBonusShare.toFixed(1)}%</strong> ({rupiah(crewBonusAmount)})
                      </span>
                    </div>
                  )}
                  {!isPusat && managerBonusAmount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" />
                      <span className="font-semibold text-gray-700">
                        Bonus AM/RM: <strong className="text-purple-700">{managerBonusShare.toFixed(1)}%</strong> ({rupiah(managerBonusAmount)})
                      </span>
                    </div>
                  )}
                  {lemburAmount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                      <span className="font-semibold text-gray-700">
                        Lemburan: <strong className="text-orange-700">{lemburShare.toFixed(1)}%</strong> ({rupiah(lemburAmount)})
                      </span>
                    </div>
                  )}
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
                          <span>{isPusat ? '1. Gaji & Payroll Staf Kantor' : '1. Gaji & Payroll (Rutin)'}</span>
                          {totalOpexData.isProrated && totalOpexData.prorataInfo && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Prorata {totalOpexData.prorataInfo.overlapDays} Hari
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {isPusat ? 'Gaji pokok dan tunjangan staf kantor pusat' : 'Gaji pokok, tunjangan rutin kru, dan alokasi rutin manajer di luar bonus omset'}
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

                  {/* Item 2: Bonus Kru Toko / Staf Kantor */}
                  {(!isPusat || crewBonusAmount > 0) && (
                    <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Award size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-xs sm:text-sm">
                            {isPusat ? '2. Bonus / Insentif Staf Kantor' : '2. Bonus & Insentif Kru Toko'}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {isPusat ? 'Bonus dan insentif staf kantor pusat' : 'Bonus omset penjualan bulanan yang dicapai kru toko'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-amber-700 text-sm sm:text-base">
                          {rupiah(crewBonusAmount)}
                        </div>
                        <div className="text-[10px] text-gray-400 font-semibold">
                          {crewBonusShare.toFixed(1)}% dari total
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Item 3: Bonus Sales AM & RM */}
                  {!isPusat && (
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
                            Insentif penjualan produk: Area Manager (Rp 50/pcs) dan Regional Manager (Rp 50/pcs)
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-purple-700 text-sm sm:text-base">
                          {rupiah(managerBonusAmount)}
                        </div>
                        <div className="text-[10px] text-gray-400 font-semibold">
                          {managerBonusShare.toFixed(1)}% dari total
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Item 4: Lembur Kas Outlet */}
                  {lemburAmount > 0 && (
                    <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Clock size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                            <span>4. Lemburan</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                              Kasir Cabang
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Upah lembur harian kru yang dibayarkan tunai via kas kecil outlet
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-orange-700 text-sm sm:text-base">
                          {rupiah(lemburAmount)}
                        </div>
                        <div className="text-[10px] text-gray-400 font-semibold">
                          {lemburShare.toFixed(1)}% dari total
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Item 5: Operational Non-Salary */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Store size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-xs sm:text-sm">
                          {lemburAmount > 0 ? '5. Operasional Outlet & Pusat' : '4. Operasional Outlet & Pusat'}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Beban operasional non-gaji murni ({opCount} transaksi: listrik, sewa cabang, wifi, fisik toko)
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
                      <span>{lemburAmount > 0 ? 'Total OPEX Bersih (1 + 2 + 3 + 4 + 5):' : 'Total OPEX Bersih (1 + 2 + 3 + 4):'}</span>
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
