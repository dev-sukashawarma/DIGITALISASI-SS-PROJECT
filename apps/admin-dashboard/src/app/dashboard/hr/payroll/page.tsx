'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Download, Plus, DollarSign, Users, PiggyBank, CreditCard } from 'lucide-react'

import { usePayroll } from '@/hooks/usePayroll'
import { usePayrollMutations } from '@/hooks/usePayrollMutations'
import { useCashAdvances } from '@/hooks/useCashAdvances'
import { useCashAdvanceMutations } from '@/hooks/useCashAdvanceMutations'

import { PayrollTable } from '@/components/PayrollTable'
import { PayrollSlipForm } from '@/components/PayrollSlipForm'
import { CashAdvanceTable } from '@/components/CashAdvanceTable'
import { CashAdvanceForm } from '@/components/CashAdvanceForm'

import { rupiah } from '@/lib/format'
import { exportCsv } from '@/lib/exportCsv'
import type { PayrollRow } from '@/hooks/usePayroll'
import type { CashAdvance } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<'payroll' | 'kasbon'>('payroll')
  
  // Payroll States
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [editingSlip, setEditingSlip] = useState<PayrollRow | null>(null)
  
  // Cash Advance States
  const [showKasbonForm, setShowKasbonForm] = useState(false)
  const [payingKasbon, setPayingKasbon] = useState<CashAdvance | null>(null)

  // Hooks
  const { data: payrollData = [], isLoading: loadingPayroll } = usePayroll(month, year)
  const payrollMutations = usePayrollMutations()
  
  const { data: kasbonData = [], isLoading: loadingKasbon } = useCashAdvances()
  const kasbonMutations = useCashAdvanceMutations()

  // ---------------------------------------------------------
  // Payroll Actions
  // ---------------------------------------------------------
  const handleGenerate = () => {
    if (!confirm(`Generate slip gaji untuk semua staff aktif periode ${MONTHS[month-1]} ${year}?`)) return
    
    payrollMutations.generate.mutate({ month, year }, {
      onSuccess: (count) => toast.success(`Berhasil membuat ${count} slip gaji`),
      onError: (e: any) => toast.error(e.message)
    })
  }

  const handleFinalize = () => {
    if (!confirm(`Finalize semua slip? Slip yang sudah final tidak bisa diedit.`)) return
    
    payrollMutations.finalizeAll.mutate({ month, year }, {
      onSuccess: () => toast.success(`Semua slip gaji berhasil di-finalize`),
      onError: (e: any) => toast.error(e.message)
    })
  }

  const handleUpdateSlip = (values: any) => {
    if (!editingSlip) return
    payrollMutations.updateSlip.mutate({ id: editingSlip.id, ...values }, {
      onSuccess: () => {
        toast.success(`Slip gaji ${editingSlip.outlet_staff?.name} diperbarui`)
        setEditingSlip(null)
      },
      onError: (e: any) => toast.error(e.message)
    })
  }

  const handleExportPayroll = () => {
    if (!payrollData.length) return toast.error('Tidak ada data untuk diexport')
    
    const rows = payrollData.map(r => ({
      Nama: r.outlet_staff?.name || '-',
      Role: r.outlet_staff?.role || '-',
      Outlet: r.outlet_staff?.outlets?.name || '-',
      Periode: `${r.period_month}/${r.period_year}`,
      'Gaji Pokok': r.basic_salary,
      'Tunjangan Jabatan': r.allowance_position,
      'Tunjangan Hadir': r.allowance_presence,
      Bonus: r.bonus,
      'Catatan Bonus': r.bonus_note || '-',
      Potongan: r.deductions,
      'Catatan Potongan': r.deduction_note || '-',
      'Total Gaji': r.total_salary,
      Status: r.status
    }))
    
    exportCsv(rows, Object.keys(rows[0]).map(k => ({ key: k as keyof typeof rows[0], label: k })), `Payroll_${MONTHS[month-1]}_${year}`)
  }

  // ---------------------------------------------------------
  // Kasbon Actions
  // ---------------------------------------------------------
  const handleCreateKasbon = (values: any) => {
    kasbonMutations.create.mutate(values, {
      onSuccess: () => {
        toast.success('Kasbon baru berhasil dibuat')
        setShowKasbonForm(false)
      },
      onError: (e: any) => toast.error(e.message)
    })
  }

  const handleAddPayment = (values: any) => {
    if (!payingKasbon) return
    kasbonMutations.addPayment.mutate({
      cash_advance_id: payingKasbon.id,
      amount: values.amount,
      note: values.note
    }, {
      onSuccess: () => {
        toast.success('Pembayaran kasbon berhasil dicatat')
        setPayingKasbon(null)
      },
      onError: (e: any) => toast.error(e.message)
    })
  }

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-suka-ink">Payroll & Kasbon</h1>
        <p className="text-sm text-suka-gray-500">Kelola slip gaji bulanan dan pinjaman karyawan.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-suka-gray-200 pb-4">
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 font-bold rounded-xl transition-all ${
            activeTab === 'payroll' ? 'bg-suka-brown text-white shadow-md' : 'bg-white text-suka-brown border border-suka-gray-200 hover:bg-suka-cream'
          }`}
        >
          Slip Gaji
        </button>
        <button
          onClick={() => setActiveTab('kasbon')}
          className={`px-4 py-2 font-bold rounded-xl transition-all ${
            activeTab === 'kasbon' ? 'bg-suka-brown text-white shadow-md' : 'bg-white text-suka-brown border border-suka-gray-200 hover:bg-suka-cream'
          }`}
        >
          Kasbon Karyawan
        </button>
      </div>

      {activeTab === 'payroll' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <select 
                value={month} 
                onChange={e => setMonth(Number(e.target.value))}
                className="rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <input 
                type="number" 
                value={year} 
                onChange={e => setYear(Number(e.target.value))}
                className="w-24 rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handleGenerate} disabled={payrollMutations.generate.isPending} className="bg-suka-orange hover:bg-suka-orange/90 text-white border-0">
                {payrollMutations.generate.isPending ? <Spinner size="sm" /> : 'Generate Slip'}
              </Button>
              <Button onClick={handleFinalize} disabled={payrollMutations.finalizeAll.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                {payrollMutations.finalizeAll.isPending ? <Spinner size="sm" /> : 'Finalize Semua'}
              </Button>
              <Button onClick={handleExportPayroll} className="bg-white text-suka-ink border-suka-gray-200 hover:bg-suka-gray-50 flex items-center gap-2">
                <Download size={16} /> Export
              </Button>
            </div>
          </div>

          {/* Summaries */}
          {payrollData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-suka-gray-500">Total Gaji Bulan Ini</p>
                  <p className="text-xl font-bold text-suka-ink">{rupiah(payrollData.reduce((acc, r) => acc + r.total_salary, 0))}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CreditCard size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-suka-gray-500">Rata-rata Gaji</p>
                  <p className="text-xl font-bold text-suka-ink">{rupiah(payrollData.length ? payrollData.reduce((acc, r) => acc + r.total_salary, 0) / payrollData.length : 0)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-suka-gray-500">Jumlah Staff</p>
                  <p className="text-xl font-bold text-suka-ink">{payrollData.length} Orang</p>
                </div>
              </div>
            </div>
          )}

          {loadingPayroll ? (
            <div className="flex justify-center p-12"><Spinner size="lg" /></div>
          ) : (
            <PayrollTable rows={payrollData} onEdit={setEditingSlip} />
          )}

          {editingSlip && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-suka-ink/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-suka-ink mb-4">Edit Slip Gaji — {editingSlip.outlet_staff?.name}</h3>
                  <PayrollSlipForm 
                    record={editingSlip} 
                    onSubmit={handleUpdateSlip} 
                    submitting={payrollMutations.updateSlip.isPending} 
                    onCancel={() => setEditingSlip(null)} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'kasbon' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Controls */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-suka-ink">Data Pinjaman Karyawan</h2>
            <Button onClick={() => setShowKasbonForm(true)} className="flex items-center gap-2">
              <Plus size={18} /> Tambah Kasbon
            </Button>
          </div>

          {/* Summaries */}
          {kasbonData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <PiggyBank size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-suka-gray-500">Total Kasbon Aktif</p>
                  <p className="text-xl font-bold text-suka-ink">
                    {rupiah(kasbonData.filter(k => k.status === 'active').reduce((acc, k) => acc + k.remaining, 0))}
                  </p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-suka-gray-500">Jumlah Peminjam Aktif</p>
                  <p className="text-xl font-bold text-suka-ink">
                    {kasbonData.filter(k => k.status === 'active').length} Orang
                  </p>
                </div>
              </div>
            </div>
          )}

          {showKasbonForm && (
            <div className="bg-white p-6 rounded-2xl border-2 border-suka-brown/20 shadow-sm">
              <h3 className="text-lg font-bold text-suka-ink mb-4">Pengajuan Kasbon Baru</h3>
              <CashAdvanceForm 
                mode="kasbon" 
                onSubmit={handleCreateKasbon} 
                submitting={kasbonMutations.create.isPending} 
                onCancel={() => setShowKasbonForm(false)} 
              />
            </div>
          )}

          {loadingKasbon ? (
            <div className="flex justify-center p-12"><Spinner size="lg" /></div>
          ) : (
            <CashAdvanceTable rows={kasbonData} onAddPayment={setPayingKasbon} />
          )}

          {payingKasbon && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-suka-ink/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-suka-ink mb-1">Catat Pembayaran Cicilan</h3>
                  <p className="text-sm text-suka-gray-500 mb-4">
                    Karyawan: <span className="font-bold">{payingKasbon.outlet_staff?.name}</span> <br/>
                    Sisa Kasbon: <span className="font-bold text-suka-orange">{rupiah(payingKasbon.remaining)}</span>
                  </p>
                  <CashAdvanceForm 
                    mode="payment" 
                    maxAmount={payingKasbon.remaining}
                    onSubmit={handleAddPayment} 
                    submitting={kasbonMutations.addPayment.isPending} 
                    onCancel={() => setPayingKasbon(null)} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
