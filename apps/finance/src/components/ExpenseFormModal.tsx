'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { 
  INCOME_CATEGORIES, 
  PENGELUARAN_CATEGORIES, 
  CATEGORY_META, 
  type ExpenseCategory,
  type TransactionType
} from '@/lib/expenseCategories'
import type { Outlet } from '@/lib/types'
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react'
import { useOutlets } from '@/hooks/useOutlets'
import { createSingleExpenseAction } from '@/app/actions/expenses'

const inputCls =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

export function ExpenseFormModal({
  isOpen = true,
  outlets: propOutlets,
  isAdmin = true,
  onClose,
  onSuccess
}: {
  isOpen?: boolean
  outlets?: Outlet[]
  isAdmin?: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: fetchedOutlets = [] } = useOutlets()
  const outletsList = propOutlets && propOutlets.length > 0 ? propOutlets : fetchedOutlets

  const [submitting, setSubmitting] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  
  const [type, setType] = useState<TransactionType>('expense')
  const [outletId, setOutletId] = useState<string>('PUSAT')

  if (isOpen === false) return null
  
  // Set default category based on type
  const defaultCategory = type === 'income' ? INCOME_CATEGORIES[0] : PENGELUARAN_CATEGORIES[0]
  const [category, setCategory] = useState<ExpenseCategory>(defaultCategory)
  
  const [amount, setAmount] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(today)

  const activeCategories = type === 'income' ? INCOME_CATEGORIES : PENGELUARAN_CATEGORIES

  // Update category if type changes
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    setCategory(newType === 'income' ? INCOME_CATEGORIES[0] : PENGELUARAN_CATEGORIES[0])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || amount <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }
    if (!description.trim()) {
      toast.error('Keterangan wajib diisi')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const yyyyMm = expenseDate.slice(0, 7)
      const periodMonth = `${yyyyMm}-01`
      const isPusat = outletId === 'PUSAT'

      await createSingleExpenseAction({
        outletId: isPusat ? null : outletId,
        category,
        amount: Number(amount),
        description,
        expenseDate: expenseDate,
        periodMonth: periodMonth,
        type: type,
        created_by: userId
      })

      toast.success('Transaksi berhasil ditambahkan')
      onSuccess()
    } catch (err: any) {
      toast.error('Gagal menyimpan transaksi: ' + (err.message || 'Error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="mb-4 text-xl font-bold text-suka-ink">Input Transaksi Baru</h3>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 mb-2 p-1 bg-suka-gray-50 rounded-xl border border-suka-gray-200">
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                type === 'income' 
                  ? 'bg-white text-green-600 shadow-sm border border-suka-gray-200' 
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" /> Pemasukan
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                type === 'expense' 
                  ? 'bg-white text-red-600 shadow-sm border border-suka-gray-200' 
                  : 'text-suka-gray-500 hover:text-suka-ink'
              }`}
            >
              <ArrowUpToLine className="w-4 h-4" /> Pengeluaran
            </button>
          </div>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-suka-ink">Target / Outlet</span>
            <select
              className={inputCls}
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              {isAdmin && <option value="PUSAT">🏢 Pusat (Company-wide)</option>}
              {outletsList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-suka-ink">Kategori</span>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            >
              {activeCategories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c]?.label || c}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-suka-ink">Jumlah (Rp)</span>
            <input
              type="number"
              min="0"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Contoh: 50000"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-suka-ink">Keterangan / Uraian</span>
            <textarea
              className={inputCls}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Beli sabun cuci piring"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-suka-ink">Tanggal</span>
            <input
              type="date"
              className={inputCls}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </label>

          <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-suka-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-suka-gray-500 hover:text-suka-ink transition-colors"
            >
              Batal
            </button>
            <Button type="submit" disabled={submitting} className="rounded-xl">
              {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}