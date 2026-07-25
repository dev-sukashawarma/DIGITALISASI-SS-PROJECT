'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Plus, Clock, CheckCircle2, XCircle, Store, Building2, Send, Check, 
  Search, Camera, X, Download, AlertCircle, Wallet, Calendar 
} from 'lucide-react'
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
  proof_of_transfer_url?: string | null
  outlet?: { name: string } | null
}

function formatDateTime(iso: string) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function formatRole(role?: string) {
  if (!role) return 'Staff'
  const map: Record<string, string> = {
    leader: 'Leader',
    area_manager: 'Area Manager',
    admin_finance: 'Finance',
    crew: 'Crew',
    admin: 'Admin',
    owner: 'Owner',
    spv: 'Supervisor'
  }
  return map[role] || role.replace('_', ' ').toUpperCase()
}

function ProofImageLightbox({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  if (!imageUrl) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Foto Bukti Transfer Finance</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50">
          <img src={imageUrl} alt="Bukti Transfer" className="max-h-[65vh] w-auto object-contain rounded-xl shadow-sm border border-slate-200" />
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 font-medium">Lampiran Bukti Transfer Resmi</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            download="Bukti_Transfer_Petty_Cash.jpg"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Unduh Foto Utuh
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LeaderPettyCashPage() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [outlets, setOutlets] = useState<any[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ name: string; role: string } | null>(null)
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Form fields
  const [amount, setAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [bankName, setBankName] = useState<string>('')
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('')
  const [bankAccountName, setBankAccountName] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('leader-petty-cash-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_topups' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadData() {
    try {
      const [topupsRes, userRes] = await Promise.all([
        supabase
          .from('petty_cash_topups')
          .select(`
            *,
            outlets!petty_cash_topups_outlet_id_fkey(name, bank_name, bank_account_number, bank_account_name)
          `)
          .order('created_at', { ascending: false }),
        supabase.auth.getUser()
      ])

      if (topupsRes.data) {
        setRequests(topupsRes.data.map((r: any) => ({
          ...r,
          outlet: r.outlets ? { name: r.outlets.name } : null
        })))
      }

      const user = userRes.data?.user
      let staff: any = null
      if (user) {
        const { data: staffData } = await supabase
          .from('outlet_staff')
          .select('id, name, role, outlet_id')
          .eq('id', user.id)
          .maybeSingle()
        if (staffData) setUserProfile(staffData)
        staff = staffData
      }

      if (!staff) {
        const { data: leaderStaff } = await supabase
          .from('outlet_staff')
          .select('id, name, role, outlet_id')
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
    } catch (err) {
      console.warn('Error loading leader petty cash data:', err)
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
    if (!selectedOutletId) {
      toast.error('Pilih outlet tujuan top up terlebih dahulu!')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Nominal Top Up (Rp) wajib diisi dengan angka positif!')
      return
    }

    if (!description.trim()) {
      toast.error('Alasan / Keperluan Operasional wajib diisi!')
      return
    }

    if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
      toast.error('Rekening Bank Outlet (Nama Bank, No. Rekening, dan Atas Nama) wajib diisi lengkap sebelum mengajukan top up!')
      return
    }

    setIsSubmitting(true)
    try {
      await supabase
        .from('outlets')
        .update({
          bank_name: bankName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          bank_account_name: bankAccountName.trim()
        })
        .eq('id', selectedOutletId)

      const { error } = await supabase.rpc('create_petty_cash_topup', {
        p_outlet_id: selectedOutletId,
        p_amount: parseFloat(amount),
        p_description: description.trim(),
        p_bank_name: bankName.trim(),
        p_bank_account_number: bankAccountNumber.trim(),
        p_bank_account_name: bankAccountName.trim()
      })

      if (error) throw error

      toast.success('Pengajuan Top Up Petty Cash & Data Rekening berhasil disimpan!')
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

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter === 'pending' && !(r.status === 'pending' || r.status === 'forwarded_to_area_manager')) return false
      if (statusFilter === 'finance' && !(r.status === 'forwarded_to_finance' || r.status === 'approved_by_finance' || r.status === 'forwarded_by_finance')) return false
      if (statusFilter === 'action_needed' && r.status !== 'forwarded_by_area_manager') return false
      if (statusFilter === 'completed' && !(r.status === 'completed' || r.status === 'forwarded_by_leader')) return false
      if (statusFilter === 'rejected' && r.status !== 'rejected') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const outletName = (r.outlet?.name || '').toLowerCase()
        const desc = (r.description || '').toLowerCase()
        const bank = (r.bank_name || '').toLowerCase()
        const acc = (r.bank_account_number || '').toLowerCase()
        const holder = (r.bank_account_name || '').toLowerCase()
        const amountStr = r.amount.toString()
        
        return outletName.includes(q) || desc.includes(q) || bank.includes(q) || acc.includes(q) || holder.includes(q) || amountStr.includes(q)
      }

      return true
    })
  }, [requests, statusFilter, searchQuery])

  const countPending = requests.filter(r => r.status === 'pending' || r.status === 'forwarded_to_area_manager').length
  const countActionNeeded = requests.filter(r => r.status === 'forwarded_by_area_manager').length
  const countCompleted = requests.filter(r => r.status === 'completed' || r.status === 'forwarded_by_leader').length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* HEADER BAR - Solid, Clean Design */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Top Up Petty Cash Outlet</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              {userProfile && (
                <span className="font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md mr-2">
                  USER: {userProfile.name} ({formatRole(userProfile.role)})
                </span>
              )}
              Kelola & pantau status pengajuan dana operasional cabang.
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          {showForm ? 'Sembunyikan Form' : '+ Form Pengajuan Baru'}
        </button>
      </div>

      {/* FORM SECTION */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-200">
          
          {/* STEP 1: OUTLET SELECTION CARDS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                Langkah 1: Pilih Outlet Tujuan Top Up
              </label>
              <span className="text-xs text-slate-500 font-medium">Pilih salah satu outlet cabang</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {outlets.map((o) => {
                const isSelected = o.id === selectedOutletId
                return (
                  <div
                    key={o.id}
                    onClick={() => handleOutletSelect(o.id)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between relative ${
                      isSelected
                        ? 'border-2 border-blue-600 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                    <div>
                      <h4 className={`text-sm font-bold ${isSelected ? 'text-blue-950' : 'text-slate-900'}`}>
                        {o.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">{o.slug}</p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-600 font-medium">
                      {o.bank_name && o.bank_account_number ? (
                        <span>Bank: <b className="text-slate-900 font-bold">{o.bank_name}</b> ({o.bank_account_number})</span>
                      ) : (
                        <span className="text-red-600 font-bold italic flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          Belum ada rekening
                        </span>
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nominal Top Up (Rp) <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold text-sm">Rp</span>
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
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alasan / Keperluan Operasional <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea 
                  rows={4} 
                  placeholder="Pembelian bahan baku es kristal, kantong plastik & perlengkapan kasir..." 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Clean Bank Account Card */}
            <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">Rekening Bank Outlet (Tersimpan)</h3>
                </div>
                <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">Wajib Diisi</span>
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Data rekening ini otomatis tersimpan secara permanen untuk outlet cabang yang Anda pilih.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Bank
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: BCA / Mandiri / BRI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    No. Rekening
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1234567890"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Atas Nama Rekening
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Nama Pemilik Rekening / Outlet"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs"
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
              className="inline-flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan Top Up'}
            </button>
          </div>
        </form>
      )}

      {/* DATA TABLE & CARDS SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* TABLE HEADER & FILTER BAR */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Daftar Pengajuan Top Up Petty Cash
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Riwayat & pemantauan status persetujuan berjenjang</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                Total: <span className="text-blue-600">{filteredRequests.length}</span> / {requests.length} data
              </span>
            </div>
          </div>

          {/* SEARCH & FILTER CONTROLS */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama outlet, alasan, bank, atau nominal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-xs"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua ({requests.length})
              </button>

              {countActionNeeded > 0 && (
                <button
                  onClick={() => setStatusFilter('action_needed')}
                  className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    statusFilter === 'action_needed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" /> Action Leader ({countActionNeeded})
                </button>
              )}

              <button
                onClick={() => setStatusFilter('pending')}
                className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Menunggu AM ({countPending})
              </button>

              <button
                onClick={() => setStatusFilter('completed')}
                className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Selesai ({countCompleted})
              </button>
            </div>

          </div>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                <th className="px-5 py-3.5 font-bold w-[160px]">Tanggal & Waktu</th>
                <th className="px-5 py-3.5 font-bold w-[200px]">Outlet Cabang</th>
                <th className="px-5 py-3.5 font-bold w-[200px]">Rekening Tujuan</th>
                <th className="px-5 py-3.5 font-bold w-[140px]">Nominal Top Up</th>
                <th className="px-5 py-3.5 font-bold">Alasan / Keperluan</th>
                <th className="px-5 py-3.5 font-bold w-[230px]">Status Hirarki</th>
                <th className="px-5 py-3.5 font-bold text-right w-[160px]">Bukti / Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700 text-sm">Tidak ada pengajuan ditemukan.</p>
                    <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau filter status di atas.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateTime(row.created_at)}
                      </div>
                    </td>

                    <td className="px-5 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{row.outlet?.name || '-'}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs">
                      {row.bank_name ? (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            {row.bank_name} - <span className="font-mono text-slate-900">{row.bank_account_number}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">a.n {row.bank_account_name || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px] bg-slate-100 px-2 py-1 rounded-md">Belum diisi</span>
                      )}
                    </td>

                    <td className="px-5 py-4 font-black text-blue-600 text-sm whitespace-nowrap">
                      {formatRupiah(row.amount)}
                    </td>

                    <td className="px-5 py-4 text-slate-800 font-medium max-w-xs sm:max-w-md whitespace-pre-wrap break-words leading-relaxed text-xs">
                      {row.description}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {(row.status === 'pending' || row.status === 'forwarded_to_area_manager') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Menunggu Area Manager</span>
                          </span>
                        )}

                        {row.status === 'forwarded_to_finance' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Menunggu Finance</span>
                          </span>
                        )}

                        {(row.status === 'approved_by_finance' || row.status === 'forwarded_by_finance') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Disetujui Finance (Pencairan)</span>
                          </span>
                        )}

                        {row.status === 'forwarded_by_area_manager' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-600 text-white animate-pulse">
                            <Send className="w-3.5 h-3.5 shrink-0" />
                            <span>Siap Serahkan ke Crew</span>
                          </span>
                        )}

                        {row.status === 'forwarded_by_leader' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Diserahkan ke Crew</span>
                          </span>
                        )}

                        {row.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-600 text-white">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Selesai (Crew Terima)</span>
                          </span>
                        )}

                        {row.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>Ditolak</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right whitespace-nowrap space-y-1">
                      {row.status === 'forwarded_by_area_manager' && (
                        <button
                          onClick={() => handleLeaderForwardToCrew(row.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> Serahkan ke Crew
                        </button>
                      )}

                      {row.proof_of_transfer_url && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(row.proof_of_transfer_url || null)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Lihat Bukti</span>
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">Tidak ada pengajuan ditemukan.</p>
            </div>
          ) : (
            filteredRequests.map((row) => (
              <div key={row.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-slate-900 text-sm">{row.outlet?.name || '-'}</span>
                  </div>
                  
                  <div>
                    {(row.status === 'pending' || row.status === 'forwarded_to_area_manager') && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Menunggu AM
                      </span>
                    )}
                    {row.status === 'forwarded_to_finance' && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        Menunggu Finance
                      </span>
                    )}
                    {(row.status === 'approved_by_finance' || row.status === 'forwarded_by_finance') && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Acc Finance
                      </span>
                    )}
                    {row.status === 'forwarded_by_area_manager' && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white animate-pulse">
                        Siap Serahkan
                      </span>
                    )}
                    {row.status === 'forwarded_by_leader' && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Serah ke Crew
                      </span>
                    )}
                    {row.status === 'completed' && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white">
                        Selesai
                      </span>
                    )}
                    {row.status === 'rejected' && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        Ditolak
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-slate-500 font-medium">{formatDateTime(row.created_at)}</span>
                  <span className="text-base font-black text-blue-600">{formatRupiah(row.amount)}</span>
                </div>

                <p className="text-xs text-slate-800 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  {row.description}
                </p>

                {row.bank_name && (
                  <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{row.bank_name} - {row.bank_account_number} (a.n {row.bank_account_name || '-'})</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  {row.status === 'forwarded_by_area_manager' && (
                    <button
                      onClick={() => handleLeaderForwardToCrew(row.id)}
                      className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all text-center"
                    >
                      Serahkan ke Crew
                    </button>
                  )}

                  {row.proof_of_transfer_url && (
                    <button
                      type="button"
                      onClick={() => setSelectedProofUrl(row.proof_of_transfer_url || null)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <Camera className="w-3.5 h-3.5" /> Bukti
                    </button>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

      </div>

      <ProofImageLightbox
        imageUrl={selectedProofUrl}
        onClose={() => setSelectedProofUrl(null)}
      />
    </div>
  )
}
