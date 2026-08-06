'use client'
// @ts-nocheck

import React, { useState, useEffect } from 'react'
import { 
  Building2, Send, Check, 
  Search, Camera, X, Download
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
      <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Camera className="w-4 h-4 text-slate-700" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Bukti Transfer</h3>
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
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 font-medium">Lampiran Resmi</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            download="Bukti_Transfer_Petty_Cash.jpg"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Unduh
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LeaderPettyCashPage() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [outlets, setOutlets] = useState<any[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>('')
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ name: string; role: string } | null>(null)
  
  // Search & Filter
  const [searchQuery] = useState<string>("")
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
      setShowForm(false)
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

      if (searchQuery && searchQuery.trim()) {
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
    <div className="max-w-4xl mx-auto w-full font-sans pb-12">
      
      {/* Header Minimalist */}
      <div className="mb-8 mt-2 px-1 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-suka-orange mb-1 uppercase tracking-wider">Top Up Petty Cash</p>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">Pengajuan Dana</h1>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-black active:scale-[0.98] text-white rounded-2xl font-bold text-sm transition-all shadow-sm shrink-0 cursor-pointer w-full sm:w-auto"
        >
          {showForm ? 'Sembunyikan Form' : '+ Form Pengajuan Baru'}
        </button>
      </div>

      {/* FORM SECTION - Luxury Minimal */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-[24px] p-5 sm:p-8 shadow-sm ring-1 ring-slate-100 space-y-8 animate-in fade-in duration-200">
          
          {/* STEP 1: OUTLET SELECTION */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">1. Pilih Outlet Tujuan</h3>
              <p className="text-sm text-slate-500 mt-1">Pilih cabang yang memerlukan tambahan operasional.</p>
            </div>

            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x">
              {outlets.map((o) => {
                const isSelected = o.id === selectedOutletId
                return (
                  <div
                    key={o.id}
                    onClick={() => handleOutletSelect(o.id)}
                    className={`shrink-0 w-[240px] snap-center cursor-pointer p-4 rounded-2xl transition-all relative ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-slate-50 text-slate-900 hover:bg-slate-100 ring-1 ring-slate-200'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-4 right-4">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <h4 className={`text-sm font-bold pr-6 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {o.name}
                    </h4>
                    <p className={`text-[11px] mt-1 font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {o.slug}
                    </p>
                    <div className="mt-4 pt-3 border-t border-white/10 text-[11px] font-medium">
                      {o.bank_name && o.bank_account_number ? (
                        <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                          {o.bank_name} ({o.bank_account_number})
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold italic flex items-center gap-1">
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

          {/* STEP 2: DETAILS */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">2. Detail Top Up & Rekening</h3>
              <p className="text-sm text-slate-500 mt-1">Isi nominal dan alasan yang jelas.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Nominal Top Up
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      placeholder="0" 
                      value={amount ? Number(amount).toLocaleString('id-ID') : ''}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                      required 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Alasan / Keperluan Operasional
                  </label>
                  <textarea 
                    rows={4} 
                    placeholder="Contoh: Beli es kristal, plastik besar..." 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all resize-none"
                    required
                  />
                </div>
              </div>

              {/* Bank Account */}
              <div className="bg-slate-50 p-6 rounded-2xl space-y-5">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900">Rekening Tujuan</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Nama Bank
                  </label>
                  <input
                    type="text"
                    placeholder="BCA / Mandiri / BRI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    No. Rekening
                  </label>
                  <input
                    type="text"
                    placeholder="1234567890"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Atas Nama
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Pemilik Rekening"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedOutletId}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-suka-orange hover:bg-orange-600 active:scale-[0.98] text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              <Send className="w-4 h-4 ml-1" />
            </button>
          </div>
        </form>
      )}

      {/* FILTER TABS (Mobile Friendly Scrollable) */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide px-1">
        <button
          onClick={() => setStatusFilter('all')}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Semua ({requests.length})
        </button>

        {countActionNeeded > 0 && (
          <button
            onClick={() => setStatusFilter('action_needed')}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === 'action_needed'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            }`}
          >
            Action Leader ({countActionNeeded})
          </button>
        )}

        <button
          onClick={() => setStatusFilter('pending')}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Menunggu AM ({countPending})
        </button>

        <button
          onClick={() => setStatusFilter('completed')}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            statusFilter === 'completed'
              ? 'bg-emerald-700 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          Selesai ({countCompleted})
        </button>
      </div>

      {/* LIST SECTION - Luxury Minimal Cards instead of tables */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center ring-1 ring-slate-100 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <p className="font-bold text-slate-900">Tidak ada pengajuan</p>
            <p className="text-sm text-slate-500 mt-1">Coba filter status lainnya.</p>
          </div>
        ) : (
          filteredRequests.map((row) => (
            <div key={row.id} className="bg-white rounded-[20px] p-5 sm:p-6 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md">
              
              {/* Header Status & Outlet */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{row.outlet?.name || '-'}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-xs font-medium text-slate-500">{formatDateTime(row.created_at)}</span>
                  </div>
                </div>
                
                {/* Status Badges */}
                <div className="flex items-center self-start sm:self-auto">
                  {(row.status === 'pending' || row.status === 'forwarded_to_area_manager') && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200/50 uppercase tracking-wider">
                      Menunggu AM
                    </span>
                  )}
                  {row.status === 'forwarded_to_finance' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-200/50 uppercase tracking-wider">
                      Menunggu Finance
                    </span>
                  )}
                  {(row.status === 'approved_by_finance' || row.status === 'forwarded_by_finance') && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50 uppercase tracking-wider">
                      Acc Finance
                    </span>
                  )}
                  {row.status === 'forwarded_by_area_manager' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-suka-orange text-white animate-pulse uppercase tracking-wider shadow-sm">
                      Siap Diserahkan
                    </span>
                  )}
                  {row.status === 'forwarded_by_leader' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50 uppercase tracking-wider">
                      Diserahkan ke Crew
                    </span>
                  )}
                  {row.status === 'completed' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider">
                      Selesai
                    </span>
                  )}
                  {row.status === 'rejected' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 ring-1 ring-red-200/50 uppercase tracking-wider">
                      Ditolak
                    </span>
                  )}
                </div>
              </div>

              {/* Amount & Description */}
              <div className="mb-4">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tighter mb-2">
                  {formatRupiah(row.amount)}
                </h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  {row.description}
                </p>
              </div>

              {/* Bank Info */}
              {row.bank_name && (
                <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-200">
                    <Building2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">{row.bank_name} - {row.bank_account_number}</span>
                    <span className="text-[11px] text-slate-500 font-medium">a.n {row.bank_account_name}</span>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {row.status === 'forwarded_by_area_manager' && (
                  <button
                    onClick={() => handleLeaderForwardToCrew(row.id)}
                    className="flex-1 sm:flex-none py-2.5 px-6 bg-suka-orange hover:bg-orange-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all text-center shadow-sm"
                  >
                    Terima & Serahkan ke Crew
                  </button>
                )}

                {row.proof_of_transfer_url && (
                  <button
                    type="button"
                    onClick={() => setSelectedProofUrl(row.proof_of_transfer_url || null)}
                    className="flex-1 sm:flex-none py-2.5 px-5 bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Lihat Bukti
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ProofImageLightbox
        imageUrl={selectedProofUrl}
        onClose={() => setSelectedProofUrl(null)}
      />
    </div>
  )
}
