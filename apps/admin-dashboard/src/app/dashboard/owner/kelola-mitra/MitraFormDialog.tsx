'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { upsertMitraProfile } from './actions'
import { 
  Users, 
  Store, 
  X, 
  Check, 
  CreditCard, 
  FileText, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Calendar, 
  Percent 
} from 'lucide-react'
import { toast } from 'sonner'

export function MitraFormDialog({ isOpen, onClose, users = [], outlets = [], initialData = null }: any) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formTab, setFormTab] = useState<'akses' | 'biodata' | 'bank' | 'pks'>('akses')

  // Form states
  const [userId, setUserId] = useState('')
  const [namaMitra, setNamaMitra] = useState('')
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([])
  
  const [nik, setNik] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [alamatDomisili, setAlamatDomisili] = useState('')

  const [bankName, setBankName] = useState('BCA')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountHolder, setBankAccountHolder] = useState('')

  const [noPks, setNoPks] = useState('')
  const [tanggalPks, setTanggalPks] = useState('')
  const [tanggalBerakhirPks, setTanggalBerakhirPks] = useState('')
  const [profitSharingPct, setProfitSharingPct] = useState(50)
  const [status, setStatus] = useState<'aktif' | 'nonaktif' | 'dalam_perpanjangan'>('aktif')

  useEffect(() => {
    if (isOpen) {
      setUserId(initialData?.user_id || '')
      setNamaMitra(initialData?.nama_mitra || '')
      setSelectedOutlets(initialData?.outlet_ids || [])
      
      setNik(initialData?.nik || '')
      setPhone(initialData?.phone || '')
      setEmail(initialData?.email || '')
      setAlamatDomisili(initialData?.alamat_domisili || '')

      setBankName(initialData?.bank_name || 'BCA')
      setBankAccountNumber(initialData?.bank_account_number || '')
      setBankAccountHolder(initialData?.bank_account_holder || '')

      setNoPks(initialData?.no_pks || '')
      setTanggalPks(initialData?.tanggal_pks || '')
      setTanggalBerakhirPks(initialData?.tanggal_berakhir_pks || '')
      setProfitSharingPct(initialData?.profit_sharing_pct ?? 50)
      setStatus(initialData?.status || 'aktif')
      setFormTab('akses')
    }
  }, [isOpen, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !namaMitra || selectedOutlets.length === 0) {
      setFormTab('akses')
      toast.error('Mohon lengkapi Akun User, Nama Mitra, dan minimal 1 Akses Outlet')
      return
    }

    setLoading(true)
    try {
      await upsertMitraProfile({
        user_id: userId,
        nama_mitra: namaMitra.trim(),
        outlet_ids: selectedOutlets,
        nik: nik.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        alamat_domisili: alamatDomisili.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        bank_account_number: bankAccountNumber.trim() || undefined,
        bank_account_holder: bankAccountHolder.trim() || undefined,
        no_pks: noPks.trim() || undefined,
        tanggal_pks: tanggalPks || undefined,
        tanggal_berakhir_pks: tanggalBerakhirPks || undefined,
        profit_sharing_pct: Number(profitSharingPct) || 50,
        status,
        previous_user_id: initialData?.user_id && initialData.user_id !== userId ? initialData.user_id : undefined
      })
      toast.success(initialData ? 'Profil mitra berhasil diperbarui' : 'Mitra baru berhasil ditambahkan')
      router.refresh()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan profil mitra')
    } finally {
      setLoading(false)
    }
  }

  const toggleOutlet = (id: string) => {
    if (selectedOutlets.includes(id)) {
      setSelectedOutlets(selectedOutlets.filter(oid => oid !== id))
    } else {
      setSelectedOutlets([...selectedOutlets, id])
    }
  }

  const selectAllOutlets = () => {
    setSelectedOutlets(outlets.map((o: any) => o.id))
  }

  const clearOutlets = () => {
    setSelectedOutlets([])
  }

  if (!isOpen) return null

  const isSelectedUserInList = users.some((u: any) => u.id === userId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 border border-amber-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {initialData ? 'Edit Data & Biodata Mitra' : 'Tambah Mitra Baru'}
              </h2>
              <p className="text-xs text-gray-500 font-normal">Konfigurasi akun, akses outlet, biodata, rekening & PKS</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFormTab('akses')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              formTab === 'akses' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Akun & Outlet</span>
          </button>

          <button
            type="button"
            onClick={() => setFormTab('biodata')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              formTab === 'biodata' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Biodata</span>
          </button>

          <button
            type="button"
            onClick={() => setFormTab('bank')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              formTab === 'bank' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Rekening</span>
          </button>

          <button
            type="button"
            onClick={() => setFormTab('pks')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              formTab === 'pks' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PKS & Bagi Hasil</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* TAB 1: AKUN & OUTLET */}
          {formTab === 'akses' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Akun Login Mitra (Role MITRA) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal text-gray-800 transition-all"
                >
                  <option value="">-- Pilih Akun Staf / User Mitra --</option>
                  {!isSelectedUserInList && userId && (
                    <option value={userId}>User ID: {userId.substring(0, 8)}...</option>
                  )}
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nama Tampilan Mitra <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={namaMitra}
                  onChange={(e) => setNamaMitra(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal placeholder-gray-400 transition-all"
                  placeholder="Contoh: Mitra Cicurug / Bpk. Hendra"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Akses Outlet Mitra ({selectedOutlets.length} Dipilih) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllOutlets}
                      className="text-[11px] font-semibold text-amber-600 hover:underline"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={clearOutlets}
                      className="text-[11px] font-medium text-gray-400 hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-2xl max-h-48 overflow-y-auto p-2.5 space-y-1.5 bg-gray-50/50">
                  {outlets.map((o: any) => {
                    const isSelected = selectedOutlets.includes(o.id)
                    return (
                      <div
                        key={o.id}
                        onClick={() => toggleOutlet(o.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-amber-100/80 text-amber-900 border border-amber-300 shadow-xs' 
                            : 'bg-white text-gray-700 hover:bg-gray-100/80 border border-gray-200/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Store className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-600' : 'text-gray-400'}`} />
                          <span>{o.name}</span>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BIODATA PRIBADI */}
          {formTab === 'biodata' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nomor Induk Kependudukan (NIK / KTP)
                </label>
                <input
                  type="text"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  maxLength={16}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-mono font-medium placeholder-gray-400"
                  placeholder="16 Digit NIK KTP"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal placeholder-gray-400"
                    placeholder="0812xxxx / 62812xxxx"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Email Kontak
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal placeholder-gray-400"
                    placeholder="mitra@sukashawarma.id"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Alamat Domisili Mitra
                </label>
                <textarea
                  rows={3}
                  value={alamatDomisili}
                  onChange={(e) => setAlamatDomisili(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal placeholder-gray-400 resize-none"
                  placeholder="Alamat lengkap sesuai KTP / tempat tinggal..."
                />
              </div>
            </div>
          )}

          {/* TAB 3: REKENING BANK */}
          {formTab === 'bank' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nama Bank Tujuan Transfer
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-semibold text-gray-800"
                >
                  <option value="BCA">BCA (Bank Central Asia)</option>
                  <option value="Mandiri">Bank Mandiri</option>
                  <option value="BRI">Bank Rakyat Indonesia (BRI)</option>
                  <option value="BNI">Bank Negara Indonesia (BNI)</option>
                  <option value="BSI">Bank Syariah Indonesia (BSI)</option>
                  <option value="CIMB">CIMB Niaga</option>
                  <option value="Permata">Bank Permata</option>
                  <option value="Lainnya">Bank Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-mono font-medium placeholder-gray-400"
                  placeholder="Contoh: 1234567890"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nama Pemilik Rekening (Atas Nama)
                </label>
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal placeholder-gray-400"
                  placeholder="Sesuai buku tabungan"
                />
              </div>
            </div>
          )}

          {/* TAB 4: PKS & BAGI HASIL */}
          {formTab === 'pks' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nomor Perjanjian Kerja Sama (No. PKS)
                </label>
                <input
                  type="text"
                  value={noPks}
                  onChange={(e) => setNoPks(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-mono font-medium placeholder-gray-400"
                  placeholder="Contoh: 001/PKS-SS/MITRA/2026"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Tanggal Mulai PKS
                  </label>
                  <input
                    type="date"
                    value={tanggalPks}
                    onChange={(e) => setTanggalPks(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Tanggal Berakhir PKS
                  </label>
                  <input
                    type="date"
                    value={tanggalBerakhirPks}
                    onChange={(e) => setTanggalBerakhirPks(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Persentase Bagi Hasil Mitra (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={profitSharingPct}
                      onChange={(e) => setProfitSharingPct(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-bold pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Status Kemitraan
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white font-semibold text-gray-800"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="dalam_perpanjangan">Dalam Perpanjangan</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/25 transition-all disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : (initialData ? 'Simpan Perubahan' : 'Tambah Mitra')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
