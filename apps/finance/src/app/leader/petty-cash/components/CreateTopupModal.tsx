'use client'

import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Card, Button, Spinner } from '@suka/design-system'
import { X, ChevronDown, Check, Store } from 'lucide-react'
import { useCreatePettyCashTopup } from '@/hooks/usePettyCash'
import { createClient } from '@/lib/supabase'
import { cekJamPengajuanTopupWib } from '@/lib/pettyCash/jamBatas'

interface CreateTopupModalProps {
  isOpen: boolean
  onClose: () => void
}

interface OutletOption {
  id: string
  name: string
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
}

export function CreateTopupModal({ isOpen, onClose }: CreateTopupModalProps) {
  const createTopup = useCreatePettyCashTopup()
  const supabase = createClient()

  const [outlets, setOutlets] = useState<OutletOption[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [outletDropdownOpen, setOutletDropdownOpen] = useState<boolean>(false)
  const outletDropdownRef = useRef<HTMLDivElement>(null)

  const [amount, setAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [bankName, setBankName] = useState<string>('')
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
  const [bankAccountName, setBankAccountName] = useState<string>('')
  const [isLoadingOutlet, setIsLoadingOutlet] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const submittingRef = useRef<boolean>(false)
  const [jamInfo, setJamInfo] = useState(() => cekJamPengajuanTopupWib())

  useEffect(() => {
    if (!isOpen) return
    setJamInfo(cekJamPengajuanTopupWib())
    setOutletDropdownOpen(false)
    const timer = setInterval(() => setJamInfo(cekJamPengajuanTopupWib()), 30_000)
    return () => clearInterval(timer)
  }, [isOpen])

  useEffect(() => {
    if (!outletDropdownOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (outletDropdownRef.current && !outletDropdownRef.current.contains(e.target as Node)) {
        setOutletDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [outletDropdownOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    async function loadOutlets() {
      setIsLoadingOutlet(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        let staff: { id: string; role: string; outlet_id: string | null } | null = null
        if (user) {
          const { data: staffData } = await supabase
            .from('outlet_staff')
            .select('id, role, outlet_id')
            .eq('id', user.id)
            .maybeSingle()
          staff = staffData
        }

        if (!staff) {
          const { data: leaderStaff } = await supabase
            .from('outlet_staff')
            .select('id, role, outlet_id')
            .eq('role', 'leader')
            .limit(1)
            .maybeSingle()
          staff = leaderStaff
        }

        let accessibleOutletIds: string[] = []
        if (staff && !['admin', 'admin_finance', 'owner', 'developer'].includes(staff.role)) {
          const { data: mapped } = await supabase
            .from('staff_outlets')
            .select('outlet_id')
            .eq('staff_id', staff.id)

          const ids = new Set<string>()
          if (staff.outlet_id) ids.add(staff.outlet_id)
          if (mapped) mapped.forEach((m: { outlet_id: string }) => ids.add(m.outlet_id))
          accessibleOutletIds = Array.from(ids)
        }

        let outletQuery = supabase
          .from('outlets')
          .select('id, name, bank_name, bank_account_number, bank_account_name')
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (accessibleOutletIds.length > 0) {
          outletQuery = outletQuery.in('id', accessibleOutletIds)
        }

        const { data } = await outletQuery
        if (!cancelled && data && data.length > 0) {
          setOutlets(data as OutletOption[])
          setSelectedOutletId(data[0].id)
          setBankName(data[0].bank_name || '')
          setBankAccountNumber(data[0].bank_account_number || '')
          setBankAccountName(data[0].bank_account_name || '')
        }
      } finally {
        if (!cancelled) setIsLoadingOutlet(false)
      }
    }
    loadOutlets()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const handleOutletChange = (outletId: string) => {
    setSelectedOutletId(outletId)
    setOutletDropdownOpen(false)
    const target = outlets.find((o) => o.id === outletId)
    if (target) {
      setBankName(target.bank_name || '')
      setBankAccountNumber(target.bank_account_number || '')
      setBankAccountName(target.bank_account_name || '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current || isSubmitting) return
    const cekJam = cekJamPengajuanTopupWib()
    setJamInfo(cekJam)
    if (!cekJam.diizinkan) {
      toast.error(cekJam.pesan || 'Pengajuan top up petty cash hanya dibuka pukul 09:00 hingga 16:00 WIB.')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (!selectedOutletId || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !description.trim()) {
      toast.error('Pilih outlet, isi nominal lebih dari Rp 0, dan isi alasan keperluan terlebih dahulu.')
      return
    }
    if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
      toast.error('Rekening tujuan transfer (Bank, No. Rekening, dan Atas Nama) wajib dilengkapi.')
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    try {
      await createTopup.mutateAsync({
        outletId: selectedOutletId,
        amount: parsedAmount,
        description: description.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim(),
      })
      toast.success('Pengajuan top up petty cash berhasil dikirim ke Finance.')
      onClose()
      setAmount('')
      setDescription('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      toast.error('Gagal membuat pengajuan: ' + msg)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white p-6 space-y-4 shadow-xl rounded-xl">
        <div className="flex justify-between items-center border-b border-suka-gray-200 pb-3">
          <h3 className="text-lg font-bold text-suka-brown">Pengajuan Top Up Petty Cash</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1 text-suka-gray-400 hover:bg-suka-gray-100 hover:text-suka-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoadingOutlet ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                jamInfo.diizinkan
                  ? 'border-blue-200 bg-blue-50 text-blue-900'
                  : 'border-red-200 bg-red-50 text-red-800 font-medium'
              }`}
            >
              {jamInfo.diizinkan
                ? 'Jam pengajuan top up petty cash: 09:00–16:00 WIB. Pengajuan yang belum diproses Finance melewati pukul 17:00 WIB dibatalkan otomatis oleh sistem.'
                : jamInfo.pesan}
            </div>

            <div ref={outletDropdownRef} className="relative">
              <span id="label-outlet-topup" className="block text-xs font-semibold text-suka-gray-700 uppercase tracking-wider mb-1">
                Outlet
              </span>
              <button
                type="button"
                role="combobox"
                aria-labelledby="label-outlet-topup"
                aria-expanded={outletDropdownOpen}
                aria-haspopup="listbox"
                disabled={isSubmitting || outlets.length === 0}
                onClick={() => setOutletDropdownOpen((prev) => !prev)}
                className="flex w-full items-center justify-between border border-suka-gray-300 bg-white rounded-lg p-2.5 text-sm font-medium text-suka-ink hover:border-suka-brown/50 focus:outline-none focus:ring-2 focus:ring-suka-brown disabled:opacity-50"
              >
                <span className="flex items-center gap-2 truncate">
                  <Store className="w-4 h-4 shrink-0 text-suka-orange" />
                  <span className="truncate">{selectedOutlet ? selectedOutlet.name : 'Pilih outlet'}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-suka-gray-500 transition-transform ${outletDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {outletDropdownOpen && outlets.length > 0 && (
                <div
                  role="listbox"
                  aria-labelledby="label-outlet-topup"
                  className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-suka-gray-200 bg-white py-1 shadow-lg"
                >
                  {outlets.map((o) => {
                    const aktif = o.id === selectedOutletId
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={aktif}
                        onClick={() => handleOutletChange(o.id)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                          aktif
                            ? 'bg-amber-50 font-semibold text-suka-brown'
                            : 'font-medium text-suka-ink hover:bg-suka-gray-50'
                        }`}
                      >
                        <span className="truncate">{o.name}</span>
                        {aktif && <Check className="w-4 h-4 shrink-0 text-suka-orange" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-suka-gray-700 uppercase tracking-wider mb-1">
                Nominal Top Up (Rp)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-suka-gray-400 font-bold text-xs">Rp</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  className="w-full border border-suka-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-suka-brown"
                  value={amount ? Number(amount).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '')
                    setAmount(raw)
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-suka-gray-700 uppercase tracking-wider mb-1">
                Alasan / Keperluan
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Pembelian perlengkapan kebersihan & bahan darurat"
                className="w-full border border-suka-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-suka-brown"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-800">Rekening Tujuan Transfer</span>
                <span className="text-[10px] text-amber-600 font-medium">Auto-save ke Outlet</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-amber-700 font-medium mb-0.5">Nama Bank</label>
                  <input
                    type="text"
                    placeholder="BCA / Mandiri / BRI"
                    className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-500"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-amber-700 font-medium mb-0.5">No. Rekening</label>
                  <input
                    type="text"
                    placeholder="1234567890"
                    className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-500"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-amber-700 font-medium mb-0.5">Atas Nama Rekening</label>
                <input
                  type="text"
                  placeholder="Nama Pemilik Rekening"
                  className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-500"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-suka-gray-200">
              <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
                Batal
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting || !jamInfo.diizinkan}>
                {isSubmitting ? 'Mengajukan...' : !jamInfo.diizinkan ? 'Tutup (09:00–16:00 WIB)' : 'Kirim Pengajuan'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
