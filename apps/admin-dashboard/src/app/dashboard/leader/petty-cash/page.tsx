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

function ProofImageLightbox({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  if (!imageUrl) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">Foto Bukti Transfer Finance</h3>
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
          <img src={imageUrl} alt="Bukti Transfer" className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-md border border-slate-200" />
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 font-semibold">Lampiran Bukti Transfer Resmi</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            download="Bukti_Transfer_Petty_Cash.jpg"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-sm"
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

    // Realtime subscription for petty_cash_topups
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
      // Parallelize topups fetch and user authentication fetch
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

    // VALIDASI WAJIB UNTUK REKENING BANK OUTLET
    if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
      toast.error('Rekening Bank Outlet (Nama Bank, No. Rekening, dan Atas Nama) wajib diisi lengkap sebelum mengajukan top up!')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Simpan/update otomatis ke tabel outlets agar permanen
      await supabase
        .from('outlets')
        .update({
          bank_name: bankName.trim(),
          bank_account_number: bankAccountNumber.trim(),
          bank_account_name: bankAccountName.trim()
        })
        .eq('id', selectedOutletId)

      // 2. Buat pengajuan top up petty cash
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

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // Status filter
      if (statusFilter === 'pending' && !(r.status === 'pending' || r.status === 'forwarded_to_area_manager')) return false
      if (statusFilter === 'finance' && !(r.status === 'forwarded_to_finance' || r.status === 'approved_by_finance' || r.status === 'forwarded_by_finance')) return false
      if (statusFilter === 'action_needed' && r.status !== 'forwarded_by_area_manager') return false
      if (statusFilter === 'completed' && !(r.status === 'completed' || r.status === 'forwarded_by_leader')) return false
      if (statusFilter === 'rejected' && r.status !== 'rejected') return false

      // Search query
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

  // Summary counts
  const countPending = requests.filter(r => r.status === 'pending' || r.status === 'forwarded_to_area_manager').length
  const countActionNeeded = requests.filter(r => r.status === 'forwarded_by_area_manager').length
  const countCompleted = requests.filter(r => r.status === 'completed' || r.status === 'forwarded_by_leader').length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Top Up Petty Cash Outlet</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Kelola & pantau status pengajuan dana operasional cabang.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-sm shadow-orange-500/20 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          {showForm ? 'Sembunyikan Form' : '+ Form Pengajuan Baru'}
        </button>
      </div>

      {/* FORM SECTION */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-orange-500/30 p-5 sm:p-7 shadow-sm space-y-6 animate-in fade-in duration-200">
          
          {/* STEP 1: OUTLET SELECTION CARDS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Store className="w-4 h-4 text-orange-500" />
                Langkah 1: Pilih Outlet Tujuan Top Up
              </label>
              <span className="text-xs text-slate-500 font-medium">Pilih salah satu outlet cabang</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {outlets.map((o) => {
                const isSelected = o.id === selectedOutletId
                return (
                  <div
                    key={o.id}
                    onClick={() => handleOutletSelect(o.id)}
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col justify-between relative ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/60 shadow-xs'
                        : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                    <div>
                      <h4 className={`text-sm font-extrabold ${isSelected ? 'text-orange-950' : 'text-slate-800'}`}>
                        {o.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">{o.slug}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-600">
                      {o.bank_name && o.bank_account_number ? (
                        <span>Bank: <b className="text-slate-800">{o.bank_name}</b> ({o.bank_account_number})</span>
                      ) : (
                        <span className="text-red-600 font-extrabold italic flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          Belum ada rekening (Wajib diisi)
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
                  Nominal Top Up (Rp) <span className="text-red-500 font-black">*</span>
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
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none"
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alasan / Keperluan Operasional <span className="text-red-500 font-black">*</span>
                </label>
                <textarea 
                  rows={3} 
                  placeholder="Pembelian bahan baku es kristal, kantong plastik & perlengkapan kasir..." 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="bg-amber-50/70 p-5 rounded-2xl border-2 border-amber-300/80 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-700" />
                  <h3 className="text-sm font-bold text-amber-900">Rekening Bank Outlet (Tersimpan)</h3>
                </div>
                <span className="text-[10px] font-black text-white bg-red-600 px-2 py-0.5 rounded shadow-2xs">Wajib Diisi *</span>
              </div>
              <p className="text-xs text-amber-800 font-medium">Rekening ini <span className="font-bold underline">wajib diisi lengkap</span> dan otomatis tersimpan permanen untuk outlet cabang yang Anda pilih.</p>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 uppercase mb-0.5 flex items-center justify-between">
                    <span>Nama Bank</span>
                    <span className="text-red-600 font-black text-[10px]">* Wajib</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: BCA / Mandiri / BRI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none shadow-2xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 uppercase mb-0.5 flex items-center justify-between">
                    <span>No. Rekening</span>
                    <span className="text-red-600 font-black text-[10px]">* Wajib</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1234567890"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none shadow-2xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 uppercase mb-0.5 flex items-center justify-between">
                    <span>Atas Nama Rekening</span>
                    <span className="text-red-600 font-black text-[10px]">* Wajib</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Nama Pemilik Rekening / Outlet"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none shadow-2xs"
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
              className="inline-flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-extrabold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-all shadow-sm shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan Top Up'}
            </button>
          </div>
        </form>
      )}

      {/* REAL DATA TABLE & CARDS SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
        
        {/* TABLE HEADER & FILTER BAR */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                Daftar Pengajuan Top Up Petty Cash
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Riwayat & pemantauan status persetujuan berjenjang</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
                Total: <span className="text-orange-600">{filteredRequests.length}</span> / {requests.length} data
              </span>
            </div>
          </div>

          {/* SEARCH & FILTER CONTROLS */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama outlet, alasan, bank, atau nominal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all shadow-2xs"
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

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua ({requests.length})
              </button>

              {countActionNeeded > 0 && (
                <button
                  onClick={() => setStatusFilter('action_needed')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                    statusFilter === 'action_needed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Send className="w-3 h-3" /> Action Leader ({countActionNeeded})
                </button>
              )}

              <button
                onClick={() => setStatusFilter('pending')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3 h-3 text-amber-500" /> Menunggu AM ({countPending})
              </button>

              <button
                onClick={() => setStatusFilter('completed')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Selesai ({countCompleted})
              </button>
            </div>

          </div>
        </div>

        {/* DESKTOP TABLE VIEW (md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                <th className="px-5 py-3.5 font-extrabold w-[160px]">Tanggal & Waktu</th>
                <th className="px-5 py-3.5 font-extrabold w-[200px]">Outlet Cabang</th>
                <th className="px-5 py-3.5 font-extrabold w-[200px]">Rekening Tujuan</th>
                <th className="px-5 py-3.5 font-extrabold w-[140px]">Nominal Top Up</th>
                <th className="px-5 py-3.5 font-extrabold">Alasan / Keperluan</th>
                <th className="px-5 py-3.5 font-extrabold w-[230px]">Status Hirarki</th>
                <th className="px-5 py-3.5 font-extrabold text-right w-[160px]">Bukti / Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-600 text-sm">Tidak ada pengajuan ditemukan.</p>
                    <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau filter status di atas.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Tanggal */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateTime(row.created_at)}
                      </div>
                    </td>

                    {/* Outlet */}
                    <td className="px-5 py-4 font-extrabold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>{row.outlet?.name || '-'}</span>
                      </div>
                    </td>

                    {/* Rekening Tujuan */}
                    <td className="px-5 py-4 text-xs">
                      {row.bank_name ? (
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/70 space-y-0.5">
                          <div className="font-extrabold text-slate-800 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-orange-500" />
                            {row.bank_name} - <span className="font-mono text-slate-900">{row.bank_account_number}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">a.n {row.bank_account_name || '-'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px] bg-slate-100 px-2 py-1 rounded-md">Belum diisi</span>
                      )}
                    </td>

                    {/* Nominal */}
                    <td className="px-5 py-4 font-black text-orange-600 text-sm whitespace-nowrap">
                      {formatRupiah(row.amount)}
                    </td>

                    {/* Alasan */}
                    <td className="px-5 py-4 text-slate-800 font-medium max-w-xs sm:max-w-md whitespace-pre-wrap break-words leading-relaxed text-xs">
                      {row.description}
                    </td>

                    {/* Status Hirarki - FULL RESPONSIVE BADGES */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {(row.status === 'pending' || row.status === 'forwarded_to_area_manager') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Menunggu Area Manager</span>
                          </span>
                        )}

                        {row.status === 'forwarded_to_finance' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Menunggu Finance</span>
                          </span>
                        )}

                        {(row.status === 'approved_by_finance' || row.status === 'forwarded_by_finance') && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                            <span>Disetujui Finance (Pencairan)</span>
                          </span>
                        )}

                        {row.status === 'forwarded_by_area_manager' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black bg-emerald-600 text-white shadow-2xs animate-pulse">
                            <Send className="w-3.5 h-3.5 shrink-0" />
                            <span>Siap Serahkan ke Crew</span>
                          </span>
                        )}

                        {row.status === 'forwarded_by_leader' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Diserahkan ke Crew (Saldo +)</span>
                          </span>
                        )}

                        {row.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-600 text-white shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Selesai (Crew Terima)</span>
                          </span>
                        )}

                        {row.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200 shadow-2xs">
                            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>Ditolak</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Bukti / Aksi */}
                    <td className="px-5 py-4 text-right whitespace-nowrap space-y-1">
                      {row.status === 'forwarded_by_area_manager' && (
                        <button
                          onClick={() => handleLeaderForwardToCrew(row.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> Serahkan ke Crew
                        </button>
                      )}

                      {row.proof_of_transfer_url && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(row.proof_of_transfer_url || null)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
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

        {/* MOBILE CARD VIEW (md:hidden) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600 text-sm">Tidak ada pengajuan ditemukan.</p>
            </div>
          ) : (
            filteredRequests.map((row) => (
              <div key={row.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                
                {/* Card Header: Outlet & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="font-black text-slate-900 text-sm">{row.outlet?.name || '-'}</span>
                  </div>
                  
                  {/* Status Badge */}
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
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                        Acc Finance
                      </span>
                    )}
                    {row.status === 'forwarded_by_area_manager' && (
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-emerald-600 text-white animate-pulse">
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

                {/* Amount & Time */}
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-lg font-black text-orange-600">{formatRupiah(row.amount)}</span>
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatDateTime(row.created_at)}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-700 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {row.description}
                </p>

                {/* Bank Info & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div>
                    {row.bank_name ? (
                      <span className="text-[11px] text-slate-600 font-bold">
                        {row.bank_name} ({row.bank_account_number})
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Belum ada rekening</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {row.proof_of_transfer_url && (
                      <button
                        type="button"
                        onClick={() => setSelectedProofUrl(row.proof_of_transfer_url || null)}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] rounded-lg border border-emerald-200"
                      >
                        📷 Bukti
                      </button>
                    )}

                    {row.status === 'forwarded_by_area_manager' && (
                      <button
                        onClick={() => handleLeaderForwardToCrew(row.id)}
                        className="px-3 py-1.5 bg-emerald-600 text-white font-black text-[11px] rounded-xl shadow-xs"
                      >
                        Serahkan ke Crew
                      </button>
                    )}
                  </div>
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
