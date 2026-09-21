'use client'
import { useState, useRef } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { 
  PENGELUARAN_CATEGORIES, 
  CATEGORY_META, 
  type ExpenseCategory
} from '@/lib/expenseCategories'
import type { Outlet } from '@/lib/types'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { useOutlets } from '@/hooks/useOutlets'
import { createSingleExpenseAction, uploadExpenseInvoiceAction } from '@/app/actions/expenses'

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
  const [submitMessage, setSubmitMessage] = useState<string>('')
  const today = new Date().toISOString().slice(0, 10)
  
  const [outletId, setOutletId] = useState<string>('PUSAT')
  const [category, setCategory] = useState<ExpenseCategory>(PENGELUARAN_CATEGORIES[0])
  const [amount, setAmount] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(today)

  // File upload state for invoice / receipt proof
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (isOpen === false) return null

  const handleCategoryChange = (newCat: ExpenseCategory) => {
    setCategory(newCat)
    if (newCat === 'gaji_staff_kantor' || newCat === 'pengeluaran_global') {
      const selectedOutlet = outletsList.find(o => o.id === outletId)
      if (selectedOutlet?.type === 'mitra') {
        setOutletId('PUSAT')
        toast.info('Kategori kantor pusat otomatis dialihkan ke Pusat.')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 10MB')
      return
    }

    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      const objUrl = URL.createObjectURL(file)
      setPreviewUrl(objUrl)
    } else {
      setPreviewUrl(null)
    }
  }

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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

    const isOfficeCategory = category === 'gaji_staff_kantor' || category === 'pengeluaran_global' || description.toLowerCase().includes('gaji kantor')
    const selectedOutlet = outletsList.find(o => o.id === outletId)
    if (isOfficeCategory && selectedOutlet?.type === 'mitra') {
      toast.error('Pengeluaran kantor pusat dilarang dialokasikan ke outlet mitra. Pilih Pusat atau outlet internal.')
      return
    }

    setSubmitting(true)
    try {
      let receiptUrl: string | null = null

      // Upload invoice image/document if selected
      if (selectedFile) {
        setSubmitMessage('Mengupload bukti invoice...')
        const formData = new FormData()
        formData.append('file', selectedFile)

        const uploadRes = await uploadExpenseInvoiceAction(formData)
        if (!uploadRes.success || !uploadRes.url) {
          toast.error('Gagal mengupload bukti invoice: ' + (uploadRes.error || 'Terjadi kesalahan'))
          setSubmitting(false)
          setSubmitMessage('')
          return
        }
        receiptUrl = uploadRes.url
      }

      setSubmitMessage('Menyimpan data pengeluaran...')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const yyyyMm = expenseDate.slice(0, 7)
      const periodMonth = `${yyyyMm}-01`
      const isPusat = outletId === 'PUSAT'

      const res = await createSingleExpenseAction({
        outletId: isPusat ? null : outletId,
        category,
        amount: Number(amount),
        description,
        expenseDate: expenseDate,
        periodMonth: periodMonth,
        type: 'expense',
        created_by: userId,
        receipt_url: receiptUrl
      })

      if (!res.success) {
        toast.error('Gagal menyimpan pengeluaran: ' + (res.error || 'Error'))
        return
      }

      toast.success('Pengeluaran OPEX berhasil ditambahkan')
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      onSuccess()
    } catch (err: any) {
      toast.error('Gagal menyimpan transaksi: ' + (err.message || 'Error'))
    } finally {
      setSubmitting(false)
      setSubmitMessage('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between pb-3 border-b border-suka-gray-100">
          <div>
            <h3 className="text-lg font-bold text-suka-ink">Input Pengeluaran Baru (OPEX)</h3>
            <p className="text-xs text-suka-gray-500">Catat transaksi pengeluaran operasional cabang / pusat</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-suka-gray-400 hover:text-suka-ink hover:bg-suka-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-suka-ink">Target / Outlet</span>
            <select
              className={inputCls}
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              {isAdmin && <option value="PUSAT">🏢 Pusat (Company-wide)</option>}
              {outletsList.map((o) => {
                const isMitra = o.type === 'mitra'
                const isOfficeCategory = category === 'gaji_staff_kantor' || category === 'pengeluaran_global'
                return (
                  <option key={o.id} value={o.id} disabled={isOfficeCategory && isMitra}>
                    {o.name} {isMitra ? (isOfficeCategory ? '(Mitra - Khusus Internal)' : '(Mitra)') : ''}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-suka-ink">Kategori Pengeluaran</span>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as ExpenseCategory)}
            >
              {PENGELUARAN_CATEGORIES.map((c) => (
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
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Beli sabun cuci piring & tissue"
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

          {/* Opsi Input Gambar Bukti Invoice */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-suka-ink">
              Bukti Invoice / Nota <span className="text-xs text-suka-gray-400 font-normal">(Opsional)</span>
            </span>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-suka-gray-200 hover:border-suka-orange rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-suka-gray-50/60 hover:bg-orange-50/40 transition-all text-center"
              >
                <div className="w-9 h-9 rounded-full bg-white border border-suka-gray-200 flex items-center justify-center text-suka-gray-500 group-hover:text-suka-orange group-hover:border-suka-orange transition-colors">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-suka-gray-700 group-hover:text-suka-orange">
                  Klik untuk upload foto invoice / nota
                </div>
                <p className="text-[11px] text-suka-gray-400">JPG, PNG, WEBP, atau PDF (maks. 10MB)</p>
              </div>
            ) : (
              <div className="border border-suka-gray-200 rounded-xl p-3 bg-suka-gray-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-suka-gray-200 shrink-0 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-orange-100 text-suka-orange flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-suka-ink truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-suka-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-suka-orange hover:underline font-medium px-2 py-1"
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1 text-suka-gray-400 hover:text-red-500 transition-colors"
                    title="Hapus file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-end gap-3 pt-4 border-t border-suka-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-suka-gray-500 hover:text-suka-ink transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <Button type="submit" disabled={submitting} className="rounded-xl flex items-center gap-2">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{submitMessage || 'Menyimpan...'}</span>
                </>
              ) : (
                'Simpan Pengeluaran'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}