'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Wallet, FileText, ArrowDownRight, ArrowUpRight, Building2, ArrowRight } from 'lucide-react'
import { Button } from '@suka/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import { useExpenses } from '@/hooks/useExpenses'
import { useOutlets } from '@/hooks/useOutlets'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { ExpenseFormModal } from '@/components/ExpenseFormModal'
import { CATEGORY_META } from '@/lib/expenseCategories'
import { isExcludedOutlet } from '@/lib/outletFilters'

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c

function firstOfMonth(ym: string) { return `${ym}-01` }
function lastOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export default function InputPengeluaranPage() {
  const { isChecker } = useFinanceRole()
  const isAdmin = isChecker
  const { data: outlets = [] } = useOutlets()
  const queryClient = useQueryClient()

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [target, setTarget] = useState<string>('all')       // 'all' | 'PUSAT' | outletId
  const [isFormOpen, setIsFormOpen] = useState(false)

  const isPusat = target === 'PUSAT'
  const periodMonth = firstOfMonth(month)

  const filter = useMemo(() => ({
    from: periodMonth,
    to: lastOfMonth(month),
    outletId: isPusat ? 'all' : target,
    source: 'all' as const
  }), [periodMonth, month, target, isPusat])

  const { rows: expenseRows, loading: expensesLoading, error: expensesError } = useExpenses(filter)
  
  // Merge expense rows
  const allTransactions = useMemo(() => {
    let list: any[] = []

    // 1. Process normal expenses
    expenseRows.forEach(r => {
      // Apply filters manually to ensure exact match if needed, though hook does it
      if (target === 'all' && r.scope === 'pusat') return // all means all outlets
      if (target === 'PUSAT' && r.scope === 'outlet') return
      if (target !== 'all' && target !== 'PUSAT' && (r.scope === 'pusat' || r.outlet_id !== target)) return
      
      list.push({
        id: r.id,
        date: r.expense_date,
        category: r.category,
        outlet_name: r.outlet_name ?? (r.scope === 'pusat' ? 'Pusat' : '-'),
        description: r.description,
        amount: r.amount,
        type: r.type || 'expense', // 'income' or 'expense'
        isTopup: false
      })
    })

    // Sort descending by date
    list.sort((a, b) => b.date.localeCompare(a.date))
    return list
  }, [expenseRows, target])

  const validOutlets = useMemo(() => {
    return outlets.filter(o => !isExcludedOutlet(o))
  }, [outlets])

  const selectOptions = useMemo(() => [
    { label: '🏢 Semua Unit (Cabang & Pusat)', value: 'all' },
    { label: '🏪 Semua Outlet (Khusus Cabang)', value: 'ALL_OUTLETS' },
    ...(isAdmin ? [{ label: '🏢 Pengeluaran Pusat (OPEX)', value: 'PUSAT' }] : []),
    ...validOutlets.map(o => ({ label: `🏪 ${o.name}`, value: o.id }))
  ], [isAdmin, validOutlets])

  const loading = expensesLoading

  return (
    <div className="space-y-6">
      <PageHeader title="Buku Kas (OPEX)" description="Catat dan pantau arus kas operasional (Pemasukan & Pengeluaran)" icon={Wallet}>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
          <TargetCombobox 
            options={selectOptions}
            value={target}
            onChange={setTarget}
            placeholder="— Pilih target —"
          />
          <Button onClick={() => setIsFormOpen(true)} className="rounded-xl flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Transaksi
          </Button>
        </div>
      </PageHeader>

      {/* Shortcut ke SOP Kas & Pengajuan Dana Kantor */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Alur Pengajuan Dana & Kas Kantor Pusat (Advance & Voucher)</h4>
            <p className="text-xs text-gray-500">Buat permohonan uang muka staf kantor, cetak voucher PDF, upload bukti nota, & verifikasi OPEX</p>
          </div>
        </div>
        <Link
          href="/pengeluaran/kantor"
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <span>Buka Kas Kantor</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {expensesError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data pengeluaran: {expensesError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-suka-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-suka-gray-200 bg-suka-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-suka-ink">Daftar Transaksi</h3>
          <span className="text-xs text-suka-gray-500 font-medium">Total: {allTransactions.length} catatan</span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-suka-gray-500 text-sm">Memuat data...</div>
        ) : allTransactions.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <FileText className="w-12 h-12 text-suka-gray-300 mb-3" />
            <p className="text-suka-gray-600 font-medium">Belum ada transaksi</p>
            <p className="text-suka-gray-400 text-sm mt-1">Ganti filter bulan/target atau tambahkan baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-suka-gray-50/50 text-suka-gray-500 border-b border-suka-gray-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Outlet</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 font-medium text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {allTransactions.map(r => {
                  const isIncome = r.type === 'income'
                  return (
                    <tr key={r.id} className="hover:bg-suka-gray-50/50 transition-colors">
                      <td className="px-4 py-3">{r.date}</td>
                      <td className="px-4 py-3">
                        {isIncome ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            Masuk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            Keluar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {labelOf(r.category)}
                      </td>
                      <td className="px-4 py-3">{r.outlet_name}</td>
                      <td className="px-4 py-3 text-suka-gray-600 truncate max-w-[250px]">{r.description}</td>
                      <td className={`px-4 py-3 text-right font-medium ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncome ? '+' : '-'}Rp {r.amount.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <ExpenseFormModal 
          outlets={outlets as any[]} 
          isAdmin={isAdmin} 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            setIsFormOpen(false)
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }} 
        />
      )}
    </div>
  )
}
