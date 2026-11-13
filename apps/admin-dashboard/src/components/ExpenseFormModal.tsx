'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { 
  PENGELUARAN_CATEGORIES, 
  CATEGORY_META, 
  type ExpenseCategory
} from '@/lib/expenseCategories'
import type { Outlet } from '@/lib/types'
import { adalahKategoriRab, cekAturanRab, KATEGORI_RAB } from '@/lib/pengeluaran/rab'
import { Upload, X, FileText, Loader2, Eye } from 'lucide-react'

const GRUP_PEMBAYAR_LABEL: Record<'utama' | 'bahan_baku' | 'petty_cash', string> = {
  utama: 'Rekening Utama',
  bahan_baku: 'Rekening Bahan Baku',
  petty_cash: 'Rekening Petty Cash',
}
import { useOutlets } from '@/hooks/useOutlets'
import {
  createSingleExpenseAction,
  updateSingleExpenseAction,
  uploadExpenseInvoiceAction,
  daftarRekeningPembayarAction,
  ambilRekeningPembayarAction
} from '@/app/actions/expenses'

const inputCls =
  'w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

export function ExpenseFormModal({
  isOpen = true,
  outlets: propOutlets,
  isAdmin = true,
  initialData = null,
  onClose,
  onSuccess
}: {
  isOpen?: boolean
  outlets?: Outlet[]
  isAdmin?: boolean
  initialData?: any | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = Boolean(initialData)
  const { data: fetchedOutlets = [] } = useOutlets(undefined, { termasukPersiapan: true })
  const outletsList = propOutlets && propOutlets.length > 0 ? propOutlets : fetchedOutlets

  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string>('')
  const today = new Date().toISOString().slice(0, 10)
  
  const [outletId, setOutletId] = useState<string>('PUSAT')
  const [category, setCategory] = useState<ExpenseCategory>(PENGELUARAN_CATEGORIES[0])
  const [amount, setAmount] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(today)
  const [recipientName, setRecipientName] = useState('')
  const [division, setDivision] = useState('')

  // Rekening pusat yang membayar ('' = tidak memotong saldo rekening pusat).
  const [rekeningList, setRekeningList] = useState<{ id: string; label: string; kind: string; grup: string; saldo: number }[]>([])
  const [cashLocationId, setCashLocationId] = useState('')
  // Mode edit: nilai tersimpan baru dikirim setelah terbaca, supaya tak terhapus tanpa sengaja.
  const [rekeningSiap, setRekeningSiap] = useState(false)
  // Rekening tersimpan saat modal edit dibuka: potongan lamanya sudah termasuk di saldo.
  const [rekeningAwal, setRekeningAwal] = useState('')
  const isRab = adalahKategoriRab(category)
  // RAB boleh dibayar dari rekening pusat: rekening tetap terpotong, tidak dihitung OPEX.
  const bisaPilihRekening =
    !(isEdit && initialData?.source === 'petty_cash') && ['expense', 'rab'].includes(initialData?.type ?? 'expense')

  // File upload state for invoice / receipt proof
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (initialData) {
      const isKantorPusat = 
        !initialData.outlet_id || 
        initialData.outlet_id === 'ffffffff-ffff-ffff-ffff-ffffffffffff' ||
        initialData.scope === 'pusat' ||
        initialData.outlet_name === 'Head Office' ||
        initialData.outlet_name === 'Kantor Pusat' ||
        initialData.outlet_name === 'Pusat'

      setOutletId(isKantorPusat ? 'PUSAT' : (initialData.outlet_id || 'PUSAT'))
      
      const cat = (initialData.category || PENGELUARAN_CATEGORIES[0]) as ExpenseCategory
      setCategory(cat)
      
      setAmount(initialData.amount !== undefined && initialData.amount !== null ? Number(initialData.amount) : '')
      setDescription(initialData.description || '')
      setExpenseDate(initialData.date || initialData.expense_date || today)
      setRecipientName(
        initialData.recipient_name && initialData.recipient_name !== '-' ? initialData.recipient_name : ''
      )
      setDivision(
        initialData.division && initialData.division !== '-' ? initialData.division : ''
      )
      setExistingReceiptUrl(initialData.receipt_url || null)
      setPreviewUrl(initialData.receipt_url || null)
      setSelectedFile(null)
    } else {
      setOutletId('PUSAT')
      setCategory(PENGELUARAN_CATEGORIES[0])
      setAmount('')
      setDescription('')
      setExpenseDate(today)
      setRecipientName('')
      setDivision('')
      setExistingReceiptUrl(null)
      setPreviewUrl(null)
      setSelectedFile(null)
    }
  }, [initialData, isOpen, today])

  useEffect(() => {
    if (isOpen === false || !bisaPilihRekening) return
    let batal = false
    setCashLocationId('')
    setRekeningAwal('')
    setRekeningSiap(!isEdit)
    daftarRekeningPembayarAction()
      .then(list => { if (!batal) setRekeningList(list) })
      .catch(() => { if (!batal) setRekeningList([]) })
    if (isEdit && initialData?.id) {
      ambilRekeningPembayarAction(initialData.id)
        .then(id => { if (!batal) { setCashLocationId(id ?? ''); setRekeningAwal(id ?? ''); setRekeningSiap(true) } })
        .catch(() => { /* biarkan rekeningSiap=false: nilai lama tidak disentuh */ })
    }
    return () => { batal = true }
  }, [isOpen, isEdit, initialData?.id, bisaPilihRekening])

  if (isOpen === false) return null

  const formatRp = (n: number) => (n < 0 ? '-Rp ' : 'Rp ') + Math.abs(Math.round(n)).toLocaleString('id-ID')
  const rekeningTerpilih = rekeningList.find(r => r.id === cashLocationId)
  // Saldo sebelum pengeluaran ini: kalau rekeningnya sama dengan yang tersimpan,
  // potongan lama dikembalikan dulu supaya tidak terhitung dua kali.
  const saldoSebelum = rekeningTerpilih
    ? rekeningTerpilih.saldo + (isEdit && rekeningAwal === rekeningTerpilih.id ? Number(initialData?.amount || 0) : 0)
    : 0
  const sisaSaldo = saldoSebelum - (Number(amount) || 0)

  const handleCategoryChange = (newCat: ExpenseCategory) => {
    setCategory(newCat)
    if (adalahKategoriRab(newCat)) {
      if (outletId === 'PUSAT') toast.info('Pengeluaran RAB wajib dialokasikan ke satu outlet. Pilih outletnya.')
      return
    }
    if (newCat === 'gaji_staff_kantor' || newCat === 'pengeluaran_global') {
      const selectedOutlet = outletsList.find(o => o.id === outletId)
      if (selectedOutlet?.type === 'mitra') {
        setOutletId('PUSAT')
        toast.info('Kategori Head Office otomatis dialihkan ke Head Office.')
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

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
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
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setExistingReceiptUrl(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
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
      toast.error('Pengeluaran Head Office dilarang dialokasikan ke outlet mitra. Pilih Head Office atau outlet internal.')
      return
    }

    if (isRab) {
      const galat = cekAturanRab({
        kategoriBaru: category,
        outletId: outletId === 'PUSAT' ? null : outletId,
        tanggalBaru: expenseDate,
        ...(isEdit ? { tipeLama: initialData?.type ?? 'expense', tanggalLama: initialData?.date || initialData?.expense_date } : {}),
      })
      if (galat) {
        toast.error(galat)
        return
      }
    }

    setSubmitting(true)
    try {
      let receiptUrl: string | null = existingReceiptUrl

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
      } else if (!existingReceiptUrl) {
        receiptUrl = null
      }

      setSubmitMessage(isEdit ? 'Menyimpan perubahan...' : 'Menyimpan data pengeluaran...')
      const yyyyMm = expenseDate.slice(0, 7)
      const periodMonth = `${yyyyMm}-01`
      const isPusat = outletId === 'PUSAT'

      if (isEdit && initialData?.id) {
        const res = await updateSingleExpenseAction({
          id: initialData.id,
          outletId: isPusat ? null : outletId,
          category,
          amount: Number(amount),
          description: description.trim(),
          expenseDate: expenseDate,
          periodMonth: periodMonth,
          receipt_url: receiptUrl,
          recipient_name: recipientName.trim() || null,
          division: division.trim() || null,
          cashLocationId: bisaPilihRekening && rekeningSiap ? (cashLocationId || null) : undefined
        })

        if (!res.success) {
          toast.error('Gagal memperbarui pengeluaran: ' + (res.error || 'Error'))
          return
        }

        toast.success(isRab ? 'Pengeluaran RAB berhasil diperbarui (tidak dihitung OPEX)' : 'Pengeluaran OPEX berhasil diperbarui')
      } else {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id

        const res = await createSingleExpenseAction({
          outletId: isPusat ? null : outletId,
          category,
          amount: Number(amount),
          description: description.trim(),
          expenseDate: expenseDate,
          periodMonth: periodMonth,
          type: 'expense',
          created_by: userId,
          receipt_url: receiptUrl,
          cashLocationId: bisaPilihRekening ? (cashLocationId || null) : null
        })

        if (!res.success) {
          toast.error('Gagal menyimpan pengeluaran: ' + (res.error || 'Error'))
          return
        }

        toast.success(isRab ? 'Pengeluaran RAB tercatat (tidak dihitung OPEX)' : 'Pengeluaran OPEX berhasil ditambahkan')
      }

      if (previewUrl && previewUrl.startsWith('blob:')) {
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
            <h3 className="text-lg font-bold text-suka-ink">
              {isEdit ? 'Edit Pengeluaran (OPEX)' : 'Input Pengeluaran Baru (OPEX)'}
            </h3>
            <p className="text-xs text-suka-gray-500">
              {isEdit ? 'Perbarui rincian transaksi beban operasional' : 'Catat transaksi pengeluaran operasional cabang / Head Office'}
            </p>
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
            <span className="mb-1 block font-medium text-suka-ink">Filter / Unit</span>
            <select
              className={inputCls}
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
            >
              {isAdmin && <option value="PUSAT" disabled={isRab}>🏢 Head Office (Company-wide){isRab ? ' — tidak untuk RAB' : ''}</option>}
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
              <optgroup label="Tidak dihitung OPEX">
                <option value={KATEGORI_RAB}>{CATEGORY_META[KATEGORI_RAB].label}</option>
              </optgroup>
            </select>
            {isRab && (
              <span className="mt-1.5 block rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1.5 text-xs text-sky-800">
                Sudah ditanggung dana investasi (RAB). Hanya dicatat untuk rekap: tidak mengurangi OPEX, laba outlet,
                laba perusahaan, maupun bagi hasil mitra. Wajib dialokasikan ke satu outlet. Kalau dibayar dari
                rekening pusat, saldo rekening itu tetap terpotong.
              </span>
            )}
          </label>

          {/* Nama Pemohon & Divisi (Opsional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-suka-ink">
                Nama Pemohon <span className="text-xs text-suka-gray-400 font-normal">(Opsional)</span>
              </span>
              <input
                type="text"
                className={inputCls}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-suka-ink">
                Divisi <span className="text-xs text-suka-gray-400 font-normal">(Opsional)</span>
              </span>
              <input
                type="text"
                className={inputCls}
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="Contoh: Operasional / GA"
              />
            </label>
          </div>

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

          {bisaPilihRekening && (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-suka-ink">
                Dibayar dari <span className="text-xs text-suka-gray-400 font-normal">(Opsional)</span>
              </span>
              <select
                className={inputCls}
                value={cashLocationId}
                disabled={isEdit && !rekeningSiap}
                onChange={(e) => setCashLocationId(e.target.value)}
              >
                <option value="">— Tidak dari rekening pusat —</option>
                {(['utama', 'bahan_baku', 'petty_cash'] as const).map((g) => {
                  const daftarGrup = rekeningList.filter((r) => r.grup === g)
                  if (daftarGrup.length === 0) return null
                  return (
                    <optgroup key={g} label={GRUP_PEMBAYAR_LABEL[g]}>
                      {daftarGrup.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} · {formatRp(r.saldo)}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
              {rekeningTerpilih && (
                <span className={`mt-1.5 block text-xs font-semibold ${sisaSaldo < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  Sisa saldo: {formatRp(sisaSaldo)}{sisaSaldo < 0 && ' (minus)'}
                </span>
              )}
            </label>
          )}

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

            {!selectedFile && !existingReceiptUrl ? (
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
            ) : selectedFile ? (
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
                      {(selectedFile.size / 1024).toFixed(1)} KB (File Baru)
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
            ) : (
              /* Existing receipt */
              <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {previewUrl?.toLowerCase().endsWith('.pdf') ? (
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Nota Tersimpan"
                      className="w-12 h-12 rounded-lg object-cover border border-emerald-200 shrink-0 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <Eye size={12} />
                      Bukti Nota Tersimpan
                    </p>
                    <a
                      href={existingReceiptUrl!}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline truncate block"
                    >
                      Buka dokumen nota
                    </a>
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
                    title="Hapus nota"
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
                  <span>{submitMessage || (isEdit ? 'Menyimpan perubahan...' : 'Menyimpan...')}</span>
                </>
              ) : (
                isEdit ? 'Simpan Perubahan' : 'Simpan Pengeluaran'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}