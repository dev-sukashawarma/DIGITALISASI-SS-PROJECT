'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@suka/design-system'
import {
  X,
  Receipt,
  Store,
  User,
  Tag,
  Calendar,
  ExternalLink,
  CheckCircle2,
  ImageOff,
  ChevronDown,
  Check,
} from 'lucide-react'
import {
  KATEGORI_PETTY_CASH_OPTIONS,
  labelKategoriPettyCash,
  useReviewPettyCashExpense,
  useUbahKategoriPettyCashExpense,
  type PendingPettyCashExpense,
} from '@/hooks/usePettyCashExpenseApproval'
import { rupiah, tanggalWaktu } from '@/lib/format'

export function SetujuiPengeluaranPettyCashModal({
  expense,
  isOpen,
  onClose,
  onTolak,
  onGagal,
}: {
  expense: PendingPettyCashExpense
  isOpen: boolean
  onClose: () => void
  onTolak: () => void
  onGagal?: () => void
}) {
  const review = useReviewPettyCashExpense()
  const ubahKategori = useUbahKategoriPettyCashExpense()
  const [imgError, setImgError] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(expense.category)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)
  const committedCategoryRef = useRef(expense.category)

  useEffect(() => {
    setSelectedCategory(expense.category)
    committedCategoryRef.current = expense.category
    setImgError(false)
    setDropdownOpen(false)
  }, [expense.id, expense.category])

  useEffect(() => {
    if (!dropdownOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [dropdownOpen])

  if (!isOpen) return null

  const isRabOtomatis = expense.type === 'rab' || expense.category === 'rab'
  const kategoriBerubah = !isRabOtomatis && selectedCategory !== committedCategoryRef.current
  const sedangProses = submitting || review.isPending || ubahKategori.isPending

  const kategoriOptions = KATEGORI_PETTY_CASH_OPTIONS.some((o) => o.value === selectedCategory)
    ? [...KATEGORI_PETTY_CASH_OPTIONS]
    : [
        ...KATEGORI_PETTY_CASH_OPTIONS,
        { value: selectedCategory, label: labelKategoriPettyCash(selectedCategory) },
      ]

  const setujui = async () => {
    if (submittingRef.current || sedangProses) return
    submittingRef.current = true
    setSubmitting(true)
    const perluUbahKategori = !isRabOtomatis && selectedCategory !== committedCategoryRef.current
    try {
      if (perluUbahKategori) {
        await ubahKategori.mutateAsync({
          expenseId: expense.id,
          category: selectedCategory,
        })
        committedCategoryRef.current = selectedCategory
      }
      await review.mutateAsync({ expenseId: expense.id, action: 'approve' })
      toast.success(
        perluUbahKategori || selectedCategory !== expense.category
          ? `Kategori dikoreksi & pengeluaran ${expense.outlet_nama} (${rupiah(expense.amount)}) disetujui`
          : `Pengeluaran petty cash ${expense.outlet_nama} (${rupiah(expense.amount)}) disetujui`,
      )
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyetujui pengeluaran petty cash')
      onGagal?.()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-suka-ink/45 p-4 backdrop-blur-xs"
      onClick={() => !sedangProses && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-modal-pengeluaran-pc"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-suka-brown/12 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Receipt size={18} />
            </div>
            <div>
              <h3 id="judul-modal-pengeluaran-pc" className="font-display text-lg font-bold text-suka-brown">
                Tinjau Pengeluaran Petty Cash
              </h3>
              <p className="text-xs text-suka-gray-500">
                Verifikasi bukti struk sebelum memotong saldo Petty Cash POS outlet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sedangProses}
            aria-label="Tutup"
            className="rounded-lg p-1 text-suka-gray-400 transition-colors hover:bg-suka-gray-100 hover:text-suka-ink disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ringkasan Pengajuan */}
        <div className="mt-4 space-y-3 rounded-xl border border-suka-brown/10 bg-suka-surface/50 p-4 text-sm">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Store size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-suka-gray-500">Outlet</div>
                <div className="truncate font-semibold text-suka-ink">{expense.outlet_nama}</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <User size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-suka-gray-500">Diajukan Oleh</div>
                <div className="truncate font-semibold text-suka-ink">{expense.pengaju_nama || 'Kru Kasir'}</div>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:col-span-2">
              <Tag size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0 flex-1" ref={dropdownRef}>
                <span
                  id="label-kategori-pengeluaran-pc"
                  className="block text-[11px] font-medium text-suka-gray-500"
                >
                  Kategori {isRabOtomatis ? '(RAB Otomatis)' : '(dapat dikoreksi sebelum ACC)'}
                </span>
                {isRabOtomatis ? (
                  <div className="mt-0.5 font-semibold text-suka-ink">
                    {labelKategoriPettyCash(expense.category)}
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <button
                      type="button"
                      role="combobox"
                      aria-labelledby="label-kategori-pengeluaran-pc"
                      aria-expanded={dropdownOpen}
                      aria-haspopup="listbox"
                      aria-controls="listbox-kategori-pengeluaran-pc"
                      disabled={sedangProses}
                      onClick={() => setDropdownOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-suka-brown/20 bg-white px-3 py-2 text-left text-sm font-semibold text-suka-ink transition-colors hover:border-suka-brown/40 focus:border-suka-orange focus:outline-none focus:ring-1 focus:ring-suka-orange disabled:opacity-50"
                    >
                      <span className="truncate">{labelKategoriPettyCash(selectedCategory)}</span>
                      <ChevronDown
                        size={16}
                        className={`ml-2 shrink-0 text-suka-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {dropdownOpen && (
                      <div
                        id="listbox-kategori-pengeluaran-pc"
                        role="listbox"
                        aria-labelledby="label-kategori-pengeluaran-pc"
                        className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-suka-gray-200 bg-white py-1 shadow-lg"
                      >
                        {kategoriOptions.map((opt) => {
                          const aktif = opt.value === selectedCategory
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="option"
                              aria-selected={aktif}
                              onClick={() => {
                                setSelectedCategory(opt.value)
                                setDropdownOpen(false)
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                aktif
                                  ? 'bg-amber-50 font-semibold text-suka-brown'
                                  : 'font-medium text-suka-ink hover:bg-suka-gray-50'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {aktif && <Check size={15} className="shrink-0 text-suka-orange" />}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {kategoriBerubah && (
                      <p className="mt-1 text-[11px] font-medium text-amber-800">
                        Akan dikoreksi dari <b>{labelKategoriPettyCash(expense.category)}</b> saat disetujui.
                      </p>
                    )}
                    {!kategoriBerubah && expense.kategori_asal && expense.kategori_asal !== expense.category && (
                      <p className="mt-1 text-[11px] text-suka-gray-500">
                        Kategori awal kasir: {labelKategoriPettyCash(expense.kategori_asal)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 sm:col-span-2">
              <Calendar size={15} className="mt-0.5 shrink-0 text-suka-orange" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-suka-gray-500">Waktu Pengajuan</div>
                <div className="truncate font-semibold text-suka-ink">{tanggalWaktu(expense.created_at)}</div>
              </div>
            </div>
          </div>

          <div className="border-t border-suka-brown/10 pt-2.5">
            <div className="text-[11px] font-medium text-suka-gray-500">Keterangan Belanja</div>
            <div className="mt-0.5 font-medium text-suka-ink">{expense.description || '-'}</div>
          </div>

          <div className="flex items-baseline justify-between border-t border-suka-brown/10 pt-2.5">
            <div>
              <span className="text-xs font-semibold text-suka-gray-600">Nominal Pengeluaran</span>
              <p className="text-[11px] text-suka-gray-500">
                Jika nominal beda dari struk, klik Tolak Pengajuan agar kasir input ulang.
              </p>
            </div>
            <span className="font-display text-xl font-bold tabular-nums text-suka-brown">
              {rupiah(expense.amount)}
            </span>
          </div>
        </div>

        {/* Foto Bukti Struk */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-suka-gray-700">Foto Bukti Struk / Nota</span>
            {expense.receipt_url && (
              <a
                href={expense.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-suka-orange hover:underline"
              >
                Buka ukuran penuh
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {expense.receipt_url && !imgError ? (
            <a
              href={expense.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-suka-gray-200 bg-suka-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={expense.receipt_url}
                alt={`Struk pengeluaran ${expense.outlet_nama}`}
                onError={() => setImgError(true)}
                className="max-h-72 w-full object-contain"
              />
            </a>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <ImageOff size={16} className="shrink-0 text-amber-600" />
              <span>
                {expense.receipt_url
                  ? 'Pratinjau gambar tidak dapat dimuat langsung. Klik "Buka ukuran penuh" untuk melihat struk.'
                  : 'Tidak ada lampiran foto struk pada pengajuan ini.'}
              </span>
            </div>
          )}
        </div>

        {/* Info Dampak Saldo */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>
            Setelah disetujui, saldo Petty Cash di POS <b>{expense.outlet_nama}</b> otomatis terpotong sebesar{' '}
            <b>{rupiah(expense.amount)}</b> dan kasir dapat melanjutkan tutup shift.
          </span>
        </div>

        {/* Aksi */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-suka-brown/10 pt-4">
          <button
            type="button"
            onClick={onTolak}
            disabled={sedangProses}
            className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tolak Pengajuan
          </button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={sedangProses}>
              Batal
            </Button>
            <Button onClick={setujui} disabled={sedangProses}>
              {sedangProses ? 'Memproses…' : kategoriBerubah ? 'Simpan Kategori & Setujui' : 'Setujui Pengeluaran'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
