'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Banknote, Users, Wallet } from 'lucide-react'
import { useCashOverview } from '@/hooks/useCashData'
import { usePayrollSlips, usePayrollDisburse } from '@/hooks/usePayrollDisbursement'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { rupiah } from '@/lib/format'
import { StatCard, SectionCard } from '@/components/ui'

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const PAY_META: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'Belum Cair', cls: 'bg-suka-gray-100 text-suka-gray-600' },
  pending: { label: 'Proses (menunggu approval)', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Dibayar', cls: 'bg-emerald-100 text-emerald-700' },
}

export default function PayrollPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [location, setLocation] = useState('')

  const { locations } = useCashOverview()
  const bankLocations = locations.filter((l) => l.kind === 'bank')
  const { data: slips = [], isLoading } = usePayrollSlips(month, year)
  const disburse = usePayrollDisburse()
  const { isFinance } = useFinanceRole()

  const totalFinal = slips.reduce((a, s) => a + s.total_salary, 0)
  const unpaid = slips.filter((s) => s.payment_status === 'unpaid')
  const totalUnpaid = unpaid.reduce((a, s) => a + s.total_salary, 0)

  const handleDisburse = () => {
    if (!location) { toast.error('Pilih rekening bank sumber dana'); return }
    if (unpaid.length === 0) { toast.error('Tidak ada slip yang belum dicairkan'); return }
    if (!confirm(`Cairkan ${unpaid.length} slip (${rupiah(totalUnpaid)}) dari rekening terpilih? Tiap slip jadi transaksi kas menunggu approval.`)) return
    disburse.mutate(
      { month, year, location },
      {
        onSuccess: (n) => toast.success(`${n} slip diajukan untuk pencairan. Setujui di menu Transaksi.`),
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Pencairan Gaji</h1>
        <p className="text-suka-gray-500">Cairkan slip gaji final menjadi transaksi kas, lalu proses approval &amp; rekonsiliasi.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-suka-gray-600">
          Bulan
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 block rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-suka-gray-600">
          Tahun
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block w-24 rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
        </label>
        <label className="text-sm font-semibold text-suka-gray-600">
          Sumber Dana (bank)
          <select value={location} onChange={(e) => setLocation(e.target.value)}
            className="mt-1 block min-w-48 rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
            <option value="">— pilih rekening —</option>
            {bankLocations.map((l) => <option key={l.id} value={l.id}>{l.label} · {rupiah(l.saldo)}</option>)}
          </select>
        </label>
        {isFinance && (
          <Button onClick={handleDisburse} disabled={disburse.isPending || unpaid.length === 0}
            className="ml-auto flex items-center gap-2">
            {disburse.isPending ? <Spinner size={16} /> : <>Cairkan {unpaid.length > 0 ? `(${unpaid.length})` : ''}</>}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Slip Final" value={rupiah(totalFinal)} icon={<Wallet size={22} />} tone="blue" />
        <StatCard label="Belum Dicairkan" value={rupiah(totalUnpaid)} icon={<Banknote size={22} />} tone="orange" hint={`${unpaid.length} slip`} />
        <StatCard label="Jumlah Karyawan" value={slips.length} icon={<Users size={22} />} tone="green" />
      </div>

      <SectionCard title={`Slip Gaji — ${MONTHS[month - 1]} ${year}`}>
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : slips.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">
            Tidak ada slip <b>final</b> untuk periode ini. Slip dibuat &amp; di-finalize di Admin Dashboard (HR &rarr; Payroll).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2">Nama</th>
                  <th className="py-2">Rekening Tujuan</th>
                  <th className="py-2 text-right">Total Gaji</th>
                  <th className="py-2">Status Bayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {slips.map((s) => {
                  const fin = s.outlet_staff?.staff_financials
                  const meta = PAY_META[s.payment_status] ?? PAY_META.unpaid
                  return (
                    <tr key={s.id}>
                      <td className="py-3">
                        <p className="font-semibold text-suka-ink">{s.outlet_staff?.name ?? '—'}</p>
                        <p className="text-xs text-suka-gray-400">{s.outlet_staff?.role}</p>
                      </td>
                      <td className="py-3 text-suka-gray-500">
                        {fin?.bank_name ? `${fin.bank_name} · ${fin.bank_account_number ?? '-'}` : <span className="text-amber-600">rekening belum diisi</span>}
                      </td>
                      <td className="py-3 text-right font-bold text-suka-ink">{rupiah(s.total_salary)}</td>
                      <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.cls}`}>{meta.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
