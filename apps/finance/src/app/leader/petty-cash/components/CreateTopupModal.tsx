'use client'

import React, { useState, useEffect } from 'react'
import { Card, Button, Spinner } from '@suka/design-system'
import { useCreatePettyCashTopup } from '@/hooks/usePettyCash'
import { createClient } from '@/lib/supabase'

interface CreateTopupModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateTopupModal({ isOpen, onClose }: CreateTopupModalProps) {
  const createTopup = useCreatePettyCashTopup()
  const supabase = createClient()

  const [outlets, setOutlets] = useState<any[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [bankName, setBankName] = useState<string>('')
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
  const [bankAccountName, setBankAccountName] = useState<string>('')
  const [isLoadingOutlet, setIsLoadingOutlet] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (!isOpen) return
    async function loadOutlets() {
      setIsLoadingOutlet(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      let staff: any = null
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
      if (staff && !['admin', 'admin_finance', 'owner'].includes(staff.role)) {
        const { data: mapped } = await supabase
          .from('staff_outlets')
          .select('outlet_id')
          .eq('staff_id', staff.id)

        const ids = new Set<string>()
        if (staff.outlet_id) ids.add(staff.outlet_id)
        if (mapped) mapped.forEach((m: any) => ids.add(m.outlet_id))
        accessibleOutletIds = Array.from(ids)
      }

      let outletQuery = supabase.from('outlets').select('*').eq('is_active', true).order('name', { ascending: true })
      if (accessibleOutletIds.length > 0) {
        outletQuery = outletQuery.in('id', accessibleOutletIds)
      }

      const { data } = await outletQuery
      if (data && data.length > 0) {
        setOutlets(data)
        setSelectedOutletId(data[0].id)
        if (data[0].bank_name) setBankName(data[0].bank_name)
        if (data[0].bank_account_number) setBankAccountNumber(data[0].bank_account_number)
        if (data[0].bank_account_name) setBankAccountName(data[0].bank_account_name)
      }
      setIsLoadingOutlet(false)
    }
    loadOutlets()
  }, [isOpen])

  const handleOutletChange = (outletId: string) => {
    setSelectedOutletId(outletId)
    const target = outlets.find(o => o.id === outletId)
    if (target) {
      setBankName(target.bank_name || '')
      setBankAccountNumber(target.bank_account_number || '')
      setBankAccountName(target.bank_account_name || '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOutletId || !amount || !description) return

    setIsSubmitting(true)
    try {
      await createTopup.mutateAsync({
        outletId: selectedOutletId,
        amount: parseFloat(amount),
        description,
        bankName,
        bankAccountNumber,
        bankAccountName,
      })
      onClose()
      setAmount('')
      setDescription('')
    } catch (err: any) {
      alert('Gagal membuat pengajuan: ' + (err.message || 'Terjadi kesalahan'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white p-6 space-y-4 shadow-xl rounded-xl">
        <div className="flex justify-between items-center border-b border-suka-gray-200 pb-3">
          <h3 className="text-lg font-bold text-suka-brown">Pengajuan Top Up Petty Cash</h3>
          <button onClick={onClose} className="text-suka-gray-400 hover:text-suka-gray-600 font-bold">✕</button>
        </div>

        {isLoadingOutlet ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-suka-gray-700 uppercase tracking-wider mb-1">
                Outlet
              </label>
              <select
                className="w-full border border-suka-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-suka-brown"
                value={selectedOutletId}
                onChange={(e) => handleOutletChange(e.target.value)}
                required
              >
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
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
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Mengajukan...' : 'Kirim Pengajuan'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
