'use client'

import { useState, useEffect } from 'react'
import { Button } from '@suka/design-system'
import { formatRupiah } from '@/lib/format'
import type { PayrollRecord } from '@/lib/types'
import { getPayrollBreakdown, buildPayrollNotes, LATE_FEE_PER_MINUTE } from '@/lib/payrollBreakdown'
import {
  Clock,
  Sparkles,
  Lock,
  Unlock,
  ExternalLink,
  RotateCcw,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface PayrollSlipFormProps {
  record: PayrollRecord
  onSubmit: (values: {
    id: string
    basic_salary: number
    allowance_meal?: number
    allowance_transport?: number
    allowance_communication?: number
    sales_bonus?: number
    deduction_kasbon?: number
    deduction_bpjs?: number
    allowance_position: number
    allowance_presence: number
    bonus: number
    bonus_note: string | null
    deductions: number
    deduction_note: string | null
  }) => void
  submitting?: boolean
  onCancel: () => void
}

const inputClass =
  'w-full rounded-xl border border-stone-200 px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange transition-all bg-white text-suka-ink placeholder:text-stone-300'

const overrideInputClass =
  'w-full rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-stone-900 font-mono'

export function PayrollSlipForm({ record, onSubmit, submitting, onCancel }: PayrollSlipFormProps) {
  const initial = getPayrollBreakdown(record)

  // 1. Take Home Pay Components (Penerimaan)
  const [basicSalary, setBasicSalary] = useState(initial.basicSalary)
  const [overtime, setOvertime] = useState(initial.overtime)
  const [mealAllowance, setMealAllowance] = useState(initial.mealAllowance)
  const [transportAllowance, setTransportAllowance] = useState(initial.transportAllowance)
  const [communicationAllowance, setCommunicationAllowance] = useState(initial.communicationAllowance)
  const [salesBonus, setSalesBonus] = useState(initial.salesBonus)
  const [positionAllowance, setPositionAllowance] = useState(initial.positionAllowance)

  // 2. Deductions Components (Potongan)
  const [cashAdvanceDeduction, setCashAdvanceDeduction] = useState(initial.cashAdvanceDeduction)
  const [bpjsDeduction, setBpjsDeduction] = useState(initial.bpjsDeduction)
  const [lateMinutes, setLateMinutes] = useState(initial.lateMinutes)
  const [otherDeduction, setOtherDeduction] = useState(initial.otherDeduction)
  const [otherDeductionReason, setOtherDeductionReason] = useState('')

  // Live attendance lookup
  const [fetchingAtt, setFetchingAtt] = useState(false)
  const [liveAttMinutes, setLiveAttMinutes] = useState<number | null>(null)

  // Live sales bonus lookup (Crew, AM, RM)
  const [fetchingBonus, setFetchingBonus] = useState(false)
  const [liveBonusInfo, setLiveBonusInfo] = useState<{ amount: number; description: string } | null>(null)

  // Live active kasbon lookup
  const [_fetchingKasbon, setFetchingKasbon] = useState(false)
  const [liveKasbonInfo, setLiveKasbonInfo] = useState<{
    totalLoan: number
    remaining: number
    monthlyInstallment: number
    count: number
  } | null>(null)
  const [pendingKasbonInfo, setPendingKasbonInfo] = useState<{
    count: number
    totalAmount: number
  } | null>(null)

  // Emergency Override Toggle for Master Data
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(false)

  const handleResetToMaster = () => {
    setBasicSalary(initial.basicSalary)
    setMealAllowance(initial.mealAllowance)
    setTransportAllowance(initial.transportAllowance)
    setCommunicationAllowance(initial.communicationAllowance)
    setPositionAllowance(initial.positionAllowance)
    setBpjsDeduction(initial.bpjsDeduction)
    if (liveKasbonInfo) {
      setCashAdvanceDeduction(liveKasbonInfo.monthlyInstallment)
    } else {
      setCashAdvanceDeduction(0)
    }
  }

  const handleToggleOverride = () => {
    if (isOverrideEnabled) {
      handleResetToMaster()
      setIsOverrideEnabled(false)
    } else {
      setIsOverrideEnabled(true)
    }
  }

  useEffect(() => {
    const fetchLiveAtt = async () => {
      setFetchingAtt(true)
      try {
        const supabase = createClient()
        const startDay = `${record.period_year}-${String(record.period_month).padStart(2, '0')}-01`
        const lastDate = new Date(record.period_year, record.period_month, 0).getDate()
        const endDay = `${record.period_year}-${String(record.period_month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`

        let totalMins = 0

        // 1. Check attendance table
        const { data: rawAtt } = await supabase
          .from('attendance')
          .select('telat_menit, type, status')
          .eq('outlet_staff_id', record.staff_id)
          .gte('ts_server', `${startDay}T00:00:00.000+07:00`)
          .lte('ts_server', `${endDay}T23:59:59.999+07:00`)

        rawAtt?.forEach((a: any) => {
          if (a.type === 'in' && (a.telat_menit > 0 || a.status === 'telat' || a.status === 'terlambat')) {
            totalMins += Number(a.telat_menit) || 0
          }
        })

        // 2. Check attendance_logs table
        const { data: logs } = await supabase
          .from('attendance_logs')
          .select('late_minutes')
          .eq('staff_id', record.staff_id)
          .gte('date', startDay)
          .lte('date', endDay)

        let logMins = 0
        logs?.forEach((l: any) => {
          logMins += Number(l.late_minutes) || 0
        })

        const finalMins = Math.max(totalMins, logMins)
        setLiveAttMinutes(finalMins)
      } catch (e) {
        // Ignore
      } finally {
        setFetchingAtt(false)
      }
    }

    const fetchLiveBonus = async () => {
      setFetchingBonus(true)
      try {
        const supabase = createClient()
        const staffRole = record.outlet_staff?.role

        if (staffRole === 'area_manager') {
          const { data } = await supabase.rpc('get_monthly_am_bonus', {
            p_month: record.period_month,
            p_year: record.period_year,
          })
          const match = (data || []).find((a: any) => a.staff_id === record.staff_id)
          if (match) {
            const amt = Number(match.total_bonus) || 0
            setLiveBonusInfo({
              amount: amt,
              description: `AM (${match.total_pcs} pcs x Rp 50)`,
            })
          }
        } else if (staffRole === 'regional_manager') {
          const { data } = await supabase.rpc('get_monthly_rm_bonus', {
            p_month: record.period_month,
            p_year: record.period_year,
          })
          const match = (data || []).find((r: any) => r.staff_id === record.staff_id)
          if (match) {
            const amt = Number(match.total_bonus) || 0
            setLiveBonusInfo({
              amount: amt,
              description: `RM (${match.total_pcs_global} pcs x Rp 50)`,
            })
          }
        } else {
          // Crew & Leader
          const { data } = await supabase.rpc('get_monthly_crew_bonus', {
            p_month: record.period_month,
            p_year: record.period_year,
            p_outlet_id: null,
          })
          const match = (data || []).find((c: any) => c.crew_id === record.staff_id)
          if (match) {
            const amt = Number(match.total_bonus) || 0
            setLiveBonusInfo({
              amount: amt,
              description: `Pool (${match.total_pcs_outlet} pcs / ${match.active_crew_count} kru)`,
            })
          }
        }
      } catch (e) {
        // Ignore
      } finally {
        setFetchingBonus(false)
      }
    }

    const fetchLiveKasbon = async () => {
      setFetchingKasbon(true)
      try {
        const supabase = createClient()
        const { data: kasbons } = await supabase
          .from('cash_advances')
          .select('id, amount, remaining, installment_months, status_hr')
          .eq('staff_id', record.staff_id)
          .eq('status', 'active')

        const approved = (kasbons || []).filter((k: any) => k.status_hr === 'approved')
        const pending = (kasbons || []).filter((k: any) => k.status_hr === 'pending')

        if (pending.length > 0) {
          const totalPending = pending.reduce((acc: number, k: any) => acc + (Number(k.amount) || 0), 0)
          setPendingKasbonInfo({
            count: pending.length,
            totalAmount: totalPending,
          })
        } else {
          setPendingKasbonInfo(null)
        }

        if (approved.length > 0) {
          let totalLoan = 0
          let remaining = 0
          let monthlyInstallment = 0

          approved.forEach((k: any) => {
            const amt = Number(k.amount) || 0
            const rem = Number(k.remaining) || 0
            const months = Number(k.installment_months) || 1
            totalLoan += amt
            remaining += rem
            const installment = months > 1 ? Math.min(rem, Math.ceil(amt / months)) : rem
            monthlyInstallment += installment
          })

          setLiveKasbonInfo({
            totalLoan,
            remaining,
            monthlyInstallment,
            count: approved.length,
          })

          // Otomatis sinkronkan cicilan resmi jika proteksi master aktif
          if (!isOverrideEnabled) {
            setCashAdvanceDeduction(monthlyInstallment)
          }
        } else {
          setLiveKasbonInfo(null)
          // Jika tidak ada kasbon disetujui di modul, reset ke 0
          if (!isOverrideEnabled) {
            setCashAdvanceDeduction(0)
          }
        }
      } catch (e) {
        // Ignore
      } finally {
        setFetchingKasbon(false)
      }
    }

    fetchLiveAtt()
    fetchLiveBonus()
    fetchLiveKasbon()
  }, [record.staff_id, record.period_month, record.period_year, record.outlet_staff?.role, isOverrideEnabled])

  // Calculations
  const lateDeduction = lateMinutes * LATE_FEE_PER_MINUTE

  const totalEarnings =
    Number(basicSalary) +
    Number(overtime) +
    Number(mealAllowance) +
    Number(transportAllowance) +
    Number(communicationAllowance) +
    Number(salesBonus) +
    Number(positionAllowance)

  const totalDeductions =
    Number(cashAdvanceDeduction) +
    Number(bpjsDeduction) +
    Number(lateDeduction) +
    Number(otherDeduction)
  const takeHomePay = Math.max(0, totalEarnings - totalDeductions)

  const handleApplyLiveAttendance = () => {
    if (liveAttMinutes !== null) {
      setLateMinutes(liveAttMinutes)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const { bonus_note, deduction_note } = buildPayrollNotes({
      overtime: Number(overtime),
      salesBonus: Number(salesBonus),
      transport: Number(transportAllowance),
      communication: Number(communicationAllowance),
      kasbon: Number(cashAdvanceDeduction),
      bpjs: Number(bpjsDeduction),
      lateMinutes: Number(lateMinutes),
      lateDeduction: Number(lateDeduction),
      otherDeduction: Number(otherDeduction),
      customDeductionNote: otherDeductionReason.trim() || undefined,
    })

    onSubmit({
      id: record.id,
      basic_salary: Number(basicSalary),
      allowance_meal: Number(mealAllowance),
      allowance_transport: Number(transportAllowance),
      allowance_communication: Number(communicationAllowance),
      sales_bonus: Number(salesBonus),
      deduction_kasbon: Number(cashAdvanceDeduction),
      deduction_bpjs: Number(bpjsDeduction),
      allowance_presence: Number(mealAllowance),
      allowance_position: Number(positionAllowance),
      bonus: Number(overtime) + Number(salesBonus),
      bonus_note,
      deductions: totalDeductions,
      deduction_note,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 my-6 max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-suka-brown">
                Rincian Slip Gaji: {record.outlet_staff?.name}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-suka-orange/10 text-suka-orange border border-suka-orange/20">
                {record.outlet_staff?.role?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Periode: <strong className="text-stone-700">Bulan {record.period_month}/{record.period_year}</strong> &bull; Outlet: <strong className="text-stone-700">{record.outlet_staff?.outlets?.name || 'Kantor Pusat'}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. Komponen Tetap (Master Data & Kasbon) Card */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-stone-200 text-stone-700">
                <Lock size={13} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-800">Komponen Tetap (Master Data &amp; Kasbon)</h4>
                <p className="text-[11px] text-stone-500">Tersinkronisasi otomatis dari Master Karyawan dan Modul Kasbon.</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href="/staff"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-300 flex items-center gap-1 transition-all shadow-2xs"
                title="Buka profil karyawan untuk mengubah data master gaji"
              >
                <span>Edit di Master</span>
                <ExternalLink size={10} />
              </a>
              <a
                href="/perizinan/kasbon"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 flex items-center gap-1 transition-all shadow-2xs"
                title="Buka modul kasbon untuk approval pinjaman"
              >
                <span>Modul Kasbon</span>
                <ExternalLink size={10} />
              </a>
              <button
                type="button"
                onClick={handleToggleOverride}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                  isOverrideEnabled
                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 shadow-2xs'
                }`}
                title={isOverrideEnabled ? 'Kunci kembali ke data master' : 'Buka kunci untuk penyesuaian darurat'}
              >
                {isOverrideEnabled ? <Lock size={11} /> : <Unlock size={11} />}
                <span>{isOverrideEnabled ? 'Tutup Override' : 'Override Khusus'}</span>
              </button>
            </div>
          </div>

          {/* Normal Read-Only View: Clean 4-Column Stat Cards */}
          {!isOverrideEnabled ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Gaji Pokok</span>
                <span className="text-sm font-bold font-mono text-stone-800">{formatRupiah(basicSalary)}</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Tunjangan Tetap</span>
                <span className="text-sm font-bold font-mono text-stone-800">
                  {formatRupiah(mealAllowance + transportAllowance + communicationAllowance + positionAllowance)}
                </span>
                <span
                  className="text-[9px] text-stone-400 block truncate"
                  title={`Makan: ${formatRupiah(mealAllowance)} | Transp: ${formatRupiah(transportAllowance)} | Pulsa: ${formatRupiah(communicationAllowance)} | Jab: ${formatRupiah(positionAllowance)}`}
                >
                  Makan, Transp, Pulsa, Jab
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Potongan BPJS</span>
                <span className="text-sm font-bold font-mono text-stone-800">
                  {bpjsDeduction > 0 ? `-${formatRupiah(bpjsDeduction)}` : 'Rp 0'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Potongan Kasbon</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    cashAdvanceDeduction > 0 ? 'text-red-600' : 'text-stone-800'
                  }`}
                >
                  {cashAdvanceDeduction > 0 ? `-${formatRupiah(cashAdvanceDeduction)}` : 'Rp 0'}
                </span>
                {liveKasbonInfo && liveKasbonInfo.remaining > 0 ? (
                  <span className="text-[9px] text-purple-700 font-semibold block truncate">
                    Sisa: {formatRupiah(liveKasbonInfo.remaining)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            /* Override Mode: Clean compact inputs */
            <div className="space-y-3 pt-2 border-t border-amber-200">
              <div className="flex items-center justify-between text-xs bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-900">
                <span className="font-semibold text-[11px]">
                  ⚠️ Mode Override Aktif: Perubahan hanya berlaku untuk slip bulan ini (tidak merubah master karyawan).
                </span>
                <button
                  type="button"
                  onClick={handleResetToMaster}
                  className="px-2 py-1 text-[10px] font-bold bg-white text-stone-700 hover:bg-stone-100 rounded-lg border border-stone-300 flex items-center gap-1 cursor-pointer shadow-2xs shrink-0 ml-2"
                >
                  <RotateCcw size={10} />
                  <span>Reset ke Master</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Gaji Pokok (Rp)</label>
                  <input
                    type="number"
                    className={overrideInputClass}
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Uang Makan (Rp)</label>
                  <input
                    type="number"
                    className={overrideInputClass}
                    value={mealAllowance}
                    onChange={(e) => setMealAllowance(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Uang Transport (Rp)</label>
                  <input
                    type="number"
                    className={overrideInputClass}
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Tunjangan Pulsa (Rp)</label>
                  <input
                    type="number"
                    className={overrideInputClass}
                    value={communicationAllowance}
                    onChange={(e) => setCommunicationAllowance(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Tunjangan Jabatan (Rp)</label>
                  <input
                    type="number"
                    className={overrideInputClass}
                    value={positionAllowance}
                    onChange={(e) => setPositionAllowance(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Potongan BPJS (Rp)</label>
                  <input
                    type="number"
                    className={overrideInputClass}
                    value={bpjsDeduction}
                    onChange={(e) => setBpjsDeduction(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-1">Potongan Kasbon (Rp)</label>
                  <input
                    type="number"
                    className={overrideInputClass}
                    value={cashAdvanceDeduction}
                    onChange={(e) => setCashAdvanceDeduction(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pending Kasbon Alert (Hanya muncul jika ada pengajuan pending) */}
          {pendingKasbonInfo && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-amber-600 shrink-0" />
                <span>
                  Ada <strong>{pendingKasbonInfo.count} pengajuan kasbon ({formatRupiah(pendingKasbonInfo.totalAmount)})</strong> berstatus pending.
                </span>
              </div>
              <a
                href="/perizinan/kasbon"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-amber-950 underline hover:text-black shrink-0"
              >
                Approval Kasbon &rarr;
              </a>
            </div>
          )}
        </div>

        {/* 2. Penyesuaian Bulan Ini (Variabel) Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-suka-orange">
                <Sparkles size={14} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-800">Penyesuaian Bulan Ini (Variabel)</h4>
                <p className="text-[11px] text-stone-400">Komponen bulanan: Lembur, Bonus POS, Keterlambatan, dan Ganti Rugi.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Overtime / Lembur */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Overtime / Lembur (Rp)
              </label>
              <input
                type="number"
                className={inputClass}
                value={overtime}
                onChange={(e) => setOvertime(Number(e.target.value))}
                min={0}
                placeholder="0"
              />
              <span className="text-[10px] text-stone-400 block mt-1">
                Insentif lembur bulan berjalan.
              </span>
            </div>

            {/* 2. Bonus Penjualan (POS) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-700">Bonus Penjualan / POS (Rp)</label>
                {liveBonusInfo && liveBonusInfo.amount > 0 && liveBonusInfo.amount !== salesBonus && (
                  <button
                    type="button"
                    onClick={() => setSalesBonus(liveBonusInfo.amount)}
                    className="text-[10px] font-bold text-orange-800 hover:text-orange-950 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                  >
                    + Sync POS ({formatRupiah(liveBonusInfo.amount)})
                  </button>
                )}
              </div>
              <input
                type="number"
                className={inputClass}
                value={salesBonus}
                onChange={(e) => setSalesBonus(Number(e.target.value))}
                min={0}
                placeholder="0"
              />
              {liveBonusInfo && liveBonusInfo.amount > 0 ? (
                <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
                  ✓ Target POS: {formatRupiah(liveBonusInfo.amount)} ({liveBonusInfo.description})
                </span>
              ) : (
                <span className="text-[10px] text-stone-400 block mt-1">
                  {fetchingBonus ? 'Mengecek data POS...' : 'Target POS bulan ini: Rp 0'}
                </span>
              )}
            </div>

            {/* 3. Keterlambatan Absensi */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-700">Keterlambatan (Absensi)</label>
                {liveAttMinutes !== null && liveAttMinutes > 0 && liveAttMinutes !== lateMinutes && (
                  <button
                    type="button"
                    onClick={handleApplyLiveAttendance}
                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                  >
                    + Sync Absensi ({liveAttMinutes}m)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    className={`${inputClass} pr-12 font-mono`}
                    value={lateMinutes}
                    onChange={(e) => setLateMinutes(Number(e.target.value))}
                    min={0}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-medium">mnt</span>
                </div>
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs font-bold font-mono whitespace-nowrap">
                  -{formatRupiah(lateDeduction)}
                </div>
              </div>
              {liveAttMinutes !== null && liveAttMinutes > 0 ? (
                <span className="text-[10px] text-red-600 font-semibold block mt-1">
                  Mesin absensi: {liveAttMinutes} menit terlambat (@ Rp 1.000/mnt)
                </span>
              ) : (
                <span className="text-[10px] text-emerald-600 block mt-1">
                  {fetchingAtt ? 'Mengecek absensi...' : '✓ Tepat waktu / 0 menit telat'}
                </span>
              )}
            </div>

            {/* 4. Potongan Lain / Ganti Rugi */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Potongan Lain / Ganti Rugi (Rp)
              </label>
              <input
                type="number"
                className={inputClass}
                value={otherDeduction}
                onChange={(e) => setOtherDeduction(Number(e.target.value))}
                min={0}
                placeholder="0"
              />
              <span className="text-[10px] text-stone-400 block mt-1">
                Denda kerusakan inventaris / ketidaksesuaian SOP.
              </span>
            </div>

            {/* 5. Alasan / Keterangan Potongan Lain */}
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Keterangan / Alasan Potongan Lain
              </label>
              <input
                type="text"
                className={inputClass}
                value={otherDeductionReason}
                onChange={(e) => setOtherDeductionReason(e.target.value)}
                placeholder="Contoh: Ganti rugi inventaris pecah / denda ketidaksesuaian SOP"
              />
            </div>
          </div>
        </div>

        {/* 3. Take Home Pay Summary Bar */}
        <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-suka-orange/30 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider">
                  Total Penerimaan
                </span>
                <span className="font-bold font-mono text-emerald-700 text-sm">
                  {formatRupiah(totalEarnings)}
                </span>
              </div>
              <span className="text-stone-300 font-bold text-base">&minus;</span>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold tracking-wider">
                  Total Potongan
                </span>
                <span className="font-bold font-mono text-red-600 text-sm">
                  {formatRupiah(totalDeductions)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-black tracking-wider text-suka-brown/70 block">
                TOTAL TAKE HOME PAY (THP)
              </span>
              <span className="text-2xl font-black text-suka-orange font-mono">
                {formatRupiah(takeHomePay)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl font-bold">
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl font-bold bg-suka-orange hover:bg-suka-orange/90 text-white px-6 shadow-md cursor-pointer"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Rincian Slip'}
          </Button>
        </div>
      </form>
    </div>
  )
}
