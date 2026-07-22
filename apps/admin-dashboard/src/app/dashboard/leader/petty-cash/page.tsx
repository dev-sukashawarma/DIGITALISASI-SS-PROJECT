'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Clock, CheckCircle2, XCircle, Store, ArrowRight, Building2, Send, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatRupiah } from '@/lib/validations'
import { toast } from 'sonner'

interface TopupRequest {
  id: string
  outlet_id: string
  amount: number
  description: string
  status: string
  created_at: string
  bank_name?: string | null
  bank_account_number?: string | null
  bank_account_name?: string | null
  outlet?: { name: string } | null
}

export default function LeaderPettyCashPage() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [outlets, setOutlets] = useState<any[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  
  // Form fields
  const [amount, setAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [bankName, setBankName] = useState<string>('')
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
  const [bankAccountName, setBankAccountName] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // Load topups
    const { data: topupData } = await supabase
      .from('petty_cash_topups')
      .select(`
        *,
        outlets!petty_cash_topups_outlet_id_fkey(name, bank_name, bank_account_number, bank_account_name)
      `)
      .order('created_at', { ascending: false })

    if (topupData) {
      setRequests(topupData.map((r: any) => ({
        ...r,
        outlet: r.outlets ? { name: r.outlets.name } : null
      })))
    }

    // Load accessible outlets for current Leader
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

    const { data: outletData } = await outletQuery

    if (outletData && outletData.length > 0) {
      setOutlets(outletData)
      if (!selectedOutletId) {
        setSelectedOutletId(outletData[0].id)
        if (outletData[0].bank_name) setBankName(outletData[0].bank_name)
        if (outletData[0].bank_account_number) setBankAccountNumber(outletData[0].bank_account_number)
        if (outletData[0].bank_account_name) setBankAccountName(outletData[0].bank_account_name)
      }
    }
  }

  const handleOutletSelect = (id: string) => {
    setSelectedOutletId(id)
    const found = outlets.find(o => o.id === id)
    if (found) {
      setBankName(found.bank_name || '')
      setBankAccountNumber(found.bank_account_number || '')
      setBankAccountName(found.bank_account_name || '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOutletId || !amount || !description) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.rpc('create_petty_cash_topup', {
        p_outlet_id: selectedOutletId,
        p_amount: parseFloat(amount),
        p_description: description,
        p_bank_name: bankName || null,
        p_bank_account_number: bankAccountNumber || null,
        p_bank_account_name: bankAccountName || null
      })

      if (error) throw error

      toast.success('Pengajuan Top Up Petty Cash berhasil dikirim ke Area Manager!')
      setAmount('')
      setDescription('')
      await loadData()
    } catch (err: any) {
      toast.error('Gagal membuat pengajuan: ' + (err.message || 'Terjadi kesalahan'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLeaderForwardToCrew = async (id: string) => {
    if (!confirm('Anda yakin ingin menyerahkan dana ke Crew? Saldo Petty Cash outlet akan bertambah.')) return
    try {
      const { error } = await supabase.rpc('leader_forward_funds', { p_topup_id: id })
      if (error) throw error
      toast.success('Dana berhasil diserahkan ke Crew & Saldo Petty Cash Outlet bertambah!')
      await loadData()
    } catch (err: any) {
      toast.error('Gagal penyerahan dana: ' + err.message)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Top Up Petty Cash Outlet</h1>
          <p className="text-sm text-slate-500 mt-1">Pilih outlet cabang yang ingin diajukan topup petty cash-nya.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          {showForm ? 'Sembunyikan Form' : '+ Form Pengajuan Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-blue-200 p-6 shadow-sm space-y-6 animate-in fade-in">
          {/* STEP 1: OUTLET SELECTION CARDS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                Langkah 1: Pilih Outlet Tujuan Top Up
              </label>
              <span className="text-xs text-slate-500 font-medium">Pilih salah satu outlet di bawah</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {outlets.map((o) => {
                const isSelected = o.id === selectedOutletId
                return (
                  <div
                    key={o.id}
                    onClick={() => handleOutletSelect(o.id)}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col justify-between relative ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                    <div>
                      <h4 className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                        {o.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">{o.slug}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-600">
                      {o.bank_name ? (
                        <span>Bank: <b className="text-slate-800">{o.bank_name}</b> ({o.bank_account_number})</span>
                      ) : (
                        <span className="text-amber-700 italic">Belum ada rekening</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* STEP 2: DETAILS & BANK INFO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nominal Top Up (Rp)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-bold text-sm">Rp</span>
                  </div>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    placeholder="0" 
                    value={amount ? Number(amount).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      setAmount(raw)
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alasan / Keperluan Operasional
                </label>
                <textarea 
                  rows={3} 
                  placeholder="Pembelian bahan baku es kristal, kantong plastik & perlengkapan kasir..." 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-700" />
                  <h3 className="text-sm font-bold text-amber-900">Rekening Bank Outlet (Tersimpan)</h3>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded">Auto-save</span>
              </div>
              <p className="text-xs text-amber-700">Rekening ini otomatis tersimpan untuk outlet yang Anda pilih di atas.</p>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-0.5">Nama Bank</label>
                  <input
                    type="text"
                    placeholder="BCA / Mandiri / BRI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-0.5">No. Rekening</label>
                  <input
                    type="text"
                    placeholder="1234567890"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-0.5">Atas Nama Rekening</label>
                  <input
                    type="text"
                    placeholder="Nama Pemilik Rekening"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || !selectedOutletId}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan Top Up'}
            </button>
          </div>
        </form>
      )}

      {/* Real Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Daftar Pengajuan Top Up Petty Cash (Data Real)</h2>
          <span className="text-xs font-bold text-slate-500">Total: {requests.length} pengajuan</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3.5 font-bold">Outlet</th>
                <th className="px-6 py-3.5 font-bold">Rekening Tujuan</th>
                <th className="px-6 py-3.5 font-bold">Nominal</th>
                <th className="px-6 py-3.5 font-bold">Alasan</th>
                <th className="px-6 py-3.5 font-bold">Status Hirarki</th>
                <th className="px-6 py-3.5 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Belum ada pengajuan petty cash.
                  </td>
                </tr>
              ) : (
                requests.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-slate-400" />
                        {row.outlet?.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                      {row.bank_name ? (
                        <div>
                          <div className="font-bold text-slate-800">{row.bank_name} - {row.bank_account_number}</div>
                          <div className="text-slate-500">a.n {row.bank_account_name || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum diisi</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-black text-blue-600 whitespace-nowrap">
                      {formatRupiah(row.amount)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                      {row.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(row.status === 'pending' || row.status === 'forwarded_to_area_manager') && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3.5 h-3.5" /> Menunggu Area Manager
                        </span>
                      )}
                      {row.status === 'forwarded_to_finance' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3.5 h-3.5" /> Menunggu Finance
                        </span>
                      )}
                      {(row.status === 'approved_by_finance' || row.status === 'forwarded_by_finance') && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui Finance (Pencairan)
                        </span>
                      )}
                      {row.status === 'forwarded_by_area_manager' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowRight className="w-3.5 h-3.5" /> Siap Diserahkan ke Crew
                        </span>
                      )}
                      {row.status === 'forwarded_by_leader' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Diserahkan ke Crew (Saldo +)
                        </span>
                      )}
                      {row.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selesai (Crew Terima)
                        </span>
                      )}
                      {row.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3.5 h-3.5" /> Ditolak
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {row.status === 'forwarded_by_area_manager' && (
                        <button
                          onClick={() => handleLeaderForwardToCrew(row.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Serahkan ke Crew
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
