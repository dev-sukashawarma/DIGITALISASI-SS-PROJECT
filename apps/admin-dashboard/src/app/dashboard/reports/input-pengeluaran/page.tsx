// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import { Plus, Wallet, FileText, UploadCloud, ArrowDownRight, ArrowUpRight, Download, Calendar, Filter, Store } from 'lucide-react'
import { Button } from '@suka/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { PageHeader } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import { useExpenses } from '@/hooks/useExpenses'
import { usePettyCashTopups } from '@/hooks/usePettyCashTopups'
import { useOutlets } from '@/hooks/useOutlets'
import { useRole } from '@/components/layout/RoleContext'
import { ExpenseFormModal } from '@/components/ExpenseFormModal'
import { BulkImportModal } from '@/components/BulkImportModal'
import { CATEGORY_META } from '@/lib/expenseCategories'

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c

function getFirstOfMonth() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function getLastOfMonth() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export default function InputPengeluaranPage() {
  const { role, outletId: userOutletId } = useRole()
  const isAdmin = role === 'ADMIN' || role === 'OWNER'
  const { data: outlets = [] } = useOutlets()
  const queryClient = useQueryClient()

  // Date range filter (from & to)
  const [startDate, setStartDate] = useState(getFirstOfMonth)
  const [endDate, setEndDate] = useState(getLastOfMonth)
  // Wajib pilih outlet terlebih dahulu (default ke userOutletId jika ada, atau kosong jika admin/owner)
  const [target, setTarget] = useState<string>(() => userOutletId || '')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  const isPusat = target === 'PUSAT'

  const filter = useMemo(() => ({
    from: startDate,
    to: endDate,
    outletId: isPusat ? 'all' : target,
    source: 'all' as const
  }), [startDate, endDate, target, isPusat])

  const { rows: expenseRows, loading: expensesLoading, error: expensesError } = useExpenses(filter)
  const { data: topupRows = [], isLoading: topupsLoading } = usePettyCashTopups(filter)

  // Merge expense rows and topup rows (treated as income)
  const allTransactions = useMemo(() => {
    if (!target) return []
    let list: any[] = []

    // 1. Process normal expenses
    expenseRows.forEach(r => {
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

    // 2. Process topups (only applicable to outlets)
    if (target !== 'PUSAT') {
      topupRows.forEach(t => {
        list.push({
          id: `topup-${t.id}`,
          date: t.transfer_date || t.created_at.split('T')[0],
          category: 'Petty Cash Topup',
          outlet_name: t.outlet_name ?? '-',
          description: `Top up dari Pusat`,
          amount: t.amount,
          type: 'income',
          isTopup: true
        })
      })
    }

    // Sort descending by date
    list.sort((a, b) => b.date.localeCompare(a.date))
    return list
  }, [expenseRows, topupRows, target])

  // Summary calculation
  const summary = useMemo(() => {
    let totalIncome = 0
    let totalExpense = 0
    allTransactions.forEach(t => {
      if (t.type === 'income') totalIncome += Number(t.amount || 0)
      else totalExpense += Number(t.amount || 0)
    })
    return {
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
      count: allTransactions.length
    }
  }, [allTransactions])

  const selectOptions = [
    ...(isAdmin ? [{ label: '🏢 Pengeluaran Pusat (company-wide)', value: 'PUSAT' }] : []),
    ...outlets.map(o => ({ label: `🏪 ${o.name}`, value: o.id })),
    { label: '📊 Semua Outlet (Konsolidasi)', value: 'all' }
  ]

  const loading = expensesLoading || topupsLoading

  // Export to Excel handler
  const handleExportExcel = () => {
    if (allTransactions.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor pada rentang tanggal ini.')
      return
    }

    const exportRows = allTransactions.map((r, idx) => ({
      'No': idx + 1,
      'Tanggal': r.date,
      'Tipe Arus Kas': r.type === 'income' ? 'Masuk' : 'Keluar',
      'Kategori': r.isTopup ? r.category : labelOf(r.category),
      'Outlet / Unit': r.outlet_name,
      'Keterangan': r.description || '-',
      'Pemasukan (Rp)': r.type === 'income' ? r.amount : 0,
      'Pengeluaran (Rp)': r.type !== 'income' ? r.amount : 0,
      'Nominal Bersih (Rp)': r.type === 'income' ? r.amount : -r.amount,
    }))

    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan OPEX')

    // Column sizing
    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 14 }, // Tanggal
      { wch: 15 }, // Tipe Arus Kas
      { wch: 25 }, // Kategori
      { wch: 28 }, // Outlet
      { wch: 38 }, // Keterangan
      { wch: 18 }, // Pemasukan
      { wch: 18 }, // Pengeluaran
      { wch: 20 }, // Nominal Bersih
    ]

    let targetLabel = 'Semua_Outlet'
    if (target === 'PUSAT') {
      targetLabel = 'Pusat'
    } else if (target !== 'all') {
      const selectedOutlet = outlets.find(o => o.id === target)
      targetLabel = selectedOutlet ? selectedOutlet.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Outlet'
    }

    const filename = `Laporan_OPEX_${targetLabel}_${startDate}_${endDate}.xlsx`
    XLSX.writeFile(wb, filename)
    toast.success(`Berhasil mengunduh ${allTransactions.length} baris transaksi ke file Excel!`)
  }

  // Quick preset handlers
  const setPreset = (preset: 'today' | 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days') => {
    const today = new Date()
    if (preset === 'today') {
      const t = today.toISOString().slice(0, 10)
      setStartDate(t)
      setEndDate(t)
    } else if (preset === 'this_month') {
      setStartDate(getFirstOfMonth())
      setEndDate(getLastOfMonth())
    } else if (preset === 'last_month') {
      const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
      const m = today.getMonth() === 0 ? 12 : today.getMonth()
      const padM = String(m).padStart(2, '0')
      const start = `${y}-${padM}-01`
      const end = new Date(y, m, 0).toISOString().slice(0, 10)
      setStartDate(start)
      setEndDate(end)
    } else if (preset === 'last_7_days') {
      const past = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      setStartDate(past.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    } else if (preset === 'last_30_days') {
      const past = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      setStartDate(past.toISOString().slice(0, 10))
      setEndDate(today.toISOString().slice(0, 10))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Buku Kas (OPEX)" description="Catat dan pantau arus kas operasional (Pemasukan & Pengeluaran)" icon={Wallet}>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-suka-gray-100 p-1 rounded-xl text-xs font-semibold text-suka-gray-600">
            <button
              onClick={() => setPreset('this_month')}
              className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-suka-brown hover:shadow-xs transition-all"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setPreset('last_month')}
              className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-suka-brown hover:shadow-xs transition-all"
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => setPreset('last_7_days')}
              className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-suka-brown hover:shadow-xs transition-all"
            >
              7 Hari
            </button>
            <button
              onClick={() => setPreset('last_30_days')}
              className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-suka-brown hover:shadow-xs transition-all"
            >
              30 Hari
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 bg-white border border-suka-gray-200 rounded-xl px-2.5 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-suka-gray-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-xs font-semibold text-suka-ink focus:outline-none bg-transparent"
              title="Dari Tanggal"
            />
            <span className="text-suka-gray-300 font-bold text-xs">s/d</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-xs font-semibold text-suka-ink focus:outline-none bg-transparent"
              title="Sampai Tanggal"
            />
          </div>

          {/* Target Outlet Combobox */}
          <TargetCombobox 
            options={selectOptions}
            value={target}
            onChange={setTarget}
            placeholder="🏢 Pilih Outlet / Cabang"
          />

          {/* Export Excel Button */}
          <Button
            variant="secondary"
            onClick={handleExportExcel}
            disabled={!target || loading || allTransactions.length === 0}
            className="rounded-xl flex items-center gap-2 border-suka-gray-200 hover:bg-suka-gray-50 text-suka-brown font-semibold shadow-xs disabled:opacity-50"
            title={!target ? "Pilih outlet terlebih dahulu untuk mengekspor" : "Download laporan transaksi ke file Excel"}
          >
            <Download className="w-4 h-4 text-emerald-600" /> Export Excel
          </Button>

          {isAdmin && (
            <Button variant="secondary" onClick={() => setIsImportOpen(true)} className="rounded-xl flex items-center gap-2">
              <UploadCloud className="w-4 h-4" /> Import Excel
            </Button>
          )}

          <Button onClick={() => setIsFormOpen(true)} className="rounded-xl flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Transaksi
          </Button>
        </div>
      </PageHeader>

      {expensesError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data pengeluaran: {expensesError}
        </div>
      )}

      {!target ? (
        <div className="bg-white rounded-2xl border border-suka-gray-200 p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100 shadow-xs">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-suka-ink">Pilih Outlet Terlebih Dahulu</h3>
          <p className="text-sm text-suka-gray-500 max-w-md mt-1.5 leading-relaxed">
            Buku Kas (OPEX) mencatat arus kas operasional per cabang. Silakan pilih salah satu outlet atau kantor pusat pada filter di atas untuk melihat buku kas, mencatat transaksi, dan mengunduh laporan Excel.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-suka-gray-500">Total Pemasukan</span>
                <span className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl font-extrabold text-green-700 mt-2">
                +Rp {summary.income.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-suka-gray-400 mt-1">Topup kas kecil & dana masuk</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-suka-gray-500">Total Pengeluaran</span>
                <span className="p-1.5 bg-red-50 text-red-600 rounded-lg">
                  <ArrowDownRight className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl font-extrabold text-red-700 mt-2">
                -Rp {summary.expense.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-suka-gray-400 mt-1">Biaya operasional & belanja kasir</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-suka-gray-500">Arus Kas Bersih (Net)</span>
                <span className="p-1.5 bg-suka-brown/10 text-suka-brown rounded-lg">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <p className={`text-xl font-extrabold mt-2 ${summary.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {summary.net >= 0 ? '+' : ''}Rp {summary.net.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-suka-gray-400 mt-1">{summary.count} total catatan pada periode ini</p>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-suka-gray-200 bg-suka-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-suka-ink">Daftar Transaksi</h3>
                <span className="text-xs text-suka-gray-500 bg-white border border-suka-gray-200 px-2 py-0.5 rounded-full font-medium">
                  {startDate} s/d {endDate}
                </span>
              </div>
              <span className="text-xs text-suka-gray-500 font-medium">Total: {allTransactions.length} catatan</span>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-suka-gray-500 text-sm">Memuat data...</div>
            ) : allTransactions.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <FileText className="w-12 h-12 text-suka-gray-300 mb-3" />
                <p className="text-suka-gray-600 font-medium">Belum ada transaksi</p>
                <p className="text-suka-gray-400 text-sm mt-1">Ganti rentang tanggal atau tambahkan transaksi baru.</p>
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
                            {r.isTopup ? r.category : labelOf(r.category)}
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
        </>
      )}

      {isFormOpen && (
        <ExpenseFormModal 
          outlets={outlets} 
          isAdmin={isAdmin}
          defaultOutletId={target && target !== 'all' ? target : undefined}
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            setIsFormOpen(false)
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }} 
        />
      )}

      {isImportOpen && (
        <BulkImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => {
            setIsImportOpen(false)
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
          }}
        />
      )}
    </div>
  )
}

