1:05:52+07:00
Completed At: 2026-08-06T11:05:52+07:00
File Path: `file:///d:/MIT/CLAUDE%20CODE%20PROJECT/SS%20DIGITAL%20PROJECT/apps/admin-dashboard/src/app/dashboard/reports/input-pengeluaran/page.tsx`
Total Lines: 143
Total Bytes: 6115
Showing lines 1 to 143
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
'use client'

import { useState, useMemo } from 'react'
import { Plus, Wallet, FileText } from 'lucide-react'
import { Button } from '@suka/design-system'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui'
import { TargetCombobox } from '@/components/TargetCombobox'
import { useExpenses } from '@/hooks/useExpenses'
import { useOutlets } from '@/hooks/useOutlets'
import { useRole } from '@/components/layout/RoleContext'
import { ExpenseFormModal } from '@/components/ExpenseFormModal'
import { CATEGORY_META } from '@/lib/expenseCategories'

const labelOf = (c: string) => CATEGORY_META[c as keyof typeof CATEGORY_META]?.label ?? c

function firstOfMonth(ym: string) { return `${ym}-01` }
function lastOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export default function InputPengeluaranPage() {
  const { role } = useRole()
  const isAdmin = role === 'ADMIN' || role === 'OWNER'
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

  const { rows, loading, error } = useExpenses(filter)

  const filteredRows = useMemo(() => {
    if (target === 'all') {
      return rows.filter(r => r.scope === 'outlet')
    } else if (target === 'PUSAT') {
      return rows.filter(r => r.scope === 'pusat')
    } else {
      return rows.filter(r => r.scope === 'outlet' && r.outlet_id === target)
    }
  }, [rows, target])

  const selectOptions = [
    { label: '🏪 Semua Outlet', value: 'all' },
    ...(isAdmin ? [{ label: '🏢 Pengeluaran Pusat (company-wide)', value: 'PUSAT' }] : []),
    ...outlets.map(o => ({ label: o.name, value: o.id }))
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Input Pengeluaran" description="Catat dan pantau pengeluaran operasional" icon={Wallet}>
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
            <Plus className="w-4 h-4" /> Tambah
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data pengeluaran: {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-suka-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-suka-gray-200 bg-suka-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-suka-ink">Daftar Pengeluaran</h3>
          <span className="text-xs text-suka-gray-500 font-medium">Total: {filteredRows.length} catatan</span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-suka-gray-500 text-sm">Memuat data...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <FileText className="w-12 h-12 text-suka-gray-300 mb-3" />
            <p className="text-suka-gray-600 font-medium">Belum ada pengeluaran</p>
            <p className="text-suka-gray-400 text-sm mt-1">Ganti filter bulan/target atau tambahkan baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-suka-gray-50/50 text-suka-gray-500 border-b border-suka-gray-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Outlet</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                  <th className="px-4 py-3 font-medium text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {filteredRows.sort((a,b) => b.expense_date.localeCompare(a.expense_date)).map(r => (
                  <tr key={r.id} className="hover:bg-suka-gray-50/50 transition-colors">
                    <td className="px-4 py-3">{r.expense_date}</td>
                    <td className="px-4 py-3 font-medium">{labelOf(r.category)}</td>
                    <td className="px-4 py-3">{r.outlet_name ?? (r.scope === 'pusat' ? 'Pusat' : '-')}</td>
                    <td className="px-4 py-3 text-suka-gray-600 truncate max-w-[250px]">{r.description}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      -Rp {r.amount.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <ExpenseFormModal 
          outlets={outlets} 
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

The above content shows the entire, complete file contents of the requested file.
